export const radio_phrases = {
  safety_car: {
    colapinto: [
      '¡Auto de seguridad en pista! Cuidá el delta positivo y confirmame si venís a boxes.',
      'Auto de seguridad, {driver}. Mantené el delta positivo y estate atento a la estrategia de boxes.',
      'Tenemos auto de seguridad en pista. Delta positivo, no te pegues y preparate para box.',
    ],
    bono: [
      'Auto de seguridad en pista. Mantén delta positivo, confirma en boxes.',
      'Auto de seguridad en pista, {driver}. Mantén el delta en verde y prepárate.',
      'Auto de seguridad, {driver}. Delta positivo en todo momento, confirmamos parada.',
    ],
    standard: [
      'Auto de seguridad en pista. Mantén delta positivo y confirma si entras a boxes.',
      'Auto de seguridad en pista. Mantén delta en positivo, atentos a la ventana de parada.',
      'Auto de seguridad en pista, {driver}. Mantén delta positivo y prepárate para posible parada.',
    ],
  },
  vsc: {
    colapinto: [
      'Auto de seguridad virtual, VSC en pista. Mantené el delta positivo, sin sobrepasos.',
      'VSC en pista, {driver}. Cuidá el delta y no te distraigas.',
      'Tenemos auto de seguridad virtual. Delta positivo en todos los sectores, prohibido adelantar.',
    ],
    bono: [
      'Auto de seguridad virtual en pista. Mantén delta positivo, sin adelantamientos.',
      'VSC en pista, {driver}. Mantén delta positivo y prepárate.',
    ],
    standard: [
      'Auto de seguridad virtual en pista. Mantén delta positivo, prohibido adelantar.',
      'VSC en pista. Mantén delta positivo en todo el circuito.',
    ],
  },
  red_flag: {
    colapinto: [
      '¡Bandera roja, bandera roja! Sesión parada, venite despacio para el pit lane.',
      'Bandera roja, {driver}. Sesión detenida, aflojá el ritmo y entrá a boxes.',
    ],
    bono: [
      'Bandera roja, bandera roja. Sesión detenida, entra al pit lane despacio.',
      'Bandera roja, {driver}. Reduce velocidad y regresa a boxes con cuidado.',
    ],
    standard: [
      'Bandera roja, bandera roja. Sesión detenida, entra al pit lane despacio.',
      'Bandera roja en pista. Reduce el ritmo y regresa al pit lane.',
    ],
  },
  tyre_puncture: {
    colapinto: [
      '¡Pinchazo, pinchazo! Box esta vuelta, {driver}, entrá despacito.',
      '¡Tenemos pinchazo! Venite a boxes ya mismo, cuidá el auto.',
    ],
    bono: [
      '¡Pinchazo en el neumático! Box esta vuelta, {driver}, entra con cuidado.',
      'Pinchazo detectado. Box esta vuelta, box box box.',
    ],
    standard: [
      '¡Pinchazo en el neumático! Box esta vuelta, entra con cuidado.',
      'Pinchazo crítico detectado, {driver}. Entra a boxes inmediatamente.',
    ],
  },
  tyre_wear: {
    colapinto: [
      'Desgaste alto en las gomas, {driver}. Cuidá la tracción en salida de curva.',
      'Las gomas están sufriendo, {driver}. Gestioná el ritmo y no patines.',
    ],
    bono: [
      'Desgaste elevado en los neumáticos. Gestiona el ritmo y cuida las gomas.',
      'Desgaste crítico en los neumáticos, {driver}. Modo gestión activado.',
    ],
    standard: [
      'Desgaste elevado en los neumáticos. Gestiona el ritmo y cuida las gomas.',
      'Degradación alta de neumáticos, {driver}. Prioriza tracción y cuida la goma.',
    ],
  },
  tyre_overheat: {
    colapinto: [
      'Gomas muy calientes, {driver}. No deslices el auto para bajar la temperatura de superficie.',
      'Ojo con la temperatura en los neumáticos. Aflojá un toque el deslizamiento.',
    ],
    bono: [
      'Temperatura de neumáticos muy alta. Reduce el deslizamiento para enfriar la superficie.',
      'Sobrecalentamiento en las gomas, {driver}. Modera las cargas laterales.',
    ],
    standard: [
      'Temperatura de neumáticos muy alta. Reduce el deslizamiento para enfriar la superficie.',
      'Neumáticos sobrecalentados, {driver}. Gestiona la entrada en curva.',
    ],
  },
  tyre_cold: {
    colapinto: [
      'Gomas frías, {driver}. Hacé zig-zag para meterle temperatura a la carcasa antes de relanzar.',
    ],
    bono: [
      'Neumáticos fríos. Haz zig-zag para meter temperatura en la carcasa.',
    ],
    standard: [
      'Neumáticos fríos. Haz zig-zag para meter temperatura en la carcasa.',
      'Gomas frías, {driver}. Calienta los neumáticos antes de la bandera verde.',
    ],
  },
  wing_damage: {
    colapinto: [
      'Daño en el alerón delantero, {driver}. Perdimos carga aerodinámica, preparate para cambiar trompa.',
      'Tocamos el alerón delantero. Hay pérdida de carga en curva rápida.',
    ],
    bono: [
      'Daño en el alerón delantero. Pérdida de carga aerodinámica, entra a boxes a cambiar morro.',
      'Daño frontal detectado, {driver}. Espera subviraje en curva media y rápida.',
    ],
    standard: [
      'Daño en el alerón delantero. Pérdida de carga aerodinámica, entra a boxes a cambiar morro.',
      'Daño en el alerón delantero detectado, {driver}. Posible parada para cambio de alerón.',
    ],
  },
  floor_damage: {
    colapinto: [
      'Daño en el piso, {driver}. Perdimos bastante carga aerodinámica, ojo en curvas rápidas.',
    ],
    bono: [
      'Daño en el fondo plano. Hemos perdido carga aerodinámica.',
    ],
    standard: [
      'Daño en el fondo plano. Hemos perdido carga aerodinámica.',
      'Daño en el suelo y difusor, {driver}. Pérdida de agarre general.',
    ],
  },
  engine_wear: {
    colapinto: [
      'Desgaste alto en componentes del motor, {driver}. Pasá marchas antes para cuidar la unidad.',
    ],
    bono: [
      'Desgaste elevado en componentes de motor. Gestiona las temperaturas y sube marcha antes.',
    ],
    standard: [
      'Desgaste elevado en componentes de motor. Gestiona las temperaturas y sube marcha antes.',
      'Desgaste mecánico elevado en el motor, {driver}. Evita sobre-revolucionar.',
    ],
  },
  mechanical_fault: {
    colapinto: [
      'Fallo mecánico en los sistemas del auto, {driver}. Revisá los comandos en el volante.',
    ],
    bono: [
      'Fallo mecánico en los sistemas del monoplaza. Revisa los controles en el volante.',
    ],
    standard: [
      'Fallo mecánico en los sistemas del monoplaza. Revisa los controles en el volante.',
      'Alerta de fallo mecánico, {driver}. Comprueba el selector de volante.',
    ],
  },
  ers_low: {
    colapinto: [
      'Batería baja, {driver}. Hacé un poco de Lift and Coast en frenadas para recargar el ERS.',
      'Estamos secos de batería. Cuidá la energía en las rectas.',
    ],
    bono: [
      'Batería baja. Haz un poco de Lift and Coast para recargar el ERS.',
      'Nivel de ERS bajo, {driver}. Necesitamos recargar en frenada.',
    ],
    standard: [
      'Batería baja. Haz un poco de Lift and Coast para recargar el ERS.',
      'Reserva de batería baja, {driver}. Aplica Lift and Coast para regenerar energía.',
    ],
  },
  radiator_overheat: {
    colapinto: [
      'El motor está levantando temperatura, {driver}. Estamos perdiendo potencia por calor, meté Lift and Coast y salí del aire sucio.',
      'Temperatura de motor crítica. Cuidá la planta impulsora con Lift & Coast para evitar mayor pérdida de potencia.',
    ],
    bono: [
      'Temperatura de motor elevada, sufriendo pérdida de potencia térmica. Sal del rebufo e introduce Lift & Coast.',
      'Alerta de motor caliente, {driver}. Aplica Lift & Coast en frenadas para refrigerar los radiadores.',
    ],
    standard: [
      'Temperatura de motor elevada con pérdida de potencia. Introduce Lift & Coast y busca aire limpio.',
      'Temperaturas de motor críticas, {driver}. Busca aire limpio en las rectas y aplica Lift & Coast.',
    ],
  },
  brake_overheat: {
    colapinto: [
      'Frenos al rojo vivo, {driver}. Tirale el reparto un toque para atrás y cuidá la entrada.',
    ],
    bono: [
      'Frenos sobrecalentados. Mueve el reparto de frenada hacia atrás.',
    ],
    standard: [
      'Frenos sobrecalentados. Mueve el reparto de frenada hacia atrás.',
      'Temperatura de frenos crítica, {driver}. Ajusta el reparto de frenada.',
    ],
  },
  brake_cold: {
    colapinto: [
      'Frenos fríos, {driver}. Meteles temperatura antes de relanzar.',
    ],
    bono: [
      'Frenos fríos. Calienta los discos antes de la relanzada.',
    ],
    standard: [
      'Frenos fríos. Calienta los discos antes de la relanzada.',
      'Discos de freno fríos, {driver}. Realiza frenadas de calentamiento.',
    ],
  },
  fuel_deficit: {
    colapinto: [
      'Estamos en déficit de combustible, {driver}. Necesitamos Lift and Coast en la frenada más fuerte.',
      'Consumo alto. Levantá unos 50 metros antes de frenar para recuperar target.',
    ],
    bono: [
      'Estamos en déficit de combustible. Necesitamos Lift and Coast en frenada.',
      'Objetivo de combustible en negativo, {driver}. Aplica Lift and Coast.',
    ],
    standard: [
      'Estamos en déficit de combustible. Necesitamos Lift and Coast en frenada.',
      'Déficit de combustible detectado, {driver}. Aplica Lift and Coast para llegar al final.',
    ],
  },
  undercut_window: {
    colapinto: [
      '¡Ventana de undercut abierta, {driver}! Dale con todo en esta vuelta de entrada.',
    ],
    bono: [
      'Ventana de undercut abierta. Empuja al máximo en esta vuelta de entrada.',
    ],
    standard: [
      'Ventana de undercut abierta. Empuja al máximo en esta vuelta de entrada.',
      'Oportunidad de undercut activa, {driver}. Vuelta rápida de entrada.',
    ],
  },
  pit_window_open: {
    colapinto: [
      'Ventana de pits abierta, {driver}. Confirmame si paramos esta vuelta.',
    ],
    bono: [
      'Ventana de parada abierta. Confirma si entramos a boxes esta vuelta.',
    ],
    standard: [
      'Ventana de parada abierta. Confirma si entramos a boxes esta vuelta.',
      'Ventana de boxes abierta, {driver}. Prepárate para llamada de parada.',
    ],
  },
  rival_defend: {
    colapinto: [
      'Auto de atrás con DRS a menos de un segundo, {driver}. Cuidale la cuerda en la recta.',
    ],
    bono: [
      'Rival a menos de un segundo con DRS. Defiende el interior en la recta.',
    ],
    standard: [
      'Rival a menos de un segundo con DRS. Defiende el interior en la recta.',
      'Presión de rival detrás en zona de DRS, {driver}. Defiende la posición.',
    ],
  },
  rival_attack: {
    colapinto: [
      'Estamos en zona de DRS, {driver}. Mandale modo ataque y buscalo en la recta.',
    ],
    bono: [
      'Estamos a distancia de DRS. Usa el modo ataque en la recta.',
    ],
    standard: [
      'Estamos a distancia de DRS. Usa el modo ataque en la recta.',
      'Oportunidad de ataque con DRS, {driver}. Usa el modo adelantamiento.',
    ],
  },
  qualy_traffic: {
    colapinto: [
      'Hay tráfico adelante para lanzar, {driver}. Abrí un hueco de cuatro segundos en el último sector.',
    ],
    bono: [
      'Tráfico por delante. Abre un hueco de cuatro segundos antes de lanzar la vuelta.',
    ],
    standard: [
      'Tráfico por delante. Abre un hueco de cuatro segundos antes de lanzar la vuelta.',
      'Tráfico en vuelta de salida, {driver}. Deja caer el ritmo para ganar aire limpio.',
    ],
  },
  qualy_clean_air: {
    colapinto: [
      'Pista libre adelante, {driver}. Calentá bien las delanteras y dale gas al salir de la última curva.',
    ],
    bono: [
      'Pista despejada por delante. Prepara los neumáticos y lanza la vuelta.',
    ],
    standard: [
      'Pista despejada por delante. Prepara los neumáticos y lanza la vuelta.',
      'Aire limpio por delante, {driver}. Prepara las gomas y abre la vuelta rápida.',
    ],
  },
  qualy_deleted_lap: {
    colapinto: [
      'Vuelta anulada por límites de pista, {driver}. Recargá el ERS y reseteá para el próximo intento.',
    ],
    bono: [
      'Vuelta anulada por límites de pista. Recarga batería y prepárate para el siguiente intento.',
    ],
    standard: [
      'Vuelta anulada por límites de pista. Recarga batería y prepárate para el siguiente intento.',
      'Tiempo de vuelta eliminado por límites de pista, {driver}. Recarga ERS y prepara otro intento.',
    ],
  },
  qualy_session_time: {
    colapinto: [
      'Quedan menos de 3 minutos de sesión, {driver}. Salí ahora para llegar a la bandera a cuadros.',
    ],
    bono: [
      'Menos de 3 minutos de sesión. Sal a pista ahora para el último intento.',
    ],
    standard: [
      'Menos de 3 minutos de sesión. Sal a pista ahora para el último intento.',
      'Tiempo de sesión crítico, {driver}. Sal de boxes ya para cruzar antes de la bandera a cuadros.',
    ],
  },
  qualy_elimination_danger: {
    colapinto: [
      'Estamos en zona de eliminación, {driver}. Necesitamos una vuelta perfecta para pasar el corte.',
    ],
    bono: [
      'Estamos en zona de eliminación. Necesitamos una vuelta limpia al límite.',
    ],
    standard: [
      'Estamos en zona de eliminación. Necesitamos una vuelta limpia al límite.',
      'Zona de peligro de eliminación, {driver}. Necesitamos mejorar el tiempo.',
    ],
  },
  track_limits_warnings: {
    colapinto: [
      'Llegamos a 3 advertencias de límites de pista, {driver}. Una más y nos clavan 3 segundos.',
    ],
    bono: [
      'Tres advertencias de límites de pista. Mantén las cuatro ruedas dentro de las líneas blancas.',
    ],
    standard: [
      'Tres advertencias de límites de pista. Una más y tendremos penalización.',
      'Última advertencia de límites de pista, {driver}. Mantén el coche dentro de la línea blanca.',
    ],
  },
  penalties_incurred: {
    colapinto: [
      'Penalización confirmada por los comisarios, {driver}. La cumpliremos en la próxima parada.',
    ],
    bono: [
      'Penalización confirmada por los comisarios. La cumpliremos en la próxima parada.',
    ],
    standard: [
      'Penalización confirmada por los comisarios. La cumpliremos en la próxima parada.',
      'Sanción impuesta por los comisarios, {driver}. La serviremos en boxes.',
    ],
  },
  weather_rain: {
    colapinto: [
      'El radar confirma lluvia inminente, {driver}. Atento al cambio de agarre en pista.',
      'Se viene la lluvia en cualquier momento. Atento al crossover de gomas.',
    ],
    bono: [
      'El radar confirma lluvia inminente. Atento al cambio de adherencia en pista.',
      'Lluvia confirmada en el radar, {driver}. Prepárate para el cambio de condiciones.',
    ],
    standard: [
      'El radar confirma lluvia inminente. Atento al cambio de adherencia en pista.',
      'Radar meteorológico confirma lluvia en los próximos minutos, {driver}.',
    ],
  },
  sector_delta: {
    colapinto: [
      'Se nos fue tiempo en el sector, {driver}. Meté foco en el radio de giro y salí prolijo con la tracción.',
      'Perdimos unas décimas en el parcial, {driver}. Redondeá la curva y dale gas progresivo.',
    ],
    bono: [
      'Tiempo perdido en este sector, {driver}. Prioriza la velocidad de vértice y la salida de curva.',
      'Pérdida de delta en el sector. Suaviza la dirección y cuida la tracción en aceleración.',
    ],
    standard: [
      'Tiempo cedido en este sector. Prioriza velocidad de vértice y tracción.',
      'Pérdida de tiempo en el sector, {driver}. Enfócate en la salida de curva.',
    ],
  },
  teammate_ahead: {
    colapinto: [
      'Tenemos al compañero adelante, {driver}. Venís con mejor ritmo, podés pasarlo pero limpito sin toques.',
      'Compañero de equipo adelante, {driver}. Dale para adelante con cuidado.',
    ],
    bono: [
      'Compañero de equipo por delante, {driver}. El delta de ritmo es favorable, vía libre para competir con limpieza.',
      'Compañero adelante en posición de pelea. Mantén la maniobra limpia.',
    ],
    standard: [
      'Compañero de equipo por delante. Ritmo favorable, libre para competir de manera limpia.',
      'Compañero de equipo adelante en pista, {driver}. Maniobra limpia.',
    ],
  },
  teammate_pitting: {
    colapinto: [
      'Tu compañero entra a boxes en esta vuelta, {driver}. Meté una vuelta limpia con aire limpio.',
      'Compañero parando en boxes, {driver}. Dale con todo.',
    ],
    bono: [
      'Tu compañero de equipo entra a boxes ahora. Concéntrate en tu vuelta de entrada.',
      'Compañero en boxes, {driver}. Pista libre para tu stint.',
    ],
    standard: [
      'Compañero de equipo en boxes. Concéntrate en tu vuelta.',
      'Tu compañero entra a boxes ahora, {driver}. Maximiza el ritmo.',
    ],
  },
  pit_clean_air: {
    colapinto: [
      'Si paramos ahora salimos con aire limpio, {driver}. Gran oportunidad de undercut.',
      'Aire limpio garantizado en la salida de boxes, {driver}. Atento a la orden de box.',
    ],
    bono: [
      'La ventana de parada ofrece aire limpio al reingreso. Momento óptimo para undercut o extensión.',
      'Ventana de parada abierta con aire limpio garantizado, {driver}.',
    ],
    standard: [
      'Ventana de boxes con aire limpio disponible. Oportunidad óptima de estrategia.',
      'Reingreso con aire limpio disponible en boxes, {driver}.',
    ],
  },
  ers_fault: {
    colapinto: [
      'Falla en el sistema ERS, {driver}. Nos quedamos sin la potencia híbrida, bancame que revisamos el reinicio.',
      'Se cayó el despliegue del ERS, {driver}. Manejá en modo térmico por ahora.',
    ],
    bono: [
      'Fallo en el despliegue del ERS detectado. Potencia eléctrica desactivada, espera protocolo de reinicio.',
      'Falla en el sistema híbrido, {driver}. Despliegue eléctrico fuera de servicio.',
    ],
    standard: [
      'Fallo en el despliegue del ERS. Potencia eléctrica fuera de línea, espera protocolo de reinicio.',
      'Falla de potencia eléctrica ERS, {driver}. Atento a instrucciones en volante.',
    ],
  },
  aero_fault: {
    colapinto: [
      'Falla en el sistema de alerón activo, {driver}. El modo de rectas no responde.',
      'Problema con el alerón móvil, {driver}. El sistema aerodinámico no responde.',
    ],
    bono: [
      'Fallo en el sistema aerodinámico activo. El modo de rectas no está disponible.',
      'Falla en el alerón móvil, {driver}. Ajuste aerodinámico bloqueado.',
    ],
    standard: [
      'Fallo en el sistema aerodinámico activo. Ajuste de alerón no disponible.',
      'Falla en mecanismo de alerón móvil, {driver}. Modo de rectas fuera de servicio.',
    ],
  },
  rival_defend_override: {
    colapinto: [
      'Auto de atrás con amenaza de Override y Boost a menos de un segundo, {driver}. Cuidale la cuerda.',
    ],
    bono: [
      'Rival a menos de un segundo con amenaza de Modo Override. Defiende el interior en recta.',
    ],
    standard: [
      'Rival a menos de un segundo con amenaza de Modo Override. Defiende el interior.',
      'Presión de rival detrás con Modo Override / Boost, {driver}. Cuida la posición.',
    ],
  },
  rival_attack_override: {
    colapinto: [
      'Estamos a tiro del de adelante, {driver}. Mandale Straight Mode y activa el Boost para buscarlo.',
    ],
    bono: [
      'Estamos a tiro del monoplaza adelante. Activa Straight Mode y prepara el Modo Override.',
    ],
    standard: [
      'Estamos a tiro del auto de adelante. Activa Straight Mode y despliega el Boost.',
      'Oportunidad de sobrepaso, {driver}. Usa Straight Mode y Modo Override.',
    ],
  },
  race_finish: {
    colapinto: [
      '¡Bandera a cuadros! Tremenda carrera metiste, {driver}. Poné mapa de enfriamiento, levantá goma fuera de la huella y traelo despacio a parque cerrado.',
    ],
    bono: [
      'Bandera a cuadros. Excelente trabajo hoy, bien conducido. Pasa a modo de enfriamiento y trae el coche a parque cerrado.',
    ],
    standard: [
      'Bandera a cuadros. Gran carrera completada. Cambia a modo de enfriamiento y dirígete a parque cerrado.',
      '¡Carrera finalizada, {driver}! Recoge goma y trae el monoplaza a parque cerrado.',
    ],
  },
  inlap_traffic_behind: {
    colapinto: [
      'Ojo que viene uno lanzado atrás en vuelta rápida, {driver}. Dale paso limpio y no molestes.',
    ],
    bono: [
      'Atención: monoplaza rápido aproximándose en vuelta lanzada por detrás. Deja espacio limpio.',
    ],
    standard: [
      'Tráfico: auto rápido en vuelta lanzada acercándose por detrás. Cede el paso de forma segura.',
      'Monoplaza lanzado detrás, {driver}. Mantén la línea limpia.',
    ],
  },
  inlap_cooldown: {
    colapinto: [
      'Vuelta terminada, a boxes ahora, {driver}. Recargá la batería, refrigerá frenos y gomas y traelo tranqui.',
    ],
    bono: [
      'Vuelta completada, entramos a boxes en esta vuelta. Recarga batería y enfría frenos.',
    ],
    standard: [
      'Vuelta rápida finalizada, entra a boxes esta vuelta. Modos de enfriamiento activos.',
      'Vuelta completa, a boxes, {driver}. Refrigera frenos y recarga el ERS.',
    ],
  },
  flags_rain_live: {
    colapinto: [
      '¡Ojo {driver}, empezó a llover en la pista! Cuidado con las frenadas que perdimos grip.',
    ],
    bono: [
      'Lluvia cayendo sobre el trazado ahora, {driver}. Mucho cuidado en zonas de frenada.',
    ],
    standard: [
      '¡Lluvia cayendo en pista! Atención al agarre en las zonas de frenada.',
      'Comenzó a llover en el circuito, {driver}. Ajusta referencias de frenado.',
    ],
  },
  tyre_crossover: {
    colapinto: [
      '¡Llegamos a la ventana de cruce de neumáticos, {driver}! A boxes en esta vuelta, ¡a boxes ya!',
    ],
    bono: [
      'Condiciones en ventana de cruce, {driver}. Entra a boxes esta vuelta para cambio de compuesto.',
    ],
    standard: [
      '¡Ventana de cruce alcanzada! Entra a boxes esta vuelta para cambio de neumáticos.',
      'Ventana de cruce abierta, {driver}. Box en esta vuelta, box box.',
    ],
  },
  directive: {
    standard: ['{clean_text}'],
  },
};
