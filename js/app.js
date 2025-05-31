/**
 * js/app.js
 * Lógica principal para la PWA NutriPlan Narváez Yánez (Tema Santuario Nutricional - Completo)
 */

const DB_NAME = 'pwa_nutriplan_db';
const DB_VERSION = 1; // Incrementar si cambias estructura de stores y manejas la migración en onupgradeneeded
let db; 

console.log('[App Santuario] Script cargado. Iniciando dbPromise...');
const dbPromise = initDB();
console.log('[App Santuario] dbPromise iniciado.');

let views, loadSampleDataButton, listaComprasContainer, currentYearSpan, planSemanalContainer, mealPrepContainer, recetaDetalleContentWrapper;

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
    const fullHash = window.location.hash.substring(1);
    const [viewName, param] = fullHash.split('/'); 
    const currentViewId = viewName || 'inicio';

    console.log(`[App Santuario - Router] Navegando a #${currentViewId}, Param: ${param}`);
    
    switch (currentViewId) {
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
        case 'receta-detalle':
            showView('receta-detalle');
            if (param) {
                console.log(`[App Santuario - Router] Llamando a renderRecetaDetalle con ID: ${param}`);
                renderRecetaDetalle(param);
            } else {
                console.warn("[App Santuario - Router] ID de receta no proporcionado para receta-detalle.");
                if(recetaDetalleContentWrapper) recetaDetalleContentWrapper.innerHTML = '<p class="text-red-500 p-4 text-center">Error: No se especificó una receta.</p>';
            }
            break;
        default:
            showView('inicio');
            console.warn(`[App Santuario - Router] Ruta desconocida "${fullHash}", mostrando inicio.`);
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
                    ${plan.map(p => `<td class="px-6 py-4"><a href="#receta-detalle/${p.desayuno.id_receta}" class="text-text-dark hover:text-accent-sapphire hover:underline transition-colors duration-200">${p.desayuno.nombre}</a></td>`).join('')}
                     <td></td>
                </tr>
                <tr class="bg-transparent hover:bg-white/20 border-b border-slate-200/20 transition-colors duration-200">
                    <th scope="row" class="px-6 py-4 font-medium whitespace-nowrap">Almuerzo</th>
                    ${plan.map(p => `<td class="px-6 py-4"><a href="#receta-detalle/${p.almuerzo.id_receta}" class="text-text-dark hover:text-accent-sapphire hover:underline transition-colors duration-200">${p.almuerzo.nombre}</a></td>`).join('')}
                     <td></td>
                </tr>
                <tr class="bg-transparent hover:bg-white/20 transition-colors duration-200">
                    <th scope="row" class="px-6 py-4 font-medium whitespace-nowrap rounded-bl-lg">Cena</th>
                    ${plan.map(p => `<td class="px-6 py-4"><a href="#receta-detalle/${p.cena.id_receta}" class="text-text-dark hover:text-accent-sapphire hover:underline transition-colors duration-200">${p.cena.nombre}</a></td>`).join('')}
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
                    <li><strong class="text-text-light font-medium">Desayuno:</strong> <a href="#receta-detalle/${dia.desayuno.id_receta}" class="text-text-dark hover:text-accent-sapphire hover:underline transition-colors duration-200">${dia.desayuno.nombre}</a></li>
                    <li><strong class="text-text-light font-medium">Almuerzo:</strong> <a href="#receta-detalle/${dia.almuerzo.id_receta}" class="text-text-dark hover:text-accent-sapphire hover:underline transition-colors duration-200">${dia.almuerzo.nombre}</a></li>
                    <li><strong class="text-text-light font-medium">Cena:</strong> <a href="#receta-detalle/${dia.cena.id_receta}" class="text-text-dark hover:text-accent-sapphire hover:underline transition-colors duration-200">${dia.cena.nombre}</a></li>
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

async function renderRecetaDetalle(recetaId) {
    if (!recetaDetalleContentWrapper) { console.warn("[App Santuario - renderRecetaDetalle] Contenedor no encontrado."); return; }
    recetaDetalleContentWrapper.innerHTML = '<p class="text-text-light p-8 text-center text-lg">Cargando detalles de la receta...</p>';
    console.log(`[App Santuario - renderRecetaDetalle] Esperando dbPromise para receta ID: ${recetaId}`);

    try {
        const currentDB = await dbPromise;
        console.log('[App Santuario - renderRecetaDetalle] dbPromise resuelta.');
        if (!currentDB) throw new Error("Conexión a BD no disponible.");

        const transaction = currentDB.transaction('recetas', 'readonly');
        const store = transaction.objectStore('recetas');
        const receta = await new Promise((resolve, reject) => {
            const request = store.get(recetaId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });

        console.log('[App Santuario - renderRecetaDetalle] Receta obtenida de IndexedDB:', receta);

        if (!receta) {
            recetaDetalleContentWrapper.innerHTML = `<div class="text-center p-8"><p class="text-text-light text-lg">Receta con ID '${recetaId}' no encontrada.</p> <button onclick="window.location.hash='#plan-semanal'" class="mt-4 text-accent-sapphire hover:text-accent-coral font-medium text-sm flex items-center mx-auto"> <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Volver al Plan Semanal</button></div>`;
            return;
        }

        const imagenHtml = receta.imagenUrl 
            ? `<div class="mb-6 md:mb-8 rounded-xl overflow-hidden shadow-xl aspect-video">
                 <img src="${receta.imagenUrl}" alt="${receta.nombre}" class="w-full h-full object-cover">
               </div>`
            : '<div class="mb-6 p-4 bg-ui-secondary rounded-lg text-center text-text-light text-sm">Imagen no disponible</div>';

        let ingredientesHtml = '<ul class="space-y-2.5 mb-8 list-none pl-0 text-text-dark">';
        receta.ingredientes.forEach(ing => {
            ingredientesHtml += `
                <li class="text-sm flex items-center p-3 bg-white/40 backdrop-blur-sm rounded-lg shadow-sm border border-white/20">
                    <span class="text-accent-mint mr-2 text-lg">▹</span>
                    <span class="font-medium">${ing.cantidad} ${ing.unidad}</span>&nbsp;de ${ing.nombre}${ing.notas ? ` <em class="text-xs text-text-light ml-1">(${ing.notas})</em>` : ''}
                </li>`;
        });
        ingredientesHtml += '</ul>';

        let instruccionesHtml = '<ol class="space-y-4 text-text-dark">';
        receta.instrucciones.forEach((paso, index) => {
            instruccionesHtml += `
                <li class="text-sm leading-relaxed flex">
                    <span class="bg-accent-sapphire text-white rounded-full h-6 w-6 flex items-center justify-center font-semibold text-xs mr-3 flex-shrink-0">${index + 1}</span>
                    <span>${paso}</span>
                </li>`;
        });
        instruccionesHtml += '</ol>';
        
        recetaDetalleContentWrapper.innerHTML = `
            <button onclick="window.history.back()" class="mb-6 text-accent-sapphire hover:text-accent-coral font-medium text-sm flex items-center transition-colors duration-200 group">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1.5 transform group-hover:-translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver
            </button>
            
            ${imagenHtml}

            <h2 class="text-3xl md:text-4xl font-semibold text-text-dark mb-2 text-center">${receta.nombre}</h2>
            <p class="text-text-light mb-8 text-sm text-center italic">${receta.descripcionCorta || ''}</p>
            
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 text-sm text-center">
                <div class="bg-white/40 backdrop-blur-sm p-3 rounded-lg shadow-md border border-white/20"><strong class="block text-text-light text-xs uppercase tracking-wider mb-0.5">Porciones</strong> ${receta.porciones}</div>
                <div class="bg-white/40 backdrop-blur-sm p-3 rounded-lg shadow-md border border-white/20"><strong class="block text-text-light text-xs uppercase tracking-wider mb-0.5">T. Prep</strong> ${receta.tiempoPrep}</div>
                <div class="bg-white/40 backdrop-blur-sm p-3 rounded-lg shadow-md border border-white/20 col-span-2 sm:col-span-1"><strong class="block text-text-light text-xs uppercase tracking-wider mb-0.5">T. Cocción</strong> ${receta.tiempoCoccion}</div>
            </div>

            <div class="grid md:grid-cols-5 gap-8">
                <div class="md:col-span-2 mb-6 md:mb-0">
                    <h3 class="text-2xl font-semibold text-accent-sapphire mb-4 pb-2 border-b border-primary-subtle/40">Ingredientes</h3>
                    ${ingredientesHtml}
                </div>

                <div class="md:col-span-3">
                    <h3 class="text-2xl font-semibold text-accent-sapphire mb-4 pb-2 border-b border-primary-subtle/40">Preparación</h3>
                    ${instruccionesHtml}
                </div>
            </div>

            ${receta.notasAdicionales ? `
                <div class="mt-10 pt-6 border-t border-primary-subtle/30">
                    <h4 class="text-lg font-semibold text-text-dark mb-2">Notas Adicionales:</h4>
                    <p class="text-sm text-text-light italic leading-relaxed">${receta.notasAdicionales}</p>
                </div>
            ` : ''}
        `;
        console.log('[App Santuario - renderRecetaDetalle] Renderizado completado con nuevo estilo.');

    } catch (error) {
        console.error('[App Santuario - renderRecetaDetalle] Error:', error);
        if (recetaDetalleContentWrapper) recetaDetalleContentWrapper.innerHTML = `<p class="text-red-500 p-6 text-center">No se pudo cargar el detalle de la receta. ${error.message}</p>`;
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
        console.log('[App Santuario - renderMealPrep] dbPromise resuelta.');
        if (!currentDB) throw new Error("Conexión a BD no disponible.");

        const transaction = currentDB.transaction('meal_prep', 'readonly');
        const store = transaction.objectStore('meal_prep');
        const todasLasTareas = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
        console.log('[App Santuario - renderMealPrep] Datos obtenidos de IndexedDB:', todasLasTareas);

        mealPrepContainer.innerHTML = '';
        if (todasLasTareas.length === 0) {
            mealPrepContainer.innerHTML = `
                <div class="bg-white/50 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/40 p-6 text-center">
                    <p class="text-text-light">No hay tareas de preparación programadas. ¡Carga datos de ejemplo desde Inicio!</p>
                </div>`;
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
                const seccionDiaDiv = document.createElement('div');
                seccionDiaDiv.className = 'bg-white/50 backdrop-blur-lg rounded-xl shadow-xl border border-white/20 p-5 mb-6 hover:shadow-2xl transition-shadow duration-300'; 
                
                const tituloDia = document.createElement('h3');
                tituloDia.className = 'text-xl font-semibold text-accent-sapphire mb-4 pb-2 border-b border-primary-subtle/40';
                tituloDia.textContent = (dia === 'Semanal' || dia === 'General') ? `Preparación ${dia}` : `Para el ${dia}`;
                seccionDiaDiv.appendChild(tituloDia);

                const listaTareasHTML = document.createElement('ul');
                listaTareasHTML.className = 'space-y-3';

                tareasAgrupadas[dia].forEach(tarea => {
                    const li = document.createElement('li');
                    li.className = `
                        flex items-center 
                        p-3 
                        bg-white/70 backdrop-blur-sm
                        rounded-lg 
                        shadow-md 
                        border border-white/20
                        transition-all duration-300 ease-out
                        hover:bg-white/90 hover:shadow-lg
                        ${tarea.completada ? 'opacity-60' : ''}
                    `;
                    
                    const labelClass = tarea.completada 
                        ? 'line-through text-text-light' 
                        : 'text-text-dark';

                    li.innerHTML = `
                        <input 
                            type="checkbox" 
                            id="mealprep-${tarea.id}" 
                            data-mealprep-id="${tarea.id}" 
                            class="form-checkbox h-5 w-5 text-accent-mint rounded-md border-primary-subtle focus:ring-2 focus:ring-accent-mint focus:ring-opacity-50 cursor-pointer flex-shrink-0"
                            ${tarea.completada ? 'checked' : ''}
                        >
                        <label for="mealprep-${tarea.id}" class="ml-3.5 ${labelClass} text-sm flex-grow cursor-pointer">
                            ${tarea.descripcion}
                        </label>
                    `;
                    listaTareasHTML.appendChild(li);
                });
                seccionDiaDiv.appendChild(listaTareasHTML);
                mealPrepContainer.appendChild(seccionDiaDiv);
            }
        }
        console.log('[App Santuario - renderMealPrep] Renderizado completado con nuevo estilo.');
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
        const sampleRecetas = [ 
            { id: "rec1-avena-frutas", nombre: "Avena con Frutas Frescas y Nueces", descripcionCorta: "Un desayuno nutritivo y energizante.", porciones: "1", tiempoPrep: "5 min", tiempoCoccion: "5 min", imagenUrl: "images/placeholders/avena-frutas.webp", ingredientes: [{ nombre: "Avena", cantidad: "1/2", unidad: "taza" }], instrucciones: ["Cocinar avena con agua/leche.", "Añadir frutas y nueces."] },
            { id: "rec2-pollo-ensalada", nombre: "Pollo a la Plancha con Ensalada Verde", descripcionCorta: "Ligero y saludable.", porciones: "1", tiempoPrep: "10 min", tiempoCoccion: "15 min", imagenUrl: "images/placeholders/pollo-ensalada.webp", ingredientes: [{ nombre: "Pechuga de pollo", cantidad: "1", unidad: "unidad" }], instrucciones: ["Cocinar pollo.", "Preparar ensalada."] },
            { id: "rec3-crema-calabacin", nombre: "Crema de Calabacín y Zanahoria", descripcionCorta: "Reconfortante y nutritiva.", porciones: "2", tiempoPrep: "10 min", tiempoCoccion: "20 min", imagenUrl: "images/placeholders/crema-calabacin.webp", ingredientes: [{ nombre: "Calabacín", cantidad: "2", unidad: "unidades" }], instrucciones: ["Sofreír vegetales.", "Licuar y servir."] },
            { id: "rec4-lentejas-guisadas", nombre: "Lentejas Guisadas con Vegetales", descripcionCorta: "Plato completo y lleno de sabor.", porciones: "4", tiempoPrep: "15 min", tiempoCoccion: "45 min", imagenUrl: "images/placeholders/lentejas.webp", ingredientes: [{ nombre: "Lentejas", cantidad: "1", unidad: "taza" }], instrucciones: ["Guisar lentejas con vegetales."] },
            { id: "rec5-salmon-esparragos", nombre: "Salmón al Horno con Espárragos", descripcionCorta: "Elegante, delicioso y muy saludable.", porciones: "2", tiempoPrep: "10 min", tiempoCoccion: "20 min", imagenUrl: "images/placeholders/salmon-esparragos.webp", ingredientes: [{ nombre: "Filete de Salmón", cantidad: "2", unidad: "" }], instrucciones: ["Hornear salmón con espárragos."] },
        ];
        
        const samplePlan = [
            { dia: "lunes", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena con Frutas Frescas" }, almuerzo: { id_receta: "rec2-pollo-ensalada", nombre: "Pollo con Ensalada Verde" }, cena: { id_receta: "rec3-crema-calabacin", nombre: "Crema de Calabacín" } },
            { dia: "martes", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena con Frutas (otra vez)" }, almuerzo: { id_receta: "rec4-lentejas-guisadas", nombre: "Lentejas Guisadas" }, cena: { id_receta: "rec5-salmon-esparragos", nombre: "Salmón con Espárragos" } },
            { dia: "miércoles", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena con Frutas Frescas" }, almuerzo: { id_receta: "rec2-pollo-ensalada", nombre: "Pollo con Ensalada Verde" }, cena: { id_receta: "rec4-lentejas-guisadas", nombre: "Resto de Lentejas" } },
            { dia: "jueves", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena con Frutas (otra vez)" }, almuerzo: { id_receta: "rec5-salmon-esparragos", nombre: "Salmón con Espárragos (Resto)" }, cena: { id_receta: "rec3-crema-calabacin", nombre: "Crema de Calabacín (Resto)" } },
            { dia: "viernes", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena con Frutas Frescas" }, almuerzo: { id_receta: "rec2-pollo-ensalada", nombre: "Ensalada Grande con Pollo" }, cena: { id_receta: "rec4-lentejas-guisadas", nombre: "Lentejas para variar" } },
            { dia: "sábado", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Desayuno Especial de Avena" }, almuerzo: { id_receta: "rec5-salmon-esparragos", nombre: "Almuerzo ligero con Salmón" }, cena: { id_receta: "rec2-pollo-ensalada", nombre: "Cena con Pollo" } },
            { dia: "domingo", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena Familiar" }, almuerzo: { id_receta: "rec4-lentejas-guisadas", nombre: "Gran porción de Lentejas" }, cena: { id_receta: "rec3-crema-calabacin", nombre: "Sopa reconfortante" } }
        ];

        const sampleMealPrep = [
            { id: 'mp-s1', descripcion: 'Lavar y almacenar todas las hojas verdes (lechuga, espinaca).', dia_prep: 'Semanal', completada: false },
            { id: 'mp-s2', descripcion: 'Cocinar 2 tazas de quinoa.', dia_prep: 'Semanal', completada: true },
            { id: 'mp-d1', descripcion: 'Cortar vegetales para ensaladas de Lunes y Martes.', dia_prep: 'Domingo', completada: false },
        ];

        const transaction = currentDB.transaction(['lista_compras', 'plan_semanal', 'meal_prep', 'recetas'], 'readwrite');
        const stores = {
            lista_compras: transaction.objectStore('lista_compras'),
            plan_semanal: transaction.objectStore('plan_semanal'),
            meal_prep: transaction.objectStore('meal_prep'),
            recetas: transaction.objectStore('recetas')
        };
        
        await Promise.all([
            new Promise((res,rej) => { const r = stores.lista_compras.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = stores.plan_semanal.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = stores.meal_prep.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = stores.recetas.clear(); r.onsuccess = res; r.onerror = rej; })
        ]);

        await Promise.all([
            ...sampleLista.map(i => new Promise((res, rej) => { const r = stores.lista_compras.put(i); r.onsuccess = res; r.onerror = rej; })),
            ...samplePlan.map(d => new Promise((res, rej) => { const r = stores.plan_semanal.put(d); r.onsuccess = res; r.onerror = rej; })),
            ...sampleMealPrep.map(t => new Promise((res, rej) => { const r = stores.meal_prep.put(t); r.onsuccess = res; r.onerror = rej; })),
            ...sampleRecetas.map(r_item => new Promise((res, rej) => { const req = stores.recetas.put(r_item); req.onsuccess = res; req.onerror = rej; }))
        ]);
        
        console.log('[App Santuario - loadSampleData] Datos de ejemplo cargados con éxito en IndexedDB.');
        alert('Datos de ejemplo (Plan, Lista, Meal Prep y Recetas) cargados con éxito.');
        
        const currentFullHash = window.location.hash.substring(1);
        const [currentViewNameForReload, currentParamForReload] = currentFullHash.split('/');
        
        if (currentViewNameForReload === 'lista-compras') await renderListaCompras();
        else if (currentViewNameForReload === 'plan-semanal') await renderPlanSemanal();
        else if (currentViewNameForReload === 'meal-prep') await renderMealPrep();
        else if (currentViewNameForReload === 'receta-detalle' && currentParamForReload) await renderRecetaDetalle(currentParamForReload);

    } catch (error) {
        console.error("[App Santuario - loadSampleData] Error:", error);
        alert("Error al cargar los datos de ejemplo: " + error.message);
    }
}

async function main() {
    console.log('Iniciando aplicación NutriPlan (Santuario con Detalle de Receta y enlaces)...');
    
    views = document.querySelectorAll('.view');
    loadSampleDataButton = document.getElementById('load-sample-data-button');
    listaComprasContainer = document.getElementById('lista-compras-container');
    currentYearSpan = document.getElementById('current-year');
    planSemanalContainer = document.getElementById('plan-semanal-container');
    mealPrepContainer = document.getElementById('meal-prep-container'); 
    recetaDetalleContentWrapper = document.getElementById('receta-detalle-content-wrapper');


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
                console.log(`[App Santuario - main] Checkbox para tarea Meal Prep ${tareaId} cambiado.`);
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
