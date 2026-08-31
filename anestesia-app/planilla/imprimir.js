// Render de impresión calcado del formulario papel (foto del Anexo V):
// encabezado en líneas, opciones impresas que se rodean, casilleros con
// puntos, grilla central cuadriculada (drogas + gráfico + filas numéricas)
// y pie con técnica / vía aérea / estado final / destino / firma.
"use strict";

const ID = parseInt(new URLSearchParams(location.search).get("id"), 10);
document.getElementById("volver").href = `parte.html?id=${ID}`;

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

// "Etiqueta: Op1 - Op2 - Op3" con la elegida rodeada
function ops(id, etiqueta = null) {
  const c = buscarCampo(id);
  const v = crudo(id);
  const os = c.opciones.map((o) =>
    `<span class="op${v === o ? " sel" : ""}">${esc(o)}</span>`
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
// papel: □Oral □Nasal…, □SALA GENERAL □RECUPERACIÓN □UTI…)
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

function fmtValor(clave, v) {
  if (v == null) return "";
  if (["sev_et", "sev_fi", "mv", "mac"].includes(clave)) {
    return (Math.round(v * 10) / 10).toString();
  }
  return Math.round(v).toString();
}

// ---------------------------------------------- grilla central (SVG)

function construirGrilla(datos, vitales, eventos) {
  const cfg = window.VITALES_GRAFICO;
  const base = fechaBase(datos, vitales, eventos);
  const marcas = [...vitales.map((v) => aMs(v.ts)), ...eventos.map((e) => aMs(e.ts))]
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
  const ANCHO_UTIL = 650;              // ancho interno fijo: la letra no cambia
  const ANCHO_TOT = 30;                // columna Total: volumen acumulado a mano
  const anchoCol = (ANCHO_UTIL - ANCHO_TOT) / nCol;
  const ancho = IZQ + ANCHO_UTIL + DER;
  const xTot = IZQ + ANCHO_UTIL - ANCHO_TOT;
  const ALTO_HORA = 13, ALTO_DROGA = 13, ALTO_GRAF = 235, ALTO_FILA = 13;

  const drogas = [];
  for (const e of eventos) {
    if (e.tipo === "droga" && !drogas.includes(e.descripcion)) drogas.push(e.descripcion);
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
  const FILAS_SUP = [...volumenes, "Diuresis", "Sev %", "Sat %", "pCO2"];
  const alto = ALTO_HORA + FILAS_SUP.length * ALTO_FILA +
               ALTO_GRAF + drogas.length * ALTO_DROGA + 3;

  const S = [];
  S.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" ` +
         `font-family="Arial Narrow, Arial, sans-serif">`);
  const lin = (x1, y1, x2, y2, g = 0.5) =>
    S.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#000" stroke-width="${g}"/>`);
  const txt = (x, y, t, extra = "") =>
    S.push(`<text x="${x}" y="${y}" ${extra}>${esc(t)}</text>`);
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
  const anotarFila = (y, etiqueta, valores, celdaTotal, total) => {
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
    // la fila cierra su celda Total solo si es de volumen; en las numéricas
    // la franja queda lisa, como en el gráfico
    lin(0, y + ALTO_FILA, celdaTotal ? ancho : xTot, y + ALTO_FILA, 0.3);
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
      const etq = e.dosis ? `${e.dosis}` : "×";
      porSlot[s] = porSlot[s] ? `${porSlot[s]}+${etq}` : etq;
      alguno = true;
      const n = e.dosis != null && e.dosis !== "" ? Number(e.dosis) : NaN;
      if (Number.isFinite(n)) suma += n; else sumable = false;
    }
    // sin dosis numéricas no hay suma automática: la celda queda para la mano
    const total = alguno && sumable ? Math.round(suma * 100) / 100 : null;
    return { valores: porSlot, total };
  };
  let ySup = ALTO_HORA;
  const primeraNum = FILAS_SUP.indexOf("Sev %");
  for (const [f, etq] of FILAS_SUP.entries()) {
    if (f < primeraNum) {
      const { valores, total } = volumenFila(etq);
      anotarFila(ySup + f * ALTO_FILA, etq, valores, true, total);
    } else {
      anotarFila(ySup + f * ALTO_FILA, etq, datosSup[etq], false);
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
    ["Claves:", "#000"],
    ["X Anestesia", "#000"],
    ["O Operación", "#000"],
    ["│ TA (TAS–TAD)", COLORES.nibp_sis],
    ["   (Nº = PAM)", COLORES.nibp_sis],
    ["● FC", COLORES.hr],
    ["○ SpO2", COLORES.spo2],
    ["◆ etCO2", COLORES.etco2],
    ["Sev% Et/Fi al pie", COLORES.sev],
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
  yTope = yG1;
  lin(0, yTope, ancho, yTope, 0.9);

  // renglones de drogas — pegados debajo del gráfico, con el rótulo vertical
  // DROGAS en el margen, como el papel
  const yD0 = yTope;
  for (const [f, nombre] of drogas.entries()) {
    const y = yTope + f * ALTO_DROGA;
    txt(14, y + 10, nombre.length > 19 ? nombre.slice(0, 18) + "…" : nombre,
        'font-size="6.8" font-weight="700"');
    for (let i = 0; i <= nCol; i++) lin(xCol(i), y, xCol(i), y + ALTO_DROGA, 0.18);
    const porSlot = {};
    for (const e of eventos) {
      if (e.tipo !== "droga" || !nombre || e.descripcion !== nombre) continue;
      const s = slotDe(e.ts);
      const etq = e.dosis ? `${e.dosis}` : "×";
      porSlot[s] = porSlot[s] ? `${porSlot[s]}+${etq}` : etq;
    }
    for (const [s, t] of Object.entries(porSlot)) {
      txt(xCol(+s) + anchoCol / 2, y + 10, t,
          'font-size="7" font-weight="700" text-anchor="middle"');
    }
    // dosis total en la columna Total, si todas las dosis son numéricas
    let suma = 0, alguna = false, sumable = true;
    for (const e of eventos) {
      if (e.tipo !== "droga" || !nombre || e.descripcion !== nombre) continue;
      alguna = true;
      const n = e.dosis != null && e.dosis !== "" ? Number(e.dosis) : NaN;
      if (Number.isFinite(n)) suma += n; else sumable = false;
    }
    if (alguna && sumable) {
      txt(xTot + ANCHO_TOT / 2, y + 10, String(Math.round(suma * 100) / 100),
          'font-size="7" font-weight="700" text-anchor="middle"');
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

function render(parte, vitales, eventos) {
  DATOS = parte.datos || {};
  const inst = window.ESQUEMA_FORMULARIO.institucion;
  // los eventos X/O ya quedan marcados sobre la grilla; drogas y volúmenes
  // viven en sus renglones
  const otros = eventos.filter((e) => e.tipo !== "droga" && e.tipo !== "volumen" &&
                               !marcaGrilla(e.descripcion));
  // valor representativo de la captura para los casilleros de ventilación
  const medianaGlobal = (key) => {
    const vals = vitales.map((v) => v[key]).filter((x) => x != null);
    return vals.length ? fmtValor(key, mediana(vals)) : "";
  };
  // Aldrete: si no fue cargado, se calcula con el estado final + TAS basal
  if (DATOS.aldrete == null || DATOS.aldrete === "") {
    const basal = vitales.find((v) => v.nibp_sis != null);
    const a = window.calcularAldrete(DATOS, basal ? basal.nibp_sis : null);
    if (a != null) DATOS.aldrete = String(a);
  }

  hoja.innerHTML = `
    <div class="anexo-titulo">${esc(inst.titulo)}</div>

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
    ${linea(campo("diagnostico"), campo("operacion_propuesta"),
            campo("codigo_cirugia", "chico", "Cód."), ops("asa"))}
    ${linea(campo("anestesiologos"), campo("hora_ingreso", "chico"),
            campo("hora_fin", "chico"), campo("quirofano", "chico"))}

    <div class="fila-marcos">
      <div class="marco crece">
        <span class="et tit">Condición al Ingreso:</span>
        <div class="parrafo">${esc(DATOS.condicion_ingreso || "")}</div>
      </div>
      <div class="marco">
        <div class="et tit">Vías de Ingreso</div>
        ${linea(checks("vias_ingreso", ""))}
      </div>
    </div>

    ${linea(titulo("Antecedentes Patológicos Condicionantes:"))}
    <div class="parrafo bajo" style="border-bottom:1px dotted #000">${esc(DATOS.antecedentes || "")}</div>

    ${linea(titulo("Prácticas Efectuadas"),
            campo("via_periferica_1", "chico", "Vía Periférica N°"),
            campo("via_periferica_2", "chico", "Vía Periférica N°"),
            campo("via_central", "chico", "Vía Central N°"),
            campo("abordaje", "chico"), campo("via_arterial", "chico"))}
    ${linea(campo("comentarios"))}
    ${linea(chkSiNo("monitoreo_faaaar"), chkSiNo("proteccion_ocular"),
            chkSiNo("proteccion_decubitos"),
            campo("ayuno_hs", "chico"), '<span class="et">hs</span>')}
    ${linea(titulo("Premedicación:"),
            `<span class="relleno">${esc(DATOS.premedicacion || "")}</span>`,
            `<span class="marco-pos">${esc(DATOS.posicion || "")}</span>`)}
    ${linea(titulo("Inducción:"),
            `<span class="relleno">${esc(DATOS.induccion || "")}</span>`)}

    <div class="grilla">${construirGrilla(DATOS, vitales, eventos)}</div>

    ${otros.length ? linea(titulo("Eventos:"), ...otros.map((e) =>
      `<span class="et">${esc(e.ts.slice(11, 16))}</span>` +
      `<span class="relleno chico" style="flex:0 1 auto">${esc(e.descripcion)}</span>`)) : ""}

    <div class="pie-2col marco">
      <div class="col">
        ${linea(titulo("Bloqueos:"), checks("bloqueo", ""))}
        ${linea(checks("antiseptico"))}
        ${linea(campo("zona_puncion"), campo("aguja", "chico"))}
        ${linea(checks("material"), campo("lote", "chico"))}
        ${linea(campo("agente_anestesico"), campo("dosis_agente", "chico"))}
        ${linea(campo("cantidad_inyectada", "chico"),
                campo("dosis_total", "chico"))}
        ${linea(campo("reinyecciones"))}
        ${linea(sino("cateter"), sino("dosis_prueba"))}
      </div>
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
        ${linea('<span class="et">Vol. Corriente:</span>',
                `<span class="relleno chico">${medianaGlobal("vt")}</span>`,
                '<span class="et">ml</span>',
                '<span class="et">Frec. Resp.:</span>',
                `<span class="relleno chico">${medianaGlobal("fr_vent")}</span>`,
                '<span class="et">/min</span>',
                '<span class="et">PIP:</span>',
                `<span class="relleno chico">${medianaGlobal("pip")}</span>`)}
      </div>
    </div>

    ${linea(titulo("Estado del paciente al finalizar la anestesia:"),
            sino("reflejo_corneal"), sino("estimulos_dolorosos"),
            sino("obedece_ordenes"))}
    ${linea(sino("depresion_circulatoria"), sino("depresion_respiratoria"),
            sino("moviliza_msup"), sino("moviliza_minf"))}
    ${linea(campo("tas_final", "chico"), campo("tam_final", "chico"),
            campo("sat_final", "chico"), '<span class="et">%</span>',
            campo("fio2_final", "chico"), '<span class="et">%</span>',
            campo("aldrete", "chico"))}
    ${linea(titulo("Destino:"), opsCajas("pasa_a"), campo("pasa_hora", "chico"),
            '<span class="et">hs</span>', sino("requiere_o2"))}

    <div class="firma">
      <span class="et">(Marcar lo que corresponda)</span>
      <span class="et">Firma</span><span class="relleno"></span>
      <span class="et">Aclaración</span><span class="relleno">${esc(DATOS.aclaracion || "")}</span>
      <span class="et">MP/MN:</span><span class="relleno medio">${esc(DATOS.mp_mn || "")}</span>
    </div>

    <div class="marco">
      ${linea(titulo("Ingreso a UTI:"), checks("ingreso_uti", ""))}
      ${linea(checks("via_aerea_uti"), opsCajas("ventilacion_uti"))}
      ${linea(campo("vc_uti", "chico"), campo("fr_uti", "chico"),
              campo("tas_uti", "chico"), campo("tad_uti", "chico"),
              campo("tam_uti", "chico"), campo("pvc_uti", "chico"),
              campo("diuresis_uti", "chico"))}
      ${linea(campo("entrega_dr", "medio"), campo("entrega_hora", "chico"),
              campo("recibe_dr", "medio"),
              '<span class="et">Firma:</span>', '<span class="relleno chico"></span>')}
    </div>
    <div class="leyenda-final">Conste que una copia fiel de este parte se halla
      archivada en el Servicio.</div>`;

  document.title = `Parte ${ID}${DATOS.nombre ? " — " + DATOS.nombre : ""} — Anexo V`;
}

(async function arrancar() {
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
