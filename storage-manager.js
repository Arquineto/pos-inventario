// storage-manager.js - Sistema de almacenamiento multi-opción

class StorageManager {
    constructor() {
        this.storageType = localStorage.getItem('storage_type') || 'localStorage';
        this.dbName = 'POS_Terminal_DB';
        this.dbVersion = 3;
        this.db = null;
        this.initIndexedDB();
    }

    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB no soportado');
                reject('IndexedDB no soportado');
                return;
            }
            
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const stores = ['productos', 'ventas', 'clientes', 'pagos', 'caja_diaria', 'cierres_caja', 'gastos', 'entradas_stock', 'config'];
                stores.forEach(store => {
                    if (!db.objectStoreNames.contains(store)) {
                        if (store === 'caja_diaria' || store === 'cierres_caja') {
                            db.createObjectStore(store, { keyPath: 'fecha' });
                        } else if (store === 'config') {
                            db.createObjectStore(store, { keyPath: 'key' });
                        } else {
                            db.createObjectStore(store, { keyPath: 'id' });
                        }
                    }
                });
            };
        });
    }

    async setStorageType(type) {
        if (type === this.storageType) return true;
        const data = await this.getAllData();
        this.storageType = type;
        localStorage.setItem('storage_type', type);
        if (type === 'indexedDB') {
            await this.initIndexedDB();
            await this.saveAllDataIndexedDB(data);
        } else if (type === 'localStorage') {
            await this.saveAllDataLocalStorage(data);
        }
        return true;
    }

    async getAllData() {
        const collections = ['productos', 'ventas', 'clientes', 'pagos', 'caja_diaria', 'cierres_caja', 'gastos', 'entradas_stock'];
        const data = {};
        for (const collection of collections) {
            data[collection] = await this.getData(collection);
        }
        return data;
    }

    async saveData(collection, data) {
        if (this.storageType === 'indexedDB') {
            return this.saveDataIndexedDB(collection, data);
        } else {
            return this.saveDataLocalStorage(collection, data);
        }
    }

    async getData(collection) {
        if (this.storageType === 'indexedDB') {
            return this.getDataIndexedDB(collection);
        } else {
            return this.getDataLocalStorage(collection);
        }
    }

    async deleteData(collection, id) {
        if (this.storageType === 'indexedDB') {
            return this.deleteDataIndexedDB(collection, id);
        } else {
            return this.deleteDataLocalStorage(collection, id);
        }
    }

    async updateData(collection, id, newData) {
        const data = await this.getData(collection);
        const index = data.findIndex(item => item.id === id);
        if (index !== -1) {
            data[index] = { ...data[index], ...newData };
            await this.saveData(collection, data);
            return true;
        }
        return false;
    }

    // MÉTODOS LOCALSTORAGE
    saveDataLocalStorage(collection, data) {
        try {
            localStorage.setItem(collection, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error(`Error guardando ${collection}:`, e);
            return false;
        }
    }

    getDataLocalStorage(collection) {
        try {
            const data = localStorage.getItem(collection);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error(`Error cargando ${collection}:`, e);
            return [];
        }
    }

    deleteDataLocalStorage(collection, id) {
        try {
            let data = this.getDataLocalStorage(collection);
            data = data.filter(item => item.id !== id);
            this.saveDataLocalStorage(collection, data);
            return true;
        } catch (e) {
            return false;
        }
    }

    saveAllDataLocalStorage(data) {
        for (const [key, value] of Object.entries(data)) {
            this.saveDataLocalStorage(key, value);
        }
    }

    // MÉTODOS INDEXEDDB
    async saveDataIndexedDB(collection, data) {
        if (!this.db) await this.initIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([collection], 'readwrite');
            const store = transaction.objectStore(collection);
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
                if (data.length === 0) { resolve(true); return; }
                let completed = 0;
                data.forEach(item => {
                    const request = store.put(item);
                    request.onsuccess = () => { completed++; if (completed === data.length) resolve(true); };
                    request.onerror = () => reject(request.error);
                });
            };
            clearRequest.onerror = () => reject(clearRequest.error);
        });
    }

    async getDataIndexedDB(collection) {
        if (!this.db) await this.initIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([collection], 'readonly');
            const store = transaction.objectStore(collection);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async deleteDataIndexedDB(collection, id) {
        if (!this.db) await this.initIndexedDB();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([collection], 'readwrite');
            const store = transaction.objectStore(collection);
            const request = store.delete(id);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async saveAllDataIndexedDB(data) {
        for (const [key, value] of Object.entries(data)) {
            await this.saveDataIndexedDB(key, value);
        }
    }

    // ==================== EXPORTAR DATOS ====================
    async exportData() {
        const data = await this.getAllData();
        const exportData = {
            version: '2.0',
            exportDate: new Date().toISOString(),
            appName: 'POS Terminal',
            data: data
        };
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pos_backup_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return true;
    }

    // ==================== IMPORTAR DATOS ====================
    async importData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const importData = JSON.parse(e.target.result);
                    if (!importData.data) { reject('Formato de archivo inválido'); return; }
                    const validCollections = ['productos', 'ventas', 'clientes', 'pagos', 'caja_diaria', 'cierres_caja', 'gastos', 'entradas_stock'];
                    for (const collection of validCollections) {
                        if (importData.data[collection]) {
                            await this.saveData(collection, importData.data[collection]);
                        }
                    }
                    resolve(true);
                } catch (error) {
                    reject('Error al leer el archivo: ' + error.message);
                }
            };
            reader.onerror = () => reject('Error al leer el archivo');
            reader.readAsText(file);
        });
    }

    // ==================== LIMPIAR TODOS LOS DATOS - CORREGIDO ====================
    async clearAllData() {
        const collections = ['productos', 'ventas', 'clientes', 'pagos', 'caja_diaria', 'cierres_caja', 'gastos', 'entradas_stock'];
        
        // Limpiar cada colección
        for (const collection of collections) {
            await this.saveData(collection, []);
        }
        
        // Limpiar también localStorage directamente por si acaso
        collections.forEach(collection => {
            localStorage.removeItem(collection);
        });
        
        // Resetear contadores y configuración
        localStorage.removeItem('ultimo_numero_factura');
        localStorage.removeItem('business_name');
        localStorage.removeItem('business_address');
        localStorage.removeItem('business_phone');
        localStorage.removeItem('iva_rate');
        localStorage.removeItem('default_stock_minimo');
        localStorage.removeItem('auto_backup');
        localStorage.removeItem('last_auto_backup');
        
        // Reiniciar datos de ejemplo
        this.inicializarDatosEjemploForzado();
        
        return true;
    }

    // Forzar inicialización de datos de ejemplo después de limpiar
    inicializarDatosEjemploForzado() {
        const productosEjemplo = [
            { id: '1', codigo: '7501000012345', nombre: 'Café molido 500g', precio: 89.90, costo: 65.00, stock: 25, stockMinimo: 10, categoria: 'Alimentos' },
            { id: '2', codigo: '7502000023456', nombre: 'Azúcar 1kg', precio: 35.50, costo: 28.00, stock: 40, stockMinimo: 15, categoria: 'Alimentos' },
            { id: '3', codigo: '7503000034567', nombre: 'Leche 1L', precio: 28.90, costo: 22.00, stock: 8, stockMinimo: 10, categoria: 'Lácteos' },
            { id: '4', codigo: '7504000045678', nombre: 'Pan molde', precio: 45.00, costo: 32.00, stock: 3, stockMinimo: 5, categoria: 'Panadería' },
            { id: '5', codigo: '7505000056789', nombre: 'Galletas', precio: 22.50, costo: 15.00, stock: 50, stockMinimo: 20, categoria: 'Snacks' }
        ];
        
        const clientesEjemplo = [
            { id: 'c1', nombre: 'María González', telefono: '555-1234', deuda: 150.00, fechaRegistro: new Date().toISOString() },
            { id: 'c2', nombre: 'Juan Pérez', telefono: '555-5678', deuda: 0, fechaRegistro: new Date().toISOString() }
        ];
        
        this.saveDataLocalStorage('productos', productosEjemplo);
        this.saveDataLocalStorage('clientes', clientesEjemplo);
        this.saveDataLocalStorage('ventas', []);
        this.saveDataLocalStorage('pagos', []);
        this.saveDataLocalStorage('caja_diaria', []);
        this.saveDataLocalStorage('cierres_caja', []);
        this.saveDataLocalStorage('gastos', []);
        this.saveDataLocalStorage('entradas_stock', []);
        
        localStorage.setItem('ultimo_numero_factura', '0');
    }

    // ==================== ESTADÍSTICAS ====================
    async getStorageStats() {
        const data = await this.getAllData();
        let totalItems = 0;
        let totalSize = 0;
        for (const [key, value] of Object.entries(data)) {
            totalItems += value.length;
            totalSize += JSON.stringify(value).length;
        }
        return {
            type: this.storageType,
            totalItems,
            totalSize: (totalSize / 1024).toFixed(2) + ' KB',
            totalSizeBytes: totalSize,
            collections: {
                productos: data.productos.length,
                ventas: data.ventas.length,
                clientes: data.clientes.length,
                pagos: data.pagos.length,
                caja_diaria: data.caja_diaria.length,
                cierres_caja: data.cierres_caja.length,
                gastos: data.gastos.length,
                entradas_stock: data.entradas_stock.length
            }
        };
    }

    // ==================== IPV DETALLE ====================
    async getIPVDetalle(fecha) {
        const ventas = await this.getData('ventas');
        const productos = await this.getData('productos');
        const entradas = await this.getData('entradas_stock') || [];
        const ventasDia = ventas.filter(v => v.fecha.split('T')[0] === fecha);
        const productosVendidos = {};
        ventasDia.forEach(venta => {
            venta.items.forEach(item => {
                if (!productosVendidos[item.id]) {
                    const productoOriginal = productos.find(p => p.id === item.id);
                    productosVendidos[item.id] = {
                        id: item.id,
                        codigo: productoOriginal?.codigo || item.codigo,
                        nombre: item.nombre,
                        precio: item.precio,
                        costo: item.costo || productoOriginal?.costo || 0,
                        cantidad: 0,
                        stockInicial: productoOriginal ? (productoOriginal.stock + item.cantidad) : item.cantidad,
                        stockFinal: productoOriginal?.stock || 0
                    };
                }
                productosVendidos[item.id].cantidad += item.cantidad;
            });
        });
        Object.values(productosVendidos).forEach(p => {
            const producto = productos.find(p2 => p2.id === p.id);
            if (producto) p.stockFinal = producto.stock;
        });
        const entradasDia = entradas.filter(e => e.fecha.split('T')[0] === fecha);
        return {
            fecha,
            ventas: ventasDia,
            productos: Object.values(productosVendidos),
            entradas: entradasDia,
            totalVentas: ventasDia.reduce((s, v) => s + v.total, 0),
            totalGanancia: ventasDia.reduce((s, v) => s + (v.ganancia || 0), 0)
        };
    }
}

const storage = new StorageManager();
window.storage = storage;
