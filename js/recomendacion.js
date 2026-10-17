// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Motor del módulo Recomendación y costos. Sin dependencias de pantalla
// (ver pruebas.html). Todas las dosis en kg de elemento (N, P) por hectárea.

const Recomendacion = (() => {
  // Factores elemento -> óxido.
  const P_A_P2O5 = 141.94 / 61.95; // 2,29
  const K_A_K2O = 94.2 / 78.2;     // 1,20

  // Valores por defecto de cada cultivo.
  //   umbralN: N disponible objetivo (suelo 0-60 cm + fertilizante), kg N/ha.
  //   criticoP: nivel crítico de P Bray 1 (0-20 cm), mg/kg. Sucunza et al. (2018).
  //   pGrano: P exportado por tonelada de grano, kg P/t. Tablas IPNI
  //           (requerimiento × índice de cosecha).
  const CULTIVOS = {
    maiz: { nombre: "Maíz", umbralN: 150, criticoP: 12.5, pGrano: 3.0 },
    soja: { nombre: "Soja", umbralN: 0, criticoP: 14.3, pGrano: 6.7 },
    trigo: { nombre: "Trigo", umbralN: 120, criticoP: 19, pGrano: 3.75 },
  };
  const CRITICO_ROTACION_TRIGO = 19;

  // ---------- Nitrógeno: método del umbral ----------
  function dosisN(umbral, nSuelo) {
    if (!(umbral > 0)) return 0;
    return Math.max(umbral - (nSuelo || 0), 0);
  }

  // ---------- Fósforo ----------
  // Rubio et al. (2008), modelo 2: aumento de P Bray por unidad de P agregado.
  //   zona: 1 = suelos al norte de la Pampa Deprimida, 0 = al sur.
  //   arcilla en %.
  function coeficienteB(bray, zona, arcilla) {
    return 0.45369 + 0.00356 * bray + 0.16245 * zona - 0.00344 * arcilla;
  }

  // kg de P/ha necesarios para subir 1 mg/kg de P Bray en 0-20 cm:
  // la capa pesa 2000 × densidad aparente t/ha, así que 1 mg/kg = 2 × DA kg/ha.
  function kgPPorPpm(b, densidad) {
    return b > 0 ? (2 * densidad) / b : NaN;
  }

  // Devuelve las dos dosis de P:
  //   suficiencia: lleva el P Bray al nivel crítico (para el cultivo de esta campaña).
  //   construccion: suficiencia + P que exporta la cosecha (el suelo sigue en el
  //                 nivel crítico la campaña siguiente).
  function dosisP({ bray, critico, arcilla, zona, densidad, rendimiento, pGrano }) {
    const b = coeficienteB(bray, zona, arcilla);
    const porPpm = kgPPorPpm(b, densidad);
    const deficit = Math.max(critico - bray, 0);
    const suficiencia = deficit * porPpm;
    const exportacion = (rendimiento || 0) * (pGrano || 0);
    return { b, porPpm, deficit, suficiencia, exportacion, construccion: suficiencia + exportacion };
  }

  // Avisos cuando los datos salen del rango en que se ajustó el modelo de Rubio.
  function avisosRubio({ bray, arcilla }) {
    const av = [];
    if (bray < 2.4 || bray > 35.6) av.push(`El P Bray (${bray} ppm) está fuera del rango de los suelos del trabajo (2,4 a 35,6 ppm).`);
    if (arcilla < 8.7 || arcilla > 37.6) av.push(`La arcilla (${arcilla} %) está fuera del rango de los suelos del trabajo (8,7 a 37,6 %).`);
    return av;
  }

  // ---------- Costos por unidad de nutriente ----------
  // Fertilizante: { id, nombre, n, p, k, s (% de elemento), precio (U$S/t) }.
  // Simples (un solo nutriente entre N y P): costo = precio / kg de nutriente.
  // Compuestos con N y P: el precio se reparte entre N y P en proporción a lo
  // que costarían comprados por separado, al menor costo entre los simples.
  // K y S no entran en el reparto (en la región casi no hay respuesta a K y
  // no se recomiendan dosis de S).
  function costosPorNutriente(catalogo) {
    const conPrecio = catalogo.filter((f) => f.precio > 0);
    const minimo = (arr) => (arr.length ? Math.min(...arr) : null);
    const refN = minimo(conPrecio.filter((f) => f.n > 0 && !(f.p > 0)).map((f) => f.precio / (f.n * 10)));
    const refP = minimo(conPrecio.filter((f) => f.p > 0 && !(f.n > 0)).map((f) => f.precio / (f.p * 10)));
    const res = {};
    for (const f of catalogo) {
      const c = { n: null, p: null, p2o5: null };
      if (f.precio > 0) {
        if (f.n > 0 && !(f.p > 0)) c.n = f.precio / (f.n * 10);
        else if (f.p > 0 && !(f.n > 0)) c.p = f.precio / (f.p * 10);
        else if (f.n > 0 && f.p > 0 && refN !== null && refP !== null) {
          const valorN = f.n * 10 * refN, valorP = f.p * 10 * refP;
          const parteN = valorN / (valorN + valorP);
          c.n = (f.precio * parteN) / (f.n * 10);
          c.p = (f.precio * (1 - parteN)) / (f.p * 10);
        }
        if (c.p !== null) c.p2o5 = c.p / P_A_P2O5;
      }
      res[f.id] = c;
    }
    return { porFertilizante: res, refN, refP };
  }

  // ---------- Combinación más económica ----------
  // Minimiza el costo cubriendo al menos nReq y pReq (kg/ha). Es un problema
  // lineal con dos restricciones: la solución óptima usa uno o dos productos,
  // así que alcanza con probar cada producto solo y cada par con las dos
  // restricciones justas. Devuelve las mejores alternativas ordenadas.
  function combinaciones(catalogo, nReq, pReq, cuantas = 4) {
    const usables = catalogo.filter((f) => f.precio > 0 && ((nReq > 0 && f.n > 0) || (pReq > 0 && f.p > 0)));
    const opciones = [];
    const agregar = (items) => {
      if (items.some((it) => !(it.kg >= 0) || !isFinite(it.kg))) return;
      const limpios = items.filter((it) => it.kg > 1e-6);
      if (!limpios.length) return;
      const aporteN = limpios.reduce((s, it) => s + it.kg * (it.f.n || 0) / 100, 0);
      const aporteP = limpios.reduce((s, it) => s + it.kg * (it.f.p || 0) / 100, 0);
      if (aporteN < nReq - 1e-6 || aporteP < pReq - 1e-6) return;
      const costo = limpios.reduce((s, it) => s + it.kg * it.f.precio / 1000, 0);
      const clave = limpios.map((it) => it.f.id).sort().join("+");
      if (opciones.some((o) => o.clave === clave)) return;
      opciones.push({ clave, items: limpios, costo, aporteN, aporteP });
    };
    for (const f of usables) {
      if ((nReq > 0 && !(f.n > 0)) || (pReq > 0 && !(f.p > 0))) continue;
      const kg = Math.max(nReq > 0 ? nReq / (f.n / 100) : 0, pReq > 0 ? pReq / (f.p / 100) : 0);
      agregar([{ f, kg }]);
    }
    if (nReq > 0 && pReq > 0) {
      for (let i = 0; i < usables.length; i++) for (let j = i + 1; j < usables.length; j++) {
        const a = usables[i], b = usables[j];
        const an = (a.n || 0) / 100, ap = (a.p || 0) / 100, bn = (b.n || 0) / 100, bp = (b.p || 0) / 100;
        const det = an * bp - bn * ap;
        if (Math.abs(det) < 1e-12) continue;
        const xa = (nReq * bp - bn * pReq) / det;
        const xb = (an * pReq - nReq * ap) / det;
        agregar([{ f: a, kg: xa }, { f: b, kg: xb }]);
      }
    }
    opciones.sort((x, y) => x.costo - y.costo);
    return opciones.slice(0, cuantas);
  }

  // Grado en óxidos (N - P2O5 - K2O - S), como figura en la bolsa.
  function gradoEquivalente(f) {
    return { n: f.n || 0, p2o5: (f.p || 0) * P_A_P2O5, k2o: (f.k || 0) * K_A_K2O, s: f.s || 0 };
  }

  return {
    P_A_P2O5, K_A_K2O, CULTIVOS, CRITICO_ROTACION_TRIGO,
    dosisN, coeficienteB, kgPPorPpm, dosisP, avisosRubio,
    costosPorNutriente, combinaciones, gradoEquivalente,
  };
})();

if (typeof module !== "undefined") module.exports = Recomendacion;
