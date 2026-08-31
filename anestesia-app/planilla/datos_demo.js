// DEMO de la planilla (Anexo V) para la app: intercepta los fetch de
// imprimir.js y contesta con un parte de DEMOSTRACIÓN embebido — sin
// backend. imprimir.js y esquema_formulario.js son COPIAS FIELES de
// app/static (la planilla que vale, commit e810f94): esta página los usa
// tal cual; si la planilla evoluciona, refrescar las copias desde ahí.
// Datos 100% inventados: "PACIENTE DE DEMOSTRACIÓN".
"use strict";

(function () {
  const DIA = "2026-08-27";
  // minutos desde las 08:00 → ISO local (la cirugía del demo: 08:00–09:45)
  const ts = (min) => {
    const h = String(8 + Math.floor(min / 60)).padStart(2, "0");
    const m = String(min % 60).padStart(2, "0");
    return `${DIA}T${h}:${m}:00`;
  };

  // ── vitales cada 5 min (determinísticos: el demo se ve siempre igual) ──
  const vitales = [];
  for (let m = 0; m <= 105; m += 5) {
    const onda = Math.sin(m / 17);
    const induccion = m >= 5 && m <= 20; // el bajón post-inducción
    const fila = {
      ts: ts(m),
      fuente: "auto",
      hr: Math.round(74 + 6 * onda - (induccion ? 6 : 0)),
      spo2: m === 0 ? 97 : 98,
      rr: null,
      etco2: m < 5 ? null : Math.round(34 + 2 * onda),
      fico2: m < 5 ? null : 0,
      awrr: m < 5 ? null : 12,
      sev_et: m < 5 ? null : +(1.9 + 0.2 * onda).toFixed(1),
      sev_fi: m < 5 ? null : +(2.2 + 0.2 * onda).toFixed(1),
      mac: m < 5 ? null : 1.0,
      peep: m < 5 ? null : 5,
      pip: m < 5 ? null : Math.round(17 + onda),
      pmedia: m < 5 ? null : 9,
      vt: m < 5 ? null : Math.round(500 + 15 * onda),
      mv: m < 5 ? null : 6.0,
      fr_vent: m < 5 ? null : 12,
      nibp_sis: null, nibp_dia: null, nibp_pam: null,
    };
    // NIBP cada 15 min, como se mide de verdad
    if (m % 15 === 0) {
      const sis = induccion ? 96 : Math.round(118 + 6 * onda);
      const dia = induccion ? 55 : Math.round(70 + 4 * onda);
      fila.nibp_sis = sis;
      fila.nibp_dia = dia;
      fila.nibp_pam = Math.round((sis + 2 * dia) / 3);
    }
    vitales.push(fila);
  }

  // ── el parte (mismo shape que GET /api/partes/{id}) ────────────────────
  const parte = {
    id: 1,
    creado: ts(0),
    estado: "cerrado",
    datos: {
      fecha: DIA,
      hc_dni: "12.345.678",
      nombre: "PACIENTE DE DEMOSTRACIÓN",
      sexo: "M",
      edad: "34",
      peso: "78",
      diagnostico: "Apendicitis aguda",
      operacion_propuesta: "Apendicectomía laparoscópica",
      codigo_cirugia: "07.06.02",   // inventado, como todo el parte
      asa: "2",
      anestesiologos: "Dr. Demo",
      hora_ingreso: "08:00",
      hora_fin: "09:45",
      quirofano: "1",
      condicion_ingreso: "Lúcido, hemodinámicamente estable, afebril.",
      vias_ingreso: ["VP"],
      antecedentes: "Sin antecedentes patológicos de relevancia. Niega alergias.",
      via_periferica_1: "18G",
      abordaje: "MSI",
      monitoreo_faaaar: "Sí",
      proteccion_ocular: "Sí",
      proteccion_decubitos: "Sí",
      ayuno_hs: "8",
      premedicacion: "Midazolam 2 mg IV.",
      induccion: "Propofol 150 mg + Fentanilo 150 µg + Rocuronio 50 mg IV. " +
        "Laringoscopía directa Cormack I, intubación orotraqueal sin dificultad.",
      posicion: "Decúbito dorsal",
      tubo_tipo: "Oral",
      tubo_numero: "7.5",
      dificultad: "No",
      respiracion: "Controlada",
      comandada: "Mecánica",
      sistema: "Circular",
      peep_cierre: "5",
      fio2_cierre: "50",
      fgf: "2",
      reflejo_corneal: "Sí",
      estimulos_dolorosos: "Sí",
      obedece_ordenes: "Sí",
      depresion_circulatoria: "No",
      depresion_respiratoria: "No",
      moviliza_msup: "Sí",
      moviliza_minf: "Sí",
      tas_final: "118",
      tam_final: "88",
      sat_final: "98",
      fio2_final: "28",
      pasa_a: "Recuperación",
      pasa_hora: "09:55",
      requiere_o2: "No",
      aclaracion: "Dr. Demo",
      mp_mn: "MP 12345",
    },
  };

  // ── drogas / volúmenes / eventos (mismo shape que /eventos) ────────────
  let idEvento = 0;
  const evento = (min, tipo, descripcion, dosis, unidad) => ({
    id: ++idEvento, ts: ts(min), tipo, descripcion,
    dosis: dosis ?? null, unidad: unidad ?? null,
  });
  const eventos = [
    evento(2, "droga", "Fentanilo", "150", "µg"),
    evento(2, "droga", "Propofol", "150", "mg"),
    evento(3, "droga", "Rocuronio", "50", "mg"),
    evento(10, "droga", "Cefazolina", "2", "g"),
    evento(62, "droga", "Fentanilo", "50", "µg"),
    evento(80, "droga", "Dipirona", "2", "g"),
    evento(85, "droga", "Ondansetrón", "4", "mg"),
    evento(30, "volumen", "Sol. Fisiológica", "500", "ml"),
    evento(90, "volumen", "Sol. Fisiológica", "500", "ml"),
    evento(100, "volumen", "Diuresis", "200", "ml"),
    evento(4, "evento", "Intubación orotraqueal"),
    evento(15, "evento", "Inicio de cirugía"),
    evento(95, "evento", "Fin de cirugía"),
    evento(103, "evento", "Extubación"),
  ];

  // ── el shim: los 3 GET de imprimir.js se contestan desde acá ───────────
  const rutas = {
    "/api/partes/1": parte,
    "/api/partes/1/vitales": vitales,
    "/api/partes/1/eventos": eventos,
  };
  const fetchReal = window.fetch.bind(window);
  window.fetch = function (recurso, opciones) {
    const camino = String(recurso).split("?")[0];
    if (camino in rutas) {
      return Promise.resolve(new Response(JSON.stringify(rutas[camino]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    }
    return fetchReal(recurso, opciones);
  };

  // El "volver" de la barra apunta a la app (parte.html no existe acá).
  addEventListener("DOMContentLoaded", () => {
    const volver = document.getElementById("volver");
    if (volver) {
      volver.href = "../";
      volver.textContent = "‹ Volver a la app";
    }
  });
})();
