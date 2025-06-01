/**
 * js/app.js
 * Lógica principal para la PWA NutriPlan Narváez Yánez (Tema Santuario Nutricional - Completo)
 */

// COMENTARIO_ESTRATÉGICO: Constantes para la configuración de IndexedDB.
// DB_NAME es el nombre de nuestra base de datos.
// DB_VERSION es la versión. Si cambiamos la estructura de los object stores (tablas),
// necesitaremos incrementar esta versión y manejar la migración en el evento 'onupgradeneeded'.
const DB_NAME = 'pwa_nutriplan_db';
const DB_VERSION = 1; 
let db; // Variable global para mantener la instancia de la base de datos una vez abierta.

console.log('[App Santuario] Script cargado. Iniciando dbPromise...');
// COMENTARIO_ESTRATÉGICO: dbPromise es una promesa que se resuelve con la instancia de la BD.
// Esto nos permite asegurar que cualquier operación de BD espere a que la conexión esté lista.
const dbPromise = initDB();
console.log('[App Santuario] dbPromise iniciado.');

// COMENTARIO_ESTRATÉGICO: Variables globales para los elementos del DOM más utilizados.
// Se inicializarán en la función main() después de que el DOM esté completamente cargado.
let views, loadSampleDataButton, listaComprasContainer, currentYearSpan, planSemanalContainer, mealPrepContainer, recetaDetalleContentWrapper;

/**
 * Inicializa y abre la conexión a la base de datos IndexedDB.
 * Devuelve una promesa que se resuelve con la instancia de la BD.
 */
function initDB() {
    console.log('[initDB] Intentando abrir conexión...');
    return new Promise((resolve, reject) => {
        // Si la BD ya está abierta y es la versión correcta, la devolvemos directamente.
        if (db && db.version === DB_VERSION) {
            console.log('[initDB] Conexión a BD ya existe y es válida. Resolviendo inmediatamente.');
            resolve(db);
            return;
        }
        
        console.log(`[initDB] Llamando a indexedDB.open('${DB_NAME}', ${DB_VERSION})`);
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Evento que se dispara si la versión de la BD en el navegador es menor que DB_VERSION,
        // o si la BD no existe. Aquí creamos o actualizamos la estructura (object stores).
        request.onupgradeneeded = (event) => {
            console.log('[initDB] onupgradeneeded: Creando/actualizando object stores...');
            const dbInstance = event.target.result;
            // Creamos los object stores si no existen.
            if (!dbInstance.objectStoreNames.contains('lista_compras')) {
                // 'keyPath' define la propiedad del objeto que se usará como clave primaria.
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

        // Evento que se dispara cuando la conexión a la BD se abre con éxito.
        request.onsuccess = (event) => {
            db = event.target.result; // Guardamos la instancia de la BD en la variable global.
            console.log('[initDB] onsuccess: Conexión a BD exitosa. Resolviendo promesa dbPromise...');
            resolve(db); 
        };

        // Evento que se dispara si hay un error al abrir la BD.
        request.onerror = (event) => {
            console.error('[initDB] onerror: Error al abrir la base de datos:', event.target.error);
            reject(event.target.error); 
        };
        
        // Evento que se dispara si la apertura de la BD es bloqueada por otra conexión abierta
        // (generalmente en otra pestaña del navegador con una versión antigua de la BD).
        request.onblocked = (event) => {
            console.error('[initDB] onblocked: Apertura de BD bloqueada. Cierra otras pestañas con la app.', event);
            // COMENTARIO_ESTRATÉGICO: Es importante notificar al usuario en este caso.
            // Una alerta simple puede ser suficiente para desarrollo, pero en producción
            // se podría mostrar un mensaje más amigable en la UI.
            alert("NutriPlan no puede iniciarse porque otra pestaña lo está bloqueando. Por favor, cierra todas las demás pestañas de NutriPlan y refresca esta página.");
            reject(new Error("Apertura de BD bloqueada. Por favor, cierra otras pestañas de esta aplicación."));
        };
    });
}

/**
 * Muestra la vista especificada y oculta las demás.
 * @param {string} viewId El ID de la vista a mostrar (sin el prefijo 'view-').
 */
function showView(viewId) {
    if (!views) { console.warn("showView: 'views' no está definido. ¿Se llamó antes de DOMContentLoaded?"); return; }
    // Si no se proporciona viewId, ocultar todas las vistas (útil para estados de carga iniciales).
    if (!viewId) {
        views.forEach(view => view.classList.add('hidden'));
        return;
    }
    console.log(`[App Santuario] Mostrando vista: view-${viewId}`);
    views.forEach(view => {
        view.classList.toggle('hidden', view.id !== `view-${viewId}`);
    });
}

/**
 * Enrutador simple basado en el hash de la URL.
 * Determina qué vista mostrar y qué datos cargar según el hash.
 */
async function router() {
    const fullHash = window.location.hash.substring(1); // Elimina el '#' del inicio.
    // COMENTARIO_ESTRATÉGICO: Permitimos un parámetro después de la ruta, ej: #receta-detalle/rec1
    // Esto es útil para vistas que necesitan un identificador específico.
    const [viewName, param] = fullHash.split('/'); 
    const currentViewId = viewName || 'inicio'; // Si no hay hash, por defecto es 'inicio'.

    console.log(`[App Santuario - Router] Navegando a #${currentViewId}, Param: ${param}`);
    
    // COMENTARIO_ESTRATÉGICO: El router maneja la lógica de qué función de renderizado llamar
    // para cada vista. Esto mantiene la lógica de navegación centralizada.
    switch (currentViewId) {
        case 'inicio':
            showView('inicio');
            console.log('[App Santuario - Router] Vista inicio mostrada.');
            break;
        case 'plan-semanal':
            showView('plan-semanal');
            console.log('[App Santuario - Router] Vista plan-semanal mostrada, llamando a renderPlanSemanal...');
            await renderPlanSemanal(); // Usamos await para funciones asíncronas de renderizado.
            break;
        case 'lista-compras':
            showView('lista-compras');
            console.log('[App Santuario - Router] Vista lista-compras mostrada, llamando a renderListaCompras...');
            await renderListaCompras(); 
            break;
        case 'meal-prep':
            showView('meal-prep');
            console.log('[App Santuario - Router] Vista meal-prep mostrada, llamando a renderMealPrep...');
            await renderMealPrep();
            break;
        case 'receta-detalle':
            showView('receta-detalle');
            if (param) {
                console.log(`[App Santuario - Router] Llamando a renderRecetaDetalle con ID: ${param}`);
                await renderRecetaDetalle(param);
            } else {
                console.warn("[App Santuario - Router] ID de receta no proporcionado para receta-detalle.");
                if(recetaDetalleContentWrapper) recetaDetalleContentWrapper.innerHTML = '<p class="text-red-500 p-4 text-center">Error: No se especificó una receta.</p>';
            }
            break;
        default:
            // Si la ruta no se reconoce, redirigimos a la vista de inicio.
            showView('inicio');
            console.warn(`[App Santuario - Router] Ruta desconocida "${fullHash}", mostrando inicio.`);
            break;
    }
}

/**
 * Renderiza la lista de compras obteniendo los datos de IndexedDB.
 */
async function renderListaCompras() {
    if (!listaComprasContainer) { console.warn("[App Santuario - renderListaCompras] Contenedor no encontrado."); return; }
    listaComprasContainer.innerHTML = '<p class="text-text-light p-4 text-center">Cargando tu lista de compras...</p>';
    console.log('[App Santuario - renderListaCompras] Esperando dbPromise...');
    
    try {
        const currentDB = await dbPromise; // Aseguramos que la BD esté lista.
        console.log('[App Santuario - renderListaCompras] dbPromise resuelta.');
        if (!currentDB) throw new Error("Conexión a BD no disponible.");

        // COMENTARIO_ESTRATÉGICO: Las operaciones de IndexedDB se realizan dentro de transacciones.
        // 'readonly' para operaciones de solo lectura, 'readwrite' para lectura y escritura.
        const transaction = currentDB.transaction('lista_compras', 'readonly');
        const store = transaction.objectStore('lista_compras');
        // getAll() obtiene todos los objetos del store. Es una operación asíncrona.
        const todosLosItems = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
        
        listaComprasContainer.innerHTML = ''; // Limpiamos el contenedor antes de renderizar.
        if (todosLosItems.length === 0) {
            listaComprasContainer.innerHTML = '<p class="text-text-light p-6 text-center bg-white/50 backdrop-blur-md rounded-xl shadow-lg border border-slate-200/40">Tu lista de compras está vacía. ¡Añade algunos ingredientes o carga datos de ejemplo!</p>';
        } else {
            todosLosItems.forEach(item => {
                const li = document.createElement('li');
                // COMENTARIO_ESTRATÉGICO: Clases de Tailwind CSS para estilizar los elementos dinámicamente.
                // El uso de Glassmorphism (backdrop-blur-md, bg-white/60) y sombras (shadow-lg)
                // contribuye al tema "Santuario Nutricional Digital".
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

                // COMENTARIO_ESTRATÉGICO: Usamos data-attributes (data-item-id) para pasar información
                // al manejador de eventos sin necesidad de IDs globales complejos.
                li.innerHTML = `
                    <div class="flex items-center flex-grow">
                        <input 
                            type="checkbox" 
                            id="item-${item.id}" 
                            data-item-id="${item.id}" 
                            class="form-checkbox h-5 w-5 text-accent rounded-md border-primary focus:ring-2 focus:ring-accent focus:ring-opacity-50 cursor-pointer"
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

/**
 * Genera el HTML para la vista de tabla del plan semanal (escritorio).
 * @param {Array} plan Array de objetos, cada uno representando un día del plan.
 * @returns {string} El HTML de la tabla.
 */
function generarHTMLPlanTabla(plan) {
    // COMENTARIO_ESTRATÉGICO: Esta tabla es responsiva, se muestra en 'md' (medium) y pantallas más grandes.
    // Las clases de Tailwind como 'hidden md:block' controlan esto.
    let html = `<div class="overflow-x-auto rounded-xl shadow-xl hidden md:block bg-white/50 backdrop-blur-lg border border-white/30 p-1">
        <table class="w-full text-sm text-left text-text-dark">
            <thead class="text-xs text-text-light uppercase bg-white/20 backdrop-blur-sm">
                <tr>
                    <th scope="col" class="px-6 py-4 font-semibold rounded-tl-lg">Comida</th>
                    ${plan.map(p => `<th scope="col" class="px-6 py-4 font-semibold capitalize">${p.dia}</th>`).join('')}
                    <th scope="col" class="px-1 py-3 rounded-tr-lg"></th> {/* Celda vacía para estética */}
                </tr>
            </thead>
            <tbody>
                <tr class="bg-transparent hover:bg-white/20 border-b border-ui-border/20 transition-colors duration-200">
                    <th scope="row" class="px-6 py-4 font-medium whitespace-nowrap">Desayuno</th>
                    ${plan.map(p => `<td class="px-6 py-4"><a href="#receta-detalle/${p.desayuno.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${p.desayuno.nombre}</a></td>`).join('')}
                     <td></td>
                </tr>
                <tr class="bg-transparent hover:bg-white/20 border-b border-ui-border/20 transition-colors duration-200">
                    <th scope="row" class="px-6 py-4 font-medium whitespace-nowrap">Almuerzo</th>
                    ${plan.map(p => `<td class="px-6 py-4"><a href="#receta-detalle/${p.almuerzo.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${p.almuerzo.nombre}</a></td>`).join('')}
                     <td></td>
                </tr>
                <tr class="bg-transparent hover:bg-white/20 transition-colors duration-200">
                    <th scope="row" class="px-6 py-4 font-medium whitespace-nowrap rounded-bl-lg">Cena</th>
                    ${plan.map(p => `<td class="px-6 py-4"><a href="#receta-detalle/${p.cena.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${p.cena.nombre}</a></td>`).join('')}
                    <td class="rounded-br-lg"></td>
                </tr>
            </tbody>
        </table>
    </div>`;
    return html;
}

/**
 * Genera el HTML para la vista de tarjetas del plan semanal (móvil).
 * @param {Array} plan Array de objetos, cada uno representando un día del plan.
 * @returns {string} El HTML de las tarjetas.
 */
function generarHTMLPlanTarjetas(plan) {
    // COMENTARIO_ESTRATÉGICO: Estas tarjetas se muestran en pantallas pequeñas y se ocultan en 'md' y mayores ('md:hidden').
    let html = `<div class="space-y-4 md:hidden">`;
    plan.forEach(dia => {
        html += `
            <div class="bg-white/60 backdrop-blur-md rounded-xl shadow-xl p-5 border border-white/30 hover:bg-white/75 hover:shadow-2xl transition-all duration-300 ease-out transform hover:-translate-y-1">
                <h3 class="text-xl font-semibold capitalize text-accent mb-3 pb-2 border-b border-primary/50">${dia.dia}</h3>
                <ul class="space-y-2 text-sm text-text-dark">
                    <li><strong class="text-text-light font-medium">Desayuno:</strong> <a href="#receta-detalle/${dia.desayuno.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${dia.desayuno.nombre}</a></li>
                    <li><strong class="text-text-light font-medium">Almuerzo:</strong> <a href="#receta-detalle/${dia.almuerzo.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${dia.almuerzo.nombre}</a></li>
                    <li><strong class="text-text-light font-medium">Cena:</strong> <a href="#receta-detalle/${dia.cena.id_receta}" class="text-text-dark hover:text-accent hover:underline transition-colors duration-200">${dia.cena.nombre}</a></li>
                </ul>
            </div>
        `;
    });
    html += `</div>`;
    return html;
}

/**
 * Renderiza el plan semanal, mostrando una tabla en escritorio y tarjetas en móvil.
 */
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
            // COMENTARIO_ESTRATÉGICO: Aseguramos un orden consistente de los días.
            const diasOrdenados = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
            planCompleto.sort((a, b) => diasOrdenados.indexOf(a.dia) - diasOrdenados.indexOf(b.dia));
            // Renderizamos ambas versiones (tabla y tarjetas) y CSS se encarga de mostrar la correcta.
            planSemanalContainer.innerHTML = generarHTMLPlanTabla(planCompleto) + generarHTMLPlanTarjetas(planCompleto);
        }
        console.log('[App Santuario - renderPlanSemanal] Renderizado completado con nuevo estilo.');
    } catch (error) {
        console.error('[App Santuario - renderPlanSemanal] Error:', error);
        if (planSemanalContainer) planSemanalContainer.innerHTML = `<p class="text-red-500 p-6 text-center">No se pudo cargar el plan semanal. ${error.message}</p>`;
    }
}

/**
 * Renderiza la vista de detalle de una receta específica.
 * @param {string} recetaId El ID de la receta a mostrar.
 */
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
        // Obtenemos la receta por su ID.
        const receta = await new Promise((resolve, reject) => {
            const request = store.get(recetaId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });

        console.log('[App Santuario - renderRecetaDetalle] Receta obtenida de IndexedDB:', receta);

        if (!receta) {
            recetaDetalleContentWrapper.innerHTML = `<div class="text-center p-8"><p class="text-text-light text-lg">Receta con ID '${recetaId}' no encontrada.</p> <button onclick="window.history.back()" class="mt-4 text-accent hover:text-primary font-medium text-sm flex items-center mx-auto"> <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg> Volver al Plan Semanal</button></div>`;
            return;
        }

        // COMENTARIO_ESTRATÉGICO: Construcción dinámica del HTML para el detalle de la receta.
        // Se utilizan clases de Tailwind para un diseño responsivo y estilizado.
        // El uso de placeholder para imágenes es una buena práctica si las imágenes reales no están disponibles.
        const imagenHtml = receta.imagenUrl 
            ? `<div class="mb-6 md:mb-8 rounded-xl overflow-hidden shadow-xl aspect-video">
                 <img src="${receta.imagenUrl}" alt="${receta.nombre}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/F0EFE6/263A29?text=Imagen+no+disponible';">
               </div>`
            : `<div class="mb-6 p-4 bg-secondary rounded-lg text-center text-text-light text-sm aspect-video flex items-center justify-center">
                 <p>Imagen no disponible</p>
               </div>`;

        let ingredientesHtml = '<ul class="space-y-2.5 mb-8 list-none pl-0 text-text-dark">';
        receta.ingredientes.forEach(ing => {
            ingredientesHtml += `
                <li class="text-sm flex items-center p-3 bg-white/40 backdrop-blur-sm rounded-lg shadow-sm border border-white/20">
                    <span class="text-primary mr-2 text-lg">▹</span>
                    <span class="font-medium">${ing.cantidad} ${ing.unidad}</span>&nbsp;de ${ing.nombre}${ing.notas ? ` <em class="text-xs text-text-light ml-1">(${ing.notas})</em>` : ''}
                </li>`;
        });
        ingredientesHtml += '</ul>';

        let instruccionesHtml = '<ol class="space-y-4 text-text-dark">';
        receta.instrucciones.forEach((paso, index) => {
            instruccionesHtml += `
                <li class="text-sm leading-relaxed flex">
                    <span class="bg-accent text-white rounded-full h-6 w-6 flex items-center justify-center font-semibold text-xs mr-3 flex-shrink-0">${index + 1}</span>
                    <span>${paso}</span>
                </li>`;
        });
        instruccionesHtml += '</ol>';
        
        // COMENTARIO_ESTRATÉGICO: El botón "Volver" usa window.history.back() para una navegación simple.
        // El diseño de la tarjeta de receta busca ser claro, legible y visualmente agradable.
        recetaDetalleContentWrapper.innerHTML = `
            <button onclick="window.history.back()" class="mb-6 text-accent hover:text-primary font-medium text-sm flex items-center transition-colors duration-200 group">
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
                    <h3 class="text-2xl font-semibold text-accent mb-4 pb-2 border-b border-primary/40">Ingredientes</h3>
                    ${ingredientesHtml}
                </div>

                <div class="md:col-span-3">
                    <h3 class="text-2xl font-semibold text-accent mb-4 pb-2 border-b border-primary/40">Preparación</h3>
                    ${instruccionesHtml}
                </div>
            </div>

            ${receta.notasAdicionales ? `
                <div class="mt-10 pt-6 border-t border-primary/30">
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

/**
 * Cambia el estado 'comprado' de un ítem en la lista de compras en IndexedDB.
 * @param {string} itemId El ID del ítem a actualizar.
 * @returns {Promise<object>} Un objeto indicando el éxito y el nuevo estado.
 */
async function toggleEstadoItemCompra(itemId) {
    console.log(`[App Santuario - toggleEstadoItemCompra] Intentando cambiar estado para item: ${itemId}`);
    try {
        const currentDB = await dbPromise;
        console.log('[App Santuario - toggleEstadoItemCompra] dbPromise resuelta.');
        if (!currentDB) throw new Error("BD no disponible para toggleEstadoItemCompra");

        const transaction = currentDB.transaction('lista_compras', 'readwrite'); // Necesitamos 'readwrite' para modificar.
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
            item.comprado = !item.comprado; // Invertimos el estado.
            // Guardamos el ítem actualizado en la BD.
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

/**
 * Renderiza las tareas de preparación de comidas (Meal Prep) agrupadas por día.
 */
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
                <div class="bg-white/50 backdrop-blur-md rounded-xl shadow-lg border border-ui-border/40 p-6 text-center">
                    <p class="text-text-light">No hay tareas de preparación programadas. ¡Carga datos de ejemplo desde Inicio!</p>
                </div>`;
            return;
        }

        // COMENTARIO_ESTRATÉGICO: Agrupamos las tareas por 'dia_prep' para una mejor visualización.
        const tareasAgrupadas = todasLasTareas.reduce((acc, tarea) => {
            const dia = tarea.dia_prep || 'General'; // Si no tiene día, va a 'General'.
            if (!acc[dia]) acc[dia] = [];
            acc[dia].push(tarea);
            return acc;
        }, {});

        // COMENTARIO_ESTRATÉGICO: Definimos un orden preferido para mostrar los días.
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
                            class="form-checkbox h-5 w-5 text-accent rounded-md border-primary focus:ring-2 focus:ring-accent focus:ring-opacity-50 cursor-pointer flex-shrink-0"
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

/**
 * Cambia el estado 'completada' de una tarea de Meal Prep en IndexedDB.
 * @param {string} tareaId El ID de la tarea a actualizar.
 * @returns {Promise<object>} Un objeto indicando el éxito y el nuevo estado.
 */
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

/**
 * Carga datos de ejemplo en IndexedDB para todos los object stores.
 * Limpia los stores antes de cargar nuevos datos.
 */
async function loadSampleData() {
    console.log('[App Santuario - loadSampleData] Iniciando carga de datos de ejemplo, esperando dbPromise...');
    try {
        const currentDB = await dbPromise;
        console.log('[App Santuario - loadSampleData] dbPromise resuelta.');
        if (!currentDB) throw new Error("BD no disponible para loadSampleData");

        console.log('[App Santuario - loadSampleData] Cargando datos de ejemplo en IndexedDB...');
        // COMENTARIO_ESTRATÉGICO: Datos de ejemplo para poblar la aplicación.
        // Es útil tener IDs predecibles para los datos de ejemplo ('sample-...')
        // y para las recetas ('recX-...') para facilitar las referencias cruzadas.
        const sampleLista = [
            { id: "sample-arroz-blanco", ingrediente: "Arroz Blanco", cantidad: 2, unidad: "kg", comprado: false },
            { id: "sample-pechuga-pollo", ingrediente: "Pechuga de Pollo", cantidad: 1.5, unidad: "kg", comprado: false },
            { id: "sample-tomates", ingrediente: "Tomates", cantidad: 1, unidad: "kg", comprado: true }, // Ejemplo de ítem ya comprado
            { id: "sample-cebolla", ingrediente: "Cebolla", cantidad: 5, unidad: "unidades", comprado: false },
            { id: "sample-lentejas", ingrediente: "Lentejas", cantidad: 0.5, unidad: "kg", comprado: false },
            { id: "sample-aceite-oliva", ingrediente: "Aceite de Oliva", cantidad: 1, unidad: "litro", comprado: false },
        ];
        const sampleRecetas = [ 
            // COMENTARIO_ESTRATÉGICO: Las imágenes de placeholder son importantes para el diseño.
            // Se usan rutas relativas asumiendo una carpeta 'images/placeholders/' en la raíz.
            { id: "rec1-avena-frutas", nombre: "Avena con Frutas Frescas y Nueces", descripcionCorta: "Un desayuno nutritivo y energizante.", porciones: "1", tiempoPrep: "5 min", tiempoCoccion: "5 min", imagenUrl: "images/placeholders/avena-frutas.webp", ingredientes: [{ nombre: "Avena", cantidad: "1/2", unidad: "taza" }, {nombre: "Frutas variadas", cantidad: "1", unidad: "taza"}, {nombre: "Nueces", cantidad: "1/4", unidad: "taza"}], instrucciones: ["Cocinar la avena con agua o leche según las instrucciones del paquete.", "Cortar las frutas frescas.", "Servir la avena caliente y cubrir con las frutas y nueces."] },
            { id: "rec2-pollo-ensalada", nombre: "Pollo a la Plancha con Ensalada Verde", descripcionCorta: "Ligero y saludable, perfecto para el almuerzo.", porciones: "1", tiempoPrep: "10 min", tiempoCoccion: "15 min", imagenUrl: "images/placeholders/pollo-ensalada.webp", ingredientes: [{ nombre: "Pechuga de pollo", cantidad: "150", unidad: "g" }, {nombre: "Mezcla de lechugas", cantidad: "2", unidad: "tazas"}, {nombre: "Tomate cherry", cantidad: "1/2", unidad: "taza"}, {nombre: "Aderezo ligero", cantidad: "2", unidad: "cdas"}], instrucciones: ["Sazonar y cocinar la pechuga de pollo a la plancha hasta que esté dorada y cocida por dentro.", "Lavar y preparar la mezcla de lechugas y los tomates cherry.", "Cortar el pollo en tiras y servir sobre la ensalada con el aderezo."] },
            { id: "rec3-crema-calabacin", nombre: "Crema de Calabacín y Zanahoria", descripcionCorta: "Reconfortante y nutritiva, ideal para una cena ligera.", porciones: "2", tiempoPrep: "10 min", tiempoCoccion: "20 min", imagenUrl: "images/placeholders/crema-calabacin.webp", ingredientes: [{ nombre: "Calabacín", cantidad: "2", unidad: "unidades medianas" }, {nombre: "Zanahoria", cantidad: "1", unidad: "unidad grande"}, {nombre: "Cebolla", cantidad: "1/2", unidad: "unidad"}, {nombre: "Caldo de verduras", cantidad: "500", unidad: "ml"}], instrucciones: ["Picar el calabacín, la zanahoria y la cebolla.", "Sofreír la cebolla en una olla, luego añadir el calabacín y la zanahoria.", "Agregar el caldo de verduras y cocinar hasta que las verduras estén tiernas.", "Licuar la mezcla hasta obtener una crema suave y servir caliente."] },
            { id: "rec4-lentejas-guisadas", nombre: "Lentejas Guisadas con Vegetales", descripcionCorta: "Plato completo y lleno de sabor, rico en proteínas y fibra.", porciones: "4", tiempoPrep: "15 min", tiempoCoccion: "45 min", imagenUrl: "images/placeholders/lentejas.webp", ingredientes: [{ nombre: "Lentejas", cantidad: "1", unidad: "taza" }, {nombre: "Pimentón rojo", cantidad: "1/2", unidad: "unidad"}, {nombre: "Zanahoria", cantidad: "1", unidad: "unidad"}, {nombre: "Papa", cantidad: "1", unidad: "unidad mediana"}], instrucciones: ["Remojar las lentejas si es necesario.", "Sofreír los vegetales picados.", "Añadir las lentejas y agua o caldo.", "Cocinar a fuego lento hasta que las lentejas estén tiernas y el guiso haya espesado."] },
            { id: "rec5-salmon-esparragos", nombre: "Salmón al Horno con Espárragos", descripcionCorta: "Elegante, delicioso y muy saludable.", porciones: "2", tiempoPrep: "10 min", tiempoCoccion: "20 min", imagenUrl: "images/placeholders/salmon-esparragos.webp", ingredientes: [{ nombre: "Filete de Salmón", cantidad: "2", unidad: "de 180g c/u" }, {nombre: "Espárragos frescos", cantidad: "1", unidad: "manojo"}, {nombre: "Aceite de oliva", cantidad: "1", unidad: "cda"}, {nombre: "Limón", cantidad: "1/2", unidad: "unidad"}], instrucciones: ["Precalentar el horno a 200°C.", "Colocar los filetes de salmón y los espárragos en una bandeja para hornear.", "Rociar con aceite de oliva, sal, pimienta y unas gotas de limón.", "Hornear durante 15-20 minutos o hasta que el salmón esté cocido."] },
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
            { id: 'mp-s2', descripcion: 'Cocinar 2 tazas de quinoa.', dia_prep: 'Semanal', completada: true }, // Ejemplo de tarea ya completada
            { id: 'mp-d1', descripcion: 'Cortar vegetales para ensaladas de Lunes y Martes.', dia_prep: 'Domingo', completada: false },
            { id: 'mp-d2', descripcion: 'Marinar porciones de pollo para la semana.', dia_prep: 'Domingo', completada: false },
        ];

        const transaction = currentDB.transaction(['lista_compras', 'plan_semanal', 'meal_prep', 'recetas'], 'readwrite');
        const stores = {
            lista_compras: transaction.objectStore('lista_compras'),
            plan_semanal: transaction.objectStore('plan_semanal'),
            meal_prep: transaction.objectStore('meal_prep'),
            recetas: transaction.objectStore('recetas')
        };
        
        // COMENTARIO_ESTRATÉGICO: Limpiamos todos los stores antes de añadir nuevos datos
        // para evitar duplicados si se llama a esta función múltiples veces.
        await Promise.all([
            new Promise((res,rej) => { const r = stores.lista_compras.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = stores.plan_semanal.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = stores.meal_prep.clear(); r.onsuccess = res; r.onerror = rej; }),
            new Promise((res,rej) => { const r = stores.recetas.clear(); r.onsuccess = res; r.onerror = rej; })
        ]);
        console.log('[App Santuario - loadSampleData] Object stores limpiados.');

        // COMENTARIO_ESTRATÉGICO: Añadimos los datos de ejemplo a sus respectivos stores.
        // Usamos Promise.all para ejecutar todas las operaciones de 'put' en paralelo.
        await Promise.all([
            ...sampleLista.map(i => new Promise((res, rej) => { const r = stores.lista_compras.put(i); r.onsuccess = res; r.onerror = rej; })),
            ...samplePlan.map(d => new Promise((res, rej) => { const r = stores.plan_semanal.put(d); r.onsuccess = res; r.onerror = rej; })),
            ...sampleMealPrep.map(t => new Promise((res, rej) => { const r = stores.meal_prep.put(t); r.onsuccess = res; r.onerror = rej; })),
            ...sampleRecetas.map(r_item => new Promise((res, rej) => { const req = stores.recetas.put(r_item); req.onsuccess = res; req.onerror = rej; }))
        ]);
        
        console.log('[App Santuario - loadSampleData] Datos de ejemplo cargados con éxito en IndexedDB.');
        // COMENTARIO_ESTRATÉGICO: Es importante dar feedback al usuario.
        // Un alert es simple para desarrollo, pero en producción se usaría un modal o toast no bloqueante.
        alert('Datos de ejemplo (Plan, Lista, Meal Prep y Recetas) cargados con éxito.');
        
        // COMENTARIO_ESTRATÉGICO: Después de cargar datos, es buena idea refrescar la vista actual
        // si es una de las que se benefician de los nuevos datos.
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

/**
 * Función principal de la aplicación. Se ejecuta cuando el DOM está listo.
 */
async function main() {
    console.log('Iniciando aplicación NutriPlan (Santuario con Detalle de Receta y enlaces)...');
    
    // Obtenemos referencias a los elementos del DOM que usaremos frecuentemente.
    views = document.querySelectorAll('.view');
    loadSampleDataButton = document.getElementById('load-sample-data-button');
    listaComprasContainer = document.getElementById('lista-compras-container');
    currentYearSpan = document.getElementById('current-year');
    planSemanalContainer = document.getElementById('plan-semanal-container');
    mealPrepContainer = document.getElementById('meal-prep-container'); 
    recetaDetalleContentWrapper = document.getElementById('receta-detalle-content-wrapper');


    console.log('[App Santuario - main] Llamando al router...');
    await router(); // Llamamos al router inicialmente para cargar la vista correcta según el hash.
    window.addEventListener('hashchange', router); // Escuchamos cambios en el hash para navegar.
    console.log('[App Santuario - main] Event listener para hashchange añadido.');
    
    if (loadSampleDataButton) {
        loadSampleDataButton.addEventListener('click', async () => {
            console.log('[App Santuario - main] Botón "Cargar Datos de Ejemplo" clickeado.');
            // COMENTARIO_ESTRATÉGICO: Deshabilitamos el botón durante la carga para evitar clics múltiples
            // y cambiamos el texto para dar feedback visual.
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
        // COMENTARIO_ESTRATÉGICO: Usamos delegación de eventos en el contenedor de la lista.
        // Esto es más eficiente que añadir un listener a cada checkbox individualmente,
        // especialmente si la lista es larga o se actualiza dinámicamente.
        listaComprasContainer.addEventListener('change', async (event) => {
            if (event.target.type === 'checkbox' && event.target.dataset.itemId) {
                const itemId = event.target.dataset.itemId;
                const listItemElement = event.target.closest('li'); // El <li> que contiene el checkbox.
                console.log(`[App Santuario - main] Checkbox para item ${itemId} cambiado.`);
                event.target.disabled = true; // Deshabilitar mientras se procesa.
                const result = await toggleEstadoItemCompra(itemId);
                if (result.success && listItemElement) {
                    // Actualizamos la UI reflejando el nuevo estado.
                    listItemElement.classList.toggle('opacity-50', result.newState); 
                    const label = listItemElement.querySelector('label');
                    if (label) {
                        label.classList.toggle('line-through', result.newState);
                        label.classList.toggle('text-text-light', result.newState);
                        label.classList.toggle('text-text-dark', !result.newState);
                    }
                    event.target.checked = result.newState; // Asegurar que el checkbox refleje el estado guardado.
                } else if (!result.success) {
                    // Si falló, revertimos el cambio en la UI y mostramos un error.
                    event.target.checked = !event.target.checked; 
                    alert('Hubo un error al guardar el cambio: ' + (result.message || 'Error desconocido'));
                }
                event.target.disabled = false; // Rehabilitar el checkbox.
            }
        });
        console.log('[App Santuario - main] Event listener para listaComprasContainer añadido.');
    } else {
        console.warn('[App Santuario - main] Contenedor "lista-compras-container" no encontrado.');
    }

    if (mealPrepContainer) {
        // Aplicamos la misma lógica de delegación de eventos para las tareas de Meal Prep.
        mealPrepContainer.addEventListener('change', async (event) => {
            if (event.target.type === 'checkbox' && event.target.dataset.mealprepId) {
                const tareaId = event.target.dataset.mealprepId;
                const listItemElement = event.target.closest('li');
                console.log(`[App Santuario - main] Checkbox para tarea Meal Prep ${tareaId} cambiado.`);
                event.target.disabled = true;
                const result = await toggleEstadoTareaMealPrep(tareaId);
                if (result.success && listItemElement) {
                    listItemElement.classList.toggle('opacity-60', result.newState); // Usamos opacity-60 como en el renderizado.
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
        currentYearSpan.textContent = new Date().getFullYear(); // Actualizamos el año en el footer.
    }

    // COMENTARIO_ESTRATÉGICO: Registro del Service Worker para la funcionalidad PWA (offline, caché).
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
            console.log('[App Santuario - main] SW registrado. Scope:', registration.scope);
            // Escuchamos actualizaciones del SW para notificar al usuario si hay una nueva versión.
            registration.onupdatefound = () => {
                const installingWorker = registration.installing;
                if (installingWorker) {
                    installingWorker.onstatechange = () => {
                        if (installingWorker.state === 'installed') {
                            if (navigator.serviceWorker.controller) {
                                // Hay un SW activo y uno nuevo instalado.
                                // Se podría mostrar un mensaje al usuario para que refresque.
                                console.log('[App Santuario - main] Nuevo Service Worker instalado. Refresca para actualizar.');
                                // Ejemplo: document.getElementById('new-version-banner').style.display = 'block';
                            } else {
                                // Contenido cacheado por primera vez.
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

// COMENTARIO_ESTRATÉGICO: Aseguramos que main() se ejecute solo después de que el DOM esté completamente cargado.
// Esto evita errores al intentar acceder a elementos del DOM que aún no existen.
if (document.readyState === 'loading') {
    console.log('[App Santuario] DOM no listo, añadiendo listener para DOMContentLoaded.');
    document.addEventListener('DOMContentLoaded', main);
} else {
    // Si el DOM ya está listo (por ejemplo, si el script se carga al final del body con 'defer'),
    // ejecutamos main() directamente.
    console.log('[App Santuario] DOM ya listo, llamando a main() directamente.');
    main();
}
