const V = 'yw-main-IBWIRJSU.js';
const SHELL = ["./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./main-445XMRUA.js","./main-4LSS4V3H.js","./main-5R7FLBET.js","./main-67LODLDZ.js","./main-ARMCFZAR.js","./main-AX6DHRGQ.js","./main-BUGMKSU3.css","./main-BX5YIDCL.css","./main-CQRNIJHN.css","./main-DX2QELID.css","./main-GLHIMHEA.js","./main-GXLRZGBV.css","./main-IBWIRJSU.js","./main-IHNJEWSN.js","./main-KMLMCJRX.css","./main-KYQ5ZBHU.css","./main-LTPNT45K.js","./main-M5EAVSIO.js","./main-MDFRAYTE.js","./main-OCFXQCJ5.css","./main-OQA6DNIE.js","./main-Q5IYCZED.js","./main-QAHDK4OR.js","./main-TA6IJEZE.js","./main-TK3YENXZ.js","./main-TXCE6OOM.js","./main-UQ7PISWC.css","./main-VYKJ6ZOW.css","./main-WAHW3MJH.js","./main-X7ZV3VFA.js","./main-XGGH34VB.css","./main-YDJLZZPB.js","./manifest.webmanifest"];
self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)));
});
self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
    if (url.pathname.includes('/assets/')) {
        e.respondWith(caches.open(V).then(async (c) => {
            const hit = await c.match(e.request);
            if (hit) return hit;
            const res = await fetch(e.request);
            if (res.ok) c.put(e.request, res.clone());
            return res;
        }));
        return;
    }
    e.respondWith(
        caches.match(e.request).then(async (hit) => {
            const fresh = await fetch(e.request).catch(() => null);
            if (fresh && fresh.ok) {
                const c = await caches.open(V);
                c.put(e.request, fresh.clone());
                return fresh;
            }
            if (hit) return hit;
            if (e.request.mode === 'navigate') return caches.match('./index.html');
            return fresh || Response.error();
        })
    );
});
