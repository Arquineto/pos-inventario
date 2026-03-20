// app.js - Funciones globales con persistencia garantizada

// ==================== UTILIDADES BÁSICAS ====================

// Verificar si localStorage está disponible
function isLocalStorageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch(e) {
        console.error('localStorage no disponible:', e);
        return false;
    }
}

// Función para guardar datos con respaldo
function guardarDatos(clave, datos) {
    try {
        localStorage.setItem(clave, JSON.stringify(datos));
        return true;
    } catch(e) {
        console.error(`Error al guardar ${clave}:`, e);
        alert('⚠️ No se pudieron guardar los datos. Espacio insuficiente.');
        return false;
    }
}

// Función para cargar datos
function cargarDatos(clave, defaultValue = []) {
    try {
        const datos = localStorage.getItem(clave);
        return datos ? JSON.parse(datos) : defaultValue;
    } catch(e) {
        console.error(`Error al cargar ${clave}:`, e);
        return defaultValue;
    }
}

// ==================== GESTIÓN DE ENTRADAS DE STOCK ====================

/**
 * Registra una entrada de stock (cuando se agrega stock a un producto)
 * @param {string} productoId - ID del producto
 * @param {number} cantidadAnterior - Stock antes del cambio
 * @param {number} cantidadNueva - Stock después del cambio
 * @param {string} motivo - Razón del cambio (edición, compra, ajuste, etc.)
 */
async function registrarEntradaStock(productoId, cantidadAnterior, cantidadNueva, motivo) {
    if (cantidadNueva > cantidadAnterior) {
        // Si existe storage global, usarlo
        if (window.storage && typeof window.storage.getData === 'function') {
            const entradas = await window.storage.getData('entradas_stock') || [];
            entradas.push({
                id: Date.now().toString(),
                productoId: productoId,
                cantidad: cantidadNueva - cantidadAnterior,
                stockAnterior: cantidadAnterior,
                stockNuevo: cantidadNueva,
                fecha: new Date().toISOString(),
                motivo: motivo
            });
            await window.storage.saveData('entradas_stock', entradas);
        } else {
            // Fallback a localStorage
            let entradas = cargarDatos('entradas_stock', []);
            entradas.push({
                id: Date.now().toString(),
                productoId: productoId,
                cantidad: cantidadNueva - cantidadAnterior,
                stockAnterior: cantidadAnterior,
                stockNuevo: cantidadNueva,
                fecha: new Date().toISOString(),
                motivo: motivo
            });
            guardarDatos('entradas_stock', entradas);
        }
        return true;
    }
    return false;
}

/**
 * Obtiene todas las entradas de stock
 * @returns {Promise<Array>} Lista de entradas de stock
 */
async function obtenerEntradasStock() {
    if (window.storage && typeof window.storage.getData === 'function') {
        return await window.storage.getData('entradas_stock') || [];
    }
    return cargarDatos('entradas_stock', []);
}

/**
 * Obtiene las entradas de stock por producto
 * @param {string} productoId - ID del producto
 * @returns {Promise<Array>} Lista de entradas del producto
 */
async function obtenerEntradasPorProducto(productoId) {
    const entradas = await obtenerEntradasStock();
    return entradas.filter(e => e.productoId === productoId);
}

/**
 * Obtiene las entradas de stock por fecha
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {Promise<Array>} Lista de entradas en esa fecha
 */
async function obtenerEntradasPorFecha(fecha) {
    const entradas = await obtenerEntradasStock();
    return entradas.filter(e => e.fecha.split('T')[0] === fecha);
}

// ==================== GESTIÓN DE GASTOS ====================

/**
 * Registra un gasto del negocio
 * @param {Object} gasto - Objeto con datos del gasto
 * @returns {Promise<boolean>}
 */
async function registrarGasto(gasto) {
    if (window.storage && typeof window.storage.getData === 'function') {
        const gastos = await window.storage.getData('gastos') || [];
        gastos.push({
            id: Date.now().toString(),
            fecha: new Date().toISOString(),
            ...gasto
        });
        await window.storage.saveData('gastos', gastos);
    } else {
        let gastos = cargarDatos('gastos', []);
        gastos.push({
            id: Date.now().toString(),
            fecha: new Date().toISOString(),
            ...gasto
        });
        guardarDatos('gastos', gastos);
    }
    return true;
}

/**
 * Obtiene gastos por período
 * @param {Date} inicio - Fecha inicio
 * @param {Date} fin - Fecha fin
 * @returns {Promise<Array>}
 */
async function obtenerGastosPorPeriodo(inicio, fin) {
    let gastos = [];
    if (window.storage && typeof window.storage.getData === 'function') {
        gastos = await window.storage.getData('gastos') || [];
    } else {
        gastos = cargarDatos('gastos', []);
    }
    return gastos.filter(g => {
        const fechaGasto = new Date(g.fecha);
        return fechaGasto >= inicio && fechaGasto <= fin;
    });
}

/**
 * Obtiene balance neto (ventas - gastos) por período
 * @param {Date} inicio - Fecha inicio
 * @param {Date} fin - Fecha fin
 * @returns {Promise<Object>}
 */
async function obtenerBalanceNeto(inicio, fin) {
    let ventas = [];
    if (window.storage && typeof window.storage.getData === 'function') {
        ventas = await window.storage.getData('ventas');
    } else {
        ventas = cargarDatos('ventas', []);
    }
    
    const ventasPeriodo = ventas.filter(v => {
        const fechaVenta = new Date(v.fecha);
        return fechaVenta >= inicio && fechaVenta <= fin;
    });
    const totalVentas = ventasPeriodo.reduce((sum, v) => sum + v.total, 0);
    
    const gastos = await obtenerGastosPorPeriodo(inicio, fin);
    const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);
    
    return {
        ventas: totalVentas,
        gastos: totalGastos,
        balance: totalVentas - totalGastos
    };
}

// ==================== INICIALIZACIÓN DE DATOS DE EJEMPLO ====================

function inicializarDatosEjemplo() {
    if (!isLocalStorageAvailable()) {
        alert('⚠️ Tu navegador no soporta almacenamiento local. La app no funcionará correctamente.');
        return;
    }
    
    // Productos
    let productos = cargarDatos('productos');
    if (productos.length === 0) {
        const productosEjemplo = [
            { id: '1', codigo: '7501000012345', nombre: 'Café molido 500g', precio: 89.90, costo: 65.00, stock: 25, stockMinimo: 10, categoria: 'Alimentos' },
            { id: '2', codigo: '7502000023456', nombre: 'Azúcar 1kg', precio: 35.50, costo: 28.00, stock: 40, stockMinimo: 15, categoria: 'Alimentos' },
            { id: '3', codigo: '7503000034567', nombre: 'Leche 1L', precio: 28.90, costo: 22.00, stock: 8, stockMinimo: 10, categoria: 'Lácteos' },
            { id: '4', codigo: '7504000045678', nombre: 'Pan molde', precio: 45.00, costo: 32.00, stock: 3, stockMinimo: 5, categoria: 'Panadería' },
            { id: '5', codigo: '7505000056789', nombre: 'Galletas', precio: 22.50, costo: 15.00, stock: 50, stockMinimo: 20, categoria: 'Snacks' },
            { id: '6', codigo: '7506000067890', nombre: 'Arroz 1kg', precio: 42.00, costo: 35.00, stock: 12, stockMinimo: 8, categoria: 'Alimentos' },
            { id: '7', codigo: '7507000078901', nombre: 'Aceite 900ml', precio: 95.00, costo: 78.00, stock: 6, stockMinimo: 5, categoria: 'Alimentos' },
            { id: '8', codigo: '7508000089012', nombre: 'Jabón líquido', precio: 18.50, costo: 12.00, stock: 30, stockMinimo: 10, categoria: 'Limpieza' }
        ];
        guardarDatos('productos', productosEjemplo);
    }
    
    // Clientes
    let clientes = cargarDatos('clientes');
    if (clientes.length === 0) {
        const clientesEjemplo = [
            { id: 'c1', nombre: 'María González', telefono: '555-1234', deuda: 150.00, fechaRegistro: new Date().toISOString() },
            { id: 'c2', nombre: 'Juan Pérez', telefono: '555-5678', deuda: 0, fechaRegistro: new Date().toISOString() },
            { id: 'c3', nombre: 'Laura Martínez', telefono: '555-9012', deuda: 320.50, fechaRegistro: new Date().toISOString() }
        ];
        guardarDatos('clientes', clientesEjemplo);
    }
    
    // Ventas
    let ventas = cargarDatos('ventas');
    if (ventas.length === 0) {
        const ventasEjemplo = [
            {
                id: 'v1',
                factura: '0001',
                fecha: new Date().toISOString(),
                items: [{ id: '1', nombre: 'Café molido 500g', precio: 89.90, costo: 65.00, cantidad: 2 }],
                subtotal: 152.20,
                iva: 27.60,
                total: 179.80,
                metodo: 'efectivo',
                pagos: { efectivo: 179.80, tarjeta: 0, transferencia: 0, credito: 0 },
                ganancia: 49.80
            },
            {
                id: 'v2',
                factura: '0002',
                fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                items: [{ id: '3', nombre: 'Leche 1L', precio: 28.90, costo: 22.00, cantidad: 3 }],
                subtotal: 73.50,
                iva: 13.20,
                total: 86.70,
                metodo: 'tarjeta',
                pagos: { efectivo: 0, tarjeta: 86.70, transferencia: 0, credito: 0 },
                ganancia: 20.70
            }
        ];
        guardarDatos('ventas', ventasEjemplo);
    }
    
    // Pagos
    let pagos = cargarDatos('pagos');
    if (pagos.length === 0) {
        guardarDatos('pagos', []);
    }
    
    // Caja diaria
    let cajaDiaria = cargarDatos('caja_diaria');
    if (cajaDiaria.length === 0) {
        guardarDatos('caja_diaria', []);
    }
    
    // Cierres de caja
    let cierresCaja = cargarDatos('cierres_caja');
    if (cierresCaja.length === 0) {
        guardarDatos('cierres_caja', []);
    }
    
    // Entradas de stock
    let entradasStock = cargarDatos('entradas_stock');
    if (entradasStock.length === 0) {
        guardarDatos('entradas_stock', []);
    }
    
    // Gastos
    let gastos = cargarDatos('gastos');
    if (gastos.length === 0) {
        guardarDatos('gastos', []);
    }
}

// ==================== EXPORTAR FUNCIONES GLOBALES ====================

window.guardarDatos = guardarDatos;
window.cargarDatos = cargarDatos;
window.registrarEntradaStock = registrarEntradaStock;
window.obtenerEntradasStock = obtenerEntradasStock;
window.obtenerEntradasPorProducto = obtenerEntradasPorProducto;
window.obtenerEntradasPorFecha = obtenerEntradasPorFecha;
window.registrarGasto = registrarGasto;
window.obtenerGastosPorPeriodo = obtenerGastosPorPeriodo;
window.obtenerBalanceNeto = obtenerBalanceNeto;

// ==================== INICIALIZACIÓN ====================

inicializarDatosEjemplo();

// ==================== SERVICE WORKER Y MODO OFFLINE ====================

// Mostrar estado de conexión (opcional)
window.addEventListener('load', () => {
    if (!navigator.onLine) {
        console.log('📡 Modo offline activo');
        const indicator = document.createElement('div');
        indicator.style.position = 'fixed';
        indicator.style.bottom = '10px';
        indicator.style.right = '10px';
        indicator.style.background = 'var(--warning)';
        indicator.style.color = 'white';
        indicator.style.padding = '4px 8px';
        indicator.style.borderRadius = '20px';
        indicator.style.fontSize = '10px';
        indicator.style.zIndex = '1000';
        indicator.style.fontFamily = 'monospace';
        indicator.innerHTML = '📡 Modo offline';
        document.body.appendChild(indicator);
        
        setTimeout(() => {
            indicator.style.opacity = '0.7';
        }, 3000);
    }
    
    // Registrar Service Worker si está disponible
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registrado:', registration.scope);
            })
            .catch(error => {
                console.log('Error al registrar Service Worker:', error);
            });
    }
});

// Escuchar cambios en la conexión
window.addEventListener('online', () => {
    console.log('📶 Conexión restaurada');
    const indicator = document.createElement('div');
    indicator.style.position = 'fixed';
    indicator.style.bottom = '10px';
    indicator.style.right = '10px';
    indicator.style.background = 'var(--success)';
    indicator.style.color = 'white';
    indicator.style.padding = '4px 8px';
    indicator.style.borderRadius = '20px';
    indicator.style.fontSize = '10px';
    indicator.style.zIndex = '1000';
    indicator.innerHTML = '✅ Conexión restaurada';
    document.body.appendChild(indicator);
    setTimeout(() => indicator.remove(), 3000);
});

window.addEventListener('offline', () => {
    console.log('📡 Conexión perdida - Modo offline');
});
