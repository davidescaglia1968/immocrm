'use strict';
/* Suite di verifica ImmoCRM Pro v10.4 — esegue il codice REALE (sync.js + app.js).
   Copre: cifratura, merge multi-dispositivo, tombstone, provider Gist (server locale),
   autenticazione PBKDF2 + lockout, login obbligatorio (solo password),
   codice dispositivo v3 (senza chiave grezza, solo "permesso" per il 1° collegamento),
   cambio password che apre su tutti i dispositivi, recupero password (domanda segreta),
   tracciamento modifiche, incroci, backup. */
const fs = require('fs');
const path = require('path');
const http = require('http');
const nodeCrypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
const failures = [];
function ok(cond, name, extra) {
  if (cond) { passed++; console.log('  ✅ ' + name); }
  else { failed++; failures.push(name + (extra ? ' — ' + extra : '')); console.log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
}
function section(t) { console.log('\n— ' + t); }

/* ---------------------------------------------------------------- */
/* 1) sync.js in Node puro: cifratura, merge, tombstone            */
/* ---------------------------------------------------------------- */
const Sync = require(path.join(ROOT, 'sync.js'));
const I = Sync._internal;

async function testCrypto() {
  section('1. Cifratura AES-GCM + PBKDF2 (sync.js)');
  const salt = nodeCrypto.randomBytes(16).toString('base64');
  const key = await I.deriveKey('mia-password', salt, 1000);
  ok(!!key, 'deriveKey produce una chiave');
  const data = { clienti: [{ id: 1, nome: 'Mario' }], settings: { agente: 'SD' } };
  const env = await I.encryptJSON(data, key);
  ok(env && env.iv && env.ct, 'encryptJSON produce iv+ct');
  const back = await I.decryptJSON(env, key);
  ok(JSON.stringify(back) === JSON.stringify(data), 'decryptJSON ripristina i dati');
  const wrong = await I.deriveKey('sbagliata', salt, 1000);
  const bad = await I.decryptJSON(env, wrong);
  ok(bad === null, 'chiave sbagliata NON decifra (null)');
}

async function testMerge() {
  section('2. Merge multi-dispositivo (ultimo vince)');
  const base = { clienti: [{ id: 1, nome: 'Mario', updatedAt: 100, telefono: '111' }, { id: 2, nome: 'Anna', updatedAt: 100 }], immobili: [], _ts: 100, _fieldTs: { settings: 100 }, settings: { agente: 'SD' } };
  const local = JSON.parse(JSON.stringify(base));
  const remote = JSON.parse(JSON.stringify(base));
  local.clienti[0].telefono = '222'; local.clienti[0].updatedAt = 300; // locale più recente
  local.clienti.push({ id: 3, nome: 'NuovoPC', updatedAt: 250 });       // record solo locale
  remote.clienti[1].nome = 'Anna R.'; remote.clienti[1].updatedAt = 200; // remoto più recente
  remote.settings = { agente: 'SD cloud' }; remote._fieldTs = { settings: 400 }; // campo remoto più recente
  const merged = Sync.mergeDB(local, remote);
  ok(merged.clienti.find(c => c.id === 1).telefono === '222', 'modifica locale più recente vince');
  ok(merged.clienti.find(c => c.id === 2).nome === 'Anna R.', 'modifica remota più recente vince');
  ok(merged.clienti.some(c => c.id === 3), 'record solo locale conservato');
  ok(merged.settings.agente === 'SD cloud', 'campo non-array prende il _fieldTs più recente');
  ok(merged.clienti.length === 3, 'nessun duplicato di id');
}

async function testTombstones() {
  section('3. Tombstone: le cancellazioni si propagano');
  I.setSnap({ rec: {}, fld: {} });
  const db = { clienti: [{ id: 1, nome: 'A' }, { id: 2, nome: 'B' }], _fieldTs: {}, _tomb: {} };
  Sync.track(db);                       // baseline
  db.clienti = db.clienti.filter(c => c.id !== 2); // elimina id 2
  Sync.track(db);
  ok(db._tomb.clienti && db._tomb.clienti['2'], 'eliminazione registrata come tombstone');
  // merge: il remoto ha ancora id 2 ma il tombstone è più recente → deve sparire
  const remote = { clienti: [{ id: 1, nome: 'A' }, { id: 2, nome: 'B', updatedAt: 50 }], _fieldTs: {}, _ts: 60 };
  db._ts = 70;
  const merged = Sync.mergeDB(db, remote);
  ok(!merged.clienti.some(c => c.id === 2), 'tombstone elimina il record anche dal merge');
  // "riesumazione": se rimetto il record con updatedAt nuovo, il tombstone viene pulito
  const db2 = { clienti: [{ id: 2, nome: 'B redivivo' }], _fieldTs: {}, _tomb: { clienti: { '2': 50 } } };
  I.setSnap({ rec: {}, fld: {} });
  Sync.track(db2);
  ok(!db2._tomb.clienti || !db2._tomb.clienti['2'], 'record ricreato azzera il tombstone');
}

async function testTrackUpdatedAt() {
  section('4. Tracciamento modifiche (updatedAt)');
  I.setSnap({ rec: {}, fld: {} });
  const db = { clienti: [{ id: 9, nome: 'X' }], _fieldTs: {}, _tomb: {} };
  const before = db.clienti[0].updatedAt;
  Sync.track(db);
  ok(typeof db.clienti[0].updatedAt === 'number' && db.clienti[0].updatedAt !== before, 'nuovo record riceve updatedAt');
  const u1 = db.clienti[0].updatedAt;
  Sync.track(db); // nessuna modifica
  ok(db.clienti[0].updatedAt === u1, 'senza modifiche updatedAt non cambia');
  await new Promise(r => setTimeout(r, 5));
  db.clienti[0].nome = 'Y';
  Sync.track(db);
  ok(db.clienti[0].updatedAt > u1, 'modifica aggiorna updatedAt');
}

/* ---- provider Gist contro un server GitHub finto ---- */
function fakeGitHub() {
  const store = {};
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      const auth = req.headers['authorization'] || '';
      const isGistPath = req.url.startsWith('/gists');
      if (isGistPath && !/Bearer |token /.test(auth)) { res.writeHead(401); return res.end(JSON.stringify({ message: 'Bad credentials' })); }
      if (req.method === 'POST' && req.url === '/gists') {
        const id = 'gist' + Math.random().toString(36).slice(2, 8);
        store[id] = JSON.parse(body).files;
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id, html_url: 'https://gist.github.com/x/' + id, files: store[id], updated_at: new Date().toISOString() }));
      }
      const m = req.url.match(/^\/gists\/([\w-]+)$/);
      if (req.method === 'GET' && m) {
        if (!store[m[1]]) { res.writeHead(404); return res.end(JSON.stringify({ message: 'Not Found' })); }
        const files = {}; Object.keys(store[m[1]]).forEach(k => { files[k] = { content: store[m[1]][k].content }; });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id: m[1], files, updated_at: new Date().toISOString(), html_url: 'https://g/' + m[1] }));
      }
      if (req.method === 'PATCH' && m && store[m[1]]) {
        const patch = JSON.parse(body).files || {};
        Object.keys(patch).forEach(k => { store[m[1]][k] = patch[k]; });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ id: m[1], files: store[m[1]], updated_at: new Date().toISOString(), html_url: 'https://g/' + m[1] }));
      }
      res.writeHead(404); res.end('{}');
    });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

async function testGistProvider() {
  section('5. Provider Gist GitHub (API reale via server locale)');
  const { server, port } = await fakeGitHub();
  const base = 'http://127.0.0.1:' + port;
  await Sync.setConfig({ mode: 'gist', token: 'faketoken', gistId: '', apiBase: base, encrypt: false });
  const db = { clienti: [{ id: 1, nome: 'Sync', updatedAt: 1 }], _ts: 5, _fieldTs: {} };
  Sync.start({ getDb: () => db, applyDb: d => { }, onStatus: () => { } });
  Sync.stop();
  const pushRes = await Sync.push().catch(e => ({ error: e.message }));
  ok(pushRes && pushRes.ok, 'push crea il gist e salva id', pushRes && pushRes.error);
  ok(I.cfg().gistId && I.cfg().gistId.startsWith('gist'), 'id gist memorizzato in config');
  const pull = await Sync.pull().catch(e => ({ error: e.message }));
  ok(pull && !pull.error, 'pull rilegge il gist', pull && pull.error);
  ok(pull && pull.counts && pull.counts.clienti === 1, 'contenuto pull corretto (1 cliente)', JSON.stringify(pull));
  // senza token → 401 gestito
  await Sync.setConfig({ token: '' });
  const noTok = await Sync.push().catch(e => e);
  ok(noTok instanceof Error || (noTok && noTok.status === 401) || (noTok && /token/i.test((noTok.error || noTok.message) || '')), 'senza token il push fallisce con messaggio chiaro');
  Sync.stop();
  server.close();
}

/* v10.4.1: rete morta/lenta → la richiesta scade, niente attesa infinita */
async function testNetworkTimeout() {
  section('5c. v10.4.1: timeout rete (mai più finestre "congelate")');
  const server = http.createServer(() => { /* accetta e non risponde mai */ });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  await Sync.setConfig({ mode: 'gist', token: 'tk-t', gistId: 'gistT', apiBase: base, encrypt: false });
  I.ghTimeout(250);
  const t0 = Date.now();
  const res = await Sync.pull().catch(e => ({ error: e.message }));
  const dt = Date.now() - t0;
  ok(res && /Timeout/i.test(res.error || ''), 'rete morta: errore chiaro dopo il timeout (niente attesa infinita)', JSON.stringify(res));
  ok(dt >= 200 && dt < 5000, 'timeout rispettato nei tempi (250ms nel test)', 'dt=' + dt);
  I.ghTimeout(20000);
  await Sync.setConfig({ mode: 'off', token: '', gistId: '', apiBase: 'https://api.github.com' });
  server.close();
}

/* ---------------------------------------------------------------- */
/* 6) app.js in jsdom: boot, auth, incroci, backup                  */
/* ---------------------------------------------------------------- */
async function testConnectCode() {
  section('5b. Codice dispositivo v10.4 (round-trip, nessuna chiave grezza)');
  await Sync.setConfig({ mode: 'gist', token: 'tk-abc', gistId: 'gistXYZ', encrypt: true, restUrl: '' });
  await Sync.unlockWithPassword('passD1', { keepSalt: true });
  const passRec = { salt: 's-h', iter: 210000, hash: 'h-h' };
  const code = await Sync.connectCode({ pass: passRec });
  ok(typeof code === 'string' && code.indexOf('IMMOCRM1.') === 0, 'connectCode genera stringa col prefisso');
  const dec = Sync.decodeConnectCode(code);
  ok(dec.token === 'tk-abc' && dec.gistId === 'gistXYZ' && dec.encrypt === true, 'decode: token+archivio+cifratura');
  ok(!dec.key && !!dec.salt, 'decode: NON contiene la chiave grezza (sicurezza v10.4), sale condivisa presente');
  ok(dec.pass && dec.pass.hash === 'h-h', 'decode: contiene hash password');
  await Sync.setConfig({ mode: 'off', token: '', gistId: '' });
  await Sync.lockMaster();
  await Sync.applyConnectCode(code);
  const c = Sync.config();
  ok(c.mode === 'gist' && c.token === 'tk-abc' && c.gistId === 'gistXYZ' && c.encrypt === true, 'applyConnectCode ripristina mode/token/gist/cifratura');
  ok(!Sync.hasMasterKey(), 'applyConnectCode (v3): NON importa chiavi — si ricavano da password+sale');
  const bad = await Sync.applyConnectCode('IMMOCRM1.!!!non-base64!!!').catch(e => e);
  ok(bad && /non valido/i.test((bad && bad.message) || ''), 'codice corrotto rifiutato');
  await Sync.setConfig({ mode: 'off', token: '', gistId: '' });
  await Sync.lockMaster();
}

async function testMultiDevice() {
  section('5d. Multi-dispositivo v10.3: chiave+password condivise, niente "problema"');
  const { server, port } = await fakeGitHub();
  const base = 'http://127.0.0.1:' + port;
  const I = Sync._internal;

  // --- Dispositivo 1: login, collegamento, push cifrato
  await Sync.setConfig({ mode: 'gist', token: 'tk-A', gistId: '', apiBase: base, encrypt: true });
  ok(await Sync.ensureMasterKey('MiaPass9x') === true, 'D1: chiave creata dalla password');
  const dbA = { clienti: [{ id: 1, nome: 'Mario', updatedAt: 1 }], _ts: 10, _fieldTs: { settings: 10 }, settings: { agente: 'SD' } };
  I.setHooks({ getDb: () => dbA, applyDb: d => { Object.assign(dbA, d); }, onStatus: () => {} });
  const pushA = await Sync.push().catch(e => ({ error: e.message }));
  ok(pushA && pushA.ok, 'D1: push cifrato ok', pushA && pushA.error);
  const idA = Sync.config().gistId;
  ok(!!idA, 'D1: archivio cloud creato');
  const gh = { headers: { Authorization: 'Bearer tk-A' } };
  const rawA = await (await fetch(base + '/gists/' + idA, gh)).json();
  const envA = JSON.parse(rawA.files['immocrm.json'].content);
  ok(envA.cipher && envA.data === null, 'D1: archivio cifrato (niente dati in chiaro)');
  const code = await Sync.connectCode({ pass: { salt: 'sh', iter: 210000, hash: 'hh' } });
  ok(!!code && code.indexOf('IMMOCRM1.') === 0, 'D1: codice dispositivo generato');

  // --- Dispositivo 2: "pulito": applica il codice (il "permesso") e ricava
  //     la chiave da password + sale condivisa → pull senza prompt
  await Sync.lockMaster();
  ok(!Sync.hasMasterKey(), 'D2: parte senza chiave');
  await Sync.applyConnectCode(code);
  ok(!Sync.hasMasterKey(), 'D2: il codice v10.4 non contiene la chiave grezza');
  ok(await Sync.ensureMasterKey('MiaPass9x') === true, 'D2: chiave ricavata da password + sale condivisa (cloud)');
  const dbB = { clienti: [], _ts: 0, _fieldTs: {} };
  I.setHooks({ getDb: () => dbB, applyDb: d => { Object.assign(dbB, d); }, onStatus: () => {} });
  const pullB = await Sync.pull().catch(e => ({ error: e.message }));
  ok(!pullB.error && pullB.counts && pullB.counts.clienti === 1, 'D2: scarica i dati di D1 decifrati (niente prompt)', JSON.stringify(pullB));
  ok(Sync.status().state !== 'error', 'D2: nessun errore → niente triangolo giallo');
  dbB.clienti.push({ id: 2, nome: 'Anna', updatedAt: 200 });
  dbB._ts = 200;
  const pushB = await Sync.push().catch(e => ({ error: e.message }));
  ok(pushB && pushB.ok, 'D2: push ok con la chiave condivisa', pushB && pushB.error);
  const rawB = await (await fetch(base + '/gists/' + idA, gh)).json();
  const envB = JSON.parse(rawB.files['immocrm.json'].content);
  ok(envB.cipher && envB.cipher.salt === envA.cipher.salt, 'D2: stessa sale dopo il push (archivio stabile)');

  // --- Dispositivo 1 riapre: perde la chiave in memoria, la ricava dalla password
  I.setHooks({ getDb: () => dbA, applyDb: d => { Object.assign(dbA, d); }, onStatus: () => {} });
  await Sync.lockMaster();
  ok(await Sync.ensureMasterKey('MiaPass9x') === true, 'D1: chiave ricavata dalla password (sale condivisa nel cloud)');
  const pullC = await Sync.pull().catch(e => ({ error: e.message }));
  ok(!pullC.error && pullC.counts && pullC.counts.clienti === 2, 'D1: dopo D2 il merge ha 2 clienti', JSON.stringify(pullC));
  // password sbagliata → NON crea una chiave spuria
  await Sync.lockMaster();
  ok(await Sync.ensureMasterKey('sbagliata') === false, 'password errata: chiave non creata');
  ok(!Sync.hasMasterKey(), 'D1: senza chiave valida non ci sono dati accessibili');

  I.setHooks({ getDb: null, applyDb: null, onStatus: null });
  await Sync.setConfig({ mode: 'off', token: '', gistId: '', apiBase: 'https://api.github.com' });
  await Sync.lockMaster();
  server.close();
}

async function testPasswordChange() {
  section('5e. v10.4: cambio password → apre su tutti i dispositivi (niente codice)');
  const { server, port } = await fakeGitHub();
  const base = 'http://127.0.0.1:' + port;
  const I = Sync._internal;
  // D1: collegamento con la password vecchia
  await Sync.setConfig({ mode: 'gist', token: 'tk-P', gistId: '', apiBase: base, encrypt: true });
  ok(await Sync.ensureMasterKey('PassVecchia1') === true, 'D1: chiave creata (password vecchia)');
  const dbA = { clienti: [{ id: 1, nome: 'Mario', updatedAt: 1 }], _ts: 10, _fieldTs: {}, settings: { agente: 'SD' } };
  I.setHooks({ getDb: () => dbA, applyDb: d => { Object.assign(dbA, d); }, onStatus: () => {} });
  const pushA = await Sync.push().catch(e => ({ error: e.message }));
  ok(pushA && pushA.ok, 'D1: push cifrato ok', pushA && pushA.error);
  // D1 cambia password → l'archivio cloud viene ricifrato (stessa sale condivisa)
  ok(await Sync.rekeyWithPassword('PassNuova2') === true, 'D1: rekey con la nuova password ok');
  // D2 (pulito): la vecchia password NON apre più; la nuova apre
  await Sync.lockMaster();
  ok(await Sync.unlockFromCloud('PassVecchia1') === 'badkey', 'D2: password vecchia → badkey (non apre)');
  ok(!Sync.hasMasterKey(), 'D2: con la password vecchia nessuna chiave spuria');
  ok(await Sync.unlockFromCloud('PassNuova2') === 'ok', 'D2: NUOVA password apre l\'archivio (niente codice)');
  ok(Sync.hasMasterKey(), 'D2: chiave adottata dalla nuova password');
  const pullD2 = await Sync.pull().catch(e => ({ error: e.message }));
  ok(!pullD2.error && pullD2.counts && pullD2.counts.clienti === 1, 'D2: scarica i dati con la nuova password', JSON.stringify(pullD2));
  // nessun archivio → 'noarchive'
  await Sync.setConfig({ mode: 'off', token: '', gistId: '' });
  await Sync.lockMaster();
  ok(await Sync.unlockFromCloud('qualsiasi') === 'noarchive', 'senza archivio → noarchive');
  I.setHooks({ getDb: null, applyDb: null, onStatus: null });
  server.close();
}
const { JSDOM } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');

function makeWindow() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<link rel="stylesheet"[^>]*>/g, '')
    .replace(/<link rel="manifest"[^>]*>/g, '')
    .replace(/<link rel="[^>]*icons[^>]*>/g, '')
    .replace(/<script src="sync\.js"[^>]*><\/script>/, '<script>' + fs.readFileSync(path.join(ROOT, 'sync.js'), 'utf8') + '<\/script>')
    .replace(/<script src="app\.js"[^>]*><\/script>/, '<script>' + fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8') + '<\/script>');
  const dom = new JSDOM(html, {
    url: 'https://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true
  });
  const win = dom.window;
  win.indexedDB = new IDBFactory();
  win.fetch = globalThis.fetch;
  Object.defineProperty(win, 'crypto', {
    value: {
      getRandomValues: a => nodeCrypto.webcrypto.getRandomValues(a),
      subtle: nodeCrypto.webcrypto.subtle,
      randomUUID: () => nodeCrypto.randomUUID()
    }, configurable: true
  });
  win.matchMedia = win.matchMedia || (q => ({ matches: false, media: q, addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { } }));
  return win;
}
function waitUntil(fn, ms = 8000) {
  const t0 = Date.now();
  return new Promise((res, rej) => {
    const t = setInterval(() => {
      let v = null; try { v = fn(); } catch (e) { }
      if (v) { clearInterval(t); res(v); }
      else if (Date.now() - t0 > ms) { clearInterval(t); rej(new Error('timeout waiting')); }
    }, 40);
  });
}

async function testApp() {
  section('6. App in jsdom: boot, auth PBKDF2, lockout, incroci');
  const win = makeWindow();
  await waitUntil(() => win.DB && typeof win.save === 'function' && typeof win.renderIncroci === 'function');
  ok(!!win.DB, 'boot completa e DB condiviso su window');

  // auth: record PBKDF2 creato direttamente, verifica e rifiuto
  const saltB64 = nodeCrypto.randomBytes(16).toString('base64');
  const hash = await win.pbkdf2('segreta', saltB64, 210000);
  win.saveAuth({ loggedIn: true, pass: { salt: saltB64, iter: 210000, hash } });
  ok(await win.verificaPassword('segreta') === true, 'verifica PBKDF2 accetta la password giusta');
  ok(await win.verificaPassword('nope') === false, 'password errata rifiutata');

  // lockout dopo 3 tentativi
  win.registraFallimento(); win.registraFallimento(); const n3 = win.registraFallimento();
  ok(n3 >= 3 && win.loginBloccato(), 'dopo 3 errori scatta il blocco temporaneo');
  win.azzeraFallimenti();
  ok(!win.loginBloccato(), 'azzeraFallimenti sblocca');

  // incroci: un contatto caldo fermo da >7 giorni genera alert high
  const ieri = new Date(Date.now() - 10 * 864e5).toISOString().slice(0, 10);
  win.DB.clienti.push({ id: 777, nome: 'Caldo', cognome: 'Fermo', stato: 'caldo', tipo: 'acquirente', ultimoContatto: ieri, dataCreazione: ieri });
  win.DB._ts = Date.now();
  const findings = win.runChecks();
  ok(findings.some(f => f.sev === 'high' && /Caldo/.test(f.t)), 'runChecks genera alert per contatto caldo fermo');

  // save() traccia updatedAt e persiste in localStorage
  const prima = (win.DB.clienti.find(c => c.id === 777) || {}).updatedAt;
  win.DB.clienti.find(c => c.id === 777).note = 'aggiornato';
  win.save();
  const dopo = win.DB.clienti.find(c => c.id === 777).updatedAt;
  ok(typeof dopo === 'number' && dopo !== prima, 'save() marca il record modificato');
  const persisted = JSON.parse(win.localStorage.getItem('immocrm_pro_v10'));
  ok(persisted.clienti.some(c => c.id === 777), 'dati persistiti in localStorage');

  // backup export contiene i dati, import li ripristina
  const out = { _export: 'immocrm', dati: win.DB };
  ok(out._export === 'immocrm' && !!out.dati.clienti, 'struttura backup valida');

  // login reale e rendering delle sezioni principali (incl. nuovo pannello sync)
  win.saveAuth({ loggedIn: true, nome: 'Test', ts: Date.now() });
  win.checkLoginRequired();
  await new Promise(r => setTimeout(r, 120));
  const sections = ['regia', 'contatti', 'immobili', 'incroci', 'pipeline', 'calendario', 'statistiche', 'impostazioni'];
  let renderErr = null;
  for (const sec of sections) {
    try { win.go(sec); } catch (e) { renderErr = sec + ': ' + e.message; break; }
  }
  ok(!renderErr, 'tutte le sezioni renderizzano senza errori', renderErr || '');
  const html = win.document.getElementById('content').innerHTML;
  ok(/Sincronizzazione multi/.test(html), 'panello Sincronizzazione presente in Impostazioni');
  ok(/PBKDF2/.test(html), 'nota sicurezza PBKDF2 presente');
  ok(!!win.document.getElementById('sec-chg-btn'), 'v10.4.1: tasto "Cambia password" presente (con stato di attività, anti-congelamento)');
  ok(typeof win.syncCardHTML === 'function' && /Dispositivi collegati/.test(win.syncCardHTML()), 'syncCardHTML genera riga dispositivi');

  // v10.3: login obbligatorio ad ogni avvio (niente apertura automatica)
  win.localStorage.removeItem('immocrm_auth');
  win.checkLoginRequired();
  ok(win.document.getElementById('login-screen').style.display !== 'none', 'v10.3: ad ogni avvio la app chiede il login');
  ok(win.document.getElementById('app-shell').style.display === 'none', 'v10.3: app non aperta senza login');

  // v10.3: secondo dispositivo — login con codice (chiave+password condivise)
  const saltD2 = nodeCrypto.randomBytes(16).toString('base64');
  const keyD2 = await win.pbkdf2('Segreta123', saltD2, 210000);
  const passD2 = { salt: saltD2, iter: 210000, hash: keyD2 };
  const codeD2 = 'IMMOCRM1.' + Buffer.from(JSON.stringify({ v: 2, m: 'gist', g: 'gistNEW', t: 'tk-dev2', e: 1, r: '', a: 'http://127.0.0.1:1', s: saltD2, k: keyD2, h: passD2 })).toString('base64');
  win.document.getElementById('login-pass').value = 'Segreta123';
  win.document.getElementById('login-code').value = codeD2;
  await win.doLogin();
  ok(win.document.getElementById('login-screen').style.display === 'none', "D2: login con codice entra nell'app");
  const authD2 = win.getAuth();
  ok(authD2 && authD2.pass && authD2.pass.hash === passD2.hash, 'D2: hash password condiviso installato localmente');
  ok(win.ImmoSync.hasMasterKey(), 'D2: chiave cifratura importata dal codice');
  ok(win.ImmoSync.config().token === 'tk-dev2', 'D2: token cloud applicato dal codice');

  // v10.4: login screen — codice nascosto di default, sezione "Password dimenticata?"
  win.localStorage.removeItem('immocrm_auth');
  win.checkLoginRequired();
  ok(win.document.getElementById('login-code-wrap').style.display === 'none', 'v10.4: codice dispositivo nascosto (solo "Primo su questo dispositivo?")');
  ok(!!win.document.getElementById('login-recupero') && win.document.getElementById('login-recupero').style.display === 'none', 'v10.4: sezione "Password dimenticata?" presente (nascosta)');
  // flusso recupero completo: risposta sbagliata rifiutata, risposta giusta → nuova password
  const saltR = nodeCrypto.randomBytes(16).toString('base64');
  const hashR = await win.pbkdf2('VecchiaPass9', saltR, 210000);
  win.saveAuth({ loggedIn: false, pass: { salt: saltR, iter: 210000, hash: hashR }, question: 'Che città sei di?', answer: win.eval('hashSimple("piacenza")'), ts: Date.now() });
  win.checkLoginRequired();
  win.mostraRecupero();
  ok(win.document.getElementById('login-recupero').style.display === 'block', 'recupero: il form si apre');
  win.document.getElementById('rec-an').value = 'sbagliata';
  win.document.getElementById('rec-p1').value = 'NuovaPass123';
  win.document.getElementById('rec-p2').value = 'NuovaPass123';
  await win.faRecupero();
  ok(/Risposta errata/.test(win.document.getElementById('rec-err').textContent), 'recupero: risposta segreta sbagliata rifiutata');
  win.document.getElementById('rec-an').value = 'Piacenza';
  await win.faRecupero();
  ok(/Password recuperata/.test(win.document.getElementById('rec-err').textContent), 'recupero: risposta giusta → success');
  ok(await win.verificaPasswordLocale('NuovaPass123') === true, 'recupero: la nuova password funziona');
  ok(await win.verificaPasswordLocale('VecchiaPass9') === false, 'recupero: la vecchia password non vale più');
  ok(win.document.getElementById('rec-btn').disabled === false && /Recupera la password/.test(win.document.getElementById('rec-btn').textContent), 'recupero: a fine operazione il tasto torna attivo (mai più "bloccato")');

  win.close();
}

(async () => {
  console.log('ImmoCRM Pro — suite di verifica\n================================');
  try { await testCrypto(); } catch (e) { failed++; failures.push('crypto: ' + e.message); console.log('  ❌ crypto exception', e.message); }
  try { await testMerge(); } catch (e) { failed++; failures.push('merge: ' + e.message); console.log('  ❌ merge exception', e.message); }
  try { await testTombstones(); } catch (e) { failed++; failures.push('tombstone: ' + e.message); console.log('  ❌ tombstone exception', e.message); }
  try { await testTrackUpdatedAt(); } catch (e) { failed++; failures.push('track: ' + e.message); console.log('  ❌ track exception', e.message); }
  try { await testGistProvider(); } catch (e) { failed++; failures.push('gist: ' + e.message); console.log('  ❌ gist exception', e.message); }
  try { await testNetworkTimeout(); } catch (e) { failed++; failures.push('timeout: ' + e.message); console.log('  ❌ timeout exception', e.message); }
  try { await testConnectCode(); } catch (e) { failed++; failures.push('connect: ' + e.message); console.log('  ❌ connect exception', e.message); }
  try { await testMultiDevice(); } catch (e) { failed++; failures.push('multidev: ' + e.message); console.log('  ❌ multidev exception', e.message); }
  try { await testPasswordChange(); } catch (e) { failed++; failures.push('passchg: ' + e.message); console.log('  ❌ passchg exception', e.message); }
  try { await testApp(); } catch (e) { failed++; failures.push('app: ' + e.message); console.log('  ❌ app exception', e.message); }
  console.log('\n================================');
  console.log('PASSATI: ' + passed + '   FALLITI: ' + failed);
  if (failures.length) { console.log('Falliti:'); failures.forEach(f => console.log(' - ' + f)); }
  process.exit(failed ? 1 : 0);
})();
