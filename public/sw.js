// HomeMed Service Worker — lets the site be installed and focuses the app when
// a reminder shown by the browser is tapped. (No server push: reminders are
// scheduled on the device.)

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
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
