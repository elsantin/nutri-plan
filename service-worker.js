// COMENTARIO_ESTRATÉGICO: Incrementamos la versión de nuevo para una máxima seguridad.
// Esto garantiza que el navegador descarte cualquier versión anterior del caché.
const CACHE_NAME = 'nutriplan-ny-cache-v21'; 

const CRITICAL_APP_SHELL_URLS = [
    '.',
    'index.html',
    'css/styles.css',
    'js/app.js',
    'manifest.json',
    'images/app-background.webp',
    'favicon.ico',
    'favicon.svg',
    'apple-touch-icon.png',
    'images/icons/icon-96x96.png',
    'images/icons/icon-192x192.png',
    'images/icons/icon-512x512.png',
    // COMENTARIO_ESTRATÉGICO: La ruta al logo.svg está aquí, asegurando que funcione offline.
    'images/logo.svg'
];

const OPTIONAL_THIRD_PARTY_URLS = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// El resto del archivo no cambia...

self.addEventListener('install', (event) => {
    console.log(`[Service Worker] Instalando ${CACHE_NAME}...`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log(`[SW ${CACHE_NAME}] Cacheando App Shell Crítica...`);
                try {
                    await cache.addAll(CRITICAL_APP_SHELL_URLS);
                    console.log(`[SW ${CACHE_NAME}] App Shell Crítica cacheada con éxito.`);
                } catch (error) {
                    console.error(`[SW ${CACHE_NAME}] Falló al cachear App Shell Crítica con addAll:`, error);
                    // Intento individual si addAll falla
                    for (const url of CRITICAL_APP_SHELL_URLS) {
                        try {
                            await cache.add(url);
                        } catch (err) {
                            console.error(`[SW ${CACHE_NAME}] Falló al cachear recurso individualmente: ${url}`, err);
                        }
                    }
                }

                console.log(`[SW ${CACHE_NAME}] Intentando cachear recursos opcionales de terceros...`);
                for (const url of OPTIONAL_THIRD_PARTY_URLS) {
                    try {
                        await cache.add(new Request(url, { mode: 'no-cors' }));
                    } catch (err) {
                        console.warn(`[SW ${CACHE_NAME}] Falló al cachear recurso opcional ${url} (posiblemente por CORS o red):`, err);
                    }
                }
            })
            .then(() => {
                console.log(`[SW ${CACHE_NAME}] Proceso de 'install' completado.`);
                return self.skipWaiting();
            })
            .catch(error => {
                console.error(`[SW ${CACHE_NAME}] Error mayor durante la instalación:`, error);
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log(`[Service Worker] Activando ${CACHE_NAME}...`);
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Eliminando caché antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log(`[SW ${CACHE_NAME}] Activado y cachés antiguas eliminadas.`);
            return self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const requestUrl = new URL(event.request.url);

    // Estrategia: Cache First, fallback to Network
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Si está en caché, lo devolvemos inmediatamente.
                    return cachedResponse;
                }

                // Si no está en caché, vamos a la red.
                return fetch(event.request).then((networkResponse) => {
                    // Si la respuesta de red es válida, la clonamos, la guardamos en caché y la devolvemos.
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Si la red falla (estamos offline), y la petición es de navegación,
                    // intentamos devolver el index.html como fallback.
                    if (event.request.mode === 'navigate') {
                        return caches.match('index.html');
                    }
                    // Para otros recursos, no hay nada que hacer si no están en caché y la red falla.
                });
            })
    );
});
