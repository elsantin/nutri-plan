/**
 * js/app.js
 * Lógica principal para la PWA NutriPlan Narváez Yánez (Versión Resiliente con Depuración)
 */

const DB_NAME = 'pwa_nutriplan_db';
const DB_VERSION = 1;
let db; // Se sigue asignando en initDB onsuccess

console.log('[App Resiliente] Script cargado. Iniciando dbPromise...');
const dbPromise = initDB();
console.log('[App Resiliente] dbPromise iniciado.');

let views, loadSampleDataButton, listaComprasContainer, currentYearSpan, planSemanalContainer;

function initDB() {
    console.log('[initDB] Intentando abrir conexión...');
    return new Promise((resolve, reject) => {
        if (db && db.version === DB_VERSION) {
            console.log('[initDB] Conexión a BD ya existe y es válida. Resolviendo inmediatamente.');
            resolve(db);
            return;
        }
        
        console.log(`[initDB] Llamando a indexedDB.open('${DB_NAME}', ${DB_VERSION})`);
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            console.log('[initDB] onupgradeneeded: Creando/actualizando object stores...');
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains('lista_compras')) {
                dbInstance.createObjectStore('lista_compras', { keyPath: 'id' });
                console.log('[initDB] Object store "lista_compras" creado.');
            }
            if (!dbInstance.objectStoreNames.contains('recetas')) {
                dbInstance.createObjectStore('recetas', { keyPath: 'id' });
                console.log('[initDB] Object store "recetas" creado.');
            }
            if (!dbInstance.objectStoreNames.contains('plan_semanal')) {
                dbInstance.createObjectStore('plan_semanal', { keyPath: 'dia' });
                console.log('[initDB] Object store "plan_semanal" creado.');
            }
            console.log('[initDB] onupgradeneeded completado.');
        };

        request.onsuccess = (event) => {
            db = event.target.result; // Asignar la instancia de BD
            console.log('[initDB] onsuccess: Conexión a BD exitosa. Resolviendo promesa dbPromise...');
            resolve(db); // Resolver la promesa con la instancia de BD
        };

        request.onerror = (event) => {
            console.error('[initDB] onerror: Error al abrir la base de datos:', event.target.error);
            reject(event.target.error); // Rechazar la promesa en caso de error
        };
        
        request.onblocked = (event) => {
            console.error('[initDB] onblocked: Apertura de BD bloqueada. Cierra otras pestañas con la app.', event);
            // COMENTARIO_ESTRATÉGICO: Es importante manejar 'onblocked'. Si otra pestaña tiene la BD abierta
            // con una versión anterior, esta nueva conexión no se podrá establecer hasta que la otra se cierre.
            // Podríamos notificar al usuario aquí.
            reject(new Error("Apertura de BD bloqueada. Por favor, cierra otras pestañas de esta aplicación."));
        };
    });
}

function showView(viewId) {
    if (!views) { console.warn("showView: 'views' no está definido. ¿Se llamó antes de DOMContentLoaded?"); return; }
    if (!viewId) {
        views.forEach(view => view.classList.add('hidden'));
        return;
    }
    console.log(`[App Resiliente] Mostrando vista: view-${viewId}`);
    views.forEach(view => {
        view.classList.toggle('hidden', view.id !== `view-${viewId}`);
    });
}

async function router() {
    const hash = window.location.hash.substring(1) || 'inicio';
    console.log(`[App Resiliente - Router] Navegando a #${hash}`);
    
    switch (hash) {
        case 'inicio':
            showView('inicio');
            console.log('[App Resiliente - Router] Vista inicio mostrada.');
            break;
        case 'plan-semanal':
            showView('plan-semanal');
            console.log('[App Resiliente - Router] Vista plan-semanal mostrada, llamando a renderPlanSemanal...');
            renderPlanSemanal(); // La función es async, se ejecutará y actualizará el DOM cuando pueda
            break;
        case 'lista-compras':
            showView('lista-compras');
            console.log('[App Resiliente - Router] Vista lista-compras mostrada, llamando a renderListaCompras...');
            renderListaCompras(); // La función es async
            break;
        case 'meal-prep':
            showView('meal-prep');
            console.log('[App Resiliente - Router] Vista meal-prep mostrada.');
            // renderMealPrep(); // Cuando exista
            break;
        default:
            showView('inicio');
            console.warn(`[App Resiliente - Router] Ruta desconocida "${hash}", mostrando inicio.`);
            break;
    }
}

async function renderListaCompras() {
    if (!listaComprasContainer) { console.warn("[App Resiliente - renderListaCompras] Contenedor no encontrado."); return; }
    listaComprasContainer.innerHTML = '<p class="text-gray-500 p-4">Cargando lista de compras...</p>';
    console.log('[App Resiliente - renderListaCompras] Mostrando "Cargando...", esperando dbPromise...');
    
    try {
        const currentDB = await dbPromise;
        console.log('[App Resiliente - renderListaCompras] dbPromise resuelta. Instancia de BD:', currentDB ? 'Obtenida' : 'NULL/UNDEFINED');
        if (!currentDB) {
            console.error('[App Resiliente - renderListaCompras] currentDB es null/undefined después de await dbPromise.');
            throw new Error("Conexión a BD no disponible para lista de compras.");
        }

        const transaction = currentDB.transaction('lista_compras', 'readonly');
        const store = transaction.objectStore('lista_compras');
        const todosLosItems = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
        console.log('[App Resiliente - renderListaCompras] Datos obtenidos de IndexedDB:', todosLosItems);

        listaComprasContainer.innerHTML = '';
        if (todosLosItems.length === 0) {
            listaComprasContainer.innerHTML = '<p class="text-gray-500 p-4">Tu lista de compras está vacía. Puedes cargar datos desde "Inicio".</p>';
        } else {
            todosLosItems.forEach(item => {
                const li = document.createElement('li');
                li.className = `flex items-center justify-between p-3 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 ${item.comprado ? 'comprado opacity-60' : ''}`;
                li.innerHTML = `
                    <div class="flex items-center flex-grow">
                        <input type="checkbox" id="item-${item.id}" data-item-id="${item.id}" class="form-checkbox h-5 w-5 text-primary rounded focus:ring-primary focus:ring-2 focus:ring-offset-1" ${item.comprado ? 'checked' : ''}>
                        <label for="item-${item.id}" class="ml-3 text-textDark flex-grow cursor-pointer ${item.comprado ? 'line-through' : ''}">${item.cantidad} ${item.unidad} de ${item.ingrediente}</label>
                    </div>`;
                listaComprasContainer.appendChild(li);
            });
        }
        console.log('[App Resiliente - renderListaCompras] Renderizado completado.');
    } catch (error) {
        console.error('[App Resiliente - renderListaCompras] Error:', error);
        if (listaComprasContainer) listaComprasContainer.innerHTML = `<p class="text-red-500 p-4">No se pudo cargar la lista de compras. Error: ${error.message}</p>`;
    }
}

function generarHTMLPlanTabla(plan) {
    let html = `<div class="overflow-x-auto rounded-lg shadow-md hidden md:block">
        <table class="w-full text-sm text-left text-textDark">
            <thead class="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                    <th scope="col" class="px-6 py-3 rounded-tl-lg">Comida</th>
                    ${plan.map(p => `<th scope="col" class="px-6 py-3 capitalize">${p.dia}</th>`).join('')}
                    <th scope="col" class="px-1 py-3 rounded-tr-lg"></th>
                </tr>
            </thead>
            <tbody>
                <tr class="bg-white border-b hover:bg-gray-50">
                    <th scope="row" class="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap">Desayuno</th>
                    ${plan.map(p => `<td class="px-6 py-4">${p.desayuno.nombre}</td>`).join('')}
                     <td></td>
                </tr>
                <tr class="bg-white border-b hover:bg-gray-50">
                    <th scope="row" class="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap">Almuerzo</th>
                    ${plan.map(p => `<td class="px-6 py-4">${p.almuerzo.nombre}</td>`).join('')}
                     <td></td>
                </tr>
                <tr class="bg-white hover:bg-gray-50">
                    <th scope="row" class="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap rounded-bl-lg">Cena</th>
                    ${plan.map(p => `<td class="px-6 py-4">${p.cena.nombre}</td>`).join('')}
                    <td class="rounded-br-lg"></td>
                </tr>
            </tbody>
        </table></div>`;
    return html;
}

function generarHTMLPlanTarjetas(plan) {
    let html = `<div class="space-y-4 md:hidden">`;
    plan.forEach(dia => {
        html += `
            <div class="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow duration-300">
                <h3 class="text-lg font-bold capitalize text-primary mb-3">${dia.dia}</h3>
                <ul class="space-y-2 text-sm text-textDark">
                    <li><strong>Desayuno:</strong> ${dia.desayuno.nombre}</li>
                    <li><strong>Almuerzo:</strong> ${dia.almuerzo.nombre}</li>
                    <li><strong>Cena:</strong> ${dia.cena.nombre}</li>
                </ul>
            </div>`;
    });
    html += `</div>`;
    return html;
}

async function renderPlanSemanal() {
    if (!planSemanalContainer) { console.warn("[App Resiliente - renderPlanSemanal] Contenedor no encontrado."); return; }
    planSemanalContainer.innerHTML = '<p class="text-gray-500 p-4">Cargando plan semanal...</p>';
    console.log('[App Resiliente - renderPlanSemanal] Mostrando "Cargando...", esperando dbPromise...');

    try {
        const currentDB = await dbPromise;
        console.log('[App Resiliente - renderPlanSemanal] dbPromise resuelta. Instancia de BD:', currentDB ? 'Obtenida' : 'NULL/UNDEFINED');
        if (!currentDB) {
            console.error('[App Resiliente - renderPlanSemanal] currentDB es null/undefined después de await dbPromise.');
            throw new Error("Conexión a BD no disponible para plan semanal.");
        }
        
        const transaction = currentDB.transaction('plan_semanal', 'readonly');
        const store = transaction.objectStore('plan_semanal');
        const planCompleto = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
        console.log('[App Resiliente - renderPlanSemanal] Datos obtenidos de IndexedDB:', planCompleto);


        if (planCompleto.length === 0) {
            planSemanalContainer.innerHTML = '<p class="text-gray-500 p-4">No hay un plan semanal cargado. Puedes cargar datos desde "Inicio".</p>';
        } else {
            const diasOrdenados = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
            planCompleto.sort((a, b) => diasOrdenados.indexOf(a.dia) - diasOrdenados.indexOf(b.dia));
            planSemanalContainer.innerHTML = generarHTMLPlanTabla(planCompleto) + generarHTMLPlanTarjetas(planCompleto);
        }
        console.log('[App Resiliente - renderPlanSemanal] Renderizado completado.');
    } catch (error) {
        console.error('[App Resiliente - renderPlanSemanal] Error:', error);
        if (planSemanalContainer) planSemanalContainer.innerHTML = `<p class="text-red-500 p-4">No se pudo cargar el plan semanal. Error: ${error.message}</p>`;
    }
}

async function toggleEstadoItemCompra(itemId) {
    console.log(`[App Resiliente - toggleEstadoItemCompra] Intentando cambiar estado para item: ${itemId}`);
    try {
        const currentDB = await dbPromise;
        console.log('[App Resiliente - toggleEstadoItemCompra] dbPromise resuelta.');
        if (!currentDB) throw new Error("BD no disponible para toggleEstadoItemCompra");

        const transaction = currentDB.transaction('lista_compras', 'readwrite');
        const store = transaction.objectStore('lista_compras');
        const item = await new Promise((resolve, reject) => {
            const request = store.get(itemId);
            request.onsuccess = e => resolve(e.target.result);
            request.onerror = e => reject(e.target.error);
        }).catch(err => {
            console.error(`[App Resiliente - toggleEstadoItemCompra] Error obteniendo item ${itemId}:`, err);
            return null;
        });
        
        if (item) {
            item.comprado = !item.comprado;
            await new Promise((resolve, reject) => { 
                const req = store.put(item); 
                req.onsuccess = () => {
                    console.log(`[App Resiliente - toggleEstadoItemCompra] Ítem ${itemId} actualizado a comprado: ${item.comprado}`);
                    resolve();
                };
                req.onerror = reject; 
            });
            return { success: true, newState: item.comprado };
        }
        console.warn(`[App Resiliente - toggleEstadoItemCompra] Ítem ${itemId} no encontrado.`);
        return { success: false, message: "Ítem no encontrado" };
    } catch (error) {
        console.error("[App Resiliente - toggleEstadoItemCompra] Error:", error);
        return { success: false, message: error.message };
    }
}

async function loadSampleData() {
    console.log('[App Resiliente - loadSampleData] Iniciando carga de datos de ejemplo, esperando dbPromise...');
    try {
        const currentDB = await dbPromise;
        console.log('[App Resiliente - loadSampleData] dbPromise resuelta.');
        if (!currentDB) throw new Error("BD no disponible para loadSampleData");

        console.log('[App Resiliente - loadSampleData] Cargando datos de ejemplo en IndexedDB...');
        const sampleLista = [
            { id: "sample-arroz-blanco", ingrediente: "Arroz Blanco", cantidad: 2, unidad: "kg", comprado: false },
            { id: "sample-pechuga-pollo", ingrediente: "Pechuga de Pollo", cantidad: 1.5, unidad: "kg", comprado: false },
            { id: "sample-tomates", ingrediente: "Tomates", cantidad: 1, unidad: "kg", comprado: true },
            { id: "sample-cebolla", ingrediente: "Cebolla", cantidad: 5, unidad: "unidades", comprado: false },
            { id: "sample-lentejas", ingrediente: "Lentejas", cantidad: 0.5, unidad: "kg", comprado: false },
            { id: "sample-aceite-oliva", ingrediente: "Aceite de Oliva", cantidad: 1, unidad: "litro", comprado: false },
        ];
        const samplePlan = [
            { dia: "lunes", desayuno: { id_receta: "rec1", nombre: "Avena con Frutas Frescas" }, almuerzo: { id_receta: "rec2", nombre: "Pollo a la Plancha con Ensalada Verde" }, cena: { id_receta: "rec3", nombre: "Crema de Calabacín y Zanahoria" } },
            { dia: "martes", desayuno: { id_receta: "rec1a", nombre: "Yogurt Griego con Granola y Miel" }, almuerzo: { id_receta: "rec4", nombre: "Lentejas Guisadas con Vegetales" }, cena: { id_receta: "rec5", nombre: "Salmón al Horno con Espárragos" } },
            { dia: "miércoles", desayuno: { id_receta: "rec1", nombre: "Avena con Frutas Frescas" }, almuerzo: { id_receta: "rec6", nombre: "Pasta Integral con Pesto y Tomates Cherry" }, cena: { id_receta: "rec7", nombre: "Sopa de Pollo Casera" } },
            { dia: "jueves", desayuno: { id_receta: "rec1a", nombre: "Yogurt Griego con Granola y Miel" }, almuerzo: { id_receta: "rec8", nombre: "Ensalada César con Pollo a la Parrilla" }, cena: { id_receta: "rec9", nombre: "Tortilla de Patatas y Cebolla" } },
            { dia: "viernes", desayuno: { id_receta: "rec1", nombre: "Avena con Frutas Frescas" }, almuerzo: { id_receta: "rec10", nombre: "Tacos de Pescado con Salsa de Mango" }, cena: { id_receta: "rec11", nombre: "Pizza Casera de Vegetales" } },
        ];

        const transaction = currentDB.transaction(['lista_compras', 'plan_semanal'], 'readwrite');
        await Promise.all([
            ...sampleLista.map(i => new Promise((res, rej) => { const r = transaction.objectStore('lista_compras').put(i); r.onsuccess = res; r.onerror = rej; })),
            ...samplePlan.map(d => new Promise((res, rej) => { const r = transaction.objectStore('plan_semanal').put(d); r.onsuccess = res; r.onerror = rej; }))
        ]);
        console.log('[App Resiliente - loadSampleData] Datos de ejemplo cargados con éxito en IndexedDB.');
        alert('Datos de ejemplo (Plan y Lista) cargados.');
        
        // Re-renderizar la vista actual si es necesario
        const currentHash = window.location.hash.substring(1) || 'inicio';
        if (currentHash === 'lista-compras') {
            await renderListaCompras();
        } else if (currentHash === 'plan-semanal') {
            await renderPlanSemanal();
        }

    } catch (error) {
        console.error("[App Resiliente - loadSampleData] Error:", error);
        alert("Error al cargar los datos de ejemplo: " + error.message);
    }
}

async function main() {
    console.log('Iniciando aplicación NutriPlan (Resiliente Intento #2 con más logs)...');
    
    views = document.querySelectorAll('.view');
    loadSampleDataButton = document.getElementById('load-sample-data-button');
    listaComprasContainer = document.getElementById('lista-compras-container');
    currentYearSpan = document.getElementById('current-year');
    planSemanalContainer = document.getElementById('plan-semanal-container');

    // dbPromise ya se inició globalmente. El router se ejecuta inmediatamente.
    console.log('[App Resiliente - main] Llamando al router...');
    router(); 
    window.addEventListener('hashchange', router);
    console.log('[App Resiliente - main] Event listener para hashchange añadido.');
    
    if (loadSampleDataButton) {
        loadSampleDataButton.addEventListener('click', async () => {
            console.log('[App Resiliente - main] Botón "Cargar Datos de Ejemplo" clickeado.');
            loadSampleDataButton.disabled = true;
            const originalText = loadSampleDataButton.textContent;
            loadSampleDataButton.textContent = 'Cargando...';
            await loadSampleData(); // loadSampleData ya maneja su propio try/catch
            loadSampleDataButton.disabled = false;
            loadSampleDataButton.textContent = originalText;
        });
        console.log('[App Resiliente - main] Event listener para loadSampleDataButton añadido.');
    } else {
        console.warn('[App Resiliente - main] Botón "load-sample-data-button" no encontrado.');
    }
    
    if (listaComprasContainer) {
        listaComprasContainer.addEventListener('change', async (event) => {
            if (event.target.type === 'checkbox' && event.target.dataset.itemId) {
                const itemId = event.target.dataset.itemId;
                const listItemElement = event.target.closest('li');
                console.log(`[App Resiliente - main] Checkbox para item ${itemId} cambiado.`);
                event.target.disabled = true;
                const result = await toggleEstadoItemCompra(itemId);
                if (result.success && listItemElement) {
                    listItemElement.classList.toggle('comprado', result.newState);
                    listItemElement.classList.toggle('opacity-60', result.newState);
                    event.target.checked = result.newState; 
                } else if (!result.success) {
                    event.target.checked = !event.target.checked; 
                    alert('Hubo un error al guardar el cambio: ' + (result.message || 'Error desconocido'));
                }
                event.target.disabled = false;
            }
        });
        console.log('[App Resiliente - main] Event listener para listaComprasContainer añadido.');
    } else {
        console.warn('[App Resiliente - main] Contenedor "lista-compras-container" no encontrado.');
    }
    
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
            console.log('[App Resiliente - main] SW registrado. Scope:', registration.scope);
            // Opcional: Escuchar actualizaciones del SW
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // Nuevo contenido está disponible, pero el SW anterior todavía controla la página.
                                // Podrías mostrar un mensaje al usuario para refrescar.
                                console.log('[App Resiliente - main] Nuevo Service Worker instalado. Refresca para actualizar.');
                            } else {
                                // Contenido cacheado por primera vez.
                                console.log('[App Resiliente - main] Contenido cacheado por Service Worker por primera vez.');
                            }
                        }
                    };
                }
            };
        } catch (error) {
            console.error('[App Resiliente - main] Falló registro SW:', error);
        }
    } else {
        console.warn('[App Resiliente - main] Service Workers no son soportados.');
    }
    console.log('[App Resiliente - main] Inicialización completada.');
}

if (document.readyState === 'loading') {
    console.log('[App Resiliente] DOM no listo, añadiendo listener para DOMContentLoaded.');
    document.addEventListener('DOMContentLoaded', main);
} else {
    console.log('[App Resiliente] DOM ya listo, llamando a main() directamente.');
    main();
}
