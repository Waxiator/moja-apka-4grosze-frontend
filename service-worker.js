// service-worker.js
// Ten plik będzie buforował zasoby i obsługiwał powiadomienia push

const CACHE_NAME = '4grosze-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/icon.png',
    '/icon-512.png'
    // Dodaj wszystkie inne statyczne zasoby, które chcesz buforować
];

// Instalacja Service Workera - buforowanie zasobów
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('Failed to cache:', error);
            })
    );
});

// Aktywacja Service Workera
self.addEventListener('activate', event => {
    console.log('Service Worker activated');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Obsługa fetch (zasoby z bufora lub sieć)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

// Obsługa powiadomień push (NOWOŚĆ)
self.addEventListener('push', event => {
    const data = event.data.json();
    console.log('Push received:', data);

    const title = data.title || 'Nowa wiadomość!';
    const options = {
        body: data.body || 'Otwórz aplikację, aby zobaczyć.',
        icon: data.icon || '/icon.png',
        badge: '/icon.png', // Ikona wyświetlana w pasku statusu (dla Androida, iOS może ignorować)
        data: {
            url: data.data && data.data.url ? data.data.url : '/' // URL do otwarcia po kliknięciu
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Obsługa kliknięcia w powiadomienie (NOWOŚĆ)
self.addEventListener('notificationclick', event => {
    console.log('Notification click received.');
    event.notification.close(); // Zamknij powiadomienie

    const clickedNotification = event.notification.data;
    const urlToOpen = clickedNotification.url || '/';

    event.waitUntil(
        clients.openWindow(urlToOpen)
    );
});