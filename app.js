'use strict';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const countWords=s=>(String(s).trim().match(/\S+/gu)||[]).length;
const localKey=d=>{const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
const blankLibrary=()=>({chapters:[],settings:{sound:'plop',haptics:true,font:'serif',wordGoal:360000},dailyAdds:{}});
const fmt=n=>new Intl.NumberFormat('de-DE').format(n);
const today=()=>localKey(new Date());
const uid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():String(Date.now())+'-'+Math.random().toString(16).slice(2);

let db, library=blankLibrary(), view='list', activeID=null, focus=false, readOnly=false;
let saveTimer=null, saveQueue=Promise.resolve(), audio=null, toastTimer=null;
const app=$('#app'), topbar=$('#top'), main=$('#main'), editor=$('#editor'), footer=$('#footer'), dialog=$('#dialog');

function toast(text, ms=2500){const el=$('#toast');el.textContent=text;el.style.display='block';clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.display='none',ms)}
function updateStatus(text){if(!$('#status'))return;const c=current();if(!c)return;$('#status').innerHTML=`<span style="color:var(--accent)">${c.phase==='drafting'?'● DRAFT LOCK':'✓ REVISION'}</span><span class="push"></span><span id="save-state">${esc(text)}</span><span>· ${fmt(countWords(c.phase==='drafting'?draft(c):c.revision))} Wörter</span>`}
function markUnsaved(){const label=$('#save-state');if(label)label.textContent='Speichert …'}
function save(immediate=false){
  if(readOnly)return;
  clearTimeout(saveTimer);
  markUnsaved();
  const persist=()=>{
    // Capture a stable snapshot: later typing must not mutate an in-flight transaction.
    const snapshot=JSON.stringify(library);
    saveQueue=saveQueue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
      try{
        const tx=db.transaction('state','readwrite');
        tx.objectStore('state').put(snapshot,'library');
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('IndexedDB write failed'));
      }catch(e){reject(e)}
    })).then(()=>{const label=$('#save-state');if(label)label.textContent='Gespeichert'}).catch(e=>{
      toast('Speichern fehlgeschlagen! Bitte Text sofort exportieren.',5500);
      const label=$('#save-state');if(label)label.textContent='SPEICHERFEHLER';
      console.error(e);
    });
  };
  if(immediate)persist();else saveTimer=setTimeout(persist,300);
}
function loadDatabase(){return new Promise((resolve,reject)=>{
  const req=indexedDB.open('ForwardWriter',1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('state'))req.result.createObjectStore('state')};
  req.onerror=()=>reject(req.error);
  req.onsuccess=()=>{db=req.result;const tx=db.transaction('state','readonly');const q=tx.objectStore('state').get('library');q.onsuccess=()=>{if(q.result){try{const decoded=JSON.parse(q.result);if(!Array.isArray(decoded.chapters)||!decoded.settings||!decoded.dailyAdds)throw Error('Invalid library');library=decoded}catch(e){readOnly=true;toast('Datenfehler: Bibliothek unverändert gelassen',7000)}}resolve()};q.onerror=()=>reject(q.error)};
})}
function current(){return library.chapters.find(c=>c.id===activeID)||null}
function draft(c){return [...c.locked,c.active].join('\n')}
function wordTotal(){return library.chapters.reduce((n,c)=>n+countWords(c.phase==='drafting'?draft(c):c.revision||''),0)}
function goal(){return Math.max(1,Number(library.settings.wordGoal)||360000)}
function progressBar(n,target){const pct=n/target*100;return `<div class="goal-track" role="progressbar" aria-valuenow="${Math.min(100,Math.round(pct))}" aria-valuemin="0" aria-valuemax="100"><div style="width:${Math.min(100,pct)}%"></div></div>`}
function cleanHTML(html){const box=document.createElement('div');box.innerHTML=html;const walk=node=>{for(const child of [...node.childNodes]){if(child.nodeType===3)continue;if(child.nodeType!==1){child.remove();continue}const tag=child.tagName.toLowerCase();if(['b','strong','i','em','u','br'].includes(tag)){for(const attr of [...child.attributes])child.removeAttribute(attr.name);walk(child)}else{walk(child);child.replaceWith(...child.childNodes)}}};walk(box);return box.innerHTML}
function plainOf(html){const el=document.createElement('div');el.innerHTML=html;return el.textContent||''}
function safeParaHTML(c,i){return c.lockedHtml?.[i] ? cleanHTML(c.lockedHtml[i]) : esc(c.locked[i])}
function commitParagraph(){const c=current(),input=$('#activePara');if(!c||!input||readOnly)return;const before=draft(c),raw=input.innerHTML,html=cleanHTML(raw),text=plainOf(html);c.lockedHtml??=[];c.lockedHtml.push(html);c.locked.push(text);c.active='';c.activeHtml='';recordWords(before,draft(c));touch(c);save(true);renderEditor({focusEditor:true});if(text.trim())play();}
function syncActive(){const c=current(),input=$('#activePara');if(!c||!input)return;const before=draft(c);c.activeHtml=cleanHTML(input.innerHTML);c.active=input.textContent||'';recordWords(before,draft(c));touch(c);updateStatus('Speichert …');save()}
function formatActive(cmd){const input=$('#activePara');if(!input)return;input.focus();document.execCommand(cmd,false,null);syncActive()}

function recordWords(before,after){const delta=Math.max(0,countWords(after)-countWords(before));if(delta)library.dailyAdds[today()]=(library.dailyAdds[today()]||0)+delta}
function touch(c){c.updated=new Date().toISOString()}

async function start(){
  try{await loadDatabase()}catch(e){readOnly=true;toast('Speicher nicht verfügbar – Schreiben deaktiviert',7000)}
  applyFont();render();
  if('serviceWorker' in navigator && window.isSecureContext){navigator.serviceWorker.register('./sw.js').catch(()=>{})}
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&saveTimer){clearTimeout(saveTimer);save(true)}});
  window.addEventListener('pagehide',()=>{if(saveTimer){clearTimeout(saveTimer);save(true)}});
}
function go(newView,id=null){view=newView;if(id)activeID=id;focus=false;render();window.scrollTo(0,0)}

function render(){
  app.classList.toggle('focus',focus);
  const isEditor=view==='editor'&&!!current();
  main.style.display=isEditor?'none':'block';editor.style.display=isEditor?'flex':'none';footer.style.display=isEditor?'none':'flex';
  if(isEditor){renderEditor();return}
  topbar.innerHTML=`<strong>Forward</strong><span class="push"></span>${view==='list'?'<button class="iconbtn" data-act="create" aria-label="Neues Kapitel">＋</button>':''}`;
  if(view==='list')renderList();
  if(view==='stats')renderStats();
  if(view==='settings')renderSettings();
  footer.innerHTML=[['list','▤ Kapitel'],['stats','▥ Statistik'],['settings','⚙ Optionen']].map(([id,label])=>`<button data-go="${id}" class="${view===id?'selected':''}">${label}</button>`).join('');
}
function renderList(){
  const chapters=[...library.chapters].sort((a,b)=>new Date(b.updated)-new Date(a.updated));
  main.innerHTML=`<div class="intro"><div class="eyebrow">Write first. Edit later.</div><h1>Ein Absatz.<br>Ein Schritt vorwärts.</h1><p>Schreib weiter, ohne zurückzuspringen. Jeder neue Absatz sichert den vorherigen.</p></div>
  <section class="surface" style="margin-bottom:20px"><div class="row"><span class="eyebrow">Romanfortschritt</span><span class="push"></span><strong>${(wordTotal()/goal()*100).toFixed(2)} %</strong></div>${progressBar(wordTotal(),goal())}<div class="row small muted"><span>${fmt(wordTotal())} / ${fmt(goal())} Wörter</span><span class="push"></span><span>${fmt(Math.max(0,goal()-wordTotal()))} verbleibend</span></div></section>${chapters.length?`<section class="cards">${chapters.map(c=>`<button class="surface chapter" data-open="${esc(c.id)}"><div class="row"><i class="dot ${c.phase==='drafting'?'':'grey'}"></i><span class="eyebrow">${c.phase==='drafting'?'Entwurf':'Revision'}</span><span class="push"></span><span class="small muted">${new Date(c.updated).toLocaleDateString('de-DE',{day:'numeric',month:'short'})}</span></div><h2>${esc(c.title)}</h2><div class="row small muted"><span>${fmt(countWords(c.phase==='drafting'?draft(c):c.revision))} Wörter · ${(countWords(c.phase==='drafting'?draft(c):c.revision)/goal()*100).toFixed(2)} % vom Ziel</span><span class="push"></span><span>↗</span></div></button>`).join('')}</section>`:
  `<div class="surface"><div style="font-size:30px;color:var(--accent)">▰</div><h2 style="margin:16px 0 8px">Deine erste Seite wartet.</h2><p>Lege ein Kapitel an. Der aktuelle Absatz bleibt bearbeitbar, alle früheren werden nach Return gesperrt.</p><button class="button primary full" data-act="create">Kapitel erstellen</button></div>`}
  <p class="small" style="text-align:center;margin-top:30px">Lokal gespeichert · Keine Anmeldung erforderlich</p>`;
}

function renderEditor({focusEditor=false,cursor=null}={}){
  const c=current();if(!c){go('list');return}
  topbar.innerHTML=`<button class="iconbtn" data-go="list" aria-label="Zurück zu Kapiteln">←</button><strong>${esc(focus?'Fokus':c.title)}</strong><span class="push"></span><button class="iconbtn" data-act="focus" aria-label="Fokusmodus">${focus?'Fokus aus':'⤢'}</button>${focus?'':`<button class="iconbtn" data-act="editor-menu" aria-label="Kapitelmenü">•••</button>`}`;
  updateStatus('Gespeichert');
  if(c.phase==='drafting'){
    $('#paper').innerHTML=`<div class="eyebrow" style="margin-bottom:27px">🔒 Absatz ${String(c.locked.length+1).padStart(2,'0')}</div>${c.locked.map((p,i)=>`<p class="locked" aria-label="Gesperrter Absatz">${p?safeParaHTML(c,i):'&nbsp;'}</p>`).join('')}
      <div id="activePara" contenteditable="${readOnly?'false':'true'}" role="textbox" aria-multiline="false" data-placeholder="Schreib den nächsten Absatz …" aria-label="Bearbeitbarer aktueller Absatz" spellcheck="true"></div>`;
    const input=$('#activePara');input.innerHTML=cleanHTML(c.activeHtml??esc(c.active));
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(!e.isComposing)commitParagraph()}});
    input.addEventListener('beforeinput',e=>{if(e.inputType==='insertParagraph'||e.inputType==='insertLineBreak'){e.preventDefault();commitParagraph()}});
    input.addEventListener('paste',e=>{e.preventDefault();const text=(e.clipboardData||window.clipboardData).getData('text/plain').replace(/[\r\n]+/g,' ');document.execCommand('insertText',false,text);syncActive()});
    input.addEventListener('input',()=>syncActive());
    input.addEventListener('blur',()=>{if(saveTimer){save(true)}});
    $('#editor-actions').innerHTML=`<button class="button" data-act="bold" aria-label="Fett"><b>B</b></button><button class="button" data-act="italic" aria-label="Kursiv"><i>I</i></button><button class="button" data-act="underline" aria-label="Unterstreichen"><u>U</u></button><button class="button" data-act="marker" ${readOnly?'disabled':''}>♧ Marker</button><button class="iconbtn muted" data-act="markers">${c.markers.length?'('+c.markers.length+')':'Liste'}</button><span class="push"></span><button class="button primary" data-act="finish" ${readOnly?'disabled':''}>✓ Abschließen</button>`;
    if(focusEditor){input.focus();input.scrollIntoView({block:'nearest'})}
  }else{
    $('#paper').innerHTML='<div class="eyebrow" style="margin-bottom:26px">Freie Überarbeitung · Original bleibt erhalten</div><textarea id="revision" aria-label="Bearbeitbare Revision" spellcheck="true"></textarea>';
    const input=$('#revision');input.value=c.revision;input.disabled=readOnly;grow(input);
    input.addEventListener('input',()=>{c.revision=input.value;touch(c);grow(input);updateStatus('Speichert …');save()});
    input.addEventListener('blur',()=>{if(saveTimer)save(true)});
    $('#editor-actions').innerHTML='<button class="button" data-act="original">◧ Original</button><button class="button" data-act="markers">♧ Marker</button><span class="push"></span><button class="button primary" data-act="export">⇧ Export</button>';
  }
}
function grow(input){input.style.height='auto';input.style.height=Math.max(185,input.scrollHeight+8)+'px'}
function onDraftInput(input){
  const c=current();if(!c||c.phase!=='drafting'||readOnly)return;
  const value=input.value.replace(/\r\n?/g,'\n'), previous=draft(c);
  if(value.includes('\n')){
    const insertionPoint=input.selectionStart;
    const prefix=value.slice(0,insertionPoint);
    const parts=value.split('\n');
    const committed=parts.slice(0,-1);
    const last=parts[parts.length-1];
    c.locked.push(...committed);
    c.active=last;
    recordWords(previous,draft(c));touch(c);save(true);
    const newCursor=prefix.split('\n').at(-1).length;
    const meaningful=committed.some(x=>x.trim().length>0);
    renderEditor({focusEditor:true,cursor:newCursor});
    if(meaningful)play(c.locked.length);
  }else{
    c.active=value;recordWords(previous,draft(c));touch(c);grow(input);updateStatus('Speichert …');save();
  }
}
function play(){
  const setting=library.settings;
  if(setting.sound==='off')return;
  // Reuse a pooled audio element but retrigger from the beginning for rapid paragraphs.
  try{if(!audio||audio.dataset.sound!==setting.sound){audio=new Audio(setting.sound+'.wav');audio.dataset.sound=setting.sound;audio.volume=setting.sound==='thud'?.75:.72}audio.currentTime=0;audio.play().catch(()=>{})}catch(e){}
}
function renderStats(){
  const counts=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return {day:d,count:library.dailyAdds[localKey(d)]||0}});
  const total=library.chapters.reduce((n,c)=>n+countWords(draft(c)),0);
  const completed=library.chapters.filter(c=>c.phase==='revising').length;
  const week=counts.reduce((n,c)=>n+c.count,0),peak=Math.max(1,...counts.map(c=>c.count));
  let day=new Date(),streak=0;if(!(library.dailyAdds[today()]||0))day.setDate(day.getDate()-1);
  while(streak<366&&(library.dailyAdds[localKey(day)]||0)>0){streak++;day.setDate(day.getDate()-1)}
  const card=(name,value,caption)=>`<div class="surface"><div class="eyebrow">${name}</div><div class="stat-num">${fmt(value)}</div><div class="muted small">${caption}</div></div>`;
  main.innerHTML=`<div class="intro"><div class="eyebrow">Dein Fortschritt</div><h1>Wörter, nicht Perfektion.</h1></div><section class="surface" style="margin-bottom:18px"><div class="row"><span class="eyebrow">Gesamtziel</span><span class="push"></span><strong>${(wordTotal()/goal()*100).toFixed(2)} %</strong></div>${progressBar(wordTotal(),goal())}<p class="small muted">${fmt(wordTotal())} von ${fmt(goal())} Wörtern · ${fmt(Math.max(0,goal()-wordTotal()))} verbleibend</p></section><div class="stat-grid">${card('Heute',library.dailyAdds[today()]||0,'neue Wörter')}${card('7 Tage',week,'neue Wörter')}${card('Rohfassungen',total,'Wörter im Entwurf')}${card('Abgeschlossen',completed,'von '+library.chapters.length+' Kapiteln')}</div>
  <section class="surface" style="margin-top:20px"><div class="row"><div class="eyebrow">Letzte 7 Tage</div><span class="push"></span><span class="small" style="color:var(--accent)">${streak} ${streak===1?"Tag":"Tage"} Serie</span></div>
  <div class="bars">${counts.map(c=>`<div class="bar-cell"><small>${c.count||'–'}</small><div class="bar ${!c.count?'empty':''}" style="height:${Math.max(5,Math.round(c.count/peak*95))}px"></div><span>${c.day.toLocaleDateString('de-DE',{weekday:'short'}).replace('.','')}</span></div>`).join('')}</div></section>
  <p class="notice">Gezählt werden neue Wörter beim Drafting. Korrekturen im aktuellen Absatz können die Tageszahl leicht erhöhen. Revisionen zählen nicht.</p>`;
}
function renderSettings(){
  const s=library.settings;
  main.innerHTML=`<div class="intro"><div class="eyebrow">Dein Schreibritual</div><h1>Mach jeden Absatz spürbar.</h1></div>
  <section class="surface"><div class="eyebrow" style="margin-bottom:17px">Absatz-Sound</div><label for="sound">Klang</label><select id="sound" ${readOnly?'disabled':''}><option value="plop">Plop</option><option value="thud">Thud</option><option value="off">Aus</option></select><div class="row" style="margin:19px 0"><span>Haptisches Feedback (nur native iOS-App)</span><span class="push"></span><span class="small muted">nur nativ</span></div><button class="button" data-act="test-sound">▶ Klang testen</button></section>
  <section class="surface" style="margin-top:16px"><div class="eyebrow" style="margin-bottom:15px">Schrift & Romanziel</div><label for="font">Leseschrift</label><select id="font"><option value="serif">Serife (Georgia)</option><option value="sans">Sans Serif (System)</option><option value="mono">Monospace</option></select><label for="wordGoal" style="margin-top:16px">Geplante Gesamtwortzahl</label><input id="wordGoal" type="number" min="1" step="1000" style="width:100%;background:var(--raised);border:1px solid var(--rule);color:var(--text);border-radius:10px;padding:13px"><p class="notice">Alle Kapitel zählen zum Gesamtziel, auch unfertige. Revisionen ersetzen die Entwurfswortzahl.</p></section><section class="surface" style="margin-top:16px"><div class="eyebrow" style="margin-bottom:15px">So funktioniert die Sperre</div><p>1. Der aktuelle Absatz bleibt editierbar.<br>2. Return sperrt den vorherigen Absatz.<br>3. Kapitelabschluss archiviert den Originaltext und öffnet eine freie Revisionsfassung.</p></section>
  <section class="surface" style="margin-top:16px"><div class="eyebrow" style="margin-bottom:15px">Datensicherheit</div><p>✓ Lokale Speicherung per IndexedDB<br>✓ Offline nach Installation über HTTPS<br>✓ TXT-, Markdown- und DOCX-Export<br>✓ Bibliothek als JSON sichern und wiederherstellen</p><p class="notice">Browserdaten können durch das Löschen von Websitedaten, private Modi oder Gerätewechsel verloren gehen. Exportiere regelmäßig Sicherungen.</p><div class="row" style="flex-wrap:wrap"><button class="button" data-act="backup">Bibliothek sichern</button><button class="button" data-act="restore" ${readOnly?'disabled':''}>Backup einlesen</button></div></section>
  <p class="small" style="text-align:center;margin:30px">FORWARD · iOS Web · 1.1</p>`;
  $('#sound').value=s.sound;$('#font').value=s.font||'serif';$('#wordGoal').value=goal();$('#font').onchange=e=>{s.font=e.target.value;applyFont();save(true)};$('#wordGoal').onchange=e=>{s.wordGoal=Math.max(1,Math.floor(Number(e.target.value)||360000));e.target.value=s.wordGoal;save(true);toast('Wortziel gespeichert')};
  $('#sound').onchange=e=>{s.sound=e.target.value;audio=null;save(true);toast('Klang gespeichert')};
}

function applyFont(){document.documentElement.dataset.font=library.settings.font||'serif'}
function showDialog(title,content,buttons){
  $('#dialog-body').innerHTML=`<h2>${esc(title)}</h2>${content}<div class="actions" id="dialog-actions"></div>`;
  for(const b of buttons){
    const el=document.createElement('button');el.type='button';el.className='button'+(b.primary?' primary':'')+(b.danger?' danger':'');el.textContent=b.label;
    el.onclick=()=>b.run();$('#dialog-actions').append(el);
  }
  dialog.showModal();
}
function closeDialog(){dialog.close()}
function promptCreate(){
  showDialog('Neues Kapitel','<label for="chapterName">Kapiteltitel</label><input type="text" id="chapterName" maxlength="180" placeholder="z. B. Chapter 29 — ..."><p class="notice">Der erste Absatz ist sofort frei editierbar.</p>',[
    {label:'Abbrechen',run:closeDialog},
    {label:'Entwurf starten',primary:true,run:()=>{
      if(readOnly)return;const name=$('#chapterName').value.trim()||'Unbenanntes Kapitel',now=new Date().toISOString();
      const c={id:uid(),title:name,created:now,updated:now,completed:null,phase:'drafting',locked:[],active:'',original:null,revision:null,markers:[]};
      library.chapters.unshift(c);save(true);closeDialog();go('editor',c.id);
    }}
  ]);
  $('#chapterName').focus();
}
function promptMarker(){const c=current();if(!c||c.phase!=='drafting')return;
  showDialog('Revisionsmarker',`<div class="eyebrow" style="margin-bottom:13px">Absatz ${c.locked.length+1}</div><label for="note">Was möchtest du später ändern?</label><textarea class="notes" rows="4" id="note" placeholder="z. B. Dialog kürzen …"></textarea><p class="notice">Der Marker ist separat. Er verändert den Entwurf nicht.</p>`,[
    {label:'Abbrechen',run:closeDialog},
    {label:'Merken',primary:true,run:()=>{const note=$('#note').value.trim();if(!note)return toast('Notiz eingeben');c.markers.push({id:uid(),paragraph:c.locked.length+1,note,created:new Date().toISOString()});touch(c);save(true);closeDialog();renderEditor();toast('Marker hinzugefügt')}}
  ]);
  $('#note').focus();
}
function showMarkers(){const c=current();if(!c)return;
  const content=c.markers.length?`<div style="max-height:55dvh;overflow:auto">${c.markers.map((m,i)=>`<div style="padding:12px 0;border-bottom:1px solid var(--rule)"><div class="eyebrow">Absatz ${m.paragraph}</div><p style="color:var(--text);margin:8px 0">${esc(m.note)}</p><button class="iconbtn small" data-removemarker="${esc(m.id)}">Löschen</button></div>`).join('')}</div>`:'<p>Hier erscheinen deine Revisionsmarker.</p>';
  showDialog('Revisionsmarker',content,[{label:'Schließen',run:closeDialog}]);
}
function showOriginal(){const c=current();if(!c)return;showDialog('Originalentwurf',`<div class="eyebrow">Unveränderbares Archiv</div><pre>${esc(c.original??draft(c))}</pre>`,[{label:'Schließen',run:closeDialog},{label:'Export',primary:true,run:()=>{closeDialog();promptExport(true)}}])}
function promptFinish(){const c=current();if(!c||c.phase!=='drafting')return;
  showDialog('Ersten Entwurf abschließen?',`<p>Dieser Schritt ist endgültig. Der vollständige Originaltext wird archiviert, und du kannst eine separate Revisionsfassung frei bearbeiten.</p><p class="notice">${fmt(countWords(draft(c)))} Wörter · ${c.locked.length+1} Absätze</p>`,[
    {label:'Weiter schreiben',run:closeDialog},
    {label:'Abschließen',primary:true,run:()=>{c.original=draft(c);c.revision=c.original;c.phase='revising';c.completed=new Date().toISOString();touch(c);save(true);closeDialog();renderEditor()}}
  ]);
}
function promptMenu(){const c=current();if(!c)return;
  showDialog('Kapiteloptionen',`<p class="small">${esc(c.title)}</p>`,[
    {label:'Schließen',run:closeDialog},
    {label:'Umbenennen',run:()=>{closeDialog();showDialog('Kapitel umbenennen',`<label>Titel</label><input type="text" id="rename" value="${esc(c.title)}" maxlength="180">`,[{label:'Abbrechen',run:closeDialog},{label:'Speichern',primary:true,run:()=>{const name=$('#rename').value.trim();if(name){c.title=name;touch(c);save(true);closeDialog();renderEditor()}}}]);$('#rename').focus()}},
    {label:'Exportieren',run:()=>{closeDialog();promptExport(false)}},
    ...(c.phase==='revising'?[{label:'Original lesen',run:()=>{closeDialog();showOriginal()}}]:[]),
    {label:'Löschen',danger:true,run:()=>{closeDialog();promptDelete()}}
  ]);
}
function promptDelete(){const c=current();if(!c)return;
  showDialog('Kapitel endgültig löschen?',`<p><strong>${esc(c.title)}</strong> mit Original, Revision und Markern wird gelöscht. Dies kann nicht rückgängig gemacht werden.</p>`,[{label:'Abbrechen',run:closeDialog},{label:'Löschen',danger:true,run:()=>{library.chapters=library.chapters.filter(x=>x.id!==c.id);save(true);closeDialog();go('list')}}]);
}
function promptExport(original=false){
  showDialog(original?'Original exportieren':'Kapitel exportieren',`<label for="format">Format</label><select id="format"><option value="txt">Text (.txt)</option><option value="md">Markdown (.md)</option><option value="docx">Word (.docx)</option></select><p class="notice">Die Datei kann über iOS Safari in „Dateien“ gesichert oder geteilt werden.</p>`,[
    {label:'Abbrechen',run:closeDialog},
    {label:'Datei erstellen',primary:true,run:()=>{const format=$('#format').value;closeDialog();try{exportChapter(current(),format,original);toast('Export vorbereitet')}catch(e){console.error(e);toast('Export fehlgeschlagen',4000)}}}
  ]);
}

function formatBody(c,original){return original?(c.original??draft(c)):(c.phase==='drafting'?draft(c):c.revision)}
function filename(s){return (s.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').trim().slice(0,65)||'Kapitel')}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),120000)}
function exportChapter(c,format,original=false){if(!c)return;const body=formatBody(c,original);let blob;const base=filename(c.title)+(original?'_Original':'');
  if(format==='txt')blob=new Blob([c.title+'\n\n'+body+'\n'],{type:'text/plain;charset=utf-8'});
  else if(format==='md')blob=new Blob(['# '+c.title+'\n\n'+body.split('\n').join('\n\n')+'\n'],{type:'text/markdown;charset=utf-8'});
  else blob=new Blob([docx(c.title,body)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  downloadBlob(blob,base+'.'+format);
}
function backupLibrary(){downloadBlob(new Blob([JSON.stringify(library,null,2)],{type:'application/json'}),'Forward_Bibliothek_'+today()+'.json')}
function restoreLibrary(){
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{
    const file=input.files?.[0];if(!file)return;
    try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.chapters)||!parsed.settings||!parsed.dailyAdds)throw Error('wrong schema');
      if(!confirm('Die bestehende Bibliothek vollständig durch dieses Backup ersetzen?'))return;
      library=parsed;save(true);go('list');toast('Bibliothek wiederhergestellt');
    }catch(e){toast('Ungültige JSON-Sicherung',4500)}
  };input.click();
}

const enc=new TextEncoder();
function xml(s){return String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function docx(title,body){
  const types='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>';
  const rels='<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  const para=s=>`<w:p><w:r><w:t xml:space="preserve">${xml(s)}</w:t></w:r></w:p>`;
  const document=`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${para(title)}${body.split('\n').map(para).join('')}<w:sectPr/></w:body></w:document>`;
  return zip([['[Content_Types].xml',types],['_rels/.rels',rels],['word/document.xml',document]]);
}
const u16=(v)=>[v&255,(v>>>8)&255],u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function zip(files){const local=[],central=[];let offset=0;
  for(const [name,text] of files){const n=enc.encode(name),b=enc.encode(text),sz=b.length,check=crc(b);
    const lh=new Uint8Array([80,75,3,4,...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(check),...u32(sz),...u32(sz),...u16(n.length),...u16(0),...n]);
    local.push(lh,b);const dh=new Uint8Array([80,75,1,2,...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(check),...u32(sz),...u32(sz),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]);central.push(dh);offset+=lh.length+b.length;
  }
  const csize=central.reduce((n,a)=>n+a.length,0);const end=new Uint8Array([80,75,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(csize),...u32(offset),...u16(0)]);
  const chunks=[...local,...central,end],length=chunks.reduce((n,a)=>n+a.length,0),result=new Uint8Array(length);let position=0;
  for(const a of chunks){result.set(a,position);position+=a.length}return result;
}

document.addEventListener('click',e=>{
  const button=e.target.closest('[data-act],[data-go],[data-open],[data-removemarker]');if(!button)return;
  if(button.dataset.go){go(button.dataset.go);return}
  if(button.dataset.open){go('editor',button.dataset.open);return}
  if(button.dataset.removemarker){const c=current();c.markers=c.markers.filter(m=>m.id!==button.dataset.removemarker);touch(c);save(true);closeDialog();showMarkers();renderEditor();return}
  switch(button.dataset.act){
    case'create':promptCreate();break;
    case'bold':formatActive('bold');break;
    case'italic':formatActive('italic');break;
    case'underline':formatActive('underline');break;
    case'focus':focus=!focus;app.classList.toggle('focus',focus);renderEditor();break;
    case'marker':promptMarker();break;
    case'markers':showMarkers();break;
    case'finish':promptFinish();break;
    case'original':showOriginal();break;
    case'editor-menu':promptMenu();break;
    case'export':promptExport(false);break;
    case'test-sound':play();break;
    case'backup':backupLibrary();break;
    case'restore':restoreLibrary();break;
  }
});
start();
