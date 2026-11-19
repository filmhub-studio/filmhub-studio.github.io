/* Film Hub ↔ Canva Connect (one way: tool → Canva, plus exports back). Needs the small proxy in /canva-proxy deployed (see README). */
(function(){
const LS=FH.LS, SCOPES='asset:read asset:write design:content:read design:content:write design:meta:read brandtemplate:meta:read brandtemplate:content:read profile:read';
const proxy=()=>(LS.get('fh:canva-proxy','')||'').replace(/\/$/,'');
const tok=()=>LS.get('fh:canva-token',null);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const b64url=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const redirect=()=>new URL('canva-callback.html', location.href).href;
async function connect(){ if(!proxy()) throw new Error('Add your Canva proxy URL first (Settings in the Canva panel).');
  const cfg=await (await fetch(proxy()+'?op=config')).json(); if(!cfg.client_id) throw new Error('The proxy has no CANVA_CLIENT_ID set.');
  const ver=b64url(crypto.getRandomValues(new Uint8Array(48))), chal=b64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ver))), state=b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem('canva-pkce',JSON.stringify({ver,state,redirect:redirect()})); localStorage.setItem('canva-pkce',JSON.stringify({ver,state,redirect:redirect()}));
  const u='https://www.canva.com/api/oauth/authorize?'+new URLSearchParams({code_challenge:chal,code_challenge_method:'s256',scope:SCOPES,response_type:'code',client_id:cfg.client_id,state,redirect_uri:redirect()});
  const w=window.open(u,'canva','width=520,height=720'); if(!w) location.href=u;
  return new Promise((res,rej)=>{ const t0=Date.now(); const iv=setInterval(()=>{ if(tok()&&tok().at>t0-1000){ clearInterval(iv); res(tok()); } if(Date.now()-t0>300000){ clearInterval(iv); rej(new Error('Timed out waiting for Canva.')); } },700); }); }
async function exchange(code,state){ const p=JSON.parse(localStorage.getItem('canva-pkce')||'{}'); if(p.state!==state) throw new Error('State mismatch — try connecting again.');
  const r=await fetch(proxy()+'?op=token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,code_verifier:p.ver,redirect_uri:p.redirect})}); const j=await r.json(); if(!r.ok) throw new Error(j.error_description||j.error||'Token exchange failed');
  LS.set('fh:canva-token',{access:j.access_token,refresh:j.refresh_token,exp:Date.now()+(j.expires_in-60)*1000,at:Date.now()}); localStorage.removeItem('canva-pkce'); }
async function access(){ let t=tok(); if(!t) throw new Error('Not connected to Canva.'); if(Date.now()>t.exp){ const r=await fetch(proxy()+'?op=refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token:t.refresh})}); const j=await r.json(); if(!r.ok){ LS.set('fh:canva-token',null); throw new Error('Canva session expired — connect again.'); } t={access:j.access_token,refresh:j.refresh_token||t.refresh,exp:Date.now()+(j.expires_in-60)*1000,at:t.at}; LS.set('fh:canva-token',t); } return t.access; }
async function api(path,method='GET',body,extra={}){ const h={'Authorization':'Bearer '+await access(),'X-Canva-Path':path,'X-Canva-Method':method,...extra}; let b=body; if(body&&!(body instanceof Blob)&&!(body instanceof ArrayBuffer)){ h['Content-Type']='application/json'; b=JSON.stringify(body); }
  const r=await fetch(proxy()+'?op=api',{method:'POST',headers:h,body:b||'{}'}); const txt=await r.text(); let j={}; try{ j=JSON.parse(txt); }catch(e){} if(!r.ok) throw new Error((j.message||j.error||txt||r.status)+''); return j; }
async function poll(path,key){ for(let i=0;i<60;i++){ const j=await api(path); const job=j.job||j; if(job.status==='success') return job; if(job.status==='failed') throw new Error((job.error&&job.error.message)||'Canva job failed'); await sleep(Math.min(4000,800+i*300)); } throw new Error('Canva took too long.'); }
async function uploadAsset(dataURL,name){ const blob=await (await fetch(dataURL)).blob(); const meta={name_base64:btoa(unescape(encodeURIComponent((name||'moodboard image').slice(0,50))))};
  const j=await api('/asset-uploads','POST',blob,{'Content-Type':'application/octet-stream','Asset-Upload-Metadata':JSON.stringify(meta)}); const job=await poll('/asset-uploads/'+j.job.id); return job.asset.id; }
async function createDesign(title,assetId){ const j=await api('/designs','POST',{design_type:{type:'preset',name:'whiteboard'},title:(title||'Moodboard').slice(0,255),...(assetId?{asset_id:assetId}:{})}); return j.design; }
async function templateFields(id){ const j=await api('/brand-templates/'+id+'/dataset'); return j.dataset||{}; }
async function autofill(templateId,data,title){ const j=await api('/autofills','POST',{brand_template_id:templateId,title:(title||'Moodboard').slice(0,255),data}); const job=await poll('/autofills/'+j.job.id); return job.result.design; }
async function exportDesign(designId,format){ const j=await api('/exports','POST',{design_id:designId,format:{type:format}}); const job=await poll('/exports/'+j.job.id); return job.urls||[]; }
async function me(){ try{ const j=await api('/users/me/profile'); return j.profile&&j.profile.display_name; }catch(e){ return null; } }
window.FHCanva={proxy,tok,connect,exchange,api,uploadAsset,createDesign,templateFields,autofill,exportDesign,me,disconnect:()=>LS.set('fh:canva-token',null)};
})();
