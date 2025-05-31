/**
 * js/app.js
 * Lógica principal para la PWA NutriPlan Narváez Yánez (Tema Santuario Nutricional - Completo)
 */

const DB_NAME = 'pwa_nutriplan_db';
const DB_VERSION = 1; // Incrementar si cambias estructura de stores y manejas la migración
let db; 

console.log('[App Santuario] Script cargado. Iniciando dbPromise...');
const dbPromise = initDB();
console.log('[App Santuario] dbPromise iniciado.');

let views, loadSampleDataButton, listaComprasContainer, currentYearSpan, planSemanalContainer, mealPrepContainer;

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
            if (!dbInstance.objectStoreNames.contains('meal_prep')) {
                dbInstance.createObjectStore('meal_prep', { keyPath: 'id' });
                console.log('[initDB] Object store "meal_prep" creado.');
            }
            console.log('[initDB] onupgradeneeded completado.');
        };

        request.onsuccess = (event) => {
            db = event.target.result; 
            console.log('[initDB] onsuccess: Conexión a BD exitosa. Resolviendo promesa dbPromise...');
            resolve(db); 
        };

        request.onerror = (event) => {
            console.error('[initDB] onerror: Error al abrir la base de datos:', event.target.error);
            reject(event.target.error); 
        };
        
        request.onblocked = (event) => {
            console.error('[initDB] onblocked: Apertura de BD bloqueada. Cierra otras pestañas con la app.', event);
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
    console.log(`[App Santuario] Mostrando vista: view-${viewId}`);
    views.forEach(view => {
        view.classList.toggle('hidden', view.id !== `view-${viewId}`);
    });
}

async function router() {
    const hash = window.location.hash.substring(1) || 'inicio';
    console.log(`[App Santuario - Router] Navegando a #${hash}`);
    
    switch (hash) {
        case 'inicio':
            showView('inicio');
            console.log('[App Santuario - Router] Vista inicio mostrada.');
            break;
        case 'plan-semanal':
            showView('plan-semanal');
            console.log('[App Santuario - Router] Vista plan-semanal mostrada, llamando a renderPlanSemanal...');
            renderPlanSemanal(); 
            break;
        case 'lista-compras':
            showView('lista-compras');
            console.log('[App Santuario - Router] Vista lista-compras mostrada, llamando a renderListaCompras...');
            renderListaCompras(); 
            break;
        case 'meal-prep':
            showView('meal-prep');
            console.log('[App Santuario - Router] Vista meal-prep mostrada, llamando a renderMealPrep...');
            renderMealPrep();
            break;
        default:
            showView('inicio');
            console.warn(`[App Santuario - Router] Ruta desconocida "${hash}", mostrando inicio.`);
            break;
    }
}

async function renderListaCompras() {
    if (!listaComprasContainer) { console.warn("[App Santuario - renderListaCompras] Contenedor no encontrado."); return; }
    listaComprasContainer.innerHTML = '<p class="text-text-light p-4 text-center">Cargando tu lista de compras...</p>';
    console.log('[App Santuario - renderListaCompras] Esperando dbPromise...');
    
    try {
        const currentDB = await dbPromise;
        console.log('[App Santuario - renderListaCompras] dbPromise resuelta.');
        if (!currentDB) throw new Error("Conexión a BD no disponible.");

        const transaction = currentDB.transaction('lista_compras', 'readonly');
        const store = transaction.objectStore('lista_compras');
        const todosLosItems = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
        
        listaComprasContainer.innerHTML = ''; 
        if (todosLosItems.length === 0) {
            listaComprasContainer.innerHTML = '<p class="text-text-light p-6 text-center bg-white/50 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/40">Tu lista de compras está vacía. ¡Añade algunos ingredientes o carga datos de ejemplo!</p>';
        } else {
            todosLosItems.forEach(item => {
                const li = document.createElement('li');
                li.className = `
                    flex items-center justify-between 
                    p-4 
                    bg-white/60 backdrop-blur-md
                    rounded-xl 
                    shadow-lg 
                    border border-white/30 
                    transition-all duration-300 ease-out
                    hover:bg-white/80 hover:shadow-xl 
                    ${item.comprado ? 'opacity-50' : ''} 
                `;
                
                const labelClass = item.comprado 
                    ? 'line-through text-text-light' 
                    : 'text-text-dark';

                li.innerHTML = `
                    <div class="flex items-center flex-grow">
                        <input 
                            type="checkbox" 
                            id="item-${item.id}" 
                            data-item-id="${item.id}" 
                            class="form-checkbox h-5 w-5 text-accent-mint rounded-md border-primary-subtle focus:ring-2 focus:ring-accent-mint focus:ring-opacity-50 cursor-pointer"
                            ${item.comprado ? 'checked' : ''}
                        >
                        <label for="item-${item.id}" class="ml-4 ${labelClass} flex-grow cursor-pointer text-sm sm:text-base">
                            <span class="font-medium">${item.ingrediente}</span>
                            <span class="text-xs text-text-light ml-1">(${item.cantidad} ${item.unidad})</span>
                        </label>
                    </div>
                `;
                listaComprasContainer.appendChild(li);
            });
        }
        console.log('[App Santuario - renderListaCompras] Renderizado completado.');
    } catch (error) {
        console.error('[App Santuario - renderListaCompras] Error:', error);
        if (listaComprasContainer) listaComprasContainer.innerHTML = `<p class="text-red-500 p-4 text-center">No se pudo cargar la lista de compras. ${error.message}</p>`;
    }
}

function generarHTMLPlanTabla(plan) {
    let html = `<div class="overflow-x-auto rounded-xl shadow-xl hidden md:block bg-white/50 backdrop-blur-lg border border-white/30 p-1">
        <table class="w-full text-sm text-left text-text-dark">
            <thead class="text-xs text-text-light uppercase bg-white/20 backdrop-blur-sm">
                <tr>
                    <th scope="col" class="px-6 py-4 font-semibold rounded-tl-lg">Comida</th>
                    ${plan.map(p => `<th scope="col" class="px-6 py-4 font-semibold capitalize">${p.dia}</th>`).join('')}
                    <th scope="col" class="px-1 py-3 rounded-tr-lg"></th>
                </tr>
            </thead>
            <tbody>
                <tr class="bg-transparent hover:bg-white/20 border-b border-slate-200/20 transition-colors duration-200">
                    <th scope="row" class="px-6 py-4 font-medium whitespace-nowrap">Desayuno</th>
                    ${plan.map(p => `<td class="px-6 py-4">${p.desayuno.nombre}</td>`).join('')}
                     <td></td>
                </tr>
                <tr class="bg-transparent hover:bg-white/20 border-b border-slate-200/20 transition-colors duration-200">
                    <th scope="row" class="px-6 py-4 font-medium whitespace-nowrap">Almuerzo</th>
                    ${plan.map(p => `<td class="px-6 py-4">${p.almuerzo.nombre}</td>`).join('')}
                     <td></td>
                </tr>
                <tr class="bg-transparent hover:bg-white/20 transition-colors duration-200">
                    <th scope="row" class="px-6 py-4 font-medium whitespace-nowrap rounded-bl-lg">Cena</th>
                    ${plan.map(p => `<td class="px-6 py-4">${p.cena.nombre}</td>`).join('')}
                    <td class="rounded-br-lg"></td>
                </tr>
            </tbody>
        </table>
    </div>`;
    return html;
}

function generarHTMLPlanTarjetas(plan) {
    let html = `<div class="space-y-4 md:hidden">`;
    plan.forEach(dia => {
        html += `
            <div class="bg-white/60 backdrop-blur-md rounded-xl shadow-xl p-5 border border-white/30 hover:bg-white/75 hover:shadow-2xl transition-all duration-300 ease-out transform hover:-translate-y-1">
                <h3 class="text-xl font-semibold capitalize text-accent-sapphire mb-3 pb-2 border-b border-primary-subtle/50">${dia.dia}</h3>
                <ul class="space-y-2 text-sm text-text-dark">
                    <li><strong class="text-text-light font-medium">Desayuno:</strong> ${dia.desayuno.nombre}</li>
                    <li><strong class="text-text-light font-medium">Almuerzo:</strong> ${dia.almuerzo.nombre}</li>
                    <li><strong class="text-text-light font-medium">Cena:</strong> ${dia.cena.nombre}</li>
                </ul>
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

async function renderPlanSemanal() {
    if (!planSemanalContainer) { console.warn("[App Santuario - renderPlanSemanal] Contenedor no encontrado."); return; }
    planSemanalContainer.innerHTML = '<p class="text-text-light p-6 text-center">Cargando tu plan semanal...</p>';
    console.log('[App Santuario - renderPlanSemanal] Esperando dbPromise...');

    try {
        const currentDB = await dbPromise;
        console.log('[App Santuario - renderPlanSemanal] dbPromise resuelta.');
        if (!currentDB) throw new Error("Conexión a BD no disponible.");
        
        const transaction = currentDB.transaction('plan_semanal', 'readonly');
        const store = transaction.objectStore('plan_semanal');
        const planCompleto = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
        
        if (planCompleto.length === 0) {
            planSemanalContainer.innerHTML = '<p class="text-text-light p-6 text-center">No hay un plan semanal cargado. ¡Carga datos de ejemplo desde Inicio!</p>';
        } else {
            const diasOrdenados = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
            planCompleto.sort((a, b) => diasOrdenados.indexOf(a.dia) - diasOrdenados.indexOf(b.dia));
            planSemanalContainer.innerHTML = generarHTMLPlanTabla(planCompleto) + generarHTMLPlanTarjetas(planCompleto);
        }
        console.log('[App Santuario - renderPlanSemanal] Renderizado completado con nuevo estilo.');
    } catch (error) {
        console.error('[App Santuario - renderPlanSemanal] Error:', error);
        if (planSemanalContainer) planSemanalContainer.innerHTML = `<p class="text-red-500 p-6 text-center">No se pudo cargar el plan semanal. ${error.message}</p>`;
    }
}

async function toggleEstadoItemCompra(itemId) {
    console.log(`[App Santuario - toggleEstadoItemCompra] Intentando cambiar estado para item: ${itemId}`);
    try {
        const currentDB = await dbPromise;
        console.log('[App Santuario - toggleEstadoItemCompra] dbPromise resuelta.');
        if (!currentDB) throw new Error("BD no disponible para toggleEstadoItemCompra");

        const transaction = currentDB.transaction('lista_compras', 'readwrite');
        const store = transaction.objectStore('lista_compras');
        const item = await new Promise((resolve, reject) => {
            const request = store.get(itemId);
            request.onsuccess = e => resolve(e.target.result);
            request.onerror = e => reject(e.target.error);
        }).catch(err => {
            console.error(`[App Santuario - toggleEstadoItemCompra] Error obteniendo item ${itemId}:`, err);
            return null;
        });
        
        if (item) {
            item.comprado = !item.comprado;
            await new Promise((resolve, reject) => { 
                const req = store.put(item); 
                req.onsuccess = () => {
                    console.log(`[App Santuario - toggleEstadoItemCompra] Ítem ${itemId} actualizado a comprado: ${item.comprado}`);
                    resolve();
                };
                req.onerror = reject; 
            });
            return { success: true, newState: item.comprado };
        }
        console.warn(`[App Santuario - toggleEstadoItemCompra] Ítem ${itemId} no encontrado.`);
        return { success: false, message: "Ítem no encontrado" };
    } catch (error) {
        console.error("[App Santuario - toggleEstadoItemCompra] Error:", error);
        return { success: false, message: error.message };
    }
}

async function renderMealPrep() {
    if (!mealPrepContainer) { console.warn("[App Santuario - renderMealPrep] Contenedor no encontrado."); return; }
    mealPrepContainer.innerHTML = '<p class="text-text-light p-4 text-center">Cargando tareas de preparación...</p>';
    console.log('[App Santuario - renderMealPrep] Esperando dbPromise...');

    try {
        const currentDB = await dbPromise;
        if (!currentDB) throw new Error("Conexión a BD no disponible.");

        const transaction = currentDB.transaction('meal_prep', 'readonly');
        const store = transaction.objectStore('meal_prep');
        const todasLasTareas = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });

        mealPrepContainer.innerHTML = '';
        if (todasLasTareas.length === 0) {
            mealPrepContainer.innerHTML = '<p class="text-text-light p-6 text-center bg-white/50 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/40">No hay tareas de preparación programadas. ¡Carga datos de ejemplo desde Inicio!</p>';
            return;
        }

        const tareasAgrupadas = todasLasTareas.reduce((acc, tarea) => {
            const dia = tarea.dia_prep || 'General';
            if (!acc[dia]) acc[dia] = [];
            acc[dia].push(tarea);
            return acc;
        }, {});

        const ordenDias = ['Semanal', 'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'General'];

        for (const dia of ordenDias) {
            if (tareasAgrupadas[dia] && tareasAgrupadas[dia].length > 0) {
                const seccionDiaHTML = document.createElement('div');
                seccionDiaHTML.className = 'mb-6';
                const tituloDia = document.createElement('h3');
                tituloDia.className = 'text-xl font-semibold text-accent-sapphire mb-3 pb-1 border-b-2 border-primary-subtle';
                tituloDia.textContent = (dia === 'Semanal' || dia === 'General') ? `Preparación ${dia}` : `Para el ${dia}`;
                seccionDiaHTML.appendChild(tituloDia);
                const listaTareasHTML = document.createElement('ul');
                listaTareasHTML.className = 'space-y-2';
                tareasAgrupadas[dia].forEach(tarea => {
                    const li = document.createElement('li');
                    li.className = `flex items-center p-3 bg-white/60 backdrop-blur-md rounded-lg shadow-md border border-white/30 transition-opacity duration-300 ${tarea.completada ? 'opacity-50' : ''}`;
                    const labelClass = tarea.completada ? 'line-through text-text-light' : 'text-text-dark';
                    li.innerHTML = `
                        <input type="checkbox" id="mealprep-${tarea.id}" data-mealprep-id="${tarea.id}" class="form-checkbox h-5 w-5 text-accent-mint rounded-md border-primary-subtle focus:ring-2 focus:ring-accent-mint focus:ring-opacity-50 cursor-pointer" ${tarea.completada ? 'checked' : ''}>
                        <label for="mealprep-${tarea.id}" class="ml-3 ${labelClass} text-sm flex-grow cursor-pointer">${tarea.descripcion}</label>`;
                    listaTareasHTML.appendChild(li);
                });
                seccionDiaHTML.appendChild(listaTareasHTML);
                mealPrepContainer.appendChild(seccionDiaHTML);
            }
        }
        console.log('[App Santuario - renderMealPrep] Renderizado completado.');
    } catch (error) {
        console.error('[App Santuario - renderMealPrep] Error:', error);
        if (mealPrepContainer) mealPrepContainer.innerHTML = `<p class="text-red-500 p-4 text-center">No se pudieron cargar las tareas de preparación. ${error.message}</p>`;
    }
}

async function toggleEstadoTareaMealPrep(tareaId) {
    console.log(`[App Santuario - toggleEstadoTareaMealPrep] ID: ${tareaId}`);
    try {
        const currentDB = await dbPromise;
        if (!currentDB) throw new Error("BD no disponible.");
        const transaction = currentDB.transaction('meal_prep', 'readwrite');
        const store = transaction.objectStore('meal_prep');
        const tarea = await new Promise((resolve, reject) => {
            const request = store.get(tareaId);
            request.onsuccess = e => resolve(e.target.result);
            request.onerror = e => reject(e.target.error);
        });
        if (tarea) {
            tarea.completada = !tarea.completada;
            await new Promise((resolve, reject) => { 
                const req = store.put(tarea); req.onsuccess = resolve; req.onerror = reject; 
            });
            return { success: true, newState: tarea.completada };
        }
        return { success: false, message: "Tarea no encontrada" };
    } catch (error) {
        console.error("[App Santuario - toggleEstadoTareaMealPrep] Error:", error);
        return { success: false, message: error.message };
    }
}

async function loadSampleData() {
    console.log('[App Santuario - loadSampleData] Iniciando carga de datos de ejemplo, esperando dbPromise...');
    try {
        const currentDB = await dbPromise;
        console.log('[App Santuario - loadSampleData] dbPromise resuelta.');
        if (!currentDB) throw new Error("BD no disponible para loadSampleData");

        console.log('[App Santuario - loadSampleData] Cargando datos de ejemplo en IndexedDB...');
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
        const sampleMealPrep = [
            { id: 'mp-s1', descripcion: 'Lavar y almacenar todas las hojas verdes (lechuga, espinaca).', dia_prep: 'Semanal', completada: false },
            { id: 'mp-s2', descripcion: 'Cocinar 2 tazas de quinoa.', dia_prep: 'Semanal', completada: true },
            { id: 'mp-d1', descripcion: 'Cortar vegetales para ensaladas de Lunes y Martes.', dia_prep: 'Domingo', completada: false },
            { id: 'mp-d2', descripcion: 'Preparar aderezo para ensaladas.', dia_prep: 'Domingo', completada: false },
            { id: 'mp-l1', descripcion: 'Descongelar pollo para la cena.', dia_prep: 'Lunes', completada: false },
            { id: 'mp-m1', descripcion: 'Remojar lentejas para almuerzo del Martes.', dia_prep: 'Lunes', completada: false },
        ];

        const transaction = currentDB.transaction(['lista_compras', 'plan_semanal', 'meal_prep'], 'readwrite');
        const listaStore = transaction.objectStore('lista_compras');
        const planStore = transaction.objectStore('plan_semanal');
        const mealPrepStore = transaction.objectStore('meal_prep');
        
        // Limpiar stores antes de añadir para evitar duplicados en recargas de ejemplo
        await Promise.all([
            new Promise((res,rej) => { const r = listaStore.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = planStore.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = mealPrepStore.clear(); r.onsuccess = res; r.onerror = rej; })
        ]);

        await Promise.all([
            ...sampleLista.map(i => new Promise((res, rej) => { const r = listaStore.put(i); r.onsuccess = res; r.onerror = rej; })),
            ...samplePlan.map(d => new Promise((res, rej) => { const r = planStore.put(d); r.onsuccess = res; r.onerror = rej; })),
            ...sampleMealPrep.map(t => new Promise((res, rej) => { const r = mealPrepStore.put(t); r.onsuccess = res; r.onerror = rej; }))
        ]);
        
        console.log('[App Santuario - loadSampleData] Datos de ejemplo cargados con éxito en IndexedDB.');
        alert('Datos de ejemplo (Plan, Lista y Meal Prep) cargados con éxito.');
        
        const currentHash = window.location.hash.substring(1) || 'inicio';
        if (currentHash === 'lista-compras') await renderListaCompras();
        else if (currentHash === 'plan-semanal') await renderPlanSemanal();
        else if (currentHash === 'meal-prep') await renderMealPrep();

    } catch (error) {
        console.error("[App Santuario - loadSampleData] Error:", error);
        alert("Error al cargar los datos de ejemplo: " + error.message);
    }
}

async function main() {
    console.log('Iniciando aplicación NutriPlan (Santuario con Glassmorphism en Lista y Plan)...');
    
    views = document.querySelectorAll('.view');
    loadSampleDataButton = document.getElementById('load-sample-data-button');
    listaComprasContainer = document.getElementById('lista-compras-container');
    currentYearSpan = document.getElementById('current-year');
    planSemanalContainer = document.getElementById('plan-semanal-container');
    mealPrepContainer = document.getElementById('meal-prep-container'); // Asegurarse que este se define

    console.log('[App Santuario - main] Llamando al router...');
    router(); 
    window.addEventListener('hashchange', router);
    console.log('[App Santuario - main] Event listener para hashchange añadido.');
    
    if (loadSampleDataButton) {
        loadSampleDataButton.addEventListener('click', async () => {
            console.log('[App Santuario - main] Botón "Cargar Datos de Ejemplo" clickeado.');
            loadSampleDataButton.disabled = true;
            const originalText = loadSampleDataButton.textContent;
            loadSampleDataButton.textContent = 'Cargando...';
            await loadSampleData(); 
            loadSampleDataButton.disabled = false;
            loadSampleDataButton.textContent = originalText;
        });
        console.log('[App Santuario - main] Event listener para loadSampleDataButton añadido.');
    } else {
        console.warn('[App Santuario - main] Botón "load-sample-data-button" no encontrado.');
    }
    
    if (listaComprasContainer) {
        listaComprasContainer.addEventListener('change', async (event) => {
            if (event.target.type === 'checkbox' && event.target.dataset.itemId) {
                const itemId = event.target.dataset.itemId;
                const listItemElement = event.target.closest('li');
                console.log(`[App Santuario - main] Checkbox para item ${itemId} cambiado.`);
                event.target.disabled = true;
                const result = await toggleEstadoItemCompra(itemId);
                if (result.success && listItemElement) {
                    listItemElement.classList.toggle('opacity-50', result.newState); 
                    const label = listItemElement.querySelector('label');
                    if (label) {
                        label.classList.toggle('line-through', result.newState);
                        label.classList.toggle('text-text-light', result.newState);
                        label.classList.toggle('text-text-dark', !result.newState);
                    }
                    event.target.checked = result.newState; 
                } else if (!result.success) {
                    event.target.checked = !event.target.checked; 
                    alert('Hubo un error al guardar el cambio: ' + (result.message || 'Error desconocido'));
                }
                event.target.disabled = false;
            }
        });
        console.log('[App Santuario - main] Event listener para listaComprasContainer añadido.');
    } else {
        console.warn('[App Santuario - main] Contenedor "lista-compras-container" no encontrado.');
    }

    if (mealPrepContainer) {
        mealPrepContainer.addEventListener('change', async (event) => {
            if (event.target.type === 'checkbox' && event.target.dataset.mealprepId) {
                const tareaId = event.target.dataset.mealprepId;
                const listItemElement = event.target.closest('li');
                event.target.disabled = true;
                const result = await toggleEstadoTareaMealPrep(tareaId);
                if (result.success && listItemElement) {
                    listItemElement.classList.toggle('opacity-50', result.newState);
                    const label = listItemElement.querySelector('label');
                    if (label) {
                        label.classList.toggle('line-through', result.newState);
                        label.classList.toggle('text-text-light', result.newState);
                        label.classList.toggle('text-text-dark', !result.newState);
                    }
                    event.target.checked = result.newState; 
                } else if (!result.success) {
                    event.target.checked = !event.target.checked; 
                    alert('Hubo un error al guardar el cambio: ' + (result.message || 'Error desconocido'));
                }
                event.target.disabled = false;
            }
        });
        console.log('[App Santuario - main] Event listener para mealPrepContainer añadido.');
    } else {
        console.warn('[App Santuario - main] Contenedor "meal-prep-container" no encontrado.');
    }
    
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
            console.log('[App Santuario - main] SW registrado. Scope:', registration.scope);
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                console.log('[App Santuario - main] Nuevo Service Worker instalado. Refresca para actualizar.');
                            } else {
                                console.log('[App Santuario - main] Contenido cacheado por Service Worker por primera vez.');
                            }
                        }
                    };
                }
            };
        } catch (error) {
            console.error('[App Santuario - main] Falló registro SW:', error);
        }
    } else {
        console.warn('[App Santuario - main] Service Workers no son soportados.');
    }
    console.log('[App Santuario - main] Inicialización completada.');
}

if (document.readyState === 'loading') {
    console.log('[App Santuario] DOM no listo, añadiendo listener para DOMContentLoaded.');
    document.addEventListener('DOMContentLoaded', main);
} else {
    console.log('[App Santuario] DOM ya listo, llamando a main() directamente.');
    main();
}
