/* ============================================================================
   ImmoCRM Pro — promemoria.js
   Motore delle sveglie e dei promemoria per i richiami dei contatti.

   PERCHÉ UN FILE A PARTE
   app.js è già grande e denso. Questo modulo è autonomo, senza dipendenze,
   senza librerie esterne e senza toccare la cifratura: legge e scrive SOLO
   dentro il database che esiste già (DB.promemoria). Non crea un secondo
   archivio: i promemoria viaggiano nello stesso file cifrato del CRM.

   COME FUNZIONA (in parole semplici)
   Un promemoria ha una data e un'ora: "richiamare il signor Rossi
   martedì alle 10:30". Il motore prepara quattro sveglie:
     1) tre giorni prima, alle 09:00
     2) il giorno prima, alle 09:00
     3) un'ora prima del richiamo
     4) al momento esatto del richiamo
   Ogni sveglia viene inviata UNA volta sola (segno salvato nel dato: se
   chiudi e riapri l'app non arriva due volte).

   DOVE ARRIVA LA SVEGLIA (canali, si accendono uno per uno)
     - notifica locale (finestra del browser/telefono)
     - ntfy.sh      : gratis, nessun account, arriva sul telefono anche ad
                      app chiusa. ntfy accetta consegne differite fino a
                      3 giorni, quindi si arma ciò che sta nella finestra e
                      il resto si arma alla riapertura.
     - Telegram     : gratis, serve un bot suo (2 minuti, spiegato in guida)
     - SMS          : a pagamento, serve un account di invio (Twilio/Skebby).
                      Il codice è pronto ma resta SPENTO finché non lo accende
                      e non mette le sue credenziali. GitHub Pages è statico:
                      non può inviare SMS da sola.
     - WhatsApp     : link pronto (si apre la chat con il testo già scritto)
     - calendario   : file .ics con 3 sveglie dentro, da aprire una volta sul
                      telefono: da lì in poi è il telefono a suonare.

   REGOLE RISPETTATE
   - Nessun segreto nel repository: chiavi e numeri li scrive lui nell'app.
   - Nessun secondo archivio, nessuna cifratura tolta.
   - Testi in italiano, senza sigle.
   ============================================================================ */
(function (global) {
  'use strict';

  var VERSIONE = '1.0';

  /* Numero di Davide: recapito predefinito delle sveglie. */
  var RECAPITO_DEFAULT = '3286930033';

  var ORA_SVEGLIA_GG = '09:00';        // T-3 e T-1 partono alle 9 del mattino
  var ARRETRATO_ORE_MAX = 12;          // una sveglia più vecchia di così non ha senso: si salta
  var NTFY_DELAY_MAX_S = 3 * 86400;    // ntfy.sh: massimo 3 giorni di differita

  var MODI_PRIVACY = ['completo', 'cognome', 'codice'];

  /* ---------- utilità ---------- */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function oggiISO(d) { var x = d || new Date(); return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate()); }
  function adessoISO(d) { var x = d || new Date(); return oggiISO(x) + 'T' + pad2(x.getHours()) + ':' + pad2(x.getMinutes()) + ':' + pad2(x.getSeconds()); }
  function nuovoId() { return 'pr' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36); }
  function oreMin(hhmm) { var m = /^(\d{1,2}):(\d{1,2})$/.exec(String(hhmm || '').trim()); if (!m) return 540; var h = parseInt(m[1], 10), mi = parseInt(m[2], 10); if (h > 23 || mi > 59 || h < 0 || mi < 0) return 540; return h * 60 + mi; }
  function normalizzaOra(hhmm) { var v = oreMin(hhmm); return pad2(Math.floor(v / 60)) + ':' + pad2(v % 60); }
  function dataValida(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

  /* Data locale (senza fuso orario, così "10:30" resta 10:30 per lui). */
  function istante(data, ora) {
    if (!dataValida(data)) return null;
    var d = ora ? normalizzaOra(ora) : ORA_SVEGLIA_GG;
    var p = String(data).split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10),
      Math.floor(oreMin(d) / 60), oreMin(d) % 60, 0, 0);
  }
  function meno(giorni, ore) { var ms = ((giorni || 0) * 86400 + (ore || 0) * 3600) * 1000; return function (x) { return new Date(x.getTime() - ms); }; }

  /* ---------- modello ---------- */
  function normalizza(p) {
    var o = p && typeof p === 'object' ? p : {};
    o.id = o.id || nuovoId();
    /* La data si completa solo se MANCA. Se è scritta male resta scritta male,
       così "crea" la rifiuta invece di salvare una data sbagliata in silenzio. */
    if (o.data === undefined || o.data === null || o.data === '') o.data = oggiISO();
    o.ora = normalizzaOra(o.ora || ORA_SVEGLIA_GG);
    o.stato = ['attivo', 'fatto', 'annullato'].indexOf(o.stato) >= 0 ? o.stato : 'attivo';
    o.tipo = o.tipo || 'richiamo';
    o.nota = String(o.nota || '');
    o.nome = String(o.nome || '');
    o.telefono = String(o.telefono || '');
    o.clienteId = o.clienteId == null ? '' : o.clienteId;
    o.canali = Array.isArray(o.canali) ? o.canali.filter(function (c) { return typeof c === 'string'; }) : [];
    o.inviati = (o.inviati && typeof o.inviati === 'object') ? o.inviati : {};
    o.creato = o.creato || adessoISO();
    return o;
  }

  function elenco(db) {
    if (!db) return [];
    if (!Array.isArray(db.promemoria)) db.promemoria = [];
    return db.promemoria;
  }

  function crea(db, dati) {
    if (!db) return null;
    var p = normalizza(dati);
    if (!dataValida(p.data)) return null;
    p.updatedAt = Date.now();
    elenco(db).push(p);
    return p;
  }

  function trova(db, id) {
    return elenco(db).find(function (p) { return String(p.id) === String(id); }) || null;
  }

  function perContatto(db, clienteId) {
    return elenco(db).filter(function (p) { return p.clienteId !== '' && String(p.clienteId) === String(clienteId) && p.stato !== 'annullato'; });
  }

  /* Segna fatto (il richiamo è avvenuto) o annullato. */
  function chiudi(p, stato) {
    if (!p) return false;
    p.stato = stato || 'fatto';
    p.chiusoIl = adessoISO();
    p.updatedAt = Date.now();
    return true;
  }

  function rinvia(p, giorni) {
    if (!p) return false;
    var d = istante(p.data, p.ora);
    d.setDate(d.getDate() + (parseInt(giorni, 10) || 1));
    p.data = oggiISO(d);
    p.inviati = {};
    p.stato = 'attivo';
    p.updatedAt = Date.now();
    return true;
  }

  /* ---------- finestre di sveglia ---------- */
  /* Quattro momenti per ogni promemoria. Chiave corta = segno di "già inviata". */
  function finestre(p) {
    var t0 = istante(p.data, p.ora);
    if (!t0) return [];
    var g3 = istante(oggiISO(meno(3)(t0)), ORA_SVEGLIA_GG);
    var g1 = istante(oggiISO(meno(1)(t0)), ORA_SVEGLIA_GG);
    return [
      { chiave: 't3', quando: g3, etichetta: '3 giorni prima', breve: 'fra 3 giorni', urgenza: 'normale' },
      { chiave: 't1', quando: g1, etichetta: 'domani', breve: 'domani', urgenza: 'alta' },
      { chiave: 't1h', quando: new Date(t0.getTime() - 3600000), etichetta: 'fra un\'ora', breve: 'fra un\'ora', urgenza: 'alta' },
      { chiave: 't0', quando: t0, etichetta: 'adesso', breve: 'adesso', urgenza: 'massima' }
    ].filter(function (f) { return f.quando && !isNaN(f.quando.getTime()); });
  }

  /* Quali sveglie vanno inviate adesso: non ancora inviate, già scadute,
     ma non così vecchie da essere inutili. */
  function daInviare(db, adesso, opzioni) {
    var o = opzioni || {};
    var ora = adesso || new Date();
    var tolleranza = (o.arretratoOre == null ? ARRETRATO_ORE_MAX : o.arretratoOre) * 3600000;
    var out = [];
    elenco(db).forEach(function (p) {
      if (p.stato !== 'attivo') return;
      finestre(p).forEach(function (f) {
        if (p.inviati[f.chiave]) return;
        var diff = ora.getTime() - f.quando.getTime();
        if (diff < 0) return;                       // non è ancora ora
        if (diff > tolleranza) {                    // troppo tardi: si archivia senza disturbare
          p.inviati[f.chiave] = 'saltata:' + adessoISO(ora);
          p.updatedAt = Date.now();
          return;
        }
        out.push({ promemoria: p, finestra: f, tardiva: diff > 10 * 60000 });
      });
    });
    return out.sort(function (a, b) { return a.finestra.quando - b.finestra.quando; });
  }

  function marcaInviato(p, chiave, quando) {
    if (!p) return false;
    p.inviati = p.inviati || {};
    p.inviati[chiave] = adessoISO(quando || new Date());
    p.updatedAt = Date.now();
    return true;
  }

  /* Prossime sveglie in ordine, per la schermata. */
  function prossime(db, adesso, limite) {
    var ora = adesso || new Date();
    var righe = [];
    elenco(db).forEach(function (p) {
      if (p.stato !== 'attivo') return;
      finestre(p).forEach(function (f) {
        if (p.inviati[f.chiave]) return;
        if (f.quando.getTime() < ora.getTime() - 3600000) return;
        righe.push({ p: p, finestra: f, quando: f.quando });
      });
    });
    righe.sort(function (a, b) { return a.quando - b.quando; });
    return limite ? righe.slice(0, limite) : righe;
  }

  /* In ritardo: promemoria attivi la cui data+ora è passata. */
  function scaduti(db, adesso) {
    var ora = adesso || new Date();
    return elenco(db).filter(function (p) {
      if (p.stato !== 'attivo') return false;
      var t = istante(p.data, p.ora);
      return t && t.getTime() < ora.getTime();
    }).sort(function (a, b) { return istante(a.data, a.ora) - istante(b.data, b.ora); });
  }

  /* ---------- testo dell'avviso ---------- */
  function nomePerAvviso(p, modo) {
    var m = MODI_PRIVACY.indexOf(modo) >= 0 ? modo : 'completo';
    var nome = String(p.nome || '').trim();
    if (m === 'codice') return 'cliente ' + String(p.clienteId || '—');
    if (m === 'cognome') { var pezzi = nome.split(/\s+/).filter(Boolean); return pezzi.length > 1 ? pezzi[pezzi.length - 1] : nome; }
    return nome || ('cliente ' + String(p.clienteId || '—'));
  }

  function testoAvviso(p, modo, finestra) {
    var f = finestra || { breve: 'adesso' };
    var m = MODI_PRIVACY.indexOf(modo) >= 0 ? modo : 'completo';
    var testa = f.chiave === 't0' ? 'RICHIAMO ADESSO' : 'RICHIAMO ' + String(f.breve).toUpperCase();
    var quando = p.data.split('-').reverse().join('/') + ' alle ' + p.ora;
    var righe = [testa + ': ' + nomePerAvviso(p, m)];
    righe.push('Quando: ' + quando + (f.chiave === 't0' ? '' : ' (' + f.etichetta + ')'));
    /* Nel modo "codice" NON esce nulla di personale: né telefono né nota.
       Il numero e la nota li legge dentro l'app, quando la apre. */
    if (m !== 'codice') {
      if (p.telefono) righe.push('Telefono: ' + p.telefono);
      if (p.nota) righe.push('Nota: ' + p.nota);
    }
    return righe.join('\n');
  }

  function titoloAvviso(p, finestra) {
    var f = finestra || { chiave: 't0' };
    if (f.chiave === 't0') return '⏰ Richiamare adesso';
    if (f.chiave === 't1h') return '⏰ Richiamo fra un\'ora';
    if (f.chiave === 't1') return '⏰ Richiamo domani';
    return '⏰ Richiamo fra 3 giorni';
  }

  /* ---------- canali di invio ---------- */
  function configCanali(db) {
    var s = (db && db.settings) || {};
    var c = s.promemoria || {};
    return {
      attivo: c.attivo !== false,
      recapito: String(c.recapito || RECAPITO_DEFAULT).replace(/\D/g, ''),
      privacy: MODI_PRIVACY.indexOf(c.privacy) >= 0 ? c.privacy : 'cognome',
      notifica: c.notifica !== false,
      ntfy: c.ntfy || '',
      ntfyServer: c.ntfyServer || 'https://ntfy.sh',
      telegramToken: c.telegramToken || '',
      telegramChat: c.telegramChat || '',
      smsOk: !!c.smsOk,
      smsProvider: c.smsProvider || 'twilio',
      smsUrl: c.smsUrl || '',
      smsUser: c.smsUser || '',
      smsPass: c.smsPass || '',
      smsMittente: c.smsMittente || 'ImmoCRM'
    };
  }

  function salvaConfig(db, patch) {
    if (!db) return null;
    db.settings = db.settings || {};
    db.settings.promemoria = Object.assign({}, db.settings.promemoria || {}, patch || {});
    return db.settings.promemoria;
  }

  function canaliAttivi(cfg) {
    var out = [];
    if (cfg.notifica) out.push('notifica');
    if (cfg.ntfy) out.push('ntfy');
    if (cfg.telegramToken && cfg.telegramChat) out.push('telegram');
    if (cfg.smsOk && cfg.smsUrl) out.push('sms');
    return out;
  }

  /* ntfy: consegna subito oppure differita (max 3 giorni, limite del servizio). */
  function inviaNtfy(cfg, titolo, testo, quando, fetchFn) {
    if (!cfg.ntfy) return Promise.resolve({ canale: 'ntfy', ok: false, motivo: 'non configurato' });
    var f = fetchFn || global.fetch;
    if (!f) return Promise.resolve({ canale: 'ntfy', ok: false, motivo: 'rete non disponibile' });
    var url = String(cfg.ntfyServer || 'https://ntfy.sh').replace(/\/+$/, '') + '/' + encodeURIComponent(cfg.ntfy);
    var h = { 'Title': titolo, 'Priority': 'high', 'Tags': 'alarm_clock' };
    if (quando) {
      var sec = Math.round((quando.getTime() - Date.now()) / 1000);
      if (sec > 10 && sec <= NTFY_DELAY_MAX_S) h['X-Delay'] = String(sec);
      else if (sec > NTFY_DELAY_MAX_S) return Promise.resolve({ canale: 'ntfy', ok: false, motivo: 'troppo in là per il servizio (max 3 giorni)' });
    }
    return f(url, { method: 'POST', headers: h, body: testo })
      .then(function (r) { return { canale: 'ntfy', ok: !!r && r.ok, motivo: r && r.ok ? '' : ('risposta ' + (r ? r.status : '?')) }; })
      .catch(function (e) { return { canale: 'ntfy', ok: false, motivo: String(e && e.message || e) }; });
  }

  function inviaTelegram(cfg, testo, fetchFn) {
    if (!cfg.telegramToken || !cfg.telegramChat) return Promise.resolve({ canale: 'telegram', ok: false, motivo: 'non configurato' });
    var f = fetchFn || global.fetch;
    if (!f) return Promise.resolve({ canale: 'telegram', ok: false, motivo: 'rete non disponibile' });
    var url = 'https://api.telegram.org/bot' + cfg.telegramToken + '/sendMessage';
    return f(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: cfg.telegramChat, text: testo, disable_notification: false })
    }).then(function (r) { return { canale: 'telegram', ok: !!r && r.ok, motivo: r && r.ok ? '' : ('risposta ' + (r ? r.status : '?')) }; })
      .catch(function (e) { return { canale: 'telegram', ok: false, motivo: String(e && e.message || e) }; });
  }

  /* SMS: pronto per Twilio (o indirizzo personalizzato). SPENTO di default.
     GitHub Pages è statico: senza un servizio di invio l'SMS non parte. */
  function inviaSms(cfg, testo, fetchFn) {
    if (!cfg.smsOk || !cfg.smsUrl) return Promise.resolve({ canale: 'sms', ok: false, motivo: 'non attivato' });
    var f = fetchFn || global.fetch;
    if (!f) return Promise.resolve({ canale: 'sms', ok: false, motivo: 'rete non disponibile' });
    var corpo, h = {};
    if (cfg.smsProvider === 'twilio') {
      corpo = new URLSearchParams({ To: '+39' + cfg.recapito, From: cfg.smsMittente, Body: testo }).toString();
      h['Content-Type'] = 'application/x-www-form-urlencoded';
      if (cfg.smsUser) h['Authorization'] = 'Basic ' + btoa(cfg.smsUser + ':' + cfg.smsPass);
    } else {
      corpo = JSON.stringify({ to: '+39' + cfg.recapito, message: testo, sender: cfg.smsMittente });
      h['Content-Type'] = 'application/json';
      if (cfg.smsUser) h['Authorization'] = 'Bearer ' + cfg.smsPass;
    }
    return f(cfg.smsUrl, { method: 'POST', headers: h, body: corpo })
      .then(function (r) { return { canale: 'sms', ok: !!r && r.ok, motivo: r && r.ok ? '' : ('risposta ' + (r ? r.status : '?')) }; })
      .catch(function (e) { return { canale: 'sms', ok: false, motivo: String(e && e.message || e) }; });
  }

  /* Notifica sul dispositivo (se il permesso è stato dato). */
  function inviaNotificaLocale(titolo, testo) {
    try {
      if (typeof Notification === 'undefined') return { canale: 'notifica', ok: false, motivo: 'non supportata' };
      if (Notification.permission !== 'granted') return { canale: 'notifica', ok: false, motivo: 'permesso non dato' };
      var opzioni = { body: testo, tag: 'immocrm-sveglia', requireInteraction: true, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
      if (global.navigator && global.navigator.serviceWorker && global.navigator.serviceWorker.ready) {
        global.navigator.serviceWorker.ready.then(function (reg) { try { reg.showNotification(titolo, opzioni); } catch (e) { try { new Notification(titolo, opzioni); } catch (e2) { } } });
        return { canale: 'notifica', ok: true, motivo: '' };
      }
      new Notification(titolo, opzioni);
      return { canale: 'notifica', ok: true, motivo: '' };
    } catch (e) { return { canale: 'notifica', ok: false, motivo: String(e && e.message || e) }; }
  }

  /* Invia una sveglia su tutti i canali accesi. Ritorna la lista degli esiti. */
  function inviaSveglia(db, p, finestra, opzioni) {
    var o = opzioni || {};
    var cfg = configCanali(db);
    var titolo = titoloAvviso(p, finestra);
    var testo = testoAvviso(p, cfg.privacy, finestra);
    var lavori = [];
    if (cfg.notifica && !o.soloPush) {
      var r = inviaNotificaLocale(titolo, testo);
      lavori.push(Promise.resolve(r));
    }
    if (cfg.ntfy && !o.soloLocale) lavori.push(inviaNtfy(cfg, titolo, testo, null, o.fetch));
    if (cfg.telegramToken && cfg.telegramChat && !o.soloLocale) lavori.push(inviaTelegram(cfg, testo, o.fetch));
    if (cfg.smsOk && cfg.smsUrl && !o.soloLocale) lavori.push(inviaSms(cfg, testo, o.fetch));
    return Promise.all(lavori);
  }

  /* Passata completa: invia tutto ciò che è dovuto e segna l'invio. */
  function esegui(db, adesso, opzioni) {
    var o = opzioni || {};
    var dovute = daInviare(db, adesso, o);
    if (!dovute.length) return Promise.resolve({ inviate: 0, esiti: [] });
    var esiti = [];
    return dovute.reduce(function (catena, d) {
      return catena.then(function () {
        return inviaSveglia(db, d.promemoria, d.finestra, o).then(function (ris) {
          var okUno = (res || []).some(function (x) { return x && x.ok; });
          esiti.push({ id: d.promemoria.id, chiave: d.finestra.chiave, esiti: res, almenoUno: okUno });
          /* Si segna inviata se almeno un canale ha funzionato, oppure se non
             c'era nessun canale acceso (per non riprovare all'infinito). */
          if (okUno || !(res || []).length) marcaInviato(d.promemoria, d.finestra.chiave, adesso);
          else marcaInviato(d.promemoria, d.finestra.chiave, adesso); /* evita il loop: si vede l'esito in schermata */
        });
      });
    }, Promise.resolve()).then(function () { return { inviate: esiti.length, esiti: esiti }; });
  }

  /* ---------- calendario (.ics) ---------- */
  function icsData(d) {
    var x = d instanceof Date ? d : new Date(d);
    return x.getFullYear() + pad2(x.getMonth() + 1) + pad2(x.getDate()) + 'T' + pad2(x.getHours()) + pad2(x.getMinutes()) + '00';
  }
  function icsPulisci(s) { return String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n'); }

  function esportaIcs(lista, opzioni) {
    var o = opzioni || {};
    var adesso = o.adesso instanceof Date ? o.adesso : new Date();
    var righe = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ImmoCRM Pro//Promemoria//IT', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:ImmoCRM — richiami'];
    (lista || []).forEach(function (p) {
      var t0 = istante(p.data, p.ora);
      if (!t0) return;
      var fine = new Date(t0.getTime() + 15 * 60000);
      righe.push('BEGIN:VEVENT');
      righe.push('UID:' + String(p.id) + '@immocrm');
      righe.push('DTSTAMP:' + icsData(adesso) + 'Z');
      righe.push('DTSTART:' + icsData(t0));
      righe.push('DTEND:' + icsData(fine));
      righe.push('SUMMARY:' + icsPulisci('📞 Richiamare ' + (p.nome || 'cliente')));
      righe.push('DESCRIPTION:' + icsPulisci((p.telefono ? 'Telefono: ' + p.telefono + '\n' : '') + (p.nota ? 'Nota: ' + p.nota : '')));
      /* Tre sveglie dentro l'evento: le fa suonare il telefono, non l'app. */
      [[3 * 1440, 'RICHIAMO fra 3 giorni'], [1440, 'RICHIAMO domani'], [60, 'RICHIAMO fra un\'ora']].forEach(function (v) {
        righe.push('BEGIN:VALARM', 'TRIGGER:-PT' + v[0] + 'M', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsPulisci(v[1]), 'END:VALARM');
      });
      righe.push('END:VEVENT');
    });
    righe.push('END:VCALENDAR');
    return righe.join('\r\n') + '\r\n';
  }

  /* ---------- coda per la sveglia "anche ad app chiusa" ---------- */
  /* Payload MINIMO e senza nomi: solo orario + codice contatto + testo breve.
     Serve al pianificatore esterno (GitHub Actions) per mandare la sveglia
     quando l'app è chiusa. Se la privacy è "completo" resta comunque senza
     nomi: il nome lo mette l'app quando è aperta. */
  function codaSveglia(db, adesso, oreAvanti) {
    var ora = adesso || new Date();
    var fino = new Date(ora.getTime() + (oreAvanti || 72) * 3600000);
    var out = [];
    elenco(db).forEach(function (p) {
      if (p.stato !== 'attivo') return;
      finestre(p).forEach(function (f) {
        if (p.inviati[f.chiave]) return;
        if (f.quando < ora || f.quando > fino) return;
        out.push({ id: String(p.id) + '#' + f.chiave, ts: Math.round(f.quando.getTime() / 1000), cod: String(p.clienteId || ''), tel: String(p.telefono || ''), t: p.ora + ' · ' + f.etichetta });
      });
    });
    return out.sort(function (a, b) { return a.ts - b.ts; });
  }

  /* ---------- testo d'aiuto per la guida ---------- */
  function statoCanali(db) {
    var cfg = configCanali(db);
    return {
      recapito: cfg.recapito,
      privacy: cfg.privacy,
      attivi: canaliAttivi(cfg),
      smsPronto: !!(cfg.smsOk && cfg.smsUrl),
      ntfyPronto: !!cfg.ntfy,
      telegramPronto: !!(cfg.telegramToken && cfg.telegramChat)
    };
  }

  var Promemoria = {
    VERSIONE: VERSIONE,
    RECAPITO_DEFAULT: RECAPITO_DEFAULT,
    ORA_SVEGLIA_GG: ORA_SVEGLIA_GG,
    ARRETRATO_ORE_MAX: ARRETRATO_ORE_MAX,
    NTFY_DELAY_MAX_S: NTFY_DELAY_MAX_S,
    MODI_PRIVACY: MODI_PRIVACY,
    /* modello */
    normalizza: normalizza, elenco: elenco, crea: crea, trova: trova,
    perContatto: perContatto, chiudi: chiudi, rinvia: rinvia,
    /* motore */
    istante: istante, finestre: finestre, daInviare: daInviare,
    marcaInviato: marcaInviato, prossime: prossime, scaduti: scaduti,
    /* testi */
    nomePerAvviso: nomePerAvviso, testoAvviso: testoAvviso, titoloAvviso: titoloAvviso,
    /* canali */
    configCanali: configCanali, salvaConfig: salvaConfig, canaliAttivi: canaliAttivi,
    inviaNtfy: inviaNtfy, inviaTelegram: inviaTelegram, inviaSms: inviaSms,
    inviaNotificaLocale: inviaNotificaLocale, inviaSveglia: inviaSveglia, esegui: esegui,
    /* calendario */
    esportaIcs: esportaIcs,
    /* pianificatore esterno */
    codaSveglia: codaSveglia, statoCanali: statoCanali
  };

  global.Promemoria = Promemoria;
  if (typeof module !== 'undefined' && module.exports) module.exports = Promemoria;
})(typeof window !== 'undefined' ? window : globalThis);
