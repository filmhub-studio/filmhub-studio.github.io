/* Film Hub cloud: Google sign-in + Firestore, using your existing Firebase project "lighting-planner". */
(function(){
'use strict';
const CFG={apiKey:"AIzaSyBer5S8tveJ3RXDiNqyd7iphlRlsLdZY9I",authDomain:"lighting-planner.firebaseapp.com",projectId:"lighting-planner",storageBucket:"lighting-planner.firebasestorage.app",messagingSenderId:"587303763020",appId:"1:587303763020:web:5f825f788623e2752748e9"};
const SDK='https://www.gstatic.com/firebasejs/10.12.2/';
let loading=null, user=null; const subs=[];
function script(src){ return new Promise((res,rej)=>{ if(document.querySelector(`script[src="${src}"]`)) return res(); const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=rej; document.head.appendChild(s); }); }
const FHCloud={
  available:false,
  ready(){ if(loading) return loading; loading=(async()=>{ await script(SDK+'firebase-app-compat.js'); await script(SDK+'firebase-auth-compat.js'); await script(SDK+'firebase-firestore-compat.js');
      if(!firebase.apps.length) firebase.initializeApp(CFG); FHCloud.available=true;
      firebase.auth().onAuthStateChanged(u=>{ user=u; subs.forEach(f=>{ try{ f(u); }catch(e){ console.error(e); } }); if(u) FHCloud.db().collection('hub_users').doc(u.uid).set({name:u.displayName||u.email, email:(u.email||'').toLowerCase(), photo:u.photoURL||'', lastSeen:Date.now()},{merge:true}).catch(()=>{}); });
      return firebase; })().catch(e=>{ FHCloud.available=false; throw e; }); return loading; },
  db(){ return firebase.firestore(); },
  user(){ return user; },
  email(){ return user&&user.email?user.email.toLowerCase():''; },
  onAuth(f){ subs.push(f); if(FHCloud.available) f(user); },
  async signIn(){ await FHCloud.ready(); const p=new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({prompt:'select_account'});
    try{ return await firebase.auth().signInWithPopup(p); }
    catch(e){ if(e&&(e.code==='auth/popup-blocked'||e.code==='auth/operation-not-supported-in-this-environment')) return firebase.auth().signInWithRedirect(p); throw e; } },
  async signOut(){ await FHCloud.ready(); return firebase.auth().signOut(); },
  explain(e){ const c=e&&e.code||''; if(c.includes('unauthorized-domain')) return 'This web address is not allowed to use Google sign-in yet. In Firebase → Authentication → Settings → Authorized domains, add this site’s domain.';
    if(c.includes('operation-not-allowed')||c.includes('configuration-not-found')) return 'Google sign-in is switched off. In Firebase → Authentication → Sign-in method, enable Google.';
    if(c.includes('permission-denied')) return 'The database refused. Paste the new Firestore rules from the README into Firebase → Firestore → Rules.';
    if(c.includes('popup-closed')) return 'Sign-in window was closed.'; return (e&&e.message)||'Something went wrong.'; },
};
window.FHCloud=FHCloud;
})();
