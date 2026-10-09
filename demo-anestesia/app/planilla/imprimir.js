// Render de impresión calcado del formulario papel (foto del Anexo V):
// encabezado en líneas, opciones impresas que se rodean, casilleros con
// puntos, grilla central cuadriculada (drogas + gráfico + filas numéricas)
// y pie con técnica / vía aérea / estado final / destino / firma.
"use strict";

// ?id= como siempre, o ?dni= (22-sep, "Ver parte" desde la tarjeta del
// celular): la planilla del parte MAS RECIENTE de ese DNI, sin conocer el id.
let ID = parseInt(new URLSearchParams(location.search).get("id"), 10);
const DNI = new URLSearchParams(location.search).get("dni");
// El TIPO DE PARTE (9-oct-2026, "sobre la base del parte vamos a diseñar otro
// que se va a llamar CGS: no va a tener condición al ingreso ni
// premedicación, y el área destinada a bloqueos va a tener un título (pre
// anestésico)"): la MISMA planilla con ?tipo=cgs. Sin el parámetro (o con
// cualquier otro), el Anexo V de siempre, idéntico.
const TIPO = (new URLSearchParams(location.search).get("tipo") || "").toLowerCase() === "cgs"
  ? "cgs" : "anexo_v";
const NOMBRE_TIPO = TIPO === "cgs" ? "CGS" : "Anexo V";

// Los antecedentes y las cirugías anteriores viajan en UN renglón
// (renglonAntecedentes de la app: "HTA, DBT. Cirugías previas: …", porque el
// Anexo V no tiene renglón aparte); el recuadro "Pre anestésico" del CGS
// (9-oct-2026) los imprime separados. Puro.
function partirAntecedentes(texto) {
  const t = String(texto || "").trim();
  const m = t.match(/^([\s\S]*?)(?:\.\s*)?Cirugías previas:\s*([\s\S]*)$/);
  if (!m) return { antecedentes: t, cirugias: "" };
  return { antecedentes: m[1].trim(), cirugias: m[2].trim() };
}
if (Number.isInteger(ID)) document.getElementById("volver").href = `parte.html?id=${ID}`;

const hoja = document.getElementById("hoja");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const buscarCampo = (id) => {
  for (const s of window.ESQUEMA_FORMULARIO.secciones) {
    const c = s.campos.find((c) => c.id === id);
    if (c) return c;
  }
  return null;
};

// ---------------------------------------------- piezas del formulario papel

let DATOS = {};

function crudo(id) {
  const v = DATOS[id];
  return v == null || v === "" ? null : v;
}

// "Etiqueta: ....valor...." (línea punteada con el valor en negrita encima)
function campo(id, tam = "", etiqueta = null) {
  const c = buscarCampo(id);
  let v = crudo(id);
  if (c.tipo === "fecha" && /^\d{4}-\d{2}-\d{2}$/.test(v || "")) {
    v = `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(2, 4)}`;   // como se escribe a mano
  }
  return `<span class="et">${esc(etiqueta ?? c.etiqueta)}:</span>` +
         `<span class="relleno ${tam}">${esc(Array.isArray(v) ? v.join(", ") : v ?? "")}</span>`;
}

// El AGENTE y la DOSIS del cuadro de BLOQUEOS (27-sep, pedido expreso:
// "el sevorane figura en el parte en el area de bloqueos"): ese renglon
// es el anestesico local del bloqueo, no el mantenimiento de la General.
// La app lo manda aparte (agente_bloqueo / dosis_bloqueo) y
// agente_anestesico sigue con TODO porque el consumo del sevo vive de el.
// En un parte de antes: sin bloqueo en tipo_anestesia, nada; con bloqueo
// (o sin tipo), agente_anestesico sin los inhalatorios, con su dosis
// apareada por posicion.
const INHALATORIO = /sevo|isofl|forane|desfl|halot|oxido nitroso|óxido nitroso|\bn2o\b/i;
const TIPOS_BLOQUEO = /raqu|perid|plexu|perif/i;
function agenteDelBloqueo(d) {
  if (d.agente_bloqueo != null) {
    return { agente: d.agente_bloqueo, dosis: d.dosis_bloqueo || "" };
  }
  if (d.tipo_anestesia && !TIPOS_BLOQUEO.test(d.tipo_anestesia)) {
    return { agente: "", dosis: "" };
  }
  const agentes = String(d.agente_anestesico || "").split(" / ");
  const dosis = String(d.dosis_agente || "").split(" / ");
  const quedan = agentes
    .map((a, i) => [a.trim(), (dosis[i] || "").trim()])
    .filter(([a]) => a && !INHALATORIO.test(a));
  return {
    agente: quedan.map(([a]) => a).join(" / "),
    dosis: quedan.some(([, x]) => x && x !== "—")
      ? quedan.map(([, x]) => x || "—").join(" / ")
      : "",
  };
}

// "Etiqueta: Op1 - Op2 - Op3" con la elegida rodeada. El ASA puede
// traer "3 E" (clase + emergencia, 8-sep): se rodea POR TOKEN con
// igualdad exacta — jamás substring (la lección de los checks).
function ops(id, etiqueta = null) {
  const c = buscarCampo(id);
  const v = crudo(id);
  const partes = String(v ?? "").split(/[\s,]+/).filter(Boolean);
  const os = c.opciones.map((o) =>
    `<span class="op${partes.includes(o) ? " sel" : ""}">${esc(o)}</span>`
  ).join('<span class="sep">-</span>');
  return `<span class="et">${esc(etiqueta ?? c.etiqueta)}:</span><span class="ops">${os}</span>`;
}

// "Etiqueta SI / NO" con el elegido rodeado
function sino(id, etiqueta = null) {
  const c = buscarCampo(id);
  const v = crudo(id);
  const os = ["Sí", "No"].map((o) =>
    `<span class="op${v === o ? " sel" : ""}">${esc(o.toUpperCase())}</span>`
  ).join('<span class="sep">/</span>');
  return `<span class="et">${esc(etiqueta ?? c.etiqueta)}</span><span class="ops">${os}</span>`;
}

// "Etiqueta: ☑ A ☐ B ☐ C" (etiqueta "" = solo los casilleros)
function checks(id, etiqueta = null) {
  const c = buscarCampo(id);
  const v = crudo(id) || [];
  const os = c.opciones.map((o) => {
    const marcada = v.includes(o);
    return `<span class="chk${marcada ? " sel" : ""}">` +
           `<span class="caja">${marcada ? "☑" : "☐"}</span> ${esc(o)}</span>`;
  }).join(" ");
  const rot = etiqueta ?? c.etiqueta;
  return (rot === "" ? "" : `<span class="et">${esc(rot)}:</span> `) + os;
}

// "Etiqueta ☐" — casillero suelto como el papel (marcado si el siNo es "Sí")
function chkSiNo(id, etiqueta = null) {
  const c = buscarCampo(id);
  const marcado = crudo(id) === "Sí";
  return `<span class="chk${marcado ? " sel" : ""}">${esc(etiqueta ?? c.etiqueta)} ` +
         `<span class="caja">${marcado ? "☑" : "☐"}</span></span>`;
}

// "Etiqueta: ☐ A ☐ B ☐ C" — opciones únicas con casillero (así están en el
// papel: □Oral □Nasal…, □SALA GENERAL □RECUPERACIÓN □UCI…)
function opsCajas(id, etiqueta = null) {
  const c = buscarCampo(id);
  const v = crudo(id);
  const os = c.opciones.map((o) => {
    const marcada = v === o;
    return `<span class="chk${marcada ? " sel" : ""}">` +
           `<span class="caja">${marcada ? "☑" : "☐"}</span> ${esc(o)}</span>`;
  }).join(" ");
  return `<span class="et">${esc(etiqueta ?? c.etiqueta)}:</span> ${os}`;
}

// eventos que en el papel se marcan sobre la grilla: X anestesia, O operación
const marcaGrilla = (desc) =>
  /anest|inducc/i.test(desc) ? "X" : /ciru|opera/i.test(desc) ? "O" : null;

// colores de las series (los de la pantalla, oscurecidos para el papel)
// La TINTA de las letras (9-oct-2026, "en el diseño del parte, ¿podemos
// poner una letra menos negra?"): un gris muy oscuro en vez del negro puro,
// en la hoja (imprimir.html: body) y en la grilla. Con Arial Narrow no hay
// grosor intermedio entre normal y negrita, así que la negrita de los
// valores queda y lo que se aclara es el tono. Las líneas y los recuadros
// del formulario siguen en negro; los colores de las series, como estaban.
const TINTA = "#333";

const COLORES = {
  nibp_sis: "#c62828",   // TAS roja
  nibp_dia: "#e07b00",   // TAD naranja
  hr: "#2e7d32",         // FC verde
  spo2: "#0091ea",       // SpO2 celeste vivo (resaltada)
  etco2: "#8e44ad",      // etCO2 violeta
  sev: "#a8770b",        // Sev ámbar
};

const linea = (...partes) => `<div class="linea">${partes.join("")}</div>`;
const titulo = (t) => `<span class="et tit">${esc(t)}</span>`;

// ---------------------------------------------- tiempo y submuestreo

const aMs = (iso) => new Date(iso).getTime();

function fechaBase(datos, vitales, eventos) {
  if (vitales.length) return vitales[0].ts.slice(0, 10);
  if (eventos.length) return eventos[0].ts.slice(0, 10);
  if (datos.fecha) return datos.fecha;
  return new Date().toISOString().slice(0, 10);
}

function mediana(valores) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// Los numeros como se escriben ACA (21-sep, "¿no se puede poner punto en
// los miles y coma en los decimales en la planilla?"): punto de miles,
// coma decimal, hasta dos decimales. Lo guardado y lo que viaja siguen
// PLANOS ("1444.03"): esto es solo para leerlo en el papel. Lo que no es
// un numero ("a demanda", "×") pasa tal cual.
function fmtCriollo(v) {
  if (v == null || v === "") return "";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return String(v);
  const r = Math.round(n * 100) / 100;
  const [ent, dec] = Math.abs(r).toString().split(".");
  const miles = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return (r < 0 ? "-" : "") + miles + (dec ? `,${dec}` : "");
}

// El Total de una DROGA en mg pasa a GRAMOS al llegar a 1000 (21-sep,
// "cuando suman 1000 mg pasara a gramos, ejemplo 1 gramo"): 1000 → "1 g",
// 1500 → "1,5 g". Solo en las drogas y solo en mg; los fluidos siguen en
// ml y las otras unidades (µg, UI) quedan como estan.
function fmtDosisTotal(n, unidad) {
  const u = String(unidad || "").trim();
  if (u === "mg" && Number.isFinite(n) && n >= 1000) return `${fmtCriollo(n / 1000)} g`;
  return `${fmtCriollo(n)}${u ? ` ${u}` : ""}`;
}

function fmtValor(clave, v) {
  if (v == null) return "";
  if (["sev_et", "sev_fi", "mv", "mac"].includes(clave)) {
    return fmtCriollo(Math.round(v * 10) / 10);
  }
  return Math.round(v).toString();
}

// ---------------------------------------------- grilla central (SVG)

function construirGrilla(datos, vitales, eventos) {
  const cfg = window.VITALES_GRAFICO;
  const base = fechaBase(datos, vitales, eventos);
  // Las drogas del celular SIN hora en la grilla (ubicado 0, 11-sep) no
  // definen el eje de tiempo: su ts es de registro, no de administración.
  // El CONSUMO de una infusión (gatillo "consumo", 15-sep: los mg que
  // calculó el cierre) tampoco: vive solo en la celda Total de su renglón.
  const esConsumo = (e) => e.gatillo === "consumo";
  // El CONSUMO del SEVORANE (27-sep, pedido expreso: "se puede poner el
  // consumo de sevorane en mililitros", en la columna Total de la fila
  // Sev %): el que agrega el cierre como "Sevorane (consumo)" en ml va a
  // esa celda y no repite renglon en la tabla de drogas.
  const esConsumoSevo = (e) =>
    e.tipo === "droga" && /sevo/i.test(e.descripcion || "") &&
    /\(consumo\)/i.test(e.descripcion || "");
  const consumoSevo = eventos.find(esConsumoSevo);
  const conHora = (e) => !esConsumo(e) && e.ubicado !== 0 && e.ubicado !== false;
  // Unidad de TASA de infusión ("µg/kg/min", "mg/h"; "ml/h" es volumen,
  // no droga): en ese renglón el Total NO suma las tasas de los tramos
  // (0,25 + 0,1 no significa nada) sino que muestra el consumo en mg.
  const esUnidadTasa = (u) => {
    const t = String(u ?? "").trim().toLowerCase();
    return !t.startsWith("ml") && (t.includes("/min") || t.includes("/h"));
  };
  const marcas = [...vitales.map((v) => aMs(v.ts)),
                  ...eventos.filter(conHora).map((e) => aMs(e.ts))]
    .filter(Number.isFinite);

  let t0 = datos.hora_ingreso ? aMs(`${base}T${datos.hora_ingreso}:00`) : null;
  let t1 = datos.hora_fin ? aMs(`${base}T${datos.hora_fin}:00`) : null;
  if (t0 == null) t0 = marcas.length ? Math.min(...marcas) : Date.now();
  if (t1 == null || t1 < t0) t1 = marcas.length ? Math.max(...marcas) : t0;
  if (t1 - t0 < 55 * 60000) t1 = t0 + 55 * 60000;   // grilla mínima ~1 h

  // columnas de 5 min como el papel; se agrandan solo si el caso es muy largo
  let minCol = cfg.minutosPorColumna;
  for (const m of [5, 10, 15, 20, 30]) {
    minCol = m;
    if ((t1 - t0) / 60000 / m <= 48) break;   // 4 h entran en columnas de 5 min
  }
  const slotMs = minCol * 60000;
  t0 = Math.floor(t0 / slotMs) * slotMs;
  const nCol = Math.ceil((t1 - t0) / slotMs);

  const IZQ = 86, DER = 3;
  const ANCHO_UCIL = 650;              // ancho interno fijo: la letra no cambia
  const ANCHO_TOT = 30;                // columna Total: volumen acumulado a mano
  const anchoCol = (ANCHO_UCIL - ANCHO_TOT) / nCol;
  const ancho = IZQ + ANCHO_UCIL + DER;
  const xTot = IZQ + ANCHO_UCIL - ANCHO_TOT;
  const ALTO_HORA = 13, ALTO_DROGA = 13, ALTO_GRAF = 235, ALTO_FILA = 13;

  // Un renglón por droga — y, desde el 15-sep, la INFUSIÓN de una droga en
  // su propio renglón, aparte de sus bolos ("Propofol" con los 150 mg de la
  // inducción y "Propofol (mg/kg/h)" con los tramos y el consumo): en un
  // solo renglón el Total no podía ser a la vez la suma de los bolos y el
  // consumo de la infusión, y el bolo desaparecía del parte impreso (y el
  // rótulo con la unidad de la tasa hacía leer "150" como 150 mg/kg/h).
  // UNA fila por droga, siempre (21-sep, "que no se repita en otra fila,
  // solo una fila de la misma"): el bolo y la infusion de la misma droga
  // comparten renglon — el bolo en su columna con su unidad, la tasa en
  // la suya con la barra, y el Total sumando bolo + consumo. Del 15-sep
  // al 21 iban en dos renglones ("Propofol" y "Propofol (inf.)").
  const claveRenglon = (e) => e.descripcion;
  const drogas = [];
  for (const e of eventos) {
    if (e.tipo === "droga" && !esConsumoSevo(e) &&
        !drogas.includes(claveRenglon(e))) drogas.push(claveRenglon(e));
  }
  // sin filas en blanco: el cuadro crece a medida que se cargan drogas
  // SpO2, etCO2 y Sev no van como filas: van dentro del cuadro de TA/FC
  // (los parámetros del respirador sí quedan como filas)
  // tabla superior del papel: los volúmenes no son filas fijas — se van
  // sumando a la grilla a medida que se cargan en la app (eventos tipo
  // "volumen"), igual que las drogas; sin renglones vacíos de reserva
  const volumenes = [];
  for (const e of eventos) {
    if (e.tipo === "volumen" && e.descripcion !== "Diuresis" &&
        !volumenes.includes(e.descripcion)) {
      volumenes.push(e.descripcion);
    }
  }
  // BALANCE (20-sep, pedido expreso: "debajo de la fila de diuresis una
  // que diga el balance y lo calcule"): ingresos menos diuresis, por
  // columna y en el Total. SOLO si hay diuresis cargada ("el balance solo
  // si se incorpora la diuresis"): sin lo que sale no es un balance, es
  // el total de ingresos otra vez — y un renglon de mas en un papel que
  // ya viene apretado.
  const hayDiuresis = eventos.some(
    (e) => e.tipo === "volumen" && e.descripcion === "Diuresis" &&
           e.dosis != null && e.dosis !== "");
  // TOTAL INGRESOS (22-sep, "en el parte falta un total de ingresos"):
  // la suma de TODOS los renglones de volumen (fluidos y hemoderivados),
  // columna por columna y en el Total, entre el ultimo volumen y la
  // diuresis. Solo si hay algun volumen cargado.
  const FILAS_SUP = [...volumenes, ...(volumenes.length ? ["Total ingresos"] : []),
                     "Diuresis", ...(hayDiuresis ? ["Balance"] : []),
                     "Sev %", "Sat %", "pCO2"];
  const alto = ALTO_HORA + FILAS_SUP.length * ALTO_FILA +
               ALTO_GRAF + drogas.length * ALTO_DROGA + 3;

  const S = [];
  S.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" ` +
         `font-family="Arial Narrow, Arial, sans-serif">`);
  const lin = (x1, y1, x2, y2, g = 0.5) =>
    S.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${g}"/>`);
  const txt = (x, y, t, extra = "") =>
    S.push(`<text x="${x}" y="${y}" ${/fill=/.test(extra) ? "" : `fill="${TINTA}" `}${extra}>${esc(t)}</text>`);
  const xCol = (i) => IZQ + i * anchoCol;
  const slotDe = (ts) => Math.min(nCol - 1, Math.max(0, Math.floor((aMs(ts) - t0) / slotMs)));

  lin(0, 0.5, ancho, 0.5, 0.9);   // borde superior (las claves van en el gráfico)

  // fila de horas — arriba de todo: un solo eje de tiempo que rige las tres
  // tablas (valores, gráfico y drogas) de arriba hacia abajo
  const cadaCuantas = Math.max(1, Math.ceil(15 / minCol));   // rótulo ~cada 15 min
  txt(2, 10.5, "Hora", 'font-size="7" font-weight="700"');
  for (let i = 0; i < nCol; i += 1) {
    if (i % cadaCuantas === 0) {
      txt(xCol(i) + 1.2, 10.5,
          new Date(t0 + i * slotMs).toTimeString().slice(0, 5), 'font-size="6.4"');
    }
  }
  txt(xTot + ANCHO_TOT / 2, 10.5, "Total",
      'font-size="6.4" font-weight="700" text-anchor="middle"');
  lin(0, ALTO_HORA, ancho, ALTO_HORA, 0.9);

  // ---- tabla 1: valores de gases/sat y aportes ----
  const anotarFila = (y, etiqueta, valores, total = null) => {
    txt(2, y + 9, etiqueta, 'font-size="6.4" font-weight="700"');
    for (let i = 0; i <= nCol; i++) lin(xCol(i), y, xCol(i), y + ALTO_FILA, 0.15);
    for (const [s, t] of Object.entries(valores || {})) {
      const cx = xCol(+s) + anchoCol / 2, cy = y + 9;
      if (anchoCol < 21 && t.length > 2) {
        txt(cx, cy, t, `font-size="${t.length > 4 ? 4.6 : 5.4}" ` +
            `text-anchor="middle" transform="rotate(-90 ${cx} ${cy})"`);
      } else {
        txt(cx, cy, t, `font-size="${t.length > 5 ? 5 : 6}" text-anchor="middle"`);
      }
    }
    if (total != null) {
      txt(xTot + ANCHO_TOT / 2, y + 9, String(total),
          'font-size="6" font-weight="700" text-anchor="middle"');
    }
    // TODAS las filas cierran su celda Total (27-sep, pedido expreso: "los
    // espacios en blanco en la columna del total donde se ubican sev, sat,
    // pco2 continua la fila hasta el final"); antes las numericas dejaban
    // la franja lisa, como en el grafico
    lin(0, y + ALTO_FILA, ancho, y + ALTO_FILA, 0.3);
  };
  const valoresDe = (key) => {
    const porSlot = {};
    for (const v of vitales) {
      if (v[key] == null) continue;
      (porSlot[slotDe(v.ts)] ||= []).push(v[key]);
    }
    const out = {};
    for (const [s, vals] of Object.entries(porSlot)) out[s] = fmtValor(key, mediana(vals));
    return out;
  };
  const valoresSevFila = () => {
    const porSlot = {};
    for (const v of vitales) {
      if (v.sev_et == null && v.sev_fi == null) continue;
      (porSlot[slotDe(v.ts)] ||= []).push(v);
    }
    const out = {};
    for (const [s, vs] of Object.entries(porSlot)) {
      const et = mediana(vs.map((v) => v.sev_et).filter((x) => x != null));
      const fi = mediana(vs.map((v) => v.sev_fi).filter((x) => x != null));
      const t = [et, fi].filter((x) => x != null).map((x) => fmtValor("sev_et", x)).join("/");
      if (t) out[s] = t;
    }
    return out;
  };
  const datosSup = {
    "Sev %": valoresSevFila(),
    "pCO2": valoresDe("etco2"),
    "Sat %": valoresDe("spo2"),
  };
  // renglón de volumen: dosis por columna horaria y suma para el Total
  const volumenFila = (nombre) => {
    const porSlot = {};
    let suma = 0, alguno = false, sumable = true;
    for (const e of eventos) {
      if (e.tipo !== "volumen" || !nombre || e.descripcion !== nombre) continue;
      const s = slotDe(e.ts);
      const etq = e.dosis ? fmtCriollo(e.dosis) : "×";
      porSlot[s] = porSlot[s] ? `${porSlot[s]}+${etq}` : etq;
      alguno = true;
      const n = e.dosis != null && e.dosis !== "" ? Number(e.dosis) : NaN;
      if (Number.isFinite(n)) suma += n; else sumable = false;
    }
    // sin dosis numéricas no hay suma automática: la celda queda para la mano
    const total = alguno && sumable ? fmtCriollo(suma) : null;
    return { valores: porSlot, total };
  };
  // Los ml de un renglon de volumen por columna, en NUMERO: el texto de
  // la fila puede decir "500+500" y el balance necesita la cuenta.
  const mlPorSlot = (nombre) => {
    const out = {};
    for (const e of eventos) {
      if (e.tipo !== "volumen" || e.descripcion !== nombre) continue;
      const n = e.dosis != null && e.dosis !== "" ? Number(e.dosis) : NaN;
      if (!Number.isFinite(n)) continue;
      const s = slotDe(e.ts);
      out[s] = (out[s] || 0) + n;
    }
    return out;
  };
  // TOTAL INGRESOS: todos los renglones de volumen sumados, columna por
  // columna y en el Total, sin signo (es lo que entro).
  const ingresosFila = () => {
    const porSlot = {};
    let total = 0, alguno = false;
    for (const nombre of volumenes) {
      for (const [s, ml] of Object.entries(mlPorSlot(nombre))) {
        porSlot[s] = (porSlot[s] || 0) + ml;
        total += ml;
        alguno = true;
      }
    }
    if (!alguno) return { valores: {}, total: null };
    const valores = {};
    for (const [s, n] of Object.entries(porSlot)) valores[s] = fmtCriollo(n);
    return { valores, total: fmtCriollo(total) };
  };
  // El BALANCE: lo que entro (todos los renglones de volumen) menos lo
  // que salio (la diuresis), columna por columna; el Total es el neto de
  // la cirugia. Con signo SIEMPRE: un balance sin signo no se lee.
  const balanceFila = () => {
    const porSlot = {};
    let total = 0, alguno = false;
    for (const nombre of [...volumenes, "Diuresis"]) {
      const signo = nombre === "Diuresis" ? -1 : 1;
      for (const [s, ml] of Object.entries(mlPorSlot(nombre))) {
        porSlot[s] = (porSlot[s] || 0) + signo * ml;
        total += signo * ml;
        alguno = true;
      }
    }
    if (!alguno) return { valores: {}, total: null };
    const conSigno = (n) => (n > 0 ? `+${fmtCriollo(n)}` : fmtCriollo(n));
    const valores = {};
    for (const [s, n] of Object.entries(porSlot)) valores[s] = conSigno(n);
    return { valores, total: conSigno(total) };
  };
  let ySup = ALTO_HORA;
  const primeraNum = FILAS_SUP.indexOf("Sev %");
  // La DIURESIS, el TOTAL INGRESOS y el BALANCE van SOLO en la columna
  // Total (27-sep, pedido expreso: "la diuresis total y los ingresos y
  // balance en el parte anestesico van en la ultima columna de total"):
  // por hora no se leen; los fluidos y hemoderivados siguen en su hora.
  for (const [f, etq] of FILAS_SUP.entries()) {
    if (etq === "Balance") {
      anotarFila(ySup + f * ALTO_FILA, etq, {}, balanceFila().total);
    } else if (etq === "Total ingresos") {
      anotarFila(ySup + f * ALTO_FILA, etq, {}, ingresosFila().total);
    } else if (etq === "Diuresis") {
      anotarFila(ySup + f * ALTO_FILA, etq, {}, volumenFila(etq).total);
    } else if (f < primeraNum) {
      const { valores, total } = volumenFila(etq);
      anotarFila(ySup + f * ALTO_FILA, etq, valores, total);
    } else if (etq === "Sev %" && consumoSevo && consumoSevo.dosis != null &&
               consumoSevo.dosis !== "") {
      anotarFila(ySup + f * ALTO_FILA, etq, datosSup[etq],
                 `${fmtCriollo(consumoSevo.dosis)} ml`);
    } else {
      anotarFila(ySup + f * ALTO_FILA, etq, datosSup[etq]);
    }
  }
  // separador grueso (como el de los tres cuadros) entre volúmenes+diuresis
  // y los valores numéricos
  const yDivSup = ySup + FILAS_SUP.indexOf("Sev %") * ALTO_FILA;
  lin(0, yDivSup, ancho, yDivSup, 0.9);
  let yTope = ySup + FILAS_SUP.length * ALTO_FILA;
  lin(0, yTope, ancho, yTope, 0.9);

  // zona de gráfico cuadriculada (Y 0–220) — arriba, pegada a las claves,
  // como el papel
  const yG0 = yTope, yG1 = yTope + ALTO_GRAF, Y_MAX = 220;
  const yDe = (v) => yG1 - (Math.max(0, Math.min(Y_MAX, v)) / Y_MAX) * ALTO_GRAF;
  for (let v = 0; v <= Y_MAX; v += 10) {
    lin(IZQ, yDe(v), xTot, yDe(v),
        v % 100 === 0 ? 0.6 : v % 20 === 0 ? 0.3 : 0.12);
    if (v % 20 === 0) txt(IZQ - 3, yDe(v) + 2.1, String(v), 'font-size="5.8" text-anchor="end"');
  }
  const pasoY = ALTO_GRAF / 22;                        // alto de cada cuadradito
  const sub = Math.max(1, Math.round(anchoCol / pasoY));
  for (let i = 0; i <= nCol; i++) {
    lin(xCol(i), yG0, xCol(i), yG1, i % cadaCuantas === 0 ? 0.45 : 0.2);
    if (i < nCol) {
      // subdivisión de la columna: celdas ~cuadradas, como el papel cuadriculado
      for (let j = 1; j < sub; j++) {
        const x = xCol(i) + (j * anchoCol) / sub;
        lin(x, yG0, x, yG1, 0.1);
      }
    }
  }
  // claves apiladas en la primera columna del gráfico (única celda alta:
  // acá reemplazan a la vieja fila "Claves:" de la cabecera)
  const claves = [
    ["Claves:", TINTA],
    ["X Anestesia", TINTA],
    ["O Operación", TINTA],
    ["│ TA (TAS–TAD)", COLORES.nibp_sis],
    ["   (Nº = PAM)", COLORES.nibp_sis],
    ["● FC", COLORES.hr],
    ["○ SpO2", COLORES.spo2],
    ["◆ etCO2", COLORES.etco2],
    ["Sev% Et/Fi al pie", COLORES.sev],
    // las marcas (22-sep), en la columna de referencias como el resto de
    // los simbolos — cada una solo si el parte la tiene
    ...(eventos.some((e) => e.tipo === "practica") ? [["✱ Práctica", "#1d5fc4"]] : []),
    ...(eventos.some((e) => e.tipo === "critico") ? [["✱ Evento crítico", COLORES.nibp_sis]] : []),
  ];
  for (const [f, [t, color]] of claves.entries()) {
    txt(3, yG0 + 12 + f * 10.5, t, `font-size="6.2" font-weight="700" fill="${color}"`);
  }
  // series puntuales, agregadas por slot (también sirven para que la etiqueta
  // de la PAM sepa qué alturas están ocupadas)
  const agregadoPorSlot = (key) => {
    const porSlot = {};
    for (const v of vitales) {
      if (v[key] == null) continue;
      (porSlot[slotDe(v.ts)] ||= []).push(v[key]);
    }
    const out = {};
    for (const [s, vals] of Object.entries(porSlot)) out[s] = mediana(vals);
    return out;
  };
  const series = [
    { key: "hr", simbolo: "●", vals: agregadoPorSlot("hr") },
    { key: "spo2", simbolo: "○", vals: agregadoPorSlot("spo2") },
    { key: "etco2", simbolo: "◆", vals: agregadoPorSlot("etco2") },
  ];

  // TA como vela delgada TAS–TAD, con la PAM anotada en su interior
  const velasTA = {};
  for (const v of vitales) {
    if (v.nibp_sis == null || v.nibp_dia == null) continue;
    (velasTA[slotDe(v.ts)] ||= []).push(v);
  }
  for (const [s, vs] of Object.entries(velasTA)) {
    const sis = mediana(vs.map((v) => v.nibp_sis));
    const dia = mediana(vs.map((v) => v.nibp_dia));
    const pams = vs.map((v) => v.nibp_pam).filter((x) => x != null);
    const pam = pams.length ? mediana(pams) : (sis + 2 * dia) / 3;
    const cx = xCol(+s) + anchoCol / 2;
    const y1 = yDe(sis), y2 = yDe(dia);
    S.push(`<line x1="${cx}" y1="${y1}" x2="${cx}" y2="${y2}" ` +
           `stroke="${COLORES.nibp_sis}" stroke-width="1.2"/>`);
    S.push(`<line x1="${cx - 2}" y1="${y1}" x2="${cx + 2}" y2="${y1}" ` +
           `stroke="${COLORES.nibp_sis}" stroke-width="1"/>`);
    S.push(`<line x1="${cx - 2}" y1="${y2}" x2="${cx + 2}" y2="${y2}" ` +
           `stroke="${COLORES.nibp_sis}" stroke-width="1"/>`);
    // etiqueta de la PAM: si pisa una marca (FC/SpO2/etCO2 del mismo slot),
    // se corre apenas hacia arriba o abajo de la TAM, al hueco más cercano
    const ocupados = series.map((se) => se.vals[s]).filter((x) => x != null).map(yDe);
    const libre = (y) => (ocupados.length
      ? Math.min(...ocupados.map((o) => Math.abs(o - y))) : Infinity);
    let yp = yDe(pam);
    if (libre(yp) < 5.5) {
      let mejor = yp, mejorD = libre(yp);
      for (const c of [yp - 6, yp + 6, yp - 9, yp + 9]) {
        const d = libre(c);
        if (d > mejorD + 0.01) { mejor = c; mejorD = d; }
        if (mejorD >= 5.5) break;
      }
      yp = Math.max(yG0 + 4, Math.min(yG1 - 4, mejor));
    }
    S.push(`<rect x="${cx - 5.2}" y="${yp - 2.9}" width="10.4" height="5.8" ` +
           `fill="#fff" opacity="0.92"/>`);
    txt(cx, yp + 1.9, String(Math.round(pam)),
        `font-size="4.9" font-weight="700" text-anchor="middle" fill="${COLORES.nibp_sis}"`);
  }

  // los símbolos NO se desplazan: su altura es el valor (los separa el color)
  for (const serie of series) {
    for (const [s, val] of Object.entries(serie.vals)) {
      const cx = xCol(+s) + anchoCol / 2, cy = yDe(val);
      if (serie.key === "spo2") {
        // la saturación resaltada: círculo real, grande y de trazo grueso
        S.push(`<circle cx="${cx}" cy="${cy}" r="2.6" fill="none" ` +
               `stroke="${COLORES.spo2}" stroke-width="1.3"/>`);
      } else {
        txt(cx, cy + 2.7, serie.simbolo,
            `font-size="8.5" font-weight="700" text-anchor="middle" fill="${COLORES[serie.key]}"`);
      }
    }
  }
  // Sev % (Et/Fi): anotado como número al pie del cuadro, en su columna
  // (a escala del eje 0–220 quedaría aplastado contra el cero)
  const sevPorSlot = {};
  for (const v of vitales) {
    if (v.sev_et == null && v.sev_fi == null) continue;
    (sevPorSlot[slotDe(v.ts)] ||= []).push(v);
  }
  let sevAnterior = null;
  for (const s of Object.keys(sevPorSlot).map(Number).sort((a, b) => a - b)) {
    const vs = sevPorSlot[s];
    const et = mediana(vs.map((v) => v.sev_et).filter((x) => x != null));
    const fi = mediana(vs.map((v) => v.sev_fi).filter((x) => x != null));
    const partes = [et, fi].filter((x) => x != null).map((x) => fmtValor("sev_et", x));
    const t = partes.join("/");
    // se anota solo cuando cambia, como en el papel (si no, se pisa entre columnas)
    if (t && t !== sevAnterior) {
      txt(xCol(s) + anchoCol / 2, yG1 - 3, t,
          `font-size="4.8" text-anchor="middle" fill="${COLORES.sev}" font-weight="700"`);
      sevAnterior = t;
    }
  }
  // marcas X (anestesia) y O (operación) arriba del gráfico, como el papel
  for (const e of eventos) {
    if (e.tipo === "droga") continue;
    const m = marcaGrilla(e.descripcion);
    if (m) {
      txt(xCol(slotDe(e.ts)) + anchoCol / 2, yG0 + 9, m,
          'font-size="9" font-weight="700" text-anchor="middle"');
    }
  }
  // Las PRACTICAS y los EVENTOS CRITICOS (22-sep, pedido expreso): un
  // asterisco grande en la columna de su hora — azul la practica, rojo el
  // evento critico — y el texto de cada uno listado al pie del parte.
  for (const e of eventos) {
    if (e.tipo !== "practica" && e.tipo !== "critico") continue;
    if (!e.ts) continue;
    const xM = xCol(slotDe(e.ts)) + anchoCol / 2;
    const color = e.tipo === "critico" ? COLORES.nibp_sis : "#1d5fc4";
    txt(xM, yG0 + 22, "✱",
        `font-size="13" font-weight="700" text-anchor="middle" fill="${color}"`);
    // el evento critico con fin: una raya roja desde el comienzo hasta el
    // fin ("hora de comienzo y finalizacion, ubicada en relacion al parte")
    const dur = Number(e.duracion) || 0;
    if (dur > 0) {
      const xF = IZQ + Math.min(nCol, Math.max(0, (aMs(e.ts) + dur * 60000 - t0) / slotMs)) * anchoCol;
      S.push(`<line x1="${xM.toFixed(2)}" y1="${(yG0 + 24).toFixed(2)}" ` +
                  `x2="${xF.toFixed(2)}" y2="${(yG0 + 24).toFixed(2)}" ` +
                  `stroke="${color}" stroke-width="1.4"/>`);
    }
  }
  yTope = yG1;
  lin(0, yTope, ancho, yTope, 0.9);

  // renglones de drogas — pegados debajo del gráfico, con el rótulo vertical
  // DROGAS en el margen, como el papel
  const yD0 = yTope;
  // la letra del Total, por largo: "10" (7), "1.33 mg" (6.4), "0.014 mg" (5.2)
  const tamTotal = (t) => t.length <= 4 ? 7 : t.length <= 7 ? 6.4 : t.length <= 11 ? 5.2 : 4.4;
  for (const [f, clave] of drogas.entries()) {
    const y = yTope + f * ALTO_DROGA;
    const delRenglon = eventos.filter((e) => e.tipo === "droga" && !!e.descripcion &&
                                             claveRenglon(e) === clave);
    const nombre = delRenglon.length ? delRenglon[0].descripcion : "";
    // El CORTE (6-oct-2026, "el remifentanilo que corta 10 min antes no se
    // ve expresado en el parte"): el evento tipo "corte" de la droga, con
    // hora, termina ahí la barra de lo que corre —aunque el tramo no traiga
    // duracion: la ficha reenviada tras el cierre se la borraba— y escribe
    // "corte" en su columna, para leerlo sin mirar la barra.
    const mismoNombre = (a, b) =>
      String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
    const cortesDelRenglon = eventos
      .filter((e) => e.tipo === "corte" && conHora(e) && mismoNombre(e.descripcion, clave))
      .sort((a, b) => aMs(a.ts) - aMs(b.ts));
    const cortesMs = cortesDelRenglon.map((e) => aMs(e.ts)).filter(Number.isFinite);
    // renglón de INFUSIÓN (15-sep): los tramos van en sus columnas y el
    // Total es el consumo que calculó el cierre (evento "consumo")
    const tasa = delRenglon.find((e) => !esConsumo(e) && esUnidadTasa(e.unidad));
    const consumo = delRenglon.find(esConsumo);
    const infusion = !!(tasa || consumo);
    // el rótulo lleva la unidad de la tasa si entra en los 19 caracteres
    // del margen ("Propofol (mg/kg/h)"); si no entra y la droga también
    // tiene renglón de bolos, "(inf.)" o "inf." para distinguirlos (el
    // nombre se recorta solo si ni así entra); si no, el nombre solo
    let rotulo = nombre;
    if (infusion) {
      const conUnidad = tasa ? `${nombre} (${String(tasa.unidad).trim()})` : "";
      if (conUnidad && conUnidad.length <= 19) rotulo = conUnidad;
    }
    // los bolos de la misma droga, en un renglon que tambien lleva la
    // infusion, van con su unidad ("150 mg") para no leerse como tasa
    const esBolo = (e) => !esConsumo(e) && !esUnidadTasa(e.unidad);
    const mixto = infusion && delRenglon.some(esBolo);
    txt(14, y + 10, rotulo.length > 19 ? rotulo.slice(0, 18) + "…" : rotulo,
        'font-size="6.8" font-weight="700"');
    for (let i = 0; i <= nCol; i++) lin(xCol(i), y, xCol(i), y + ALTO_DROGA, 0.18);
    const porSlot = {};
    for (const e of delRenglon) {
      // sin hora en la grilla (11-sep): nombre en el renglón y dosis en
      // el Total, pero ninguna columna horaria — hasta que el episodio
      // del monitor (o el médico) le dé su hora
      if (!conHora(e)) continue;
      const s = slotDe(e.ts);
      let etq = e.dosis ? fmtCriollo(e.dosis) : "×";
      if (mixto && esBolo(e) && e.dosis && e.unidad) etq = `${etq} ${String(e.unidad).trim()}`;
      porSlot[s] = porSlot[s] ? `${porSlot[s]}+${etq}` : etq;
    }
    for (const e of cortesDelRenglon) {
      const s = slotDe(e.ts);
      porSlot[s] = porSlot[s] ? `${porSlot[s]} corte` : "corte";
    }
    for (const [s, t] of Object.entries(porSlot)) {
      txt(xCol(+s) + anchoCol / 2, y + 10, t,
          'font-size="7" font-weight="700" text-anchor="middle"');
    }
    // LO QUE CORRE (15-sep, revisión): en el papel una infusión se marca
    // con una línea que va desde que se cuelga hasta que se corta. Sin
    // ella, "0,5" en la columna de las 9 con un Total de 0,35 mg se lee
    // como un Total equivocado (0,5 durante la hora entera daría 2,1);
    // con la línea se ve que ese goteo corrió 10 min. Cada tramo termina
    // donde arranca el siguiente, o a los `duracion` minutos, o en el
    // corte de la droga (6-oct-2026), o al final.
    if (infusion) {
      const tramos = delRenglon
        .filter((e) => !esConsumo(e) && conHora(e) && esUnidadTasa(e.unidad))
        .map((e) => ({ ini: aMs(e.ts), dur: Number(e.duracion) || 0 }))
        .sort((a, b) => a.ini - b.ini);
      const xDe = (ms) => IZQ + Math.min(nCol, Math.max(0, (ms - t0) / slotMs)) * anchoCol;
      for (const [i, tr] of tramos.entries()) {
        const topes = [t1];
        if (tramos[i + 1]) topes.push(tramos[i + 1].ini);
        if (tr.dur) topes.push(tr.ini + tr.dur * 60000);
        const corte = cortesMs.find((ms) => ms > tr.ini);
        if (corte != null) topes.push(corte);
        const fin = Math.min(...topes);
        if (fin <= tr.ini) continue;
        const yL = y + ALTO_DROGA - 3;
        lin(xDe(tr.ini), yL, xDe(fin), yL, 0.8);
        // la barrita del final solo si el goteo se cortó antes del cierre
        if (fin < t1) lin(xDe(fin), yL - 2.5, xDe(fin), yL + 1.5, 0.8);
      }
    }
    // los bolos del renglon, sumados si todos comparten unidad (150 mg +
    // 50 mg; un µg y un mg no se suman) — para el Total de la fila mixta
    const bolos = delRenglon.filter((e) => esBolo(e) && e.dosis != null && e.dosis !== "");
    const unidadesBolo = [...new Set(bolos.map((e) => String(e.unidad || "").trim()))];
    const sumaBolos = bolos.length && unidadesBolo.length === 1 &&
                      bolos.every((e) => Number.isFinite(Number(e.dosis)))
      ? { n: bolos.reduce((a, e) => a + Number(e.dosis), 0), u: unidadesBolo[0] } : null;
    if (infusion) {
      let t = "";
      if (consumo && consumo.dosis != null && consumo.dosis !== "") {
        // el consumo calculado al cierre (mg, o UI para una infusión en
        // UI/h); nada de sumar tasas. En la fila mixta, mas los bolos si
        // van en la misma unidad; si no, los bolos aparte
        const uC = consumo.unidad || "mg";
        if (sumaBolos && sumaBolos.u === uC) {
          t = fmtDosisTotal(sumaBolos.n + Number(consumo.dosis), uC);
        } else if (sumaBolos) {
          t = `${fmtDosisTotal(sumaBolos.n, sumaBolos.u)} + ${fmtDosisTotal(Number(consumo.dosis), uC)}`;
        } else {
          t = fmtDosisTotal(Number(consumo.dosis), uC);
        }
      } else {
        // sin consumo (el parte sigue abierto, un tramo sin hora, un parte
        // cerrado antes del 15-sep, o la app en producción que manda el
        // mantenimiento sin hora): la/s tasa/s tal cual, como siempre —
        // nunca un Total vacío ni una suma de tasas
        const tasas = [];
        // solo las TASAS (21-sep): en la fila unica el bolo ya va aparte
        for (const e of delRenglon.filter((e) => !esConsumo(e) && esUnidadTasa(e.unidad))) {
          const d = e.dosis != null && e.dosis !== "" ? fmtCriollo(e.dosis) : "";
          if (d && !tasas.includes(d)) tasas.push(d);
        }
        t = tasas.join("→");
        if (t.length > 15) t = `${tasas[0]}→…→${tasas[tasas.length - 1]}`;
        if (sumaBolos) t = `${fmtDosisTotal(sumaBolos.n, sumaBolos.u)} + ${t}`;
      }
      if (t) {
        txt(xTot + ANCHO_TOT / 2, y + 10, t,
            `font-size="${tamTotal(t)}" font-weight="700" text-anchor="middle"`);
      }
    } else {
      // dosis total en la columna Total, si todas las dosis son numéricas
      let suma = 0, alguna = false, sumable = true;
      for (const e of delRenglon) {
        if (esConsumo(e)) continue;
        alguna = true;
        const n = e.dosis != null && e.dosis !== "" ? Number(e.dosis) : NaN;
        if (Number.isFinite(n)) suma += n; else sumable = false;
      }
      if (alguna && sumable) {
        // el Total de los bolos va pelado como siempre, salvo que sean
        // mg y lleguen a 1000: ahi en gramos ("1 g")
        const enGramos = sumaBolos && sumaBolos.u === "mg" && suma >= 1000;
        const tt = enGramos ? fmtDosisTotal(suma, "mg") : fmtCriollo(suma);
        txt(xTot + ANCHO_TOT / 2, y + 10, tt,
            `font-size="${enGramos ? tamTotal(tt) : 7}" font-weight="700" text-anchor="middle"`);
      }
    }
    lin(0, y + ALTO_DROGA, ancho, y + ALTO_DROGA, 0.35);
  }
  const yD1 = yTope + drogas.length * ALTO_DROGA;
  if (drogas.length) {
    txt(6, (yD0 + yD1) / 2, "D R O G A S",
        `font-size="6.6" font-weight="700" text-anchor="middle" transform="rotate(-90 6 ${(yD0 + yD1) / 2})"`);
    lin(11, yD0, 11, yD1, 0.4);
    lin(0, yD1, ancho, yD1, 0.9);
  }

  lin(IZQ, 0, IZQ, alto, 0.9);
  lin(xTot, 0, xTot, alto, 0.6);                  // borde de la columna Total
  lin(ancho - DER, 0, ancho - DER, alto, 0.9);    // borde derecho de la hoja
  S.push("</svg>");
  return S.join("");
}

// ---------------------------------------------- página completa

// La FECHA del encabezado (28-sep, parte de prueba con "Fecha:" en blanco):
// la app nunca la manda. Sin fecha cargada va la del día del acto: la del
// primer vital (la captura del monitor) o, sin monitor, la de creación del
// parte. Lo que se tipee en la ficha web manda.
function fechaDelParte(parte, vitales) {
  const d = parte.datos || {};
  if (d.fecha) return d.fecha;
  if (vitales.length && vitales[0].ts) return String(vitales[0].ts).slice(0, 10);
  return parte.creado ? String(parte.creado).slice(0, 10) : "";
}

function render(parte, vitales, eventos) {
  DATOS = { ...(parte.datos || {}), fecha: fechaDelParte(parte, vitales) };
  const inst = window.ESQUEMA_FORMULARIO.institucion;
  // los eventos X/O ya quedan marcados sobre la grilla; drogas y volúmenes
  // viven en sus renglones
  // El CORTE de una infusión (7-oct-2026) vive en el renglón de su droga
  // ("corte" en su columna, la barra termina ahí): acá se leía como un
  // evento suelto ("09:50 Remifentanilo").
  const otros = eventos.filter((e) => e.tipo !== "droga" && e.tipo !== "volumen" &&
                               e.tipo !== "practica" && e.tipo !== "critico" &&
                               e.tipo !== "corte" && !marcaGrilla(e.descripcion));
  // Practicas y eventos criticos (22-sep): "HH:MM — texto", cada lista
  // bajo su titulo y SOLO si hubo alguno; si no, no se ven en el parte.
  const listaMarcas = (tipo, titulo_) => {
    const de = eventos.filter((e) => e.tipo === tipo)
                      .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
    if (!de.length) return "";
    return linea(titulo(titulo_), ...de.map((e) =>
      `<span class="et">${esc(e.ts ? e.ts.slice(11, 16) : "")}</span>` +
      `<span class="relleno chico" style="flex:0 1 auto">${esc(e.descripcion)}</span>`));
  };
  // valor representativo de la captura para los casilleros de ventilación
  const medianaGlobal = (key) => {
    const vals = vitales.map((v) => v[key]).filter((x) => x != null);
    return vals.length ? fmtValor(key, mediana(vals)) : "";
  };
  // Aldrete: el intubado bajo ARM NO CALIFICA (21-sep) — se escribe con
  // letras y manda sobre cualquier numero; si no, y si no fue cargado, se
  // calcula con el estado final + TAS basal
  // Los partes de antes del 21-sep guardaron "UTI"; el papel dice UCI.
  if (DATOS.pasa_a === "UTI") DATOS.pasa_a = "UCI";
  const basalAldrete = vitales.find((v) => v.nibp_sis != null);
  const esArm = window.aldreteNoCalifica(DATOS);
  if (esArm) {
    DATOS.aldrete = window.ALDRETE_NO_CALIFICA;
  } else if (DATOS.aldrete == null || DATOS.aldrete === "") {
    const a = window.calcularAldrete(DATOS, basalAldrete ? basalAldrete.nibp_sis : null);
    if (a != null) DATOS.aldrete = String(a);
  }
  // Los cinco items del Aldrete para el papel; en el ARM, solo el rotulo.
  const aldreteImpreso = () => {
    if (esArm) {
      return ['<span class="et">Aldrete:</span>',
              `<span class="relleno chico">${esc(window.ALDRETE_NO_CALIFICA)}</span>`];
    }
    const c = window.componentesAldrete(DATOS, basalAldrete ? basalAldrete.nibp_sis : null);
    const item = (et, v) => [`<span class="et">${et}:</span>`,
                             `<span class="relleno chico">${v == null ? "" : v}</span>`];
    return [...item("Actividad", c.actividad), ...item("Respiración", c.respiracion),
            ...item("Circulación", c.circulacion), ...item("Conciencia", c.conciencia),
            ...item("Saturación", c.saturacion),
            '<span class="et">Aldrete:</span>',
            `<span class="relleno chico">${esc(DATOS.aldrete || "")}</span>`];
  };
  const marcados = (v) => Array.isArray(v) ? v : String(v ?? "").split(/[,/]/).map((s) => s.trim());
  const extubadoUti = marcados(DATOS.via_aerea_uti).includes("Extubado") ||
                      (DATOS.pasa_a === "UCI" && !esArm);
  const opcionUti = (sel, txt) => `<span class="op${sel ? " sel" : ""}">${esc(txt)}</span>`;
  const ingresaUti = esArm || extubadoUti || DATOS.pasa_a === "UCI";

  hoja.innerHTML = `
    <div class="anexo-titulo">${esc(TIPO === "cgs" ? "CGS" : inst.titulo)}</div>

    <div class="encabezado">
      <div class="izq">
        <div class="parte-titulo">PARTE ANESTÉSICO</div>
        ${inst.lineas.map((l) => `<div>${esc(l)}</div>`).join("")}
      </div>
      <div class="der">
        ${linea(campo("fecha", "medio"))}
        ${linea(campo("hc_dni"))}
      </div>
    </div>

    ${linea(campo("nombre"), ops("sexo"), campo("edad", "chico"),
            campo("peso", "chico", "Peso"), '<span class="et">kg</span>')}
    ${/* En el CGS el ASA va en el recuadro "Pre anestésico" (9-oct-2026). */""}
    ${linea(campo("diagnostico"), campo("operacion_propuesta"),
            campo("codigo_cirugia", "chico", "Cód."), TIPO === "cgs" ? "" : ops("asa"))}
    ${linea(campo("anestesiologos"), campo("hora_ingreso", "chico"),
            campo("hora_fin", "chico"), campo("quirofano", "chico"))}

    <div class="fila-marcos">
      ${/* El CGS no lleva la condición al ingreso (9-oct-2026): las vías
            ocupan la fila. */""}
      ${TIPO === "cgs" ? "" : `<div class="marco crece">
        <span class="et tit">Condición al Ingreso:</span>
        <div class="parrafo">${esc(DATOS.condicion_ingreso || "")}</div>
      </div>`}
      <div class="marco${TIPO === "cgs" ? " crece" : ""}">
        <div class="et tit">Vías de Ingreso</div>
        ${linea(checks("vias_ingreso", ""))}
        ${/* Las vias al ingreso son SOLO los casilleros (24-sep, "solo aparece
              lo que esta tildado"); el comentario cargado debajo de las vias va
              DENTRO del cuadro (28-sep, "marcar los chips y si hay comentario
              sumar el comentario"), solo si hay. */""}
        ${(DATOS.vias_comentario || "").trim() ? `<div class="parrafo">${esc(DATOS.vias_comentario)}</div>` : ""}
      </div>
    </div>

    ${/* En el CGS los antecedentes van en el recuadro "Pre anestésico"
          (9-oct-2026). */""}
    ${TIPO === "cgs" ? "" : linea(titulo("Antecedentes Patológicos Condicionantes:")) +
      `<div class="parrafo bajo" style="border-bottom:1px dotted #000">${esc(DATOS.antecedentes || "")}</div>`}

    ${/* Las practicas AL INGRESO (22-sep): el renglon Comentarios de
          "Practicas efectuadas", solo si se cargo alguna. */""}
    ${(DATOS.comentarios || "").trim() ? linea(campo("comentarios", "", "Prácticas al ingreso")) : ""}
    ${linea(chkSiNo("monitoreo_faaaar"), chkSiNo("proteccion_ocular"),
            chkSiNo("proteccion_decubitos"),
            campo("ayuno_hs", "chico"), '<span class="et">hs</span>')}
    ${/* El CGS no lleva premedicación (9-oct-2026): el recuadro de la
          posición pasa al renglón de la inducción. */""}
    ${TIPO === "cgs"
      ? linea(titulo("Inducción:"),
              `<span class="relleno">${esc(DATOS.induccion || "")}</span>`,
              `<span class="marco-pos">${esc(DATOS.posicion || "")}</span>`)
      : linea(titulo("Premedicación:"),
              `<span class="relleno">${esc(DATOS.premedicacion || "")}</span>`,
              `<span class="marco-pos">${esc(DATOS.posicion || "")}</span>`) +
        linea(titulo("Inducción:"),
              `<span class="relleno">${esc(DATOS.induccion || "")}</span>`)}

    <div class="grilla">${construirGrilla(DATOS, vitales, eventos)}</div>

    ${listaMarcas("practica", "Prácticas durante la anestesia:")}
    ${listaMarcas("critico", "Eventos críticos:")}
    ${otros.length ? linea(titulo("Eventos:"), ...otros.map((e) =>
      `<span class="et">${esc(e.ts.slice(11, 16))}</span>` +
      `<span class="relleno chico" style="flex:0 1 auto">${esc(e.descripcion)}</span>`)) : ""}

    <div class="pie-2col marco">
      ${/* En el CGS el área de los bloqueos es el PRE ANESTÉSICO (9-oct-2026,
            "se cargan los antecedentes patológicos de la carga, cirugías
            anteriores, ASA, todo se lo reemplaza"): sin los bloqueos. */""}
      ${TIPO === "cgs" ? `<div class="col">
        <div class="titulo-area">Pre anestésico</div>
        ${linea(titulo("Antecedentes patológicos:"))}
        <div class="parrafo bajo" style="border-bottom:1px dotted #000">${esc(partirAntecedentes(DATOS.antecedentes).antecedentes)}</div>
        ${linea(titulo("Cirugías anteriores:"))}
        <div class="parrafo bajo" style="border-bottom:1px dotted #000">${esc(partirAntecedentes(DATOS.antecedentes).cirugias)}</div>
        ${linea(ops("asa"))}
      </div>` : `<div class="col">
        ${linea(titulo("Bloqueos:"), checks("bloqueo", ""))}
        ${linea(checks("antiseptico"))}
        ${linea(campo("zona_puncion"), campo("aguja", "chico"))}
        ${linea(checks("material"), campo("lote", "chico"))}
        ${linea('<span class="et">Agente anestésico:</span>',
                `<span class="relleno">${esc(agenteDelBloqueo(DATOS).agente)}</span>`,
                '<span class="et">Dosis:</span>',
                `<span class="relleno chico">${esc(agenteDelBloqueo(DATOS).dosis)}</span>`)}
        ${linea(campo("cantidad_inyectada", "chico"),
                campo("dosis_total", "chico"))}
        ${linea(campo("reinyecciones"))}
        ${linea(sino("cateter"), sino("dosis_prueba"))}
      </div>`}
      <div class="col">
        ${linea(titulo("Vía aérea —"), opsCajas("tubo_tipo", "Tubo"),
                campo("tubo_numero", "chico", "N°"))}
        ${linea(sino("dificultad"), campo("otras_vias"))}
        ${linea(titulo("Respiración:"), checks("suplemento_o2", "Suplemento de O2"))}
        ${linea(opsCajas("respiracion"))}
        ${linea(opsCajas("comandada"), opsCajas("sistema"))}
        ${linea(campo("fgf", "chico", "FGF"), '<span class="et">L/min</span>',
                '<span class="et">PEEP:</span>',
                `<span class="relleno chico">${esc(DATOS.peep_cierre || medianaGlobal("peep"))}</span>`,
                campo("fio2_cierre", "chico", "FiO2"), '<span class="et">%</span>')}
        ${/* Vol. corriente y Frec. resp. (22-sep): SIEMPRE del monitor si
              hubo monitoreo (la mediana de la captura); si no, lo cargado
              en la anestesia General de la app (vol_corriente / frec_resp).
              La PIP igual (29-sep): sin monitor, la de la vía aérea de la
              carga (pip_cierre). */""}
        ${linea('<span class="et">Vol. Corriente:</span>',
                `<span class="relleno chico">${medianaGlobal("vt") || esc(DATOS.vol_corriente || "")}</span>`,
                '<span class="et">ml</span>',
                '<span class="et">Frec. Resp.:</span>',
                `<span class="relleno chico">${medianaGlobal("fr_vent") || esc(DATOS.frec_resp || "")}</span>`,
                '<span class="et">/min</span>',
                '<span class="et">PIP:</span>',
                `<span class="relleno chico">${medianaGlobal("pip") || esc(DATOS.pip_cierre || "")}</span>`)}
      </div>
    </div>

    ${/* El Aldrete con sus CINCO items y el total (21-sep, "que figure con
          todos sus items"): las respuestas crudas (moviliza, depresion,
          TAS, sat...) llegan de la app y viven en los datos, pero en el
          papel se lee el puntaje de cada item. En el intubado bajo ARM,
          "No califica" y nada mas. */""}
    ${linea(titulo("Estado del paciente al finalizar la anestesia:"),
            ...aldreteImpreso())}
    ${/* Sin la hora del pase (23-sep, "pase a las hs sacalo del parte"). */""}
    ${linea(titulo("Destino:"), opsCajas("pasa_a"), sino("requiere_o2"))}

    ${/* El cuadro de la UCI (21-sep, pedido expreso): SOLO si ingresa a
          UCI, y SOLO la opcion que dicen los datos — "ARM" si va intubado
          o relajado; si no, "Extubado" con su Aldrete (el puntaje solo,
          sin items), ventilacion espontanea y con o sin oxigenoterapia.
          Nada de dos renglones con uno marcado. Queda la linea de la
          entrega, que es la firma del pase. Si no va a UCI, el cuadro no
          se imprime. */""}
    ${!ingresaUti ? "" : `<div class="marco">
      ${esArm
        ? linea(titulo("Ingreso a UCI:"), opcionUti(true, "ARM"))
        : linea(titulo("Ingreso a UCI:"), opcionUti(true, "Extubado"),
                '<span class="et">Aldrete:</span>',
                `<span class="relleno chico">${esc(DATOS.aldrete || "")}</span>`,
                '<span class="et">Ventilación espontánea</span>',
                '<span class="et">Oxigenoterapia:</span>',
                `<span class="relleno chico">${esc(DATOS.requiere_o2 || "")}</span>`)}
      ${/* Sin "Entrega en UCI: Dr." ni la "Firma:" suelta (21-sep): el que
            entrega es el autor del parte, que firma al pie con aclaracion y
            matricula. Queda la hora del ingreso y quien recibe. */""}
      ${/* Sin la hora de ingreso a UCI (24-sep, "la hora en UCI la sacamos"). */""}
      ${linea(campo("recibe_dr", "medio"))}
    </div>`}

    ${/* La firma del anestesiologo va AL FINAL del parte (21-sep):
          antes quedaba entre el destino y el cuadro de la UCI. */""}
    ${/* La FIRMA electronica (24-sep): si la app mando el trazo, se imprime
          sobre la linea de Firma con la aclaracion y la matricula, y debajo
          la constancia con la hora del envio. Si no, la linea queda para
          firmar a mano. */""}
    <div class="firma">
      <span class="et">(Marcar lo que corresponda)</span>
      <span class="et">Firma</span><span class="relleno firma-trazo">${
        /^[A-Za-z0-9+/=]+$/.test(DATOS.firma_png || "")
          ? `<img src="data:image/png;base64,${DATOS.firma_png}" alt="firma">` : ""}</span>
      <span class="et">Aclaración</span><span class="relleno">${esc(DATOS.aclaracion || "")}</span>
      <span class="et">MP/MN:</span><span class="relleno medio">${esc(DATOS.mp_mn || "")}</span>
    </div>
    ${(DATOS.firmado_en || "").trim() && (DATOS.firma_png || "")
      ? `<div class="leyenda-final">Firmado electrónicamente desde la app el ${esc(DATOS.firmado_en)}.</div>` : ""}
    <div class="leyenda-final">Conste que una copia fiel de este parte se halla
      archivada en el Servicio.</div>`;

  document.title = `Parte ${ID}${DATOS.nombre ? " — " + DATOS.nombre : ""} — ${NOMBRE_TIPO}`;
}

(async function arrancar() {
  if (!Number.isInteger(ID) && DNI) {
    // El celular manda la carga EN PARALELO con abrir esta pestaña ("Ver
    // parte" = enviar + ver): se le espera hasta ~30 s, preguntando cada
    // 1,5 s, antes de decir que no hay.
    for (let intento = 0; intento < 20 && !Number.isInteger(ID); intento++) {
      if (intento > 0) await new Promise((ok) => setTimeout(ok, 1500));
      hoja.innerHTML = `<div class="sin-datos">Esperando el parte del DNI ${esc(DNI)} (el celular lo está mandando a la notebook)…</div>`;
      try {
        const r = await fetch(`/api/partes/ultimo?dni=${encodeURIComponent(DNI)}`);
        if (r.ok) {
          ID = (await r.json()).id;
          document.getElementById("volver").href = `parte.html?id=${ID}`;
        }
      } catch (e) { /* se reintenta */ }
    }
    if (!Number.isInteger(ID)) {
      hoja.innerHTML = `<div class="sin-datos">No llegó ningún parte para el DNI ${esc(DNI)}: fijate el aviso de la app (falta un dato obligatorio o no hay conexión con la notebook) y volvé a tocar Ver parte.</div>`;
      return;
    }
  }
  if (!Number.isInteger(ID)) {
    hoja.innerHTML = '<div class="sin-datos">Falta ?id= en la URL</div>';
    return;
  }
  try {
    const [parte, vitales, eventos] = await Promise.all([
      fetch(`/api/partes/${ID}`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }),
      fetch(`/api/partes/${ID}/vitales`).then((r) => r.json()),
      fetch(`/api/partes/${ID}/eventos`).then((r) => r.json()),
    ]);
    render(parte, vitales, eventos);
  } catch (e) {
    hoja.innerHTML = `<div class="sin-datos">No se pudo cargar el parte: ${esc(e.message)}</div>`;
  }
})();
