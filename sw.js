const V = 'yw-main-NKSBJY3E.js';
const SHELL = ["./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./main-2UQ34X3R.js","./main-43USJ6EE.js","./main-445XMRUA.js","./main-4EYBSEJ4.css","./main-4LSS4V3H.js","./main-5R7FLBET.js","./main-5UFQZRHJ.js","./main-63X2N3SW.js","./main-67LODLDZ.js","./main-6E2RWU6M.js","./main-7QJ55VGL.js","./main-AR4IDUCH.css","./main-ARMCFZAR.js","./main-AX6DHRGQ.js","./main-BUGMKSU3.css","./main-BX5YIDCL.css","./main-BZPHTY5C.js","./main-CQRNIJHN.css","./main-DJ3RIDTW.js","./main-DX2QELID.css","./main-EQK22VCF.js","./main-ERIUZHT5.css","./main-G5NXAZH4.css","./main-GLHIMHEA.js","./main-GWKT5FJT.css","./main-GXLRZGBV.css","./main-HBU23IED.js","./main-IBWIRJSU.js","./main-IEGW2AY5.css","./main-IHNJEWSN.js","./main-IOX3CWJS.css","./main-IS5CX3YP.js","./main-JXQK2QZ4.js","./main-KMLMCJRX.css","./main-KYQ5ZBHU.css","./main-LEINMX2I.js","./main-LTPNT45K.js","./main-M5EAVSIO.js","./main-MDFRAYTE.js","./main-MEIRPJJD.js","./main-NCTYZQVC.js","./main-NKSBJY3E.js","./main-OCFXQCJ5.css","./main-OQA6DNIE.js","./main-PIAIKR66.css","./main-PXHLJNH4.css","./main-Q5IYCZED.js","./main-Q6PRE565.js","./main-QAHDK4OR.js","./main-QEZEUHD6.js","./main-QFSV4DSE.js","./main-RLXPOKMZ.js","./main-S4PUMYVM.css","./main-TA6IJEZE.js","./main-TB74IKJX.css","./main-TIUAKHUI.css","./main-TK3YENXZ.js","./main-TXCE6OOM.js","./main-UDIOIN2J.css","./main-UOVWQPA5.js","./main-UQ7PISWC.css","./main-VYKJ6ZOW.css","./main-WAHW3MJH.js","./main-X7ZV3VFA.js","./main-XGGH34VB.css","./main-XWGOAP6I.css","./main-YDJLZZPB.js","./main-YHNWDJFP.css","./main-ZNNTFVK2.js","./manifest.webmanifest"];
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
