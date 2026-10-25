// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Catálogo de fertilizantes compartido entre módulos: lo usan el ensayo de
// Distribución (para elegir el producto) y Recomendación y costos.
//   n, p, k, s: % de N, P, K y S elementales (grado). P = P2O5 ÷ 2,2914.
//   precio: U$S por tonelada (lista del 11/06/2026; se actualizan con
//   "Actualizar precios", que lee precios.json).
//   densidad: kg/L, solo en los líquidos (para pasar kg/ha a L/ha).
const CATALOGO_FERTILIZANTES = [
  { id: "urea", nombre: "Urea", n: 46, p: 0, k: 0, s: 0, precio: 850 },
  { id: "dap", nombre: "Fosfato diamónico (DAP)", n: 18, p: 20.1, k: 0, s: 0, precio: 980 },
  { id: "map", nombre: "Fosfato monoamónico (MAP)", n: 11, p: 22.7, k: 0, s: 0, precio: 1000 },
  { id: "can", nombre: "Nitrato de amonio calcáreo (CAN)", n: 27, p: 0, k: 0, s: 0, precio: null },
  { id: "spt", nombre: "Superfosfato triple (SPT)", n: 0, p: 20.1, k: 0, s: 0, precio: 800 },
  { id: "sps", nombre: "Superfosfato simple (SPS)", n: 0, p: 9.2, k: 0, s: 12, precio: null },
  { id: "uan", nombre: "UAN 32 (líquido)", n: 32, p: 0, k: 0, s: 0, precio: 600, densidad: 1.32 },
  { id: "sa", nombre: "Sulfato de amonio", n: 21, p: 0, k: 0, s: 24, precio: 455 },
];
