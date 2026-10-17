// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Guarda la app en el teléfono para que funcione sin conexión en el campo.
// Al publicar cambios hay que subir el número de versión.
const VERSION = "fertilizacion-v5";
const ARCHIVOS = [
  "./", "index.html", "manifest.webmanifest", "css/estilos.css",
  "js/motor.js", "js/graficos.js", "js/catalogo.js", "js/ejemplos.js", "js/app.js",
  "iconos/icono.svg", "iconos/icono-192.png", "iconos/icono-512.png", "iconos/icono-maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Primero intenta la red (para recibir actualizaciones) y si no hay conexión
// usa la copia guardada.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copia)); return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
