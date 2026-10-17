// SPDX-License-Identifier: GPL-3.0-or-later
// Calculadora de Fertilización · © 2026 Juan Manuel Vázquez
// Pantallas del módulo Recomendación y costos (antes app Ferti). Los cálculos
// están en recomendacion.js; las funciones compartidas, en App (app.js).

(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const { fmt, leer, escribir, mostrarValor, aviso, toast } = App;
  const R = Recomendacion;

  const CLAVE_LOTE = "fertilizacion.lote";
  const CLAVE_CATALOGO = "fertilizacion.catalogo";
  const CLAVE_FECHA = "fertilizacion.fechaPrecios";

  // ---------- Estado ----------
  function loteNuevo() {
    const c = R.CULTIVOS.maiz;
    return {
      cultivo: "maiz", rendimiento: null, nSuelo: null, umbralN: c.umbralN,
      bray: null, criticoP: c.criticoP, rotacionTrigo: false,
      arcilla: null, densidad: 1.25, zona: 1, pGrano: c.pGrano, dosisPComb: "suficiencia",
    };
  }
  const lote = Object.assign(loteNuevo(), leer(CLAVE_LOTE, {}));
  let catalogo = leer(CLAVE_CATALOGO, null) || CATALOGO_FERTILIZANTES.map((f) => ({ ...f }));
  const guardarLote = () => escribir(CLAVE_LOTE, lote);
  const guardarCatalogo = () => escribir(CLAVE_CATALOGO, catalogo);

  const kg = (v, el) => `${fmt(v, 0)} <small>kg ${el}/ha</small>`;
  const usd = (v, dec = 2) => (v === null || v === undefined ? "—" : fmt(v, dec));

  // ============ LOTE ============
  function aplicarCultivo(id) {
    const c = R.CULTIVOS[id];
    lote.cultivo = id;
    lote.umbralN = c.umbralN;
    lote.criticoP = lote.rotacionTrigo ? R.CRITICO_ROTACION_TRIGO : c.criticoP;
    lote.pGrano = c.pGrano;
    guardarLote();
    dibujarLote();
  }
  $$("#cultivo-sel button").forEach((b) => b.addEventListener("click", () => aplicarCultivo(b.dataset.cultivo)));
  $$("#zona-sel button").forEach((b) => b.addEventListener("click", () => { lote.zona = +b.dataset.zona; guardarLote(); dibujarLote(); }));
  $("#rotacion-trigo").addEventListener("change", (e) => {
    lote.rotacionTrigo = e.target.checked;
    lote.criticoP = lote.rotacionTrigo ? R.CRITICO_ROTACION_TRIGO : R.CULTIVOS[lote.cultivo].criticoP;
    guardarLote(); dibujarLote();
  });
  $$("#p-lote [data-lote]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const r = Motor.leerNumero(inp.value);
      inp.classList.toggle("invalido", !r.ok);
      if (!r.ok) return;
      lote[inp.dataset.lote] = r.valor;
      guardarLote();
    });
  });

  function dibujarLote() {
    $$("#cultivo-sel button").forEach((b) => b.classList.toggle("activa", b.dataset.cultivo === lote.cultivo));
    $$("#zona-sel button").forEach((b) => b.classList.toggle("activa", +b.dataset.zona === lote.zona));
    $("#rotacion-trigo").checked = lote.rotacionTrigo;
    $("#tarjeta-n").hidden = lote.cultivo === "soja";
    $$("#p-lote [data-lote]").forEach((inp) => {
      if (document.activeElement === inp) return;
      inp.value = mostrarValor(lote[inp.dataset.lote]);
      inp.classList.remove("invalido");
    });
  }

  // ============ CÁLCULO ============
  // Devuelve { faltan: [...], n, p } con lo que se pueda calcular.
  function calcular() {
    const faltan = [];
    let n = null, p = null;
    if (lote.cultivo !== "soja") {
      if (lote.nSuelo === null) faltan.push("N de nitratos 0–60 cm");
      else n = R.dosisN(lote.umbralN, lote.nSuelo);
    } else n = 0;
    if (lote.bray === null) faltan.push("P Bray");
    if (lote.arcilla === null) faltan.push("arcilla");
    if (lote.bray !== null && lote.arcilla !== null) {
      p = R.dosisP({
        bray: lote.bray, critico: lote.criticoP, arcilla: lote.arcilla, zona: lote.zona,
        densidad: lote.densidad || 1.25, rendimiento: lote.rendimiento || 0, pGrano: lote.pGrano || 0,
      });
    }
    if (!(lote.rendimiento > 0)) faltan.push("rendimiento esperado (para la reposición)");
    return { faltan, n, p };
  }

  const p2o5 = (v) => `<small class="eq">(${fmt(v * R.P_A_P2O5, 0)} kg P₂O₅)</small>`;

  // ============ DOSIS N Y P ============
  function dibujarReco() {
    const { faltan, n, p } = calcular();
    const cultivo = R.CULTIVOS[lote.cultivo].nombre;
    let html = `<p class="ayuda" style="margin-top:0">${cultivo}${lote.rendimiento > 0 ? ` · ${fmt(lote.rendimiento, 1)} t/ha esperadas` : ""} · ${lote.zona ? "zona norte" : "zona sur"}</p>`;
    if (faltan.length) html += `<div class="aviso">Faltan datos en la pantalla Lote: ${faltan.join(", ")}.</div>`;

    // Nitrógeno
    html += `<div class="tarjeta"><h2>Nitrógeno</h2>`;
    if (lote.cultivo === "soja") html += `<p class="ayuda">En soja no se calcula dosis de N.</p>`;
    else if (n === null) html += `<p class="ayuda">Cargá el N de nitratos 0–60 cm a la siembra.</p>`;
    else html += `<div class="resultados"><div class="dato"><div class="etq">Dosis de N</div><div class="val">${kg(n, "N")}</div></div></div>
      <p class="ayuda">Umbral ${fmt(lote.umbralN, 0)} kg N/ha (suelo + fertilizante) − ${fmt(lote.nSuelo, 0)} kg N/ha de nitratos en el suelo.</p>`;
    html += `</div>`;

    // Fósforo
    html += `<div class="tarjeta"><h2>Fósforo</h2>`;
    if (!p) html += `<p class="ayuda">Cargá el P Bray y la arcilla.</p>`;
    else {
      const bajo = p.deficit > 0;
      html += `<p class="ayuda" style="margin-top:0">Para subir 1 ppm el P Bray de este suelo hacen falta <b>${fmt(p.porPpm, 1)} kg de P/ha</b> (dosis equivalente). P Bray ${fmt(lote.bray, 1)} ppm; nivel crítico ${fmt(lote.criticoP, 1)} ppm.</p>
        <div class="dosis-p">
          <div class="dato"><div class="etq">Dosis de suficiencia</div><div class="val">${kg(p.suficiencia, "P")}</div>${p2o5(p.suficiencia)}</div>
          <p class="explica">${bajo
            ? "Lleva el P del suelo al nivel crítico para el cultivo de esta campaña."
            : "El P del suelo ya está en el nivel crítico o por encima: esta campaña no hace falta subirlo."}</p>
          <div class="dato"><div class="etq">Dosis de construcción y mantenimiento</div><div class="val">${kg(p.construccion, "P")}</div>${p2o5(p.construccion)}</div>
          <p class="explica">${bajo ? "Además repone" : "Repone"} el P que se lleva la cosecha${lote.rendimiento > 0
            ? ` (${fmt(p.exportacion, 0)} kg de P con ${fmt(lote.rendimiento, 1)} t/ha)` : " (falta el rendimiento esperado)"}, para que el suelo siga en el nivel crítico la campaña siguiente.</p>
        </div>`;
      const avisos = R.avisosRubio({ bray: lote.bray, arcilla: lote.arcilla });
      if (avisos.length) html += `<div class="aviso">${avisos.join("<br>")}</div>`;
      html += `<p class="ayuda fuente">Dosis equivalente según Rubio et al. (2008), con arcilla, P Bray y zona. Se ajustó en Molisoles no calcáreos de la Región Pampeana (0–20 cm), incubados en laboratorio. Niveles críticos: Sucunza et al. (2018). P en grano: tablas del IPNI.</p>`;
    }
    html += `</div>`;
    html += `<div class="botones"><button class="btn" id="ir-comb">Ver la combinación más económica</button></div>`;
    $("#reco-contenido").innerHTML = html;
    $("#ir-comb").onclick = () => App.irA("comb");
  }

  // ============ FERTILIZANTES ============
  const fechaInp = $("#fecha-precios");
  fechaInp.addEventListener("input", () => escribir(CLAVE_FECHA, fechaInp.value));

  function grado(f) {
    const g = R.gradoEquivalente(f);
    const e = (v) => fmt(v || 0, 1);
    return `<b>${e(f.n)}-${e(f.p)}-${e(f.k)}-${e(f.s)}</b><br><small>${fmt(g.n, 0)}-${fmt(g.p2o5, 0)}-${fmt(g.k2o, 0)}-${fmt(g.s, 0)}</small>`;
  }

  function dibujarFert() {
    fechaInp.value = leer(CLAVE_FECHA, "");
    const costos = R.costosPorNutriente(catalogo).porFertilizante;
    const filas = catalogo.map((f) => {
      const c = costos[f.id] || {};
      return `<tr data-id="${f.id}">
        <td>${escapar(f.nombre)} <button class="quitar" title="Quitar" aria-label="Quitar ${escapar(f.nombre)}">×</button></td>
        <td class="grado">${grado(f)}</td>
        <td><input type="text" inputmode="numeric" class="precio" value="${f.precio > 0 ? f.precio : ""}" aria-label="Precio de ${escapar(f.nombre)}"></td>
        <td>${usd(c.n)}</td>
        <td>${usd(c.p)}${c.p2o5 !== null && c.p2o5 !== undefined ? `<br><small class="eq">${usd(c.p2o5)}</small>` : ""}</td>
      </tr>`;
    }).join("");
    $("#tabla-fert").innerHTML = `<tr><th>Fertilizante</th><th>Grado<br><small>equivalente</small></th><th>U$S/t</th><th>U$S/kg N</th><th>U$S/kg P<br><small>/kg P₂O₅</small></th></tr>${filas}`;
    $$("#tabla-fert input.precio").forEach((inp) => {
      inp.addEventListener("change", () => {
        const id = inp.closest("tr").dataset.id;
        const r = Motor.leerNumero(inp.value);
        if (!r.ok) { inp.classList.add("invalido"); return; }
        catalogo.find((f) => f.id === id).precio = r.valor === null ? null : Math.round(r.valor);
        if (!fechaInp.value) { fechaInp.value = new Date().toISOString().slice(0, 10); escribir(CLAVE_FECHA, fechaInp.value); }
        guardarCatalogo();
        dibujarFert();
      });
    });
    $$("#tabla-fert button.quitar").forEach((b) => b.addEventListener("click", () => {
      const id = b.closest("tr").dataset.id, f = catalogo.find((x) => x.id === id);
      if (!confirm(`¿Quitar "${f.nombre}" de la lista?`)) return;
      catalogo = catalogo.filter((x) => x.id !== id);
      guardarCatalogo(); dibujarFert();
    }));
  }

  function escapar(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  $("#nf-agregar").onclick = () => {
    const nombre = $("#nf-nombre").value.trim();
    const num = (id) => { const r = Motor.leerNumero($(id).value); return r.ok ? (r.valor || 0) : NaN; };
    const n = num("#nf-n"), p = num("#nf-p"), k = num("#nf-k"), s = num("#nf-s");
    const precio = Motor.leerNumero($("#nf-precio").value);
    if (!nombre) { toast("Falta el nombre"); return; }
    if ([n, p, k, s].some((v) => isNaN(v) || v > 100) || !precio.ok) { toast("Revisá los porcentajes y el precio"); return; }
    if (n + p + k + s <= 0) { toast("El fertilizante tiene que tener algún nutriente"); return; }
    catalogo.push({ id: "f" + Date.now().toString(36), nombre, n, p, k, s, precio: precio.valor === null ? null : Math.round(precio.valor) });
    guardarCatalogo();
    ["#nf-nombre", "#nf-n", "#nf-p", "#nf-k", "#nf-s", "#nf-precio"].forEach((id) => { $(id).value = ""; });
    $("#agregar-fert").open = false;
    toast(`"${nombre}" agregado`);
    dibujarFert();
  };
  $("#btn-restaurar-fert").onclick = () => {
    if (!confirm("¿Volver a la lista original de fertilizantes? Se pierden los agregados y los precios cargados.")) return;
    catalogo = CATALOGO_FERTILIZANTES.map((f) => ({ ...f }));
    guardarCatalogo(); dibujarFert();
  };

  // ============ COMBINACIÓN MÁS ECONÓMICA ============
  $$("#comb-p-sel button").forEach((b) => b.addEventListener("click", () => { lote.dosisPComb = b.dataset.dosisp; guardarLote(); dibujarComb(); }));

  function dibujarComb() {
    $$("#comb-p-sel button").forEach((b) => b.classList.toggle("activa", b.dataset.dosisp === lote.dosisPComb));
    const { n, p } = calcular();
    const lista = $("#comb-lista");
    if (n === null || !p) {
      $("#comb-req").innerHTML = "";
      lista.innerHTML = `<div class="aviso">Primero completá los datos de la pantalla Lote.</div>`;
      return;
    }
    const pReq = lote.dosisPComb === "construccion" ? p.construccion : p.suficiencia;
    $("#comb-req").innerHTML = `<p class="ayuda" style="margin:0">A cubrir: <b>${fmt(n, 0)} kg N/ha</b> y <b>${fmt(pReq, 0)} kg P/ha</b>.</p>`;
    if (n <= 0 && pReq <= 0) { lista.innerHTML = `<div class="aviso">Con estos datos no hace falta fertilizar con N ni con P.</div>`; return; }
    const ops = R.combinaciones(catalogo, n, pReq);
    if (!ops.length) { lista.innerHTML = `<div class="aviso">No hay fertilizantes con precio que cubran lo necesario. Cargá los precios en la pantalla Fertilizantes.</div>`; return; }
    const fecha = leer(CLAVE_FECHA, "");
    lista.innerHTML = ops.map((o, i) => {
      const filas = o.items.map((it, j) => `<li><span class="prod">${escapar(it.f.nombre)}</span>
          <span class="cant">${fmt(it.kg, 0)} kg/ha</span><span class="costo">U$S ${fmt(it.kg * it.f.precio / 1000, 1)}</span>
          <button class="btn sec chico" data-op="${i}" data-item="${j}">Calibrar</button></li>`).join("");
      const sobraN = o.aporteN - n, sobraP = o.aporteP - pReq;
      const sobra = [sobraN > 0.5 ? `${fmt(sobraN, 0)} kg de N` : "", sobraP > 0.5 ? `${fmt(sobraP, 0)} kg de P` : ""].filter(Boolean);
      return `<div class="tarjeta opcion${i === 0 ? " mejor" : ""}">
        <div class="opcion-cab"><b>${i === 0 ? "Más económica" : `Alternativa ${i}`}</b><span class="total">U$S ${fmt(o.costo, 1)}/ha</span></div>
        <ul class="items">${filas}</ul>
        <p class="ayuda" style="margin:4px 0 0">Aporta ${fmt(o.aporteN, 0)} kg N y ${fmt(o.aporteP, 0)} kg P por ha${sobra.length ? ` (sobran ${sobra.join(" y ")})` : ""}.</p>
      </div>`;
    }).join("") + `<p class="ayuda">Costo solo del producto, con los precios de la pantalla Fertilizantes${fecha ? ` (${fecha.split("-").reverse().join("/")})` : ""}. "Calibrar" lleva esa dosis a la calibración de la fertilizadora.</p>`;
    $$("#comb-lista button[data-op]").forEach((b) => b.addEventListener("click", () => {
      const it = ops[+b.dataset.op].items[+b.dataset.item];
      App.calibrarPara(it.kg);
    }));
  }

  App.registrar("lote", dibujarLote);
  App.registrar("reco", dibujarReco);
  App.registrar("fert", dibujarFert);
  App.registrar("comb", dibujarComb);
})();
