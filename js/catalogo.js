// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Catálogo de fertilizantes compartido entre módulos. Por ahora lo usa el
// ensayo (para elegir el producto); más adelante lo van a usar los módulos de
// dosis y costos (tomado de la app Ferti) y de mezclas físicas.
//   n, p, k: % de N, P y K elementales (como en Ferti).
const CATALOGO_FERTILIZANTES = [
  { nombre: "Urea", n: 46, p: 0, k: 0 },
  { nombre: "Fosfato diamónico (DAP)", n: 18, p: 20, k: 0 },
  { nombre: "Fosfato monoamónico (MAP)", n: 11, p: 23, k: 0 },
  { nombre: "Nitrato de amonio calcáreo (CAN)", n: 27, p: 0, k: 0 },
  { nombre: "Superfosfato triple (SPT)", n: 0, p: 20, k: 0 },
  { nombre: "Superfosfato simple (SPS)", n: 0, p: 9, k: 0 },
  { nombre: "Cloruro de potasio", n: 0, p: 0, k: 50 },
  { nombre: "Sulfato de amonio", n: 21, p: 0, k: 0 },
];
