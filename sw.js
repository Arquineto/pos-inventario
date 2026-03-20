// sw.js - Service Worker para funcionamiento offline
const CACHE_NAME = 'pos-terminal-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/ventas.html',
  '/inventario.html',
  '/clientes.html',
  '/reportes.html',
  '/ventas-dia.html',
  '/cierre-caja.html',
  '/reporte-iva.html',
  '/configuracion.html',
  '/style.css',
  '/app.js',
  '/storage-manager.js',
  '/manifest.json',
  '/offline.html',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
  console.log('Service Worker instalando...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.log('Error al cachear:', err))
  );
  self.skipWaiting();
});

// Activación - limpiar caches antiguos
self.addEventListener('activate', event => {
  console.log('Service Worker activado');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Cache First (con respaldo de red)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en cache, devolverlo
        if (response) {
          return response;
        }
        
        // Si no, intentar obtener de la red
        return fetch(event.request)
          .then(response => {
            // Verificar si es una respuesta válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Clonar y guardar en cache para futuras visitas
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          })
          .catch(() => {
            // Si falla la red y no está en cache, mostrar página offline
            if (event.request.destination === 'document') {
              return caches.match('/offline.html');
            }
            
            // Para imágenes y otros recursos, devolver un placeholder
            if (event.request.destination === 'image') {
              return new Response('', {
                status: 200,
                statusText: 'OK',
                headers: new Headers({
                  'Content-Type': 'image/svg+xml',
                  'Cache-Control': 'no-store'
                })
              });
            }
            
            return new Response('Sin conexión a internet', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Sincronización en segundo plano (opcional)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-ventas') {
    console.log('Sincronizando ventas pendientes...');
    event.waitUntil(sincronizarVentas());
  }
});

async function sincronizarVentas() {
  // Función para sincronizar datos cuando vuelva la conexión
  const pendingSales = await getPendingSales();
  for (const sale of pendingSales) {
    await sendToServer(sale);
  }
}
