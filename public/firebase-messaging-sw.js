// Service worker for Firebase Cloud Messaging
try {
  importScripts('/firebase-app-compat.js');
  importScripts('/firebase-messaging-compat.js');

  if (typeof firebase !== 'undefined') {
    firebase.initializeApp({
      messagingSenderId: '1079522964144'
    });

    const messaging = firebase.messaging();

    messaging.onBackgroundMessage(function(payload) {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      
      const notificationTitle = (payload.notification && payload.notification.title) || 'CivicLens';
      const notificationOptions = {
        body: (payload.notification && payload.notification.body) || '',
        icon: '/favicon.ico',
        data: payload.data
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });

    self.addEventListener('notificationclick', function(event) {
      event.notification.close();
      const urlToOpen = (event.notification.data && event.notification.data.click_action) || '/';
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
          for (var i = 0; i < windowClients.length; i++) {
            var client = windowClients[i];
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
      );
    });
    
    console.log('[firebase-messaging-sw.js] Service Worker initialized successfully.');
  } else {
    console.error('[firebase-messaging-sw.js] Firebase script loaded but global "firebase" is missing.');
  }
} catch (err) {
  console.error('[firebase-messaging-sw.js] Evaluation failed:', err);
}
