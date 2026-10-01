/* ============================================================================
   ImmoCRM Pro — automazioni.js  (v10.6.3)
   Quattro automazioni che lavorano sui dati CHE HAI GIÀ nel CRM.
   Nessun servizio esterno, nessun dato che esce: tutto calcolato sul dispositivo.

     1. MARKETING        immobile nuovo → quali clienti avvisare e cosa scrivere
     2. FOLLOW-UP        chi non senti da troppo tempo e cosa fare
     3. PERFORMANCE      da dove arrivano i clienti, conversioni, provvigioni, tempi
     4. REPORT PROPRIETARI  rapporto pronto per il venditore

   Le regole sono trasparenti: ogni punteggio si può spiegare e correggere.
   ============================================================================ */
(function (global) {
  'use strict';

  var VERSIONE = '1.0';

  function num(x) { var n = parseFloat(x); return isNaN(n) ? 0 : n; }
  function pulisci(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function senzaAccenti(s) { return pulisci(s).normalize ? pulisci(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '') : pulisci(s); }
  function oggi(d) { var x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function giorniDa(dataISO, adesso) {
    if (!dataISO) return null;
    var t = new Date(String(dataISO).slice(0, 10) + 'T00:00:00');
    if (isNaN(t.getTime())) return null;
    var ora = adesso || new Date();
    return Math.floor((ora.getTime() - t.getTime()) / 86400000);
  }
  function giorniTra(aISO, bISO) {
    var a = new Date(String(aISO || '').slice(0, 10) + 'T00:00:00'), b = new Date(String(bISO || '').slice(0, 10) + 'T00:00:00');
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return Math.floor((b.getTime() - a.getTime()) / 86400000);
  }
  function euro(n) { try { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0); } catch (e) { return '€ ' + Math.round(n || 0); } }
  function nomeCompleto(c) { return [c && c.nome, c && c.cognome].filter(Boolean).join(' ').trim() || 'Cliente'; }

  /* ========================================================================
     1) MARKETING — immobile nuovo, quali clienti avvisare
     ======================================================================== */

  /* Quanto un immobile somiglia a quello che cerca un cliente.
     Restituisce punteggio 0-100, i motivi (perché è un buon abbinamento)
     e gli avvisi (cosa non torna). Tutto spiegabile: niente scatole nere. */
  function punteggioIncrocio(c, im) {
    var motivi = [], avvisi = [], punti = 0;
    if (!c || !im) return { punteggio: 0, motivi: motivi, avvisi: avvisi };
    var tipo = pulisci(c.tipo);
    if (tipo !== 'acquirente' && tipo !== 'investitore') {
      return { punteggio: 0, motivi: [], avvisi: ['Non è un acquirente'] };
    }
    var prezzo = num(im.prezzo);
    var bMin = num(c.budgetMin), bMax = num(c.budgetMax) || num(c.budget);
    if (!prezzo) avvisi.push('Immobile senza prezzo');
    else if (bMax) {
      if (prezzo <= bMax && (!bMin || prezzo >= bMin)) { punti += 40; motivi.push('Nel budget (' + euro(bMin) + '–' + euro(bMax) + ')'); }
      else if (prezzo <= bMax * 1.08) { punti += 20; motivi.push('Poco sopra il budget — si può trattare'); }
      else { avvisi.push('Sopra il budget di ' + euro(prezzo - bMax)); }
    }
    var zc = senzaAccenti(c.zonaDesiderata || c.zona), zi = senzaAccenti(im.zona);
    if (zc && zi && (zi.indexOf(zc) >= 0 || zc.indexOf(zi) >= 0)) { punti += 25; motivi.push('Zona richiesta: ' + im.zona); }
    var cc = senzaAccenti(c.comuneDesiderato || c.citta), ci = senzaAccenti(im.citta);
    if (cc && ci && cc === ci) { punti += 15; motivi.push('Comune giusto: ' + im.citta); }
    var tc = pulisci(c.tipologiaDesiderata), ti = pulisci(im.tipo);
    if (tc && ti && tc === ti) { punti += 15; motivi.push('Tipologia richiesta: ' + im.tipo); }
    if (num(c.localiMin) && num(im.locali) && num(im.locali) >= num(c.localiMin)) { punti += 5; motivi.push('Almeno ' + c.localiMin + ' locali'); }
    var stato = pulisci(c.stato);
    if (stato === 'caldo') { punti += 10; motivi.push('Cliente caldo'); }
    else if (stato === 'tiepido') { punti += 5; }
    else if (stato === 'perso' || stato === 'chiuso') { punti -= 30; avvisi.push('Risulta perso o chiuso'); }
    return { punteggio: Math.max(0, Math.min(100, punti)), motivi: motivi, avvisi: avvisi };
  }

  function clientiPerImmobile(db, im, opzioni) {
    var o = opzioni || {};
    var soglia = o.soglia == null ? 50 : o.soglia;
    var tutti = (db && db.clienti) || [];
    return tutti.map(function (c) {
      var r = punteggioIncrocio(c, im);
      return { cliente: c, punteggio: r.punteggio, motivi: r.motivi, avvisi: r.avvisi };
    }).filter(function (x) { return x.punteggio >= soglia; })
      .sort(function (a, b) { return b.punteggio - a.punteggio || nomeCompleto(a.cliente).localeCompare(nomeCompleto(b.cliente)); });
  }

  function testoProposta(db, c, im) {
    var s = (db && db.settings) || {};
    var agente = s.agente || 'Il tuo agente';
    var agenzia = s.agenziaNome || '';
    var pezzi = [
      'Buongiorno ' + (c.nome || '') + ', sono ' + agente + (agenzia ? ' di ' + agenzia : '') + '.',
      'È appena arrivato un immobile che può interessarle: ' + (im.tipo || 'immobile') + ' in ' + (im.zona || im.citta || '') +
      (num(im.locali) ? ', ' + im.locali + ' locali' : '') + (num(im.superficie) ? ', ' + im.superficie + ' mq' : '') +
      ', a ' + euro(im.prezzo) + '.',
      'Le mando le foto e i dettagli? Quando posso chiamarla?'
    ];
    return pezzi.join(' ');
  }

  function linkWhatsapp(telefono, testo) {
    var n = String(telefono || '').replace(/\D/g, '').replace(/^39/, '');
    if (n.length < 8) return '';
    return 'https://wa.me/39' + n + '?text=' + encodeURIComponent(testo || '');
  }
  function linkEmail(email, oggetto, testo) {
    if (!email || String(email).indexOf('@') < 0) return '';
    return 'mailto:' + email + '?subject=' + encodeURIComponent(oggetto || '') + '&body=' + encodeURIComponent(testo || '');
  }

  /* ========================================================================
     2) FOLLOW-UP — chi non senti da troppo tempo
     ======================================================================== */

  /* La data dell'ultimo contatto vero: guarda anche gli eventi in timeline. */
  function ultimoContattoDi(db, c) {
    var quando = c.ultimoContatto || c.dataPrimoContatto || c.dataCreazione || '';
    (db && db.eventi || []).forEach(function (e) {
      if (String(e.contattoId) !== String(c.id)) return;
      var d = String(e.data || '').slice(0, 10);
      if (d && (!quando || d > quando)) quando = d;
    });
    return quando;
  }

  function giorniSilenzio(db, c, adesso) {
    var g = giorniDa(ultimoContattoDi(db, c), adesso);
    return g == null ? null : g;
  }

  /* Nel CRM il contatto ha una TEMPERATURA (freddo/tiepido/caldo): quanto
     spesso va toccato dipende da quella. Il lead invece ha una FASE
     (Nuovo, Contattato, Appuntamento...): quella dice cosa fare adesso. */
  var RITMI = {
    'caldo': { giorni: 7, azione: 'Cliente caldo: sentilo, non farlo spegnere' },
    'tiepido': { giorni: 14, azione: 'Ricontatto: portagli una novità concreta' },
    'freddo': { giorni: 30, azione: 'Ricontatto morbido, senza pressione' }
  };
  var RITMI_FASI = {
    'Nuovo': { giorni: 2, azione: 'Primo contatto: presentati e capisci cosa cerca' },
    'Prequalifica': { giorni: 3, azione: 'Completa la prequalifica (budget, tempi, mutuo)' },
    'Contattato': { giorni: 7, azione: 'Ricontatta e proponi un appuntamento' },
    'Appuntamento': { giorni: 4, azione: 'Conferma l\'appuntamento e prepara 3 immobili' },
    'Trattativa': { giorni: 2, azione: 'Senti come procede e togli l\'ostacolo' },
    'Nurturing': { giorni: 21, azione: 'Ricontatto morbido con una novità' },
    'Acquisito': { giorni: 45, azione: 'Chiedi referenze e una recensione' },
    'Perso': { giorni: 90, azione: 'Riprova con un immobile nuovo' }
  };
  function regolaFollowUp(stato) {
    var s = String(stato == null ? '' : stato).trim();
    return RITMI[s] || RITMI[s.toLowerCase()] || RITMI_FASI[s] || { giorni: 14, azione: 'Ricontatta per non perderlo' };
  }

  function daRicontattare(db, opzioni) {
    var o = opzioni || {};
    var adesso = o.adesso || new Date();
    var out = [];
    ((db && db.clienti) || []).forEach(function (c) {
      if (pulisci(c.stato) === 'chiuso') return;
      var r = regolaFollowUp(c.stato);
      var g = giorniSilenzio(db, c, adesso);
      if (g == null || g < r.giorni) return;
      out.push({
        tipo: 'contatto', chi: c, cliente: c, giorniSilenzio: g, soglia: r.giorni, azione: r.azione,
        dove: 'contatti',
        urgenza: g >= r.giorni * 3 ? 'alta' : (g >= r.giorni * 1.5 ? 'media' : 'bassa'),
        oltre: g - r.giorni
      });
    });
    /* Anche i lead hanno il loro ritmo: una fase che non avanza è un lead che si perde. */
    ((db && db.leads) || []).forEach(function (l) {
      var r = regolaFollowUp(l.stato);
      var g = giorniDa(l.ultimoContatto || l.dataCreazione || l.data, adesso);
      if (g == null || g < r.giorni) return;
      out.push({
        tipo: 'lead', chi: l, lead: l, giorniSilenzio: g, soglia: r.giorni, azione: r.azione,
        dove: 'leads',
        urgenza: g >= r.giorni * 3 ? 'alta' : (g >= r.giorni * 1.5 ? 'media' : 'bassa'),
        oltre: g - r.giorni
      });
    });
    return out.sort(function (a, b) { return b.oltre - a.oltre; });
  }

  /* ========================================================================
     3) PERFORMANCE — da dove arrivano i clienti e quanto rendono
     ======================================================================== */

  function metriche(db, adesso) {
    var clienti = (db && db.clienti) || [];
    var trattative = (db && db.trattative) || [];
    var immobili = (db && db.immobili) || [];
    var fatture = (db && db.fatture) || [];
    var vendite = (db && db.vendite) || [];
    var s = (db && db.settings) || {};
    var provv = num(s.provvigione) || 3;

    /* per fonte: quanti ne ho presi e quanti sono diventati clienti */
    var perFonte = {};
    clienti.forEach(function (c) {
      var f = c.fonte || 'Non indicata';
      perFonte[f] = perFonte[f] || { fonte: f, totale: 0, chiusi: 0, persi: 0 };
      perFonte[f].totale++;
      if (pulisci(c.stato) === 'acquisito') perFonte[f].chiusi++;
      if (pulisci(c.stato) === 'perso') perFonte[f].persi++;
    });
    var fonti = Object.keys(perFonte).map(function (k) {
      var x = perFonte[k];
      x.tasso = x.totale ? Math.round((x.chiusi / x.totale) * 100) : 0;
      return x;
    }).sort(function (a, b) { return b.chiusi - a.chiusi || b.totale - a.totale; });

    /* trattative aperte e provvigioni previste */
    var aperte = trattative.filter(function (t) { return ['conclusa', 'persa'].indexOf(pulisci(t.fase)) < 0; });
    var valoreAperto = aperte.reduce(function (s2, t) { return s2 + num(t.prezzoOfferto); }, 0);
    var provvPreviste = aperte.reduce(function (s2, t) { return s2 + num(t.prezzoOfferto) * (num(t.provvigione) || provv) / 100; }, 0);
    var incassato = fatture.filter(function (f) { return pulisci(f.stato) === 'incassata'; }).reduce(function (s2, f) { return s2 + num(f.totale); }, 0);
    var daIncassare = fatture.filter(function (f) { return pulisci(f.stato) !== 'incassata'; }).reduce(function (s2, f) { return s2 + num(f.totale); }, 0);

    /* immobili */
    var disponibili = immobili.filter(function (i) { return pulisci(i.stato) === 'disponibile'; });
    var invenduti90 = disponibili.filter(function (i) {
      var g = giorniDa(i.dataInserimento || i.dataCreazione, adesso);
      return g != null && g > 90;
    });
    var senzaVisite = disponibili.filter(function (i) { return num(i.visite) === 0; });

    /* tempi e sconti sulle vendite vere */
    var tempi = [], sconti = [];
    vendite.forEach(function (v) {
      var im = immobili.find(function (i) { return String(i.id) === String(v.immobileId); }) || {};
      var inizio = im.dataInserimento || v.dataInserimento || v.dataMandato;
      var g = giorniTra(inizio, v.dataVendita);
      if (g != null && g >= 0) tempi.push(g);
      if (num(v.prezzoPubblicato) && num(v.prezzoVendita)) sconti.push((num(v.prezzoPubblicato) - num(v.prezzoVendita)) / num(v.prezzoPubblicato) * 100);
    });
    var media = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };

    /* passaparola: chi ti manda clienti */
    var passaparola = {};
    clienti.forEach(function (c) {
      var f = pulisci(c.fonte);
      if (f !== 'referral' && f !== 'passaparola') return;
      var chi = (c.portatoDa || '').trim() || 'non indicato';
      passaparola[chi] = passaparola[chi] || { chi: chi, quanti: 0, chiusi: 0 };
      passaparola[chi].quanti++;
      if (pulisci(c.stato) === 'acquisito') passaparola[chi].chiusi++;
    });
    var classificaPassaparola = Object.keys(passaparola).map(function (k) { return passaparola[k]; })
      .sort(function (a, b) { return b.quanti - a.quanti; });

    return {
      fonti: fonti,
      trattativeAperte: aperte.length,
      valoreAperto: valoreAperto,
      provvigioniPreviste: Math.round(provvPreviste),
      incassato: incassato,
      daIncassare: daIncassare,
      disponibili: disponibili.length,
      invenduti90: invenduti90.length,
      senzaVisite: senzaVisite.length,
      tempoMedioVendita: media(tempi) == null ? null : Math.round(media(tempi)),
      scontoMedio: media(sconti) == null ? null : Math.round(media(sconti) * 10) / 10,
      passaparola: classificaPassaparola
    };
  }

  /* ========================================================================
     4) REPORT PROPRIETARI — il rapporto per il venditore
     ======================================================================== */

  function reportProprietario(db, im, adesso) {
    if (!im) return null;
    var ora = adesso || new Date();
    var mandato = ((db && db.mandati) || []).find(function (m) { return String(m.immobileId) === String(im.id); }) || {};
    var inizio = im.dataInserimento || mandato.dataFirma;
    var giorni = giorniDa(inizio, ora);
    var visite = num(im.visite);

    /* confronto con gli altri annunci in zona */
    var zona = senzaAccenti(im.zona);
    var inZona = ((db && db.immobili) || []).filter(function (i) {
      return i.id !== im.id && pulisci(i.stato) === 'disponibile' && zona && senzaAccenti(i.zona).indexOf(zona) >= 0 && num(i.prezzo) && num(i.superficie);
    });
    var mqZona = inZona.length ? Math.round(inZona.reduce(function (s, i) { return s + num(i.prezzo) / num(i.superficie); }, 0) / inZona.length) : null;
    var mqMio = num(im.superficie) ? Math.round(num(im.prezzo) / num(im.superficie)) : null;
    var posizionamento = (mqZona && mqMio) ? (mqMio > mqZona * 1.05 ? 'sopra' : (mqMio < mqZona * 0.95 ? 'sotto' : 'in linea')) : null;

    /* OMI di riferimento, se caricato */
    var omi = ((db && db.zoneOMI) || []).find(function (z) { return senzaAccenti(z.zona).indexOf(zona) >= 0; }) || null;

    /* cosa suggerire */
    var consigli = [];
    if (giorni != null && giorni > 90 && visite === 0) consigli.push('Dopo ' + giorni + ' giorni senza visite il prezzo è il primo sospetto: valuta un ritocco del 5%.');
    else if (giorni != null && giorni > 120) consigli.push('In vendita da ' + giorni + ' giorni: fai vedere al proprietario il confronto con gli annunci in zona.');
    if (posizionamento === 'sopra') consigli.push('Il tuo €/mq è sopra la media degli annunci in zona: aspettati trattativa o tempi lunghi.');
    if (posizionamento === 'sotto') consigli.push('Il tuo €/mq è sotto la media in zona: puoi chiedere di più.');
    if (num(im.prezzoIniziale) && num(im.prezzo) && num(im.prezzoIniziale) > num(im.prezzo)) {
      consigli.push('Prezzo già sceso da ' + euro(im.prezzoIniziale) + ' a ' + euro(im.prezzo) + ' (−' + Math.round((1 - num(im.prezzo) / num(im.prezzoIniziale)) * 100) + '%).');
    }
    var scad = mandato.dataFirma ? giorniTra(mandato.dataFirma, oggi(ora)) : null;
    var giorniMandato = scad == null ? null : 90 - scad;

    return {
      immobile: im, giorniInVendita: giorni, visite: visite,
      prezzo: num(im.prezzo), prezzoIniziale: num(im.prezzoIniziale),
      mqMio: mqMio, mqZona: mqZona, posizionamento: posizionamento,
      annunciInZona: inZona.length, omi: omi, consigli: consigli,
      mandato: mandato, giorniMandatoRimanenti: giorniMandato
    };
  }

  function testoReport(db, im, adesso) {
    var r = reportProprietario(db, im, adesso);
    if (!r) return '';
    var righe = [];
    righe.push('RAPPORTO — ' + (im.titolo || 'immobile'));
    righe.push('Data: ' + oggi(adesso));
    righe.push('');
    righe.push('Prezzo pubblicato: ' + euro(r.prezzo) + (r.mqMio ? ' (' + euro(r.mqMio) + '/mq)' : ''));
    righe.push('In vendita da: ' + (r.giorniInVendita == null ? '—' : r.giorniInVendita + ' giorni'));
    righe.push('Visite registrate: ' + r.visite);
    if (r.annunciInZona) righe.push('Confronto: ' + r.annunciInZona + ' annunci simili in zona, media ' + euro(r.mqZona) + '/mq → il tuo è ' + r.posizionamento + ' la media');
    if (r.omi) righe.push('Fascia OMI di riferimento: ' + euro(r.omi.mqMin) + '–' + euro(r.omi.mqMax) + '/mq' + (r.omi.semestre ? ' (semestre ' + r.omi.semestre + ')' : '') + ' — non è il prezzo della casa');
    if (r.mandato && r.mandato.dataFirma) righe.push('Mandato firmato il ' + r.mandato.dataFirma + (r.giorniMandatoRimanenti != null ? ' — ' + r.giorniMandatoRimanenti + ' giorni alla scadenza dei 90' : ''));
    if (r.consigli.length) { righe.push(''); righe.push('Cosa fare adesso:'); r.consigli.forEach(function (c) { righe.push('• ' + c); }); }
    righe.push('');
    righe.push('Rapporto di lavoro dell\'agenzia. Non è una perizia.');
    return righe.join('\n');
  }

  /* ========================================================================
     5) BACKUP — promemoria per non perdere i dati
     ======================================================================== */
  var GIORNI_BACKUP = 7;
  function serveBackup(db, adesso) {
    var s = (db && db.settings) || {};
    var g = giorniDa(s.ultimoExport, adesso);
    if (g == null) return { serve: true, giorni: null, motivo: 'Non hai mai esportato un backup' };
    if (g >= GIORNI_BACKUP) return { serve: true, giorni: g, motivo: 'Ultimo backup ' + g + ' giorni fa' };
    return { serve: false, giorni: g, motivo: '' };
  }
  function registraExport(db, adesso) {
    if (!db) return false;
    db.settings = db.settings || {};
    db.settings.ultimoExport = oggi(adesso);
    return true;
  }

  var Automazioni = {
    VERSIONE: VERSIONE,
    GIORNI_BACKUP: GIORNI_BACKUP,
    /* marketing */
    punteggioIncrocio: punteggioIncrocio, clientiPerImmobile: clientiPerImmobile,
    testoProposta: testoProposta, linkWhatsapp: linkWhatsapp, linkEmail: linkEmail,
    /* follow-up */
    ultimoContattoDi: ultimoContattoDi, giorniSilenzio: giorniSilenzio,
    regolaFollowUp: regolaFollowUp, daRicontattare: daRicontattare, RITMI: RITMI, RITMI_FASI: RITMI_FASI,
    /* performance */
    metriche: metriche,
    /* report proprietari */
    reportProprietario: reportProprietario, testoReport: testoReport,
    /* backup */
    serveBackup: serveBackup, registraExport: registraExport,
    /* utilità per i test */
    _u: { num: num, giorniDa: giorniDa, giorniTra: giorniTra, oggi: oggi, euro: euro, senzaAccenti: senzaAccenti }
  };

  global.Automazioni = Automazioni;
  if (typeof module !== 'undefined' && module.exports) module.exports = Automazioni;
})(typeof window !== 'undefined' ? window : globalThis);
