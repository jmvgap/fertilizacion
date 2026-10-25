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
  { id: "urea_s6", nombre: "Urea azufrada 40-0-0-6S", n: 40, p: 0, k: 0, s: 6, precio: 753 },
  { id: "urea_s4", nombre: "Urea azufrada 37-0-0-4S", n: 37, p: 0, k: 0, s: 4, precio: 728 },
  { id: "urea_ng", nombre: "Urea N-Gradual", n: 46, p: 0, k: 0, s: 0, precio: 890 },
  { id: "uan", nombre: "UAN 32 (líquido)", n: 32, p: 0, k: 0, s: 0, precio: 600, densidad: 1.32 },
  { id: "sa", nombre: "Sulfato de amonio (SA)", n: 21, p: 0, k: 0, s: 24, precio: 455 },
  { id: "can", nombre: "Nitrato de amonio calcáreo (CAN)", n: 27, p: 0, k: 0, s: 0, precio: null },
  { id: "map", nombre: "MAP 11-52", n: 11, p: 22.7, k: 0, s: 0, precio: 1000 },
  { id: "map_10_50", nombre: "MAP 10-50", n: 10, p: 21.8, k: 0, s: 0, precio: 940 },
  { id: "dap", nombre: "DAP 18-46", n: 18, p: 20.1, k: 0, s: 0, precio: 980 },
  { id: "nps_zn", nombre: "NPS + Zn 12-40-0-8S", n: 12, p: 17.5, k: 0, s: 8, precio: 1000 },
  { id: "map_s5", nombre: "MAP azufrado 7-39-0-5S", n: 7, p: 17, k: 0, s: 5, precio: 781 },
  { id: "map_s6", nombre: "MAP azufrado 8-36-0-6S", n: 8, p: 15.7, k: 0, s: 6, precio: 762 },
  { id: "spt", nombre: "Superfosfato triple (SPT)", n: 0, p: 20.1, k: 0, s: 0, precio: 800 },
  { id: "sps", nombre: "Superfosfato simple (SPS)", n: 0, p: 9.2, k: 0, s: 12, precio: null },
  { id: "summa_soja", nombre: "Summa Mix Soja 0-36-0-5S", n: 0, p: 15.7, k: 0, s: 5, precio: 661 },
  { id: "summa_maiz", nombre: "Summa Mix Maíz 11-47-0-2S", n: 11, p: 20.5, k: 0, s: 2, precio: 1005 },
  { id: "summa_trigo", nombre: "Summa Mix Trigo 10-43-0-8S", n: 10, p: 18.8, k: 0, s: 8, precio: 939 },
];
