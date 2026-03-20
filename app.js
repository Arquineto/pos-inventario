// app.js - Funciones globales

function inicializarDatosEjemplo() {
    const productos = localStorage.getItem('productos');
    if (!productos || JSON.parse(productos).length === 0) {
        const productosEjemplo = [
            { id: '1', codigo: '7501000012345', nombre: 'Café molido 500g', precio: 89.90, stock: 25, stockMinimo: 10 },
            { id: '2', codigo: '7502000023456', nombre: 'Azúcar 1kg', precio: 35.50, stock: 40, stockMinimo: 15 },
            { id: '3', codigo: '7503000034567', nombre: 'Leche 1L', precio: 28.90, stock: 8, stockMinimo: 10 },
            { id: '4', codigo: '7504000045678', nombre: 'Pan molde', precio: 45.00, stock: 3, stockMinimo: 5 },
            { id: '5', codigo: '7505000056789', nombre: 'Galletas', precio: 22.50, stock: 50, stockMinimo: 20 },
            { id: '6', codigo: '7506000067890', nombre: 'Arroz 1kg', precio: 42.00, stock: 12, stockMinimo: 8 },
            { id: '7', codigo: '7507000078901', nombre: 'Aceite 900ml', precio: 95.00, stock: 6, stockMinimo: 5 },
            { id: '8', codigo: '7508000089012', nombre: 'Jabón líquido', precio: 18.50, stock: 30, stockMinimo: 10 }
        ];
        localStorage.setItem('productos', JSON.stringify(productosEjemplo));
    }
    
    const clientes = localStorage.getItem('clientes');
    if (!clientes || JSON.parse(clientes).length === 0) {
        const clientesEjemplo = [
            { id: 'c1', nombre: 'María González', telefono: '555-1234', email: 'maria@email.com', deuda: 150.00, fechaRegistro: new Date().toISOString() },
            { id: 'c2', nombre: 'Juan Pérez', telefono: '555-5678', email: 'juan@email.com', deuda: 0, fechaRegistro: new Date().toISOString() },
            { id: 'c3', nombre: 'Laura Martínez', telefono: '555-9012', email: 'laura@email.com', deuda: 320.50, fechaRegistro: new Date().toISOString() }
        ];
        localStorage.setItem('clientes', JSON.stringify(clientesEjemplo));
    }
    
    const ventas = localStorage.getItem('ventas');
    if (!ventas || JSON.parse(ventas).length === 0) {
        const ventasEjemplo = [
            {
                id: 'v1',
                fecha: new Date().toISOString(),
                items: [{ id: '1', nombre: 'Café molido 500g', precio: 89.90, cantidad: 2 }],
                total: 179.80,
                metodo: 'efectivo'
            },
            {
                id: 'v2',
                fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                items: [{ id: '3', nombre: 'Leche 1L', precio: 28.90, cantidad: 3 }],
                total: 86.70,
                metodo: 'tarjeta'
            }
        ];
        localStorage.setItem('ventas', JSON.stringify(ventasEjemplo));
    }
}

inicializarDatosEjemplo();