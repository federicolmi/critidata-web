importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDz3P4llq6aYaXQHt783lVv1MGMARRBd90',
  authDomain: 'critidata.firebaseapp.com',
  projectId: 'critidata',
  storageBucket: 'critidata.firebasestorage.app',
  messagingSenderId: '854163690301',
  appId: '1:854163690301:web:45605c6d2bca49f5f0ab54',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  if (title) {
    self.registration.showNotification(title, { body: body ?? '' });
  }
});
