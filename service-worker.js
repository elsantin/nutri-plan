// COMENTARIO_ESTRATÉGICO: Versión del caché para cuando se usa el hero artístico.
const CACHE_NAME = 'nutriplan-ny-cache-v25'; 

const CRITICAL_APP_SHELL_URLS = [
    '.', // Representa la raíz, usualmente se resuelve a index.html
    'index.html',
    'css/styles.css',
    'js/app.js',
    'manifest.json',
    'images/app-background.webp', // Fondo general
    'favicon.ico',
    'favicon.svg',
    'apple-touch-icon.png',
    'images/icons/icon-96x96.png',
    'images/icons/icon-192x192.png',
    'images/icons/icon-512x512.png',
    'images/logo.svg', // Logo del header
    'images/hero_kiwi_yin_yang.jpg' // Imagen del Hero para la vista de inicio
];

const OPTIONAL_THIRD_PARTY_URLS = [
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

self.addEventListener('install', (event) => {
    console.log(`[Service Worker] Instalando ${CACHE_NAME}...`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log(`[SW ${CACHE_NAME}] Cacheando App Shell Crítica...`);
                try {
                    // Intenta cachear todos los recursos críticos de una vez.
                    await cache.addAll(CRITICAL_APP_SHELL_URLS);
                    console.log(`[SW ${CACHE_NAME}] App Shell Crítica cacheada con éxito con addAll.`);
                } catch (error) {
                    // Si addAll falla (por ejemplo, si un solo recurso no se encuentra),
                    // el Service Worker podría no instalarse. Como fallback, intentamos cachear individualmente.
                    console.error(`[SW ${CACHE_NAME}] Falló al cachear App Shell Crítica con addAll:`, error);
                    console.log(`[SW ${CACHE_NAME}] Intentando cachear recursos críticos individualmente...`);
                    for (const url of CRITICAL_APP_SHELL_URLS) {
                        try {
                            await cache.add(url);
                            console.log(`[SW ${CACHE_NAME}] Cacheado exitosamente (crítico individual): ${url}`);
                        } catch (err) {
                            console.error(`[SW ${CACHE_NAME}] Falló al cachear recurso CRÍTICO individual ${url}:`, err);
                            // No relanzar el error aquí para permitir que otros recursos se intenten cachear.
                        }
                    }
                }

                console.log(`[SW ${CACHE_NAME}] Intentando cachear recursos opcionales de terceros...`);
                for (const url of OPTIONAL_THIRD_PARTY_URLS) {
                    try {
                        // Para recursos de terceros, 'no-cors' es importante si no controlas los headers CORS.
                        // Esto permite que el recurso se guarde en caché pero podría no ser completamente opaco.
                        await cache.add(new Request(url, { mode: 'no-cors' }));
                        console.log(`[SW ${CACHE_NAME}] Cacheado recurso opcional (o intento hecho): ${url}`);
                    } catch (err) {
                        console.warn(`[SW ${CACHE_NAME}] Falló al cachear recurso opcional ${url} (posiblemente por CORS o red):`, err);
                    }
                }
            })
            .then(() => {
                console.log(`[SW ${CACHE_NAME}] Proceso de 'install' completado.`);
                // Forza al nuevo Service Worker a activarse inmediatamente después de la instalación.
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
                        // Elimina cachés antiguas para liberar espacio y evitar conflictos.
                        console.log(`[SW ${CACHE_NAME}] Eliminando caché antigua:`, cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log(`[SW ${CACHE_NAME}] Activado y cachés antiguas eliminadas.`);
            // Permite que el Service Worker activado tome control de las páginas abiertas
            // que están dentro de su scope inmediatamente, sin necesidad de recargar.
            return self.clients.claim(); 
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Solo nos interesan las peticiones GET.
    if (event.request.method !== 'GET') return; 

    // Estrategia: Cache First, fallback to Network
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    // Si el recurso está en caché, lo devolvemos.
                    // console.log(`[SW ${CACHE_NAME}] Sirviendo desde caché: ${event.request.url}`);
                    return cachedResponse;
                }

                // Si no está en caché, vamos a la red.
                // console.log(`[SW ${CACHE_NAME}] No en caché, solicitando a red: ${event.request.url}`);
                return fetch(event.request).then((networkResponse) => {
                    // Si la respuesta de red es válida (status 200),
                    // la clonamos, la guardamos en caché para futuras peticiones y la devolvemos.
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            // console.log(`[SW ${CACHE_NAME}] Cacheando nueva respuesta desde red: ${event.request.url}`);
                            cache.put(event.request, responseToCache);
                        });
                    } else if (networkResponse && networkResponse.status !== 200) {
                        // console.warn(`[SW ${CACHE_NAME}] Respuesta de red no OK (${networkResponse.status}) para: ${event.request.url}`);
                    }
                    return networkResponse;
                }).catch((error) => {
                    // Si la petición a la red falla (por ejemplo, estamos offline).
                    console.warn(`[SW ${CACHE_NAME}] Falló la petición a red para: ${event.request.url}`, error);
                    // Si la petición fallida es una navegación (solicitud de un documento HTML),
                    // intentamos servir el 'index.html' cacheado como fallback.
                    if (event.request.mode === 'navigate') {
                        console.log(`[SW ${CACHE_NAME}] Petición de navegación fallida, sirviendo index.html de fallback.`);
                        return caches.match('index.html');
                    }
                    // Para otros tipos de recursos (imágenes, CSS, JS), si no están en caché y la red falla,
                    // el navegador mostrará su error de red estándar. No tenemos un fallback genérico para ellos aquí.
                });
            })
    );
});
