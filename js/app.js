// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Pantallas del módulo Distribución. Los cálculos están en motor.js y los dibujos en
// graficos.js; acá solo se conectan los datos con la interfaz.

(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const fmt = Graficos.fmt;
  // Dentro de la app de Android hay un "puente" (AndroidApp) para imprimir a
  // PDF y guardar archivos, que en un WebView no funcionan solos.
  const Nativo = window.AndroidApp || null;

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
  // Ancho de trabajo inicial: la mitad del ancho que cubren las cajas.
  function anchoInicial(e) { return Math.max(Math.round((e.nCajas * e.dCentros) / 2 * 10) / 10, e.dCentros); }

  function ensayoNuevo() {
    const e = {
      id: null, nombre: "", fecha: new Date().toISOString().slice(0, 10),
      maquina: "", fertilizante: "",
      nCajas: 15, dCentros: 2, bocaAncho: null, bocaLargo: null,
      modo: "continuo",
      valores: new Array(15).fill(null),
    };
    e.ancho = anchoInicial(e);
    return e;
  }
  let ensayo = Object.assign(ensayoNuevo(), leer(CLAVE_ACTUAL, {}));
  let pantalla = "ensayo";
  let seleccion = 0;
  let verMitades = false;
  let barraMarcada = null;
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

  // Escala de CV: verde hasta "bueno", amarillo hasta "aceptable", rojo arriba.
  function limitesCV() {
    return [15, 25]; // valores fijos (el usuario sacó el apartado Evaluación)
  }
  function claseCV(cv) {
    const [bueno, aceptable] = limitesCV();
    return cv <= bueno ? "bien" : cv <= aceptable ? "medio" : "mal";
  }

  // Si una caja del extremo todavía recoge bastante, la fila de cajas no llegó
  // hasta donde la máquina deja de tirar: falta parte de las colas del perfil.
  function avisoPerfilCortado(r) {
    if (!r.ok) return "";
    const v = r.valores, max = Math.max(...v);
    const partes = [];
    if (v[0] / max > 0.1) partes.push(`la caja 1 (extremo izquierdo) recoge el ${fmt(v[0] / max * 100, 0)} %`);
    if (v[v.length - 1] / max > 0.1) partes.push(`la caja ${v.length} (extremo derecho) recoge el ${fmt(v[v.length - 1] / max * 100, 0)} %`);
    if (!partes.length) return "";
    return `Perfil posiblemente cortado: ${partes.join(" y ")} de la caja más cargada. Conviene agregar cajas en ese extremo; si no, el CV de los anchos grandes puede salir mejor de lo real.`;
  }

  function aviso(contenedor, mensaje, tipo = "") {
    $(contenedor).innerHTML = mensaje ? `<div class="aviso ${tipo}">${mensaje}</div>` : "";
  }

  function kgHa(gramos) {
    if (!(ensayo.bocaAncho > 0 && ensayo.bocaLargo > 0)) return null;
    return Motor.gramosAKgHa(gramos, ensayo.bocaAncho, ensayo.bocaLargo);
  }

  // ---------- Navegación ----------
  const VERSION = "3.4.0";
  let pantallaAnterior = "ensayo";
  $("#version-app").textContent = VERSION;
  $$("[data-acerca]").forEach((b) => { b.onclick = () => { if (pantalla !== "acerca" && pantalla !== "ayuda") pantallaAnterior = pantalla; irA("acerca"); }; });
  $$("[data-ayuda]").forEach((b) => { b.onclick = () => { if (pantalla !== "acerca" && pantalla !== "ayuda") pantallaAnterior = pantalla; irA("ayuda"); }; });
  $("#btn-volver-ayuda").onclick = () => irA(pantallaAnterior);
  $("#btn-volver").onclick = () => irA(pantallaAnterior);

  // Cada módulo tiene su barra de pestañas; la pantalla elegida define cuál se ve.
  // Los otros módulos registran sus pantallas con App.registrar().
  const otrasPantallas = {};
  const ultimaDeModulo = { distribucion: "ensayo", recomendacion: "lote" };
  function moduloDe(p) {
    const nav = document.querySelector(`nav.pestanas button[data-p="${p}"]`);
    return nav ? nav.closest("nav").dataset.modulo : null;
  }
  function irA(p) {
    pantalla = p;
    const modulo = moduloDe(p);
    if (modulo) { ultimaDeModulo[modulo] = p; escribir("ferticalc.modulo", modulo); }
    $$("section.pantalla").forEach((s) => s.classList.toggle("activa", s.id === "p-" + p));
    $$("nav.pestanas").forEach((n) => { if (modulo) n.hidden = n.dataset.modulo !== modulo; });
    $$("nav.pestanas button").forEach((b) => b.classList.toggle("activa", b.dataset.p === p));
    $$("[data-ir-modulo]").forEach((b) => b.classList.toggle("activa", b.dataset.irModulo === modulo));
    window.scrollTo(0, 0);
    medirNav();
    dibujar();
  }
  $$("nav.pestanas button[data-p]").forEach((b) => b.addEventListener("click", () => irA(b.dataset.p)));

  // Deslizar el dedo de costado pasa a la pantalla vecina del mismo módulo.
  // No actúa donde ya hay algo que se desliza de costado (fila de cajas,
  // deslizador del ancho, tablas, informe).
  let toque = null;
  const zonasPropias = ".tira-cajas, input, select, textarea, .control-ancho, .tabla-desliza, .informe, details";
  document.querySelector("main").addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1 || e.target.closest(zonasPropias)) { toque = null; return; }
    toque = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  }, { passive: true });
  document.querySelector("main").addEventListener("touchend", (e) => {
    if (!toque) return;
    const dx = e.changedTouches[0].clientX - toque.x, dy = e.changedTouches[0].clientY - toque.y;
    const rapido = Date.now() - toque.t < 700;
    toque = null;
    if (!rapido || Math.abs(dx) < 70 || Math.abs(dx) < 2 * Math.abs(dy)) return;
    const modulo = moduloDe(pantalla);
    if (!modulo) return;
    const orden = $$(`nav.pestanas[data-modulo="${modulo}"] button[data-p]`).map((b) => b.dataset.p);
    const i = orden.indexOf(pantalla) + (dx < 0 ? 1 : -1);
    if (i >= 0 && i < orden.length) irA(orden[i]);
  }, { passive: true });
  $$("[data-ir-modulo]").forEach((b) => b.addEventListener("click", () => irA(ultimaDeModulo[b.dataset.irModulo])));

  function dibujar() {
    if (otrasPantallas[pantalla]) otrasPantallas[pantalla]();
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
      if (!inp.dataset.tipo) { ensayo[campo] = inp.value; guardarActual(); return; }
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
      // Si cambia lo que cubren las cajas, el ancho vuelve a la mitad de esa extensión.
      ensayo.ancho = campo === "nCajas" || campo === "dCentros" ? anchoInicial(ensayo) : acotarAncho(ensayo.ancho);
      guardarActual();
    });
  });

  function dibujarLista() {
    const lista = leer(CLAVE_ENSAYOS, []);
    const ul = $("#lista-ensayos");
    if (!lista.length) { ul.innerHTML = `<li><small>Todavía no guardaste ningún ensayo.</small></li>`; return; }
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
    ensayo.ancho = anchoInicial(ensayo);
    guardarActual(); toast("Ejemplo cargado (datos inventados)"); dibujar();
  };

  // ---------- CSV (separador ; y coma decimal, para Excel en castellano) ----------
  const CAMPOS_CSV = ["nombre", "fecha", "maquina", "fertilizante", "dCentros", "bocaAncho", "bocaLargo"];
  const num = (v) => (v === null || v === undefined ? "" : String(+v.toFixed(6)).replace(".", ","));

  $("#btn-exportar").onclick = () => {
    const lineas = CAMPOS_CSV.map((c) => `# ${c};${typeof ensayo[c] === "number" ? num(ensayo[c]) : (ensayo[c] ?? "")}`);
    lineas.push("caja;posicion_m;peso_g");
    const pos = Motor.posiciones(ensayo.nCajas, ensayo.dCentros);
    ensayo.valores.forEach((v, i) => lineas.push(`${i + 1};${num(pos[i])};${num(v)}`));
    const nombre = `ferticalc_${(ensayo.nombre || "ensayo").replace(/[^\w\-]+/g, "_")}.csv`;
    const texto = "\ufeff" + lineas.join("\r\n");
    if (Nativo) { Nativo.guardarArchivo(nombre, texto, "text/csv"); return; }
    const blob = new Blob([texto], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
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
          if (["dCentros", "bocaAncho", "bocaLargo"].includes(c)) { const r = Motor.leerNumero(v); if (r.ok) e[c] = r.valor; }
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
    e.ancho = anchoInicial(e);
    return e;
  }

  // ============ CAJAS ============
  // Las cajas se muestran en una tira horizontal, en el mismo orden que en el
  // campo: cada columna tiene su barra arriba y la casilla de peso abajo.
  const tira = $("#tira-cajas");
  const erroresCajas = {};

  function dibujarCajas() {
    const pos = Motor.posiciones(ensayo.nCajas, ensayo.dCentros);
    if (tira.children.length !== ensayo.nCajas || tira.dataset.d !== String(ensayo.dCentros)) {
      tira.innerHTML = "";
      tira.dataset.d = ensayo.dCentros;
      for (let i = 0; i < ensayo.nCajas; i++) {
        const col = document.createElement("div");
        col.className = "col-caja";
        col.innerHTML = `<div class="barra-cont"><div class="barra"></div></div>
          <div class="num">${i + 1}</div><div class="pos">${fmt(pos[i], 2)} m</div>
          <input type="text" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="Peso caja ${i + 1}">`;
        const inp = col.querySelector("input");
        inp.addEventListener("focus", () => { seleccion = i; inp.select(); actualizarPerfil(); });
        inp.addEventListener("input", () => {
          const r = Motor.leerNumero(inp.value);
          inp.classList.toggle("invalido", !r.ok);
          if (r.ok) delete erroresCajas[i]; else erroresCajas[i] = r.error;
          if (r.ok) { ensayo.valores[i] = r.valor; guardarActual(); }
          actualizarPerfil();
        });
        inp.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            const sig = tira.children[i + 1];
            if (sig) sig.querySelector("input").focus(); else inp.blur();
          }
        });
        // Tocar la barra también elige la caja.
        col.querySelector(".barra-cont").addEventListener("click", () => inp.focus());
        tira.appendChild(col);
      }
      // Arranca mostrando el centro de la fila.
      requestAnimationFrame(() => { tira.scrollLeft = (tira.scrollWidth - tira.clientWidth) / 2; });
    }
    Array.from(tira.children).forEach((col, i) => {
      const inp = col.querySelector("input");
      if (document.activeElement !== inp) {
        inp.value = mostrarValor(ensayo.valores[i]);
        inp.classList.remove("invalido");
        delete erroresCajas[i];
      }
    });
    actualizarPerfil();
  }

  function actualizarPerfil() {
    const r = datosParaCalculo();
    const max = Math.max(...r.valores.map((v) => v ?? 0), 0.001);
    Array.from(tira.children).forEach((col, i) => {
      const v = r.valores[i];
      col.classList.toggle("interpolada", r.interpoladas[i]);
      col.classList.toggle("sin-dato", v === null || v === undefined);
      col.classList.toggle("seleccionada", i === seleccion);
      col.querySelector(".barra").style.height = v > 0 ? (v / max) * 100 + "%" : "0";
      col.querySelector("input").placeholder = r.interpoladas[i] ? fmt(v, 2) : "";
    });
    const errores = Object.entries(erroresCajas).map(([i, e]) => `Caja ${+i + 1}: ${e}`);
    const vacio = !Motor.hayDatos(ensayo.valores);
    if (errores.length) aviso("#aviso-cajas", errores.join("<br>"), "error");
    else if (!vacio && !r.ok) aviso("#aviso-cajas", r.mensaje, "error");
    else aviso("#aviso-cajas", avisoPerfilCortado(r));
  }


  $("#btn-borrar-valores").onclick = () => {
    if (!confirm("¿Borrar todos los pesos cargados?")) return;
    ensayo.valores = new Array(ensayo.nCajas).fill(null);
    guardarActual(); dibujarCajas();
  };

  // ============ PASADAS ============
  const rango = $("#ancho-rango");
  rango.addEventListener("input", () => { barraMarcada = null; ensayo.ancho = acotarAncho(+rango.value); guardarActual(); dibujarPasadas(); });
  $("#ancho-menos").onclick = () => { barraMarcada = null; ensayo.ancho = acotarAncho(ensayo.ancho - 0.1); guardarActual(); dibujarPasadas(); };
  $("#ancho-mas").onclick = () => { barraMarcada = null; ensayo.ancho = acotarAncho(ensayo.ancho + 0.1); guardarActual(); dibujarPasadas(); };
  $$("#modo-pasadas button").forEach((b) => b.addEventListener("click", () => {
    ensayo.modo = b.dataset.modo; barraMarcada = null; guardarActual(); dibujarPasadas();
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
      $("#res-cv .val").textContent = "—"; $("#res-dosis .val").textContent = "—";
      $("#res-mitades").textContent = ""; $("#res-detalle").textContent = "";
      return;
    }
    aviso("#aviso-pasadas", avisoPerfilCortado(r));
    const alt = ensayo.modo === "alternado";
    const s = Motor.superponer(r.valores, ensayo.dCentros, ensayo.ancho, alt);
    const g = Motor.graficoPasadas(r.valores, ensayo.dCentros, ensayo.ancho, alt);
    const paso = s.xs.length > 1 ? s.xs[1] - s.xs[0] : ensayo.ancho;
    Graficos.pasadas(svg, { ...g, d: ensayo.dCentros, w: ensayo.ancho, media: s.media, etqY: "g",
      alto: Math.max($("#cont-pasadas").clientHeight, 120),
      ciclo: [s.xs[0] - paso / 2, s.xs[s.xs.length - 1] + paso / 2],
      marcada: barraMarcada, onClick: (i) => { barraMarcada = i; dibujarPasadas(); } });
    $("#res-detalle").innerHTML = barraMarcada != null && g.barras[barraMarcada]
      ? detalleBarra(g.barras[barraMarcada])
      : "Tocá una barra del gráfico para ver de dónde sale su valor.";

    const cajaCV = $("#res-cv");
    cajaCV.querySelector(".val").innerHTML = `${fmt(s.cv, 1)} <small>%</small>`;
    cajaCV.classList.remove("bien", "medio", "mal");
    cajaCV.classList.add(claseCV(s.cv));
    const kh = kgHa(s.media);
    $("#res-dosis .val").innerHTML = kh !== null ? `${fmt(kh, 0)} <small>kg/ha</small>` : `${fmt(s.media, 2)} <small>g/caja</small>`;
    $("#res-mitades").innerHTML = alt
      ? `Mitades del ciclo (criterio por mitades): izquierda CV ${fmt(s.mitades[0].cv, 1)} %, derecha CV ${fmt(s.mitades[1].cv, 1)} %. El valor principal es el del ciclo completo.`
      : (kh === null ? "Para ver la dosis en kg/ha cargá la medida de la boca de caja en Ensayo." : "");
  }

  // Desglose de una barra: aporte de cada pasada al total.
  function detalleBarra(b) {
    const partes = [];
    if (b.cen > 1e-9) partes.push(`<span style="color:var(--p-cen)">■</span> central ${fmt(b.cen, 2)}`);
    if (b.izq > 1e-9) partes.push(`<span style="color:var(--p-izq)">■</span> izquierda ${fmt(b.izq, 2)}`);
    if (b.der > 1e-9) partes.push(`<span style="color:var(--p-der)">■</span> derecha ${fmt(b.der, 2)}`);
    const otras = b.total - b.cen - b.izq - b.der;
    if (otras > 1e-9) partes.push(`<span style="color:var(--p-suma)">■</span> pasadas más lejanas ${fmt(otras, 2)}`);
    return `En ${fmt(b.x, 2)} m: ${partes.join(" + ") || "0"} = <b>${fmt(b.total, 2)} g</b>`;
  }

  // ============ CURVA DE CV ============
  $("#ver-mitades").addEventListener("change", (e) => { verMitades = e.target.checked; dibujarCV(); });
  $("#btn-ir-pasadas").onclick = () => irA("pasadas");

  function dibujarCV() {
    $("#ver-mitades").checked = verMitades;
    const r = datosParaCalculo();
    if (!r.ok) { aviso("#aviso-cv", r.mensaje, "error"); $("#g-cv").innerHTML = ""; $("#resumen-cv").innerHTML = ""; $("#tabla-cv").innerHTML = ""; return; }
    aviso("#aviso-cv", avisoPerfilCortado(r));
    const [bueno, aceptable] = limitesCV();
    const paso = 1; // m
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
      series, limites: [bueno, aceptable], wActual: ensayo.ancho,
      onClick: (w) => { ensayo.ancho = acotarAncho(w); guardarActual(); dibujarCV(); },
    });
    $("#leyenda-cv").innerHTML = series.map((s) =>
      `<span><i style="background:${s.color};height:${s.trazo ? 2 : 4}px"></i>${s.nombre}</span>`).join("")
      + `<span><i style="background:var(--cv-bueno);opacity:.35"></i>hasta ${fmt(bueno, 0)} %</span>`
      + `<span><i style="background:var(--cv-medio);opacity:.35"></i>${fmt(bueno, 0)}–${fmt(aceptable, 0)} %</span>`
      + `<span><i style="background:var(--cv-malo);opacity:.35"></i>más de ${fmt(aceptable, 0)} %</span>`;

    const rangos = (curva, limite) => {
      const rs = Motor.rangosAceptables(curva, limite);
      if (!rs.length) return "ninguno";
      return rs.map((x) => (x.desde === curva[0].w ? `hasta ${fmt(x.hasta, 1)} m` : `${fmt(x.desde, 1)} a ${fmt(x.hasta, 1)} m`)).join("<br>");
    };
    const sc = Motor.superponer(r.valores, ensayo.dCentros, ensayo.ancho, false);
    const sa = Motor.superponer(r.valores, ensayo.dCentros, ensayo.ancho, true);
    $("#resumen-cv").innerHTML = `
      <table class="tabla">
        <tr><th></th><th>Continuo</th><th>Alternado</th></tr>
        <tr><td><span class="cv-bueno">Anchos con CV ≤ ${fmt(bueno, 0)} %</span></td><td>${rangos(cont, bueno)}</td><td>${rangos(alt, bueno)}</td></tr>
        <tr><td><span class="cv-medio">Anchos con CV ≤ ${fmt(aceptable, 0)} %</span></td><td>${rangos(cont, aceptable)}</td><td>${rangos(alt, aceptable)}</td></tr>
        <tr><td>CV con ${fmt(ensayo.ancho, 1)} m</td><td class="cv-${{bien: "bueno", medio: "medio", mal: "malo"}[claseCV(sc.cv)]}">${fmt(sc.cv, 1)} %</td>
          <td class="cv-${{bien: "bueno", medio: "medio", mal: "malo"}[claseCV(sa.cv)]}">${fmt(sa.cv, 1)} %</td></tr>
      </table>`;
    const filas = cont.map((c, i) => {
      const a = alt[i];
      const k = (cv) => `cv-${{bien: "bueno", medio: "medio", mal: "malo"}[claseCV(cv)]}`;
      return `<tr><td>${fmt(c.w, 2)}</td><td class="${k(c.cv)}">${fmt(c.cv, 1)}</td><td class="${k(a.cv)}">${fmt(a.cv, 1)}</td>
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

  // ---------- Instalación ----------
  // Chrome avisa con "beforeinstallprompt" cuando se puede instalar; en ese
  // caso el botón abre el diálogo del sistema. Si no, se explica cómo hacerlo
  // según el navegador.
  let pedidoInstalar = null;
  const instalada = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  function mostrarTarjetaInstalar() {
    $("#tarjeta-instalar").hidden = instalada() || leer("ferticalc.instalarNo", false);
  }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pedidoInstalar = e; mostrarTarjetaInstalar(); });
  window.addEventListener("appinstalled", () => { $("#tarjeta-instalar").hidden = true; toast("App instalada"); });
  $("#btn-instalar-no").onclick = () => { escribir("ferticalc.instalarNo", true); $("#tarjeta-instalar").hidden = true; };
  $("#btn-instalar").onclick = async () => {
    if (pedidoInstalar) {
      pedidoInstalar.prompt();
      await pedidoInstalar.userChoice.catch(() => {});
      pedidoInstalar = null;
      return;
    }
    const ua = navigator.userAgent;
    let ayuda;
    if (/iPhone|iPad|iPod/.test(ua)) {
      ayuda = "En iPhone: abrila en <b>Safari</b>, tocá el botón <b>Compartir</b> (cuadrado con flecha) y elegí <b>Agregar a inicio</b>.";
    } else if (/; wv\)|FBAN|FBAV|Instagram|Line\//.test(ua)) {
      ayuda = "Estás viendo la página dentro de otra aplicación, y ahí no se puede instalar. Tocá el menú <b>⋮</b> y elegí <b>Abrir en Chrome</b> (o copiá la dirección y pegala en Chrome).";
    } else if (/SamsungBrowser/.test(ua)) {
      ayuda = "En Samsung Internet: tocá el menú <b>≡</b> (abajo), luego <b>Agregar página a</b> → <b>Pantalla de inicio</b>.";
    } else if (/Firefox/.test(ua)) {
      ayuda = "En Firefox: tocá el menú <b>⋮</b> y elegí <b>Instalar</b>.";
    } else if (/Android/.test(ua)) {
      ayuda = "En Chrome: tocá el menú <b>⋮</b> (arriba a la derecha) y elegí <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>. Si no aparece, recargá la página y esperá unos segundos.";
    } else {
      ayuda = "En la computadora: usá el ícono de instalar que aparece a la derecha de la barra de direcciones de Chrome o Edge.";
    }
    $("#instalar-ayuda").innerHTML = `<div class="aviso" style="margin-top:10px">${ayuda}</div>`;
  };
  if (Nativo) $("#tarjeta-instalar").remove(); else mostrarTarjetaInstalar();

  // ---------- Inicio ----------
  // El alto de la barra de pestañas define cuánto lugar queda para las
  // pantallas que ocupan toda la altura (Cajas y Pasadas).
  // Se usa el alto real de la ventana (más confiable que 100dvh en las apps
  // instaladas). Mientras el teclado está abierto no se recalcula, para que la
  // pantalla no se achique; al cerrarse, la vista vuelve arriba.
  const pantallasLlenas = ["cajas", "pasadas"];
  function medirNav() {
    const raiz = document.documentElement.style;
    const nav = $("nav.pestanas:not([hidden])");
    if (nav) raiz.setProperty("--alto-nav", nav.offsetHeight + "px");
    const escribiendo = document.activeElement && document.activeElement.tagName === "INPUT";
    if (!escribiendo) raiz.setProperty("--alto-vista", window.innerHeight + "px");
  }
  medirNav();
  window.addEventListener("resize", medirNav);
  document.addEventListener("focusout", () => setTimeout(() => {
    if (document.activeElement && document.activeElement.tagName === "INPUT") return; // pasó a otra casilla
    medirNav();
    if (pantallasLlenas.includes(pantalla)) window.scrollTo(0, 0);
  }, 300));
  window.addEventListener("resize", () => { clearTimeout(dibujar.h); dibujar.h = setTimeout(dibujar, 150); });

  // ============ INFORME (PDF) ============
  // El informe se arma como una pantalla más y se pasa a PDF con el diálogo
  // de impresión del sistema ("Guardar como PDF"). Los gráficos se dibujan con
  // un ancho fijo pensado para una hoja A4.
  const ANCHO_INFORME = 680;
  let informeTitulo = "", pantallaAntesInforme = "ensayo";
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const informe = {
    ANCHO: ANCHO_INFORME, esc,
    encabezado(titulo, subtitulo) {
      return `<header class="inf-cab"><div><h1>${titulo}</h1>${subtitulo ? `<p>${esc(subtitulo)}</p>` : ""}</div>
        <div class="inf-app">Calculadora de Fertilización<br><small>jmvgap.github.io/fertilizacion</small></div></header>`;
    },
    // filas: [[etiqueta, valor HTML], ...]; las filas sin valor no se muestran.
    datos(filas) {
      return `<table class="inf-datos">${filas.filter((f) => f && f[1] !== null && f[1] !== undefined && f[1] !== "")
        .map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join("")}</table>`;
    },
    pie() {
      return `<footer class="inf-pie">Generado el ${new Date().toLocaleDateString("es-AR")} con la Calculadora de Fertilización ${VERSION}
        · Ing. Agr. Juan Manuel Vázquez (Dto. de Tecnología, UNLu · FCAyF, UNLP) · Software libre, licencia GPL-3.</footer>`;
    },
  };
  function abrirInforme(titulo, construir) {
    informeTitulo = titulo.replace(/[\\/:*?"<>|]+/g, "-");
    if (pantalla !== "informe") pantallaAntesInforme = pantalla;
    irA("informe");
    construir($("#informe"));
  }
  $("#inf-volver").onclick = () => irA(pantallaAntesInforme);
  $("#inf-imprimir").onclick = () => {
    // El título de la página se usa como nombre sugerido del PDF.
    const anterior = document.title;
    document.title = informeTitulo;
    if (Nativo) Nativo.imprimir(informeTitulo); else window.print();
    setTimeout(() => { document.title = anterior; }, 1500);
  };

  const claseTextoCV = (cv) => ({ bien: "cv-bueno", medio: "cv-medio", mal: "cv-malo" }[claseCV(cv)]);

  function informeDistribucion(cont) {
    const r = datosParaCalculo();
    const [bueno, aceptable] = limitesCV();
    const fecha = ensayo.fecha ? ensayo.fecha.split("-").reverse().join("/") : "";
    let h = informe.encabezado("Informe de distribución transversal", [ensayo.nombre, fecha].filter(Boolean).join(" · "));
    h += `<section class="bloque"><h2>Datos del ensayo</h2>${informe.datos([
      ["Máquina", esc(ensayo.maquina)],
      ["Fertilizante", esc(ensayo.fertilizante)],
      ["Cajas", `${ensayo.nCajas} cajas cada ${fmt(ensayo.dCentros, 2)} m (de centro a centro); cubren ${fmt(ensayo.nCajas * ensayo.dCentros, 1)} m`],
      ["Boca de caja", ensayo.bocaAncho > 0 && ensayo.bocaLargo > 0 ? `${fmt(ensayo.bocaAncho, 1)} × ${fmt(ensayo.bocaLargo, 1)} cm` : null],
      ["Escala de CV", `<span class="cv-bueno">verde</span> hasta ${fmt(bueno, 0)} %, <span class="cv-medio">amarillo</span> hasta ${fmt(aceptable, 0)} %, <span class="cv-malo">rojo</span> por encima`],
    ])}</section>`;
    if (!r.ok) { cont.innerHTML = h + `<div class="aviso error">${r.mensaje}</div>` + informe.pie(); return; }

    // Pesos por caja, en tablas de hasta 16 cajas por renglón.
    const pos = Motor.posiciones(ensayo.nCajas, ensayo.dCentros);
    let tablas = "";
    for (let i0 = 0; i0 < ensayo.nCajas; i0 += 16) {
      const idx = [...Array(Math.min(16, ensayo.nCajas - i0)).keys()].map((k) => k + i0);
      tablas += `<table class="inf-pesos"><tr><th>Caja</th>${idx.map((i) => `<td>${i + 1}</td>`).join("")}</tr>
        <tr><th>m</th>${idx.map((i) => `<td>${fmt(pos[i], 1)}</td>`).join("")}</tr>
        <tr><th>g</th>${idx.map((i) => `<td${r.interpoladas[i] ? ' class="interp"' : ""}>${fmt(r.valores[i], 2)}</td>`).join("")}</tr></table>`;
    }
    const corte = avisoPerfilCortado(r);
    h += `<section class="bloque"><h2>Perfil de una pasada</h2><svg class="inf-graf" id="inf-perfil"></svg>${tablas}
      ${r.interpoladas.some(Boolean) ? `<p class="nota">En gris, cajas sin dato interpoladas entre sus vecinas.</p>` : ""}
      ${corte ? `<p class="nota">${corte}</p>` : ""}</section>`;

    // Superposición con el ancho elegido.
    const alt = ensayo.modo === "alternado";
    const s = Motor.superponer(r.valores, ensayo.dCentros, ensayo.ancho, alt);
    const g = Motor.graficoPasadas(r.valores, ensayo.dCentros, ensayo.ancho, alt);
    const paso = s.xs.length > 1 ? s.xs[1] - s.xs[0] : ensayo.ancho;
    const kh = kgHa(s.media);
    h += `<section class="bloque"><h2>Superposición con ${fmt(ensayo.ancho, 1)} m de ancho de trabajo (${ensayo.modo})</h2>
      <svg class="inf-graf" id="inf-pasadas"></svg>
      <p class="nota"><span style="color:var(--p-izq)">■</span> pasada izquierda · <span style="color:var(--p-cen)">■</span> central ·
        <span style="color:var(--p-der)">■</span> derecha · <span style="color:var(--p-suma)">■</span> suma de todas las pasadas ·
        sombreado: ciclo evaluado · línea de trazos: media</p>
      ${informe.datos([
        ["CV (ciclo completo)", `<b class="${claseTextoCV(s.cv)}">${fmt(s.cv, 1)} %</b>`],
        ["Dosis media", kh !== null ? `${fmt(kh, 0)} kg/ha` : `${fmt(s.media, 2)} g por caja`],
        alt ? ["CV por mitades (complementario)", `izquierda ${fmt(s.mitades[0].cv, 1)} %, derecha ${fmt(s.mitades[1].cv, 1)} %`] : null,
      ])}</section>`;

    // Curva de CV.
    const pasoCurva = 1; // m
    const cCont = Motor.curvaCV(r.valores, ensayo.dCentros, anchoMin(), anchoMax(), pasoCurva, false);
    const cAlt = Motor.curvaCV(r.valores, ensayo.dCentros, anchoMin(), anchoMax(), pasoCurva, true);
    const rangos = (curva, lim) => {
      const rs = Motor.rangosAceptables(curva, lim);
      return rs.length ? rs.map((x) => (x.desde === curva[0].w ? `hasta ${fmt(x.hasta, 1)} m` : `${fmt(x.desde, 1)} a ${fmt(x.hasta, 1)} m`)).join("; ") : "ninguno";
    };
    h += `<section class="bloque"><h2>CV según el ancho de trabajo</h2><svg class="inf-graf" id="inf-cv"></svg>
      <p class="nota"><span style="color:#6a1b9a">━</span> continuo · <span style="color:#ef6c00">━</span> alternado · línea vertical: ancho elegido</p>
      <table class="inf-tabla"><tr><th></th><th>Continuo</th><th>Alternado</th></tr>
        <tr><td class="cv-bueno">Anchos con CV ≤ ${fmt(bueno, 0)} %</td><td>${rangos(cCont, bueno)}</td><td>${rangos(cAlt, bueno)}</td></tr>
        <tr><td class="cv-medio">Anchos con CV ≤ ${fmt(aceptable, 0)} %</td><td>${rangos(cCont, aceptable)}</td><td>${rangos(cAlt, aceptable)}</td></tr>
      </table></section>`;

    // Calibración, si se cargó.
    const anchoCal = cal.ancho > 0 ? cal.ancho : ensayo.ancho;
    if ((cal.kgMin > 0 && cal.vel > 0) || (cal.objetivo > 0 && cal.vel > 0)) {
      h += `<section class="bloque"><h2>Calibración</h2>${informe.datos([
        ["Caudal", cal.kgMin > 0 ? `${fmt(cal.kgMin, 2)} kg/min` : null],
        ["Velocidad", cal.vel > 0 ? `${fmt(cal.vel, 1)} km/h` : null],
        ["Ancho de trabajo", `${fmt(anchoCal, 1)} m`],
        ["Dosis aplicada", cal.kgMin > 0 && cal.vel > 0 ? `<b>${fmt(Motor.kgHaDesdeCaudal(cal.kgMin, cal.vel, anchoCal), 0)} kg/ha</b>` : null],
        ["Dosis deseada", cal.objetivo > 0 ? `${fmt(cal.objetivo, 0)} kg/ha → caudal a regular <b>${fmt(Motor.caudalParaDosis(cal.objetivo, cal.vel, anchoCal), 2)} kg/min</b>` : null],
      ])}</section>`;
    }
    h += informe.pie();
    cont.innerHTML = h;

    Graficos.perfil($("#inf-perfil"), { valores: r.valores, interpoladas: r.interpoladas, d: ensayo.dCentros, alto: 160, anchoFijo: ANCHO_INFORME });
    Graficos.pasadas($("#inf-pasadas"), { ...g, d: ensayo.dCentros, w: ensayo.ancho, media: s.media, etqY: "g",
      alto: 210, anchoFijo: ANCHO_INFORME, ciclo: [s.xs[0] - paso / 2, s.xs[s.xs.length - 1] + paso / 2] });
    Graficos.curvaCV($("#inf-cv"), {
      series: [{ nombre: "Continuo", color: "#6a1b9a", puntos: cCont }, { nombre: "Alternado", color: "#ef6c00", puntos: cAlt }],
      limites: [bueno, aceptable], wActual: ensayo.ancho, alto: 210, anchoFijo: ANCHO_INFORME,
    });
  }
  $$('[data-informe="distribucion"]').forEach((b) => {
    b.onclick = () => abrirInforme(`Informe distribución - ${ensayo.nombre || "ensayo"}`, informeDistribucion);
  });

  // Funciones compartidas con los otros módulos.
  window.App = {
    irA, toast, leer, escribir, mostrarValor, aviso, fmt, abrirInforme, informe,
    registrar(p, fn) { otrasPantallas[p] = fn; },
  };

  // Arranca cuando ya se cargaron todos los módulos.
  document.addEventListener("DOMContentLoaded", () => {
    if (leer("ferticalc.modulo", "distribucion") === "recomendacion") irA("lote");
    else irA(Motor.hayDatos(ensayo.valores) ? "pasadas" : "ensayo");
  });

  // Botón "atrás" de Android: vuelve de Informe, Ayuda y Acerca de; en las
  // demás pantallas devuelve false y la app se cierra.
  window.atrasApp = () => {
    if (pantalla === "informe") { irA(pantallaAntesInforme); return true; }
    if (pantalla === "ayuda" || pantalla === "acerca") { irA(pantallaAnterior); return true; }
    return false;
  };

  if (!Nativo && "serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
