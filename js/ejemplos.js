// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Ensayo de ejemplo INVENTADO (no es una medición real): sirve para probar la
// app hasta cargar ensayos propios. Perfil típico de fertilizadora de discos
// en forma de "M", 17 cajas cada 2 m, algo cargado hacia la izquierda.
const EJEMPLOS = [
  {
    nombre: "Ejemplo (datos inventados)",
    maquina: "Fertilizadora de doble disco",
    fertilizante: "Urea granulada",
    dCentros: 2,
    bocaAncho: 50,
    bocaLargo: 50,
    valores: [
      0.2, 0.9, 2.4, 4.1, 5.4, 6.1, 6.0, 5.1, 4.6,
      5.0, 5.7, 5.8, 4.7, 3.2, 1.6, 0.5, 0.1,
    ],
  },
];
