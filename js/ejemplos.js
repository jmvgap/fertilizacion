// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Ensayo de ejemplo INVENTADO (no es una medición real): sirve para probar la
// app hasta cargar ensayos propios. Perfil típico de fertilizadora de discos,
// 31 cajas cada 1 m, algo cargado hacia la izquierda.
const EJEMPLOS = [
  {
    nombre: "Ejemplo (datos inventados)",
    maquina: "Fertilizadora de doble disco",
    fertilizante: "Urea granulada",
    dCentros: 1,
    bocaAncho: 50,
    bocaLargo: 50,
    valores: [
      0.4, 0.9, 1.6, 2.4, 3.3, 4.1, 4.9, 5.4, 5.9, 6.1,
      6.3, 6.0, 5.6, 5.1, 4.8, 4.6, 4.7, 5.0, 5.4, 5.7,
      5.9, 5.8, 5.3, 4.7, 4.0, 3.2, 2.4, 1.6, 1.0, 0.5, 0.2,
    ],
  },
];
