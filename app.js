'use strict';
const KEY='immocrm_pro_v10',AUTH_KEY='immocrm_auth';
let DB={};
const NAV_ITEMS=[
{id:'regia',label:'Regia del Giorno',icon:'🎯'},
{id:'obiettivi',label:'Obiettivi & Focus',icon:'🔥'},
{id:'chiamate',label:'Chiamate',icon:'📞'},
{id:'dashboard',label:'Dashboard',icon:'📊'},
{id:'da-fare',label:'Da Fare Oggi',icon:'⚡'},
{id:'contatti',label:'Contatti',icon:'👥'},
{id:'immobili',label:'Immobili',icon:'🏠'},
{id:'mandati',label:'Mandati',icon:'✍️'},
{id:'openhouse',label:'Open House',icon:'🏡'},
{id:'pipeline',label:'Pipeline',icon:'🤝'},
{id:'mercato',label:'Compravendite OMI',icon:'📉'},
{id:'valutatore',label:'Valutatore',icon:'🔬'},
{id:'incroci',label:'Incroci & Monitoraggio',icon:'🔀'},
{id:'leads',label:'Acquisizione Lead',icon:'📥'},
{id:'import',label:'Importa Rubrica',icon:'📋'},
{id:'attivita',label:'Attività',icon:'📌'},
{id:'calendario',label:'Calendario',icon:'📅'},
{id:'documenti',label:'Documenti',icon:'📄'},
{id:'fatture',label:'Provvigioni & Fatture',icon:'🧾'},
{id:'report-sett',label:'Report Settimanale',icon:'🖨️'},
{id:'report-prop',label:'Report Proprietari',icon:'📤'},
{id:'marketing',label:'Marketing',icon:'📣'},
{id:'statistiche',label:'Statistiche',icon:'📈'},
{id:'impostazioni',label:'Impostazioni',icon:'⚙️'}];
const FASI=['interesse','proposta','contrattazione','compromesso','rogito','conclusa','persa'];
const FASI_LABEL={interesse:'Interesse',proposta:'Proposta',contrattazione:'Contrattazione',compromesso:'Compromesso',rogito:'Rogito',conclusa:'Conclusa',persa:'Persa'};
const fasiColor={interesse:'#3b82f6',proposta:'#6366f1',contrattazione:'#f97316',compromesso:'#a855f7',rogito:'#22c55e',conclusa:'#6b7280',persa:'#94a3b8'};
const FASI_CONTATTO=['Nuovo','Prequalifica','Contattato','Appuntamento','Trattativa','Acquisito','Nurturing','Perso'];
const fasiContColor={Nuovo:'#3b82f6',Prequalifica:'#8b5cf6',Contattato:'#6366f1',Appuntamento:'#f97316',Trattativa:'#a855f7',Acquisito:'#22c55e',Nurturing:'#06b6d4',Perso:'#6b7280'};
const TIPO_CONTATTO=['acquirente','venditore','locatore','conduttore','investitore','professionista','altro'];
const TIPO_IMM=['appartamento','attico','villa','bilocale','trilocale','monolocale','mansarda','box','negozio','ufficio','capannone','terreno','rustico'];
const tipoIco={appartamento:'🏠',attico:'🏙️',villa:'🏡',bilocale:'🏠',trilocale:'🏠',monolocale:'🏠',mansarda:'🏠',box:'🚗',negozio:'🏪',ufficio:'🏢',capannone:'🏭',terreno:'🌳',rustico:'🏚️'};
const STATO_IMM=['disponibile','trattativa','venduto','locato','ritirato'];
const statoColor={freddo:'var(--blue)',tiepido:'var(--orange)',caldo:'var(--red)',chiuso:'var(--green)'};
const FONTE_LEAD=['Sito web','Google','Facebook','Instagram','WhatsApp','Telefono','Email','Referral','Portale','Passaparola','Pagine Bianche','Per strada','Al bar','Open House','Altro'];
const PORTALI=['Immobiliare.it','Idealista','Casa.it','Subito','Wikicasa','Bakeca','Altro'];
const TIPI_STEP={chiamata:'📞',whatsapp:'💬',email:'📧',visita:'🏠',nota:'📝'};
const STATI_CHIUSI_CH=['convertito','non-interessato','perso'];
const MERCATO_DEFAULT={ultimoAggiornamento:'2026-09-10',trimestri:[
{p:'2024-Q1',prov:812,comune:361,prezzoMq:1856,giorniMedi:112,scontoMedio:7.8,tassoMutui:4.36},
{p:'2024-Q2',prov:894,comune:398,prezzoMq:1872,giorniMedi:109,scontoMedio:7.5,tassoMutui:4.21},
{p:'2024-Q3',prov:823,comune:366,prezzoMq:1889,giorniMedi:107,scontoMedio:7.2,tassoMutui:4.02},
{p:'2024-Q4',prov:968,comune:431,prezzoMq:1904,giorniMedi:103,scontoMedio:6.9,tassoMutui:3.79},
{p:'2025-Q1',prov:841,comune:376,prezzoMq:1918,giorniMedi:101,scontoMedio:6.6,tassoMutui:3.54},
{p:'2025-Q2',prov:926,comune:412,prezzoMq:1931,giorniMedi:99,scontoMedio:6.3,tassoMutui:3.38},
{p:'2025-Q3',prov:877,comune:392,prezzoMq:1942,giorniMedi:97,scontoMedio:6.1,tassoMutui:3.30},
{p:'2025-Q4',prov:1023,comune:455,prezzoMq:1955,giorniMedi:95,scontoMedio:5.9,tassoMutui:3.22},
{p:'2026-Q1',prov:869,comune:389,prezzoMq:1961,giorniMedi:96,scontoMedio:5.8,tassoMutui:3.18},
{p:'2026-Q2',prov:954,comune:427,prezzoMq:1968,giorniMedi:94,scontoMedio:5.6,tassoMutui:3.12}]};
const ZONE_PIACENZA=[
{nome:'Centro Storico',categoria:'centrali',mqMin:1700,mqMid:2000,mqMax:2400,affittoMq:5.5,trend:'+9%',trendUp:true,fonte:'Borsino 2026'},
{nome:'Barriera Milano / S.Ambrogio',categoria:'centrali',mqMin:1050,mqMid:1182,mqMax:1350,affittoMq:4.09,trend:'+7%',trendUp:true,fonte:'Borsino 2026'},
{nome:'V.le Dante / Via XXIV Maggio',categoria:'centrali',mqMin:1180,mqMid:1313,mqMax:1450,affittoMq:4.57,trend:'+8%',trendUp:true,fonte:'Borsino 2026'},
{nome:'Clinica / Infrangibile',categoria:'semicentrali',mqMin:1850,mqMid:2137,mqMax:2400,affittoMq:6.2,trend:'+12%',trendUp:true,fonte:'Immobiliare.it 2026'},
{nome:'Zona Stadio / Galleana',categoria:'semicentrali',mqMin:1100,mqMid:1250,mqMax:1400,affittoMq:4.2,trend:'+5%',trendUp:true,fonte:'Borsino 2026'},
{nome:'San Lazzaro / Farnesiana',categoria:'semicentrali',mqMin:1150,mqMid:1300,mqMax:1500,affittoMq:3.9,trend:'+6%',trendUp:true,fonte:'Borsino 2026'},
{nome:'Montale',categoria:'periferiche',mqMin:850,mqMid:979,mqMax:1100,affittoMq:3.42,trend:'+3%',trendUp:true,fonte:'Borsino 2026'},
{nome:'Roncaglia / Mortizza',categoria:'periferiche',mqMin:980,mqMid:1130,mqMax:1300,affittoMq:6.87,trend:'+2%',trendUp:true,fonte:'Immobiliare.it 2026'},
{nome:'Bellevue / Baia del Re',categoria:'periferiche',mqMin:1300,mqMid:1500,mqMax:1750,affittoMq:4.2,trend:'+8%',trendUp:true,fonte:'Stima 2026'},
{nome:'Fiorenzuola d\'Arda',categoria:'comuni',mqMin:850,mqMid:1050,mqMax:1250,affittoMq:3.2,trend:'+4%',trendUp:true,fonte:'Borsino 2026'},
{nome:'Castel San Giovanni',categoria:'comuni',mqMin:780,mqMid:950,mqMax:1150,affittoMq:2.9,trend:'+2%',trendUp:true,fonte:'Borsino 2026'},
{nome:'Rottofreno / San Nicolò',categoria:'comuni',mqMin:950,mqMid:1150,mqMax:1350,affittoMq:3.4,trend:'+5%',trendUp:true,fonte:'Borsino 2026'}];
const CHECKLIST_TPL={compromesso:{label:'Checklist Compromesso',items:['Visura catastale aggiornata','Atto di provenienza','APE valido + IPE','Planimetria conforme','Documento identità venditore','Regolarità condominiale','Pratica mutuo avviata','Caparra confirmatoria']},rogito:{label:'Checklist Rogito',items:['Notaio incaricato','Estinzione mutuo venditore','Certificati pagamenti','Perizia ipotecaria','Documenti identità parti','Quietanza saldo prezzo','Consegna chiavi']}};
const AML_ITEMS=[{id:'doc',label:'📄 Documento identità + CF (copia)'},{id:'te',label:'👤 Titolare effettivo identificato'},{id:'pep',label:'🏛️ Verifica PEP eseguita'},{id:'fondi',label:'🔎 Origine fondi dichiarata'},{id:'cons',label:'🗄️ Conservazione 10 anni'}];
let calendarMonth=new Date().getMonth(),calendarYear=new Date().getFullYear();
let activeSection='regia',sidebarCollapsed=false,currentImmId=null,pnPassi=[],V={step:1,dati:{},risultato:null};
let _chF={stato:'',ricerca:''},_immF={tipo:'',stato:'',ricerca:''},_attF={stato:'aperte'},_contF={tipo:'',stato:'',fonte:'',ricerca:'',quick:'',collab:'',pres:''};
let _contattiView='tabella',_immView='griglia',_importParsed=[],zonaFilter='',categoriaFilter='tutte',zoneConfronto=[];
const fmtEuro=n=>n!=null&&n!==''&&!isNaN(n)?new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n):'—';
const fmtEuroShort=n=>{if(!n&&n!==0)return'—';if(Math.abs(n)>=1e6)return'€ '+(n/1e6).toFixed(1)+'M';if(Math.abs(n)>=1e3)return'€ '+Math.round(n/1e3)+'K';return fmtEuro(n)};
const fmtDate=d=>d?new Date(d).toLocaleDateString('it-IT'):'—';
const fmtDateShort=d=>d?new Date(d).toLocaleDateString('it-IT',{day:'2-digit',month:'short'}):'—';
const pad2=n=>String(n).padStart(2,'0');
const isoLocal=d=>{const x=new Date(d);return x.getFullYear()+'-'+pad2(x.getMonth()+1)+'-'+pad2(x.getDate())};
const today=()=>isoLocal(new Date());
const nowISO=()=>new Date().toISOString();
const esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const ucfirst=s=>s?s.charAt(0).toUpperCase()+s.slice(1):'';
const daysSince=d=>d?Math.floor((Date.now()-new Date(d).getTime())/86400000):0;
const daysBetween=(a,b)=>a&&b?Math.floor((new Date(b)-new Date(a))/86400000):0;
const ageText=d=>{if(!d)return'';const dd=daysSince(d);if(dd===0)return'oggi';if(dd===1)return'ieri';if(dd<30)return dd+'gg fa';if(dd<365)return Math.floor(dd/30)+' mesi fa';return Math.floor(dd/365)+' anni fa'};
const waNumber=t=>String(t||'').replace(/\D/g,'').replace(/^39/,'');
const hashSimple=s=>{let h=0;for(let i=0;i<(s||'').length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0}return'h'+Math.abs(h).toString(36)};
const sumBy=(a,k)=>a.reduce((s,x)=>s+(typeof k==='function'?k(x):(x[k]||0)),0);
function weekStart(d){const x=new Date(d);const day=(x.getDay()+6)%7;x.setDate(x.getDate()-day);x.setHours(0,0,0,0);return x}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function iso(d){return isoLocal(d)}
function weekLabel(ws,we){const m=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];return ws.getDate()+'–'+we.getDate()+' '+m[we.getMonth()]}
function greeting(){const h=new Date().getHours();return h<6?'Buonanotte':h<12?'Buongiorno':h<18?'Buon pomeriggio':'Buonasera'}
function nomeAgente(){return(DB.settings||{}).agente||'Agente'}
function getAuth(){try{return JSON.parse(localStorage.getItem(AUTH_KEY)||'null')}catch(e){return null}}
function saveAuth(a){try{localStorage.setItem(AUTH_KEY,JSON.stringify(a))}catch(e){console.warn('saveAuth',e)}}
// v10.3: verifica la password contro un hash PBKDF2 condiviso (viene dal codice dispositivo)
async function verificaConHash(rec,p){const h=await pbkdf2(p,rec.salt,rec.iter||PBK_ITER);return !!h&&h===rec.hash}
function initDB(){
['clienti','immobili','trattative','appuntamenti','attivita','documenti','eventi','chiamate','mandati','openhouses','leads','fatture'].forEach(k=>{if(!DB[k])DB[k]=[]});
if(!DB.obiettivi)DB.obiettivi={incarichiSettimana:1,incarichiMese:4,chiamateGiorno:10};
if(!DB.regia)DB.regia={data:today(),fatte:[],saltate:[]};
if(!DB.actionPlans)DB.actionPlans=[];
if(!DB.mercato||!DB.mercato.trimestri)DB.mercato=JSON.parse(JSON.stringify(MERCATO_DEFAULT));
if(!DB.zoneOMI)DB.zoneOMI=[{id:'z1',comune:'Piacenza',zona:'Centro storico',mqMin:1900,mqMax:2900,tempoMedioGiorni:90,scontoMedioPct:6}];
if(!DB.settings)DB.settings={agente:'Scaglia Davide',agenziaNome:'Immobiliare Scaglia',telefono:'',email:'',provvigione:3,waTemplates:[{nome:'Ricontatto',testo:'Ciao {nome}, sono {agente}. Ci sono novità che potrebbero interessarti. Quando ti chiamo?'},{nome:'Nuovo immobile',testo:'Ciao {nome}, è arrivato un immobile perfetto per te! Organizziamo una visita? — {agente}'}]};
if(!DB.settings._localPass&&!DB.settings._passV2)DB.settings._localPass=hashSimple('successo');
if(DB.settings){if(!DB.settings.waTemplates)DB.settings.waTemplates=[];if(!DB.settings.waTemplates.some(x=>x.nome==='Presentazione'))DB.settings.waTemplates.push({nome:'Presentazione',testo:'Buongiorno {nome}, sono {agente} di {agenzia}. Le invio la mia presentazione. Quando possiamo sentirci?'});}
(DB.clienti||[]).forEach(c=>{if(!c.dataPrimoContatto)c.dataPrimoContatto=c.dataCreazione||c.ultimoContatto||'';if(c.presentazioneInviata===true)c.presentazioneInviata='si';if(!c.via&&c.indirizzo){const sp=splitIndirizzo(c.indirizzo);c.via=c.via||sp.via;c.civico=c.civico||sp.civico}});
}
/* ---------- PERSISTENZA (localStorage + IndexedDB + cloud) ---------- */
let BOOT_DB=null,_dbReady=false,_bootstrapped=false,_lockTimer=null,_passPromptOpen=false;
function save(){try{
DB._ts=Date.now();
if(window.ImmoSync)ImmoSync.track(DB);
localStorage.setItem(KEY,JSON.stringify(DB));
if(window.ImmoSync)ImmoSync.mirror(DB);
const i=document.getElementById('save-indicator');if(i){i.classList.add('show');clearTimeout(window._sT);window._sT=setTimeout(()=>i.classList.remove('show'),2000)}
if(window.ImmoSync)ImmoSync.onLocalChange();
}catch(e){showToast('⚠️ Spazio esaurito: esporta un backup','error')}}
function loadDB(){if(_dbReady){initDB();return}
if(window.ImmoSync&&BOOT_DB){DB=BOOT_DB;BOOT_DB=null}
else{try{const r=localStorage.getItem(KEY);if(r)DB=JSON.parse(r)}catch(e){DB={}}}
_dbReady=true;initDB()}
function applicaDbRemoto(d){if(!d||typeof d!=='object')return;DB=d;window.DB=DB;_dbReady=true;
// v10.4: tiene aggiornato il record password locale da quello sincronizzato
if(d.settings&&d.settings.passRec&&d.settings.passRec.hash){const _a=getAuth()||{};const _pr=d.settings.passRec;if(!(_a.pass&&_a.pass.hash===_pr.hash&&_a.pass.salt===_pr.salt)){_a.pass={salt:_pr.salt,iter:_pr.iter,hash:_pr.hash};delete _a.localPass;saveAuth(_a)}}
if(window.ImmoSync){ImmoSync.adopt(DB);try{localStorage.setItem(KEY,JSON.stringify(DB))}catch(e){}ImmoSync.mirror(DB)}
initDB();
if(appAttiva()){render();updateBadges()}
showToast('☁️ Dati aggiornati dal cloud','info',2200)}
function appAttiva(){const a=document.getElementById('app-shell');return !!a&&a.style.display!=='none'}
/* ---------- AUTENTICAZIONE (PBKDF2 + blocco tentativi + auto-lock) ---------- */
const PBK_ITER=210000;
let _cloudPass=null; // v10.3: password di accesso in memoria → ricavo automatico della chiave cloud condivisa (cancellata a logout/blocco)
function _b64e(buf){let s='';const b=new Uint8Array(buf);for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return btoa(s)}
function _b64d(str){const bin=atob(str);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function _subtle(){const c=window.crypto;if(!c)return null;return c.subtle||(c.webcrypto&&c.webcrypto.subtle)||null}
function nuovoSale(){const a=new Uint8Array(16);if(window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(a);else for(let i=0;i<16;i++)a[i]=Math.floor(Math.random()*256);return _b64e(a)}
async function pbkdf2(pass,salt,iter){const su=_subtle();if(!su||!pass)return null;
const base=await su.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveBits']);
const bits=await su.deriveBits({name:'PBKDF2',salt:_b64d(salt),iterations:iter||PBK_ITER,hash:'SHA-256'},base,256);
return _b64e(bits)}
async function aggiornaHashPassword(pass){const a=getAuth()||{};const salt=nuovoSale();const h=await pbkdf2(pass,salt,PBK_ITER);if(!h)return false;
a.pass={salt:salt,iter:PBK_ITER,hash:h};delete a.localPass;saveAuth(a);
// v10.4: il record vive anche nei dati sincronizzati (dentro la cifratura):
// gli altri dispositivi lo ricevono al prossimo pull e il login resta valido
if(DB.settings){delete DB.settings._localPass;DB.settings._passV2=true;DB.settings.passRec={salt:salt,iter:PBK_ITER,hash:h}}
return true}
/* v10.4: verifica SOLO sui record locali (per il flusso di login) */
async function verificaPasswordLocale(pass){const a=getAuth()||{};
if(a.pass&&a.pass.hash&&a.pass.salt){const h=await pbkdf2(pass,a.pass.salt,a.pass.iter);if(!!h&&h===a.pass.hash)return true}
const lp=a.localPass||(DB.settings||{})._localPass;
if(lp&&hashSimple(pass)===lp){await aggiornaHashPassword(pass);return true}
return false}
async function verificaPassword(pass){const a=getAuth()||{};
if(a.pass&&a.pass.hash&&a.pass.salt){const h=await pbkdf2(pass,a.pass.salt,a.pass.iter);if(!!h&&h===a.pass.hash)return true}
const lp=a.localPass||(DB.settings||{})._localPass;
if(lp&&hashSimple(pass)===lp){await aggiornaHashPassword(pass);return true}
// v10.4: record locale assente o stantio (es. password cambiata su un altro
// dispositivo) → si prova la password sull'archivio cloud: la sale condivisa
// è salvata nell'archivio, quindi la password PIÙ RECENTE apre su tutti i
// dispositivi, senza codici e senza ricominciare.
if(window.ImmoSync&&ImmoSync.unlockFromCloud){const r=await ImmoSync.unlockFromCloud(pass);if(r==='ok')return true}
return false}
function loginBloccato(){const a=getAuth()||{};return !!(a.fails&&a.fails.until&&a.fails.until>Date.now())}
function registraFallimento(){const a=getAuth()||{};const n=((a.fails&&a.fails.n)||0)+1;const minuti=Math.min(15,Math.pow(2,n-1)*0.5);a.fails={n:n,until:n>=3?Date.now()+minuti*60000:0};saveAuth(a);return n}
function azzeraFallimenti(){const a=getAuth()||{};if(a.fails){delete a.fails;saveAuth(a)}}
function minutiBlocco(){const a=getAuth()||{};if(!loginBloccato())return 0;return Math.max(1,Math.ceil((a.fails.until-Date.now())/60000))}
async function sbloccoCloud(pass){try{if(window.ImmoSync)await ImmoSync.unlockWithPassword(pass,{keepSalt:true});return true}catch(e){console.warn('unlock',e);return false}}
function showLogin(){document.getElementById('login-form').style.display='block';document.getElementById('setup-form').style.display='none'}
function showSetup(){document.getElementById('login-form').style.display='none';document.getElementById('setup-form').style.display='block'}
/* v10.3: applica il codice dispositivo (config cloud + chiave condivisa) */
async function apriConCodice(d){
const patch={mode:d.mode||'gist',token:d.token||'',gistId:d.gistId||'',encrypt:d.encrypt!==false,restUrl:d.restUrl||''};
if(d.apiBase)patch.apiBase=d.apiBase;
if(!patch.token)throw new Error('Il codice non contiene un permesso valido');
await ImmoSync.setConfig(patch);
if(d.key&&d.salt)await ImmoSync.importMaster(d.key,d.salt);
else if(d.salt&&_cloudPass)await ImmoSync.unlockWithPassword(_cloudPass,{salt:d.salt});
}
async function doLogin(){const inp=document.getElementById('login-pass');const p=(inp&&inp.value||'').trim();const e=document.getElementById('login-err');e.textContent='';
const btn=document.getElementById('login-btn');
if(loginBloccato()){e.textContent='⏳ Troppi tentativi errati: riprova fra '+minutiBlocco()+' min';return}
if(!p){e.textContent='Inserisci la password';return}
const codeEl=document.getElementById('login-code');const code=(codeEl&&codeEl.value||'').trim();const _ga=getAuth()||{};const haAuth=!!(_ga.pass&&_ga.pass.hash)||!!_ga.localPass;
let dec=null;
if(code){
try{dec=window.ImmoSync?ImmoSync.decodeConnectCode(code):null;
if(!dec)throw new Error('nessun dec');
}catch(err){e.textContent='❌ Codice dispositivo non valido';return}
}
if(btn){btn.disabled=true;btn.textContent='Verifico…'}
/* v10.4: verifica in 3 tempi: (1) record locale, (2) cloud — la password
   più recente vince sempre, anche se cambiata su un altro dispositivo,
   (3) record del codice (solo se offline/nessun archivio). Il codice è
   applicato PRIMA della verifica: è il "permesso" che permette al
   dispositivo nuovo di raggiungere il cloud. */
let ok=false,via='';
try{
if(dec){_cloudPass=p;try{await apriConCodice(dec)}catch(err){console.warn('codice',err)}}
if(await verificaPasswordLocale(p)){ok=true;via='local'}
else if(window.ImmoSync&&ImmoSync.unlockFromCloud){
const r=await ImmoSync.unlockFromCloud(p);
if(r==='ok'){ok=true;via='cloud'}
else if((r==='noarchive'||r==='error')&&dec&&dec.pass&&await verificaConHash(dec.pass,p)){ok=true;via='code'}
}
else if(dec&&dec.pass&&await verificaConHash(dec.pass,p)){ok=true;via='code'}
}catch(err){ok=false}
if(btn){btn.disabled=false;btn.textContent='🔐 Accedi'}
if(!ok){const n=registraFallimento();let msg;
if(code)msg='❌ Password errata (o codice non corrispondente)';
else if(!haAuth)msg='❌ Dispositivo non riconosciuto: al primo utilizzo usa "Primo su questo dispositivo?" in basso';
else msg='❌ Password errata — l\'hai dimenticata? Usa "Password dimenticata?" in basso';
e.textContent=msg+(n>=3?' — accesso sospeso per '+minutiBlocco()+' min':'');inp.value='';return}
azzeraFallimenti();
const a=getAuth()||{};a.loggedIn=true;a.nome=a.nome||(DB.settings||{}).agente||'Utente';a.ts=Date.now();
if(via==='code'&&dec&&dec.pass){a.pass=dec.pass;delete a.localPass}
saveAuth(a);
_cloudPass=p;
// v10.4: se la chiave non c'è, la ricavo dall'archivio cloud (sale condivisa)
// invece di crearne una nuova a caso — la password giusta apre sempre.
if(window.ImmoSync&&!ImmoSync.hasMasterKey()){try{await ImmoSync.ensureMasterKey(p)}catch(e){console.warn('master',e)}}
entraApp();
const n=document.getElementById('lock-note');if(n)n.style.display='none';
if(codeEl)codeEl.value='';
if(p==='successo')chiediCambioPassword(true)}
async function doSetup(){const n=document.getElementById('setup-nome').value.trim(),p1=document.getElementById('setup-pass').value,p2=document.getElementById('setup-pass2').value,q=document.getElementById('setup-question').value.trim(),an=document.getElementById('setup-answer').value.trim(),e=document.getElementById('setup-err');e.textContent='';
if(!n){e.textContent='Nome obbligatorio';return}if(p1.length<6){e.textContent='Password min 6 caratteri';return}if(p1!==p2){e.textContent='Non coincidono';return}if(!q||!an){e.textContent='Domanda e risposta obbligatorie';return}
const salt=nuovoSale();const h=await pbkdf2(p1,salt,PBK_ITER);
const a={loggedIn:true,nome:n,question:q,answer:hashSimple(an.toLowerCase()),ts:Date.now()};
if(h)a.pass={salt:salt,iter:PBK_ITER,hash:h};else a.localPass=hashSimple(p1);
saveAuth(a);
if(DB.settings){DB.settings.agente=n;if(h){delete DB.settings._localPass;DB.settings._passV2=true}else DB.settings._localPass=hashSimple(p1)}
save();_cloudPass=p1;await sbloccoCloud(p1);entraApp();showToast('Benvenuto '+n+' 👋')}
function chiediCambioPassword(forza){if(document.getElementById('chg-pass-modal'))return;
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" id="chg-pass-modal"><div class="modal modal-sm" onclick="event.stopPropagation()"><h2>🔐 Cambia la password predefinita</h2>
<div class="alert gold" style="margin-top:0">Stai ancora usando la password <code>successo</code>. Chiunque apra questa pagina potrebbe indovinarla: scegli una password tua (minimo 6 caratteri).</div>
<div class="form-group"><label class="form-label">Nuova password</label><input type="password" id="cp-1" class="inp" autocomplete="new-password"></div>
<div class="form-group"><label class="form-label">Conferma</label><input type="password" id="cp-2" class="inp" autocomplete="new-password"></div>
<div class="login-err" id="cp-err"></div>
<div class="modal-footer">${forza?'':'<button class="btn btn-ghost" onclick="chiudiCambioPassword()">Più tardi</button>'}<button class="btn btn-primary" onclick="salvaCambioPassword()">Salva password</button></div></div></div>`);
setTimeout(()=>{const el=document.getElementById('cp-1');if(el)el.focus()},80)}
function chiudiCambioPassword(){const m=document.getElementById('chg-pass-modal');if(m)m.remove()}
/* ---------- v10.4: recupero password (domanda segreta, senza server) ---------- */
function toggleCodeWrap(){const w=document.getElementById('login-code-wrap');if(w)w.style.display=(w.style.display==='none'?'block':'none')}
function mostraRecupero(){const f=document.getElementById('login-form');if(f)f.style.display='block';const b=document.getElementById('login-recupero');if(b)b.style.display='block';const w=document.getElementById('login-code-wrap');if(w)w.style.display='none';
const a=getAuth()||{};const q=a.question||'';const rq=document.getElementById('rec-q');if(rq)rq.textContent=q?('Domanda segreta: '+q):'Domanda segreta';
const note=document.getElementById('rec-note');if(note)note.style.display=q?'none':'block';
['rec-an','rec-p1','rec-p2'].forEach(id=>{const i=document.getElementById(id);if(i)i.value=''});
const e=document.getElementById('rec-err');if(e){e.textContent='';e.classList.remove('ok')}
const an=document.getElementById('rec-an');if(an)an.focus()}
function chiudiRecupero(){const b=document.getElementById('login-recupero');if(b)b.style.display='none';const f=document.getElementById('login-form');if(f)f.style.display='block'}
/* v10.4.1: recupero senza mai "gelo": progresso visivo su ogni passo,
   scatto di sicurezza dopo 2 minuti e tasto che torna SEMPRE cliccabile. */
async function faRecupero(){const a=getAuth()||{};const e=document.getElementById('rec-err');e.textContent='';e.classList.remove('ok');
if(!a.question){e.textContent='Su questo dispositivo non c\'è una domanda segreta: il recupero non è possibile.';return}
if(loginBloccato()){e.textContent='⏳ Troppi tentativi errati: riprova fra '+minutiBlocco()+' min';return}
const anEl=document.getElementById('rec-an'),p1El=document.getElementById('rec-p1'),p2El=document.getElementById('rec-p2');
if(!anEl||!p1El||!p2El){e.textContent='⚠️ Finestra non caricata: chiudi e riapri "Password dimenticata?".';return}
const an=(anEl.value||'').trim().toLowerCase();
if(!an){e.textContent='Rispondi alla domanda segreta.';return}
if(hashSimple(an)!==a.answer){const n=registraFallimento();e.textContent='Risposta errata'+(n>=3?' — riprova fra '+minutiBlocco()+' min':'');return}
const p1=p1El.value,p2=p2El.value;
if(p1.length<6){e.textContent='Nuova password: minimo 6 caratteri.';return}
if(p1!==p2){e.textContent='Le due password non coincidono.';return}
const btn=document.getElementById('rec-btn');
const setBtn=(t,dis)=>{if(btn){btn.disabled=!!dis;btn.textContent=t}};
const sicurezza=setTimeout(()=>{setBtn('🔑 Recupera la password',false);e.textContent='⏳ Operazione troppo lunga (rete?): il pulsante è di nuovo attivo, riprova.';},120000);
try{
azzeraFallimenti();
setBtn('🔄 Passo 1 di 3: verifico…',true);
const salt=nuovoSale();
setBtn('🔄 Passo 2 di 3: cifro la nuova password…',true);
const h=await pbkdf2(p1,salt,PBK_ITER);
if(!h){e.textContent='Cifratura non disponibile: serve una connessione HTTPS.';return}
a.pass={salt:salt,iter:PBK_ITER,hash:h};delete a.localPass;a.ts=Date.now();saveAuth(a);
if(DB.settings){delete DB.settings._localPass;DB.settings._passV2=true;DB.settings.passRec={salt:salt,iter:PBK_ITER,hash:h}}
try{save()}catch(err){}
_cloudPass=p1;
e.textContent='✅ Password aggiornata su questo dispositivo.';e.classList.add('ok');
// l'archivio cloud viene ricifrato con la nuova password (stessa sale condivisa)
if(window.ImmoSync&&ImmoSync.rekeyWithPassword){setBtn('🔄 Passo 3 di 3: aggiorno il cloud…',true);
try{await ImmoSync.rekeyWithPassword(p1)}catch(err){console.warn('rekey',err)}
if(window.ImmoSync.syncNow){try{ImmoSync.syncNow('password')}catch(err){}}}
e.textContent='✅ Password recuperata! Ora accedi con la nuova password.';e.classList.add('ok');
setTimeout(chiudiRecupero,2600);
}catch(err){console.warn('recupero',err);e.textContent='⚠️ Errore: '+(err&&err.message?err.message:'riprova')+'. Il pulsante è di nuovo attivo.';e.classList.remove('ok')}
finally{clearTimeout(sicurezza);setBtn('🔑 Recupera la password',false)}}
async function salvaCambioPassword(){const p1=document.getElementById('cp-1').value,p2=document.getElementById('cp-2').value,e=document.getElementById('cp-err');
if(p1.length<6){e.textContent='Minimo 6 caratteri';return}if(p1!==p2){e.textContent='Non coincidono';return}
if(!(await aggiornaHashPassword(p1))){e.textContent='Il browser non supporta la cifratura: serve HTTPS';return}
const a=getAuth()||{};a.ts=Date.now();saveAuth(a);save();await sbloccoCloud(p1);chiudiCambioPassword();
if(window.ImmoSync)ImmoSync.syncNow('password');
showToast('🔑 Password aggiornata')}
function doLogout(){if(!confirm('Uscire? I dati restano salvati su questo dispositivo e sul cloud.'))return;
_cloudPass=null;
try{localStorage.removeItem(AUTH_KEY)}catch(e){}
if(window.ImmoSync){try{ImmoSync.flushNow()}catch(e){}ImmoSync.lockMaster()}
location.reload()}
function armaLock(){if(_lockTimer)clearTimeout(_lockTimer);const a=getAuth()||{};const min=a.lockMin===undefined?15:parseInt(a.lockMin,10);if(!min||min<0)return;_lockTimer=setTimeout(bloccaApp,min*60000)}
function bloccaApp(){if(!appAttiva())return;
_cloudPass=null;
try{if(window.ImmoSync)ImmoSync.flushNow()}catch(e){}
document.getElementById('app-shell').style.display='none';
const ls=document.getElementById('login-screen');if(ls)ls.style.display='flex';
showLogin();const n=document.getElementById('lock-note');if(n)n.style.display='block';
const i=document.getElementById('login-pass');if(i){i.value='';setTimeout(()=>i.focus(),60)}}
function entraApp(){document.getElementById('login-screen').style.display='none';document.getElementById('app-shell').style.display='flex';
const a=getAuth();if(a&&a.nome){document.getElementById('uname').textContent=a.nome;document.getElementById('uav').textContent=a.nome.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
loadDB();document.getElementById('topbar-date').textContent=new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});
buildNav();render();updateBadges();injectMobile();renderSyncPill();armaLock();
if(_bootstrapped)return;_bootstrapped=true;
setInterval(updateBadges,60000);
setInterval(()=>{try{if(window.ImmoSync)ImmoSync.mirror(DB)}catch(e){}},60000);
['pointerdown','keydown','touchstart','wheel'].forEach(ev=>document.addEventListener(ev,()=>{if(appAttiva())armaLock()},{passive:true}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeGlobalSearch()});
window.addEventListener('online',()=>{renderSyncPill();if(window.ImmoSync)ImmoSync.syncNow('online')});
window.addEventListener('offline',()=>renderSyncPill());
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(window.ImmoSync)ImmoSync.flushNow()}else if(appAttiva()&&window.ImmoSync)ImmoSync.pull()});
window.addEventListener('pagehide',()=>{try{if(window.ImmoSync)ImmoSync.flushNow()}catch(e){}});
if(window.ImmoSync)ImmoSync.start({getDb:()=>DB,applyDb:applicaDbRemoto,onStatus:renderSyncPill,unlock:chiediPasswordCloud})}
function renderSyncPill(st){const el=document.getElementById('sync-pill');if(!el)return;
const s=st||(window.ImmoSync?ImmoSync.status():{state:'off',mode:'off'});
const off=(typeof navigator!=='undefined'&&navigator.onLine===false);
let cls='ok',ico='☁️',txt='';
if(off){cls='off';ico='📴';txt='offline'}
else if(s.mode==='off'){cls='local';ico='💾';txt='solo locale'}
else if(s.state==='syncing'){cls='busy';ico='⏳';txt='sync…'}
else if(s.state==='error'){cls='err';ico='⚠️';txt='errore'}
else{txt=s.lastSync?new Date(s.lastSync).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'}):'pronto'}
el.className='sync-pill '+cls;
el.innerHTML='<span class="sp-ico">'+ico+'</span><span class="sp-txt">'+txt+'</span>';
const ob=document.getElementById('offline-banner');
if(ob)ob.style.display=(off&&appAttiva())?'block':'none';
el.title=(s.lastError?('⚠️ '+s.lastError+'\n'):'')+'Ultima sincronizzazione: '+(s.lastSync?new Date(s.lastSync).toLocaleString('it-IT'):'mai')}
/* prompt password: sblocca l'archivio cloud cifrato oppure ricava la chiave locale.
   v10.3: se conosco ancora la password di accesso, provo da solo (niente prompt). */
function chiediPasswordCloud(env){return new Promise(res=>{if(_passPromptOpen){res(false);return}
const apri=()=>{_passPromptOpen=true;
window._clEnv=env||null;window._clRes=res;
const testo=env?'I dati nel cloud sono cifrati con la password del dispositivo che li ha caricati. Inseriscila per scaricarli anche qui.':'Inserisci la tua password: serve per cifrare i dati prima di mandarli nel cloud.';
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" id="cl-modal" onclick="chiudiPromptCloud(false)"><div class="modal modal-sm" onclick="event.stopPropagation()"><h2>🔐 Password</h2>
<p class="text-muted text-sm" style="margin-bottom:12px">${testo}</p>
<div class="form-group"><label class="form-label">Password</label><input type="password" id="cl-pass" class="inp" autocomplete="current-password" onkeydown="if(event.key==='Enter')confermaPromptCloud()"></div>
<div class="login-err" id="cl-err"></div>
<div class="modal-footer"><button class="btn btn-ghost" onclick="chiudiPromptCloud(false)">Annulla</button><button class="btn btn-primary" onclick="confermaPromptCloud()">Conferma</button></div></div></div>`);
setTimeout(()=>{const el=document.getElementById('cl-pass');if(el)el.focus()},80)}
if(env&&_cloudPass&&window.ImmoSync){ImmoSync.rekeyFromEnvelope(_cloudPass,env).then(ok=>{if(ok){res(true);return}apri()}).catch(()=>apri())}
else apri()
})}
async function confermaPromptCloud(){const el=document.getElementById('cl-pass');const p=el?el.value:'';const e=document.getElementById('cl-err');
if(!p){if(e)e.textContent='Inserisci la password';return}
if(!window.ImmoSync){chiudiPromptCloud(false);return}
let ok=false;const eraRemoto=!!window._clEnv;
try{ok=eraRemoto?await ImmoSync.rekeyFromEnvelope(p,window._clEnv):(await ImmoSync.unlockWithPassword(p,{keepSalt:true}),true)}catch(err){ok=false}
if(!ok){if(e)e.textContent=eraRemoto?'Password non valida per questo archivio':'Operazione non riuscita';return}
chiudiPromptCloud(true);showToast('🔐 Fatto');renderSyncPill();
if(eraRemoto)ImmoSync.pull().then(()=>{render();renderSyncPill()})}
function chiudiPromptCloud(ok){const m=document.getElementById('cl-modal');if(m)m.remove();_passPromptOpen=false;
const r=window._clRes;window._clRes=null;window._clEnv=null;if(r)r(!!ok)}
// v10.3: LOGIN OBBLIGATORIO ad ogni avvio — niente apertura automatica
function checkLoginRequired(){loadDB();showLogin()}
function showToast(m,t='success',d=3000){const el=document.createElement('div');el.className='toast toast-'+t;el.textContent=m;document.getElementById('toast-container').appendChild(el);setTimeout(()=>{el.style.opacity='0';setTimeout(()=>el.remove(),300)},d)}
const RENDERERS={};
function buildNav(){const n=document.getElementById('nav');if(!n)return;n.innerHTML=NAV_ITEMS.map(x=>`<button class="nav-item ${x.id===activeSection?'active':''}" onclick="go('${x.id}')"><span class="nav-icon">${x.icon}</span><span class="nav-label">${x.label}</span><span class="nav-badge" id="badge-${x.id}" style="display:none"></span></button>`).join('')}
function go(id){activeSection=id;document.querySelectorAll('.nav-item').forEach(e=>e.classList.remove('active'));const b=document.querySelector(`.nav-item[onclick="go('${id}')"]`);if(b)b.classList.add('active');if(innerWidth<768)document.getElementById('sidebar')?.classList.remove('mobile-open');render()}
function render(){const c=document.getElementById('content');if(!c)return;c.classList.remove('fade-up');void c.offsetWidth;c.classList.add('fade-up');const p=NAV_ITEMS.find(n=>n.id===activeSection);document.getElementById('page-title').textContent=p?p.label:'';const r=RENDERERS[activeSection]||renderDashboard;try{r(c)}catch(e){c.innerHTML=`<div class="card">Errore: ${esc(e.message)}</div>`;console.error(e)}}
function topAdd(){const m={contatti:()=>openContattoModal(),immobili:()=>openImmobileModal(),chiamate:()=>openChiamataModal(),mandati:()=>openMandatoModal(),leads:()=>openLeadModal(),pipeline:()=>openTrattativaModal(),calendario:()=>openAppModal(),attivita:()=>openAttivitaModal(),documenti:()=>openDocumentoModal(),fatture:()=>openFatturaModal(),openhouse:()=>openOpenHouseModal()};(m[activeSection]||(()=>openContattoModal()))()}
function toggleSidebar(){sidebarCollapsed=!sidebarCollapsed;document.getElementById('sidebar').classList.toggle('collapsed',sidebarCollapsed)}
function updateBadges(){const o=today();const df=(DB.attivita||[]).filter(a=>!a.done&&a.scadenza<=o).length;const ap=(DB.appuntamenti||[]).filter(a=>a.data===o&&a.stato!=='completato'&&a.stato!=='annullato').length;const dr=(DB.chiamate||[]).filter(c=>c.dataRichiamo&&c.dataRichiamo<=o&&STATI_CHIUSI_CH.indexOf(c.stato)<0).length;const rc=(DB.clienti||[]).filter(c=>c.dataRichiamo&&c.dataRichiamo<=o&&c.stato!=='chiuso').length;setBadge('da-fare',df+rc);setBadge('calendario',ap);setBadge('chiamate',dr);setBadge('contatti',rc)}
function setBadge(id,n){const e=document.getElementById('badge-'+id);if(!e)return;if(n>0){e.style.display='inline-flex';e.textContent=n}else e.style.display='none'}
function openGlobalSearch(){document.getElementById('search-overlay').style.display='flex';setTimeout(()=>document.getElementById('search-input').focus(),50)}
function closeGlobalSearch(){document.getElementById('search-overlay').style.display='none';document.getElementById('search-results').innerHTML=''}
function runGlobalSearch(q){const r=document.getElementById('search-results');if(!q){r.innerHTML='';return}const t=q.toLowerCase();let h='';
(DB.clienti||[]).filter(c=>(`${c.nome} ${c.cognome} ${c.telefono}`.toLowerCase().includes(t))).slice(0,5).forEach(c=>{h+=`<div class="search-result" onclick="closeGlobalSearch();go('contatti');setTimeout(()=>openContattoModal(${c.id}),100)">👤 <b>${esc(c.nome)} ${esc(c.cognome)}</b></div>`});
(DB.immobili||[]).filter(i=>(`${i.titolo} ${i.codice}`.toLowerCase().includes(t))).slice(0,5).forEach(i=>{h+=`<div class="search-result" onclick="closeGlobalSearch();go('immobili');setTimeout(()=>openImmobileModal(${i.id}),100)">🏠 <b>${esc(i.titolo)}</b></div>`});
(DB.chiamate||[]).filter(x=>(`${x.nome} ${x.telefono}`.toLowerCase().includes(t))).slice(0,5).forEach(x=>{h+=`<div class="search-result" onclick="closeGlobalSearch();go('chiamate');setTimeout(()=>openChiamataModal('${x.id}'),100)">📞 <b>${esc(x.nome)}</b></div>`});
r.innerHTML=h||'<div class="empty-state">Nessun risultato</div>'}
function calcolaLeadScore(c){let s=0;const gg=daysSince(c.ultimoContatto||c.dataCreazione);if(gg<=1)s+=15;else if(gg<=7)s+=10;else if(gg<=30)s+=5;else if(gg>90)s-=10;if(c.stato==='caldo')s+=30;else if(c.stato==='tiepido')s+=15;s+=Math.min(((DB.eventi||[]).filter(e=>String(e.contattoId)===String(c.id)).length)*3,30);if((DB.appuntamenti||[]).some(a=>String(a.contattoId)===String(c.id)))s+=30;if((c.fonte||'').match(/referral|passaparola/i))s+=15;if(c.budget>0)s+=10;return Math.max(0,Math.min(100,Math.round(s)))}
function leadScoreChip(c){const s=calcolaLeadScore(c);const col=s>=70?'var(--red)':s>=40?'var(--orange)':s>=20?'var(--blue)':'var(--text2)';return`<span class="badge" style="background:${col}18;color:${col}">🎯 ${s}</span>`}
function getZonaInfo(i){if(!DB.zoneOMI||!i)return null;let z=DB.zoneOMI.find(x=>i.zona&&x.zona&&x.zona.toLowerCase()===String(i.zona).toLowerCase());if(!z)z=DB.zoneOMI.find(x=>i.citta&&x.comune&&x.comune.toLowerCase()===String(i.citta).toLowerCase());return z?{...z,mqMid:Math.round((z.mqMin+z.mqMax)/2)}:null}
function calcolaISV(i){let p=0;const motivi=[];const gg=Math.max(0,daysSince(i.data_pubblicazione||i.dataInserimento));if((i.fonte||'').toLowerCase()==='privato'){p+=20;motivi.push('privato')}const vt=i.prezzoIniziale?(i.prezzo-i.prezzoIniziale)/i.prezzoIniziale*100:0;if(vt<0){p+=Math.round(2*Math.abs(vt));motivi.push('ribasso')}if(gg>90){p+=20;motivi.push(gg+'gg mercato')}p=Math.max(0,Math.min(100,Math.round(p)));return{punti:p,livello:p>=70?'rosso':p>=40?'giallo':'verde',dettagli:motivi,gg}}
function isvChip(i){const v=calcolaISV(i);const m={verde:['🟢','normale','var(--green)'],giallo:['🟡','trattabile','var(--orange)'],rosso:['🔴','urgente','var(--red)']}[v.livello];return`<span class="badge" style="background:${m[2]}18;color:${m[2]}">${m[0]} ISV ${v.punti}</span>`}
function matchAcquirentiPerImmobile(imm){const out=[];(DB.clienti||[]).forEach(c=>{if(c.tipo!=='acquirente'&&c.tipo!=='investitore')return;let s=0;const bM=c.budgetMax||c.budget,bm=c.budgetMin||0;if(bM>0&&imm.prezzo>0){if(imm.prezzo<=bM&&imm.prezzo>=bm)s+=40;else if(imm.prezzo<=bM*1.1)s+=25}if(c.comuneDesiderato&&imm.citta&&c.comuneDesiderato.toLowerCase()===imm.citta.toLowerCase())s+=20;if(c.zonaDesiderata&&imm.zona&&c.zonaDesiderata.toLowerCase()===imm.zona.toLowerCase())s+=20;if(c.tipologiaDesiderata&&imm.tipo===c.tipologiaDesiderata)s+=15;if(s>=30)out.push({c,score:s})});return out.sort((a,b)=>b.score-a.score)}
/* REGIA */
function getRegiaOggi(){const o=today();if(!DB.regia||DB.regia.data!==o)DB.regia={data:o,fatte:[],saltate:[]};return DB.regia}
function punteggioCh(ch){if(STATI_CHIUSI_CH.indexOf(ch.stato)>=0)return{p:-1,motivi:[]};let p=0;const m=[];if(ch.stato==='appuntamento'){p+=120;m.push('appuntamento')}if(ch.dispPresentazione==='si'){p+=100;m.push('presentazione accettata')}if(ch.dataRichiamo&&ch.dataRichiamo<=today()){p+=60;m.push('da richiamare oggi')}if(ch.segnalatoDa||(ch.fonte||'').match(/referral|segnalazione/i)){p+=70;m.push('referral')}if(ch.stato==='presentazione-ok'){p+=40;m.push('presentazione ok')}if(ch.stato==='da-richiamare'){p+=30;m.push('da richiamare')}if(ch.stato==='da-chiamare'){p+=10;m.push('da chiamare')}return{p,motivi:m}}
function generaListaOggi(){const r=getRegiaOggi();const l=[];(DB.chiamate||[]).forEach(ch=>{if(STATI_CHIUSI_CH.indexOf(ch.stato)>=0||r.fatte.indexOf(ch.id)>=0||r.saltate.indexOf(ch.id)>=0)return;const s=punteggioCh(ch);if(s.p>=0)l.push({ch,p:s.p,motivi:s.motivi})});return l.sort((a,b)=>b.p-a.p)}
function renderRegia(c){const r=getRegiaOggi();const lista=generaListaOggi();const fatte=r.fatte.length;const target=(DB.obiettivi&&DB.obiettivi.chiamateGiorno)||10;const pct=Math.min(100,Math.round(fatte/target*100));const ok=fatte>=target;const pal=statoPaletto();
c.innerHTML=`<div class="stack">
<div class="card" style="background:linear-gradient(135deg,rgba(201,169,110,.14),rgba(99,102,241,.06));border-color:var(--gold)">
<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:12px">
<div><div class="card-title" style="font-size:18px">🎯 Regia del Giorno</div><div class="card-subtitle">${greeting()}, ${esc(nomeAgente().split(' ')[0])} — ${new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}</div></div>
<div class="row-tight">
<div style="text-align:center;padding:8px 16px;background:var(--bg2);border-radius:10px"><div style="font-size:9px;color:var(--text2)">CHIAMATE OGGI</div><div style="font-size:26px;font-weight:700;color:${ok?'var(--green)':'var(--gold)'}">${fatte}/${target}</div><div class="prog-bar" style="width:90px;margin-top:4px"><div class="prog-fill" style="background:${ok?'var(--green)':'var(--gold)'};width:${pct}%"></div></div></div>
<div style="text-align:center;padding:8px 16px;background:var(--bg2);border-radius:10px"><div style="font-size:9px;color:var(--text2)">PALETTO</div><div style="font-size:26px;font-weight:700;color:${pal.ok?'var(--green)':'var(--red)'}">${pal.inc}/${pal.target}</div></div></div></div>
<div style="margin-top:12px;font-size:13px;font-weight:600;color:${ok?'var(--green)':'var(--gold)'}">${lista.length===0&&fatte===0?'📭 Lista vuota: importa una rubrica o aggiungi prospect.':ok?'✅ Obiettivo chiamate raggiunto!':'💪 Hai '+lista.length+' persone da chiamare: inizia da quelle in alto.'}</div></div>
<div class="row"><button class="btn btn-primary" onclick="openChiamataModal()">+ Nuovo prospect</button><button class="btn btn-ghost" onclick="regiaReset()">↺ Azzera fatte/saltate</button><span class="text-muted text-sm" style="margin-left:auto">${lista.length} in lista</span></div>
<div class="stack">${lista.length===0?'<div class="card"><div class="empty-state"><div class="icon">🎉</div>Nessuna chiamata in sospeso oggi.</div></div>':lista.map((it,i)=>cardRegia(it,i)).join('')}</div></div>`}
function cardRegia(it,i){const ch=it.ch;const col=it.p>=100?'var(--red)':it.p>=60?'var(--orange)':it.p>=30?'var(--blue)':'var(--text2)';const rk=i+1;const bg=rk===1?'var(--red)':rk===2?'var(--orange)':rk===3?'var(--gold)':'var(--bg5)';
return`<div class="card" style="border-left:4px solid ${col}">
<div class="row" style="gap:12px;align-items:flex-start">
<div style="width:34px;height:34px;border-radius:50%;background:${bg};color:${rk<=3?'#0a0c14':'var(--text)'};display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">${rk}</div>
<div style="flex:1;min-width:0"><div class="row" style="justify-content:space-between"><div style="font-size:15px;font-weight:700">${esc(ch.nome)}</div><span class="badge" style="background:${col}22;color:${col}">priorità ${it.p}</span></div>
<div style="font-size:11px;color:var(--text2)">${esc(ch.fonte||'—')}${ch.citta?' · '+esc(ch.citta):''}${ch.indirizzo?' · '+esc(ch.indirizzo):''}</div>
${it.motivi.length?`<div style="font-size:10px;color:var(--gold);margin-top:3px">💡 ${esc(it.motivi.join(' · '))}</div>`:''}
${ch.esito?`<div style="font-size:11px;color:var(--text3);margin-top:4px;font-style:italic">"${esc(ch.esito)}"</div>`:''}</div></div>
<div class="row" style="margin-top:12px;gap:6px;flex-wrap:wrap">
${ch.telefono?`<button class="btn btn-primary btn-sm" onclick="window.open('tel:${waNumber(ch.telefono)}','_self')">📞 Chiama</button><button class="btn btn-gold btn-sm" onclick="regiaWA('${ch.id}')">💬 WhatsApp</button>`:''}
<button class="btn btn-success btn-sm" onclick="regiaEsito('${ch.id}')">✅ Esito</button>
<button class="btn btn-ghost btn-sm" onclick="regiaApp('${ch.id}')">📅 Appunt.</button>
<button class="btn btn-ghost btn-sm" onclick="regiaConverti('${ch.id}')">👤 Converti</button>
<button class="btn btn-ghost btn-sm" onclick="regiaSalta('${ch.id}')">⏭ Salta</button>
<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openChiamataModal('${ch.id}')">✏️</button></div></div>`}
function trovaCh(id){return(DB.chiamate||[]).find(x=>String(x.id)===String(id))}
function regiaWA(id){const ch=trovaCh(id);if(!ch||!ch.telefono)return;window.open('https://wa.me/'+waNumber(ch.telefono)+'?text='+encodeURIComponent('Buongiorno '+ch.nome+', sono '+(DB.settings.agente||'l\'agente')+'. Quando possiamo sentirci?'),'_blank')}
function regiaSalta(id){const r=getRegiaOggi();if(r.saltate.indexOf(id)<0)r.saltate.push(id);save();render();showToast('Saltata per oggi','info')}
function regiaReset(){if(!confirm('Azzerare fatte/saltate di oggi?'))return;DB.regia={data:today(),fatte:[],saltate:[]};save();render()}
function regiaConverti(id){const ch=trovaCh(id);if(!ch)return;if(!confirm('Convertire '+ch.nome+' in contatto CRM?'))return;const nm=String(ch.nome||'').split(' ');DB.clienti.push(contattoFromChiamata(ch));ch.stato='convertito';markFatta(id);save();render();showToast('✅ Convertito in contatto')}
function markFatta(id){const r=getRegiaOggi();if(r.fatte.indexOf(id)<0)r.fatte.push(id)}
function regiaApp(id){const ch=trovaCh(id);openAppModal(0,null,null,today(),ch?ch.nome:'')}
function regiaEsito(id){const ch=trovaCh(id);if(!ch)return;
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-sm" onclick="event.stopPropagation()"><h2>✅ Esito — ${esc(ch.nome)}</h2>
<div class="stack" style="gap:10px">
<div class="form-group"><label class="form-label">Com'è andata?</label><select id="rg-esito" class="inp"><option value="presentazione">🟢 Accetta presentazione</option><option value="richiamare">🔵 Da richiamare</option><option value="appuntamento">🟣 Vuole appuntamento</option><option value="non-risponde">⚪ Non risponde</option><option value="non-interessato">🟠 Non interessato</option></select></div>
<div class="form-group"><label class="form-label">Data richiamo</label><input id="rg-rich" type="date" class="inp" value="${iso(addDays(new Date(),1))}"></div>
<div class="form-group"><label class="form-label">Cosa vi siete detti</label><textarea id="rg-note" class="inp" rows="3"></textarea></div></div>
<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="regiaSalvaEsito('${id}')">Salva</button></div></div></div>`)}
function regiaSalvaEsito(id){const ch=trovaCh(id);if(!ch)return;const es=document.getElementById('rg-esito').value;const rich=document.getElementById('rg-rich').value;const note=document.getElementById('rg-note').value.trim();
ch.dataChiamata=today();ch.oraChiamata=new Date().toTimeString().slice(0,5);if(note)ch.esito=note;
if(es==='presentazione'){ch.stato='presentazione-ok';ch.dispPresentazione='si';ch.dataRichiamo=rich}
else if(es==='appuntamento'){ch.stato='appuntamento'}
else if(es==='richiamare'||es==='non-risponde'){ch.stato='da-richiamare';ch.dataRichiamo=rich}
else if(es==='non-interessato'){ch.stato='non-interessato'}
markFatta(id);save();closeModal();render();showToast('✅ Esito registrato')}
/* OBIETTIVI */
function statoPaletto(){const t=(DB.obiettivi&&DB.obiettivi.incarichiSettimana)||1;const ws=weekStart(new Date()),we=addDays(ws,6);const inc=(DB.mandati||[]).filter(m=>{if(m.stato==='annullato')return false;const d=m.dataFirma||m.dataInizio;return d&&d>=iso(ws)&&d<=iso(we)}).length;return{inc,target:t,ok:inc>=t}}
function streakSettimane(){const t=(DB.obiettivi&&DB.obiettivi.incarichiSettimana)||1;let s=0,w=addDays(weekStart(new Date()),-7),g=0;while(g++<200){const we=addDays(w,6);const n=(DB.mandati||[]).filter(m=>{if(m.stato==='annullato')return false;const d=m.dataFirma||m.dataInizio;return d&&d>=iso(w)&&d<=iso(we)}).length;if(n>=t){s++;w=addDays(w,-7)}else break}return s}
function renderObiettivi(c){const ob=DB.obiettivi||{};const ws=weekStart(new Date()),we=addDays(ws,6);
const incSett=(DB.mandati||[]).filter(m=>{if(m.stato==='annullato')return false;const d=m.dataFirma||m.dataInizio;return d&&d>=iso(ws)&&d<=iso(we)}).length;
const target=ob.incarichiSettimana||1;const giorni=Math.max(0,daysBetween(today(),iso(we)));const streak=streakSettimane();
const now=new Date();const mS=new Date(now.getFullYear(),now.getMonth(),1),mE=new Date(now.getFullYear(),now.getMonth()+1,0);
const incMese=(DB.mandati||[]).filter(m=>{if(m.stato==='annullato')return false;const d=m.dataFirma||m.dataInizio;return d&&d>=iso(mS)&&d<=iso(mE)}).length;
const incAnno=(DB.mandati||[]).filter(m=>{if(m.stato==='annullato')return false;const d=m.dataFirma||m.dataInizio;return d&&d.slice(0,4)===String(now.getFullYear())}).length;
const chSett=(DB.chiamate||[]).filter(x=>x.dataChiamata&&x.dataChiamata>=iso(ws)&&x.dataChiamata<=iso(we)).length;
const pct=Math.min(100,Math.round(incSett/target*100));const ok=incSett>=target;
let msg,col;if(ok){msg='🎉 Paletto rispettato! Continua così.';col='var(--green)'}else if(giorni<=1){msg='⚠️ Ultimo giorno: ti manca '+(target-incSett)+' incarico. Chiamate mirate ORA.';col='var(--red)'}else if(giorni<=3){msg='🔥 Mancano '+(target-incSett)+' incarico/i e '+giorni+' giorni.';col='var(--orange)'}else{msg='💪 Paletto: '+target+' incarico/i. Hai '+giorni+' giorni.';col='var(--blue)'}
const azioni=[];const richOggi=(DB.chiamate||[]).filter(x=>x.dataRichiamo&&x.dataRichiamo<=today()&&STATI_CHIUSI_CH.indexOf(x.stato)<0).length;
if(richOggi)azioni.push({i:'⏰',t:'Richiama le '+richOggi+' persone in scadenza oggi',g:'chiamate'});
const presOk=(DB.chiamate||[]).filter(x=>x.dispPresentazione==='si'&&STATI_CHIUSI_CH.indexOf(x.stato)<0).length;
if(presOk)azioni.push({i:'🟢',t:'Trasforma '+presOk+' presentazioni in appuntamenti',g:'chiamate'});
if(chSett<(ob.chiamateGiorno||10))azioni.push({i:'📞',t:'Fai ancora '+((ob.chiamateGiorno||10)-chSett)+' chiamate',g:'regia'});
if(!ok)azioni.push({i:'🎯',t:'Chiudi '+(target-incSett)+' incarico entro domenica',g:'mandati'});
const sett=[];for(let i=11;i>=0;i--){const w=addDays(ws,-7*i);const wwe=addDays(w,6);const n=(DB.mandati||[]).filter(m=>{if(m.stato==='annullato')return false;const d=m.dataFirma||m.dataInizio;return d&&d>=iso(w)&&d<=iso(wwe)}).length;sett.push({w,wwe,n,cur:i===0})}
c.innerHTML=`<div class="stack">
<div class="card" style="background:linear-gradient(135deg,rgba(201,169,110,.12),rgba(239,68,68,.06));border-color:${ok?'var(--green)':'var(--gold)'};text-align:center">
<div style="font-size:11px;letter-spacing:2px;color:var(--gold);text-transform:uppercase;font-weight:700">🎯 Il paletto fisso del titolare</div>
<div style="font-family:var(--font-serif);font-size:30px;font-weight:700;color:var(--gold2);margin:6px 0">Almeno ${target} incarico${target===1?'':'i'} a settimana</div>
<div style="font-size:12px;color:var(--text2)">Settimana ${weekLabel(ws,we)} · mancano ${giorni} giorni</div>
<div style="margin:16px auto;max-width:480px"><div class="row" style="justify-content:space-between;font-size:13px;margin-bottom:6px"><span>Questa settimana: <b style="color:${ok?'var(--green)':'var(--gold)'}">${incSett}/${target}</b></span>${streak>0?`<span>🔥 Streak: <b style="color:var(--orange)">${streak}</b></span>`:''}</div>
<div class="prog-bar" style="height:12px;border-radius:6px"><div class="prog-fill" style="height:12px;border-radius:6px;background:${ok?'var(--green)':'linear-gradient(90deg,var(--gold),var(--gold2))'};width:${pct}%"></div></div></div>
<div style="font-size:13px;color:${col};font-weight:600">${msg}</div></div>
<div class="grid4">
<div class="stat-card"><div class="stat-label">Incarichi settimana</div><div class="stat-value">${incSett} / ${target}</div><div class="stat-sub">${ok?'✅ in regola':'⚠️ sotto'}</div></div>
<div class="stat-card"><div class="stat-label">Incarichi mese</div><div class="stat-value">${incMese} / ${ob.incarichiMese||4}</div></div>
<div class="stat-card"><div class="stat-label">Incarichi anno</div><div class="stat-value">${incAnno}</div></div>
<div class="stat-card"><div class="stat-label">Streak</div><div class="stat-value">🔥 ${streak}</div><div class="stat-sub">settimane a segno</div></div></div>
<div class="card"><div class="card-title" style="margin-bottom:10px">📅 Ultime 12 settimane (verde = paletto ok)</div>
<div class="row" style="gap:6px;overflow-x:auto">${sett.map(w=>{const o=w.n>=target;return`<div style="flex:1;min-width:52px;background:${w.cur?'rgba(99,102,241,.2)':o?'rgba(34,197,94,.18)':'rgba(239,68,68,.14)'};border:1px solid ${w.cur?'var(--primary)':o?'var(--green)':'rgba(239,68,68,.5)'};border-radius:8px;padding:8px 4px;text-align:center"><div style="font-size:9px;color:var(--text2)">${weekLabel(w.w,w.wwe)}</div><div style="font-size:18px;font-weight:700;color:${o?'var(--green)':'var(--red)'}">${w.n}</div></div>`}).join('')}</div></div>
<div class="grid2">
<div class="card"><div class="card-title" style="margin-bottom:12px">📊 Attrezzatura settimana</div>
<div style="margin-bottom:12px"><div class="row" style="justify-content:space-between;font-size:12px;margin-bottom:4px"><span>📞 Chiamate fatte</span><b>${chSett} / ${ob.chiamateGiorno||10}</b></div><div class="prog-bar"><div class="prog-fill" style="background:${chSett>=(ob.chiamateGiorno||10)?'var(--green)':'var(--gold)'};width:${Math.min(100,chSett/(ob.chiamateGiorno||10)*100)}%"></div></div></div>
<div><div class="row" style="justify-content:space-between;font-size:12px;margin-bottom:4px"><span>🎯 Incarichi</span><b>${incSett} / ${target}</b></div><div class="prog-bar"><div class="prog-fill" style="background:${ok?'var(--green)':'var(--gold)'};width:${pct}%"></div></div></div></div>
<div class="card"><div class="card-title" style="margin-bottom:12px">⚡ Cosa fare ADESSO</div>
${azioni.map(a=>`<div class="row" style="padding:9px 0;border-bottom:1px solid var(--bg4);cursor:pointer" onclick="go('${a.g}')"><div style="font-size:18px">${a.i}</div><div style="flex:1;font-size:13px">${a.t}</div><span style="color:var(--primary)">→</span></div>`).join('')||'<div class="empty-state text-sm">Sei in regola: mantieni il ritmo.</div>'}</div></div>
<div class="card"><div class="card-title" style="margin-bottom:10px">⚙️ I miei obiettivi</div>
<div class="form-row-3">
<div class="form-group"><label class="form-label">Incarichi / settimana</label><input id="ob-sett" type="number" min="1" class="inp" value="${ob.incarichiSettimana||1}"></div>
<div class="form-group"><label class="form-label">Incarichi / mese</label><input id="ob-mese" type="number" min="1" class="inp" value="${ob.incarichiMese||4}"></div>
<div class="form-group"><label class="form-label">Chiamate / giorno</label><input id="ob-ch" type="number" min="1" class="inp" value="${ob.chiamateGiorno||10}"></div></div>
<div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" onclick="saveObiettivi()">Salva obiettivi</button><button class="btn btn-gold btn-sm" onclick="openMandatoModal()">+ Registra incarico</button></div></div></div>`}
function saveObiettivi(){DB.obiettivi.incarichiSettimana=Math.max(1,parseInt(document.getElementById('ob-sett').value)||1);DB.obiettivi.incarichiMese=Math.max(1,parseInt(document.getElementById('ob-mese').value)||1);DB.obiettivi.chiamateGiorno=Math.max(1,parseInt(document.getElementById('ob-ch').value)||1);save();render();showToast('Obiettivi salvati ✓')}
/* CHIAMATE */
function renderChiamate(c){const f=_chF;const ric=f.ricerca.toLowerCase();
const lista=(DB.chiamate||[]).filter(x=>(!f.stato||x.stato===f.stato)&&(!ric||(`${x.nome} ${x.telefono} ${x.indirizzo}`.toLowerCase().includes(ric)))).sort((a,b)=>(b.dataChiamata||'').localeCompare(a.dataChiamata||''));
const daF=(DB.chiamate||[]).filter(x=>x.dataRichiamo&&x.dataRichiamo<=today()&&STATI_CHIUSI_CH.indexOf(x.stato)<0);
const tot=(DB.chiamate||[]).length;const conv=(DB.chiamate||[]).filter(x=>x.stato==='convertito').length;const pres=(DB.chiamate||[]).filter(x=>x.dispPresentazione==='si').length;
const stati=[['da-chiamare','⚪ Da chiamare'],['da-richiamare','🔵 Da richiamare'],['presentazione-ok','🟢 Presentaz. OK'],['appuntamento','🟣 Appuntamento'],['convertito','✅ Convertito'],['non-interessato','🟠 Non interess.'],['perso','🔴 Perso']];
c.innerHTML=`<div class="stack">
<div class="card"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px">
<div><div class="card-title" style="font-size:17px">📞 Registro Chiamate</div><div class="card-subtitle">Pagine Bianche, strada, bar, segnalazioni</div></div>
<div class="row-tight"><div style="text-align:center;padding:8px 14px;background:var(--bg2);border-radius:10px"><div style="font-size:9px;color:var(--text2)">DA RICHIAMARE</div><div style="font-size:22px;font-weight:700;color:${daF.length?'var(--red)':'var(--green)'}">${daF.length}</div></div><button class="btn btn-primary" onclick="openChiamataModal()">+ Nuova</button></div></div>
<div class="grid4" style="margin-top:14px"><div class="stat-box"><div class="stat-num">${tot}</div><div class="stat-lbl">in lista</div></div><div class="stat-box"><div class="stat-num">${pres}</div><div class="stat-lbl">accettano presentaz.</div></div><div class="stat-box"><div class="stat-num">${conv}</div><div class="stat-lbl">convertiti</div></div><div class="stat-box"><div class="stat-num">${tot?Math.round(conv/tot*100):0}%</div><div class="stat-lbl">conversione</div></div></div></div>
<div class="row"><div class="search-bar">🔍 <input value="${esc(f.ricerca)}" placeholder="Cerca…" oninput="_chF.ricerca=this.value;renderChiamate(document.getElementById('content'))"></div>
<select class="inp" style="width:auto" onchange="_chF.stato=this.value;renderChiamate(document.getElementById('content'))"><option value="">Tutti gli stati</option>${stati.map(s=>`<option value="${s[0]}" ${f.stato===s[0]?'selected':''}>${s[1]}</option>`).join('')}</select></div>
<div class="card">${lista.length===0?'<div class="empty-state"><div class="icon">📞</div>Nessuna persona. Aggiungila o importa una rubrica.</div>':`<div class="table-wrap"><table class="table"><thead><tr><th>Persona</th><th>Fonte</th><th>Stato</th><th>Present.</th><th>Richiamo</th><th>Segnal.</th><th></th></tr></thead><tbody>${lista.map(ch=>`<tr class="row-clickable" onclick="openChiamataModal('${ch.id}')"><td><b>${esc(ch.nome)}</b><div style="font-size:10px;color:var(--text2)">${esc(ch.telefono||'')}</div></td><td><span class="badge badge-gray">${esc(ch.fonte||'—')}</span></td><td>${esc(ch.stato||'')}</td><td>${ch.dispPresentazione==='si'?'✅':ch.dispPresentazione==='forse'?'🟡':'—'}</td><td style="font-size:11px">${ch.dataRichiamo?fmtDateShort(ch.dataRichiamo):'—'}</td><td>${(ch.segnalazioni||[]).length||'—'}</td><td onclick="event.stopPropagation()"><div class="row-tight">${ch.telefono?`<button class="btn btn-ghost btn-xs" onclick="window.open('tel:${waNumber(ch.telefono)}','_self')">📞</button>`:''}<button class="btn btn-success btn-xs" onclick="regiaEsito('${ch.id}')">✅</button></div></td></tr>`).join('')}</tbody></table></div>`}</div></div>`}
function openChiamataModal(id){const ch=id?trovaCh(id):{};const fonti=['Pagine Bianche','Per strada','Al bar','Referral','Conoscente','Porta a porta','Altro'];const stati=['da-chiamare','da-richiamare','presentazione-ok','appuntamento','convertito','non-interessato','perso'];
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-lg" onclick="event.stopPropagation()"><h2>${id?'✏️ '+esc(ch.nome||''):'📞 Nuova persona'}</h2>
<div class="form-row-3">
<div class="form-group"><label class="form-label">Nome e cognome *</label><input id="ch-nome" class="inp" value="${esc(ch.nome||'')}"></div>
<div class="form-group"><label class="form-label">Telefono *</label><input id="ch-tel" class="inp" value="${esc(ch.telefono||'')}"></div>
<div class="form-group"><label class="form-label">Fonte</label><select id="ch-fonte" class="inp">${fonti.map(x=>`<option ${ch.fonte===x?'selected':''}>${x}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Indirizzo</label><input id="ch-ind" class="inp" value="${esc(ch.indirizzo||'')}"></div>
<div class="form-group"><label class="form-label">Città</label><input id="ch-citta" class="inp" value="${esc(ch.citta||'Piacenza')}"></div>
<div class="form-group"><label class="form-label">Zona</label><input id="ch-zona" class="inp" value="${esc(ch.zona||'')}"></div>
<div class="form-group"><label class="form-label">Immobile?</label><select id="ch-ha" class="inp"><option value="" ${!ch.haImmobile?'selected':''}>—</option><option value="vende" ${ch.haImmobile==='vende'?'selected':''}>Vuole vendere</option><option value="affitta" ${ch.haImmobile==='affitta'?'selected':''}>Vuole affittare</option><option value="cerca" ${ch.haImmobile==='cerca'?'selected':''}>Cerca casa</option></select></div>
<div class="form-group"><label class="form-label">Disponibile presentaz.?</label><select id="ch-disp" class="inp"><option value="" ${!ch.dispPresentazione?'selected':''}>—</option><option value="si" ${ch.dispPresentazione==='si'?'selected':''}>✅ Sì</option><option value="forse" ${ch.dispPresentazione==='forse'?'selected':''}>🟡 Forse</option><option value="no" ${ch.dispPresentazione==='no'?'selected':''}>❌ No</option></select></div>
<div class="form-group"><label class="form-label">Stato</label><select id="ch-stato" class="inp">${stati.map(s=>`<option value="${s}" ${(ch.stato||'da-chiamare')===s?'selected':''}>${s}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Data chiamata</label><input id="ch-dataCh" type="date" class="inp" value="${ch.dataChiamata||today()}"></div>
<div class="form-group"><label class="form-label">Data da richiamare</label><input id="ch-dataRich" type="date" class="inp" value="${ch.dataRichiamo||''}"></div>
<div class="form-group"><label class="form-label">Segnalato da</label><input id="ch-segda" class="inp" value="${esc(ch.segnalatoDa||'')}"></div></div>
<div class="form-group" style="margin-top:10px"><label class="form-label">📝 Cosa ci siamo detti</label><textarea id="ch-esito" class="inp" rows="3">${esc(ch.esito||'')}</textarea></div>
<div class="form-group" style="margin-top:8px"><label class="form-label">➡️ Prossima azione</label><input id="ch-pross" class="inp" value="${esc(ch.prossimaAzione||'')}"></div>
<div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px"><div class="row" style="justify-content:space-between;margin-bottom:8px"><div class="card-title">👥 Chi mi ha segnalato (referral)</div><button class="btn btn-ghost btn-xs" onclick="aggSegnRow()">+ Aggiungi</button></div><div id="segn-cont">${(ch.segnalazioni||[]).map(segnRow).join('')}</div></div>
<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button>${id?`<button class="btn btn-danger" onclick="deleteChiamata('${id}')">Elimina</button>`:''}<button class="btn btn-primary" onclick="saveChiamata('${id||''}')">${id?'Salva':'Aggiungi'}</button></div></div></div>`)}
function segnRow(s){s=s||{};return`<div class="segn-row" style="display:flex;gap:6px;margin-bottom:6px"><input class="inp segn-nome" style="flex:1" placeholder="Nome" value="${esc(s.nome||'')}"><input class="inp segn-tel" style="flex:1" placeholder="Tel" value="${esc(s.telefono||'')}"><input class="inp segn-nota" style="flex:1" placeholder="Nota" value="${esc(s.nota||'')}"><button class="btn btn-ghost btn-sm" onclick="this.parentNode.remove()">✕</button></div>`}
function aggSegnRow(){document.getElementById('segn-cont').insertAdjacentHTML('beforeend',segnRow({}))}
function saveChiamata(id){const g=v=>document.getElementById(v).value;const seg=[];document.querySelectorAll('#segn-cont .segn-row').forEach(r=>{const n=r.querySelector('.segn-nome').value.trim(),t=r.querySelector('.segn-tel').value.trim(),no=r.querySelector('.segn-nota').value.trim();if(n||t)seg.push({nome:n,telefono:t,nota:no})});
const d={nome:g('ch-nome').trim(),telefono:g('ch-tel').trim(),fonte:g('ch-fonte'),indirizzo:g('ch-ind').trim(),citta:g('ch-citta').trim(),zona:g('ch-zona').trim(),haImmobile:g('ch-ha'),dispPresentazione:g('ch-disp'),stato:g('ch-stato'),dataChiamata:g('ch-dataCh'),dataRichiamo:g('ch-dataRich'),segnalatoDa:g('ch-segda').trim(),esito:g('ch-esito').trim(),prossimaAzione:g('ch-pross').trim(),segnalazioni:seg};
if(!d.nome||!d.telefono){showToast('Nome e telefono obbligatori','error');return}
if(id){const i=(DB.chiamate||[]).findIndex(x=>String(x.id)===String(id));if(i>=0)DB.chiamate[i]={...DB.chiamate[i],...d};showToast('Scheda aggiornata ✓')}
else{d.id=''+Date.now();d.creata=nowISO();DB.chiamate.push(d);showToast('Aggiunto alla lista ✓')}
save();closeModal();render()}
function deleteChiamata(id){if(!confirm('Eliminare?'))return;DB.chiamate=DB.chiamate.filter(x=>String(x.id)!==String(id));save();closeModal();render()}
/* DASHBOARD */
function renderDashboard(c){const ct=DB.clienti||[],im=DB.immobili||[],tr=DB.trattative||[];const o=today();
const appO=(DB.appuntamenti||[]).filter(a=>a.data===o&&a.stato!=='completato'&&a.stato!=='annullato');
const attO=(DB.attivita||[]).filter(a=>!a.done&&a.scadenza<=o);
const disp=im.filter(i=>i.stato==='disponibile');const inCorso=tr.filter(t=>!['conclusa','rogito','persa'].includes(t.fase));
const provv=sumBy(inCorso,t=>(t.prezzoOfferto||0)*(t.provvigione||0)/100);
const chiuse=sumBy(tr.filter(t=>t.fase==='conclusa'||t.fase==='rogito'),t=>(t.prezzoOfferto||0)*(t.provvigione||0)/100);
const top=ct.map(x=>({c:x,s:calcolaLeadScore(x)})).sort((a,b)=>b.s-a.s).slice(0,6);
const topI=disp.map(i=>({i,v:calcolaISV(i)})).filter(x=>x.v.punti>0).sort((a,b)=>b.v.punti-a.v.punti).slice(0,5);
const pal=statoPaletto();const u=mercatoUltimo();const yoy=mercatoYoY(u);
c.innerHTML=`<div class="stack">
<div class="card" style="background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(139,92,246,.06));border-color:var(--primary)">
<div class="row" style="justify-content:space-between;flex-wrap:wrap"><div><div class="card-title" style="font-size:18px">${greeting()}, ${esc(nomeAgente().split(' ')[0])} 👋</div><div class="card-subtitle">${new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})}</div></div>
<div class="row-tight"><span class="badge ${pal.ok?'badge-green':'badge-red'}">🎯 paletto ${pal.inc}/${pal.target}</span><span class="badge badge-primary">${attO.length+appO.length} cose oggi</span></div></div>
<div style="margin-top:10px;font-size:11px;color:var(--text2)">📉 Mercato PC (${u.p}): ${u.prov} NTN prov. (${yoy.prov>=0?'+':''}${yoy.prov.toFixed(1)}% YoY) · €/mq ${fmtEuroShort(u.prezzoMq)} · mutui ${u.tassoMutui}% <a style="cursor:pointer;color:var(--primary)" onclick="go('mercato')">→ dettaglio</a></div></div>
<div class="grid4">
<div class="stat-card"><div class="stat-label">Contatti</div><div class="stat-value">${ct.length}</div><div class="stat-sub">${ct.filter(x=>x.stato==='caldo').length} caldi · ${ct.filter(x=>x.dataRichiamo&&x.dataRichiamo<=o&&x.stato!=='chiuso').length} da richiamare</div></div>
<div class="stat-card"><div class="stat-label">Immobili</div><div class="stat-value">${im.length}</div><div class="stat-sub">${disp.length} disponibili</div></div>
<div class="stat-card"><div class="stat-label">Pipeline</div><div class="stat-value">${inCorso.length}</div><div class="stat-sub">${fmtEuroShort(provv)} stimati</div></div>
<div class="stat-card"><div class="stat-label">Incassato</div><div class="stat-value">${fmtEuroShort(chiuse)}</div><div class="stat-sub text-green">provvigioni</div></div></div>
<div class="grid2">
<div class="card"><div class="card-title" style="margin-bottom:10px">🔥 Lead più caldi</div>${top.length?top.map(t=>`<div class="row" style="padding:8px 0;border-bottom:1px solid var(--bg4);cursor:pointer" onclick="openContattoModal(${t.c.id})"><div style="flex:1"><b>${esc(t.c.nome)} ${esc(t.c.cognome)}</b><div style="font-size:10px;color:var(--text2)">${t.c.tipo}</div></div>${leadScoreChip(t.c)}</div>`).join(''):'<div class="empty-state text-sm">Nessun lead.</div>'}</div>
<div class="card"><div class="card-title" style="margin-bottom:10px">🏆 Opportunità ISV</div>${topI.length?topI.map(t=>`<div class="row" style="padding:8px 0;border-bottom:1px solid var(--bg4);cursor:pointer" onclick="openImmobileModal(${t.i.id})"><div style="flex:1"><b>${esc(t.i.titolo)}</b><div style="font-size:10px;color:var(--text2)">${fmtEuroShort(t.i.prezzo)} · ${t.v.gg}gg</div></div>${isvChip(t.i)}</div>`).join(''):'<div class="empty-state text-sm">Nessuna opportunità.</div>'}</div></div></div>`}
/* DA FARE */
function renderDaFare(c){const o=today();const att=(DB.attivita||[]).filter(a=>!a.done&&a.scadenza<=o);const scad=att.filter(a=>a.scadenza<o);const app=(DB.appuntamenti||[]).filter(a=>a.data===o&&a.stato!=='completato'&&a.stato!=='annullato');
const rich=(DB.clienti||[]).filter(x=>x.dataRichiamo&&x.dataRichiamo<=o&&x.stato!=='chiuso').sort((a,b)=>(a.dataRichiamo||'').localeCompare(b.dataRichiamo||''));
c.innerHTML=`<div class="stack">
${scad.length?`<div class="card" style="border-color:rgba(239,68,68,.4)"><div class="card-title text-red" style="margin-bottom:10px">⚠️ Scadute (${scad.length})</div>${scad.map(a=>attRow(a,true)).join('')}</div>`:''}
<div class="card"><div class="card-title" style="margin-bottom:10px">📅 Appuntamenti oggi (${app.length})</div>${app.length?app.map(a=>`<div class="row" style="padding:10px 0;border-bottom:1px solid var(--bg4)"><b style="width:55px;color:var(--primary)">${a.ora}</b><div style="flex:1">${esc(a.titolo)}</div><button class="btn btn-ghost btn-xs" onclick="openAppModal(${a.id})">✏️</button></div>`).join(''):'<div class="empty-state text-sm">Nessuno.</div>'}</div>
<div class="card"><div class="card-title" style="margin-bottom:10px">☎️ Contatti da richiamare (${rich.length})</div>${rich.length?rich.map(x=>`<div class="row" style="padding:10px 0;border-bottom:1px solid var(--bg4)"><div style="font-size:18px">${x.dataRichiamo<o?'🔴':'📞'}</div><div style="flex:1;min-width:0"><b>${esc(x.nome)} ${esc(x.cognome||'')}</b><div style="font-size:10px;color:var(--text2)">${x.dataRichiamo<o?'<span class="text-red">scaduto '+fmtDateShort(x.dataRichiamo)+'</span>':'oggi'}${x.fonte?' · '+esc(x.fonte):''}${x.collaborativo==='si'?' · collaborativo':''}</div></div>${x.telefono?`<button class="btn btn-ghost btn-xs" onclick="window.open('tel:${waNumber(x.telefono)}','_self')">📞</button><button class="btn btn-gold btn-xs" onclick="whatsappCliente(${x.id})">💬</button>`:''}<button class="btn btn-ghost btn-xs" onclick="openContattoModal(${x.id})">✏️</button></div>`).join(''):'<div class="empty-state text-sm">Nessun richiamo in scadenza.</div>'}</div>
<div class="card"><div class="card-title" style="margin-bottom:10px">📌 Da fare oggi</div>${att.length?att.map(a=>attRow(a,false)).join(''):'<div class="empty-state text-sm">Tutto fatto!</div>'}</div></div>`}
function attRow(a,sc){return`<div class="row" style="padding:10px 0;border-bottom:1px solid var(--bg4)"><div style="font-size:18px">${a.priorita==='alta'?'🔴':a.priorita==='media'?'🟡':'🔵'}</div><div style="flex:1"><b>${esc(a.titolo)}</b><div style="font-size:10px;color:var(--text2)">${a.contattoNome?'👤 '+esc(a.contattoNome):''}${sc?' · <span class="text-red">scaduta</span>':''}</div></div><button class="btn btn-success btn-icon btn-sm" onclick="toggleAttivita('${a.id}')">✓</button><button class="btn btn-ghost btn-icon btn-sm" onclick="openAttivitaModal('${a.id}')">✏️</button></div>`}
/* CONTATTI */
const COLLAB_OPT=[['','—'],['si','✅ Collaborativo'],['forse','🟡 Forse'],['no','❌ Non collaborativo']];
const PRES_MODO=['','di persona','email','whatsapp','posta','altra'];
function telKey(x){return String(x||'').replace(/\D/g,'')}
function splitIndirizzo(s){s=String(s||'').trim();if(!s)return{via:'',civico:''};const m=s.match(/^(.*?)[\s,]+(\d+[A-Za-z\/]*)$/);return m?{via:m[1].trim(),civico:m[2].trim()}:{via:s,civico:''}}
function fmtIndirizzo(c){const v=(c.via||'').trim(),n=(c.civico||'').trim();if(v||n)return(v+(n?' '+n:'')).trim();return(c.indirizzo||'').trim()}
function residenzaLabel(c){return c.residenzaTipo==='domiciliato'?'Domiciliato':c.residenzaTipo==='residente'?'Residente':''}
function contattoFromChiamata(ch){const nm=String(ch.nome||'').trim().split(/\s+/);return{id:Date.now()+Math.floor(Math.random()*999),nome:nm[0]||ch.nome||'(senza nome)',cognome:nm.slice(1).join(' ')||'',telefono:ch.telefono||'',email:'',citta:ch.citta||'Piacenza',zona:ch.zona||'',via:splitIndirizzo(ch.indirizzo).via,civico:splitIndirizzo(ch.indirizzo).civico,indirizzo:ch.indirizzo||'',residenzaTipo:'',indirizzoSpedizione:ch.indirizzo||'',tipo:ch.haImmobile==='cerca'?'acquirente':ch.haImmobile==='vende'?'venditore':'altro',stato:'tiepido',fase:'Nuovo',fonte:ch.fonte||'Pagine Bianche',note:ch.esito||'',dataCreazione:today(),dataPrimoContatto:ch.dataChiamata||(ch.creata?String(ch.creata).slice(0,10):today()),ultimoContatto:ch.dataChiamata||today(),dataRichiamo:ch.dataRichiamo||'',collaborativo:'',presentazioneInviata:ch.dispPresentazione==='si'?'si':'no',dataPresentazione:ch.dispPresentazione==='si'?(ch.dataChiamata||''):'',presentazioneModo:'',chiamataId:ch.id}}
function importaChiamateInContatti(){const ex={};(DB.clienti||[]).forEach(c=>{const k=telKey(c.telefono);if(k)ex[k]=true});let n=0;(DB.chiamate||[]).forEach(ch=>{const k=telKey(ch.telefono);if(k&&ex[k])return;if(!ch.nome&&!ch.telefono)return;const c=contattoFromChiamata(ch);c.id=Date.now()+n;DB.clienti.push(c);if(k)ex[k]=true;n++});save();render();updateBadges();showToast(n?('✅ '+n+' persone da Pagine Bianche / strada aggiunte ai Contatti'):'Nessuna nuova persona da importare (già in rubrica o lista vuota)','info')}
function collabChip(c){const v=c.collaborativo||'';if(v==='si')return'<span class="badge badge-green">collaborativo</span>';if(v==='forse')return'<span class="badge badge-orange">forse</span>';if(v==='no')return'<span class="badge badge-red">non coll.</span>';return'<span class="badge badge-gray">—</span>'}
function presChip(c){if(c.presentazioneInviata==='si')return`<span class="badge badge-green">📬 ${c.dataPresentazione?fmtDateShort(c.dataPresentazione):'inviata'}</span>`;return'<span class="badge badge-gray">📬 no</span>'}
function richiamoCell(c){if(!c.dataRichiamo)return'<span class="text-muted">—</span>';const o=today();const late=c.dataRichiamo<o&&c.stato!=='chiuso';return`<span class="${late?'text-red':'text-gold'}" style="font-weight:600">${late?'⏰ ':''}${fmtDateShort(c.dataRichiamo)}</span>`}
function renderContatti(c){const f=_contF;const ric=(f.ricerca||'').toLowerCase();const o=today();
let lista=(DB.clienti||[]).filter(x=>{
if(f.tipo&&x.tipo!==f.tipo)return false;
if(f.stato&&x.stato!==f.stato)return false;
if(f.fonte&&x.fonte!==f.fonte)return false;
if(f.collab&&(x.collaborativo||'')!==f.collab)return false;
if(f.pres==='si'&&x.presentazioneInviata!=='si')return false;
if(f.pres==='no'&&x.presentazioneInviata==='si')return false;
if(f.quick==='richiamo'&&!(x.dataRichiamo&&x.dataRichiamo<=o&&x.stato!=='chiuso'))return false;
if(f.quick==='oggi'&&x.dataRichiamo!==o)return false;
if(f.quick==='pres-manca'&&x.presentazioneInviata==='si')return false;
if(f.quick==='collab'&&x.collaborativo!=='si')return false;
if(f.quick==='pb'&&x.fonte!=='Pagine Bianche')return false;
if(f.quick==='strada'&&x.fonte!=='Per strada')return false;
if(ric&&!(`${x.nome} ${x.cognome} ${x.telefono} ${x.via||''} ${x.civico||''} ${x.indirizzo||''} ${x.citta||''}`.toLowerCase().includes(ric)))return false;
return true;
}).sort((a,b)=>{
const ar=a.dataRichiamo||'9',br=b.dataRichiamo||'9';
if(ar!==br)return ar.localeCompare(br);
return calcolaLeadScore(b)-calcolaLeadScore(a);
});
const tot=(DB.clienti||[]).length;
const nRich=(DB.clienti||[]).filter(x=>x.dataRichiamo&&x.dataRichiamo<=o&&x.stato!=='chiuso').length;
const nPres=(DB.clienti||[]).filter(x=>x.presentazioneInviata==='si').length;
const nColl=(DB.clienti||[]).filter(x=>x.collaborativo==='si').length;
const nPb=(DB.clienti||[]).filter(x=>x.fonte==='Pagine Bianche'||x.fonte==='Per strada'||x.fonte==='Al bar').length;
const qBtn=(id,lab)=>`<button class="btn ${f.quick===id?'btn-primary':'btn-ghost'} btn-xs" onclick="_contF.quick=_contF.quick==='${id}'?'':'${id}';renderContatti(document.getElementById('content'))">${lab}</button>`;
c.innerHTML=`<div class="stack">
<div class="grid4">
<div class="stat-box"><div class="stat-num">${tot}</div><div class="stat-lbl">in rubrica</div></div>
<div class="stat-box"><div class="stat-num" style="color:${nRich?'var(--red)':'var(--green)'}">${nRich}</div><div class="stat-lbl">da richiamare</div></div>
<div class="stat-box"><div class="stat-num">${nPres}</div><div class="stat-lbl">presentazione inviata</div></div>
<div class="stat-box"><div class="stat-num">${nColl}</div><div class="stat-lbl">collaborativi</div></div></div>
<div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
<div class="search-bar">🔍 <input value="${esc(f.ricerca)}" placeholder="Cerca nome, tel, indirizzo…" oninput="_contF.ricerca=this.value;renderContatti(document.getElementById('content'))"></div>
<select class="inp" style="width:auto" onchange="_contF.tipo=this.value;renderContatti(document.getElementById('content'))"><option value="">Tutti i tipi</option>${TIPO_CONTATTO.map(x=>`<option value="${x}" ${f.tipo===x?'selected':''}>${ucfirst(x)}</option>`).join('')}</select>
<select class="inp" style="width:auto" onchange="_contF.fonte=this.value;renderContatti(document.getElementById('content'))"><option value="">Tutte le fonti</option>${FONTE_LEAD.map(x=>`<option ${f.fonte===x?'selected':''}>${x}</option>`).join('')}</select>
<select class="inp" style="width:auto" onchange="_contF.stato=this.value;renderContatti(document.getElementById('content'))"><option value="">Tutti gli stati</option>${['freddo','tiepido','caldo','chiuso'].map(s=>`<option value="${s}" ${f.stato===s?'selected':''}>${s}</option>`).join('')}</select>
<button class="btn btn-gold" onclick="importaChiamateInContatti()">📥 Da Pagine Bianche / strada</button>
<button class="btn btn-primary" onclick="openContattoModal()">+ Nuovo</button></div>
<div class="row" style="gap:6px;flex-wrap:wrap">${qBtn('richiamo','⏰ Da richiamare')} ${qBtn('pres-manca','📬 Senza presentazione')} ${qBtn('collab','✅ Collaborativi')} ${qBtn('pb','📒 Pagine Bianche')} ${qBtn('strada','🚶 Per strada')}<span class="text-muted text-sm" style="margin-left:auto">${nPb} da PB/strada/bar · ${lista.length} visibili</span></div>
<div class="card">${lista.length===0?'<div class="empty-state"><div class="icon">👥</div>Nessun contatto. Aggiungine uno o importa da Chiamate (Pagine Bianche / strada).</div>':`<div class="table-wrap"><table class="table"><thead><tr><th>Contatto</th><th>Tel</th><th>Fonte</th><th>Primo contatto</th><th>Richiamo</th><th>Collab.</th><th>Presentaz.</th><th></th></tr></thead><tbody>${lista.map(x=>`<tr class="row-clickable" onclick="openContattoModal(${x.id})"><td><b>${esc(x.nome)} ${esc(x.cognome||'')}</b><div style="font-size:10px;color:var(--text2)">${esc(fmtIndirizzo(x)||'')}${fmtIndirizzo(x)&&x.citta?' · ':''}${esc(x.citta||'')}${residenzaLabel(x)?' · '+residenzaLabel(x):''}</div></td><td style="font-size:12px">${esc(x.telefono||'—')}</td><td><span class="badge badge-gray">${esc(x.fonte||'—')}</span></td><td style="font-size:11px">${x.dataPrimoContatto?fmtDateShort(x.dataPrimoContatto):'—'}</td><td>${richiamoCell(x)}</td><td>${collabChip(x)}</td><td>${presChip(x)}</td><td onclick="event.stopPropagation()"><div class="row-tight">${x.telefono?`<button class="btn btn-ghost btn-xs" onclick="window.open('tel:${waNumber(x.telefono)}','_self')">📞</button><button class="btn btn-gold btn-xs" onclick="whatsappCliente(${x.id})">💬</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`}</div></div>`}
function openContattoModal(id){const ct=id?(DB.clienti||[]).find(x=>String(x.id)===String(id)):{};
const events=id?(DB.eventi||[]).filter(e=>String(e.contattoId)===String(id)).sort((a,b)=>new Date(b.data)-new Date(a.data)):[];
const overdue=ct.dataRichiamo&&ct.dataRichiamo<today()&&ct.stato!=='chiuso';
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-lg" onclick="event.stopPropagation()"><h2>${id?'👤 '+esc((ct.nome||'')+' '+(ct.cognome||'')):'➕ Nuovo contatto'}</h2>
${overdue?`<div class="alert red" style="margin-bottom:12px">⏰ Promemoria scaduto il ${fmtDate(ct.dataRichiamo)} — ricontattalo.</div>`:''}
<div class="form-row-3">
<div class="form-group"><label class="form-label">Nome *</label><input id="ct-nome" class="inp" value="${esc(ct.nome||'')}"></div>
<div class="form-group"><label class="form-label">Cognome</label><input id="ct-cognome" class="inp" value="${esc(ct.cognome||'')}"></div>
<div class="form-group"><label class="form-label">Tipo</label><select id="ct-tipo" class="inp" onchange="document.getElementById('ct-acq').style.display=this.value==='acquirente'?'block':'none'">${TIPO_CONTATTO.map(x=>`<option value="${x}" ${ct.tipo===x?'selected':''}>${ucfirst(x)}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Telefono</label><input id="ct-tel" class="inp" value="${esc(ct.telefono||'')}"></div>
<div class="form-group"><label class="form-label">Email</label><input id="ct-email" class="inp" value="${esc(ct.email||'')}"></div>
<div class="form-group"><label class="form-label">Città</label><input id="ct-citta" class="inp" value="${esc(ct.citta||'Piacenza')}"></div>
<div class="form-group"><label class="form-label">Via</label><input id="ct-via" class="inp" value="${esc(ct.via||splitIndirizzo(ct.indirizzo).via)}" placeholder="es. Via Roma"></div>
<div class="form-group"><label class="form-label">N. civico</label><input id="ct-civ" class="inp" value="${esc(ct.civico||splitIndirizzo(ct.indirizzo).civico)}" placeholder="es. 12"></div>
<div class="form-group"><label class="form-label">Residente / Domiciliato</label><select id="ct-res" class="inp"><option value="" ${!ct.residenzaTipo?'selected':''}>—</option><option value="residente" ${ct.residenzaTipo==='residente'?'selected':''}>🏠 Residente</option><option value="domiciliato" ${ct.residenzaTipo==='domiciliato'?'selected':''}>📫 Domiciliato</option></select></div>
<div class="form-group"><label class="form-label">Zona</label><input id="ct-zona" class="inp" value="${esc(ct.zona||'')}"></div>
<div class="form-group"><label class="form-label">Stato</label><select id="ct-stato" class="inp">${['freddo','tiepido','caldo','chiuso'].map(s=>`<option value="${s}" ${ct.stato===s?'selected':''}>${s}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Fonte</label><select id="ct-fonte" class="inp">${FONTE_LEAD.map(x=>`<option ${ct.fonte===x?'selected':''}>${x}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Collaborativo?</label><select id="ct-collab" class="inp">${COLLAB_OPT.map(x=>`<option value="${x[0]}" ${(ct.collaborativo||'')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Budget €</label><input id="ct-budget" type="number" class="inp" value="${ct.budget||''}"></div>
<div class="form-group"><label class="form-label">Data primo contatto</label><input id="ct-primo" type="date" class="inp" value="${ct.dataPrimoContatto||ct.dataCreazione||today()}"></div>
<div class="form-group"><label class="form-label">Promemoria prossimo contatto</label><input id="ct-rich" type="date" class="inp" value="${ct.dataRichiamo||''}"></div>
<div class="form-group"><label class="form-label">Ultimo contatto</label><input id="ct-ult" type="date" class="inp" value="${ct.ultimoContatto||''}"></div></div>
<div style="margin-top:14px;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:10px">
<div class="card-title" style="margin-bottom:10px">📬 Presentazione inviata</div>
<div class="form-row-3">
<div class="form-group"><label class="form-label">Inviata?</label><select id="ct-pres" class="inp"><option value="no" ${ct.presentazioneInviata!=='si'?'selected':''}>No</option><option value="si" ${ct.presentazioneInviata==='si'?'selected':''}>Sì</option></select></div>
<div class="form-group"><label class="form-label">Data invio</label><input id="ct-presdata" type="date" class="inp" value="${ct.dataPresentazione||''}"></div>
<div class="form-group"><label class="form-label">Come</label><select id="ct-presmodo" class="inp">${PRES_MODO.map(x=>`<option value="${x}" ${(ct.presentazioneModo||'')===x?'selected':''}>${x||'—'}</option>`).join('')}</select></div>
<div class="form-group" style="grid-column:1/-1"><label class="form-label">Indirizzo di spedizione</label><input id="ct-sped" class="inp" value="${esc(ct.indirizzoSpedizione||fmtIndirizzo(ct)||'')}" placeholder="Se diversa da via/civico"></div></div>
${id?`<div class="row" style="margin-top:8px"><button class="btn btn-gold btn-sm" onclick="segnaPresentazione(${id})">📬 Segna inviata oggi</button></div>`:''}
</div>
<div id="ct-acq" style="display:${ct.tipo==='acquirente'?'block':'none'};margin-top:12px;padding:12px;background:var(--bg2);border-radius:10px"><div class="card-title" style="margin-bottom:8px">🎯 Ricerca acquirente</div>
<div class="form-row-3"><div class="form-group"><label class="form-label">Budget min</label><input id="ct-bmin" type="number" class="inp" value="${ct.budgetMin||''}"></div><div class="form-group"><label class="form-label">Budget max</label><input id="ct-bmax" type="number" class="inp" value="${ct.budgetMax||''}"></div><div class="form-group"><label class="form-label">Comune</label><input id="ct-com" class="inp" value="${esc(ct.comuneDesiderato||'')}"></div><div class="form-group"><label class="form-label">Zona</label><input id="ct-zon" class="inp" value="${esc(ct.zonaDesiderata||'')}"></div><div class="form-group"><label class="form-label">Tipologia</label><select id="ct-tip" class="inp"><option value="">—</option>${TIPO_IMM.map(x=>`<option value="${x}" ${ct.tipologiaDesiderata===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Locali min</label><input id="ct-loc" type="number" class="inp" value="${ct.localiMin||''}"></div></div></div>
<div class="form-group" style="margin-top:10px"><label class="form-label">Note</label><textarea id="ct-note" class="inp" rows="2">${esc(ct.note||'')}</textarea></div>
${id?`<div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px"><div class="card-title" style="margin-bottom:8px">📜 Timeline</div>
<div style="max-height:220px;overflow-y:auto;background:var(--bg2);border-radius:10px;padding:8px">${events.length?events.map(e=>`<div style="display:flex;gap:8px;padding:8px;border-radius:8px;margin-bottom:4px;background:var(--bg3)"><div style="font-size:16px">${e.tipo==='chiamata'?'📞':e.tipo==='email'?'📧':e.tipo==='whatsapp'?'💬':e.tipo==='visita'?'🏠':'📝'}</div><div style="flex:1"><div style="font-size:12px;font-weight:600">${esc(e.titolo||e.tipo)}</div><div style="font-size:10px;color:var(--text2)">${fmtDate(e.data)}</div></div><button class="btn btn-ghost btn-icon btn-xs" onclick="deleteEvento('${e.id}',${id})">✕</button></div>`).join(''):'<div class="empty-state text-sm">Nessun evento.</div>'}</div>
<div class="row" style="margin-top:8px;gap:5px;flex-wrap:wrap"><button class="btn btn-ghost btn-xs" onclick="logRapido(${id},'chiamata')">📞 Log chiamata</button><button class="btn btn-ghost btn-xs" onclick="logRapido(${id},'whatsapp')">💬 Log WA</button><button class="btn btn-ghost btn-xs" onclick="logRapido(${id},'visita')">🏠 Log visita</button><button class="btn btn-gold btn-xs" onclick="whatsappCliente(${id})">💬 WhatsApp</button></div></div>`:''}
<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button>${id?`<button class="btn btn-danger" onclick="deleteContatto(${id})">Elimina</button>`:''}<button class="btn btn-primary" onclick="saveContatto(${id||0})">${id?'Salva':'Crea'}</button></div></div></div>`)}
function segnaPresentazione(id){const c=(DB.clienti||[]).find(x=>String(x.id)===String(id));if(!c)return;c.presentazioneInviata='si';c.dataPresentazione=today();if(!c.presentazioneModo)c.presentazioneModo='di persona';if(!c.indirizzoSpedizione)c.indirizzoSpedizione=c.indirizzo||'';c.ultimoContatto=today();save();closeModal();showToast('📬 Presentazione segnata come inviata');openContattoModal(id)}
function saveContatto(id){const g=v=>{const el=document.getElementById(v);return el?el.value:''};
const d={nome:g('ct-nome').trim(),cognome:g('ct-cognome').trim(),telefono:g('ct-tel').trim(),email:g('ct-email').trim(),citta:g('ct-citta').trim(),via:g('ct-via').trim(),civico:g('ct-civ').trim(),residenzaTipo:g('ct-res'),indirizzo:(g('ct-via').trim()+' '+g('ct-civ').trim()).trim()||g('ct-sped').trim(),zona:g('ct-zona').trim(),tipo:g('ct-tipo'),stato:g('ct-stato'),fonte:g('ct-fonte'),collaborativo:g('ct-collab'),budget:parseInt(g('ct-budget'))||0,note:g('ct-note').trim(),dataPrimoContatto:g('ct-primo')||today(),dataRichiamo:g('ct-rich'),ultimoContatto:g('ct-ult')||today(),presentazioneInviata:g('ct-pres')||'no',dataPresentazione:g('ct-presdata'),presentazioneModo:g('ct-presmodo'),indirizzoSpedizione:g('ct-sped').trim()};
if(d.tipo==='acquirente'){d.budgetMin=parseInt(document.getElementById('ct-bmin')?.value)||0;d.budgetMax=parseInt(document.getElementById('ct-bmax')?.value)||0;d.comuneDesiderato=document.getElementById('ct-com')?.value.trim()||'';d.zonaDesiderata=document.getElementById('ct-zon')?.value.trim()||'';d.tipologiaDesiderata=document.getElementById('ct-tip')?.value||'';d.localiMin=parseInt(document.getElementById('ct-loc')?.value)||0}
if(!d.nome){showToast('Nome obbligatorio','error');return}
if(id){const i=(DB.clienti||[]).findIndex(x=>String(x.id)===String(id));if(i>=0)DB.clienti[i]={...DB.clienti[i],...d};showToast('Aggiornato ✓')}
else{d.id=Date.now();d.fase='Nuovo';d.dataCreazione=today();if(!d.ultimoContatto)d.ultimoContatto=today();DB.clienti.push(d);showToast('Creato ✓')}
save();closeModal();render();updateBadges()}
function deleteContatto(id){if(!confirm('Eliminare contatto?'))return;DB.clienti=DB.clienti.filter(x=>String(x.id)!==String(id));save();closeModal();render();updateBadges()}
function whatsappCliente(id){const c=(DB.clienti||[]).find(x=>String(x.id)===String(id));if(!c||!c.telefono){showToast('Nessun numero','warn');return}
const tpls=(DB.settings.waTemplates||[]);const tpl=tpls.find(x=>x.nome==='Presentazione'&&c.presentazioneInviata!=='si')||tpls[0];const s=DB.settings||{};
const testo=tpl?tpl.testo.replace(/\{nome\}/g,c.nome||'').replace(/\{agente\}/g,s.agente||'').replace(/\{agenzia\}/g,s.agenziaNome||''):'Ciao '+c.nome+'!';
window.open('https://wa.me/'+waNumber(c.telefono)+'?text='+encodeURIComponent(testo),'_blank');c.ultimoContatto=today();save()}
/* IMMOBILI */
function renderImmobili(c){const f=_immF;const ric=f.ricerca.toLowerCase();
const lista=(DB.immobili||[]).filter(i=>(!f.tipo||i.tipo===f.tipo)&&(!f.stato||i.stato===f.stato)&&(!ric||(`${i.titolo} ${i.codice} ${i.zona}`.toLowerCase().includes(ric)))).sort((a,b)=>calcolaISV(b).punti-calcolaISV(a).punti);
c.innerHTML=`<div class="stack">
<div class="row"><div class="search-bar">🔍 <input value="${esc(f.ricerca)}" placeholder="Cerca…" oninput="_immF.ricerca=this.value;renderImmobili(document.getElementById('content'))"></div>
<select class="inp" style="width:auto" onchange="_immF.stato=this.value;renderImmobili(document.getElementById('content'))"><option value="">Tutti gli stati</option>${STATO_IMM.map(s=>`<option value="${s}" ${f.stato===s?'selected':''}>${s}</option>`).join('')}</select>
<button class="btn btn-primary" onclick="openImmobileModal()">+ Nuovo</button></div>
<div class="imm-grid">${lista.length===0?'<div class="empty-state" style="grid-column:1/-1"><div class="icon">🏠</div>Nessun immobile.</div>':lista.map(i=>`<div class="imm-card" onclick="openImmobileModal(${i.id})"><div class="imm-foto">${tipoIco[i.tipo]||'🏠'}<div class="imm-foto-overlay"><span class="badge badge-gray">${i.operazione||'vendita'}</span>${isvChip(i)}</div></div><div style="padding:13px"><b>${esc(i.titolo)}</b><div style="font-size:10px;color:var(--text2)">${esc(i.zona||'')} · ${esc(i.citta||'')}</div><div style="font-size:20px;font-weight:700;color:var(--primary);margin-top:6px">${fmtEuroShort(i.prezzo)}</div><div style="font-size:10px;color:var(--text2);margin-top:4px">${i.superficie?'📐 '+i.superficie+'mq':''}${i.locali?' · 🚪 '+i.locali:''}</div></div></div>`).join('')}</div></div>`}
function openImmobileModal(id){const i=id?(DB.immobili||[]).find(x=>String(x.id)===String(id)):{};currentImmId=id||null;
const prop=(DB.clienti||[]).filter(c=>c.tipo==='venditore'||c.tipo==='locatore');
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-lg" onclick="event.stopPropagation()"><h2>${id?'🏠 '+esc(i.titolo||''):'🏠 Nuovo immobile'}</h2>
<div class="form-row-3">
<div class="form-group"><label class="form-label">Codice</label><input id="im-cod" class="inp" value="${esc(i.codice||'')}"></div>
<div class="form-group"><label class="form-label">Titolo *</label><input id="im-tit" class="inp" value="${esc(i.titolo||'')}"></div>
<div class="form-group"><label class="form-label">Tipo</label><select id="im-tipo" class="inp">${TIPO_IMM.map(t=>`<option value="${t}" ${i.tipo===t?'selected':''}>${t}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Prezzo *</label><input id="im-prezzo" type="number" class="inp" value="${i.prezzo||''}"></div>
<div class="form-group"><label class="form-label">Prezzo iniziale</label><input id="im-prezzoin" type="number" class="inp" value="${i.prezzoIniziale||''}"></div>
<div class="form-group"><label class="form-label">Mq</label><input id="im-mq" type="number" class="inp" value="${i.superficie||''}"></div>
<div class="form-group"><label class="form-label">Locali</label><input id="im-loc" type="number" class="inp" value="${i.locali||''}"></div>
<div class="form-group"><label class="form-label">Bagni</label><input id="im-bag" type="number" class="inp" value="${i.bagni||''}"></div>
<div class="form-group"><label class="form-label">Stato</label><select id="im-stato" class="inp">${STATO_IMM.map(s=>`<option value="${s}" ${i.stato===s?'selected':''}>${s}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Fonte</label><select id="im-fonte" class="inp"><option value="Privato" ${i.fonte==='Privato'?'selected':''}>👤 Privato</option><option value="Altro" ${i.fonte==='Altro'?'selected':''}>🏢 Altro</option></select></div>
<div class="form-group"><label class="form-label">Città *</label><input id="im-citta" class="inp" value="${esc(i.citta||'Piacenza')}"></div>
<div class="form-group"><label class="form-label">Zona</label><input id="im-zona" class="inp" value="${esc(i.zona||'')}"></div>
<div class="form-group"><label class="form-label">Proprietario</label><select id="im-prop" class="inp"><option value="">—</option>${prop.map(p=>`<option value="${p.id}" ${String(i.proprietarioId)===String(p.id)?'selected':''}>${esc(p.nome+' '+p.cognome)}</option>`).join('')}</select></div></div>
<div class="form-group" style="margin-top:10px"><label class="form-label">Descrizione</label><textarea id="im-desc" class="inp" rows="2">${esc(i.descrizione||'')}</textarea></div>
${id?`<div class="row" style="margin-top:12px;gap:6px"><button class="btn btn-ghost btn-sm" onclick="tabImm('match')">🎯 Match (${matchAcquirentiPerImmobile(i).length})</button><button class="btn btn-ghost btn-sm" onclick="tabImm('omi')">🔬 Valutazione OMI</button><button class="btn btn-ghost btn-sm" onclick="tabImm('storico')">📊 Storico</button></div><div id="im-tab" style="margin-top:10px"></div>`:''}
<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button>${id?`<button class="btn btn-danger" onclick="deleteImmobile(${id})">Elimina</button>`:''}<button class="btn btn-primary" onclick="saveImmobile(${id||0})">${id?'Salva':'Crea'}</button></div></div></div>`)}
function tabImm(t){const i=(DB.immobili||[]).find(x=>String(x.id)===String(currentImmId));if(!i)return;const el=document.getElementById('im-tab');if(!el)return;
if(t==='match'){const m=matchAcquirentiPerImmobile(i);el.innerHTML=m.length?m.slice(0,8).map(x=>`<div class="row" style="padding:8px 0;border-bottom:1px solid var(--bg4)"><div style="flex:1"><b>${esc(x.c.nome)} ${esc(x.c.cognome)}</b><div style="font-size:10px;color:var(--text2)">budget ${fmtEuroShort(x.c.budgetMax||x.c.budget)}</div></div><span class="badge badge-green">${x.score}</span><button class="btn btn-gold btn-xs" onclick="whatsappCliente(${x.c.id})">💬</button></div>`).join(''):'<div class="empty-state text-sm">Nessun match.</div>'}
else if(t==='omi'){const z=getZonaInfo(i);if(!z||!i.superficie){el.innerHTML='<div class="empty-state text-sm">Servono zona OMI e mq.</div>';return}const mid=z.mqMid*i.superficie;const diff=((i.prezzo-mid)/mid)*100;el.innerHTML=`<div class="grid3"><div class="stat-box"><div class="stat-num">${fmtEuroShort(mid)}</div><div class="stat-lbl">valore OMI</div></div><div class="stat-box"><div class="stat-num">${fmtEuroShort(i.prezzo)}</div><div class="stat-lbl">prezzo attuale</div></div><div class="stat-box"><div class="stat-num" style="color:${diff>5?'var(--red)':diff<-5?'var(--green)':'var(--primary)'}">${diff>0?'+':''}${diff.toFixed(1)}%</div><div class="stat-lbl">scarto</div></div></div>`}
else{el.innerHTML=(i.storicoPrezzi||[]).length?`<div class="table-wrap"><table class="table"><tbody>${i.storicoPrezzi.map(s=>`<tr><td>${fmtDate(s.data)}</td><td>${fmtEuroShort(s.prezzo)}</td><td>${s.deltaPct?s.deltaPct+'%':'—'}</td><td>${esc(s.evento||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state text-sm">Nessuno storico.</div>'}}
function saveImmobile(id){const g=v=>document.getElementById(v).value;
const old=id?(DB.immobili||[]).find(x=>String(x.id)===String(id)):null;
const d={codice:g('im-cod').trim()||('PC-'+Date.now().toString().slice(-6)),titolo:g('im-tit').trim(),tipo:g('im-tipo'),prezzo:parseFloat(g('im-prezzo'))||0,prezzoIniziale:parseFloat(g('im-prezzoin'))||parseFloat(g('im-prezzo'))||0,superficie:parseFloat(g('im-mq'))||0,locali:parseInt(g('im-loc'))||0,bagni:parseInt(g('im-bag'))||0,stato:g('im-stato'),fonte:g('im-fonte'),citta:g('im-citta').trim(),zona:g('im-zona').trim(),proprietarioId:parseInt(g('im-prop'))||null,descrizione:g('im-desc').trim(),operazione:'vendita'};
if(!d.titolo||!d.prezzo||!d.citta){showToast('Titolo, prezzo, città obbligatori','error');return}
if(id&&old){if(old.prezzo>0&&d.prezzo<old.prezzo){d.storicoPrezzi=old.storicoPrezzi||[];d.storicoPrezzi.push({data:today(),prezzo:d.prezzo,deltaPct:Math.round((d.prezzo-old.prezzo)/old.prezzo*1000)/10,evento:'Ribasso'})}else d.storicoPrezzi=old.storicoPrezzi||[];DB.immobili[DB.immobili.findIndex(x=>String(x.id)===String(id))]={...old,...d};showToast('Aggiornato ✓')}
else{d.id=Date.now();d.dataInserimento=today();d.data_pubblicazione=today();d.visite=0;d.storicoPrezzi=[{data:today(),prezzo:d.prezzo,deltaPct:0,evento:'Inserimento'}];DB.immobili.push(d);showToast('Creato ✓')}
save();closeModal();render()}
function deleteImmobile(id){if(!confirm('Eliminare?'))return;DB.immobili=DB.immobili.filter(x=>String(x.id)!==String(id));save();closeModal();render()}
/* MANDATI */
function renderMandati(c){const ms=(DB.mandati||[]).slice().sort((a,b)=>(b.dataFirma||'').localeCompare(a.dataFirma||''));const att=ms.filter(m=>m.stato!=='annullato'&&m.stato!=='risolto').length;
c.innerHTML=`<div class="stack"><div class="card"><div class="row" style="justify-content:space-between"><div><div class="card-title" style="font-size:17px">✍️ Mandati di vendita</div><div class="card-subtitle">Firma digitale · paletto ${(DB.obiettivi&&DB.obiettivi.incarichiSettimana)||1}/sett</div></div><div class="row-tight"><span class="badge badge-green">${att} attivi</span><button class="btn btn-primary" onclick="openMandatoModal()">+ Nuovo</button></div></div></div>
${ms.length===0?'<div class="card"><div class="empty-state"><div class="icon">✍️</div>Nessun mandato.</div></div>':`<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Venditore</th><th>Immobile</th><th>Tipo</th><th>Prezzo</th><th>Firma</th><th>Stato</th><th></th></tr></thead><tbody>${ms.map(m=>`<tr><td><b>${esc(m.nomeVenditore||'—')}</b></td><td style="font-size:12px">${esc(m.immobileNome||'—')}</td><td><span class="badge ${m.tipo==='esclusivo'?'badge-gold':'badge-gray'}">${m.tipo||''}</span></td><td>${fmtEuroShort(m.prezzo)}</td><td>${m.firma?'<span class="badge badge-green">✓</span>':'<span class="badge badge-red">✗</span>'}</td><td>${esc(m.stato||'attivo')}</td><td><div class="row-tight"><button class="btn btn-ghost btn-xs" onclick="openMandatoModal('${m.id}')">✏️</button>${m.firma?`<button class="btn btn-ghost btn-xs" onclick="stampaMandato('${m.id}')">🖨️</button>`:''}<button class="btn btn-ghost btn-xs" onclick="deleteMandato('${m.id}')">✕</button></div></td></tr>`).join('')}</tbody></table></div></div>`}</div>`}
function openMandatoModal(id){const m=id?(DB.mandati||[]).find(x=>String(x.id)===String(id)):{};const vend=(DB.clienti||[]).filter(x=>x.tipo==='venditore'||x.tipo==='locatore');
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-lg" onclick="event.stopPropagation()"><h2>${id?'✏️ Mandato':'✍️ Nuovo mandato'}</h2>
<div class="form-row">
<div class="form-group"><label class="form-label">Venditore</label><select id="md-vend" class="inp"><option value="">—</option>${vend.map(v=>`<option value="${v.id}" ${String(m.venditoreId)===String(v.id)?'selected':''}>${esc(v.nome+' '+v.cognome)}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Immobile (nome)</label><input id="md-imm" class="inp" value="${esc(m.immobileNome||'')}"></div>
<div class="form-group"><label class="form-label">Tipo</label><select id="md-tipo" class="inp"><option value="esclusivo" ${m.tipo==='esclusivo'?'selected':''}>🔒 Esclusivo</option><option value="non-esclusivo" ${m.tipo==='non-esclusivo'?'selected':''}>🔓 Non esclusivo</option></select></div>
<div class="form-group"><label class="form-label">Stato</label><select id="md-stato" class="inp"><option value="attivo" ${(m.stato||'attivo')==='attivo'?'selected':''}>attivo</option><option value="risolto" ${m.stato==='risolto'?'selected':''}>risolto</option><option value="annullato" ${m.stato==='annullato'?'selected':''}>annullato</option></select></div>
<div class="form-group"><label class="form-label">Data firma</label><input id="md-data" type="date" class="inp" value="${m.dataFirma||today()}"></div>
<div class="form-group"><label class="form-label">Prezzo €</label><input id="md-prezzo" type="number" class="inp" value="${m.prezzo||''}"></div>
<div class="form-group"><label class="form-label">Provvigione %</label><input id="md-provv" type="number" step="0.1" class="inp" value="${m.provvigione||3}"></div></div>
<div class="form-group" style="margin-top:12px"><label class="form-label">🖊️ Firma del venditore (disegna)</label><canvas id="firma-pad" class="sig-canvas"></canvas><div class="row" style="margin-top:6px"><button class="btn btn-ghost btn-sm" onclick="clearFirma()">🧹 Cancella</button>${m.firma?'<span class="badge badge-green">firma precedente conservata</span>':''}</div></div>
<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveMandato('${id||''}')">Salva</button></div></div></div>`);
window._firmaDrawn=false;setTimeout(initFirmaPad,80)}
function initFirmaPad(){const cv=document.getElementById('firma-pad');if(!cv)return;const ctx=cv.getContext('2d');cv.width=cv.offsetWidth||560;cv.height=140;ctx.strokeStyle='#1a1d27';ctx.lineWidth=2.2;ctx.lineCap='round';let d=false;
const pos=e=>{const r=cv.getBoundingClientRect();const p=e.touches?e.touches[0]:e;return{x:p.clientX-r.left,y:p.clientY-r.top}};
cv.addEventListener('mousedown',e=>{d=true;ctx.beginPath();const p=pos(e);ctx.moveTo(p.x,p.y)});
cv.addEventListener('mousemove',e=>{if(!d)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();window._firmaDrawn=true});
window.addEventListener('mouseup',()=>d=false);
cv.addEventListener('touchstart',e=>{d=true;ctx.beginPath();const p=pos(e);ctx.moveTo(p.x,p.y);e.preventDefault()},{passive:false});
cv.addEventListener('touchmove',e=>{if(!d)return;const p=pos(e);ctx.lineTo(p.x,p.y);ctx.stroke();window._firmaDrawn=true;e.preventDefault()},{passive:false});
cv.addEventListener('touchend',()=>d=false)}
function clearFirma(){const cv=document.getElementById('firma-pad');if(cv)cv.getContext('2d').clearRect(0,0,cv.width,cv.height);window._firmaDrawn=false}
function saveMandato(id){const g=v=>document.getElementById(v).value;const vend=(DB.clienti||[]).find(x=>String(x.id)===String(g('md-vend')));
const d={venditoreId:parseInt(g('md-vend'))||null,nomeVenditore:vend?vend.nome+' '+vend.cognome:'',immobileNome:g('md-imm').trim(),tipo:g('md-tipo'),stato:g('md-stato'),dataFirma:g('md-data')||today(),dataInizio:g('md-data')||today(),prezzo:parseFloat(g('md-prezzo'))||0,provvigione:parseFloat(g('md-provv'))||3};
const cv=document.getElementById('firma-pad');
if(id){const o=(DB.mandati||[]).find(x=>String(x.id)===String(id));if(o){if(window._firmaDrawn&&cv)o.firma=cv.toDataURL();Object.assign(o,d)}showToast('Aggiornato ✓')}
else{d.id='md'+Date.now();if(window._firmaDrawn&&cv)d.firma=cv.toDataURL();DB.mandati.push(d);showToast('🎯 Mandato registrato: paletto aggiornato!')}
save();closeModal();render()}
function deleteMandato(id){if(!confirm('Eliminare?'))return;DB.mandati=DB.mandati.filter(x=>String(x.id)!==String(id));save();render()}
function stampaMandato(id){const m=(DB.mandati||[]).find(x=>String(x.id)===String(id));if(!m)return;const w=window.open('','_blank');if(!w)return;
w.document.write('<html><head><title>Mandato</title><style>body{font-family:Georgia,serif;padding:36px;max-width:820px;margin:0 auto}h1{border-bottom:3px solid #c9a96e}.firma{max-height:110px;margin-top:30px}</style></head><body><h1>✍️ Mandato di vendita '+esc(m.tipo||'')+'</h1><p><b>Venditore:</b> '+esc(m.nomeVenditore||'')+'<br><b>Immobile:</b> '+esc(m.immobileNome||'')+'<br><b>Prezzo:</b> '+fmtEuro(m.prezzo)+'<br><b>Provvigione:</b> '+(m.provvigione||0)+'%<br><b>Data:</b> '+fmtDate(m.dataFirma)+'</p>'+(m.firma?'<img class="firma" src="'+m.firma+'"><br><small>Firma del venditore</small>':'')+'<script>window.onload=function(){window.print()}<\/script></body></html>');w.document.close()}
/* OPEN HOUSE */
function renderOpenHouse(c){const os=(DB.openhouses||[]).slice().sort((a,b)=>(b.data||'').localeCompare(a.data||''));
c.innerHTML=`<div class="stack"><div class="card"><div class="row" style="justify-content:space-between"><div><div class="card-title" style="font-size:17px">🏡 Open House</div><div class="card-subtitle">Eventi + registro visitatori → lead</div></div><button class="btn btn-primary" onclick="openOpenHouseModal()">+ Nuovo</button></div></div>
${os.length===0?'<div class="card"><div class="empty-state"><div class="icon">🏡</div>Nessun open house.</div></div>':`<div class="grid2">${os.map(o=>{const im=(DB.immobili||[]).find(i=>String(i.id)===String(o.immobileId));return`<div class="card" style="cursor:pointer" onclick="openOpenHouseModal('${o.id}')"><div class="row" style="justify-content:space-between"><div><b>${esc(o.titolo)}</b><div style="font-size:11px;color:var(--text2)">🏠 ${esc(im?im.titolo:'—')}</div><div style="font-size:11px;color:var(--text2)">📅 ${fmtDate(o.data)}</div></div><div style="text-align:right"><div style="font-size:20px;font-weight:700;color:var(--gold)">${(o.visitatori||[]).length}</div><div style="font-size:9px;color:var(--text2)">visitatori</div></div></div></div>`}).join('')}</div>`}</div>`}
function openOpenHouseModal(id){const o=id?(DB.openhouses||[]).find(x=>String(x.id)===String(id)):{};
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-lg" onclick="event.stopPropagation()"><h2>${id?'✏️ '+esc(o.titolo||''):'🏡 Nuovo Open House'}</h2>
<div class="form-group"><label class="form-label">Titolo *</label><input id="oh-tit" class="inp" value="${esc(o.titolo||'')}"></div>
<div class="form-group"><label class="form-label">Immobile</label><select id="oh-imm" class="inp"><option value="">—</option>${(DB.immobili||[]).map(i=>`<option value="${i.id}" ${String(o.immobileId)===String(i.id)?'selected':''}>${esc(i.titolo)}</option>`).join('')}</select></div>
<div class="form-row-3"><div class="form-group"><label class="form-label">Data *</label><input id="oh-data" type="date" class="inp" value="${o.data||today()}"></div><div class="form-group"><label class="form-label">Inizio</label><input id="oh-in" type="time" class="inp" value="${o.oraInizio||'10:00'}"></div><div class="form-group"><label class="form-label">Fine</label><input id="oh-fine" type="time" class="inp" value="${o.oraFine||'12:00'}"></div></div>
${id?`<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px"><div class="row" style="justify-content:space-between;margin-bottom:8px"><div class="card-title">👥 Visitatori (${(o.visitatori||[]).length})</div><button class="btn btn-ghost btn-xs" onclick="aggVisRow()">+ Aggiungi</button></div><div id="vis-cont">${(o.visitatori||[]).map(visRow).join('')}</div></div>`:''}
<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button>${id?`<button class="btn btn-danger" onclick="deleteOpenHouse('${id}')">Elimina</button>`:''}<button class="btn btn-primary" onclick="saveOpenHouse('${id||''}')">${id?'Salva':'Crea'}</button></div></div></div>`)}
function visRow(v){v=v||{};return`<div class="vis-row" style="display:flex;gap:6px;margin-bottom:6px"><input class="inp vis-nome" style="flex:1" placeholder="Nome" value="${esc(v.nome||'')}"><input class="inp vis-tel" style="flex:1" placeholder="Tel" value="${esc(v.telefono||'')}"><select class="inp vis-rating" style="width:70px"><option value="5" ${v.rating==5?'selected':''}>⭐5</option><option value="4" ${v.rating==4?'selected':''}>⭐4</option><option value="3" ${v.rating==3||!v.rating?'selected':''}>⭐3</option><option value="2" ${v.rating==2?'selected':''}>⭐2</option><option value="1" ${v.rating==1?'selected':''}>⭐1</option></select><button class="btn btn-ghost btn-sm" onclick="this.parentNode.remove()">✕</button></div>`}
function aggVisRow(){document.getElementById('vis-cont').insertAdjacentHTML('beforeend',visRow({}))}
function saveOpenHouse(id){const g=v=>document.getElementById(v).value;const vis=[];document.querySelectorAll('#vis-cont .vis-row').forEach(r=>{const n=r.querySelector('.vis-nome').value.trim(),t=r.querySelector('.vis-tel').value.trim(),rt=parseInt(r.querySelector('.vis-rating').value)||3;if(n||t)vis.push({nome:n,telefono:t,rating:rt})});
const d={titolo:g('oh-tit').trim(),immobileId:parseInt(g('oh-imm'))||null,data:g('oh-data'),oraInizio:g('oh-in'),oraFine:g('oh-fine'),visitatori:vis};
if(!d.titolo||!d.data){showToast('Titolo e data obbligatori','error');return}
if(id){const i=(DB.openhouses||[]).findIndex(x=>String(x.id)===String(id));if(i>=0)DB.openhouses[i]={...DB.openhouses[i],...d};showToast('Aggiornato ✓')}
else{d.id='oh'+Date.now();DB.openhouses.push(d);showToast('Creato ✓')}
save();closeModal();render()}
function deleteOpenHouse(id){if(!confirm('Eliminare?'))return;DB.openhouses=DB.openhouses.filter(x=>String(x.id)!==String(id));save();closeModal();render()}
/* PIPELINE */
function renderPipeline(c){const items=(DB.trattative||[]).slice();
c.innerHTML=`<div class="stack"><div class="row" style="justify-content:space-between"><div style="font-size:11px;color:var(--text2)">${items.length} trattative</div><button class="btn btn-primary" onclick="openTrattativaModal()">+ Nuova</button></div>
<div class="kanban-wrap">${FASI.map(f=>{const fi=items.filter(t=>t.fase===f);return`<div class="kanban-col" data-fase="${f}"><div class="kanban-col-head"><div class="kanban-col-title" style="color:${fasiColor[f]}">${FASI_LABEL[f]}</div><div class="kanban-col-count">${fi.length}</div></div>${fi.length?fi.map(t=>`<div class="kanban-card tr-card" draggable="true" data-tid="${t.id}" style="border-left-color:${fasiColor[f]}"><b style="font-size:12px">${esc(t.immobile||'—')}</b><div style="font-size:10px;color:var(--text2)">${esc(t.acquirente||'—')}</div><div style="font-size:11px;font-weight:600;color:var(--primary);margin-top:4px">${fmtEuroShort(t.prezzoOfferto||0)}</div></div>`).join(''):'<div class="kanban-empty">Nessuna</div>'}</div>`}).join('')}</div></div>`;
c.querySelectorAll('.kanban-col').forEach(col=>{col.addEventListener('dragover',e=>{e.preventDefault();col.style.background='var(--bg3)'});col.addEventListener('dragleave',()=>col.style.background='');col.addEventListener('drop',e=>{e.preventDefault();col.style.background='';const t=(DB.trattative||[]).find(x=>String(x.id)===String(e.dataTransfer.getData('text/plain')));if(t){t.fase=col.dataset.fase;t.ultimaModifica=today();save();render()}})});
c.querySelectorAll('.tr-card').forEach(cd=>{cd.addEventListener('dragstart',e=>e.dataTransfer.setData('text/plain',cd.dataset.tid));cd.addEventListener('click',()=>openTrattativaModal(cd.dataset.tid))})}
function openTrattativaModal(id){const t=id?(DB.trattative||[]).find(x=>String(x.id)===String(id)):{};
const acq=(DB.clienti||[]).filter(c=>c.tipo==='acquirente'||c.tipo==='investitore');const vend=(DB.clienti||[]).filter(c=>c.tipo==='venditore');
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-lg" onclick="event.stopPropagation()"><h2>🤝 Trattativa</h2>
<div class="form-row">
<div class="form-group"><label class="form-label">Acquirente *</label><select id="tr-acq" class="inp"><option value="">—</option>${acq.map(c=>`<option value="${c.id}" ${String(t.acquirenteId)===String(c.id)?'selected':''}>${esc(c.nome+' '+c.cognome)}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Immobile *</label><select id="tr-imm" class="inp"><option value="">—</option>${(DB.immobili||[]).map(i=>`<option value="${i.id}" ${String(t.immobileId)===String(i.id)?'selected':''}>${esc(i.titolo)}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Prezzo offerto €</label><input id="tr-prezzo" type="number" class="inp" value="${t.prezzoOfferto||''}"></div>
<div class="form-group"><label class="form-label">Provvigione %</label><input id="tr-provv" type="number" step="0.1" class="inp" value="${t.provvigione||3}"></div>
<div class="form-group"><label class="form-label">Fase</label><select id="tr-fase" class="inp">${FASI.map(f=>`<option value="${f}" ${(t.fase||'interesse')===f?'selected':''}>${FASI_LABEL[f]}</option>`).join('')}</select></div></div>
<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button>${id?`<button class="btn btn-danger" onclick="deleteTrattativa('${id}')">Elimina</button>`:''}<button class="btn btn-primary" onclick="saveTrattativa('${id||''}')">Salva</button></div></div></div>`)}
function saveTrattativa(id){const g=v=>document.getElementById(v).value;const acq=(DB.clienti||[]).find(x=>String(x.id)===String(g('tr-acq')));const im=(DB.immobili||[]).find(x=>String(x.id)===String(g('tr-imm')));
const d={acquirenteId:parseInt(g('tr-acq'))||null,immobileId:parseInt(g('tr-imm'))||null,prezzoOfferto:parseFloat(g('tr-prezzo'))||0,provvigione:parseFloat(g('tr-provv'))||3,fase:g('tr-fase'),ultimaModifica:today(),acquirente:acq?acq.nome+' '+acq.cognome:'—',immobile:im?im.titolo:'—'};
if(!d.immobileId){showToast('Seleziona immobile','error');return}
if(id){const i=(DB.trattative||[]).findIndex(x=>String(x.id)===String(id));if(i>=0)DB.trattative[i]={...DB.trattative[i],...d};showToast('Aggiornata ✓')}
else{d.id=''+Date.now();d.dataApertura=today();DB.trattative.push(d);showToast('Creata ✓')}
save();closeModal();render()}
function deleteTrattativa(id){if(!confirm('Eliminare?'))return;DB.trattative=DB.trattative.filter(x=>String(x.id)!==String(id));save();closeModal();render()}
/* MERCATO */
function mercatoUltimo(){const t=DB.mercato.trimestri;return t[t.length-1]}
function mercatoYoY(u){const t=DB.mercato.trimestri;const[y,q]=u.p.split('-Q');const p=t.find(x=>x.p===(+y-1)+'-Q'+q);return p?{prov:(u.prov-p.prov)/p.prov*100,prezzo:(u.prezzoMq-p.prezzoMq)/p.prezzoMq*100}:{prov:0,prezzo:0}}
function renderMercato(c){const m=DB.mercato;const u=mercatoUltimo();const yoy=mercatoYoY(u);const g=Math.max(0,daysSince(m.ultimoAggiornamento));const stale=g>100;
c.innerHTML=`<div class="stack">
<div class="card"><div class="row" style="justify-content:space-between;flex-wrap:wrap"><div><div class="card-title" style="font-size:17px">📉 Compravendite Piacenza 2025/2026</div><div class="card-subtitle">Fonte OMI – Agenzia Entrate + ISTAT · elaborazione automatica</div></div><div class="row-tight"><span class="badge ${stale?'badge-red':'badge-green'}">${stale?'⚠️ aggiorna ('+g+'gg)':'✅ agg. '+ageText(m.ultimoAggiornamento)}</span><button class="btn btn-gold btn-sm" onclick="stampaReportMercato()">🖨️ Report</button></div></div>
${stale?`<div class="alert red" style="margin-top:10px">⚠️ Dati OMI da aggiornare. <button class="btn btn-success btn-sm" onclick="segnaMercatoAggiornato()">✓ Ho verificato</button></div>`:''}</div>
<div class="grid4"><div class="stat-card"><div class="stat-label">NTN Provincia (${u.p})</div><div class="stat-value">${u.prov}</div><div class="stat-sub ${yoy.prov>=0?'text-green':'text-red'}">${yoy.prov>=0?'+':''}${yoy.prov.toFixed(1)}% YoY</div></div><div class="stat-card"><div class="stat-label">NTN Comune</div><div class="stat-value">${u.comune}</div></div><div class="stat-card"><div class="stat-label">€/mq città</div><div class="stat-value">${fmtEuroShort(u.prezzoMq)}</div><div class="stat-sub ${yoy.prezzo>=0?'text-green':'text-red'}">${yoy.prezzo>=0?'+':''}${yoy.prezzo.toFixed(1)}% YoY</div></div><div class="stat-card"><div class="stat-label">Tasso mutui</div><div class="stat-value">${u.tassoMutui}%</div></div></div>
<div class="card"><div class="card-title" style="margin-bottom:10px">📋 Serie trimestrale</div><div class="table-wrap"><table class="table"><thead><tr><th>Periodo</th><th>NTN Prov</th><th>NTN Comune</th><th>€/mq</th><th>Giorni</th><th>Sconto</th></tr></thead><tbody>${m.trimestri.map(t=>`<tr><td><b>${t.p}</b></td><td>${t.prov}</td><td>${t.comune}</td><td>${fmtEuroShort(t.prezzoMq)}</td><td>${t.giorniMedi}</td><td>${t.scontoMedio}%</td></tr>`).join('')}</tbody></table></div></div>
<div class="card"><div class="card-title" style="margin-bottom:10px">🗺️ Zone Piacenza (€/mq)</div><div class="row" style="margin-bottom:10px"><div class="search-bar" style="max-width:260px">🔍 <input id="ricercaZona" placeholder="Cerca zona" oninput="filtraZone()"></div>${['tutte','centrali','semicentrali','periferiche','comuni'].map(x=>`<button class="btn btn-ghost btn-xs" onclick="filtraPerCategoria('${x}')">${x}</button>`).join('')}</div>
<div class="table-wrap"><table class="table"><thead><tr><th>Zona</th><th>€/mq</th><th>Affitto</th><th>Yield</th><th>Trend</th></tr></thead><tbody id="zoneBody"></tbody></table></div>
<div class="card-title" style="margin:14px 0 8px">⚖️ Confronto zone</div><div id="zoneConfronto" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px"></div><div id="risultatoConfronto"></div></div></div>`;
renderTabellaZone()}
function filtraZone(){zonaFilter=(document.getElementById('ricercaZona')?.value||'').toLowerCase();renderTabellaZone()}
function filtraPerCategoria(cat){categoriaFilter=cat;renderTabellaZone()}
function renderTabellaZone(){const b=document.getElementById('zoneBody');if(!b)return;
const z=ZONE_PIACENZA.filter(x=>(!zonaFilter||x.nome.toLowerCase().includes(zonaFilter))&&(categoriaFilter==='tutte'||x.categoria===categoriaFilter));
b.innerHTML=z.map(x=>{const y=((x.affittoMq*12)/x.mqMid*100).toFixed(1);return`<tr style="cursor:pointer" onclick="aggiungiConfronto('${x.nome.replace(/'/g,"\\'")}')"><td><b>${esc(x.nome)}</b></td><td style="color:var(--gold);font-weight:700">€ ${x.mqMid}</td><td>€ ${x.affittoMq}</td><td>${y}%</td><td class="${x.trendUp?'trend-up':'trend-down'}">${x.trend}</td></tr>`}).join('')||'<tr><td colspan="5" style="text-align:center">Nessuna zona</td></tr>';
renderConfronto()}
function aggiungiConfronto(n){if(zoneConfronto.indexOf(n)>=0)zoneConfronto=zoneConfronto.filter(z=>z!==n);else if(zoneConfronto.length<4)zoneConfronto.push(n);else{zoneConfronto.shift();zoneConfronto.push(n)}renderConfronto()}
function renderConfronto(){const el=document.getElementById('zoneConfronto');if(!el)return;
el.innerHTML=zoneConfronto.map(n=>{const z=ZONE_PIACENZA.find(x=>x.nome===n);if(!z)return'';const y=((z.affittoMq*12)/z.mqMid*100).toFixed(1);return`<div class="comp-card" style="cursor:pointer" onclick="aggiungiConfronto('${n.replace(/'/g,"\\'")}')"><div class="comp-card-row"><b>${esc(n)}</b><span style="color:var(--red)">✕</span></div><div style="margin-top:6px;font-size:12px"><span style="color:var(--gold);font-weight:700">€ ${z.mqMid}/mq</span> · Yield ${y}%</div></div>`}).join('')+(zoneConfronto.length<4?'<div class="comp-card" style="border-color:var(--gold)"><b style="color:var(--gold)">+ Aggiungi zona</b><div style="font-size:11px;color:var(--text2);margin-top:4px">Clicca una riga della tabella</div></div>':'');
const res=document.getElementById('risultatoConfronto');if(!res)return;
if(zoneConfronto.length>=2){const st=zoneConfronto.map(n=>ZONE_PIACENZA.find(x=>x.nome===n)).filter(Boolean);res.innerHTML=`<div class="alert green"><b>📊 Sintesi:</b> Range € ${Math.min(...st.map(s=>s.mqMin))}–€ ${Math.max(...st.map(s=>s.mqMax))}/mq · Più economica: <b>${esc(st.reduce((a,b)=>a.mqMid<b.mqMid?a:b).nome)}</b> · Più cara: <b>${esc(st.reduce((a,b)=>a.mqMid>b.mqMid?a:b).nome)}</b></div>`}else res.innerHTML=''}
function segnaMercatoAggiornato(){DB.mercato.ultimoAggiornamento=today();save();render();showToast('📊 Aggiornamento registrato')}
function stampaReportMercato(){const m=DB.mercato;const w=window.open('','_blank');if(!w)return;
w.document.write('<html><head><title>Report mercato</title><style>body{font-family:Georgia,serif;padding:36px}h1{border-bottom:3px solid #c9a96e}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #ddd;padding:7px;font-size:12px}th{background:#f5f0e6}</style></head><body><h1>📉 Compravendite Piacenza</h1><p>Generato '+fmtDate(today())+' · Fonte OMI/ISTAT</p><table><tr><th>Periodo</th><th>NTN Prov</th><th>NTN Comune</th><th>€/mq</th><th>Giorni</th></tr>'+m.trimestri.map(t=>`<tr><td>${t.p}</td><td>${t.prov}</td><td>${t.comune}</td><td>${t.prezzoMq}</td><td>${t.giorniMedi}</td></tr>`).join('')+'</table><script>window.onload=function(){window.print()}<\/script></body></html>');w.document.close()}
/* VALUTATORE */
const PESI={principale:1,balcone:.3,terrazzo:.35,giardino:.1,cantina:.25,box:.5,postoAutoCoperto:.4,postoAutoScoperto:.2};
const CLASSE_IMPACT={A4:1.15,A3:1.13,A2:1.11,A1:1.09,B:1.05,C:1,D:.97,E:.93,F:.88,G:.83};
const COEFF={piano:{con:{seminterrato:-25,terra:-10,primo:-10,secondo:-3,terzo:0,quarto:5,ultimo:10},senza:{seminterrato:-25,terra:-10,primo:-10,secondo:-15,terzo:-20,quarto:-30,ultimo:-30}},stato:{daRistrutturare:-15,abitabile:-5,buono:0,ristrutturato:5,nuovo:10},esposizione:{sud:10,est:5,ovest:0,nord:-5,doppia:12,tripla:15},luminosita:{moltoLuminoso:10,luminoso:5,medio:0,pocoLuminoso:-5},vista:{panoramica:10,aperta:5,mista:0,cortile:-5},riscaldamento:{autonomo:5,centralizzato:0,assente:-5}};
const STEPS=['📍 Zona','🏠 Tipologia','⚡ Caratteristiche','📐 Pertinenze','🎨 Qualità','🏙️ Mercato','🎯 Risultato'];
function vtd(k,v){V.dati[k]=v}
function getOmiRange(z){const x=ZONE_PIACENZA.find(y=>y.nome.toLowerCase()===(z||'').toLowerCase());return x?{min:x.mqMin,mid:x.mqMid,max:x.mqMax,fonte:x.fonte,affittoMq:x.affittoMq}:{min:1000,mid:1500,max:2000,fonte:'stima',affittoMq:4}}
function getComparabili(d){const out=[];(DB.immobili||[]).filter(im=>im.tipo===d.tipo&&im.stato!=='venduto').forEach(im=>{let s=50;if(im.zona&&d.zona&&im.zona.toLowerCase()===d.zona.toLowerCase())s+=25;if(im.superficie&&d.mq&&Math.abs(im.superficie-d.mq)/d.mq<.2)s+=10;out.push({...im,score:s})});
if(out.length<3&&d.zona){const omi=getOmiRange(d.zona);const sb=d.mq||80;[0,-8,5].forEach((sc,i)=>{out.push({codice:'BORSINO-'+(i+1),titolo:(d.locali||3)+' locali - '+d.zona,zona:d.zona,superficie:sb,locali:d.locali,prezzo:Math.round(omi.mid*(1+sc/100)*sb),score:65-i*3})})}
return out.sort((a,b)=>b.score-a.score).slice(0,5)}
RENDERERS.valutatore=function(c){c.innerHTML=`<div class="stack"><div class="card" style="background:linear-gradient(135deg,#0a0c14,#111520);border-color:rgba(201,169,110,.2)"><div id="wizardSteps" class="wizard-steps"></div><div id="wizardBody"></div><div class="row" style="margin-top:18px;justify-content:space-between" id="navButtons"></div></div></div>`;V={step:1,dati:{},risultato:null};vtPaint()};
function vtPaint(){const ws=document.getElementById('wizardSteps');if(!ws)return;
ws.innerHTML=STEPS.map((s,i)=>{const n=i+1;return`<div class="wizard-step ${V.step===n?'on':V.step>n?'done':''}" onclick="V.step=${n};vtPaint()"><span class="num">${V.step>n?'✓':n}</span>${s.slice(2)}</div>`}).join('');
document.getElementById('wizardBody').innerHTML=window['vtStep'+V.step]();
document.getElementById('navButtons').innerHTML=(V.step>1?'<button class="btn btn-ghost" onclick="V.step--;vtPaint()">← Indietro</button>':'')+'<div class="progress"><div class="progress-bar" style="width:'+(V.step/7*100)+'%"></div></div>'+(V.step<7?'<button class="btn btn-gold" onclick="vtNext()">Avanti →</button>':'<button class="btn btn-gold" onclick="V={step:1,dati:{},risultato:null};vtPaint()">🔄 Nuova</button>');
if(V.step===1){setTimeout(()=>{const el=document.getElementById('omi-info');if(el){const r=getOmiRange(V.dati.zona);el.innerHTML='<b>📊 '+esc(V.dati.zona||'—')+'</b> · Vendita € '+r.min+'-'+r.max+'/mq (media € '+r.mid+') · Affitto € '+r.affittoMq+'/mq/mese · Fonte '+r.fonte}},80)}}
function vtNext(){const d=V.dati;if(V.step===1&&!d.zona){alert('Inserisci la zona');return}if(V.step===2&&(!d.mq||!d.locali)){alert('Inserisci mq e locali');return}if(V.step===3&&!d.anno){alert('Inserisci anno');return}if(V.step===6)vtCalcola();V.step++;vtPaint()}
function vtStep1(){const d=V.dati;return`<div class="card"><h2 style="color:var(--gold);font-family:var(--font-serif)">📍 Dove si trova?</h2><div class="form-grid"><div class="form-group"><label>Comune</label><input class="form-control" value="${esc(d.citta||'Piacenza')}" onchange="vtd('citta',this.value)"></div><div class="form-group"><label>Zona *</label><input class="form-control" list="zdl" value="${esc(d.zona||'')}" onchange="vtd('zona',this.value)"><datalist id="zdl">${ZONE_PIACENZA.map(z=>`<option value="${esc(z.nome)}">`).join('')}</datalist></div></div><div id="omi-info" style="margin-top:14px;padding:12px;background:rgba(201,169,110,.1);border:1px solid var(--gold);border-radius:8px;font-size:13px"></div></div>`}
function vtStep2(){const d=V.dati;return`<div class="card"><h2 style="color:var(--gold);font-family:var(--font-serif)">🏠 Tipologia & superfici</h2><div class="form-grid"><div class="form-group"><label>Tipologia</label><select class="form-control" onchange="vtd('tipo',this.value)">${['appartamento','attico','villa','bilocale','trilocale','mansarda','box'].map(t=>`<option ${d.tipo===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label>Sup. mq *</label><input type="number" class="form-control" value="${d.mq||80}" onchange="vtd('mq',parseInt(this.value)||80)"></div><div class="form-group"><label>Locali *</label><input type="number" class="form-control" value="${d.locali||3}" onchange="vtd('locali',parseInt(this.value)||3)"></div><div class="form-group"><label>Balconi mq</label><input type="number" class="form-control" value="${d.mqBalconi||0}" onchange="vtd('mqBalconi',parseFloat(this.value)||0)"></div><div class="form-group"><label>Terrazzo mq</label><input type="number" class="form-control" value="${d.mqTerrazzo||0}" onchange="vtd('mqTerrazzo',parseFloat(this.value)||0)"></div><div class="form-group"><label>Box mq</label><input type="number" class="form-control" value="${d.mqBox||0}" onchange="vtd('mqBox',parseFloat(this.value)||0)"></div><div class="form-group"><label>Giardino mq</label><input type="number" class="form-control" value="${d.mqGiardino||0}" onchange="vtd('mqGiardino',parseFloat(this.value)||0)"></div><div class="form-group"><label>Cantina mq</label><input type="number" class="form-control" value="${d.mqCantina||0}" onchange="vtd('mqCantina',parseFloat(this.value)||0)"></div></div></div>`}
function vtStep3(){const d=V.dati;const cls=['A4','A3','A2','A1','B','C','D','E','F','G'];const col={A4:'#00a651',A3:'#3bbf49',A2:'#7ed957',A1:'#bce379',B:'#ffe600',C:'#fcd116',D:'#f9b233',E:'#f48a36',F:'#ed2227',G:'#a8131d'};
return`<div class="card"><h2 style="color:var(--gold);font-family:var(--font-serif)">⚡ Caratteristiche</h2><div class="form-grid"><div class="form-group"><label>Anno *</label><input type="number" class="form-control" value="${d.anno||2000}" onchange="vtd('anno',parseInt(this.value)||2000)"></div><div class="form-group"><label>Piano</label><input type="number" class="form-control" value="${d.piano||2}" onchange="vtd('piano',parseInt(this.value)||0)"></div><div class="form-group"><label>Ascensore</label><div class="toggle-group"><div class="toggle-opt ${d.ascensore===true?'on':''}" onclick="vtd('ascensore',true);vtPaint()">Sì</div><div class="toggle-opt ${d.ascensore===false?'on':''}" onclick="vtd('ascensore',false);vtPaint()">No</div></div></div><div class="form-group"><label>Stato</label><select class="form-control" onchange="vtd('stato',this.value)">${['nuovo','ristrutturato','buono','abitabile','daRistrutturare'].map(s=>`<option value="${s}" ${d.stato===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="form-group" style="grid-column:1/-1"><label>Classe energetica</label><div class="classi-grid">${cls.map(x=>`<div class="classe-btn ${d.classe===x?'selected':''}" style="background:${col[x]};color:${['A1','B','C','D'].includes(x)?'#000':'#fff'}" onclick="vtd('classe','${x}');vtPaint()">${x}</div>`).join('')}</div></div></div></div>`}
function vtStep4(){const d=V.dati;const it=[['box','🚗','Box'],['postoAuto','🅿️','Posto auto'],['cantina','🛢️','Cantina'],['giardino','🌳','Giardino'],['terrazzo','🌅','Terrazzo'],['piscina','🏊','Piscina'],['allarme','🚨','Allarme'],['domotica','🤖','Domotica'],['pannelli','☀️','Solari'],['fibra','📡','Fibra']];
return`<div class="card"><h2 style="color:var(--gold);font-family:var(--font-serif)">📐 Pertinenze & dotazioni</h2><div class="extra-grid">${it.map(x=>`<div class="extra-card ${d[x[0]]?'on':''}" onclick="vtd('${x[0]}',${!d[x[0]]});vtPaint()"><div class="icona">${x[1]}</div><div class="lbl">${x[2]}</div></div>`).join('')}</div></div>`}
function vtStep5(){const d=V.dati;return`<div class="card"><h2 style="color:var(--gold);font-family:var(--font-serif)">🎨 Qualità</h2><div class="form-grid"><div class="form-group"><label>Esposizione</label><select class="form-control" onchange="vtd('esposizione',this.value)">${['tripla','sud','doppia','est','ovest','nord'].map(x=>`<option value="${x}" ${d.esposizione===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="form-group"><label>Luminosità</label><select class="form-control" onchange="vtd('luminosita',this.value)">${['moltoLuminoso','luminoso','medio','pocoLuminoso'].map(x=>`<option value="${x}" ${d.luminosita===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="form-group"><label>Vista</label><select class="form-control" onchange="vtd('vista',this.value)">${['panoramica','aperta','mista','cortile'].map(x=>`<option value="${x}" ${d.vista===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="form-group"><label>Finiture</label><select class="form-control" onchange="vtd('finiture',this.value)">${['lusso','signorile','buone','standard'].map(x=>`<option value="${x}" ${d.finiture===x?'selected':''}>${x}</option>`).join('')}</select></div></div></div>`}
function vtStep6(){const d=V.dati;return`<div class="card"><h2 style="color:var(--gold);font-family:var(--font-serif)">🏙️ Mercato</h2><div class="form-grid"><div class="form-group"><label>Trend zona</label><select class="form-control" onchange="vtd('trendZona',this.value)">${['crescente','stabile','calo'].map(x=>`<option value="${x}" ${d.trendZona===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="form-group"><label>Prezzo richiesto €</label><input type="number" class="form-control" value="${d.prezzoRichiesto||''}" onchange="vtd('prezzoRichiesto',parseFloat(this.value)||0)"></div><div class="form-group"><label>Giorni mercato</label><input type="number" class="form-control" value="${d.giorniMercato||0}" onchange="vtd('giorniMercato',parseInt(this.value)||0)"></div></div></div>`}
function vtCalcola(){const d=V.dati,omi=getOmiRange(d.zona),det=[];let coef=0,n=0;
let sup=d.mq||0;sup+=(d.mqBalconi||0)*PESI.balcone+(d.mqTerrazzo||0)*PESI.terrazzo+(d.mqGiardino||0)*PESI.giardino+(d.mqCantina||0)*PESI.cantina+(d.mqBox||0)*PESI.box;
det.push({fattore:'Base OMI',condizione:omi.fonte,valore:0});n++;
const pl=d.piano<=0?'terra':d.piano===1?'primo':d.piano===2?'secondo':d.piano===3?'terzo':'ultimo';
if(d.tipo!=='box'){const v=(d.ascensore?COEFF.piano.con:COEFF.piano.senza)[pl]||0;if(v){coef+=v;det.push({fattore:'Piano',condizione:pl,valore:v});n++}}
if(d.stato){const v=COEFF.stato[d.stato]||0;if(v){coef+=v;det.push({fattore:'Stato',condizione:d.stato,valore:v});n++}}
const cd=((CLASSE_IMPACT[d.classe||'C']||1)-1)*100;if(cd){coef+=cd;det.push({fattore:'Classe',condizione:d.classe||'C',valore:parseFloat(cd.toFixed(1))});n++}
if(d.esposizione){const v=COEFF.esposizione[d.esposizione]||0;if(v){coef+=v;det.push({fattore:'Esposizione',condizione:d.esposizione,valore:v});n++}}
if(d.luminosita){const v=COEFF.luminosita[d.luminosita]||0;if(v){coef+=v;det.push({fattore:'Luminosità',condizione:d.luminosita,valore:v});n++}}
if(d.vista){const v=COEFF.vista[d.vista]||0;if(v){coef+=v;det.push({fattore:'Vista',condizione:d.vista,valore:v});n++}}
['box','giardino','terrazzo','cantina'].forEach(k=>{if(d[k]){coef+=3;det.push({fattore:'Pertinenza',condizione:k,valore:3});n++}});
if(d.trendZona){const v={crescente:5,stabile:0,calo:-5}[d.trendZona];if(v){coef+=v;det.push({fattore:'Trend',condizione:d.trendZona,valore:v});n++}}
if(d.domotica){coef+=3;det.push({fattore:'Domotica',condizione:'presente',valore:3});n++}
const base=Math.round(omi.mid*sup*(1+coef/100));
V.risultato={base,min:Math.round(base*.93),max:Math.round(base*1.07),mq:Math.round(base/Math.max(sup,1)),sup,coef,det,conf:Math.min(100,60+det.length*2)}}
function vtStep7(){if(!V.risultato)vtCalcola();const r=V.risultato,d=V.dati;const comp=getComparabili(d);
const canA=Math.round(r.base*.055),canM=Math.round(canA/12);
return`<div class="risultato-box"><div class="risultato-prezzo">${fmtEuro(r.base)}</div><div class="risultato-range">Forbice ${fmtEuro(r.min)} – ${fmtEuro(r.max)}</div><div class="risultato-permq">${fmtEuro(r.mq)}/mq · sup comm ${r.sup.toFixed(0)}mq</div>
<div class="confidence-bar"><div class="confidence-label"><span>📊 Affidabilità</span><strong>${r.conf}%</strong></div><div class="confidence-track"><div class="confidence-fill" style="width:${r.conf}%"></div></div></div></div>
<div class="stats-grid"><div class="stat-box"><div class="stat-num">${r.sup.toFixed(0)}</div><div class="stat-lbl">mq comm.</div></div><div class="stat-box"><div class="stat-num">${r.det.length}</div><div class="stat-lbl">coefficienti</div></div><div class="stat-box"><div class="stat-num">${(r.coef>0?'+':'')+r.coef.toFixed(1)}%</div><div class="stat-lbl">correzione</div></div><div class="stat-box"><div class="stat-num">${fmtEuro(r.mq)}</div><div class="stat-lbl">€/mq</div></div></div>
<div class="card"><h3 style="color:var(--gold)">💡 Stima affitto</h3><div class="stats-grid"><div class="stat-box"><div class="stat-num">${fmtEuro(canM)}</div><div class="stat-lbl">canone/mese</div></div><div class="stat-box"><div class="stat-num">${fmtEuro(canA)}</div><div class="stat-lbl">canone/anno</div></div><div class="stat-box"><div class="stat-num">${((canA/r.base)*100).toFixed(2)}%</div><div class="stat-lbl">yield lordo</div></div><div class="stat-box"><div class="stat-num">${((canA*.65/r.base)*100).toFixed(2)}%</div><div class="stat-lbl">yield netto</div></div></div></div>
<div class="card"><h3 style="color:var(--gold)">📐 Coefficienti</h3><div style="max-height:240px;overflow-y:auto"><table class="coeff-table"><tbody>${r.det.map(x=>`<tr><td><b>${esc(x.fattore)}</b></td><td style="color:var(--text2)">${esc(x.condizione)}</td><td style="text-align:right;color:${x.valore>0?'var(--green)':x.valore<0?'var(--red)':'var(--text2)'}">${x.valore>0?'+':''}${x.valore}%</td></tr>`).join('')}</tbody></table></div></div>
${comp.length?`<div class="card"><h3 style="color:var(--gold)">🏠 Comparabili</h3>${comp.map(x=>`<div class="comp-card"><div class="comp-card-row"><div><b>${esc(x.codice||'')}</b> ${esc(x.titolo||'')}<div style="font-size:11px;color:var(--text2)">similarità ${x.score}%</div></div><div style="text-align:right"><b style="color:var(--gold)">${fmtEuro(x.prezzo)}</b></div></div></div>`).join('')}</div>`:''}
<div class="card"><h3 style="color:var(--gold)">🎯 Strategia</h3><ul class="strategia-list"><li>💰 Richiesta: ${fmtEuro(Math.round(r.base*1.05))} (+5%)</li><li>🎯 Trattativa: ${fmtEuro(r.min)} – ${fmtEuro(r.base)}</li><li>🚫 Minimo: ${fmtEuro(r.min)}</li>${d.giorniMercato>120?'<li>⏰ Oltre 120gg: ribasso 5-10%</li>':''}</ul></div>
<div class="alert gold">⚠️ Stima indicativa (modello edonico). Perizia giurata UNI 11558:2014 per valori ufficiali.</div>`}
/* INCROCI */
function runChecks(){const F=[];const o=today();const push=(s,cat,t,d,g,id)=>F.push({sev:s,cat,t,d,g,id});
(DB.clienti||[]).forEach(c=>{if(c.stato==='chiuso')return;if(c.dataRichiamo&&c.dataRichiamo<today())push('high','Contatti',(c.nome||'')+' '+(c.cognome||'')+' da richiamare '+ageText(c.dataRichiamo),'Promemoria scaduto','contatti',c.id);const gg=daysSince(c.ultimoContatto||c.dataCreazione||c.dataPrimoContatto);if(c.stato==='caldo'&&gg>7)push('high','Contatti',c.nome+' '+c.cognome+' caldo fermo da '+gg+'gg','Ricontattalo','contatti',c.id);else if(gg>21)push('medium','Contatti',c.nome+' '+c.cognome+' fermo da '+gg+'gg','Ricontatto','contatti',c.id);if(c.collaborativo==='si'&&c.presentazioneInviata!=='si')push('medium','Presentazione',(c.nome||'')+' '+(c.cognome||'')+' collaborativo senza presentazione','Inviala','contatti',c.id)});
(DB.immobili||[]).forEach(i=>{if(i.stato!=='disponibile')return;const gg=daysSince(i.dataInserimento||i.data_pubblicazione);if((i.visite||0)===0&&gg>30)push('high','Immobili',i.titolo+' 0 visite in '+gg+'gg','Rivedi prezzo/foto','immobili',i.id)});
(DB.trattative||[]).forEach(t=>{if(['conclusa','persa','rogito'].includes(t.fase))return;const gg=daysSince(t.ultimaModifica||t.dataApertura);if(gg>14)push('high','Pipeline','Trattativa '+(t.immobile||'')+' ferma '+gg+'gg','Sblocca','pipeline',t.id)});
(DB.appuntamenti||[]).forEach(a=>{if(a.data<o&&(a.stato==='pianificato'||a.stato==='confermato'||!a.stato))push('medium','Appuntamenti','"'+(a.titolo||'')+'" senza esito','Registra esito','calendario',a.id)});
(DB.attivita||[]).forEach(a=>{if(!a.done&&a.scadenza&&a.scadenza<o)push('high','Attività','Scaduta: '+a.titolo,'Completa','da-fare',a.id)});
(DB.chiamate||[]).forEach(ch=>{if(ch.dataRichiamo&&ch.dataRichiamo<o&&STATI_CHIUSI_CH.indexOf(ch.stato)<0)push('medium','Chiamate',ch.nome+' da richiamare '+ageText(ch.dataRichiamo),'Non lasciarlo raffreddare','chiamate',ch.id)});
(DB.mandati||[]).forEach(m=>{if(m.stato==='attivo'&&!m.firma)push('medium','Mandati','Mandato senza firma','Fai firmare','mandati',m.id)});
return F}
function renderIncroci(c){const F=runChecks();let sc=100;F.forEach(f=>{sc-=f.sev==='high'?8:f.sev==='medium'?3:1});sc=Math.max(0,Math.min(100,sc));const high=F.filter(x=>x.sev==='high').length;
c.innerHTML=`<div class="stack"><div class="card"><div class="row" style="justify-content:space-between"><div><div class="card-title" style="font-size:17px">🔀 Incroci & Monitoraggio</div><div class="card-subtitle">Il CRM incrocia i dati e ti dice cosa presidiare</div></div><div class="row-tight"><div style="text-align:center;padding:8px 16px;background:var(--bg2);border-radius:10px"><div style="font-size:9px;color:var(--text2)">SALUTE</div><div style="font-size:26px;font-weight:700;color:${sc>=75?'var(--green)':sc>=50?'var(--orange)':'var(--red)'}">${sc}</div></div><div style="text-align:center;padding:8px 16px;background:var(--bg2);border-radius:10px"><div style="font-size:9px;color:var(--text2)">ALERT</div><div style="font-size:26px;font-weight:700;color:${high?'var(--red)':'var(--green)'}">${high}</div></div></div></div></div>
<div class="grid2"><div class="card"><div class="card-title" style="margin-bottom:10px">🚨 Urgenti</div>${F.filter(x=>x.sev==='high').slice(0,8).map(fRow).join('')||'<div class="empty-state text-sm">✅ Nessuna urgenza</div>'}</div><div class="card"><div class="card-title" style="margin-bottom:10px">⚠️ Da osservare</div>${F.filter(x=>x.sev==='medium').slice(0,8).map(fRow).join('')||'<div class="empty-state text-sm">✅ Tutto ok</div>'}</div></div></div>`}
function fRow(f){return`<div class="row" style="padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:10px;margin-bottom:8px"><div style="flex:1"><b style="font-size:13px">${esc(f.t)}</b><div style="font-size:11px;color:var(--text2)">${esc(f.d)}</div></div><span class="badge badge-gray">${esc(f.cat)}</span><button class="btn btn-primary btn-xs" onclick="go('${f.g}')">Apri</button></div>`}
/* LEADS + IMPORT */
function renderLeads(c){const l=(DB.leads||[]).slice().sort((a,b)=>(b.creata||'').localeCompare(a.creata||''));
c.innerHTML=`<div class="stack"><div class="card"><div class="row" style="justify-content:space-between"><div><div class="card-title" style="font-size:17px">📥 Acquisizione Lead</div><div class="card-subtitle">Lead rapidi da telefono/portineria/passaparola</div></div><button class="btn btn-primary" onclick="openLeadModal()">+ Nuovo</button></div></div>
${l.length===0?'<div class="card"><div class="empty-state"><div class="icon">📥</div>Nessun lead.</div></div>':`<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>Tel</th><th>Tipo</th><th>Fonte</th><th></th></tr></thead><tbody>${l.map(x=>`<tr><td><b>${esc(x.nome)}</b></td><td>${esc(x.telefono||'—')}</td><td>${esc(x.tipo||'')}</td><td>${esc(x.fonte||'')}</td><td><div class="row-tight"><button class="btn btn-success btn-xs" onclick="convertiLead('${x.id}')">→ Contatto</button><button class="btn btn-ghost btn-xs" onclick="deleteLead('${x.id}')">✕</button></div></td></tr>`).join('')}</tbody></table></div></div>`}</div>`}
function openLeadModal(){document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-sm" onclick="event.stopPropagation()"><h2>📥 Nuovo lead</h2><div class="stack" style="gap:10px"><div class="form-group"><label class="form-label">Nome *</label><input id="ld-nome" class="inp"></div><div class="form-group"><label class="form-label">Telefono *</label><input id="ld-tel" class="inp"></div><div class="form-group"><label class="form-label">Tipo</label><select id="ld-tipo" class="inp"><option value="acquirente">Cerca casa</option><option value="venditore">Vuole vendere</option><option value="investitore">Investitore</option></select></div><div class="form-group"><label class="form-label">Fonte</label><select id="ld-fonte" class="inp">${FONTE_LEAD.map(x=>`<option>${x}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Note</label><textarea id="ld-note" class="inp" rows="2"></textarea></div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveLead()">Crea</button></div></div></div>`)}
function saveLead(){const g=v=>document.getElementById(v).value;const d={id:''+Date.now(),nome:g('ld-nome').trim(),telefono:g('ld-tel').trim(),tipo:g('ld-tipo'),fonte:g('ld-fonte'),note:g('ld-note').trim(),creata:nowISO()};
if(!d.nome||!d.telefono){showToast('Nome e telefono obbligatori','error');return}DB.leads.push(d);save();closeModal();render();showToast('✅ Lead creato')}
function convertiLead(id){const l=(DB.leads||[]).find(x=>String(x.id)===String(id));if(!l)return;const nm=String(l.nome||'').split(' ');DB.clienti.push({id:Date.now(),nome:nm[0]||l.nome,cognome:nm.slice(1).join(' ')||'',telefono:l.telefono,tipo:l.tipo||'altro',stato:'tiepido',fase:'Nuovo',fonte:l.fonte,note:l.note||'',citta:'Piacenza',indirizzo:'',dataCreazione:today(),dataPrimoContatto:today(),ultimoContatto:today(),dataRichiamo:'',collaborativo:'',presentazioneInviata:'no'});DB.leads=DB.leads.filter(x=>String(x.id)!==String(id));save();render();showToast('✅ Convertito')}
function deleteLead(id){DB.leads=DB.leads.filter(x=>String(x.id)!==String(id));save();render()}
function renderImport(c){c.innerHTML=`<div class="stack"><div class="card"><div class="card-title" style="font-size:17px">📋 Importa Rubrica in blocco</div><div class="card-subtitle">Incolla elenchi da Pagine Bianche / Excel / appunti</div>
<div style="font-size:12px;color:var(--text2);margin:10px 0;line-height:1.7">Formati: <code>Rossi Mario;0521 123456;Via Cavour 12</code> · <code>Rossi Mario,3331234567,Via Roma 3</code> · testo libero</div>
<div class="form-row" style="margin-bottom:10px"><div class="form-group"><label class="form-label">Fonte blocco</label><select id="imp-fonte" class="inp"><option>Pagine Bianche</option><option>Per strada</option><option>Al bar</option><option>Referral</option><option>Altro</option></select></div><div class="form-group"><label class="form-label">Città</label><input id="imp-citta" class="inp" value="Piacenza"></div></div>
<textarea id="imp-testo" class="inp" rows="8" placeholder="Incolla qui l'elenco…"></textarea>
<div class="row" style="margin-top:10px"><button class="btn btn-primary" onclick="analizzaImport()">🔍 Analizza</button><button class="btn btn-ghost" onclick="document.getElementById('imp-testo').value='';window._importParsed=[];document.getElementById('import-preview').innerHTML=''">🧹 Pulisci</button></div>
<div id="import-preview" style="margin-top:14px"></div></div></div>`}
function parseRiga(line,fonte,citta){line=line.trim();if(!line)return null;const pm=line.match(/(\+?39[\s\-.]?)?([0-9]{2,4}[\s\-.]?[0-9]{5,9})/);let phone='',rest=line;if(pm){phone=pm[0].replace(/[^\d+]/g,'');rest=line.replace(pm[0],' ')}rest=rest.replace(/\s+/g,' ').trim();let sep=null;if(rest.includes(';'))sep=';';else if(rest.includes(','))sep=',';else if(rest.includes('\t'))sep='\t';let nome='',ind='';if(sep){const p=rest.split(sep).map(x=>x.trim()).filter(Boolean);if(p[0]&&p[0].replace(/\D/g,'').length>=8&&!phone){phone=p[0].replace(/\D/g,'');nome=p[1]||'';ind=p.slice(2).join(', ')}else{nome=p[0]||'';ind=p.slice(1).join(', ')}}else nome=rest;nome=nome.replace(/^[\s\-]+/,'').trim();if(!nome&&!phone)return null;return{nome:nome||'(senza nome)',telefono:phone,indirizzo:ind,citta,fonte}}
function analizzaImport(){const raw=document.getElementById('imp-testo').value;const fonte=document.getElementById('imp-fonte').value;const citta=document.getElementById('imp-citta').value||'Piacenza';
const parsed=raw.split(/\r?\n/).map(r=>parseRiga(r,fonte,citta)).filter(Boolean);
const ex={};(DB.chiamate||[]).forEach(x=>{const n=(x.telefono||'').replace(/\D/g,'');if(n)ex[n]=true});
const seen={};let fin=[],dI=0,dR=0;
parsed.forEach(p=>{const n=p.telefono.replace(/\D/g,'');if(!n){fin.push(p);return}if(seen[n]){dI++;return}if(ex[n]){dR++;return}seen[n]=true;fin.push(p)});
window._importParsed=fin;const pv=document.getElementById('import-preview');
if(!fin.length){pv.innerHTML='<div class="text-red">Nessun contatto valido.</div>';return}
pv.innerHTML=`<div class="row" style="justify-content:space-between;margin-bottom:10px"><div style="font-size:12px;color:var(--text2)"><b class="text-green">${fin.length}</b> pronti${dI?' · '+dI+' duplicati saltati':''}${dR?' · '+dR+' già in rubrica':''}</div><button class="btn btn-gold" onclick="confermaImport()">✅ Importa ${fin.length}</button></div><div class="table-wrap"><table class="table"><tbody>${fin.slice(0,30).map(p=>`<tr><td>${esc(p.nome)}</td><td>${esc(p.telefono||'—')}</td><td style="color:var(--text2)">${esc(p.indirizzo||'')}</td></tr>`).join('')}</tbody></table></div>`}
function confermaImport(){const l=window._importParsed||[];if(!l.length)return;const b=Date.now();l.forEach((p,i)=>DB.chiamate.push({id:''+(b+i),nome:p.nome,telefono:p.telefono||'',fonte:p.fonte,indirizzo:p.indirizzo||'',citta:p.citta||'Piacenza',stato:'da-chiamare',creata:nowISO()}));save();showToast('✅ '+l.length+' persone importate');window._importParsed=[];document.getElementById('imp-testo').value='';document.getElementById('import-preview').innerHTML='';render()}
/* ATTIVITA */
function renderAttivita(c){const items=(DB.attivita||[]).filter(a=>_attF.stato==='aperte'?!a.done:_attF.stato==='completate'?a.done:true).sort((a,b)=>(a.scadenza||'').localeCompare(b.scadenza||''));
c.innerHTML=`<div class="stack"><div class="row" style="justify-content:space-between"><select class="inp" style="width:auto" onchange="_attF.stato=this.value;renderAttivita(document.getElementById('content'))"><option value="aperte" ${_attF.stato==='aperte'?'selected':''}>Aperte</option><option value="completate" ${_attF.stato==='completate'?'selected':''}>Completate</option><option value="tutte" ${_attF.stato==='tutte'?'selected':''}>Tutte</option></select><button class="btn btn-primary" onclick="openAttivitaModal()">+ Nuova</button></div>
<div class="card">${items.length?items.map(a=>attRow(a,a.scadenza<today()&&!a.done)).join(''):'<div class="empty-state"><div class="icon">✅</div>Nessuna attività.</div>'}</div></div>`}
function openAttivitaModal(id){const a=id?(DB.attivita||[]).find(x=>String(x.id)===String(id)):{};
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-sm" onclick="event.stopPropagation()"><h2>📌 Attività</h2><div class="stack" style="gap:10px"><div class="form-group"><label class="form-label">Titolo *</label><input id="at-tit" class="inp" value="${esc(a.titolo||'')}"></div><div class="form-row"><div class="form-group"><label class="form-label">Priorità</label><select id="at-prio" class="inp"><option value="alta" ${a.priorita==='alta'?'selected':''}>🔴 Alta</option><option value="media" ${(a.priorita||'media')==='media'?'selected':''}>🟡 Media</option><option value="bassa" ${a.priorita==='bassa'?'selected':''}>🔵 Bassa</option></select></div><div class="form-group"><label class="form-label">Scadenza *</label><input id="at-scad" type="date" class="inp" value="${a.scadenza||today()}"></div></div><div class="form-group"><label class="form-label">Contatto</label><select id="at-cont" class="inp"><option value="">—</option>${(DB.clienti||[]).map(x=>`<option value="${x.id}" ${String(a.contattoId)===String(x.id)?'selected':''}>${esc(x.nome+' '+x.cognome)}</option>`).join('')}</select></div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button>${id?`<button class="btn btn-danger" onclick="deleteAttivita('${id}')">Elimina</button>`:''}<button class="btn btn-primary" onclick="saveAttivita('${id||''}')">Salva</button></div></div></div>`)}
function saveAttivita(id){const g=v=>document.getElementById(v).value;const ct=(DB.clienti||[]).find(x=>String(x.id)===String(g('at-cont')));
const d={titolo:g('at-tit').trim(),priorita:g('at-prio'),scadenza:g('at-scad'),contattoId:parseInt(g('at-cont'))||null,contattoNome:ct?ct.nome+' '+ct.cognome:null,telefono:ct?ct.telefono:null};
if(!d.titolo||!d.scadenza){showToast('Titolo e scadenza obbligatori','error');return}
if(id){const i=(DB.attivita||[]).findIndex(x=>String(x.id)===String(id));if(i>=0)DB.attivita[i]={...DB.attivita[i],...d};showToast('Aggiornata ✓')}
else{d.id='a'+Date.now();d.done=false;DB.attivita.push(d);showToast('Creata ✓')}
save();closeModal();render();updateBadges()}
function deleteAttivita(id){if(!confirm('Eliminare?'))return;DB.attivita=DB.attivita.filter(x=>String(x.id)!==String(id));save();closeModal();render();updateBadges()}
function toggleAttivita(id){const a=(DB.attivita||[]).find(x=>String(x.id)===String(id));if(!a)return;a.done=!a.done;save();render();updateBadges();showToast(a.done?'✓ Completata':'↩ Riaperta')}
/* CALENDARIO */
function renderCalendario(c){const d=new Date(calendarYear,calendarMonth,1);const mese=d.toLocaleDateString('it-IT',{month:'long',year:'numeric'});const off=(d.getDay()+6)%7;const ug=new Date(calendarYear,calendarMonth+1,0).getDate();const o=today();const ev=DB.appuntamenti||[];let cells='';
for(let i=0;i<off;i++)cells+='<div class="cal-cell empty"></div>';
for(let g=1;g<=ug;g++){const ds=`${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(g).padStart(2,'0')}`;const ee=ev.filter(e=>e.data===ds);
cells+=`<div class="cal-cell ${ds===o?'oggi':''}" onclick="apriGiorno('${ds}')"><div class="cal-day">${g}</div>${ee.slice(0,3).map(e=>`<div class="cal-event">${e.ora||''} ${esc((e.titolo||'').slice(0,16))}</div>`).join('')}</div>`}
c.innerHTML=`<div class="stack"><div class="row" style="justify-content:space-between"><div class="row-tight"><button class="btn btn-ghost btn-icon" onclick="cambiaMese(-1)">←</button><div style="font-size:18px;font-weight:700;text-transform:capitalize;min-width:170px;text-align:center">${mese}</div><button class="btn btn-ghost btn-icon" onclick="cambiaMese(1)">→</button></div><button class="btn btn-primary" onclick="openAppModal()">+ Appuntamento</button></div>
<div class="cal-grid"><div class="cal-head">LUN</div><div class="cal-head">MAR</div><div class="cal-head">MER</div><div class="cal-head">GIO</div><div class="cal-head">VEN</div><div class="cal-head">SAB</div><div class="cal-head">DOM</div>${cells}</div></div>`}
function cambiaMese(dl){calendarMonth+=dl;if(calendarMonth<0){calendarMonth=11;calendarYear--}if(calendarMonth>11){calendarMonth=0;calendarYear++}renderCalendario(document.getElementById('content'))}
function apriGiorno(ds){openAppModal(0,null,null,ds)}
function openAppModal(id,contattoId,immobileId,dataDefault,contattoNome){const a=id?(DB.appuntamenti||[]).find(x=>String(x.id)===String(id)):{};
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-md" onclick="event.stopPropagation()"><h2>📅 Appuntamento</h2><div class="stack" style="gap:10px"><div class="form-group"><label class="form-label">Titolo *</label><input id="ap-tit" class="inp" value="${esc(a.titolo||contattoNome||'')}"></div><div class="form-row-3"><div class="form-group"><label class="form-label">Data *</label><input id="ap-data" type="date" class="inp" value="${a.data||dataDefault||today()}"></div><div class="form-group"><label class="form-label">Ora *</label><input id="ap-ora" type="time" class="inp" value="${a.ora||'10:00'}"></div><div class="form-group"><label class="form-label">Tipo</label><select id="ap-tipo" class="inp"><option value="visita" ${a.tipo==='visita'?'selected':''}>🏠 Visita</option><option value="chiamata" ${a.tipo==='chiamata'?'selected':''}>📞 Chiamata</option><option value="appuntamento" ${a.tipo==='appuntamento'||!a.tipo?'selected':''}>📅 Appuntamento</option><option value="firma" ${a.tipo==='firma'?'selected':''}>✍️ Firma</option></select></div></div><div class="form-group"><label class="form-label">Contatto</label><select id="ap-cont" class="inp"><option value="">—</option>${(DB.clienti||[]).map(x=>`<option value="${x.id}" ${String(a.contattoId)===String(x.id)?'selected':''}>${esc(x.nome+' '+x.cognome)}</option>`).join('')}</select></div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button>${id?`<button class="btn btn-danger" onclick="deleteApp(${id})">Elimina</button>`:''}<button class="btn btn-primary" onclick="saveApp(${id||0})">Salva</button></div></div></div>`)}
function saveApp(id){const g=v=>document.getElementById(v).value;const ct=(DB.clienti||[]).find(x=>String(x.id)===String(g('ap-cont')));
const d={titolo:g('ap-tit').trim(),data:g('ap-data'),ora:g('ap-ora'),tipo:g('ap-tipo'),contattoId:parseInt(g('ap-cont'))||null,contatto:ct?ct.nome+' '+ct.cognome:'',stato:'pianificato'};
if(!d.titolo||!d.data){showToast('Titolo e data obbligatori','error');return}
if(id){const i=(DB.appuntamenti||[]).findIndex(x=>String(x.id)===String(id));if(i>=0)DB.appuntamenti[i]={...DB.appuntamenti[i],...d};showToast('Aggiornato ✓')}
else{d.id=Date.now();DB.appuntamenti.push(d);showToast('Creato ✓')}
save();closeModal();render();updateBadges()}
function deleteApp(id){if(!confirm('Eliminare?'))return;DB.appuntamenti=DB.appuntamenti.filter(x=>String(x.id)!==String(id));save();closeModal();render();updateBadges()}
/* DOCUMENTI */
function renderDocumenti(c){const d=DB.documenti||[];
c.innerHTML=`<div class="stack"><div class="row" style="justify-content:space-between"><div style="font-size:11px;color:var(--text2)">${d.length} documenti · AML attiva</div><button class="btn btn-primary" onclick="openDocumentoModal()">+ Nuovo</button></div>
<div class="grid3">${d.length?d.map(x=>`<div class="card" style="padding:13px;cursor:pointer" onclick="openDocumentoModal(${x.id})"><div style="font-size:30px">📄</div><b>${esc(x.titolo)}</b><div style="font-size:10px;color:var(--text2)">${esc(x.tipo||'')} · ${fmtDate(x.data)}</div></div>`).join(''):'<div class="empty-state" style="grid-column:1/-1"><div class="icon">📄</div>Nessun documento.</div>'}</div>
<div class="card" style="background:var(--bg2)"><div class="card-title" style="margin-bottom:10px">🛡️ AML — Antiriciclaggio</div>${AML_ITEMS.map((it,i)=>`<div class="row-tight" style="padding:6px 0;border-bottom:1px solid var(--bg4)"><input type="checkbox" id="aml-${i}" ${(DB.settings?.amlDone||{})[it.id]?'checked':''} onchange="salvaAML('${it.id}',this.checked)"><label for="aml-${i}" style="flex:1;font-size:12px">${it.label}</label></div>`).join('')}</div></div>`}
function salvaAML(id,done){if(!DB.settings)DB.settings={};if(!DB.settings.amlDone)DB.settings.amlDone={};DB.settings.amlDone[id]=done;save()}
function openDocumentoModal(id){const d=id?(DB.documenti||[]).find(x=>String(x.id)===String(id)):{};
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-md" onclick="event.stopPropagation()"><h2>📄 Documento</h2><div class="stack" style="gap:10px"><div class="form-row"><div class="form-group"><label class="form-label">Tipo</label><select id="dc-tipo" class="inp">${['visura','ape','planimetria','incarico','preliminare','rogito','identita','altro'].map(t=>`<option value="${t}" ${d.tipo===t?'selected':''}>${t}</option>`).join('')}</select></div><div class="form-group"><label class="form-label">Titolo *</label><input id="dc-tit" class="inp" value="${esc(d.titolo||'')}"></div></div><div class="form-row"><div class="form-group"><label class="form-label">Data</label><input id="dc-data" type="date" class="inp" value="${d.data||today()}"></div><div class="form-group"><label class="form-label">Scadenza</label><input id="dc-scad" type="date" class="inp" value="${d.scadenza||''}"></div></div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button>${id?`<button class="btn btn-danger" onclick="deleteDocumento(${id})">Elimina</button>`:''}<button class="btn btn-primary" onclick="saveDocumento(${id||0})">Salva</button></div></div></div>`)}
function saveDocumento(id){const g=v=>document.getElementById(v).value;const d={tipo:g('dc-tipo'),titolo:g('dc-tit').trim(),data:g('dc-data'),scadenza:g('dc-scad')};
if(!d.titolo){showToast('Titolo obbligatorio','error');return}
if(id){const i=(DB.documenti||[]).findIndex(x=>String(x.id)===String(id));if(i>=0)DB.documenti[i]={...DB.documenti[i],...d};showToast('Aggiornato ✓')}
else{d.id=Date.now();DB.documenti.push(d);showToast('Creato ✓')}
save();closeModal();render()}
function deleteDocumento(id){if(!confirm('Eliminare?'))return;DB.documenti=DB.documenti.filter(x=>String(x.id)!==String(id));save();closeModal();render()}
/* FATTURE */
function renderFatture(c){const f=DB.fatture||[];const ap=f.filter(x=>x.stato==='da-incassare');const inc=sumBy(f.filter(x=>x.stato==='incassata'),x=>x.totale);const daI=sumBy(ap,x=>x.totale);
c.innerHTML=`<div class="stack"><div class="grid3"><div class="stat-card"><div class="stat-label">Incassato</div><div class="stat-value text-green">${fmtEuroShort(inc)}</div></div><div class="stat-card"><div class="stat-label">Da incassare</div><div class="stat-value text-gold">${fmtEuroShort(daI)}</div></div><div class="stat-card"><div class="stat-label">Scadute</div><div class="stat-value ${ap.filter(x=>x.scadenza&&x.scadenza<today()).length?'text-red':''}">${ap.filter(x=>x.scadenza&&x.scadenza<today()).length}</div></div></div>
<div class="row" style="justify-content:flex-end"><button class="btn btn-primary" onclick="openFatturaModal()">+ Nuova fattura</button></div>
<div class="card">${f.length?`<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Cliente</th><th>Totale</th><th>Scadenza</th><th>Stato</th><th></th></tr></thead><tbody>${f.map(x=>`<tr><td><b>${esc(x.numero)}</b></td><td>${esc(x.cliente||'—')}</td><td>${fmtEuro(x.totale)}</td><td>${x.scadenza?fmtDate(x.scadenza):'—'}</td><td>${x.stato==='incassata'?'<span class="badge badge-green">incassata</span>':'<span class="badge badge-orange">da incassare</span>'}</td><td><div class="row-tight">${x.stato==='da-incassare'?`<button class="btn btn-success btn-xs" onclick="pagaFattura('${x.id}')">💰</button>`:''}<button class="btn btn-ghost btn-xs" onclick="openFatturaModal('${x.id}')">✏️</button><button class="btn btn-ghost btn-xs" onclick="deleteFattura('${x.id}')">✕</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="icon">🧾</div>Nessuna fattura.</div>'}</div></div>`}
function openFatturaModal(id){const f=id?(DB.fatture||[]).find(x=>String(x.id)===String(id)):{};const num='FA-'+today().slice(0,4)+'-'+String((DB.fatture||[]).length+1).padStart(2,'0');
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-md" onclick="event.stopPropagation()"><h2>🧾 Fattura provvigione</h2><div class="stack" style="gap:10px"><div class="form-row"><div class="form-group"><label class="form-label">Numero</label><input id="fa-num" class="inp" value="${esc(f.numero||num)}"></div><div class="form-group"><label class="form-label">Data</label><input id="fa-data" type="date" class="inp" value="${f.data||today()}"></div></div><div class="form-group"><label class="form-label">Cliente</label><input id="fa-cli" class="inp" value="${esc(f.cliente||'')}"></div><div class="form-row-3"><div class="form-group"><label class="form-label">Imponibile €</label><input id="fa-imp" type="number" class="inp" value="${f.imponibile||''}" oninput="aggTotFatt()"></div><div class="form-group"><label class="form-label">IVA %</label><input id="fa-iva" type="number" class="inp" value="${f.ivaPct!=null?f.ivaPct:22}" oninput="aggTotFatt()"></div><div class="form-group"><label class="form-label">Totale</label><input id="fa-tot" class="inp" readonly value="${f.totale||''}"></div></div><div class="form-group"><label class="form-label">Scadenza</label><input id="fa-scad" type="date" class="inp" value="${f.scadenza||''}"></div><div class="form-group"><label class="form-label">Stato</label><select id="fa-stato" class="inp"><option value="da-incassare" ${f.stato!=='incassata'?'selected':''}>Da incassare</option><option value="incassata" ${f.stato==='incassata'?'selected':''}>Incassata</option></select></div></div><div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Annulla</button><button class="btn btn-primary" onclick="saveFattura('${id||''}')">Salva</button></div></div></div>`)}
function aggTotFatt(){const i=parseFloat(document.getElementById('fa-imp').value)||0;const v=parseFloat(document.getElementById('fa-iva').value)||0;document.getElementById('fa-tot').value=(i*(1+v/100)).toFixed(2)}
function saveFattura(id){const g=v=>document.getElementById(v).value;const i=parseFloat(g('fa-imp'))||0;const v=parseFloat(g('fa-iva'))||0;
const d={numero:g('fa-num').trim(),data:g('fa-data'),cliente:g('fa-cli').trim(),imponibile:i,ivaPct:v,totale:Math.round(i*(1+v/100)*100)/100,scadenza:g('fa-scad'),stato:g('fa-stato')};
if(!d.numero||!i){showToast('Numero e imponibile obbligatori','error');return}
if(id){const x=(DB.fatture||[]).find(y=>String(y.id)===String(id));if(x)Object.assign(x,d);showToast('Aggiornata ✓')}
else{d.id='f'+Date.now();DB.fatture.push(d);showToast('Creata ✓')}
save();closeModal();render()}
function pagaFattura(id){const f=(DB.fatture||[]).find(x=>String(x.id)===String(id));if(!f)return;f.stato='incassata';f.dataIncasso=today();save();render();showToast('💰 Incassata')}
function deleteFattura(id){if(!confirm('Eliminare?'))return;DB.fatture=DB.fatture.filter(x=>String(x.id)!==String(id));save();render()}
/* REPORT */
function renderReportSett(c){const m=metricheSett();const ok=m.incarichi.length>=m.target;
c.innerHTML=`<div class="stack"><div class="card"><div class="row" style="justify-content:space-between"><div><div class="card-title" style="font-size:17px">🖨️ Report Settimanale</div><div class="card-subtitle">Settimana ${weekLabel(m.ws,m.we)} · ${esc(nomeAgente())}</div></div><div class="row-tight"><span class="badge ${ok?'badge-green':'badge-red'}">paletto ${m.incarichi.length}/${m.target}</span><button class="btn btn-gold" onclick="stampaReportSett()">🖨️ Stampa PDF</button></div></div></div>
<div class="grid4"><div class="stat-card"><div class="stat-label">📞 Chiamate</div><div class="stat-value">${m.chiamate.length}</div></div><div class="stat-card"><div class="stat-label">🟢 Presentazioni</div><div class="stat-value">${m.presentazioni.length}</div></div><div class="stat-card"><div class="stat-label">📅 Appuntamenti</div><div class="stat-value">${m.appuntamenti.length}</div></div><div class="stat-card"><div class="stat-label">✍️ Incarichi</div><div class="stat-value">${m.incarichi.length}</div></div></div></div>`}
function metricheSett(){const ws=weekStart(new Date()),we=addDays(ws,6);const a=iso(ws),b=iso(we);
const ch=(DB.chiamate||[]).filter(x=>x.dataChiamata&&x.dataChiamata>=a&&x.dataChiamata<=b);
const inc=(DB.mandati||[]).filter(m=>{if(m.stato==='annullato')return false;const d=m.dataFirma||m.dataInizio;return d&&d>=a&&d<=b});
return{ws,we,target:(DB.obiettivi&&DB.obiettivi.incarichiSettimana)||1,chiamate:ch,presentazioni:ch.filter(x=>x.dispPresentazione==='si'),appuntamenti:(DB.appuntamenti||[]).filter(x=>x.data>=a&&x.data<=b&&x.stato!=='annullato'),incarichi:inc}}
function stampaReportSett(){const m=metricheSett();const ok=m.incarichi.length>=(DB.obiettivi&&DB.obiettivi.incarichiSettimana||1);const w=window.open('','_blank');if(!w)return;
w.document.write('<html><head><title>Report settimanale</title><style>body{font-family:Georgia,serif;padding:36px}h1{border-bottom:3px solid #c9a96e}.k{display:flex;gap:12px;margin:16px 0}.k div{flex:1;background:#f7f3ea;border:1px solid #e6dcc6;border-radius:10px;padding:12px;text-align:center}.k b{font-size:22px;display:block}</style></head><body><h1>🖨️ Report Settimanale</h1><p>'+esc(nomeAgente())+' · '+weekLabel(m.ws,m.we)+'</p><div class="k"><div><b>'+m.chiamate.length+'</b>chiamate</div><div><b>'+m.presentazioni.length+'</b>presentazioni</div><div><b>'+m.appuntamenti.length+'</b>appuntamenti</div><div><b>'+m.incarichi.length+'</b>incarichi</div></div><p style="font-style:italic">'+(ok?'🎉 Paletto rispettato!':'💪 Paletto non raggiunto: riparti lunedì.')+'</p><script>window.onload=function(){window.print()}<\/script></body></html>');w.document.close()}
function renderReportProp(c){const items=(DB.immobili||[]).filter(i=>i.proprietarioId||i.stato==='disponibile');
c.innerHTML=`<div class="stack"><div class="card"><div class="card-title" style="font-size:17px">📤 Report per i venditori</div><div class="card-subtitle">Report periodico che fidelizza il proprietario</div></div>
${items.length?`<div class="grid2">${items.map(i=>{const p=(DB.clienti||[]).find(x=>String(x.id)===String(i.proprietarioId));return`<div class="card"><div class="row" style="justify-content:space-between"><div><b>${esc(i.titolo)}</b><div style="font-size:11px;color:var(--text2)">👤 ${esc(p?p.nome+' '+p.cognome:'—')} · ${daysSince(i.dataInserimento)}gg · ${i.visite||0} visite</div></div><button class="btn btn-gold btn-sm" onclick="stampaReportProp(${i.id})">📤 Genera</button></div></div>`}).join('')}</div>`:'<div class="card"><div class="empty-state"><div class="icon">📤</div>Nessun immobile.</div></div>'}</div>`}
function stampaReportProp(id){const i=(DB.immobili||[]).find(x=>String(x.id)===String(id));if(!i)return;const p=(DB.clienti||[]).find(x=>String(x.id)===String(i.proprietarioId))||{};const w=window.open('','_blank');if(!w)return;
w.document.write('<html><head><title>Report immobile</title><style>body{font-family:Georgia,serif;padding:36px}h1{border-bottom:3px solid #c9a96e}.k{display:flex;gap:12px;margin:16px 0}.k div{flex:1;background:#f7f3ea;border:1px solid #e6dcc6;border-radius:10px;padding:12px;text-align:center}.k b{font-size:22px;display:block}</style></head><body><h1>📊 Report — '+esc(i.titolo)+'</h1><p>Gentile <b>'+esc((p.nome||'')+' '+(p.cognome||'Proprietario'))+'</b>, riepilogo al '+fmtDate(today())+'.</p><div class="k"><div><b>'+daysSince(i.dataInserimento||i.data_pubblicazione)+'</b>giorni mercato</div><div><b>'+(i.visite||0)+'</b>visite</div><div><b>'+fmtEuroShort(i.prezzo)+'</b>prezzo</div></div><p>Proseguiamo con visite e aggiornamento annunci ogni 15 giorni.</p><script>window.onload=function(){window.print()}<\/script></body></html>');w.document.close()}
/* MARKETING + STAT + IMPOSTAZIONI */
function renderMarketing(c){const t=(DB.settings&&DB.settings.waTemplates)||[];
c.innerHTML=`<div class="stack"><div class="grid2"><div class="card"><div class="card-title" style="margin-bottom:10px">💬 Template WhatsApp</div>${t.map((x,i)=>`<div style="padding:9px 0;border-bottom:1px solid var(--bg4)"><b style="font-size:12px">${esc(x.nome)}</b><div style="font-size:10px;color:var(--text2)">${esc(x.testo.slice(0,80))}…</div></div>`).join('')}</div>
<div class="card"><div class="card-title" style="margin-bottom:10px">🎯 Buone pratiche</div><div class="stack" style="gap:10px"><div class="mark-tip"><b>📸 Foto professionali</b><div style="font-size:11px;color:var(--text2)">+47% richieste di visita.</div></div><div class="mark-tip"><b>🎥 Video 60"</b><div style="font-size:11px;color:var(--text2)">3× engagement social.</div></div><div class="mark-tip"><b>📱 4+ portali</b><div style="font-size:11px;color:var(--text2)">Massima copertura.</div></div><div class="mark-tip"><b>🤝 Referral</b><div style="font-size:11px;color:var(--text2)">100€ a chi porta un cliente firmato.</div></div></div></div></div></div>`}
function renderStatistiche(c){const ct=DB.clienti||[],im=DB.immobili||[],tr=DB.trattative||[];
const chiuse=tr.filter(t=>t.fase==='conclusa'||t.fase==='rogito');const inc=sumBy(chiuse,t=>(t.prezzoOfferto||0)*(t.provvigione||0)/100);
c.innerHTML=`<div class="stack"><div class="grid4">
<div class="stat-card"><div class="stat-label">Contatti</div><div class="stat-value">${ct.length}</div></div>
<div class="stat-card"><div class="stat-label">Immobili</div><div class="stat-value">${im.length}</div></div>
<div class="stat-card"><div class="stat-label">Trattative chiuse</div><div class="stat-value">${chiuse.length}</div></div>
<div class="stat-card"><div class="stat-label">Provvigioni</div><div class="stat-value">${fmtEuroShort(inc)}</div></div>
<div class="stat-card"><div class="stat-label">Chiamate totali</div><div class="stat-value">${(DB.chiamate||[]).length}</div></div>
<div class="stat-card"><div class="stat-label">Convertiti</div><div class="stat-value">${(DB.chiamate||[]).filter(x=>x.stato==='convertito').length}</div></div>
<div class="stat-card"><div class="stat-label">Open House</div><div class="stat-value">${(DB.openhouses||[]).length}</div></div>
<div class="stat-card"><div class="stat-label">Lead</div><div class="stat-value">${(DB.leads||[]).length}</div></div></div></div>`}
function renderImpostazioni(c){const s=DB.settings||{};setTimeout(caricaStorico,0);
c.innerHTML=`<div class="stack">
<div class="card"><div class="card-title" style="margin-bottom:10px">👤 Profilo</div><div class="form-row-3">
<div class="form-group"><label class="form-label">Nome agente</label><input class="inp" value="${esc(s.agente||'')}" onchange="DB.settings.agente=this.value;save()"></div>
<div class="form-group"><label class="form-label">Agenzia</label><input class="inp" value="${esc(s.agenziaNome||'')}" onchange="DB.settings.agenziaNome=this.value;save()"></div>
<div class="form-group"><label class="form-label">Telefono</label><input class="inp" value="${esc(s.telefono||'')}" onchange="DB.settings.telefono=this.value;save()"></div></div></div>
<div class="card"><div class="card-title" style="margin-bottom:10px">🔐 Sicurezza</div><div class="form-row-3">
<div class="form-group"><label class="form-label">Password attuale</label><input type="password" id="sec-cur" class="inp"></div>
<div class="form-group"><label class="form-label">Nuova</label><input type="password" id="sec-n1" class="inp"></div>
<div class="form-group"><label class="form-label">Conferma</label><input type="password" id="sec-n2" class="inp"></div></div>
<button class="btn btn-primary btn-sm" id="sec-chg-btn" style="margin-top:10px" onclick="cambiaPassword()">🔑 Cambia password</button>
<div class="form-row-3" style="margin-top:14px">
<div class="form-group"><label class="form-label">Blocco automatico dopo</label><select class="inp" onchange="impostaAutoLock(this.value)">${[['5','5 minuti'],['15','15 minuti'],['30','30 minuti'],['60','1 ora'],['120','2 ore'],['0','Mai']].map(o=>`<option value="${o[0]}" ${String((getAuth()||{}).lockMin===undefined?15:(getAuth()||{}).lockMin)===o[0]?'selected':''}>${o[1]}</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">App sul telefono</label><button class="btn btn-ghost btn-sm" style="margin-top:18px" onclick="installaApp()">📲 Installa come app</button></div></div>
<div class="alert gold" style="margin-top:12px">🔒 <b>Accesso personale.</b> L'accesso è protetto da password (PBKDF2‑SHA256, 210.000 cicli) con blocco dopo 3 tentativi errati. Dopo il periodo di inattività scelto l'app si blocca da sola. I tuoi dati non sono condivisi con nessuno.</div></div>
${syncCardHTML()}
<div class="grid2"><div class="card"><div class="card-title" style="margin-bottom:10px">💾 Backup</div><div class="stack" style="gap:8px">
<button class="btn btn-gold" onclick="esportaBackup()">📥 Esporta backup</button>
<button class="btn btn-ghost" onclick="document.getElementById('import-file').click()">📤 Importa backup</button>
<input type="file" id="import-file" style="display:none" accept=".json" onchange="importaBackup(this.files[0])">
<button class="btn btn-danger" onclick="resetTotale()">🗑️ Reset totale</button></div></div>
<div class="card"><div class="card-title" style="margin-bottom:10px">ℹ️ Info</div><div style="font-size:12px;color:var(--text2);line-height:1.7"><b>ImmoCRM Pro v10.4.1</b><br>${(DB.clienti||[]).length} contatti · ${(DB.immobili||[]).length} immobili · ${(DB.mandati||[]).length} mandati · ${(DB.chiamate||[]).length} chiamate<br>Ultimo salvataggio: ${DB._ts?new Date(DB._ts).toLocaleString('it-IT'):'mai'}</div></div></div></div>`}
async function cambiaPassword(){const btn=document.getElementById('sec-chg-btn');
if(btn){btn.disabled=true;btn.textContent='🔄 Cambio in corso…'}
try{
const cur=document.getElementById('sec-cur').value,n1=document.getElementById('sec-n1').value,n2=document.getElementById('sec-n2').value;
if(!(await verificaPassword(cur))){showToast('Password attuale errata','error');return}
if(n1.length<6){showToast('Minimo 6 caratteri','error');return}if(n1!==n2){showToast('Non coincidono','error');return}
if(!(await aggiornaHashPassword(n1))){showToast('Cifratura non disponibile (serve HTTPS)','error');return}
const a=getAuth()||{};a.ts=Date.now();saveAuth(a);save();await sbloccoCloud(n1);
if(window.ImmoSync)ImmoSync.syncNow('password');
['sec-cur','sec-n1','sec-n2'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
showToast('🔑 Password aggiornata e dati ricifrati')
}finally{if(btn){btn.disabled=false;btn.textContent='🔑 Cambia password'}}}
function impostaAutoLock(v){const a=getAuth()||{};a.lockMin=parseInt(v,10)||0;saveAuth(a);armaLock();showToast('Blocco automatico: '+(a.lockMin?a.lockMin+' minuti':'disattivato'))}
function resetTotale(){if(!confirm('Eliminare TUTTI i dati da questo dispositivo? Se la sincronizzazione cloud è attiva i dati torneranno al prossimo sync.'))return;
if(!confirm('Conferma definitiva: cancello archivio locale, storico e sessione.'))return;
try{localStorage.removeItem(KEY);localStorage.removeItem('immocrm_snap_v1');localStorage.removeItem(AUTH_KEY);localStorage.removeItem('immocrm_ls_main');localStorage.removeItem('immocrm_ls_hist');localStorage.removeItem('immocrm_ls_key')}catch(e){}
if(window.indexedDB&&indexedDB.databases){indexedDB.databases().then(l=>{(l||[]).forEach(d=>{if(d.name==='immocrm')indexedDB.deleteDatabase('immocrm')})}).catch(()=>{})}
location.reload()}
async function installaApp(){if(window._deferredPrompt){window._deferredPrompt.prompt();const r=await window._deferredPrompt.userChoice.catch(()=>null);window._deferredPrompt=null;showToast(r&&r.outcome==='accepted'?'✅ App installata':'Installazione annullata','info');return}
const iOS=/iPhone|iPad|iPod/.test(navigator.userAgent);
showToast(iOS?'Su iPhone/iPad: tocca Condividi ⇪ poi "Aggiungi a Home"':'Su Android/PC: menu del browser → "Installa app" — oppure aggiungila ai preferiti','info',6000)}
function esportaBackup(){const out={_export:'immocrm',versione:'10.3',esportatoIl:new Date().toISOString(),dispositivo:(window.ImmoSync?ImmoSync.deviceName():''),dati:DB};
const b=new Blob([JSON.stringify(out,null,2)],{type:'application/json'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='immocrm-backup-'+today()+'.json';a.click();URL.revokeObjectURL(u);showToast('Backup scaricato ✓');if(window.ImmoSync)ImmoSync.mirror(DB)}
function importaBackup(f){if(!f)return;if(!confirm('Sovrascrivere i dati di questo dispositivo con il backup?'))return;const r=new FileReader();
r.onload=e=>{try{const d=JSON.parse(e.target.result);const dati=d&&d._export==='immocrm'?d.dati:d;if(!dati||typeof dati!=='object')throw 0;
DB=dati;window.DB=DB;_dbReady=true;initDB();
if(window.ImmoSync){ImmoSync.adopt(DB);ImmoSync.mirror(DB)}
save();render();updateBadges();showToast('Importato ✓');if(window.ImmoSync)ImmoSync.syncNow('import')}catch(x){showToast('File non valido','error')}};r.readAsText(f)}
/* ---------- PANNELLO SINCRONIZZAZIONE ---------- */
function syncCardHTML(){
if(!window.ImmoSync)return'';
const S=ImmoSync.status(),cfg=ImmoSync.config();
const stati={off:['💾','Solo questo dispositivo','var(--text2)'],idle:['⏸️','In attesa','var(--text2)'],syncing:['⏳','Sincronizzo…','var(--blue)'],ok:['✅','Sincronizzato','var(--green)'],error:['⚠️','Problema','var(--red)']};
const st=stati[S.state]||stati.off;
const off=navigator.onLine===false;
const disp=DB._devices||{};
const dispRows=Object.keys(disp).map(k=>`<div class="row" style="justify-content:space-between;padding:8px 10px;background:var(--bg2);border-radius:8px;margin-bottom:6px"><div><b class="text-sm">${esc(disp[k].name||'Dispositivo')}</b>${k===ImmoSync.deviceId()?' <span class="badge badge-green">questo</span>':''}<div style="font-size:10px;color:var(--text2)">ultimo sync ${disp[k].ts?new Date(disp[k].ts).toLocaleString('it-IT'):'—'}</div></div></div>`).join('')||'<div class="text-sm text-muted">Nessun dispositivo ha ancora sincronizzato.</div>';
return `<div class="card" id="sync-card"><div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:12px">
<div><div class="card-title" style="font-size:15px">☁️ Sincronizzazione multi‑dispositivo</div>
<div class="card-subtitle">Gli stessi dati (contatti, immobili, incroci, agenda) su PC, tablet e smartphone</div></div>
<div class="row-tight"><span class="badge" style="background:${st[2]}22;color:${st[2]}">${st[0]} ${st[1]}</span>${off?'<span class="badge badge-orange">📴 offline</span>':''}</div></div>
<div class="form-row-3">
<div class="form-group"><label class="form-label">Dove salvo i dati</label><select class="inp" id="sy-mode">
<option value="off" ${cfg.mode==='off'?'selected':''}>💾 Solo questo dispositivo</option>
<option value="gist" ${cfg.mode==='gist'?'selected':''}>☁️ Cloud personale (Gist GitHub privato)</option>
<option value="rest" ${cfg.mode==='rest'?'selected':''}>🔌 Endpoint REST personale</option></select></div>
<div class="form-group"><label class="form-label">Token GitHub <span class="text-muted">(permesso: gist)</span></label><input class="inp" id="sy-token" type="password" autocomplete="off" placeholder="ghp_…" value="${esc(cfg.token||'')}"></div>
<div class="form-group"><label class="form-label">ID archivio <span class="text-muted">(vuoto = ne creo uno)</span></label><input class="inp" id="sy-gist" placeholder="es. 3f1c…" value="${esc(cfg.gistId||'')}"></div>
<div class="form-group" style="grid-column:1/-1"><label class="form-label">Endpoint REST <span class="text-muted">(solo se usi un server tuo)</span></label><input class="inp" id="sy-rest" placeholder="https://…" value="${esc(cfg.restUrl||'')}"></div>
<div class="form-group"><label class="form-label">Controllo automatico ogni</label><select class="inp" id="sy-min">${[1,5,15,30,60].map(m=>`<option value="${m}" ${String(cfg.autoPullMin)===String(m)?'selected':''}>${m} min</option>`).join('')}</select></div>
<div class="form-group"><label class="form-label">Cifratura cloud</label><select class="inp" id="sy-enc"><option value="1" ${cfg.encrypt?'selected':''}>🔒 Attiva (AES‑256)</option><option value="0" ${!cfg.encrypt?'selected':''}>Non cifrato (sconsigliato)</option></select></div>
<div class="form-group"><label class="form-label">Nome di questo dispositivo</label><input class="inp" id="sy-dev" value="${esc(ImmoSync.deviceName()||'')}"></div></div>
<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
<button class="btn btn-gold" onclick="syncCollega()">🔗 Collega e sincronizza</button>
<button class="btn btn-primary" onclick="syncOra()">🔄 Sincronizza ora</button>
<button class="btn btn-ghost" onclick="syncScarica()">⬇️ Scarica dal cloud</button>
<button class="btn btn-ghost" onclick="syncCarica()">⬆️ Carica ora</button>
<button class="btn btn-ghost" onclick="syncSblocca()">🔑 Sblocca archivio</button>
<button class="btn btn-danger" onclick="syncScollega()">Scollega</button></div>
<div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap;align-items:flex-end">
<div class="form-group" style="flex:1;min-width:200px"><label class="form-label">📥 Codice dispositivo (dal tuo altro dispositivo — basta questo + password)</label><input class="inp" id="sy-code" placeholder="IMMOCRM1.…"></div>
<button class="btn btn-primary" onclick="usaCodiceSync()">Usa codice</button>
<button class="btn btn-ghost" onclick="mostraCodiceSync()">📤 Genera codice dispositivo</button></div>
<div id="sy-msg" style="margin-top:10px;font-size:12px;min-height:18px;color:${S.state==='error'?'var(--red)':'var(--text2)'}">${S.lastError?('⚠️ '+esc(S.lastError)):('Ultimo salvataggio nel cloud: '+(S.lastPush?new Date(S.lastPush).toLocaleString('it-IT'):'mai')+' · Ultimo controllo: '+(S.lastPull?new Date(S.lastPull).toLocaleString('it-IT'):'mai'))}</div>
<div class="divider"></div>
<div class="grid2">
<div><div class="card-title" style="margin-bottom:8px">📱 Dispositivi collegati</div>${dispRows}</div>
<div><div class="card-title" style="margin-bottom:8px">🕓 Backup automatici su questo dispositivo</div><div id="sy-hist" class="text-sm text-muted">Carico lo storico…</div></div></div>
<details style="margin-top:12px"><summary style="cursor:pointer;font-size:12px;color:var(--gold)">📖 Come si attiva in 3 minuti (guida)</summary>
<ol style="font-size:12px;line-height:1.9;padding-left:18px;margin-top:8px;color:var(--text2)">
<li>Apri <a href="https://github.com/settings/tokens/new?description=ImmoCRM&scopes=gist" target="_blank" rel="noopener" style="color:var(--primary)">github.com/settings/tokens/new</a> (devi essere collegato col tuo account GitHub).</li>
<li>Note: <code>ImmoCRM</code> · Scadenza: quella che preferisci · Spunta <b>solo</b> la casella <code>gist</code> · <b>Generate token</b>.</li>
<li>Copia il token (inizia con <code>ghp_</code> o <code>github_pat_</code>) e incollalo qui sopra nel campo <b>Token GitHub</b>.</li>
<li>Lascia vuoto <b>ID archivio</b> e premi <b>Collega e sincronizza</b>: creo io un Gist <b>privato</b> nel tuo GitHub, ci salvo i dati cifrati e ti mostro subito il <b>codice dispositivo</b>.</li>
<li>Su tablet e smartphone apri lo stesso indirizzo, inserisci la tua <b>password</b> e incolla il <b>codice dispositivo</b> (in Accesso, o qui sotto in «Usa codice»). Niente token da ricopiare.</li>
<li>Da lì in poi tutto è automatico: salvi su un dispositivo e in pochi secondi i dati (e gli incroci) arrivano sugli altri. Password e chiave di cifratura sono le stesse su tutti i tuoi dispositivi.</li>
</ol>
<div class="alert gold">🔐 Il token resta solo su questo dispositivo. Con il permesso <code>gist</code> può scrivere unicamente i tuoi archivi personali: non tocca repository né account. Se un giorno vuoi revocarlo: github.com → Settings → Developer settings → Tokens → Delete.<br>Il <b>codice dispositivo</b> contiene anche la chiave di cifratura: chi lo possiede può leggere i dati. Non condividerlo; se lo perdi, rigenerane uno dalle Impostazioni.</div>
</details></div>`}
function syncMsg(t,col){const e=document.getElementById('sy-msg');if(e){e.textContent=t;e.style.color=col||'var(--text2)'}}
async function syncCollega(){const prima=ImmoSync.config();
const eraPrimo=(prima.mode==='off'||!prima.token);
const patch={mode:document.getElementById('sy-mode').value,token:document.getElementById('sy-token').value.trim(),gistId:document.getElementById('sy-gist').value.trim(),restUrl:document.getElementById('sy-rest').value.trim(),autoPullMin:parseInt(document.getElementById('sy-min').value,10)||5,encrypt:document.getElementById('sy-enc').value==='1'};
if(patch.mode!=='off'&&!patch.token){syncMsg('⚠️ Serve il token GitHub (o REST) per collegare il cloud','var(--red)');return}
await ImmoSync.setConfig(patch);
const dev=document.getElementById('sy-dev').value.trim();if(dev)await ImmoSync.setDeviceName(dev);
if(patch.mode!=='off'&&patch.encrypt&&!ImmoSync.hasMasterKey()){
if(_cloudPass){const okk=await ImmoSync.ensureMasterKey(_cloudPass).catch(()=>false);
if(okk)syncMsg('🔐 Chiave di cifratura pronta (condivisa con gli altri dispositivi)','var(--green)');
else{syncMsg('⚠️ Cifratura attiva ma password non disponibile: premi prima "Sblocca archivio"','var(--red)');return}}
else{syncMsg('⚠️ Cifratura attiva ma password non disponibile: premi prima "Sblocca archivio"','var(--red)');return}}
syncMsg('⏳ Collegamento in corso…','var(--blue)');
const r=await ImmoSync.syncNow('collega');
if(r&&r.error){syncMsg('⚠️ '+r.error,'var(--red)');return}
if(ImmoSync.status().state==='error'){syncMsg('⚠️ '+ImmoSync.status().lastError,'var(--red)');return}
save();renderSyncPill();
syncMsg('✅ Collegato: dati salvati nel cloud e disponibili sugli altri dispositivi','var(--green)');
showToast('☁️ Sincronizzazione attiva');render();
if(eraPrimo)setTimeout(mostraCodiceSync,400)}
async function syncOra(){syncMsg('⏳ Sincronizzo…','var(--blue)');const r=await ImmoSync.syncNow('manuale');const S=ImmoSync.status();
syncMsg(S.state==='error'?('⚠️ '+S.lastError):'✅ Sincronizzato alle '+new Date().toLocaleTimeString('it-IT'),S.state==='error'?'var(--red)':'var(--green)');renderSyncPill();caricaStorico()}
async function syncScarica(){syncMsg('⏳ Scarico dal cloud…','var(--blue)');await ImmoSync.pull();const S=ImmoSync.status();
syncMsg(S.state==='error'?('⚠️ '+S.lastError):'✅ Dati cloud applicati a questo dispositivo',S.state==='error'?'var(--red)':'var(--green)');renderSyncPill();render()}
async function syncCarica(){syncMsg('⏳ Carico nel cloud…','var(--blue)');await ImmoSync.syncNow('carica');const S=ImmoSync.status();
syncMsg(S.state==='error'?('⚠️ '+S.lastError):'✅ Caricato nel cloud',S.state==='error'?'var(--red)':'var(--green)');renderSyncPill()}
async function syncSblocca(){const ok=await chiediPasswordCloud(null);if(ok){syncMsg('🔑 Chiave di cifratura pronta','var(--green)');ImmoSync.syncNow('sblocco')}return ok}
async function mostraCodiceSync(){
if(!window.ImmoSync){return}
let c=null;
try{c=await ImmoSync.connectCode({pass:(getAuth()||{}).pass||null})}catch(e){c=null}
if(!c){syncMsg('⚠️ Prima collega il cloud su questo dispositivo ("Collega e sincronizza")','var(--red)');return}
document.body.insertAdjacentHTML('beforeend',`<div class="modal-overlay" onclick="closeModal(event,this)"><div class="modal modal-sm" onclick="event.stopPropagation()"><h2>📱 Codice dispositivo</h2>
<p class="text-muted text-sm" style="margin-bottom:10px">Sullo smartphone o tablet: apri ImmoCRM, inserisci la tua <b>password</b> e incolla questo codice (in Accesso, o in Impostazioni → Sincronizzazione → "Usa codice"). Con lui basta il codice: <b>niente token</b>. Il codice contiene anche la chiave di cifratura: trattalo come la password e non condividerlo. Se cambi password o archivio, rigeneralo.</p>
<textarea class="inp" id="codice-sync" rows="5" readonly onclick="this.select()" style="font-size:11px;word-break:break-all">${c}</textarea>
<div class="modal-footer"><button class="btn btn-ghost" onclick="closeModal()">Chiudi</button><button class="btn btn-primary" onclick="copiaCodiceSync()">📋 Copia</button></div></div></div>`)}
function copiaCodiceSync(){const el=document.getElementById('codice-sync');if(!el)return;el.select();
try{document.execCommand('copy');showToast('📋 Codice copiato')}catch(e){}
if(navigator.clipboard)navigator.clipboard.writeText(el.value).then(()=>showToast('📋 Codice copiato')).catch(()=>{})}
async function usaCodiceSync(){const el=document.getElementById('sy-code');const v=el?el.value:'';
if(!window.ImmoSync){return}
if(!v.trim()){syncMsg('Incolla prima il codice dispositivo','var(--red)');return}
syncMsg('⏳ Applicazione codice…','var(--blue)');
try{
const dec=ImmoSync.decodeConnectCode(v);
await ImmoSync.applyConnectCode(v);
if(dec.pass){const a=getAuth()||{};a.pass=dec.pass;delete a.localPass;saveAuth(a);showToast('🔑 Password condivisa aggiornata','info')}
if(!ImmoSync.hasMasterKey()&&_cloudPass)await ImmoSync.ensureMasterKey(_cloudPass).catch(()=>{});
const dev=document.getElementById('sy-dev');if(dev&&dev.value.trim())await ImmoSync.setDeviceName(dev.value.trim());
syncMsg('✅ Codice applicato: allineo i dati…','var(--green)');renderSyncPill();
await ImmoSync.syncNow('codice');render();showToast('☁️ Dispositivo collegato');
if(el)el.value='';}
catch(e){syncMsg('⚠️ '+(e&&e.message?e.message:'Codice non valido'),'var(--red)')}}
function syncScollega(){if(!confirm('Scollegare il cloud? I dati restano su questo dispositivo.'))return;
ImmoSync.setConfig({mode:'off'});renderSyncPill();render();showToast('Cloud scollegato','info')}
async function caricaStorico(){const box=document.getElementById('sy-hist');if(!box||!window.ImmoSync)return;
const list=await ImmoSync.historyList();
box.innerHTML=list.length?list.map(h=>`<div class="row" style="justify-content:space-between;padding:7px 9px;background:var(--bg2);border-radius:8px;margin-bottom:6px"><div style="font-size:11px">${new Date(h.ts).toLocaleString('it-IT')}<div class="text-muted" style="font-size:10px">${Object.keys(h.counts||{}).filter(k=>h.counts[k]).map(k=>k+' '+h.counts[k]).join(' · ')||'vuoto'}</div></div><button class="btn btn-ghost btn-xs" onclick="ripristinaStorico(${h.ts})">Ripristina</button></div>`).join(''):'<div class="text-sm text-muted">Nessuno snapshot ancora: ne creo uno ogni 20 minuti di lavoro.</div>'}
async function ripristinaStorico(ts){if(!confirm('Ripristinare i dati di '+new Date(ts).toLocaleString('it-IT')+'? Le modifiche successive andranno perse su questo dispositivo.'))return;
const d=await ImmoSync.historyGet(ts);if(!d){showToast('Snapshot non disponibile','error');return}
DB=d;window.DB=DB;_dbReady=true;initDB();if(window.ImmoSync){ImmoSync.adopt(DB);ImmoSync.mirror(DB)}save();render();showToast('↩️ Backup ripristinato')}
/* MOBILE + BOOT */
function injectMobile(){if(document.getElementById('mobilenav'))return;
const n=document.createElement('div');n.id='mobilenav';
n.innerHTML=`<button class="mn-btn" onclick="go('regia')"><span class="mn-ico">🎯</span>Regia</button><button class="mn-btn" onclick="go('chiamate')"><span class="mn-ico">📞</span>Chiamate</button><button class="mn-plus" onclick="toggleQuickMenu()">+</button><button class="mn-btn" onclick="go('immobili')"><span class="mn-ico">🏠</span>Immobili</button><button class="mn-btn" onclick="go('calendario')"><span class="mn-ico">📅</span>Agenda</button>`;
document.body.appendChild(n)}
function toggleQuickMenu(){const ex=document.querySelector('.quickmenu');if(ex){ex.remove();return}
const q=document.createElement('div');q.className='quickmenu';
q.innerHTML=`<button class="qm-btn" onclick="closeQuickMenu();openContattoModal()"><span class="qm-ico">👤</span>Contatto</button><button class="qm-btn" onclick="closeQuickMenu();openImmobileModal()"><span class="qm-ico">🏠</span>Immobile</button><button class="qm-btn" onclick="closeQuickMenu();openAppModal()"><span class="qm-ico">📅</span>Appunt.</button><button class="qm-btn" onclick="closeQuickMenu();go('leads')"><span class="qm-ico">📥</span>Lead</button><button class="qm-btn" onclick="closeQuickMenu();openMandatoModal()"><span class="qm-ico">✍️</span>Mandato</button><button class="qm-btn" onclick="closeQuickMenu();openOpenHouseModal()"><span class="qm-ico">🏡</span>Open House</button>`;
document.body.appendChild(q)}
function closeQuickMenu(){const q=document.querySelector('.quickmenu');if(q)q.remove()}
function closeModal(e,el){if(e&&e.target!==e.currentTarget)return;if(el)el.remove();else document.querySelectorAll('.modal-overlay').forEach(m=>m.remove())}
window.addEventListener('error',function(ev){try{var e=document.getElementById('login-err');if(e&&ev&&ev.message)e.textContent='Errore: '+ev.message}catch(x){}});
async function bootApp(){
try{
Object.assign(RENDERERS,{
regia:renderRegia,obiettivi:renderObiettivi,chiamate:renderChiamate,dashboard:renderDashboard,
'da-fare':renderDaFare,contatti:renderContatti,immobili:renderImmobili,mandati:renderMandati,
openhouse:renderOpenHouse,pipeline:renderPipeline,mercato:renderMercato,incroci:renderIncroci,
leads:renderLeads,import:renderImport,attivita:renderAttivita,calendario:renderCalendario,
documenti:renderDocumenti,fatture:renderFatture,'report-sett':renderReportSett,
'report-prop':renderReportProp,marketing:renderMarketing,statistiche:renderStatistiche,
impostazioni:renderImpostazioni
});
if(window.ImmoSync){ImmoSync.setStorageKey(KEY);try{const b=await ImmoSync.boot();BOOT_DB=b?b.db:null}catch(e){console.warn('boot sync',e)}}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();window._deferredPrompt=e;renderSyncPill()});
if('serviceWorker' in navigator&&location.protocol!=='file:'){window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(e=>console.warn('sw',e))})}
checkLoginRequired();window.DB=DB;console.log('%c🏠 ImmoCRM Pro v10.4.1','font-size:14px;font-weight:bold;color:#c9a96e');
}catch(err){console.error(err);var e=document.getElementById('login-err');if(e)e.textContent='Errore avvio: '+(err&&err.message?err.message:err)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootApp);
else bootApp();
