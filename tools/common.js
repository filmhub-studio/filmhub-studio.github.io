/* Film Hub — shared helpers for every tool.
   Data lives in this browser (localStorage), one record per project per tool:
   fh:projects  → [{id,name,created}]   fh:current → project id   fh:data:<pid>:<tool> → JSON */
(function(){
'use strict';
const LS = {
  get(k, d=null){ try{ const v=localStorage.getItem(k); return v==null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){} }
};
const uid = () => Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc = s => String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function projects(){ let p=LS.get('fh:projects', []); if(!Array.isArray(p)||!p.length){ p=[{id:uid(), name:'My first project', created:Date.now()}]; LS.set('fh:projects', p); LS.set('fh:current', p[0].id); } return p; }
function currentId(){ const ps=projects(); let c=LS.get('fh:current'); if(!ps.some(p=>p.id===c)){ c=ps[0].id; LS.set('fh:current', c); } return c; }
function currentProject(){ return projects().find(p=>p.id===currentId()); }
function key(tool, pid){ return `fh:data:${pid||currentId()}:${tool}`; }

let saveTimers={}, lastSaved={}, watched=new Set();
// theme (dark / light) shared by every page
function applyTheme(){ document.documentElement.dataset.theme=LS.get('fh:theme','dark'); const p=LS.get('fh:pal','oxblood'); if(p&&p!=='oxblood') document.documentElement.dataset.pal=p; else delete document.documentElement.dataset.pal; }
applyTheme(); window.addEventListener('storage', e=>{ if(e.key==='fh:theme'||e.key==='fh:pal') applyTheme(); });
// someone else (a collaborator, through the hub's cloud sync) changed this tool's data
window.addEventListener('storage', e=>{ if(!e.key||!e.key.startsWith('fh:data:')) return; const tool=e.key.split(':').pop(); if(!watched.has(tool)||e.key!==key(tool)) return; if(e.newValue===lastSaved[tool]) return;
  const busy=document.activeElement&&['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
  if(!busy){ location.reload(); return; }
  if(!document.getElementById('fh-remote')){ const b=document.createElement('div'); b.className='banner no-print'; b.id='fh-remote'; b.innerHTML='<b>Updated by a collaborator.</b><span class="spacer"></span><button class="btn sm accent" onclick="location.reload()">Show their changes</button>'; const top=document.querySelector('.fh-top'); top?top.after(b):document.body.prepend(b); } });
const FH = {
  LS, uid, esc, $, $$,
  projects, currentId, currentProject,
  load(tool, def){ watched.add(tool); const v=LS.get(key(tool)); return v==null ? (typeof def==='function'?def():JSON.parse(JSON.stringify(def))) : v; },
  save(tool, data, quiet){ clearTimeout(saveTimers[tool]); FH.state('Saving…'); saveTimers[tool]=setTimeout(()=>{ const ok=LS.set(key(tool), data); try{ lastSaved[tool]=localStorage.getItem(key(tool)); }catch(e){} const p=currentProject(); LS.set('fh:touched:'+p.id+':'+tool, Date.now()); FH.state(ok?(FH.isCloud()?'● Saved · syncing':'● Saved'):'Not saved · storage full — use Backup'); }, quiet?0:350); },
  isCloud(){ const p=currentProject(); return !!(p&&p.cloud); },
  openTool(id){ try{ if(window.self!==window.top){ parent.postMessage({fh:'open', id},'*'); return; } }catch(e){} location.href=id+'.html'; },
  touched(tool, pid){ return LS.get('fh:touched:'+(pid||currentId())+':'+tool, 0); },
  state(t){ const el=$('#fh-state'); if(el) el.textContent=t; },
  onProjectChange(cb){ window.addEventListener('storage', e=>{ if(e.key==='fh:current'||e.key==='fh:projects') cb(); }); },

  // Standard top bar
  header({kicker, name, actions='', help=''}){
    const p=currentProject();
    const bar=document.createElement('header'); bar.className='fh-top no-print';
    bar.innerHTML=`<a class="btn back" href="../index.html">← Hub</a><div class="fh-title"><span class="fh-kicker">${esc(kicker||'')}</span><span class="fh-name">${esc(name)}</span></div><span class="fh-proj" title="Current project — change it on the Hub">PROJECT · <b id="fh-pname">${esc(p.name)}</b></span><div class="spacer"></div><span class="fh-state" id="fh-state">${p.cloud?'☁ Shared project':'● Saved in this browser'}</span><div class="fh-acts">${actions}${help?'<button class="fh-help" id="fh-helpbtn" title="How this tool works">?</button>':''}</div>`;
    document.body.prepend(bar);
    try{ if(window.self!==window.top) document.body.classList.add('in-hub'); }catch(e){ document.body.classList.add('in-hub'); }
    if(!$('#fh-modal')){ const m=document.createElement('div'); m.className='modal-bg'; m.id='fh-modal'; m.innerHTML='<div class="modal" id="fh-modal-box"></div>'; document.body.appendChild(m); m.addEventListener('click',e=>{ if(e.target===m) FH.close(); }); const t=document.createElement('div'); t.id='fh-toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
    if(help) setTimeout(()=>{ const hb=document.getElementById('fh-helpbtn'); if(hb) hb.onclick=()=>FH.modal(`<h3>How ${esc(name)} works</h3>${help}<div class="acts"><button class="btn accent" onclick="FH.close()">Got it</button></div>`); },0);
    return bar;
  },
  toast(msg){ const t=$('#fh-toast'); if(!t) return; t.textContent=msg; t.classList.add('show'); clearTimeout(FH._tt); FH._tt=setTimeout(()=>t.classList.remove('show'),3200); },
  modal(html, wide){ const b=$('#fh-modal-box'); b.className='modal'+(wide?' wide':''); b.innerHTML=html; $('#fh-modal').classList.add('show'); return b; },
  close(){ $('#fh-modal').classList.remove('show'); },
  confirm(title, text, ok, fn){ FH.modal(`<h3>${esc(title)}</h3><p>${esc(text)}</p><div class="acts"><button class="btn" onclick="FH.close()">Cancel</button><button class="btn accent" id="fh-ok">${esc(ok)}</button></div>`); $('#fh-ok').onclick=()=>{ FH.close(); fn(); }; },
  prompt(title, label, val, fn, okText='Save'){ FH.modal(`<h3>${esc(title)}</h3><div class="field"><label>${esc(label)}</label><input type="text" id="fh-in" value="${esc(val||'')}"></div><div class="acts"><button class="btn" onclick="FH.close()">Cancel</button><button class="btn accent" id="fh-ok">${esc(okText)}</button></div>`); const i=$('#fh-in'); i.focus(); i.select(); const go=()=>{ const v=i.value.trim(); FH.close(); fn(v); }; $('#fh-ok').onclick=go; i.onkeydown=e=>{ if(e.key==='Enter') go(); }; },

  // Downloads work on your own site (Netlify). Where the browser blocks them, show the text to copy instead.
  download(name, data, mime='text/plain'){
    try{ const blob=data instanceof Blob?data:new Blob([data],{type:mime}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),15000); FH.toast('Downloaded '+name); }
    catch(e){ FH.copyBox('Copy '+name, typeof data==='string'?data:''); }
  },
  copyBox(title, text){ FH.modal(`<h3>${esc(title)}</h3><p>Copy this and paste it where you need it.</p><textarea readonly id="fh-copy">${esc(text)}</textarea><div class="acts"><button class="btn" id="fh-cp">Copy</button><button class="btn accent" onclick="FH.close()">Done</button></div>`); $('#fh-cp').onclick=()=>FH.copy(text); },
  copy(text){ navigator.clipboard.writeText(text).then(()=>FH.toast('Copied.'),()=>{ const t=$('#fh-copy'); if(t){ t.select(); } FH.toast('Select the text and press Ctrl/Cmd+C.'); }); },
  csv(rows){ return rows.map(r=>r.map(v=>{ v=String(v??''); return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v; }).join(',')).join('\n'); },
  // Print / PDF: opens the browser's print dialog for a clean sheet (choose "Save as PDF").
  print(html, title){
    let area=$('#fh-print'); if(!area){ area=document.createElement('div'); area.id='fh-print'; document.body.appendChild(area); const st=document.createElement('style'); st.textContent='#fh-print{display:none}@media print{body>*:not(#fh-print){display:none!important}#fh-print{display:block!important}}'; document.head.appendChild(st); }
    area.innerHTML=`<div class="sheet">${html}</div>`; const old=document.title; if(title) document.title=title;
    try{ window.print(); }catch(e){} document.title=old;
    setTimeout(()=>{ if(document.hasFocus && !matchMedia('print').matches){} },100);
  },
  previewSheet(html, title){ const b=FH.modal(`<h3>${esc(title)}</h3><div style="max-height:60vh;overflow:auto;margin:10px 0"><div class="sheet">${html}</div></div><div class="acts"><button class="btn" onclick="FH.close()">Close</button><button class="btn accent" id="fh-pr">Print / Save PDF</button></div>`, true); $('#fh-pr').onclick=()=>{ FH.close(); FH.print(html, title); }; },
  fileToDataURL(f, max=1400, q=.85){ return new Promise((res,rej)=>{ const url=URL.createObjectURL(f); const im=new Image(); im.onload=()=>{ const k=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)); const c=document.createElement('canvas'); c.width=Math.round(im.naturalWidth*k); c.height=Math.round(im.naturalHeight*k); c.getContext('2d').drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg',q)); }; im.onerror=e=>{ URL.revokeObjectURL(url); rej(e); }; im.src=url; }); },
  money(n, cur){ cur=cur||FH.LS.get('fh:currency','£'); return cur+(Math.round((+n||0)*100)/100).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); },
  fmtDate(d){ if(!d) return ''; const x=new Date(d+'T12:00'); return isNaN(x)?d:x.toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'}); },
};

/* ---------- Editable grouped table ----------
   cfg: {columns:[{key,label,type:'text|long|num|money|select|date|time|check|calc',options,width,calc(row,g),sum}],
         grouped, groupWord, newRow(), newGroup(n), rowStyle(row), onChange(data), sumLabel} */
FH.Table = class {
  constructor(el, data, cfg){ this.el=el; this.cfg=cfg; this.data=data; if(!Array.isArray(this.data.groups)) this.data.groups=[{id:uid(), name:cfg.groupWord?cfg.groupWord+' 1':'', rows:[]}]; this.filter=''; this.render(); }
  changed(full){ this.cfg.onChange&&this.cfg.onChange(this.data); if(full) this.render(); else this.refreshCalc(); }
  cell(c, r){
    const v=r[c.key]??''; const a=`data-r="${r.id}" data-k="${c.key}"`;
    if(c.type==='calc') return `<td class="ro" data-calc="${c.key}" data-r="${r.id}">${esc(this.fmt(c, c.calc(r)))}</td>`;
    if(c.type==='select') return `<td><select ${a}>${(c.options||[]).map(o=>{ const [k,l]=Array.isArray(o)?o:[o,o]; return `<option value="${esc(k)}" ${String(k)===String(v)?'selected':''}>${esc(l)}</option>`; }).join('')}</select></td>`;
    if(c.type==='check') return `<td style="text-align:center"><input type="checkbox" ${a} ${v?'checked':''} style="margin-top:8px"></td>`;
    if(c.type==='long') return `<td><textarea ${a} placeholder="${esc(c.placeholder||'')}">${esc(v)}</textarea></td>`;
    const t=c.type==='num'||c.type==='money'?'number':c.type==='date'?'date':c.type==='time'?'time':'text';
    return `<td class="${c.type==='num'||c.type==='money'?'num':''}"><input type="${t}" ${a} value="${esc(v)}" placeholder="${esc(c.placeholder||'')}" ${t==='number'?'step="any"':''}></td>`;
  }
  fmt(c, v){ if(c.fmt) return c.fmt(v); if(c.money||c.type==='money') return FH.money(v); return v; }
  sumOf(rows, c){ return rows.reduce((s,r)=>s+(+(c.type==='calc'?c.calc(r):r[c.key])||0),0); }
  visible(r){ if(!this.filter) return true; const f=this.filter.toLowerCase(); return Object.values(r).some(v=>String(v).toLowerCase().includes(f)); }
  render(){
    const C=this.cfg.columns, G=this.data.groups, grouped=this.cfg.grouped, sums=C.filter(c=>c.sum);
    const head=`<tr><th style="width:26px"></th>${C.map(c=>`<th style="${c.width?'width:'+c.width:''}">${esc(c.label)}</th>`).join('')}<th style="width:86px"></th></tr>`;
    let body='';
    G.forEach((g,gi)=>{
      if(grouped) body+=`<tr class="group" data-g="${g.id}"><td colspan="${C.length+2}"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><input class="gname" data-g="${g.id}" value="${esc(g.name)}">${this.cfg.groupExtra?this.cfg.groupExtra(g):''}<span class="spacer"></span><span class="pill">${g.rows.length} ${g.rows.length===1?'row':'rows'}</span>${sums.map(c=>`<span class="pill" style="color:var(--accent)">${esc(c.label)}: ${esc(this.fmt(c,this.sumOf(g.rows,c)))}</span>`).join('')}<button class="ib" data-gup="${g.id}" title="Move up">↑</button><button class="ib" data-gdn="${g.id}" title="Move down">↓</button><button class="ib del" data-gdel="${g.id}" title="Delete ${esc(this.cfg.groupWord||'group')}">✕</button></div></td></tr>`;
      g.rows.filter(r=>this.visible(r)).forEach(r=>{ const st=this.cfg.rowStyle?this.cfg.rowStyle(r):''; body+=`<tr draggable="true" data-row="${r.id}" style="${st}"><td class="handle" title="Drag to reorder">⋮⋮</td>${C.map(c=>this.cell(c,r)).join('')}<td><div class="rowacts"><button class="ib" data-dup="${r.id}" title="Duplicate">⧉</button><button class="ib del" data-del="${r.id}" title="Delete">✕</button></div></td></tr>`; });
      body+=`<tr data-gadd="${g.id}"><td></td><td colspan="${C.length+1}"><button class="btn sm ghost" data-add="${g.id}">+ ${esc(this.cfg.rowWord||'Row')}</button></td></tr>`;
    });
    if(sums.length){ const all=G.flatMap(g=>g.rows); body+=`<tr class="sum"><td></td>${C.map((c,i)=>`<td>${c.sum?esc(this.fmt(c,this.sumOf(all,c))):(i===0?esc(this.cfg.sumLabel||'Total'):'')}</td>`).join('')}<td></td></tr>`; }
    this.el.innerHTML=`<div class="tbl-wrap"><table class="grid"><thead>${head}</thead><tbody>${body}</tbody></table></div>${grouped?`<div style="margin-top:10px"><button class="btn" id="tbl-addg">+ ${esc(this.cfg.groupWord||'Group')}</button></div>`:''}`;
    this.bind();
    if(this.cfg.afterRender) this.cfg.afterRender(this);
  }
  find(id){ for(const g of this.data.groups){ const i=g.rows.findIndex(r=>r.id===id); if(i>=0) return {g,i,r:g.rows[i]}; } return null; }
  refreshCalc(){ const C=this.cfg.columns; $$('[data-calc]',this.el).forEach(td=>{ const f=this.find(td.dataset.r); if(!f) return; const c=C.find(x=>x.key===td.dataset.calc); td.textContent=this.fmt(c,c.calc(f.r)); }); if(this.cfg.rowStyle) $$('tr[data-row]',this.el).forEach(tr=>{ const f=this.find(tr.dataset.row); if(f) tr.setAttribute('style',this.cfg.rowStyle(f.r)); }); }
  bind(){
    const el=this.el;
    $$('[data-r][data-k]',el).forEach(inp=>{ const ev=inp.tagName==='SELECT'||inp.type==='checkbox'?'change':'input'; inp.addEventListener(ev,()=>{ const f=this.find(inp.dataset.r); if(!f) return; f.r[inp.dataset.k]=inp.type==='checkbox'?inp.checked:inp.value; this.changed((this.cfg.rerender||this.cfg.columns.some(c=>c.sum))&&ev==='change'); }); if(ev==='input' && (this.cfg.rerender || this.cfg.columns.some(c=>c.sum))) inp.addEventListener('change',()=>this.render()); });
    $$('.gname',el).forEach(i=>i.addEventListener('input',()=>{ const g=this.data.groups.find(x=>x.id===i.dataset.g); g.name=i.value; this.changed(false); }));
    $$('[data-add]',el).forEach(b=>b.onclick=()=>{ const g=this.data.groups.find(x=>x.id===b.dataset.add); const r=Object.assign({id:uid()}, this.cfg.newRow?this.cfg.newRow(g):{}); g.rows.push(r); this.changed(true); const first=$(`[data-r="${r.id}"]`,el); if(first) first.focus(); });
    $$('[data-del]',el).forEach(b=>b.onclick=()=>{ const f=this.find(b.dataset.del); f.g.rows.splice(f.i,1); this.changed(true); });
    $$('[data-dup]',el).forEach(b=>b.onclick=()=>{ const f=this.find(b.dataset.dup); const c=JSON.parse(JSON.stringify(f.r)); c.id=uid(); f.g.rows.splice(f.i+1,0,c); this.changed(true); });
    $$('[data-gdel]',el).forEach(b=>b.onclick=()=>{ const g=this.data.groups.find(x=>x.id===b.dataset.gdel); const go=()=>{ this.data.groups=this.data.groups.filter(x=>x!==g); if(!this.data.groups.length) this.data.groups.push(this.cfg.newGroup?this.cfg.newGroup(1):{id:uid(),name:'',rows:[]}); this.changed(true); }; if(g.rows.length) FH.confirm(`Delete “${g.name}”?`,`It has ${g.rows.length} rows. This cannot be undone.`,'Delete',go); else go(); });
    const mv=(id,d)=>{ const G=this.data.groups, i=G.findIndex(x=>x.id===id), j=i+d; if(j<0||j>=G.length) return; [G[i],G[j]]=[G[j],G[i]]; this.changed(true); };
    $$('[data-gup]',el).forEach(b=>b.onclick=()=>mv(b.dataset.gup,-1)); $$('[data-gdn]',el).forEach(b=>b.onclick=()=>mv(b.dataset.gdn,1));
    const ag=$('#tbl-addg',el); if(ag) ag.onclick=()=>{ const n=this.data.groups.length+1; this.data.groups.push(Object.assign({id:uid(), rows:[]}, this.cfg.newGroup?this.cfg.newGroup(n):{name:(this.cfg.groupWord||'Group')+' '+n})); this.changed(true); };
    // drag & drop rows (also between groups)
    let dragId=null;
    $$('tr[data-row]',el).forEach(tr=>{
      tr.addEventListener('dragstart',e=>{ if(!e.target.closest('.handle') && document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){ } dragId=tr.dataset.row; tr.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',dragId); });
      tr.addEventListener('dragend',()=>{ tr.classList.remove('dragging'); $$('.dropbefore',el).forEach(x=>x.classList.remove('dropbefore')); });
    });
    $$('tr[data-row],tr[data-gadd]',el).forEach(tr=>{
      tr.addEventListener('dragover',e=>{ if(!dragId) return; e.preventDefault(); $$('.dropbefore',el).forEach(x=>x.classList.remove('dropbefore')); tr.classList.add('dropbefore'); });
      tr.addEventListener('drop',e=>{ e.preventDefault(); if(!dragId) return; const src=this.find(dragId); if(!src) return; const row=src.r; src.g.rows.splice(src.i,1);
        if(tr.dataset.gadd){ this.data.groups.find(g=>g.id===tr.dataset.gadd).rows.push(row); } else { const t=this.find(tr.dataset.row); if(t) t.g.rows.splice(t.i,0,row); else src.g.rows.splice(src.i,0,row); }
        dragId=null; this.changed(true); });
    });
    // stop inputs from starting a row drag
    $$('input,textarea,select',el).forEach(i=>{ i.addEventListener('mousedown',()=>{ const tr=i.closest('tr'); if(tr) tr.draggable=false; }); i.addEventListener('blur',()=>{ const tr=i.closest('tr[data-row]'); if(tr) tr.draggable=true; }); });
  }
  allRows(){ return this.data.groups.flatMap(g=>g.rows.map(r=>Object.assign({_group:g.name},r))); }
};

window.FH = FH;
/* soft reveal while scrolling + light sweep on open */
(function(){ if(matchMedia('(prefers-reduced-motion: reduce)').matches||!('IntersectionObserver' in window)) return;
  const seen=new WeakSet(), io=new IntersectionObserver(es=>es.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add('in'); io.unobserve(en.target); } }),{rootMargin:'0px 0px -6% 0px'});
  const SEL='.card,.tcard,.tile,.welcome,.steps3>*,.shot,.hero,.sec-h,.mod';
  let n=0; function scan(){ document.querySelectorAll(SEL).forEach(el=>{ if(seen.has(el)) return; seen.add(el); const r=el.getBoundingClientRect(); if(r.top<innerHeight&&n++>40) return; el.classList.add('fh-rv'); el.style.transitionDelay=Math.min(240,(n%8)*35)+'ms'; io.observe(el); setTimeout(()=>{ el.style.transitionDelay=''; },900); }); }
  const start=()=>{ const sw=document.createElement('div'); sw.className='fh-sweep'; document.body.appendChild(sw); setTimeout(()=>sw.remove(),1000); scan(); let t; new MutationObserver(()=>{ clearTimeout(t); t=setTimeout(scan,60); }).observe(document.body,{childList:true,subtree:true}); };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start):start();
  FH.sweep=()=>{ const sw=document.createElement('div'); sw.className='fh-sweep'; document.body.appendChild(sw); setTimeout(()=>sw.remove(),1000); };
})();
})();
