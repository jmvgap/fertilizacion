// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Catálogo de fertilizantes compartido entre módulos: lo usan el ensayo de
// Distribución (para elegir el producto) y Recomendación y costos.
//   n, p, k, s: % de N, P, K y S elementales (grado).
//   precio: U$S por tonelada. Los valores de fábrica son los de la app Ferti
//   (2025) y están para ser actualizados.
//   densidad: kg/L, solo en los líquidos (para pasar kg/ha a L/ha).
const CATALOGO_FERTILIZANTES = [
  { id: "urea", nombre: "Urea", n: 46, p: 0, k: 0, s: 0, precio: 522 },
  { id: "dap", nombre: "Fosfato diamónico (DAP)", n: 18, p: 20, k: 0, s: 0, precio: 880 },
  { id: "map", nombre: "Fosfato monoamónico (MAP)", n: 11, p: 23, k: 0, s: 0, precio: 883 },
  { id: "can", nombre: "Nitrato de amonio calcáreo (CAN)", n: 27, p: 0, k: 0, s: 0, precio: 450 },
  { id: "spt", nombre: "Superfosfato triple (SPT)", n: 0, p: 20, k: 0, s: 0, precio: 800 },
  { id: "sps", nombre: "Superfosfato simple (SPS)", n: 0, p: 9, k: 0, s: 12, precio: 397 },
  { id: "uan", nombre: "UAN 32 (líquido)", n: 32, p: 0, k: 0, s: 0, precio: null, densidad: 1.32 },
  { id: "sa", nombre: "Sulfato de amonio", n: 21, p: 0, k: 0, s: 24, precio: null },
];
