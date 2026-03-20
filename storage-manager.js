// storage-manager.js - Sistema de almacenamiento multi-opción

class StorageManager {
    constructor() {
        this.storageType = localStorage.getItem('storage_type') || 'localStorage';
        this.dbName = 'POS_Terminal_DB';
        this.dbVersion = 2;
        this.db = null;
        this.initIndexedDB();
    }

    // ==================== INICIALIZACIÓN ====================
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
                
                // Crear stores si no existen
                const stores = ['productos', 'ventas', 'clientes', 'pagos', 'caja_diaria', 'cierres_caja', 'gastos', 'config'];
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

    // ==================== CAMBIAR TIPO DE ALMACENAMIENTO ====================
    async setStorageType(type) {
        if (type === this.storageType) return true;
        
        // Migrar datos al nuevo almacenamiento
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

    // ==================== OBTENER TODOS LOS DATOS ====================
    async getAllData() {
        const collections = ['productos', 'ventas', 'clientes', 'pagos', 'caja_diaria', 'cierres_caja', 'gastos'];
        const data = {};
        
        for (const collection of collections) {
            data[collection] = await this.getData(collection);
        }
        
        return data;
    }

    // ==================== GUARDAR DATOS SEGÚN TIPO ====================
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

    // ==================== MÉTODOS LOCALSTORAGE ====================
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

    // ==================== MÉTODOS INDEXEDDB ====================
    async saveDataIndexedDB(collection, data) {
        if (!this.db) await this.initIndexedDB();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([collection], 'readwrite');
            const store = transaction.objectStore(collection);
            
            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
                if (data.length === 0) {
                    resolve(true);
                    return;
                }
                
                let completed = 0;
                data.forEach(item => {
                    const request = store.put(item);
                    request.onsuccess = () => {
                        completed++;
                        if (completed === data.length) resolve(true);
                    };
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
                    
                    if (!importData.data) {
                        reject('Formato de archivo inválido');
                        return;
                    }
                    
                    const validCollections = ['productos', 'ventas', 'clientes', 'pagos', 'caja_diaria', 'cierres_caja', 'gastos'];
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

    // ==================== LIMPIAR TODOS LOS DATOS ====================
    async clearAllData() {
        const collections = ['productos', 'ventas', 'clientes', 'pagos', 'caja_diaria', 'cierres_caja', 'gastos'];
        
        for (const collection of collections) {
            await this.saveData(collection, []);
        }
        
        return true;
    }

    // ==================== ESTADÍSTICAS DE ALMACENAMIENTO ====================
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
            collections: {
                productos: data.productos.length,
                ventas: data.ventas.length,
                clientes: data.clientes.length,
                pagos: data.pagos.length,
                caja_diaria: data.caja_diaria.length,
                cierres_caja: data.cierres_caja.length,
                gastos: data.gastos.length
            }
        };
    }
}

// Instancia global
const storage = new StorageManager();

// Exportar para uso global
window.storage = storage;
