// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Catálogo de fertilizantes compartido entre módulos: lo usan el ensayo de
// Distribución (para elegir el producto) y Recomendación y costos.
//   n, p, k, s: % de N, P, K y S elementales (grado).
//   precio: U$S por tonelada. Los valores de fábrica son los de la app Ferti
//   (2025) y están para ser actualizados.
const CATALOGO_FERTILIZANTES = [
  { id: "urea", nombre: "Urea", n: 46, p: 0, k: 0, s: 0, precio: 522 },
  { id: "dap", nombre: "Fosfato diamónico (DAP)", n: 18, p: 20, k: 0, s: 0, precio: 880 },
  { id: "map", nombre: "Fosfato monoamónico (MAP)", n: 11, p: 23, k: 0, s: 0, precio: 883 },
  { id: "can", nombre: "Nitrato de amonio calcáreo (CAN)", n: 27, p: 0, k: 0, s: 0, precio: 450 },
  { id: "spt", nombre: "Superfosfato triple (SPT)", n: 0, p: 20, k: 0, s: 0, precio: 800 },
  { id: "sps", nombre: "Superfosfato simple (SPS)", n: 0, p: 9, k: 0, s: 12, precio: 397 },
  { id: "kcl", nombre: "Cloruro de potasio", n: 0, p: 0, k: 50, s: 0, precio: null },
  { id: "sa", nombre: "Sulfato de amonio", n: 21, p: 0, k: 0, s: 24, precio: null },
];
