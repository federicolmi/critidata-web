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
        { id: "nombre", etiqueta: "Nombre y Apellido", tipo: "texto", ancho: "grande" },
        { id: "sexo", etiqueta: "Sexo", tipo: "opciones", opciones: ["M", "F"] },
        { id: "edad", etiqueta: "Edad", tipo: "numero", ancho: "chico" },
        { id: "peso", etiqueta: "Peso (kg)", tipo: "numero", ancho: "chico" },
        { id: "diagnostico", etiqueta: "Diagnóstico", tipo: "texto", ancho: "grande" },
        { id: "operacion_propuesta", etiqueta: "Operación Propuesta", tipo: "texto", ancho: "grande" },
        // 28-ago-2026, pedido del usuario: el código de la cirugía
        // (nomenclador) acompaña a la operación propuesta.
        { id: "codigo_cirugia", etiqueta: "Código de cirugía", tipo: "texto", ancho: "chico" },
        { id: "asa", etiqueta: "ASA", tipo: "opciones", opciones: ["1", "2", "3", "4", "5", "E"] },
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
        { id: "vias_ingreso", etiqueta: "Vías de ingreso", tipo: "checks",
          opciones: ["VP", "VC", "VCP", "SNG", "S. Vesical"] },
      ],
    },
    {
      id: "antecedentes", titulo: "Antecedentes",
      campos: [
        { id: "antecedentes", etiqueta: "Antecedentes Patológicos Condicionantes", tipo: "textoLargo" },
      ],
    },
    {
      id: "practicas", titulo: "Prácticas efectuadas",
      campos: [
        { id: "via_periferica_1", etiqueta: "Vía Periférica N°", tipo: "texto", ancho: "chico" },
        { id: "via_periferica_2", etiqueta: "Vía Periférica N°", tipo: "texto", ancho: "chico" },
        { id: "via_central", etiqueta: "Vía Central N°", tipo: "texto", ancho: "chico" },
        { id: "abordaje", etiqueta: "Abordaje", tipo: "texto" },
        { id: "via_arterial", etiqueta: "V. Arterial en", tipo: "texto" },
        { id: "comentarios", etiqueta: "Comentarios", tipo: "textoLargo" },
      ],
    },
    {
      id: "controles", titulo: "Controles y monitoreo",
      campos: [
        { id: "monitoreo_faaaar", etiqueta: "Monitoreo según Normas FAAAAR", tipo: "siNo" },
        { id: "proteccion_ocular", etiqueta: "Protección Ocular", tipo: "siNo" },
        { id: "proteccion_decubitos", etiqueta: "Protección Decúbitos", tipo: "siNo" },
        { id: "ayuno_hs", etiqueta: "Refiere ayuno de (hs)", tipo: "numero", ancho: "chico" },
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
        { id: "reflejo_corneal", etiqueta: "Reflejo corneal", tipo: "siNo" },
        { id: "estimulos_dolorosos", etiqueta: "Responde a estímulos dolorosos", tipo: "siNo", incierto: true },
        { id: "obedece_ordenes", etiqueta: "Obedece órdenes", tipo: "siNo" },
        { id: "depresion_circulatoria", etiqueta: "Depresión circulatoria", tipo: "siNo" },
        { id: "depresion_respiratoria", etiqueta: "Depresión respiratoria", tipo: "siNo" },
        { id: "moviliza_msup", etiqueta: "Moviliza M. Sup.", tipo: "siNo" },
        { id: "moviliza_minf", etiqueta: "Moviliza M. Inf.", tipo: "siNo" },
        { id: "tas_final", etiqueta: "TAS", tipo: "numero", ancho: "chico" },
        { id: "tam_final", etiqueta: "TAM", tipo: "numero", ancho: "chico" },
        { id: "sat_final", etiqueta: "SatO2 (%)", tipo: "numero", ancho: "chico" },
        { id: "fio2_final", etiqueta: "con FiO2 (%)", tipo: "numero", ancho: "chico" },
        { id: "aldrete", etiqueta: "Aldrete (auto)", tipo: "numero", ancho: "chico" },
      ],
    },
    {
      id: "destino", titulo: "Destino",
      campos: [
        { id: "pasa_a", etiqueta: "Pasa a", tipo: "opciones",
          opciones: ["Sala General", "Recuperación", "UTI"] },
        { id: "pasa_hora", etiqueta: "a las (hs)", tipo: "hora" },
        { id: "requiere_o2", etiqueta: "Requiere O2 con máscara", tipo: "siNo" },
      ],
    },
    {
      id: "uti", titulo: "Ingreso a UTI",
      campos: [
        { id: "ingreso_uti", etiqueta: "Ingreso a UTI", tipo: "checks",
          opciones: ["Despierto", "R/ a orden verbal", "Somnoliento", "Dormido",
                     "Sedado", "Relajado para ARM"], incierto: true },
        { id: "via_aerea_uti", etiqueta: "Vía aérea", tipo: "checks",
          opciones: ["Extubado", "Con máscara", "Intubado"], incierto: true },
        { id: "ventilacion_uti", etiqueta: "Ventilación", tipo: "opciones",
          opciones: ["Espontánea", "Asistida", "Controlada"] },
        { id: "vc_uti", etiqueta: "Vol. Corriente (ml)", tipo: "numero", ancho: "chico" },
        { id: "fr_uti", etiqueta: "FR (/min)", tipo: "numero", ancho: "chico" },
        { id: "tas_uti", etiqueta: "TAS", tipo: "numero", ancho: "chico" },
        { id: "tad_uti", etiqueta: "TAD", tipo: "numero", ancho: "chico" },
        { id: "tam_uti", etiqueta: "TAM", tipo: "numero", ancho: "chico" },
        { id: "pvc_uti", etiqueta: "PVC", tipo: "numero", ancho: "chico", incierto: true },
        { id: "diuresis_uti", etiqueta: "Diuresis", tipo: "texto", ancho: "chico" },
        { id: "entrega_dr", etiqueta: "Entrega en UTI: Dr.", tipo: "texto" },
        { id: "entrega_hora", etiqueta: "a las (hs)", tipo: "hora" },
        { id: "recibe_dr", etiqueta: "Recibe en UTI: Dr.", tipo: "texto" },
      ],
    },
    {
      id: "firma", titulo: "Firma",
      campos: [
        { id: "aclaracion", etiqueta: "Aclaración", tipo: "texto", ancho: "grande" },
        { id: "mp_mn", etiqueta: "MP/MN", tipo: "texto", ancho: "chico" },
      ],
    },
  ],
};

// Score de Aldrete calculado con los campos del estado final + la TAS basal
// (primera TAS capturada). Devuelve 0–10, o null si falta algún componente.
window.calcularAldrete = function (datos, tasBasal) {
  const sup = datos.moviliza_msup, inf = datos.moviliza_minf;
  if (!sup || !inf) return null;
  const actividad = (sup === "Sí" ? 1 : 0) + (inf === "Sí" ? 1 : 0);
  if (!datos.depresion_respiratoria) return null;
  const respiracion = datos.depresion_respiratoria === "No" ? 2 : 1;
  const tas = parseFloat(datos.tas_final);
  if (!tasBasal || !isFinite(tas)) return null;
  const desvio = Math.abs(tas - tasBasal) / tasBasal;
  const circulacion = desvio <= 0.2 ? 2 : desvio <= 0.5 ? 1 : 0;
  let conciencia;
  if (datos.obedece_ordenes === "Sí") conciencia = 2;
  else if (datos.estimulos_dolorosos === "Sí") conciencia = 1;
  else if (datos.obedece_ordenes === "No" && datos.estimulos_dolorosos === "No") conciencia = 0;
  else return null;
  const sat = parseFloat(datos.sat_final);
  if (!isFinite(sat)) return null;
  const saturacion = sat >= 92 ? 2 : sat >= 90 ? 1 : 0;
  return actividad + respiracion + circulacion + conciencia + saturacion;
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
