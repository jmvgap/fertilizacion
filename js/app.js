// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Pantallas del módulo Distribución. Los cálculos están en motor.js y los dibujos en
// graficos.js; acá solo se conectan los datos con la interfaz.

(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const fmt = Graficos.fmt;

  // ---------- Almacenamiento local (puede no estar disponible) ----------
  const CLAVE_ACTUAL = "ferticalc.actual";
  const CLAVE_ENSAYOS = "ferticalc.ensayos";
  const CLAVE_CAL = "ferticalc.calibracion";
  function leer(clave, porDefecto) {
    try { const t = localStorage.getItem(clave); return t ? JSON.parse(t) : porDefecto; }
    catch { return porDefecto; }
  }
  function escribir(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
  }

  // ---------- Estado ----------
  function ensayoNuevo() {
    return {
      id: null, nombre: "", fecha: new Date().toISOString().slice(0, 10),
      maquina: "", fertilizante: "",
      nCajas: 31, dCentros: 1, bocaAncho: null, bocaLargo: null,
      umbral: 15, wPaso: 0.5, modo: "continuo", ancho: 15,
      valores: new Array(31).fill(null),
    };
  }
  let ensayo = Object.assign(ensayoNuevo(), leer(CLAVE_ACTUAL, {}));
  let pantalla = "ensayo";
  let seleccion = 0;
  let verMitades = false;
  const cal = Object.assign({ kgRecogidos: null, segundos: null, kgMin: null, vel: null, ancho: null, objetivo: null },
    leer(CLAVE_CAL, {}));

  function guardarActual() { escribir(CLAVE_ACTUAL, ensayo); }

  function toast(texto) {
    const t = $("#toast");
    t.textContent = texto; t.classList.add("ver");
    clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("ver"), 2200);
  }

  // ---------- Datos listos para calcular ----------
  // Devuelve { ok, valores, interpoladas, mensaje }
  function datosParaCalculo() {
    const r = Motor.completar(ensayo.valores);
    if (!Motor.hayDatos(ensayo.valores)) {
      return { ok: false, ...r, mensaje: "Todavía no hay pesos cargados. Cargalos en la pantalla Cajas (o cargá el ejemplo)." };
    }
    if (r.faltanIzq || r.faltanDer) {
      const partes = [];
      if (r.faltanIzq) partes.push(r.faltanIzq === 1 ? "la caja 1" : `las cajas 1 a ${r.faltanIzq}`);
      if (r.faltanDer) { const n = ensayo.nCajas, a = n - r.faltanDer + 1;
        partes.push(r.faltanDer === 1 ? `la caja ${n}` : `las cajas ${a} a ${n}`); }
      return { ok: false, ...r, mensaje: `Faltan datos en los extremos (${partes.join(" y ")}). Las cajas de los extremos no se pueden interpolar: si no recogieron nada, poné 0.` };
    }
    if (r.cantMedidas < 3) return { ok: false, ...r, mensaje: "Hacen falta al menos 3 cajas medidas." };
    if (!(ensayo.valores.some((v) => v > 0))) return { ok: false, ...r, mensaje: "Todas las cajas están en cero." };
    return { ok: true, ...r };
  }

  function anchoMin() { return Math.max(+(ensayo.dCentros).toFixed(2), 0.1); }
  function anchoMax() { return +(ensayo.nCajas * ensayo.dCentros).toFixed(2); }
  function acotarAncho(w) { return Math.min(Math.max(Math.round(w * 10) / 10, anchoMin()), anchoMax()); }

  function aviso(contenedor, mensaje, tipo = "") {
    $(contenedor).innerHTML = mensaje ? `<div class="aviso ${tipo}">${mensaje}</div>` : "";
  }

  function kgHa(gramos) {
    if (!(ensayo.bocaAncho > 0 && ensayo.bocaLargo > 0)) return null;
    return Motor.gramosAKgHa(gramos, ensayo.bocaAncho, ensayo.bocaLargo);
  }

  function mostrarSubtitulo() {
    $("#sub-ensayo").textContent = ensayo.nombre ? " · " + ensayo.nombre : "";
  }

  // ---------- Navegación ----------
  const VERSION = "2.0.0";
  let pantallaAnterior = "ensayo";
  $("#version-app").textContent = VERSION;
  $("#btn-acerca").onclick = () => { if (pantalla !== "acerca") pantallaAnterior = pantalla; irA("acerca"); };
  $("#btn-volver").onclick = () => irA(pantallaAnterior);

  function irA(p) {
    pantalla = p;
    $$("section.pantalla").forEach((s) => s.classList.toggle("activa", s.id === "p-" + p));
    $$("#pestanas button").forEach((b) => b.classList.toggle("activa", b.dataset.p === p));
    window.scrollTo(0, 0);
    dibujar();
  }
  $$("#pestanas button").forEach((b) => b.addEventListener("click", () => irA(b.dataset.p)));

  function dibujar() {
    mostrarSubtitulo();
    if (pantalla === "ensayo") dibujarEnsayo();
    if (pantalla === "cajas") dibujarCajas();
    if (pantalla === "pasadas") dibujarPasadas();
    if (pantalla === "cv") dibujarCV();
    if (pantalla === "dosis") dibujarDosis();
  }

  // ============ ENSAYO ============
  $("#lista-fert").innerHTML = CATALOGO_FERTILIZANTES.map((f) => `<option value="${f.nombre}">`).join("");

  function mostrarValor(v) { return v === null || v === undefined ? "" : String(v).replace(".", ","); }

  function dibujarEnsayo() {
    $$("#p-ensayo [data-campo]").forEach((inp) => {
      if (document.activeElement !== inp) {
        const v = ensayo[inp.dataset.campo];
        inp.value = inp.dataset.tipo ? mostrarValor(v) : (v ?? "");
        inp.classList.remove("invalido");
      }
    });
    Graficos.esquemaCajas($("#esquema-cajas"));
    dibujarLista();
  }

  $$("#p-ensayo [data-campo]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const campo = inp.dataset.campo;
      if (!inp.dataset.tipo) { ensayo[campo] = inp.value; guardarActual(); mostrarSubtitulo(); return; }
      const r = Motor.leerNumero(inp.value);
      let valido = r.ok && r.valor !== null && r.valor > 0;
      if (valido && inp.dataset.tipo === "entero") valido = Number.isInteger(r.valor) && r.valor >= 3 && r.valor <= 200;
      if (campo === "bocaAncho" || campo === "bocaLargo") valido = r.ok; // pueden quedar vacíos
      inp.classList.toggle("invalido", !valido);
      if (!valido) return;
      if (campo === "nCajas") {
        ensayo.valores = Motor.redimensionar(ensayo.valores, r.valor);
        seleccion = Math.min(seleccion, r.valor - 1);
      }
      ensayo[campo] = r.valor;
      ensayo.ancho = acotarAncho(ensayo.ancho);
      guardarActual();
    });
  });

  function dibujarLista() {
    const lista = leer(CLAVE_ENSAYOS, []);
    const ul = $("#lista-ensayos");
    if (!lista.length) { ul.innerHTML = `<li><small>No hay ensayos guardados.</small></li>`; return; }
    ul.innerHTML = "";
    lista.slice().sort((a, b) => (b.fecha || "").localeCompare(a.fecha || "")).forEach((e) => {
      const li = document.createElement("li");
      const actual = e.id === ensayo.id;
      li.innerHTML = `<div class="info"><b>${escapar(e.nombre || "(sin nombre)")}${actual ? " ✓" : ""}</b>
        <small>${e.fecha || ""} · ${escapar(e.maquina || "")} · ${escapar(e.fertilizante || "")}</small></div>`;
      const abrir = document.createElement("button");
      abrir.className = "btn sec"; abrir.textContent = "Abrir";
      abrir.onclick = () => { ensayo = Object.assign(ensayoNuevo(), e); guardarActual(); toast("Ensayo abierto"); dibujar(); };
      const borrar = document.createElement("button");
      borrar.className = "btn peligro"; borrar.textContent = "Borrar";
      borrar.onclick = () => {
        if (!confirm(`¿Borrar el ensayo "${e.nombre || "(sin nombre)"}"?`)) return;
        escribir(CLAVE_ENSAYOS, leer(CLAVE_ENSAYOS, []).filter((x) => x.id !== e.id));
        if (ensayo.id === e.id) { ensayo.id = null; guardarActual(); }
        dibujarLista();
      };
      li.append(abrir, borrar);
      ul.appendChild(li);
    });
  }

  function escapar(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  $("#btn-guardar").onclick = () => {
    if (!ensayo.nombre.trim()) { toast("Poné un nombre al ensayo para guardarlo"); return; }
    const lista = leer(CLAVE_ENSAYOS, []);
    if (!ensayo.id) ensayo.id = Date.now().toString(36);
    const i = lista.findIndex((x) => x.id === ensayo.id);
    if (i >= 0) lista[i] = ensayo; else lista.push(ensayo);
    escribir(CLAVE_ENSAYOS, lista);
    guardarActual();
    toast("Ensayo guardado");
    dibujarLista();
  };
  $("#btn-nuevo").onclick = () => {
    if (Motor.hayDatos(ensayo.valores) && !ensayo.id && !confirm("El ensayo actual no está guardado. ¿Empezar uno nuevo igual?")) return;
    ensayo = ensayoNuevo(); seleccion = 0; guardarActual(); dibujar();
  };
  $("#btn-ejemplo").onclick = () => {
    const e = EJEMPLOS[0];
    ensayo = Object.assign(ensayoNuevo(), {
      nombre: e.nombre, maquina: e.maquina, fertilizante: e.fertilizante, dCentros: e.dCentros,
      bocaAncho: e.bocaAncho, bocaLargo: e.bocaLargo, nCajas: e.valores.length, valores: e.valores.slice(),
    });
    guardarActual(); toast("Ejemplo cargado (datos inventados)"); dibujar();
  };

  // ---------- CSV (separador ; y coma decimal, para Excel en castellano) ----------
  const CAMPOS_CSV = ["nombre", "fecha", "maquina", "fertilizante", "dCentros", "bocaAncho", "bocaLargo", "umbral"];
  const num = (v) => (v === null || v === undefined ? "" : String(+v.toFixed(6)).replace(".", ","));

  $("#btn-exportar").onclick = () => {
    const lineas = CAMPOS_CSV.map((c) => `# ${c};${typeof ensayo[c] === "number" ? num(ensayo[c]) : (ensayo[c] ?? "")}`);
    lineas.push("caja;posicion_m;peso_g");
    const pos = Motor.posiciones(ensayo.nCajas, ensayo.dCentros);
    ensayo.valores.forEach((v, i) => lineas.push(`${i + 1};${num(pos[i])};${num(v)}`));
    const blob = new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ferticalc_${(ensayo.nombre || "ensayo").replace(/[^\w\-]+/g, "_")}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#btn-importar").onclick = () => $("#archivo-csv").click();
  $("#archivo-csv").onchange = async (ev) => {
    const f = ev.target.files[0]; ev.target.value = "";
    if (!f) return;
    try {
      const nuevo = importarCSV(await f.text());
      ensayo = nuevo; seleccion = 0; guardarActual(); dibujar();
      toast(`Importadas ${nuevo.nCajas} cajas`);
    } catch (e) { alert("No se pudo leer el archivo: " + e.message); }
  };

  // Acepta el formato exportado o simplemente una columna de pesos (una caja
  // por renglón), con ; , o tabulación como separador.
  function importarCSV(texto) {
    const e = ensayoNuevo();
    const valores = [];
    for (let linea of texto.replace(/^﻿/, "").split(/\r?\n/)) {
      linea = linea.trim();
      if (!linea) continue;
      if (linea.startsWith("#")) {
        const [clave, ...resto] = linea.slice(1).split(";");
        const c = clave.trim(), v = resto.join(";").trim();
        if (CAMPOS_CSV.includes(c)) {
          if (["dCentros", "bocaAncho", "bocaLargo", "umbral"].includes(c)) { const r = Motor.leerNumero(v); if (r.ok) e[c] = r.valor; }
          else e[c] = v;
        }
        continue;
      }
      const celdas = linea.split(/[;\t]/);
      const ultimo = celdas[celdas.length - 1];
      const r = Motor.leerNumero(ultimo);
      // Renglones no numéricos antes de los datos (encabezados) se saltean.
      if (!r.ok) { if (valores.length === 0) continue; throw new Error(`valor no válido: "${ultimo}"`); }
      valores.push(r.valor);
    }
    if (valores.length < 3) throw new Error("hacen falta al menos 3 cajas");
    e.valores = valores; e.nCajas = valores.length;
    e.ancho = Math.round(valores.length * e.dCentros / 2);
    return e;
  }

  // ============ CAJAS ============
  function dibujarCajas() {
    const grilla = $("#grilla-cajas");
    const pos = Motor.posiciones(ensayo.nCajas, ensayo.dCentros);
    if (grilla.children.length !== ensayo.nCajas || grilla.dataset.d !== String(ensayo.dCentros)) {
      grilla.innerHTML = "";
      grilla.dataset.d = ensayo.dCentros;
      for (let i = 0; i < ensayo.nCajas; i++) {
        const div = document.createElement("div");
        div.className = "caja-in";
        div.innerHTML = `<label>Caja ${i + 1} <small>(${fmt(pos[i], 2)} m)</small></label>
          <input type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off"><div class="error-txt"></div>`;
        const inp = div.querySelector("input");
        inp.addEventListener("focus", () => { seleccion = i; inp.select(); actualizarPerfil(); });
        inp.addEventListener("input", () => {
          const r = Motor.leerNumero(inp.value);
          inp.classList.toggle("invalido", !r.ok);
          div.querySelector(".error-txt").textContent = r.ok ? "" : r.error;
          if (!r.ok) return;
          ensayo.valores[i] = r.valor;
          guardarActual();
          actualizarPerfil();
        });
        inp.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            const sig = grilla.children[i + 1];
            if (sig) sig.querySelector("input").focus(); else inp.blur();
          }
        });
        grilla.appendChild(div);
      }
    }
    Array.from(grilla.children).forEach((div, i) => {
      const inp = div.querySelector("input");
      if (document.activeElement !== inp) {
        inp.value = mostrarValor(ensayo.valores[i]);
        inp.classList.remove("invalido");
        div.querySelector(".error-txt").textContent = "";
      }
    });
    actualizarPerfil();
  }

  function actualizarPerfil() {
    const r = datosParaCalculo();
    const grilla = $("#grilla-cajas");
    Array.from(grilla.children).forEach((div, i) => {
      div.classList.toggle("interpolada", r.interpoladas[i]);
      div.classList.toggle("seleccionada", i === seleccion);
      const inp = div.querySelector("input");
      inp.placeholder = r.interpoladas[i] ? fmt(r.valores[i], 2) : "";
    });
    Graficos.perfil($("#g-perfil"), {
      valores: r.valores, interpoladas: r.interpoladas, d: ensayo.dCentros, seleccion, etqY: "g",
      onClick: (i) => { const inp = grilla.children[i]?.querySelector("input"); if (inp) { inp.focus(); inp.scrollIntoView({ block: "center", behavior: "smooth" }); } },
    });
    const vacio = !Motor.hayDatos(ensayo.valores);
    aviso("#aviso-cajas", vacio ? "" : (r.ok ? "" : r.mensaje), "error");
  }

  $("#btn-borrar-valores").onclick = () => {
    if (!confirm("¿Borrar todos los pesos cargados?")) return;
    ensayo.valores = new Array(ensayo.nCajas).fill(null);
    guardarActual(); dibujarCajas();
  };

  // ============ PASADAS ============
  const rango = $("#ancho-rango");
  rango.addEventListener("input", () => { ensayo.ancho = acotarAncho(+rango.value); guardarActual(); dibujarPasadas(); });
  $("#ancho-menos").onclick = () => { ensayo.ancho = acotarAncho(ensayo.ancho - 0.1); guardarActual(); dibujarPasadas(); };
  $("#ancho-mas").onclick = () => { ensayo.ancho = acotarAncho(ensayo.ancho + 0.1); guardarActual(); dibujarPasadas(); };
  $$("#modo-pasadas button").forEach((b) => b.addEventListener("click", () => {
    ensayo.modo = b.dataset.modo; guardarActual(); dibujarPasadas();
  }));

  function dibujarPasadas() {
    $$("#modo-pasadas button").forEach((b) => b.classList.toggle("activa", b.dataset.modo === ensayo.modo));
    ensayo.ancho = acotarAncho(ensayo.ancho);
    rango.min = anchoMin(); rango.max = anchoMax(); rango.step = 0.1; rango.value = ensayo.ancho;
    $("#ancho-valor").textContent = `Ancho de trabajo: ${fmt(ensayo.ancho, 1)} m`;
    const r = datosParaCalculo();
    const svg = $("#g-pasadas");
    if (!r.ok) {
      aviso("#aviso-pasadas", r.mensaje, "error"); svg.innerHTML = "";
      $("#res-cv .val").textContent = "—"; $("#res-dosis .val").textContent = "—"; $("#res-mitades").textContent = "";
      return;
    }
    aviso("#aviso-pasadas", "");
    const alt = ensayo.modo === "alternado";
    const s = Motor.superponer(r.valores, ensayo.dCentros, ensayo.ancho, alt);
    const g = Motor.graficoPasadas(r.valores, ensayo.dCentros, ensayo.ancho, alt);
    const paso = s.xs.length > 1 ? s.xs[1] - s.xs[0] : ensayo.ancho;
    Graficos.pasadas(svg, { ...g, d: ensayo.dCentros, w: ensayo.ancho, media: s.media, etqY: "g/caja",
      ciclo: [s.xs[0] - paso / 2, s.xs[s.xs.length - 1] + paso / 2] });

    const cajaCV = $("#res-cv");
    cajaCV.querySelector(".val").innerHTML = `${fmt(s.cv, 1)} <small>%</small>`;
    cajaCV.classList.toggle("mal", s.cv > ensayo.umbral);
    cajaCV.classList.toggle("bien", s.cv <= ensayo.umbral);
    const kh = kgHa(s.media);
    $("#res-dosis .val").innerHTML = kh !== null ? `${fmt(kh, 0)} <small>kg/ha</small>` : `${fmt(s.media, 2)} <small>g/caja</small>`;
    $("#res-mitades").innerHTML = alt
      ? `Mitades del ciclo (criterio por mitades): izquierda CV ${fmt(s.mitades[0].cv, 1)} %, derecha CV ${fmt(s.mitades[1].cv, 1)} %. El valor principal es el del ciclo completo.`
      : (kh === null ? "Para ver la dosis en kg/ha cargá la medida de la boca de caja en Ensayo." : "");
  }

  // ============ CURVA DE CV ============
  $("#ver-mitades").addEventListener("change", (e) => { verMitades = e.target.checked; dibujarCV(); });
  $("#btn-ir-pasadas").onclick = () => irA("pasadas");

  function dibujarCV() {
    $("#ver-mitades").checked = verMitades;
    const r = datosParaCalculo();
    if (!r.ok) { aviso("#aviso-cv", r.mensaje, "error"); $("#g-cv").innerHTML = ""; $("#resumen-cv").innerHTML = ""; $("#tabla-cv").innerHTML = ""; return; }
    aviso("#aviso-cv", "");
    const paso = ensayo.wPaso > 0 ? ensayo.wPaso : 0.5;
    const desde = anchoMin(), hasta = anchoMax();
    const cont = Motor.curvaCV(r.valores, ensayo.dCentros, desde, hasta, paso, false);
    const alt = Motor.curvaCV(r.valores, ensayo.dCentros, desde, hasta, paso, true);
    const series = [
      { nombre: "Continuo", color: "#6a1b9a", puntos: cont },
      { nombre: "Alternado", color: "#ef6c00", puntos: alt },
    ];
    if (verMitades) {
      series.push({ nombre: "Alt. mitad izq.", color: "#ef6c00", trazo: 1.2, guiones: "4 3", puntos: alt.map((p) => ({ w: p.w, cv: p.cvIzq })) });
      series.push({ nombre: "Alt. mitad der.", color: "#bf360c", trazo: 1.2, guiones: "1 3", puntos: alt.map((p) => ({ w: p.w, cv: p.cvDer })) });
    }
    Graficos.curvaCV($("#g-cv"), {
      series, umbral: ensayo.umbral, wActual: ensayo.ancho,
      onClick: (w) => { ensayo.ancho = acotarAncho(w); guardarActual(); dibujarCV(); },
    });
    $("#leyenda-cv").innerHTML = series.map((s) =>
      `<span><i style="background:${s.color};height:${s.trazo ? 2 : 4}px"></i>${s.nombre}</span>`).join("")
      + `<span><i style="background:var(--ok);height:2px"></i>CV aceptable (${fmt(ensayo.umbral, 1)} %)</span>`;

    const rangos = (curva) => {
      const rs = Motor.rangosAceptables(curva, ensayo.umbral);
      if (!rs.length) return "ninguno";
      return rs.map((x) => (x.desde === curva[0].w ? `hasta ${fmt(x.hasta, 1)} m` : `${fmt(x.desde, 1)} a ${fmt(x.hasta, 1)} m`)).join("<br>");
    };
    const sc = Motor.superponer(r.valores, ensayo.dCentros, ensayo.ancho, false);
    const sa = Motor.superponer(r.valores, ensayo.dCentros, ensayo.ancho, true);
    $("#resumen-cv").innerHTML = `
      <table class="tabla">
        <tr><th></th><th>Continuo</th><th>Alternado</th></tr>
        <tr><td>Anchos con CV ≤ ${fmt(ensayo.umbral, 1)} %</td><td>${rangos(cont)}</td><td>${rangos(alt)}</td></tr>
        <tr><td>CV con ${fmt(ensayo.ancho, 1)} m</td><td>${fmt(sc.cv, 1)} %</td><td>${fmt(sa.cv, 1)} %</td></tr>
      </table>`;
    const filas = cont.map((c, i) => {
      const a = alt[i];
      const cls = c.cv <= ensayo.umbral || a.cv <= ensayo.umbral ? "ok" : "";
      return `<tr class="${cls}"><td>${fmt(c.w, 2)}</td><td>${fmt(c.cv, 1)}</td><td>${fmt(a.cv, 1)}</td>
        <td>${fmt(a.cvIzq, 1)}</td><td>${fmt(a.cvDer, 1)}</td></tr>`;
    }).join("");
    $("#tabla-cv").innerHTML = `<table class="tabla"><tr><th>Ancho (m)</th><th>CV cont.</th><th>CV alt.</th><th>alt. izq.</th><th>alt. der.</th></tr>${filas}</table>`;
  }

  // ============ DOSIS ============
  $$("#p-dosis [data-cal]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const r = Motor.leerNumero(inp.value);
      inp.classList.toggle("invalido", !r.ok);
      if (!r.ok) return;
      cal[inp.dataset.cal] = r.valor;
      // Si se cargó lo recogido en un tiempo, calcula el caudal.
      if ((inp.dataset.cal === "kgRecogidos" || inp.dataset.cal === "segundos") && cal.kgRecogidos > 0 && cal.segundos > 0) {
        cal.kgMin = +(cal.kgRecogidos / cal.segundos * 60).toFixed(3);
        const k = $('#p-dosis [data-cal="kgMin"]'); k.value = mostrarValor(cal.kgMin); k.classList.remove("invalido");
      }
      escribir(CLAVE_CAL, cal);
      calcularDosis();
    });
  });

  function calcularDosis() {
    const ancho = cal.ancho > 0 ? cal.ancho : ensayo.ancho;
    const d = Motor.kgHaDesdeCaudal(cal.kgMin, cal.vel, ancho);
    $("#cal-dosis").innerHTML = cal.kgMin > 0 && cal.vel > 0 && ancho > 0 ? `${fmt(d, 0)} <small>kg/ha</small>` : "—";
    const q = Motor.caudalParaDosis(cal.objetivo, cal.vel, ancho);
    $("#cal-caudal").innerHTML = cal.objetivo > 0 && cal.vel > 0 && ancho > 0 ? `${fmt(q, 2)} <small>kg/min</small>` : "—";
  }

  function dibujarDosis() {
    $$("#p-dosis [data-cal]").forEach((inp) => {
      if (document.activeElement === inp) return;
      inp.value = mostrarValor(cal[inp.dataset.cal]);
    });
    const anchoInp = $('#p-dosis [data-cal="ancho"]');
    anchoInp.placeholder = `${fmt(ensayo.ancho, 1)} (del ensayo)`;
    calcularDosis();

    const r = datosParaCalculo();
    const cont = $("#dosis-ensayo");
    if (!r.ok) { cont.innerHTML = `<div class="aviso error">${r.mensaje}</div>`; return; }
    const alt = ensayo.modo === "alternado";
    const s = Motor.superponer(r.valores, ensayo.dCentros, ensayo.ancho, alt);
    const kh = kgHa(s.media);
    cont.innerHTML = kh === null
      ? `<p>Con ${fmt(ensayo.ancho, 1)} m de ancho (${ensayo.modo}): <b>${fmt(s.media, 2)} g por caja</b> en promedio.</p>
         <div class="aviso">Cargá la medida de la boca de caja en la pantalla Ensayo para pasarlo a kg/ha.</div>`
      : `<div class="resultados"><div class="dato"><div class="etq">Con ${fmt(ensayo.ancho, 1)} m (${ensayo.modo})</div>
           <div class="val">${fmt(kh, 0)} <small>kg/ha</small></div></div></div>
         <p class="ayuda">Promedio de ${fmt(s.media, 2)} g por caja en una boca de ${fmt(ensayo.bocaAncho, 1)} × ${fmt(ensayo.bocaLargo, 1)} cm. Vale para la velocidad y apertura con que se hizo el ensayo.</p>`;
  }

  // ---------- Inicio ----------
  window.addEventListener("resize", () => { clearTimeout(dibujar.h); dibujar.h = setTimeout(dibujar, 150); });
  irA(Motor.hayDatos(ensayo.valores) ? "pasadas" : "ensayo");

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
