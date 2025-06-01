/**
 * js/app.js
 * Lógica principal para la PWA NutriPlan Narváez Yánez
 */

// COMENTARIO_ESTRATÉGICO: Constantes para la configuración de IndexedDB.
const DB_NAME = 'pwa_nutriplan_db';
const DB_VERSION = 1;
let db; // Variable global para la instancia de la BD.

console.log('[App] Script cargado. Iniciando dbPromise...');
const dbPromise = initDB(); // Promesa para asegurar que la BD esté lista.
console.log('[App] dbPromise iniciado.');

// COMENTARIO_ESTRATÉGICO: Variables globales para elementos del DOM.
// Se inicializarán en main() después de que el DOM cargue.
let views, loadSampleDataButton, listaComprasContainer, currentYearSpan, planSemanalContainer, mealPrepContainer, recetaDetalleContentWrapper;

/**
 * Inicializa y abre la conexión a la base de datos IndexedDB.
 */
function initDB() {
    return new Promise((resolve, reject) => {
        if (db && db.version === DB_VERSION) {
            resolve(db);
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const dbInstance = event.target.result;
            if (!dbInstance.objectStoreNames.contains('lista_compras')) {
                dbInstance.createObjectStore('lista_compras', { keyPath: 'id' });
            }
            if (!dbInstance.objectStoreNames.contains('recetas')) {
                dbInstance.createObjectStore('recetas', { keyPath: 'id' });
            }
            if (!dbInstance.objectStoreNames.contains('plan_semanal')) {
                dbInstance.createObjectStore('plan_semanal', { keyPath: 'dia' });
            }
            if (!dbInstance.objectStoreNames.contains('meal_prep')) {
                dbInstance.createObjectStore('meal_prep', { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onerror = (event) => reject(event.target.error);
        request.onblocked = (event) => {
            console.error('[initDB] Apertura de BD bloqueada. Cierra otras pestañas de NutriPlan.');
            alert("NutriPlan no puede iniciarse porque otra pestaña lo está bloqueando. Por favor, cierra todas las demás pestañas de NutriPlan y refresca esta página.");
            reject(new Error("Apertura de BD bloqueada."));
        };
    });
}

/**
 * Muestra la vista especificada con una animación de "Fundido con Vistas Superpuestas".
 * @param {string} viewId El ID de la vista a mostrar (sin el prefijo 'view-').
 */
function showView(viewId) {
    if (!views || views.length === 0) {
        views = document.querySelectorAll('.view');
        if (!views.length) {
            console.error("showView: No se encontraron elementos .view en el DOM.");
            return;
        }
    }

    const nextView = document.getElementById(`view-${viewId}`);

    if (!nextView) {
        console.error(`showView: No se encontró la vista con ID 'view-${viewId}'`);
        const inicioView = document.getElementById('view-inicio');
        views.forEach(view => view.classList.remove('active'));
        if (inicioView) inicioView.classList.add('active');
        return;
    }

    views.forEach(view => {
        view.classList.remove('active');
    });

    requestAnimationFrame(() => {
        nextView.classList.add('active');
    });
}


/**
 * Enrutador simple basado en el hash de la URL.
 */
async function router() {
    const fullHash = window.location.hash.substring(1);
    const [viewName, param] = fullHash.split('/');
    const currentViewId = viewName || 'inicio';

    console.log(`[Router] Navegando a #${currentViewId}, Param: ${param}`);

    showView(currentViewId);

    switch (currentViewId) {
        case 'inicio':
            break;
        case 'plan-semanal':
            await renderPlanSemanal();
            break;
        case 'lista-compras':
            await renderListaCompras();
            break;
        case 'meal-prep':
            await renderMealPrep();
            break;
        case 'receta-detalle':
            if (param) {
                await renderRecetaDetalle(param);
            } else {
                const rdContentWrapper = document.getElementById('receta-detalle-content-wrapper');
                if(rdContentWrapper) rdContentWrapper.innerHTML = '<p class="text-red-500 p-4 text-center">Error: No se especificó una receta.</p>';
                console.warn("[Router] ID de receta no proporcionado para receta-detalle.");
            }
            break;
        case 'acerca-de':
            break;
        default:
            console.warn(`[Router] Ruta desconocida "${currentViewId}", se mantiene la vista actual o de inicio.`);
            break;
    }
}

/**
 * Renderiza la lista de compras.
 */
async function renderListaCompras() {
    if (!listaComprasContainer) {
        listaComprasContainer = document.getElementById('lista-compras-container');
        if (!listaComprasContainer) { console.error("Contenedor lista-compras-container no encontrado"); return; }
    }
    listaComprasContainer.innerHTML = '<p class="text-text-light p-4 text-center">Cargando tu lista de compras...</p>';

    try {
        const currentDB = await dbPromise;
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
                li.className = `flex items-center justify-between p-4 bg-white/60 backdrop-blur-md rounded-xl shadow-lg border border-white/30 transition-all duration-300 ease-out hover:bg-white/80 hover:shadow-xl ${item.comprado ? 'opacity-50' : ''}`;
                const labelClass = item.comprado ? 'line-through text-text-light' : 'text-text-dark';
                li.innerHTML = `<div class="flex items-center flex-grow"><input type="checkbox" id="item-${item.id}" data-item-id="${item.id}" class="form-checkbox h-5 w-5 text-accent rounded-md border-primary focus:ring-2 focus:ring-accent focus:ring-opacity-50 cursor-pointer" ${item.comprado ? 'checked' : ''}><label for="item-${item.id}" class="ml-4 ${labelClass} flex-grow cursor-pointer text-sm sm:text-base"><span class="font-medium">${item.ingrediente}</span><span class="text-xs text-text-light ml-1">(${item.cantidad} ${item.unidad})</span></label></div>`;
                listaComprasContainer.appendChild(li);
            });
        }
    } catch (error) {
        console.error('[renderListaCompras] Error:', error);
        if (listaComprasContainer) listaComprasContainer.innerHTML = `<p class="text-red-500 p-4 text-center">No se pudo cargar la lista de compras. ${error.message}</p>`;
    }
}

/**
 * Genera el HTML para la tabla del plan semanal.
 */
function generarHTMLPlanTabla(plan) {
    let html = `<div class="overflow-x-auto rounded-xl shadow-xl hidden md:block bg-white/50 backdrop-blur-lg border border-white/30 p-1"><table class="w-full text-sm text-left text-text-dark"><thead class="text-xs text-text-light uppercase bg-white/20 backdrop-blur-sm"><tr><th scope="col" class="px-6 py-4 font-semibold rounded-tl-lg">Comida</th>${plan.map(p => `<th scope="col" class="px-6 py-4 font-semibold capitalize">${p.dia}</th>`).join('')}<th scope="col" class="px-1 py-3 rounded-tr-lg"></th></tr></thead><tbody><tr class="bg-transparent hover:bg-white/20 border-b border-ui-border/20 transition-colors duration-200"><th scope="row" class="px-6 py-4 font-medium whitespace-nowrap">Desayuno</th>${plan.map(p => `<td class="px-6 py-4"><a href="#receta-detalle/${p.desayuno.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${p.desayuno.nombre}</a></td>`).join('')}<td></td></tr><tr class="bg-transparent hover:bg-white/20 border-b border-ui-border/20 transition-colors duration-200"><th scope="row" class="px-6 py-4 font-medium whitespace-nowrap">Almuerzo</th>${plan.map(p => `<td class="px-6 py-4"><a href="#receta-detalle/${p.almuerzo.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${p.almuerzo.nombre}</a></td>`).join('')}<td></td></tr><tr class="bg-transparent hover:bg-white/20 transition-colors duration-200"><th scope="row" class="px-6 py-4 font-medium whitespace-nowrap rounded-bl-lg">Cena</th>${plan.map(p => `<td class="px-6 py-4"><a href="#receta-detalle/${p.cena.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${p.cena.nombre}</a></td>`).join('')}<td class="rounded-br-lg"></td></tr></tbody></table></div>`;
    return html;
}

/**
 * Genera el HTML para las tarjetas del plan semanal.
 */
function generarHTMLPlanTarjetas(plan) {
    let html = `<div class="space-y-4 md:hidden">`;
    plan.forEach(dia => {
        html += `<div class="bg-white/60 backdrop-blur-md rounded-xl shadow-xl p-5 border border-white/30 hover:bg-white/75 hover:shadow-2xl transition-all duration-300 ease-out transform hover:-translate-y-1"><h3 class="text-xl font-semibold capitalize text-accent mb-3 pb-2 border-b border-primary/50">${dia.dia}</h3><ul class="space-y-2 text-sm text-text-dark"><li><strong class="text-text-light font-medium">Desayuno:</strong> <a href="#receta-detalle/${dia.desayuno.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${dia.desayuno.nombre}</a></li><li><strong class="text-text-light font-medium">Almuerzo:</strong> <a href="#receta-detalle/${dia.almuerzo.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${dia.almuerzo.nombre}</a></li><li><strong class="text-text-light font-medium">Cena:</strong> <a href="#receta-detalle/${dia.cena.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${dia.cena.nombre}</a></li></ul></div>`;
    });
    html += `</div>`;
    return html;
}

/**
 * Renderiza el plan semanal.
 */
async function renderPlanSemanal() {
    if (!planSemanalContainer) {
        planSemanalContainer = document.getElementById('plan-semanal-container');
        if (!planSemanalContainer) { console.error("Contenedor plan-semanal-container no encontrado"); return; }
    }
    planSemanalContainer.innerHTML = '<p class="text-text-light p-6 text-center">Cargando tu plan semanal...</p>';
    try {
        const currentDB = await dbPromise;
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
    } catch (error) {
        console.error('[renderPlanSemanal] Error:', error);
        if (planSemanalContainer) planSemanalContainer.innerHTML = `<p class="text-red-500 p-6 text-center">No se pudo cargar el plan semanal. ${error.message}</p>`;
    }
}

/**
 * Renderiza el detalle de una receta.
 */
async function renderRecetaDetalle(recetaId) {
    if (!recetaDetalleContentWrapper) {
        recetaDetalleContentWrapper = document.getElementById('receta-detalle-content-wrapper');
        if (!recetaDetalleContentWrapper) { console.error("Contenedor receta-detalle-content-wrapper no encontrado"); return; }
    }
    recetaDetalleContentWrapper.innerHTML = '<p class="text-text-light p-8 text-center text-lg">Cargando detalles de la receta...</p>';

    try {
        const currentDB = await dbPromise;
        const transaction = currentDB.transaction('recetas', 'readonly');
        const store = transaction.objectStore('recetas');
        const receta = await new Promise((resolve, reject) => {
            const request = store.get(recetaId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });

        if (!receta) {
            recetaDetalleContentWrapper.innerHTML = `<div class="text-center p-8"><p class="text-text-light text-lg">Receta con ID '${recetaId}' no encontrada.</p> <button onclick="window.history.back()" class="mt-4 text-accent hover:text-primary font-medium text-sm flex items-center mx-auto"> <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Volver</button></div>`;
            return;
        }

        const imagenHtml = receta.imagenUrl
            ? `<div class="mb-6 md:mb-8 rounded-xl overflow-hidden shadow-xl aspect-video"><img src="${receta.imagenUrl}" alt="${receta.nombre}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/F0EFE6/263A29?text=Imagen+no+disponible';"></div>`
            : `<div class="mb-6 p-4 bg-secondary rounded-lg text-center text-text-light text-sm aspect-video flex items-center justify-center"><p>Imagen no disponible</p></div>`;
        let ingredientesHtml = '<ul class="space-y-2.5 mb-8 list-none pl-0 text-text-dark">';
        (receta.ingredientes || []).forEach(ing => {
            ingredientesHtml += `<li class="text-sm flex items-center p-3 bg-white/40 backdrop-blur-sm rounded-lg shadow-sm border border-white/20"><span class="text-primary mr-2 text-lg">▹</span><span class="font-medium">${ing.cantidad} ${ing.unidad}</span>&nbsp;de ${ing.nombre}${ing.notas ? ` <em class="text-xs text-text-light ml-1">(${ing.notas})</em>` : ''}</li>`;
        });
        ingredientesHtml += '</ul>';
        let instruccionesHtml = '<ol class="space-y-4 text-text-dark">';
        (receta.instrucciones || []).forEach((paso, index) => {
            instruccionesHtml += `<li class="text-sm leading-relaxed flex"><span class="bg-accent text-white rounded-full h-6 w-6 flex items-center justify-center font-semibold text-xs mr-3 flex-shrink-0">${index + 1}</span><span>${paso}</span></li>`;
        });
        instruccionesHtml += '</ol>';
        recetaDetalleContentWrapper.innerHTML = `<button onclick="window.history.back()" class="mb-6 text-accent hover:text-primary font-medium text-sm flex items-center transition-colors duration-200 group"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-1.5 transform group-hover:-translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Volver</button>${imagenHtml}<h2 class="text-3xl md:text-4xl font-semibold text-text-dark mb-2 text-center">${receta.nombre}</h2><p class="text-text-light mb-8 text-sm text-center italic">${receta.descripcionCorta || ''}</p><div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 text-sm text-center"><div class="bg-white/40 backdrop-blur-sm p-3 rounded-lg shadow-md border border-white/20"><strong class="block text-text-light text-xs uppercase tracking-wider mb-0.5">Porciones</strong> ${receta.porciones || 'N/A'}</div><div class="bg-white/40 backdrop-blur-sm p-3 rounded-lg shadow-md border border-white/20"><strong class="block text-text-light text-xs uppercase tracking-wider mb-0.5">T. Prep</strong> ${receta.tiempoPrep || 'N/A'}</div><div class="bg-white/40 backdrop-blur-sm p-3 rounded-lg shadow-md border border-white/20 col-span-2 sm:col-span-1"><strong class="block text-text-light text-xs uppercase tracking-wider mb-0.5">T. Cocción</strong> ${receta.tiempoCoccion || 'N/A'}</div></div><div class="grid md:grid-cols-5 gap-8"><div class="md:col-span-2 mb-6 md:mb-0"><h3 class="text-2xl font-semibold text-accent mb-4 pb-2 border-b border-primary/40">Ingredientes</h3>${ingredientesHtml}</div><div class="md:col-span-3"><h3 class="text-2xl font-semibold text-accent mb-4 pb-2 border-b border-primary/40">Preparación</h3>${instruccionesHtml}</div></div>${receta.notasAdicionales ? `<div class="mt-10 pt-6 border-t border-primary/30"><h4 class="text-lg font-semibold text-text-dark mb-2">Notas Adicionales:</h4><p class="text-sm text-text-light italic leading-relaxed">${receta.notasAdicionales}</p></div>` : ''}`;
    } catch (error) {
        console.error('[renderRecetaDetalle] Error:', error);
        if (recetaDetalleContentWrapper) recetaDetalleContentWrapper.innerHTML = `<p class="text-red-500 p-6 text-center">No se pudo cargar el detalle de la receta. ${error.message}</p>`;
    }
}

/**
 * Cambia el estado de 'comprado' de un ítem.
 */
async function toggleEstadoItemCompra(itemId) {
    try {
        const currentDB = await dbPromise;
        const transaction = currentDB.transaction('lista_compras', 'readwrite');
        const store = transaction.objectStore('lista_compras');
        const item = await new Promise((resolve, reject) => {
            const request = store.get(itemId);
            request.onsuccess = e => resolve(e.target.result);
            request.onerror = e => reject(e.target.error);
        });
        if (item) {
            item.comprado = !item.comprado;
            await new Promise((resolve, reject) => {
                const req = store.put(item);
                req.onsuccess = resolve; req.onerror = reject;
            });
            return { success: true, newState: item.comprado };
        }
        return { success: false, message: "Ítem no encontrado" };
    } catch (error) {
        console.error("[toggleEstadoItemCompra] Error:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Renderiza las tareas de Meal Prep.
 */
async function renderMealPrep() {
    if (!mealPrepContainer) {
        mealPrepContainer = document.getElementById('meal-prep-container');
        if (!mealPrepContainer) { console.error("Contenedor meal-prep-container no encontrado"); return; }
    }
    mealPrepContainer.innerHTML = '<p class="text-text-light p-4 text-center">Cargando tareas de preparación...</p>';

    try {
        const currentDB = await dbPromise;
        const transaction = currentDB.transaction('meal_prep', 'readonly');
        const store = transaction.objectStore('meal_prep');
        const todasLasTareas = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });

        mealPrepContainer.innerHTML = '';
        if (todasLasTareas.length === 0) {
            mealPrepContainer.innerHTML = `<div class="bg-white/50 backdrop-blur-md rounded-xl shadow-lg border border-ui-border/40 p-6 text-center"><p class="text-text-light">No hay tareas de preparación programadas. ¡Carga datos de ejemplo desde Inicio!</p></div>`;
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
                tituloDia.className = 'text-xl font-semibold text-accent mb-4 pb-2 border-b border-primary/40';
                tituloDia.textContent = (dia === 'Semanal' || dia === 'General') ? `Preparación ${dia}` : `Para el ${dia}`;
                seccionDiaDiv.appendChild(tituloDia);
                const listaTareasHTML = document.createElement('ul');
                listaTareasHTML.className = 'space-y-3';
                tareasAgrupadas[dia].forEach(tarea => {
                    const li = document.createElement('li');
                    li.className = `flex items-center p-3 bg-white/70 backdrop-blur-sm rounded-lg shadow-md border border-white/20 transition-all duration-300 ease-out hover:bg-white/90 hover:shadow-lg ${tarea.completada ? 'opacity-60' : ''}`;
                    const labelClass = tarea.completada ? 'line-through text-text-light' : 'text-text-dark';
                    li.innerHTML = `<input type="checkbox" id="mealprep-${tarea.id}" data-mealprep-id="${tarea.id}" class="form-checkbox h-5 w-5 text-accent rounded-md border-primary focus:ring-2 focus:ring-accent focus:ring-opacity-50 cursor-pointer flex-shrink-0" ${tarea.completada ? 'checked' : ''}><label for="mealprep-${tarea.id}" class="ml-3.5 ${labelClass} text-sm flex-grow cursor-pointer">${tarea.descripcion}</label>`;
                    listaTareasHTML.appendChild(li);
                });
                seccionDiaDiv.appendChild(listaTareasHTML);
                mealPrepContainer.appendChild(seccionDiaDiv);
            }
        }
    } catch (error) {
        console.error('[renderMealPrep] Error:', error);
        if (mealPrepContainer) mealPrepContainer.innerHTML = `<p class="text-red-500 p-4 text-center">No se pudieron cargar las tareas de preparación. ${error.message}</p>`;
    }
}

/**
 * Cambia el estado de 'completada' de una tarea de Meal Prep.
 */
async function toggleEstadoTareaMealPrep(tareaId) {
    try {
        const currentDB = await dbPromise;
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
        console.error("[toggleEstadoTareaMealPrep] Error:", error);
        return { success: false, message: error.message };
    }
}

/**
 * Carga datos de ejemplo en la BD.
 */
async function loadSampleData() {
    try {
        const currentDB = await dbPromise;
        console.log('[loadSampleData] Cargando datos de ejemplo en IndexedDB...');
        const sampleLista = [
            { id: "sample-arroz-blanco", ingrediente: "Arroz Blanco", cantidad: 2, unidad: "kg", comprado: false },
            { id: "sample-pechuga-pollo", ingrediente: "Pechuga de Pollo", cantidad: 1.5, unidad: "kg", comprado: false },
            { id: "sample-tomates", ingrediente: "Tomates", cantidad: 1, unidad: "kg", comprado: true },
            { id: "sample-cebolla", ingrediente: "Cebolla", cantidad: 0.5, unidad: "kg", comprado: false },
            { id: "sample-avena", ingrediente: "Avena en Hojuelas", cantidad: 1, unidad: "kg", comprado: false },
            { id: "sample-frutas-varias", ingrediente: "Frutas Varias (Manzana, Cambur, Lechoza)", cantidad: 2, unidad: "kg", comprado: false },
            { id: "sample-nueces", ingrediente: "Nueces y Almendras", cantidad: 200, unidad: "g", comprado: false },
            { id: "sample-vegetales-ensalada", ingrediente: "Vegetales para Ensalada (Lechuga, Pepino)", cantidad: 1, unidad: "paq", comprado: false },
        ];
        const sampleRecetas = [
            { id: "rec1-avena-frutas", nombre: "Avena con Frutas Frescas y Nueces", descripcionCorta: "Un desayuno nutritivo y energético.", porciones: "1", tiempoPrep: "5 min", tiempoCoccion: "5 min", imagenUrl: "images/placeholders/avena-frutas.webp", ingredientes: [{ nombre: "Avena en hojuelas", cantidad: "1/2", unidad: "taza" }, { nombre: "Agua o leche", cantidad: "1", unidad: "taza" }, { nombre: "Frutas picadas (cambur, fresas, manzana)", cantidad: "1", unidad: "taza" }, { nombre: "Nueces o almendras", cantidad: "1", unidad: "puñado" }, {nombre: "Miel o sirope (opcional)", cantidad: "1", unidad: "cdta"}], instrucciones: ["En una olla pequeña, cocina la avena con el agua o leche a fuego medio hasta que espese (unos 5 minutos), revolviendo ocasionalmente.", "Sirve la avena en un tazón.", "Cubre con las frutas picadas, las nueces y un toque de miel si lo deseas."] },
            { id: "rec2-pollo-ensalada", nombre: "Pollo a la Plancha con Ensalada Fresca", descripcionCorta: "Almuerzo ligero, proteico y saludable.", porciones: "1", tiempoPrep: "10 min", tiempoCoccion: "15 min", imagenUrl: "images/placeholders/pollo-ensalada.webp", ingredientes: [{ nombre: "Pechuga de pollo", cantidad: "150", unidad: "g" }, { nombre: "Mix de lechugas", cantidad: "2", unidad: "tazas" }, { nombre: "Tomate", cantidad: "1/2", unidad: "unidad" }, { nombre: "Pepino", cantidad: "1/4", unidad: "unidad" }, {nombre: "Aceite de oliva", cantidad: "1", unidad: "cda"}, {nombre: "Vinagre balsámico o limón", cantidad: "1", unidad: "cdta"}, {nombre: "Sal y pimienta", cantidad: "al gusto", unidad: ""}], instrucciones: ["Sazona la pechuga de pollo con sal y pimienta.", "Cocina el pollo a la plancha o en un sartén antiadherente caliente durante 6-8 minutos por cada lado, o hasta que esté bien cocido.", "Mientras se cocina el pollo, prepara la ensalada: lava y corta los vegetales.", "En un bol, mezcla las lechugas, el tomate y el pepino. Adereza con aceite de oliva y vinagre o limón.", "Sirve el pollo junto a la ensalada fresca."] },
            // COMENTARIO_ESTRATÉGICO: Añadimos una tercera receta simple para más variedad
            { id: "rec3-huevos-revueltos-integral", nombre: "Huevos Revueltos con Pan Integral", descripcionCorta: "Desayuno clásico y rápido.", porciones: "1", tiempoPrep: "3 min", tiempoCoccion: "5 min", imagenUrl: "images/placeholders/huevos-revueltos.webp", ingredientes: [{ nombre: "Huevos", cantidad: "2", unidad: "unidades" }, { nombre: "Pan integral", cantidad: "1", unidad: "rebanada" }, { nombre: "Sal y pimienta", cantidad: "al gusto", unidad: ""}, {nombre: "Aceite de oliva o mantequilla (opcional)", cantidad: "1/2", unidad: "cdta"}], instrucciones: ["Bate los huevos en un tazón con sal y pimienta.", "Calienta un poco de aceite o mantequilla en un sartén a fuego medio (opcional).", "Vierte los huevos batidos en el sartén y cocina, revolviendo suavemente, hasta que alcancen la cocción deseada.", "Tuesta la rebanada de pan integral.", "Sirve los huevos revueltos sobre el pan tostado."] }
        ];

        // COMENTARIO_ESTRATÉGICO: Plan semanal completo para 7 días.
        const samplePlan = [
            { dia: "lunes", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena con Frutas" }, almuerzo: { id_receta: "rec2-pollo-ensalada", nombre: "Pollo con Ensalada Fresca" }, cena: { id_receta: "rec3-huevos-revueltos-integral", nombre: "Huevos Revueltos Ligeros" } },
            { dia: "martes", desayuno: { id_receta: "rec3-huevos-revueltos-integral", nombre: "Huevos con Integral" }, almuerzo: { id_receta: "rec1-avena-frutas", nombre: "Bowl de Avena y Frutas" }, cena: { id_receta: "rec2-pollo-ensalada", nombre: "Ensalada César con Pollo" } },
            { dia: "miércoles", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena Energética" }, almuerzo: { id_receta: "rec2-pollo-ensalada", nombre: "Pollo a la Parrilla y Vegetales" }, cena: { id_receta: "rec3-huevos-revueltos-integral", nombre: "Tortilla de Huevos" } },
            { dia: "jueves", desayuno: { id_receta: "rec3-huevos-revueltos-integral", nombre: "Desayuno Proteico" }, almuerzo: { id_receta: "rec1-avena-frutas", nombre: "Avena con Toppings" }, cena: { id_receta: "rec2-pollo-ensalada", nombre: "Pollo y Mix Verde" } },
            { dia: "viernes", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena Viernes Feliz" }, almuerzo: { id_receta: "rec2-pollo-ensalada", nombre: "Almuerzo Fit de Pollo" }, cena: { id_receta: "rec3-huevos-revueltos-integral", nombre: "Cena Rápida: Huevos" } },
            { dia: "sábado", desayuno: { id_receta: "rec3-huevos-revueltos-integral", nombre: "Huevos de Sábado" }, almuerzo: { id_receta: "rec1-avena-frutas", nombre: "Súper Avena de Sábado" }, cena: { id_receta: "rec2-pollo-ensalada", nombre: "Pollo Ligero para el Sábado" } },
            { dia: "domingo", desayuno: { id_receta: "rec1-avena-frutas", nombre: "Avena Dominical" }, almuerzo: { id_receta: "rec2-pollo-ensalada", nombre: "Pollo Festivo con Ensalada" }, cena: { id_receta: "rec3-huevos-revueltos-integral", nombre: "Huevos para Cerrar Semana" } }
        ];
        const sampleMealPrep = [
            { id: 'mp-s1', descripcion: 'Lavar y desinfectar todas las frutas y vegetales de la semana.', dia_prep: 'Semanal', completada: false },
            { id: 'mp-s2', descripcion: 'Cocinar una tanda grande de arroz o quinoa para varios almuerzos.', dia_prep: 'Semanal', completada: false },
            { id: 'mp-s3', descripcion: 'Porcionar nueces y semillas en recipientes pequeños para snacks o toppings.', dia_prep: 'Semanal', completada: true },
            { id: 'mp-d1', descripcion: 'Picar vegetales para la ensalada del almuerzo del Lunes.', dia_prep: 'Domingo', completada: false },
            { id: 'mp-d2', descripcion: 'Dejar en remojo la avena para el desayuno del Lunes (opcional).', dia_prep: 'Domingo', completada: false },
        ];

        const transaction = currentDB.transaction(['lista_compras', 'plan_semanal', 'meal_prep', 'recetas'], 'readwrite');
        const stores = {
            lista_compras: transaction.objectStore('lista_compras'),
            plan_semanal: transaction.objectStore('plan_semanal'),
            meal_prep: transaction.objectStore('meal_prep'),
            recetas: transaction.objectStore('recetas')
        };

        // Limpiar los almacenes antes de añadir nuevos datos
        await Promise.all([
            new Promise((res,rej) => { const r = stores.lista_compras.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = stores.plan_semanal.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = stores.meal_prep.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = stores.recetas.clear(); r.onsuccess = res; r.onerror = rej; })
        ]);
        console.log("[loadSampleData] Almacenes limpiados.");

        // Añadir los nuevos datos
        await Promise.all([
            ...sampleLista.map(i => new Promise((res, rej) => { const r = stores.lista_compras.put(i); r.onsuccess = res; r.onerror = rej; })),
            ...samplePlan.map(d => new Promise((res, rej) => { const r = stores.plan_semanal.put(d); r.onsuccess = res; r.onerror = rej; })),
            ...sampleMealPrep.map(t => new Promise((res, rej) => { const r = stores.meal_prep.put(t); r.onsuccess = res; r.onerror = rej; })),
            ...sampleRecetas.map(r_item => new Promise((res, rej) => { const req = stores.recetas.put(r_item); req.onsuccess = res; req.onerror = rej; }))
        ]);
        console.log("[loadSampleData] Nuevos datos de ejemplo cargados.");

        alert('Datos de ejemplo (Plan Semanal Completo, Lista, Meal Prep y Recetas) cargados con éxito.');

        const currentFullHash = window.location.hash.substring(1);
        const [currentViewNameForReload] = currentFullHash.split('/');

        if (currentViewNameForReload === 'lista-compras') await renderListaCompras();
        else if (currentViewNameForReload === 'plan-semanal') await renderPlanSemanal();
        else if (currentViewNameForReload === 'meal-prep') await renderMealPrep();

    } catch (error) {
        console.error("[loadSampleData] Error:", error);
        alert("Error al cargar los datos de ejemplo: " + error.message);
    }
}

/**
 * Función principal de la aplicación.
 */
async function main() {
    console.log('Iniciando aplicación NutriPlan...');

    views = document.querySelectorAll('.view');

    loadSampleDataButton = document.getElementById('load-sample-data-button');
    listaComprasContainer = document.getElementById('lista-compras-container');
    currentYearSpan = document.getElementById('current-year');
    planSemanalContainer = document.getElementById('plan-semanal-container');
    mealPrepContainer = document.getElementById('meal-prep-container');
    recetaDetalleContentWrapper = document.getElementById('receta-detalle-content-wrapper');

    await router();
    window.addEventListener('hashchange', router);

    if (loadSampleDataButton) {
        loadSampleDataButton.addEventListener('click', async () => {
            loadSampleDataButton.disabled = true;
            const originalText = loadSampleDataButton.textContent;
            loadSampleDataButton.textContent = 'Cargando...';
            await loadSampleData();
            loadSampleDataButton.disabled = false;
            loadSampleDataButton.textContent = originalText;
        });
    }

    if (listaComprasContainer) {
        listaComprasContainer.addEventListener('change', async (event) => {
            if (event.target.type === 'checkbox' && event.target.dataset.itemId) {
                const itemId = event.target.dataset.itemId;
                const listItemElement = event.target.closest('li');
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
    }

    if (mealPrepContainer) {
        mealPrepContainer.addEventListener('change', async (event) => {
            if (event.target.type === 'checkbox' && event.target.dataset.mealprepId) {
                const tareaId = event.target.dataset.mealprepId;
                const listItemElement = event.target.closest('li');
                event.target.disabled = true;
                const result = await toggleEstadoTareaMealPrep(tareaId);
                if (result.success && listItemElement) {
                    listItemElement.classList.toggle('opacity-60', result.newState);
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
    }

    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
            try {
                const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
                console.log('[main] SW registrado. Scope:', registration.scope);
                 registration.onupdatefound = () => {
                    const installingWorker = registration.installing;
                    if (installingWorker) {
                        installingWorker.onstatechange = () => {
                            if (installingWorker.state === 'installed') {
                                if (navigator.serviceWorker.controller) {
                                    console.log('[main] Nuevo Service Worker instalado. Refresca para actualizar o la app se actualizará en la próxima carga.');
                                } else {
                                    console.log('[main] Contenido cacheado por Service Worker por primera vez.');
                                }
                            }
                        };
                    }
                };
            } catch (error) {
                console.error('[main] Falló registro SW:', error);
            }
        });
    } else {
         console.warn('[main] Service Workers no son soportados en este navegador.');
    }
    console.log('[main] Inicialización completada.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
