// LA DEMO de CritiData Anestesia (5-oct-2026, "me gustaría verlo como el
// demo de la web"): la nube, la notebook del quirófano y el monitor Dräger
// Vista 120, simulados en el navegador. La app del anestesiólogo (Flutter,
// compilada con DEMO_WEB) y las páginas de la notebook (copias de
// app/static) son las de verdad: este archivo contesta sus pedidos —los
// fetch a la nube y a /api/, y el WebSocket del vivo— desde un estado
// guardado en localStorage con clave propia, que comparten las ventanas de
// la demo (mismo origen). Nada sale del navegador; los pacientes son
// inventados.
//
// Imita, en chico, lo que hacen app/cargas.py (la ficha que llega, el
// concluir, las órdenes, el arranque solo con el monitor, el consumo al
// cierre), app/servidor.py (las rutas de la notebook) y el backend (las
// rutas /anestesia/* y /auth/*): lo que se ve en la demo, no cada regla de
// la casa. Si una regla cambia allá y la demo la muestra, se copia acá.
"use strict";

(function () {
  if (window.critidataDemo) return;   // ya cargado en esta ventana

  const CLAVE = "critidata-anestesia-demo-estado";
  const PREFIJO = "critidata-anestesia-demo";   // el de la app (kPrefijoGuardado)
  const VERSION = 1;
  const NUBE = "https://nube.demo.invalid";     // el LOGIN_URL de la app demo
  const QUIROFANO = "1";
  const PASO_MS = 3000;            // el lector del monitor: una lectura cada 3 s
  const PASO_HISTORICO_MS = 30000; // los partes viejos de la demo, cada 30 s
  const ESPERA_CENTINELA_MS = 6000;   // dos miradas al monitor y arranca solo
  const DEMORA_PDF_MS = 2500;      // lo mínimo que "tarda" la notebook en el PDF
  const RAIZ = new URL(".", (document.currentScript && document.currentScript.src)
    || location.href).href;

  // ───────────────────────────────────────────────────────── utilidades

  const dos = (n) => String(n).padStart(2, "0");
  function isoLocal(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}` +
      `T${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
  }
  // El backend manda sus fechas en UTC SIN zona (ver fechas-del-backend-utc).
  const isoUtcSinZona = (ms) => new Date(ms).toISOString().slice(0, 19);
  const fechaLocal = (ms) => isoLocal(ms).slice(0, 10);
  const horaLocal = (ms) => isoLocal(ms).slice(11, 16);
  function msDeIso(iso) {
    const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d))?/.exec(String(iso || ""));
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime();
  }
  function hhmm(texto) {
    const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(String(texto || ""));
    if (!m || +m[1] > 23 || +m[2] > 59) return null;
    return `${dos(+m[1])}:${m[2]}`;
  }
  const texto = (v) => (v == null ? "" : String(v));
  const vacio = (v) => v == null || (Array.isArray(v) ? v.length === 0 : texto(v).trim() === "");
  const esSi = (v) => ["1", "true", "si", "sí"].includes(texto(v).trim().toLowerCase());
  const soloDigitos = (t) => texto(t).replace(/\D/g, "");
  const mismoPaciente = (a, b) => { const x = soloDigitos(a); return !!x && x === soloDigitos(b); };
  function normalizar(t) {
    return texto(t).normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  }
  // Azar REPETIBLE: el mismo (semilla, n, k) da siempre el mismo número, así
  // cada ventana de la demo calcula los mismos signos para el mismo segundo.
  function azar(semilla, n, k) {
    let h = Math.imul(semilla | 0, 374761393) ^ Math.imul(n | 0, 668265263) ^ Math.imul(k | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // ─────────────────────────────────────────────── el estado compartido

  let enMemoria = null;   // sin localStorage (modo privado estricto)

  function leerCrudo() {
    try { return localStorage.getItem(CLAVE); } catch (_) { return enMemoria; }
  }
  function cargar() {
    const crudo = leerCrudo();
    if (crudo) {
      try {
        const e = JSON.parse(crudo);
        if (e && e.v === VERSION) return e;
      } catch (_) { /* roto: se siembra de nuevo */ }
    }
    const e = sembrar(Date.now());
    guardar(e);
    return e;
  }
  function guardar(e) {
    e.cambios = (e.cambios || 0) + 1;
    const txt = JSON.stringify(e);
    enMemoria = txt;
    try { localStorage.setItem(CLAVE, txt); } catch (_) { /* queda en memoria */ }
  }

  // ─────────────────────────────────────────────── los partes de ejemplo

  function sembrar(ahora) {
    const e = {
      v: VERSION, cambios: 0,
      ids: { parte: 102, evento: 0, pedido: 0 },
      partes: [],
      captura: { activa: false, parte_id: null, intervalo_s: 1 },
      subida: { activa: false, parte_id: null },
      frenado: null,
      ultimoConcluido: null,
      monitor: { conectado: false, desde: null },
      pasos: {},   // lo que ya hizo quien prueba (la guía de la portada)
    };
    // 101: el parte de la planilla de demostración de la app (datos_demo.js),
    // con su fecha fija.
    const dia = "2026-08-27";
    const t0 = msDeIso(`${dia}T08:00:00`);
    const p101 = {
      id: 101, creado: `${dia}T07:55:00`, estado: "cerrado", perfil: "general",
      t0, lecturas: [[t0, t0 + 105 * 60000, PASO_HISTORICO_MS]], manuales: [],
      sesion: null, eventos: [],
      datos: {
        fecha: dia, hc_dni: "12.345.678", nombre: "PACIENTE DE DEMOSTRACIÓN",
        sexo: "M", edad: "34", peso: "78", diagnostico: "Apendicitis aguda",
        operacion_propuesta: "Apendicectomía laparoscópica",
        codigo_cirugia: "07.06.02", asa: "3 E", anestesiologos: "Dr. Demo",
        hora_ingreso: "08:00", hora_fin: "09:45", quirofano: "1",
        tipo_anestesia: "General",
        condicion_ingreso: "Lúcido, hemodinámicamente estable, afebril.",
        vias_ingreso: ["VP"],
        antecedentes: "Sin antecedentes patológicos de relevancia. Niega alergias.",
        monitoreo_faaaar: "Sí", proteccion_ocular: "Sí", proteccion_decubitos: "Sí",
        ayuno_hs: "8", premedicacion: "Midazolam 2 mg IV.",
        induccion: "Propofol 150 mg + Fentanilo 150 µg + Rocuronio 50 mg IV. " +
          "Laringoscopía directa Cormack I, intubación orotraqueal sin dificultad.",
        posicion: "Decúbito dorsal", tubo_tipo: "Oral", tubo_numero: "7.5",
        dificultad: "No", respiracion: "Controlada", comandada: "Mecánica",
        sistema: "Circular", peep_cierre: "5", fio2_cierre: "50", fgf: "2",
        agente_anestesico: "Sevorane", dosis_agente: "2%",
        estimulos_dolorosos: "Sí", obedece_ordenes: "Sí",
        depresion_respiratoria: "No", moviliza_msup: "Sí", moviliza_minf: "Sí",
        tas_final: "118", sat_final: "98", pasa_a: "Recuperación",
        requiere_o2: "No", aclaracion: "Dr. Demo", mp_mn: "MP 12345",
      },
    };
    const ev101 = (min, tipo, descripcion, dosis, unidad, extra) => ({
      id: ++e.ids.evento, ts: isoLocal(t0 + min * 60000), tipo, descripcion,
      dosis: dosis == null ? null : String(dosis), unidad: unidad ?? null,
      gatillo: null, ubicado: 1, minutos: null, kg: null, duracion: null, ...(extra || {}),
    });
    p101.eventos = [
      ev101(2, "droga", "Fentanilo", 150, "µg"),
      ev101(2, "droga", "Propofol", 150, "mg"),
      ev101(3, "droga", "Rocuronio", 50, "mg"),
      ev101(0, "droga", "Remifentanilo", 0.25, "µg/kg/min", { gatillo: "inicio", minutos: 0, kg: 78 }),
      ev101(60, "droga", "Remifentanilo", 0.15, "µg/kg/min", { kg: 78 }),
      ev101(95, "droga", "Remifentanilo", 0.1, "µg/kg/min", { gatillo: "cierre", minutos: 10, kg: 78 }),
      ev101(105, "droga", "Remifentanilo", 1.66, "mg", { gatillo: "consumo", ubicado: 0 }),
      ev101(10, "droga", "Cefazolina", 2, "g"),
      ev101(12, "droga", "Efedrina", 6, "mg", { gatillo: "hipotension" }),
      ev101(62, "droga", "Fentanilo", 50, "µg"),
      ev101(80, "droga", "Dipirona", 2, "g"),
      ev101(85, "droga", "Ondansetrón", 4, "mg"),
      ev101(30, "volumen", "Sol. Fisiológica", 500, "ml"),
      ev101(90, "volumen", "Sol. Fisiológica", 500, "ml"),
      ev101(100, "volumen", "Diuresis", 200, "ml"),
      ev101(4, "evento", "Intubación orotraqueal"),
      ev101(15, "evento", "Inicio de cirugía"),
      ev101(95, "evento", "Fin de cirugía"),
      ev101(103, "evento", "Extubación"),
    ];
    e.partes.push(p101);

    // 102: García, María — AYER, videocolonoscopía con sedación. La agenda
    // de la app la tiene concluida, en Parte (agenda_demo.dart).
    const hoy0 = new Date(ahora); hoy0.setHours(0, 0, 0, 0);
    const ayer = hoy0.getTime() - 86400000;
    const a0 = ayer + (10 * 60 + 30) * 60000;
    const p102 = {
      id: 102, creado: isoLocal(a0 - 2 * 60000), estado: "cerrado", perfil: "sedacion",
      t0: a0, lecturas: [[a0, a0 + 45 * 60000, PASO_HISTORICO_MS]], manuales: [],
      sesion: null, eventos: [],
      datos: {
        fecha: fechaLocal(a0), hc_dni: "20.345.678", nombre: "García, María",
        sexo: "F", edad: "58", peso: "70", diagnostico: "Pólipo de colon",
        operacion_propuesta: "Videocolonoscopía con polipectomía",
        codigo_cirugia: "110717 EB", asa: "2", quirofano: "1",
        tipo_anestesia: "Sedación", tipo_intervencion: "Ambulatoria",
        hora_ingreso: horaLocal(a0), hora_fin: horaLocal(a0 + 45 * 60000),
        condicion_ingreso: "Lúcida, estable.", vias_ingreso: ["VP"], ayuno_hs: "8",
        premedicacion: "—", induccion: "Propofol 70 mg + Fentanilo 50 µg IV.",
        posicion: "Decúbito lateral", respiracion: "Espontánea",
        suplemento_o2: ["Cánula nasal"],
        estimulos_dolorosos: "Sí", obedece_ordenes: "Sí",
        depresion_respiratoria: "No", moviliza_msup: "Sí", moviliza_minf: "Sí",
        tas_final: "112", sat_final: "97", pasa_a: "Recuperación", requiere_o2: "No",
        aclaracion: "Dra. Demo", mp_mn: "MP 54321",
      },
    };
    const ev102 = (min, tipo, descripcion, dosis, unidad) => ({
      id: ++e.ids.evento, ts: isoLocal(a0 + min * 60000), tipo, descripcion,
      dosis: dosis == null ? null : String(dosis), unidad: unidad ?? null,
      gatillo: null, ubicado: 1, minutos: null, kg: null, duracion: null,
    });
    p102.eventos = [
      ev102(1, "droga", "Fentanilo", 50, "µg"),
      ev102(2, "droga", "Propofol", 70, "mg"),
      ev102(12, "droga", "Propofol", 30, "mg"),
      ev102(25, "droga", "Propofol", 20, "mg"),
      ev102(3, "evento", "Inicio del procedimiento"),
      ev102(40, "evento", "Fin del procedimiento"),
    ];
    e.partes.push(p102);
    return e;
  }

  // ───────────────────────────────────────── el monitor (signos simulados)

  // El PERFIL del paciente decide qué muestra el monitor: la General ventila
  // y tiene sevorane; la sedación y el bloqueo respiran solos.
  function perfilDe(datos) {
    const t = normalizar(`${texto(datos.tipo_anestesia)} ${texto(datos.agente_anestesico)}`);
    if (/general|sevo|desflu|isoflu/.test(t)) return "general";
    if (/sedac/.test(t)) return "sedacion";
    if (/raqu|perid|bloqueo|plex|regional/.test(t)) return "regional";
    return "general";
  }

  // Los signos del segundo [t] de la anestesia que empezó en [t0], para el
  // paciente [semilla]. Puros: dos ventanas que preguntan lo mismo reciben
  // lo mismo. La forma: estable, con la hipotensión de la inducción entre
  // los 8 y los 17 min (las drogas "tras hipotensión" toman esa hora).
  function vitalEn(t, t0, semilla, perfil) {
    const min = (t - t0) / 60000;
    const n = Math.floor(t / 1000);
    const r = (k) => azar(semilla, n, k) - 0.5;
    const general = perfil === "general";
    const intubado = general && min >= 3;
    const gas = general && min >= 5;
    const bajon = min >= 8 && min < 17;
    const fc = Math.round(74 + 5 * Math.sin(min / 11) + 3 * r(1) - (bajon ? 7 : 0));
    // El manguito mide cada 5 min; el monitor muestra la última toma.
    const toma = Math.max(0, Math.floor(min / 5));
    const rt = (k) => azar(semilla, 900000 + toma, k) - 0.5;
    let sis, dia;
    if (toma === 2 || toma === 3) {
      sis = toma === 2 ? 86 : 88; dia = toma === 2 ? 50 : 52;
    } else {
      sis = Math.round(118 + 6 * Math.sin(toma / 3) + 6 * rt(1));
      dia = Math.round(72 + 4 * Math.sin(toma / 3) + 4 * rt(2));
    }
    const etco2 = intubado ? Math.round(35 + 2 * Math.sin(min / 13) + 2 * r(3))
      : perfil === "sedacion" && min >= 1 ? Math.round(31 + 2 * Math.sin(min / 9) + 2 * r(3))
      : null;
    const sevEt = gas ? Math.round((1.9 + 0.15 * Math.sin(min / 15) + 0.12 * r(4)) * 10) / 10 : null;
    const vt = intubado ? Math.round(480 + 20 * Math.sin(min / 17) + 8 * r(5)) : null;
    const frEsp = Math.round(14 + 2 * Math.sin(min / 7) + r(6));
    return {
      ts: isoLocal(t), fuente: "auto",
      hr: fc,
      spo2: min < 1 ? 97 : r(2) > 0.25 ? 98 : 99,
      rr: intubado ? 12 : frEsp,
      nibp_sis: sis, nibp_dia: dia, nibp_pam: Math.round((sis + 2 * dia) / 3),
      etco2,
      fico2: etco2 == null ? null : 0,
      awrr: intubado ? 12 : etco2 == null ? null : frEsp,
      sev_et: sevEt,
      sev_fi: gas ? Math.round((sevEt + 0.3) * 10) / 10 : null,
      mac: gas ? Math.round(sevEt / 2.05 * 10) / 10 : null,
      peep: intubado ? 5 : null,
      pip: intubado ? Math.round(17 + Math.sin(min / 7) + r(7)) : null,
      pmedia: intubado ? 9 : null,
      vt,
      mv: intubado ? Math.round(vt * 12 / 100) / 10 : null,
      fr_vent: intubado ? 12 : null,
    };
  }

  // Las CURVAS del monitor (lo que el WebSocket manda como {"curvas"}): 6 s
  // de ECG, pletismografía y capnografía, en 0..100.
  function curvasEn(v) {
    const N = 300, seg = 6;
    const fc = v && v.hr ? v.hr : 72;
    const fr = v && (v.fr_vent || v.awrr || v.rr) ? (v.fr_vent || v.awrr || v.rr) : 12;
    const alto = v && v.etco2 ? Math.min(95, v.etco2 * 2.2) : 0;
    const ecg = [], pleti = [], co2 = [];
    const g = (x, c, a) => Math.exp(-((x - c) * (x - c)) / (2 * a * a));
    for (let i = 0; i < N; i++) {
      const s = (i / N) * seg;
      const f = (s * fc / 60) % 1;
      ecg.push(Math.round(40 + 6 * g(f, 0.12, 0.025) - 6 * g(f, 0.22, 0.008) +
        52 * g(f, 0.25, 0.01) - 12 * g(f, 0.28, 0.01) + 12 * g(f, 0.5, 0.05)));
      const fp = (f + 0.85) % 1;
      pleti.push(Math.round(15 + 65 * g(fp, 0.18, 0.07) + 22 * g(fp, 0.42, 0.08)));
      const fc2 = (s * fr / 60) % 1;
      const subida = Math.min(1, fc2 / 0.08);
      const meseta = fc2 < 0.45 ? subida * (0.92 + 0.08 * (fc2 / 0.45)) : Math.max(0, 1 - (fc2 - 0.45) / 0.05);
      co2.push(alto ? Math.round(3 + alto * meseta) : null);
    }
    const curvas = { ecg, pleti };
    if (alto) curvas.co2 = co2;
    return curvas;
  }

  function parteDe(e, id) { return e.partes.find((p) => p.id === Number(id)) || null; }

  function abrirLectura(p, ahora) {
    if ((p.lecturas || []).some((l) => l[1] == null)) return;
    p.lecturas.push([ahora, null, PASO_MS]);
    if (p.t0 == null) {
      p.t0 = ahora;
      p.perfil = perfilDe(p.datos);
    }
  }
  function cerrarLecturas(p, ahora) {
    for (const l of p.lecturas || []) if (l[1] == null) l[1] = ahora;
  }

  // Los vitales del parte, ordenados por ts; [desde] (ts exclusivo) trae
  // solo lo nuevo, como basedatos.listar_vitales.
  function vitalesDe(p, desde, ahora) {
    const filas = [];
    const desdeMs = desde ? msDeIso(desde) : null;
    for (const [ini, fin, paso] of p.lecturas || []) {
      const hasta = Math.min(fin == null ? ahora : fin, ahora);
      let k = Math.ceil(ini / paso);
      if (desdeMs != null) k = Math.max(k, Math.floor(desdeMs / paso) + 1);
      for (let t = k * paso; t <= hasta; t += paso) {
        filas.push({ id: Math.floor(t / 1000), ...vitalEn(t, p.t0 ?? ini, p.id, p.perfil || "general") });
      }
    }
    for (const m of p.manuales || []) {
      if (!desde || m.ts > desde) filas.push(m);
    }
    filas.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    return filas;
  }
  function ultimoVital(p, ahora) {
    const abierta = (p.lecturas || []).find((l) => l[1] == null);
    const lect = abierta || (p.lecturas || [])[p.lecturas.length - 1];
    if (!lect) return null;
    const [ini, fin, paso] = lect;
    const hasta = Math.min(fin == null ? ahora : fin, ahora);
    const t = Math.floor(hasta / paso) * paso;
    if (t < ini) return null;
    return vitalEn(t, p.t0 ?? ini, p.id, p.perfil || "general");
  }

  // ─────────────────────────────────────── la captura, la subida, el freno

  function inhibir(e, motivo, ahora) { e.frenado = `${motivo} a las ${horaLocal(ahora)}`; }
  function permitir(e) { e.frenado = null; e.ultimoConcluido = null; }

  function capturaDetener(e, ahora) {
    const p = parteDe(e, e.captura.parte_id);
    if (p) cerrarLecturas(p, ahora);
    e.captura = { activa: false, parte_id: null, intervalo_s: e.captura.intervalo_s || 1 };
  }
  function capturaIniciar(e, p, ahora, intervalo) {
    if (e.captura.activa && e.captura.parte_id !== p.id) capturaDetener(e, ahora);
    if (vacio(p.datos.hora_ingreso)) p.datos.hora_ingreso = horaLocal(ahora);
    e.captura = { activa: true, parte_id: p.id, intervalo_s: intervalo || 1, desde: ahora };
    if (e.monitor.conectado) abrirLectura(p, ahora);
  }
  function subidaIniciar(e, p, ahora) {
    e.subida = { activa: true, parte_id: p.id, desde: ahora };
    if (!p.sesion) p.sesion = { creado: ahora };
  }
  function subidaDetener(e) { e.subida = { activa: false, parte_id: null }; }

  function nuevoParte(e, datos, ahora) {
    const p = {
      id: ++e.ids.parte, creado: isoLocal(ahora), estado: "en_curso", perfil: null,
      t0: null, lecturas: [], manuales: [], sesion: null, eventos: [], datos: { ...datos },
    };
    e.partes.push(p);
    return p;
  }

  // La ORDEN del quirófano (cargas.ejecutar_orden): "iniciar" sobre el en
  // curso de hoy más reciente, o uno nuevo; "detener" corta y frena el
  // arranque solo. Sin [delMedico] (el centinela) respeta el freno.
  function ejecutarOrden(e, orden, delMedico, ahora) {
    if (orden === "detener") {
      capturaDetener(e, ahora);
      subidaDetener(e);
      inhibir(e, "Detener registro", ahora);
      return "captura y subida detenidas";
    }
    if (orden !== "iniciar") return `orden desconocida: ${orden}`;
    if (delMedico) permitir(e);
    else if (e.frenado) return `autoarranque inhibido (${e.frenado})`;
    const hoy = fechaLocal(ahora);
    const enCurso = e.partes
      .filter((p) => p.estado === "en_curso" && p.creado.startsWith(hoy))
      .sort((a, b) => b.id - a.id);
    const p = enCurso[0] || nuevoParte(e, { peso: "70", fecha: hoy, quirofano: QUIROFANO }, ahora);
    capturaIniciar(e, p, ahora, 1);
    subidaIniciar(e, p, ahora);
    return `captura + subida en vivo iniciadas sobre el parte ${p.id}`;
  }

  // El CENTINELA y lo que pasa solo con el tiempo. true si cambió algo.
  function tic(e, ahora) {
    let cambio = false;
    if (e.monitor.conectado && !e.captura.activa && !e.frenado &&
        e.monitor.desde != null && ahora - e.monitor.desde >= ESPERA_CENTINELA_MS) {
      ejecutarOrden(e, "iniciar", false, ahora);
      cambio = true;
    }
    for (const p of e.partes) {
      if (p.estado === "en_curso" && p.eventos.some((ev) => !ev.ubicado && ev.gatillo &&
          ev.gatillo !== "cierre" && ev.gatillo !== "consumo")) {
        if (ubicarPendientes(p, ahora, false)) cambio = true;
      }
    }
    return cambio;
  }

  function monitorConectar(e, conectado, ahora) {
    if (Boolean(e.monitor.conectado) === Boolean(conectado)) return;
    e.monitor = { conectado: Boolean(conectado), desde: conectado ? ahora : null };
    const p = e.captura.activa ? parteDe(e, e.captura.parte_id) : null;
    if (p) {
      if (conectado) abrirLectura(p, ahora);
      else cerrarLecturas(p, ahora);
    }
  }

  // ───────────────────────────────────────── la carga que llega de la app

  const CAMPOS_PERMITIDOS = [
    "nombre", "hc_dni", "diagnostico", "edad", "operacion_propuesta",
    "codigo_cirugia", "sexo", "peso", "anestesiologos", "hora_ingreso",
    "hora_fin", "quirofano", "fecha", "agentes_tiempo", "tipo_anestesia",
    "condicion_ingreso", "vias_ingreso", "antecedentes", "asa",
    "tipo_intervencion", "premedicacion", "induccion", "posicion",
    "tubo_tipo", "tubo_numero", "antiseptico", "zona_puncion", "aguja",
    "material", "agente_anestesico", "dosis_agente", "cateter",
    "dosis_prueba", "agente_bloqueo", "dosis_bloqueo", "dificultad",
    "otras_vias", "suplemento_o2", "respiracion", "peep_cierre",
    "fio2_cierre", "comandada", "sistema", "fgf", "vol_corriente",
    "frec_resp", "pip_cierre", "monitoreo_faaaar", "proteccion_ocular",
    "proteccion_decubitos", "estimulos_dolorosos", "obedece_ordenes",
    "depresion_respiratoria", "moviliza_msup", "moviliza_minf",
    "circulacion_aldrete", "aldrete", "tas_final", "sat_final", "pasa_a",
    "requiere_o2", "ayuno_hs", "vias_comentario", "comentarios",
    "aclaracion", "mp_mn", "firma_png", "firmado_en", "ingreso_uti",
    "via_aerea_uti", "ventilacion_uti",
  ];
  const CAMPOS_CHECKS = ["vias_ingreso", "antiseptico", "material",
    "suplemento_o2", "ingreso_uti", "via_aerea_uti"];

  function comoLista(v) {
    const crudos = Array.isArray(v) ? v.map(String) : texto(v).split(/[,/]/);
    const vistos = new Set(), lista = [];
    for (let x of crudos) {
      x = x.trim();
      if (x && !vistos.has(x.toLowerCase())) { vistos.add(x.toLowerCase()); lista.push(x); }
    }
    return lista;
  }
  function datosDeCarga(payload) {
    const nuevos = {};
    for (const campo of CAMPOS_PERMITIDOS) {
      const v = payload[campo];
      if (v == null) continue;
      if (CAMPOS_CHECKS.includes(campo)) {
        const l = comoLista(v);
        if (l.length) nuevos[campo] = l;
        continue;
      }
      const t = texto(v).trim();
      if (t) nuevos[campo] = t;
    }
    if (!nuevos.peso) nuevos.peso = "70";
    if (!nuevos.quirofano) nuevos.quirofano = QUIROFANO;
    return nuevos;
  }

  function idsActivos(e) {
    const ids = new Set();
    if (e.captura.activa) ids.add(e.captura.parte_id);
    if (e.subida.activa) ids.add(e.subida.parte_id);
    return ids;
  }
  function elMejor(candidatos, e) {
    const activos = idsActivos(e);
    return candidatos.sort((a, b) =>
      (activos.has(b.id) - activos.has(a.id)) || (b.id - a.id))[0] || null;
  }
  function parteEnCursoDelPaciente(e, dni, ahora) {
    const hoy = fechaLocal(ahora), ayer = fechaLocal(ahora - 86400000);
    return elMejor(e.partes.filter((p) => p.estado === "en_curso" &&
      [hoy, ayer].includes(p.creado.slice(0, 10)) && mismoPaciente(dni, p.datos.hc_dni)), e);
  }
  function parteLibreDeHoy(e, ahora) {
    const hoy = fechaLocal(ahora);
    return elMejor(e.partes.filter((p) => p.estado === "en_curso" &&
      p.creado.startsWith(hoy) && !soloDigitos(p.datos.hc_dni)), e);
  }
  function parteDeLaCorreccion(e, dni, concluidaEn, ahora) {
    if (!soloDigitos(dni)) return null;
    const fin = msDeIso(concluidaEn) ?? ahora;
    const candidatos = e.partes
      .filter((p) => mismoPaciente(dni, p.datos.hc_dni))
      .filter((p) => { const c = msDeIso(p.creado); return c != null && c >= fin - 86400000 && c <= fin + 300000; })
      .sort((a, b) => b.id - a.id);
    return candidatos[0] || null;
  }

  function completarParte(e, p, payload, nuevos, pisar, ahora) {
    const datos = p.datos;
    const previa = mismoPaciente(nuevos.hc_dni, datos.hc_dni) && datos._carga_previa &&
      typeof datos._carga_previa === "object" ? datos._carga_previa : {};
    const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    for (const [k, v] of Object.entries(nuevos)) {
      const corregido = k in previa && !igual(previa[k], v);
      if (pisar.includes(k) || corregido || vacio(datos[k])) datos[k] = v;
    }
    if (mismoPaciente(nuevos.hc_dni, datos.hc_dni)) datos._carga_previa = nuevos;
    aplicarDrogas(e, p, payload.drogas, ahora);
    aplicarVolumenes(e, p, payload.volumenes, ahora);
    aplicarMarcas(e, p, payload.marcas, ahora);
  }

  // cargas.aplicar_carga, en chico.
  function aplicarCarga(e, payload, ahora) {
    if (!payload || typeof payload !== "object") throw new ErrorHttp(400, "La carga debe ser un objeto");
    if (esSi(payload.concluir)) return aplicarConcluir(e, payload, ahora);
    if (esSi(payload.ajuste)) return aplicarAjuste(e, payload, ahora);
    const nuevos = datosDeCarga(payload);
    const correccion = esSi(payload.corrige);
    const destino = correccion
      ? parteDeLaCorreccion(e, payload.hc_dni, payload.concluida_en, ahora)
      : (parteEnCursoDelPaciente(e, payload.hc_dni, ahora) || parteLibreDeHoy(e, ahora));
    if (destino) {
      completarParte(e, destino, payload, nuevos, [], ahora);
      return { parte_id: destino.id, creado: false };
    }
    const p = nuevoParte(e, { fecha: fechaLocal(ahora), ...nuevos, _carga_previa: nuevos }, ahora);
    aplicarDrogas(e, p, payload.drogas, ahora);
    aplicarVolumenes(e, p, payload.volumenes, ahora);
    aplicarMarcas(e, p, payload.marcas, ahora);
    if (correccion) {
      const fin = hhmm(payload.hora_fin) || (payload.concluida_en ? horaLocal(msDeIso(payload.concluida_en) ?? ahora) : horaLocal(ahora));
      cerrarParte(e, p, fin, ahora);
      return { parte_id: p.id, creado: true };
    }
    // La ficha de OTRO paciente levanta el freno: viene la anestesia siguiente.
    if (e.frenado && !mismoPaciente(nuevos.hc_dni, e.ultimoConcluido)) permitir(e);
    return { parte_id: p.id, creado: true };
  }

  function aplicarConcluir(e, payload, ahora) {
    const p = parteEnCursoDelPaciente(e, payload.hc_dni, ahora) || parteLibreDeHoy(e, ahora);
    if (!p || p.estado !== "en_curso") return { parte_id: p ? p.id : null, concluido: false, creado: false };
    inhibir(e, `concluir del parte ${p.id}`, ahora);
    e.ultimoConcluido = payload.hc_dni || null;
    const horaFin = hhmm(payload.hora_fin);
    const nuevos = datosDeCarga(payload);
    if (horaFin) nuevos.hora_fin = horaFin; else delete nuevos.hora_fin;
    completarParte(e, p, payload, nuevos, horaFin ? ["hora_fin"] : [], ahora);
    if (e.captura.activa && e.captura.parte_id === p.id) capturaDetener(e, ahora);
    cerrarParte(e, p, horaFin || horaLocal(ahora), ahora);
    return { parte_id: p.id, concluido: true, creado: false };
  }

  function aplicarAjuste(e, payload, ahora) {
    const p = parteEnCursoDelPaciente(e, payload.hc_dni, ahora);
    if (!p) return { parte_id: null, creado: false, ajuste: true, aplicadas: 0 };
    return { parte_id: p.id, creado: false, ajuste: true, aplicadas: aplicarDrogas(e, p, payload.drogas, ahora) };
  }

  // ─────────────────────────────────────────── drogas, volúmenes, marcas

  const GATILLOS = ["hipotension", "bradicardia", "hipertension", "taquicardia"];
  const DROGAS_GATILLO = {
    hipotension: ["noradr", "norepi", "etilef", "effortil", "fenilef", "efedr", "dopam", "dobut", "vasopres"],
    bradicardia: ["atrop", "isoprot", "isoprenal"],
    hipertension: ["labet", "nitrogl", "ntg", "tng", "trinitr", "nitroprus", "urapid", "esmol", "hidralaz", "nicardip", "nifedip"],
    taquicardia: ["amiodar", "adenos", "metoprol", "propranol", "diltiaz", "verapam"],
  };
  function gatilloDe(nombre, origen) {
    if (origen != null && ["al finalizar", "reversion"].includes(normalizar(origen))) return "cierre";
    if (origen != null && normalizar(origen) !== "durante la anestesia") return null;
    const palabras = normalizar(nombre).split(/[^a-z0-9]+/);
    for (const g of GATILLOS) {
      if (DROGAS_GATILLO[g].some((p) => palabras.some((w) => w.startsWith(p)))) return g;
    }
    return null;
  }
  function parsearDosis(t) {
    const s = texto(t).trim();
    if (!/\w/.test(s)) return [null, null];
    const m = /^(\d+(?:[.,]\d+)?)\s*(.*)$/.exec(s);
    if (!m) return [null, s];
    return [parseFloat(m[1].replace(",", ".")), m[2].trim() || null];
  }
  function unidadPartes(u) {
    return texto(u).trim().toLowerCase().replace(/[µμ]/g, "u").replace(/\s/g, "").split("/").filter(Boolean);
  }
  function esUnidadTasa(u) {
    const p = unidadPartes(u);
    if (p.length < 2 || p[0].startsWith("ml")) return false;
    return ["min", "h", "hs", "hr", "hora"].includes(p[p.length - 1]);
  }
  function minutosDe(t) {
    const m = /^\s*(\d+(?:[.,]\d+)?)/.exec(texto(t));
    return m ? Math.round(parseFloat(m[1].replace(",", "."))) : null;
  }
  function duracionDeCarga(d) {
    const m = /^\s*(\d+(?:[.,]\d+)?)\s*(min(?:utos?|s)?|m|h|hs|hrs?|horas?)?\.?\s*$/i.exec(texto(d.duracion));
    if (!m) return null;
    let n = parseFloat(m[1].replace(",", "."));
    if ((m[2] || "").toLowerCase().startsWith("h")) n *= 60;
    n = Math.round(n);
    return n > 0 ? n : null;
  }
  function momentoDeCarga(d) {
    const momento = texto(d.momento).trim().toLowerCase();
    const valor = texto(d.valor).trim();
    if (momento === "inicio") return ["inicio", ""];
    if (momento === "min") {
      const n = minutosDe(valor);
      if (n == null) return [null, null];
      return n === 0 ? ["inicio", ""] : ["min", String(n)];
    }
    if (momento === "fin") return ["fin", String(minutosDe(valor) ?? 0)];
    if (momento === "hora") { const h = hhmm(valor); return h ? ["hora", h] : [null, null]; }
    if (momento === "episodio") {
      const g = normalizar(valor);
      return GATILLOS.includes(g) ? ["episodio", g] : [null, null];
    }
    return [null, null];
  }
  const esCorte = (d) => texto(d.accion).trim().toLowerCase() === "cortar" || esSi(d.cortar);
  function momentoDeEvento(ev) {
    if (GATILLOS.includes(ev.gatillo)) return ["episodio", ev.gatillo];
    if (ev.gatillo === "inicio") return ev.minutos ? ["min", String(ev.minutos)] : ["inicio", ""];
    if (ev.gatillo === "cierre" && ev.minutos != null) return ["fin", String(ev.minutos)];
    if (!ev.gatillo && ev.ubicado) return ["hora", texto(ev.ts).slice(11, 16)];
    return [null, null];
  }
  function inicioDe(p) {
    const h = hhmm(p.datos.hora_ingreso);
    const fecha = texto(p.datos.fecha) || p.creado.slice(0, 10);
    if (h) return msDeIso(`${fecha}T${h}:00`);
    const l = (p.lecturas || [])[0];
    return l ? l[0] : null;
  }
  function finDe(p) {
    const h = hhmm(p.datos.hora_fin);
    if (!h) return null;
    const ini = inicioDe(p);
    const fecha = ini != null ? fechaLocal(ini) : (texto(p.datos.fecha) || p.creado.slice(0, 10));
    let fin = msDeIso(`${fecha}T${h}:00`);
    if (ini != null && fin < ini) fin += 86400000;   // cruza la medianoche
    return fin;
  }
  function tsDeHora(p, valor, ahora) {
    const ini = inicioDe(p);
    const base = ini != null ? fechaLocal(ini) : fechaLocal(ahora);
    let t = msDeIso(`${base}T${valor}:00`);
    if (ini != null && ini - t > 2 * 3600000) t += 86400000;
    return isoLocal(t);
  }
  function nuevoEvento(e, p, campos, ahora) {
    const ev = {
      id: ++e.ids.evento, ts: isoLocal(ahora), tipo: "evento", descripcion: "",
      dosis: null, unidad: null, gatillo: null, ubicado: 1, minutos: null,
      kg: null, duracion: null, ...campos,
    };
    if (ev.dosis != null) ev.dosis = String(ev.dosis);
    p.eventos.push(ev);
    return ev;
  }
  function comoListaDeObjetos(crudo) {
    if (typeof crudo === "string") { try { crudo = JSON.parse(crudo); } catch (_) { return []; } }
    return Array.isArray(crudo) ? crudo.filter((x) => x && typeof x === "object") : [];
  }
  function claveDroga(nombre, dosis, unidad) {
    return [texto(nombre).trim().toLowerCase(), dosis == null ? "" : String(dosis), texto(unidad).trim().toLowerCase()].join("|");
  }

  function aplicarDrogas(e, p, crudas, ahora) {
    const lista = comoListaDeObjetos(crudas);
    if (!lista.length) return 0;
    const guardados = {};
    for (const ev of p.eventos) {
      if ((ev.tipo !== "droga" && ev.tipo !== "corte") || ev.gatillo === "consumo") continue;
      const k = `${ev.tipo}|${claveDroga(ev.descripcion, ev.dosis, ev.unidad)}|${momentoDeEvento(ev).join("|")}`;
      guardados[k] = (guardados[k] || 0) + 1;
    }
    const pedidos = {};
    let insertadas = 0;
    for (const d of lista) {
      const nombre = texto(d.droga).trim();
      if (!nombre) continue;
      let [dosis, unidad] = parsearDosis(d.dosis);
      let [momento, valor] = momentoDeCarga(d);
      const corte = esCorte(d);
      if (corte) { dosis = null; unidad = null; }
      const propio = gatilloDe(nombre, d.origen);
      if (!corte && momento == null && !texto(d.momento).trim() && esUnidadTasa(unidad) && propio == null) {
        momento = "inicio"; valor = "";
      }
      let ts = null, ubicado = 0, minutos = null, gatillo = null;
      if (momento === "hora") { ts = tsDeHora(p, valor, ahora); ubicado = 1; }
      else if (momento === "inicio" || momento === "min") { gatillo = "inicio"; minutos = Number(valor || 0); }
      else if (momento === "fin") { gatillo = "cierre"; minutos = Number(valor || 0); }
      else if (momento === "episodio") gatillo = valor;
      else gatillo = corte ? null : propio;
      const tipo = corte ? "corte" : "droga";
      const k = `${tipo}|${claveDroga(nombre, dosis, unidad)}|${momentoDeEvento({ gatillo, minutos, ubicado, ts }).join("|")}`;
      pedidos[k] = (pedidos[k] || 0) + 1;
      if (pedidos[k] <= (guardados[k] || 0)) continue;   // reenviada: no duplica
      nuevoEvento(e, p, {
        tipo, descripcion: nombre, ts: ts || isoLocal(ahora), dosis, unidad,
        gatillo, ubicado, minutos, kg: parsearDosis(d.kg)[0],
        duracion: corte ? null : duracionDeCarga(d),
      }, ahora);
      insertadas++;
    }
    ubicarPendientes(p, ahora, false);
    return insertadas;
  }

  function aplicarVolumenes(e, p, crudos, ahora) {
    const lista = comoListaDeObjetos(crudos);
    if (!lista.length) return 0;
    const guardados = {};
    for (const ev of p.eventos) {
      if (ev.tipo !== "volumen") continue;
      const k = `${claveDroga(ev.descripcion, ev.dosis, ev.unidad)}|${momentoDeEvento(ev).join("|")}`;
      guardados[k] = (guardados[k] || 0) + 1;
    }
    const pedidos = {};
    let n = 0;
    for (const d of lista) {
      const nombre = texto(d.droga || d.descripcion).trim();
      if (!nombre) continue;
      const [dosis, unidad] = parsearDosis(d.dosis);
      const [momento, valor] = momentoDeCarga(d);
      let ts = null, ubicado = 0, minutos = null, gatillo = null;
      if (momento === "hora") { ts = tsDeHora(p, valor, ahora); ubicado = 1; }
      else if (momento === "inicio" || momento === "min") { gatillo = "inicio"; minutos = Number(valor || 0); }
      else if (momento === "fin") { gatillo = "cierre"; minutos = Number(valor || 0); }
      const k = `${claveDroga(nombre, dosis, unidad)}|${momentoDeEvento({ gatillo, minutos, ubicado, ts }).join("|")}`;
      pedidos[k] = (pedidos[k] || 0) + 1;
      if (pedidos[k] <= (guardados[k] || 0)) continue;
      nuevoEvento(e, p, { tipo: "volumen", descripcion: nombre, ts: ts || isoLocal(ahora), dosis, unidad, gatillo, ubicado, minutos }, ahora);
      n++;
    }
    ubicarPendientes(p, ahora, false);
    return n;
  }

  function aplicarMarcas(e, p, crudas, ahora) {
    const lista = comoListaDeObjetos(crudas);
    if (!lista.length) return 0;
    let n = 0;
    for (const m of lista) {
      const tipo = texto(m.tipo).trim();
      const descripcion = texto(m.texto).trim();
      if (!["practica", "critico"].includes(tipo) || !descripcion) continue;
      const [momento, valor] = momentoDeCarga(m);
      if (!["hora", "min", "inicio"].includes(momento)) continue;
      const ya = p.eventos.find((ev) => ev.tipo === tipo && ev.descripcion === descripcion &&
        momentoDeEvento(ev).join("|") === (momento === "hora" ? ["hora", valor] : momento === "inicio" ? ["inicio", ""] : ["min", valor]).join("|"));
      if (ya) { ya.duracion = duracionDeCarga(m); continue; }
      if (momento === "hora") {
        nuevoEvento(e, p, { tipo, descripcion, ts: tsDeHora(p, valor, ahora), ubicado: 1, duracion: duracionDeCarga(m) }, ahora);
      } else {
        nuevoEvento(e, p, { tipo, descripcion, gatillo: "inicio", ubicado: 0, minutos: Number(valor || 0), duracion: duracionDeCarga(m) }, ahora);
      }
      n++;
    }
    ubicarPendientes(p, ahora, false);
    return n;
  }

  // El EPISODIO que registró el monitor (gatillos.py, en chico): la primera
  // lectura que lo cumple, con la gracia de la hipertensión y la taquicardia.
  function episodio(p, gatillo, ahora) {
    const ini = inicioDe(p);
    for (const v of vitalesDe(p, null, ahora)) {
      const t = msDeIso(v.ts);
      const min = ini != null ? (t - ini) / 60000 : 99;
      if (gatillo === "hipotension" && ((v.nibp_sis != null && v.nibp_sis < 90) || (v.nibp_pam != null && v.nibp_pam < 65))) return t;
      if (gatillo === "bradicardia" && v.hr != null && v.hr < 45) return t;
      if (gatillo === "hipertension" && min >= 10 && ((v.nibp_sis != null && v.nibp_sis > 160) || (v.nibp_dia != null && v.nibp_dia > 110))) return t;
      if (gatillo === "taquicardia" && min >= 10 && v.hr != null && v.hr > 120) return t;
    }
    return null;
  }

  function ubicarPendientes(p, ahora, alCierre) {
    let cambio = false;
    const ini = inicioDe(p);
    const fin = finDe(p);
    for (const ev of p.eventos) {
      if (ev.ubicado || !ev.gatillo || ev.gatillo === "consumo") continue;
      let t = null;
      if (ev.gatillo === "inicio") { if (ini != null) t = ini + (ev.minutos || 0) * 60000; }
      else if (ev.gatillo === "cierre") { if (alCierre && fin != null) t = fin - (ev.minutos || 0) * 60000; }
      else { const ep = episodio(p, ev.gatillo, ahora); if (ep != null) t = ep + 60000; }
      if (t != null) { ev.ts = isoLocal(t); ev.ubicado = 1; cambio = true; }
    }
    return cambio;
  }

  // ─────────────────────────────────────────────────── el cierre del parte

  const FAMILIAS = [[{ mg: 1, ug: 1e-3, mcg: 1e-3, g: 1000, ng: 1e-6 }, "mg"], [{ ui: 1, u: 1, iu: 1 }, "UI"]];
  function porMinuto(dosis, unidad, kg) {
    const p = unidadPartes(unidad);
    if (dosis == null || !esUnidadTasa(unidad)) return null;
    for (const [factores, unidadTotal] of FAMILIAS) {
      const f = factores[p[0]];
      if (f != null) {
        const pm = p[p.length - 1] === "min" ? 1 : 1 / 60;
        const pk = p.slice(1, -1).includes("kg") ? kg : 1;
        return [dosis * f * pk * pm, unidadTotal];
      }
    }
    return null;
  }
  function redondearConsumo(total) {
    if (total <= 0) return 0;
    const dec = Math.min(4, Math.max(2, 1 - Math.floor(Math.log10(total))));
    return Math.round((total + 1e-9) * 10 ** dec) / 10 ** dec;
  }
  // cargas.calcular_consumo_infusiones: Σ tasa × kg × minutos de cada tramo
  // (el corte de un goteo es un tramo en cero).
  function calcularConsumoInfusiones(e, p) {
    const desde = inicioDe(p), hasta = finDe(p);
    if (hasta == null) return;
    const fin = hasta - 59000;
    const kgDef = parsearDosis(p.datos.peso)[0] || 70;
    const tramos = {}, sinHora = new Set();
    for (const ev of p.eventos) {
      if (ev.gatillo === "consumo") continue;
      const nombre = texto(ev.descripcion).trim();
      if (ev.tipo === "corte" && ev.ubicado) (tramos[nombre] = tramos[nombre] || []).push([msDeIso(ev.ts), 0, null, null, null, true]);
      if (ev.tipo !== "droga" || !esUnidadTasa(ev.unidad)) continue;
      if (!ev.ubicado) { sinHora.add(nombre); continue; }
      (tramos[nombre] = tramos[nombre] || []).push([msDeIso(ev.ts), parsearDosis(ev.dosis)[0], ev.unidad, ev.kg, ev.duracion, false]);
    }
    p.eventos = p.eventos.filter((ev) => ev.gatillo !== "consumo");
    for (const [nombre, lista] of Object.entries(tramos)) {
      if (sinHora.has(nombre) || !lista.some((x) => !x[5])) continue;
      lista.sort((a, b) => a[0] - b[0]);
      let total = 0, unidadTotal = null;
      lista.forEach(([t, dosis, unidad, kg, duracion, esCorteTramo], i) => {
        if (esCorteTramo) return;
        const r = porMinuto(dosis, unidad, kg || kgDef);
        if (!r) return;
        if (unidadTotal == null) unidadTotal = r[1]; else if (r[1] !== unidadTotal) return;
        let h = i + 1 < lista.length ? Math.min(lista[i + 1][0], fin) : fin;
        if (duracion) h = Math.min(h, t + duracion * 60000);
        const arranque = desde == null ? t : Math.max(t, desde);
        total += r[0] * Math.max(0, (h - arranque) / 60000);
      });
      if (unidadTotal == null) continue;
      nuevoEvento(e, p, { tipo: "droga", descripcion: nombre, dosis: redondearConsumo(total), unidad: unidadTotal, gatillo: "consumo", ubicado: 0, ts: isoLocal(fin) }, fin);
    }
  }
  // cargas.calcular_consumo_inhalatorio: ml = factor × % × L/min × horas.
  function calcularConsumoInhalatorio(e, p, ahora) {
    const ini = inicioDe(p), fin = finDe(p);
    if (ini == null || fin == null || fin <= ini) return;
    const horas = (fin - ini) / 3600000;
    const agentes = texto(p.datos.agente_anestesico).split(" / ");
    const dosis = texto(p.datos.dosis_agente).split(" / ");
    const fi = vitalesDe(p, null, ahora).map((v) => v.sev_fi).filter((x) => x != null);
    const medido = fi.length ? Math.round(fi.reduce((a, b) => a + b, 0) / fi.length * 10) / 10 : null;
    agentes.forEach((agente, i) => {
      agente = agente.trim();
      if (!/sevo|desflu|isoflu|halot/i.test(agente)) return;
      const m = /^\s*(?:(\d+(?:[.,]\d+)?)\s*%\s*\/?)?\s*(?:(\d+(?:[.,]\d+)?)\s*(?:l|lts?|litros?)\s*(?:\/?\s*min(?:uto)?s?)?)?\s*$/i.exec(dosis[i] || "");
      if (!m) return;
      const pct = /sevo/i.test(agente) && medido != null ? medido : m[1] ? parseFloat(m[1].replace(",", ".")) : null;
      const flujo = m[2] ? parseFloat(m[2].replace(",", ".")) : parsearDosis(p.datos.fgf)[0] ?? 2;
      if (pct == null || !flujo) return;
      const factor = /sevo/i.test(agente) ? 3.3 : /desflu/i.test(agente) ? 2.9 : /isoflu/i.test(agente) ? 3.0 : 2.6;
      const ml = Math.round(factor * pct * flujo * horas);
      const nombre = `${agente} (consumo)`;
      if (ml > 0 && !p.eventos.some((ev) => ev.descripcion.toLowerCase() === nombre.toLowerCase())) {
        nuevoEvento(e, p, { tipo: "droga", descripcion: nombre, dosis: ml, unidad: "ml", ts: isoLocal(fin) }, fin);
      }
    });
  }

  // cargas.cerrar_parte: la hora de fin, las drogas con gatillo, el consumo,
  // cerrado; la nube borra la sesión (3-oct).
  function cerrarParte(e, p, horaFinDefecto, ahora) {
    if (horaFinDefecto && vacio(p.datos.hora_fin)) p.datos.hora_fin = horaFinDefecto;
    cerrarLecturas(p, ahora);
    ubicarPendientes(p, ahora, true);
    calcularConsumoInhalatorio(e, p, ahora);
    calcularConsumoInfusiones(e, p);
    p.estado = "cerrado";
    if (e.subida.activa && e.subida.parte_id === p.id) subidaDetener(e);
    p.sesion = null;
  }

  // ─────────────────────────────────────────── el PDF del parte (demo)

  // La notebook de verdad imprime la planilla con Edge sin ventana; acá se
  // la fotografía en el navegador (html2canvas + jsPDF) y, si algo falla,
  // va el PDF de ejemplo que trae la demo.
  const LIBRERIAS = [
    ["html2canvas", "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"],
    ["jspdf", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"],
  ];
  let librerias = null;
  function cargarLibrerias() {
    if (!librerias) {
      librerias = Promise.all(LIBRERIAS.map(([global, src]) => window[global] ? null : new Promise((ok, mal) => {
        const s = document.createElement("script");
        s.src = src; s.async = true; s.crossOrigin = "anonymous";
        s.onload = ok; s.onerror = () => mal(new Error(`no cargó ${src}`));
        document.head.appendChild(s);
      })));
      librerias.catch(() => { librerias = null; });
    }
    return librerias;
  }
  function esperar(ms) { return new Promise((ok) => setTimeout(ok, ms)); }

  // La planilla fotografiada en el navegador (html2canvas): el lienzo del
  // que salen el PDF y, desde el 6-oct, la imagen JPEG.
  async function lienzoDePlanilla(parteId) {
    await cargarLibrerias();
    const marco = document.createElement("iframe");
    marco.setAttribute("aria-hidden", "true");
    marco.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;height:1400px;border:0;visibility:hidden";
    marco.src = `${RAIZ}notebook/imprimir.html?id=${parteId}&para_pdf=1`;
    document.body.appendChild(marco);
    try {
      const limite = Date.now() + 20000;
      let hoja = null;
      while (Date.now() < limite) {
        await esperar(250);
        const doc = marco.contentDocument;
        if (doc && / — Anexo V$/.test(doc.title)) { hoja = doc.getElementById("hoja"); break; }
      }
      if (!hoja) throw new Error("la planilla no terminó de armarse");
      await esperar(300);
      return await window.html2canvas(hoja, { scale: 2, backgroundColor: "#ffffff", logging: false });
    } finally {
      marco.remove();
    }
  }
  async function pdfDePlanilla(parteId) {
    const lienzo = await lienzoDePlanilla(parteId);
    {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      let ancho = 196, alto = (lienzo.height / lienzo.width) * ancho;
      if (alto > 283) { ancho *= 283 / alto; alto = 283; }
      pdf.addImage(lienzo.toDataURL("image/jpeg", 0.92), "JPEG", (210 - ancho) / 2, 7, ancho, alto);
      return pdf.output("arraybuffer");
    }
  }
  // La IMAGEN JPEG de la planilla (6-oct-2026, "dame la opción de JPEG:
  // guardo y comparto"): la misma foto, sin envolverla en un PDF. La
  // notebook de verdad la saca con el Edge sin ventana (pdf.generar_jpeg).
  async function jpegDelParte(parteId) {
    const lienzo = await lienzoDePlanilla(parteId);
    const blob = await new Promise((ok, mal) => lienzo.toBlob(
      (b) => (b ? ok(b) : mal(new Error("la planilla no salió como JPEG"))), "image/jpeg", 0.9));
    return blob.arrayBuffer();
  }
  async function pdfDeEjemplo() {
    const r = await fetchReal(`${RAIZ}parte_demo.pdf`);
    if (!r.ok) throw new Error(`PDF de ejemplo: HTTP ${r.status}`);
    return r.arrayBuffer();
  }
  function pdfDelParte(parteId) {
    return pdfDePlanilla(parteId).catch((err) => {
      console.warn("[demo] el PDF de la planilla no salió; va el de ejemplo:", err);
      return pdfDeEjemplo();
    });
  }
  function nombrePdf(p, extension = "pdf") {
    const nombre = texto(p.datos.nombre).replace(/[^\p{L}\p{N}\s.-]/gu, "").replace(/\s+/g, " ").trim() || "sin nombre";
    const fecha = /^\d{4}-\d\d-\d\d$/.test(texto(p.datos.fecha)) ? p.datos.fecha : p.creado.slice(0, 10);
    return `Parte anestesico - ${nombre} - ${fecha}.${extension}`;
  }
  function ultimoParteDelDni(e, dni) {
    return e.partes.filter((p) => mismoPaciente(dni, p.datos.hc_dni)).sort((a, b) => b.id - a.id)[0] || null;
  }

  // Los PEDIDOS del PDF por la nube viven en la ventana que los hizo (la
  // app pregunta cada 3 s desde la misma).
  const pedidosPdf = new Map();

  // ─────────────────────────────────────────────────── las respuestas

  class ErrorHttp extends Error {
    constructor(status, detalle) { super(detalle); this.status = status; }
  }
  const json = (cuerpo, status = 200) => ({ status, cuerpo: JSON.stringify(cuerpo), tipo: "application/json" });

  function capturaEstado(e, ahora) {
    const c = e.captura;
    const p = c.activa ? parteDe(e, c.parte_id) : null;
    const ultimo = p && e.monitor.conectado ? ultimoVital(p, ahora) : null;
    return {
      activa: Boolean(c.activa), parte_id: c.activa ? c.parte_id : null,
      intervalo_s: c.intervalo_s || 1,
      ultima_ok: Boolean(ultimo), ultima_ts: ultimo ? ultimo.ts : null,
      error: c.activa && !e.monitor.conectado
        ? "Sin imagen del monitor: el cable está desconectado o el monitor apagado (reintenta solo)" : null,
      quirofano: ultimo ? QUIROFANO : null, monitor_rotulo: ultimo ? `QFN${QUIROFANO}` : null,
      cabecera_ts: ultimo ? ultimo.ts : null,
    };
  }
  function nubeEstado(e, ahora) {
    const s = e.subida;
    const p = s.activa ? parteDe(e, s.parte_id) : null;
    const ultimo = p && e.captura.activa && e.captura.parte_id === p.id && e.monitor.conectado ? ultimoVital(p, ahora) : null;
    return {
      conectado: true, email: "demo@critidata.com",
      vence: isoLocal(ahora + 60 * 86400000), vencida: false,
      activa: Boolean(s.activa), parte_id: s.activa ? s.parte_id : null,
      error: null, pendientes: 0, ultima_subida: ultimo ? ultimo.ts : null,
    };
  }
  function sesionesDe(e, ahora) {
    return e.partes.filter((p) => p.sesion).sort((a, b) => b.id - a.id).map((p) => {
      const u = ultimoVital(p, ahora);
      return {
        id: p.id, creado: isoUtcSinZona(p.sesion.creado),
        etiqueta: `Parte N° ${p.id} · Quirófano ${QUIROFANO}`,
        estado: "en_curso", origen_parte_id: p.id,
        ultima_ts: u ? u.ts : null, quirofano: QUIROFANO,
      };
    });
  }
  function latido(e, ahora) {
    const c = capturaEstado(e, ahora);
    return {
      notebooks: [{
        en_linea: true, hace_s: 3, quirofano: QUIROFANO,
        estado: {
          captura_activa: c.activa, dongle: c.activa ? Boolean(e.monitor.conectado) : true,
          lectura_ok: c.activa ? c.ultima_ok : null, ultima_lectura: c.ultima_ts,
          captura_error: c.error, quirofano: c.quirofano, monitor_rotulo: c.monitor_rotulo,
          subida_activa: Boolean(e.subida.activa), parte_id: c.parte_id,
          cargas_ajenas: 0, ajustes_sin_parte: 0,
          autoarranque_inhibido: Boolean(e.frenado),
        },
      }],
    };
  }

  const PERFIL_DEMO = {
    token: "demo", full_name: "Dra. Demo", subscription_status: "active",
    trial_expires_at: null, subscription_kind: "debito", paid_until: null,
  };

  // La NUBE (el backend de login + /anestesia/*), como la ve la app.
  async function nube(metodo, url, cuerpo, e, ahora) {
    const camino = url.pathname;
    let m;
    if (camino === "/auth/login" && metodo === "POST") return json(PERFIL_DEMO);
    if (camino === "/auth/check-status") return json({ ...PERFIL_DEMO, new_token: "demo" });
    if (camino.startsWith("/auth/")) {
      throw new ErrorHttp(400, "En la demo no se crean cuentas ni hay pagos: entrá con cualquier email");
    }
    if (camino === "/anestesia/cargas" && metodo === "POST") {
      const r = aplicarCarga(e, (cuerpo && cuerpo.payload) || cuerpo, ahora);
      if (r.parte_id != null) e.pasos.ficha = true;
      if (r.concluido) e.pasos.concluida = true;
      guardar(e);
      return json({ id: e.ids.evento, ok: true });
    }
    if (camino === "/anestesia/notebook") return json(latido(e, ahora));
    if (camino === "/anestesia/ordenes" && metodo === "POST") {
      const detalle = ejecutarOrden(e, texto(cuerpo && cuerpo.orden), true, ahora);
      guardar(e);
      return json({ ok: true, detalle });
    }
    if (camino === "/anestesia/codigo-vinculo") return json({ codigo: "DEMO42", minutos: 10 });
    if (camino === "/anestesia/sesiones") return json(sesionesDe(e, ahora));
    if ((m = /^\/anestesia\/sesiones\/(\d+)\/vitales$/.exec(camino))) {
      const p = parteDe(e, m[1]);
      if (!p || !p.sesion) throw new ErrorHttp(404, "La sesión ya no está en la nube");
      return json(vitalesDe(p, url.searchParams.get("desde"), ahora).map(({ id, fuente, ...v }) => v));
    }
    if ((m = /^\/anestesia\/sesiones\/(\d+)$/.exec(camino)) && metodo === "DELETE") {
      const p = parteDe(e, m[1]);
      if (!p || !p.sesion) throw new ErrorHttp(404, "La sesión ya no está en la nube");
      p.sesion = null;
      if (e.subida.activa && e.subida.parte_id === p.id) subidaDetener(e);
      guardar(e);
      return json({ ok: true });
    }
    if (camino === "/anestesia/pedidos-parte" && metodo === "POST") {
      const id = ++e.ids.pedido;
      guardar(e);
      const p = ultimoParteDelDni(e, cuerpo && cuerpo.dni);
      // (6-oct) tipo "jpeg": la planilla como imagen, por el mismo buzón.
      const imagen = Boolean(cuerpo) && cuerpo.tipo === "jpeg";
      const pedido = { creado: ahora, parteId: p ? p.id : null, imagen, nombre: p ? nombrePdf(p, imagen ? "jpg" : "pdf") : null, bytes: null, error: null };
      if (p) {
        pedido.promesa = (imagen ? jpegDelParte(p.id) : pdfDelParte(p.id))
          .then((b) => { pedido.bytes = b; }, (err) => { pedido.error = String(err.message || err); });
      }
      pedidosPdf.set(id, pedido);
      return json({ id });
    }
    if ((m = /^\/anestesia\/pedidos-parte\/(\d+)(\/pdf)?$/.exec(camino))) {
      const id = Number(m[1]);
      const pedido = pedidosPdf.get(id);
      if (!pedido) throw new ErrorHttp(404, "El pedido venció");
      if (metodo === "DELETE") { pedidosPdf.delete(id); return json({ ok: true }); }
      if (m[2]) {
        if (pedido.promesa) await pedido.promesa;
        if (!pedido.bytes) throw new ErrorHttp(404, "El PDF todavía no está");
        return { status: 200, cuerpo: pedido.bytes, tipo: pedido.imagen ? "image/jpeg" : "application/pdf" };
      }
      const madurez = ahora - pedido.creado >= DEMORA_PDF_MS;
      if (!pedido.parteId) {
        return json(madurez ? { id, estado: "sin_parte", detalle: "La notebook del quirófano no tiene un parte con ese DNI" } : { id, estado: "pendiente" });
      }
      if (pedido.error) return json({ id, estado: "error", detalle: `La notebook no pudo armar ${pedido.imagen ? "la imagen" : "el PDF"}` });
      return json(madurez && pedido.bytes ? { id, estado: "listo", nombre: pedido.nombre } : { id, estado: "pendiente" });
    }
    throw new ErrorHttp(404, `La demo no conoce ${metodo} ${camino}`);
  }

  // La NOTEBOOK (app/servidor.py), como la ven sus páginas.
  async function notebook(metodo, url, cuerpo, e, ahora) {
    const camino = url.pathname;
    let m;
    if (camino === "/api/respaldo") {
      return json({ ultimo: `${fechaLocal(ahora)}T07:00`, partes: e.partes.length, externo: true, aviso_externo: "" });
    }
    if (camino === "/api/partes" && metodo === "GET") {
      return json(e.partes.slice().sort((a, b) => b.id - a.id).map((p) => ({
        id: p.id, creado: p.creado, estado: p.estado, nombre: p.datos.nombre || null,
        fecha: texto(p.datos.fecha).trim() || p.creado.slice(0, 10),
      })));
    }
    if (camino === "/api/partes" && metodo === "POST") {
      const p = nuevoParte(e, (cuerpo && cuerpo.datos) || {}, ahora);
      guardar(e);
      return json({ id: p.id });
    }
    if (camino === "/api/partes/ultimo") {
      const p = ultimoParteDelDni(e, url.searchParams.get("dni"));
      if (!p) throw new ErrorHttp(404, "Sin parte para ese DNI");
      return json({ id: p.id });
    }
    if (camino === "/api/partes/pdf" || /^\/api\/partes\/\d+\/pdf$/.test(camino)) {
      const p = camino === "/api/partes/pdf" ? ultimoParteDelDni(e, url.searchParams.get("dni")) : parteDe(e, camino.split("/")[3]);
      if (!p) throw new ErrorHttp(404, "Parte no encontrado");
      return { status: 200, cuerpo: await pdfDelParte(p.id), tipo: "application/pdf" };
    }
    if ((m = /^\/api\/partes\/(\d+)$/.exec(camino))) {
      const p = parteDe(e, m[1]);
      if (!p) throw new ErrorHttp(404, "Parte no encontrado");
      if (metodo === "GET") return json({ id: p.id, creado: p.creado, estado: p.estado, datos: p.datos });
      if (metodo === "PUT") {
        if (!cuerpo || typeof cuerpo.datos !== "object") throw new ErrorHttp(400, "Falta 'datos' (objeto)");
        Object.assign(p.datos, cuerpo.datos);
        guardar(e);
        return json({ ok: true });
      }
      if (metodo === "DELETE") {
        if (e.captura.activa && e.captura.parte_id === p.id) {
          throw new ErrorHttp(409, "Ese parte se está capturando ahora: detené la captura antes");
        }
        if (e.subida.activa && e.subida.parte_id === p.id) subidaDetener(e);
        e.partes = e.partes.filter((x) => x.id !== p.id);
        guardar(e);
        return json({ ok: true });
      }
    }
    if ((m = /^\/api\/partes\/(\d+)\/cerrar$/.exec(camino))) {
      const p = parteDe(e, m[1]);
      if (!p) throw new ErrorHttp(404, "Parte no encontrado");
      if (e.captura.activa && e.captura.parte_id === p.id) {
        inhibir(e, `cierre del parte ${p.id} en la notebook`, ahora);
        capturaDetener(e, ahora);
      }
      if (p.estado === "en_curso") cerrarParte(e, p, horaLocal(ahora), ahora);
      guardar(e);
      return json({ ok: true });
    }
    if ((m = /^\/api\/partes\/(\d+)\/ubicar_drogas$/.exec(camino))) {
      const p = parteDe(e, m[1]);
      if (!p) throw new ErrorHttp(404, "Parte no encontrado");
      ubicarPendientes(p, ahora, false);
      guardar(e);
      return json({ ubicadas: 0, pendientes: p.eventos.filter((ev) => !ev.ubicado && ev.gatillo && ev.gatillo !== "consumo").length });
    }
    if (camino === "/api/carga" && metodo === "POST") {
      const r = aplicarCarga(e, (cuerpo && cuerpo.payload) || cuerpo, ahora);
      guardar(e);
      return json(r);
    }
    if ((m = /^\/api\/partes\/(\d+)\/vitales$/.exec(camino))) {
      const p = parteDe(e, m[1]);
      if (!p) throw new ErrorHttp(404, "Parte no encontrado");
      if (metodo === "GET") return json(vitalesDe(p, url.searchParams.get("desde"), ahora));
      const fila = { id: ++e.ids.evento, ts: (cuerpo && cuerpo.ts) || isoLocal(ahora), fuente: "manual" };
      for (const col of ["hr", "spo2", "rr", "nibp_sis", "nibp_dia", "nibp_pam", "etco2"]) {
        if (cuerpo && cuerpo[col] != null && cuerpo[col] !== "") fila[col] = Number(cuerpo[col]);
      }
      p.manuales.push(fila);
      guardar(e);
      return json({ id: fila.id });
    }
    if ((m = /^\/api\/partes\/(\d+)\/eventos$/.exec(camino))) {
      const p = parteDe(e, m[1]);
      if (!p) throw new ErrorHttp(404, "Parte no encontrado");
      if (metodo === "GET") {
        return json(p.eventos.slice().sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id - b.id)));
      }
      const tipo = texto(cuerpo && cuerpo.tipo).trim(), descripcion = texto(cuerpo && cuerpo.descripcion).trim();
      if (!tipo || !descripcion) throw new ErrorHttp(400, "Faltan 'tipo' y/o 'descripcion'");
      const ev = nuevoEvento(e, p, { tipo, descripcion, ts: cuerpo.ts || isoLocal(ahora), dosis: cuerpo.dosis ?? null, unidad: cuerpo.unidad ?? null }, ahora);
      guardar(e);
      return json({ id: ev.id });
    }
    if ((m = /^\/api\/eventos\/(\d+)$/.exec(camino)) && metodo === "DELETE") {
      const id = Number(m[1]);
      const p = e.partes.find((x) => x.eventos.some((ev) => ev.id === id));
      if (!p) throw new ErrorHttp(404, "Evento no encontrado");
      p.eventos = p.eventos.filter((ev) => ev.id !== id);
      guardar(e);
      return json({ ok: true });
    }
    if (camino === "/api/captura/estado") return json(capturaEstado(e, ahora));
    if (camino === "/api/captura/iniciar") {
      const p = parteDe(e, cuerpo && cuerpo.parte_id);
      if (!p) throw new ErrorHttp(404, "Parte no encontrado");
      permitir(e);
      capturaIniciar(e, p, ahora, Number(cuerpo.intervalo_s) || 30);
      guardar(e);
      return json({ ok: true });
    }
    if (camino === "/api/captura/detener") {
      inhibir(e, "Detener en la notebook", ahora);
      capturaDetener(e, ahora);
      guardar(e);
      return json({ ok: true });
    }
    if (camino === "/api/monitoreo/iniciar" || camino === "/api/monitoreo/detener") {
      const orden = camino.endsWith("iniciar") ? "iniciar" : "detener";
      const detalle = ejecutarOrden(e, orden, true, ahora);
      guardar(e);
      return json({ ok: true, detalle, parte_id: e.captura.parte_id });
    }
    if (camino === "/api/monitoreo/estado") {
      return json({ captura: capturaEstado(e, ahora), nube: nubeEstado(e, ahora), autoarranque_frenado: e.frenado });
    }
    if (camino === "/api/nube/estado") return json(nubeEstado(e, ahora));
    if (camino === "/api/nube/iniciar") {
      const p = parteDe(e, cuerpo && cuerpo.parte_id);
      if (!p) throw new ErrorHttp(404, "Parte no encontrado");
      subidaIniciar(e, p, ahora);
      guardar(e);
      return json({ ok: true });
    }
    if (camino === "/api/nube/detener") { subidaDetener(e); guardar(e); return json({ ok: true }); }
    if (camino.startsWith("/api/nube/")) {
      throw new ErrorHttp(400, "En la demo la notebook queda vinculada a la cuenta de demostración");
    }
    throw new ErrorHttp(404, `La demo no conoce ${metodo} ${camino}`);
  }

  // ─────────────────────────────────────────── fetch y WebSocket de mentira

  const fetchReal = window.fetch.bind(window);

  async function leerCuerpo(recurso, opciones) {
    let crudo = opciones && opciones.body;
    if (crudo == null && recurso instanceof Request) crudo = await recurso.clone().text();
    if (crudo == null) return null;
    let txt;
    if (typeof crudo === "string") txt = crudo;
    else if (crudo instanceof URLSearchParams) txt = crudo.toString();
    else if (crudo instanceof ArrayBuffer || ArrayBuffer.isView(crudo)) txt = new TextDecoder().decode(crudo);
    else if (crudo instanceof Blob) txt = await crudo.text();
    else txt = String(crudo);
    try { return JSON.parse(txt); } catch (_) { /* no es JSON */ }
    if (txt.includes("=")) return Object.fromEntries(new URLSearchParams(txt));
    return txt;
  }

  window.fetch = async function (recurso, opciones) {
    const crudo = recurso instanceof Request ? recurso.url : String(recurso);
    let url;
    try { url = new URL(crudo, location.href); } catch (_) { return fetchReal(recurso, opciones); }
    const esNube = url.href.startsWith(NUBE);
    const esNotebook = !esNube && url.origin === location.origin && url.pathname.startsWith("/api/");
    if (!esNube && !esNotebook) return fetchReal(recurso, opciones);
    const metodo = ((opciones && opciones.method) || (recurso instanceof Request ? recurso.method : "GET")).toUpperCase();
    const cuerpo = await leerCuerpo(recurso, opciones);
    const ahora = Date.now();
    const e = cargar();
    if (tic(e, ahora)) guardar(e);
    let r;
    try {
      r = esNube ? await nube(metodo, url, cuerpo, e, ahora) : await notebook(metodo, url, cuerpo, e, ahora);
    } catch (err) {
      const status = err instanceof ErrorHttp ? err.status : 500;
      if (!(err instanceof ErrorHttp)) console.error("[demo]", err);
      r = json({ detail: err.message || "Error de la demo" }, status);
    }
    return new Response(r.cuerpo, { status: r.status, headers: { "Content-Type": r.tipo, "Cache-Control": "no-store" } });
  };

  // El VIVO por WebSocket (/anestesia/sesiones/{id}/ws): cada 3 s la tanda
  // nueva de vitales y las curvas; al cerrarse el parte, el código 4410.
  const WebSocketReal = window.WebSocket;
  class WebSocketDemo extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url);
      this.readyState = 0;
      this.protocol = "";
      this.extensions = "";
      this.binaryType = "blob";
      this.bufferedAmount = 0;
      this.onopen = this.onmessage = this.onclose = this.onerror = null;
      const u = new URL(this.url);
      const m = /\/anestesia\/sesiones\/(\d+)\/ws$/.exec(u.pathname);
      this._id = m ? Number(m[1]) : null;
      this._desde = u.searchParams.get("desde") || "";
      setTimeout(() => this._abrir(), 60);
    }
    _emitir(tipo, init) {
      const ev = tipo === "message" ? new MessageEvent("message", init)
        : tipo === "close" ? new CloseEvent("close", init) : new Event(tipo);
      this.dispatchEvent(ev);
      const h = this[`on${tipo}`];
      if (typeof h === "function") h.call(this, ev);
    }
    _abrir() {
      if (this.readyState !== 0) return;
      this.readyState = 1;
      this._emitir("open");
      const e = cargar();
      const p = parteDe(e, this._id);
      if (!p || !p.sesion) { this._cerrar(4404, "la sesión no está"); return; }
      if (!e.pasos.vivo) { e.pasos.vivo = true; guardar(e); }
      this._tic();
      this._reloj = setInterval(() => this._tic(), PASO_MS);
    }
    _tic() {
      if (this.readyState !== 1) return;
      const ahora = Date.now();
      const e = cargar();
      if (tic(e, ahora)) guardar(e);
      const p = parteDe(e, this._id);
      if (!p || !p.sesion) { this._cerrar(4410, "la anestesia terminó"); return; }
      const nuevos = vitalesDe(p, this._desde || null, ahora).map(({ id, fuente, ...v }) => v);
      if (nuevos.length) this._desde = nuevos[nuevos.length - 1].ts;
      this._emitir("message", { data: JSON.stringify(nuevos) });
      const ultimo = nuevos[nuevos.length - 1];
      if (ultimo) this._emitir("message", { data: JSON.stringify({ curvas: curvasEn(ultimo) }) });
    }
    _cerrar(code, reason) {
      clearInterval(this._reloj);
      if (this.readyState === 3) return;
      this.readyState = 3;
      this._emitir("close", { code, reason, wasClean: true });
    }
    send() { /* el teléfono no manda nada por el vivo */ }
    close(code, reason) { this._cerrar(code || 1000, reason || ""); }
  }
  Object.assign(WebSocketDemo, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  function WebSocketMixto(url, protocolos) {
    if (String(url).startsWith(NUBE.replace(/^https/, "wss"))) return new WebSocketDemo(url, protocolos);
    return protocolos === undefined ? new WebSocketReal(url) : new WebSocketReal(url, protocolos);
  }
  Object.assign(WebSocketMixto, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  WebSocketMixto.prototype = WebSocketReal.prototype;
  window.WebSocket = WebSocketMixto;

  // ───────────────────────────────────────────── el reloj de cada ventana

  setInterval(() => {
    const e = cargar();
    if (tic(e, Date.now())) guardar(e);
  }, PASO_MS);

  // Las páginas de la NOTEBOOK se refrescan solas cuando cambia algo desde
  // otra ventana (la app manda una ficha, concluye, el monitor arranca).
  const enNotebook = /\/notebook\//.test(location.pathname);
  if (enNotebook) {
    let ultimaFirma = "";
    const firma = () => {
      const e = cargar();
      return JSON.stringify(e.partes.map((p) => [p.id, p.estado, p.datos.nombre, p.datos.hc_dni]));
    };
    const refrescar = () => {
      const f = firma();
      if (f === ultimaFirma) return;
      const antes = ultimaFirma;
      ultimaFirma = f;
      if (!antes) return;
      if (typeof window.cargarPartes === "function") window.cargarPartes();
      const id = Number(new URLSearchParams(location.search).get("id"));
      if (/parte\.html$/.test(location.pathname) && id) {
        let sinCambiosPropios = true;
        try { sinCambiosPropios = Object.keys(pendientes).length === 0; } catch (_) { /* aún no cargó */ }
        const ahoraP = JSON.parse(f).find((x) => x[0] === id);
        const antesP = JSON.parse(antes).find((x) => x[0] === id);
        if (sinCambiosPropios && JSON.stringify(ahoraP) !== JSON.stringify(antesP)) location.reload();
      }
    };
    addEventListener("storage", (ev) => { if (ev.key === CLAVE) refrescar(); });
    setInterval(refrescar, 4000);
    addEventListener("DOMContentLoaded", () => {
      ultimaFirma = firma();
      if (/imprimir\.html$/.test(location.pathname) && !new URLSearchParams(location.search).get("para_pdf")) {
        const e = cargar();
        if (!e.pasos.planilla) { e.pasos.planilla = true; guardar(e); }
      }
    });
  }

  // ───────────────────────────────────────────── lo que usa la portada

  window.critidataDemo = {
    raiz: RAIZ,
    estado: () => cargar(),
    // El monitor como lo ve el quirófano: los signos de ahora (del parte
    // que se registra, o del paciente en la camilla) y sus curvas.
    monitorAhora() {
      const ahora = Date.now();
      const e = cargar();
      const p = e.captura.activa ? parteDe(e, e.captura.parte_id) : null;
      // Sin registro, el paciente en la camilla: despierto y estable.
      const t = Math.floor(ahora / PASO_MS) * PASO_MS;
      const v = p && p.t0 != null
        ? vitalEn(t, p.t0, p.id, p.perfil || "general")
        : vitalEn(t, ahora - 60 * 60000, 7, "regional");
      return {
        vital: v, curvas: curvasEn(v), conectado: Boolean(e.monitor.conectado),
        registrando: Boolean(e.captura.activa && e.monitor.conectado), parte_id: p ? p.id : null,
        frenado: e.frenado,
      };
    },
    conectarMonitor(si) {
      const e = cargar();
      monitorConectar(e, si, Date.now());
      if (si) e.pasos.monitor = true;
      guardar(e);
    },
    // Borra TODO lo de la demo (la app y la notebook): solo las claves con
    // el prefijo de la demo, jamás las de la app real del mismo sitio.
    reiniciar() {
      try {
        const claves = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(PREFIJO)) claves.push(k);
        }
        claves.forEach((k) => localStorage.removeItem(k));
      } catch (_) { /* sin localStorage: queda en memoria */ }
      enMemoria = null;
    },
    // Para las pruebas (node): el núcleo, sin el navegador.
    _nucleo: { sembrar, aplicarCarga, ejecutarOrden, tic, monitorConectar, vitalesDe, cerrarParte, capturaEstado, latido, sesionesDe, parteDe },
  };
})();
