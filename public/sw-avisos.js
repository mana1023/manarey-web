/*
 * Service worker de los avisos de pedidos de Manarey.
 *
 * Sólo muestra notificaciones. No guarda nada en caché ni intercepta pedidos
 * de red, a propósito: así no hay forma de que deje a alguien viendo una
 * versión vieja de la tienda. Se registra con scope /admin, desde el panel de
 * pedidos, y nunca toca las páginas públicas.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { body: event.data ? event.data.text() : "" };
  }

  const opciones = {
    body: datos.body || "",
    icon: "/icon.png",
    // renotify exige un tag: sin él Chrome tira error y no muestra nada.
    tag: datos.tag || "pedido-web",
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 400],
    data: { url: datos.url || "/admin", whatsapp: datos.whatsapp || null },
    // Android muestra estos botones; iPhone los ignora y abre el pedido.
    actions: datos.whatsapp
      ? [
          { action: "whatsapp", title: "💬 Escribirle al cliente" },
          { action: "pedido", title: "Ver pedido" },
        ]
      : [],
  };

  // Siempre hay que mostrar algo: si un push llega y no se muestra nada,
  // Chrome pone un aviso genérico y termina quitando el permiso.
  event.waitUntil(self.registration.showNotification(datos.title || "Pedido nuevo en la web", opciones));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const { url, whatsapp } = event.notification.data || {};
  const destino = event.action === "whatsapp" && whatsapp ? whatsapp : url || "/admin";

  event.waitUntil(
    (async () => {
      // Si el panel ya está abierto, se usa esa ventana en vez de abrir otra.
      if (destino.startsWith("/")) {
        const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const ventana of ventanas) {
          if (new URL(ventana.url).pathname.startsWith("/admin") && "focus" in ventana) {
            await ventana.navigate(destino).catch(() => {});
            return ventana.focus();
          }
        }
      }
      return self.clients.openWindow(destino);
    })(),
  );
});
