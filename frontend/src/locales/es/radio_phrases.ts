import type {
  BoxCallKind,
  EngineerBoxTiming,
  ExchangeLine,
  RadioAlertCategory,
  RadioPhrasePool,
  RadioValueWords,
  ReportPhrase,
} from '../../types/telemetry';

export const radio_phrases = {
  safety_car: {
    bono: [
      'Safety Car, Safety Car. Delta positivo, sin adelantar.',
      '{driver}, Safety Car desplegado. Mantené el delta por encima de cero.',
      'Ok, Safety Car en pista. Respetá el delta, nada de adelantamientos.',
      'Tenemos Safety Car. Delta positivo en todo momento.',
      'Safety Car, {driver}. Tranquilo con el delta, no se adelanta.',
    ],
    colapinto: [
      '¡Safety Car, Safety Car! Delta positivo y nada de adelantar.',
      '¡Safety Car en pista, {driver}! Cuidá el delta, que no baje de cero.',
      '¡Ojo, sale el Safety Car! Mantené el delta positivo.',
      '¡Safety Car! Sin adelantar, {driver}, delta siempre positivo.',
      '¡Carrera neutralizada con Safety Car! Pegado al delta, eh.',
    ],
    standard: [
      'Safety Car en pista. Mantené el delta positivo y no adelantes.',
      'Safety Car desplegado, {driver}. Delta positivo, sin adelantamientos.',
      'Tenemos el Safety Car en pista. Respetá el delta en todo momento.',
      'Carrera neutralizada con Safety Car. Delta positivo, prohibido adelantar.',
    ],
  },
  vsc: {
    bono: [
      'VSC, VSC. Delta positivo, sin adelantar.',
      '{driver}, Safety Car Virtual. Mantené el delta por encima de cero.',
      'Ok, VSC desplegado. Respetá el delta.',
      'VSC en pista. Seguí el delta, nada de adelantamientos.',
    ],
    colapinto: [
      '¡VSC, VSC! Delta positivo y nadie adelanta.',
      '¡Safety Car Virtual, {driver}! Cuidá el delta, que no baje de cero.',
      '¡Ojo, VSC! Bajá el ritmo y mantené el delta positivo.',
      '¡VSC en pista! Sin adelantar, {driver}, pegado al delta.',
    ],
    standard: [
      'VSC desplegado. Mantené el delta positivo y no adelantes.',
      'Safety Car Virtual en pista, {driver}. Delta positivo, sin adelantamientos.',
      'Tenemos VSC. Respetá el delta en todo momento.',
      'Carrera neutralizada con VSC. Delta positivo, prohibido adelantar.',
    ],
  },
  safety_car_box: {
    bono: [
      'Safety Car. Aprovechamos para parar, {driver}.',
      'Ok, Safety Car en pista. Hacemos la parada con él.',
      'Safety Car, {driver}. Es nuestra parada, delta positivo hasta boxes.',
      'Safety Car desplegado. Paramos con el Safety Car.',
    ],
    colapinto: [
      '¡Safety Car, {driver}! ¡Aprovechamos y paramos!',
      '¡Salió el Safety Car! Nos viene justo, cambiamos gomas.',
      '¡Safety Car en pista! Nos sirve, {driver}, hacemos la parada.',
      '¡Dale que hay Safety Car! Paramos, cuidá el delta.',
    ],
    standard: [
      'Safety Car en pista. Aprovechamos para hacer la parada.',
      'Safety Car desplegado, {driver}. Paramos bajo Safety Car.',
      'Con el Safety Car hacemos la parada. Mantené el delta positivo.',
    ],
  },
  vsc_box: {
    bono: [
      'VSC. Aprovechamos para parar, {driver}.',
      'Ok, VSC desplegado. Hacemos la parada con el VSC.',
      'Safety Car Virtual, {driver}. Es nuestra parada, cuidá el delta.',
    ],
    colapinto: [
      '¡VSC, {driver}! ¡Aprovechamos y paramos!',
      '¡Salió el VSC! Nos viene justo, hacemos la parada.',
      '¡VSC en pista! Entramos a cambiar gomas, cuidá el delta.',
    ],
    standard: [
      'VSC en pista. Aprovechamos para hacer la parada.',
      'Safety Car Virtual, {driver}. Paramos bajo VSC.',
      'Con el VSC hacemos la parada. Mantené el delta positivo.',
    ],
  },
  red_flag: {
    bono: [
      'Bandera roja, bandera roja. Bajá el ritmo y volvé a boxes.',
      '{driver}, bandera roja. Sesión detenida, entrá despacio a boxes.',
      'Ok, bandera roja. Despacio hasta la calle de boxes.',
    ],
    colapinto: [
      '¡Bandera roja, bandera roja! Aflojá y venite a boxes.',
      '¡Bandera roja, {driver}! Se para todo, volvé despacio.',
      '¡Bandera roja! Sesión parada, traé el auto tranquilo a boxes.',
    ],
    standard: [
      'Bandera roja. Sesión detenida, volvé despacio a la calle de boxes.',
      'Bandera roja, {driver}. Reducí la velocidad y entrá a boxes.',
      'Bandera roja en pista. Ritmo lento y de vuelta a boxes.',
    ],
  },
  tyre_puncture: {
    bono: [
      'Pinchadura en la {wheel}, {driver}. Traelo con cuidado.',
      'Ok, goma {wheel} pinchada. Despacio hasta boxes.',
      'Pinchazo en la goma {wheel}. Sin riesgos.',
      'Pinchadura, {driver}. Traelo con cuidado.',
    ],
    colapinto: [
      '¡Pinchadura en la {wheel}, {driver}! Traelo despacito.',
      '¡Pinchaste la goma {wheel}! Con cuidado hasta boxes.',
      '¡Tenemos la {wheel} pinchada! Tranquilo, sin romper nada más.',
      '¡Pinchadura, {driver}! Despacio hasta boxes.',
    ],
    standard: [
      'Pinchadura en la goma {wheel}. Volvé a boxes con cuidado.',
      'La goma {wheel} está pinchada, {driver}. Cuidá el auto.',
      'Pinchazo en la {wheel}. Reducí el ritmo y traé el auto.',
      'Pinchadura, {driver}. Volvé con cuidado.',
    ],
  },
  tyre_worn_out: {
    bono: [
      'La goma {wheel} tiene {pct} por ciento de desgaste, {driver}. Paramos.',
      'Ok, {wheel} con {pct} por ciento de desgaste. Se terminó.',
      'Desgaste de {pct} por ciento en la {wheel}. Hay que parar.',
      'Esa goma está terminada, {driver}. Paramos.',
    ],
    colapinto: [
      '¡La {wheel} ya no da más, {pct} por ciento! Paramos, {driver}.',
      'Goma {wheel} con {pct} por ciento de desgaste, {driver}. ¡Está liquidada!',
      '¡{pct} por ciento de desgaste en la {wheel}! Se acabó esa goma.',
      '¡Esa goma está liquidada, {driver}! Paramos.',
    ],
    standard: [
      'Goma {wheel} con {pct} por ciento de desgaste. Tenemos que parar.',
      'Desgaste del {pct} por ciento en la {wheel}, {driver}. Está terminada.',
      'La {wheel} llegó a {pct} por ciento de desgaste. Paramos.',
      'Goma terminada, {driver}. Tenemos que parar.',
    ],
  },
  tyre_wear: {
    bono: [
      'Desgaste de {pct} por ciento en la {wheel}, {driver}. Cuidala.',
      'Ok, la goma {wheel} va con {pct} por ciento de desgaste.',
      'La más gastada es la {wheel}, con {pct} por ciento. Sin excesos.',
      '{pct} por ciento de desgaste en la goma {wheel}. Suave con ella.',
      'Las gomas empiezan a gastarse, {driver}. Cuidalas.',
    ],
    colapinto: [
      'La {wheel} ya va por el {pct} por ciento, {driver}. ¡Cuidala!',
      'Ojo con la goma {wheel}: {pct} por ciento de desgaste. Menos deslizamiento.',
      '{pct} por ciento en la {wheel}. Tranqui con esa goma, que tiene que durar.',
      'La que más sufre es la {wheel}, {pct} por ciento. ¡Cuidala, {driver}!',
      '¡Desgaste en {pct} por ciento! La {wheel} es la más castigada.',
      'Las gomas se empiezan a gastar, {driver}. ¡Cuidalas!',
    ],
    standard: [
      'Desgaste de gomas: la {wheel} está en {pct} por ciento.',
      'La goma {wheel} lleva {pct} por ciento de desgaste, {driver}. Administrala.',
      'La {wheel} es la más gastada, con {pct} por ciento. Controlá los deslizamientos.',
      'Goma {wheel} con {pct} por ciento de desgaste. Empezá a gestionar las gomas.',
      'El desgaste de gomas va subiendo. Controlá los deslizamientos.',
    ],
  },
  tyre_wear_critical: {
    bono: [
      'Goma {wheel} con {pct} por ciento, {driver}. Desgaste crítico.',
      'Ok, {pct} por ciento en la {wheel}. Cuidala mucho.',
      'La {wheel} con {pct} por ciento de desgaste. Al límite.',
      'Crítico: {pct} por ciento de desgaste en la {wheel}.',
      'Desgaste crítico de gomas, {driver}.',
    ],
    colapinto: [
      '¡La {wheel} está al {pct} por ciento, {driver}! ¡Cuidala mucho!',
      '¡Ojo! {pct} por ciento en la goma {wheel}, está al límite.',
      '¡Desgaste crítico en la {wheel}! {pct} por ciento, muy suave.',
      '{pct} por ciento de desgaste en la {wheel}. ¡Nada de deslizar!',
      '¡Las gomas están al límite, {driver}! Cuidalas.',
    ],
    standard: [
      'Desgaste crítico: la {wheel} está en {pct} por ciento.',
      'La goma {wheel} llegó a {pct} por ciento, {driver}. Cuidala al máximo.',
      '{pct} por ciento de desgaste en la {wheel}. Evitá deslizamientos.',
      'Goma {wheel} con desgaste crítico, {pct} por ciento. Gestioná el ritmo.',
      'Desgaste crítico de gomas. Protegelas.',
    ],
  },
  tyre_overheat: {
    bono: [
      'Gomas traseras calientes, {driver}. Cuidá la tracción.',
      'Ok, las traseras suben de temperatura. Menos patinadas a la salida.',
      'Temperatura alta atrás. Acelerá más progresivo.',
      'Se calientan las traseras. Suave con el acelerador.',
    ],
    colapinto: [
      '¡Las traseras están recalientes, {driver}! Suave con la tracción.',
      'Ojo con las gomas de atrás, se están pasando de temperatura. ¡Menos derrape!',
      '¡Traseras muy calientes! Acelerá más tranqui a la salida de las curvas.',
      'Se te calientan las de atrás. Cuidá el patinamiento en tracción.',
      '{driver}, las traseras levantan mucha temperatura. Pie derecho suave.',
    ],
    standard: [
      'Gomas traseras sobrecalentadas. Gestioná la tracción a la salida de las curvas.',
      'Temperatura alta en las traseras, {driver}. Reducí los deslizamientos.',
      'Las traseras están por encima de su ventana. Aceleraciones más progresivas.',
      'Superficie de las gomas traseras muy caliente. Cuidá la tracción.',
    ],
  },
  tyre_cold: {
    bono: [
      'Gomas frías, {driver}. Metele temperatura de a poco.',
      'Ok, las gomas están por debajo de la ventana. Calentalas.',
      'Gomas sin temperatura todavía. Progresivo.',
      'Falta temperatura en las gomas. Cuidado en las primeras curvas.',
    ],
    colapinto: [
      '¡Gomas frías, {driver}! Metele temperatura, de a poquito.',
      'Las gomas todavía están frías. ¡Ojo que no agarran!',
      '¡Falta temperatura en las gomas! Calentalas antes de apretar.',
      'Gomas frías, cuidado en las frenadas. ¡A meterles calor!',
    ],
    standard: [
      'Gomas frías. Llevalas a temperatura antes de empujar.',
      'Las gomas están por debajo de su ventana, {driver}. Generá temperatura.',
      'Temperatura de gomas baja. Empujá de forma progresiva.',
      'Gomas sin temperatura, {driver}. Cuidado con el agarre.',
    ],
  },
  wing_damage: {
    bono: [
      'Alerón delantero dañado, {pct} por ciento, {driver}. Vas a tener subviraje.',
      'Ok, daño de {pct} por ciento en el alerón delantero.',
      'Alerón delantero con {pct} por ciento de daño. Esperá subviraje.',
      'Daño en el alerón delantero, {driver}. Esperá subviraje.',
    ],
    colapinto: [
      'Alerón delantero dañado, {pct} por ciento. ¡Va a empujar de trompa!',
      '¡Tocado el alerón de adelante, {pct} por ciento, {driver}!',
      '{pct} por ciento de daño en el alerón. ¡Ojo con el subviraje!',
      '¡Alerón delantero dañado, {driver}! Va a empujar de trompa.',
    ],
    standard: [
      'Daño en el alerón delantero del {pct} por ciento. Esperá subviraje.',
      'El alerón delantero tiene {pct} por ciento de daño, {driver}.',
      'Alerón delantero con {pct} por ciento de daño. Menos carga adelante.',
      'Daño en el alerón delantero. El auto va a tener subviraje.',
    ],
  },
  floor_damage: {
    bono: [
      'Daño en el piso, {pct} por ciento, {driver}. Menos carga aerodinámica.',
      'Ok, el fondo tiene {pct} por ciento de daño. Ojo en las curvas rápidas.',
      'Piso y difusor dañados, {pct} por ciento. Menos agarre en alta.',
      'Daño en el piso, {driver}. Perdimos carga.',
    ],
    colapinto: [
      'El piso está dañado, {pct} por ciento, {driver}. ¡Ojo en las rápidas!',
      '{pct} por ciento de daño en el fondo. Vamos a tener menos carga en curvas rápidas.',
      'Daño de {pct} por ciento en piso y difusor. Menos agarre en alta velocidad.',
      '¡Daño en el piso, {driver}! Ojo en las curvas rápidas.',
    ],
    standard: [
      'Daño en el piso del {pct} por ciento. Pérdida de carga aerodinámica.',
      'El fondo plano tiene {pct} por ciento de daño, {driver}. Menos agarre en curvas rápidas.',
      'Piso y difusor con {pct} por ciento de daño. Cuidado en alta velocidad.',
      'Daño en el fondo del auto. Menos carga en curvas rápidas.',
    ],
  },
  engine_wear: {
    bono: [
      'Desgaste de motor al {pct} por ciento, {driver}.',
      'Ok, un componente de la unidad de potencia va por el {pct} por ciento.',
      'Unidad de potencia con {pct} por ciento de desgaste. Cuidala.',
      'Desgaste alto en el motor, {driver}.',
    ],
    colapinto: [
      'Un componente del motor llegó al {pct} por ciento, {driver}. ¡Cuidalo!',
      '{pct} por ciento de desgaste en la unidad de potencia. Con cariño, eh.',
      'El motor va por el {pct} por ciento de desgaste. Sin pasarte de vueltas.',
      '¡El motor está gastado, {driver}! Cuidalo.',
    ],
    standard: [
      'Desgaste de la unidad de potencia: {pct} por ciento.',
      'Un componente del motor alcanzó {pct} por ciento de desgaste, {driver}.',
      'Motor con {pct} por ciento de desgaste. Evitá pasarte de vueltas.',
      'Desgaste elevado en la unidad de potencia.',
    ],
  },
  terminal_engine: {
    bono: [
      'Se rompió el motor, {driver}. Pará el auto en un lugar seguro.',
      'Ok, motor roto. Salí de la pista y pará.',
      'Perdimos el motor. Pará el auto donde sea seguro.',
    ],
    colapinto: [
      '¡Se rompió el motor, {driver}! Pará en un lugar seguro.',
      '¡Motor roto! Salí de la trazada y apagá todo.',
      '¡Perdimos el motor! Tirate afuera con cuidado.',
    ],
    standard: [
      'Falla de motor. Detené el auto en una zona segura.',
      'El motor está roto, {driver}. Salí de la pista y pará.',
      'Motor fuera de servicio. Estacioná el auto en un lugar seguro.',
    ],
  },
  ers_low: {
    bono: [
      'Batería al {pct} por ciento, {driver}. Dejala recargar.',
      'Ok, {pct} por ciento de batería. Recuperá energía.',
      'Batería baja, {pct} por ciento. Ahorrá un poco.',
      'Nos queda {pct} por ciento de batería. Recargá antes de usarla.',
      'Batería baja, {driver}. Dejala recargar.',
    ],
    colapinto: [
      '¡Batería al {pct} por ciento, {driver}! Dejala recargar un poco.',
      'Quedó {pct} por ciento de batería. ¡Ahorrá para cuando la necesites!',
      '{pct} por ciento de batería nomás. A recargar, {driver}.',
      'Estamos con {pct} por ciento de batería. Juntá energía.',
      '¡Nos quedamos cortos de batería! A recargar.',
    ],
    standard: [
      'Batería al {pct} por ciento. Recargá antes de volver a usarla.',
      'Nivel de batería en {pct} por ciento, {driver}. Ahorrá energía.',
      'La batería está en {pct} por ciento. Priorizá la recarga.',
      'Carga de batería baja, {pct} por ciento. Gestioná el despliegue.',
      'Batería baja. Dejala recargar, {driver}.',
    ],
  },
  radiator_overheat: {
    bono: [
      'Motor caliente, {driver}. Levantá un poco antes de frenar.',
      'Ok, temperatura de motor alta. Un poco de levantar y dejar correr.',
      'Motor por encima del límite. Salí del rebufo cuando puedas.',
      'Sube la temperatura del motor. Levantá antes de las frenadas largas.',
    ],
    colapinto: [
      '¡Se calienta el motor, {driver}! Levantá antes de frenar y salí del chupón.',
      'Ojo con la temperatura del motor. Buscá aire limpio.',
      'Motor caliente. ¡Un poquito de levantar y dejar correr!',
      'El motor pide aire, {driver}. Si vas en el chupón, despegate un poco.',
    ],
    standard: [
      'Temperatura de motor alta. Levantá y dejá correr antes de las frenadas.',
      'El motor está por encima del límite, {driver}. Buscá aire limpio.',
      'Motor caliente. Algo de levantar y dejar correr para bajarle la temperatura.',
      'Temperatura del motor elevada. Evitá el rebufo un rato.',
    ],
  },
  radiator_overheat_high: {
    bono: [
      'El motor sigue subiendo, {driver}. Más levantar y dejar correr.',
      'Ok, la temperatura no baja. Aire limpio.',
      'Motor todavía más caliente. Levantá antes y salí del rebufo.',
    ],
    colapinto: [
      '¡El motor sigue calentando, {driver}! Levantá más y buscá aire limpio.',
      'No baja la temperatura. ¡Salí del chupón!',
      'Cada vez más caliente el motor. Más levantar y dejar correr, ¡dale!',
    ],
    standard: [
      'La temperatura del motor sigue subiendo. Más levantar y dejar correr.',
      'El motor continúa calentándose, {driver}. Buscá aire limpio.',
      'Temperatura de motor en aumento. Levantá antes de frenar y alejate del rebufo.',
    ],
  },
  radiator_overheat_critical: {
    bono: [
      'Temperatura de motor crítica, {driver}. Levantá ya.',
      'Ok, motor en zona crítica. Levantá y dejá correr, fuera del rebufo.',
      'Motor crítico. Aire limpio ya.',
    ],
    colapinto: [
      '¡Motor en temperatura crítica, {driver}! ¡Levantá ya!',
      '¡Temperatura crítica! Salí del chupón ya mismo.',
      '¡El motor está al rojo! Levantá y dejá correr, ¡ya!',
    ],
    standard: [
      'Temperatura de motor crítica. Levantá y dejá correr ya.',
      'Motor en temperatura crítica, {driver}. Salí del rebufo ahora.',
      'Temperatura crítica en el motor. Enfrialo ya, buscá aire limpio.',
    ],
  },
  brake_overheat: {
    bono: [
      'Freno de la {wheel} caliente, {driver}. Reparto un punto para atrás.',
      'Ok, se recalienta el freno de la {wheel}. Balance un punto atrás.',
      'La {wheel} tiene el freno pasado de temperatura. Mové el reparto hacia atrás.',
      'Temperatura alta en el freno de la {wheel}. Un punto de reparto atrás.',
      'Frenos delanteros calientes, {driver}. Reparto un punto atrás.',
    ],
    colapinto: [
      '¡El freno de la {wheel} está que arde, {driver}! Reparto un punto para atrás.',
      'Ojo con el freno de la {wheel}. ¡Llevá el balance para atrás!',
      'Freno de la {wheel} muy caliente. ¡Reparto atrás, un punto!',
      'Mucha temperatura en el freno de la {wheel}, {driver}. Pasá el balance para atrás.',
      '¡Frenos de adelante muy calientes! Reparto para atrás.',
    ],
    standard: [
      'Freno de la {wheel} sobrecalentado. Mové el reparto de frenada un punto hacia atrás.',
      'El freno de la {wheel} está muy caliente, {driver}. Reparto hacia atrás.',
      'Temperatura excesiva en el freno de la {wheel}. Balance de frenos un punto atrás.',
      'Se recalienta el freno de la {wheel}. Llevá el reparto un punto hacia atrás.',
      'Frenos delanteros sobrecalentados. Mové el reparto hacia atrás.',
    ],
  },
  brake_overheat_rear: {
    bono: [
      'Freno de la {wheel} caliente, {driver}. Reparto un punto para adelante.',
      'Ok, se recalienta el freno de la {wheel}. Balance un punto adelante.',
      'La {wheel} tiene el freno pasado de temperatura. Mové el reparto hacia adelante.',
      'Temperatura alta en el freno de la {wheel}. Un punto de reparto adelante.',
      'Frenos traseros calientes, {driver}. Reparto un punto adelante.',
    ],
    colapinto: [
      '¡El freno de la {wheel} está que arde, {driver}! Reparto un punto para adelante.',
      'Ojo con el freno de la {wheel}. ¡Llevá el balance para adelante!',
      'Freno de la {wheel} muy caliente. ¡Reparto adelante, un punto!',
      'Mucha temperatura en el freno de la {wheel}, {driver}. Pasá el balance hacia adelante.',
      '¡Frenos de atrás muy calientes! Reparto para adelante.',
    ],
    standard: [
      'Freno de la {wheel} sobrecalentado. Mové el reparto de frenada un punto hacia adelante.',
      'El freno de la {wheel} está muy caliente, {driver}. Reparto hacia adelante.',
      'Temperatura excesiva en el freno de la {wheel}. Balance de frenos un punto adelante.',
      'Se recalienta el freno de la {wheel}. Llevá el reparto un punto hacia adelante.',
      'Frenos traseros sobrecalentados. Mové el reparto hacia adelante.',
    ],
  },
  brake_cold: {
    bono: [
      'Frenos fríos, {driver}. Metele algo de presión al pedal.',
      'Ok, los frenos están sin temperatura. Calentalos.',
      'Frenos fríos. Unas frenadas firmes para calentarlos.',
      'Falta temperatura en los frenos. Ojo en la primera frenada.',
    ],
    colapinto: [
      '¡Frenos fríos, {driver}! Pisá el freno y metele temperatura.',
      'Los frenos están helados. ¡Calentalos con unas frenadas fuertes!',
      '¡Ojo que los frenos no tienen temperatura! Calentalos.',
      'Frenos fríos. ¡Arrastrá un poco de freno para calentarlos!',
    ],
    standard: [
      'Frenos fríos. Calentalos con algo de presión en el pedal.',
      'Temperatura de frenos baja, {driver}. Generá temperatura frenando.',
      'Los frenos están por debajo de su temperatura. Frenadas firmes para calentarlos.',
      'Frenos sin temperatura, {driver}. Cuidado con la primera frenada fuerte.',
    ],
  },
  brake_bias: {
    bono: [
      'Los frenos del eje {axle} van mucho más calientes, {driver}. Reparto atrás.',
      'Ok, el eje {axle} hace casi todo el trabajo de frenada. Balance para atrás.',
      'Demasiada temperatura en los frenos del eje {axle}. Mové el reparto hacia atrás.',
      'Frenos desbalanceados, {driver}. Reparto hacia atrás.',
    ],
    colapinto: [
      '¡Los frenos del eje {axle} están mucho más calientes, {driver}! Reparto para atrás.',
      'El eje {axle} se lleva toda la frenada. ¡Balance para atrás!',
      'Mucho freno en el eje {axle}. Mové el reparto para atrás, {driver}.',
      '¡Demasiado freno adelante! Reparto para atrás.',
    ],
    standard: [
      'Los frenos del eje {axle} están mucho más calientes que los traseros. Reparto hacia atrás.',
      'Temperatura de frenos cargada en el eje {axle}, {driver}. Mové el balance hacia atrás.',
      'El eje {axle} trabaja de más en las frenadas. Reparto un punto atrás.',
      'Temperaturas de frenos desparejas. Mové el reparto hacia atrás.',
    ],
  },
  brake_bias_forward: {
    bono: [
      'Los frenos del eje {axle} van mucho más calientes, {driver}. Reparto adelante.',
      'Ok, el eje {axle} carga con la frenada. Balance para adelante.',
      'Demasiada temperatura en los frenos del eje {axle}. Mové el reparto hacia adelante.',
      'Frenos desbalanceados, {driver}. Reparto hacia adelante.',
    ],
    colapinto: [
      '¡Los frenos del eje {axle} están mucho más calientes, {driver}! Reparto para adelante.',
      'El eje {axle} se lleva toda la frenada. ¡Balance para adelante!',
      'Mucho freno en el eje {axle}. Mové el reparto para adelante, {driver}.',
      '¡Demasiado freno atrás! Reparto para adelante.',
    ],
    standard: [
      'Los frenos del eje {axle} están mucho más calientes que los delanteros. Reparto hacia adelante.',
      'Temperatura de frenos cargada en el eje {axle}, {driver}. Mové el balance hacia adelante.',
      'El eje {axle} trabaja de más en las frenadas. Reparto un punto adelante.',
      'Temperaturas de frenos desparejas. Mové el reparto hacia adelante.',
    ],
  },
  fuel_deficit: {
    bono: [
      'Nos faltan {fuel_laps} vueltas de combustible, {driver}. Levantá antes de las frenadas grandes.',
      'Ok, combustible: {fuel_laps} vueltas abajo del objetivo. Levantar y dejar correr.',
      'Déficit de {fuel_laps} vueltas de combustible. Levantá y dejá correr.',
      '{fuel_laps} vueltas por debajo del objetivo de nafta. Ahorrá en las frenadas fuertes.',
      'Estamos justos de combustible, {driver}. Levantá y dejá correr.',
    ],
    colapinto: [
      'Nos faltan {fuel_laps} vueltas de nafta, {driver}. ¡Levantá antes de las frenadas fuertes!',
      'Estamos {fuel_laps} vueltas abajo con la nafta. Levantá y dejá correr, dale.',
      'Ojo con la nafta: faltan {fuel_laps} vueltas. A ahorrar en las frenadas grandes.',
      'Venimos {fuel_laps} vueltas en rojo con el combustible. ¡Levantá antes de frenar!',
      '¡Estamos justos de nafta, {driver}! A ahorrar.',
    ],
    standard: [
      'Nos faltan {fuel_laps} vueltas de combustible. Levantá y dejá correr en las frenadas fuertes.',
      'Objetivo de combustible: {fuel_laps} vueltas de déficit, {driver}. Ahorrá antes de frenar.',
      'El combustible está {fuel_laps} vueltas por debajo del objetivo. Levantá antes de las frenadas grandes.',
      'Déficit de {fuel_laps} vueltas de combustible. Gestioná con levantar y dejar correr.',
      'Estamos justos de combustible. Levantá y dejá correr antes de frenar.',
    ],
  },
  undercut_window: {
    bono: [
      'El de atrás paró, estaba a {gap}, {driver}. Empujá.',
      'Ok, el de atrás entró a boxes a {gap}. Cubrí el undercut.',
      'Undercut del de atrás, venía a {gap} segundos. Ritmo máximo.',
      'El de atrás entró a boxes, {driver}. Cubrí el undercut.',
    ],
    colapinto: [
      '¡Paró el de atrás, {driver}! Estaba a {gap}, ¡apretá ya!',
      '¡Undercut! El de atrás entró a {gap}, ¡a fondo!',
      'El de atrás se tiró a boxes a {gap}. ¡Vueltas de clasificación!',
      '¡El de atrás paró, {driver}! ¡Empujá con todo!',
    ],
    standard: [
      'El de atrás paró a {gap} segundos. Empujá para cubrir el undercut.',
      'Intento de undercut del auto de atrás, a {gap}, {driver}. Ritmo máximo.',
      'Paró el auto que venía a {gap}. Empujá ahora.',
      'El auto de atrás entró a boxes. Empujá para cubrir el undercut.',
    ],
  },
  overcut_window: {
    bono: [
      'El de adelante paró, estaba a {gap}, {driver}. Aire limpio, empujá.',
      'Ok, el de adelante paró a {gap}. Vamos por el overcut.',
      'Paró el de adelante, a {gap} segundos. Ritmo en aire limpio.',
      'El de adelante entró a boxes, {driver}. Overcut.',
    ],
    colapinto: [
      '¡Paró el de adelante, {driver}! Estaba a {gap}, ¡aire limpio y a fondo!',
      '¡Se fue a boxes el de adelante, a {gap}! ¡Overcut!',
      'El de adelante paró a {gap} segundos. ¡Pista libre, apretá!',
      '¡El de adelante paró! ¡Aprovechá el aire limpio!',
    ],
    standard: [
      'El auto de adelante paró a {gap} segundos. Empujá en aire limpio.',
      'El de adelante entró a boxes, {driver}, a {gap}. Ritmo para el overcut.',
      'Paró el auto de adelante, estaba a {gap}. Aprovechá el aire limpio.',
      'El auto de adelante entró a boxes. Empujá para el overcut.',
    ],
  },
  pit_plan_next_lap: {
    bono: [
      'Box la próxima vuelta, {driver}. Salimos P{position}.',
      'Ok, paramos la vuelta que viene. Volvemos a pista P{position}.',
      'La que viene es la parada. Salida prevista en P{position}.',
      'Próxima vuelta, box. Deberíamos salir P{position}.',
      'Ok, la vuelta que viene paramos.',
    ],
    colapinto: [
      '¡Box la vuelta que viene, {driver}! Salimos P{position}.',
      'Preparate que la próxima es la parada. Volvemos P{position}.',
      'Vuelta que viene paramos, ¡dale! Salimos en P{position}.',
      'Se viene la parada en la próxima vuelta. Saldríamos P{position}, {driver}.',
      '¡Preparate, {driver}! Box la próxima vuelta.',
    ],
    standard: [
      'Aviso de parada, box en la próxima vuelta. Salida en P{position}.',
      'Paramos al final de la próxima vuelta, {driver}. Volvemos a pista P{position}.',
      'Parada planificada para la próxima vuelta. Reingreso estimado en P{position}.',
      'Próxima vuelta entramos a boxes, {driver}. Deberíamos salir P{position}.',
      'Box en la próxima vuelta, {driver}.',
    ],
  },
  pit_plan_box: {
    bono: [
      'Es la parada, {driver}. Salimos P{position}.',
      'Ok, vamos con la parada planificada. Volvemos P{position}.',
      'Paramos según el plan. Reingreso en P{position}.',
      'Llegó la parada. Deberíamos salir P{position}.',
      'Vamos con la parada planificada, {driver}.',
    ],
    colapinto: [
      '¡Llegó la parada, {driver}! Salimos P{position}.',
      'Vamos con la parada, ¡dale! Volvemos a pista P{position}.',
      'Es nuestra parada, {driver}. Deberíamos salir P{position}.',
      'Toca parar. Saldríamos en P{position}, ¡vamos!',
      '¡Toca parar, {driver}! Es la parada del plan.',
    ],
    standard: [
      'Parada planificada, {driver}. Salimos P{position}.',
      'Hacemos la parada prevista. Reingreso en P{position}.',
      'Es la parada del plan. Deberíamos volver a pista P{position}.',
      'Paramos según la estrategia, {driver}. Salida estimada en P{position}.',
      'Es la parada planificada.',
    ],
  },
  pit_window_close: {
    bono: [
      'Se cierra la ventana, {driver}. Tenemos que parar.',
      'Ok, última oportunidad de la ventana. Paramos.',
      'Fin de la ventana de parada. No hay más margen.',
      'La ventana se termina. Paramos sí o sí.',
    ],
    colapinto: [
      '¡Se cierra la ventana, {driver}! ¡Paramos sí o sí!',
      '¡Última oportunidad para parar! No podemos estirarlo más.',
      '¡Ventana cerrándose! Hay que entrar, {driver}.',
      '¡No hay más margen! Se termina la ventana de parada.',
    ],
    standard: [
      'Se cierra la ventana de parada. Tenemos que parar.',
      'Última vuelta de la ventana de parada, {driver}. Paramos.',
      'La ventana de parada se termina, {driver}. No podemos estirar más.',
      'Es la última oportunidad de la ventana. Hacemos la parada.',
    ],
  },
  rival_defend: {
    bono: [
      'Auto de atrás a {gap}. Defendé.',
      'El de atrás, a {gap}. Cuidá la posición.',
      '{gap} al de atrás. Sin errores.',
      'De atrás a {gap}, cubrí las frenadas.',
      'Tenés el auto de atrás encima. Defendé.',
    ],
    colapinto: [
      '¡El de atrás a {gap}! ¡Cerrá la puerta!',
      '¡Lo tenés a {gap} atrás! ¡Defendé con todo!',
      '¡A {gap} el de atrás! Frenadas firmes y por adentro.',
      '¡Atrás a {gap}, atento! ¡No le dejes hueco!',
      '¡El de atrás está encima! ¡Cerrá la puerta!',
    ],
    standard: [
      'Auto de atrás a {gap} segundos. Defendé la posición.',
      'El de atrás, a {gap}. Cuidá las frenadas.',
      'Diferencia de {gap} con el auto de atrás. Sin errores.',
      'A {gap} tenés al de atrás. Mantené la línea defensiva.',
      'Auto de atrás muy cerca. Defendé la posición.',
    ],
  },
  rival_defend_drs: {
    bono: [
      'El de atrás, a {gap}, tiene DRS.',
      'Auto de atrás a {gap}, con DRS. Buena salida a la recta.',
      'DRS atrás, a {gap}. Cubrí el interior.',
      'A {gap} el de atrás, con DRS. Defendé.',
      'El auto de atrás tiene DRS.',
    ],
    colapinto: [
      '¡DRS atrás, a {gap}! ¡Cerrá la puerta!',
      '¡El de atrás a {gap}, con DRS! ¡Cubrí el interior!',
      '¡A {gap} y con DRS el de atrás! ¡Buena tracción!',
      '¡Con DRS a {gap} atrás! ¡No le des lugar!',
      '¡El de atrás tiene DRS! ¡Cubrí el interior!',
    ],
    standard: [
      'Auto de atrás a {gap}, con DRS. Defendé.',
      'A {gap} el de atrás, con DRS. Cuidá la salida.',
      'Diferencia de {gap} con el de atrás, que tiene DRS.',
      'A {gap} y con DRS el auto de atrás. Defendé.',
      'Auto de atrás en rango de DRS. Defendé el interior.',
    ],
  },
  rival_attack: {
    bono: [
      'El de adelante a {gap}, le descontás {rate} por vuelta, {driver}.',
      'Ok, {gap} al de adelante y bajando {rate} por vuelta. Paciencia.',
      'Le sacás {rate} por vuelta al de adelante. Está a {gap}.',
      'Diferencia de {gap} adelante, te acercás {rate} por vuelta.',
      'Auto de adelante a {gap}, {driver}. Mantené la presión.',
      'Ok, el de adelante está a {gap}. Buscá la oportunidad.',
      '{gap} al de adelante. Presión constante.',
      'Estás a {gap} del de adelante. Atacá cuando haya hueco.',
      'Auto de adelante a tiro, {driver}.',
    ],
    colapinto: [
      '¡Le descontás {rate} por vuelta, {driver}! Está a {gap}, ¡vamos a buscarlo!',
      'El de adelante a {gap} y te acercás {rate} por vuelta. ¡Dale!',
      '¡{rate} por vuelta más rápido que el de adelante! Lo tenés a {gap}.',
      '¡Lo estás cazando! {gap} y bajando {rate} por vuelta.',
      '¡El de adelante está a {gap}, {driver}! ¡A buscarlo!',
      'Lo tenés a {gap}. ¡Presión, presión!',
      '¡A {gap} del de adelante! Metele presión, {driver}.',
      'Está a tiro, {gap}. ¡Vamos que se puede!',
      '¡El de adelante está ahí nomás! ¡A buscarlo!',
    ],
    standard: [
      'Auto de adelante a {gap}, le descontás {rate} por vuelta.',
      'Diferencia con el de adelante: {gap}, bajando {rate} por vuelta.',
      'Estás a {gap} del auto de adelante y le ganás {rate} por vuelta, {driver}.',
      'Te acercás {rate} por vuelta al de adelante. Diferencia de {gap}.',
      'Auto de adelante a {gap} segundos. Seguí presionando.',
      'El de adelante está a {gap}, {driver}. Buscá la oportunidad.',
      'Diferencia de {gap} con el auto de adelante. Atacá.',
      'A {gap} del auto de adelante. Mantené el ritmo.',
      'Auto de adelante al alcance. Seguí presionando, {driver}.',
    ],
  },
  rival_attack_drs: {
    bono: [
      'DRS sobre el de adelante, a {gap}. Le descontás {rate} por vuelta.',
      'Ok, tenés DRS. {gap} y bajando {rate} por vuelta, {driver}.',
      'Con DRS, a {gap}, y le sacás {rate} por vuelta al de adelante.',
      'DRS disponible. Te acercás {rate} por vuelta, estás a {gap}.',
      'DRS sobre el auto de adelante, a {gap}, {driver}.',
      'Ok, tenés DRS. El de adelante está a {gap}.',
      'A {gap} con DRS. Usalo bien.',
      'Tenés el DRS sobre el de adelante, a {gap}. Paciencia.',
      'DRS sobre el de adelante, {driver}.',
    ],
    colapinto: [
      '¡DRS, {driver}! Está a {gap} y le descontás {rate} por vuelta.',
      '¡Tenés DRS y te acercás {rate} por vuelta! Está a {gap}, ¡vamos!',
      'A {gap} con DRS, bajando {rate} por vuelta. ¡Atacalo!',
      '¡{rate} por vuelta más rápido y con DRS! Lo tenés a {gap}.',
      '¡DRS sobre el de adelante, a {gap}! ¡A buscarlo, {driver}!',
      '¡Tenés DRS! Lo tenés a {gap}, ¡dale!',
      'A {gap} y con DRS. ¡Abrilo en la recta y atacá!',
      '¡DRS! El de adelante a {gap}, ¡vamos!',
      '¡Tenés DRS sobre el de adelante, {driver}! ¡Vamos!',
    ],
    standard: [
      'DRS sobre el auto de adelante, a {gap}, descontando {rate} por vuelta.',
      'Tenés DRS, {driver}. Diferencia de {gap}, le descontás {rate} por vuelta.',
      'Con DRS a {gap} del de adelante y ganando {rate} por vuelta.',
      'Te acercás {rate} por vuelta con DRS. El de adelante está a {gap}.',
      'DRS sobre el auto de adelante, a {gap} segundos.',
      'Estás en rango de DRS, {driver}. El de adelante a {gap}.',
      'Tenés DRS sobre el de adelante. Diferencia de {gap}.',
      'A {gap} del auto de adelante con DRS. Usalo en la zona de activación.',
      'En rango de DRS del auto de adelante, {driver}.',
    ],
  },
  qualy_traffic: {
    bono: [
      'Auto a {gap} adelante, {driver}. Abrí hueco antes de lanzar.',
      'Ok, tráfico a {gap}. Levantá y hacé espacio.',
      'Tenés un auto a {gap}. Dejá distancia.',
      '{gap} al auto de adelante. Necesitás más espacio.',
      'Tráfico adelante, {driver}. Abrí hueco.',
    ],
    colapinto: [
      '¡Hay un auto a {gap}, {driver}! Levantá y abrí hueco.',
      'Ojo, tráfico a {gap} adelante. ¡Hacete lugar antes de lanzar!',
      'Muy cerca el de adelante, {gap}. ¡Dejalo ir un poco!',
      '{gap} nomás al de adelante. Bajá el ritmo y armá el hueco.',
      '¡Tráfico adelante! Abrí espacio antes de lanzar.',
    ],
    standard: [
      'Auto adelante a {gap} segundos. Levantá y abrí un hueco.',
      'Tráfico a {gap}, {driver}. Generá espacio antes de la vuelta rápida.',
      'Hay un auto a {gap} en pista. Dejá distancia para lanzar.',
      'Diferencia de {gap} con el auto de adelante. Necesitás más espacio.',
      'Tráfico adelante en la vuelta de salida. Abrí un hueco.',
    ],
  },
  qualy_clean_air: {
    bono: [
      'Pista libre adelante, {driver}. Preparate para lanzar.',
      'Ok, sin tráfico. Gomas listas y a la vuelta.',
      'Tenés aire limpio para la vuelta rápida.',
      'Despejado adelante. Buena salida de la última curva.',
    ],
    colapinto: [
      '¡Pista libre, {driver}! Gomas listas y ¡a fondo!',
      'No hay nadie adelante. ¡Preparate para la vuelta!',
      '¡Aire limpio! Calentá bien las gomas y largá la vuelta.',
      'Todo despejado. ¡Salí bien de la última y dale!',
    ],
    standard: [
      'Pista despejada adelante. Prepará las gomas y lanzá la vuelta.',
      'Sin tráfico para la vuelta rápida, {driver}.',
      'Aire limpio adelante. Empujá desde la última curva.',
      'Tenés pista libre. Llevá las gomas a temperatura y lanzá.',
    ],
  },
  qualy_traffic_ahead: {
    bono: [
      'Auto lento adelante, lo alcanzás en {reach} segundos.',
      'Tráfico adelante, en {reach} segundos lo tenés. Atento.',
      'Vuelta lenta adelante, lo agarrás en {reach}.',
      'En {reach} segundos alcanzás a un auto lento.',
      'Auto lento adelante, atento.',
    ],
    colapinto: [
      '¡Auto lento adelante, lo alcanzás en {reach} segundos!',
      '¡Tráfico, en {reach} lo tenés! ¡Atento!',
      '¡En {reach} segundos agarrás a uno lento! ¡Cuidado!',
      '¡Uno no lanzado, lo alcanzás en {reach}!',
      '¡Auto lento adelante, ojo!',
    ],
    standard: [
      'Auto lento adelante, llegás en {reach} segundos.',
      'Tráfico adelante, lo alcanzás en {reach} segundos. Atención.',
      'Auto en vuelta lenta, llegás en {reach} segundos.',
      'En {reach} segundos alcanzás a un auto lento en pista.',
      'Auto lento en pista adelante. No está en vuelta rápida.',
    ],
  },
  qualy_traffic_ahead_now: {
    bono: [
      'Auto lento justo adelante. Atento.',
      'Tráfico encima ya, cuidado.',
      'Auto lento ahí nomás adelante, atento a dónde va.',
    ],
    colapinto: [
      '¡Auto lento ahí adelante! ¡Cuidado!',
      '¡Tráfico encima! ¡Atento!',
      '¡Uno lento justo adelante! ¡Cuidado!',
    ],
    standard: [
      'Auto lento justo adelante. Tené cuidado.',
      'Tráfico encima, atención.',
      'Un auto lento justo adelante. Atento a dónde va.',
    ],
  },
  race_slow_car_ahead: {
    bono: [
      'Auto lento adelante, lo alcanzás en {reach} segundos.',
      'Uno lento en pista, en {reach} segundos lo tenés.',
      'Auto lento más adelante, llegás en {reach}.',
      'Auto lento adelante. Atento al llegar.',
    ],
    colapinto: [
      '¡Auto lento adelante, lo tenés en {reach}!',
      '¡Uno muy lento, {reach} segundos! ¡Cuidado!',
      '¡Auto lento en pista, llegás en {reach}! ¡Atento!',
      '¡Auto lento adelante! ¡Atento!',
    ],
    standard: [
      'Auto lento adelante, llegás en {reach} segundos.',
      'Auto lento en pista, a {reach} segundos.',
      'Auto lento más adelante, llegás en {reach} segundos. Atención.',
      'Auto lento en pista adelante. Atención.',
    ],
  },
  race_stopped_car_ahead: {
    bono: [
      'Auto parado adelante, llegás en {reach} segundos.',
      'Uno parado en pista, en {reach} segundos lo tenés.',
      'Auto parado más adelante, a {reach} segundos.',
      'Auto parado en pista adelante. Atento.',
    ],
    colapinto: [
      '¡Auto parado adelante, llegás en {reach}! ¡Cuidado!',
      '¡Uno parado, {reach} segundos! ¡Atento!',
      '¡Auto parado en pista, a {reach} segundos!',
      '¡Auto parado adelante! ¡Cuidado!',
    ],
    standard: [
      'Auto parado adelante, lo alcanzás en {reach} segundos.',
      'Un auto parado en pista, a {reach} segundos.',
      'Auto detenido más adelante, llegás en {reach} segundos. Atención.',
      'Hay un auto parado en pista adelante. Atención.',
    ],
  },
  race_slow_car_ahead_now: {
    bono: [
      'Auto lento ahí nomás. Atento.',
      'Uno lento justo enfrente, cuidado.',
      'Auto lento encima ya. Atento.',
    ],
    colapinto: [
      '¡Auto lento justo enfrente! ¡Cuidado!',
      '¡Uno lento ahí nomás! ¡Atento!',
      '¡Auto lento encima! ¡Cuidado!',
    ],
    standard: [
      'Auto lento justo enfrente. Atención.',
      'Hay un auto lento ahí adelante. Tené cuidado.',
      'Auto lento encima ya, atención.',
    ],
  },
  race_car_behind: {
    bono: [
      'Auto viniendo atrás, te alcanza en {reach} segundos.',
      'Auto rápido atrás, a {reach} segundos de vos.',
      'Tráfico atrás, te agarra en {reach} segundos.',
      'Auto viniendo atrás. Fuera de la línea.',
    ],
    colapinto: [
      '¡Auto viniendo, te alcanza en {reach}! ¡Cuidado!',
      '¡Auto atrás, {reach} segundos! ¡Mantené la línea!',
      '¡Tráfico atrás, te agarra en {reach}! ¡Atento!',
      '¡Auto viniendo atrás! ¡Cuidado!',
    ],
    standard: [
      'Viene un auto atrás, llega en {reach} segundos.',
      'Auto acercándose atrás, a {reach} segundos.',
      'Tráfico atrás, llega en {reach} segundos. Atención.',
      'Viene un auto atrás. Dejá libre la línea.',
    ],
  },
  race_car_behind_two: {
    bono: [
      'Dos autos viniendo, te alcanzan en {reach} segundos.',
      'Dos autos atrás, a {reach} segundos.',
      'Dos autos acercándose, llegan en {reach} segundos.',
      'Dos autos viniendo atrás. Fuera de la línea.',
    ],
    colapinto: [
      '¡Dos autos, te alcanzan en {reach}! ¡Cuidado!',
      '¡Dos atrás, {reach} segundos! ¡Mantené la línea!',
      '¡Vienen dos, llegan en {reach}! ¡Atento!',
      '¡Dos autos viniendo! ¡Cuidado!',
    ],
    standard: [
      'Vienen dos autos atrás, llegan en {reach} segundos.',
      'Dos autos acercándose, a {reach} segundos.',
      'Dos autos atrás, llegan en {reach} segundos. Atención.',
      'Vienen dos autos atrás. Dejá libre la línea.',
    ],
  },
  race_car_behind_now: {
    bono: [
      'Auto justo atrás ya. Mantené la línea.',
      'Auto encima, atrás. Cuidado.',
      'Lo tenés encima ya, sé predecible.',
    ],
    colapinto: [
      '¡Auto justo atrás! ¡Mantené la línea!',
      '¡Lo tenés encima! ¡Cuidado!',
      '¡Ahí atrás, encima! ¡Atento!',
    ],
    standard: [
      'Hay un auto justo atrás. Mantené la línea.',
      'Auto encima ahora, atención.',
      'Lo tenés encima. Sé predecible.',
    ],
  },
  race_car_behind_close: {
    bono: [
      'Ya te alcanza, mantené la línea.',
      'Ahí llega, sé predecible.',
      'Encima ya. Tranquilo.',
    ],
    colapinto: [
      '¡Ya llega! ¡Mantené la línea!',
      '¡Ahí viene! ¡Cuidado!',
      '¡Encima ya! ¡Atento!',
    ],
    standard: [
      'El auto ya te alcanza. Mantené la línea.',
      'Ahí llega ahora. Sé predecible.',
      'Ya lo tenés encima. Atención.',
    ],
  },
  race_car_behind_clear: {
    bono: [
      'Libre, ya pasó.',
      'Libre atrás. A recuperar ritmo.',
      'Pasó. Libre atrás.',
    ],
    colapinto: [
      '¡Ya pasó, libre!',
      '¡Todo libre! ¡Dale!',
      '¡Pasó! ¡Libre atrás!',
    ],
    standard: [
      'Libre, el auto ya pasó.',
      'Libre atrás. Recuperá el ritmo.',
      'Ya pasó. Libre.',
    ],
  },
  race_pit_exit_traffic: {
    bono: [
      'Auto pasando por la salida de boxes, cuidado al salir.',
      'Tráfico en la salida de boxes. Cuidado al entrar a pista.',
      'Auto en pista en la salida. Ojo la línea blanca.',
    ],
    colapinto: [
      '¡Auto en la salida de boxes! ¡Cuidado al salir!',
      '¡Tráfico pasando la salida! ¡Atento!',
      '¡Auto en pista en la salida! ¡Cuidado!',
    ],
    standard: [
      'Viene un auto por la salida de boxes. Cuidado al salir.',
      'Tráfico en la salida de boxes, atención al salir.',
      'Auto en pista en la salida. Respetá la línea blanca.',
    ],
  },
  qualy_pit_exit_traffic: {
    bono: [
      'Auto lanzado llegando a la salida de boxes, cuidado al salir.',
      'Viene uno lanzado por la salida. Cuidado.',
      'Atento a la salida, viene uno lanzado.',
    ],
    colapinto: [
      '¡Uno lanzado en la salida de boxes! ¡Cuidado!',
      '¡Viene uno rápido por la salida! ¡Atento!',
      '¡Auto lanzado en la salida! ¡Cuidado al salir!',
    ],
    standard: [
      'Un auto lanzado llega a la salida de boxes. Cuidado al salir.',
      'Auto en vuelta rápida por la salida. Incorporate con cuidado.',
      'Tráfico en la salida de boxes, un auto lanzado.',
    ],
  },
  qualy_deleted_lap: {
    bono: [
      'Vuelta anulada, {driver}. No cuenta.',
      'Ok, vuelta inválida. Levantá y preparamos la próxima.',
      'Esa vuelta no vale. Enfriá y volvemos a intentar.',
    ],
    colapinto: [
      '¡Vuelta anulada, {driver}! Levantá y vamos con la próxima.',
      'Esa no cuenta. ¡Tranqui, armamos otra!',
      '¡Nos borraron la vuelta! Aflojá y preparamos la siguiente.',
    ],
    standard: [
      'Vuelta inválida. No va a contar.',
      'Te anularon la vuelta, {driver}. Levantá y prepará la siguiente.',
      'Esa vuelta no cuenta. Recargá y preparate para otro intento.',
    ],
  },
  qualy_session_time: {
    bono: [
      'Menos de {minutes} minutos, {driver}. Cruzá la línea antes de la bandera.',
      'Ok, quedan menos de {minutes} minutos de sesión.',
      'Menos de {minutes} minutos. Llegá a la línea a tiempo.',
      'Se termina el tiempo, {driver}. Cruzá la línea antes de la bandera.',
    ],
    colapinto: [
      '¡Quedan menos de {minutes} minutos, {driver}! Que no se te pase la bandera.',
      'Menos de {minutes} minutos en el reloj. ¡A tiempo a la línea!',
      'Quedan menos de {minutes} minutos. ¡No te quedes sin vuelta!',
      '¡Se acaba el reloj, {driver}! Llegá a la línea a tiempo.',
    ],
    standard: [
      'Quedan menos de {minutes} minutos. Cruzá la línea antes del final.',
      'Menos de {minutes} minutos en la sesión, {driver}. Atento al reloj.',
      'Reloj: menos de {minutes} minutos. Hay que cruzar la línea a tiempo.',
      'Queda muy poco tiempo. Cruzá la línea antes de la bandera.',
    ],
  },
  qualy_session_time_garage: {
    bono: [
      'Menos de {minutes} minutos, {driver}. Salimos para el último intento.',
      'Ok, quedan menos de {minutes} minutos. Hora de salir.',
      'Menos de {minutes} minutos en el reloj. Vamos a pista.',
      'Se acaba la sesión, {driver}. Salimos para el último intento.',
    ],
    colapinto: [
      '¡Menos de {minutes} minutos, {driver}! ¡A pista para el último intento!',
      'Quedan menos de {minutes} minutos. ¡Vamos, salimos!',
      'Menos de {minutes} minutos, es ahora o nunca. ¡A la pista!',
      '¡Se termina el tiempo, {driver}! ¡Salimos ya!',
    ],
    standard: [
      'Menos de {minutes} minutos. Hora de salir al último intento.',
      'Quedan menos de {minutes} minutos, {driver}. Salimos a pista.',
      'Menos de {minutes} minutos de sesión. Último intento, a pista.',
      'Queda poco tiempo de sesión. Salimos para el último intento.',
    ],
  },
  qualy_elimination_danger: {
    bono: [
      'P{position}, zona de eliminación, menos de {minutes} minutos, {driver}.',
      'Ok, estamos P{position} y afuera. Quedan menos de {minutes} minutos.',
      'Menos de {minutes} minutos y P{position}, en zona de eliminación.',
      'P{position}, en zona de eliminación, {driver}.',
      'Ok, P{position}. Ahora mismo quedamos afuera.',
      'Estamos en zona de eliminación, {driver}. Hay que mejorar.',
    ],
    colapinto: [
      '¡P{position} y afuera, {driver}! Menos de {minutes} minutos, hay que mejorar.',
      'Menos de {minutes} minutos y estamos P{position}, en zona de eliminación. ¡Vamos!',
      'P{position} con menos de {minutes} minutos. ¡Necesitamos una vuelta!',
      '¡Estamos P{position}, en zona de eliminación, {driver}!',
      'P{position}, así quedamos afuera. ¡A mejorar!',
      '¡Estamos en zona de eliminación! Hay que meter una vuelta.',
    ],
    standard: [
      'P{position}, en zona de eliminación, con menos de {minutes} minutos.',
      'Quedan menos de {minutes} minutos y estamos P{position}, {driver}. Hay que mejorar.',
      'Zona de eliminación: P{position}, menos de {minutes} minutos.',
      'P{position}, en zona de eliminación. Hay que mejorar el tiempo.',
      'Estamos P{position}, {driver}. Así quedamos eliminados.',
      'Estamos en zona de eliminación. Necesitamos mejorar.',
    ],
  },
  qualy_elimination_bubble: {
    bono: [
      'P{position}, el último que pasa, {driver}. Menos de {minutes} minutos.',
      'Ok, P{position}, justo en el corte. Quedan menos de {minutes} minutos.',
      'Menos de {minutes} minutos y P{position}. No estamos a salvo.',
      'P{position}, justo en el corte, {driver}.',
      'Ok, P{position}. Pasamos por poco, no es seguro.',
      'Estamos justo en el corte, {driver}. No estamos a salvo.',
    ],
    colapinto: [
      '¡P{position}, justito en el corte, {driver}! Menos de {minutes} minutos.',
      'Menos de {minutes} minutos y P{position}, el último que pasa. ¡A asegurarlo!',
      'P{position} con menos de {minutes} minutos. ¡Si alguien mejora, quedamos afuera!',
      '¡P{position}, en el filo, {driver}! No estamos a salvo.',
      'P{position}, el último que pasa. ¡Hay que mejorar!',
      '¡Estamos en el corte, {driver}! Si alguien mejora, quedamos afuera.',
    ],
    standard: [
      'P{position}, la última posición que pasa, con menos de {minutes} minutos.',
      'Menos de {minutes} minutos y estamos P{position}, {driver}. Riesgo de quedar afuera.',
      'Justo en el corte: P{position}, quedan menos de {minutes} minutos.',
      'P{position}, justo en el corte. No estamos a salvo.',
      'Somos P{position}, el último que pasa, {driver}. Hay riesgo.',
      'Somos el último auto que pasa. No estamos a salvo.',
    ],
  },
  qualy_lap_pole: {
    bono: [
      'Pole provisional, {driver}. {pole_gap} sobre el segundo.',
      'Ok, P1 por {pole_gap}. Muy bien.',
      'Pole provisional, con {pole_gap} de margen.',
      'Pole provisional, {driver}.',
      'Ok, estamos P1. Bien hecho.',
    ],
    colapinto: [
      '¡Pole provisional, {driver}! ¡{pole_gap} de ventaja!',
      '¡P1 por {pole_gap}! ¡Qué vuelta!',
      '¡Estamos arriba de todos por {pole_gap}! ¡Vamos!',
      '¡Pole provisional, {driver}! ¡Qué vueltón!',
      '¡P1, P1! ¡Vamos!',
    ],
    standard: [
      'Pole provisional. {pole_gap} de ventaja sobre el segundo.',
      'P1, {driver}, por {pole_gap}.',
      'Primer lugar provisional con {pole_gap} de margen.',
      'Estás en la pole provisional, {driver}.',
      'P1 provisional. Gran vuelta.',
    ],
  },
  qualy_lap_result: {
    bono: [
      'P{position}, a {pole_gap} de la pole, {driver}.',
      'Ok, eso es P{position}. {pole_gap} del primero.',
      'Mejoraste: P{position}, a {pole_gap} de la punta.',
      'P{position} con esa vuelta, {pole_gap} detrás de la pole.',
      'Eso nos pone P{position}, {driver}.',
      'Ok, mejora. P{position}.',
      'Vuelta mejorada, {driver}.',
    ],
    colapinto: [
      '¡P{position}, {driver}! A {pole_gap} de la pole.',
      '¡Mejoramos! P{position}, {pole_gap} del primero.',
      'Esa vuelta nos pone P{position}, a {pole_gap} de la punta. ¡Vamos!',
      '¡P{position}! Estamos a {pole_gap} de la pole, ¡se puede más!',
      '¡Mejoramos, {driver}! P{position}.',
      '¡Esa vuelta vale P{position}! ¡Vamos!',
      '¡Vuelta mejorada, {driver}! ¡Bien ahí!',
    ],
    standard: [
      'P{position}, a {pole_gap} de la pole.',
      'Esa vuelta te pone P{position}, {driver}. {pole_gap} detrás del primero.',
      'Mejora de tiempo: P{position}, a {pole_gap} de la punta.',
      'Estás P{position}, a {pole_gap} del mejor tiempo.',
      'Esa vuelta te pone P{position}.',
      'Mejoraste, {driver}. Ahora P{position}.',
      'Vuelta mejorada.',
    ],
  },
  qualy_lap_no_improvement: {
    bono: [
      'Sin mejora, {driver}. Estamos P{position}.',
      'Ok, esa no mejoró. Estás P{position}.',
      'No hubo mejora. Vamos P{position} por ahora.',
      'Esa vuelta no alcanzó. Estamos P{position}.',
      'Sin mejora en esa vuelta, {driver}.',
    ],
    colapinto: [
      'No mejoramos, {driver}. Estamos P{position}.',
      'Esa no salió, vamos P{position}. ¡Cabeza en la próxima!',
      'Sin mejora, P{position} por ahora. ¡Tranqui!',
      'P{position}, esa vuelta no mejoró el tiempo. ¡Seguimos!',
      'Esa vuelta no mejoró, {driver}. ¡Tranqui!',
    ],
    standard: [
      'Sin mejora. Estás P{position}.',
      'Esa vuelta no fue más rápida, {driver}. Estás en P{position}.',
      'No mejoraste el tiempo. Posición actual, P{position}.',
      'Vuelta sin mejora, vas P{position}.',
      'Esa vuelta no mejoró tu tiempo.',
    ],
  },
  track_limits_warnings: {
    bono: [
      '{count} advertencias por límites de pista, {driver}.',
      'Ok, van {count} avisos por límites. Adentro de las líneas.',
      'Ya son {count} advertencias. Las cuatro ruedas adentro.',
      'Límites de pista: {count} advertencias. Cuidado con las líneas blancas.',
      'Advertencia por límites de pista, {driver}.',
    ],
    colapinto: [
      '¡Van {count} advertencias por límites, {driver}! Adentro de las líneas blancas.',
      '¡Ojo, ya son {count} advertencias! Mantenelo dentro de la pista.',
      '{count} avisos por límites de pista, {driver}. ¡Las cuatro ruedas adentro!',
      '¡Otra advertencia, van {count}! Respetá las líneas blancas.',
      '¡Límites de pista, {driver}! Mantenelo adentro.',
    ],
    standard: [
      'Llevás {count} advertencias por límites de pista. Respetá las líneas blancas.',
      'Advertencia número {count} por límites de pista, {driver}.',
      '{count} advertencias por exceder los límites. Cuatro ruedas dentro de la pista.',
      'Van {count} avisos por límites de pista. Más margen con las líneas.',
      'Advertencia por límites de pista. Mantené el auto dentro de las líneas.',
    ],
  },
  penalties_incurred: {
    bono: [
      '{penalty_sec} segundos de penalización, {driver}.',
      'Ok, los comisarios nos dan {penalty_sec} segundos.',
      'Penalización de {penalty_sec} segundos. Seguimos.',
      'Penalización de tiempo, {driver}.',
    ],
    colapinto: [
      '¡Nos clavaron {penalty_sec} segundos, {driver}! Cabeza fría, seguimos.',
      'Penalización de {penalty_sec} segundos. ¡A recuperarlo en pista, vamos!',
      '{penalty_sec} segundos de sanción, {driver}. ¡Seguimos empujando!',
      '¡Nos penalizaron con tiempo, {driver}! A seguir.',
    ],
    standard: [
      'Penalización de {penalty_sec} segundos de los comisarios.',
      'Los comisarios te dieron {penalty_sec} segundos, {driver}.',
      'Tenemos {penalty_sec} segundos de penalización. Seguí con tu carrera.',
      'Penalización de tiempo de los comisarios, {driver}.',
    ],
  },
  penalty_drive_through: {
    bono: [
      'Drive-through, {driver}. Tres vueltas para cumplirlo.',
      'Ok, penalización de drive-through. Hay que cumplirla en tres vueltas.',
      'Nos dieron un drive-through. Plazo de tres vueltas.',
    ],
    colapinto: [
      '¡Drive-through, {driver}! Tenemos tres vueltas para pagarlo.',
      '¡Uh, drive-through! A cumplirlo dentro de tres vueltas.',
      'Nos dieron drive-through, {driver}. Tres vueltas de plazo, ¡seguimos!',
    ],
    standard: [
      'Penalización de drive-through. Hay que cumplirla dentro de tres vueltas.',
      'Drive-through para nosotros, {driver}. Plazo de tres vueltas.',
      'Los comisarios dieron un drive-through. Se cumple en las próximas tres vueltas.',
    ],
  },
  penalty_stop_go: {
    bono: [
      'Stop and go, {driver}. Tres vueltas para cumplirlo.',
      'Ok, penalización de stop and go. Hay que cumplirla en tres vueltas.',
      'Nos dieron un stop and go. Plazo de tres vueltas.',
    ],
    colapinto: [
      '¡Stop and go, {driver}! Tres vueltas para pagarlo.',
      '¡Uh, nos dieron stop and go! Hay que cumplirlo en tres vueltas.',
      'Stop and go para nosotros, {driver}. ¡Cabeza fría, tres vueltas de plazo!',
    ],
    standard: [
      'Penalización de stop and go. Hay que cumplirla dentro de tres vueltas.',
      'Stop and go, {driver}. Plazo de tres vueltas para cumplirlo.',
      'Stop and go de los comisarios. Se cumple en tres vueltas.',
    ],
  },
  weather_rain: {
    bono: [
      '{rain_pct} por ciento de lluvia en {minutes} minutos, {driver}.',
      'Ok, radar: {rain_pct} por ciento de probabilidad de lluvia en {minutes} minutos.',
      'Posible lluvia en {minutes} minutos, {rain_pct} por ciento. Por ahora, seco.',
      '{rain_pct} por ciento de probabilidad de lluvia, {driver}.',
      'Ok, el radar marca lluvia, {rain_pct} por ciento.',
      'Se puede venir la lluvia, {driver}. Atento.',
    ],
    colapinto: [
      '¡Ojo, {driver}! {rain_pct} por ciento de lluvia en {minutes} minutos.',
      'Se viene agua: {rain_pct} por ciento en {minutes} minutos.',
      'El radar marca lluvia en {minutes} minutos, {rain_pct} por ciento. ¡Atento!',
      '¡Ojo con la lluvia! {rain_pct} por ciento de probabilidad.',
      '{rain_pct} por ciento de lluvia en el radar, {driver}.',
      '¡Puede llover pronto, {driver}! Atento al agarre.',
    ],
    standard: [
      'Pronóstico: {rain_pct} por ciento de probabilidad de lluvia en {minutes} minutos.',
      'Lluvia posible en {minutes} minutos, {driver}. Probabilidad del {rain_pct} por ciento.',
      'El radar da {rain_pct} por ciento de lluvia dentro de {minutes} minutos.',
      'Probabilidad de lluvia del {rain_pct} por ciento, {driver}.',
      'El radar marca {rain_pct} por ciento de probabilidad de lluvia.',
      'Hay lluvia en el pronóstico. Por ahora la pista sigue seca.',
    ],
  },
  sector_delta: {
    bono: [
      'Perdiste {delta} en el sector {sector}, {driver}.',
      'Ok, sector {sector}, {delta} más lento que tu mejor.',
      'En el {sector} perdimos {delta} contra tu mejor parcial.',
      'Sector {sector} con {delta} de pérdida. Prolijo la próxima.',
      '{delta} cedidos en el sector {sector}. Se puede recuperar.',
      'Se perdió tiempo en ese sector, {driver}.',
    ],
    colapinto: [
      'Se nos fueron {delta} en el sector {sector}, {driver}. ¡A recuperarlos!',
      'Sector {sector}, {delta} más lento que tu mejor. ¡Vos podés más!',
      'En el parcial {sector} dejamos {delta}. ¡La próxima más fina!',
      '{delta} perdidos en el sector {sector}. Tranqui, se arregla.',
      '¡Ojo con el sector {sector}! {delta} arriba de tu mejor.',
      'Perdimos un poco en ese sector, {driver}. ¡A recuperarlo!',
    ],
    standard: [
      'Sector {sector}: {delta} segundos más lento que tu mejor parcial.',
      'El parcial {sector} costó {delta}, {driver}. Hay margen para la próxima vuelta.',
      'El sector {sector} fue {delta} más lento que tu referencia.',
      '{delta} de pérdida en el sector {sector} respecto a tu mejor.',
      'Ese parcial fue más lento que tu mejor, {driver}.',
    ],
  },
  teammate_ahead: {
    bono: [
      'Tu compañero está adelante, a {gap}, {driver}. Limpio.',
      'Ok, compañero a {gap} segundos. Sin contacto.',
      'El de adelante es tu compañero, a {gap}. Con respeto.',
      'Compañero de equipo a {gap}. Nada de toques.',
      'Tu compañero está adelante, {driver}. Sin contacto.',
    ],
    colapinto: [
      'Tenés a tu compañero a {gap}, {driver}. ¡Limpito, sin toques!',
      'El de adelante es tu compañero, a {gap} segundos. ¡Cuidado con los toques!',
      'Compañero a {gap}. Cuidado, que somos del mismo equipo.',
      '¡Ojo que adelante, a {gap}, va tu compañero! Nada de contacto.',
      '¡Tu compañero adelante, {driver}! Sin tocarse, eh.',
    ],
    standard: [
      'Tu compañero de equipo está adelante, a {gap} segundos. Sin contacto.',
      'Compañero a {gap}, {driver}. Mantené la distancia en las frenadas.',
      'A {gap} tenés a tu compañero. Cero riesgos con él.',
      'Tu compañero va a {gap} adelante. Cuidado con el contacto.',
      'Compañero de equipo adelante. Evitá cualquier contacto.',
    ],
  },
  teammate_pitting: {
    bono: [
      'Tu compañero entró a boxes, {driver}.',
      'Ok, el compañero entró a la calle de boxes.',
      'Compañero en la calle de boxes.',
    ],
    colapinto: [
      '¡Tu compañero está entrando a boxes, {driver}!',
      'Tu compañero se fue a boxes.',
      'El compañero está en la calle de boxes.',
    ],
    standard: [
      'Tu compañero de equipo está en boxes.',
      'Tu compañero entra a la calle de boxes, {driver}.',
      'Tu compañero está pasando por boxes.',
    ],
  },
  teammate_doublestack: {
    bono: [
      'Doble parada, {driver}. Puede haber una breve espera.',
      'Ok, compañero en el box. Doble parada, posible espera.',
      'Paramos detrás de tu compañero. Doble parada.',
    ],
    colapinto: [
      '¡Doble parada, {driver}! Tu compañero está en el box.',
      '¡Ojo, doble parada! Puede que esperemos un toque.',
      'Tu compañero está adelante en boxes. ¡Doble parada, paciencia!',
    ],
    standard: [
      'Doble parada. Tu compañero está en el box, posible espera.',
      'Parada doble con tu compañero, {driver}. Puede haber una breve espera.',
      'Tu compañero todavía está en el box. Doble parada.',
    ],
  },
  pit_clean_air: {
    bono: [
      'Si paramos, salimos en aire limpio, {driver}.',
      'Ok, hay un hueco a la salida de boxes. Buena opción para el undercut.',
      'Parar nos deja en aire limpio. Es una opción.',
      'Tenemos aire limpio para salir de boxes. Undercut posible.',
      'Si paramos, salimos P{position} en aire limpio, {driver}.',
      'Ok, una parada nos deja P{position} y en aire limpio.',
      'Parar nos deja en P{position}, con aire limpio. Es una opción.',
      'Hay hueco a la salida de boxes. P{position} y aire limpio.',
    ],
    colapinto: [
      '¡Si paramos salimos en aire limpio, {driver}! Linda para el undercut.',
      'Hay un hueco bárbaro a la salida de boxes. ¡Podemos intentar el undercut!',
      'Aire limpio si entramos. ¿Vamos por el undercut?',
      'Ojo, se abrió un hueco para salir de boxes. Es una opción, {driver}.',
      'Si entramos, salimos P{position} con aire limpio. ¡Linda para el undercut!',
      '¡Hay hueco a la salida! Volvemos P{position} en aire limpio.',
      'Aire limpio si paramos, {driver}. ¡Salimos P{position}!',
      '¿Vamos por el undercut? Salimos P{position} con aire limpio.',
    ],
    standard: [
      'Una parada nos deja en aire limpio. Buena oportunidad para el undercut.',
      'Hay aire limpio a la salida de boxes, {driver}. La parada es una opción.',
      'Si paramos, reingresamos sin tráfico. Opción de undercut.',
      'Estamos en la ventana y hay hueco para salir. Podemos parar.',
      'Una parada nos deja P{position} en aire limpio.',
      'Si paramos, reingresamos P{position} con aire limpio, {driver}.',
      'Hay aire limpio para salir de boxes en P{position}. La parada es una opción.',
      'Salida de boxes en P{position} y en aire limpio. Podemos parar.',
    ],
  },
  ers_fault: {
    bono: [
      'Falla de ERS, {driver}. Sin potencia eléctrica.',
      'Ok, perdimos el ERS. Solo motor térmico.',
      'El ERS no funciona. No hay despliegue eléctrico.',
    ],
    colapinto: [
      '¡Falla en el ERS, {driver}! Nos quedamos sin eléctrico.',
      '¡Se cayó el ERS! No hay despliegue, solo el térmico.',
      '¡Problema de ERS! Manejá sin la parte eléctrica.',
    ],
    standard: [
      'Falla en el ERS. No hay despliegue eléctrico.',
      'El sistema ERS dejó de funcionar, {driver}. Sin potencia eléctrica.',
      'ERS fuera de servicio. Corremos solo con el motor térmico.',
    ],
  },
  aero_fault: {
    bono: [
      'Falla en el alerón móvil, {driver}. No abre.',
      'Ok, el alerón móvil no responde.',
      'Problema de aerodinámica activa. El alerón no se abre.',
    ],
    colapinto: [
      '¡Falla en el alerón móvil, {driver}! No se abre.',
      '¡Se trabó el alerón! No podemos abrirlo.',
      '¡Ojo, el alerón no abre! Falla en el sistema.',
    ],
    standard: [
      'Falla en el alerón móvil. No se puede abrir.',
      'El sistema de aerodinámica activa falló, {driver}. El alerón no abre.',
      'Alerón móvil fuera de servicio. Corremos sin apertura.',
    ],
  },
  rival_defend_override: {
    bono: [
      'El de atrás, a {gap}, tiene Override.',
      'Auto de atrás a {gap} con Override. Defendé la recta.',
      'Override atrás, a {gap}. Cubrí el interior.',
      'A {gap} el de atrás, en rango de Override.',
      'El auto de atrás tiene Override.',
    ],
    colapinto: [
      '¡Override atrás, a {gap}! ¡Cerrá la puerta!',
      '¡El de atrás a {gap}, con Override! ¡Cuidale la cuerda!',
      '¡A {gap} y con Override el de atrás! ¡Buena salida de curva!',
      '¡Con Override a {gap} atrás! ¡No le des lugar!',
      '¡El de atrás tiene Override! ¡Cuidale la cuerda!',
    ],
    standard: [
      'Auto de atrás a {gap}, con Override. Defendé.',
      'A {gap} el de atrás, con Override. Cuidá la salida de curva.',
      'Diferencia de {gap} con el de atrás, que tiene Override.',
      'A {gap} y con Override el auto de atrás. Defendé el interior.',
      'Auto de atrás en rango de Override. Defendé el interior.',
    ],
  },
  rival_attack_override: {
    bono: [
      'Override sobre el de adelante, a {gap}. Le descontás {rate} por vuelta.',
      'Ok, a {gap} y bajando {rate} por vuelta. Override listo.',
      'Le sacás {rate} por vuelta, está a {gap}. Usá el Override, {driver}.',
      'Te acercás {rate} por vuelta. A {gap}, tenés Override.',
      'Auto de adelante a {gap}, {driver}. Override disponible.',
      'Ok, a {gap} del de adelante. Modo recta y Override.',
      'Override listo, el de adelante está a {gap}.',
      'A {gap} con Override. Elegí bien dónde usarlo.',
      'Override disponible sobre el de adelante, {driver}.',
    ],
    colapinto: [
      '¡Le descontás {rate} por vuelta, {driver}! Está a {gap}, ¡Override y a buscarlo!',
      '¡Te acercás {rate} por vuelta! A {gap}, ¡modo recta y Override!',
      'A {gap} y bajando {rate} por vuelta. ¡Tirale el Override!',
      '¡{rate} por vuelta más rápido! Lo tenés a {gap}, usá el Override.',
      '¡El de adelante a {gap}, {driver}! ¡Override y vamos!',
      'Lo tenés a {gap}. ¡Modo recta y Override, dale!',
      '¡A {gap} con el Override listo! ¡A buscarlo!',
      'Está a tiro, {gap}. ¡Usá el Override en la recta!',
      '¡Tenés Override sobre el de adelante, {driver}! ¡Dale!',
    ],
    standard: [
      'Auto de adelante a {gap}, descontando {rate} por vuelta. Override disponible.',
      'Le descontás {rate} por vuelta al de adelante, {driver}. Está a {gap}, usá el Override.',
      'Diferencia de {gap}, bajando {rate} por vuelta. Modo recta y Override.',
      'Te acercás {rate} por vuelta al de adelante, a {gap}. Override listo.',
      'Auto de adelante a {gap} segundos. Override disponible.',
      'Estás en rango de Override, {driver}. El de adelante a {gap}.',
      'A {gap} del auto de adelante. Usá el modo recta y el Override.',
      'Diferencia de {gap} con el de adelante. Podés usar el Override.',
      'En rango de Override del auto de adelante, {driver}.',
    ],
  },
  race_finish: {
    bono: [
      'Bandera a cuadros, {driver}. P{position}. Vuelta de enfriamiento y al parque cerrado.',
      'Ok, bandera a cuadros, terminamos P{position}. Al parque cerrado.',
      'Fin de carrera en P{position}. Llevalo al parque cerrado.',
      'Bandera a cuadros. Al parque cerrado, {driver}.',
    ],
    colapinto: [
      'Bandera a cuadros, {driver}. P{position}, hoy no alcanzó. Al parque cerrado.',
      'Terminamos P{position}, bandera a cuadros. A seguir laburando, llevalo al parque cerrado.',
      'Bandera, P{position}. Vuelta tranquila y al parque cerrado, {driver}.',
      'Bandera a cuadros, {driver}. Llevalo al parque cerrado.',
    ],
    standard: [
      'Bandera a cuadros, P{position}. Vuelta de enfriamiento y al parque cerrado.',
      'Carrera terminada en P{position}, {driver}. Llevá el auto al parque cerrado.',
      'Final de carrera, P{position}. Seguí las indicaciones hasta el parque cerrado.',
      'Carrera terminada, {driver}. Llevá el auto al parque cerrado.',
    ],
  },
  race_finish_points: {
    bono: [
      'Bandera a cuadros. P{position}, buenos puntos, {driver}.',
      'Ok, P{position} y en los puntos. Al parque cerrado.',
      'Terminamos P{position}. Puntos para el equipo, bien hecho.',
      'Bandera a cuadros, en los puntos. Al parque cerrado, {driver}.',
    ],
    colapinto: [
      '¡Bandera a cuadros! ¡P{position} y sumamos puntos, {driver}!',
      '¡P{position}, en los puntos! ¡Bien ahí, vamos!',
      '¡Puntos, {driver}! P{position}, ¡bárbaro! Llevalo al parque cerrado.',
      '¡Sumamos puntos, {driver}! ¡Qué buena carrera!',
    ],
    standard: [
      'Bandera a cuadros, P{position}. Puntos sumados. Al parque cerrado.',
      'Terminaste P{position}, {driver}. Dentro de los puntos.',
      'P{position} al final. Buenos puntos, llevá el auto al parque cerrado.',
      'Carrera terminada con puntos, {driver}. Llevá el auto al parque cerrado.',
    ],
  },
  race_finish_podium: {
    bono: [
      'Bandera a cuadros. P{position}, es podio, {driver}. Gran carrera.',
      'Ok, P{position}. Podio. Muy bien hecho.',
      'Terminamos P{position}, en el podio. Al parque cerrado.',
      'Podio, {driver}. Gran trabajo.',
    ],
    colapinto: [
      '¡P{position}! ¡Podio, {driver}! ¡Qué carrera, vamos!',
      '¡Bandera a cuadros y P{position}! ¡Estamos en el podio!',
      '¡Podio, {driver}! P{position}, ¡qué carrerón!',
      '¡Podio, podio! ¡Vamos, {driver}!',
    ],
    standard: [
      'Bandera a cuadros en P{position}. Subís al podio.',
      'Terminaste P{position}, {driver}. Es un podio.',
      'P{position} y podio. Llevá el auto al parque cerrado.',
      'Es podio, {driver}. Llevá el auto al parque cerrado.',
    ],
  },
  race_finish_win: {
    bono: [
      'Bandera a cuadros. Ganaste, {driver}. Bien hecho.',
      'Ok, P1. Victoria. Gran carrera.',
      'Ganamos la carrera. Tranquilo hasta el parque cerrado.',
    ],
    colapinto: [
      '¡Ganamos, {driver}! ¡P1! ¡Qué carrera!',
      '¡Victoria! ¡Vamos, vamos, vamos!',
      '¡Bandera a cuadros y P1! ¡Sos un fenómeno, {driver}!',
    ],
    standard: [
      'Bandera a cuadros. P1, ganaste la carrera.',
      'Victoria, {driver}. Llevá el auto al parque cerrado.',
      'Ganaste la carrera. Gran trabajo de todo el equipo.',
    ],
  },
  inlap_traffic_behind: {
    bono: [
      'Auto lanzado atrás, te alcanza en {reach} segundos.',
      'Vuelta rápida detrás, te alcanza en {reach}. Correte.',
      'Auto lanzado detrás, en {reach} segundos lo tenés. Cedé el paso.',
      'En {reach} segundos te alcanza uno lanzado. Fuera de la línea.',
      'Auto en vuelta rápida detrás. Dejalo pasar.',
    ],
    colapinto: [
      '¡Auto lanzado atrás, te alcanza en {reach} segundos!',
      '¡Viene uno lanzado, en {reach} lo tenés encima! ¡Correte!',
      '¡En {reach} segundos te alcanza uno en vuelta rápida!',
      '¡Uno lanzado, te agarra en {reach}! Afuera de la trazada.',
      '¡Viene uno lanzado atrás! Dale paso.',
    ],
    standard: [
      'Viene uno lanzado, te alcanza en {reach} segundos.',
      'Vuelta rápida atrás, te alcanza en {reach} segundos.',
      'Auto lanzado atrás, llega en {reach} segundos. Cedé el paso.',
      'En {reach} segundos te alcanza un auto lanzado. Salí de la línea.',
      'Auto en vuelta rápida detrás. Cedé el paso de forma segura.',
    ],
  },
  inlap_traffic_behind_now: {
    bono: [
      'Lo tenés encima, salí de la línea.',
      'Auto lanzado justo atrás. Dejalo pasar ya.',
      'Ya está encima, uno lanzado. Correte.',
    ],
    colapinto: [
      '¡Lo tenés encima! ¡Salí de la línea!',
      '¡Uno lanzado justo atrás! ¡Correte ya!',
      '¡Ya te alcanza! ¡Dale paso!',
    ],
    standard: [
      'Auto lanzado justo detrás. Salí de la línea.',
      'Un auto en vuelta rápida te tiene encima. Cedé el paso.',
      'Auto lanzado pegado atrás. Correte con seguridad.',
    ],
  },
  inlap_traffic_behind_two: {
    bono: [
      'Dos lanzados atrás, te alcanzan en {reach} segundos.',
      'Vienen dos en vuelta rápida, en {reach} los tenés.',
      'Dos autos lanzados, llegan en {reach} segundos. Correte.',
      'Dos lanzados atrás. Dejalos pasar a los dos.',
    ],
    colapinto: [
      '¡Dos lanzados atrás, te alcanzan en {reach} segundos!',
      '¡Vienen dos lanzados, en {reach} los tenés encima!',
      '¡Dos rápidos, te agarran en {reach}! ¡Correte!',
      '¡Vienen dos lanzados atrás! ¡Dales paso!',
    ],
    standard: [
      'Dos autos lanzados, te alcanzan en {reach} segundos.',
      'Dos en vuelta rápida, llegan en {reach} segundos.',
      'En {reach} segundos te alcanzan dos lanzados. Cedé el paso.',
      'Dos autos en vuelta rápida detrás. Cedé el paso a ambos.',
    ],
  },
  inlap_traffic_close: {
    bono: [
      'Ya lo tenés encima, fuera de la línea.',
      'Está pegado atrás, dejalo pasar.',
      'Encima tuyo ahora, correte.',
    ],
    colapinto: [
      '¡Ya lo tenés encima! ¡Correte!',
      '¡Pegado atrás! ¡Dejalo pasar!',
      '¡Ahí está! ¡Fuera de la línea!',
    ],
    standard: [
      'Lo tenés encima ahora. Salí de la línea de carrera.',
      'El auto lanzado está pegado atrás. Cedé el paso.',
      'Ya está detrás tuyo. Correte con seguridad.',
    ],
  },
  inlap_traffic_clear: {
    bono: [
      'Libre, ya pasó.',
      'Libre atrás.',
      'Ya pasó, libre.',
    ],
    colapinto: [
      '¡Libre, ya pasó!',
      '¡Ya está, libre!',
      '¡Libre atrás!',
    ],
    standard: [
      'Libre, el auto ya pasó.',
      'Ya pasó. Libre atrás.',
      'Todo libre atrás.',
    ],
  },
  inlap_cooldown: {
    bono: [
      'Vuelta de enfriamiento, {driver}. Recargá la batería.',
      'Ok, vuelta lenta. Enfriá frenos y gomas.',
      'A boxes tranquilo. Recargá y enfriá los frenos.',
    ],
    colapinto: [
      'Vuelta de enfriamiento, {driver}. Recargá batería y traelo tranqui.',
      'Ahora a enfriar: frenos y gomas. Traelo despacio.',
      'Tranqui ahora. Cargá la batería y enfriá los frenos.',
    ],
    standard: [
      'Vuelta de enfriamiento. Recargá la batería y enfriá frenos y gomas.',
      'Enfriá el auto, {driver}. Llevalo tranquilo a boxes.',
      'Vuelta lenta a boxes. Recargá energía y bajá temperaturas.',
    ],
  },
  flags_rain_live: {
    bono: [
      'Empezó a llover, {driver}. Cuidado en las frenadas.',
      'Ok, cae lluvia en pista. El agarre va a cambiar.',
      'Lluvia en pista. Frená con margen.',
    ],
    colapinto: [
      '¡Está lloviendo, {driver}! Ojo en las frenadas.',
      '¡Empezó a caer agua! Cuidado que cambia el agarre.',
      '¡Llueve en la pista! Frená antes, el agarre cambia.',
    ],
    standard: [
      'Comenzó a llover en pista. Atención al agarre en las frenadas.',
      'Lluvia en el circuito, {driver}. El agarre está cambiando.',
      'Cae lluvia en pista. Cuidado en las zonas de frenada.',
    ],
  },
  tyre_crossover: {
    bono: [
      'Muy mojado para slicks, {driver}. Vamos a intermedias.',
      'Ok, la lluvia se queda. Ponemos intermedias.',
      'Se terminaron los slicks. Intermedias.',
      'Llueve y sigue. Cambiamos a gomas intermedias.',
    ],
    colapinto: [
      '¡Muy mojado para slicks, {driver}! ¡Vamos a intermedias!',
      '¡La lluvia no para! Ponemos intermedias.',
      '¡Chau slicks! Intermedias, {driver}.',
      '¡Está para intermedias! Cambiamos gomas.',
    ],
    standard: [
      'La pista está muy mojada para slicks. Vamos a intermedias.',
      'La lluvia se mantiene, {driver}. Cambiamos a gomas intermedias.',
      'Los slicks ya no sirven. Paramos por intermedias.',
    ],
  },
  tyre_crossover_slicks: {
    bono: [
      'La pista está seca, {driver}. Los slicks son una opción.',
      'Ok, ya hay línea seca. Podemos ir a slicks.',
      'Seco hace rato. Slicks disponibles si los querés.',
    ],
    colapinto: [
      '¡La pista se secó, {driver}! Podemos ir a slicks.',
      '¡Ya está para slicks! Si querés, cambiamos.',
      'Hace rato que no llueve. ¡Los slicks son una opción, eh!',
    ],
    standard: [
      'La pista lleva un rato seca. Los slicks son una opción.',
      'Condiciones secas, {driver}. Podemos cambiar a slicks.',
      'Ya se puede ir con slicks. La decisión es tuya.',
    ],
  },
  flags_sc_in: {
    bono: [
      'Safety Car adentro esta vuelta. Mantené el delta.',
      '{driver}, el Safety Car entra al final de esta vuelta. Calentá las gomas.',
      'Ok, el Safety Car entra esta vuelta. Preparate para el relanzamiento.',
      'Última vuelta del Safety Car. Delta positivo y temperatura en las gomas.',
    ],
    colapinto: [
      '¡Safety Car adentro esta vuelta, {driver}! Calentá gomas y frenos.',
      '¡Se va el Safety Car! Entra al final de esta vuelta, preparate.',
      '¡Ojo, el Safety Car entra esta vuelta! Cuidá el delta.',
      '¡Safety Car a boxes en esta vuelta! Listo para el relanzamiento, ¡dale!',
    ],
    standard: [
      'El Safety Car entra al final de esta vuelta. Delta positivo.',
      'Safety Car adentro esta vuelta, {driver}. Calentá las gomas para el relanzamiento.',
      'Esta vuelta se retira el Safety Car. Preparate para el relanzamiento.',
      'Safety Car a boxes esta vuelta. Delta positivo y gomas en temperatura.',
    ],
  },
  vsc_ending: {
    bono: [
      'El VSC termina. Mantené el delta, listo para acelerar.',
      '{driver}, fin del VSC en breve. Atento a la bandera verde.',
      'Ok, se termina el VSC. Delta positivo hasta que se libere.',
    ],
    colapinto: [
      '¡Se termina el VSC, {driver}! Preparate para salir a fondo.',
      '¡Atento que se va el VSC! Cuidá el delta hasta la verde.',
      '¡Termina el VSC! Delta positivo y listo para apretar.',
    ],
    standard: [
      'El VSC está por terminar. Mantené el delta positivo.',
      'Fin del VSC en breve, {driver}. Preparate para acelerar con la verde.',
      'Se termina el VSC. Respetá el delta hasta la bandera verde.',
    ],
  },
  flags_green: {
    bono: [
      'Bandera verde, bandera verde. A correr.',
      '{driver}, bandera verde. Se reanuda la carrera.',
      'Ok, bandera verde. Ritmo de carrera.',
      'Verde, verde. Pista libre, empujá.',
    ],
    colapinto: [
      '¡Bandera verde, bandera verde! ¡Dale a fondo!',
      '¡Verde, {driver}! ¡A correr de nuevo, vamos!',
      '¡Bandera verde! Se larga otra vez, ¡apretá!',
      '¡Verde, verde, verde! ¡Con todo!',
    ],
    standard: [
      'Bandera verde. Se reanuda la carrera, empujá.',
      'Bandera verde, {driver}. Volvemos a correr.',
      'Tenemos bandera verde. Carrera en marcha, a empujar.',
      'Bandera verde en pista. Ritmo de carrera otra vez.',
    ],
  },
  flags_blue: {
    bono: [
      'Banderas azules. Dejalo pasar.',
      'Bandera azul. Auto más rápido atrás, cedé el paso.',
      'Banderas azules. Dejá pasar al de atrás sin perder tiempo.',
      'Azul, azul. Te va a doblar, facilitale el paso.',
    ],
    colapinto: [
      '¡Banderas azules! Dejalo pasar limpio.',
      '¡Azules! Viene uno más rápido, dejale lugar.',
      '¡Bandera azul! Te dobla el de atrás, cedé sin drama.',
      '¡Banderas azules! Dejalo pasar y seguimos con lo nuestro.',
    ],
    standard: [
      'Banderas azules. Auto más rápido atrás, dejalo pasar.',
      'Bandera azul. Cedé el paso al auto que te dobla.',
      'Banderas azules para vos. Facilitá el paso al de atrás.',
      'Te están doblando, banderas azules. Dejá pasar limpio.',
    ],
  },
  flags_blue_two: {
    bono: [
      'Banderas azules, son dos. Dejalos pasar a los dos.',
      'Banderas azules. Vienen dos, dejalos pasar.',
      'Dos autos te doblan, banderas azules. Cedé a los dos.',
    ],
    colapinto: [
      '¡Banderas azules, son dos! ¡Dejalos pasar!',
      '¡Vienen dos atrás, azules! ¡Dales lugar a los dos!',
      '¡Bandera azul para dos autos! ¡Dejalos ir!',
    ],
    standard: [
      'Banderas azules, dos autos para dejar pasar.',
      'Banderas azules. Dos autos más rápidos atrás, cedé a los dos.',
      'Te doblan dos autos. Banderas azules, dejalos pasar.',
    ],
  },
  flags_blue_clear: {
    bono: [
      'Libre atrás.',
      'Listo, libre atrás.',
      'Libre. Volvé a tu carrera.',
    ],
    colapinto: [
      '¡Libre! ¡A lo nuestro!',
      '¡Libre atrás, dale!',
      '¡Listo, libre! ¡Seguimos!',
    ],
    standard: [
      'Libre atrás, volvé a tu ritmo.',
      'Todo libre atrás. Seguimos con lo nuestro.',
      'Ya tenés la pista libre atrás.',
    ],
  },
  flags_yellow: {
    bono: [
      'Bandera amarilla. Cuidado, listo para levantar.',
      '{driver}, amarilla. Sin adelantar.',
      'Ok, bandera amarilla en tu zona. Prudencia.',
      'Amarilla, amarilla. Levantá si hace falta.',
    ],
    colapinto: [
      '¡Bandera amarilla, {driver}! Ojo, nada de adelantar.',
      '¡Amarilla! Levantá un toque y atento.',
      '¡Ojo, bandera amarilla! Cuidado y sin pasar a nadie.',
      '¡Bandera amarilla en tu zona! Pie listo para levantar.',
    ],
    standard: [
      'Bandera amarilla. Precaución y no adelantes.',
      'Bandera amarilla, {driver}. Preparate para levantar.',
      'Amarilla en tu zona. Cuidado, sin adelantamientos.',
      'Tenemos bandera amarilla. Reducí y atento a la pista.',
    ],
  },
  wrong_way: {
    bono: [
      'Vas en sentido contrario, {driver}. Pará el auto.',
      'Ok, estás a contramano. Pegá la vuelta con cuidado.',
      'Sentido contrario. Frená y girá con seguridad.',
    ],
    colapinto: [
      '¡Estás a contramano, {driver}! ¡Pará o pegá la vuelta!',
      '¡Sentido contrario! Frená ya y girá con cuidado.',
      '¡Ojo, vas al revés! Pará el auto en un lugar seguro.',
    ],
    standard: [
      'Estás en sentido contrario. Detené el auto o girá con cuidado.',
      'Vas a contramano, {driver}. Pegá la vuelta de forma segura.',
      'Dirección incorrecta. Frená y volvé al sentido de la pista.',
    ],
  },
  flags_drs_enabled: {
    bono: [
      'DRS habilitado.',
      '{driver}, DRS habilitado. Usalo cuando estés a tiro.',
      'Ok, dirección de carrera habilitó el DRS.',
    ],
    colapinto: [
      '¡DRS habilitado, {driver}! A usarlo cuando tengas a alguien a tiro.',
      '¡Ya hay DRS! Aprovechalo en las zonas.',
      '¡Habilitaron el DRS, vamos!',
    ],
    standard: [
      'DRS habilitado por dirección de carrera.',
      'El DRS ya está disponible, {driver}.',
      'Dirección de carrera habilitó el DRS. Podés usarlo en las zonas de activación.',
    ],
  },
  flags_drs_disabled: {
    bono: [
      'DRS deshabilitado.',
      '{driver}, sin DRS por ahora.',
      'Ok, dirección de carrera deshabilitó el DRS.',
    ],
    colapinto: [
      '¡Sacaron el DRS, {driver}! Por ahora no hay.',
      '¡DRS deshabilitado! No cuentes con él por ahora.',
      '¡Ojo, no hay DRS! Lo deshabilitó dirección de carrera.',
    ],
    standard: [
      'DRS deshabilitado por dirección de carrera.',
      'El DRS no está disponible, {driver}.',
      'Sin DRS por el momento. Está deshabilitado.',
    ],
  },
  race_fastest_lap: {
    bono: [
      'Vuelta rápida de la carrera, {driver}. Bien hecho.',
      'Ok, esa es la vuelta más rápida de la carrera.',
      'Vuelta rápida. Buen ritmo, seguí así.',
    ],
    colapinto: [
      '¡Vuelta rápida de la carrera, {driver}! ¡Qué ritmo!',
      '¡Bárbaro! Esa es la vuelta más rápida de todos.',
      '¡Vuelta rápida! ¡Vamos, vamos!',
    ],
    standard: [
      'Vuelta rápida de la carrera. Muy buen ritmo.',
      'Marcaste la vuelta más rápida, {driver}.',
      'Es la vuelta rápida de la carrera. Seguí así.',
    ],
  },
  race_final_lap: {
    bono: [
      'Última vuelta, {driver}. P{position}, traelo a casa.',
      'Ok, última vuelta. Vamos P{position}.',
      'Última vuelta en P{position}. Tranquilo y limpio.',
      'Última vuelta, {driver}. Traelo a casa.',
    ],
    colapinto: [
      '¡Última vuelta, {driver}! P{position}, ¡traelo a casa!',
      '¡Es la última, {driver}! Seguimos P{position}, ¡a cerrarla bien!',
      '¡Última vuelta en P{position}! Sin errores, ¡vamos!',
      '¡Última vuelta! ¡A cerrarla, {driver}!',
    ],
    standard: [
      'Última vuelta. Vas P{position}, traelo a casa.',
      'Comienza la última vuelta, {driver}. Estás P{position}.',
      'Es la última vuelta, en P{position}. Sin riesgos.',
      'Última vuelta, {driver}. Llevalo hasta la bandera.',
    ],
  },
  race_final_lap_lead: {
    bono: [
      'Última vuelta, {driver}. Vamos primeros, traelo a casa.',
      'Ok, última vuelta y en punta. Limpio.',
      'Última vuelta liderando. Sin riesgos.',
    ],
    colapinto: [
      '¡Última vuelta y vamos primeros, {driver}! ¡Traelo a casa!',
      '¡Es la última y estamos P1! Sin errores, ¡vamos!',
      '¡Última vuelta liderando! Concentrado hasta la bandera.',
    ],
    standard: [
      'Última vuelta, P1. Traelo a casa.',
      'Última vuelta en punta, {driver}. Sin riesgos.',
      'Comienza la última vuelta y vas liderando. Llevalo hasta la bandera.',
    ],
  },
  car_collision: {
    bono: [
      'Hubo contacto, {driver}. ¿Cómo está el auto?',
      'Ok, contacto reportado. Avisanos si notás algo raro.',
      'Tuviste contacto. Revisá dirección y alerón.',
    ],
    colapinto: [
      '¡Hubo contacto, {driver}! ¿Está todo bien con el auto?',
      '¡Contacto! Contame si sentís algo raro en la dirección.',
      '¡Ojo con ese contacto! Avisame si el auto tira para algún lado.',
    ],
    standard: [
      'Contacto reportado. Revisá la dirección y el alerón delantero.',
      'Hubo contacto, {driver}. Informá si notás daños.',
      'Contacto con otro auto. Avisá si el comportamiento cambió.',
    ],
  },
  car_collision_light: {
    bono: [
      'Contacto leve, {driver}. Avisanos si notás algo.',
      'Ok, fue un roce. Contanos si el auto cambió.',
      'Toque leve. Seguimos, atento a cualquier cosa rara.',
    ],
    colapinto: [
      '¡Fue un roce nomás, {driver}! Avisame si sentís algo raro.',
      'Toquecito, {driver}. ¿Todo en orden con el auto?',
      '¡Un toque leve! Si algo se siente distinto, avisame.',
    ],
    standard: [
      'Contacto leve. Avisá si notás algo raro.',
      'Roce con otro auto, {driver}. Informá si cambia el comportamiento.',
      'Fue un toque leve. Revisá que el auto responda igual.',
    ],
  },
  car_collision_heavy: {
    bono: [
      'Contacto fuerte, {driver}. Revisá si hay daño.',
      'Ok, fue un golpe duro. ¿Cómo responde el auto?',
      'Golpe fuerte. Contanos cómo están dirección, alerón y gomas.',
    ],
    colapinto: [
      '¡Golpe fuerte, {driver}! ¿Estás bien? Contame cómo va el auto.',
      '¡Uf, contacto fuerte! Revisá dirección, alerón y gomas.',
      '¡Fue duro ese golpe! Avisame qué sentís en el auto.',
    ],
    standard: [
      'Contacto fuerte. Revisá si hay daños y avisá.',
      'Impacto fuerte, {driver}. Chequeá dirección, alerón delantero y gomas.',
      'Fue un golpe duro. Informá cómo se comporta el auto.',
    ],
  },
  car_retirement: {
    bono: [
      'Abandonó un auto, {driver}. Atento a amarillas o restos.',
      'Ok, hay un abandono. Ojo con posibles restos en pista.',
      'Un auto se retiró. Puede haber bandera amarilla.',
    ],
    colapinto: [
      '¡Abandonó un auto, {driver}! Ojo con pedazos en la pista.',
      'Se quedó un auto fuera de carrera. ¡Atento a las amarillas!',
      'Tenemos un abandono. Atento por si hay restos o amarillas.',
    ],
    standard: [
      'Un auto abandonó la carrera. Atención a banderas amarillas o restos.',
      'Abandono en pista, {driver}. Precaución con posibles restos.',
      'Se retiró un auto. Atento a la señalización.',
    ],
  },
  formation_lap_start: {
    bono: [
      'Vuelta de formación, {driver}. Zigzagueá y calentá gomas y frenos.',
      'Ok, vuelta previa. Temperatura en gomas y frenos.',
      'Empieza la vuelta de formación. Calentá las gomas.',
    ],
    colapinto: [
      '¡Vuelta previa, {driver}! Zigzagueá y meté temperatura en las gomas.',
      'Arranca la formación. ¡Frenos y gomas calentitos para la largada!',
      '¡Vamos con la vuelta previa! Calentá bien todo, gomas y frenos.',
    ],
    standard: [
      'Vuelta de formación. Zigzagueá para las gomas y algunas frenadas para los frenos.',
      'Comienza la vuelta previa, {driver}. Llevá gomas y frenos a temperatura.',
      'Arranca la vuelta de formación. Temperatura en gomas y frenos antes de la grilla.',
    ],
  },
  grid_approach: {
    bono: [
      'Llegando a la grilla, {driver}. Alineá el auto y buscá el punto de embrague.',
      'Ok, se viene tu lugar en la grilla. Centrado y quieto.',
      'Grilla a la vista. Punto de embrague listo.',
    ],
    colapinto: [
      '¡Llegamos a la grilla, {driver}! Clavalo derechito en tu lugar.',
      'Se viene la grilla. ¡Buscá el punto de embrague y a concentrarse!',
      '¡Atento a tu posición! Alineado y con el embrague en su punto.',
    ],
    standard: [
      'Llegando a la grilla. Alineá el auto en tu posición.',
      'Acercándote a tu lugar en la grilla, {driver}. Buscá el punto de embrague.',
      'Final de la vuelta de formación. Ubicá el auto y prepará la largada.',
    ],
  },
  start_reaction_time: {
    bono: [
      'Reacción de {reaction}, {driver}. Correcto.',
      'Ok, largada normal, {reaction} de reacción.',
      'Tiempo de reacción {reaction}. A lo nuestro.',
      'Largada correcta, {driver}.',
    ],
    colapinto: [
      'Largaste con {reaction} de reacción, {driver}. ¡Vamos, a pelear!',
      '¡Reacción de {reaction}! Buena, ahora concentrado en la carrera.',
      '{reaction} de reacción en la largada. ¡Dale que arrancó la carrera!',
      '¡Largamos, {driver}! A pelear.',
    ],
    standard: [
      'Tiempo de reacción en la largada: {reaction}.',
      'Largada normal, {driver}. Reacción de {reaction}.',
      'Reaccionaste en {reaction}. Ahora a encontrar el ritmo.',
      'Largada correcta. A buscar el ritmo de carrera.',
    ],
  },
  start_reaction_fast: {
    bono: [
      'Gran largada, {driver}. Reacción de {reaction}.',
      'Ok, {reaction} de reacción. Excelente.',
      'Reacción de {reaction}. Muy bien hecho.',
      'Gran reacción en la largada.',
    ],
    colapinto: [
      '¡Qué largada, {driver}! ¡{reaction} de reacción!',
      '¡Volaste en la largada! Reacción de {reaction}, ¡bárbaro!',
      '¡{reaction}! ¡Reflejos de crack, vamos!',
      '¡Qué arranque, {driver}! ¡Tremendo!',
    ],
    standard: [
      'Excelente largada. Reacción de {reaction}.',
      'Muy buena reacción, {driver}. {reaction} segundos.',
      'Reaccionaste en {reaction}, una gran largada.',
      'Excelente reacción en la largada, {driver}.',
    ],
  },
  start_reaction_slow: {
    bono: [
      'Reacción de {reaction}, algo lenta. Hay carrera por delante.',
      'Ok, largada lenta, {reaction}. Hay tiempo para recuperar.',
      '{reaction} de reacción, {driver}. Cabeza fría, hay tiempo.',
      'Largada lenta, {driver}. Queda mucha carrera.',
    ],
    colapinto: [
      'Reacción de {reaction}, un poco lenta. ¡Cabeza fría y a remontar!',
      'Largamos lento, {driver}. Reacción de {reaction}, ¡queda un montón!',
      '{reaction} en la largada, lento. ¡Tranqui, que esto es largo!',
      'Se nos escapó la largada, {driver}. ¡A remontar!',
    ],
    standard: [
      'Reacción lenta en la largada: {reaction}. Queda mucha carrera.',
      'Tiempo de reacción de {reaction}, {driver}. Concentrate en el ritmo.',
      'Largada lenta, reacción de {reaction}. Hay tiempo para recuperar.',
      'La largada fue lenta, {driver}. Cabeza fría, queda carrera.',
    ],
  },
  pit_serve_penalty: {
    bono: [
      'Primero los {penalty_sec} segundos de penalización, {driver}. Quieto.',
      'Ok, cumplimos {penalty_sec} segundos antes del cambio. Auto quieto.',
      'Penalización de {penalty_sec} segundos primero. Nadie toca el auto.',
      'Primero cumplimos la penalización, {driver}. Quieto.',
    ],
    colapinto: [
      '¡Quieto, {driver}! Primero pagamos {penalty_sec} segundos.',
      'Ojo: {penalty_sec} segundos de sanción antes de cambiar gomas.',
      'Esperá los {penalty_sec} segundos, {driver}. Después trabajan los mecánicos.',
      '¡Quieto, que primero va la penalización!',
    ],
    standard: [
      'Cumplimos {penalty_sec} segundos de penalización antes del servicio.',
      'Auto detenido {penalty_sec} segundos por la penalización, {driver}.',
      'Primero la penalización: {penalty_sec} segundos sin tocar el auto.',
      'Primero se cumple la penalización. Mantené el auto quieto.',
    ],
  },
  pit_stop_duration: {
    bono: [
      'Parada de {stop_sec} segundos, {driver}.',
      'Ok, {stop_sec} segundos detenidos. Correcto.',
      'Parada limpia, {stop_sec} segundos. Buen trabajo.',
      'Parada hecha, {driver}.',
    ],
    colapinto: [
      '¡Parada de {stop_sec} segundos, {driver}! ¡Bien ahí, equipo!',
      '¡{stop_sec} segundos, todo en orden!',
      'Listo, {stop_sec} segundos en el box. ¡Parada limpia!',
      '¡Parada hecha, {driver}! ¡Sin problemas!',
    ],
    standard: [
      'Tiempo de parada: {stop_sec} segundos.',
      'Parada de {stop_sec} segundos, {driver}. Todo en orden.',
      'Detenidos {stop_sec} segundos. Parada sin problemas.',
      'Parada completada, sin problemas.',
    ],
  },
  pit_stop_fast: {
    bono: [
      'Gran parada, {stop_sec} segundos, {driver}.',
      'Ok, {stop_sec} segundos. Excelente trabajo del equipo.',
      'Parada de {stop_sec}. Los mecánicos estuvieron muy bien.',
      'Parada muy rápida del equipo, {driver}.',
    ],
    colapinto: [
      '¡Qué parada, {driver}! ¡{stop_sec} segundos!',
      '¡{stop_sec} segundos! ¡El equipo es un crack!',
      '¡Bárbaro, {stop_sec} segundos de parada! ¡Gracias, equipo!',
      '¡Parada voladora, {driver}! ¡Grande, equipo!',
    ],
    standard: [
      'Parada rápida, {stop_sec} segundos. Gran trabajo de los mecánicos.',
      'Excelente parada, {driver}. {stop_sec} segundos detenidos.',
      'Solo {stop_sec} segundos en el box. Muy buen trabajo del equipo.',
      'Excelente trabajo de los mecánicos en la parada.',
    ],
  },
  pit_stop_slow: {
    bono: [
      'Parada lenta, {stop_sec} segundos, {driver}. Seguimos.',
      'Ok, {stop_sec} segundos detenidos. Más de lo previsto.',
      '{stop_sec} segundos en el box. Perdimos algo de tiempo.',
      'La parada fue lenta, {driver}. Perdón.',
    ],
    colapinto: [
      'Parada lenta, {stop_sec} segundos, {driver}. ¡Mala suerte!',
      '¡{stop_sec} segundos, se nos complicó!',
      'Perdimos tiempo en el box, {stop_sec} segundos. ¡Cabeza fría!',
      'Parada lenta, {driver}. ¡Perdón!',
    ],
    standard: [
      'Parada lenta: {stop_sec} segundos detenidos.',
      'La parada llevó {stop_sec} segundos, {driver}. Perdimos algo de tiempo.',
      'Parada más larga de lo previsto, {stop_sec} segundos.',
      'La parada fue lenta. Perdimos algo de tiempo.',
    ],
  },
  pit_limiter_exit: {
    bono: [
      'Limitador afuera, {driver}. A empujar.',
      'Ok, fuera de boxes. Sacá el limitador, respetá la línea.',
      'Línea pasada. Limitador fuera y ritmo.',
    ],
    colapinto: [
      '¡Limitador afuera, {driver}! ¡A fondo!',
      '¡Sacá el limitador y dale! Ojo con la línea blanca.',
      '¡Ya estamos afuera! Sin limitador, ¡vamos!',
    ],
    standard: [
      'Limitador desactivado. Respetá la línea de salida y empujá.',
      'Fuera de boxes, {driver}. Limitador afuera, a ritmo de carrera.',
      'Pasaste la línea de salida. Sacá el limitador y empujá.',
    ],
  },
  tyre_crossover_wet: {
    bono: [
      'Demasiada agua para intermedias, {driver}. Gomas de lluvia.',
      'Ok, llueve fuerte. Vamos a gomas de lluvia.',
      'Las intermedias ya no evacuan el agua. Gomas de lluvia.',
    ],
    colapinto: [
      '¡Mucha agua, {driver}! ¡Vamos a gomas de lluvia!',
      '¡Las intermedias no aguantan esto! Ponemos las de lluvia.',
      '¡Llueve fuertísimo! Cambiamos a gomas de lluvia extrema.',
    ],
    standard: [
      'Hay demasiada agua para intermedias. Vamos a gomas de lluvia.',
      'Lluvia intensa, {driver}. Cambiamos a gomas de lluvia extrema.',
      'Las intermedias no alcanzan con esta lluvia. Paramos por gomas de lluvia.',
    ],
  },
  tyre_crossover_inter: {
    bono: [
      'Aflojó la lluvia, {driver}. Las intermedias ya son más rápidas.',
      'Ok, menos agua. Volvemos a intermedias.',
      'Bajó la lluvia. Ponemos intermedias.',
    ],
    colapinto: [
      '¡Aflojó la lluvia, {driver}! ¡Vamos a intermedias!',
      '¡Hay menos agua! Las intermedias van más rápido.',
      '¡Ya no hacen falta las de lluvia! Intermedias, {driver}.',
    ],
    standard: [
      'La lluvia disminuyó. Las intermedias son más rápidas.',
      'Menos agua en pista, {driver}. Cambiamos a intermedias.',
      'Las gomas de lluvia ya sobran. Paramos por intermedias.',
    ],
  },
  brake_bias_ok: {
    bono: [
      'Frenos parejos otra vez, {driver}. Así está bien.',
      'Ok, temperaturas de frenos equilibradas.',
      'El balance de frenos quedó bien.',
    ],
    colapinto: [
      '¡Frenos parejitos de nuevo, {driver}! Así, perfecto.',
      '¡Ahí está! Temperaturas de frenos equilibradas.',
      'Se emparejaron los frenos adelante y atrás. ¡Bien ahí!',
    ],
    standard: [
      'Temperaturas de frenos equilibradas entre adelante y atrás.',
      'El reparto de frenos quedó bien, {driver}.',
      'Frenos delanteros y traseros de nuevo parejos.',
    ],
  },
  fuel_mix_neutralized: {
    bono: [
      'Mezcla pobre, {driver}. Ahorramos mientras dure la neutralización.',
      'Ok, carrera neutralizada. Pasá a mezcla pobre.',
      'Mezcla de combustible a pobre.',
    ],
    colapinto: [
      '¡Mezcla pobre, {driver}! Ahorramos nafta con la neutralización.',
      '¡Carrera neutralizada! Pasá la mezcla a pobre.',
      'Aprovechá para ahorrar: mezcla pobre mientras estemos neutralizados.',
    ],
    standard: [
      'Carrera neutralizada. Cambiá la mezcla a pobre.',
      'Pasá a mezcla pobre durante la neutralización, {driver}.',
      'Con la carrera neutralizada, mapa de combustible pobre.',
    ],
  },
  fuel_mix_restart: {
    bono: [
      'Seguís en mezcla pobre, {driver}. Volvé a la estándar.',
      'Ok, se corre de nuevo. Mezcla de carrera.',
      'Mezcla estándar otra vez.',
    ],
    colapinto: [
      '¡Seguís en pobre, {driver}! Mezcla estándar y a correr.',
      '¡Ya se corre! Volvé a la mezcla de carrera.',
      'Ojo, todavía en mezcla pobre. ¡Pasala a estándar!',
    ],
    standard: [
      'La mezcla sigue en pobre. Volvé a la mezcla estándar de carrera.',
      'Carrera en marcha, {driver}. Mezcla de combustible estándar.',
      'Seguís con mapa pobre. Cambiá a la mezcla de carrera.',
    ],
  },
  ers_clipping: {
    bono: [
      'Clipping, {driver}. Sin despliegue eléctrico hasta la línea.',
      'Ok, llegamos al límite de despliegue de la vuelta.',
      'Despliegue de la vuelta agotado. Nada de eléctrico hasta la línea.',
    ],
    colapinto: [
      '¡Clipping, clipping! No hay más despliegue hasta la línea.',
      '¡Se acabó el despliegue de esta vuelta, {driver}!',
      'Llegamos al tope de batería de la vuelta. ¡Sin eléctrico hasta la meta!',
    ],
    standard: [
      'Clipping. Se alcanzó el límite de despliegue de la vuelta.',
      'Despliegue eléctrico agotado por esta vuelta, {driver}.',
      'Límite de despliegue alcanzado. Sin ayuda eléctrica hasta cruzar la línea.',
    ],
  },
  tyre_set_advisory: {
    bono: [
      'Se acerca la ventana de parada, {driver}. Tenemos gomas {compound} nuevas.',
      'Ok, juego nuevo de gomas {compound} listo en boxes.',
      'Para la parada hay gomas {compound} sin usar.',
      'Se acerca la ventana. Tenemos un juego usado listo, {driver}.',
    ],
    colapinto: [
      '¡Se viene la ventana, {driver}! Hay gomas {compound} nuevas esperando.',
      'Gomas {compound} nuevitas listas en boxes. ¡Para cuando paremos!',
      'Ventana de parada cerca. Tenemos un juego de gomas {compound} sin estrenar.',
      '¡Se acerca la ventana! Hay un juego usado preparado, {driver}.',
    ],
    standard: [
      'Ventana de parada cerca. Hay un juego nuevo de gomas {compound} disponible.',
      'Tenemos gomas {compound} nuevas preparadas para la parada, {driver}.',
      'Se acerca la ventana de parada. Juego de gomas {compound} sin usar, listo.',
      'Se acerca la ventana de parada. Queda un juego usado preparado.',
    ],
  },
  aero_straight_anticipation: {
    bono: [
      'Zona de modo recta adelante, {driver}. Preparado.',
      'Ok, se viene el modo recta.',
      'Modo recta disponible en la próxima zona.',
      'Atento al modo recta.',
    ],
    colapinto: [
      '¡Se viene la zona de modo recta, {driver}! Listo para activarlo.',
      '¡Modo recta en camino! Preparate a la salida.',
      'Viene la recta, ¡modo recta apenas puedas!',
      '¡Atento al alerón! Zona de modo recta adelante.',
    ],
    standard: [
      'Zona de modo recta próxima. Preparate para activarlo.',
      'Se acerca una zona de modo recta, {driver}.',
      'Modo recta disponible en la zona que viene. Atento a la activación.',
      'Próxima zona de baja carga aerodinámica. Listo con el modo recta.',
    ],
  },
  overtake_boost_anticipation: {
    bono: [
      'Zona de Override adelante, {driver}. Lo tenés disponible.',
      'Ok, se viene la zona de Override.',
      'Override disponible en la próxima zona. Preparado.',
      'Atento, Override listo para la zona que viene.',
    ],
    colapinto: [
      '¡Se viene la zona de Override, {driver}! ¡Dedo en el botón!',
      '¡Tenés el Override! Usalo en la zona que viene.',
      '¡Zona de Override! Preparate para tirarlo.',
      '¡Override cargado y la zona en camino! ¡Dale!',
    ],
    standard: [
      'Se acerca la zona de Override. Lo tenés disponible.',
      'Zona de activación de Override próxima, {driver}.',
      'Override disponible. Preparate para la zona de activación.',
      'Próxima zona de Override. Atento al botón.',
    ],
  },
  pit_limiter_overspeed: {
    bono: [
      'Limitador, {driver}. Bajá la velocidad.',
      'Ok, muy rápido para la calle de boxes. Limitador.',
      'Velocidad alta en la entrada. Activá el limitador.',
    ],
    colapinto: [
      '¡Limitador, limitador, {driver}! ¡Frená!',
      '¡Venís muy rápido! Activá el limitador ya.',
      '¡Ojo con la velocidad en boxes! Limitador puesto.',
    ],
    standard: [
      'Exceso de velocidad en la entrada a boxes. Activá el limitador.',
      'Limitador de boxes, {driver}. Reducí la velocidad.',
      'Muy rápido para la calle de boxes. Frená y poné el limitador.',
    ],
  },
  tyre_blistering: {
    bono: [
      'Ampollas en la goma {wheel}, {pct} por ciento, {driver}. Menos deslizamientos.',
      'Ok, la {wheel} tiene ampollas, {pct} por ciento. Evitá los pianos.',
      'Ampollamiento del {pct} por ciento en la {wheel}. Suave en los pianos.',
      'Ampollas en una goma, {driver}. Menos deslizamientos y pianos.',
    ],
    colapinto: [
      '¡Ampollas en la {wheel}, {driver}! {pct} por ciento, aflojá con los pianitos.',
      'La goma {wheel} se está ampollando, {pct} por ciento. ¡Nada de deslizar!',
      '{pct} por ciento de ampollas en la {wheel}. Prolijo, sin pisar pianitos.',
      '¡Se ampolla una goma, {driver}! Prolijo con los pianitos.',
    ],
    standard: [
      'Ampollas en la goma {wheel}, {pct} por ciento. Reducí los deslizamientos.',
      'La {wheel} presenta ampollas del {pct} por ciento, {driver}. Evitá los pianos agresivos.',
      'Ampollamiento de {pct} por ciento en la {wheel}. Menos carga en los pianos.',
      'Una goma tiene ampollas. Evitá deslizamientos y pianos.',
    ],
  },
  tyre_pressure_high: {
    bono: [
      'Presión alta en la goma {wheel}, {driver}. Suave en la entrada.',
      'Ok, la {wheel} viene con la presión alta.',
      'Sube la presión de la {wheel}. Menos deslizamiento al entrar.',
      'Presiones desparejas en el eje {axle}, {driver}.',
      'Ok, el eje {axle} tiene las presiones desbalanceadas. Cargas parejas.',
      'Presiones de gomas fuera de rango, {driver}.',
    ],
    colapinto: [
      '¡La presión de la {wheel} se dispara, {driver}! Suave en las entradas.',
      'Presión altísima en la goma {wheel}. ¡No la arrastres en las curvas!',
      'Ojo con la presión de la {wheel}, está muy alta.',
      '¡Presiones desparejas en el eje {axle}! Manejá parejito.',
      'El eje {axle} tiene una presión distinta de cada lado, {driver}.',
      '¡Ojo con las presiones de las gomas, {driver}!',
    ],
    standard: [
      'Presión alta en la goma {wheel}. Moderá el deslizamiento en la entrada de curva.',
      'La presión de la {wheel} está subiendo, {driver}.',
      'Pico de presión en la {wheel}. Cuidá la carga en curva.',
      'Diferencia de presión entre las gomas del eje {axle}. Equilibrá las cargas.',
      'Presiones desiguales en el eje {axle}, {driver}.',
      'Las presiones de las gomas están fuera de lo normal.',
    ],
  },
  damage_gearbox_wear: {
    bono: [
      'Caja de cambios con {pct} por ciento de desgaste, {driver}.',
      'Ok, la caja va por el {pct} por ciento. Cambios suaves.',
      'Desgaste de caja, {pct} por ciento. Cuidala.',
      'Desgaste en la caja de cambios, {driver}.',
    ],
    colapinto: [
      'La caja de cambios va por el {pct} por ciento, {driver}. ¡Cambios suaves!',
      '{pct} por ciento de desgaste en la caja. Tratala con cariño.',
      'Ojo con la caja, {pct} por ciento. Sin rebajes bruscos.',
      '¡Cuidá la caja, {driver}! Está gastada.',
    ],
    standard: [
      'Desgaste de la caja de cambios: {pct} por ciento.',
      'La caja tiene {pct} por ciento de desgaste, {driver}. Cambios suaves.',
      'Caja de cambios con {pct} por ciento de daño. Evitá los rebajes bruscos.',
      'Desgaste en la caja de cambios. Cuidá los cambios.',
    ],
  },
  damage_ice_wear: {
    bono: [
      'Motor de combustión con {pct} por ciento de desgaste, {driver}.',
      'Ok, el térmico va por el {pct} por ciento.',
      'Desgaste del motor térmico, {pct} por ciento. Cuidalo.',
      'Desgaste alto en el motor de combustión, {driver}.',
    ],
    colapinto: [
      'El motor térmico va por el {pct} por ciento, {driver}. ¡Cuidalo!',
      '{pct} por ciento de desgaste en el térmico. Sin pasarse de vueltas.',
      'Ojo, el motor de combustión ya tiene {pct} por ciento de desgaste.',
      '¡El motor térmico está gastado, {driver}!',
    ],
    standard: [
      'Desgaste del motor de combustión: {pct} por ciento.',
      'El motor térmico tiene {pct} por ciento de desgaste, {driver}.',
      'Motor térmico con {pct} por ciento de desgaste. Cuidá las revoluciones.',
      'Desgaste elevado en el motor de combustión.',
    ],
  },
  pit_entry_reminder: {
    bono: [
      'Box, box. Entrada a boxes a la vista, {driver}.',
      'Ok, se viene la entrada. Quedate del lado de boxes.',
      'Entrada a boxes enseguida. Box, box.',
      'Box, box, {driver}. La entrada está adelante.',
    ],
    colapinto: [
      '¡Box, box, box! Se viene la entrada, {driver}.',
      '¡Entramos, {driver}! Pegate del lado de boxes.',
      '¡Box, box! Atento a la entrada, que no se te pase.',
      '¡Ahí está la entrada a boxes! Box, box.',
    ],
    standard: [
      'Box, box. Se acerca la entrada a boxes.',
      'Entrada a boxes próxima, {driver}. Mantenete del lado de boxes.',
      'Box, box, {driver}. Preparate para la entrada a boxes.',
      'Llegando a la entrada de boxes. Box, box.',
    ],
  },
  gap_report: {
    bono: [
      'Diferencias, {driver}.',
      'Ok, te paso las distancias.',
      'La situación.',
      'Las diferencias.',
      'Así estamos.',
    ],
    colapinto: [
      '¡Te paso las diferencias, {driver}!',
      '¡A ver cómo estamos!',
      'Ahí van los tiempos.',
      '¡Así está la cosa!',
      'Mirá cómo venimos.',
    ],
    standard: [
      'Informe de diferencias.',
      'Así van las diferencias.',
      'Situación de carrera.',
      'Así está la carrera, {driver}.',
      'Estado de las diferencias.',
    ],
  },
  tyre_life: {
    bono: [
      'Unas {laps} vueltas en estas gomas, {driver}. La {wheel} se va primero.',
      'Ok, quedan unas {laps} vueltas. La {wheel} marca el límite.',
      'A estas gomas les quedan {laps} vueltas, más o menos. Limita la {wheel}.',
      'La {wheel} llega al límite en unas {laps} vueltas.',
      'Cerca de {laps} vueltas de vida. La que más rápido se gasta es la {wheel}.',
    ],
    colapinto: [
      'Les quedan unas {laps} vueltas a estas gomas, {driver}. ¡Ojo con la {wheel}!',
      'La {wheel} aguanta unas {laps} vueltas más. ¡Cuidala!',
      '¡{laps} vueltas, más o menos! La {wheel} es la que se gasta primero.',
      'Unas {laps} vueltas de goma, {driver}. La {wheel} marca el límite.',
      'Tenemos unas {laps} vueltas con estas gomas. La {wheel} es la más justa.',
    ],
    standard: [
      'Quedan unas {laps} vueltas en estas gomas. La {wheel} llega primero al límite.',
      'Vida de gomas: unas {laps} vueltas, {driver}. La {wheel} es la que más rápido se gasta.',
      'La goma {wheel} tiene unas {laps} vueltas antes del límite de desgaste.',
      'Estimamos {laps} vueltas más con estas gomas. La crítica es la {wheel}.',
    ],
  },
  tyre_life_end: {
    bono: [
      'Estas gomas llegan al final, {driver}. Seguí administrando.',
      'Ok, con estas gomas llegamos a la bandera.',
      'Las gomas alcanzan hasta el final. Sin excesos.',
      'Llegamos al final con este juego. Cuidalo igual.',
    ],
    colapinto: [
      '¡Estas gomas llegan al final, {driver}! Seguí cuidándolas.',
      '¡Buenas noticias! Con este juego llegamos a la bandera.',
      'Las gomas dan para terminar. ¡Seguí así de prolijo!',
      '¡Este juego llega hasta el final! Mantené el cuidado.',
    ],
    standard: [
      'Estas gomas llegan al final de la carrera. Seguí gestionándolas.',
      'Con este juego llegamos a la bandera, {driver}.',
      'Las gomas alcanzan hasta el final si seguís cuidándolas.',
      'El desgaste da para terminar la carrera. Seguí administrando.',
    ],
  },
  rival_closing: {
    bono: [
      'El de adelante a {gap}, le descontás {rate} por vuelta. Lo alcanzás en unas {laps} vueltas.',
      'Ok, {gap} al de adelante y bajando {rate} por vuelta. En unas {laps} vueltas estás ahí.',
      'Le sacás {rate} por vuelta al de adelante, {driver}. A {gap}, unas {laps} vueltas para alcanzarlo.',
      'A {gap} del de adelante, {rate} por vuelta más rápido. A tiro en unas {laps} vueltas.',
      '{gap} al de adelante, te acercás {rate} por vuelta. Seguí así.',
      'Le descontás {rate} por vuelta al de adelante, {driver}. Está a {gap}.',
      'Vas descontando, {driver}. El de adelante está a {gap}, le sacás {rate} por vuelta.',
      'Te estás acercando al de adelante, {driver}.',
      'Ok, vas descontando con el de adelante. Seguí así.',
    ],
    colapinto: [
      '¡Le descontás {rate} por vuelta, {driver}! Está a {gap}, en unas {laps} vueltas lo tenés.',
      '¡Lo vamos cazando! {gap} y bajando {rate} por vuelta, ¡en unas {laps} vueltas lo agarramos!',
      'A {gap} el de adelante, te acercás {rate} por vuelta. ¡En unas {laps} vueltas, a pelear!',
      '¡En unas {laps} vueltas lo tenés a tiro, {driver}! Está a {gap}, le descontás {rate} por vuelta.',
      '¡Vamos que lo alcanzamos! A {gap} y le descontás {rate} por vuelta.',
      '¡El de adelante está a {gap}, {driver}! Le sacás {rate} por vuelta, ¡dale!',
      '{gap} al de adelante y bajando {rate} por vuelta. ¡Seguí apretando!',
      '¡Lo estás alcanzando, {driver}! ¡Dale que vamos!',
      '¡Le vamos descontando al de adelante! Seguí así.',
    ],
    standard: [
      'Auto de adelante a {gap}, descontando {rate} por vuelta. Lo alcanzás en unas {laps} vueltas.',
      'Diferencia con el de adelante: {gap}, bajando {rate} por vuelta. Unas {laps} vueltas para alcanzarlo.',
      'A {gap} del de adelante, ganando {rate} por vuelta. En pelea en unas {laps} vueltas, {driver}.',
      'En unas {laps} vueltas alcanzás al de adelante. Está a {gap}, le descontás {rate} por vuelta.',
      'El de adelante está a {gap}. Le descontás {rate} por vuelta, {driver}.',
      'Diferencia de {gap} con el auto de adelante, bajando {rate} por vuelta. Mantené el ritmo.',
      'Te acercás {rate} por vuelta al auto de adelante, que está a {gap}.',
      'Te estás acercando al auto de adelante. Mantené el ritmo.',
      'Vas descontando con el de adelante, {driver}.',
    ],
  },
  rival_catching_you: {
    bono: [
      '{gap} al de atrás y te descuenta {rate} por vuelta. Te alcanza en unas {laps} vueltas.',
      'Ok, el de atrás se acerca {rate} por vuelta. Está a {gap}, unas {laps} vueltas para llegarte.',
      'El de atrás viene {rate} por vuelta más rápido, a {gap}. Está encima en unas {laps} vueltas, {driver}.',
      'Te descuenta {rate} por vuelta el de atrás, a {gap}. Llega en unas {laps} vueltas.',
      'El de atrás a {gap}, se acerca {rate} por vuelta, {driver}.',
      'Ok, el de atrás te saca {rate} por vuelta y está a {gap}. Subí el ritmo.',
      '{gap} al de atrás, viene {rate} por vuelta más rápido.',
      'El de atrás se está acercando, {driver}.',
      'Ok, el de atrás viene más rápido. Subí el ritmo.',
    ],
    colapinto: [
      '¡Te viene comiendo {rate} por vuelta, {driver}! Está a {gap}, en unas {laps} vueltas llega.',
      '¡Ojo atrás! {gap} y bajando {rate} por vuelta, ¡en unas {laps} vueltas lo tenés encima!',
      '¡A {gap} el de atrás y te saca {rate} por vuelta! Apretá, en unas {laps} vueltas llega.',
      '¡En unas {laps} vueltas lo tenés encima, {driver}! Está a {gap}, te descuenta {rate} por vuelta.',
      '¡El de atrás está a {gap} y te descuenta {rate} por vuelta! ¡Dale, apretá!',
      'A {gap} el de atrás, bajando {rate} por vuelta. ¡Subí el ritmo, {driver}!',
      '¡Se acerca {rate} por vuelta el de atrás! Está a {gap}.',
      '¡El de atrás se viene acercando, {driver}! ¡Apretá!',
      '¡Ojo que el de atrás viene más rápido! Subí el ritmo.',
    ],
    standard: [
      'Auto de atrás a {gap}, descontando {rate} por vuelta. Te alcanza en unas {laps} vueltas.',
      'Diferencia con el de atrás: {gap}, bajando {rate} por vuelta. Llega en unas {laps} vueltas.',
      'El de atrás se acerca {rate} por vuelta, {driver}. Está a {gap} y llega en unas {laps} vueltas.',
      'El de atrás te alcanza en unas {laps} vueltas: está a {gap} y descuenta {rate} por vuelta.',
      'Auto de atrás a {gap}, se acerca {rate} por vuelta. Subí el ritmo.',
      'El de atrás te descuenta {rate} por vuelta, {driver}. Diferencia de {gap}.',
      'Diferencia de {gap} con el auto de atrás, que viene {rate} por vuelta más rápido.',
      'El auto de atrás se está acercando. Subí el ritmo, {driver}.',
      'El de atrás viene más rápido. Mantené la concentración.',
    ],
  },
  rival_penalty_ahead: {
    bono: [
      'El de adelante tiene {penalty_sec} segundos de penalización, {driver}. Está a {gap}.',
      'Sanción de {penalty_sec} segundos al de adelante, a {gap}. Terminá a menos de {penalty_sec} de él.',
      'Ok, el de adelante, a {gap}, carga {penalty_sec} segundos de penalización. Quedate cerca.',
      'El de adelante tiene una penalización de tiempo, {driver}.',
    ],
    colapinto: [
      '¡El de adelante tiene {penalty_sec} segundos de penalización, {driver}! Está a {gap}, ¡pegate!',
      '¡Lo sancionaron con {penalty_sec} segundos al de adelante! Está a {gap}, ¡quedate a menos de {penalty_sec}!',
      '¡A {gap} el de adelante, con {penalty_sec} de sanción! A menos de {penalty_sec}, lo pasamos.',
      '¡Penalizaron al de adelante, {driver}! ¡Pegate!',
    ],
    standard: [
      'El auto de adelante tiene {penalty_sec} segundos de penalización. Está a {gap}, {driver}.',
      'Penalización de {penalty_sec} segundos al de adelante, a {gap}. A menos de {penalty_sec}, quedás adelante.',
      'El de adelante está a {gap} y tiene {penalty_sec} segundos de sanción. Mantenete cerca.',
      'El auto de adelante tiene una penalización de tiempo.',
    ],
  },
  rival_penalty_behind: {
    bono: [
      'El de atrás tiene {penalty_sec} segundos de penalización, {driver}. Está a {gap}.',
      'El de atrás a {gap}, con {penalty_sec} de sanción. Si te pasa, mantenelo a menos de {penalty_sec}.',
      'Ok, el de atrás, a {gap}, tiene {penalty_sec} segundos de sanción. Necesita sacarte más de {penalty_sec}.',
      'El de atrás tiene una penalización de tiempo, {driver}.',
    ],
    colapinto: [
      '¡El de atrás tiene {penalty_sec} segundos de penalización, {driver}! Está a {gap}.',
      '¡El de atrás, a {gap}, tiene {penalty_sec} de sanción! Si te pasa, ¡que no se escape!',
      'El de atrás, a {gap}, carga {penalty_sec} segundos de penalización. ¡Tiene que sacarte más de {penalty_sec}!',
      '¡Penalizaron al de atrás, {driver}! Cabeza fría.',
    ],
    standard: [
      'El auto de atrás tiene {penalty_sec} segundos de penalización. Está a {gap}, {driver}.',
      'Sanción de {penalty_sec} segundos al de atrás, a {gap}. Aunque pase, debe sacarte más de {penalty_sec}.',
      'El de atrás está a {gap}, penalizado con {penalty_sec} segundos. Si te pasa, seguilo de cerca.',
      'El auto de atrás tiene una penalización de tiempo.',
    ],
  },
  leader_pitted: {
    bono: [
      'El líder entró a boxes, {driver}. Estaba a {gap}.',
      'Ok, paró el líder. Nos llevaba {gap} segundos.',
      'El puntero está en boxes. Iba {gap} adelante.',
      'Ok, el líder entró a boxes.',
    ],
    colapinto: [
      '¡Paró el líder, {driver}! Nos llevaba {gap}.',
      '¡El puntero se fue a boxes! Estaba a {gap} segundos.',
      '¡Ojo, entró a boxes el líder! Nos sacaba {gap}.',
      '¡El líder está en boxes, {driver}!',
    ],
    standard: [
      'El líder entró a boxes. Estaba a {gap} segundos de vos.',
      'Parada del líder, {driver}. Te llevaba {gap}.',
      'El puntero está en la calle de boxes. Diferencia antes de entrar: {gap}.',
      'El líder de la carrera entró a boxes, {driver}.',
    ],
  },
  nearby_pitted_ahead: {
    bono: [
      'Paró un auto de adelante, {driver}. Estaba a {gap}.',
      'Ok, entró a boxes un auto que iba {gap} adelante.',
      'Un auto de adelante en boxes, a {gap} segundos.',
      'Ok, paró un auto de adelante.',
    ],
    colapinto: [
      '¡Se fue a boxes uno de adelante, {driver}! Iba a {gap}.',
      'Un auto a {gap} adelante entró a boxes. ¡Atento!',
      '¡Ojo, paró uno que iba {gap} adelante!',
      '¡Paró un auto de adelante, {driver}!',
    ],
    standard: [
      'Un auto de adelante entró a boxes. Estaba a {gap} segundos.',
      'Parada de un auto que iba {gap} adelante, {driver}.',
      'Auto a {gap} adelante en la calle de boxes.',
      'Un auto de adelante entró a boxes.',
    ],
  },
  nearby_pitted_behind: {
    bono: [
      'Paró un auto de atrás, {driver}. Estaba a {gap}.',
      'Ok, entró a boxes un auto que venía {gap} atrás.',
      'Un auto de atrás en boxes, a {gap} segundos.',
      'Ok, paró un auto de atrás.',
    ],
    colapinto: [
      '¡Se fue a boxes uno de atrás, {driver}! Venía a {gap}.',
      'Un auto a {gap} atrás entró a boxes. ¡Atento!',
      '¡Ojo, paró uno que venía {gap} atrás!',
      '¡Paró un auto de atrás, {driver}!',
    ],
    standard: [
      'Un auto de atrás entró a boxes. Estaba a {gap} segundos.',
      'Parada de un auto que venía {gap} atrás, {driver}.',
      'Auto a {gap} atrás en la calle de boxes.',
      'Un auto de atrás entró a boxes.',
    ],
  },
  pit_plan_next_lap_traffic: {
    bono: [
      'Box la próxima vuelta, {driver}. Salimos P{position}, a {gap} detrás de un auto.',
      'Ok, paramos la vuelta que viene. Salimos P{position} con tráfico, a {gap} del de adelante.',
      'La que viene es la parada. Volvemos P{position}, {gap} detrás de otro auto.',
      'Box la vuelta que viene. Salimos con tráfico, a {gap} de un auto.',
      'Ok, próxima vuelta paramos. Salimos {gap} detrás de un auto, {driver}.',
      'Próxima vuelta, box. Salimos con tráfico.',
    ],
    colapinto: [
      '¡Box la vuelta que viene, {driver}! Salimos P{position}, {gap} detrás de un auto.',
      'Preparate, la próxima es la parada. Volvemos P{position} con tráfico, a {gap} del de adelante.',
      'Vuelta que viene paramos, ¡dale! Salimos P{position}, a {gap} detrás de un auto.',
      '¡Box la próxima vuelta! Salimos con tráfico, a {gap} de un auto.',
      'Se viene la parada en la próxima vuelta. Salimos {gap} detrás de uno, {driver}.',
      '¡Preparate, {driver}! Box la próxima vuelta, salimos con tráfico.',
    ],
    standard: [
      'Box en la próxima vuelta. Salida en P{position}, {gap} detrás de otro auto.',
      'Paramos al final de la próxima vuelta, {driver}. Reingreso en P{position}, con tráfico a {gap}.',
      'Parada planificada para la próxima vuelta. Volvemos P{position}, a {gap} detrás de un auto.',
      'Box en la próxima vuelta, {driver}. Salimos {gap} detrás de un auto.',
      'Próxima vuelta entramos a boxes. Reingreso con tráfico, a {gap} del auto de adelante.',
      'Paramos en la próxima vuelta. La salida es con tráfico.',
    ],
  },
  penalty_served: {
    bono: [
      'Penalización cumplida, {driver}.',
      'Ok, sanción cumplida. Seguimos.',
      'Cumplimos la penalización. A lo nuestro.',
    ],
    colapinto: [
      '¡Penalización cumplida, {driver}! ¡A remontar!',
      '¡Listo, cumpliste la sanción! Ahora a recuperar.',
      '¡Ya está, sanción cumplida! A empujar, {driver}.',
    ],
    standard: [
      'Penalización cumplida. Seguí con tu carrera.',
      'Ya cumpliste la sanción, {driver}. Seguimos.',
      'Cumplimos la penalización. Volvemos a la carrera.',
    ],
  },
  weather_rain_approx: {
    bono: [
      'El pronóstico dice {rain_pct} por ciento de lluvia en {minutes} minutos, más o menos.',
      'Ok, más o menos {rain_pct} por ciento de lluvia en unos {minutes} minutos, {driver}.',
      'Puede que llueva en {minutes} minutos, {rain_pct} por ciento. No es seguro.',
      'Ok, el pronóstico dice {rain_pct} por ciento de lluvia. Aproximado.',
      'Más o menos {rain_pct} por ciento de chance de lluvia, {driver}.',
      'Capaz que llueva, {driver}. El pronóstico no es seguro.',
    ],
    colapinto: [
      '¡Ojo, {driver}! Más o menos {rain_pct} por ciento de lluvia en {minutes} minutos.',
      'Capaz que se viene la lluvia: {rain_pct} por ciento en unos {minutes} minutos.',
      '¡Puede que llueva en unos {minutes} minutos! Dice {rain_pct} por ciento, más o menos.',
      '¡Ojo con la lluvia! Parece que hay {rain_pct} por ciento de chance.',
      '{rain_pct} por ciento de lluvia, más o menos, {driver}. ¡Atento!',
      '¡Capaz que llueva, {driver}! Atento al agarre.',
    ],
    standard: [
      'Pronóstico aproximado: {rain_pct} por ciento de probabilidad de lluvia en {minutes} minutos.',
      'Lluvia posible en unos {minutes} minutos, {driver}. Probabilidad aproximada del {rain_pct} por ciento.',
      'El pronóstico calcula {rain_pct} por ciento de lluvia en {minutes} minutos. No es seguro.',
      'Probabilidad aproximada de lluvia: {rain_pct} por ciento, {driver}.',
      'El pronóstico da {rain_pct} por ciento de lluvia, más o menos.',
      'Puede que llueva. El pronóstico es aproximado.',
    ],
  },
  rain_heavier: {
    bono: [
      'La lluvia se pone más fuerte, {driver}.',
      'Ok, llueve más. Menos agarre.',
      'Aumenta la lluvia. Frená con margen.',
    ],
    colapinto: [
      '¡Llueve cada vez más, {driver}! Cuidado.',
      '¡Se largó más fuerte la lluvia! Ojo en las frenadas.',
      '¡Ahora llueve en serio! Suave con el acelerador.',
    ],
    standard: [
      'La lluvia es cada vez más intensa. Atención al agarre.',
      'Llueve con más fuerza, {driver}. Cuidado en las frenadas.',
      'Aumenta la intensidad de la lluvia. Menos agarre en pista.',
    ],
  },
  rain_easing: {
    bono: [
      'La lluvia afloja, {driver}.',
      'Ok, llueve menos.',
      'Pierde intensidad la lluvia.',
    ],
    colapinto: [
      '¡Afloja la lluvia, {driver}!',
      '¡Está aflojando la lluvia! Atento a cómo cambia la pista.',
      '¡Buenas noticias, llueve menos!',
    ],
    standard: [
      'La lluvia está perdiendo intensidad.',
      'Llueve menos, {driver}. Atento a los cambios de agarre.',
      'Disminuye la lluvia en el circuito.',
    ],
  },
  track_drying: {
    bono: [
      'Paró la lluvia, {driver}. La pista se empieza a secar.',
      'Ok, ya no llueve. Va a ir secándose.',
      'Dejó de llover. La pista va a empezar a secarse.',
    ],
    colapinto: [
      '¡Paró de llover, {driver}! La pista se va a ir secando.',
      '¡Se terminó la lluvia! Ahora se empieza a secar.',
      '¡Ya no llueve! Atento, que la pista se seca.',
    ],
    standard: [
      'Dejó de llover. La pista va a comenzar a secarse.',
      'Terminó la lluvia, {driver}. La pista se va a ir secando.',
      'Sin lluvia en el circuito. Se viene una pista cada vez más seca.',
    ],
  },
  track_temp_up: {
    bono: [
      'La pista subió {temp_delta} grados en este stint, {driver}.',
      'Ok, {temp_delta} grados más de pista desde que arrancó el stint. Cuidá las gomas.',
      'Asfalto {temp_delta} grados más caliente en este stint. Ojo con la temperatura de gomas.',
      'La pista está más caliente que al inicio del stint.',
    ],
    colapinto: [
      '¡El asfalto está {temp_delta} grados más caliente que al arrancar el stint!',
      'Subió {temp_delta} grados la pista en este stint. ¡Ojo con el desgaste!',
      '¡{temp_delta} grados más de pista desde que arrancó el stint, {driver}! Gomas con cariño.',
      '¡La pista se calentó en este stint, {driver}! Cuidá las gomas.',
    ],
    standard: [
      'La temperatura de pista subió {temp_delta} grados en este stint.',
      'El asfalto está {temp_delta} grados más caliente desde que arrancó el stint, {driver}.',
      'Pista {temp_delta} grados más caliente en este stint. Gestioná la temperatura de las gomas.',
      'Subió la temperatura de pista en este stint.',
    ],
  },
  track_temp_down: {
    bono: [
      'La pista bajó {temp_delta} grados en este stint, {driver}.',
      'Ok, {temp_delta} grados menos de pista desde que arrancó el stint. Atento al agarre.',
      'Asfalto {temp_delta} grados más frío en este stint. Ojo con la temperatura de gomas.',
      'La pista está más fría que al inicio del stint.',
    ],
    colapinto: [
      '¡El asfalto está {temp_delta} grados más frío que al arrancar el stint!',
      'Bajó {temp_delta} grados la pista en este stint. ¡Mantené las gomas en temperatura!',
      '¡{temp_delta} grados menos de pista desde que arrancó el stint, {driver}! Ojo con el agarre.',
      '¡Se enfrió la pista en este stint, {driver}! Ojo con el agarre.',
    ],
    standard: [
      'La temperatura de pista bajó {temp_delta} grados en este stint.',
      'El asfalto está {temp_delta} grados más frío desde que arrancó el stint, {driver}.',
      'Pista {temp_delta} grados más fría en este stint. Cuidá la temperatura de las gomas.',
      'Bajó la temperatura de pista en este stint.',
    ],
  },
} satisfies Record<RadioAlertCategory, RadioPhrasePool>;

/**
 * What is said after a call to pit about when to: an instruction ("box this lap") or an option
 * (a Safety Car stop). Keyed by the directive's box timing.
 */
export const box_timing_phrases = {
  instruction: {
    this_lap: {
      bono: [
        'Box esta vuelta. Box, box.',
        'Entramos esta vuelta.',
        'Esta vuelta, a boxes.',
      ],
      colapinto: [
        '¡Box esta vuelta, box box!',
        '¡Box, box! ¡Esta vuelta adentro!',
        '¡Entramos esta vuelta, dale!',
      ],
      standard: [
        'Box esta vuelta, box box.',
        'Entrá a boxes esta vuelta.',
        'Paramos esta vuelta. Box, box.',
      ],
    },
    next_lap: {
      bono: [
        'Ya pasamos la entrada. Box la próxima vuelta.',
        'Quedate afuera, box la vuelta que viene.',
      ],
      colapinto: [
        '¡No llegamos a la entrada! Box la vuelta que viene.',
        'Seguí afuera, ¡box la próxima vuelta!',
      ],
      standard: [
        'Ya no llegás a la entrada de boxes. Box la próxima vuelta.',
        'Quedate en pista y entrá a boxes la próxima vuelta.',
      ],
    },
    asap: {
      bono: [
        'Box en cuanto puedas.',
        'A boxes apenas se pueda.',
      ],
      colapinto: [
        '¡Entrá a boxes en cuanto puedas!',
        '¡A boxes apenas puedas!',
      ],
      standard: [
        'Entrá a boxes lo antes posible.',
        'Box en la primera oportunidad.',
      ],
    },
  },
  option: {
    this_lap: {
      bono: [
        'Todavía llegamos a entrar esta vuelta.',
        'Si queremos, esta vuelta llegamos a boxes.',
      ],
      colapinto: [
        '¡Todavía llegamos a parar esta vuelta!',
        'Si querés, esta vuelta llegamos a entrar.',
      ],
      standard: [
        'Aún llegamos a la entrada de boxes esta vuelta.',
        'Si paramos, todavía llegamos a entrar esta vuelta.',
      ],
    },
    next_lap: {
      bono: [
        'Esta entrada ya no llega. Sería la próxima vuelta.',
        'Tarde para esta vuelta, sería la que viene.',
      ],
      colapinto: [
        'Ya no llegamos a esta entrada, ¡sería la vuelta que viene!',
        'Para esta vuelta es tarde, sería la próxima.',
      ],
      standard: [
        'Ya no llegamos a la entrada esta vuelta. Sería la próxima.',
        'Es tarde para entrar esta vuelta, la parada sería la próxima.',
      ],
    },
    asap: {
      standard: [
      ],
    },
  },
} satisfies Record<BoxCallKind, Record<EngineerBoxTiming, RadioPhrasePool>>;

/**
 * Las partes de un informe de diferencias, después de su frase de apertura: la posición, y la
 * diferencia con el auto de adelante y el de atrás con cómo se mueve. `{position}`, `{gap}`
 * (segundos) y `{rate}` (segundos por vuelta) se llenan con los números del informe.
 */
export const report_phrases = {
  position: {
    standard: [
      'Vas P{position}.',
      'Estás P{position}.',
      'Corrés en P{position}.',
    ],
  },
  leading: {
    standard: [
      'Vas primero.',
      'Liderás la carrera.',
      'Estás en punta.',
    ],
  },
  ahead: {
    standard: [
      'El de adelante a {gap}.',
      'Adelante, {gap} segundos.',
      'Diferencia con el de adelante, {gap}.',
    ],
  },
  ahead_closing: {
    standard: [
      'El de adelante a {gap}, le descontás {rate} por vuelta.',
      'Adelante, {gap}, y te acercás {rate} por vuelta.',
      'Diferencia adelante {gap}, bajando {rate} por vuelta.',
    ],
  },
  ahead_opening: {
    standard: [
      'El de adelante a {gap}, se aleja {rate} por vuelta.',
      'Adelante, {gap}, y perdés {rate} por vuelta.',
      'Diferencia adelante {gap}, sube {rate} por vuelta.',
    ],
  },
  ahead_stable: {
    standard: [
      'El de adelante a {gap}, estable.',
      'Adelante, {gap}, la diferencia se mantiene.',
      'Diferencia adelante {gap}, sin cambios.',
    ],
  },
  behind: {
    standard: [
      'El de atrás a {gap}.',
      'Atrás, {gap} segundos.',
      'Diferencia con el de atrás, {gap}.',
    ],
  },
  behind_closing: {
    standard: [
      'El de atrás a {gap}, te descuenta {rate} por vuelta.',
      'Atrás, {gap}, y se acerca {rate} por vuelta.',
      'Diferencia atrás {gap}, bajando {rate} por vuelta.',
    ],
  },
  behind_opening: {
    standard: [
      'El de atrás a {gap}, le sacás {rate} por vuelta.',
      'Atrás, {gap}, y se aleja {rate} por vuelta.',
      'Diferencia atrás {gap}, sube {rate} por vuelta.',
    ],
  },
  behind_stable: {
    standard: [
      'El de atrás a {gap}, estable.',
      'Atrás, {gap}, la diferencia se mantiene.',
      'Diferencia atrás {gap}, sin cambios.',
    ],
  },
  nobody_close: {
    standard: [
      'Nadie a menos de diez segundos.',
      'Sin autos cerca, más de diez segundos para los dos lados.',
      'Aire limpio, nadie a menos de diez segundos.',
    ],
  },
  tyre_life_one_lap: {
    standard: [
      'A la {wheel} le queda más o menos una vuelta.',
      'Queda una vuelta en estas gomas, la {wheel} es la primera en llegar al límite.',
      'Una vuelta más y la {wheel} llega al límite.',
      'Queda más o menos una vuelta en estas gomas.',
      'Estas gomas están al límite, les queda una vuelta.',
      'Una vuelta más y las gomas llegan al límite.',
    ],
  },
  elimination_drop_zone: {
    standard: [
      'Eso es zona de eliminación.',
      'Por ahora quedamos afuera.',
      'Estamos en zona de eliminación.',
    ],
  },
  elimination_last_through: {
    standard: [
      'Justo en el corte.',
      'Somos el último que pasa, no estamos a salvo.',
      'Pasamos por poco, no es seguro.',
    ],
  },
} satisfies Record<ReportPhrase, RadioPhrasePool>;

/**
 * Lo que dice el ingeniero en un intercambio por push-to-talk, aparte de la respuesta. `{driver}`
 * es el indicativo.
 * - say_again: el piloto abrió la radio pero no llegó ninguna palabra.
 * - radio_fault: la radio no funciona y no se lo escucha (el micrófono está bloqueado o no está,
 *   el servicio de voz no responde).
 * - stand_by: la pregunta llegó y la respuesta está en camino.
 * - answer_failed: el muro de boxes no pudo conseguir la respuesta.
 */
export const exchange_phrases = {
  say_again: {
    bono: [
      'Repetí, {driver}, no te entendimos.',
      '{driver}, no llegó nada. Repetí, por favor.',
    ],
    colapinto: [
      '¿Cómo, {driver}? Repetí, por favor.',
      'No te copié, {driver}. ¿Me repetís?',
    ],
    standard: [
      'Repetí el mensaje, {driver}.',
      'No te entendimos, {driver}. Repetí, por favor.',
    ],
  },
  radio_fault: {
    bono: [
      'Problema de radio, {driver}. No te escuchamos.',
      'No nos llega tu radio, {driver}.',
    ],
    colapinto: [
      'Perdón, {driver}, la radio no anda. No te escuchamos.',
      '{driver}, se cortó la radio. No nos llega nada.',
    ],
    standard: [
      'La radio no funciona, {driver}. No te escuchamos.',
      'Problema de radio de nuestro lado, {driver}. No te recibimos.',
    ],
  },
  stand_by: {
    bono: [
      'Copiado, {driver}. Un momento.',
      'Recibido, {driver}. Esperá.',
    ],
    colapinto: [
      '¡Copiado, {driver}! Bancame un segundo.',
      'Dale, {driver}, ya lo vemos. Aguantá.',
    ],
    standard: [
      'Copiado, {driver}. Aguardá un momento.',
      'Recibido, {driver}. Lo estamos revisando.',
    ],
  },
  answer_failed: {
    bono: [
      'Perdón, {driver}, ese dato no lo tenemos ahora.',
      'No podemos darte eso ahora, {driver}.',
    ],
    colapinto: [
      'Uh, perdón, {driver}. Ahora no lo puedo sacar.',
      'No te lo puedo confirmar ahora, {driver}. ¡Perdón!',
    ],
    standard: [
      'Lo siento, {driver}, ahora no podemos darte esa información.',
      'No tenemos ese dato en este momento, {driver}.',
    ],
  },
} satisfies Record<ExchangeLine, RadioPhrasePool>;

/**
 * Las palabras con que se dicen la rueda, el eje y la goma de la llamada. Las frases las usan
 * así: "la goma {wheel}" o "la {wheel}" (femenino), "el eje {axle}" (masculino), "gomas {compound}"
 * (plural femenino).
 */
export const value_words = {
  wheel: {
    front_left: 'delantera izquierda',
    front_right: 'delantera derecha',
    rear_left: 'trasera izquierda',
    rear_right: 'trasera derecha',
  },
  axle: {
    front: 'delantero',
    rear: 'trasero',
  },
  compound: {
    soft: 'blandas',
    medium: 'medias',
    hard: 'duras',
    inter: 'intermedias',
    wet: 'de lluvia',
  },
} satisfies RadioValueWords;
