const cacheName = 'shopeasy-offline-v2';
const assetsToCache = [
    '/',
    '/index.html',
    '/products',           // Cache the products route if it exists
    '/styles.css',
    '/app.js',
    '/manifest.json',      // ← Now explicitly cached
    '/offline.html',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png',
    // Add all product images to cache
    '/icons/smart.jpg',
    '/icons/speaker.jpg',
    '/icons/head.jpg'
];

// Install: Cache all critical assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(cacheName)
            .then(cache => cache.addAll(assetsToCache))
            .then(() => self.skipWaiting())
    );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => 
            Promise.all(
                keys.map(key => {
                    if (key !== cacheName) return caches.delete(key);
                })
            )
        )
    );
});
// Network-first for API, Cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls (Network-first)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache successful API responses
          const clone = response.clone();
          caches.open('api-cache').then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))  // Fallback to cache
    );
  }
  // Static assets (Cache-first)
  else {
    event.respondWith(
      caches.match(event.request)
        .then(cached => cached || fetch(event.request))
    );
  }
});

// Retry failed requests when back online
self.addEventListener('sync', event => {
  if (event.tag === 'sync-cart') {
    event.waitUntil(
      retryFailedCartRequests()  // Your custom function
    );
  }
});

// Example: Retry POST requests
async function retryFailedCartRequests() {
  const failedRequests = await getFailedRequestsFromIDB();  // Use IndexedDB
  for (const req of failedRequests) {
    try {
      await fetch(req.url, { method: 'POST', body: req.body });
      await removeFromIDB(req.id);  // Clear after success
    } catch (err) {
      console.error('Retry failed:', err);
    }
  }
}

self.addEventListener('push', event => {
  const data = event.data?.json() || { title: 'New Message', body: 'Updates available' };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      vibrate: [200, 100, 200]
    })
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')  // Open app homepage
  );
});

// Fetch: Serve cached files or offline fallback
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests (e.g., POST API calls)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached file if found
                if (cachedResponse) return cachedResponse;

                // Fetch from network
                return fetch(event.request)
                    .then(networkResponse => {
                        // Cache new responses (like product images)
                        const responseClone = networkResponse.clone();
                        caches.open(cacheName)
                            .then(cache => cache.put(event.request, responseClone));
                        return networkResponse;
                    })
                    .catch(() => {
                        // Offline fallback for HTML
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/offline.html');
                        }
                        // Offline fallback for images
                        if (event.request.destination === 'image') {
                            return caches.match('/icons/icon-512x512.png'); // Show app icon as placeholder
                        }
                    });
            })
    );
});