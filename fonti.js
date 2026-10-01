/* ImmoCRM Pro — fonti.js  (v10.6.4)
   ------------------------------------------------------------------
   A COSA SERVE
   I dati di mercato non si aggiornano tutti allo stesso ritmo:
     - le QUOTAZIONI OMI (fascia €/mq) escono due volte l'anno:
       entro il 15 marzo (2° semestre dell'anno prima) ed entro il
       15 ottobre (1° semestre dell'anno in corso) — fonte: Agenzia
       delle Entrate, "Forniture dati OMI";
     - gli ATTI REALI (corrispettivi dichiarati, servizio "Consultazione
       Valori Immobiliari Dichiarati") si aggiornano ogni MESE;
     - le TUE compravendite si aggiornano quando le registri tu.
   Questo file sa il calendario ufficiale a memoria, dice sempre
   quanto è vecchio ogni dato che il CRM sta usando, e legge gli atti
   reali che incolli tu dal servizio dell'Agenzia. Tutto in locale:
   non chiama nessun servizio esterno e non manda niente in giro.
   ------------------------------------------------------------------ */
(function (global) {
  'use strict';

  const MESI = { gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12 };
  const NOMI = ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const GIORNO = 86400000;

  function aData(x) {
    if (x instanceof Date) return new Date(x.getFullYear(), x.getMonth(), x.getDate());
    if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x)) { const p = x.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    const d = new Date(x); return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function it(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(); }
  function giorni(tra, oggi) { return Math.round((aData(oggi) - aData(tra)) / GIORNO); }

  /* ---------------------------------------------------------------- */
  /* 1) CALENDARIO UFFICIALE OMI                                      */
  /* ---------------------------------------------------------------- */
  /* '2025-S2' → data di pubblicazione (15/03/2026) e nome per esteso. */
  function dataPubblicazione(semestre) {
    const m = /^(\d{4})-S([12])$/.exec(String(semestre || ''));
    if (!m) return null;
    const anno = +m[1], s = +m[2];
    return s === 1 ? new Date(anno, 9, 15) : new Date(anno + 1, 2, 15);
  }
  function etichettaSemestre(semestre) {
    const m = /^(\d{4})-S([12])$/.exec(String(semestre || ''));
    if (!m) return semestre || '—';
    return (m[2] === '1' ? '1° semestre ' : '2° semestre ') + m[1];
  }
  function semestreDiAnno(anno, s) { return anno + '-S' + s; }

  /* Quale semestre è pubblicato oggi, e quando esce il prossimo. */
  function calendario(oggi) {
    const d = aData(oggi || new Date());
    const a = d.getFullYear();
    const dopo15marzo = (d.getMonth() + 1) > 3 || (d.getMonth() + 1) === 3 && d.getDate() >= 15;
    const dopo15ottobre = (d.getMonth() + 1) > 10 || (d.getMonth() + 1) === 10 && d.getDate() >= 15;
    let ultimo, prossimo, prossimaData;
    if (dopo15ottobre) { ultimo = semestreDiAnno(a, 1); prossimo = semestreDiAnno(a, 2); prossimaData = new Date(a + 1, 2, 15); }
    else if (dopo15marzo) { ultimo = semestreDiAnno(a - 1, 2); prossimo = semestreDiAnno(a, 1); prossimaData = new Date(a, 9, 15); }
    else { ultimo = semestreDiAnno(a - 1, 1); prossimo = semestreDiAnno(a - 1, 2); prossimaData = new Date(a, 2, 15); }
    return {
      ultimo: ultimo,
      ultimoEtichetta: etichettaSemestre(ultimo),
      ultimoDal: ymd(dataPubblicazione(ultimo)),
      prossimo: prossimo,
      prossimoEtichetta: etichettaSemestre(prossimo),
      prossimaData: ymd(prossimaData),
      prossimaDataIt: it(prossimaData),
      giorniAlProssimo: Math.max(0, giorni(d, prossimaData)),
      uscitoDa: Math.max(0, giorni(dataPubblicazione(ultimo), d)),
      testo: 'Oggi l\'ultimo dato ufficiale OMI è il ' + etichettaSemestre(ultimo) + ' (uscito il ' + it(dataPubblicazione(ultimo)) + '). Il prossimo (' + etichettaSemestre(prossimo) + ') esce il ' + it(prossimaData) + ', fra ' + Math.max(0, giorni(d, prossimaData)) + ' giorni.'
    };
  }

  /* ---------------------------------------------------------------- */
  /* 2) LEGGERE GLI ATTI REALI (valori dichiarati)                    */
  /* ---------------------------------------------------------------- */
  /* Accetta quello che esce dal servizio dell'Agenzia incollato qui:
     tabulazioni, punti e virgola, "185.000,00", "marzo 2025", "5,5 vani",
     "118 mq", "A/2", zona "C23" o un nome di zona. Righe non capite
     finiscono negli scarti: non si inventa niente. */
  function numeriTesto(s) {
    const out = []; const re = /(\d{1,3}(?:[.\s]\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g; let m;
    while ((m = re.exec(s))) out.push({ testo: m[0], inizio: m.index, fine: m.index + m[0].length });
    return out;
  }
  function aNumero(t) {
    let s = String(t).replace(/\s/g, '');
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.indexOf(',') >= 0) { const dopo = s.split(',')[1] || ''; s = dopo.length === 3 ? s.replace(',', '') : s.replace(',', '.'); }
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); /* 180.000 = centoottantamila */
    const n = parseFloat(s);
    return isFinite(n) ? n : null;
  }
  const INTESTAZIONI = /^(mese|data|zona|comune|localit|categoria|tipologia|corrispettiv|consistenz|risultat|immobil|atti?\b|totale|valore|superficie|van[oi]\b)/i;

  function parseRiga(riga, opt) {
    opt = opt || {};
    let s = String(riga == null ? '' : riga).replace(/\u00a0/g, ' ').replace(/\t+/g, ' ; ').trim();
    if (!s) return null;
    if (/^[-–—;|,\s.]+$/.test(s)) return null;
    if (INTESTAZIONI.test(s) && !/\d{4}/.test(s)) return null;

    /* mese / anno */
    let anno = null, mese = null, usati = [];
    let m = /(\d{1,2})\s*[\/\-\.]\s*(20\d{2})/.exec(s);
    if (m) { mese = +m[1]; anno = +m[2]; usati.push([m.index, m.index + m[0].length]); }
    if (anno === null && /\b\d{4}\b/.test(s)) {
      const mn = /(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/i.exec(s);
      if (mn) mese = MESI[mn[1].toLowerCase()];
      const an = /(20\d{2})/.exec(s);
      if (an) { anno = +an[1]; usati.push([an.index, an.index + an[0].length]); }
    }
    if (mese === null && anno !== null && /(^|\D)(20\d{2})-(\d{1,2})(\D|$)/.test(s)) {
      const iso = /(20\d{2})-(\d{1,2})/.exec(s); if (iso) { mese = +iso[2]; anno = +iso[1]; usati.push([iso.index, iso.index + iso[0].length]); }
    }
    if (!anno || !mese || mese < 1 || mese > 12) {
      return { scarto: true, riga: s, motivo: 'manca il mese e l\'anno dell\'atto' };
    }

    /* superficie e vani */
    let mq = 0, vani = 0;
    const mmq = /(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:mq|m²|m2|metri\s*quadrati)/i.exec(s);
    if (mmq) { const v = aNumero(mmq[1]); if (v && v >= 15 && v <= 2000) mq = Math.round(v); usati.push([mmq.index, mmq.index + mmq[0].length]); }
    const mva = /(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:vani|vano)\b/i.exec(s);
    if (mva) { const v = aNumero(mva[1]); if (v) vani = Math.round(v * 10) / 10; usati.push([mva.index, mva.index + mva[0].length]); }

    /* categoria catastale e zona OMI */
    const mcat = /\b([A-E])\s*\/\s*(\d{1,2})\b/.exec(s);
    const categoria = mcat ? (mcat[1].toUpperCase() + '/' + mcat[2]) : '';
    let zonaCodice = '';
    const mz = /\b([A-E]\d{1,2})\b/.exec(s.replace(/\b[A-E]\s*\/\s*\d{1,2}\b/g, ' '));
    if (mz && !new RegExp('\\b' + mz[1] + '\\s*(?:vani|mq|m²)').test(s)) zonaCodice = mz[1];

    /* prezzo: il numero più grande che non sia già stato usato */
    const cand = numeriTesto(s).filter(n => !usati.some(u => n.inizio >= u[0] && n.fine <= u[1]));
    let prezzo = 0;
    cand.forEach(n => {
      const v = aNumero(n.testo);
      if (v && v >= 5000 && v <= 8000000 && v > prezzo) prezzo = Math.round(v);
    });

    /* nome zona: pezzo di testo dopo il codice, se c'è */
    let zonaNome = '';
    if (mz && zonaCodice) {
      const dopo = s.slice(mz.index + mz[0].length).replace(/^[\s;|\-–—]+/, '').replace(/\s*;\s*/g, ' ').trim();
      if (dopo && dopo.length >= 3 && !/^\d/.test(dopo)) zonaNome = dopo.slice(0, 40);
    }
    if (!prezzo) return { scarto: true, riga: s, motivo: 'non trovo il prezzo dichiarato' };
    if (!mq && !vani) return { scarto: true, riga: s, motivo: 'non trovo né i mq né i vani (servono per confrontare il prezzo)' };

    const zona = (opt.zona || '').trim() || zonaNome || zonaCodice || '';
    return {
      anno: anno, mese: mese, data: anno + '-' + String(mese).padStart(2, '0') + '-01',
      meseAnno: NOMI[mese] + ' ' + anno,
      prezzo: prezzo, mq: mq, vani: vani, categoria: categoria,
      zonaCodice: zonaCodice, zonaNome: zonaNome, zona: zona,
      usabile: !!(mq > 0), riga: s
    };
  }

  function parseAtti(testo, opt) {
    opt = opt || {};
    const righe = String(testo || '').split(/\r?\n/);
    const atti = [], scartate = [];
    righe.forEach(r => {
      if (!r || !r.trim()) return;
      let p;
      try { p = parseRiga(r, opt); } catch (e) { p = { scarto: true, riga: r, motivo: 'riga non leggibile' }; }
      if (!p) return;
      if (p.scarto) scartate.push({ riga: String(r).trim().slice(0, 120), motivo: p.motivo });
      else atti.push(p);
    });
    const avvisi = [];
    const senzaMq = atti.filter(a => !a.usabile).length;
    if (senzaMq) avvisi.push(senzaMq + ' atti hanno i vani ma non i mq: si salvano, ma NON entrano nella media €/mq finché non ci scrivi i mq.');
    if (atti.length) avvisi.push('Sono i corrispettivi DICHIARATI negli atti: veri, ma se qualcuno ha dichiarato al minimo il numero è basso. Servono a farsi un\'idea, non sono una perizia.');
    return { atti: atti, scartate: scartate, avvisi: avvisi };
  }

  /* ---------------------------------------------------------------- */
  /* 3) SALVATAGGIO (con doppioni bloccati)                           */
  /* ---------------------------------------------------------------- */
  const FONTE = 'Agenzia Entrate — valori dichiarati';
  function chiaveAtto(a) { return [a.data, (a.zona || '').toLowerCase(), a.prezzo, a.mq || 0, a.vani || 0].join('|'); }

  function salvaAtti(db, atti, opt) {
    opt = opt || {};
    if (!db.vendite) db.vendite = [];
    const esistenti = {};
    db.vendite.forEach(v => { if (v && String(v.fonte || '').indexOf('valori dichiarati') >= 0) esistenti[[v.dataVendita, String(v.zona || '').toLowerCase(), v.prezzoVendita, v.mq || 0, v.vani || 0].join('|')] = true; });
    let aggiunti = 0, duplicati = 0;
    const quando = ymd(aData(opt.adesso || new Date()));
    (atti || []).forEach((a, i) => {
      if (!a || !a.prezzo || !a.data) return;
      const k = chiaveAtto(a);
      if (esistenti[k]) { duplicati++; return; }
      esistenti[k] = true;
      db.vendite.push({
        id: 'ar' + Date.now() + '-' + i,
        immobileId: null,
        titolo: 'Atto Agenzia' + (a.categoria ? ' ' + a.categoria : ''),
        zona: a.zona || opt.zona || '', citta: opt.citta || 'Piacenza',
        tipo: '', mq: a.mq || 0, vani: a.vani || 0, superficieTotale: a.mq || 0,
        locali: 0, prezzoPubblicato: 0, prezzoVendita: a.prezzo,
        dataVendita: a.data, meseAnnoAtto: a.meseAnno || '', categoria: a.categoria || '',
        fonte: FONTE, importato: quando, nota: 'Corrispettivo dichiarato nell\'atto'
      });
      aggiunti++;
    });
    if (!db.mercato) db.mercato = {};
    if (aggiunti) db.mercato.ultimoAttiReali = quando;
    return { aggiunti: aggiunti, duplicati: duplicati };
  }

  /* Atti reali usabili per il €/mq: solo quelli con i mq, in zona, recenti. */
  function attiReali(db, opt) {
    opt = opt || {};
    const mesi = opt.mesi || 36;
    const limit = new Date(); limit.setMonth(limit.getMonth() - mesi);
    const lim = ymd(limit);
    const stessaZona = (a, b) => !!(a && b && String(a).toLowerCase().trim() === String(b).toLowerCase().trim());
    return ((db && db.vendite) || []).filter(v =>
      v && String(v.fonte || '').indexOf('valori dichiarati') >= 0 && v.prezzoVendita > 0 &&
      (v.mq || 0) > 0 && (!v.dataVendita || v.dataVendita >= lim) &&
      (!opt.zona || !v.zona || stessaZona(v.zona, opt.zona))
    );
  }
  function attiSenzaMq(db, opt) {
    opt = opt || {};
    const stessaZona = (a, b) => !!(a && b && String(a).toLowerCase().trim() === String(b).toLowerCase().trim());
    return ((db && db.vendite) || []).filter(v => v && String(v.fonte || '').indexOf('valori dichiarati') >= 0 && v.prezzoVendita > 0 && !(v.mq > 0) && (!opt.zona || !v.zona || stessaZona(v.zona, opt.zona)));
  }

  /* ---------------------------------------------------------------- */
  /* 4) FRESCHEZZA: quanto è vecchio quello che sto usando            */
  /* ---------------------------------------------------------------- */
  function freschezza(db, oggi) {
    const d = aData(oggi || new Date());
    const c = calendario(d);
    const out = [];
    const m = (db && db.mercato) || {};

    /* Quotazioni OMI (fascia ufficiale) — semestrali */
    const sem = m.semestreOmi || (db && db.zoneOMI && db.zoneOMI[0] && db.zoneOMI[0].semestre) || '';
    const pubAttesa = dataPubblicazione(c.ultimo);
    let stato = 'ok', nota = '';
    if (!sem) { stato = 'mai'; nota = 'Non risulta caricato nessun semestre ufficiale: nel valutatore la prima riga è un appunto interno, non OMI.'; }
    else if (dataPubblicazione(sem)) {
      const pub = dataPubblicazione(sem);
      if (pub < pubAttesa) { stato = 'da-aggiornare'; nota = 'Hai il ' + etichettaSemestre(sem) + ', ma il ' + c.ultimoEtichetta + ' è già uscito il ' + c.ultimoDal.slice(8, 10) + '/' + c.ultimoDal.slice(5, 7) + '/' + c.ultimoDal.slice(0, 4) + '.'; }
      else nota = 'Sei in regola: stai usando il semestre più recente pubblicato.';
    } else { stato = 'da-controllare'; nota = 'Semestre scritto in un formato non riconosciuto: usa 2025-S1 o 2025-S2.'; }
    out.push({
      chiave: 'omi', fonte: 'Quotazioni OMI — fascia ufficiale', cadenza: 'due volte l\'anno: entro il 15 marzo e il 15 ottobre',
      aggiornatoAl: sem || '', aggiornatoEtichetta: sem ? etichettaSemestre(sem) : 'nessuno', giorni: sem && dataPubblicazione(sem) ? giorni(dataPubblicazione(sem), d) : null,
      stato: stato, nota: nota, dove: 'valutatore', prossimo: c.prossimaDataIt, giorniAlProssimo: c.giorniAlProssimo
    });

    /* Atti reali — mensili */
    const ult = m.ultimoAttiReali || '';
    const nAtti = ((db && db.vendite) || []).filter(v => v && String(v.fonte || '').indexOf('valori dichiarati') >= 0).length;
    const g = ult ? giorni(ult, d) : null;
    out.push({
      chiave: 'atti', fonte: 'Atti reali — valori dichiarati', cadenza: 'ogni mese (servizio Agenzia delle Entrate)',
      aggiornatoAl: ult, aggiornatoEtichetta: ult ? (ult.slice(8, 10) + '/' + ult.slice(5, 7) + '/' + ult.slice(0, 4)) : 'mai',
      giorni: g, stato: !ult ? 'mai' : (g > 35 ? 'da-aggiornare' : 'ok'),
      nota: !ult ? 'Non hai ancora incollato atti reali: la riga "venduto" della stima vive solo delle tue compravendite.' :
        (g > 35 ? 'Sono passati ' + g + ' giorni: il servizio Agenzia si aggiorna ogni mese, vale la pena rinfrescarlo.' : 'Aggiornati da ' + g + ' giorni: va bene.'),
      quanti: nAtti, dove: 'mercato', prossimo: '', giorniAlProssimo: null
    });

    /* Le tue compravendite — quando le registri */
    const mie = ((db && db.vendite) || []).filter(v => v && v.prezzoVendita > 0 && v.prezzoPubblicato > 0);
    const ultima = mie.map(v => v.dataVendita || '').filter(Boolean).sort().pop() || '';
    const gm = ultima ? giorni(ultima, d) : null;
    out.push({
      chiave: 'vendite', fonte: 'Le tue compravendite', cadenza: 'quando le registri tu (subito)',
      aggiornatoAl: ultima, aggiornatoEtichetta: ultima ? (ultima.slice(8, 10) + '/' + ultima.slice(5, 7) + '/' + ultima.slice(0, 4)) : 'nessuna',
      giorni: gm, stato: mie.length ? 'ok' : 'mai', quanti: mie.length,
      nota: mie.length ? mie.length + ' vendite con prezzo chiesto e prezzo di vendita (servono anche per lo sconto medio).' : 'Registra una vendita appena la chiudi: è il dato più prezioso che hai.',
      dove: 'valutatore', prossimo: '', giorniAlProssimo: null
    });

    return { calendario: c, fonti: out, daFare: out.filter(f => f.stato === 'da-aggiornare' || f.stato === 'mai').map(f => f.fonte) };
  }

  const api = {
    MESI: MESI, aData: aData, ymd: ymd, it: it, giorni: giorni,
    calendario: calendario, dataPubblicazione: dataPubblicazione, etichettaSemestre: etichettaSemestre,
    parseRiga: parseRiga, parseAtti: parseAtti, salvaAtti: salvaAtti,
    attiReali: attiReali, attiSenzaMq: attiSenzaMq, freschezza: freschezza, FONTE: FONTE
  };
  global.Fonti = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
