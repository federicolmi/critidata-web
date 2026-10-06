// Lógica del índice: lista de partes + crear nuevo.
"use strict";

const cuerpo = document.getElementById("cuerpo-partes");
const aviso = document.getElementById("aviso");

function mostrarAviso(msj) {
  aviso.textContent = msj;
  aviso.classList.remove("oculto");
}

function fmtFechaHora(iso) {
  if (!iso) return "—";
  const [f, h] = iso.split("T");
  return h ? `${f} ${h.slice(0, 5)}` : f;
}

// El RESPALDO diario de la base (4-oct): cuándo fue la última copia y si
// llegó al disco externo, para que se vea sin abrir nada.
async function mostrarRespaldo() {
  const el = document.getElementById("respaldo");
  if (!el) return;
  try {
    const r = await fetch("/api/respaldo");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const e = await r.json();
    el.classList.toggle("respaldo-mal", Boolean(e.error));
    if (e.error) {
      el.textContent = `Respaldo de la base: ${e.error}.`;
      return;
    }
    if (!e.ultimo) {
      el.textContent = "Respaldo de la base: se hace en unos minutos.";
      return;
    }
    const [fecha, hora] = e.ultimo.split("T");
    const hoy = new Date();
    const dos = (n) => String(n).padStart(2, "0");
    const esHoy = fecha === `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;
    const cuando = esHoy ? `hoy ${hora}` : `${fecha.slice(8, 10)}/${fecha.slice(5, 7)} ${hora}`;
    el.textContent = `Respaldo de la base: ${cuando}, ${e.partes} partes en la notebook` +
      (e.externo ? " y en el disco externo." : `; ${e.aviso_externo}.`);
    el.classList.toggle("respaldo-mal", !e.externo);
  } catch (err) {
    el.textContent = "";
  }
}

// (6-oct-2026, "o los leés del disco externo") La PC de casa: si en el disco
// externo hay un respaldo hecho por la notebook del quirófano, un botón trae
// esos partes a esta máquina, que desde entonces contesta con ellos (PDF,
// imagen, AADOB) como si fuera la notebook. Sin tal respaldo, no se ve.
async function mostrarTraerRespaldo() {
  const caja = document.getElementById("traer-respaldo");
  if (!caja) return;
  try {
    const r = await fetch("/api/respaldo/disco");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const e = await r.json();
    const mejor = (e.respaldos || [])[0];
    if (!mejor) { caja.classList.add("oculto"); return; }
    const quien = /^q\d+$/.test(mejor.etiqueta) ? `del quirófano ${mejor.etiqueta.slice(1)}`
      : mejor.etiqueta ? `de "${mejor.etiqueta}"` : "de la notebook";
    const dia = `${mejor.fecha.slice(8, 10)}/${mejor.fecha.slice(5, 7)}`;
    document.getElementById("traer-texto").textContent =
      `En el disco externo está el respaldo ${quien} del ${dia} (${mejor.partes} partes).`;
    const boton = document.getElementById("traer-boton");
    boton.onclick = async () => {
      const ok = confirm(`Reemplaza los ${e.partes_aqui} partes de esta máquina por los ${mejor.partes} ` +
        `del respaldo ${quien} del ${dia}. La base de ahora queda guardada al lado. ¿Seguir?`);
      if (!ok) return;
      boton.disabled = true;
      try {
        const rr = await fetch("/api/respaldo/traer", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruta: mejor.ruta }),
        });
        const d = await rr.json();
        if (!rr.ok) throw new Error(d.detail || `HTTP ${rr.status}`);
        mostrarAviso(`Listo: ${d.partes} partes traídos de ${d.nombre}. Esta máquina contesta con ellos.`);
        cargarPartes();
        mostrarRespaldo();
      } catch (err) {
        mostrarAviso(`No se pudo traer el respaldo: ${err.message}`);
      } finally {
        boton.disabled = false;
      }
    };
    caja.classList.remove("oculto");
  } catch (err) {
    caja.classList.add("oculto");
  }
}

async function cargarPartes() {
  let partes;
  try {
    const r = await fetch("/api/partes");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    partes = await r.json();
  } catch (e) {
    mostrarAviso(`No se pudo cargar la lista de partes: ${e.message}`);
    cuerpo.innerHTML = "";
    return;
  }
  cuerpo.innerHTML = "";
  if (!partes.length) {
    cuerpo.innerHTML =
      '<tr><td colspan="6" class="celda-vacia">Sin partes todavía. Creá el primero con “+ Nuevo parte”.</td></tr>';
    return;
  }
  for (const p of partes) {
    const tr = document.createElement("tr");
    tr.tabIndex = 0;
    tr.innerHTML = `
      <td class="celda-num">${p.id}</td>
      <td>${p.fecha || "—"}</td>
      <td class="celda-nombre">${p.nombre || "(sin nombre)"}</td>
      <td class="celda-num">${fmtFechaHora(p.creado)}</td>
      <td><span class="badge badge-${p.estado}">${p.estado === "en_curso" ? "En curso" : "Cerrado"}</span></td>
      <td class="celda-accion"><button class="boton-borrar" type="button" title="Borrar este parte">×</button></td>`;
    const abrir = () => { location.href = `parte.html?id=${p.id}`; };
    tr.addEventListener("click", abrir);
    // Borrar un parte viejo (14-sep): pruebas y partes vacíos que ensucian
    // la lista. Se lleva vitales, eventos y su sesión de la nube; el que
    // se está capturando no se deja borrar (el server contesta 409).
    tr.querySelector(".boton-borrar").addEventListener("click", async (ev) => {
      ev.stopPropagation();
      const quien = p.nombre ? `${p.nombre}` : "(sin nombre)";
      if (!confirm(`¿Borrar el parte N° ${p.id} — ${quien}?\n\nSe borran sus signos vitales, sus drogas/eventos y su sesión en la nube. No se puede deshacer.`)) return;
      try {
        const r = await fetch(`/api/partes/${p.id}`, { method: "DELETE" });
        if (!r.ok) {
          let detalle = `HTTP ${r.status}`;
          try { detalle = (await r.json()).detail || detalle; } catch (_) { /* sin cuerpo */ }
          throw new Error(detalle);
        }
        cargarPartes();
      } catch (e) { mostrarAviso(`No se pudo borrar: ${e.message}`); }
    });
    tr.addEventListener("keydown", (ev) => { if (ev.key === "Enter") abrir(); });
    cuerpo.appendChild(tr);
  }
}

document.getElementById("boton-nuevo").addEventListener("click", async () => {
  try {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
    const r = await fetch("/api/partes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datos: { fecha } }),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { id } = await r.json();
    location.href = `parte.html?id=${id}`;
  } catch (e) {
    mostrarAviso(`No se pudo crear el parte: ${e.message}`);
  }
});

cargarPartes();
mostrarRespaldo();
mostrarTraerRespaldo();
// Se vuelve a mirar cada minuto: la copia del día se rehace sola.
setInterval(mostrarRespaldo, 60000);

// ------------------------------------------------------------- monitoreo
// INICIAR MONITOREO desde la notebook (4-oct-2026, "abrimos la app y que
// arranque ahí con un botón", en vez de depender de la IA): un botón arriba
// de la lista hace lo mismo que "Iniciar registro" del celular —el parte en
// curso de hoy o uno nuevo, la lectura del monitor y la subida en vivo— y
// el panel dice cómo va, sin abrir el parte.

function horaDe(iso) {
  if (!iso) return "";
  const h = String(iso).split("T")[1] || "";
  return h.slice(0, 8);
}

function pintarMonitoreo(est) {
  const c = est.captura || {};
  const n = est.nube || {};
  const punto = document.getElementById("monitoreo-punto");
  const titulo = document.getElementById("monitoreo-titulo");
  const detalle = document.getElementById("monitoreo-detalle");
  const error = document.getElementById("monitoreo-error");
  const ver = document.getElementById("monitoreo-ver");
  const iniciar = document.getElementById("monitoreo-iniciar");
  const detener = document.getElementById("monitoreo-detener");

  iniciar.classList.toggle("oculto", Boolean(c.activa));
  detener.classList.toggle("oculto", !c.activa);
  ver.classList.toggle("oculto", !(c.activa && c.parte_id));
  if (c.parte_id) ver.href = `parte.html?id=${c.parte_id}`;

  // El subidor guarda en `error` también un AVISO de espera: "Leyendo el
  // rótulo del monitor (quirófano) para nombrar la sesión…" (termina en
  // "…"). Eso no es una falla y no va en rojo.
  const esperaNube = Boolean(n.error) && String(n.error).endsWith("…");
  let clase = "punto-gris";
  let tit = "Monitoreo detenido";
  let det = "Tocá «Iniciar monitoreo» para leer el monitor y subirlo en vivo.";
  // (5-oct-2026) Frenado por un Detener o un cierre del médico: el monitor
  // no lo vuelve a arrancar solo, y el panel lo dice.
  if (!c.activa && est.autoarranque_frenado) {
    det = "El monitor no lo arranca solo: lo frenó el " +
          `${est.autoarranque_frenado}. Para seguir, «Iniciar monitoreo».`;
  }
  if (c.activa) {
    tit = `Monitoreo en marcha · parte N° ${c.parte_id}`;
    if (c.ultima_ok) {
      clase = "punto-verde";
      det = `Leyendo el monitor: última lectura ${horaDe(c.ultima_ts)}`;
    } else if (c.error) {
      clase = "punto-rojo";
      det = "No lee el monitor: reintenta solo";
    } else {
      clase = "punto-ambar";
      det = "Arrancando la lectura del monitor…";
    }
    if (c.quirofano) det += ` · Quirófano ${c.quirofano}`;
    if (!n.conectado) {
      det += " · Sin subir: la notebook no está vinculada a la nube";
    } else if (n.activa && esperaNube) {
      det += ` · ${n.error}`;   // un aviso de espera, no una falla
    } else if (n.activa && n.error) {
      det += " · La subida en vivo tiene un error y reintenta sola";
      if (clase === "punto-verde") clase = "punto-ambar";
    } else if (n.activa) {
      det += " · En vivo en la nube";
    }
  }
  punto.className = `punto punto-grande ${clase}`;
  titulo.textContent = tit;
  detalle.textContent = det;
  const problema = c.activa
    ? (c.error || (n.activa && n.error && !esperaNube ? n.error : ""))
    : "";
  error.classList.toggle("oculto", !problema);
  error.textContent = problema;
}

async function traerMonitoreo() {
  try {
    const r = await fetch("/api/monitoreo/estado");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    pintarMonitoreo(await r.json());
  } catch (e) { /* servidor ocupado o caído: lo nota la próxima vuelta */ }
}

async function ordenMonitoreo(orden) {
  const boton = document.getElementById(`monitoreo-${orden}`);
  boton.disabled = true;
  try {
    const r = await fetch(`/api/monitoreo/${orden}`, { method: "POST" });
    if (!r.ok) {
      let detalle = `HTTP ${r.status}`;
      try { detalle = (await r.json()).detail || detalle; } catch (_) { /* sin cuerpo */ }
      throw new Error(detalle);
    }
    await traerMonitoreo();
    cargarPartes();   // el parte nuevo aparece en la lista
  } catch (e) {
    mostrarAviso(`No se pudo ${orden === "iniciar" ? "iniciar" : "detener"} el monitoreo: ${e.message}`);
  } finally {
    boton.disabled = false;
  }
}

document.getElementById("monitoreo-iniciar").addEventListener("click",
  () => ordenMonitoreo("iniciar"));
document.getElementById("monitoreo-detener").addEventListener("click", () => {
  // Un toque accidental en plena cirugía corta el registro: se confirma.
  if (!confirm("¿Detener el monitoreo?\n\nDeja de leer el monitor y de subir en vivo. " +
               "El monitor no lo vuelve a arrancar solo hasta que toques «Iniciar monitoreo».")) return;
  ordenMonitoreo("detener");
});

traerMonitoreo();
setInterval(traerMonitoreo, 3000);
