// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Motor de cálculo del módulo Distribución. Sin dependencias de pantalla: todo lo que
// está acá se puede probar por separado (ver pruebas.html).
//
// Convenciones:
//   - Las cajas se numeran de izquierda a derecha y el centro de la fila de
//     cajas coincide con el centro de la máquina (posición x = 0).
//   - d = distancia entre cajas, de centro a centro (m).
//   - w = ancho de trabajo = distancia entre pasadas (m).
//   - Un valor de caja null significa "sin dato" (distinto de 0, que es una
//     medición válida).

const Motor = (() => {
  const EPS = 1e-9;

  // ---------- Lectura de números ----------

  // Acepta coma o punto decimal, sin límite de decimales. Devuelve:
  //   { ok: true, valor: número | null }   (null si el texto está vacío)
  //   { ok: false, error: "..." }
  function leerNumero(texto) {
    const t = String(texto ?? "").trim().replace(/\s+/g, "");
    if (t === "") return { ok: true, valor: null };
    if (t.startsWith("-")) return { ok: false, error: "No se aceptan valores negativos" };
    const norm = t.replace(",", ".");
    if (!/^(\d+(\.\d*)?|\.\d+)$/.test(norm)) {
      return { ok: false, error: "Solo números, con coma o punto decimal" };
    }
    return { ok: true, valor: parseFloat(norm) };
  }

  // ---------- Datos de cajas ----------

  function hayDatos(valores) {
    return valores.some((v) => v !== null && v !== undefined);
  }

  // Completa las cajas sin dato interpolando linealmente entre las cajas
  // medidas más cercanas a cada lado. Las cajas sin dato en los extremos no se
  // inventan: se informan como faltantes.
  function completar(valores) {
    const n = valores.length;
    const medidas = [];
    valores.forEach((v, i) => { if (v !== null && v !== undefined) medidas.push(i); });
    const res = { valores: valores.slice(), interpoladas: new Array(n).fill(false),
                  faltanIzq: 0, faltanDer: 0, cantMedidas: medidas.length };
    if (medidas.length === 0) { res.faltanIzq = n; return res; }
    res.faltanIzq = medidas[0];
    res.faltanDer = n - 1 - medidas[medidas.length - 1];
    for (let k = 0; k < medidas.length - 1; k++) {
      const a = medidas[k], b = medidas[k + 1];
      for (let i = a + 1; i < b; i++) {
        const t = (i - a) / (b - a);
        res.valores[i] = valores[a] + (valores[b] - valores[a]) * t;
        res.interpoladas[i] = true;
      }
    }
    return res;
  }

  // Cambia la cantidad de cajas conservando los datos centrados (si se agregan
  // cajas aparecen vacías en los dos extremos; si se quitan, se recortan los
  // extremos).
  function redimensionar(valores, n) {
    const viejo = valores.length;
    if (n === viejo) return valores.slice();
    const res = new Array(n).fill(null);
    const desp = Math.floor((n - viejo) / 2);
    for (let i = 0; i < viejo; i++) {
      const j = i + desp;
      if (j >= 0 && j < n) res[j] = valores[i];
    }
    return res;
  }

  // Posición de cada caja respecto del centro de la máquina.
  function posiciones(n, d) {
    return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * d);
  }

  // ---------- Perfil de una pasada ----------

  // Devuelve una función p(x) con la cantidad recogida a una distancia x del
  // centro de la pasada. Entre cajas interpola linealmente; fuera de la fila
  // de cajas vale 0.
  function crearPerfil(valores, d) {
    const n = valores.length;
    const medio = ((n - 1) / 2) * d;
    const p = (x) => {
      if (x < -medio - EPS || x > medio + EPS) return 0;
      if (n === 1) return valores[0];
      const t = Math.min(Math.max((x + medio) / d, 0), n - 1);
      const i = Math.min(Math.floor(t + EPS), n - 2);
      const f = t - i;
      return valores[i] + (valores[i + 1] - valores[i]) * (f < EPS ? 0 : f);
    };
    p.medio = medio;
    return p;
  }

  // Aporte de la pasada k (centrada en k·w) en la posición x. En modo
  // alternado las pasadas impares van en sentido contrario (perfil espejado).
  function aportePasada(perfil, x, w, k, alternado) {
    let local = x - k * w;
    if (alternado && Math.abs(k) % 2 === 1) local = -local;
    return perfil(local);
  }

  // Suma de TODAS las pasadas que alcanzan la posición x (campo sin bordes).
  function sumaEn(perfil, x, w, alternado) {
    const kmin = Math.ceil((x - perfil.medio) / w - EPS);
    const kmax = Math.floor((x + perfil.medio) / w + EPS);
    let s = 0;
    for (let k = kmin; k <= kmax; k++) s += aportePasada(perfil, x, w, k, alternado);
    return s;
  }

  // ---------- Estadística ----------

  function media(a) { return a.reduce((s, v) => s + v, 0) / a.length; }

  // Desvío estándar muestral (n-1), como piden las normas.
  function desvio(a) {
    if (a.length < 2) return 0;
    const m = media(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
  }

  function cv(a) {
    const m = media(a);
    return m > 0 ? (desvio(a) / m) * 100 : NaN;
  }

  // ---------- Superposición ----------

  // Calcula la distribución superpuesta para un ancho de trabajo w.
  // Evalúa un ciclo completo: w en modo continuo, 2·w en alternado. Los
  // puntos se ubican sobre la grilla de las cajas cuando w es múltiplo de d;
  // si no, se reparten parejos con un paso lo más cercano posible a d.
  function superponer(valores, d, w, alternado) {
    const perfil = crearPerfil(valores, d);
    const n = valores.length;
    const origen = posiciones(n, d)[Math.floor(n / 2)];
    const m = Math.max(1, Math.ceil(w / d - EPS));
    const paso = w / m;
    const puntos = alternado ? 2 * m : m;
    const xs = [], ys = [];
    for (let j = 0; j < puntos; j++) {
      const x = origen + j * paso;
      xs.push(x);
      ys.push(sumaEn(perfil, x, w, alternado));
    }
    const r = { w, alternado, xs, ys, media: media(ys), cv: cv(ys) };
    if (alternado) {
      const a = ys.slice(0, m), b = ys.slice(m);
      r.mitades = [
        { media: media(a), cv: cv(a) },
        { media: media(b), cv: cv(b) },
      ];
    }
    return r;
  }

  // Curva de CV en función del ancho de trabajo.
  function curvaCV(valores, d, desde, hasta, paso, alternado) {
    const res = [];
    for (let w = desde; w <= hasta + EPS; w += paso) {
      const ww = Math.round(w * 1000) / 1000;
      const s = superponer(valores, d, ww, alternado);
      const fila = { w: ww, cv: s.cv, media: s.media };
      if (alternado) { fila.cvIzq = s.mitades[0].cv; fila.cvDer = s.mitades[1].cv; }
      res.push(fila);
    }
    return res;
  }

  // Tramos de ancho donde el CV no supera el umbral. La curva puede tener
  // varios (perfiles en "W"), así que no alcanza con informar el máximo.
  function rangosAceptables(curva, umbral) {
    const res = [];
    let actual = null;
    for (const f of curva) {
      if (f.cv <= umbral) {
        if (actual) actual.hasta = f.w; else actual = { desde: f.w, hasta: f.w };
      } else if (actual) { res.push(actual); actual = null; }
    }
    if (actual) res.push(actual);
    return res;
  }

  // Datos para el gráfico de pasadas: tres pasadas visibles (izquierda, centro,
  // derecha) sobre la grilla de cajas de la pasada central. En cada posición
  // se informa qué pasada va "adelante" (la central tapa a las otras) y el
  // total real, que incluye todas las pasadas del campo.
  function graficoPasadas(valores, d, w, alternado) {
    const perfil = crearPerfil(valores, d);
    const n = valores.length;
    const pos0 = posiciones(n, d)[0];
    const alcance = w + perfil.medio;
    const jmin = Math.ceil((-alcance - pos0) / d - EPS);
    const jmax = Math.floor((alcance - pos0) / d + EPS);
    const barras = [];
    for (let j = jmin; j <= jmax; j++) {
      const x = pos0 + j * d;
      const izq = aportePasada(perfil, x, w, -1, alternado);
      const cen = aportePasada(perfil, x, w, 0, alternado);
      const der = aportePasada(perfil, x, w, 1, alternado);
      const total = sumaEn(perfil, x, w, alternado);
      const enCentro = Math.abs(x) <= perfil.medio + EPS;
      let frente, base;
      if (enCentro) { frente = "centro"; base = cen; }
      else if (x < 0) { frente = "izquierda"; base = izq; }
      else { frente = "derecha"; base = der; }
      barras.push({ x, izq, cen, der, total, frente, base, extra: Math.max(total - base, 0) });
    }
    return { barras, medio: perfil.medio };
  }

  // ---------- Dosis ----------

  // Gramos recogidos en una caja -> kg/ha, según el área de la boca (cm x cm).
  function gramosAKgHa(gramos, bocaAnchoCm, bocaLargoCm) {
    const area = (bocaAnchoCm * bocaLargoCm) / 10000; // m²
    return area > 0 ? (gramos / area) * 10 : NaN;
  }

  // Calibración en el campo.
  //   kg/ha = kg/min × 600 / (velocidad km/h × ancho m)
  function kgHaDesdeCaudal(kgMin, velKmH, anchoM) {
    const den = velKmH * anchoM;
    return den > 0 ? (kgMin * 600) / den : NaN;
  }
  function caudalParaDosis(kgHa, velKmH, anchoM) {
    return (kgHa * velKmH * anchoM) / 600;
  }

  return {
    leerNumero, hayDatos, completar, redimensionar, posiciones,
    crearPerfil, sumaEn, media, desvio, cv,
    superponer, curvaCV, rangosAceptables, graficoPasadas,
    gramosAKgHa, kgHaDesdeCaudal, caudalParaDosis,
  };
})();

if (typeof module !== "undefined") module.exports = Motor;
