// service worker by 10101: makes the game installable and playable offline.
// bump VERSION whenever index.html, feel.js or game.js change, so phones pick up the new build.
const VERSION='fw-70';
// music is optional: each track is cached if it exists, and a missing one never breaks the install
// flip to true together with MUSIC_READY in feel.js once the songs are in music/
const MUSIC_READY=true;
// the title loop and the battle song come with the install, since every first game needs them; the finale and win songs are fetched once music first plays
const MUSIC=!MUSIC_READY?[]:['weave-me-thru-the-veil-loop','dystopias-kingdom'].map(n=>'./music/'+n+'.mp3');
const MUSIC_LATER=!MUSIC_READY?[]:['burning-sky','mtbfree'].map(n=>'./music/'+n+'.mp3');
self.addEventListener('message',e=>{if(e.data&&e.data.type==='cache-music')e.waitUntil(caches.open(VERSION).then(c=>Promise.all(MUSIC_LATER.map(u=>c.match(u).then(m=>m||c.add(u).catch(()=>{}))))));});
const FILES=['./','./index.html','./feel.js','./game.js','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./opponents.json','./lab.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES).then(()=>Promise.all(MUSIC.map(u=>c.add(u).catch(()=>{}))))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// network first, so an online player always gets the newest build; the cache is the offline fallback.
// the part after # (challenge links) never reaches the server, so it works the same either way.
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
 e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();if(r.status===200&&new URL(e.request.url).origin===location.origin)caches.open(VERSION).then(c=>c.put(e.request,copy));return r;})
  .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(m=>m||caches.match('./index.html'))));});
