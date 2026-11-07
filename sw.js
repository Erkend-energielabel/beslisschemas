/* Service worker EE Beslisschema – verhoog VERSIE bij elke nieuwe upload */
const VERSIE = 'ee-bs-2026-11-07u';
const APP = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/@azure/msal-browser@2.38.3/lib/msal-browser.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js',
  'https://cdn.jsdelivr.net/npm/pmtiles@3.2.1/dist/pmtiles.js',
  'https://cdn.jsdelivr.net/npm/meshoptimizer@0.21.0/meshopt_decoder.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];
const CDN = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSIE);
    await c.addAll(APP);
    await Promise.all(LIBS.map(u => fetch(u, {mode: 'no-cors'}).then(r => c.put(u, r)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for(const k of await caches.keys()) if(k !== VERSIE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // de app zelf (alleen de hoofdpagina, manifest en iconen; andere mappen zoals opname/ blijven met rust):
  // eerst internet (dan heb je altijd de nieuwste versie), anders de bewaarde versie
  const basis = new URL('./', self.registration.scope).pathname;
  const eigen = url.origin === location.origin && (url.pathname === basis || url.pathname === basis + 'index.html' ||
    url.pathname === basis + 'manifest.webmanifest' || url.pathname.startsWith(basis + 'icons/'));
  if(eigen){
    e.respondWith((async () => {
      const c = await caches.open(VERSIE);
      try{
        const r = await fetch(req);
        if(r.ok && !url.search) c.put(req, r.clone());
        return r;
      }catch(err){
        return (await c.match(req, {ignoreSearch: true})) ||
               (req.mode === 'navigate' ? await c.match('./') : undefined) ||
               Response.error();
      }
    })());
    return;
  }
  // vaste bibliotheken (vaste versies): uit de cache
  if(CDN.includes(url.hostname)){
    e.respondWith((async () => {
      const c = await caches.open(VERSIE);
      const hit = await c.match(req.url);
      if(hit) return hit;
      const r = await fetch(req);
      if(r.ok || r.type === 'opaque') c.put(req.url, r.clone());
      return r;
    })());
  }
  // al het andere (PDOK, 3DBAG, EP-online, OneDrive, inloggen): gewoon via internet
});
