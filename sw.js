const CACHE_NAME = 'disaster-alert-v1.0.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  // Add your icon files here
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - Cache resources
self.addEventListener('install', (event) => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[SW] Failed to cache:', error);
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - Serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('unpkg.com') &&
      !event.request.url.includes('tile.openstreetmap.org')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version if available
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        // Otherwise fetch from network
        return fetch(event.request)
          .then((response) => {
            // Don't cache if not a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Cache the fetched resource
            caches.open(CACHE_NAME)
              .then((cache) => {
                // Cache map tiles and other resources
                if (event.request.url.includes('tile.openstreetmap.org') ||
                    event.request.url.includes('unpkg.com')) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          })
          .catch(() => {
            // If both cache and network fail, return offline page for navigations
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // For map tiles, return a placeholder if offline
            if (event.request.url.includes('tile.openstreetmap.org')) {
              return new Response(
                '<svg width="256" height="256" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f0f0f0"/><text x="50%" y="50%" text-anchor="middle" fill="#999">Offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
              );
            }
          });
      })
  );
});

// Background sync for offline SOS requests
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync event:', event.tag);
  
  if (event.tag === 'sos-sync') {
    event.waitUntil(
      // Get stored SOS requests and send them
      getStoredSOSRequests().then((requests) => {
        return Promise.all(
          requests.map((request) => {
            return sendSOSRequest(request);
          })
        );
      })
    );
  }
});

// Push event for disaster alerts
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  
  const options = {
    body: 'Emergency alert in your area',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View Details',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'close',
        title: 'Dismiss',
        icon: '/icons/close-icon.png'
      }
    ],
    requireInteraction: true,
    tag: 'disaster-alert'
  };

  if (event.data) {
    const data = event.data.json();
    options.body = data.message || options.body;
    options.title = data.title || 'DisasterAlert';
  }

  event.waitUntil(
    self.registration.showNotification('DisasterAlert', options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received');
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/?notification=true')
    );
  } else if (event.action === 'close') {
    // Just close the notification
    return;
  } else {
    // Default action - open the app
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        if (clientList.length > 0) {
          return clientList[0].focus();
        }
        return clients.openWindow('/');
      })
    );
  }
});

// Helper functions
function getStoredSOSRequests() {
  return new Promise((resolve) => {
    // In a real implementation, you would get this from IndexedDB
    // For now, return empty array
    resolve([]);
  });
}

function sendSOSRequest(request) {
  return fetch('/api/emergency-sos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(request)
  }).catch((error) => {
    console.error('[SW] Failed to send SOS request:', error);
    throw error;
  });
}

// Message event for communication with main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Periodic background sync for disaster alerts (if supported)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync event:', event.tag);
  
  if (event.tag === 'disaster-check') {
    event.waitUntil(
      checkForDisasterAlerts()
    );
  }
});

function checkForDisasterAlerts() {
  return fetch('/api/disaster-alerts')
    .then((response) => response.json())
    .then((alerts) => {
      alerts.forEach((alert) => {
        if (alert.severity === 'high') {
          self.registration.showNotification('Emergency Alert', {
            body: alert.message,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/badge-72x72.png',
            vibrate: [200, 100, 200, 100, 200],
            requireInteraction: true,
            tag: 'disaster-alert-' + alert.id
          });
        }
      });
    })
    .catch((error) => {
      console.error('[SW] Failed to check for alerts:', error);
    });
}