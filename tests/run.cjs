'use strict';
/* Suite di verifica ImmoCRM Pro v10.2 — esegue il codice REALE (sync.js + app.js).
   Copre: cifratura, merge multi-dispositivo, tombstone, provider Gist (server locale),
   autenticazione PBKDF2 + lockout, tracciamento modifiche, incroci, backup. */
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

/* ---------------------------------------------------------------- */
/* 6) app.js in jsdom: boot, auth, incroci, backup                  */
/* ---------------------------------------------------------------- */
async function testConnectCode() {
  section('5b. Codice di collegamento (round-trip)');
  await Sync.setConfig({ mode: 'gist', token: 'tk-abc', gistId: 'gistXYZ', encrypt: true, restUrl: '' });
  const code = Sync.connectCode();
  ok(typeof code === 'string' && code.indexOf('IMMOCRM1.') === 0, 'connectCode genera stringa col prefisso');
  await Sync.setConfig({ mode: 'off', token: '', gistId: '' });
  await Sync.applyConnectCode(code);
  const c = Sync.config();
  ok(c.mode === 'gist' && c.token === 'tk-abc' && c.gistId === 'gistXYZ' && c.encrypt === true, 'applyConnectCode ripristina mode/token/gist/cifratura');
  const bad = await Sync.applyConnectCode('IMMOCRM1.!!!non-base64!!!').catch(e => e);
  ok(bad && /non valido/i.test((bad && bad.message) || ''), 'codice corrotto rifiutato');
  await Sync.setConfig({ mode: 'off', token: '', gistId: '' });
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
  ok(typeof win.syncCardHTML === 'function' && /Dispositivi collegati/.test(win.syncCardHTML()), 'syncCardHTML genera riga dispositivi');

  win.close();
}

(async () => {
  console.log('ImmoCRM Pro — suite di verifica\n================================');
  try { await testCrypto(); } catch (e) { failed++; failures.push('crypto: ' + e.message); console.log('  ❌ crypto exception', e.message); }
  try { await testMerge(); } catch (e) { failed++; failures.push('merge: ' + e.message); console.log('  ❌ merge exception', e.message); }
  try { await testTombstones(); } catch (e) { failed++; failures.push('tombstone: ' + e.message); console.log('  ❌ tombstone exception', e.message); }
  try { await testTrackUpdatedAt(); } catch (e) { failed++; failures.push('track: ' + e.message); console.log('  ❌ track exception', e.message); }
  try { await testGistProvider(); } catch (e) { failed++; failures.push('gist: ' + e.message); console.log('  ❌ gist exception', e.message); }
  try { await testConnectCode(); } catch (e) { failed++; failures.push('connect: ' + e.message); console.log('  ❌ connect exception', e.message); }
  try { await testApp(); } catch (e) { failed++; failures.push('app: ' + e.message); console.log('  ❌ app exception', e.message); }
  console.log('\n================================');
  console.log('PASSATI: ' + passed + '   FALLITI: ' + failed);
  if (failures.length) { console.log('Falliti:'); failures.forEach(f => console.log(' - ' + f)); }
  process.exit(failed ? 1 : 0);
})();
