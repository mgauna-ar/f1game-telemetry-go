export const radio_phrases = {
  safety_car: {
    colapinto: [
      'Safety Car en pista, Safety Car. Cuidá el delta positivo y confirmame si venís a boxes.',
      'Safety Car, {driver}. Mantené el delta positivo y estate atento a la estrategia de pits.',
      'Tenemos Safety Car en pista. Delta positivo, no te pegues y preparate para box.',
    ],
    bono: [
      'Safety Car en pista, Safety Car. Mantén delta positivo, confirma en boxes.',
      'Safety Car desplegado, {driver}. Mantén el delta en verde y prepárate.',
      'Safety Car, {driver}. Delta positivo en todo momento, confirmamos parada.',
    ],
    standard: [
      'Safety Car en pista, Safety Car. Mantén delta positivo y confirma si entras a boxes.',
      'Safety Car desplegado. Mantén delta en positivo, atentos a la ventana de parada.',
      'Safety Car en pista, {driver}. Mantén delta positivo y prepárate para posible parada.',
    ],
  },
  vsc: {
    colapinto: [
      'Virtual Safety Car, VSC. Mantené el delta positivo, sin sobrepasos.',
      'VSC en pista, {driver}. Cuidá el delta y no te distraigas.',
      'Tenemos Virtual Safety Car. Delta positivo en todos los sectores, prohibido adelantar.',
    ],
    bono: [
      'Virtual Safety Car desplegado. Mantén delta positivo, sin adelantamientos.',
      'VSC desplegado, {driver}. Mantén delta positivo y prepárate.',
    ],
    standard: [
      'Virtual Safety Car desplegado. Mantén delta positivo, prohibido adelantar.',
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
      'El motor está levantando temperatura, {driver}. Salí del aire sucio para enfriar radiadores.',
    ],
    bono: [
      'Temperatura de motor elevada. Sal del aire sucio para refrigerar el radiador.',
    ],
    standard: [
      'Temperatura de motor elevada. Sal del aire sucio para refrigerar el radiador.',
      'Temperaturas de motor críticas, {driver}. Busca aire limpio en las rectas.',
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
  directive: {
    standard: ['{clean_text}'],
  },
};
