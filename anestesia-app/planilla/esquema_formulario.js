// Esquema del Parte Anestésico (Anexo V — Htal. Z. Gral. Dr. Posadas, Saladillo)
// Transcripto de la foto del formulario papel. Los campos con incierto:true
// tienen rótulos poco legibles en la foto: corregir acá y se actualiza toda
// la app (ficha + impresión).
//
// tipos: texto | textoLargo | numero | fecha | hora | opciones (una) | checks (varias) | siNo

window.ESQUEMA_FORMULARIO = {
  institucion: {
    lineas: [
      "Htal. Z. Gral. Dr. Posadas — Saladillo",
      "Servicio de Anestesia",
      "Parte de Anestesia",
    ],
    titulo: "ANEXO V",
  },
  secciones: [
    {
      id: "cabecera", titulo: "Datos del paciente y la cirugía",
      campos: [
        { id: "fecha", etiqueta: "Fecha", tipo: "fecha" },
        { id: "hc_dni", etiqueta: "Historia Clínica o DNI", tipo: "texto" },
        // 29-sep ("la carga va a ser apellido y nombre, y en el anexo igual").
        { id: "nombre", etiqueta: "Apellido y Nombre", tipo: "texto", ancho: "grande" },
        { id: "sexo", etiqueta: "Sexo", tipo: "opciones", opciones: ["M", "F"] },
        { id: "edad", etiqueta: "Edad", tipo: "texto", ancho: "chico" },
        { id: "peso", etiqueta: "Peso (kg)", tipo: "numero", ancho: "chico" },
        { id: "diagnostico", etiqueta: "Diagnóstico", tipo: "texto", ancho: "grande" },
        { id: "operacion_propuesta", etiqueta: "Operación Propuesta", tipo: "texto", ancho: "grande" },
        // 28-ago-2026, pedido del usuario: el código de la cirugía
        // (nomenclador) acompaña a la operación propuesta.
        { id: "codigo_cirugia", etiqueta: "Código de cirugía", tipo: "texto", ancho: "chico" },
        // 1-oct-2026, pedido del usuario: "debajo de cirugía programada va
        // tipo de intervención". De UNA opción. El defecto (Internación)
        // vive en la APP, no acá: en la ficha web el campo SÍ puede quedar
        // sin dato — un parte que nació en la notebook sin carga del
        // celular, una carga de la app vieja (sin la clave), o re-tocar la
        // opción elegida, que la destilda ("repetir = destildar",
        // parte.js). Si alguna vez tiene que imprimirse siempre, el
        // defecto hay que ponerlo del lado del parte.
        { id: "tipo_intervencion", etiqueta: "Tipo de intervención", tipo: "opciones", opciones: ["Internación", "Ambulatoria"] },
        { id: "asa", etiqueta: "ASA", tipo: "opciones", multi: true, opciones: ["1", "2", "3", "4", "5", "E"] },
        { id: "anestesiologos", etiqueta: "Anestesiólogo(s)", tipo: "texto", ancho: "grande" },
        { id: "hora_ingreso", etiqueta: "Hora de ingreso", tipo: "hora" },
        { id: "hora_fin", etiqueta: "Hora de finalización", tipo: "hora" },
        { id: "quirofano", etiqueta: "Quirófano", tipo: "texto", ancho: "chico" },
      ],
    },
    {
      id: "ingreso", titulo: "Condición al ingreso",
      campos: [
        { id: "condicion_ingreso", etiqueta: "Condición al ingreso", tipo: "textoLargo" },
        // 24-sep: la V. Arterial es un casillero mas (antes iba en un renglon
        // aparte con "V. Arterial en:", que se saco junto con los numeros de via).
        { id: "vias_ingreso", etiqueta: "Vías de ingreso", tipo: "checks",
          opciones: ["VP", "VC", "VCP", "V. Arterial", "SNG", "S. Vesical"] },
      ],
    },
    {
      id: "antecedentes", titulo: "Antecedentes",
      campos: [
        { id: "antecedentes", etiqueta: "Antecedentes Patológicos Condicionantes", tipo: "textoLargo" },
      ],
    },
    {
      id: "practicas", titulo: "Vías al ingreso",
      campos: [
        { id: "vias_comentario", etiqueta: "Comentarios de las vías", tipo: "textoLargo" },
        { id: "comentarios", etiqueta: "Comentarios", tipo: "textoLargo" },
      ],
    },
    {
      id: "controles", titulo: "Controles y monitoreo",
      campos: [
        { id: "monitoreo_faaaar", etiqueta: "Monitoreo según Normas FAAAAR", tipo: "siNo" },
        { id: "proteccion_ocular", etiqueta: "Protección Ocular", tipo: "siNo" },
        { id: "proteccion_decubitos", etiqueta: "Protección Decúbitos", tipo: "siNo" },
        // 24-sep: texto (la app manda "> 8" o "< 8"; el parte imprime "> 8 hs").
        { id: "ayuno_hs", etiqueta: "Refiere ayuno de (hs)", tipo: "texto", ancho: "chico" },
      ],
    },
    {
      id: "procedimiento", titulo: "Premedicación e inducción",
      campos: [
        { id: "premedicacion", etiqueta: "Premedicación", tipo: "textoLargo" },
        { id: "induccion", etiqueta: "Inducción", tipo: "textoLargo" },
        { id: "posicion", etiqueta: "Posición", tipo: "texto" },
      ],
    },
    {
      id: "tecnica", titulo: "Técnica anestésica / Bloqueos",
      campos: [
        { id: "bloqueo", etiqueta: "Bloqueo", tipo: "checks",
          opciones: ["Peridural", "Raquídeo", "Plexual", "Periférico"], incierto: true },
        { id: "antiseptico", etiqueta: "Antiséptico con", tipo: "checks",
          opciones: ["Pervidona", "Alcohol iodado"], incierto: true },
        { id: "zona_puncion", etiqueta: "Zona de punción", tipo: "texto" },
        { id: "aguja", etiqueta: "Calibre aguja", tipo: "texto", ancho: "chico" },
        { id: "material", etiqueta: "Mat. utilizado", tipo: "checks",
          opciones: ["Caja Hospital", "Set Descartable", "Látex"], incierto: true },
        { id: "lote", etiqueta: "Lote", tipo: "texto", ancho: "chico" },
        { id: "agente_anestesico", etiqueta: "Agente anestésico", tipo: "texto" },
        { id: "dosis_agente", etiqueta: "Dosis", tipo: "texto", ancho: "chico" },
        { id: "cantidad_inyectada", etiqueta: "Cantidad inyectada (cc)", tipo: "texto",
          ancho: "chico", incierto: true },
        { id: "dosis_total", etiqueta: "Dosis total", tipo: "texto", ancho: "chico" },
        { id: "cateter", etiqueta: "Catéter", tipo: "siNo" },
        { id: "dosis_prueba", etiqueta: "Dosis prueba", tipo: "siNo" },
        { id: "reinyecciones", etiqueta: "Reinyecciones", tipo: "texto", incierto: true },
      ],
    },
    {
      id: "via_aerea", titulo: "Vía aérea",
      campos: [
        { id: "tubo_tipo", etiqueta: "Tubo", tipo: "opciones",
          opciones: ["Oral", "Nasal", "Máscara Laríngea"] },
        { id: "tubo_numero", etiqueta: "N°", tipo: "numero", ancho: "chico" },
        { id: "dificultad", etiqueta: "Dificultad", tipo: "siNo" },
        { id: "otras_vias", etiqueta: "Otros tubos", tipo: "texto", incierto: true },
      ],
    },
    {
      id: "ventilacion", titulo: "Ventilación",
      campos: [
        { id: "suplemento_o2", etiqueta: "Suplemento de O2", tipo: "checks",
          opciones: ["Máscara", "Bigotera"] },
        { id: "respiracion", etiqueta: "Respiración", tipo: "opciones",
          opciones: ["Espontánea", "Asistida", "Controlada"] },
        { id: "peep_cierre", etiqueta: "PEEP (cm H2O)", tipo: "numero", ancho: "chico" },
        { id: "fio2_cierre", etiqueta: "FiO2 (%)", tipo: "numero", ancho: "chico" },
        // 22-sep ("falta vol corriente, fc respiratoria"): en el papel manda
        // el monitor si hubo monitoreo; sin monitor, lo cargado en la
        // anestesia General de la app.
        { id: "vol_corriente", etiqueta: "Vol. Corriente (ml)", tipo: "numero", ancho: "chico" },
        { id: "frec_resp", etiqueta: "Frec. Resp. (/min)", tipo: "numero", ancho: "chico" },
        // 29-sep ("faltan ítems que están en el parte"): la PIP; en el papel
        // manda el monitor, sin monitor la cargada.
        { id: "pip_cierre", etiqueta: "PIP (cm H2O)", tipo: "numero", ancho: "chico" },
        { id: "comandada", etiqueta: "Comandada", tipo: "opciones",
          opciones: ["Manual", "Mecánica"] },
        { id: "sistema", etiqueta: "Sistema", tipo: "opciones",
          opciones: ["Lineal", "Circular"] },
        { id: "fgf", etiqueta: "FGF (L/min)", tipo: "numero", ancho: "chico", incierto: true },
      ],
    },
    {
      id: "estado_final", titulo: "Estado del paciente al finalizar la anestesia",
      campos: [
        { id: "estimulos_dolorosos", etiqueta: "Responde a estímulos dolorosos", tipo: "siNo", incierto: true },
        { id: "obedece_ordenes", etiqueta: "Obedece órdenes", tipo: "siNo" },
        { id: "depresion_respiratoria", etiqueta: "Depresión respiratoria", tipo: "siNo" },
        { id: "moviliza_msup", etiqueta: "Moviliza M. Sup.", tipo: "siNo" },
        { id: "moviliza_minf", etiqueta: "Moviliza M. Inf.", tipo: "siNo" },
        // 23-sep: la circulación del Aldrete la responde el anestesiólogo
        // (TA final contra la basal); el monitor queda de respaldo.
        { id: "circulacion_aldrete", etiqueta: "Circulación (Aldrete)", tipo: "opciones",
          opciones: ["TA ±20% de la basal", "TA ±20–50%", "TA >50%"] },
        { id: "tas_final", etiqueta: "TAS", tipo: "numero", ancho: "chico" },
        { id: "sat_final", etiqueta: "SatO2 (%)", tipo: "numero", ancho: "chico" },
        { id: "aldrete", etiqueta: "Aldrete", tipo: "numero", ancho: "chico" },
      ],
    },
    {
      id: "destino", titulo: "Destino",
      campos: [
        { id: "pasa_a", etiqueta: "Pasa a", tipo: "opciones",
          opciones: ["Sala General", "Recuperación", "UCI"] },
        { id: "requiere_o2", etiqueta: "Requiere O2 con máscara", tipo: "siNo" },
      ],
    },
    {
      id: "uti", titulo: "Ingreso a UCI",
      campos: [
        { id: "ingreso_uti", etiqueta: "Ingreso a UCI", tipo: "checks",
          opciones: ["Despierto", "R/ a orden verbal", "Somnoliento", "Dormido",
                     "Sedado", "Relajado para ARM"], incierto: true },
        { id: "via_aerea_uti", etiqueta: "Vía aérea", tipo: "checks",
          opciones: ["Extubado", "Con máscara", "Intubado"], incierto: true },
        { id: "ventilacion_uti", etiqueta: "Ventilación", tipo: "opciones",
          opciones: ["Espontánea", "Asistida", "Controlada"] },
        // 23-sep: el cuadro de valores al ingreso a UCI y "Entrega Dr." no
        // están en el parte impreso; se sacaron del formulario también.
        { id: "recibe_dr", etiqueta: "Recibe en UCI: Dr.", tipo: "texto" },
      ],
    },
    {
      id: "firma", titulo: "Firma",
      campos: [
        { id: "aclaracion", etiqueta: "Aclaración", tipo: "texto", ancho: "grande" },
        { id: "mp_mn", etiqueta: "MP/MN", tipo: "texto", ancho: "chico" },
        // 24-sep: la firma electronica que manda la app (PNG en base64) y su hora.
        { id: "firmado_en", etiqueta: "Firmado electrónicamente el", tipo: "texto", ancho: "chico" },
      ],
    },
  ],
};

// ALDRETE NO CALIFICA (21-sep, "pase a UCI extubado con Aldrete; intubado
// ARM, Aldrete no califica"): el Aldrete es un puntaje de alta de
// recuperacion — un paciente que va a UCI intubado bajo ARM queda fuera
// de esa pregunta (respiracion 0 por el respirador, conciencia 0-1 por la
// sedacion: el numero no mediria nada). El parte lo dice con letras en
// vez de dejar el casillero en blanco o inventar un puntaje. Los checks
// llegan como lista (la notebook) o como texto (una carga vieja).
window.aldreteNoCalifica = function (datos) {
  const marcados = (v) => Array.isArray(v) ? v : String(v ?? "").split(/[,/]/).map((s) => s.trim());
  return marcados(datos.via_aerea_uti).includes("Intubado") ||
         marcados(datos.ingreso_uti).includes("Relajado para ARM");
};
window.ALDRETE_NO_CALIFICA = "No califica";

// Score de Aldrete calculado con los campos del estado final + la TAS basal
// (primera TAS capturada). Devuelve 0–10, o null si falta algún componente.
// Los CINCO items del Aldrete por separado (21-sep, "que el Aldrete figure
// con todos sus items en el parte"): cada uno 0-2, o null si falta lo que
// lo decide; total solo con los cinco. calcularAldrete es la suma.
window.componentesAldrete = function (datos, tasBasal) {
  const sup = datos.moviliza_msup, inf = datos.moviliza_minf;
  const actividad = (sup && inf)
    ? (sup === "Sí" ? 1 : 0) + (inf === "Sí" ? 1 : 0) : null;
  const respiracion = datos.depresion_respiratoria
    ? (datos.depresion_respiratoria === "No" ? 2 : 1) : null;
  // La circulación: lo que respondió el anestesiólogo (23-sep); si el
  // parte no lo trae (uno viejo), la TAS final contra la basal del monitor.
  const circ = String(datos.circulacion_aldrete ?? "").trim();
  let circulacion = null;
  if (circ) {
    circulacion = circ.includes(">50") ? 0
      : (circ.includes("20–50") || circ.includes("20-50")) ? 1 : 2;
  } else {
    const tas = parseFloat(datos.tas_final);
    if (tasBasal && isFinite(tas)) {
      const desvio = Math.abs(tas - tasBasal) / tasBasal;
      circulacion = desvio <= 0.2 ? 2 : desvio <= 0.5 ? 1 : 0;
    }
  }
  let conciencia = null;
  if (datos.obedece_ordenes === "Sí") conciencia = 2;
  else if (datos.estimulos_dolorosos === "Sí") conciencia = 1;
  else if (datos.obedece_ordenes === "No" && datos.estimulos_dolorosos === "No") conciencia = 0;
  const sat = parseFloat(datos.sat_final);
  const saturacion = isFinite(sat) ? (sat >= 92 ? 2 : sat >= 90 ? 1 : 0) : null;
  const items = { actividad, respiracion, circulacion, conciencia, saturacion };
  const completo = Object.values(items).every((x) => x != null);
  return { ...items,
           total: completo ? Object.values(items).reduce((a, b) => a + b, 0) : null };
};

window.calcularAldrete = function (datos, tasBasal) {
  return window.componentesAldrete(datos, tasBasal).total;
};

// Series del gráfico intraoperatorio (pantalla e impresión).
// simbolo: como se marca en el parte papel; colorPantalla: solo pantalla.
window.VITALES_GRAFICO = {
  // gráficas sobre eje Y de presión/frecuencia (0–220)
  plot: [
    { key: "nibp_sis", etiqueta: "TAS", simbolo: "v", colorPantalla: "#e05555" },
    { key: "nibp_dia", etiqueta: "TAD", simbolo: "^", colorPantalla: "#e09955" },
    { key: "hr",       etiqueta: "FC",  simbolo: "●", colorPantalla: "#4caf50" },
    { key: "spo2",     etiqueta: "SpO2", simbolo: "○", colorPantalla: "#29b6f6" },
  ],
  // filas numéricas (una celda por columna de tiempo en la impresión)
  filas: [
    { key: "spo2",   etiqueta: "SpO2 %" },
    { key: "etco2",  etiqueta: "etCO2" },
    { key: "sev_et", etiqueta: "Sev Et %" },
    { key: "sev_fi", etiqueta: "Sev Fi %" },
    { key: "vt",     etiqueta: "VT ml" },
    { key: "fr_vent", etiqueta: "FR" },
    { key: "peep",   etiqueta: "PEEP" },
    { key: "pip",    etiqueta: "PIP" },
  ],
  minutosPorColumna: 5,
};
