// Only the generic offline screen is cached. No private API responses or app data.
const CACHE='wedding-offline-v1';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.add(new URL('./offline.html',self.location).href))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('wedding-offline-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||event.request.mode!=='navigate'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('./offline.html',self.location).href)));
});
