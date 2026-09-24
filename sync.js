/* =====================================================================
   ImmoCRM Pro — Motore di Sincronizzazione e Persistenza (sync.js)
   ---------------------------------------------------------------------
   Obiettivo: gli stessi dati (e gli stessi incroci) su PC, tablet e
   smartphone, con salvataggio sempre disponibile.

   Tre livelli di salvataggio:
     1. localStorage  → immediato, funziona anche offline
     2. IndexedDB     → capiente, con storico dei backup automatici
     3. Cloud         → Gist privato di GitHub (cifrato AES-GCM) oppure
                        un endpoint REST personale (es. Cloudflare Worker)

   Il merge è a livello di singolo record (ultimo aggiornamento vince)
   con "tombstone" per propagare le eliminazioni fra i dispositivi.
   ===================================================================== */
(function (global) {
'use strict';

var CFG_KEY   = 'immocrm_sync_cfg';
var SNAP_KEY  = 'immocrm_snap_v1';
var LS_MAIN   = 'immocrm_ls_main';
var LS_HIST   = 'immocrm_ls_hist';
var LS_KEYR   = 'immocrm_ls_key';
var LS_META   = 'immocrm_ls_meta';
var IDB_NAME  = 'immocrm';
var IDB_VER   = 1;
var HIST_MAX  = 24;
var HIST_MIN_GAP = 20 * 60 * 1000;      // max 1 snapshot ogni 20 minuti
var TOMB_MAX_AGE = 120 * 24 * 3600 * 1000; // conserva i tombstone 120 giorni
var PUSH_DEBOUNCE = 2500;
var KDF_ITER  = 210000;
var FILE_NAME = 'immocrm.json';

var cfg = { mode: 'off', gistId: '', token: '', apiBase: 'https://api.github.com', encrypt: true, autoPullMin: 1, restUrl: '' };
var mainLsKey = 'immocrm_pro_v10';   // chiave localStorage usata dall'app (allineata con app.js)
var snap = { rec: {}, fld: {} };
var deviceId = '', deviceName = '';
var masterKey = null, masterSalt = null;
var idb = null, idbBroken = false;
var hooks = { getDb: null, applyDb: null, onStatus: null };
var state = { mode: 'off', state: 'off', lastSync: 0, lastPush: 0, lastPull: 0, lastError: '', pending: false, remoteTs: 0, bytes: 0, encrypted: false };
var busy = false, again = false, pushTimer = null, pullTimer = null, started = false;
var localFresh = true;      // vero se su questo dispositivo non c'erano dati
var listeners = [];

/* ---------- utilities ---------- */
function clone(o) {
  try { return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o)); }
  catch (e) { return JSON.parse(JSON.stringify(o)); }
}
function now() { return Date.now(); }
function b64enc(buf) {
  var bytes = new Uint8Array(buf), s = '', i;
  for (i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return (typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64'));
}
function b64dec(str) {
  var bin = (typeof atob === 'function' ? atob(str) : Buffer.from(str, 'base64').toString('binary'));
  var out = new Uint8Array(bin.length), i;
  for (i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function randBytes(n) {
  var c = getCrypto();
  if (c && c.getRandomValues) { var a = new Uint8Array(n); c.getRandomValues(a); return a; }
  var out = new Uint8Array(n); for (var i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256); return out;
}
function getCrypto() {
  return (typeof globalThis !== 'undefined' && globalThis.crypto) || (global.window && global.window.crypto) || null;
}
function getSubtle() {
  var c = getCrypto();
  return (c && (c.subtle || (c.webcrypto && c.webcrypto.subtle))) || null;
}
function djb2(str) {
  var h = 5381, i;
  for (i = 0; i < str.length; i++) h = (((h << 5) + h) + str.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36);
}
function stableString(o) {
  if (o === null || typeof o !== 'object') return JSON.stringify(o);
  if (Array.isArray(o)) return '[' + o.map(stableString).join(',') + ']';
  var keys = Object.keys(o).sort(), out = [], i;
  for (i = 0; i < keys.length; i++) out.push(JSON.stringify(keys[i]) + ':' + stableString(o[keys[i]]));
  return '{' + out.join(',') + '}';
}
function isMeta(k) { return k.charAt(0) === '_'; }
function arrayCols(db) {
  var out = [];
  if (!db || typeof db !== 'object') return out;
  Object.keys(db).forEach(function (k) {
    if (isMeta(k)) return;
    var v = db[k];
    if (Array.isArray(v)) out.push(k);
  });
  return out;
}
function tsOf(rec) { return (rec && typeof rec.updatedAt === 'number') ? rec.updatedAt : 0; }
function emit() { listeners.forEach(function (f) { try { f(state); } catch (e) { /* noop */ } }); }
function set(partial) {
  Object.keys(partial).forEach(function (k) { state[k] = partial[k]; });
  emit();
  if (hooks.onStatus) { try { hooks.onStatus(state); } catch (e) { /* noop */ } }
}
function SyncError(status, message) { this.status = status; this.message = message; this.name = 'SyncError'; }
SyncError.prototype = Object.create(Error.prototype);

/* ---------- IndexedDB (con fallback localStorage) ---------- */
function openIDB() {
  return new Promise(function (resolve) {
    if (idb) return resolve(idb);
    if (idbBroken || typeof indexedDB === 'undefined') return resolve(null);
    var req;
    try { req = indexedDB.open(IDB_NAME, IDB_VER); } catch (e) { idbBroken = true; return resolve(null); }
    req.onupgradeneeded = function () {
      var db = req.result;
      ['main', 'history', 'keyring', 'meta'].forEach(function (s) { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s); });
    };
    req.onsuccess = function () { idb = req.result; idb.onclose = function () { idb = null; }; resolve(idb); };
    req.onerror = function () { idbBroken = true; resolve(null); };
    req.onblocked = function () { idbBroken = true; resolve(null); };
    setTimeout(function () { if (!idb) { idbBroken = true; resolve(null); } }, 4000);
  });
}
function idbGet(store, key) {
  return openIDB().then(function (db) {
    if (!db) return undefined;
    return new Promise(function (resolve) {
      var done = false;
      var fin = function (v) { if (!done) { done = true; resolve(v); } };
      try {
        var r = db.transaction(store, 'readonly').objectStore(store).get(key);
        r.onsuccess = function () { fin(r.result); };
        r.onerror = function () { fin(undefined); };
      } catch (e) { fin(undefined); }
      setTimeout(function () { fin(undefined); }, 4000);
    });
  });
}
function idbPut(store, key, val) {
  return openIDB().then(function (db) {
    if (!db) return false;
    return new Promise(function (resolve) {
      var done = false;
      var fin = function (v) { if (!done) { done = true; resolve(v); } };
      try {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(val, key);
        tx.oncomplete = function () { fin(true); };
        tx.onerror = function () { fin(false); };
        tx.onabort = function () { fin(false); };
      } catch (e) { fin(false); }
      setTimeout(function () { fin(false); }, 5000);
    });
  });
}
function idbAllKeys(store) {
  return openIDB().then(function (db) {
    if (!db) return [];
    return new Promise(function (resolve) {
      try {
        var r = db.transaction(store, 'readonly').objectStore(store).getAllKeys();
        r.onsuccess = function () { resolve(r.result || []); };
        r.onerror = function () { resolve([]); };
      } catch (e) { resolve([]); }
    });
  });
}
function idbDel(store, key) {
  return openIDB().then(function (db) {
    if (!db) return false;
    return new Promise(function (resolve) {
      try {
        var tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      } catch (e) { resolve(false); }
    });
  });
}
function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : undefined; } catch (e) { return undefined; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

/* ---------- cifratura ---------- */
function deriveKey(password, saltB64, iter) {
  var subtle = getSubtle();
  if (!subtle || !password) return Promise.resolve(null);
  var enc = new TextEncoder();
  return subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
    .then(function (base) {
      return subtle.deriveKey(
        { name: 'PBKDF2', salt: b64dec(saltB64), iterations: iter || KDF_ITER, hash: 'SHA-256' },
        base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    });
}
function importKeyRaw(keyB64) {
  var subtle = getSubtle();
  if (!subtle) return Promise.resolve(null);
  return subtle.importKey('raw', b64dec(keyB64), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}
function exportKeyRaw(key) {
  var subtle = getSubtle();
  if (!subtle) return Promise.resolve('');
  return subtle.exportKey('raw', key).then(b64enc);
}
function encryptJSON(obj, key) {
  var subtle = getSubtle();
  if (!subtle || !key) return Promise.resolve(null);
  var iv = randBytes(12);
  return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, new TextEncoder().encode(JSON.stringify(obj)))
    .then(function (ct) { return { iv: b64enc(iv), ct: b64enc(ct) }; });
}
function decryptJSON(cipher, key) {
  var subtle = getSubtle();
  if (!subtle || !key || !cipher) return Promise.resolve(null);
  return subtle.decrypt({ name: 'AES-GCM', iv: b64dec(cipher.iv) }, key, b64dec(cipher.ct))
    .then(function (buf) { return JSON.parse(new TextDecoder().decode(buf)); })
    .catch(function () { return null; });
}

/* ---------- tracciamento modifiche (per il merge) ---------- */
function track(db) {
  if (!db || typeof db !== 'object') return;
  var t = now(), next = { rec: {}, fld: {} }, self = this;
  db._fieldTs = db._fieldTs || {};
  db._tomb = db._tomb || {};

  Object.keys(db).forEach(function (k) {
    if (isMeta(k)) return;
    var v = db[k];
    if (!Array.isArray(v)) {
      var fh = djb2(stableString(v));
      if (snap.fld[k] !== fh) { snap.fld[k] = fh; db._fieldTs[k] = t; }
      next.fld[k] = fh;
      return;
    }
    var seen = {}, i, rec;
    for (i = 0; i < v.length; i++) {
      rec = v[i];
      if (!rec || typeof rec !== 'object' || rec.id === undefined || rec.id === null) continue;
      var id = String(rec.id);
      seen[id] = 1;
      var h = djb2(stableString(rec));
      var key = k + '#' + id;
      if (snap.rec[key] !== h) {
        rec.updatedAt = t;                     // marca il record come modificato
        if (db._tomb[k] && db._tomb[k][id]) delete db._tomb[k][id]; // "riesumato"
      }
      next.rec[key] = djb2(stableString(rec)); // hash DOPO l'eventuale bump
    }
    // eliminazioni → tombstone, così la cancellazione arriva anche agli altri dispositivi
    Object.keys(snap.rec).forEach(function (key) {
      if (key.indexOf(k + '#') !== 0) return;
      var id = key.slice(k.length + 1);
      if (seen[id]) return;
      db._tomb[k] = db._tomb[k] || {};
      if (!db._tomb[k][id]) db._tomb[k][id] = t;
      delete snap.rec[key];
    });
  });

  // pulizia tombstone vecchi
  Object.keys(db._tomb || {}).forEach(function (col) {
    Object.keys(db._tomb[col]).forEach(function (id) {
      if (t - db._tomb[col][id] > TOMB_MAX_AGE) delete db._tomb[col][id];
    });
    if (!Object.keys(db._tomb[col]).length) delete db._tomb[col];
  });

  snap = next;
  persistSnap();
}
function persistSnap() { try { localStorage.setItem(SNAP_KEY, JSON.stringify(snap)); } catch (e) { /* quota: non bloccante */ } }
function loadSnap() { var s = lsGet(SNAP_KEY); snap = (s && s.rec && s.fld) ? s : { rec: {}, fld: {} }; }
/* Ricalibra la fotografia dei contenuti senza marcare nulla come modificato:
   si usa dopo aver ricevuto i dati dal cloud, altrimenti ogni record ricevuto
   sembrerebbe una modifica locale e vincerebbe sempre nel merge. */
function rebaseline(db) {
  if (!db) return snap;
  var next = { rec: {}, fld: {} };
  Object.keys(db).forEach(function (k) {
    if (isMeta(k)) return;
    var v = db[k];
    if (!Array.isArray(v)) { next.fld[k] = djb2(stableString(v)); return; }
    v.forEach(function (rec) {
      if (!rec || typeof rec !== 'object' || rec.id === undefined || rec.id === null) return;
      next.rec[k + '#' + String(rec.id)] = djb2(stableString(rec));
    });
  });
  snap = next;
  localFresh = false;
  persistSnap();
  return snap;
}

/* ---------- merge ---------- */
function isEmptyDB(db) {
  if (!db) return true;
  if (db._fieldTs && Object.keys(db._fieldTs).length) return false;
  return arrayCols(db).every(function (k) { return !db[k] || db[k].length === 0; });
}
function mergeTomb(a, b) {
  var out = {}, i, j;
  [a, b].forEach(function (src) {
    if (!src) return;
    Object.keys(src).forEach(function (col) {
      out[col] = out[col] || {};
      Object.keys(src[col]).forEach(function (id) {
        out[col][id] = Math.max(out[col][id] || 0, src[col][id] || 0);
      });
    });
  });
  Object.keys(out).forEach(function (col) { if (!Object.keys(out[col]).length) delete out[col]; });
  return out;
}
function mergeDB(local, remote) {
  if (isEmptyDB(local) && !isEmptyDB(remote)) return clone(remote);
  if (isEmptyDB(remote)) return clone(local);

  var out = clone(local);
  out._tomb = mergeTomb(local._tomb, remote._tomb);
  out._fieldTs = {};
  out._ts = Math.max(local._ts || 0, remote._ts || 0);

  var lf = local._fieldTs || {}, rf = remote._fieldTs || {}, i, k;
  var fieldKeys = {};
  Object.keys(lf).forEach(function (x) { fieldKeys[x] = 1; });
  Object.keys(rf).forEach(function (x) { fieldKeys[x] = 1; });
  Object.keys(fieldKeys).forEach(function (key) {
    var lt = lf[key] || 0, rt = rf[key] || 0;
    out._fieldTs[key] = Math.max(lt, rt);
    if (rt > lt && Object.prototype.hasOwnProperty.call(remote, key)) out[key] = clone(remote[key]);
  });
  // campi presenti solo nel cloud (es. primo collegamento da dispositivo nuovo)
  Object.keys(remote).forEach(function (key) {
    if (isMeta(key)) return;
    if (!Object.prototype.hasOwnProperty.call(out, key)) out[key] = clone(remote[key]);
  });

  var cols = {};
  arrayCols(local).forEach(function (c) { cols[c] = 1; });
  arrayCols(remote).forEach(function (c) { cols[c] = 1; });

  Object.keys(cols).forEach(function (col) {
    var l = local[col] || [], r = remote[col] || [];
    var rmap = {};
    r.forEach(function (rec) { if (rec && rec.id !== undefined && rec.id !== null) rmap[String(rec.id)] = rec; });
    var outArr = [], seen = {}, noId = {}, j, rec, id;

    for (j = 0; j < l.length; j++) {
      rec = l[j];
      if (!rec || typeof rec !== 'object') continue;
      if (rec.id === undefined || rec.id === null) {
        var hs = djb2(stableString(rec));
        if (!noId[hs]) { noId[hs] = 1; outArr.push(clone(rec)); }
        continue;
      }
      id = String(rec.id);
      if (seen[id]) continue;
      seen[id] = 1;
      var other = rmap[id];
      outArr.push(other && tsOf(other) > tsOf(rec) ? clone(other) : clone(rec));
    }
    for (j = 0; j < r.length; j++) {
      rec = r[j];
      if (!rec || typeof rec !== 'object' || rec.id === undefined || rec.id === null) continue;
      id = String(rec.id);
      if (seen[id]) continue;
      seen[id] = 1;
      outArr.push(clone(rec));
    }
    var tomb = (out._tomb || {})[col] || {};
    out[col] = outArr.filter(function (rec) {
      if (rec.id === undefined || rec.id === null) return true;
      return (tomb[String(rec.id)] || 0) <= tsOf(rec);
    });
  });
  return out;
}

/* ---------- provider cloud ---------- */
function ghHeaders(extra) {
  var h = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json'
  };
  if (cfg.token) h['Authorization'] = 'Bearer ' + cfg.token;
  if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
  return h;
}
function ghMessage(status, body) {
  var m = '';
  try { m = (JSON.parse(body || '{}').message) || ''; } catch (e) { m = ''; }
  if (status === 401) return 'Token GitHub non valido o scaduto: creane uno nuovo (permesso "gist").';
  if (status === 403) return 'GitHub ha rifiutato la richiesta: ' + (m || 'permessi insufficienti o limite richieste raggiunto');
  if (status === 404) return 'Gist non trovato: collega di nuovo il cloud dalle Impostazioni.';
  if (status === 422) return 'Dati rifiutati da GitHub: ' + (m || 'contenuto non valido');
  return m || ('Errore GitHub (' + status + ')');
}
var GH_TIMEOUT = 20000; // v10.4.1: ogni richiesta di rete ha una durata massima —
// su rete mobile lenta/morta le finestre (recupero, cambio password, sync)
// non restano più in attesa indefinita: errori chiari e bottoni riutilizzabili.
function gistRequest(path, method, body) {
  var url = (cfg.apiBase || 'https://api.github.com').replace(/\/$/, '') + path;
  var opts = { method: method, headers: ghHeaders(), body: body ? JSON.stringify(body) : undefined };
  var to = null;
  if (typeof AbortController !== 'undefined') {
    var ctrl = new AbortController();
    to = setTimeout(function () { ctrl.abort(); }, GH_TIMEOUT);
    opts.signal = ctrl.signal;
  }
  var wrap = function (fn) { return function (x) { if (to) clearTimeout(to); return fn(x); }; };
  return fetch(url, opts)
    .then(wrap(function (r) {
      return r.text().then(function (txt) {
        if (!r.ok) throw new SyncError(r.status, ghMessage(r.status, txt));
        return txt ? JSON.parse(txt) : null;
      });
    }))
    .catch(wrap(function (e) {
      if (e && e.name === 'AbortError') throw new SyncError(0, 'Timeout: connessione a GitHub troppo lenta. Controlla la rete e riprova.');
      throw e;
    }));
}
var providers = {
  gist: {
    label: 'Gist GitHub (privato)',
    read: function () {
      if (!cfg.gistId) return Promise.resolve(null);
      return gistRequest('/gists/' + encodeURIComponent(cfg.gistId), 'GET').then(function (g) {
        var f = g && g.files && (g.files[FILE_NAME] || g.files[Object.keys(g.files)[0]]);
        if (!f) return null;
        if (f.truncated) {
          return fetch(f.raw_url).then(function (r) { return r.text(); }).then(function (t) { return { text: t, ts: Date.parse(g.updated_at || '') || 0, url: g.html_url }; });
        }
        return { text: f.content, ts: Date.parse(g.updated_at || '') || 0, url: g.html_url };
      });
    },
    write: function (text) {
      if (cfg.gistId) {
        var body = {}; body.files = {}; body.files[FILE_NAME] = { content: text };
        return gistRequest('/gists/' + encodeURIComponent(cfg.gistId), 'PATCH', body)
          .then(function (g) { return { id: cfg.gistId, url: g.html_url }; });
      }
      var create = { description: 'ImmoCRM Pro — archivio dati (privato, cifrato)', public: false, files: {} };
      create.files[FILE_NAME] = { content: text };
      return gistRequest('/gists', 'POST', create).then(function (g) {
        cfg.gistId = g.id;
        return saveCfg().then(function () { return { id: g.id, url: g.html_url }; });
      });
    },
    info: function () { return cfg.gistId ? 'gist ' + String(cfg.gistId).slice(0, 8) + '…' : 'nessun gist collegato'; }
  },
  rest: {
    label: 'Endpoint REST personale',
    read: function () {
      if (!cfg.restUrl) return Promise.resolve(null);
      var h = {}; if (cfg.token) h['Authorization'] = 'Bearer ' + cfg.token;
      return fetch(cfg.restUrl, { headers: h }).then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) throw new SyncError(r.status, 'Endpoint REST: HTTP ' + r.status);
        return r.text().then(function (t) { return { text: t, ts: Date.now(), url: cfg.restUrl }; });
      });
    },
    write: function (text) {
      if (!cfg.restUrl) return Promise.reject(new SyncError(0, 'Indirizzo endpoint REST mancante'));
      var h = { 'Content-Type': 'application/json' }; if (cfg.token) h['Authorization'] = 'Bearer ' + cfg.token;
      return fetch(cfg.restUrl, { method: 'PUT', headers: h, body: text }).then(function (r) {
        if (!r.ok) throw new SyncError(r.status, 'Endpoint REST: HTTP ' + r.status);
        return { id: cfg.restUrl, url: cfg.restUrl };
      });
    },
    info: function () { return cfg.restUrl || 'nessun endpoint'; }
  }
};
function provider() { return providers[cfg.mode] || null; }

/* ---------- envelope ---------- */
function buildEnvelope(db) {
  var base = { app: 'immocrm', v: 1, ts: now(), device: deviceId, deviceName: deviceName };
  if (cfg.encrypt && masterKey) {
    return encryptJSON(db, masterKey).then(function (c) {
      if (!c) throw new SyncError(0, 'Cifratura non disponibile in questo browser (serve HTTPS)');
      base.cipher = { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', salt: b64enc(masterSalt), iter: KDF_ITER, iv: c.iv, ct: c.ct };
      base.data = null;
      return base;
    });
  }
  base.cipher = null;
  base.data = db;
  return Promise.resolve(base);
}
function readEnvelope(env) {
  if (!env) return Promise.resolve(null);
  if (env.cipher) {
    if (!masterKey) return Promise.resolve({ error: 'locked', env: env });
    return decryptJSON(env.cipher, masterKey).then(function (data) {
      if (!data) return { error: 'badkey', env: env };
      return { data: data };
    });
  }
  return Promise.resolve({ data: env.data });
}

/* ---------- configurazione ---------- */
function saveCfg() {
  return idbPut('meta', 'cfg', cfg).then(function (ok) { if (!ok) lsSet(CFG_KEY, cfg); return cfg; });
}
function loadCfg() {
  return idbGet('meta', 'cfg').then(function (v) {
    if (!v) v = lsGet(CFG_KEY);
    if (v && typeof v === 'object') Object.keys(cfg).forEach(function (k) { if (v[k] !== undefined) cfg[k] = v[k]; });
    return cfg;
  });
}
function deviceLabel() {
  var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  var tipo = /iPad|Tablet/i.test(ua) ? 'Tablet' : /iPhone|Android.*Mobile|iPod/i.test(ua) ? 'Smartphone' : 'PC';
  var os = /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'macOS' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : '';
  var br = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /Chrome\//i.test(ua) ? 'Chrome' : /Safari\//i.test(ua) ? 'Safari' : /Firefox\//i.test(ua) ? 'Firefox' : 'Browser';
  return [tipo, os, br].filter(Boolean).join(' · ');
}
function loadMeta() {
  return idbGet('meta', 'device').then(function (v) {
    if (!v) v = lsGet(LS_META);
    if (v && v.id) { deviceId = v.id; deviceName = v.name || deviceLabel(); }
    else {
      deviceId = 'dev-' + b64enc(randBytes(6)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
      deviceName = deviceLabel();
      var m = { id: deviceId, name: deviceName };
      lsSet(LS_META, m);
      return idbPut('meta', 'device', m).then(function () { return m; });
    }
    return { id: deviceId, name: deviceName };
  });
}

/* ---------- chiave master ---------- */
function storeMaster(key, salt) {
  masterKey = key; masterSalt = salt;
  if (!key) return Promise.resolve(false);
  return exportKeyRaw(key).then(function (raw) {
    var rec = { salt: b64enc(salt), iter: KDF_ITER, key: raw, ts: now() };
    return idbPut('keyring', 'master', rec).then(function (ok) { if (!ok) lsSet(LS_KEYR, rec); return true; });
  });
}
function loadMaster() {
  return idbGet('keyring', 'master').then(function (rec) {
    if (!rec) rec = lsGet(LS_KEYR);
    if (!rec || !rec.key) return false;
    return importKeyRaw(rec.key).then(function (k) {
      if (!k) return false;
      masterKey = k; masterSalt = b64dec(rec.salt);
      return true;
    });
  });
}
function clearMaster() {
  masterKey = null; masterSalt = null;
  return idbDel('keyring', 'master').then(function () { try { localStorage.removeItem(LS_KEYR); } catch (e) { /* noop */ } return true; });
}

/* v10.3 — chiavi condivise tra dispositivi: stessa password + stessa sale
   (la sale viaggia nell'archivio cloud e nel codice dispositivo) = stessa
   chiave su tutti i dispositivi. Così il secondo dispositivo decifra senza
   errori e senza prompt. */
function unlockMaster(password, opts) {
  var o = opts || {};
  var salt = o.salt ? b64dec(o.salt) : ((o.keepSalt && masterSalt) ? masterSalt : randBytes(16));
  return deriveKey(password, b64enc(salt), KDF_ITER).then(function (key) {
    if (!key) throw new SyncError(0, 'Cifratura non disponibile (serve una connessione HTTPS)');
    return storeMaster(key, salt).then(function () {
      set({ encrypted: true });
      return true;
    });
  });
}
function rekeyFromEnv(password, env) {
  if (!env || !env.cipher) return Promise.resolve(false);
  return deriveKey(password, env.cipher.salt, env.cipher.iter).then(function (key) {
    if (!key) return false;
    return decryptJSON(env.cipher, key).then(function (data) {
      if (!data) return false;
      return storeMaster(key, b64dec(env.cipher.salt)).then(function () {
        set({ encrypted: true, lastError: '', state: 'ok' });
        return true;
      });
    });
  });
}
function importMasterRaw(keyB64, saltB64) {
  if (!keyB64 || !saltB64) return Promise.reject(new SyncError(0, 'Codice incompleto: manca la chiave di cifratura'));
  return importKeyRaw(keyB64).then(function (k) {
    if (!k) throw new SyncError(0, 'Chiave di cifratura non valida');
    masterKey = k; masterSalt = b64dec(saltB64);
    return storeMaster(k, masterSalt).then(function () {
      set({ encrypted: true });
      return true;
    });
  });
}
/* Assicura la chiave giusta per questo archivio partendo dalla password:
   se l'archivio esiste la ricava da quello (sale condivisa nel cloud),
   altrimenti ne crea una. Ritorna true/false, non lancia. */
function ensureMasterKey(password) {
  if (!password) return Promise.resolve(false);
  if (masterKey) return Promise.resolve(true);
  var p = provider();
  function crea() {
    return unlockMaster(password, { keepSalt: true }).then(function () { return true; }).catch(function () { return false; });
  }
  if (!p || cfg.mode === 'off') return crea();
  return p.read().then(function (res) {
    var env = null;
    if (res && res.text) { try { env = JSON.parse(res.text); } catch (e) { env = null; } }
    if (env && env.cipher) return rekeyFromEnv(password, env).catch(function () { return false; });
    return crea();
  }).catch(crea);
}

/* v10.4 — verifica LA PASSWORD contro l'archivio cloud: la chiave si ricava
   da password + sale condivisa salvata nell'archivio. Ritorna
   'ok' (decifra: adotta la chiave), 'badkey' (password sbagliata),
   'noarchive' (nessun archivio configurato), 'error' (rete/cripto).
   Non adotta mai una chiave sbagliata. */
function unlockFromCloud(password) {
  var p = provider();
  if (!password || !p || cfg.mode === 'off') return Promise.resolve('noarchive');
  return p.read().then(function (res) {
    var env = null;
    if (res && res.text) { try { env = JSON.parse(res.text); } catch (e) { env = null; } }
    if (!env || !env.cipher) return 'noarchive';
    return deriveKey(password, env.cipher.salt, env.cipher.iter).then(function (key) {
      if (!key) throw new SyncError(0, 'Cifratura non disponibile (serve una connessione HTTPS)');
      return decryptJSON(env.cipher, key).then(function (data) {
        if (!data) return 'badkey';
        return storeMaster(key, b64dec(env.cipher.salt)).then(function () {
          set({ encrypted: true, lastError: '', state: 'ok' });
          return 'ok';
        });
      });
    });
  }).catch(function () { return 'error'; });
}

/* v10.4 — adotta una NUOVA password di cifratura (cambio password o
   recupero): mantiene la sale condivisa, ricifra l'archivio cloud con la
   nuova chiave (se il vecchio archivio è ancora leggibile) e salva la
   nuova chiave locale. Ritorna true/false. */
function rekeyWithPassword(newPass) {
  if (!newPass) return Promise.resolve(false);
  var salt = masterSalt || randBytes(16);
  return deriveKey(newPass, b64enc(salt), KDF_ITER).then(function (nkey) {
    if (!nkey) throw new SyncError(0, 'Cifratura non disponibile (serve una connessione HTTPS)');
    var p = provider();
    function adotta() {
      return storeMaster(nkey, salt).then(function () {
        set({ encrypted: true, lastError: '', state: 'ok' });
        return true;
      });
    }
    if (!masterKey || !p || cfg.mode === 'off') return adotta();
    return p.read().then(function (res) {
      var env = null;
      if (res && res.text) { try { env = JSON.parse(res.text); } catch (e) { env = null; } }
      if (!env || !env.cipher) return adotta();
      return decryptJSON(env.cipher, masterKey).then(function (data) {
        if (!data) return adotta(); /* vecchio archivio non leggibile: riparte dai dati locali */
        var base = { app: 'immocrm', v: 1, ts: now(), device: deviceId, deviceName: deviceName };
        return encryptJSON(data, nkey).then(function (c) {
          base.cipher = { alg: 'AES-GCM', kdf: 'PBKDF2-SHA256', salt: b64enc(salt), iter: KDF_ITER, iv: c.iv, ct: c.ct };
          base.data = null;
          return p.write(JSON.stringify(base)).then(adotta);
        });
      });
    }).catch(adotta);
  }).catch(function (e) { console.warn('rekeyWithPassword', e); return false; });
}

/* ---------- boot ---------- */
function boot() {
  return openIDB().then(function () { return loadCfg(); })
    .then(loadMeta)
    .then(loadMaster)
    .then(function () { loadSnap(); return readBootDB(); })
    .then(function (res) {
      set({ mode: cfg.mode, state: cfg.mode === 'off' ? 'off' : 'idle', encrypted: !!(cfg.encrypt && masterKey) });
      return res;
    });
}
function readBootDB() {
  var lsDB = null;
  try { var raw = localStorage.getItem(mainLsKey); if (raw) lsDB = JSON.parse(raw); } catch (e) { lsDB = null; }
  return idbGet('main', 'db').then(function (mainRec) {
    /* v10.5: 'main' contiene l'inviluppo {db, ts} scritto da mirror() —
       qui lo scartocciamo (prima il confronto usava ._ts che non esiste
       nell'inviluppo: con la sola copia IndexedDB il boot partiva vuoto). */
    var idbDB = null, idbTs = 0;
    if (mainRec && typeof mainRec === 'object') {
      if (mainRec.db && typeof mainRec.db === 'object') { idbDB = mainRec.db; idbTs = mainRec.ts || mainRec.db._ts || 0; }
      else if (!mainRec.ts) { idbDB = mainRec; idbTs = mainRec._ts || 0; } /* formato diretto legacy */
    }
    var lsTs = (lsDB && lsDB._ts) || 0;
    var best = null, source = 'nuovo';
    if (lsDB && idbDB) best = idbTs > lsTs ? idbDB : lsDB;
    else best = idbDB || lsDB || null;
    if (best) source = (idbDB && best === idbDB) ? 'indexeddb' : 'localstorage';
    else {
      /* v10.5: copia principale E IndexedDB vuote (pulizia del PC?) →
         proviamo il fallback del mirror (LS_MAIN) e poi la doppia copia
         di emergenza. */
      var lsm = lsGet(LS_MAIN);
      if (lsm && lsm.db && typeof lsm.db === 'object') { best = lsm.db; source = 'localstorage'; }
      else {
        var emg = emergencyRead();
        if (emg.length) { best = emg[0].db; source = 'emergenza'; }
      }
    }
    localFresh = !best;
    return { db: best, fresh: !best, source: source };
  });
}

/* ---------- mirror locale + storico ---------- */
function mirror(db) {
  var payload = { db: db, ts: db._ts || now() };
  emergencyWrite(db, false);   /* v10.5: doppia copia di emergenza (throttled) */
  return idbPut('main', 'db', payload).then(function (ok) {
    if (!ok) lsSet(LS_MAIN, payload);
    return maybeSnapshot(db);
  });
}
function maybeSnapshot(db) {
  return idbGet('meta', 'lastSnap').then(function (last) {
    if (last && now() - last < HIST_MIN_GAP) return false;
    var rec = { ts: now(), counts: countsOf(db), device: deviceName };
    return idbPut('meta', 'lastSnap', rec.ts)
      .then(function () { return idbPut('history', rec.ts, { meta: rec, db: clone(db) }); })
      .then(function () { return pruneHistory(); });
  });
}
function pruneHistory() {
  return idbAllKeys('history').then(function (keys) {
    var nums = keys.map(Number).filter(function (n) { return !isNaN(n); }).sort(function (a, b) { return a - b; });
    var extra = nums.slice(0, Math.max(0, nums.length - HIST_MAX));
    return Promise.all(extra.map(function (k) { return idbDel('history', k); })).then(function () { return nums.length - extra.length; });
  });
}
function historyList() {
  return idbAllKeys('history').then(function (keys) {
    var nums = keys.map(Number).filter(function (n) { return !isNaN(n); }).sort(function (a, b) { return b - a; });
    return Promise.all(nums.slice(0, HIST_MAX).map(function (k) {
      return idbGet('history', k).then(function (v) { return v && v.meta ? v.meta : { ts: k }; });
    }));
  });
}
function historyGet(ts) { return idbGet('history', Number(ts)).then(function (v) { return v ? v.db : null; }); }
function countsOf(db) {
  var out = {};
  arrayCols(db).forEach(function (k) { out[k] = db[k].length; });
  return out;
}
function storageInfo() {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    return navigator.storage.estimate().then(function (e) {
      return { usage: e.usage || 0, quota: e.quota || 0, persisted: false };
    }).then(function (r) {
      if (navigator.storage.persisted) return navigator.storage.persisted().then(function (p) { r.persisted = !!p; return r; });
      return r;
    }).catch(function () { return { usage: 0, quota: 0, persisted: false }; });
  }
  return Promise.resolve({ usage: 0, quota: 0, persisted: false });
}

/* ---------- pull / push ---------- */
function pull(opts) {
  var p = provider();
  if (!p) { set({ state: 'off', mode: cfg.mode }); return Promise.resolve({ skipped: true }); }
  set({ state: 'syncing' });
  return p.read().then(function (res) {
    if (!res || !res.text) {
      set({ state: 'ok', lastPull: now(), lastSync: now(), lastError: '' });
      return { empty: true };
    }
    var env;
    try { env = JSON.parse(res.text); } catch (e) { throw new SyncError(0, 'Archivio cloud danneggiato'); }
    return readEnvelope(env).then(function (out) {
      if (out.error === 'locked' || out.error === 'badkey') {
        if (hooks.unlock) {
          return Promise.resolve(hooks.unlock(env, out.error)).then(function (ok) {
            if (ok) {
              set({ state: 'syncing', lastError: '' });
              return readEnvelope(env).then(function (o2) {
                if (o2.error) { set({ state: 'error', lastError: 'Password non corretta per i dati cloud.' }); return { locked: true }; }
                return applyRemote(o2.data, env, res);
              });
            }
            set({ state: 'error', lastError: 'Archivio cloud cifrato: inserisci la password nelle Impostazioni → Sincronizzazione.' });
            return { locked: true };
          });
        }
        set({ state: 'error', lastError: 'Archivio cloud cifrato: inserisci la password nelle Impostazioni → Sincronizzazione.' });
        return { locked: true };
      }
      return applyRemote(out.data, env, res);
    });
  }).catch(function (err) {
    set({ state: 'error', lastError: err && err.message ? err.message : 'Errore di connessione' });
    throw err;
  });
}
function applyRemote(remote, env, res) {
  remote = remote || {};
  state.remoteTs = remote._ts || env.ts || (res && res.ts) || now();
  var db = hooks.getDb ? hooks.getDb() : null;
  if (!db) return { data: remote };
  var merged = mergeDB(db, remote);
  merged._devices = mergeDevices(db._devices, remote._devices);
  merged._devices[deviceId] = { name: deviceName, ts: now() };
  var changed = stableString(stripVolatile(merged)) !== stableString(stripVolatile(db));
  if (changed && hooks.applyDb) hooks.applyDb(merged);
  set({ state: 'ok', lastPull: now(), lastSync: now(), lastError: '', encrypted: !!env.cipher, mode: cfg.mode });
  return { merged: changed, counts: countsOf(merged) };
}
function stripVolatile(db) {
  var c = clone(db);
  delete c._ts; delete c._devices;
  return c;
}
function mergeDevices(a, b) {
  var out = {}, k;
  [a, b].forEach(function (src) { if (src) for (k in src) if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k]; });
  return out;
}
function push() {
  var p = provider();
  if (!p) return Promise.resolve({ skipped: true });
  var db = hooks.getDb ? hooks.getDb() : null;
  if (!db) return Promise.resolve({ skipped: true });
  if (cfg.encrypt && !masterKey) {
    set({ state: 'error', lastError: 'Cifratura attiva ma chiave non disponibile: reinserisci la password.' });
    return Promise.resolve({ locked: true });
  }
  set({ state: 'syncing', pending: false });
  var payload;
  db._devices = db._devices || {};
  db._devices[deviceId] = { name: deviceName, ts: now() };
  return buildEnvelope(db).then(function (env) {
    payload = JSON.stringify(env);
    state.bytes = payload.length;
    return p.write(payload);
  }).then(function (info) {
    set({ state: 'ok', lastPush: now(), lastSync: now(), lastError: '', pending: false, remoteTs: now() });
    return { ok: true, id: info && info.id, bytes: state.bytes };
  }).catch(function (err) {
    set({ state: 'error', lastError: err && err.message ? err.message : 'Errore di invio', pending: true });
    throw err;
  });
}
function syncNow(reason) {
  if (cfg.mode === 'off' || !provider()) { set({ state: 'off', mode: cfg.mode }); return Promise.resolve({ skipped: true }); }
  if (busy) { again = true; return Promise.resolve({ deferred: true }); }
  busy = true; again = false;
  set({ state: 'syncing', mode: cfg.mode });
  return pull({ reason: reason })
    .then(function () { return push(); })
    .catch(function () { return null; })
    .then(function (res) {
      busy = false;
      if (again) { again = false; return syncNow(reason); }
      return res;
    });
}
function onLocalChange() {
  set({ pending: true });
  if (cfg.mode === 'off' || !provider()) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(function () {
    pushTimer = null;
    syncNow('auto').catch(function () { /* lo stato è già aggiornato */ });
  }, PUSH_DEBOUNCE);
}
function flushNow() {
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  return syncNow('flush').catch(function () { return null; });
}
function startAuto() {
  if (pullTimer) clearInterval(pullTimer);
  var min = Math.max(1, parseInt(cfg.autoPullMin, 10) || 5);
  pullTimer = setInterval(function () {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (cfg.mode === 'off' || busy) return;
    pull({ reason: 'periodico' }).catch(function () { /* noop */ });
  }, min * 60 * 1000);
}

/* =====================================================================
   v10.5 — GENERATORE QR CODE INTEGRATO (nessuna libreria esterna:
   l'app funziona anche offline). Byte mode, versioni 1-40, livelli
   L/M/Q/H. Serve per mostrare nel pannello Sincronizzazione un QR che
   apre l'app sul telefono col codice dispositivo GIA' INSERITO
   (#codice=IMMOCRM1.…): sul telefono basta scrivere la password.
   Tabelle blocchi/ECC: ISO/IEC 18004 (stesse della letteratura nota).
   ===================================================================== */
var QR_EC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
/* righe = livello ECC (L,M,Q,H) — colonne = versione 1..40 (indice 0 = padding) */
var QR_ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];
var QR_NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];
var QR_FORMAT_BITS = [1, 0, 3, 2]; /* L,M,Q,H → bit nel formato */
function qrGetBit(x, i) { return ((x >>> i) & 1) !== 0; }
function qrRawModules(ver) {
  var r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    var na = Math.floor(ver / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
function qrDataCodewords(ver, ecl) {
  return Math.floor(qrRawModules(ver) / 8) - QR_ECC_PER_BLOCK[ecl][ver] * QR_NUM_BLOCKS[ecl][ver];
}
function qrAlignPositions(ver) {
  if (ver === 1) return [];
  var na = Math.floor(ver / 7) + 2;
  var step = (ver === 32) ? 26 : Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2;
  var res = [6], pos;
  for (pos = ver * 4 + 10; res.length < na; pos -= step) res.splice(1, 0, pos);
  return res;
}
function qrRsMultiply(x, y) {
  var z = 0, i;
  for (i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z;
}
function qrRsDivisor(degree) {
  var res = [], i, j, root = 1;
  for (i = 0; i < degree - 1; i++) res.push(0);
  res.push(1);
  for (i = 0; i < degree; i++) {
    for (j = 0; j < res.length; j++) {
      res[j] = qrRsMultiply(res[j], root);
      if (j + 1 < res.length) res[j] ^= res[j + 1];
    }
    root = qrRsMultiply(root, 0x02);
  }
  return res;
}
function qrRsRemainder(data, divisor) {
  var res = divisor.map(function () { return 0; }), i, j;
  for (i = 0; i < data.length; i++) {
    var factor = data[i] ^ res.shift();
    res.push(0);
    for (j = 0; j < divisor.length; j++) res[j] ^= qrRsMultiply(divisor[j], factor);
  }
  return res;
}
function qrAppendBits(val, len, bb) { for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); }
function qrCci(ver) { return ver <= 9 ? 8 : 16; } /* byte mode: 8 bit (v1-9), 16 bit (v10-40) */
function qrUtf8Bytes(s) {
  if (typeof TextEncoder !== 'undefined') {
    var u = new TextEncoder().encode(s), out0 = [], i0;
    for (i0 = 0; i0 < u.length; i0++) out0.push(u[i0]);
    return out0;
  }
  var out = [], i;
  for (i = 0; i < s.length; i++) {
    var c = s.codePointAt(i); if (c > 0xFFFF) i++;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function qrAddEcc(data, ver, ecl) {
  var numBlocks = QR_NUM_BLOCKS[ecl][ver];
  var eccLen = QR_ECC_PER_BLOCK[ecl][ver];
  var raw = Math.floor(qrRawModules(ver) / 8);
  var numShort = numBlocks - raw % numBlocks;
  var shortLen = Math.floor(raw / numBlocks);
  var div = qrRsDivisor(eccLen);
  var blocks = [], k = 0, i, j;
  for (i = 0; i < numBlocks; i++) {
    var datLen = shortLen - eccLen + (i < numShort ? 0 : 1);
    var dat = data.slice(k, k + datLen); k += datLen;
    var ecc = qrRsRemainder(dat, div);
    if (i < numShort) dat.push(0); /* segnaposto per l'interleave */
    blocks.push(dat.concat(ecc));
  }
  var out = [];
  for (i = 0; i < blocks[0].length; i++) {
    for (j = 0; j < blocks.length; j++) {
      if (i !== shortLen - eccLen || j >= numShort) out.push(blocks[j][i]);
    }
  }
  return out;
}
function qrPenalty(mod, size) {
  var N1 = 3, N2 = 3, N3 = 40, N4 = 10, result = 0, x, y;
  function addHist(len, hist) { if (hist[0] === 0) len += size; hist.pop(); hist.unshift(len); }
  function countPat(hist) {
    var n = hist[1];
    var core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
    return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0) + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0);
  }
  function termCount(color, len, hist) { if (color) { addHist(len, hist); len = 0; } len += size; addHist(len, hist); return countPat(hist); }
  for (y = 0; y < size; y++) {
    var runColor = false, runX = 0, hist = [0, 0, 0, 0, 0, 0, 0];
    for (x = 0; x < size; x++) {
      if (mod[y][x] === runColor) { runX++; if (runX === 5) result += N1; else if (runX > 5) result++; }
      else { addHist(runX, hist); if (!runColor) result += countPat(hist) * N3; runColor = mod[y][x]; runX = 1; }
    }
    result += termCount(runColor, runX, hist) * N3;
  }
  for (x = 0; x < size; x++) {
    var runColor2 = false, runY = 0, hist2 = [0, 0, 0, 0, 0, 0, 0];
    for (y = 0; y < size; y++) {
      if (mod[y][x] === runColor2) { runY++; if (runY === 5) result += N1; else if (runY > 5) result++; }
      else { addHist(runY, hist2); if (!runColor2) result += countPat(hist2) * N3; runColor2 = mod[y][x]; runY = 1; }
    }
    result += termCount(runColor2, runY, hist2) * N3;
  }
  for (y = 0; y < size - 1; y++) {
    for (x = 0; x < size - 1; x++) {
      var col = mod[y][x];
      if (col === mod[y][x + 1] && col === mod[y + 1][x] && col === mod[y + 1][x + 1]) result += N2;
    }
  }
  var dark = 0;
  for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (mod[y][x]) dark++;
  var total = size * size;
  var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += k * N4;
  return result;
}
function qrEncode(text, ecName) {
  var eclIdx = QR_EC_INDEX[String(ecName || 'M').toUpperCase().charAt(0)];
  if (eclIdx === undefined) eclIdx = 1;
  var bytes = qrUtf8Bytes(String(text == null ? '' : text));
  var ver, i;
  for (ver = 1; ver <= 40; ver++) {
    if (4 + qrCci(ver) + bytes.length * 8 <= qrDataCodewords(ver, eclIdx) * 8) break;
  }
  if (ver > 40) throw new SyncError(0, 'QR: testo troppo lungo (oltre la versione 40)');
  var bb = [];
  qrAppendBits(4, 4, bb); /* byte mode */
  qrAppendBits(bytes.length, qrCci(ver), bb);
  for (i = 0; i < bytes.length; i++) qrAppendBits(bytes[i], 8, bb);
  var cap = qrDataCodewords(ver, eclIdx) * 8;
  qrAppendBits(0, Math.min(4, cap - bb.length), bb);
  while (bb.length % 8 !== 0) bb.push(0);
  var data = [];
  for (i = 0; i < bb.length; i += 8) {
    var b = 0, j;
    for (j = 0; j < 8; j++) b = (b << 1) | bb[i + j];
    data.push(b);
  }
  for (i = 0; data.length * 8 < cap; i++) data.push(i % 2 === 0 ? 0xEC : 0x11);
  return qrDraw(qrAddEcc(data, ver, eclIdx), ver, eclIdx);
}
function qrDraw(allCw, ver, ecl) {
  var size = ver * 4 + 17, mod = [], fun = [], y, x, i;
  for (y = 0; y < size; y++) { mod.push(new Array(size).fill(false)); fun.push(new Array(size).fill(false)); }
  function setF(x2, y2, dark) { mod[y2][x2] = dark; fun[y2][x2] = true; }
  for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); } /* timing */
  function finder(cx, cy) {
    for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
      var dist = Math.max(Math.abs(dx), Math.abs(dy)), xx = cx + dx, yy = cy + dy;
      if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, dist !== 2 && dist !== 4);
    }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  var ap = qrAlignPositions(ver), n = ap.length, j;
  for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
    for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++)
      setF(ap[j] + dx2, ap[i] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
  }
  function drawFormat(mask) {
    var dataF = (QR_FORMAT_BITS[ecl] << 3) | mask, rem = dataF, t;
    for (t = 0; t < 10; t++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((dataF << 10) | rem) ^ 0x5412;
    for (t = 0; t <= 5; t++) setF(8, t, qrGetBit(bits, t));
    setF(8, 7, qrGetBit(bits, 6)); setF(8, 8, qrGetBit(bits, 7)); setF(7, 8, qrGetBit(bits, 8));
    for (t = 9; t < 15; t++) setF(14 - t, 8, qrGetBit(bits, t));
    for (t = 0; t < 8; t++) setF(size - 1 - t, 8, qrGetBit(bits, t));
    for (t = 8; t < 15; t++) setF(8, size - 15 + t, qrGetBit(bits, t));
    setF(8, size - 8, true); /* modulo sempre scuro */
  }
  function drawVersion() {
    if (ver < 7) return;
    var rem = ver, t;
    for (t = 0; t < 12; t++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    var bits = (ver << 12) | rem;
    for (t = 0; t < 18; t++) {
      var bit = qrGetBit(bits, t), a = size - 11 + t % 3, b = Math.floor(t / 3);
      setF(a, b, bit); setF(b, a, bit);
    }
  }
  drawFormat(0); drawVersion();
  var bi = 0, right, vert;
  for (right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (vert = 0; vert < size; vert++) {
      for (j = 0; j < 2; j++) {
        x = right - j;
        var upward = ((right + 1) & 2) === 0;
        y = upward ? size - 1 - vert : vert;
        if (!fun[y][x] && bi < allCw.length * 8) { mod[y][x] = qrGetBit(allCw[bi >>> 3], 7 - (bi & 7)); bi++; }
      }
    }
  }
  function maskBit(m, xx, yy) {
    switch (m) {
      case 0: return (xx + yy) % 2 === 0;
      case 1: return yy % 2 === 0;
      case 2: return xx % 3 === 0;
      case 3: return (xx + yy) % 3 === 0;
      case 4: return (Math.floor(xx / 3) + Math.floor(yy / 2)) % 2 === 0;
      case 5: return (xx * yy) % 2 + (xx * yy) % 3 === 0;
      case 6: return ((xx * yy) % 2 + (xx * yy) % 3) % 2 === 0;
      default: return ((xx + yy) % 2 + (xx * yy) % 3) % 2 === 0;
    }
  }
  function applyMask(m) {
    for (var yy2 = 0; yy2 < size; yy2++) for (var xx2 = 0; xx2 < size; xx2++)
      if (!fun[yy2][xx2] && maskBit(m, xx2, yy2)) mod[yy2][xx2] = !mod[yy2][xx2];
  }
  var bestMask = 0, bestPen = Infinity, m2;
  for (m2 = 0; m2 < 8; m2++) {
    applyMask(m2); drawFormat(m2);
    var pen = qrPenalty(mod, size);
    if (pen < bestPen) { bestPen = pen; bestMask = m2; }
    applyMask(m2); /* XOR è involutivo: annulla la maschera di prova */
  }
  applyMask(bestMask); drawFormat(bestMask);
  return { version: ver, ecl: 'LMQH'.charAt(ecl), mask: bestMask, size: size, modules: mod };
}
function qrMatrix(text, ec) { return qrEncode(text, ec || 'M'); }
function qrSvg(text, opts) {
  opts = opts || {};
  var q = (text && typeof text === 'object' && text.modules) ? text : qrEncode(text, opts.ec || 'M');
  var border = opts.border === undefined ? 4 : opts.border;
  var dim = q.size + border * 2, path = '', y, x;
  for (y = 0; y < q.size; y++) for (x = 0; x < q.size; x++)
    if (q.modules[y][x]) path += 'M' + (x + border) + ' ' + (y + border) + 'h1v1h-1z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges" role="img" aria-label="QR code ImmoCRM">' +
    '<rect width="' + dim + '" height="' + dim + '" fill="#ffffff"/><path d="' + path + '" fill="#000000"/></svg>';
}

/* =====================================================================
   v10.5 — PROTEZIONE DATI DA PULIZIA DEL COMPUTER
   1) StorageManager.persist(): chiediamo al browser il salvataggio
      PERSISTENTE → niente cancellazione automatica dei dati quando
      il browser "fa pulizie" o lo spazio si esaurisce.
   2) DOPPIA COPIA LOCALE DI EMERGENZA: a ogni mirror i dati finiscono
      anche in due chiavi localStorage separate (A e B). Se un
      programma di pulizia cancella la copia principale, al boot
      ripristiniamo dalla copia di emergenza più recente.
   ===================================================================== */
var EMG_A = 'immocrm_emg_a', EMG_B = 'immocrm_emg_b';
var EMG_MIN_GAP = 30 * 1000;   /* al massimo una doppia copia ogni 30 s */
var _lastEmg = 0;
function emergencyWrite(db, force) {
  db = db || (hooks.getDb ? hooks.getDb() : null);
  if (!db || typeof db !== 'object') return false;
  if (!force && now() - _lastEmg < EMG_MIN_GAP) return false;
  var payload = { ts: db._ts || now(), emg: 1, db: db };
  var a = lsSet(EMG_A, payload), b = lsSet(EMG_B, payload);
  if (a || b) _lastEmg = now();
  return !!(a && b);
}
function emgValid(v) {
  return !!(v && v.db && typeof v.db === 'object' && !Array.isArray(v.db) &&
    (arrayCols(v.db).length > 0 || v.db.settings || v.db._ts));
}
function emergencyRead() {
  var slots = [['a', EMG_A], ['b', EMG_B]], out = [], i;
  for (i = 0; i < slots.length; i++) {
    var v = lsGet(slots[i][1]);
    if (emgValid(v)) out.push({ slot: slots[i][0], ts: v.ts || (v.db && v.db._ts) || 0, db: v.db });
  }
  out.sort(function (p, q) { return q.ts - p.ts; });
  return out;
}
function emergencyClear() {
  try { localStorage.removeItem(EMG_A); localStorage.removeItem(EMG_B); } catch (e) { /* noop */ }
  _lastEmg = 0;
}
function requestPersist() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist)
      return Promise.resolve(navigator.storage.persist()).then(function (r) { return !!r; }).catch(function () { return false; });
  } catch (e) { /* noop */ }
  return Promise.resolve(false);
}
function isPersisted() {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persisted)
      return Promise.resolve(navigator.storage.persisted()).then(function (r) { return !!r; }).catch(function () { return false; });
  } catch (e) { /* noop */ }
  return Promise.resolve(false);
}
function verifyStorage() {
  var rep = { mainLS: { ok: false, ts: 0, size: 0 }, idb: { ok: false, ts: 0 }, emgA: { ok: false, ts: 0 }, emgB: { ok: false, ts: 0 }, storico: 0, persisted: false, persistSupported: false, usage: 0, quota: 0, ok: false };
  try {
    var raw = localStorage.getItem(mainLsKey);
    if (raw) { var d = JSON.parse(raw); rep.mainLS = { ok: !!(d && typeof d === 'object'), ts: (d && d._ts) || 0, size: raw.length }; }
  } catch (e) { /* resta ok:false */ }
  try {
    var ea = lsGet(EMG_A), eb = lsGet(EMG_B);
    if (emgValid(ea)) rep.emgA = { ok: true, ts: ea.ts || 0 };
    if (emgValid(eb)) rep.emgB = { ok: true, ts: eb.ts || 0 };
  } catch (e2) { /* resta ok:false */ }
  rep.persistSupported = !!(typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist);
  return idbGet('main', 'db').then(function (m) {
    if (m && m.db && typeof m.db === 'object') rep.idb = { ok: true, ts: m.ts || m.db._ts || 0 };
    return historyList();
  }).then(function (h) {
    rep.storico = h.length;
    return isPersisted();
  }).then(function (p) {
    rep.persisted = !!p;
    return storageInfo();
  }).then(function (si) {
    rep.usage = si.usage; rep.quota = si.quota;
    rep.ok = !!(rep.mainLS.ok || rep.idb.ok || rep.emgA.ok || rep.emgB.ok);
    return rep;
  }).catch(function () { return rep; });
}

/* ---------- API pubblica ---------- */
var Sync = {
  version: '1.1',
  boot: boot,
  track: track,
  rebaseline: rebaseline,
  adopt: function (db) { return rebaseline(db); },
  setStorageKey: function (k) { if (k) mainLsKey = k; return mainLsKey; },
  mirror: mirror,
  onLocalChange: onLocalChange,
  flushNow: flushNow,
  pull: function () { return pull({ reason: 'manuale' }).catch(function (e) { return { error: e && e.message }; }); },
  push: function () { return push().catch(function (e) { return { error: e && e.message }; }); },
  syncNow: syncNow,
  start: function (h) {
    hooks.getDb = h.getDb || null;
    hooks.applyDb = h.applyDb || null;
    hooks.onStatus = h.onStatus || null;
    hooks.unlock = h.unlock || null;
    started = true;
    set({ mode: cfg.mode, state: cfg.mode === 'off' ? 'off' : 'idle' });
    if (cfg.mode !== 'off') {
      syncNow('avvio');
      startAuto();
    }
    return Promise.resolve(state);
  },
  stop: function () { if (pullTimer) clearInterval(pullTimer); pullTimer = null; started = false; },
  status: function () { return state; },
  isStarted: function () { return started; },
  config: function () { return clone(cfg); },
  hasMasterKey: function () { return !!masterKey; },
  deviceId: function () { return deviceId; },
  deviceName: function () { return deviceName; },
  setDeviceName: function (n) {
    deviceName = String(n || '').slice(0, 40) || deviceLabel();
    var m = { id: deviceId, name: deviceName };
    lsSet(LS_META, m);
    return idbPut('meta', 'device', m).then(function () { return deviceName; });
  },
  /* v10.3 — codice dispositivo: porta su un altro dispositivo tutto quello
     che serve per collegarsi — token, archivio, chiave di cifratura + sale
     (condivise) e hash della password di accesso (mai la password stessa).
     extra.pass = {salt,iter,hash} dell'utente che genera il codice. */
  connectCode: function (extra) {
    if (cfg.mode === 'off' || !cfg.token) return Promise.resolve(null);
    /* v10.4 (formato v3): NON contiene più la chiave grezza (k) — con quella
       sola il codice poteva decifrare il cloud senza password. La chiave si
       ricava sempre da password + sale condivisa (s), quindi il codice è
       solo il "permesso di collegamento": serve (con la password) una volta,
       per collegare un dispositivo nuovo. */
    var o = { v: 3, m: cfg.mode, g: cfg.gistId, t: cfg.token, e: cfg.encrypt ? 1 : 0, r: cfg.restUrl };
    if (cfg.encrypt && masterSalt) o.s = b64enc(masterSalt);
    var p = extra && extra.pass;
    if (p && p.hash && p.salt) o.h = { salt: p.salt, iter: p.iter || KDF_ITER, hash: p.hash };
    return Promise.resolve('IMMOCRM1.' + b64enc(new TextEncoder().encode(JSON.stringify(o))));
  },
  /* Legge un codice senza effetti collaterali (schermata di accesso, test). */
  decodeConnectCode: function (str) {
    try {
      var s = String(str || '').trim();
      var tag = 'IMMOCRM1.';
      var i = s.indexOf(tag);
      if (i >= 0) s = s.slice(i + tag.length);
      s = s.replace(/\s+/g, '');
      if (!s) throw new Error('vuoto');
      var json = JSON.parse(new TextDecoder().decode(b64dec(s)));
      if (!json || typeof json !== 'object') throw new Error('non valido');
      return {
        mode: json.m || 'gist', token: json.t || '', gistId: json.g || '',
        encrypt: json.e !== 0, restUrl: json.r || '', apiBase: json.a || '',
        salt: json.s || '', key: json.k || '',
        pass: (json.h && json.h.hash && json.h.salt) ? { salt: json.h.salt, iter: json.h.iter || KDF_ITER, hash: json.h.hash } : null
      };
    } catch (e) { throw new SyncError(0, 'Codice di collegamento non valido'); }
  },
  /* Applica un codice: configura il cloud e, se presente, IMPORTA la chiave
     di cifratura condivisa (stessa chiave su tutti i dispositivi). */
  applyConnectCode: function (str) {
    var d;
    try { d = this.decodeConnectCode(str); } catch (e) { return Promise.reject(e); }
    var patch = { mode: d.mode || 'gist', token: d.token || '', gistId: d.gistId || '', encrypt: d.encrypt !== 0, restUrl: d.restUrl || '', apiBase: d.apiBase || cfg.apiBase };
    if (!patch.token) return Promise.reject(new SyncError(0, 'Il codice non contiene un permesso valido'));
    return this.setConfig(patch).then(function () {
      if (d.key && d.salt) return importMasterRaw(d.key, d.salt);
      return false;
    }).then(function () { return clone(cfg); });
  },
  /* Importa la chiave master già derivata (viene dal codice dispositivo). */
  importMaster: importMasterRaw,
  /* Prende in carico la chiave partendo dalla password (sale condivisa). */
  ensureMasterKey: ensureMasterKey,
  setConfig: function (patch) {
    Object.keys(patch || {}).forEach(function (k) { if (k in cfg) cfg[k] = patch[k]; });
    if (!cfg.encrypt) { /* resta in chiaro */ }
    return saveCfg().then(function () {
      if (cfg.mode === 'off') { set({ mode: 'off', state: 'off', lastError: '' }); if (pullTimer) clearInterval(pullTimer); }
      else { set({ mode: cfg.mode }); startAuto(); }
      return clone(cfg);
    });
  },
  /* Crea/collega la chiave di cifratura partendo dalla password dell'utente.
     opts.salt      → sale esplicito (quella condivisa nel codice dispositivo)
     opts.keepSalt  → riusa la sale già presente qui: stessa password + stessa
                      sale = stessa chiave su tutti i dispositivi (v10.3) */
  unlockWithPassword: function (password, opts) {
    return unlockMaster(password, opts);
  },
  rekeyFromEnvelope: function (password, env) {
    return rekeyFromEnv(password, env);
  },
  /* v10.4: verifica la password contro l'archivio cloud (sale condivisa). */
  unlockFromCloud: unlockFromCloud,
  /* v10.4: ricifra l'archivio con una nuova password (cambio/recupero). */
  rekeyWithPassword: rekeyWithPassword,
  lockMaster: clearMaster,
  historyList: historyList,
  historyGet: historyGet,
  storageInfo: storageInfo,
  /* v10.5 — QR code (generatore integrato, funziona anche offline):
     apre l'app sul telefono col codice dispositivo già inserito. */
  qr: {
    matrix: qrMatrix,
    svg: qrSvg,
    encode: qrEncode,
    dataCodewords: function (ver, ec) {
      var e = QR_EC_INDEX[String(ec || 'M').toUpperCase().charAt(0)];
      return qrDataCodewords(ver, e === undefined ? 1 : e);
    }
  },
  /* v10.5 — protezione dati da pulizia del computer:
     persistenza browser + doppia copia locale di emergenza + verifica. */
  requestPersist: requestPersist,
  isPersisted: isPersisted,
  verifyStorage: verifyStorage,
  emergencyWrite: function (db, force) { return emergencyWrite(db, !!force); },
  emergencyRead: emergencyRead,
  emergencyClear: emergencyClear,
  mergeDB: mergeDB,
  track_: track,
  providers: { gist: providers.gist.label, rest: providers.rest.label },
  onState: function (fn) { listeners.push(fn); },
  /* usato dai test: accesso alle parti interne senza esporle nell'UI */
  _internal: {
    cfg: function () { return cfg; },
    setHooks: function (h) {
      if (!h) return;
      if (h.getDb !== undefined) hooks.getDb = h.getDb;
      if (h.applyDb !== undefined) hooks.applyDb = h.applyDb;
      if (h.onStatus !== undefined) hooks.onStatus = h.onStatus;
      if (h.unlock !== undefined) hooks.unlock = h.unlock;
    },
    setSnap: function (s) { snap = s; },
    getSnap: function () { return snap; },
    providers: providers,
    buildEnvelope: buildEnvelope,
    readEnvelope: readEnvelope,
    deriveKey: deriveKey,
    encryptJSON: encryptJSON,
    decryptJSON: decryptJSON,
    isEmptyDB: isEmptyDB,
    stableString: stableString,
    idbGet: idbGet,
    idbPut: idbPut,
    openIDB: openIDB,
    lsGet: lsGet,
    countsOf: countsOf,
    deviceLabel: deviceLabel,
    FILE_NAME: FILE_NAME,
    KDF_ITER: KDF_ITER,
    /* v10.5: chiavi delle copie di emergenza + tabelle QR (per i test) */
    EMG_A: EMG_A,
    EMG_B: EMG_B,
    LS_MAIN: LS_MAIN,
    QR_ECC_PER_BLOCK: QR_ECC_PER_BLOCK,
    QR_NUM_BLOCKS: QR_NUM_BLOCKS,
    qrRawModules: qrRawModules,
    qrAlignPositions: qrAlignPositions,
    ghTimeout: function (ms) { if (ms) GH_TIMEOUT = ms; return GH_TIMEOUT; }
  }
};

global.ImmoSync = Sync;
if (typeof module !== 'undefined' && module.exports) module.exports = Sync;
})(typeof window !== 'undefined' ? window : globalThis);
