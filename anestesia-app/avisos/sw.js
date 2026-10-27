// EL SERVICE WORKER DE LOS AVISOS (27-oct-2026, el médico: "que suene una
// notificación en el teléfono cuando vence"). La nube manda un Web Push a la
// hora en que vence una redosis y este trabajador lo muestra aunque la app
// esté cerrada o la pantalla bloqueada (en el quirófano el teléfono queda en
// la mesa).
//
// Vive en avisos/ con su propio alcance (avisos/), NUNCA en la raíz de la
// app: ahí Flutter registra su flutter_service_worker.js, que se des-registra
// solo en cada carga; en el mismo alcance reemplazaría a éste y la
// suscripción se perdería. flutter build web lo copia tal cual. No toca la
// red ni guarda nada: solo muestra la notificación y abre la app al tocarla.
//
// El push trae {titulo, cuerpo, tag, url}, sin el nombre ni el DNI del
// paciente (pasa por los servidores de push de Google, Apple o Mozilla).

'use strict';

// La base de la app (/anestesia-app/), un nivel arriba de este archivo.
const BASE = new URL('../', self.location.href).href;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function leer(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch (_) {
    try {
      return { cuerpo: event.data.text() };
    } catch (_) {
      return {};
    }
  }
}

self.addEventListener('push', (event) => {
  const d = leer(event);
  const titulo = typeof d.titulo === 'string' && d.titulo ? d.titulo : 'Redosis';
  const url = new URL(
    typeof d.url === 'string' && d.url ? d.url : '#/carga',
    BASE,
  ).href;
  const icono = new URL('icons/Icon-192.png', BASE).href;
  // El ícono chico de la barra (revisión del 27-oct-2026): Android lo pinta
  // con el alfa solo, y el Icon-192 es opaco (un cuadrado blanco). Va la
  // campanita del interruptor (notifications_active de Material Icons,
  // Apache 2.0) en blanco sobre transparente, 96x96.
  const insignia = new URL('icons/badge-96.png', BASE).href;
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: typeof d.cuerpo === 'string' ? d.cuerpo : '',
      tag: typeof d.tag === 'string' && d.tag ? d.tag : 'redosis',
      // Que vuelva a sonar aunque reemplace a una con el mismo tag, y que
      // quede a la vista hasta que la toquen.
      renotify: true,
      requireInteraction: true,
      vibrate: [300, 100, 300, 100, 600],
      icon: icono,
      badge: insignia,
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const datos = event.notification.data || {};
  const url = typeof datos.url === 'string' && datos.url ? datos.url : BASE;
  event.waitUntil(
    (async () => {
      // La app ya abierta (en cualquier ruta de /anestesia-app/): al frente.
      const ventanas = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const v of ventanas) {
        if (v.url.startsWith(BASE) && 'focus' in v) {
          await v.focus();
          return;
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
