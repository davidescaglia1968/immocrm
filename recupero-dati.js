/* ============================================================================
   v10.6.1 — CONTROLLO E RECUPERO DEI DATI
   A cosa serve: se i contatti non si vedono, questa parte cerca in TUTTE le
   copie che il CRM tiene sul dispositivo (e nel cloud) e le rimette dentro
   con un clic. Nessun dato viene cancellato da qui: si legge e si riporta.
   ============================================================================ */

function contaDati(db) {
  if (!db || typeof db !== 'object') return null;
  const c = {
    clienti: (db.clienti || []).length, immobili: (db.immobili || []).length,
    chiamate: (db.chiamate || []).length, eventi: (db.eventi || []).length,
    documenti: (db.documenti || []).length, fatture: (db.fatture || []).length,
    mandati: (db.mandati || []).length, promemoria: (db.promemoria || []).length
  };
  c.totale = c.clienti + c.immobili + c.chiamate + c.eventi + c.documenti + c.fatture + c.mandati;
  return c;
}

/* Copie che stanno nella memoria del browser: si leggono subito. */
function copieDaMemoria() {
  const out = [];
  const leggi = (chiave, etichetta, estrai) => {
    try {
      const raw = localStorage.getItem(chiave);
      if (!raw) return;
      const v = JSON.parse(raw);
      const db = estrai(v);
      if (!db || typeof db !== 'object') return;
      out.push({ chiave: 'mem:' + chiave, etichetta: etichetta, db: db, quando: db._ts || (v && v.ts) || 0 });
    } catch (e) { }
  };
  leggi('immocrm_pro_v10', 'Copia principale', v => v);
  leggi('immocrm_ls_main', 'Specchio di riserva', v => v && v.db);
  leggi('immocrm_emg_a', 'Copia di emergenza A', v => v && v.db);
  leggi('immocrm_emg_b', 'Copia di emergenza B', v => v && v.db);
  leggi('immocrm_backup_pre_106', 'Copia di sicurezza (prima dell\'aggiornamento)', v => v);
  leggi('immocrm_import_backup', 'Copia prima di un\'importazione', v => v);
  return out;
}

/* Copie dentro l'archivio del browser (IndexedDB) e storico dei salvataggi. */
async function copieDaIndexed() {
  const out = [];
  try {
    if (!window.ImmoSync) return out;
    const I = ImmoSync._internal || {};
    if (I.idbGet) {
      const main = await I.idbGet('main', 'db');
      if (main && main.db) out.push({ chiave: 'idb:main', etichetta: 'Copie del browser (IndexedDB)', db: main.db, quando: main.ts || 0 });
    }
    if (ImmoSync.historyList && ImmoSync.historyGet) {
      const lista = (await ImmoSync.historyList()) || [];
      for (const m of lista.slice(0, 15)) {
        try {
          const db = await ImmoSync.historyGet(m.ts);
          if (db) out.push({ chiave: 'hist:' + m.ts, etichetta: 'Salvataggio automatico', db: db, quando: m.ts });
        } catch (e) { }
      }
    }
  } catch (e) { console.warn('copie DaIndexed', e); }
  return out;
}

/* Tutte le copie, con il numero di contatti dentro. Le più ricche in cima. */
async function elencoCopie() {
  const corrente = { chiave: 'corrente', etichetta: 'Dati in uso adesso', db: DB, quando: (DB && DB._ts) || Date.now() };
  let tutte = [corrente].concat(copieDaMemoria()).concat(await copieDaIndexed());
  tutte = tutte.map(c => ({ chiave: c.chiave, etichetta: c.etichetta, db: c.db, quando: c.quando, conta: contaDati(c.db) })).filter(c => c.conta);
  tutte.sort((a, b) => (b.conta.clienti - a.conta.clienti) || (b.quando - a.quando));
  return tutte;
}

function quandoTesto(ts) {
  if (!ts) return 'data non segnata';
  try { return new Date(ts).toLocaleString('it-IT'); } catch (e) { return '—'; }
}

/* Pannello: mostra dove sono i dati e permette di riportarli dentro. */
async function apriRecuperoDati() {
  showToast('🔎 Guardo tutte le copie…', 'info', 2500);
  let copie = [];
  try { copie = await elencoCopie(); } catch (e) { copie = []; }
  const conContatti = copie.filter(c => c.conta.clienti > 0);
  const righe = copie.map(c => {
    const mia = c.chiave === 'corrente';
    return `<tr>
      <td><b>${esc(c.etichetta)}</b><div style="font-size:10px;color:var(--text2)">${quandoTesto(c.quando)}${mia ? ' · in uso ora' : ''}</div></td>
      <td style="text-align:center"><b class="${c.conta.clienti > 0 ? 'text-green' : 'text-red'}">${c.conta.clienti}</b><div style="font-size:10px;color:var(--text2)">contatti</div></td>
      <td style="text-align:center">${c.conta.immobili}<div style="font-size:10px;color:var(--text2)">immobili</div></td>
      <td style="text-align:center">${c.conta.totale}<div style="font-size:10px;color:var(--text2)">schede in tutto</div></td>
      <td style="text-align:right">${mia ? '<span class="badge">in uso</span>' : `<button class="btn btn-gold btn-xs" onclick="recuperaDa('${c.chiave}')">↩️ Recupera</button>`}</td>
    </tr>`;
  }).join('');
  document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-lg" onclick="event.stopPropagation()">
    <h2>🆘 Recupero dei dati</h2>
    <div class="login-hint" style="margin-bottom:10px">Qui non si cancella niente: si <b>legge</b> quello che c'è nelle copie e lo si riporta dentro. Il CRM tiene più copie dei tuoi dati, sul dispositivo e (se collegato) nel cloud cifrato.</div>
    ${conContatti.length ? `<div class="alert green">✅ Ho trovato <b>${conContatti.length}</b> ${conContatti.length === 1 ? 'copia che contiene contatti' : 'copie che contengono contatti'}. La più ricca ha <b>${conContatti[0].conta.clienti}</b> contatti e ${conContatti[0].conta.immobili} immobili (${esc(conContatti[0].etichetta)}).</div>`
      : '<div class="alert orange">⚠️ Su questo dispositivo non trovo copie con contatti. Se il telefono li ha ancora, aprili da lì: non cancellare niente. Se hai il cloud collegato, prova il tasto qui sotto.</div>'}
    <div class="table-wrap"><table class="table"><thead><tr><th>Copia</th><th>Contatti</th><th>Immobili</th><th>Totale</th><th></th></tr></thead><tbody>${righe}</tbody></table></div>
    <div class="row-tight" style="margin-top:12px;flex-wrap:wrap;gap:8px">
      <button class="btn btn-primary" onclick="provaDalCloud()">☁️ Prova a scaricare dal cloud</button>
      <button class="btn btn-ghost" onclick="refertoCopie()">📄 Esporta il referto (per assistenza)</button>
      <button class="btn btn-ghost" onclick="closeModal()">Chiudi</button>
    </div>
    <div class="login-hint" style="margin-top:8px">Il referto contiene solo i <b>numeri</b> delle copie: nessun nome, nessun telefono. Serve per capire dove sono i dati.</div>
  </div></div>`);
}

/* Riporta dentro i dati di una copia. */
async function recuperaDa(chiave) {
  let copie = [];
  try { copie = await elencoCopie(); } catch (e) { }
  const c = copie.find(x => x.chiave === chiave);
  if (!c) { showToast('Copia non trovata', 'error'); return; }
  const n = c.conta.clienti, m = c.conta.immobili;
  if (!confirm('Recuperare i dati da "' + c.etichetta + '"?\n\nContiene ' + n + ' contatti e ' + m + ' immobili.\n\nI dati attuali restano salvati in una copia di riserva: se non ti piace, si torna indietro.')) return;
  /* Prima mette da parte quello che c'è adesso: si può sempre tornare indietro. */
  try { localStorage.setItem('immocrm_backup_prima_del_recupero', localStorage.getItem(KEY) || '{}'); } catch (e) { }
  DB = JSON.parse(JSON.stringify(c.db));
  window.DB = DB;
  try { initDB(); } catch (e) { }
  if (window.ImmoSync) { try { ImmoSync.adopt(DB); ImmoSync.mirror(DB); } catch (e) { } }
  try { save(); } catch (e) { }
  closeModal();
  render(); if (typeof updateBadges === 'function') updateBadges();
  showToast('✅ Recuperati ' + n + ' contatti da: ' + c.etichetta, 'success', 5000);
}

/* Prova a riscaricare dal cloud cifrato. */
async function provaDalCloud() {
  if (!window.ImmoSync || !ImmoSync.pull) { showToast('Sincronizzazione non disponibile', 'error'); return; }
  showToast('☁️ Chiedo i dati al cloud…', 'info', 3000);
  try {
    const r = await ImmoSync.pull({ reason: 'recupero' });
    const n = contaDati(DB).clienti;
    if (r && r.empty) { showToast('Nel cloud non c\'è ancora un archivio', 'error', 5000); return; }
    if (r && r.locked) { showToast('Il cloud è cifrato: reinserisci la password in Impostazioni → Sincronizzazione', 'error', 6000); return; }
    closeModal(); render();
    showToast('✅ Dati chiesti al cloud. Ora hai ' + n + ' contatti.', 'success', 5000);
  } catch (e) {
    showToast('Cloud non raggiungibile: ' + (e && e.message ? e.message : 'errore'), 'error', 6000);
  }
}

/* Referto per l'assistenza: solo numeri, nessun dato personale. */
async function refertoCopie() {
  let copie = [];
  try { copie = await elencoCopie(); } catch (e) { }
  const stato = (window.ImmoSync && ImmoSync.status) ? (ImmoSync.status() || {}) : {};
  const referto = {
    fattoIl: new Date().toISOString(),
    versione: '10.6.1',
    dispositivo: (window.ImmoSync && ImmoSync.deviceName) ? ImmoSync.deviceName() : 'questo',
    copie: copie.map(c => ({ nome: c.etichetta, quando: quandoTesto(c.quando), contatti: c.conta.clienti, immobili: c.conta.immobili, totale: c.conta.totale })),
    cloud: { stato: stato.state || 'sconosciuto', archivio: stato.mode || '—', ultimoInvio: stato.lastPush ? quandoTesto(stato.lastPush) : '—', ultimaLettura: stato.lastPull ? quandoTesto(stato.lastPull) : '—' }
  };
  scarica('referto-copie-immocrm.json', JSON.stringify(referto, null, 2), 'application/json');
  showToast('📄 Referto salvato: puoi mandarlo per assistenza (non contiene nomi)', 'success', 5000);
}

/* Avviso in alto se i contatti non si vedono ma una copia li ha. */
async function sicurezzaContatti() {
  try {
    if (DB && (DB.clienti || []).length > 0) return;      /* tutto a posto: non faccio nulla */
    const copie = await elencoCopie();
    const buona = copie.filter(c => c.chiave !== 'corrente' && c.conta.clienti > 0).sort((a, b) => b.conta.clienti - a.conta.clienti)[0];
    if (!buona) return;
    if (document.getElementById('avviso-recupero')) return;
    const barra = document.createElement('div');
    barra.id = 'avviso-recupero';
    barra.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:3000;background:#7f1d1d;color:#fff;padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px';
    barra.innerHTML = '<b>⚠️ Non vedo i contatti, ma ho trovato una copia con ' + buona.conta.clienti + ' contatti (' + esc(buona.etichetta) + ').</b>' +
      '<button class="btn btn-gold btn-sm" onclick="recuperaDa(\'' + buona.chiave + '\')">↩️ Recupera adesso</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="apriRecuperoDati()">Vedi tutte le copie</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'avviso-recupero\').remove()">Chiudi</button>';
    document.body.appendChild(barra);
  } catch (e) { console.warn('sicurezzaContatti', e); }
}
