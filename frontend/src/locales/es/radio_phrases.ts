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
      'Tenemos auto de seguridad virtual. Delta positivo en todos los sectores, sin sobrepasos.',
    ],
    bono: [
      'Auto de seguridad virtual en pista. Mantén delta positivo, sin adelantamientos.',
      'VSC en pista, {driver}. Mantén delta positivo y prepárate.',
    ],
    standard: [
      'Auto de seguridad virtual en pista. Mantén delta positivo, sin sobrepasos.',
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
      '¡Pinchadura, pinchadura! Box esta vuelta, {driver}, entrá despacito.',
      '¡Tenemos pinchadura! Venite a boxes ya mismo, cuidá el auto.',
    ],
    bono: [
      '¡Pinchadura en el neumático! Box esta vuelta, {driver}, entra con cuidado.',
      'Pinchadura detectada. Box esta vuelta, box box box.',
    ],
    standard: [
      '¡Pinchadura en el neumático! Box esta vuelta, entra con cuidado.',
      'Pinchadura crítica detectada, {driver}. Entra a boxes inmediatamente.',
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
      'Daño en el alerón delantero. Pérdida de carga aerodinámica, entra a boxes a cambiar la trompa.',
      'Daño frontal detectado, {driver}. Espera subviraje en curva media y rápida.',
    ],
    standard: [
      'Daño en el alerón delantero. Pérdida de carga aerodinámica, entra a boxes a cambiar el alerón.',
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
  terminal_engine: {
    colapinto: [
      '¡Pará el auto, pará el auto, {driver}! Falla terminal del motor, tirate a zona segura y apagá el auto ya.',
      '¡Falla terminal en el motor! Tirate afuera de la trazada y cortá el motor inmediatamente.',
    ],
    bono: [
      'Para el monoplaza, {driver}. Falla terminal del motor, busca una escapatoria segura y apaga la unidad de potencia.',
      'Falla terminal del motor. Detén el auto en una zona segura y apágalo de inmediato.',
    ],
    standard: [
      'Falla terminal del motor. Detén el monoplaza en zona segura y apaga la unidad de potencia.',
      'Avería crítica de motor, {driver}. Apaga el monoplaza de inmediato en una zona segura.',
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
  brake_bias: {
    colapinto: [
      'Desbalance térmico en frenos, {driver}. Movete 1 o 2 puntos el reparto de frenada para emparejar los ejes.',
      'Reparto de frenos descompensado, {driver}. Corregí el balance para cuidar las temperaturas.',
    ],
    bono: [
      'Desbalance de temperatura en frenos, {driver}. Ajusta el reparto de frenada un 1 o 2 por ciento.',
      'Diferencia térmica en los frenos. Ajusta el reparto de frenada para compensar.',
    ],
    standard: [
      'Desbalance térmico de frenos detectado. Ajusta el reparto de frenada en 1-2% para equilibrar los ejes.',
      'Diferencia térmica entre ejes de frenos, {driver}. Modifica el balance de frenos.',
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
  pit_window_close: {
    colapinto: [
      '¡A boxes en esta vuelta, box box! Se nos cierra la ventana, {driver}, entramos ya para no liquidar las gomas.',
      'Ventana de parada cerrando en esta vuelta, {driver}. ¡Box box ahora!',
    ],
    bono: [
      'Box en esta vuelta, box box. La ventana de parada se cierra ahora, {driver}.',
      'Ventana de pits cerrando. Entramos a boxes en esta vuelta para proteger el neumático.',
    ],
    standard: [
      'Box en esta vuelta, box box. Se cierra la ventana de parada.',
      'Ventana de parada cerrándose ahora, {driver}. Entra a boxes para mantener el delta de gomas.',
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
      'Última advertencia de límites de pista, {driver}. Mantén el auto dentro de la línea blanca.',
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
  teammate_doublestack: {
    colapinto: [
      '¡Ojo que tu compañero está en el box, {driver}! Doble parada en boxes, bancá la posición en la suelta.',
      '¡Compañero en boxes! Preparate para doble parada, aguantá la marca.',
    ],
    bono: [
      'Tu compañero está en boxes, {driver}. Preparado para doble parada, espera una breve retención.',
      'Doble parada en boxes. Tu compañero está en el cajón, prepárate para esperar.',
    ],
    standard: [
      'Tu compañero de equipo está en boxes. Doble parada, espera una breve retención.',
      'Alerta de doble parada, {driver}. Compañero en el cajón de boxes, prepárate para esperar.',
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
      'Bandera a cuadros. Excelente trabajo hoy, bien conducido. Pasa a modo de enfriamiento y trae el auto a parque cerrado.',
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
  flags_sc_in: {
    colapinto: [
      '¡Auto de seguridad a boxes en esta vuelta! Calentá gomas delanteras y preparate para el relanzamiento.',
      'Auto de seguridad se guarda en esta vuelta, {driver}. Mantené el delta y prendé los frenos para relanzar.',
    ],
    bono: [
      'Auto de seguridad a boxes en esta vuelta. Mantén delta positivo y calienta neumáticos para el reinicio.',
      'Auto de seguridad entra en esta vuelta, {driver}. Prepárate para bandera verde.',
    ],
    standard: [
      'Auto de seguridad a boxes en esta vuelta. Mantén delta positivo, calienta neumáticos y prepara el relanzamiento.',
      'Auto de seguridad se retira en esta vuelta. Preparados para bandera verde.',
    ],
  },
  flags_green: {
    colapinto: [
      '¡Bandera verde, bandera verde! Carrera relanzada, dale a fondo.',
      '¡Pista libre, bandera verde {driver}! Acelerá todo.',
    ],
    bono: [
      'Bandera verde, bandera verde. Pista libre, a empujar.',
      'Bandera verde, {driver}. Carrera reiniciada, tiempo de ataque.',
    ],
    standard: [
      'Bandera verde, bandera verde. Carrera relanzada, a fondo.',
      'Pista libre, bandera verde. Se reanuda la carrera.',
    ],
  },
  flags_blue: {
    colapinto: [
      '¡Banderas azules, banderas azules {driver}! Viene el puntero atrás, dale paso limpio en la próxima curva.',
      'Banderas azules, {driver}. Dejá pasar al auto de atrás para no comerte sanción.',
    ],
    bono: [
      'Banderas azules, {driver}. Viene el líder detrás, cede la posición limpiamente.',
      'Banderas azules. Deja pasar al líder en la siguiente recta.',
    ],
    standard: [
      'Banderas azules, {driver}. Viene el líder detrás, cede la posición de forma limpia.',
      'Banderas azules. Permite el paso al puntero que viene a doblar.',
    ],
  },
  flags_yellow: {
    colapinto: [
      '¡Bandera amarilla en este sector! Hay un auto parado o incidente adelante, prohibido pasar.',
      'Bandera amarilla, {driver}. Cuidado con posibles restos en pista y levantá si hace falta.',
    ],
    bono: [
      'Bandera amarilla en este sector. Incidente adelante, sin sobrepasos y prepárate para levantar.',
      'Bandera amarilla, {driver}. Precaución en esta zona.',
    ],
    standard: [
      'Bandera amarilla en este sector. Incidente adelante, sin sobrepasos y mantén la precaución.',
      'Bandera amarilla en pista. Reduce la velocidad si es necesario.',
    ],
  },
  wrong_way: {
    colapinto: [
      '¡Estás yendo al revés, {driver}! ¡Sentido contrario, da la vuelta o frená ya!',
      '¡Alerta, vas en sentido contrario! Frená o pegá la vuelta inmediatamente.',
    ],
    bono: [
      '¡Dirección incorrecta, {driver}! Conduces en sentido contrario, detén el auto o gira de inmediato.',
      'Alerta de sentido contrario. Da la vuelta o detén el monoplaza con seguridad.',
    ],
    standard: [
      '¡Alerta! Conduces en sentido contrario a la pista. Detén el monoplaza o cambia de sentido de inmediato.',
      'Aviso de sentido contrario. Cambia de dirección o detén el vehículo con seguridad.',
    ],
  },
  flags_drs_enabled: {
    colapinto: [
      '¡DRS habilitado, {driver}! Ya tenés DRS, dale gas en la recta.',
      '¡DRS activo! Aprovechalo si estás a tiro de DRS.',
    ],
    bono: [
      'DRS habilitado, {driver}. El DRS ya está activo.',
      'DRS disponible, puedes activarlo en las zonas habilitadas.',
    ],
    standard: [
      'DRS habilitado, DRS ahora activo.',
      'Dirección de carrera ha habilitado el DRS.',
    ],
  },
  flags_drs_disabled: {
    colapinto: [
      '¡DRS deshabilitado, {driver}! Sin DRS por ahora, mantenete cerca.',
      'Desactivaron el DRS, seguimos sin asistencia en las rectas.',
    ],
    bono: [
      'DRS deshabilitado, {driver}. Dirección de carrera desactivó el DRS.',
      'DRS deshabilitado en todo el circuito.',
    ],
    standard: [
      'DRS deshabilitado por dirección de carrera.',
      'El DRS se encuentra desactivado.',
    ],
  },
  race_fastest_lap: {
    colapinto: [
      '¡Vuelta rápida, {driver}! ¡Púrpura en todos los sectores, tremendo ritmo!',
      '¡Récord de vuelta! Volaste en los tres parciales, hermoso giro.',
    ],
    bono: [
      'Vuelta rápida de la sesión, {driver}. Sectores en púrpura, impecable.',
      'Esa es la vuelta más rápida de la carrera, gran trabajo.',
    ],
    standard: [
      'Vuelta más rápida de la sesión. Excelente ritmo.',
      'Nuevo récord de vuelta registrado.',
    ],
  },
  car_collision: {
    colapinto: [
      '¡Hubo toque, {driver}! Avisame si sentís vibración en la dirección o en el alerón delantero.',
      '¡Cuidado con el toque! Decime si el auto tira para algún lado o sentís daño.',
    ],
    bono: [
      'Contacto reportado, {driver}. Revisa el tacto de la dirección y el alerón delantero.',
      'Vimos un toque, confirma comportamiento del tren delantero.',
    ],
    standard: [
      '¡Contacto reportado! Revisa dirección y balance del alerón delantero.',
      'Colisión detectada. Monitorea el comportamiento del monoplaza.',
    ],
  },
  car_retirement: {
    colapinto: [
      'Hay un auto que abandonó, {driver}. Ojo con posibles pedazos en la pista.',
      'Abandono adelante, levantá un poco si ves polvo o banderas.',
    ],
    bono: [
      'Abandono reportado en pista, {driver}. Precaución con posibles restos o bandera amarilla.',
      'Retiro confirmado. Mantén la concentración en esa zona.',
    ],
    standard: [
      'Abandono en pista. Atención a posibles banderas amarillas o restos.',
      'Vehículo retirado. Precaución en pista.',
    ],
  },
  formation_lap_start: {
    colapinto: [
      '¡Vuelta previa, {driver}! Calentá bien las gomas zigzagueando y dale temperatura a los frenos.',
      'Vuelta de formación en marcha. Cuidá la temperatura de gomas y frenos para largar con todo.',
    ],
    bono: [
      'Vuelta de formación, {driver}. Zigzaguea para calentar neumáticos y frenos delanteros.',
      'Inicia la vuelta de formación. Carga temperatura en la carcasa de las gomas.',
    ],
    standard: [
      'Vuelta de formación. Zigzaguea para poner temperatura en neumáticos y frenos delanteros.',
      'Comienza la vuelta previa. Construye temperatura en neumáticos y frenos.',
    ],
  },
  grid_approach: {
    colapinto: [
      'Llegando a la grilla, {driver}. Clavalo bien en el cajón y buscá el punto del embrague.',
      'Atento a la grilla. Alineá el auto en el cajón y prepará la largada.',
    ],
    bono: [
      'Aproximación a parrilla, {driver}. Cuadra el monoplaza y busca el punto de embrague.',
      'Llegando al cajón de salida. Alinea el auto y prepara la arrancada.',
    ],
    standard: [
      'Acercándote a la grilla. Alinea con cuidado en tu cajón y busca el punto de mordida del embrague.',
      'Alineación en parrilla. Posiciona el monoplaza y prepara el procedimiento de largada.',
    ],
  },
  start_reaction_time: {
    colapinto: [
      '¡Buena largada, {driver}! Reaccionaste rápido, ahora cuidá la cuerda en la primera curva.',
      '¡Excelente reacción en los semáforos! Mantenete firme en la curva 1.',
    ],
    bono: [
      'Buena reacción en la salida, {driver}. Concéntrate en la trazada de la curva 1.',
      'Procedimiento de arrancada correcto. Ahora consolida posición.',
    ],
    standard: [
      'Buena respuesta en la largada. Mantén la posición en las primeras curvas.',
      'Salida completada. Enfócate en el ritmo de carrera.',
    ],
  },
  pit_serve_penalty: {
    colapinto: [
      '¡Acordate que pagamos sanción en boxes! El auto tiene que estar quieto antes de cambiar gomas.',
      '¡Atento a la penalización! Ni bien pares, los mecánicos no tocan el auto hasta cumplir los segundos.',
    ],
    bono: [
      'Recuerda que cumplimos la penalización primero, {driver}. Auto parado antes del cambio de gomas.',
      'Parada con penalización. El monoplaza debe permanecer detenido antes de la intervención.',
    ],
    standard: [
      'Cumplir penalización antes del cambio de neumáticos. Monoplaza detenido hasta finalizar sanción.',
      'Parada con penalización. Respeta el tiempo detenido antes de la asistencia mecánica.',
    ],
  },
  pit_stop_duration: {
    colapinto: [
      '¡Buena parada de los pibes! Gomas puestas, salí a fondo en la vuelta de salida.',
      '¡Impecable el pit stop! A fondo ahora, dale calor a las gomas en la vuelta de salida.',
    ],
    bono: [
      'Buena parada, {driver}. Cambio limpio, empuja fuerte en la vuelta de salida.',
      'Parada completada. Neumáticos montados, a tope en la out-lap.',
    ],
    standard: [
      'Parada en boxes completada. Empuja ahora en la vuelta de salida.',
      'Servicio completado. Maximiza el ritmo en la vuelta de salida.',
    ],
  },
  pit_limiter_exit: {
    colapinto: [
      '¡Limitador afuera, {driver}! Pista limpia, ¡a fondo!',
      '¡Fuera limitador! Cuidá la línea blanca de salida y acelerá todo.',
    ],
    bono: [
      'Limitador fuera, {driver}. Pista libre, a empujar.',
      'Limitador desactivado. Cuidado con la línea blanca y a fondo.',
    ],
    standard: [
      'Limitador de boxes desactivado. Respeta la línea blanca de salida y empuja ahora.',
      'Pista libre en salida de boxes. Limitador fuera, ritmo de carrera.',
    ],
  },
  tyre_crossover_wet: {
    colapinto: [
      '¡Hay demasiada agua en pista, riesgo de aquaplaning! ¡A boxes esta vuelta, {driver}, necesitamos gomas de lluvia extrema!',
      '¡El agua estancada es tremenda para intermedios! ¡A boxes ahora, boxes boxes, ponemos gomas de lluvia!',
    ],
    bono: [
      'La pista está saturada, demasiado agua para intermedias, {driver}. Boxes en esta vuelta para neumáticos de lluvia extrema.',
      'Riesgo crítico de aquaplaning. Boxes esta vuelta, boxes boxes para neumático de lluvia.',
    ],
    standard: [
      'Pista saturada con agua estancada, riesgo inminente de aquaplaning. Entra a boxes esta vuelta por neumáticos de lluvia extrema.',
      'Transición a lluvia extrema confirmada. Boxes esta vuelta para montar neumáticos de lluvia.',
    ],
  },
  tyre_crossover_inter: {
    colapinto: [
      '¡La lluvia aflojó y el agua está drenando! ¡El intermedio es muchísimo más rápido ahora, a boxes esta vuelta, {driver}!',
      '¡Se está secando la huella para intermedios! ¡A boxes en esta vuelta, boxes boxes!',
    ],
    bono: [
      'La lluvia ha remitido y el agua estancada se dispersa, {driver}. El intermedio es más rápido ahora, boxes para intermedias.',
      'Pista mejorando de lluvia extrema. Neumático intermedio es el más rápido, boxes en esta vuelta.',
    ],
    standard: [
      'La lluvia ha disminuido y el agua estancada se dispersa. El neumático intermedio es mucho más rápido ahora, boxes por intermedios.',
      'Ventana de transición a intermedios abierta. Entra a boxes para cambiar de lluvia extrema a intermedios.',
    ],
  },
  brake_bias_ok: {
    colapinto: [
      '¡Se emparejaron las temperaturas de frenos, {driver}! El balance térmico volvió a la ventana ideal.',
      'Frenos bien balanceados ahora, excelente gestión del reparto.',
    ],
    bono: [
      'Temperaturas de frenos equilibradas, {driver}. El balance entre ejes está restablecido.',
      'Balance térmico de frenos restablecido. Buen trabajo ajustando el reparto.',
    ],
    standard: [
      'Temperaturas de frenos equilibradas, balance térmico entre ejes restablecido.',
      'Balance de frenos normalizado. Temperaturas entre eje delantero y trasero en rango homogéneo.',
    ],
  },
  fuel_mix_neutralized: {
    colapinto: [
      '¡Safety Car en pista! ¡Pasá a mezcla magra o Mezcla 1, {driver}, ahorrá nafta y cuidá las temperaturas!',
      'Mezcla 1 en la perilla de combustible. Recuperá delta de nafta durante la neutralización.',
    ],
    bono: [
      'Safety Car en pista, {driver}. Cambia a mezcla pobre, Mezcla 1 para ahorrar combustible y refrigerar.',
      'Selecciona Mezcla 1 bajo neutralización para cuidar motor y ganar delta de combustible.',
    ],
    standard: [
      'Safety Car en pista. Cambia el mapa de combustible a Mezcla 1 (magra) para ahorrar combustible y controlar temperaturas.',
      'Neutralización activa. Ajusta a mezcla magra para optimizar el consumo de combustible.',
    ],
  },
  fuel_mix_restart: {
    colapinto: [
      '¡Bandera verde, se relanza! ¡Volvé a Mezcla 2 de carrera, {driver}, dale con todo!',
      '¡Relanzamiento con verde! Poné la nafta en Mezcla 2 y acelerá a fondo.',
    ],
    bono: [
      '¡Bandera verde! Restablece el mapa de combustible a Mezcla 2 de carrera.',
      'Pista libre, verde. Vuelve a Mezcla 2 en la perilla de combustible y empuja.',
    ],
    standard: [
      '¡Pista despejada, bandera verde! Restablece el mapa de combustible a Mezcla 2 de carrera.',
      'Relanzamiento bajo bandera verde. Vuelve al modo de combustible estándar de carrera.',
    ],
  },
  ers_clipping: {
    colapinto: [
      '¡Clipping, clipping! ¡Llegaste al límite de 4MJ por vuelta, no hay más boost de batería hasta cruzar la meta!',
      '¡Derating, {driver}! Agotaste el cupo eléctrico de la vuelta, aprovechá el envión hacia la frenada.',
    ],
    bono: [
      'Clipping en recta, {driver}. Despliegue máximo de 4MJ por vuelta alcanzado, sin potencia eléctrica hasta la línea.',
      'Derating de ERS. Cupo eléctrico de la vuelta agotado, gestiona la inercia hasta la frenada.',
    ],
    standard: [
      '¡Clipping, clipping! Despliegue máximo de ERS por vuelta alcanzado. Asistencia eléctrica agotada hasta la línea de meta.',
      'Derating de ERS activo. Se alcanzó el límite reglamentario de 4MJ de despliegue por vuelta.',
    ],
  },
  tyre_set_advisory: {
    colapinto: [
      '¡Ventana de boxes cerca, {driver}! ¡El juego de gomas nuevas ya está listo en boxes, meté una buena vuelta de entrada!',
      '¡Gomas listas en el pit lane! Tenemos un juego fresco preparado para calzarlo.',
    ],
    bono: [
      'Ventana de parada aproximándose, {driver}. Juego nuevo preparado en el cajón de boxes.',
      'Estrategia confirmada para la parada. Neumáticos frescos preparados y mantas fuera.',
    ],
    standard: [
      'Ventana de parada aproximándose. Juego de neumáticos recomendado disponible en boxes.',
      'Juego de neumáticos nuevo preparado para la próxima detención en boxes.',
    ],
  },
  aero_straight_anticipation: {
    colapinto: [
      '¡Zona de Modo Recta en 100 metros, {driver}! ¡Apretá el botón en cuanto salgas de la curva!',
      '¡Se viene la zona de baja resistencia aerodinámica! ¡Prepará el Modo Recta!',
    ],
    bono: [
      'Modo Recta en 100 metros, {driver}. Prepárate para activar aerodinámica de baja carga a la salida.',
      'Zona de aerodinámica activa aproximándose. Listo en el botón de Modo Recta.',
    ],
    standard: [
      'Zona de activación de Modo Recta en 100 metros. Prepárate para activar aerodinámica de baja carga a la salida de curva.',
      'Zona de aerodinámica activa aproximándose. Prepara Modo Recta.',
    ],
  },
  overtake_boost_anticipation: {
    colapinto: [
      '¡Zona de sobrepaso en 100 metros, {driver}! ¡Dedo en el botón de boost, tiráselo en la recta!',
      '¡Se viene la zona de boost! ¡Todo el despliegue al salir del curvón!',
    ],
    bono: [
      'Zona de sobrepaso en 100 metros, {driver}. Botón de boost armado, úsalo para adelantar.',
      'Aproximándose a la zona de potencia extra. Prepárate para activar el modo de sobrepaso.',
    ],
    standard: [
      'Zona de sobrepaso adelante en 100 metros. Listo en el botón de boost.',
      'Zona de activación de boost de sobrepaso en 100 metros. Prepara despliegue.',
    ],
  },
  pit_limiter_overspeed: {
    colapinto: [
      '¡Limitador de boxes, limitador! ¡Bajá la velocidad ya, {driver}, no te comas una penalización!',
      '¡Frená para la línea de boxes! ¡Activá el limitador ya, cuidado con la velocidad!',
    ],
    bono: [
      '¡Limitador de velocidad! Reduce la velocidad ahora, {driver}, línea de entrada a boxes aproximándose.',
      'Atención a la velocidad de entrada a boxes. Clava el limitador antes de la línea.',
    ],
    standard: [
      '¡Limitador de velocidad! Reduce velocidad, línea de limitador de boxes aproximándose. Respeta el límite del pit lane.',
      'Exceso de velocidad en entrada a boxes. Activa el limitador antes de la línea reglamentaria.',
    ],
  },
  tyre_blistering: {
    colapinto: [
      '¡Tenemos ampollas en las gomas, {driver}! ¡Aflojale a los pianitos agresivos y cuidá la carga lateral!',
      '¡Ampollamiento detectado en el neumático! No deslices en curva, llevá el auto prolijo.',
    ],
    bono: [
      'Ampollamiento detectado en los neumáticos, {driver}. Reduce la carga lateral y aléjate de los bordillos agresivos.',
      'Vemos ampollas desarrollándose en la goma. Modera el deslizamiento en curvas rápidas.',
    ],
    standard: [
      'Ampollamiento detectado en los neumáticos. Reduce cargas laterales y evita cortes agresivos sobre bordillos.',
      'Ampollas detectadas en la banda de rodamiento. Gestiona el deslizamiento para evitar desgarros térmicos.',
    ],
  },
  tyre_pressure_high: {
    colapinto: [
      '¡Presión de gomas por las nubes, {driver}! ¡No derrapes en la entrada en curva, protegé la huella de contacto!',
      '¡Presión altísima en los neumáticos! Manejá suave y balanceá el peso.',
    ],
    bono: [
      'La presión del neumático está disparándose, {driver}. Gestiona la entrada en curva para evitar deformar la huella.',
      'Desbalance de presiones detectado en el eje. Equilibra las cargas de frenado y tracción.',
    ],
    standard: [
      'Presión de neumáticos elevada. Modera el apoyo de entrada para evitar abombamiento en la superficie de contacto.',
      'Disparidad de presión entre neumáticos del mismo eje. Equilibra las cargas en curva.',
    ],
  },
  damage_gearbox_wear: {
    colapinto: [
      '¡Desgaste crítico en la caja de cambios, {driver}! ¡Cuidado al tirar cambios, pasalos prolijos!',
      '¡La caja está al límite! No seas agresivo en los rebajes, cuidá los engranajes.',
    ],
    bono: [
      'Desgaste crítico de la caja de cambios, {driver}. Espera cambios lentos y pérdidas de sincronización de torque.',
      'Daño elevado en la transmisión. Sé preciso en los cambios ascendentes.',
    ],
    standard: [
      '¡Desgaste crítico en la caja de cambios! Anticipa retrasos en el cambio de marcha y pérdidas de sincronismo.',
      'Alto daño detectado en la caja de cambios. La sincronización de marchas puede fallar.',
    ],
  },
  damage_ice_wear: {
    colapinto: [
      '¡El motor térmico está al límite de desgaste, {driver}! ¡Vamos a perder velocidad de punta en las rectas!',
      '¡Desgaste altísimo en el ICE! Cuidá las revoluciones y refrigerá en la succión.',
    ],
    bono: [
      'Desgaste crítico en el motor térmico (ICE), {driver}. Habrá pérdida de potencia punta en recta.',
      'Desgaste severo de la unidad de potencia de combustión. Modera el régimen de giro.',
    ],
    standard: [
      'Desgaste crítico del motor de combustión interna (ICE). Anticipa pérdida de potencia en recta.',
      'Alto desgaste detectado en el ICE. La velocidad final y potencia están degradadas.',
    ],
  },
  directive: {
    standard: ['{clean_text}'],
  },
};
