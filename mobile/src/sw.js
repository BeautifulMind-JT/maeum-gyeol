const CACHE='maeum-mobile-__BUILD_HASH__';
const ASSETS=['./','./index.html','./main.mjs','./presentation.mjs','./icons.mjs','./identity.mjs','./gowun-batang.woff2','./gowun-dodum.woff2','./summer-hero.webp','./summer-wine.webp','./summer-still.webp','./runtime.mjs','./storage.mjs','./policies.mjs','./sync-journal.mjs','./server-journal.mjs','./cloud.mjs','./cloud-ui.mjs','./social-ui.mjs','./social-cloud.mjs','./public-records.mjs','./photos.mjs','./cloud-config.json','./vendor/supabase.mjs','./style.css','./manifest.webmanifest','./shared/tasting.mjs','./shared/model.mjs','./wine-moment.webp','./favicon.svg','./icon-192.png','./icon-512.png'];
// Cache only packaged public assets. Account configuration and API responses
// must always come from the server, even when an older cache contains them.
const STATIC_ASSETS=[...ASSETS.filter(path=>path!=='./cloud-config.json'),'./oauth.mjs'];
const STATIC_PATHS=new Set(STATIC_ASSETS.map(path=>new URL(path,self.registration.scope).pathname));
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 await cache.addAll(STATIC_ASSETS);
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>k.startsWith('maeum-mobile-')&&k!==CACHE).map(k=>caches.delete(k)));
 // Claim existing tabs without reloading them or discarding in-progress input.
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 // Callback codes and temporary preview access links must never enter Cache API.
 if(request.method!=='GET'||url.search||url.origin!==self.location.origin||!STATIC_PATHS.has(url.pathname)||request.cache==='no-store')return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   // A refresh must see the deployed design, not an indefinitely cached page.
   const response=await fetch(request,{cache:'no-cache'});
   if(response.ok)await cache.put(request,response.clone()).catch(()=>{});
   return response;
  }catch(error){
   const cached=await cache.match(request);
   if(cached)return cached;
   throw error;
  }
 })());
});
