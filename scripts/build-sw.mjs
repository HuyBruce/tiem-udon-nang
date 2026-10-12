import fs from "node:fs/promises";
import crypto from "node:crypto";
const files = (await fs.readdir("dist/assets")).filter(
  (f) => !f.endsWith(".woff"),
);
const shell = [
  "/",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
  ...files.map((f) => "/assets/" + f),
];
const hash = crypto
  .createHash("sha256")
  .update(files.join())
  .digest("hex")
  .slice(0, 10);
const sw = `const CACHE='udon-nang-${hash}';
const SHELL=${JSON.stringify(shell)};
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('udon-nang-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;
  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),4000);
      try{
        const response=await fetch(e.request,{cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error('Navigation unavailable');
        const cache=await caches.open(CACHE);
        await cache.put('/',response.clone());
        return response;
      }catch{
        return await caches.match('/')||Response.error();
      }finally{clearTimeout(timeout);}
    })());
    return;
  }
  e.respondWith(caches.match(e.request,{ignoreVary:true}).then(hit=>hit||fetch(e.request).then(res=>{
    if(res.ok){const copy=res.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}
    return res;
  }).catch(()=>Response.error())));
});`;
await fs.writeFile("dist/sw.js", sw);
console.log("Offline shell: " + shell.length + " files, cache " + hash);
