// Configuración de Flota Slavon.
// Estos datos no son secretos: la seguridad la ponen las reglas de Firestore (firestore.rules), no esta clave.

window.FLOTA_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyBWsKT10OQSXU4c5FtKxq4aP2BXKWNmPOE',
    authDomain: 'flota-slavon.firebaseapp.com',
    projectId: 'flota-slavon',
    storageBucket: 'flota-slavon.firebasestorage.app',
    messagingSenderId: '646376978506',
    appId: '1:646376978506:web:57a4475a77bf676e18ceb3',
  },

  // Este mail siempre es admin (también está fijo en firestore.rules). Sirve para el primer ingreso.
  ownerEmail: 'juanmarcospaterno@gmail.com',
};
