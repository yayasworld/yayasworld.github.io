const V = 'yw-main-MZIBV2AQ.js-1795814775182';
const SHELL = ["./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-512.png","./index.html","./main-2GLFNUZN.css","./main-MZIBV2AQ.js","./manifest.webmanifest"];
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
    if (url.pathname === '/ghazwa' || url.pathname.startsWith('/ghazwa/') || url.pathname === '/nile-kingdoms' || url.pathname.startsWith('/nile-kingdoms/')) return;
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
