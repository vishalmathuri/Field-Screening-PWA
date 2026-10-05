const CACHE='field-screening-shell-v1';
const BUILD_ASSETS=/*BUILD_ASSETS*/[];
const STATIC=['/manifest.webmanifest','/favicon.svg','/icon-192.png','/icon-512.png','/icon-maskable.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll([...STATIC,...BUILD_ASSETS])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('field-screening-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
// Cache shell only after the authenticated app has loaded. Never cache API responses.
self.addEventListener('message',event=>{
 if(event.data?.type!=='CACHE_SHELL')return;
 event.waitUntil((async()=>{
  try{
   const c=await caches.open(CACHE);
   if(await c.match('/'))event.source?.postMessage({type:'OFFLINE_READY'});
   const response=await fetch('/',{credentials:'same-origin'});
   if(!response.ok||new URL(response.url).origin!==self.location.origin||new URL(response.url).pathname!=='/')return;
   const html=await response.clone().text();if(!html.includes('Field Screening'))return;
   const urls=[...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>new URL(m[1],self.location.origin)).filter(u=>u.origin===self.location.origin&&/\.(js|css)(\?|$)/.test(u.href));
   await Promise.all(urls.map(async u=>{const r=await fetch(u.href);if(!r.ok)throw new Error('Asset unavailable');await c.put(u.href,r);}));
   await c.put('/',response);event.source?.postMessage({type:'OFFLINE_READY'});
  }catch{/* Online form remains usable if caching fails. */}
 })());
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/cdn-cgi/')||['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].includes(url.pathname)||event.request.headers.get('RSC'))return;
 if(event.request.mode==='navigate'&&url.pathname==='/'){
  event.respondWith(fetch(event.request).catch(async()=> (await (await caches.open(CACHE)).match('/')) || Response.error()));return;
 }
 if(['script','style','image','font'].includes(event.request.destination)||STATIC.includes(url.pathname)){
  event.respondWith((async()=>{
   const c=await caches.open(CACHE), cached=await c.match(event.request);if(cached)return cached;
   const r=await fetch(event.request);if(r.ok&&!r.redirected)await c.put(event.request,r.clone());return r;
  })());
 }
});
