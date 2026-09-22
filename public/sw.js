// HomeMed Service Worker — handles push notifications & scheduled reminders
const CACHE_VERSION = 'homemed-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Handle push events from server (future-proofing for web push)
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'HomeMed', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'HomeMed'
  const options = {
    body: data.body || '',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: data.tag || 'homemed',
    data: data.data || {},
    requireInteraction: false,
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// When user clicks a notification, focus/open the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'notification-click', data: event.notification.data })
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})

// Basic fetch handler (no aggressive caching to avoid breaking Next.js dynamic routes)
self.addEventListener('fetch', (event) => {
  // pass through, no caching
})
