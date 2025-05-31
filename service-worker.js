// service-worker.js

const CACHE_NAME = 'nutriplan-ny-cache-v15'; // CAMBIO: Nueva versión

// CAMBIO: Reintegramos los archivos JS y CSS críticos
const CRITICAL_APP_SHELL_URLS = [
    '.', // Para index.html en la raíz
    'index.html',
    'css/styles.css',
    'js/app.js',
    'manifest.json'
    // Los íconos y favicon los añadiremos cuando los tengamos listos y verificados
    // 'favicon.ico',
    // 'apple-touch-icon.png',
    // 'web-app-manifest-192x192.png',
    // 'web-app-manifest-512x512.png',
    // 'favicon.svg'
];

const OPTIONAL_THIRD_PARTY_URLS = [
    // Siguen comentados por ahora para simplificar
    // 'https://cdn.tailwindcss.com',
    // 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// La función verifyCache y los eventos install, activate, fetch se mantienen
// igual que en la última versión que te di (la v14 de depuración),
// ya que la lógica de cacheo individual y verificación funcionó bien.
// Solo hemos cambiado la lista de archivos a cachear y el nombre del caché.

async function verifyCache(cache, urlsToVerify) {
    console.log(`[SW ${CACHE_NAME}] Verificando contenido del caché...`);
    let allFound = true;
    for (const url of urlsToVerify) {
        const match = await cache.match(url);
        if (match) {
            console.log(`[SW ${CACHE_NAME}] VERIFICADO EN CACHÉ: ${url}`);
        } else {
            console.error(`[SW ${CACHE_NAME}] NO ENCONTRADO EN CACHÉ después de intentar añadir: ${url}`);
            allFound = false;
        }
    }
    if(allFound) console.log(`[SW ${CACHE_NAME}] Todos los recursos críticos verificados en caché.`);
    else console.error(`[SW ${CACHE_NAME}] Faltan recursos críticos en el caché después de la instalación.`);
}

self.addEventListener('install', (event) => {
    console.log(`[Service Worker] Instalando ${CACHE_NAME}...`);
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async (cache) => {
                console.log(`[SW ${CACHE_NAME}] Intentando cachear individualmente:`, CRITICAL_APP_SHELL_URLS);
                let allCriticalCached = true;
                for (const url of CRITICAL_APP_SHELL_URLS) {
                    try {
                        await cache.add(url); // cache.add() ya hace el fetch y el put
                        console.log(`[SW ${CACHE_NAME}] INTENTO DE CACHEO para ${url} completado.`);
                        const match = await cache.match(url); // Verificar inmediatamente
                        if (match) {
                            console.log(`[SW ${CACHE_NAME}] VERIFICADO EN CACHÉ: ${url}`);
                        } else {
                            console.error(`[SW ${CACHE_NAME}] NO ENCONTRADO EN CACHÉ después de add: ${url}`);
                            allCriticalCached = false;
                        }
                    } catch (err) {
                        console.error(`[SW ${CACHE_NAME}] Falló gravemente al cachear ${url}:`, err);
                        allCriticalCached = false;
                    }
                }

                if (!allCriticalCached) {
                    console.error(`[SW ${CACHE_NAME}] NO TODOS los recursos críticos fueron cacheados y verificados.`);
                    throw new Error("Fallo en el cacheo de recursos críticos verificados.");
                } else {
                    console.log(`[SW ${CACHE_NAME}] Cacheo de recursos críticos completado y verificado.`);
                }
                
                // Opcional: Cachear recursos de terceros (si los descomentas arriba)
                // console.log(`[SW ${CACHE_NAME}] Intentando cachear recursos opcionales de terceros...`);
                // const thirdPartyCachePromises = OPTIONAL_THIRD_PARTY_URLS.map(url => {
                //     return cache.add(new Request(url, { mode: 'no-cors' })).catch(err => {
                //         console.warn(`[SW ${CACHE_NAME}] Falló al cachear recurso opcional ${url} (posiblemente por CORS):`, err);
                //     });
                // });
                // await Promise.all(thirdPartyCachePromises);
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
    if (event.request.mode === 'navigate' || requestUrl.pathname.endsWith('index.html') || requestUrl.pathname === '/') {
        console.log(`[SW ${CACHE_NAME}] Fetch event para NAVEGACIÓN o index.html: ${event.request.url}, modo: ${event.request.mode}`);
    }

    event.respondWith(
        caches.open(CACHE_NAME).then(async (cache) => { // Abrir el caché primero
            const cachedResponse = await cache.match(event.request);
            if (cachedResponse) {
                console.log(`[SW ${CACHE_NAME}] Sirviendo DESDE CACHÉ: ${event.request.url}`);
                return cachedResponse;
            }

            // Si es una petición de navegación para la raíz y no se encontró la URL exacta,
            // intentar con 'index.html' explícitamente.
            if (event.request.mode === 'navigate' && (requestUrl.pathname === '/' || requestUrl.pathname.endsWith('/.'))) {
                console.log(`[SW ${CACHE_NAME}] Petición de navegación no encontrada como ${event.request.url}, intentando con 'index.html' explícito en caché.`);
                const rootIndexCachedResponse = await cache.match('index.html');
                if (rootIndexCachedResponse) {
                    console.log(`[SW ${CACHE_NAME}] Sirviendo 'index.html' explícito DESDE CACHÉ para ${event.request.url}`);
                    return rootIndexCachedResponse;
                }
            }
            
            console.log(`[SW ${CACHE_NAME}] No en caché, buscando en RED: ${event.request.url}`);
            try {
                const networkResponse = await fetch(event.request);
                if (networkResponse && networkResponse.status === 200) {
                    // Cachear dinámicamente si es un recurso crítico o del mismo origen
                    const isCritical = CRITICAL_APP_SHELL_URLS.some(path => requestUrl.pathname.endsWith(path) || (path === '.' && requestUrl.pathname === '/'));
                    // const isOptional = OPTIONAL_THIRD_PARTY_URLS.includes(event.request.url); // Si los tuviéramos

                    if (isCritical /*|| isOptional*/ || requestUrl.origin === self.location.origin) {
                         console.log(`[SW ${CACHE_NAME}] Cacheando desde red: ${event.request.url}`);
                        await cache.put(event.request, networkResponse.clone());
                    }
                }
                return networkResponse;
            } catch (error) {
                console.warn(`[SW ${CACHE_NAME}] Petición a RED falló para: ${event.request.url}`, error);
                return new Response(`Recurso no disponible. Offline y no en caché: ${event.request.url}`, {
                    status: 404,
                    statusText: "Not Found - Offline or Not Cached",
                    headers: { 'Content-Type': 'text/plain' }
                });
            }
        })
    );
});
