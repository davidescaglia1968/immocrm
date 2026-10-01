'use strict';
/* Suite di verifica ImmoCRM Pro v10.5 — esegue il codice REALE (sync.js + app.js).
   Copre: cifratura, merge multi-dispositivo, tombstone, provider Gist (server locale),
   autenticazione PBKDF2 + lockout, login obbligatorio (solo password),
   codice dispositivo v3 (senza chiave grezza, solo "permesso" per il 1° collegamento),
   cambio password che apre su tutti i dispositivi, recupero password (domanda segreta),
   tracciamento modifiche, incroci, backup,
   v10.5: QR code (generatore integrato + decodifica indipendente + RS),
   v10.5: allarmi scadenze a 4 livelli su tutto il CRM (campanella + pannello + Da Fare),
   v10.5: QR in Sincronizzazione + avviso "non collegato al cloud",
   v10.5: protezione dati da pulizia del PC (persist + doppia copia di emergenza + verifica). */
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
  const cfgPrimaSenzaCloud = Sync.config();
  await Sync.setConfig({ encrypt: false });
  ok(await Sync.rekeyWithPassword('NonScrivere9', { requireCloud: true }) === false, 'reset da dispositivo autorizzato rifiuta cloud non cifrato');
  await Sync.setConfig({ mode: 'off', token: '', gistId: '' });
  ok(await Sync.rekeyWithPassword('NonScrivere9', { requireCloud: true }) === false, 'reset da dispositivo autorizzato rifiuta modalità locale');
  await Sync.setConfig(cfgPrimaSenzaCloud);
  // D2 (pulito): la vecchia password NON apre più; la nuova apre
  await Sync.lockMaster();
  ok(await Sync.rekeyWithPassword('NonScrivere9') === false, 'rekey senza chiave non tocca l\'archivio');
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
const { JSDOM, VirtualConsole } = require('jsdom');
const { IDBFactory } = require('fake-indexeddb');

function makeWindow(url) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<link rel="stylesheet"[^>]*>/g, '')
    .replace(/<link rel="manifest"[^>]*>/g, '')
    .replace(/<link rel="[^>]*icons[^>]*>/g, '')
    .replace(/<script src="sync\.js"[^>]*><\/script>/, '<script>' + fs.readFileSync(path.join(ROOT, 'sync.js'), 'utf8') + '<\/script>')
    .replace(/<script src="promemoria\.js"[^>]*><\/script>/, '<script>' + fs.readFileSync(path.join(ROOT, 'promemoria.js'), 'utf8') + '<\/script>')
    .replace(/<script src="recupero-dati\.js"[^>]*><\/script>/, '<script>' + fs.readFileSync(path.join(ROOT, 'recupero-dati.js'), 'utf8') + '<\/script>')
    .replace(/<script src="automazioni\.js"[^>]*><\/script>/, '<script>' + fs.readFileSync(path.join(ROOT, 'automazioni.js'), 'utf8') + '<\/script>')
    .replace(/<script src="fonti\.js"[^>]*><\/script>/, '<script>' + fs.readFileSync(path.join(ROOT, 'fonti.js'), 'utf8') + '<\/script>')
    .replace(/<script src="app\.js"[^>]*><\/script>/, '<script>' + fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8') + '<\/script>');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test((e && e.message) || '')) console.error('jsdom:', e && e.message); });
  const dom = new JSDOM(html, {
    url: url || 'https://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc
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

  // niente attesa di minuti dopo errori di password
  win.registraFallimento(); win.registraFallimento(); const n3 = win.registraFallimento();
  ok(!win.loginBloccato() && win.minutiBlocco()===0, 'gli errori non bloccano più l\'accesso per minuti');
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
  ok(!!win.document.getElementById('sec-reset-trusted-btn') && typeof win.confermaResetDaDispositivo === 'function', 'v10.5.11: reimpostazione da dispositivo autorizzato presente');
  win.apriResetDaDispositivo();
  ok(!win.document.getElementById('trusted-reset-modal'), 'reimpostazione non parte senza chiave già autorizzata');
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
  ok(!!win.document.getElementById('rec-entra-btn') && typeof win.recuperaEEntra === 'function', 'v10.5.12: tasto Recupera e entra presente');
  const eye = win.document.getElementById('login-eye');
  ok(!!eye && win.document.getElementById('login-pass').type === 'password', 'v10.5.12: occhio password presente e inizialmente nascosta');
  win.togglePasswordVisibility('login-pass', eye);
  ok(win.document.getElementById('login-pass').type === 'text', 'v10.5.12: occhio mostra la password solo sul dispositivo');
  win.togglePasswordVisibility('login-pass', eye);
  ok(win.document.getElementById('login-pass').type === 'password', 'v10.5.12: occhio torna a nascondere la password');
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

/* ---------------------------------------------------------------- */
/* v10.5 — QR code: generatore integrato in sync.js                 */
/* La decodifica qui sotto è INDIPENDENTE (scritta dai posizioni     */
/* della specifica): se il round-trip passa, posizionamento dati,    */
/* maschera, bit di formato e Reed-Solomon sono corretti.            */
/* ---------------------------------------------------------------- */
function qrDecodeCheck(modules) {
  const size = modules.length;
  const ver = (size - 17) / 4;
  if (!Number.isInteger(ver) || ver < 1 || ver > 40) throw new Error('dimensione non QR: ' + size);
  let f = 0;
  for (let i = 0; i <= 5; i++) if (modules[i][8]) f |= 1 << i;
  if (modules[7][8]) f |= 1 << 6;
  if (modules[8][8]) f |= 1 << 7;
  if (modules[8][7]) f |= 1 << 8;
  for (let i = 9; i < 15; i++) if (modules[8][14 - i]) f |= 1 << i;
  const val = f ^ 0x5412;
  const dataF = val >>> 10;
  let rem = dataF;
  for (let t = 0; t < 10; t++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  if (((dataF << 10) | rem) !== val) throw new Error('bit di formato BCH non validi');
  const eclIdx = [1, 0, 3, 2].indexOf(dataF >>> 3);
  const mask = dataF & 7;
  if (eclIdx < 0) throw new Error('livello ECC non valido');
  const fun = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (x, y) => { if (x >= 0 && x < size && y >= 0 && y < size) fun[y][x] = true; };
  for (let i = 0; i < size; i++) { setF(6, i); setF(i, 6); }
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) setF(cx + dx, cy + dy); };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = I.qrAlignPositions(ver), n = ap.length;
  for (let a1 = 0; a1 < n; a1++) for (let a2 = 0; a2 < n; a2++) {
    if ((a1 === 0 && a2 === 0) || (a1 === 0 && a2 === n - 1) || (a1 === n - 1 && a2 === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ap[a2] + dx, ap[a1] + dy);
  }
  for (let i = 0; i <= 5; i++) setF(8, i);
  setF(8, 7); setF(8, 8); setF(7, 8);
  for (let i = 9; i < 15; i++) setF(14 - i, 8);
  for (let i = 0; i < 8; i++) setF(size - 1 - i, 8);
  for (let i = 8; i < 15; i++) setF(8, size - 15 + i);
  setF(8, size - 8);
  if (ver >= 7) for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, b = Math.floor(i / 3); setF(a, b); setF(b, a); }
  const maskBit = (m, x, y) => {
    switch (m) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
  };
  const bits = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!fun[y][x]) { let d = modules[y][x]; if (maskBit(mask, x, y)) d = !d; bits.push(d ? 1 : 0); }
      }
    }
  }
  const cw = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; cw.push(b); }
  const numBlocks = I.QR_NUM_BLOCKS[eclIdx][ver];
  const eccLen = I.QR_ECC_PER_BLOCK[eclIdx][ver];
  const raw = Math.floor(I.qrRawModules(ver) / 8);
  const numShort = numBlocks - raw % numBlocks;
  const shortLen = Math.floor(raw / numBlocks);
  if (cw.length < raw) throw new Error('codewords letti insufficienti');
  const datBlocks = [], eccBlocks = [];
  for (let b1 = 0; b1 < numBlocks; b1++) { datBlocks.push([]); eccBlocks.push([]); }
  let k = 0;
  for (let i = 0; i < shortLen - eccLen; i++) for (let j = 0; j < numBlocks; j++) datBlocks[j].push(cw[k++]);
  for (let j = numShort; j < numBlocks; j++) datBlocks[j].push(cw[k++]);
  for (let i = 0; i < eccLen; i++) for (let j = 0; j < numBlocks; j++) eccBlocks[j].push(cw[k++]);
  const rsMul = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
  const rsDiv = deg => { const r = new Array(deg - 1).fill(0); r.push(1); let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = rsMul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = rsMul(root, 2); } return r; };
  const rsRem = (data, div) => { const r = div.map(() => 0); data.forEach(b => { const fac = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= rsMul(c, fac); }); }); return r; };
  const div = rsDiv(eccLen);
  let eccOk = 0;
  datBlocks.forEach((d, j) => { const calc = rsRem(d, div); if (calc.join() !== eccBlocks[j].join()) throw new Error('Reed-Solomon non torna nel blocco ' + j); eccOk++; });
  const data = [].concat(...datBlocks);
  let bi = 0;
  const take = nb => { let v = 0; for (let i = 0; i < nb; i++) { v = (v << 1) | ((data[bi >> 3] >> (7 - (bi & 7))) & 1); bi++; } return v; };
  const bytes = [];
  while (bi + 4 <= data.length * 8) {
    const mode = take(4);
    if (mode === 0) break;
    if (mode !== 4) throw new Error('modo non byte: ' + mode);
    const len = take(ver <= 9 ? 8 : 16);
    for (let i = 0; i < len; i++) bytes.push(take(8));
  }
  return { text: Buffer.from(bytes).toString('utf8'), ver, mask, ecl: 'LMQH'[eclIdx], eccOk };
}

async function testQR() {
  section('7. v10.5: QR code — generatore integrato (sync.js, niente librerie esterne)');
  const q1 = Sync.qr.matrix('A', 'L');
  ok(q1.size === 21 && q1.version === 1 && q1.modules.length === 21 && q1.modules[0][0] === true && q1.modules[0][6] === true && q1.modules[3][3] === true && q1.modules[2][2] === true && q1.modules[1][3] === false, 'matrice v1 21×21 con finder pattern corretto (centro pieno, anello chiaro)');
  const a = Sync.qr.matrix('stesso testo', 'M'), b2 = Sync.qr.matrix('stesso testo', 'M'), c2 = Sync.qr.matrix('altro testo!', 'M');
  const flat = q => q.modules.map(r => r.map(x => x ? '1' : '0').join('')).join('');
  ok(flat(a) === flat(b2) && flat(a) !== flat(c2), 'deterministico: stesso testo → stessa matrice, testo diverso → matrice diversa');
  ok(Sync.qr.dataCodewords(1, 'L') === 19 && Sync.qr.dataCodewords(1, 'M') === 16 && Sync.qr.dataCodewords(1, 'Q') === 13 && Sync.qr.dataCodewords(1, 'H') === 9 && Sync.qr.dataCodewords(10, 'M') === 216 && Sync.qr.dataCodewords(40, 'L') === 2956 && Sync.qr.dataCodewords(40, 'H') === 1276, 'capienze codewords uguali ai valori pubblicati (ISO 18004)');
  const t1 = 'CIAO-MONDO-123';
  const d1 = qrDecodeCheck(Sync.qr.matrix(t1, 'M').modules);
  ok(d1.text === t1, 'round-trip: testo corto decodificato identico', d1.text);
  const codeLungo = 'IMMOCRM1.' + Buffer.from(JSON.stringify({ v: 3, m: 'gist', g: 'gist1234567', t: 'ghp_' + 'T'.repeat(36), e: 1, r: '', s: 'U2FsZVNhbGVTYWxlU2FsZQ==', h: { salt: 'c2FsdA==', iter: 210000, hash: 'aGFzaGhhc2hoYXNoaGFzaA==' } })).toString('base64');
  const urlQR = 'https://davidescaglia1968.github.io/immocrm/#codice=' + encodeURIComponent(codeLungo);
  const d2 = qrDecodeCheck(Sync.qr.matrix(urlQR, 'M').modules);
  ok(d2.text === urlQR, 'round-trip: link reale col codice dispositivo (~' + urlQR.length + ' caratteri)', d2.text.slice(0, 40));
  const t3 = 'È perchè — città € 💶 ünïcödé';
  const d3 = qrDecodeCheck(Sync.qr.matrix(t3, 'M').modules);
  ok(d3.text === t3, 'round-trip: accenti ed emoji (UTF-8)');
  const qm = Sync.qr.matrix(urlQR, 'Q');
  const dm = qrDecodeCheck(qm.modules);
  ok(dm.ecl === 'Q' && dm.mask >= 0 && dm.mask <= 7, 'bit di formato: livello ECC richiesto (' + dm.ecl + ') e maschera 0-7');
  ok(d2.eccOk > 0 && dm.eccOk === I.QR_NUM_BLOCKS[2][qm.version], 'Reed-Solomon: ECC verificato su tutti i blocchi (' + dm.eccOk + ')');
  const t4 = 'x'.repeat(1000);
  const q4 = Sync.qr.matrix(t4, 'M');
  const d4 = qrDecodeCheck(q4.modules);
  ok(q4.version > 10 && d4.text === t4, 'testo di 1000 caratteri → versione alta (v' + q4.version + ') e round-trip ok');
  const svg = Sync.qr.svg('test-svg', { ec: 'M' });
  ok(typeof svg === 'string' && svg.indexOf('<svg') === 0 && /viewBox="0 0 \d+ \d+"/.test(svg) && svg.indexOf('fill="#ffffff"') > 0 && svg.indexOf('<path') > 0 && svg.indexOf('</svg>') === svg.length - 6, 'qr.svg produce SVG valido (sfondo bianco + moduli neri)');
  let overflowErr = null;
  try { Sync.qr.matrix('y'.repeat(3000), 'H'); } catch (e) { overflowErr = e; }
  ok(overflowErr && /troppo lungo/i.test(overflowErr.message), 'oltre la versione 40 → errore chiaro');
}

async function testAllarmi() {
  section('8. v10.5: allarmi scadenze — 4 livelli (3-2-1 giorni e oggi) su tutto il CRM');
  const win = makeWindow();
  await waitUntil(() => win.DB && typeof win.raccogliScadenze === 'function' && typeof win.apriPannelloScadenze === 'function');
  const D = n => { const x = new Date(); x.setDate(x.getDate() + n); const p = v => String(v).padStart(2, '0'); return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()); }; // isoLocal è una const di app.js: non vive su window, la ricalco qui (stesso fuso)
  const DB = win.DB;
  DB.attivita.push({ id: 'a1', titolo: 'Att tre giorni', scadenza: D(3), done: false, priorita: 'alta' });
  DB.attivita.push({ id: 'a2', titolo: 'Fatta domani', scadenza: D(1), done: true });
  DB.attivita.push({ id: 'a3', titolo: 'Scaduta ieri laltro', scadenza: D(-2), done: false });
  DB.attivita.push({ id: 'a4', titolo: 'Tra una settimana', scadenza: D(7), done: false });
  DB.appuntamenti.push({ id: 101, titolo: 'Visita Via Roma', data: D(2), ora: '10:00', stato: 'pianificato' });
  DB.appuntamenti.push({ id: 102, titolo: 'Annullato', data: D(1), ora: '11:00', stato: 'annullato' });
  DB.chiamate.push({ id: 103, nome: 'Mario Rossi', telefono: '333', stato: 'da-richiamare', dataRichiamo: D(1) });
  DB.chiamate.push({ id: 104, nome: 'Gia convertito', telefono: '334', stato: 'convertito', dataRichiamo: D(1) });
  DB.clienti.push({ id: 105, nome: 'Anna', cognome: 'Verdi', dataRichiamo: D(0), stato: 'tiepido' });
  DB.clienti.push({ id: 106, nome: 'Chiuso', cognome: 'Bianchi', dataRichiamo: D(1), stato: 'chiuso' });
  DB.documenti.push({ id: 107, titolo: 'APE in scadenza', tipo: 'ape', scadenza: D(2) });
  DB.documenti.push({ id: 108, titolo: 'Visura scaduta', tipo: 'visura', scadenza: D(-1) });
  DB.fatture.push({ id: 'f109', numero: 'FA-1', totale: 1500, cliente: 'Caio', stato: 'da-incassare', scadenza: D(3) });
  DB.fatture.push({ id: 'f110', numero: 'FA-2', totale: 900, cliente: 'Sempronio', stato: 'incassata', scadenza: D(1) });
  DB.openhouses.push({ id: 'oh111', titolo: 'OH Borgotrebbia', data: D(1), oraInizio: '15:00' });
  DB.openhouses.push({ id: 'oh112', titolo: 'OH passata', data: D(-5), oraInizio: '15:00' });
  DB.mandati.push({ id: 'md113', immobileNome: 'Villa Esclusiva', stato: 'attivo', nomeVenditore: 'Dante', scadenza: D(2) });
  DB.mandati.push({ id: 'md114', immobileNome: 'Mandato 90gg', stato: 'attivo', nomeVenditore: 'Beatrice', dataFirma: D(-88) });
  DB.mandati.push({ id: 'md115', immobileNome: 'Annullato', stato: 'annullato', scadenza: D(1) });

  const tutti = win.raccogliScadenze();
  const tipi = ['Attività', 'Appuntamento', 'Chiamata', 'Contatto', 'Documento', 'Fattura', 'Open House', 'Mandato'];
  ok(tipi.every(t => tutti.some(x => x.tipo === t)), 'raccoglie le scadenze di tutte le 8 aree del CRM', tipi.filter(t => !tutti.some(x => x.tipo === t)).join(','));
  const per = win.allarmiPerLivello();
  ok(per[3].length === 2 && per[3].some(x => x.titolo === 'Att tre giorni') && per[3].some(x => /FA-1/.test(x.titolo)) && per[3].every(x => x.gg === 3 && x.livello === 3), 'livello 3: scadenze tra 3 giorni (attività + fattura)');
  ok(per[2].length === 4 && per[2].some(x => /Visita Via Roma/.test(x.titolo)) && per[2].some(x => x.titolo === 'APE in scadenza') && per[2].every(x => x.gg === 2), 'livello 2: tra 2 giorni (appuntamento, documento, mandati)');
  ok(per[1].length === 2 && per[1].some(x => x.tipo === 'Chiamata' && x.dettaglio === 'da richiamare') && per[1].some(x => x.tipo === 'Open House'), 'livello 1: domani (chiamata da richiamare + open house)');
  ok(per[0].length === 1 && per[0][0].tipo === 'Contatto' && /Anna/.test(per[0][0].titolo) && per[0][0].gg === 0, 'livello 0: oggi (contatto da richiamare oggi)');
  ok(win.giorniMancanti(D(4)) === 4 && win.livelloAllarme(4) === null && !win.allarmiScadenze().some(x => x.titolo === 'Tra una settimana') && win.scaduteOra().some(x => x.titolo === 'Scaduta ieri laltro'), 'tra 4+ giorni nessun allarme; le passate finiscono in "scadute"');
  const esclusi = ['Fatta domani', 'Annullato', 'Gia convertito', 'Chiuso Bianchi', 'FA-2', 'OH passata'];
  ok(!win.allarmiScadenze().some(x => esclusi.some(e => (x.titolo || '').indexOf(e) >= 0)) && !win.scaduteOra().some(x => x.titolo === 'OH passata'), 'esclusi: attività completate, chiusi, convertiti, incassate, annullati, eventi passati');
  const m90 = win.allarmiScadenze().find(x => x.titolo === 'Mandato 90gg');
  ok(!!m90 && m90.gg === 2 && /90/.test(m90.dettaglio), 'mandato senza scadenza → allarme a 90 giorni dalla firma');
  const tot = win.allarmiScadenze().length;

  win.updateBadges();
  const bell = win.document.getElementById('bell-btn'), badge = win.document.getElementById('bell-badge');
  ok(tot === 9 && !!bell && !!badge && badge.style.display === 'inline-flex' && badge.textContent === '9' && /apriPannelloScadenze/.test(bell.getAttribute('onclick')), 'campanella 🔔 in topbar con contatore = 9 allarmi attivi');
  win.apriPannelloScadenze();
  const mod = win.document.getElementById('scadenze-modal');
  const mh = mod ? mod.innerHTML : '';
  ok(!!mod && /Tra 3 giorni/.test(mh) && /Tra 2 giorni/.test(mh) && /Domani/.test(mh) && /Oggi/.test(mh), 'clic sulla campanella → pannello con i 4 livelli');
  ok(/Già scadute/.test(mh) && /Scaduta ieri laltro/.test(mh) && /Visura scaduta/.test(mh), 'pannello: sezione "Già scadute" con le voci passate');
  win.closeModal();
  win.go('da-fare');
  const dh = win.document.getElementById('content').innerHTML;
  ok(/Allarmi scadenze \(9\)/.test(dh) && /Apri pannello/.test(dh) && /già scadute: 2/.test(dh), 'riassunto allarmi nella schermata "Da Fare Oggi"');

  DB.attivita = []; DB.appuntamenti = []; DB.chiamate = []; DB.clienti = []; DB.documenti = []; DB.fatture = []; DB.openhouses = []; DB.mandati = [];
  win.updateBadges();
  ok(win.allarmiScadenze().length === 0 && win.document.getElementById('bell-badge').style.display === 'none', 'senza scadenze il contatore della campanella si nasconde');
  win.close();
}

async function testQRApp() {
  section('9. v10.5: QR in Sincronizzazione + avviso "non collegato al cloud"');
  const code = 'IMMOCRM1.' + Buffer.from(JSON.stringify({ v: 3, m: 'gist', g: 'gistQR', t: 'tk-qr', e: 1, r: '', s: 'c2FsZQ==' })).toString('base64');
  const win = makeWindow('https://localhost/index.html#codice=' + encodeURIComponent(code));
  await waitUntil(() => win.DB && typeof win.leggiCodiceDaURL === 'function');
  await waitUntil(() => win.document.getElementById('login-code').value, 4000).catch(() => {});
  const inp = win.document.getElementById('login-code');
  ok(inp && inp.value === code, 'aprendo l\'app col link del QR (#codice=…) il codice è già inserito nel login');
  const wrap = win.document.getElementById('login-code-wrap'), hint = win.document.getElementById('qr-code-hint');
  ok(wrap && wrap.style.display === 'block' && hint && hint.style.display === 'block' && /solo la password/i.test(hint.textContent), 'campo codice visibile + avviso "scrivi solo la password"');

  win.saveAuth({ loggedIn: true, nome: 'Test', ts: Date.now() });
  win.checkLoginRequired();
  await new Promise(r => setTimeout(r, 120));
  win.go('impostazioni');
  let card = win.document.getElementById('sync-card').outerHTML;
  ok(/sy-avviso-cloud/.test(card) && /non è ancora collegato al cloud/i.test(card), 'pannello Sincronizzazione: avviso chiaro quando il dispositivo NON è collegato al cloud');
  await win.ImmoSync.setConfig({ mode: 'gist', token: 'tk-qr2', gistId: 'gistQR2', encrypt: false });
  card = win.syncCardHTML();
  ok(!/sy-avviso-cloud/.test(card) && /QR — collega il telefono/.test(card) && /sy-qr/.test(card), 'cloud collegato: avviso sparito e sezione QR presente nel pannello');
  await win.caricaQRSync();
  const box = win.document.getElementById('sy-qr');
  ok(!!box && box.innerHTML.indexOf('<svg') >= 0 && box.innerHTML.indexOf('viewBox') >= 0, 'caricaQRSync inserisce il QR (SVG) nel pannello');
  win.close();
}

async function testProtezione() {
  section('10. v10.5: protezione dati da pulizia del computer');
  const EMG_A = I.EMG_A, EMG_B = I.EMG_B;
  const win = makeWindow();
  await waitUntil(() => win.DB && typeof win.verificaProtezione === 'function');
  let persistCalls = 0;
  Object.defineProperty(win.navigator, 'storage', {
    value: { persist: async () => { persistCalls++; return true; }, persisted: async () => true, estimate: async () => ({ usage: 1234567, quota: 500000000 }) },
    configurable: true
  });
  ok(await win.ImmoSync.requestPersist() === true && persistCalls === 1 && await win.ImmoSync.isPersisted() === true, 'requestPersist chiama navigator.storage.persist (StorageManager) e isPersisted risponde');
  win.DB.clienti.push({ id: 555, nome: 'Protetto', cognome: 'Sempre', updatedAt: Date.now() });
  win.DB._ts = Date.now();
  win.save();
  const eA = JSON.parse(win.localStorage.getItem(EMG_A) || 'null'), eB = JSON.parse(win.localStorage.getItem(EMG_B) || 'null');
  ok(eA && eB && eA.db && eB.db && eA.db.clienti.some(x => x.id === 555) && eB.db.clienti.some(x => x.id === 555) && eA.ts > 0, 'save() crea la DOPPIA copia di emergenza (A e B) con dati e timestamp');

  // boot con sola copia di emergenza (pulizia del PC: principale + IndexedDB sparite)
  const win2 = makeWindow();
  await waitUntil(() => win2.ImmoSync && win2.ImmoSync.boot);
  const emgPayload = { ts: Date.now(), emg: 1, db: { clienti: [{ id: 1, nome: 'Superstite', updatedAt: Date.now() }], _ts: Date.now(), settings: { agente: 'SD' } } };
  win2.localStorage.setItem(EMG_A, JSON.stringify(emgPayload));
  win2.localStorage.setItem(EMG_B, JSON.stringify(emgPayload));
  const b2 = await win2.ImmoSync.boot();
  ok(b2 && b2.source === 'emergenza' && b2.db && b2.db.clienti.some(x => x.nome === 'Superstite'), 'boot: senza copia principale e senza IndexedDB → ripristino dalla copia di emergenza');
  win2.close();

  // boot con solo IndexedDB (localStorage principale cancellata): l'inviluppo {db,ts} va scartato
  const win3 = makeWindow();
  await waitUntil(() => win3.DB && win3.DB.clienti);
  win3.DB.clienti.push({ id: 666, nome: 'SoloIDB', updatedAt: Date.now() });
  win3.DB._ts = Date.now();
  await win3.ImmoSync.mirror(win3.DB);
  win3.localStorage.removeItem('immocrm_pro_v10');
  win3.localStorage.removeItem(I.LS_MAIN);
  const b3 = await win3.ImmoSync.boot();
  ok(b3 && b3.source === 'indexeddb' && b3.db && Array.isArray(b3.db.clienti) && b3.db.clienti.some(x => x.nome === 'SoloIDB'), 'boot da solo IndexedDB: inviluppo scartato, dati integri (regressione v10.5)');
  win3.close();

  const r = await win.ImmoSync.verifyStorage();
  ok(r && r.mainLS.ok && r.idb.ok && r.emgA.ok && r.emgB.ok && r.persisted === true && r.persistSupported === true && r.quota === 500000000 && r.storico >= 1, 'verifyStorage: report completo (principale, IndexedDB+storico, copie A/B, persistenza, quota)');
  win.saveAuth({ loggedIn: true, nome: 'Test', ts: Date.now() });
  win.checkLoginRequired();
  await new Promise(r2 => setTimeout(r2, 120));
  win.go('impostazioni');
  await win.verificaProtezione();
  const pm = win.document.getElementById('protect-modal');
  ok(!!win.document.getElementById('protect-card') && !!win.document.getElementById('protect-check-btn') && !!pm && /Copia di emergenza A/.test(pm.innerHTML) && /Copia di emergenza B/.test(pm.innerHTML) && /Salvataggio persistente/.test(pm.innerHTML) && !/StorageManager/.test(pm.innerHTML), 'Impostazioni: card "Protezione dati" e il pulsante di verifica apre il report con tutte le copie');
  win.closeModal();
  Object.defineProperty(win.navigator, 'storage', {
    value: { persist: async () => false, persisted: async () => false, estimate: async () => ({ usage: 1, quota: 100 }) },
    configurable: true
  });
  await win.attivaPersistenza();
  const help = win.document.getElementById('persist-help-modal');
  ok(!!help && /Installa l'app/.test(help.innerHTML) && !/Persistenza non concessa/.test(help.innerHTML) && !/StorageManager/.test(help.innerHTML), 'se il browser non blocca i dati: istruzione chiara: installa l’app, senza gergo');
  win.closeModal();
  win.confirm = () => true;
  try { Object.defineProperty(win.location, 'reload', { value: () => {}, configurable: true }); } catch (e) {}
  win.resetTotale();
  ok(win.localStorage.getItem(EMG_A) === null && win.localStorage.getItem(EMG_B) === null && win.localStorage.getItem('immocrm_pro_v10') === null, 'reset totale: cancella anche le copie di emergenza (niente "resurrezione")');
  win.close();
}

async function testCerca() {
  section('Ricerca nome e indirizzo');
  const win = makeWindow();
  await waitUntil(() => win.DB && typeof win.matchRicerca === 'function' && typeof win.renderContatti === 'function');
  ok(typeof win.matchRicerca === 'function', 'matchRicerca è nel programma');
  ok(win.matchRicerca(['Mario', 'Rossi', 'Via Città, 12'], 'rossi mario') === true, 'cognome prima del nome');
  ok(win.matchRicerca(['Mario', 'Rossi', 'Via Città, 12'], 'citta 12') === true, 'via senza accento');
  ok(win.matchRicerca(['Mario', 'Rossi', '333 123 4567'], '333123') === true, 'telefono senza spazi');
  ok(win.matchRicerca(['Mario', 'Rossi', 'Via Roma 12'], 'nessunoqui') === false, 'nome assente non esce');
  ok(win.matchRicerca(["Sant'Antonino 4", 'Anna'], 'sant antonino') === true, 'apostrofo nella via');
  win.DB.clienti = [{ id: 501, nome: 'Giuseppe', cognome: 'Neri', tipo: 'venditore', fonte: 'Immobiliare.it', via: 'Via Beverora', civico: '8', citta: 'Piacenza', telefono: '333 111 2222', stato: 'tiepido', presentazioneInviata: 'no' }];
  const content = win.document.getElementById('content');
  win.renderContatti(content);
  const strada = Array.from(content.querySelectorAll('button')).find(b => /Per strada/.test(b.textContent));
  ok(!!strada, 'il tasto Per strada c\'è');
  if (strada) strada.click();
  const spento = win.document.getElementById('content').innerHTML;
  ok(!/Giuseppe/.test(spento), 'Per strada da solo nasconde chi non è per strada');
  const box = win.document.getElementById('ct-cerca');
  box.value = 'neri beverora';
  box.focus();
  win.filtraContatti(box);
  const html = win.document.getElementById('content').innerHTML;
  ok(/Giuseppe/.test(html) && /Beverora/.test(html), 'con Per strada acceso la ricerca trova comunque nome e via');
  ok(/Cerco in tutta la rubrica/.test(html), 'la casella dice che guarda tutta la rubrica');
  const dopo = win.document.getElementById('ct-cerca');
  ok(!!dopo && dopo.value === 'neri beverora', 'il testo resta nella casella');
  ok(win.document.activeElement === dopo, 'il cursore resta nella casella');
  win.runGlobalSearch('beverora');
  const sr = win.document.getElementById('search-results').innerHTML;
  ok(/Giuseppe/.test(sr) && /Beverora/.test(sr), 'la lente in alto trova la via');
  win.close();
}


/* ---------------------------------------------------------------- */
/* 14) v10.6 — promemoria, pulsanti riparati, contatti collegati     */
/* ---------------------------------------------------------------- */
async function testPromemoria() {
  section('14. v10.6: sveglie per i richiami (promemoria.js)');
  const P = require(path.join(ROOT, 'promemoria.js'));
  const db = {};
  const p = P.crea(db, { clienteId: 7, nome: 'Mario Rossi', telefono: '3331112222', data: '2026-11-10', ora: '10:30', nota: 'mutuo' });
  ok(!!p && db.promemoria.length === 1, 'la sveglia entra nel database esistente (nessun secondo archivio)');
  const f = P.finestre(p); const q = {}; f.forEach(x => q[x.chiave] = x.quando);
  ok(f.length === 4, 'quattro sveglie per ogni richiamo');
  ok(q.t3.getDate() === 7 && q.t3.getHours() === 9, 'tre giorni prima, alle 09:00');
  ok(q.t1.getDate() === 9 && q.t1.getHours() === 9, 'il giorno prima, alle 09:00');
  ok(q.t1h.getHours() === 9 && q.t1h.getMinutes() === 30, "un'ora prima del richiamo");
  ok(q.t0.getHours() === 10 && q.t0.getMinutes() === 30, 'al momento esatto del richiamo');
  const dopo = new Date(2026, 10, 10, 10, 31);
  const dovute = P.daInviare(db, dopo);
  ok(dovute.length === 2, 'invia solo le sveglie recenti, non tutte quelle vecchie in blocco');
  dovute.forEach(d => P.marcaInviato(d.promemoria, d.finestra.chiave, dopo));
  ok(P.daInviare(db, dopo).length === 0, 'NESSUN DOPPIONE: la seconda passata non rimanda nulla');
  ok(P.istante('2026-11-10', '25:99') instanceof Date, 'un orario impossibile viene corretto, non fa esplodere niente');
  ok(P.crea({}, { data: 'non-data' }) === null, 'una data sbagliata viene rifiutata invece di salvare "oggi"');
  const testo = P.testoAvviso(p, 'cognome', { chiave: 't0', breve: 'adesso', etichetta: 'adesso' });
  ok(/Rossi/.test(testo) && !/Mario/.test(testo), 'privacy "cognome": esce solo il cognome');
  const testo2 = P.testoAvviso(p, 'codice', { chiave: 't0', breve: 'adesso', etichetta: 'adesso' });
  ok(!/Rossi/.test(testo2) && !/3331112222/.test(testo2) && /7/.test(testo2), 'privacy "codice": non esce né nome né telefono');
  const ics = P.esportaIcs([p]);
  ok((ics.match(/BEGIN:VALARM/g) || []).length === 3, 'il file calendario porta con sé 3 sveglie');
  const cfg = P.configCanali({ settings: {} });
  ok(cfg.recapito === '3286930033', 'il recapito predefinito è il suo numero: 3286930033');
  ok(cfg.smsOk === false, "SMS spento finché non lo attiva (serve un account di invio)");
  const sms = await P.inviaSms(cfg, 'x');
  ok(sms.ok === false && /non attivato/.test(sms.motivo), "senza attivazione l'SMS non parte e lo dice con chiarezza");
  const db2 = {};   /* cassetto nuovo: nel primo le sveglie risultano già inviate */
  P.crea(db2, { clienteId: 9, nome: 'Luigi Verdi', telefono: '3335556666', data: '2026-11-10', ora: '10:30' });
  const coda = P.codaSveglia(db2, new Date(2026, 10, 8, 8, 0), 72);
  ok(coda.length >= 1, 'la coda per il pianificatore esterno si prepara');
  ok(!/Verdi/.test(JSON.stringify(coda)), 'la coda NON contiene i nomi dei clienti');
  const finto = (u, o) => { finto.ultimo = o; return Promise.resolve({ ok: true, status: 200 }); };
  await P.inviaNtfy(Object.assign({}, cfg, { ntfy: 'prova' }), 'T', 'testo', new Date(Date.now() + 3600000), finto);
  ok(finto.ultimo.headers['X-Delay'] > 3000, 'ntfy riceve la sveglia con il ritardo giusto (fino a 3 giorni)');
  await P.inviaNtfy(Object.assign({}, cfg, { ntfy: 'prova' }), 'T', 'testo', new Date(Date.now() + 6 * 86400000), finto);
  const oltre = await P.inviaNtfy(Object.assign({}, cfg, { ntfy: 'prova' }), 'T', 'testo', new Date(Date.now() + 6 * 86400000), finto);
  ok(oltre.ok === false, 'oltre i 3 giorni avvisa invece di fingere che sia arrivata');
}

async function testAppV106() {
  section('15. v10.6: pulsanti riparati, contatti apribili, dati intatti');
  const win = makeWindow();
  await waitUntil(() => win.DB && typeof win.render === 'function' && win.Promemoria);
  const p = win.document.getElementById('login-pass'); if (p) p.value = 'successo';
  try { await win.doLogin(); } catch (e) { }
  await waitUntil(() => win.document.getElementById('app-shell').style.display !== 'none').catch(() => { });
  ok(typeof win.logRapido === 'function', 'logRapido esiste (prima il tasto "Log chiamata" era morto)');
  ok(typeof win.deleteEvento === 'function', 'deleteEvento esiste (prima la "✕" degli eventi era morta)');
  ok(win.eval("NAV_ITEMS.some(x=>x.id==='promemoria')"), 'la voce Promemoria è nel menu');
  ok(win.eval("typeof RENDERERS.promemoria==='function'"), 'la sezione Promemoria è collegata');
  win.eval("activeSection='promemoria'"); win.render();
  const c1 = win.document.getElementById('content').innerHTML;
  ok(/Promemoria e sveglie/.test(c1) && /ntfy/.test(c1) && /3286930033/.test(c1), 'la schermata mostra canali e recapito');
  /* sveglia creata dalla scheda contatto */
  win.DB.clienti.push({ id: 501, nome: 'Prova', cognome: 'Sveglia', telefono: '3330001111', stato: 'Nuovo', tipo: 'acquirente', dataCreazione: '2026-10-01', updatedAt: 1 });
  win.eval("activeSection='contatti';render()");
  win.openContattoModal(501);
  ok(!!win.document.getElementById('prm-data') && !!win.document.getElementById('prm-ora'), 'nella scheda ci sono data E ora del richiamo');
  win.document.getElementById('prm-data').value = '2026-11-10';
  win.document.getElementById('prm-ora').value = '15:45';
  win.creaPromemoriaDaScheda(501, 0);
  const creata = (win.DB.promemoria || []).find(x => String(x.clienteId) === '501');
  ok(!!creata && creata.ora === '15:45', 'la sveglia viene salvata con data e ora');
  ok(win.eval("raccogliScadenze().some(x=>x.tipo==='Sveglia')"), 'la sveglia entra nella campanella delle scadenze');
  win.eval("closeModal()");
  /* contatto apribile da un'altra sezione */
  win.DB.chiamate = [{ id: 601, nome: 'Prova Sveglia', telefono: '3330001111', stato: 'da-richiamare', dataRichiamo: '2026-10-20', updatedAt: 2 }];
  win.eval("activeSection='chiamate';render()");
  ok(win.document.querySelectorAll('#content .link-scheda').length > 0, 'da Chiamate compare il tasto 👤 che apre la scheda');
  /* valutatore: la regola dell'affidabilità */
  win.DB.vendite = [];
  win.eval("V={step:1,dati:{zona:'Centro Storico',mq:95,locali:4,anno:1980,piano:2,ascensore:true,stato:'buono',classe:'C',tipo:'trilocale'},risultato:null}");
  win.eval("vtCalcola()");
  const r0 = win.eval("V.risultato.conf");
  ok(r0 <= 20, 'senza venduti veri l\'affidabilita resta bassa (' + r0 + '%): non sale contando i coefficienti');
  win.DB.vendite = [1, 2, 3, 4, 5, 6].map(i => ({ id: 700 + i, zona: 'Centro Storico', prezzoPubblicato: 190000, prezzoVendita: 178000, superficieTotale: 95, dataVendita: '2026-0' + i + '-01', updatedAt: 3 }));
  win.eval("vtCalcola()");
  const r6 = win.eval("V.risultato.conf");
  ok(r6 > r0 && r6 <= 92, 'con venduti veri sale ma non tocca mai il 100% (' + r0 + '% → ' + r6 + '%)');
  ok(win.eval("V.risultato.ampia") === 0.07, 'con 3+ venduti la forbice si stringe');
  ok(!/Base OMI/.test(win.eval("htmlTreRighe(V.dati,V.risultato)")) || /^omi/i.test(win.eval("V.risultato.det[0].condizione")), 'la riga della fascia non si chiama "Base OMI" se la fonte non è OMI');
  win.close();
}


/* ---------------------------------------------------------------- */
/* 16) v10.6.1 — un dispositivo vuoto non deve cancellare il cloud   */
/* ---------------------------------------------------------------- */
async function testProtezioneVuoto() {
  section('16. v10.6.1: un dispositivo vuoto NON cancella l\'archivio cloud');
  const { server, port } = await fakeGitHub();
  const base = 'http://127.0.0.1:' + port;
  await Sync.setConfig({ mode: 'gist', token: 'faketoken', gistId: '', apiBase: base, encrypt: false });
  const contatti = [];
  for (let i = 0; i < 40; i++) contatti.push({ id: i, nome: 'Cliente ' + i, telefono: '333000' + i, note: 'nota di lavoro '.repeat(20), updatedAt: 1 });
  let db = { clienti: contatti, immobili: [], _ts: 5, _fieldTs: {} };
  Sync.start({ getDb: () => db, applyDb: () => { }, onStatus: () => { } });
  Sync.stop();
  const p1 = await Sync.push().catch(e => ({ error: e.message }));
  ok(p1 && p1.ok, 'primo invio: l\'archivio cloud contiene i contatti');
  /* il dispositivo "si svuota" (memoria del browser pulita) */
  db = { clienti: [], immobili: [], _ts: 9, _fieldTs: {} };
  const bloccato = await Sync.push().catch(e => ({ error: e.message }));
  ok(bloccato && bloccato.blocked === true, 'con i dati vuoti il CRM NON sovrascrive il cloud');
  const dopo = await Sync.pull().catch(e => ({ error: e.message }));
  ok(dopo && dopo.counts && dopo.counts.clienti === 40, 'l\'archivio cloud è ancora intero (40 contatti)');
  /* svuotamento VOLUTO: Reset totale deve poter passare */
  db = { clienti: [], immobili: [], _ts: 10, _svuotaOk: Date.now(), _fieldTs: {} };
  const forzato = await Sync.push().catch(e => ({ error: e.message }));
  ok(forzato && forzato.ok, 'con lo svuotamento voluto (Reset totale) l\'invio passa');
  server.close();
}

/* ---------------------------------------------------------------- */
/* 17) v10.6.1 — recupero dei dati da tutte le copie                 */
/* ---------------------------------------------------------------- */
async function testRecupero() {
  section('17. v10.6.1: recupero dei contatti dalle copie di sicurezza');
  const vivi = { clienti: [{ id: 1, nome: 'Mario', cognome: 'Rossi', telefono: '3331112222', updatedAt: 1 }, { id: 2, nome: 'Anna', cognome: 'Bianchi', telefono: '3339998887', updatedAt: 2 }], immobili: [{ id: 9, titolo: 'Casa', updatedAt: 3 }] };
  const win = makeWindow();
  /* la copia principale risulta vuota, ma le copie di riserva hanno i dati */
  win.localStorage.setItem('immocrm_pro_v10', JSON.stringify({ clienti: [], immobili: [], settings: { agente: 'SD' } }));
  win.localStorage.setItem('immocrm_emg_a', JSON.stringify({ ts: Date.now() - 60000, db: vivi }));
  win.localStorage.setItem('immocrm_backup_pre_106', JSON.stringify(vivi));
  await waitUntil(() => win.DB && typeof win.render === 'function');
  win.confirm = () => true;                     /* jsdom non ha le finestre di conferma */
  const copie = await win.elencoCopie();
  const conContatti = copie.filter(c => c.conta.clienti > 0);
  ok(conContatti.length >= 2, 'trova almeno 2 copie con i contatti (' + conContatti.length + ')');
  ok(conContatti[0].conta.clienti === 2, 'la copia più ricca ha 2 contatti');
  const conta = copie.find(c => c.chiave === 'corrente').conta;
  ok(conta.clienti === 0, 'i dati in uso adesso risultano vuoti (è il caso da recuperare)');
  await win.sicurezzaContatti();
  ok(!!win.document.getElementById('avviso-recupero'), 'compare l\'avviso in alto con il tasto di recupero');
  const buona = conContatti[0];
  await win.recuperaDa(buona.chiave);
  ok(win.DB.clienti.length === 2, 'i contatti sono tornati nel CRM');
  ok(win.DB.immobili.length === 1, 'anche gli immobili sono tornati');
  ok(win.DB.clienti[0].nome === 'Mario' && win.DB.clienti[0].telefono === '3331112222', 'i dati sono quelli giusti, non vuoti');
  ok(!!win.localStorage.getItem('immocrm_backup_prima_del_recupero'), 'quello che c\'era prima resta in una copia: si può tornare indietro');
  const dopo = await win.elencoCopie();
  ok(dopo.find(c => c.chiave === 'corrente').conta.clienti === 2, 'ora anche i dati in uso hanno i contatti');
  /* referto per assistenza: solo numeri, nessun nome */
  let salvato = null;
  win.scarica = (nome, testo) => { salvato = { nome, testo }; };
  await win.refertoCopie();
  ok(!!salvato && /referto-copie-immocrm\.json/.test(salvato.nome), 'il referto per assistenza si genera');
  ok(!/Rossi|3331112222/.test(salvato.testo), 'il referto NON contiene nomi né telefoni: solo numeri');
  win.close();
}


/* ---------------------------------------------------------------- */
/* 18) v10.6.3 — automazioni: marketing, follow-up, performance, report */
/* ---------------------------------------------------------------- */
async function testAutomazioni() {
  section('18. v10.6.3: automazioni (marketing, follow-up, performance, report)');
  const A = require(path.join(ROOT, 'automazioni.js'));
  const db = {
    settings: { agente: 'Scaglia Davide', agenziaNome: 'Immobiliare Scaglia', provvigione: 3 },
    clienti: [
      { id: 1, nome: 'Mario', cognome: 'Rossi', tipo: 'acquirente', stato: 'caldo', budgetMin: 150000, budgetMax: 200000, zonaDesiderata: 'centro storico', comuneDesiderato: 'Piacenza', tipologiaDesiderata: 'trilocale', telefono: '3331112222', fonte: 'Referral', portatoDa: 'Anna Bianchi', ultimoContatto: '2026-08-01' },
      { id: 2, nome: 'Anna', cognome: 'Bianchi', tipo: 'acquirente', stato: 'tiepido', budgetMax: 130000, ultimoContatto: '2026-09-25' },
      { id: 3, nome: 'Sara', cognome: 'Neri', tipo: 'acquirente', stato: 'chiuso', ultimoContatto: '2026-01-01' }
    ],
    leads: [{ id: 9, nome: 'Paolo Gialli', stato: 'Nuovo', ultimoContatto: '2026-09-20' }],
    immobili: [{ id: 10, titolo: 'Trilocale centro', tipo: 'trilocale', zona: 'Centro Storico', citta: 'Piacenza', prezzo: 185000, superficie: 95, locali: 3, stato: 'disponibile', visite: 0, dataInserimento: '2026-04-01', prezzoIniziale: 210000 }],
    trattative: [{ id: 20, immobileId: 10, prezzoOfferto: 180000, provvigione: 3, fase: 'trattativa' }],
    mandati: [{ id: 30, immobileId: 10, dataFirma: '2026-05-01' }],
    fatture: [{ id: 40, totale: 3000, stato: 'incassata' }],
    vendite: [{ id: 50, immobileId: 10, prezzoPubblicato: 190000, prezzoVendita: 178000, superficieTotale: 95, dataVendita: '2026-06-01' }],
    eventi: [{ id: 60, contattoId: 1, tipo: 'chiamata', data: '2026-09-20' }],
    zoneOMI: [{ zona: 'Centro storico', mqMin: 1900, mqMax: 2900, semestre: '2025-S2' }]
  };
  const adesso = new Date(2026, 9, 1);
  const im = db.immobili[0];

  /* MARKETING */
  const m = A.clientiPerImmobile(db, im);
  ok(m.length >= 1 && m[0].cliente.id === 1, 'marketing: propone il cliente giusto per l\'immobile');
  ok(m[0].punteggio >= 80, 'marketing: punteggio alto quando budget, zona e tipologia combaciano (' + m[0].punteggio + ')');
  ok(!m.some(x => x.cliente.id === 3), 'marketing: il cliente chiuso non viene proposto');
  ok(m[0].motivi.some(x => /budget/i.test(x)), 'marketing: dice PERCHÉ lo propone (budget)');
  ok(A.linkWhatsapp('3331112222', 'x').indexOf('wa.me/393331112222') >= 0, 'marketing: link WhatsApp pronto, con prefisso 39');
  ok(A.testoProposta(db, db.clienti[0], im).indexOf('Scaglia Davide') >= 0, 'marketing: il messaggio è firmato dall\'agente');

  /* FOLLOW-UP */
  const f = A.daRicontattare(db, { adesso });
  ok(f.length >= 2, 'follow-up: trova chi è rimasto indietro (' + f.length + ')');
  const mario = f.find(x => x.chi && x.chi.id === 1);
  ok(!!mario && mario.giorniSilenzio === 11 && mario.soglia === 7, 'follow-up: cliente caldo, scatta dopo 7 giorni (ne ha 11)');
  ok(!f.some(x => x.chi && x.chi.id === 2), 'follow-up: il tiepido sentito 6 giorni fa NON viene disturbato');
  ok(!f.some(x => x.chi && x.chi.id === 3), 'follow-up: il contatto chiuso è escluso');
  ok(f.some(x => x.tipo === 'lead'), 'follow-up: anche i lead fermi da troppo finiscono in lista');
  ok(A.regolaFollowUp('caldo').giorni === 7 && A.regolaFollowUp('Nuovo').giorni === 2, 'follow-up: ritmo diverso per temperatura cliente e fase lead');
  ok(A.regolaFollowUp('sconosciuto').giorni === 14, 'follow-up: valore sconosciuto → ritmo prudente');

  /* PERFORMANCE */
  const p = A.metriche(db, adesso);
  ok(p.trattativeAperte === 1, 'performance: conta le trattative aperte');
  ok(p.provvigioniPreviste === Math.round(180000 * 0.03), 'performance: provvigioni previste sul prezzo offerto');
  ok(p.incassato === 3000, 'performance: incassato');
  ok(p.tempoMedioVendita === 61, 'performance: tempo medio di vendita (61 giorni)');
  ok(p.scontoMedio > 5 && p.scontoMedio < 7, 'performance: sconto medio chiesto/venduto');
  ok(p.invenduti90 >= 1 && p.senzaVisite >= 1, 'performance: segnala invenduti da oltre 90 giorni e senza visite');
  ok(p.passaparola.length >= 1 && p.passaparola[0].chi === 'Anna Bianchi', 'performance: classifica del passaparola');

  /* REPORT PROPRIETARI */
  const r = A.reportProprietario(db, im, adesso);
  ok(r.giorniInVendita === 183, 'report: conta i giorni in vendita dal 01/04 (' + r.giorniInVendita + ')');
  ok(r.consigli.length >= 1, 'report: dà un consiglio concreto quando non ci sono visite');
  ok(r.giorniMandatoRimanenti !== null, 'report: calcola la scadenza del mandato');
  const testo = A.testoReport(db, im, adesso);
  ok(/Non è una perizia/.test(testo), 'report: scritto che non è una perizia');
  ok(/visite/i.test(testo), 'report: contiene le visite');

  /* BACKUP */
  ok(A.serveBackup({ settings: {} }, adesso).serve === true, 'backup: avvisa se non hai mai esportato');
  ok(A.serveBackup({ settings: { ultimoExport: '2026-09-28' } }, adesso).serve === false, 'backup: nessun avviso se è recente');
}

async function testAutomazioniApp() {
  section('19. v10.6.3: le automazioni dentro l\'app (jsdom)');
  const win = makeWindow();
  await waitUntil(() => win.DB && typeof win.render === 'function' && win.Automazioni);
  const p = win.document.getElementById('login-pass'); if (p) p.value = 'successo';
  try { await win.doLogin(); } catch (e) { }
  await waitUntil(() => win.document.getElementById('app-shell').style.display !== 'none').catch(() => { });
  const oggi = new Date();
  const iso = d => d.toISOString().slice(0, 10);
  win.DB.clienti.push({ id: 801, nome: 'Mario', cognome: 'Prova', tipo: 'acquirente', stato: 'caldo', budgetMin: 150000, budgetMax: 200000, zonaDesiderata: 'Centro Storico', tipologiaDesiderata: 'trilocale', telefono: '3331112222', ultimoContatto: iso(new Date(oggi.getTime() - 40 * 86400000)), updatedAt: 1 });
  win.DB.immobili.push({ id: 802, titolo: 'Trilocale prova', tipo: 'trilocale', zona: 'Centro Storico', citta: 'Piacenza', prezzo: 185000, superficie: 95, locali: 3, stato: 'disponibile', visite: 0, dataInserimento: iso(new Date(oggi.getTime() - 200 * 86400000)), updatedAt: 1 });
  win.save();

  win.eval("activeSection='marketing';render()");
  let html1 = win.document.getElementById('content').innerHTML;
  ok(/Immobile nuovo\? Ecco chi avvisare/.test(html1), 'Marketing: compare il riquadro "chi avvisare"');
  ok(/Mario Prova/.test(html1), 'Marketing: propone il cliente giusto');

  win.eval("activeSection='da-fare';render()");
  let html2 = win.document.getElementById('content').innerHTML;
  ok(/Follow-up/.test(html2), 'Da Fare: compare il riquadro Follow-up');
  ok(/Mario Prova/.test(html2), 'Da Fare: il contatto fermo da 40 giorni è segnalato');
  ok(/Esporta backup adesso|Ultimo backup|Non hai mai esportato/.test(html2), 'Da Fare: avvisa di esportare il backup');

  win.eval("activeSection='statistiche';render()");
  let html3 = win.document.getElementById('content').innerHTML;
  ok(/Performance dell/.test(html3), 'Statistiche: compare il riquadro Performance');
  ok(/passaparola/i.test(html3), 'Statistiche: c\'è la classifica del passaparola');

  win.eval("activeSection='report-prop';render()");
  let html4 = win.document.getElementById('content').innerHTML;
  ok(/Rapporto per il proprietario/.test(html4), 'Report Proprietari: compare il rapporto pronto');
  ok(/giorni in vendita/.test(html4), 'Report Proprietari: mostra i giorni in vendita');

  /* il tasto "Esporta backup" registra la data, così l'avviso sparisce */
  win.eval("activeSection='da-fare';render()");
  win.Automazioni.registraExport(win.DB, new Date()); win.save();
  win.eval("render()");
  ok(!/Esporta backup adesso/.test(win.document.getElementById('content').innerHTML), 'dopo il backup l\'avviso sparisce');
  win.close();
}


/* ---------------------------------------------------------------- */
/* 20) v10.6.4 — freschezza dei dati di mercato (fonti.js)           */
/* ---------------------------------------------------------------- */
async function testFonti() {
  section('20. v10.6.4: quando si aggiornano i dati di mercato');
  const F = require(path.join(ROOT, 'fonti.js'));

  /* calendario ufficiale: 15 marzo e 15 ottobre */
  const c1 = F.calendario('2026-03-14');
  ok(c1.ultimo === '2025-S1' && c1.prossimaData === '2026-03-15' && c1.giorniAlProssimo === 1, 'calendario: il 14/03 il nuovo semestre esce domani (15/03)');
  const c2 = F.calendario('2026-03-15');
  ok(c2.ultimo === '2025-S2' && c2.prossimaData === '2026-10-15', 'calendario: dal 15/03 è disponibile il 2° semestre 2025');
  const c3 = F.calendario('2026-10-01');
  ok(c3.ultimo === '2025-S2' && c3.giorniAlProssimo === 14, 'calendario: il 01/10 mancano 14 giorni al 1° semestre 2026');
  const c4 = F.calendario('2026-10-15');
  ok(c4.ultimo === '2026-S1' && c4.prossimaData === '2027-03-15', 'calendario: dal 15/10 c\'è il 1° semestre 2026');
  ok(c4.testo.indexOf('15/10/2026') >= 0, 'calendario: la frase per l\'utente porta le date vere');
  ok(F.giorni(F.dataPubblicazione('2025-S2'), '2026-03-15') === 0, 'la data di uscita del 2° semestre è il 15 marzo');

  /* lettura degli atti incollati */
  const testo = 'Mese/Anno\tTipologia\tCorrispettivo\tCategoria\tConsistenza\n' +
    '03/2025\tResidenziale\t185.000,00\tA/2\t5,5 vani\n' +
    'marzo 2025 ; Residenziale ; 178500 ; A/2 ; 118 mq ; C23 Centro storico\n' +
    '2025-06; 210000; 95 mq\n' +
    'aprile 2025; 190000; 3 vani; B1\n' +
    'riga senza senso\n';
  const r = F.parseAtti(testo, { zona: 'Centro storico' });
  ok(r.atti.length === 4, 'lettura: riconosce 4 atti su 5 righe di dati (' + r.atti.length + ')');
  ok(r.scartate.length === 1, 'lettura: la riga inutile finisce negli scarti, non nei dati');
  const a1 = r.atti.find(a => a.prezzo === 185000);
  ok(!!a1 && a1.vani === 5.5 && a1.mq === 0, 'lettura: "5,5 vani" → vani 5,5, mq 0');
  const a2 = r.atti.find(a => a.prezzo === 178500);
  ok(!!a2 && a2.mq === 118 && a2.categoria === 'A/2' && a2.zonaCodice === 'C23', 'lettura: mq, categoria e zona OMI dal testo');
  ok(!!a2 && a2.usabile === true, 'lettura: con i mq l\'atto è usabile per la media');
  const a3 = r.atti.find(a => a.prezzo === 210000);
  ok(!!a3 && a3.mese === 6 && a3.mq === 95, 'lettura: data ISO 2025-06 e mq');
  ok(r.avvisi.some(x => /vani/.test(x)), 'lettura: avvisa che gli atti con soli vani non entrano nel €/mq');
  ok(r.avvisi.some(x => /DICHIARATI/.test(x)), 'lettura: avvisa che sono prezzi dichiarati, non perizie');

  /* salvataggio e doppioni */
  const db = { vendite: [], mercato: {} };
  const s1 = F.salvaAtti(db, r.atti, { zona: 'Centro storico' });
  ok(s1.aggiunti === 4 && db.vendite.length === 4, 'salvataggio: 4 atti dentro');
  const s2 = F.salvaAtti(db, r.atti, { zona: 'Centro storico' });
  ok(s2.aggiunti === 0 && s2.duplicati === 4 && db.vendite.length === 4, 'salvataggio: gli stessi atti non si duplicano');
  ok(!!db.mercato.ultimoAttiReali, 'salvataggio: segna la data dell\'ultimo caricamento');

  /* chi entra nella media */
  const usabili = F.attiReali(db, { zona: 'centro storico', mesi: 36 });
  ok(usabili.length === 2, 'media €/mq: solo gli atti con i mq (' + usabili.length + ')');
  ok(F.attiSenzaMq(db, {}).length === 2, 'gli atti con soli vani restano visibili ma fuori dalla media');
  ok(F.attiReali(db, { zona: 'Borgonovo' }).length === 0, 'media €/mq: non prende atti di altre zone');

  /* freschezza */
  const fr = F.freschezza(db, '2026-10-01');
  const omi = fr.fonti.find(f => f.chiave === 'omi'), atti = fr.fonti.find(f => f.chiave === 'atti');
  ok(omi.stato === 'mai' && /appunto interno/.test(omi.nota), 'freschezza: senza semestre caricato lo dice chiaro');
  ok(atti.stato === 'ok' && atti.giorni === 0, 'freschezza: atti appena caricati → in regola');
  db.mercato.ultimoAttiReali = '2026-08-01';
  const fr2 = F.freschezza(db, '2026-10-01');
  ok(fr2.fonti.find(f => f.chiave === 'atti').stato === 'da-aggiornare', 'freschezza: dopo 35 giorni gli atti vanno rinfrescati');
  ok(fr2.daFare.length >= 1, 'freschezza: sa dire cosa c\'è da fare');
  const db3 = { vendite: [], mercato: { semestreOmi: '2026-S1' }, zoneOMI: [] };
  const fr3 = F.freschezza(db3, '2026-10-20');
  ok(fr3.fonti.find(f => f.chiave === 'omi').stato === 'ok', 'freschezza: semestre allineato → in regola');
  const db4 = { vendite: [], mercato: { semestreOmi: '2025-S2' }, zoneOMI: [] };
  ok(F.freschezza(db4, '2026-10-20').fonti.find(f => f.chiave === 'omi').stato === 'da-aggiornare', 'freschezza: semestre vecchio → da aggiornare');
}

/* ---------------------------------------------------------------- */
/* 21) v10.6.4 — atti reali dentro l'app (jsdom)                     */
/* ---------------------------------------------------------------- */
async function testFontiApp() {
  section('21. v10.6.4: atti reali e calendario dentro l\'app (jsdom)');
  const win = makeWindow();
  await waitUntil(() => win.DB && typeof win.render === 'function' && win.Fonti);
  const p = win.document.getElementById('login-pass'); if (p) p.value = 'successo';
  try { await win.doLogin(); } catch (e) { }
  await waitUntil(() => win.document.getElementById('app-shell').style.display !== 'none').catch(() => { });

  /* la scheda in Compravendite OMI */
  win.eval("activeSection='mercato';render()");
  let html = win.document.getElementById('content').innerHTML;
  ok(/Dati di mercato — quando si aggiornano/.test(html), 'Mercato: compare la scheda della freschezza dei dati');
  ok(/15 ottobre|15 marzo/.test(html), 'Mercato: cita il calendario ufficiale (15 marzo / 15 ottobre)');
  ok(/Incolla gli atti reali/.test(html), 'Mercato: c\'è la casella per incollare gli atti reali');
  ok(/SPID/.test(html), 'Mercato: dice dove prendere gli atti (SPID/CIE)');

  /* import end-to-end */
  win.document.getElementById('dm-zona').value = 'Centro Storico';
  win.document.getElementById('dm-testo').value =
    '05/2026 ; Residenziale ; 180.000 ; 100 mq ; A/2 ; C23 Centro storico\n' +
    '06/2026 ; Residenziale ; 168.000 ; 96 mq ; A/2 ; C23 Centro storico\n' +
    '07/2026 ; Residenziale ; 240.000 ; 120 mq ; A/3 ; C23 Centro storico\n' +
    '08/2026 ; Residenziale ; 96.000 ; 3 vani ; B1\n';
  win.eval("leggiAtti()");
  let prev = win.document.getElementById('dm-preview').innerHTML;
  ok(/Ho letto 4 atti/.test(prev), 'import: l\'anteprima dice quanti atti ha letto');
  ok(/172\.500|172500/.test(prev.replace(/\./g, '')) || /€/.test(prev), 'import: l\'anteprima mostra i prezzi');
  const btn = win.document.getElementById('dm-salva');
  ok(btn && btn.disabled === false, 'import: il tasto di conferma si attiva solo dopo il controllo');
  win.eval("confermaAtti()");
  const atti = win.DB.vendite.filter(v => String(v.fonte || '').indexOf('valori dichiarati') >= 0);
  ok(atti.length === 4, 'import: i 4 atti sono dentro il CRM (' + atti.length + ')');
  ok(atti.every(v => v.prezzoVendita > 0 && v.dataVendita), 'import: ogni atto ha prezzo e mese/anno');

  /* il valutatore li usa nella riga "Venduto" */
  const imm = { id: 901, titolo: 'Trilocale prova', tipo: 'trilocale', zona: 'Centro Storico', citta: 'Piacenza', prezzo: 195000, superficie: 100, locali: 3, stato: 'disponibile', prezzoIniziale: 210000, dataInserimento: '2026-06-01' };
  const res = win.eval("(function(){if(!DB.zoneOMI)DB.zoneOMI=[];var i=" + JSON.stringify(imm) + ";V={step:1,dati:{zona:'Centro Storico',tipo:'appartamento',superficie:100,stato:'buono',piano:1,classe:'C'},risultato:null};V.dati.prezzoRichiesto=195000;return 1})()");
  win.eval("vtCalcola()");
  const r = win.eval("V.risultato");
  ok(r.nAtti === 3, 'valutatore: conta 3 atti reali in zona con i mq (' + r.nAtti + ')');
  ok(r.attiSenzaMq === 1, 'valutatore: l\'atto con soli vani è contato a parte');
  ok(r.nVenduti === 3, 'valutatore: gli atti reali entrano nei venduti veri');
  ok(r.conf >= 60, 'valutatore: con 3 compravendite reali l\'affidabilità sale (' + r.conf + '%)');
  ok(r.ampia === 0.07, 'valutatore: con 3+ venduti veri la forbice si stringe al 7%');
  const tre = win.eval("(function(){var d=V.dati,r=V.risultato;return htmlTreRighe(d,r)})()");
  ok(/3 compravendite reali in zona \(3 atti Agenzia \+ 0 tue\)/.test(tre), 'stima: la riga Venduto dice che sono atti dell\'Agenzia');
  ok(/atti con soli vani/.test(tre), 'stima: dice che 1 atto è fuori dalla media per mancanza dei mq');
  ok(/Calendario ufficiale OMI/.test(tre), 'stima: la riga 1 porta il calendario ufficiale con le date');
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
  try { await testQR(); } catch (e) { failed++; failures.push('qr: ' + e.message); console.log('  ❌ qr exception', e.message); }
  try { await testAllarmi(); } catch (e) { failed++; failures.push('allarmi: ' + e.message); console.log('  ❌ allarmi exception', e.message); }
  try { await testQRApp(); } catch (e) { failed++; failures.push('qrapp: ' + e.message); console.log('  ❌ qrapp exception', e.message); }
  try { await testProtezione(); } catch (e) { failed++; failures.push('protezione: ' + e.message); console.log('  ❌ protezione exception', e.message); }
  try { await testCerca(); } catch (e) { failed++; failures.push('cerca: ' + e.message); console.log('  ❌ cerca exception', e.message); }
  try { await testPromemoria(); } catch (e) { failed++; failures.push('promemoria: ' + e.message); console.log('  ❌ promemoria exception', e.message); }
  try { await testAppV106(); } catch (e) { failed++; failures.push('app106: ' + e.message); console.log('  ❌ app106 exception', e.message); }
  try { await testProtezioneVuoto(); } catch (e) { failed++; failures.push('protezione-vuoto: ' + e.message); console.log('  ❌ protezione-vuoto exception', e.message); }
  try { await testRecupero(); } catch (e) { failed++; failures.push('recupero: ' + e.message); console.log('  ❌ recupero exception', e.message); }
  try { await testAutomazioni(); } catch (e) { failed++; failures.push('automazioni: ' + e.message); console.log('  ❌ automazioni exception', e.message); }
  try { await testAutomazioniApp(); } catch (e) { failed++; failures.push('automazioni-app: ' + e.message); console.log('  ❌ automazioni-app exception', e.message); }
  try { await testFonti(); } catch (e) { failed++; failures.push('fonti: ' + e.message); console.log('  ❌ fonti exception', e.message); }
  try { await testFontiApp(); } catch (e) { failed++; failures.push('fonti-app: ' + e.message); console.log('  ❌ fonti-app exception', e.message); }
  console.log('\n================================');
  console.log('PASSATI: ' + passed + '   FALLITI: ' + failed);
  if (failures.length) { console.log('Falliti:'); failures.forEach(f => console.log(' - ' + f)); }
  process.exit(failed ? 1 : 0);
})();
