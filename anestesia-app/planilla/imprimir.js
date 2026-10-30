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
// anestésico)"): la MISMA planilla en dos tipos. Manda ?tipo= (cgs o
// anexo_v); sin él, el que eligió la ficha ("enganchá el CGS en la ficha":
// tipos_parte, "anexo_v,cgs"): el Anexo V si lo lleva, si no el CGS. Sin
// nada, el Anexo V de siempre, idéntico. Lo fija render().
const TIPO_PEDIDO = (new URLSearchParams(location.search).get("tipo") || "").toLowerCase();
let TIPO = "anexo_v";
let NOMBRE_TIPO = "Anexo V";

/// Los tipos que eligió la ficha ("anexo_v,cgs" → ["anexo_v", "cgs"]). Puro.
function tiposDelParte(datos) {
  return String((datos || {}).tipos_parte || "").split(",")
    .map((t) => t.trim().toLowerCase()).filter(Boolean);
}

/// El tipo en que sale la planilla (ver arriba). Puro.
function elegirTipo(datos, pedido = TIPO_PEDIDO) {
  if (pedido === "cgs" || pedido === "anexo_v") return pedido;
  const del = tiposDelParte(datos);
  if (!del.length || del.includes("anexo_v")) return "anexo_v";
  return del.includes("cgs") ? "cgs" : "anexo_v";
}

// Los antecedentes y las cirugías anteriores viajan en UN renglón
// (renglonAntecedentes de la app: "HTA, DBT. Cirugías previas: …", porque el
// Anexo V no tiene renglón aparte); el recuadro "Evaluación pre anestésica" del CGS
// (9-oct-2026) los imprime separados. Puro.
function partirAntecedentes(texto) {
  const t = String(texto || "").trim();
  const m = t.match(/^([\s\S]*?)(?:\.\s*)?Cirugías previas:\s*([\s\S]*)$/);
  if (!m) return { antecedentes: t, cirugias: "" };
  return { antecedentes: m[1].trim(), cirugias: m[2].trim() };
}
if (Number.isInteger(ID) && document.getElementById("volver")) {
  document.getElementById("volver").href = `parte.html?id=${ID}`;
}

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

// El CÓDIGO DE LA CIRUGÍA (21-oct-2026, "el código de la cirugía y el ASA
// se superponen"): en el casillero fijo de 14 mm, "010101 MB, 040123 EL" se
// partía en tres renglones y, con la letra más ancha de la nube, se montaba
// sobre el ASA. Ahora el casillero toma el ancho de lo escrito y cada código
// queda entero: si no entran todos, corta ENTRE códigos, nunca adentro de
// uno, y lo que se achica es el diagnóstico o la operación.
function codigosCirugia(id, etiqueta = null) {
  const c = buscarCampo(id);
  const v = crudo(id);
  const lista = (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((s) => String(s).trim()).filter(Boolean);
  const texto = lista.map((s) => `<span class="un-codigo" style="white-space:nowrap">${esc(s)}</span>`)
    .join(", ");
  return `<span class="et">${esc(etiqueta ?? c.etiqueta)}:</span>` +
         `<span class="relleno codigos" style="flex:0 1 auto;min-width:14mm">${texto}</span>`;
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

// Los casilleros de BLOQUEOS se tildan solos con la técnica (17-oct-2026,
// revisión: el renglón Bloqueos salía con los cuatro vacíos aunque la
// anestesia fuera una raquídea; la app no manda "bloqueo" pero sí la
// técnica, "General, Raquídea" o "Raquídea x2"). Raquídea tilda Raquídeo y
// así con Peridural, Plexual y Periférico, en el orden del esquema y
// mirando solo el COMIENZO de cada técnica: "Premedicación" no matchea.
// Si "bloqueo" existe, lo tildó alguien a mano en la ficha de la notebook
// y manda entero, aun vacío (destildar todo es "ninguno"). Sin
// tipo_anestesia (un parte viejo), nada.
const BLOQUEO_POR_TECNICA = [
  [/^perid/i, "Peridural"], [/^raqu/i, "Raquídeo"],
  [/^plexu/i, "Plexual"], [/^perif/i, "Periférico"],
];
function bloqueoDelParte(d) {
  if (d.bloqueo != null) return d.bloqueo;
  const tecnicas = String(d.tipo_anestesia || "").split(",")
    .map((t) => t.trim()).filter(Boolean);
  return BLOQUEO_POR_TECNICA
    .filter(([re]) => tecnicas.some((t) => re.test(t)))
    .map(([, op]) => op);
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
// ms → "AAAA-MM-DDTHH:MM:SS" en hora local (lo que lee aMs)
const deMs = (ms) => {
  const d = new Date(ms), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T` +
         `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const TOLERANCIA_ACOMODAR_MS = 60000;   // un minuto: las horas van sin segundos
// el menor y el mayor sin Math.min(...lista): el cable deja decenas de miles
// de filas en una anestesia larga y el spread tiene tope de argumentos
const menorDe = (xs) => xs.reduce((a, b) => (b < a ? b : a), Infinity);
const mayorDe = (xs) => xs.reduce((a, b) => (b > a ? b : a), -Infinity);

// (26-oct-2026) Los vitales REALES acomodados a la ventana [t0, t1] del
// parte (ms): si desbordan, el primero cae en t0 y el último en t1, los de
// entre medio en proporción. Si entran, vuelven tal cual. PURA.
// (27-oct-2026, Paulino Balsamo: 15 min del monitor, de 08:53 a 09:08, en un
// parte de 08:00 a 09:00, estirados a la hora entera: la FC quedaba en el
// último cuarto y nada para completar) Lo MÁS CORTO que el parte no se
// estira: se corre lo justo para que entre, con su duración real, y lo que
// falta lo completa completarColumnas. Solo lo más largo se comprime.
// (27-oct-2026, revisión) El borde del FIN es el último segundo del parte
// (t1 − 1 s), no t1: en una VEDA de 10:30 a 11:00 la grilla mínima llega a
// las 11:25 y lo que caía a las 11:00 en punto se dibujaba en la columna de
// las 11:00, después de la salida del paciente. Y lo que entra por el minuto
// de tolerancia (las horas van sin segundos) no se pierde: lo de antes del
// ingreso va al ingreso y lo de después del fin a su último segundo, con su
// hora real; antes la grilla lo descartaba (un único registro a las 07:59:40
// en un parte de 08:00 dejaba la grilla vacía).
function acomodarAlParte(vitales, t0, t1) {
  const reales = vitales.filter((v) => v.fuente !== "prueba").map((v) => aMs(v.ts))
    .filter(Number.isFinite);
  if (!reales.length || t1 <= t0) return vitales;
  const v0 = menorDe(reales), v1 = mayorDe(reales);
  const ultimo = t1 - 1000;   // el último segundo del parte
  const mover = (aDonde) => vitales.map((v) => {
    const t = aMs(v.ts);
    if (v.fuente === "prueba" || !Number.isFinite(t)) return v;
    const nuevo = aDonde(t);
    return nuevo === t ? v : { ...v, ts: deMs(nuevo), tsReal: v.ts };
  });
  if (v0 >= t0 - TOLERANCIA_ACOMODAR_MS && v1 <= t1 + TOLERANCIA_ACOMODAR_MS) {
    if (v0 >= t0 && v1 <= ultimo) return vitales;
    return mover((t) => Math.max(t0, Math.min(ultimo, t)));
  }
  if (v1 - v0 <= ultimo - t0) {
    const corre = v0 < t0 ? t0 - v0 : ultimo - v1;
    return mover((t) => t + corre);
  }
  // la compresión, con la escala del 26-oct (hasta t1) y solo el último
  // segundo traído adentro: con la escala hasta t1 − 1 s cada fila se corría
  // un poco y alguna cambiaba de columna (el parte 67 salía con otra toma)
  const escala = (t1 - t0) / (v1 - v0);
  return mover((t) => Math.min(ultimo, t0 + (t - v0) * escala));
}

function fechaBase(datos, vitales, eventos) {
  if (vitales.length) return vitales[0].ts.slice(0, 10);
  if (eventos.length) return eventos[0].ts.slice(0, 10);
  if (datos.fecha) return datos.fecha;
  return new Date().toISOString().slice(0, 10);
}

// LA HORA DE INGRESO EN MINUTOS (23-oct-2026; la VEDA de 10:30 a 11:00 con
// 325 filas del cable de 09:21 a 10:04 se amontonaba en su primera columna,
// slotDe las lleva al borde; ese día se dejó de dibujar lo de otra hora y
// desde el 26-oct el registro se acomoda a las horas: acomodarAlParte).
const minutosDe = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// LOS QUE CUENTAN (23-oct-2026, el médico: "con 'De prueba' prendido mandan
// los de prueba, aunque el monitor registre dentro del horario del parte"):
// con alguna fila de prueba —la ficha está en "De prueba"; en Auto la serie
// se borra— el parte dibuja solo la serie; las del monitor quedan guardadas
// sin contar. Sin ninguna de prueba, todas. La misma regla que la central
// (basedatos.cuentan).
function vitalesQueCuentan(vitales) {
  const dePrueba = vitales.filter((v) => v.fuente === "prueba");
  return dePrueba.length ? dePrueba : vitales;
}

// El momento del INGRESO en ms, o null sin hora de ingreso: la hora sobre la
// fecha base, del día anterior si queda más de 12 h después del primer vital.
// (23-oct-2026, "que una anestesia que cruza la medianoche salga con sus
// vitales de prueba") La grilla también lo toma de acá: con el ingreso a las
// 23:50 y la captura desde las 00:05, arrancaba a las 23:50 de ESE día y
// amontonaba todo en su primera columna.
// (26-oct-2026, revisión en la PC) Y para el otro lado: el ingreso a las 00:10
// con el monitor desde las 23:58 de la víspera quedaba sobre la fecha del
// primer vital, 24 h antes; más de 12 h ANTES del primer vital, es del día
// siguiente.
function ingresoDelParte(datos, vitales, eventos) {
  const ing = minutosDe(datos && datos.hora_ingreso);
  if (ing == null) return null;
  let t0 = aMs(`${fechaBase(datos, vitales, eventos)}T00:00:00`) + ing * 60000;
  if (!Number.isFinite(t0)) return null;
  const tiempos = vitales.map((v) => aMs(v.ts)).filter(Number.isFinite);
  if (tiempos.length && t0 - menorDe(tiempos) > 12 * 3600000) t0 -= 24 * 3600000;
  else if (tiempos.length && menorDe(tiempos) - t0 > 12 * 3600000) t0 += 24 * 3600000;
  return t0;
}

// LA VENTANA DEL PARTE (26-oct-2026, revisión en la PC): el ingreso y el fin
// en ms, con las mismas reglas para la grilla y para elegir la serie. El fin
// sigue al ingreso —ya corrido de día si hizo falta—: lo que dura de una
// hora a la otra, y un fin antes que el ingreso es del día siguiente (el
// cruce de la medianoche, hasta 12 h; más que eso son horas cargadas al
// revés). Sobre la fecha del primer vital, el ingreso de anoche pasado al
// día anterior quedaba con el fin de HOY: una grilla de 25 h, completada.
// Fin igual al ingreso, o sin una de las dos: t1 null. `manual`: el ingreso
// lo escribió el médico (en la app o en la central), no la máquina
// (hora_ingreso_auto "1": el arranque de la captura o los vitales de prueba).
// En la app las dos horas van en el mismo modo (cierre.dart).
function ventanaDelParte(datos, vitales, eventos) {
  const t0 = ingresoDelParte(datos, vitales, eventos);
  const ing = minutosDe(datos && datos.hora_ingreso), fin = minutosDe(datos && datos.hora_fin);
  let t1 = null;
  if (t0 != null && fin != null) {
    const min = fin > ing ? fin - ing : fin < ing && fin + 1440 - ing <= 12 * 60 ? fin + 1440 - ing : 0;
    if (min > 0) t1 = t0 + min * 60000;
  }
  const auto = String((datos && datos.hora_ingreso_auto) ?? "").trim() === "1";
  return { t0, t1, manual: t0 != null && !auto };
}

// (26-oct-2026) Reemplaza a vitalesDelHorario del 23-oct ("solo se dibujan los
// vitales de la hora de ingreso a la de fin"; los de afuera no se dibujaban):
// el médico decidió que el registro SE ACOMODA a las horas del parte
// (acomodarAlParte), no que se descarte. Lo que sí se descarta es lo que no
// es de esta anestesia: la PRIMERA SERIE SEGUIDA de vitales reales manda y
// lo que llega después de un hueco de más de BRECHA_MAX_H horas (una
// captura que fue a parar a este parte, como en cargas.ultimo_vital_seguido)
// no se dibuja. Los de prueba siguen tal cual.
const BRECHA_MAX_H = 6;
function primeraSerieSeguida(vitales) {
  const reales = vitales.filter((v) => v.fuente !== "prueba" && Number.isFinite(aMs(v.ts)))
    .sort((a, b) => aMs(a.ts) - aMs(b.ts));
  let corte = null;
  for (let i = 1; i < reales.length; i++) {
    if (aMs(reales[i].ts) - aMs(reales[i - 1].ts) > BRECHA_MAX_H * 3600000) { corte = aMs(reales[i].ts); break; }
  }
  if (corte == null) return vitales;
  return vitales.filter((v) => v.fuente === "prueba" || !Number.isFinite(aMs(v.ts)) || aMs(v.ts) < corte);
}

// (26-oct-2026, revisión en la PC) LA SERIE DE ESTA ANESTESIA: la primera
// serie seguida mandaba aunque no tuviera nada que ver con las horas del
// parte —una prueba del monitor de 5 min a las 07:30 en el mismo parte que
// la anestesia de 14:00 a 16:00 tiraba las 2 h reales y se estiraba sobre
// todo el parte—. Cada serie se mide contra la ventana del parte armada CON
// ELLA (la regla de las 12 h del ingreso mira su propio primer vital: con
// todas juntas, la prueba de las 07:30 corría al día anterior una guardia de
// las 20:00 y volvía a ganar). Con fin, la que más se superpone con su
// ventana (si ninguna la toca, la más cercana); sin fin, la que contiene el
// ingreso o la primera que empieza después (no la más larga: la del paciente
// siguiente en un parte abierto). Sin horas, la primera, como hasta hoy.
// Devuelve la serie y la ventana con que se eligió.
function elegirSerie(datos, vitales, eventos) {
  const tiempos = vitales.filter((v) => v.fuente !== "prueba").map((v) => aMs(v.ts))
    .filter(Number.isFinite).sort((a, b) => a - b);
  const series = [];
  for (const t of tiempos) {
    const ultima = series[series.length - 1];
    if (ultima && t - ultima[1] <= BRECHA_MAX_H * 3600000) ultima[1] = t;
    else series.push([t, t]);
  }
  if (series.length < 2) return { vitales, ventana: ventanaDelParte(datos, vitales, eventos) };
  const candidatas = series.map(([a, b]) => {
    const vs = vitales.filter((v) => v.fuente === "prueba" || !Number.isFinite(aMs(v.ts)) ||
                                     (aMs(v.ts) >= a && aMs(v.ts) <= b));
    return { a, b, vitales: vs, ventana: ventanaDelParte(datos, vs, eventos) };
  });
  const puntaje = ({ a, b, ventana: { t0, t1 } }) => {
    if (t0 == null) return 0;
    if (t1 != null) return Math.min(b, t1) - Math.max(a, t0);   // negativo: lo que le falta
    return b < t0 ? -Infinity : -Math.max(0, a - t0);
  };
  let elegida = candidatas[0];
  for (const c of candidatas.slice(1)) if (puntaje(c) > puntaje(elegida)) elegida = c;
  return { vitales: elegida.vitales, ventana: elegida.ventana };
}

// LOS VITALES QUE VAN AL PARTE (26-oct-2026, revisión en la PC): los que
// cuentan (la serie de prueba, si la hay), los de esta anestesia y, cuando
// el registro NO se acomoda, solo los de su horario, en su hora real —la
// regla del 23-oct—: en Auto ("si la hora es auto es auto") el fin es la
// extubación o el Concluir, y la captura sigue hasta que el Concluir llega a
// la central; comprimirla corría cada vital respecto de sus drogas, y lo que
// el monitor registró después (hasta el paciente siguiente) entraba al parte.
// También a mano sin fin (un parte abierto): del ingreso en adelante, nunca
// amontonado en la primera columna. A mano y con fin, se acomodan en la
// grilla (acomodarAlParte). La serie de prueba, siempre adentro de su
// horario (las horas corregidas sin rehacer la serie la dejaban afuera).
// Sin hora de ingreso, todos. Devuelve también la ventana del parte.
function anestesiaDelParte(datos, vitales, eventos) {
  const { vitales: vs, ventana } = elegirSerie(datos, vitalesQueCuentan(vitales), eventos);
  const { t0, t1, manual } = ventana;
  if (t0 == null) return { vitales: vs, ventana };
  const hasta = t1 == null ? Infinity : t1 + 59999;   // el minuto entero del fin
  const recortarReales = !(manual && t1 != null);
  return {
    vitales: vs.filter((v) => {
      const t = aMs(v.ts);
      if (!Number.isFinite(t) || (v.fuente !== "prueba" && !recortarReales)) return true;
      return t >= t0 && t <= hasta;
    }),
    ventana,
  };
}
function vitalesDeLaAnestesia(datos, vitales, eventos) {
  return anestesiaDelParte(datos, vitales, eventos).vitales;
}

// Lo que trae una fila del monitor (basedatos.COLUMNAS_VITAL): una fila con
// cualquiera de estos es captura, aunque sea solo el respirador.
const CAMPOS_DEL_MONITOR = ["hr", "spo2", "rr", "nibp_sis", "nibp_dia", "nibp_pam",
  "etco2", "fico2", "awrr", "sev_et", "sev_fi", "mac",
  "peep", "pip", "pmedia", "vt", "mv", "fr_vent"];
const tieneDato = (v) => CAMPOS_DEL_MONITOR.some((k) => v[k] != null && v[k] !== "");

function mediana(valores) {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

// (26-oct-2026, con el registro acomodado a las horas del parte; decisión
// del médico: "si la distribución supera a los 5 minutos de cada registro
// se toman los más estables") De los vitales que cayeron en UNA columna,
// los que entran en la cuenta de [key]: si abarcan más de 5 minutos REALES
// (la compresión metió más de un registro en la columna, o la columna es
// de 10 min o más), los 5 minutos reales más estables —la ventana de menor
// amplitud máx−mín de [key]; a igual amplitud, la primera—; si no, todos.
// La hora real es tsReal (la de antes de acomodar) o, sin acomodar, ts.
// (26-oct-2026, revisión en la PC) Solo cuentan los TRAMOS ENTEROS de 5 min:
// las ventanas que arrancaban sobre el final de la columna tenían una o dos
// lecturas, una lectura sola tiene amplitud 0 y ganaba siempre: la columna
// salía con su último valor (un pico de 103 entre 70 y 73 quedaba como "lo
// más estable"). Una ventana entra si los datos siguen hasta su fin (con el
// paso de la medición de margen: 10 lecturas cada 30 s cubren 5 min), tiene
// al menos dos lecturas y está CUBIERTA —sus lecturas llegan a sus 5 min—: si
// no, antes de cada hueco de la columna ganaban las 2 o 3 últimas lecturas
// (el cable repite el último dato 15 s cuando se corta). Sin ninguna así
// (una TA cada 6 min), todas. El mínimo y el máximo de la ventana van con
// dos colas monótonas: un parte del cable de 6 h tardaba 2 s en dibujarse.
const ESTABLES_MS = 5 * 60000;
function masEstables(vs, key) {
  const con = vs.filter((v) => v[key] != null);
  if (con.length < 2) return con;
  const filas = con.map((v) => [aMs(v.tsReal || v.ts), v]).sort((a, b) => a[0] - b[0]);
  const n = filas.length, t = filas.map((f) => f[0]), val = filas.map((f) => f[1][key]);
  const ultimo = t[n - 1];
  if (ultimo - t[0] <= ESTABLES_MS) return con;
  const paso = mediana(t.slice(1).map((x, i) => x - t[i]));
  const colaMin = [], colaMax = [];   // índices; la cabeza en hMin / hMax
  let hMin = 0, hMax = 0, hasta = 0;  // ventana deslizante: [i, hasta) entra en 5 min
  let mejorI = -1, mejorHasta = -1, mejorAmp = Infinity;
  for (let i = 0; i < n && t[i] + ESTABLES_MS <= ultimo + paso; i++) {
    while (hasta < n && t[hasta] - t[i] <= ESTABLES_MS) {
      while (colaMin.length > hMin && val[colaMin[colaMin.length - 1]] >= val[hasta]) colaMin.pop();
      colaMin.push(hasta);
      while (colaMax.length > hMax && val[colaMax[colaMax.length - 1]] <= val[hasta]) colaMax.pop();
      colaMax.push(hasta);
      hasta++;
    }
    while (colaMin[hMin] < i) hMin++;
    while (colaMax[hMax] < i) hMax++;
    if (hasta - i < 2 || t[hasta - 1] - t[i] < ESTABLES_MS - paso) continue;
    const amp = val[colaMax[hMax]] - val[colaMin[hMin]];
    if (amp < mejorAmp) { mejorAmp = amp; mejorI = i; mejorHasta = hasta; }
  }
  return mejorI < 0 ? con : filas.slice(mejorI, mejorHasta).map((f) => f[1]);
}
function medianaEstable(vs, key) { return mediana(masEstables(vs, key).map((v) => v[key])); }
// (26-oct-2026, revisión en la PC) El sevorane Et/Fi de UNA ventana, como la
// TA: cada gas con su propia ventana armaba una pareja de dos momentos
// distintos. La elige el espirado (o el inspirado, si no hay espirado).
function sevEstable(vs) {
  const w = masEstables(vs, vs.some((v) => v.sev_et != null) ? "sev_et" : "sev_fi");
  const de = (k) => mediana(w.map((v) => v[k]).filter((x) => x != null)) ?? medianaEstable(vs, k);
  return { et: de("sev_et"), fi: de("sev_fi") };
}

// EL REGISTRO COMPLETO (26-oct-2026, el médico: "cuando los datos en vivo
// capturados son en menor cantidad a los del tiempo de la anestesia,
// autocompletá con parámetros de monitoreo similares"). El monitor que se
// conectó tarde, se desconectó un rato o se apagó antes del fin dejaba
// columnas vacías dentro de las horas del parte. Se completa SOLO EL TIEMPO
// SIN CAPTURA —las columnas de la anestesia donde el monitor no dejó nada—;
// adentro de lo capturado queda lo que midió (no se inventa una TA entre dos
// tomas del NIBP ni un CO2 antes de intubar). Cada parámetro —FC,
// saturación, CO2 y TA con su PAM— lo toma de sus columnas medidas: entre
// dos, el que le toca por su lugar entre ellas; antes de la primera o
// después de la última, el de la más cercana —si se medía en el borde de lo
// capturado—; al ritmo con que aparece en lo capturado (el cable y la VGA
// repiten la última TA en cada fila, así que lo capturado la muestra en cada
// columna y lo completado también; si viniera solo en cada toma, cada tres
// columnas de 5 con una toma cada 15 min) y con una variación chica y
// REPETIBLE (la misma columna sale igual en la central, en la nube y en la
// app). Como los vitales de prueba (cargas.aplicar_vitales_prueba): nunca
// sobre un evento crítico —ese tramo queda en blanco, para la mano del
// médico— y en un Óbito nada desde el último evento crítico (sin evento,
// nada después de lo último medido); nada que el monitor no haya medido
// nunca (sin una TA medida no hay TA); con la serie de prueba no hace falta,
// ya cubre el horario.
// (27-oct-2026, el médico con el parte de Paulino Balsamo: "no me deja
// autocompletar los signos vitales"; el monitor dejó 15 min con FC y nada de
// Sat ni TA) LOS DE LAS NORMAS —FC, saturación y TA, que se monitorean de la
// entrada a la salida— se completan en TODA columna de la anestesia donde
// falten, también adentro de lo capturado (la VGA que no leyó la FC, el
// respirador solo), sin la regla del borde y a su ritmo (entre dos tomas de
// TA del NIBP, nada). El que no se midió nunca, si la ficha dice
// "Monitoreo según Normas FAAAAR: Sí" (el parte afirma que se monitoreó),
// con valores normales como los de prueba, repetibles por parte (`normas`:
// la semilla; sin ella, nada). El CO2 sigue como antes: solo el tiempo sin
// captura y si se medía en el borde (sin vía aérea no hay CO2), y nunca
// inventado. `fin`: el de la anestesia, o sin hora de fin (un
// parte abierto) lo último medido: nunca hacia horas que no pasaron. Solo al
// dibujar: en la base quedan los del monitor tal cual. PURA.
// (27-oct-2026, revisión) Cuatro reglas más para lo que se completa:
// - LO ANORMAL SUELTO NO SE ESTIRA: una columna medida fuera de los topes
//   (una desaturación de un minuto a 82 %, la TA de la entrada a 141/91) no
//   es base para las demás si no se sostuvo en ANORMAL_SOSTENIDO columnas
//   medidas seguidas —con dos, una desaturación de 2 min a caballo de dos
//   columnas ya contaba—: se dibuja en su columna y nada más; estirada,
//   inventaba una hora de hipoxemia en un parte que va a AADOB. Sin otra
//   base, lo que falta queda como nunca medido (normal con las Normas, nada
//   sin ellas). Lo sostenido (la hipertensa, la bradicardia del
//   betabloqueado, el EPOC con 92 %) sí se estira: es el paciente.
// - LA FC Y LA SAT SON CONTINUAS: se completan en cada columna; el ritmo
//   (entre dos tomas, nada) es solo del NIBP. La FC leída de a ratos por la
//   VGA quedaba con huecos, a la distancia de su "ritmo".
// - EN UN ÓBITO SIN EVENTO CRÍTICO, cada uno de las Normas hasta su PROPIA
//   última medición: después del paro el respirador sigue ventilando y esas
//   filas son captura, pero la FC y la Sat ya no llegan (el cable descarta
//   FC < 20 y Sat < 40); cortando en la última fila capturada se inventaban
//   20 min de FC 80 después del paro.
// - `fin` NO ENTRA: la columna que arranca a la hora de fin ya es después de
//   la salida (en la grilla mínima de una VEDA de 30 min existe). Sin hora
//   de fin, quien llama pasa lo último medido más su segundo.
// `normal`: el valor de base cuando no se midió nunca, del rango de los
// vitales de prueba (cargas._vital_de_prueba), y sus topes (también lo que
// cuenta como anormal); `continuo`: se mide todo el tiempo, sin ritmo
const GRUPOS_COMPLETAR = [
  { claves: ["hr"], requeridas: ["hr"], varia: { hr: 3 }, normas: true, continuo: true,
    normal: { hr: [62, 84] }, topes: { hr: [55, 95] } },
  { claves: ["spo2"], requeridas: ["spo2"], varia: { spo2: 1 }, normas: true, continuo: true,
    normal: { spo2: [97, 98] }, topes: { spo2: [96, 100] } },
  { claves: ["etco2"], requeridas: ["etco2"], varia: { etco2: 1 } },
  { claves: ["nibp_sis", "nibp_dia", "nibp_pam"], requeridas: ["nibp_sis", "nibp_dia"],
    varia: { nibp_sis: 4, nibp_dia: 3 }, normas: true,
    normal: { nibp_sis: [112, 130], nibp_dia: [66, 78] },
    topes: { nibp_sis: [105, 140], nibp_dia: [60, 85] } },
];
const RITMO_MAX_COLUMNAS = 6;   // la TA cada 30 min en columnas de 5, como mucho
const ANORMAL_SOSTENIDO = 3;    // columnas medidas seguidas: más de 5 min de registro
// un número entre 0 y 1 que depende solo del texto (FNV-1a): la variación
// repetible, sin Math.random
function azarRepetible(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}
function completarColumnas(vitales, eventos, ini, fin, t0, slotMs, nCol, obito = false,
                           normas = null) {
  if (!vitales.length || vitales.some((v) => v.fuente === "prueba")) return vitales;
  const slotDe = (v) => Math.min(nCol - 1, Math.max(0, Math.floor((aMs(v.ts) - t0) / slotMs)));
  const conHora = vitales.filter((v) => Number.isFinite(aMs(v.ts)));
  // captura es cualquier fila con un dato del monitor, aunque sea solo el
  // respirador; los valores salen de las que traen el parámetro
  const capturados = conHora.filter(tieneDato);
  const medidos = conHora.filter((v) => GRUPOS_COMPLETAR.some((g) => g.requeridas.every((k) => v[k] != null)));
  if (!medidos.length && !(normas && capturados.length)) return vitales;
  // los eventos críticos, desde su hora hasta su duración (sin ella, hasta el fin)
  const criticos = eventos.filter((e) => e.tipo === "critico" && Number.isFinite(aMs(e.ts)))
    .map((e) => [aMs(e.ts), Number(e.duracion) > 0 ? aMs(e.ts) + Number(e.duracion) * 60000
                                                   : Infinity]);
  if (obito) {
    // sin evento, lo último capturado más su segundo (`fin` no entra)
    fin = Math.min(fin, criticos.length ? mayorDe(criticos.map((c) => c[0]))
                                        : mayorDe(capturados.map((v) => aMs(v.ts))) + 1000);
  }
  if (!Number.isFinite(ini) || !Number.isFinite(fin) || fin <= ini) return vitales;
  // (27-oct-2026) en un Óbito sin evento crítico, los de las Normas cortan
  // en su propia última medición (arriba, la regla)
  const cortarNormas = obito && !criticos.length;
  const capturadas = new Set(capturados.map(slotDe));
  const ordenCapturadas = [...capturadas].sort((a, b) => a - b);
  // las columnas de la anestesia que se pueden completar: adentro de
  // [ini, fin) y fuera de un evento crítico
  const libres = [];
  for (let i = 0; i < nCol; i++) {
    const desde = t0 + i * slotMs, hasta = desde + slotMs;
    if (desde >= fin || hasta <= ini) continue;
    if (criticos.some(([d, h]) => desde < h && hasta > d)) continue;
    libres.push(i);
  }
  const sinCaptura = libres.filter((i) => !capturadas.has(i));
  const nuevas = [];
  // (27-oct-2026, revisión) con las Normas la variación lleva también la
  // semilla del parte: dos pacientes con el mismo horario no comparten el
  // mismo zigzag. Sin ellas, como el 26-oct.
  const sal = normas ? `${normas}:` : "";
  const variacion = (i, varia) => {
    const semilla = deMs(t0 + i * slotMs);
    const delta = {};
    for (const k of Object.keys(varia)) {
      delta[k] = Math.round((azarRepetible(`${sal}${semilla}:${k}`) * 2 - 1) * varia[k]);
    }
    return delta;
  };
  const fila = (i, claves, base, delta) => {
    const f = { ts: deMs(t0 + i * slotMs + slotMs / 2), fuente: "completado" };
    for (const k of claves) {
      if (base[k] == null) continue;
      // la PAM sigue a la sistólica y la diastólica (PAM = D + (S − D) / 3)
      const d = k === "nibp_pam" ? ((delta.nibp_sis || 0) + 2 * (delta.nibp_dia || 0)) / 3
        : (delta[k] || 0);
      f[k] = Math.round(base[k] + d);
    }
    if (f.spo2 != null) f.spo2 = Math.min(100, f.spo2);
    // (27-oct-2026, revisión) la sistólica y la diastólica varían cada una
    // por su lado: con una presión de pulso chica (62/56, un shock) salía
    // 58/59, una vela al revés. Se queda con la presión de pulso medida.
    if (f.nibp_sis != null && f.nibp_dia != null && f.nibp_sis <= f.nibp_dia) {
      f.nibp_dia = f.nibp_sis - Math.max(1, Math.round(base.nibp_sis - base.nibp_dia));
      if (f.nibp_pam != null) f.nibp_pam = Math.round(f.nibp_dia + (f.nibp_sis - f.nibp_dia) / 3);
    }
    return f;
  };
  // la última columna con alguno de las Normas medido (el Óbito sin evento)
  const deLasNormasMedido = (v) => GRUPOS_COMPLETAR.some((g) => g.normas && g.requeridas.every((k) => v[k] != null));
  const ultimaDeLasNormas = mayorDe(medidos.filter(deLasNormasMedido).map(slotDe));
  for (const { claves, requeridas, varia, normas: deLasNormas, normal, topes, continuo } of GRUPOS_COMPLETAR) {
    const porSlot = {};
    for (const v of medidos) {
      if (requeridas.some((k) => v[k] == null)) continue;
      (porSlot[slotDe(v)] ||= []).push(v);
    }
    // cada columna medida con el valor que le da la grilla (sus 5 min más estables)
    const medidas = Object.keys(porSlot).map(Number).sort((a, b) => a - b).map((s) => {
      const vs = masEstables(porSlot[s], claves[0]);
      const val = {};
      for (const k of claves) val[k] = mediana(vs.map((v) => v[k]).filter((x) => x != null));
      return { s, val };
    });
    // los de las Normas, toda columna donde falten; el CO2, solo el tiempo
    // sin captura
    let columnas = deLasNormas ? libres.filter((i) => !porSlot[i]) : sinCaptura;
    if (deLasNormas && cortarNormas) {
      const ultima = medidas.length ? medidas[medidas.length - 1].s : ultimaDeLasNormas;
      columnas = columnas.filter((i) => i <= ultima);
    }
    // lo anormal suelto no es base (arriba, la regla): cada medida fuera de
    // los topes con el largo de su racha de medidas fuera seguidas
    const fuera = medidas.map((m) => Object.entries(topes || {}).some(([k, [lo, hi]]) =>
      m.val[k] != null && (m.val[k] < lo || m.val[k] > hi)));
    const racha = medidas.map(() => 0);
    for (let j = 0; j < medidas.length; j++) {
      if (!fuera[j] || racha[j]) continue;
      let k = j;
      while (k < medidas.length && fuera[k]) k++;
      for (let x = j; x < k; x++) racha[x] = k - j;
    }
    const bases = !deLasNormas ? medidas
      : medidas.filter((m, j) => !fuera[j] || racha[j] >= ANORMAL_SOSTENIDO);
    if (!bases.length) {
      // (27-oct-2026) nunca medido —o solo lecturas sueltas fuera de lo
      // normal—: los de las Normas, normales y repetibles por parte, en cada
      // columna donde falten; los demás (el CO2), nada
      if (!deLasNormas || !normas || !capturados.length) continue;
      const base = {};
      for (const [k, [lo, hi]] of Object.entries(normal)) {
        base[k] = lo + Math.floor(azarRepetible(`${normas}:${k}`) * (hi - lo + 1));
      }
      if (base.nibp_sis != null) base.nibp_pam = Math.round(base.nibp_dia + (base.nibp_sis - base.nibp_dia) / 3);
      for (const i of columnas) {
        const f = fila(i, claves, base, variacion(i, varia));
        for (const [k, [lo, hi]] of Object.entries(topes)) f[k] = Math.max(lo, Math.min(hi, f[k]));
        if (f.nibp_sis != null) f.nibp_pam = Math.round(f.nibp_dia + (f.nibp_sis - f.nibp_dia) / 3);
        nuevas.push(f);
      }
      continue;
    }
    // el ritmo de la medición, en columnas: lo que va de una medida a la
    // siguiente adentro de lo capturado (un corte de la captura no cuenta);
    // lo continuo (FC, Sat), en cada columna
    const pasos = medidas.slice(1).map((m, j) => m.s - medidas[j].s)
      .filter((d, j) => {
        for (let c = medidas[j].s + 1; c < medidas[j + 1].s; c++) if (!capturadas.has(c)) return false;
        return true;
      });
    const ritmo = continuo ? 1 : Math.min(RITMO_MAX_COLUMNAS, Math.max(1, Math.round(mediana(pasos) ?? 1)));
    for (const i of columnas) {
      let antes = bases.filter((m) => m.s < i).pop();
      let despues = bases.find((m) => m.s > i);
      // el CO2: cada lado vale si se medía en el BORDE de lo capturado (a
      // menos de su ritmo): el que empieza al intubar, a las 08:50 con el
      // monitor desde las 08:43, no se completa para antes, ni el que
      // termina al extubar para después
      if (!deLasNormas) {
        const bordeAntes = ordenCapturadas.filter((c) => c < i).pop();
        const bordeDespues = ordenCapturadas.find((c) => c > i);
        if (antes && !(bordeAntes - antes.s < ritmo)) antes = undefined;
        if (despues && !(despues.s - bordeDespues < ritmo)) despues = undefined;
      }
      if (!antes && !despues) continue;
      const cerca = !antes ? despues : !despues ? antes
        : i - antes.s <= despues.s - i ? antes : despues;
      if (Math.abs(i - cerca.s) % ritmo !== 0) continue;
      const base = {};
      for (const k of claves) {
        const a = antes && antes.val[k], b = despues && despues.val[k];
        base[k] = a != null && b != null ? a + (b - a) * (i - antes.s) / (despues.s - antes.s)
          : a != null ? a : b;
      }
      nuevas.push(fila(i, claves, base, variacion(i, varia)));
    }
  }
  return nuevas.length ? [...vitales, ...nuevas] : vitales;
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
// Y SIN DECIMALES (9-oct-2026, "cuando sumás el total de las drogas, sin
// decimales"): hacia ARRIBA a la media unidad ("1,5 es 1,5, mayor es dos";
// "2,16 es 2,5"): remifentanilo 2,16 mg → "2,5 mg", midazolam 3,6 → "4";
// 2,5 y 2 quedan como están. Los gramos, igual ("en gramos no", el
// decimal suelto): 1260 mg → "1,5 g", 1500 → "1,5 g", 1600 → "2 g". Lo
// que no llega a 1 mg va en µg (dexmedetomidina 0,07 mg → "70 µg"): en mg
// quedaría en 0,5 o en 1, un registro falso (revisión 15-sep). Y nunca un
// 0 que no es 0: lo que redondea a 0 queda como venía, con todos sus
// decimales. Devuelve { texto, u }: el número ya escrito y la unidad.
function enteroOMedio(n) {
  // con dos decimales, como se escribe: 2,004 es 2 y no sube a 2,5
  const r2 = Math.round(n * 100) / 100;
  return Math.ceil(r2 * 2 - 1e-9) / 2;
}

function totalSinDecimales(n, unidad) {
  const u = String(unidad || "").trim();
  if (u === "mg" && enteroOMedio(n) >= 1000) {
    return { texto: fmtCriollo(enteroOMedio(n / 1000)), u: "g" };
  }
  if (u === "mg" && n > 0 && n < 1 && enteroOMedio(n * 1000) > 0) {
    return { texto: fmtCriollo(enteroOMedio(n * 1000)), u: "µg" };
  }
  const r = enteroOMedio(n);
  if (r === 0 && n > 0) return { texto: String(n).replace(".", ","), u };
  return { texto: fmtCriollo(r), u };
}

function fmtDosisTotal(v, unidad) {
  const n = typeof v === "number" ? v : Number(v);
  const t = Number.isFinite(n) ? totalSinDecimales(n, unidad)
                               : { texto: fmtCriollo(v), u: String(unidad || "").trim() };
  return `${t.texto}${t.u ? ` ${t.u}` : ""}`;
}

// El Total de un renglón de droga, por FAMILIA de unidad (17-oct-2026,
// revisión: morfina 100 µg intratecal + 3 mg IV imprimía "103" pelado, y
// desde el 15-oct la lidocaína del plexo en ml se sumaba a los mg IV:
// "120"). Es la tabla del consumo mensual (backend anestesia_consumo._canon):
// las masas se suman entre sí (en mg), las UI entre sí y los ml entre sí;
// otra unidad, solo con ella misma. Se convierte SOLO si hace falta: si
// toda la familia vino en una unidad, queda esa ("1.200 µg", "2 g"); si
// vino en más de una, pasa a la canónica y totalSinDecimales hace lo de
// siempre (3,1 mg → "3,5 mg", hacia arriba a la media, 9-oct). Cada
// familia con su unidad, unidas con " + ", en orden fijo: masa, UI, ml y
// después las demás como aparecieron ("100 mg + 20 ml", nunca "120"). La
// misma unidad escrita de dos formas (µg y mcg) no es "más de una": queda
// como vino la primera ("1.200 µg", no 1,2 mg que subiría a "1,5 mg"). Sin
// unidad en el dato, el número solo: no se inventa. Map y no un objeto,
// para no tropezar con las claves del prototipo.
const FAMILIAS_DOSIS = [
  { u: "mg", factor: new Map([["mg", 1], ["µg", 0.001], ["μg", 0.001], ["ug", 0.001],
                               ["mcg", 0.001], ["g", 1000], ["gr", 1000]]) },
  { u: "UI", factor: new Map([["ui", 1], ["u.i.", 1], ["u", 1], ["uds", 1], ["unidades", 1]]) },
  { u: "ml", factor: new Map([["ml", 1], ["cc", 1], ["cm3", 1]]) },
];

// items: [{ n, u }] → "3,5 mg", "100 mg + 20 ml", "" si no hay nada
function totalDeDosis(items) {
  const grupos = new Map();
  for (const { n, u } of items) {
    if (!Number.isFinite(n)) continue;
    const literal = String(u ?? "").trim();
    const clave = literal.toLowerCase();
    const fi = FAMILIAS_DOSIS.findIndex((f) => f.factor.has(clave));
    const k = fi >= 0 ? `f${fi}` : `o:${clave}`;
    let g = grupos.get(k);
    if (!g) {
      g = { fi, orden: grupos.size, claves: new Set(), factores: new Set(),
            primera: literal, propia: 0, canon: 0 };
      grupos.set(k, g);
    }
    const f = fi >= 0 ? FAMILIAS_DOSIS[fi].factor.get(clave) : 1;
    g.claves.add(clave);
    g.factores.add(f);
    g.propia += n;
    g.canon += n * f;
  }
  const rango = (g) => (g.fi >= 0 ? g.fi : FAMILIAS_DOSIS.length);
  // una sola unidad, o la misma escrita distinto (µg y mcg): como vino; con
  // factor 1 (UI y U, cc y ml) da igual, la canónica
  const comoVino = (g) => g.claves.size === 1 || (g.factores.size === 1 && !g.factores.has(1));
  return [...grupos.values()]
    .sort((a, b) => rango(a) - rango(b) || a.orden - b.orden)
    .map((g) => (comoVino(g)
      ? fmtDosisTotal(g.propia, g.primera)
      : fmtDosisTotal(g.canon, FAMILIAS_DOSIS[g.fi].u)))
    .join(" + ");
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
  const anestesia = anestesiaDelParte(datos, vitales, eventos);   // (23 y 26-oct-2026)
  vitales = anestesia.vitales;
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
  // Unidad de TASA de infusión ("µg/kg/min", "mg/h"): en ese renglón el
  // Total NO suma las tasas de los tramos (0,25 + 0,1 no significa nada)
  // sino que muestra el consumo en mg. (28-oct-2026, "una droga puede ser en
  // monodosis o en goteo") También "ml/h": el propofol en bomba a 10 ml/h es
  // un goteo con su barra, y su consumo va en ml ("15 ml"); hasta hoy se
  // tomaba por volumen. Los fluidos no pasan por acá (son eventos
  // "volumen"). Lo que no empieza con una letra no es tasa ("%/2L/min"),
  // como es_unidad_tasa del cierre y esUnidadTasa de la app.
  const esUnidadTasa = (u) => {
    const t = String(u ?? "").trim().toLowerCase();
    return /^[a-zµμγ]/.test(t) && (t.includes("/min") || t.includes("/h"));
  };
  const marcas = [...vitales.map((v) => aMs(v.ts)),
                  ...eventos.filter(conHora).map((e) => aMs(e.ts))]
    .filter(Number.isFinite);

  // (26-oct-2026, revisión en la PC) La ventana con las reglas de
  // ventanaDelParte: el fin sigue al ingreso, también pasada la medianoche.
  const ventana = anestesia.ventana;
  let t0 = ventana.t0, t1 = ventana.t1;
  if (t0 == null) {
    t0 = marcas.length ? menorDe(marcas) : Date.now();
    // sin ingreso, la hora de fin sobre el día del comienzo (del siguiente si
    // queda antes, hasta 12 h), no sobre la fecha del primer vital
    const fin = minutosDe(datos.hora_fin);
    if (fin != null) {
      t1 = aMs(`${deMs(t0).slice(0, 10)}T00:00:00`) + fin * 60000;
      if (t1 < t0) t1 = t1 + 24 * 3600000 - t0 <= 12 * 3600000 ? t1 + 24 * 3600000 : null;
    }
  }
  const conFin = t1 != null && t1 > t0;
  if (!conFin) t1 = marcas.length ? Math.max(t0, mayorDe(marcas)) : t0;
  // (26-oct-2026, el parte 67: ficha con 08:00–09:00 cargados a mano y el
  // monitor registrando de 08:43 a 10:46: la grilla cortaba a las 09:00 y
  // casi dos horas de registro en vivo no salían en el parte) Decisión del
  // médico: "si la hora es auto es auto, pero si no, el registro se tiene
  // que acomodar a la no auto". Con las horas a mano MANDAN las horas y el
  // registro del monitor se acomoda adentro: si los vitales reales desbordan
  // la ventana ingreso→fin, se los estira o comprime en proporción (el
  // primero cae a la hora de ingreso, el último a la de fin). Solo al
  // dibujar: en la base quedan con su hora real. Los de prueba no se tocan
  // (salen de la ficha, ya adentro de la ventana). En Auto, o sin fin, no se
  // acomoda: vitalesDeLaAnestesia ya dejó los de su horario, en su hora.
  if (ventana.manual && conFin) vitales = acomodarAlParte(vitales, t0, t1);
  // la anestesia, antes de la grilla mínima; sin hora de fin (un parte
  // abierto), hasta lo último medido, con su segundo (27-oct-2026: el fin de
  // completarColumnas no entra)
  const iniParte = t0;
  const finParte = conFin ? t1
    : mayorDe(vitales.filter((v) => v.fuente !== "prueba" && tieneDato(v)).map((v) => aMs(v.ts))
      .filter(Number.isFinite)) + 1000;
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
  // (26-oct-2026, revisión en la PC) lo que cae fuera de la grilla no entra
  // por el borde: slotDe lo amontonaba en la primera o la última columna
  const finGrilla = t0 + nCol * slotMs + 60000;
  vitales = vitales.filter((v) => !Number.isFinite(aMs(v.ts)) ||
                                  (aMs(v.ts) >= t0 && aMs(v.ts) <= finGrilla));
  // (27-oct-2026) con "Monitoreo según Normas FAAAAR: Sí", lo que el monitor
  // no midió nunca de FC, Sat y TA, normal y repetible por parte. La semilla
  // lleva al paciente —su "Historia Clínica o DNI" (hc_dni; datos.dni no
  // existe) o, sin él, su nombre—: con la fecha y la hora sola, dos pacientes
  // del mismo día ingresados a la misma hora salían con la misma Sat y la
  // misma TA, columna por columna.
  const paciente = String(datos.hc_dni ?? "").trim() || String(datos.nombre ?? "").trim();
  const normas = String(datos.monitoreo_faaaar ?? "").trim() === "Sí"
    ? `${datos.fecha ?? ""}|${datos.hora_ingreso ?? ""}|${paciente}` : null;
  vitales = completarColumnas(vitales, eventos.filter(conHora), iniParte, finParte,
                              t0, slotMs, nCol, datos.pasa_a === "Óbito", normas);   // (26-oct-2026)

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
      (porSlot[slotDe(v.ts)] ||= []).push(v);
    }
    const out = {};
    for (const [s, vs] of Object.entries(porSlot)) out[s] = fmtValor(key, medianaEstable(vs, key));
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
      const { et, fi } = sevEstable(vs);
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
      // sin decimales, como los Totales de las drogas (9-oct-2026)
      anotarFila(ySup + f * ALTO_FILA, etq, datosSup[etq],
                 fmtDosisTotal(consumoSevo.dosis, "ml"));
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
      (porSlot[slotDe(v.ts)] ||= []).push(v);
    }
    const out = {};
    for (const [s, vs] of Object.entries(porSlot)) out[s] = medianaEstable(vs, key);
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
  for (const [s, vsTodos] of Object.entries(velasTA)) {
    const vs = masEstables(vsTodos, "nibp_sis");   // la misma ventana para las tres
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
    const { et, fi } = sevEstable(vs);
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
  // CADA DOSIS CON SU UNIDAD (17-oct-2026, "cada valor numérico de una
  // dosis en el parte que vaya con su unidad de medida"): la celda horaria
  // dice "150 mg" o "0,25 µg/kg/min" (ver el dibujo de las celdas, abajo).
  const conUnidad = (e) => {
    const u = String(e.unidad || "").trim();
    return u ? `${fmtCriollo(e.dosis)} ${u}` : fmtCriollo(e.dosis);
  };
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
      const etq = e.dosis ? conUnidad(e) : "×";
      porSlot[s] = porSlot[s] ? `${porSlot[s]}+${etq}` : etq;
    }
    for (const e of cortesDelRenglon) {
      const s = slotDe(e.ts);
      porSlot[s] = porSlot[s] ? `${porSlot[s]} corte` : "corte";
    }
    // (17-oct-2026) Si entra en su columna, centrada y a letra 7, como
    // siempre. Si no —"0,25 µg/kg/min" en columnas de 5 min—, arranca en su
    // columna y se estira a la derecha hasta la próxima celda ocupada del
    // renglón (en un goteo casi siempre hay varias libres), con la letra
    // más grande que entre (~0,55 de la letra por carácter), nunca menos
    // de 4,4: achicada a su columna sola no se leía en el papel.
    const slots = Object.keys(porSlot).map(Number).sort((a, b) => a - b);
    for (const [i, s] of slots.entries()) {
      const t = porSlot[s];
      if (0.55 * 7 * t.length <= anchoCol * 0.96) {
        txt(xCol(s) + anchoCol / 2, y + 10, t,
            'font-size="7" font-weight="700" text-anchor="middle"');
        continue;
      }
      const hasta = i + 1 < slots.length ? slots[i + 1] : nCol;
      const libre = (hasta - s) * anchoCol - 2;
      const tam = Math.max(4.4, Math.min(7, libre / (0.55 * t.length)));
      txt(xCol(s) + 1, y + 10, t, `font-size="${tam.toFixed(1)}" font-weight="700"`);
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
    // los bolos del renglon con su unidad, para el Total de la fila mixta;
    // se suman por familia de unidad (17-oct-2026, totalDeDosis): un µg con
    // un mg sí, un ml con un mg no. Si alguno no es un número, los bolos no
    // entran al Total, como siempre
    const bolos = delRenglon.filter((e) => esBolo(e) && e.dosis != null && e.dosis !== "");
    const dosisBolos = bolos.every((e) => Number.isFinite(Number(e.dosis)))
      ? bolos.map((e) => ({ n: Number(e.dosis), u: e.unidad })) : [];
    if (infusion) {
      let t = "";
      if (consumo && consumo.dosis != null && consumo.dosis !== "") {
        // el consumo calculado al cierre (mg, o UI para una infusión en
        // UI/h); nada de sumar tasas. En la fila mixta, mas los bolos de su
        // misma familia (150 mg + 315 mg = "465 mg"; 10 µg + 0,03 mg =
        // "40 µg"); los de otra, aparte ("150 mg + 20 ml", 17-oct-2026)
        t = totalDeDosis([...dosisBolos, { n: Number(consumo.dosis), u: consumo.unidad || "mg" }]);
      } else {
        // sin consumo (el parte sigue abierto, un tramo sin hora, un parte
        // cerrado antes del 15-sep, o la app en producción que manda el
        // mantenimiento sin hora): la/s tasa/s tal cual, como siempre —
        // nunca un Total vacío ni una suma de tasas
        const tasas = [];
        const unidades = [];
        // solo las TASAS (21-sep): en la fila unica el bolo ya va aparte
        for (const e of delRenglon.filter((e) => !esConsumo(e) && esUnidadTasa(e.unidad))) {
          const d = e.dosis != null && e.dosis !== "" ? fmtCriollo(e.dosis) : "";
          const u = String(e.unidad || "").trim();
          if (d && !tasas.some((x, i) => x === d && unidades[i] === u)) {
            tasas.push(d);
            unidades.push(u);
          }
        }
        if (new Set(unidades).size > 1) {
          // (revisión 28-oct-2026) un goteo que pasó de µg/kg/min a ml/h:
          // cada tasa con SU unidad ("100 µg/kg/min→12 ml/h"); con la de la
          // fila sola, el 12 quedaba rotulado en µg/kg/min
          const conUnidad = tasas.map((d, i) => (unidades[i] ? `${d} ${unidades[i]}` : d));
          t = conUnidad.length > 2
            ? `${conUnidad[0]}→…→${conUnidad[conUnidad.length - 1]}`
            : conUnidad.join("→");
        } else {
          t = tasas.join("→");
          if (t.length > 15) t = `${tasas[0]}→…→${tasas[tasas.length - 1]}`;
          // (17-oct-2026) con su unidad
          if (t && tasa && String(tasa.unidad || "").trim()) t = `${t} ${String(tasa.unidad).trim()}`;
        }
        // los bolos delante, por familia (17-oct-2026: con bolos en dos
        // unidades desaparecían del Total); sin ninguna tasa con dosis, los
        // bolos solos, sin un " + " colgando
        if (dosisBolos.length) {
          const b = totalDeDosis(dosisBolos);
          t = t ? `${b} + ${t}` : b;
        }
      }
      if (t) {
        txt(xTot + ANCHO_TOT / 2, y + 10, t,
            `font-size="${tamTotal(t)}" font-weight="700" text-anchor="middle"`);
      }
    } else {
      // dosis total en la columna Total, si todas las dosis son numéricas
      const dosis = [];
      let sumable = true;
      for (const e of delRenglon) {
        if (esConsumo(e)) continue;
        const n = e.dosis != null && e.dosis !== "" ? Number(e.dosis) : NaN;
        if (Number.isFinite(n)) dosis.push({ n, u: e.unidad }); else sumable = false;
      }
      if (dosis.length && sumable) {
        // hacia arriba a la media unidad (9-oct-2026), mg que llegan a 1000
        // → "1 g", menos de 1 mg → "500 µg", SIEMPRE con su unidad
        // (17-oct-2026) y por familia de unidad (17-oct-2026, totalDeDosis):
        // nunca un µg sumado a un mg sin pasarlo, ni un ml a un mg
        // (morfina 100 µg + 3 mg → "3,5 mg"; lidocaína 100 mg + 20 ml →
        // "100 mg + 20 ml")
        const tt = totalDeDosis(dosis);
        txt(xTot + ANCHO_TOT / 2, y + 10, tt,
            `font-size="${tamTotal(tt)}" font-weight="700" text-anchor="middle"`);
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
  // (23-oct-2026) con la serie de prueba cuentan solo los de prueba, y lo
  // que no es de esta anestesia no va al parte: ni a la grilla ni a la
  // ventilación ni a la TA basal del Aldrete (26-oct: el registro de la
  // anestesia, aunque desborde las horas, se acomoda en la grilla; la serie
  // de esta anestesia y, en Auto, la de su horario: vitalesDeLaAnestesia)
  vitales = vitalesDeLaAnestesia(parte.datos || {}, vitales, eventos);
  TIPO = elegirTipo(DATOS);
  NOMBRE_TIPO = TIPO === "cgs" ? "CGS" : "Anexo V";
  // Si la ficha eligió los DOS tipos, la barra ofrece ver el otro.
  const otro = document.getElementById("otro-tipo");
  if (otro) {
    const ambos = tiposDelParte(DATOS).includes("anexo_v") && tiposDelParte(DATOS).includes("cgs");
    otro.hidden = !ambos;
    if (ambos) {
      const q = new URLSearchParams(location.search);
      q.set("tipo", TIPO === "cgs" ? "anexo_v" : "cgs");
      otro.href = `?${q.toString()}`;
      otro.textContent = TIPO === "cgs" ? "Ver como Anexo V" : "Ver como CGS";
    }
  }
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
  // los Bloqueos, de la técnica si nadie los tildó a mano (17-oct-2026);
  // DATOS es una copia: lo guardado no cambia
  DATOS.bloqueo = bloqueoDelParte(DATOS);
  const basalAldrete = vitales.find((v) => v.nibp_sis != null);
  const esArm = window.aldreteNoCalifica(DATOS);
  // ÓBITO (13-oct-2026, "un chip que sea óbito, eso anula la extubación y
  // el Aldrete"): el destino dice Óbito y no hay Aldrete que calcular.
  const esObito = DATOS.pasa_a === "Óbito";
  if (esArm) {
    DATOS.aldrete = window.ALDRETE_NO_CALIFICA;
  } else if (esObito) {
    DATOS.aldrete = "";
  } else if (DATOS.aldrete == null || DATOS.aldrete === "") {
    const a = window.calcularAldrete(DATOS, basalAldrete ? basalAldrete.nibp_sis : null);
    if (a != null) DATOS.aldrete = String(a);
  }
  // Los cinco items del Aldrete para el papel; en el ARM, solo el rotulo.
  const aldreteImpreso = () => {
    if (esObito) return ['<span class="relleno"><b>Óbito</b></span>'];
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
        ${/* Solo "DNI" en los dos partes (9-oct-2026, "en ambos partes dejá
              solo DNI"); el formulario de la notebook sigue con el rótulo
              del esquema. */""}
        ${linea(campo("hc_dni", "", "DNI"))}
      </div>
    </div>

    ${linea(campo("nombre"), ops("sexo"), campo("edad", "chico"),
            campo("peso", "chico", "Peso"), '<span class="et">kg</span>')}
    ${/* En el CGS el ASA va en el recuadro "Evaluación pre anestésica" (9-oct-2026), y
          el código de la intervención no va ("en el parte CGS el código por
          intervención no va", 9-oct-2026). */""}
    ${linea(campo("diagnostico"), campo("operacion_propuesta"),
            TIPO === "cgs" ? "" : codigosCirugia("codigo_cirugia", "Cód."),
            // (21-oct-2026) "ASA:" y sus opciones juntos: si no entran, bajan enteros
            TIPO === "cgs" ? "" : `<span style="white-space:nowrap">${ops("asa")}</span>`)}
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

    ${/* En el CGS los antecedentes van en el recuadro "Evaluación pre anestésica"
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
      ${/* (13-oct-2026, "antecedentes patológicos, cirugías anteriores,
            agregar observación, son todos subtítulos de Evaluación pre
            anestésica y debe figurar así en el parte CGS") El recuadro se
            llama así y suma la Observación de la ficha. */""}
      ${TIPO === "cgs" ? `<div class="col">
        <div class="titulo-area">Evaluación pre anestésica</div>
        ${linea(titulo("Antecedentes patológicos:"))}
        <div class="parrafo bajo" style="border-bottom:1px dotted #000">${esc(partirAntecedentes(DATOS.antecedentes).antecedentes)}</div>
        ${linea(titulo("Cirugías anteriores:"))}
        <div class="parrafo bajo" style="border-bottom:1px dotted #000">${esc(partirAntecedentes(DATOS.antecedentes).cirugias)}</div>
        ${linea(titulo("Observación:"))}
        <div class="parrafo bajo" style="border-bottom:1px dotted #000">${esc(DATOS.observacion_preanestesica || "")}</div>
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
                `<span class="relleno chico">${medianaGlobal("pip") || esc(DATOS.pip_cierre || "")}</span>`,
                // (17-oct-2026) con su unidad, como el ml y el /min
                '<span class="et">cmH₂O</span>')}
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
    ${esObito
      ? linea(titulo("Destino:"),
              '<span class="chk sel"><span class="caja">☑</span> <b>Óbito</b></span>')
      : linea(titulo("Destino:"), opsCajas("pasa_a"), sino("requiere_o2"))}

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
