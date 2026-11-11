// Leitor DOCX — service worker (funciona 100% offline depois da 1ª abertura)
// Ao publicar uma versão nova do app, troque o número abaixo.
const VERSAO = 'leitor-docx-v1';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const CACHE_COMPARTILHADO = 'ld-compartilhado';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== VERSAO && k !== CACHE_COMPARTILHADO).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);

  // Arquivo recebido pelo "Compartilhar" do Android
  if (req.method === 'POST' && url.pathname.endsWith('/compartilhar')) {
    e.respondWith((async () => {
      try {
        const fd = await req.formData();
        const f = fd.get('arquivo');
        if (f && f.size) {
          const c = await caches.open(CACHE_COMPARTILHADO);
          await c.put(new URL('arquivo-compartilhado', self.registration.scope).href,
            new Response(f, { headers: { 'X-Nome': encodeURIComponent(f.name || 'Documento.docx') } }));
        }
      } catch (err) {}
      return Response.redirect(new URL('./?compartilhado=1', self.registration.scope).href, 303);
    })());
    return;
  }

  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Cache primeiro: abre instantâneo e sem internet
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
