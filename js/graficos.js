// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Gráficos SVG livianos, sin librerías (la app tiene que andar sin conexión).

const Graficos = (() => {
  const NS = "http://www.w3.org/2000/svg";

  function el(tag, attrs = {}, padre) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (padre) padre.appendChild(e);
    return e;
  }

  function color(nombre) {
    return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  }

  // Marcas "lindas" para un eje entre 0 y max.
  function marcas(max, cantidad = 5) {
    if (!(max > 0)) return [0, 1];
    const bruto = max / cantidad;
    const pot = 10 ** Math.floor(Math.log10(bruto));
    const paso = [1, 2, 2.5, 5, 10].map((f) => f * pot).find((p) => p >= bruto);
    const res = [];
    for (let v = 0; v <= max + paso * 0.001; v += paso) res.push(+v.toFixed(10));
    if (res[res.length - 1] < max) res.push(+(res[res.length - 1] + paso).toFixed(10));
    return res;
  }

  const fmt = (v, dec = 1) => v.toLocaleString("es-AR", { maximumFractionDigits: dec });

  // Prepara el lienzo y devuelve funciones de escala.
  function lienzo(svg, alto, xmin, xmax, ymax, opciones = {}) {
    svg.innerHTML = "";
    const ancho = Math.max(svg.clientWidth || svg.parentNode.clientWidth || 320, 240);
    svg.setAttribute("viewBox", `0 0 ${ancho} ${alto}`);
    svg.setAttribute("height", alto);
    const m = { izq: 40, der: 10, arr: 10, aba: 28, ...opciones.margenes };
    const ym = marcas(ymax);
    const ytop = ym[ym.length - 1];
    const sx = (x) => m.izq + ((x - xmin) / (xmax - xmin || 1)) * (ancho - m.izq - m.der);
    const sy = (y) => alto - m.aba - (y / ytop) * (alto - m.arr - m.aba);
    const ejes = el("g", {}, svg);
    for (const y of ym) {
      el("line", { x1: m.izq, x2: ancho - m.der, y1: sy(y), y2: sy(y), stroke: "#e3e8e4" }, ejes);
      const t = el("text", { x: m.izq - 4, y: sy(y) + 4, "text-anchor": "end" }, ejes);
      t.textContent = fmt(y, 2);
    }
    if (opciones.etqY) {
      const t = el("text", { x: 4, y: m.arr + 2, "text-anchor": "start", "dominant-baseline": "hanging" }, ejes);
      t.textContent = opciones.etqY;
    }
    return { ancho, alto, m, sx, sy, ytop, ejes };
  }

  function ejeX(c, xmin, xmax, sufijo = " m") {
    const rango = xmax - xmin;
    const xs = marcas(rango, Math.max(3, Math.floor(c.ancho / 70)));
    const paso = xs[1] - xs[0];
    const inicio = Math.ceil(xmin / paso) * paso;
    for (let x = inicio; x <= xmax + 1e-9; x += paso) {
      const t = el("text", { x: c.sx(x), y: c.alto - c.m.aba + 16, "text-anchor": "middle" }, c.ejes);
      t.textContent = fmt(+x.toFixed(6), 2) + sufijo;
    }
    el("line", { x1: c.m.izq, x2: c.ancho - c.m.der, y1: c.sy(0), y2: c.sy(0), stroke: "#9aa59d" }, c.ejes);
  }

  // ---------- Pasadas superpuestas ----------
  // Capas, de atrás hacia adelante: suma total (amarillo), pasadas vecinas
  // completas (rojo y azul) y pasada central (verde). Así se ve el perfil
  // entero de cada pasada y el amarillo es lo que la suma agrega por encima.
  // datos: resultado de Motor.graficoPasadas + { d, w, ciclo: [x0, x1], media,
  //        etqY, alto, marcada (índice de barra), onClick(índice) }
  function pasadas(svg, datos) {
    const { barras, d } = datos;
    const xmin = barras[0].x - d / 2, xmax = barras[barras.length - 1].x + d / 2;
    const ymax = Math.max(...barras.map((b) => b.total), 0.001);
    const c = lienzo(svg, datos.alto || 240, xmin, xmax, ymax, { etqY: datos.etqY });
    // Ciclo evaluado (sombreado)
    if (datos.ciclo) {
      el("rect", { x: c.sx(datos.ciclo[0]), y: c.m.arr, width: c.sx(datos.ciclo[1]) - c.sx(datos.ciclo[0]),
        height: c.sy(0) - c.m.arr, fill: "#000", "fill-opacity": 0.05 }, c.ejes);
    }
    ejeX(c, xmin, xmax);
    const anchoBarra = Math.max(c.sx(xmin + d) - c.sx(xmin) - (d * 40 > 1 ? 1 : 0), 0.8);
    const colores = { izquierda: color("--p-izq"), centro: color("--p-cen"), derecha: color("--p-der") };
    const amarillo = color("--p-suma");
    const g = el("g", {}, svg);
    const barra = (x, v, fill) => {
      if (v > 1e-9) el("rect", { x, y: c.sy(v), width: anchoBarra, height: c.sy(0) - c.sy(v), fill }, g);
    };
    for (const b of barras) {
      const x = c.sx(b.x) - anchoBarra / 2;
      barra(x, b.total, amarillo);
      barra(x, b.izq, colores.izquierda);
      barra(x, b.der, colores.derecha);
      barra(x, b.cen, colores.centro);
    }
    if (datos.marcada != null && barras[datos.marcada]) {
      const b = barras[datos.marcada], x = c.sx(b.x) - anchoBarra / 2;
      el("rect", { x: x - 1.5, y: c.sy(b.total) - 1.5, width: anchoBarra + 3, height: c.sy(0) - c.sy(b.total) + 1.5,
        fill: "none", stroke: "#111", "stroke-width": 2 }, g);
    }
    // Centros de pasada
    for (const [k, col] of [[-1, colores.izquierda], [0, colores.centro], [1, colores.derecha]]) {
      const x = c.sx(k * datos.w);
      el("line", { x1: x, x2: x, y1: c.m.arr, y2: c.sy(0), stroke: col, "stroke-dasharray": "4 3", "stroke-width": 1.5 }, g);
    }
    if (datos.media > 0) {
      el("line", { x1: c.m.izq, x2: c.ancho - c.m.der, y1: c.sy(datos.media), y2: c.sy(datos.media),
        stroke: "#333", "stroke-dasharray": "6 4" }, g);
    }
    // Zona de toque: elige la barra más cercana.
    if (datos.onClick) {
      const z = el("rect", { x: c.m.izq, y: 0, width: c.ancho - c.m.izq - c.m.der, height: c.alto,
        fill: "transparent", style: "cursor:pointer" }, svg);
      z.addEventListener("click", (ev) => {
        const r = svg.getBoundingClientRect();
        const px = ((ev.clientX - r.left) / r.width) * c.ancho;
        let mejor = 0;
        barras.forEach((b, i) => { if (Math.abs(c.sx(b.x) - px) < Math.abs(c.sx(barras[mejor].x) - px)) mejor = i; });
        datos.onClick(mejor);
      });
    }
  }

  // ---------- Curva de CV en función del ancho ----------
  // datos: { series: [{ nombre, color, puntos: [{w, cv}], trazo }], limites: [bueno, aceptable],
  //          wActual, onClick(w) }
  // Fondo en tres franjas: verde (bueno), amarillo (aceptable) y rojo (malo).
  function curvaCV(svg, datos) {
    const [bueno, aceptable] = datos.limites;
    const todos = datos.series.flatMap((s) => s.puntos);
    const xmin = Math.min(...todos.map((p) => p.w)), xmax = Math.max(...todos.map((p) => p.w));
    const ymax = Math.min(Math.max(...todos.map((p) => p.cv).filter(isFinite), aceptable * 1.4), 100);
    const c = lienzo(svg, 260, xmin, xmax, ymax, { etqY: "CV %" });
    ejeX(c, xmin, xmax);
    const franja = (y0, y1, fill) => el("rect", { x: c.m.izq, y: c.sy(Math.min(y1, c.ytop)), width: c.ancho - c.m.izq - c.m.der,
      height: Math.max(c.sy(y0) - c.sy(Math.min(y1, c.ytop)), 0), fill, "fill-opacity": 0.13 }, c.ejes);
    franja(0, bueno, color("--cv-bueno"));
    franja(bueno, aceptable, color("--cv-medio"));
    franja(aceptable, c.ytop, color("--cv-malo"));
    const g = el("g", {}, svg);
    for (const s of datos.series) {
      const pts = s.puntos.filter((p) => isFinite(p.cv))
        .map((p) => `${c.sx(p.w).toFixed(1)},${c.sy(Math.min(p.cv, c.ytop)).toFixed(1)}`).join(" ");
      el("polyline", { points: pts, fill: "none", stroke: s.color, "stroke-width": s.trazo || 2.5,
        "stroke-dasharray": s.guiones || "", "stroke-linejoin": "round" }, g);
    }
    if (datos.wActual != null) {
      const x = c.sx(datos.wActual);
      el("line", { x1: x, x2: x, y1: c.m.arr, y2: c.sy(0), stroke: "#333", "stroke-width": 1.5 }, g);
    }
    if (datos.onClick) {
      const z = el("rect", { x: c.m.izq, y: 0, width: c.ancho - c.m.izq - c.m.der, height: c.alto,
        fill: "transparent", style: "cursor:crosshair" }, g);
      z.addEventListener("click", (ev) => {
        const r = svg.getBoundingClientRect();
        const px = ((ev.clientX - r.left) / r.width) * c.ancho;
        const w = xmin + ((px - c.m.izq) / (c.ancho - c.m.izq - c.m.der)) * (xmax - xmin);
        datos.onClick(Math.min(Math.max(w, xmin), xmax));
      });
    }
  }

  // ---------- Esquema de la distancia entre cajas ----------
  function esquemaCajas(svg) {
    svg.innerHTML = "";
    svg.setAttribute("viewBox", "0 0 300 70");
    const verde = color("--verde");
    for (const x of [40, 140, 240]) {
      el("rect", { x: x - 22, y: 18, width: 44, height: 26, rx: 3, fill: "#fff", stroke: "#555" }, svg);
      el("line", { x1: x, x2: x, y1: 12, y2: 50, stroke: verde, "stroke-dasharray": "3 2" }, svg);
    }
    el("line", { x1: 40, x2: 140, y1: 60, y2: 60, stroke: verde, "stroke-width": 2, "marker-end": "", }, svg);
    for (const x of [40, 140]) el("line", { x1: x, x2: x, y1: 55, y2: 65, stroke: verde, "stroke-width": 2 }, svg);
    const t = el("text", { x: 90, y: 56, "text-anchor": "middle", fill: verde, "font-size": 11 }, svg);
    t.textContent = "centro a centro";
    const t2 = el("text", { x: 190, y: 12, "text-anchor": "middle", fill: "#999", "font-size": 10 }, svg);
    t2.textContent = "(no el hueco entre cajas)";
  }

  return { pasadas, curvaCV, esquemaCajas, fmt };
})();
