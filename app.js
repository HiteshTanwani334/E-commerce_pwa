// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration.scope);
      })
      .catch(error => {
        console.log('SW registration failed: ', error);
      });
  });
}

// Simple cart functionality
document.querySelectorAll('.product button').forEach(button => {
    button.addEventListener('click', () => {
        const product = button.parentElement;
        const productName = product.querySelector('h3').textContent;
        const productPrice = product.querySelector('p').textContent;
        alert(`Added ${productName} (${productPrice}) to cart!`);
    });
});

// Register Background Sync
async function registerSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const reg = await navigator.serviceWorker.ready;
    await reg.sync.register('sync-cart');
    console.log('Sync registered');
  }
}

// Trigger after failed cart update
document.querySelector('#cart-button').addEventListener('click', async () => {
  try {
    await fetch('/api/cart', { method: 'POST', body: cartData });
  } catch (err) {
    await saveToIDB(cartData);  // Save to IndexedDB
    await registerSync();       // Register sync
  }
});

// Request Push Permission
async function requestPushPermission() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('Push permission granted');
    // Subscribe to push (requires Firebase/backend)
  }
}

// Call on user action (e.g., "Enable Notifications" button)
document.querySelector('#notify-button')?.addEventListener('click', requestPushPermission);

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached response if found
                if (cachedResponse) {
                    return cachedResponse;
                }
                // Otherwise fetch from network
                return fetch(event.request)
                    .catch(() => {
                        // If the request is for HTML and both cache/network fail, show offline.html
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/offline.html');
                        }
                    });
            })
    );
});