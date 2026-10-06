// Ficha del parte: formulario dinámico (autosave), panel en vivo con
// gráfico, drogas/eventos y control de la captura automática.
"use strict";

const ID = parseInt(new URLSearchParams(location.search).get("id"), 10);
const aviso = document.getElementById("aviso");
const indicadorGuardado = document.getElementById("guardado");

if (!Number.isInteger(ID)) {
  aviso.textContent = "Falta ?id= en la URL";
  aviso.classList.remove("oculto");
  throw new Error("sin id");
}
document.getElementById("titulo-num").textContent = `N° ${ID}`;
document.getElementById("boton-imprimir").href = `imprimir.html?id=${ID}`;

async function pedirJSON(url, opciones) {
  const r = await fetch(url, opciones);
  if (!r.ok) {
    let detalle = `HTTP ${r.status}`;
    try { detalle = (await r.json()).detail || detalle; } catch (e) { /* nada */ }
    throw new Error(detalle);
  }
  return r.json();
}

function mostrarAviso(msj) {
  aviso.textContent = msj;
  aviso.classList.remove("oculto");
}

const fmtHora = (iso) => (iso || "").slice(11, 16) || "—";

function horaAIso(hhmm) {
  // "14:35" -> ISO de hoy a esa hora (los partes se cargan el día de la cirugía)
  const d = new Date();
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
}

// ------------------------------------------------------------- formulario

let datosParte = {};        // datos actuales (espejo local)
const pendientes = {};      // cambios sin guardar (se mandan juntos)
let timerGuardar = null;

function marcarGuardado(texto, esError) {
  indicadorGuardado.textContent = texto;
  indicadorGuardado.classList.toggle("guardado-error", !!esError);
}

// el Aldrete se calcula solo cuando cambian sus componentes (editable a mano)
const CAMPOS_ALDRETE = ["circulacion_aldrete", "moviliza_msup", "moviliza_minf", "depresion_respiratoria",
                        "tas_final", "obedece_ordenes", "estimulos_dolorosos",
                        "sat_final",
                        // y lo de la UCI (21-sep): intubado bajo ARM = no califica
                        "via_aerea_uti", "ingreso_uti"];

function recalcularAldrete() {
  // El intubado bajo ARM NO CALIFICA (21-sep): letras, y manda sobre el
  // numero; si no, el puntaje con el estado final + TAS basal.
  let a;
  if (window.aldreteNoCalifica(datosParte)) {
    a = window.ALDRETE_NO_CALIFICA;
  } else {
    const basal = vitales.find((v) => v.nibp_sis != null);
    a = window.calcularAldrete(datosParte, basal ? basal.nibp_sis : null);
    // al dejar de ser ARM, el "No califica" que quedo se borra
    if (a == null && datosParte.aldrete === window.ALDRETE_NO_CALIFICA) a = "";
  }
  if (a == null || String(datosParte.aldrete ?? "") === String(a)) return;
  const input = document.querySelector('[data-campo="aldrete"]');
  if (input) input.value = a;
  programarGuardado("aldrete", String(a));
}

function programarGuardado(campoId, valor) {
  datosParte[campoId] = valor;
  pendientes[campoId] = valor;
  if (campoId === "nombre") ponerNombreTitulo();
  if (CAMPOS_ALDRETE.includes(campoId)) recalcularAldrete();
  marcarGuardado("Guardando…");
  clearTimeout(timerGuardar);
  timerGuardar = setTimeout(guardarPendientes, 800);
}

async function guardarPendientes() {
  const cambios = { ...pendientes };
  if (!Object.keys(cambios).length) return;
  try {
    await pedirJSON(`/api/partes/${ID}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datos: cambios }),
    });
    for (const k of Object.keys(cambios)) {
      if (pendientes[k] === cambios[k]) delete pendientes[k];
    }
    if (!Object.keys(pendientes).length) {
      marcarGuardado(`Guardado ${new Date().toTimeString().slice(0, 5)} ✓`);
    }
  } catch (e) {
    marcarGuardado(`Error al guardar: ${e.message}`, true);
    clearTimeout(timerGuardar);
    timerGuardar = setTimeout(guardarPendientes, 3000); // reintento
  }
}

function crearRotulo(campo) {
  const r = document.createElement("label");
  r.className = "rotulo" + (campo.incierto ? " incierto" : "");
  r.textContent = campo.etiqueta;
  if (campo.incierto) r.title = "Rótulo poco legible en el formulario papel (ver esquema_formulario.js)";
  return r;
}

function crearEntrada(campo) {
  const valor = datosParte[campo.id];
  if (campo.tipo === "textoLargo") {
    const t = document.createElement("textarea");
    t.rows = 3;
    t.value = valor || "";
    t.addEventListener("input", () => programarGuardado(campo.id, t.value));
    return t;
  }
  if (campo.tipo === "opciones" || campo.tipo === "siNo") {
    const opciones = campo.tipo === "siNo" ? ["Sí", "No"] : campo.opciones;
    const cont = document.createElement("div");
    cont.className = "segmentado";
    // El ASA es multi (8-sep): guarda "3 E" — la clase Y la E, como
    // se rodean juntas en el papel. El resto sigue de UNA opción.
    const tokens = () =>
      String(datosParte[campo.id] ?? "").split(/[\s,]+/).filter(Boolean);
    const pintar = () => {
      const activos = campo.multi ? tokens() : [datosParte[campo.id]];
      for (const otro of cont.children) {
        otro.classList.toggle("activo", activos.includes(otro.textContent));
      }
    };
    for (const op of opciones) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = op;
      b.classList.toggle(
        "activo", campo.multi ? tokens().includes(op) : valor === op);
      b.addEventListener("click", () => {
        let nuevo;
        if (campo.multi) {
          const t = new Set(tokens());
          t.has(op) ? t.delete(op) : t.add(op);
          // Siempre en el orden del renglón ("3 E", nunca "E 3").
          nuevo = campo.opciones.filter((o) => t.has(o)).join(" ") || null;
        } else {
          nuevo = datosParte[campo.id] === op ? null : op; // repetir = destildar
        }
        programarGuardado(campo.id, nuevo);
        pintar();
      });
      cont.appendChild(b);
    }
    return cont;
  }
  if (campo.tipo === "checks") {
    const cont = document.createElement("div");
    cont.className = "checks";
    const marcadas = Array.isArray(valor) ? valor : [];
    for (const op of campo.opciones) {
      const lab = document.createElement("label");
      lab.className = "check";
      const c = document.createElement("input");
      c.type = "checkbox";
      c.checked = marcadas.includes(op);
      c.addEventListener("change", () => {
        const actual = new Set(Array.isArray(datosParte[campo.id]) ? datosParte[campo.id] : []);
        c.checked ? actual.add(op) : actual.delete(op);
        programarGuardado(campo.id, campo.opciones.filter((o) => actual.has(o)));
      });
      lab.append(c, document.createTextNode(op));
      cont.appendChild(lab);
    }
    return cont;
  }
  const i = document.createElement("input");
  i.type = { numero: "number", fecha: "date", hora: "time" }[campo.tipo] || "text";
  // el Aldrete puede decir "No califica" (21-sep): un input number lo vaciaria
  if (campo.id === "aldrete") i.type = "text";
  if (campo.tipo === "numero") i.step = "any";
  i.dataset.campo = campo.id;
  i.value = valor ?? "";
  i.addEventListener("input", () => programarGuardado(campo.id, i.value));
  return i;
}

function construirFormulario() {
  const form = document.getElementById("formulario");
  form.innerHTML = "";
  for (const [n, seccion] of window.ESQUEMA_FORMULARIO.secciones.entries()) {
    const det = document.createElement("details");
    det.className = "seccion";
    det.open = n === 0; // cabecera abierta, el resto colapsado
    const sum = document.createElement("summary");
    sum.textContent = seccion.titulo;
    const cuerpo = document.createElement("div");
    cuerpo.className = "seccion-cuerpo";
    for (const campo of seccion.campos) {
      const div = document.createElement("div");
      div.className = "campo" +
        (campo.ancho === "chico" ? " campo-chico" :
         campo.ancho === "grande" || campo.tipo === "textoLargo" ? " campo-grande" : "");
      div.append(crearRotulo(campo), crearEntrada(campo));
      cuerpo.appendChild(div);
    }
    det.append(sum, cuerpo);
    form.appendChild(det);
  }
}

function ponerNombreTitulo() {
  document.getElementById("titulo-nombre").textContent = datosParte.nombre || "";
}

function ponerEstado(estado) {
  const b = document.getElementById("badge-estado");
  b.className = `badge badge-${estado}`;
  b.textContent = estado === "en_curso" ? "En curso" : "Cerrado";
  document.getElementById("boton-cerrar").disabled = estado !== "en_curso";
}

// --------------------------------------------------------------- en vivo

const TARJETAS = [
  { clase: "v-fc", rotulo: "FC", unidad: "lpm", texto: (u) => num(u.hr) },
  { clase: "v-spo2", rotulo: "SpO2", unidad: "%", texto: (u) => num(u.spo2) },
  { clase: "v-ta tarjeta-ta", rotulo: "TA", unidad: "mmHg",
    texto: (u) => (u.nibp_sis != null ? `${num(u.nibp_sis)}/${num(u.nibp_dia)} (${num(u.nibp_pam)})` : "—"),
    sub: (u) => (u._ts_nibp ? `medida ${fmtHora(u._ts_nibp)}` : "") },
  { clase: "", rotulo: "etCO2", unidad: "mmHg", texto: (u) => num(u.etco2) },
  { clase: "", rotulo: "Sev Et/Fi", unidad: "%",
    texto: (u) => (u.sev_et != null || u.sev_fi != null ? `${num(u.sev_et)}/${num(u.sev_fi)}` : "—") },
  { clase: "", rotulo: "MAC", unidad: "", texto: (u) => num(u.mac) },
  { clase: "", rotulo: "VT × FR", unidad: "",
    texto: (u) => (u.vt != null || u.fr_vent != null ? `${num(u.vt)}×${num(u.fr_vent)}` : "—") },
  { clase: "", rotulo: "PEEP / PIP", unidad: "cmH2O",
    texto: (u) => (u.peep != null || u.pip != null ? `${num(u.peep)} / ${num(u.pip)}` : "—") },
];

const num = (v) => (v == null ? "—" : (Math.round(v * 10) / 10).toString());

let vitales = [];   // acumulado en orden
let ultimoTs = null;

function ultimosValores() {
  // último valor no nulo de cada columna (y hora de la última medición NIBP)
  const u = {};
  for (const v of vitales) {
    for (const [k, val] of Object.entries(v)) {
      if (val != null && k !== "id" && k !== "ts" && k !== "fuente") {
        u[k] = val;
        if (k === "nibp_sis") u._ts_nibp = v.ts;
      }
    }
  }
  return u;
}

function pintarTarjetas() {
  const u = ultimosValores();
  const cont = document.getElementById("tarjetas");
  cont.innerHTML = "";
  for (const t of TARJETAS) {
    const d = document.createElement("div");
    d.className = `tarjeta ${t.clase}`;
    const unidad = t.unidad ? ` <span class="unidad">${t.unidad}</span>` : "";
    d.innerHTML = `
      <div class="tarjeta-rotulo">${t.rotulo}${unidad}</div>
      <div class="tarjeta-valor">${t.texto(u)}</div>
      <div class="tarjeta-sub">${(t.sub && t.sub(u)) || ""}</div>`;
    cont.appendChild(d);
  }
}

// ---- gráfico SVG (TAS/TAD/FC/SpO2 vs tiempo, eje 0–220) ----

const SVG_NS = "http://www.w3.org/2000/svg";
const G = { ancho: 860, alto: 340, izq: 34, der: 8, arr: 8, aba: 22, yMax: 220 };

function svgEl(nombre, atributos) {
  const el = document.createElementNS(SVG_NS, nombre);
  for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
  return el;
}

function pintarGrafico() {
  const svg = document.getElementById("grafico");
  svg.innerHTML = "";
  const w = G.ancho - G.izq - G.der, h = G.alto - G.arr - G.aba;
  const conTs = vitales.filter((v) => v.ts);
  const ahora = Date.now();
  let t0 = conTs.length ? new Date(conTs[0].ts).getTime() : ahora - 30 * 60000;
  let t1 = conTs.length ? Math.max(new Date(conTs[conTs.length - 1].ts).getTime(), t0 + 60000) : ahora;
  if (t1 - t0 < 30 * 60000) t1 = t0 + 30 * 60000;   // ventana mínima 30 min
  const x = (t) => G.izq + ((t - t0) / (t1 - t0)) * w;
  const y = (v) => G.arr + (1 - v / G.yMax) * h;

  // grilla horizontal cada 20 + rótulos
  for (let v = 0; v <= G.yMax; v += 20) {
    svg.appendChild(svgEl("line", { x1: G.izq, x2: G.ancho - G.der, y1: y(v), y2: y(v),
      stroke: v % 100 === 0 ? "#c9d2dd" : "#e7ecf2", "stroke-width": 1 }));
    const et = svgEl("text", { x: G.izq - 5, y: y(v) + 3.5, "text-anchor": "end",
      "font-size": 10, fill: "#5b6675" });
    et.textContent = v;
    svg.appendChild(et);
  }
  // marcas de tiempo (~6 rótulos)
  const paso = Math.max(5, Math.round((t1 - t0) / 60000 / 6 / 5) * 5) * 60000;
  for (let t = Math.ceil(t0 / paso) * paso; t <= t1; t += paso) {
    svg.appendChild(svgEl("line", { x1: x(t), x2: x(t), y1: G.arr, y2: G.alto - G.aba,
      stroke: "#eef1f5", "stroke-width": 1 }));
    const et = svgEl("text", { x: x(t), y: G.alto - 7, "text-anchor": "middle",
      "font-size": 10, fill: "#5b6675" });
    et.textContent = new Date(t).toTimeString().slice(0, 5);
    svg.appendChild(et);
  }
  // series
  for (const serie of window.VITALES_GRAFICO.plot) {
    for (const v of conTs) {
      const val = v[serie.key];
      if (val == null) continue;
      const m = svgEl("text", { x: x(new Date(v.ts).getTime()), y: y(val) + 4,
        "text-anchor": "middle", "font-size": 11, "font-weight": 700,
        fill: serie.colorPantalla });
      m.textContent = serie.simbolo;
      svg.appendChild(m);
    }
  }
  // leyenda
  document.getElementById("leyenda").innerHTML = window.VITALES_GRAFICO.plot
    .map((s) => `<span class="chip-leyenda" style="color:${s.colorPantalla}">${s.simbolo} ${s.etiqueta}</span>`)
    .join("");
}

async function traerVitales() {
  const url = `/api/partes/${ID}/vitales` + (ultimoTs ? `?desde=${encodeURIComponent(ultimoTs)}` : "");
  const nuevos = await pedirJSON(url);
  if (nuevos.length) {
    vitales = vitales.concat(nuevos);
    ultimoTs = nuevos[nuevos.length - 1].ts;
    pintarTarjetas();
    pintarGrafico();
  }
}

// --------------------------------------------------------------- eventos

async function traerEventos() {
  const eventos = await pedirJSON(`/api/partes/${ID}/eventos`);
  const ul = document.getElementById("lista-eventos");
  ul.innerHTML = "";
  if (!eventos.length) {
    ul.innerHTML = '<li class="evento-vacio">Sin registros todavía.</li>';
    return;
  }
  // La hora por evento (11-sep): la droga del celular con gatillo
  // muestra si ya tomó la hora de su episodio o si la espera todavía
  // (mientras tanto luce la hora de la carga).
  const NOMBRE_GATILLO = { hipotension: "hipotensión", bradicardia: "bradicardia",
                           hipertension: "hipertensión",
                           taquicardia: "taquicardia",
                           cierre: "el final de la anestesia",
                           inicio: "el inicio de la anestesia" };
  for (const ev of eventos) {
    const li = document.createElement("li");
    li.className = "evento-fila";
    const dosis = [ev.dosis, ev.unidad].filter(Boolean).join(" ");
    // La DURACIÓN (15-sep, "¿y si en la inducción comienzo con un goteo?"):
    // un goteo (unidad de tasa) "durante N min" — se corta ahí y el consumo
    // del cierre también —; un bolo "(en N min)" es la dosis de carga
    // repartida en ese tiempo (informativo, suma como bolo). Mismo
    // detector de tasa que la planilla: '/min' o '/h' y no empieza con ml.
    const duracion = Number(ev.duracion) || 0;
    const unidadTasa = String(ev.unidad ?? "").trim().toLowerCase();
    const esTasa = !unidadTasa.startsWith("ml")
      && (unidadTasa.includes("/min") || unidadTasa.includes("/h"));
    const rotuloDuracion = !duracion ? ""
      : esTasa
      ? ` <span class="evento-duracion" title="Goteo con tope: corre ${duracion} min desde su momento y el consumo del cierre se corta ahí">durante ${duracion} min</span>`
      : ` <span class="evento-duracion" title="Dosis de carga: el total se pasa en ${duracion} min (suma como bolo, sin consumo)">(en ${duracion} min)</span>`;
    const nombreGatillo = ev.gatillo ? (NOMBRE_GATILLO[ev.gatillo] || ev.gatillo) : "";
    const sinHora = ev.ubicado === 0 || ev.ubicado === false;
    const esCierre = ev.gatillo === "cierre";
    const esInicio = ev.gatillo === "inicio";
    // Los TRAMOS de dosis (15-sep): "al inicio" / "a los N min del
    // inicio" / "últimos N min" (al finalizar) en vez de "tras <episodio>".
    const minutos = Number(ev.minutos) || 0;
    const rotuloTramo = esCierre
      ? (minutos ? `últimos ${minutos} min` : "al finalizar")
      : esInicio ? (minutos ? `a los ${minutos} min del inicio` : "al inicio")
      : null;
    const gatillo = ev.gatillo === "consumo"
      // el consumo de la infusión que calculó el cierre (15-sep): mg
      // totales, sin hora — va al Total del renglón en la planilla
      ? `<span class="evento-gatillo" title="Σ tasa × kg × minutos de cada tramo, calculado al cerrar el parte">consumo calculado al cierre</span>`
      : ev.gatillo
      ? (sinHora
          ? `<span class="evento-gatillo pendiente" title="${esCierre ? "Toma la hora al cerrar el parte" : esInicio ? "Toma la hora de ingreso del parte" : "Espera el episodio en el monitor para tomar su hora en la grilla"}">⏱ a ubicar (${rotuloTramo ?? nombreGatillo})</span>`
          : `<span class="evento-gatillo" title="${esCierre ? "Hora del cierre del parte" : esInicio ? "Hora del inicio de la anestesia" : "Hora tomada del episodio que registró el monitor"}">${rotuloTramo ?? `tras ${nombreGatillo}`}</span>`)
      : (sinHora
          ? `<span class="evento-gatillo" title="Droga del celular: figura en el renglón y en el Total, sin columna horaria">sin hora</span>`
          : "");
    li.innerHTML = `
      <span class="evento-hora">${sinHora ? "—" : fmtHora(ev.ts)}</span>
      <span class="badge-tipo badge-${ev.tipo === "droga" ? "droga" : "evento"}">${ev.tipo}</span>
      <span class="evento-desc"></span>
      <span class="evento-dosis">${dosis}${rotuloDuracion}</span>${gatillo}
      <button class="boton-borrar" title="Borrar" type="button">×</button>`;
    li.querySelector(".evento-desc").textContent = ev.descripcion;
    li.querySelector(".boton-borrar").addEventListener("click", async () => {
      if (!confirm(`¿Borrar "${ev.descripcion}"?`)) return;
      try {
        await pedirJSON(`/api/eventos/${ev.id}`, { method: "DELETE" });
        traerEventos();
      } catch (e) { mostrarAviso(`No se pudo borrar: ${e.message}`); }
    });
    ul.appendChild(li);
  }
}

document.getElementById("ev-agregar").addEventListener("click", async () => {
  const desc = document.getElementById("ev-desc").value.trim();
  if (!desc) { document.getElementById("ev-desc").focus(); return; }
  const hora = document.getElementById("ev-hora").value;
  const cuerpo = {
    tipo: document.getElementById("ev-tipo").value,
    descripcion: desc,
    dosis: document.getElementById("ev-dosis").value.trim() || null,
    unidad: document.getElementById("ev-unidad").value.trim() || null,
  };
  if (hora) cuerpo.ts = horaAIso(hora);
  try {
    await pedirJSON(`/api/partes/${ID}/eventos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    document.getElementById("ev-desc").value = "";
    document.getElementById("ev-dosis").value = "";
    document.getElementById("ev-hora").value = "";
    document.getElementById("ev-desc").focus();
    traerEventos();
  } catch (e) { mostrarAviso(`No se pudo agregar: ${e.message}`); }
});
document.getElementById("ev-desc").addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("ev-agregar").click(); }
});

// --------------------------------------------------------------- captura

function pintarCaptura(est) {
  const punto = document.getElementById("captura-punto");
  const texto = document.getElementById("captura-texto");
  const error = document.getElementById("captura-error");
  document.getElementById("captura-iniciar").disabled = false;
  document.getElementById("captura-detener").disabled = !est.activa;
  let clase = "punto-gris", msj = "Inactiva";
  if (est.activa) {
    if (est.parte_id !== ID) {
      clase = "punto-ambar";
      msj = `Capturando para el parte N° ${est.parte_id} (no este)`;
    } else if (est.ultima_ok) {
      clase = "punto-verde";
      msj = `Activa cada ${Math.round(est.intervalo_s)} s — última lectura ${fmtHora(est.ultima_ts)}`;
    } else if (est.error) {
      clase = "punto-rojo";
      msj = `Activa, con error (reintenta cada ${Math.round(est.intervalo_s)} s)`;
    } else {
      clase = "punto-ambar";
      msj = "Arrancando…";
    }
  }
  // El rótulo del monitor → quirófano (14-sep): "QFN3" identifica el
  // quirófano online (etiqueta de la sesión y renglón del Anexo V).
  if (est.quirofano) {
    msj += ` · Monitor «${est.monitor_rotulo || "?"}» = Quirófano ${est.quirofano}`;
  } else if (est.activa && est.cabecera_ts) {
    msj += est.monitor_rotulo
      ? ` · Rótulo del monitor «${est.monitor_rotulo}» (sin QFN: quirófano de notebook.json)`
      : " · Rótulo del monitor ilegible (quirófano de notebook.json)";
  }
  punto.className = `punto ${clase}`;
  texto.textContent = msj;
  error.classList.toggle("oculto", !(est.activa && est.error));
  error.textContent = est.error || "";
}

async function traerEstadoCaptura() {
  try { pintarCaptura(await pedirJSON("/api/captura/estado")); }
  catch (e) { /* servidor caído: lo nota el próximo poll */ }
}

document.getElementById("captura-iniciar").addEventListener("click", async () => {
  const intervalo = parseFloat(document.getElementById("captura-intervalo").value) || 30;
  try {
    await pedirJSON("/api/captura/iniciar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parte_id: ID, intervalo_s: intervalo }),
    });
    traerEstadoCaptura();
  } catch (e) { mostrarAviso(`No se pudo iniciar la captura: ${e.message}`); }
});

document.getElementById("captura-detener").addEventListener("click", async () => {
  try {
    await pedirJSON("/api/captura/detener", { method: "POST" });
    traerEstadoCaptura();
  } catch (e) { mostrarAviso(`No se pudo detener: ${e.message}`); }
});

// ------------------------------------------------------------------ nube

function pintarNube(est) {
  const conectar = document.getElementById("nube-conectar");
  const controles = document.getElementById("nube-controles");
  const error = document.getElementById("nube-error");
  const cuenta = document.getElementById("nube-cuenta");
  const desvincular = document.getElementById("nube-desvincular");
  conectar.classList.toggle("oculto", est.conectado);
  // Con la credencial VENCIDA (3-oct) el canje por código queda a la vista
  // sin tener que desconectar antes: el token nuevo pisa al viejo.
  document.getElementById("nube-conectar-codigo")
    .classList.toggle("oculto", est.conectado && !est.vencida);
  controles.classList.toggle("oculto", !est.conectado);
  // (3-oct) La credencial se renueva sola: se muestra hasta cuándo vale.
  // Vencida no hay canje posible: se pide vincular de nuevo.
  const fechaVence = est.vence ? new Date(est.vence).toLocaleDateString("es-AR") : "";
  cuenta.textContent = !est.conectado ? "" : `Cuenta: ${est.email}` + (
    !est.vence ? "" :
    est.vencida ? ` · credencial VENCIDA el ${fechaVence}: vinculá de nuevo con el código de la app`
                : ` · credencial hasta el ${fechaVence}, se renueva sola`);
  desvincular.classList.toggle("oculto", !est.conectado);
  if (!est.conectado) {
    error.classList.add("oculto");
    return;
  }
  const punto = document.getElementById("nube-punto");
  const texto = document.getElementById("nube-texto");
  document.getElementById("nube-detener").disabled = !est.activa;
  let clase = "punto-gris", msj = "Inactiva";
  if (est.activa) {
    if (est.parte_id !== ID) {
      clase = "punto-ambar";
      msj = `Subiendo el parte N° ${est.parte_id} (no este)`;
    } else if (est.error) {
      clase = "punto-rojo";
      msj = est.pendientes != null
        ? `Con error — ${est.pendientes} lecturas en cola local`
        : "Con error (reintenta solo)";
    } else if (est.ultima_subida || est.pendientes === 0) {
      clase = "punto-verde";
      msj = "En vivo — " +
            (est.ultima_subida ? `última subida ${fmtHora(est.ultima_subida)}` : "al día") +
            (est.pendientes ? ` (${est.pendientes} en cola)` : "");
    } else {
      clase = "punto-ambar";
      msj = "Conectando…";
    }
  }
  punto.className = `punto ${clase}`;
  texto.textContent = msj;
  error.classList.toggle("oculto", !(est.activa && est.error));
  error.textContent = est.error || "";
}

async function traerEstadoNube() {
  try { pintarNube(await pedirJSON("/api/nube/estado")); }
  catch (e) { /* servidor caído: lo nota el próximo poll */ }
}

document.getElementById("nube-vincular").addEventListener("click", async () => {
  const email = document.getElementById("nube-email").value.trim();
  const password = document.getElementById("nube-pass").value;
  if (!email || !password) return;
  const boton = document.getElementById("nube-vincular");
  boton.disabled = true;
  try {
    await pedirJSON("/api/nube/vincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    document.getElementById("nube-pass").value = "";
    traerEstadoNube();
  } catch (e) { mostrarAviso(`No se pudo conectar: ${e.message}`); }
  boton.disabled = false;
});

// Vinculación por CÓDIGO (31-ago): el médico lo genera en su app logueada
// (critidata.com/anestesia-app) — la contraseña no pasa por la notebook.
document.getElementById("nube-vincular-codigo").addEventListener("click", async () => {
  const codigo = document.getElementById("nube-codigo").value.trim().toUpperCase();
  if (!codigo) return;
  const boton = document.getElementById("nube-vincular-codigo");
  boton.disabled = true;
  try {
    await pedirJSON("/api/nube/vincular-codigo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo }),
    });
    document.getElementById("nube-codigo").value = "";
    traerEstadoNube();
  } catch (e) { mostrarAviso(`No se pudo vincular: ${e.message}`); }
  boton.disabled = false;
});

document.getElementById("nube-iniciar").addEventListener("click", async () => {
  try {
    await pedirJSON("/api/nube/iniciar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parte_id: ID }),
    });
    traerEstadoNube();
  } catch (e) { mostrarAviso(`No se pudo iniciar la subida: ${e.message}`); }
});

document.getElementById("nube-detener").addEventListener("click", async () => {
  try {
    await pedirJSON("/api/nube/detener", { method: "POST" });
    traerEstadoNube();
  } catch (e) { mostrarAviso(`No se pudo detener: ${e.message}`); }
});

document.getElementById("nube-desvincular").addEventListener("click", async (e) => {
  e.preventDefault();
  if (!confirm("¿Desconectar la cuenta de CritiData? La subida en vivo se detiene.")) return;
  try {
    await pedirJSON("/api/nube/desvincular", { method: "POST" });
    traerEstadoNube();
  } catch (err) { mostrarAviso(`No se pudo desconectar: ${err.message}`); }
});

// ---------------------------------------------------------------- cierre

document.getElementById("boton-cerrar").addEventListener("click", async () => {
  if (!confirm("¿Cerrar el parte? La captura automática se detiene.")) return;
  try {
    await guardarPendientes();
    if (Object.keys(pendientes).length) throw new Error("quedaron cambios sin guardar");
    // (5-oct-2026) El cierre corta la captura si era de este parte y frena
    // el arranque solo: lo hace el servidor, que así anota el motivo como
    // "cierre del parte" y no como un Detener.
    await pedirJSON(`/api/partes/${ID}/cerrar`, { method: "POST" });
    ponerEstado("cerrado");
  } catch (e) { mostrarAviso(`No se pudo cerrar: ${e.message}`); }
});

// --------------------------------------------------------------- arranque

(async function arrancar() {
  let parte;
  try {
    parte = await pedirJSON(`/api/partes/${ID}`);
  } catch (e) {
    mostrarAviso(`No se pudo cargar el parte: ${e.message}`);
    return;
  }
  datosParte = parte.datos || {};
  ponerNombreTitulo();
  ponerEstado(parte.estado);
  construirFormulario();
  pintarTarjetas();
  pintarGrafico();
  traerEventos();
  traerVitales().catch(() => {});
  traerEstadoCaptura();
  traerEstadoNube();
  setInterval(() => {
    traerVitales().catch(() => {});
    traerEstadoCaptura();
    traerEstadoNube();
    // la lista de drogas también (11-sep): el poller ubica las drogas
    // con gatillo a los segundos del episodio y hay que verlo sin
    // recargar la página
    traerEventos().catch(() => {});
  }, 5000);
})();
