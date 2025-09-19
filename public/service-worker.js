// Service Worker for KHS CRM
// Version 1.0.0 - Update this when you want to force cache refresh

const CACHE_NAME = 'khs-crm-v1.0.0';
const API_CACHE = 'khs-crm-api-v1';

// Files to cache for offline use
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/api-utils.js',
  '/config.js',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event - cache all static assets
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Install');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting');
        return self.skipWaiting(); // Activate immediately
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activate');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE) {
            console.log('[ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim(); // Take control immediately
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle API requests differently (network first, cache fallback)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone the response before caching
          if (response.ok) {
            const responseToCache = response.clone();
            caches.open(API_CACHE).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then(response => {
            if (response) {
              console.log('[ServiceWorker] Serving API from cache:', request.url);
              return response;
            }
            // Return offline response for API
            return new Response(JSON.stringify({
              error: 'Offline',
              message: 'No cached data available'
            }), {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'application/json'
              })
            });
          });
        })
    );
    return;
  }
  
  // For static assets: cache first, network fallback
  event.respondWith(
    caches.match(request).then(response => {
      if (response) {
        // Found in cache
        return response;
      }
      
      // Not in cache, fetch from network
      return fetch(request).then(response => {
        // Check if valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        
        // Clone the response
        const responseToCache = response.clone();
        
        // Add to cache for next time
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseToCache);
        });
        
        return response;
      }).catch(() => {
        // Network failed, return offline page if it's a navigation request
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// Handle messages from the app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[ServiceWorker] Clearing cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    );
  }
});

// Background sync for offline actions (future enhancement)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-offline-data') {
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  // This will be implemented later to sync offline changes
  console.log('[ServiceWorker] Syncing offline data...');
}