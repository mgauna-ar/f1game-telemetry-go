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
      'Safety Car, Safety Car. Keep the delta positive.',
      'Okay, {driver}, Safety Car. Delta positive, no overtaking.',
      'Safety Car deployed. Stay positive on the delta.',
      'Full Safety Car, {driver}. Nice and calm, watch the delta.',
      'Safety Car is out. Respect the delta, no passing.',
    ],
    colapinto: [
      'Safety Car, Safety Car! Delta positive, no overtaking!',
      'Safety Car on track, {driver}! Watch that delta!',
      'Safety Car is out! Slow it down, keep the delta positive.',
      'Full Safety Car, {driver}! No overtaking, mind the delta!',
      'We have a Safety Car! Stay sharp, delta positive!',
    ],
    standard: [
      'Safety Car deployed. Keep the delta positive and do not overtake.',
      'Safety Car, {driver}. Slow down and respect the delta.',
      'The Safety Car is out. Maintain a positive delta.',
      'Full Safety Car on track. No overtaking, watch your delta.',
      'Safety Car period, {driver}. Hold position and keep the delta positive.',
    ],
  },
  vsc: {
    bono: [
      'VSC, VSC. Keep the delta positive.',
      'Okay, {driver}, Virtual Safety Car. Delta positive.',
      'Virtual Safety Car deployed. No overtaking, watch the delta.',
      'VSC, {driver}. Stay on the positive side of the delta.',
      'We have a VSC. Nice and steady on the delta.',
    ],
    colapinto: [
      'VSC, VSC! Delta positive, no overtaking!',
      'Virtual Safety Car, {driver}! Watch the delta!',
      'VSC is out! Slow down, keep the delta positive!',
      'Virtual Safety Car deployed! Keep it positive on the delta, {driver}!',
    ],
    standard: [
      'Virtual Safety Car deployed. Keep the delta positive.',
      'VSC, {driver}. Maintain a positive delta, no overtaking.',
      'The Virtual Safety Car is out. Slow down to the delta.',
      'VSC period. Hold position and keep the delta positive.',
      'Virtual Safety Car, {driver}. Watch your delta, no overtaking.',
    ],
  },
  safety_car_box: {
    bono: [
      'Safety Car, Safety Car. We take the stop under it.',
      "Okay, {driver}, Safety Car. We're pitting.",
      'Safety Car deployed. We pit under it, delta positive.',
      'Safety Car, {driver}. This is our stop.',
    ],
    colapinto: [
      'Safety Car! We take the stop under it, {driver}!',
      "Safety Car out, we're pitting! Delta positive!",
      "Safety Car, {driver}! Cheaper stop, we're taking it!",
    ],
    standard: [
      "Safety Car deployed. We'll take the stop under it.",
      "Safety Car, {driver}. We're pitting under the Safety Car.",
      "Safety Car on track. Keep the delta positive, we're pitting.",
    ],
  },
  vsc_box: {
    bono: [
      'VSC, VSC. We take the stop under it.',
      "Okay, {driver}, Virtual Safety Car. We're pitting.",
      'Virtual Safety Car. Delta positive, we pit under it.',
    ],
    colapinto: [
      "VSC, {driver}! We're pitting under it!",
      'Virtual Safety Car! We take the stop, mind the delta!',
      "VSC is out! Cheaper stop, we're having it!",
    ],
    standard: [
      "Virtual Safety Car deployed. We'll pit under it.",
      "VSC, {driver}. Keep the delta positive, we're pitting.",
      'Virtual Safety Car on track. This is our stop.',
    ],
  },
  red_flag: {
    bono: [
      'Red flag, red flag. Slow down, back to the pit lane.',
      "Okay, {driver}, red flag. Session's stopped, bring it in slowly.",
      'Red flag. Easy back to the pit lane, {driver}.',
    ],
    colapinto: [
      'Red flag, red flag! Slow down, bring it to the pit lane!',
      'Red flag, {driver}! Session stopped, back to the pits carefully.',
      "It's a red flag! Easy now, into the pit lane.",
    ],
    standard: [
      'Red flag, red flag. Session stopped, return to the pit lane.',
      'Red flag, {driver}. Slow down and come back to the pit lane.',
      'Red flag on track. Bring the car slowly into the pit lane.',
    ],
  },
  tyre_puncture: {
    bono: [
      'Puncture on the {wheel}, {driver}. Bring it in carefully.',
      'Okay, {driver}, {wheel} puncture. Nurse it back.',
      'We have a puncture, {wheel} tyre. Easy over the kerbs.',
      'Puncture. Steady, bring it back to us.',
    ],
    colapinto: [
      'Puncture on the {wheel}, {driver}! Careful, bring it back!',
      'Puncture, {wheel}! Easy, easy, no risks!',
      "We've got a puncture, {wheel} tyre! Gently on the way in!",
      'Puncture, puncture! Bring it in easy, {driver}!',
    ],
    standard: [
      'Puncture on the {wheel} tyre. Bring the car in carefully.',
      'You have a {wheel} puncture, {driver}. Keep it steady.',
      'The {wheel} tyre is punctured. Slowly back to the pit lane.',
      'Puncture. Bring the car back carefully.',
    ],
  },
  tyre_worn_out: {
    bono: [
      "The {wheel} is at {pct} percent, {driver}. It's finished, we stop.",
      'Okay, {driver}, {wheel} tyre is done. {pct} percent worn, we pit.',
      "{pct} percent on the {wheel}. That tyre's had it, we stop.",
      "That tyre's finished, {driver}. We stop.",
    ],
    colapinto: [
      'The {wheel} is gone, {pct} percent worn! We stop, {driver}!',
      "It's finished, the {wheel} is at {pct} percent! We're pitting!",
      'Nothing left in the {wheel}, {driver}! {pct} percent, we stop.',
      "That tyre's finished! We have to stop, {driver}.",
    ],
    standard: [
      'The {wheel} tyre is worn to {pct} percent. We need to stop.',
      "The {wheel} is at {pct} percent wear, {driver}. It's finished, we pit.",
      "{pct} percent wear on the {wheel}. That tyre is done, we're stopping.",
      'That tyre is worn out. We need to stop.',
    ],
  },
  tyre_wear: {
    bono: [
      'Okay, {driver}, the {wheel} is at {pct} percent wear. Start looking after it.',
      'Tyre wear, {wheel} at {pct} percent. Manage the slides.',
      '{pct} percent on the {wheel}. Easy on it from here.',
      'The {wheel} is our most worn, {pct} percent. Manage it.',
      'Wear check, {driver}. Most worn is the {wheel}, {pct} percent.',
      'Tyre wear is building. Manage the slides.',
    ],
    colapinto: [
      'The {wheel} is at {pct} percent, {driver}! Look after it.',
      'Wear on the {wheel} is {pct} percent! Smooth inputs now.',
      "Careful with the {wheel}, {driver}, it's at {pct} percent!",
      '{pct} percent wear on the {wheel}! Less sliding, more care!',
      'Tyres are starting to wear, {driver}! Manage them.',
    ],
    standard: [
      'The {wheel} tyre is at {pct} percent wear. Start managing it.',
      'Most worn tyre is the {wheel}, {pct} percent, {driver}. Manage it.',
      '{pct} percent wear on the {wheel}. Keep the slides under control.',
      'The {wheel} is at {pct} percent, {driver}. Look after the tyres.',
      'Tyre wear is building. Manage the tyres.',
    ],
  },
  tyre_wear_critical: {
    bono: [
      'Okay, {driver}, the {wheel} is at {pct} percent. Critical now.',
      'Every corner counts, the {wheel} is at {pct} percent.',
      'Tyre wear critical, {wheel} on {pct} percent. Nurse it.',
      'The {wheel} is on {pct} percent, {driver}. Very little left.',
      'Tyre wear is critical. Protect the tyres.',
    ],
    colapinto: [
      'Careful, the {wheel} is at {pct} percent, {driver}! Critical!',
      'Critical wear, the {wheel} is on {pct} percent!',
      'The {wheel} is almost gone, {pct} percent! Look after it!',
      '{pct} percent on the {wheel}, {driver}! Nurse it, nurse it!',
      'Tyres are critical, {driver}! Look after them!',
    ],
    standard: [
      'Critical tyre wear. The {wheel} is at {pct} percent.',
      'The {wheel} tyre has reached {pct} percent, {driver}. Protect it.',
      '{pct} percent wear on the {wheel}. Manage every corner.',
      'Wear on the {wheel} is critical, {driver}. {pct} percent.',
      'Tyre wear is critical. Manage your pace.',
    ],
  },
  tyre_overheat: {
    bono: [
      'Rears are running hot, {driver}. Easy on the traction.',
      'Rear tyre temps are high. Gentle on the throttle out of the slow stuff.',
      'Okay, {driver}, rears are overheating. Manage the wheelspin.',
      'Rear surface temps are up. Smooth on exit, cool them.',
    ],
    colapinto: [
      'The rears are cooking, {driver}! Smooth on the throttle!',
      'Rear tyres too hot! Less wheelspin out of the corners!',
      'Rears overheating, {driver}! Stop the slides, cool them down!',
      'Hot rears! Feed the throttle in gently!',
    ],
    standard: [
      'Rear tyres are overheating. Manage traction out of the corners.',
      'Rear tyre surface temperatures are high, {driver}. Reduce the sliding.',
      'The rears are too hot. Be progressive with the throttle on exit.',
      'Rear tyre temperatures are over the window, {driver}. Fewer slides.',
    ],
  },
  tyre_cold: {
    bono: [
      'Tyres are cold, {driver}. Work some temperature into them.',
      'Tyre temps are low. Build them up gradually.',
      'Okay, {driver}, tyres still cold. Careful until they switch on.',
      'Not much heat in the tyres yet. Bring them in gently.',
    ],
    colapinto: [
      'Cold tyres, {driver}! Get some heat into them!',
      'Tyres are still cold! Push gradually, careful!',
      'No temperature in the tyres yet, {driver}! Work them!',
      'Tyres below the window! Build it up, step by step!',
    ],
    standard: [
      'Tyres are cold. Build temperature before you push.',
      'Tyre temperatures are below the window, {driver}. Warm them up.',
      'The tyres are still cold. Take care and push gradually.',
      'The tyres need temperature, {driver}. Work them up gradually.',
    ],
  },
  wing_damage: {
    bono: [
      'Front wing damage, {driver}, {pct} percent. Expect understeer.',
      'Okay, {driver}, front wing is {pct} percent damaged. Less front grip.',
      "We see {pct} percent front wing damage. It'll understeer.",
      "Front wing's damaged. You'll have less front end.",
    ],
    colapinto: [
      'Front wing damage, {pct} percent, {driver}! Watch the understeer!',
      "We've lost front wing, {pct} percent! Less grip on the front!",
      '{pct} percent damage on the front wing! Careful on entry!',
      "Front wing damage, {driver}! It'll push in the corners!",
    ],
    standard: [
      'The front wing is {pct} percent damaged. Expect understeer.',
      'Front wing damage at {pct} percent, {driver}. Front grip is reduced.',
      'You have {pct} percent front wing damage. Expect less front grip.',
      'Front wing damage. Expect understeer in the faster corners.',
    ],
  },
  floor_damage: {
    bono: [
      'Floor damage, {driver}, {pct} percent. Less grip in the quick stuff.',
      "Okay, {driver}, {pct} percent floor damage. We've lost some downforce.",
      "The floor's {pct} percent damaged. Careful in the high-speed corners.",
      'Floor damage, {driver}. Downforce is down.',
    ],
    colapinto: [
      'Floor damage, {pct} percent, {driver}! Watch the fast corners!',
      "We've got {pct} percent floor damage! Less downforce, be careful!",
      '{pct} percent on the floor! The car will feel lighter at high speed!',
      'Floor damage, {driver}! We lost some downforce!',
    ],
    standard: [
      'Floor damage at {pct} percent. Expect less downforce.',
      'The floor and diffuser are {pct} percent damaged, {driver}. Less high-speed grip.',
      'We have {pct} percent floor damage. Take care in the high-speed corners.',
      'Floor damage. Downforce is reduced, especially at high speed.',
    ],
  },
  engine_wear: {
    bono: [
      'Power unit wear is at {pct} percent, {driver}. Look after it.',
      'Okay, {driver}, one of the engine parts is at {pct} percent wear.',
      '{pct} percent wear on the power unit. Short-shift where you can.',
      'Power unit wear is getting high. Treat it kindly.',
    ],
    colapinto: [
      'Engine wear at {pct} percent, {driver}! Look after it!',
      'Power unit part at {pct} percent! Short-shift a bit, protect it!',
      '{pct} percent wear on the engine, {driver}. Be kind to it.',
      'Engine wear is high, {driver}! Protect the power unit!',
    ],
    standard: [
      'Power unit component wear has reached {pct} percent.',
      'A power unit part is at {pct} percent wear, {driver}. Short-shift where possible.',
      'Engine wear at {pct} percent. Avoid the rev limiter.',
      'Power unit wear is high. Manage the engine.',
    ],
  },
  terminal_engine: {
    bono: [
      'Engine failure, {driver}. Pull over safely and stop the car.',
      "We've lost the engine. Find a safe place and stop.",
      "Okay, {driver}, the engine's gone. Off the racing line and stop.",
    ],
    colapinto: [
      'Engine failure, {driver}! Pull off safely, stop the car!',
      "We've lost the engine! Get off the line, somewhere safe!",
      "The engine's gone, {driver}! Stop it somewhere safe.",
    ],
    standard: [
      'Engine failure. Pull off the track safely and stop the car.',
      'The engine has failed, {driver}. Stop in a safe place.',
      'Terminal engine failure. Get off the racing line and stop.',
    ],
  },
  ers_low: {
    bono: [
      "Battery's at {pct} percent, {driver}. Let it recharge.",
      'Okay, {driver}, {pct} percent battery. Harvest for a bit.',
      '{pct} percent left in the battery. Save some deploy.',
      'Battery on {pct} percent. Build it back up.',
      'Battery is low. Let it recharge.',
    ],
    colapinto: [
      'Battery at {pct} percent, {driver}! Harvest, harvest!',
      "Only {pct} percent battery! Let's charge it up!",
      '{pct} percent in the battery, {driver}! Save some energy now!',
      "We're on {pct} percent battery! Get some charge back in!",
      'Battery is low, {driver}! Harvest some energy!',
    ],
    standard: [
      'Battery charge is at {pct} percent. Let it recharge.',
      'The battery is at {pct} percent, {driver}. Save some energy.',
      'ERS at {pct} percent. Harvest to build the charge back up.',
      'Battery down to {pct} percent. Reduce deployment for now.',
      'Battery charge is low. Harvest some energy.',
    ],
  },
  radiator_overheat: {
    bono: [
      "Engine temperature's high, {driver}. A bit of lift and coast.",
      'Engine running warm. Get out of the tow when you can.',
      'Okay, {driver}, engine temps are up. Some lift and coast, find clean air.',
      'Watch the engine temperature. Lift a little earlier into the big stops.',
    ],
    colapinto: [
      "Engine's getting hot, {driver}! Lift and coast a bit!",
      'Engine temp is high! Pull out of the tow, find some air!',
      'Hot engine, {driver}! Lift a little earlier into the braking!',
      'Engine temperatures up! A bit of lift and coast, get some clean air!',
    ],
    standard: [
      'Engine temperature is high. Use some lift and coast.',
      'The engine is running hot, {driver}. Move out of the tow to cool it.',
      'Engine temperature over the limit. Lift and coast into the heavy braking zones.',
      'The engine is warm. Find some clean air when you can.',
    ],
  },
  radiator_overheat_high: {
    bono: [
      'Engine temperature still climbing, {driver}. More lift and coast.',
      "Engine's getting hotter. Out of the tow, find clean air.",
      'Okay, {driver}, temps still rising. Lift earlier, coast longer.',
    ],
    colapinto: [
      'Engine still heating up, {driver}! More lift and coast!',
      "It's getting hotter! Get out of the tow, clean air!",
      'Temps still going up, {driver}! Lift earlier, cool it!',
    ],
    standard: [
      'Engine temperature is still rising. More lift and coast, please.',
      'The engine is getting hotter, {driver}. Find clean air.',
      'Engine temperature still climbing. Lift earlier and stay out of the tow.',
    ],
  },
  radiator_overheat_critical: {
    bono: [
      'Engine temperature critical, {driver}. Lift and coast now.',
      'Critical engine temps. Out of the tow, lift and coast.',
      'Okay, {driver}, engine is critical. Cool it, lots of lift and coast.',
    ],
    colapinto: [
      'Engine is critical, {driver}! Lift and coast, now!',
      'Critical temperature! Out of the tow, cool it down!',
      'Engine way too hot! Lift and coast everywhere, {driver}!',
    ],
    standard: [
      'Critical engine temperature. Lift and coast now, get into clean air.',
      'Engine temperature is critical, {driver}. Cool it down immediately.',
      'Engine temperature critical. Lift and coast and leave the tow.',
    ],
  },
  brake_overheat: {
    bono: [
      "The {wheel} brake's running hot, {driver}. Bias rearward a click.",
      'Okay, {driver}, {wheel} brake is overheating. One click back on the bias.',
      'Too much heat in the {wheel} brake. Move the bias back.',
      'Hot brake, {wheel}. Bias rearward, one click.',
      'Front brakes are hot. Bias rearward a click.',
    ],
    colapinto: [
      'The {wheel} brake is cooking, {driver}! Bias back a click!',
      'Brake temps way up on the {wheel}! Bias rearward, one click!',
      'Overheating on the {wheel} brake! Move the bias back, {driver}!',
      'Click the bias rearward! The {wheel} brake is overheating!',
      'Front brake overheating, {driver}! Bias back a click!',
    ],
    standard: [
      'The {wheel} brake is overheating. Move the brake bias rearward a click.',
      'The {wheel} brake temperature is too high, {driver}. Bias rearward.',
      'High temperature on the {wheel} brake. One click of bias to the rear.',
      'Brake bias back a click, {driver}. The {wheel} brake is overheating.',
      'Front brake overheating. Move the bias rearward.',
    ],
  },
  brake_overheat_rear: {
    bono: [
      'Running hot on the {wheel} brake, {driver}. Bias forward a click.',
      'Okay, {driver}, the {wheel} brake is overheating. One click forward.',
      'Hot brake on the {wheel}. Move the bias forward.',
      "The {wheel} brake's too hot. Bias forward, one click.",
      'Rear brakes are hot. Bias forward a click.',
    ],
    colapinto: [
      'The {wheel} brake is cooking, {driver}! Bias forward a click!',
      'Overheating on the {wheel} brake! Bias forward, one click!',
      'Too hot on the {wheel} brake! Bring the bias forward, {driver}!',
      'Move the bias forward! The {wheel} brake is overheating!',
      'Rear brake overheating, {driver}! Bias forward!',
    ],
    standard: [
      'The {wheel} brake is overheating. Move the brake bias forward a click.',
      'The {wheel} brake temperature is too high, {driver}. Bias forward.',
      'High temperature on the {wheel} brake. One click of bias forward.',
      'Bias forward a click, {driver}. The {wheel} brake is overheating.',
      'Rear brake overheating. Move the bias forward.',
    ],
  },
  brake_cold: {
    bono: [
      'Brakes are cold, {driver}. Put some heat into them.',
      'Brake temps are low. Lean on them a little.',
      'Okay, {driver}, cold brakes. Careful on the first big stop.',
      'Brakes need temperature. A bit more pressure on them.',
    ],
    colapinto: [
      'Cold brakes, {driver}! Warm them up!',
      'Brakes are cold! Brake a bit harder to wake them up!',
      'No temperature in the brakes, {driver}! Careful into the braking zones!',
      'Brakes too cold! Drag them a little, get them working!',
    ],
    standard: [
      'Brake temperatures are low. Use some brake pressure to warm them.',
      'The brakes are cold, {driver}. Take care in the braking zones.',
      'Cold brakes. Build the temperature before you push.',
      "Warm the brakes up, {driver}. They're below their window.",
    ],
  },
  brake_bias: {
    bono: [
      'The front brakes are doing too much, {driver}. Bias rearward.',
      'Fronts much hotter than the rears. Move the bias back.',
      'Okay, {driver}, too much heat in the front brakes. Bias to the rear.',
    ],
    colapinto: [
      'Fronts are way hotter than the rears, {driver}! Bias back!',
      'Too much front brake! Shift the bias rearward!',
      'Front brakes running hot, {driver}! Move the bias back!',
    ],
    standard: [
      'The front brakes are running much hotter than the rears. Move the bias rearward.',
      'Brake temperatures are higher on the front axle, {driver}. Bias rearward.',
      'Too much braking on the front axle. Shift the brake bias back.',
    ],
  },
  brake_bias_forward: {
    bono: [
      'The rear brakes are working too hard, {driver}. Bias forward.',
      'Rears much hotter than the fronts. Move the bias forward.',
      'Okay, {driver}, too much heat at the rear. Bring the bias forward.',
    ],
    colapinto: [
      'Rears are way hotter than the fronts, {driver}! Bias forward!',
      'Too much rear brake! Shift the bias forward!',
      'Rear brakes running hot, {driver}! Move the bias forward!',
    ],
    standard: [
      'The rear brakes are running much hotter than the fronts. Move the bias forward.',
      'Brake temperatures are higher on the rear axle, {driver}. Bias forward.',
      'Too much braking on the rear axle. Shift the brake bias forward.',
    ],
  },
  fuel_deficit: {
    bono: [
      "We're {fuel_laps} laps short on fuel, {driver}. Lift and coast into the big stops.",
      'Okay, {driver}, fuel is {fuel_laps} laps down. Start lifting and coasting.',
      'Fuel target, {fuel_laps} laps short. Lift and coast, please.',
      '{fuel_laps} laps short on fuel. Lift before the heavy braking zones.',
      "We're short on fuel. Lift and coast into the big stops.",
    ],
    colapinto: [
      'Fuel is {fuel_laps} laps short, {driver}! Lift and coast!',
      'We need to save, {fuel_laps} laps short! Lift into the braking zones!',
      '{fuel_laps} laps down on fuel, {driver}. Lift and coast, every big stop.',
      'Fuel target is {fuel_laps} laps short! Lift early, coast in!',
      "We're down on fuel, {driver}! Lift and coast!",
    ],
    standard: [
      'We are {fuel_laps} laps short on the fuel target. Lift and coast into the heavy braking zones.',
      'Fuel is {fuel_laps} laps short, {driver}. Please lift and coast.',
      'Fuel deficit of {fuel_laps} laps. Lift and coast into the big braking zones.',
      'The fuel target is {fuel_laps} laps short. Start saving fuel.',
      'We are short on fuel. Lift and coast into heavy braking.',
    ],
  },
  undercut_window: {
    bono: [
      'Car behind has pitted, {gap} back, {driver}. Push now.',
      'Okay, {driver}, the car behind is in, {gap} behind. Hammer time.',
      'Undercut attempt, car behind pitted at {gap}. Push, push.',
      'Car behind has boxed. Push now, cover the undercut.',
    ],
    colapinto: [
      'Car behind just pitted, {gap} back! Push flat out, {driver}!',
      'Undercut from the car behind, {gap} seconds! Give it everything!',
      'The car behind has boxed, {gap} gap! Push now, {driver}!',
      'Car behind just pitted, {driver}! Push, cover the undercut!',
    ],
    standard: [
      'Car behind has pitted from {gap} back. Push to cover the undercut.',
      'The car {gap} behind has boxed, {driver}. Maximum pace now.',
      'Undercut threat. The car behind pitted at {gap} seconds, push.',
      'The car behind has pitted. Push now to cover the undercut.',
    ],
  },
  overcut_window: {
    bono: [
      'Car ahead has boxed, {gap} in front, {driver}. Clean air, push.',
      'Okay, {driver}, the car ahead pitted at {gap}. Overcut, push now.',
      'Car ahead in the pits, {gap} gap. Use the clean air.',
      'Car ahead has pitted. Push in the clean air.',
    ],
    colapinto: [
      'Car ahead just pitted, {gap} ahead! Push, {driver}!',
      'Car in front boxed at {gap}! Clean air, go for the overcut!',
      'Car ahead is in the pits, {gap} gap! Hammer it, {driver}!',
      'Car ahead has boxed, {driver}! Clean air, go, go, go!',
    ],
    standard: [
      'The car ahead, {gap} seconds up the road, has pitted. Push now.',
      'The car ahead has boxed at {gap}, {driver}. Push in the clean air.',
      'Car ahead pitted from {gap} in front. Push for the overcut.',
      'The car ahead has pitted. Push in clean air for the overcut.',
    ],
  },
  pit_plan_next_lap: {
    bono: [
      'Box next lap, {driver}. We should come out P{position}.',
      'Okay, {driver}, we stop next lap. Rejoin around P{position}.',
      'Plan is box next lap. Projected rejoin P{position}.',
      "Next lap is the stop. We'd come out P{position}.",
      "Box next lap, {driver}. That's the plan.",
      'Next lap is our stop.',
    ],
    colapinto: [
      'Box next lap, {driver}! We come out around P{position}!',
      'Get ready, we stop next lap! Should be P{position} after!',
      'Next lap we box, {driver}! Projected P{position} on exit!',
      'In next lap! We rejoin around P{position}!',
      'Box next lap, {driver}! Get ready!',
    ],
    standard: [
      'Box next lap. We should rejoin P{position}.',
      'The plan is to pit next lap, {driver}. Projected rejoin P{position}.',
      'We stop at the end of next lap. Expected rejoin position P{position}.',
      'Pit stop next lap, {driver}. We would come out P{position}.',
      'Box next lap, {driver}. Prepare for the stop.',
    ],
  },
  pit_plan_box: {
    bono: [
      'This is our stop, {driver}. We come out P{position}.',
      'Okay, {driver}, planned stop. Rejoin around P{position}.',
      'Time to pit. Should be P{position} when we come out.',
      'Stop as planned. Projected P{position} on exit.',
      'Okay, {driver}, this is the planned stop.',
    ],
    colapinto: [
      'This is the stop, {driver}! We come out around P{position}!',
      'Time to pit! Should rejoin P{position}!',
      'Our stop, {driver}! Projected P{position} after it!',
      "Planned stop! Rejoin around P{position}, let's go!",
      'Time for the stop, {driver}!',
    ],
    standard: [
      'Planned stop, {driver}. We rejoin around P{position}.',
      'This is the planned pit stop. Projected rejoin P{position}.',
      'We pit as planned, {driver}. Expected position on exit P{position}.',
      'Pit as per the plan. We should come out P{position}.',
      'This is the planned stop.',
    ],
  },
  pit_window_close: {
    bono: [
      'Pit window is closing, {driver}. We have to stop.',
      'Last lap of the window. We stop.',
      'Okay, {driver}, last chance to pit. We take it.',
      "Window's closing. No more waiting, we stop.",
    ],
    colapinto: [
      'Pit window closing, {driver}! We have to stop!',
      'Last chance to pit! We go for it!',
      'This is the last lap of the window, {driver}! We stop!',
      'The window is closing! No more waiting, we pit!',
    ],
    standard: [
      'The pit window is closing. We need to stop.',
      'Last lap of the pit window, {driver}. We have to pit.',
      'This is our last chance to stop, {driver}. We pit.',
      'The pit window closes. We must stop.',
    ],
  },
  rival_defend: {
    bono: [
      'Car behind at {gap}, gaining {rate} a lap, {driver}. Defend.',
      'Okay, {driver}, {gap} to the car behind, {rate} a lap quicker. Cover the inside.',
      'Car behind is {gap} back and closing {rate} a lap. Watch your mirrors.',
      'Gap behind {gap}, coming down {rate} a lap. Defend the position.',
      'Car behind at {gap}, {driver}. Defend.',
      '{gap} to the car behind. Cover the inside.',
      'Okay, {driver}, car behind is {gap} back. Keep it tidy.',
      'Car behind is close, {gap}. Protect the position.',
      'Car behind is close, {driver}. Defend.',
    ],
    colapinto: [
      'Car behind at {gap}, gaining {rate} a lap! Close the door, {driver}!',
      '{gap} behind and closing {rate} a lap! Defend hard!',
      '{gap} back and {rate} a lap quicker! Cover it, {driver}!',
      'Car behind {gap}, taking {rate} a lap! Defend, defend!',
      'Car behind at {gap}, {driver}! Close the door!',
      '{gap} to the car behind! Defend the inside!',
      "Car right behind, {gap}! Don't give them anything, {driver}!",
      'Gap behind is {gap}! Keep the door shut!',
      'Car right behind you, {driver}! Close the door!',
    ],
    standard: [
      'Car behind at {gap} seconds, gaining {rate} a lap. Defend.',
      'The car behind is {gap} back and closing {rate} a lap, {driver}. Defend your position.',
      'Gap behind {gap}, coming down {rate} a lap. Protect the inside.',
      'The car behind is {rate} a lap quicker, gap {gap}. Defend.',
      'Car behind at {gap} seconds. Defend.',
      'The car behind is {gap} back, {driver}. Defend your position.',
      'Gap behind is {gap}. Cover the inside line.',
      'Car behind close at {gap}. Watch your mirrors.',
      'Car behind is close, {driver}. Defend your line.',
    ],
  },
  rival_defend_drs: {
    bono: [
      'Car behind has DRS, {gap}, gaining {rate} a lap. Defend.',
      'Okay, {driver}, DRS car behind at {gap}, closing {rate} a lap. Inside line.',
      'DRS behind you, {gap} and coming down {rate} a lap. Defend the inside.',
      'Car behind in DRS at {gap}, taking {rate} a lap, {driver}. Protect the line.',
      'Car behind has DRS, {gap}, {driver}. Defend.',
      'DRS behind, {gap}. Cover the inside into the braking.',
      'Okay, {driver}, car behind in DRS at {gap}. Nail the exits.',
      'DRS for the car behind, {gap}. Defend the position.',
      'Car behind has DRS, {driver}. Defend.',
    ],
    colapinto: [
      'DRS behind at {gap}, gaining {rate} a lap, {driver}! Cover the inside!',
      'Car behind with DRS, {gap}, {rate} a lap quicker! Close the door!',
      '{gap} behind with DRS and closing {rate} a lap! Defend, defend!',
      'DRS car behind, {gap}, taking {rate} a lap! Big exits, {driver}!',
      'Car behind with DRS at {gap}, {driver}! Cover the inside!',
      'DRS behind, {gap}! Close the door!',
      '{gap} to the car behind and it has DRS! Great exits now!',
      'DRS on you from behind, {gap}! Defend, {driver}!',
      'Car behind has DRS, {driver}! Cover the inside!',
    ],
    standard: [
      'Car behind has DRS, {gap} seconds, gaining {rate} a lap. Defend.',
      'The car behind is in DRS at {gap}, closing {rate} a lap, {driver}.',
      'DRS for the car behind. Gap {gap}, coming down {rate} a lap.',
      'The car behind has DRS and is {rate} a lap quicker. Gap {gap}, defend.',
      'Car behind has DRS, {gap} seconds. Defend.',
      'The car behind is in DRS range at {gap}, {driver}. Defend your position.',
      'DRS for the car behind, gap {gap}. Protect the inside.',
      'Gap behind {gap} with DRS. Focus on your exits.',
      'Car behind within DRS range, {driver}. Defend the inside.',
    ],
  },
  rival_attack: {
    bono: [
      "Car ahead at {gap}, we're gaining {rate} a lap, {driver}. Keep the pressure on.",
      'Okay, {driver}, {gap} to the car ahead, closing {rate} a lap.',
      '{rate} a lap quicker than the car ahead, gap {gap}. Keep at it.',
      'Gap ahead {gap}, coming down {rate} a lap. Keep chipping away.',
      'Car ahead at {gap}, {driver}. Keep the pressure on.',
      '{gap} to the car ahead. Have a look.',
      'Okay, {driver}, car ahead is {gap} in front. Push.',
      'Gap to the car ahead is {gap}. Attack.',
      'Car ahead is close. Keep the pressure on.',
    ],
    colapinto: [
      "Car ahead at {gap} and you're catching {rate} a lap, {driver}! Go for it!",
      '{gap} to the car ahead, taking {rate} a lap! Attack!',
      "We're {rate} a lap faster, gap {gap}! Let's go, {driver}!",
      'Closing {rate} a lap, gap ahead {gap}! Push, push!',
      'Car ahead at {gap}, {driver}! Go for it!',
      '{gap} to the car ahead! Attack, attack!',
      'Gap ahead {gap}! Put them under pressure!',
      "Car in front at {gap}, {driver}! Let's have a go!",
      'Car ahead is close, {driver}! Go for it!',
    ],
    standard: [
      'Car ahead at {gap}, closing {rate} a lap. Keep pushing.',
      'The gap to the car ahead is {gap}, you are gaining {rate} a lap, {driver}.',
      'Gap ahead {gap}, coming down {rate} a lap. Attack.',
      'You are {rate} a lap quicker than the car ahead. Gap {gap}.',
      'Car ahead at {gap} seconds. Keep pushing.',
      'The car ahead is {gap} in front, {driver}. Attack.',
      'The gap to the car ahead is {gap}. Look for an opportunity.',
      'Car ahead in range, gap {gap}. Keep the pressure on.',
      'Car ahead in range, {driver}. Attack.',
    ],
  },
  rival_attack_drs: {
    bono: [
      'DRS on the car ahead at {gap}, gaining {rate} a lap, {driver}.',
      'Okay, {driver}, you have DRS, {gap}, closing {rate} a lap.',
      "Car ahead at {gap}, DRS, and we're {rate} a lap quicker. Use it.",
      'Gap ahead {gap} with DRS, coming down {rate} a lap. Line it up.',
      'DRS on the car ahead, {gap}, {driver}. Use it.',
      'You have DRS, {gap} to the car ahead.',
      'Okay, {driver}, DRS on the car in front at {gap}. Have a look.',
      'Car ahead at {gap}, DRS available.',
      'DRS on the car ahead. Use it on the straight.',
    ],
    colapinto: [
      'DRS on the car ahead at {gap}, catching {rate} a lap, {driver}! Go!',
      '{gap} with DRS and {rate} a lap quicker! Attack!',
      'You have DRS, {gap}, closing {rate} a lap! Send it, {driver}!',
      "DRS, {gap} ahead, taking {rate} a lap! Let's go!",
      'DRS on the car ahead at {gap}, {driver}! Go for it!',
      'You have DRS, {gap}! Attack!',
      '{gap} to the car ahead with DRS! Make it count!',
      'Car in front at {gap}, DRS is yours! Go, {driver}!',
      'DRS on the car ahead, {driver}! Go for it!',
    ],
    standard: [
      'DRS on the car ahead, {gap} seconds, closing {rate} a lap.',
      'You have DRS, {driver}. Gap {gap}, gaining {rate} a lap.',
      'You are {rate} a lap quicker and within DRS. Gap {gap}.',
      'The car ahead is in DRS range at {gap}, you are gaining {rate} a lap.',
      'DRS on the car ahead, {gap} seconds.',
      'You have DRS on the car ahead, {driver}. Gap {gap}.',
      'Gap ahead {gap}, DRS available. Attack.',
      'Within DRS of the car ahead at {gap}. Use it on the straight.',
      'Within DRS of the car ahead, {driver}. Attack.',
    ],
  },
  qualy_traffic: {
    bono: [
      'Traffic ahead, {gap} seconds, {driver}. Back off, make a gap.',
      'Okay, {driver}, car {gap} up the road. Drop back a bit.',
      'Only {gap} to the car ahead. Make some space before the lap.',
      'Car ahead at {gap}. Ease off, find a gap.',
      'Traffic ahead, {driver}. Back off and make a gap.',
    ],
    colapinto: [
      'Traffic ahead at {gap}, {driver}! Back off, make space!',
      'Car only {gap} ahead! Drop back before the lap!',
      '{gap} to the car in front! Give yourself room, {driver}!',
      'Too close, {gap} ahead! Slow it down, make a gap!',
      'Traffic ahead, {driver}! Make a gap before you start the lap!',
    ],
    standard: [
      'Traffic ahead, {gap} seconds. Back off and make a gap.',
      'There is a car {gap} ahead, {driver}. Drop back before the push lap.',
      'Car ahead at {gap} seconds. Create space before you start the lap.',
      'Only {gap} seconds to the car ahead. Back off for clean air.',
      'Traffic ahead on the out-lap. Back off and make a gap.',
    ],
  },
  qualy_clean_air: {
    bono: [
      'Track is clear ahead, {driver}. Prepare the tyres.',
      'Clear air for the lap. Get ready.',
      'Okay, {driver}, nobody ahead. Tyres ready, then go.',
      'Space in front for the lap. Get the tyres ready.',
    ],
    colapinto: [
      'Clear track ahead, {driver}! Get the tyres ready!',
      'Nobody in front! Prepare the tyres, then full attack!',
      "Clean air for the lap, {driver}! Let's go!",
      'Track is all yours ahead! Tyres ready, push lap coming!',
    ],
    standard: [
      'Track is clear ahead. Prepare the tyres for the push lap.',
      'You have clean air for the lap, {driver}. Get the tyres ready.',
      'No traffic ahead. Prepare the tyres and push from the line.',
      'Clean air in front, {driver}. Set up the push lap.',
    ],
  },
  qualy_traffic_ahead: {
    bono: [
      'Slow car ahead, {gap}. Not on a push lap.',
      'Slow car {gap} up the road. Be ready.',
      'Car ahead at {gap}, not pushing. Careful.',
      'Slow car {gap} in front. Watch where it goes.',
      'Slow car ahead. Not on a push lap.',
    ],
    colapinto: [
      'Slow car ahead, {gap}! Careful!',
      'Car not pushing, {gap} ahead! Be ready!',
      '{gap} to a slow car! Eyes up!',
      "Traffic, {gap} ahead! It's on a slow lap!",
      'Slow car ahead! Careful!',
    ],
    standard: [
      'Slow car ahead, {gap} seconds. Not on a push lap.',
      'A car {gap} ahead is on a slow lap. Be ready.',
      'Traffic {gap} seconds ahead, not pushing. Take care.',
      'Car ahead at {gap}, slow lap. It may be in the way.',
      'Slow car ahead. Be ready.',
    ],
  },
  qualy_deleted_lap: {
    bono: [
      "That lap is invalid, {driver}. It won't count.",
      'Lap deleted. Back off, we go again.',
      "Okay, {driver}, that one's gone. Cool down, set up the next.",
    ],
    colapinto: [
      "Lap invalid, {driver}! That one won't count!",
      "That lap's deleted! Back off, next one!",
      'Invalid lap, {driver}. Reset and go again.',
    ],
    standard: [
      'That lap is invalidated. Back off and set up the next one.',
      'The lap has been deleted, {driver}. Prepare the next attempt.',
      "This lap won't count, it's invalid. Abort and reset.",
    ],
  },
  qualy_session_time: {
    bono: [
      'Under {minutes} minutes left, {driver}. Cross the line before the flag.',
      'Okay, {driver}, less than {minutes} minutes. Start the lap in time.',
      'Less than {minutes} minutes. Get across the line before the flag.',
      'Under a minute left, {driver}. Beat the flag.',
    ],
    colapinto: [
      'Under {minutes} minutes to go, {driver}! Beat the flag!',
      'Less than {minutes} minutes! Make sure you cross the line in time!',
      "Clock says under {minutes} minutes, {driver}! Don't miss the flag!",
      'Clock is nearly done, {driver}! Cross the line before the flag!',
    ],
    standard: [
      'Under {minutes} minutes left. Cross the line before the chequered flag.',
      'Less than {minutes} minutes remaining, {driver}. Start your lap before the chequered flag.',
      'Session clock under {minutes} minutes. Time your lap to beat the flag.',
      'Under a minute left. Make sure you start the lap in time.',
    ],
  },
  qualy_session_time_garage: {
    bono: [
      'Under {minutes} minutes left, {driver}. Time to go out.',
      "Okay, {driver}, less than {minutes} minutes. Last run, let's go.",
      '{minutes} minutes or less. Out we go for the final run.',
      'Clock is running down, {driver}. Time to go out.',
    ],
    colapinto: [
      'Under {minutes} minutes, {driver}! Out we go, last run!',
      'Less than {minutes} minutes left! Time to head out!',
      'Last run, {driver}! Under {minutes} minutes on the clock!',
      'Not much time left, {driver}! Head out now!',
    ],
    standard: [
      'Under {minutes} minutes left. Time to go out for the final run.',
      'Less than {minutes} minutes remaining, {driver}. Head out for the last run.',
      'Session clock under {minutes} minutes. Leave the pits for your final attempt.',
      'Clock is running down. Time to go out for the final run.',
    ],
  },
  qualy_elimination_danger: {
    bono: [
      'P{position}, in the drop zone, {driver}. Under {minutes} minutes left.',
      'Okay, {driver}, P{position} with under {minutes} minutes. We need to improve.',
      "We're P{position}, drop zone, less than {minutes} minutes to go.",
      'Okay, {driver}, P{position}. Drop zone, we need to improve.',
      "P{position} right now. That's in the drop zone.",
      "We're in the drop zone, {driver}. We need a lap.",
    ],
    colapinto: [
      'P{position}, drop zone, {driver}! Under {minutes} minutes, we need a lap!',
      "We're P{position} and out right now! Less than {minutes} minutes!",
      'Under {minutes} minutes, P{position}! Big lap needed, {driver}!',
      'P{position}, drop zone, {driver}! We need a big lap!',
      "We're P{position}, out as it stands! Let's improve!",
      'Drop zone, {driver}! We need a big lap!',
    ],
    standard: [
      'P{position}, in the drop zone with under {minutes} minutes left.',
      'You are P{position}, in the elimination zone, {driver}. Less than {minutes} minutes.',
      'Under {minutes} minutes and we are P{position}, in the drop zone.',
      'P{position}, in the drop zone. We need to improve.',
      '{driver}, P{position} is in the elimination zone. We need a better lap.',
      'Currently in the drop zone. We need to improve.',
    ],
  },
  qualy_elimination_bubble: {
    bono: [
      'P{position}, last car through, {driver}. Under {minutes} minutes, not safe.',
      'Okay, {driver}, P{position}, right on the cut. Less than {minutes} minutes.',
      "We're P{position}, on the bubble, with under {minutes} minutes.",
      'P{position}, the last car through, {driver}. Not safe yet.',
      'Okay, {driver}, P{position}. On the bubble.',
      'On the cut line, {driver}. Not safe yet.',
    ],
    colapinto: [
      'P{position}, right on the cut line! Under {minutes} minutes, {driver}!',
      'Last car through, P{position}! Less than {minutes} minutes, not safe!',
      "Under {minutes} minutes and we're P{position}, on the edge!",
      'P{position}, right on the cut line, {driver}! Anyone improves, we drop!',
      "We're P{position}, last one through! Not safe!",
      'Right on the cut line, {driver}! Not safe!',
    ],
    standard: [
      'P{position}, the last place through, with under {minutes} minutes left.',
      'You are P{position}, on the cut line, {driver}. Less than {minutes} minutes.',
      'Under {minutes} minutes remaining and we are P{position}, the last safe place.',
      'P{position}, the last car through. We are at risk.',
      '{driver}, P{position} is right on the cut line. Not safe yet.',
      'We are the last car through. Not safe yet.',
    ],
  },
  qualy_lap_pole: {
    bono: [
      'Provisional pole, {driver}. {pole_gap} clear of P2.',
      'Okay, {driver}, P1 by {pole_gap}. Lovely lap.',
      "That's pole for now, {pole_gap} the margin.",
      'Provisional pole, {driver}. Nice lap.',
      'P1, {driver}. Top of the timesheet.',
    ],
    colapinto: [
      'Provisional pole, {driver}! P1 by {pole_gap}!',
      'P1, P1! {pole_gap} ahead of P2!',
      'Pole position, {driver}! {pole_gap} to the next car!',
      'P1, {driver}! Provisional pole!',
      'Top of the times! Provisional pole!',
    ],
    standard: [
      'Provisional pole. {pole_gap} clear of P2.',
      'You are P1 by {pole_gap}, {driver}.',
      'Pole position for now, {pole_gap} ahead of P2.',
      'Provisional pole, {driver}.',
      'That lap puts you P1.',
    ],
  },
  qualy_lap_result: {
    bono: [
      'P{position}, {pole_gap} off P1, {driver}.',
      'Okay, {driver}, that puts us P{position}. {pole_gap} to pole.',
      "That's P{position}, {pole_gap} off the top.",
      'P{position} for now, {pole_gap} behind P1.',
      'That puts us P{position}, {driver}.',
      'Okay, {driver}, P{position} with that lap.',
      'That was an improvement, {driver}.',
    ],
    colapinto: [
      'P{position}, {driver}! {pole_gap} off P1!',
      'That lap is P{position}, {pole_gap} from pole!',
      "We're P{position}, {driver}! {pole_gap} to the top!",
      '{pole_gap} off pole, P{position}! Good lap!',
      'P{position}, {driver}! Better lap!',
      'That puts us P{position}! Nice one!',
      'Improvement, {driver}! Good lap!',
    ],
    standard: [
      'P{position}, {pole_gap} off P1.',
      'That puts you P{position}, {pole_gap} off the top.',
      '{driver}, P{position}, {pole_gap} behind pole.',
      'New best lap. P{position}, {pole_gap} to P1.',
      'That puts you P{position}.',
      'Your new best puts you P{position}, {driver}.',
      'Lap time improved, {driver}.',
    ],
  },
  qualy_lap_no_improvement: {
    bono: [
      'No improvement on that one, {driver}. P{position}.',
      "Okay, {driver}, not quicker. We're P{position}.",
      'No better that time. P{position} for now.',
      "That one didn't improve. Sitting P{position}.",
      'No improvement on that lap, {driver}.',
    ],
    colapinto: [
      "No improvement, {driver}. We're P{position}.",
      'Not quicker that time! P{position} for now!',
      'P{position}, no improvement, {driver}!',
      "Didn't improve, we're P{position}! Keep fighting!",
      'That lap was no quicker, {driver}!',
    ],
    standard: [
      'No improvement. You are P{position}.',
      'That lap was not quicker, {driver}. Running P{position}.',
      'No lap time improvement, P{position}.',
      'That lap did not improve your time. P{position}.',
      'No improvement on that lap.',
    ],
  },
  track_limits_warnings: {
    bono: [
      "That's {count} track limits warnings, {driver}. Keep it on the black stuff.",
      'Okay, {driver}, {count} warnings for track limits. Tidy it up.',
      "Track limits, that's {count} now. Inside the white lines.",
      '{count} warnings for track limits. No more, please.',
      'Track limits warning, {driver}. Mind the white lines.',
    ],
    colapinto: [
      '{count} track limits warnings, {driver}! Keep it inside the lines!',
      "That's {count} warnings! Careful with the track limits!",
      'Track limits again, {count} warnings! Four wheels inside, {driver}!',
      'We have {count} warnings for track limits! Watch the white lines!',
      'Track limits warning, {driver}! Inside the white lines!',
    ],
    standard: [
      '{count} track limits warnings. Keep all four wheels inside the lines.',
      'You now have {count} track limits warnings, {driver}.',
      'Track limits warning number {count}. Stay within the white lines.',
      'That is {count} warnings for track limits, {driver}. Respect the white lines.',
      'Track limits warning, {driver}. Keep it inside the lines.',
    ],
  },
  penalties_incurred: {
    bono: [
      '{penalty_sec} second time penalty, {driver}.',
      'Okay, {driver}, the stewards have given us {penalty_sec} seconds.',
      "We've got a {penalty_sec} second penalty. Head down, keep going.",
      'Time penalty from the stewards, {driver}.',
    ],
    colapinto: [
      '{penalty_sec} second penalty, {driver}! Head down, keep pushing!',
      'Stewards gave us {penalty_sec} seconds! Push to cover it!',
      "It's a {penalty_sec} second time penalty! We fight on, {driver}!",
      'Time penalty, {driver}! Keep pushing!',
    ],
    standard: [
      '{penalty_sec} second time penalty from the stewards.',
      'You have a {penalty_sec} second time penalty, {driver}.',
      'The stewards have issued a {penalty_sec} second penalty.',
      'The stewards have given you a time penalty.',
    ],
  },
  penalty_drive_through: {
    bono: [
      'Drive-through penalty, {driver}. Three laps to serve it.',
      'Okay, {driver}, we have a drive-through. Within three laps.',
      "Drive-through penalty. We'll serve it inside three laps.",
    ],
    colapinto: [
      'Drive-through penalty, {driver}! We serve it within three laps.',
      "We've got a drive-through! Three laps to take it.",
      'Drive-through, {driver}! Head down, three laps to serve it.',
    ],
    standard: [
      'Drive-through penalty. It must be served within three laps.',
      'You have a drive-through penalty, {driver}. Serve it within three laps.',
      'The stewards have given us a drive-through. Three laps to serve it.',
    ],
  },
  penalty_stop_go: {
    bono: [
      'Stop-go penalty, {driver}. Three laps to serve it.',
      'Okay, {driver}, stop-go penalty. Within three laps.',
      "We have a stop-go. It's to be served inside three laps.",
    ],
    colapinto: [
      'Stop-go penalty, {driver}! We serve it within three laps.',
      "We've got a stop-go! Three laps to take it.",
      'Stop-go, {driver}! Head down, three laps to serve it.',
    ],
    standard: [
      'Stop-go penalty. It must be served within three laps.',
      'You have a stop-go penalty, {driver}. Serve it within three laps.',
      'The stewards have given us a stop-go. Three laps to serve it.',
    ],
  },
  weather_rain: {
    bono: [
      'Rain forecast, {driver}. {rain_pct} percent chance within {minutes} minutes.',
      'Okay, {driver}, radar says {rain_pct} percent for rain in {minutes} minutes.',
      '{rain_pct} percent chance of rain in {minutes} minutes. Dry for now.',
      'Rain on the radar, {rain_pct} percent chance. Not raining yet.',
      'Okay, {driver}, {rain_pct} percent chance of rain soon.',
      'Rain is on the way, {driver}. Not here yet.',
    ],
    colapinto: [
      'Rain coming, {driver}! {rain_pct} percent in {minutes} minutes!',
      '{rain_pct} percent chance of rain within {minutes} minutes! Stay alert!',
      'Radar shows rain, {rain_pct} percent, in {minutes} minutes!',
      'Rain very close, {rain_pct} percent chance, {driver}!',
      '{rain_pct} percent chance of rain any moment! Eyes open!',
      'Rain on the radar, {driver}! Stay alert!',
    ],
    standard: [
      'Weather update. {rain_pct} percent chance of rain within {minutes} minutes.',
      'The forecast shows {rain_pct} percent chance of rain in {minutes} minutes, {driver}.',
      'Rain expected in about {minutes} minutes, {rain_pct} percent probability.',
      '{rain_pct} percent chance of rain shortly. It is not raining yet.',
      'Rain is likely soon, {rain_pct} percent chance, {driver}.',
      'Rain is forecast soon. It is not raining yet.',
    ],
  },
  sector_delta: {
    bono: [
      'Sector {sector}, {delta} down on your best, {driver}.',
      'Okay, {driver}, {delta} lost in sector {sector}. Tidy it up.',
      'We dropped {delta} in sector {sector}. Find it next lap.',
      'Sector {sector} was {delta} off your best. Nice and clean next time.',
      '{delta} slower in sector {sector}. Have a look at it.',
      'Bit of time lost in that sector, {driver}. Tidy it up.',
    ],
    colapinto: [
      '{delta} off your best in sector {sector}, {driver}! We can find it!',
      'Lost {delta} in sector {sector}! Get it back next lap!',
      '{delta} down in sector {sector}! Clean it up, {driver}!',
      'Sector {sector} cost us {delta}! Focus, next lap!',
      'We lost time in that sector, {driver}! Clean it up!',
    ],
    standard: [
      'Sector {sector} was {delta} slower than your best.',
      'You lost {delta} in sector {sector} against your best, {driver}.',
      '{delta} lost in sector {sector}. Look to recover it next lap.',
      'Time loss in sector {sector}, {delta} seconds to your best.',
      'Time lost in that sector against your best.',
    ],
  },
  teammate_ahead: {
    bono: [
      'Teammate ahead, {gap}, {driver}. Keep it clean.',
      'Okay, {driver}, your teammate is {gap} up the road. No contact.',
      '{gap} to your teammate. Clean racing, please.',
      'Teammate {gap} in front. Give each other room.',
      'Teammate ahead on track. Clean racing only, {driver}.',
    ],
    colapinto: [
      'Teammate ahead at {gap}, {driver}! Keep it clean!',
      '{gap} to your teammate! No contact, okay?',
      'Your teammate is {gap} in front, {driver}! Race clean!',
      'Teammate right there, {gap}! Clean and fair!',
      'Teammate ahead, {driver}! No contact!',
    ],
    standard: [
      'Teammate ahead, {gap} seconds. Race clean, no contact.',
      'Your teammate is {gap} ahead, {driver}. Avoid any contact.',
      'The gap to your teammate is {gap}. Keep it clean.',
      'Teammate {gap} up the road, {driver}. Clean racing.',
      'Teammate ahead on track, {driver}. Keep the battle clean.',
    ],
  },
  teammate_pitting: {
    bono: [
      'Teammate is pitting, {driver}.',
      'Okay, {driver}, your teammate is in the pit lane.',
      'Teammate in the pits.',
    ],
    colapinto: [
      'Teammate is boxing, {driver}!',
      'Your teammate just came in!',
      'Teammate in the pit lane, {driver}!',
    ],
    standard: [
      'Your teammate is pitting.',
      'The other car is in the pit lane, {driver}.',
      'Your teammate has come into the pits.',
    ],
  },
  teammate_doublestack: {
    bono: [
      'Double stack, {driver}. Teammate is in the box, expect a short wait.',
      'Okay, {driver}, double stack. Small hold in the box.',
      "Teammate's ahead of us in the box. Double stack.",
    ],
    colapinto: [
      'Double stack, {driver}! Teammate first, short wait!',
      'Teammate is in the box! Double stack, be patient!',
      "We're double stacking! Short hold, {driver}!",
    ],
    standard: [
      'Double stack. Your teammate is in the box, expect a brief hold.',
      'Double-stack stop, {driver}. There may be a short wait.',
      'Teammate is pitting ahead of you. Double stack, short delay.',
    ],
  },
  pit_clean_air: {
    bono: [
      'If we stop, we rejoin P{position} in clean air, {driver}.',
      'Okay, {driver}, a stop puts us out P{position}, nobody around.',
      'P{position} in clean air if we box. Your call.',
      'A stop would drop us into P{position}, clean air.',
      'If we stop, we come out in clean air, {driver}. Undercut chance.',
      'Clean air on the rejoin if we pit. Your call.',
      'Okay, {driver}, a stop would drop us into clean air.',
      'Gap in the traffic for a stop. Good undercut chance.',
    ],
    colapinto: [
      'Box and we come out P{position} in clean air, {driver}!',
      "Clean air if we pit! We'd rejoin P{position}!",
      'A stop puts us P{position}, nobody around, {driver}!',
      'P{position} with clean air after a stop! Do we go for it?',
      'Clean air if we box, {driver}! Undercut chance!',
      'We can pit into clean air! Great chance for the undercut!',
      "There's a gap for us after a stop, {driver}! The undercut is on!",
      'Clean air on the rejoin! Do we go for it?',
    ],
    standard: [
      'A stop would put you out P{position} in clean air.',
      'If we pit, we come out P{position} in clean air, {driver}.',
      'Clean air available after a stop, rejoining P{position}.',
      'Pit stop option. We would rejoin P{position} with clean air, {driver}.',
      'A stop would put us in clean air. Good chance for the undercut.',
      'We would rejoin in clean air if we pit, {driver}.',
      'Clean air available after a stop. The undercut is an option.',
      'The pit window is open and the rejoin is clear, {driver}.',
    ],
  },
  ers_fault: {
    bono: [
      'ERS failure, {driver}. No electric deploy.',
      "Okay, {driver}, we've lost the ERS. Engine only for now.",
      'ERS fault. No hybrid power, drive around it.',
    ],
    colapinto: [
      'ERS failure, {driver}! No electric boost!',
      "We've lost the ERS! Engine power only, keep fighting!",
      'ERS fault! No deploy, {driver}. Keep it on track.',
    ],
    standard: [
      'ERS failure. Electric deployment is not available.',
      'We have an ERS fault, {driver}. No hybrid boost.',
      'The ERS has failed. You have no electric deployment.',
    ],
  },
  aero_fault: {
    bono: [
      "Wing fault, {driver}. The flap won't open.",
      'Okay, {driver}, we have an aero fault. The wing stays closed.',
      'Wing flap fault. No low drag on the straights.',
    ],
    colapinto: [
      "Wing fault, {driver}! The flap isn't opening!",
      'Aero fault! No low drag on the straights for us!',
      "The wing won't open, {driver}! We race without it!",
    ],
    standard: [
      'Wing flap fault. It cannot open.',
      'We have an aero fault, {driver}. The wing will not open.',
      'Aero flap failure. No low-drag mode available.',
    ],
  },
  rival_defend_override: {
    bono: [
      'Car behind at {gap} with Override, gaining {rate} a lap. Defend.',
      'Okay, {driver}, {gap} behind, closing {rate} a lap. Override range.',
      'Override threat behind, {gap}, coming down {rate} a lap. Inside line.',
      'Gap behind {gap}, taking {rate} a lap, {driver}. Expect the Override.',
      'Car behind at {gap}, in Override range. Defend.',
      'Override threat behind, {gap}, {driver}. Cover the inside.',
      'Okay, {driver}, {gap} to the car behind. Expect the boost.',
      'Car behind in Override range at {gap}. Good exits.',
      'Car behind in Override range, {driver}. Defend.',
    ],
    colapinto: [
      'Override car behind at {gap}, closing {rate} a lap! Close the door, {driver}!',
      '{gap} behind, {rate} a lap quicker, with Override! Protect the inside!',
      'Override range behind, {gap}, taking {rate} a lap! Defend!',
      'Gap behind {gap}, dropping {rate} a lap! Override threat, cover it!',
      'Car behind at {gap} with Override, {driver}! Protect the inside!',
      'Override range behind, {gap}! Close the door!',
      '{gap} to the car behind and it can boost! Defend, {driver}!',
      'Car behind at {gap}! Watch the Override on the straight!',
      'Override threat from behind, {driver}! Protect the inside!',
    ],
    standard: [
      'Car behind at {gap}, gaining {rate} a lap, within Override range. Defend.',
      'The car behind is {gap} back and {rate} a lap quicker, {driver}. Expect Override.',
      'Gap behind {gap}, coming down {rate} a lap. Defend against the Override.',
      'Override threat from the car behind. Gap {gap}, closing {rate} a lap.',
      'Car behind at {gap} seconds, within Override range. Defend.',
      'The car behind is {gap} back with Override, {driver}. Defend the inside line.',
      'Gap behind {gap}. Expect an Override attack on the straight.',
      'Override range behind you, gap {gap}. Protect your position.',
      'Car behind within Override range, {driver}. Defend your position.',
    ],
  },
  rival_attack_override: {
    bono: [
      'Car ahead at {gap}, gaining {rate} a lap, {driver}. Straight Mode and Override.',
      'Okay, {driver}, {gap} to the car ahead, closing {rate} a lap. Override ready.',
      '{rate} a lap quicker, gap {gap}. Use Override on the straight.',
      'Gap ahead {gap}, coming down {rate} a lap. Straight Mode, then Override.',
      'Car ahead at {gap}, {driver}. Straight Mode and Override.',
      '{gap} to the car ahead. Override ready.',
      'Okay, {driver}, car in front at {gap}. Use the boost.',
      'Gap ahead {gap}. Line it up with Override.',
      'Car ahead within reach. Straight Mode and Override.',
    ],
    colapinto: [
      'Car ahead at {gap}, catching {rate} a lap, {driver}! Override, go!',
      '{gap} ahead and {rate} a lap quicker! Straight Mode and boost!',
      'Closing {rate} a lap, gap {gap}! Hit the Override, {driver}!',
      'Gap {gap}, taking {rate} a lap! Boost on the straight!',
      'Car ahead at {gap}, {driver}! Straight Mode and boost!',
      '{gap} to the car in front! Override, attack!',
      'Gap ahead {gap}! Use the Override, {driver}!',
      'Car in front at {gap}! Boost on the straight, go!',
      'Car ahead within reach, {driver}! Override, go!',
    ],
    standard: [
      'Car ahead at {gap}, closing {rate} a lap. Use Straight Mode and Override.',
      'Gap ahead {gap}, gaining {rate} a lap, {driver}. Prepare Override.',
      'You are {rate} a lap quicker than the car ahead, gap {gap}. Use Override.',
      'The car ahead is {gap} in front, you are closing {rate} a lap. Attack with Override.',
      'Car ahead at {gap} seconds. Use Straight Mode and Override.',
      'The car ahead is {gap} in front, {driver}. Prepare Override.',
      'Gap ahead {gap}. Attack with Override on the straight.',
      'Car ahead in range, gap {gap}. Straight Mode and Override.',
      'Overtake opportunity, {driver}. Use Straight Mode and Override.',
    ],
  },
  race_finish: {
    bono: [
      'Chequered flag, {driver}. P{position}. Cool-down lap, then parc fermé.',
      "Okay, {driver}, that's the flag. P{position}, bring it to parc fermé.",
      'P{position} at the flag. Not our day. Cool-down lap, please.',
      'Chequered flag, {driver}. Cool-down lap, then parc fermé.',
    ],
    colapinto: [
      'Chequered flag, P{position}, {driver}. We keep working. Bring it to parc fermé.',
      "That's the flag, P{position}. Tough one, we go again.",
      'P{position} at the chequered flag. Cool down, then parc fermé.',
      'Chequered flag, {driver}. Bring the car to parc fermé.',
    ],
    standard: [
      'Chequered flag, P{position}. Cool-down lap, then bring the car to parc fermé.',
      'You finish P{position}, {driver}. Head to parc fermé after the cool-down lap.',
      'Race over at the flag, P{position}. Bring it back to parc fermé.',
      'Chequered flag, {driver}. Cool-down lap and parc fermé.',
    ],
  },
  race_finish_points: {
    bono: [
      'Chequered flag, {driver}. P{position}, points. Good job.',
      'Okay, {driver}, P{position}. Points on the board, nice work.',
      'P{position} at the flag. Good points today.',
      'Chequered flag, points for us, {driver}. Bring it to parc fermé.',
    ],
    colapinto: [
      'Chequered flag! P{position}, points, {driver}! Great job!',
      'P{position}! We scored points, vamos!',
      'Points, {driver}! P{position} at the flag, well done!',
      'Points, {driver}! What a race!',
    ],
    standard: [
      'Chequered flag, P{position}. Points today, well done.',
      'You finish P{position}, in the points, {driver}.',
      'P{position} at the flag, that is points. Bring the car to parc fermé.',
      'Chequered flag, in the points, {driver}. Bring the car to parc fermé.',
    ],
  },
  race_finish_podium: {
    bono: [
      "Chequered flag, P{position}, {driver}. That's a podium. Great drive.",
      'Okay, {driver}, P{position}. Podium. Lovely job.',
      "P{position} at the flag. We're on the podium.",
      'Podium, {driver}. Great drive. Bring it to parc fermé.',
    ],
    colapinto: [
      'P{position}! Podium, {driver}! Unbelievable!',
      "We're on the podium, P{position}! Vamos, {driver}!",
      'Chequered flag, P{position}! Podium! What a drive!',
      'Podium, {driver}! Incredible!',
    ],
    standard: [
      'Chequered flag, P{position}, a podium. Great drive.',
      '{driver}, P{position} at the flag. That is a podium finish.',
      'P{position} and a podium. Bring the car to parc fermé.',
      'Podium finish, {driver}. Bring the car to parc fermé.',
    ],
  },
  race_finish_win: {
    bono: [
      'Chequered flag. You win, {driver}. Outstanding.',
      'Okay, {driver}, P1. Race win. Get in there.',
      "That's the win. Lovely drive, bring it to parc fermé.",
    ],
    colapinto: [
      'We won, {driver}! P1! Incredible drive!',
      'Race winner! Vamos, vamos!',
      'P1, {driver}! You won the race!',
    ],
    standard: [
      'Chequered flag, P1. You win the race, {driver}.',
      'P1, race win! Outstanding drive.',
      'You have won the race. Bring the car to parc fermé.',
    ],
  },
  inlap_traffic_behind: {
    bono: [
      'Car behind on a push lap, {gap} back. Give way.',
      'Push lap car {gap} behind. Off the line.',
      'Fast car coming, {gap} behind. Let it through safely.',
      'Push lap behind you, {gap}. Stay out of its way.',
      'Car behind on a push lap. Give way.',
    ],
    colapinto: [
      'Car on a push lap, {gap} behind! Let it by!',
      'Push lap car {gap} back! Move off the line!',
      "{gap} behind, it's on a flying lap! Out of the way!",
      'Fast car behind, {gap}! Off the racing line!',
      'Car behind on a push lap! Move off line!',
    ],
    standard: [
      'Car behind on a push lap, {gap} seconds. Give way safely.',
      'Flying lap car {gap} behind. Stay off the racing line.',
      'Push lap car {gap} seconds back. Let it through.',
      'Traffic behind, {gap} seconds, on a push lap. Move aside safely.',
      'Car behind on a push lap. Give way safely.',
    ],
  },
  inlap_cooldown: {
    bono: [
      'Cool-down lap, {driver}. Recharge and cool the brakes.',
      'Okay, {driver}, cool it down. Battery, brakes, tyres.',
      "That's it for now. Cool the car and bring it home.",
    ],
    colapinto: [
      'Cool-down lap, {driver}! Recharge, cool the brakes, bring it home!',
      'Cool it down now! Battery charging, brakes and tyres cooling!',
      'Easy lap, {driver}, cool everything down!',
    ],
    standard: [
      'Cool-down lap. Recharge the battery, cool the brakes and tyres.',
      'Cool the car down, {driver}. Recharge and bring it in.',
      'In-lap. Let the brakes and tyres cool and charge the battery.',
    ],
  },
  flags_rain_live: {
    bono: [
      'Rain is falling now, {driver}. Careful on the brakes.',
      "Okay, {driver}, it's raining. Grip will drop, brake earlier.",
      'Rain on track. Gently into the braking zones.',
    ],
    colapinto: [
      "It's raining, {driver}! Careful in the braking zones!",
      'Rain on track now! Grip is changing, be careful!',
      'Here comes the rain! Brake a little earlier, {driver}!',
    ],
    standard: [
      'Rain is falling on track. Watch the grip into the braking zones.',
      'It has started raining, {driver}. Grip is changing.',
      'Rain on track. Adjust your braking points.',
    ],
  },
  tyre_crossover: {
    bono: [
      "It's wet and staying wet, {driver}. We go to Inters.",
      'Okay, {driver}, slicks are done. Inters.',
      'Rain has set in. Time for Inters.',
      'Too wet for slicks now. We take the Inters.',
    ],
    colapinto: [
      "It's too wet for slicks, {driver}! Inters!",
      'Rain is here to stay! Inters, {driver}, Inters!',
      'Slicks are finished! We go to intermediates!',
    ],
    standard: [
      'The track is too wet for slicks. We go to intermediates.',
      'The rain is staying, {driver}. Intermediates.',
      'The forecast keeps it wet. We switch to Inters.',
    ],
  },
  tyre_crossover_slicks: {
    bono: [
      "Track's drying, {driver}. Slicks are an option.",
      'Okay, {driver}, the dry line is there. We can go to slicks.',
      'Dry for a while now. Slicks if you want them.',
    ],
    colapinto: [
      'Track is drying, {driver}! Slicks are ready if you want them!',
      'Dry line is coming! Slicks are on the table!',
      "It's drying out! Say the word for slicks, {driver}!",
    ],
    standard: [
      'The track is drying. Slicks are an option.',
      'It has been dry for a while, {driver}. We can switch to slicks.',
      'Slick tyres are an option now the track is drying.',
    ],
  },
  flags_sc_in: {
    bono: [
      'Safety Car in this lap, Safety Car in this lap.',
      'Okay, {driver}, Safety Car in this lap. Get the tyres warm.',
      'Safety Car coming in. Keep the delta, ready for the restart.',
      'Safety Car in at the end of the lap. Warm the tyres.',
      "The Safety Car comes in, {driver}. Restart's coming, stay sharp.",
    ],
    colapinto: [
      'Safety Car in this lap! Warm the tyres, get ready!',
      'Safety Car coming in, {driver}! Restart time, tyres warm!',
      'Safety Car is in at the end of the lap! Be ready!',
      'Safety Car comes in this lap! Delta positive till the restart!',
    ],
    standard: [
      'Safety Car in this lap. Keep the delta, prepare for the restart.',
      'The Safety Car is coming in, {driver}. Warm the tyres for the restart.',
      'Safety Car in at the end of this lap. Prepare to restart.',
      'The Safety Car comes in this lap. Build tyre temperature.',
    ],
  },
  vsc_ending: {
    bono: [
      'VSC ending, {driver}. Keep the delta, be ready to go.',
      'VSC ending, VSC ending. Delta until it goes green.',
      'Okay, {driver}, VSC finishing. Stay on the delta, then go.',
    ],
    colapinto: [
      'VSC is ending, {driver}! Be ready on the throttle!',
      'VSC about to end! Hold the delta, then we go!',
      'Get ready, {driver}, the VSC is ending! Delta until green!',
    ],
    standard: [
      'VSC ending. Keep the delta positive until it turns green.',
      'The Virtual Safety Car is about to end, {driver}. Be ready to go.',
      'VSC ending soon. Respect the delta and prepare to race.',
    ],
  },
  flags_green: {
    bono: [
      'Green flag, green flag. Racing.',
      "Okay, {driver}, green flag. Let's go.",
      'Green flag, {driver}. Hammer time.',
      'Green flag. Back to racing, push.',
    ],
    colapinto: [
      'Green flag, green flag! Go, go, go!',
      'Green flag, {driver}! Push now!',
      "It's green flag! Racing again, let's go!",
      'Green flag! Full attack, {driver}!',
    ],
    standard: [
      'Green flag, green flag. Racing resumes, push now.',
      'Green flag, {driver}. We are racing again.',
      'Track is green, green flag. Back up to race pace.',
      'Green flag, the race is back on. Push.',
    ],
  },
  flags_blue: {
    bono: [
      'Blue flags, {driver}. Faster car behind, let it through.',
      'Blue flags. Let it by cleanly.',
      'Okay, {driver}, blue flags. Give it room, lose as little as you can.',
      'Blue flag for us. Let the car behind through.',
    ],
    colapinto: [
      'Blue flags, {driver}! Let it pass, easy!',
      'Blue flags! Faster car behind, let it go cleanly!',
      "Blue flag, {driver}! Don't fight it, let it by!",
      'Blue flags behind you! Move over, nice and clean!',
    ],
    standard: [
      'Blue flags. Let the faster car behind through.',
      'Blue flags, {driver}. A faster car is lapping you, let it pass.',
      'Blue flag shown. Give way to the car behind.',
      'Blue flags, {driver}. Let the car through at a safe place.',
    ],
  },
  flags_yellow: {
    bono: [
      'Yellow flag, {driver}. Careful, be ready to lift.',
      'Yellows here. No overtaking.',
      'Okay, {driver}, yellow flag. Easy through there.',
      'Yellow flag in this sector. Be ready to slow down.',
    ],
    colapinto: [
      'Yellow flag, {driver}! Careful, no overtaking!',
      'Yellows! Lift if you need to!',
      'Yellow flag here! Eyes open, {driver}!',
      'Careful, yellow flag! Ready to lift!',
    ],
    standard: [
      'Yellow flag in this sector. Careful, be ready to lift.',
      'Yellow flag, {driver}. No overtaking under the yellows.',
      'Yellow flag. Reduce speed and do not overtake.',
      'Caution, yellow flag, {driver}. Be prepared to lift.',
    ],
  },
  wrong_way: {
    bono: [
      'Wrong way, wrong way, {driver}. Turn it around safely.',
      "Okay, {driver}, you're going the wrong way. Stop and turn round.",
      'Wrong way. Careful, turn the car around.',
    ],
    colapinto: [
      'Wrong way, {driver}! Turn it around, carefully!',
      "You're going the wrong way! Stop and turn around!",
      'Wrong way, wrong way! Turn around safely!',
    ],
    standard: [
      'You are going the wrong way. Turn the car around safely.',
      'Wrong way, {driver}. Stop and turn around.',
      'Warning, wrong way. Turn around when it is safe.',
    ],
  },
  flags_drs_enabled: {
    bono: [
      'DRS enabled, {driver}.',
      "Okay, {driver}, DRS is on. Use it when you're in range.",
      "DRS enabled. Within a second, it's yours.",
    ],
    colapinto: [
      "DRS enabled, {driver}! Let's use it!",
      'DRS is live! Get within a second and go!',
      'We have DRS now! Stay close, {driver}!',
    ],
    standard: [
      'DRS is now enabled.',
      'DRS enabled by race control, {driver}.',
      'DRS enabled. Available within one second of the car ahead.',
    ],
  },
  flags_drs_disabled: {
    bono: [
      'DRS disabled, {driver}.',
      'Okay, {driver}, no DRS for now.',
      'Race control has disabled DRS.',
    ],
    colapinto: [
      'DRS disabled, {driver}! No DRS for now!',
      'No more DRS! Race control turned it off.',
      'DRS is off, {driver}! Keep fighting without it!',
    ],
    standard: [
      'DRS disabled by race control.',
      'DRS is now disabled, {driver}.',
      'Race control has turned DRS off.',
    ],
  },
  race_fastest_lap: {
    bono: [
      'Fastest lap, {driver}. Nice work.',
      "That's the fastest lap of the race. Keep it going.",
      'Okay, {driver}, fastest lap. Good rhythm.',
    ],
    colapinto: [
      'Fastest lap of the race, {driver}! Mega!',
      'Fastest lap! What a lap!',
      "You've got the fastest lap, {driver}! Brilliant!",
    ],
    standard: [
      'Fastest lap of the race. Good pace.',
      'That is the fastest lap, {driver}. Keep it up.',
      'You have set the fastest lap of the race.',
    ],
  },
  race_final_lap: {
    bono: [
      'Last lap, {driver}. P{position}, bring it home.',
      'Okay, {driver}, final lap. P{position}, nice and tidy.',
      "This is the last lap. We're P{position}.",
      'Last lap, {driver}. Bring it home.',
    ],
    colapinto: [
      'Last lap, {driver}! P{position}, bring it home!',
      "Final lap! We're P{position}, give it everything!",
      "Last lap, P{position}! Let's finish this, {driver}!",
      'Last lap! Bring it home, {driver}!',
    ],
    standard: [
      'Last lap. You are P{position}, bring it home.',
      'Final lap, {driver}. Running P{position}.',
      'This is the final lap, P{position}. Keep it clean to the flag.',
      'Final lap, {driver}. Bring it home cleanly.',
    ],
  },
  race_final_lap_lead: {
    bono: [
      "Last lap, {driver}, and you're leading. Bring it home.",
      'Okay, {driver}, last lap, P1. Nice and calm.',
      'Final lap in the lead. No risks.',
    ],
    colapinto: [
      "Last lap and we're leading, {driver}! Bring it home!",
      'Final lap, P1! Stay calm, finish it!',
      'Last lap in the lead, {driver}! One more!',
    ],
    standard: [
      'Last lap, P1. Bring it home.',
      'Final lap in the lead, {driver}. Keep it clean.',
      'This is the last lap and you are leading.',
    ],
  },
  car_collision: {
    bono: [
      'Contact there, {driver}. Tell us if anything feels wrong.',
      'Okay, {driver}, we saw contact. How does the car feel?',
      'Contact reported. Check the steering and let us know.',
    ],
    colapinto: [
      'Contact, {driver}! Everything okay with the car?',
      'We saw contact! Tell me if something feels off.',
      'Contact there! Check the steering, talk to me, {driver}.',
    ],
    standard: [
      'Contact reported. Check the car and report any problems.',
      'There was contact, {driver}. Tell us if the handling has changed.',
      'Contact with another car. Let us know how the car feels.',
    ],
  },
  car_collision_light: {
    bono: [
      'Light contact there, {driver}. Tell us if anything feels wrong.',
      'Just a touch, {driver}. Shout if the car feels different.',
      'Okay, {driver}, minor contact. Report anything odd.',
    ],
    colapinto: [
      'Little touch there, {driver}! All good?',
      'Light contact! Tell me if the car pulls anywhere.',
      'Just a touch, {driver}! Keep going, talk to me if needed.',
    ],
    standard: [
      'Light contact. Report anything that feels wrong.',
      'Minor contact, {driver}. Let us know how the car feels.',
      'A light touch with another car. Tell us about any issues.',
    ],
  },
  car_collision_heavy: {
    bono: [
      'Heavy contact, {driver}. Check the car, how does it feel?',
      'That was a big hit. Talk to us, {driver}.',
      'Okay, {driver}, hard contact. Check steering, wing, tyres.',
    ],
    colapinto: [
      'Big hit, {driver}! Are you okay? How is the car?',
      'Heavy contact! Check the steering, tell me everything!',
      'That was hard, {driver}! Check for damage!',
    ],
    standard: [
      'Heavy contact. Check for damage and report.',
      'Big impact, {driver}. Check steering, front wing and tyres.',
      'That was a hard contact, {driver}. Tell us about any damage.',
    ],
  },
  car_retirement: {
    bono: [
      'A car has retired, {driver}. Watch for yellows.',
      'Retirement on track. Keep your eyes open for debris.',
      'Okay, {driver}, one car out of the race. Possible yellows.',
    ],
    colapinto: [
      'A car is out of the race, {driver}! Watch for yellow flags!',
      'Retirement! Eyes open, there could be debris.',
      'One car has retired, {driver}! Careful out there.',
    ],
    standard: [
      'A car has retired from the race. Watch for yellow flags or debris.',
      'Retirement reported, {driver}. Stay alert for hazards on track.',
      'One car is out of the race. Be ready for yellow flags.',
    ],
  },
  formation_lap_start: {
    bono: [
      'Formation lap, {driver}. Weave, heat in the tyres and brakes.',
      'Okay, {driver}, formation lap. Get some temperature in.',
      'Formation lap. Work the tyres, warm the brakes.',
    ],
    colapinto: [
      'Formation lap, {driver}! Weave and wake up the tyres!',
      'Here we go, formation lap! Tyres and brakes warm!',
      'Formation lap! Heat in everything, {driver}!',
    ],
    standard: [
      'Formation lap. Weave to warm the tyres and put heat into the brakes.',
      'Formation lap, {driver}. Build tyre and brake temperature.',
      'Formation lap underway. Warm the tyres and brakes progressively.',
    ],
  },
  grid_approach: {
    bono: [
      'Approaching the grid, {driver}. Into the box, find the bite.',
      'Okay, {driver}, grid slot coming up. Bite point.',
      'Grid ahead. Line it up nicely, clutch ready.',
    ],
    colapinto: [
      'Grid coming up, {driver}! Line it up, find the bite point!',
      'Into your grid slot! Clutch ready!',
      "Here's the grid, {driver}! Bite point, focus!",
    ],
    standard: [
      'Approaching the grid. Line up in your box and find the bite point.',
      'Grid slot ahead, {driver}. Stop in the box and set the clutch.',
      'Grid approach. Position the car and prepare for the start.',
    ],
  },
  start_reaction_time: {
    bono: [
      'Reaction {reaction}, {driver}. Decent start, settle in.',
      'Okay, {driver}, {reaction} off the lights. Clean getaway.',
      "Start reaction {reaction}. Fine. Now let's race.",
      'Decent start, {driver}. Settle in.',
    ],
    colapinto: [
      '{reaction} reaction, {driver}! Good start, keep fighting!',
      "Solid launch, {reaction}! Let's race!",
      'Reaction time {reaction}! Now go, {driver}!',
      'Good start, {driver}! Keep fighting!',
    ],
    standard: [
      'Reaction time {reaction} seconds. Solid start.',
      '{driver}, {reaction} off the line. Settle into the race.',
      'Clean getaway, reaction {reaction}. Focus on the first laps.',
      'Solid start off the line. Settle into race pace.',
    ],
  },
  start_reaction_fast: {
    bono: [
      'Great reaction, {reaction}, {driver}.',
      'Okay, {driver}, {reaction} off the lights. Very nice.',
      '{reaction} reaction. Mega launch.',
      'Great launch, {driver}.',
    ],
    colapinto: [
      'What a launch, {reaction}, {driver}!',
      '{reaction} reaction! Rocket start!',
      'Reaction {reaction}, brilliant, {driver}!',
      'What a start, {driver}! Great reaction!',
    ],
    standard: [
      'Great reaction, {reaction} seconds.',
      'Excellent launch, reaction {reaction}, {driver}.',
      'Very fast reaction off the line, {reaction} seconds.',
      'Excellent launch, {driver}.',
    ],
  },
  start_reaction_slow: {
    bono: [
      'Reaction {reaction}, {driver}. A bit slow. Long race.',
      'Okay, {driver}, {reaction} off the line. Plenty of time to recover.',
      'Slow reaction, {reaction}. Head down, settle in.',
      'Bit slow off the line, {driver}. Long race.',
    ],
    colapinto: [
      '{reaction} reaction, slow one, {driver}! Head down, attack!',
      'Slow off the lights, {reaction}! Lots of race left!',
      'Reaction {reaction}, not our best! Fight back, {driver}!',
      'Slow off the line, {driver}! Head down, fight back!',
    ],
    standard: [
      'Slow reaction, {reaction} seconds. Plenty of race left to recover.',
      'Reaction time {reaction}, {driver}. We lost a little at the start.',
      'Reaction {reaction} seconds, slower than we want. Focus forward.',
      'Start was a bit slow, {driver}. Head down.',
    ],
  },
  pit_serve_penalty: {
    bono: [
      '{penalty_sec} seconds to serve first, {driver}. Stay still.',
      'Okay, {driver}, we hold you {penalty_sec} seconds before the tyres.',
      'Penalty first, {penalty_sec} seconds. Keep the car still.',
      "Penalty first, {driver}. The car stays still until it's served.",
    ],
    colapinto: [
      "{penalty_sec} second penalty first, {driver}! Don't move!",
      'Hold for {penalty_sec} seconds, then the crew goes!',
      'Penalty, {penalty_sec} seconds! Wait for it, {driver}!',
      'Serve the penalty first, {driver}! Stay still!',
    ],
    standard: [
      'Hold for the {penalty_sec} second penalty before the tyres are changed.',
      'A {penalty_sec} second hold for the penalty first, {driver}. Stay stationary.',
      'Penalty to serve, {penalty_sec} seconds. The crew waits until it is done.',
      'Penalty to serve first. Stay stationary until it is done.',
    ],
  },
  pit_stop_duration: {
    bono: [
      '{stop_sec} second stop, {driver}. Push now.',
      "Okay, {driver}, {stop_sec} seconds. Out-lap, let's go.",
      'Stop was {stop_sec}. Get some heat in the tyres.',
      'Stop done. Push on the out-lap.',
    ],
    colapinto: [
      '{stop_sec} second stop, {driver}! Push on the out-lap!',
      '{stop_sec} seconds in the box! Go, go!',
      'Stationary {stop_sec} seconds! Out-lap, give it everything!',
      'Stop done! Push hard on the out-lap!',
    ],
    standard: [
      '{stop_sec} second stop. Push now.',
      'Stationary time {stop_sec} seconds, {driver}. Push on the out-lap.',
      'Pit stop complete in {stop_sec} seconds. Bring the tyres up to temperature.',
      'Pit stop complete. Push now on the out-lap.',
    ],
  },
  pit_stop_fast: {
    bono: [
      'Great stop, {stop_sec} seconds, {driver}. Push now.',
      'Okay, {driver}, {stop_sec} seconds. Good work by the crew.',
      '{stop_sec} second stop. Lovely work from the crew.',
      'Rapid stop from the crew. Push now.',
    ],
    colapinto: [
      'What a stop, {stop_sec} seconds! Push, {driver}!',
      '{stop_sec} seconds! The crew nailed it!',
      'Mega stop, {stop_sec} seconds, {driver}! Go, go, go!',
      'Great stop by the crew! Push now!',
    ],
    standard: [
      'Fast stop, {stop_sec} seconds. Push now.',
      'A {stop_sec} second stop, {driver}. Excellent work by the crew.',
      'Quick stop, {stop_sec} seconds stationary. Push on the out-lap.',
      'Rapid stop, {driver}. Push now.',
    ],
  },
  pit_stop_slow: {
    bono: [
      'Slow stop, {stop_sec} seconds, {driver}. Sorry. Push on the out-lap.',
      'Okay, {driver}, {stop_sec} seconds, we lost time there. Make it up.',
      "That was {stop_sec} in the box. Let's get it back.",
      'Stop was slow, sorry. Make it up on the out-lap.',
    ],
    colapinto: [
      'Slow stop, {stop_sec} seconds, {driver}. Push hard on the out-lap!',
      '{stop_sec} seconds, too long! Out-lap, everything you have!',
      'We lost time in the stop, {stop_sec} seconds. Head down, {driver}!',
      'Slow stop, {driver}. Push hard now!',
    ],
    standard: [
      'Slow stop, {stop_sec} seconds. Make up the time on the out-lap.',
      'The stop took {stop_sec} seconds, {driver}. We lost some time there.',
      'Stationary for {stop_sec} seconds, longer than planned. Push now.',
      'That was a slow stop, {driver}. Push on the out-lap.',
    ],
  },
  pit_limiter_exit: {
    bono: [
      'Limiter off, {driver}. Mind the exit line, then push.',
      "Okay, {driver}, limiter off. Let's go.",
      'Limiter off. Respect the white line, then push.',
    ],
    colapinto: [
      'Limiter off, {driver}! Push, push!',
      'Pit limiter off! Careful with the white line, then go!',
      "Off the limiter! Let's go, {driver}!",
    ],
    standard: [
      'Pit limiter off. Mind the white line on exit and push.',
      'Limiter off, {driver}. Push now.',
      'You are past the pit exit. Limiter off and push.',
    ],
  },
  tyre_crossover_wet: {
    bono: [
      'Too much water for Inters, {driver}. We go to full wets.',
      'Okay, {driver}, heavy rain. Full wets.',
      'Standing water now. Time for the wets.',
    ],
    colapinto: [
      'Way too much water, {driver}! Full wets!',
      'Heavy rain! Inters are done, we go to the wets!',
      "It's pouring! Full wet tyres, {driver}!",
    ],
    standard: [
      'Heavy rain is holding. We go to full wet tyres.',
      'Too much standing water for Inters, {driver}. Full wets.',
      'The rain is too heavy for intermediates. We switch to wets.',
    ],
  },
  tyre_crossover_inter: {
    bono: [
      'Rain has eased, {driver}. Inters are quicker now.',
      'Okay, {driver}, the water is clearing. We go to Inters.',
      'Less rain now. Time for intermediates.',
    ],
    colapinto: [
      'The rain is easing, {driver}! Inters are faster now!',
      "Water is clearing! Inters, let's go!",
      'Wets are too slow now, {driver}! Intermediates!',
    ],
    standard: [
      'The rain has eased. Intermediates are faster now.',
      'The standing water is clearing, {driver}. We go to Inters.',
      'Full wets are no longer needed. We switch to intermediates.',
    ],
  },
  brake_bias_ok: {
    bono: [
      'Brake temps are even again, {driver}. Good.',
      'Okay, {driver}, brake balance looks right now.',
      'Front and rear brakes are equal again. Leave the bias there.',
    ],
    colapinto: [
      'Brakes are even again, {driver}! Nice!',
      'Brake balance is back! Good job!',
      'Front and rear brake temps are equal now, {driver}!',
    ],
    standard: [
      'Brake temperatures are even again front to rear.',
      'The brake balance is back in the window, {driver}.',
      'Front and rear brakes are balanced now. Keep this bias.',
    ],
  },
  fuel_mix_neutralized: {
    bono: [
      'Fuel mix to lean, {driver}. Save what you can.',
      "Okay, {driver}, lean mix while we're neutralised.",
      'Lean mix, please. Look after the fuel and the engine.',
    ],
    colapinto: [
      'Lean mix, {driver}! Save that fuel!',
      'Fuel mix to lean while we wait!',
      'Switch to the lean mix, {driver}! Every drop counts!',
    ],
    standard: [
      'Neutralised conditions. Switch the fuel mix to lean.',
      'Switch to the lean fuel mix to save fuel, {driver}.',
      'Lean fuel mix while the race is neutralised.',
    ],
  },
  fuel_mix_restart: {
    bono: [
      "Racing again, {driver}. You're still on lean, standard mix.",
      'Okay, {driver}, fuel mix back to standard.',
      'Still on the lean mix. Back to race mix, please.',
    ],
    colapinto: [
      "We're racing! Back to the standard mix, {driver}!",
      "You're still on lean, {driver}! Standard mix and push!",
      'Race mix, race mix! Go!',
    ],
    standard: [
      'Racing again. Switch the fuel mix back to standard.',
      "You're still on the lean mix, {driver}. Back to standard.",
      'Fuel mix is still lean. Select the standard race mix.',
    ],
  },
  ers_clipping: {
    bono: [
      "Clipping, {driver}. That's the deploy for this lap.",
      'Okay, {driver}, deployment limit reached. Nothing more until the line.',
      "We're clipping. No more electric this lap.",
    ],
    colapinto: [
      'Clipping, clipping! No more deploy until the line!',
      'Deploy limit reached, {driver}! No more boost this lap!',
      "You're clipping, {driver}! Electric is out until the line!",
    ],
    standard: [
      'ERS deployment limit reached for this lap. No more electric boost until the line.',
      'You are clipping, {driver}. Deployment returns after the line.',
      'Clipping. The lap deployment limit has been reached.',
    ],
  },
  tyre_set_advisory: {
    bono: [
      "Pit window's coming, {driver}. Fresh {compound}s are ready.",
      'Okay, {driver}, a new set of {compound}s is waiting for you.',
      'Stop is getting close. We have a fresh {compound} set ready.',
      "Pit window's coming, {driver}. A used set is ready.",
    ],
    colapinto: [
      'Pit window coming, {driver}! Fresh {compound}s ready in the box!',
      'New {compound} tyres waiting for you!',
      'We have a fresh set of {compound}s! Window is close, {driver}!',
      'Pit window coming, {driver}! Scrubbed set ready!',
    ],
    standard: [
      'The pit window is approaching. A fresh set of {compound}s is ready.',
      'New {compound} tyres are prepared for the stop, {driver}.',
      'Fresh {compound} tyres ready for the upcoming stop.',
      'The pit window is approaching. A used set of tyres is ready.',
    ],
  },
  aero_straight_anticipation: {
    bono: [
      'Straight Mode zone coming up, {driver}. Be ready.',
      'Okay, {driver}, Straight Mode next. Use it on the exit.',
      'Straight Mode coming. Low drag when you get there.',
      'Straight Mode zone ahead. Ready on it.',
    ],
    colapinto: [
      'Straight Mode coming, {driver}! Get ready!',
      'Straight Mode zone ahead! Open it up on the exit!',
      'Get ready for Straight Mode, {driver}!',
      'Low drag zone coming! Straight Mode, ready!',
    ],
    standard: [
      'Straight Mode zone approaching. Be ready to activate it.',
      '{driver}, Straight Mode zone coming up. Prepare the low-drag setting.',
      'Active aero zone ahead. Use Straight Mode on the straight.',
      'Next straight is a Straight Mode zone, {driver}.',
    ],
  },
  overtake_boost_anticipation: {
    bono: [
      'Override zone coming up, {driver}. Boost is available.',
      'Okay, {driver}, Override next. Ready on the button.',
      'Override available, zone ahead. Use it if you need it.',
      'Boost zone coming. Override is ready.',
    ],
    colapinto: [
      'Override zone coming, {driver}! Ready on the boost!',
      'Boost is ready! Override zone ahead!',
      'Get ready to hit Override, {driver}!',
      'Override zone next! Full boost!',
    ],
    standard: [
      'Override zone approaching. Boost is available.',
      '{driver}, Override is ready for the next zone.',
      'Override activation zone ahead. Prepare the boost.',
      'Boost available, {driver}. Override zone coming up.',
    ],
  },
  pit_limiter_overspeed: {
    bono: [
      'Limiter, limiter, {driver}. Slow down for the pit lane.',
      'Okay, {driver}, pit limiter on. Too fast.',
      "You're too quick for the pit lane. Limiter.",
    ],
    colapinto: [
      'Limiter, {driver}! Slow down, slow down!',
      'Pit limiter! Too fast for the pit lane!',
      'Speed! Hit the limiter, {driver}!',
    ],
    standard: [
      'Pit limiter on. You are too fast for the pit lane.',
      'Engage the pit limiter, {driver}. Reduce speed now.',
      'Speed limiter! Slow down for the pit lane.',
    ],
  },
  tyre_blistering: {
    bono: [
      'The {wheel} is blistering, {driver}, {pct} percent. Back off the slides.',
      'Okay, {driver}, {pct} percent blistering on the {wheel}. Off the kerbs.',
      'Blisters on the {wheel}, {pct} percent. Calm the inputs.',
      'We have blistering, {driver}. Back off the slides and kerbs.',
    ],
    colapinto: [
      'Blistering on the {wheel}, {pct} percent! Stay off the kerbs, {driver}!',
      'The {wheel} is blistering, {pct} percent! Less sliding!',
      '{pct} percent blister on the {wheel}! Smooth, smooth!',
      'Blistering on a tyre, {driver}! Easy on the kerbs!',
    ],
    standard: [
      'The {wheel} tyre is blistering, {pct} percent. Reduce sliding and avoid the kerbs.',
      'Blistering on the {wheel} at {pct} percent, {driver}. Back off the lateral load.',
      '{pct} percent blistering on the {wheel}. Keep the car off the kerbs.',
      'Tyre blistering. Reduce sliding and stay off the kerbs.',
    ],
  },
  tyre_pressure_high: {
    bono: [
      'The {wheel} pressure is spiking, {driver}. Less scrub on entry.',
      "Okay, {driver}, pressure's high on the {wheel}. Smooth through the corners.",
      'High pressure in the {wheel}. Ease off the sliding.',
      'Pressures are uneven across the {axle} axle, {driver}. Balance the loads.',
      'Pressure split on the {axle} tyres, left to right. Smooth inputs.',
      'Tyre pressures are off, {driver}. Keep it smooth.',
    ],
    colapinto: [
      'Pressure way up on the {wheel}, {driver}! Stop sliding it!',
      'Too much pressure in the {wheel}! Smooth on entry!',
      'High pressure, {wheel} tyre! Less scrub, {driver}!',
      'Uneven pressures on the {axle} axle, {driver}! Balance it out!',
      'Pressure difference on the {axle} tyres! Smooth inputs!',
      'Tyre pressures not happy! Smooth inputs, {driver}!',
    ],
    standard: [
      'The {wheel} tyre pressure is high. Reduce scrub on corner entry.',
      'Pressure is spiking on the {wheel}, {driver}. Avoid sliding the tyre.',
      'High tyre pressure on the {wheel}. Manage the corner entries.',
      'Tyre pressures are uneven on the {axle} axle. Balance your cornering loads.',
      'There is a pressure difference across the {axle} tyres, {driver}.',
      'Tyre pressures are out of the window. Keep the inputs smooth.',
    ],
  },
  damage_gearbox_wear: {
    bono: [
      'Gearbox wear at {pct} percent, {driver}. Gentle on the shifts.',
      'Okay, {driver}, gearbox is {pct} percent worn. Smooth upshifts.',
      '{pct} percent gearbox damage. Be kind to it.',
      'Gearbox wear is high. Easy on the shifts.',
    ],
    colapinto: [
      'Gearbox at {pct} percent, {driver}! Easy on the downshifts!',
      '{pct} percent gearbox damage! Smooth shifts, protect it!',
      'The gearbox is {pct} percent worn! Careful with it, {driver}!',
      'Gearbox damage, {driver}! Gentle shifts!',
    ],
    standard: [
      'Gearbox damage has reached {pct} percent. Be gentle with the shifts.',
      'Gearbox wear is at {pct} percent, {driver}. Avoid aggressive downshifts.',
      'The gearbox is {pct} percent damaged. Shift smoothly.',
      'High gearbox wear. Be smooth on the gear changes.',
    ],
  },
  damage_ice_wear: {
    bono: [
      'Engine wear, {driver}. The ICE is at {pct} percent.',
      'Okay, {driver}, combustion engine at {pct} percent wear. Look after it.',
      '{pct} percent wear on the combustion engine. Short-shift where you can.',
      'ICE wear is getting high, {driver}. Be kind to the engine.',
    ],
    colapinto: [
      'ICE wear at {pct} percent, {driver}! Protect the engine!',
      'The engine is {pct} percent worn! Easy on the revs!',
      '{pct} percent on the combustion engine! Short-shift a bit, {driver}!',
      'Engine wear is high, {driver}! Look after it!',
    ],
    standard: [
      'Internal combustion engine wear is at {pct} percent.',
      'The combustion engine has reached {pct} percent wear, {driver}. Avoid the rev limiter.',
      'The combustion engine is {pct} percent worn. Manage the revs.',
      'High combustion engine wear. Manage the engine.',
    ],
  },
  pit_entry_reminder: {
    bono: [
      'Box, box. Pit entry coming up, {driver}.',
      'Okay, {driver}, box this lap. Stay on the pit side.',
      'Pit entry next. Box, box.',
      'Box, box, {driver}. Pit side, mind the entry line.',
    ],
    colapinto: [
      'Box, box, box! Pit entry coming up, {driver}!',
      "Box now, {driver}! Pit entry's right there!",
      'Box this lap, {driver}! Get over to the pit side!',
      'Here comes the pit entry! Box, box!',
    ],
    standard: [
      'Box, box. Pit entry coming up.',
      'Pit entry approaching, {driver}. Box, box.',
      'Box this lap. Move over to the pit lane side.',
      'Stay on the pit side, {driver}. Box, box.',
    ],
  },
  gap_report: {
    bono: [
      'Gaps for you, {driver}.',
      'Okay, {driver}, quick update.',
      'Here are the gaps.',
      'Quick one on the gaps.',
      'Where we are.',
    ],
    colapinto: [
      'Gap update, {driver}!',
      'Here we go, the gaps!',
      'Quick update for you!',
      "Let's look at the gaps, {driver}!",
      'Situation update!',
    ],
    standard: [
      'Gap report.',
      'Update on the gaps, {driver}.',
      'Here is the current picture.',
      'Race update, {driver}.',
      'Position and gaps.',
    ],
  },
  tyre_life: {
    bono: [
      'About {laps} laps left in these tyres, {driver}. The {wheel} goes first.',
      'Okay, {driver}, {laps} laps or so on this set. The {wheel} is the limit.',
      'Tyres have around {laps} laps left. Watch the {wheel}.',
      'Roughly {laps} laps to go on these. The {wheel} is wearing fastest.',
    ],
    colapinto: [
      'About {laps} laps left on these tyres, {driver}! The {wheel} goes first!',
      '{laps} laps left on this set! Look after the {wheel}!',
      'The {wheel} has about {laps} laps left, {driver}!',
      'Around {laps} more laps on these! The {wheel} is the one to watch!',
    ],
    standard: [
      'About {laps} laps left on these tyres. The {wheel} will go first.',
      'Tyre life is around {laps} laps, limited by the {wheel}, {driver}.',
      'The {wheel} is wearing fastest, about {laps} laps left.',
      'Projected tyre life is {laps} laps, {driver}. The {wheel} is the limit.',
    ],
  },
  tyre_life_end: {
    bono: [
      'Good news, {driver}. These tyres will make the end.',
      'Tyres go to the flag at this rate. Keep managing them.',
      'Okay, {driver}, this set makes it to the end. Look after it.',
      'At this pace the tyres will last. Steady.',
    ],
    colapinto: [
      'These tyres make the end, {driver}! Keep looking after them!',
      'Tyres will last to the flag! Keep it up!',
      'Good news, {driver}! This set goes to the end!',
      'No worries on tyres, they make the finish!',
    ],
    standard: [
      'These tyres will make the end of the race. Keep managing them.',
      'Tyres are good to the flag at this rate, {driver}.',
      'Tyre life is enough to finish the race. Keep the wear under control.',
      'This set will last to the end if you keep managing it, {driver}.',
    ],
  },
  rival_closing: {
    bono: [
      "Car ahead at {gap}, we're taking {rate} a lap. About {laps} laps to range.",
      'Okay, {driver}, car ahead at {gap}, {rate} a lap quicker. With them in {laps} laps.',
      'Gap ahead {gap}, coming down {rate} a lap. On their gearbox in {laps} laps.',
      "We're {rate} a lap quicker than the car ahead. {gap} now, {laps} laps to range.",
      "Car ahead at {gap}, we're taking {rate} a lap, {driver}. Keep chipping away.",
      'Gap to the car ahead is {gap}, coming down {rate} a lap. Good pace.',
      "We're catching the car ahead, {driver}. Keep it coming.",
    ],
    colapinto: [
      "Car ahead at {gap}, taking {rate} a lap! We're on them in {laps} laps, {driver}!",
      "{gap} to the car in front, {rate} a lap quicker! We're there in {laps} laps!",
      "We're eating into it, {rate} a lap! Gap {gap}, {laps} laps to range, {driver}!",
      'Gap ahead {gap}, coming down {rate} a lap! Right with them in {laps} laps!',
      "Car ahead at {gap}, we're catching {rate} a lap! Keep it coming, {driver}!",
      "{rate} a lap quicker than the car in front! Gap's {gap}, keep pushing!",
      'Reeling in the car ahead, {driver}! Keep it up!',
    ],
    standard: [
      'Car ahead at {gap}, gaining {rate} a lap. Within range in about {laps} laps.',
      'You are {rate} a lap quicker, gap ahead {gap}. About {laps} laps to range.',
      'The gap ahead is {gap}, falling {rate} a lap. In range in {laps} laps.',
      'Closing {rate} a lap, {driver}. Gap ahead {gap}, battle range in about {laps} laps.',
      'Car ahead at {gap} seconds, you are gaining {rate} a lap.',
      'The gap ahead is {gap}, coming down {rate} a lap, {driver}. Keep the pace.',
      'You are catching the car ahead, {driver}. Keep the pace up.',
    ],
  },
  rival_catching_you: {
    bono: [
      'Car behind at {gap}, gaining {rate} a lap. With us in about {laps} laps.',
      'Okay, {driver}, car behind at {gap}, {rate} a lap quicker. About {laps} laps to range.',
      'Gap behind {gap}, coming down {rate} a lap. On our gearbox in {laps} laps.',
      "Car behind's {gap} back, taking {rate} a lap. They'll be close in {laps} laps.",
      'Car behind at {gap}, {driver}, gaining {rate} a lap. Bit more pace, please.',
      '{gap} back to the car behind, coming down {rate} a lap. Pick it up.',
      'Car behind is catching us, {driver}. Bit more pace if you have it.',
    ],
    colapinto: [
      "Car behind at {gap}, gaining {rate} a lap! They're on us in {laps} laps, {driver}!",
      '{gap} back, {rate} a lap quicker! About {laps} laps to range, pick it up!',
      "Gap behind {gap}, coming down {rate} a lap! Push, {driver}, they're close in {laps} laps!",
      "Car behind's taking {rate} a lap! Gap {gap}, with us in {laps} laps!",
      'Car behind at {gap}, taking {rate} a lap, {driver}! Pick up the pace!',
      '{rate} a lap quicker behind us, gap {gap}! Come on, push!',
      'Car behind is catching us, {driver}! Pick up the pace!',
    ],
    standard: [
      'Car behind at {gap}, gaining {rate} a lap. In range in about {laps} laps.',
      'The car behind is {gap} back, closing {rate} a lap, {driver}. About {laps} laps to range.',
      'Gap behind {gap}, falling {rate} a lap. Within range in {laps} laps or so.',
      'Losing {rate} a lap to the car behind, {gap} back. Battle range in {laps} laps.',
      'Car behind at {gap} seconds, gaining {rate} a lap. Pick up the pace.',
      'The gap behind is {gap}, coming down {rate} a lap, {driver}.',
      'The car behind is catching you, {driver}. Pick up the pace.',
    ],
  },
  rival_penalty_ahead: {
    bono: [
      'Car ahead is {gap} up the road with a {penalty_sec} second penalty. Stay within that, {driver}.',
      "Okay, {driver}, gap ahead {gap}, and they've got {penalty_sec} seconds in penalties. Finish within that.",
      "{penalty_sec} second penalty for the car ahead, gap {gap}. Under {penalty_sec} and it's ours.",
      'Penalty for the car ahead, {driver}. Stay close.',
    ],
    colapinto: [
      "Car ahead has a {penalty_sec} second penalty! Gap's {gap}, stay within it, {driver}!",
      "{penalty_sec} seconds of penalties for the car in front! It's {gap} ahead, finish within that!",
      "Gap ahead {gap}, {penalty_sec} seconds of penalty! Under that at the flag, it's ours!",
      'Car ahead has a time penalty, {driver}! Stay right with them!',
    ],
    standard: [
      'The car {gap} ahead has a {penalty_sec} second penalty. Finish within it for the place.',
      'Gap to the car ahead is {gap}, {driver}. It has {penalty_sec} seconds of penalties to serve.',
      'Car ahead at {gap}, {penalty_sec} seconds of penalty. Finish within {penalty_sec} seconds of it.',
      'The car ahead has a time penalty, {driver}. Stay close to it.',
    ],
  },
  rival_penalty_behind: {
    bono: [
      "Car behind's {gap} back, {penalty_sec} second penalty. If it gets by, stay within it.",
      'Okay, {driver}, car behind at {gap} has a {penalty_sec} second penalty. Keep them within that.',
      'Gap behind {gap}, {penalty_sec} seconds of penalty. They need more than that on us.',
      "Car behind's carrying a time penalty, {driver}. Worth knowing.",
    ],
    colapinto: [
      "Car behind has a {penalty_sec} second penalty, gap {gap}! Getting by us isn't enough for them!",
      'Car behind at {gap} with {penalty_sec} seconds of penalty! It needs more than that!',
      "Gap behind {gap}, and they've got a {penalty_sec} second penalty! Keep them within that, {driver}!",
      'Car behind has a penalty, {driver}! Keep them close!',
    ],
    standard: [
      'The car behind, {gap} back, must beat you by more than its {penalty_sec} second penalty.',
      'Gap behind {gap}, {driver}. That car has {penalty_sec} seconds of penalties to serve.',
      'Car behind at {gap}, {penalty_sec} second penalty. If it gets past, stay within that.',
      'The car behind has a time penalty, {driver}.',
    ],
  },
  leader_pitted: {
    bono: [
      'Leader has pitted, {driver}. They were {gap} up the road.',
      "Okay, {driver}, the leader's in the pits. Gap was {gap}.",
      "Race leader's boxed from {gap} ahead.",
      'The leader has just come in, {driver}.',
    ],
    colapinto: [
      'The leader has pitted, {driver}! {gap} up the road!',
      "Leader's boxing! They were {gap} ahead of us!",
      'Leader in the pits, {driver}! Gap was {gap}!',
      'The leader just came in, {driver}!',
    ],
    standard: [
      'The race leader has pitted from {gap} ahead.',
      'The leader is in the pits, {driver}. The gap was {gap} seconds.',
      'Leader pitting. They were {gap} seconds in front, {driver}.',
      'The race leader has entered the pits.',
    ],
  },
  nearby_pitted_ahead: {
    bono: [
      'A car {gap} up the road has pitted, {driver}.',
      'Okay, {driver}, a car {gap} ahead has just boxed.',
      'One of the cars ahead has pitted. It was {gap} in front.',
      'A car ahead has pitted, {driver}.',
    ],
    colapinto: [
      'A car {gap} ahead just pitted, {driver}!',
      'Car up the road in the pits, {gap} ahead of us!',
      'Someone ahead has boxed! They were {gap} in front, {driver}!',
      'A car up the road just boxed, {driver}!',
    ],
    standard: [
      'A car {gap} seconds ahead has pitted.',
      'A car up the road has entered the pits, {driver}. It was {gap} ahead.',
      'Pit stop for a car {gap} in front of you.',
      'A car ahead of you has pitted.',
    ],
  },
  nearby_pitted_behind: {
    bono: [
      'A car {gap} behind has pitted, {driver}.',
      'Okay, {driver}, a car behind has boxed. It was {gap} back.',
      'One of the cars behind is in the pits, {gap} back.',
      'Someone behind has come in, {driver}.',
    ],
    colapinto: [
      'A car {gap} behind just pitted, {driver}!',
      'Someone behind is in the pits! They were {gap} back!',
      'Pit stop behind us, {gap} back, {driver}!',
      'A car behind just boxed, {driver}!',
    ],
    standard: [
      'A car {gap} seconds behind has pitted.',
      'A car behind you has entered the pits, {driver}. It was {gap} back.',
      'Pit stop for a car {gap} behind you.',
      'A car behind you has pitted.',
    ],
  },
  pit_plan_next_lap_traffic: {
    bono: [
      "Box next lap, {driver}. We'd rejoin P{position}, {gap} behind a car.",
      'Okay, {driver}, stop is next lap. Out in P{position}, traffic {gap} ahead.',
      'Next lap is our stop. P{position} on exit, {gap} behind traffic.',
      "Box next lap, {driver}. We'd come out {gap} behind a car.",
      'Next lap we stop. Traffic on the rejoin, {gap} behind.',
      "Box next lap, {driver}. We'd rejoin in traffic.",
    ],
    colapinto: [
      'Box next lap, {driver}! We come out P{position}, {gap} behind a car!',
      'In next lap! Rejoin P{position} with traffic {gap} ahead!',
      'Next lap we box! P{position} on exit, {gap} behind another car, {driver}!',
      'Box next lap! Traffic on the way out, {gap} behind!',
      "We stop next lap, {driver}! We'd come out {gap} behind a car!",
      'Box next lap, {driver}! Some traffic on the rejoin!',
    ],
    standard: [
      'Box next lap. We rejoin P{position}, {gap} seconds behind a car.',
      'The plan is to pit next lap, {driver}. Rejoin P{position} in traffic, {gap} behind.',
      'Pit stop next lap. Expected rejoin P{position}, {gap} behind another car.',
      'Box next lap, {driver}. We rejoin in traffic, {gap} behind a car.',
      'We stop at the end of next lap, rejoining {gap} behind traffic.',
      'Box next lap, {driver}. Expect traffic on the rejoin.',
    ],
  },
  penalty_served: {
    bono: [
      'Penalty served, {driver}. Back to racing.',
      "Okay, {driver}, that's the penalty done.",
      "Penalty's served. Head down now.",
    ],
    colapinto: [
      "Penalty served, {driver}! Let's go racing!",
      "That's it, penalty done! Push now!",
      "Penalty's done, {driver}! Head down, let's go!",
    ],
    standard: [
      'The penalty has been served.',
      'Penalty served, {driver}. Back to the race.',
      'That penalty is done. Focus on the race now.',
    ],
  },
  weather_rain_approx: {
    bono: [
      'Rough forecast, {driver}. {rain_pct} percent chance of rain in around {minutes} minutes.',
      "Okay, {driver}, forecast says {rain_pct} percent for rain in {minutes} minutes. It's only a guide.",
      'Maybe rain in {minutes} minutes or so, {driver}. {rain_pct} percent chance.',
      'Forecast suggests {rain_pct} percent chance of rain. Rough numbers only.',
      'Looks like rain, {rain_pct} percent chance, {driver}. Not a precise forecast.',
      "Might be rain on the way, {driver}. Forecast's only rough.",
    ],
    colapinto: [
      'Rain maybe coming, {driver}! {rain_pct} percent in about {minutes} minutes!',
      'Forecast says {rain_pct} percent for rain in about {minutes} minutes! Not exact, stay alert!',
      'It could rain in {minutes} minutes or so, {rain_pct} percent chance! Eyes open, {driver}!',
      'Looks like {rain_pct} percent chance of rain, {driver}! Rough forecast!',
      'Maybe rain on the way, {rain_pct} percent chance! Stay sharp!',
      "Might rain soon, {driver}! Forecast isn't exact!",
    ],
    standard: [
      'Approximate forecast. {rain_pct} percent chance of rain in about {minutes} minutes.',
      'The forecast suggests {rain_pct} percent chance of rain in {minutes} minutes, {driver}.',
      'Rain possible in around {minutes} minutes, {rain_pct} percent chance. The forecast is only approximate.',
      'Roughly {rain_pct} percent chance of rain, {driver}. The forecast is not precise.',
      'The forecast says {rain_pct} percent chance of rain. Treat it as approximate.',
      'Rain might be on the way. The forecast is approximate.',
    ],
  },
  rain_heavier: {
    bono: [
      "Rain's getting heavier, {driver}. Less grip out there.",
      'Okay, {driver}, the rain is picking up.',
      'Heavier rain now. Careful on the brakes.',
    ],
    colapinto: [
      'Rain is getting heavier, {driver}! Careful!',
      'More rain coming down now! Watch the grip!',
      "It's raining harder, {driver}! Easy on the throttle!",
    ],
    standard: [
      'The rain is getting heavier. Grip is dropping.',
      'Rain intensity is increasing, {driver}.',
      'Heavier rain on track now, {driver}. Adjust your braking points.',
    ],
  },
  rain_easing: {
    bono: [
      "Rain's easing off, {driver}.",
      'Okay, {driver}, the rain is getting lighter.',
      'The rain is easing a touch.',
    ],
    colapinto: [
      'Rain is easing, {driver}!',
      "The rain's getting lighter! Keep it clean!",
      'Less rain now! Stay focused, {driver}!',
    ],
    standard: [
      'The rain is easing.',
      'Rain is getting lighter, {driver}.',
      'Lighter rain on track now.',
    ],
  },
  track_drying: {
    bono: [
      'Rain has stopped, {driver}. Track will start to dry.',
      'Okay, {driver}, no more rain. Track should dry from here.',
      "That's the rain stopped. Look for a dry line.",
    ],
    colapinto: [
      "Rain has stopped, {driver}! Track's going to dry!",
      'No more rain! The track starts drying now!',
      "It's stopped raining! A dry line is coming, {driver}!",
    ],
    standard: [
      'The rain has stopped. The track will start to dry.',
      'No more rain, {driver}. Expect the track to start drying.',
      'Rain has stopped. Watch for a dry line forming.',
    ],
  },
  track_temp_up: {
    bono: [
      "Track's up {temp_delta} degrees this stint, {driver}.",
      'Okay, {driver}, track temperature up {temp_delta} degrees since the start of the stint.',
      "Asphalt's {temp_delta} degrees warmer than at the start of the stint.",
      "Track temperature's rising this stint, {driver}.",
    ],
    colapinto: [
      "Track's {temp_delta} degrees hotter this stint, {driver}!",
      'Asphalt is up {temp_delta} degrees since the start of the stint!',
      'Track temperature has climbed {temp_delta} degrees this stint!',
      "Track's heating up this stint, {driver}!",
    ],
    standard: [
      'Track temperature is up {temp_delta} degrees this stint.',
      'The track has warmed {temp_delta} degrees since the start of the stint, {driver}.',
      'Asphalt temperature up {temp_delta} degrees over this stint.',
      'The track is getting warmer this stint, {driver}.',
    ],
  },
  track_temp_down: {
    bono: [
      "Track's down {temp_delta} degrees this stint, {driver}.",
      'Okay, {driver}, track temperature down {temp_delta} degrees since the start of the stint.',
      "Asphalt's {temp_delta} degrees cooler than at the start of the stint.",
      "Track temperature's dropping this stint, {driver}.",
    ],
    colapinto: [
      "Track's {temp_delta} degrees cooler this stint, {driver}!",
      'Asphalt is down {temp_delta} degrees since the start of the stint!',
      'Track temperature has dropped {temp_delta} degrees this stint!',
      "Track's cooling down this stint, {driver}!",
    ],
    standard: [
      'Track temperature is down {temp_delta} degrees this stint.',
      'The track has cooled {temp_delta} degrees since the start of the stint, {driver}.',
      'Asphalt temperature down {temp_delta} degrees over this stint.',
      'The track is getting cooler this stint, {driver}.',
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
        'Box this lap, box box.',
        'Box, box, this lap.',
        'In this lap, box box.',
      ],
      colapinto: [
        'Box this lap, box box!',
        'Box, box, box! This lap!',
        'In this lap! Box, box!',
      ],
      standard: [
        'Box this lap.',
        'Box at the end of this lap.',
        'Pit this lap, box box.',
      ],
    },
    next_lap: {
      bono: [
        'Too late for the pit entry. Box next lap.',
        'Stay out this time, box next lap.',
      ],
      colapinto: [
        "We've missed the entry! Box next lap!",
        'Stay out, stay out! Box next lap!',
      ],
      standard: [
        'Too late for this pit entry. Box at the end of next lap.',
        'Stay out, we box next lap.',
      ],
    },
    asap: {
      bono: [
        'Box as soon as you can.',
        'Bring it in at the first chance.',
      ],
      colapinto: [
        'Get it in as soon as you can!',
        'Box at the first chance you get!',
      ],
      standard: [
        'Box as soon as possible.',
        'Pit at the earliest opportunity.',
      ],
    },
  },
  option: {
    this_lap: {
      bono: [
        'We can still make the pit entry this lap.',
        'Pit entry is still on this lap if you want it.',
      ],
      colapinto: [
        'We can still box this lap if you want!',
        'This lap is still possible, your call!',
      ],
      standard: [
        'Pit entry is still possible this lap.',
        'We can still box this lap.',
      ],
    },
    next_lap: {
      bono: [
        "Too late for this lap's entry, it would be next lap.",
        'Missed this entry. Next lap is the option.',
      ],
      colapinto: [
        'Too late for this pit entry, it would be next lap!',
        'This lap is gone, we could do it next lap!',
      ],
      standard: [
        'Too late for the pit entry this lap. Next lap is the option.',
        'If we stop, it will be next lap.',
      ],
    },
    asap: {
      standard: [
      ],
    },
  },
} satisfies Record<BoxCallKind, Record<EngineerBoxTiming, RadioPhrasePool>>;

/**
 * The parts a gap report is built from, after its opening phrase: the position, then the gap to the
 * car ahead and to the car behind with how it moves. `{position}`, `{gap}` (seconds) and `{rate}`
 * (seconds a lap) are filled with the report's numbers, written the listener's way.
 */
export const report_phrases = {
  position: {
    standard: [
      'P{position}.',
      'You are P{position}.',
      'Running P{position}.',
    ],
  },
  leading: {
    standard: [
      'You are leading.',
      'Leading the race.',
      'Out in front.',
    ],
  },
  ahead: {
    standard: [
      'Car ahead at {gap}.',
      'Gap ahead {gap} seconds.',
      '{gap} to the car in front.',
    ],
  },
  ahead_closing: {
    standard: [
      'Gap ahead {gap}, you are gaining {rate} a lap.',
      'Car ahead at {gap}, closing {rate} a lap.',
      '{gap} to the car in front, coming down {rate} a lap.',
    ],
  },
  ahead_opening: {
    standard: [
      'Gap ahead {gap}, losing {rate} a lap.',
      'Car ahead at {gap}, pulling away {rate} a lap.',
      '{gap} to the car in front, growing {rate} a lap.',
    ],
  },
  ahead_stable: {
    standard: [
      'Gap ahead {gap} seconds, holding steady.',
      'Car ahead at {gap}, gap is stable.',
      '{gap} to the car in front, not moving.',
    ],
  },
  behind: {
    standard: [
      'Car behind at {gap}.',
      'Gap behind {gap} seconds.',
      '{gap} back to the car behind.',
    ],
  },
  behind_closing: {
    standard: [
      'Car behind at {gap}, gaining {rate} a lap.',
      'Gap behind {gap} seconds, coming down {rate} a lap.',
      '{gap} back to the car behind, they are {rate} a lap quicker.',
    ],
  },
  behind_opening: {
    standard: [
      'Car behind at {gap}, you are pulling away {rate} a lap.',
      'Gap behind {gap} seconds, growing {rate} a lap.',
      '{gap} back to the car behind, you are {rate} a lap quicker.',
    ],
  },
  behind_stable: {
    standard: [
      'Car behind at {gap}, gap is stable.',
      'Gap behind {gap} seconds, holding steady.',
      '{gap} back to the car behind, steady.',
    ],
  },
  nobody_close: {
    standard: [
      'Nobody within ten seconds.',
      'Clear air both ways, nobody within ten seconds.',
      'No cars within ten seconds either side.',
    ],
  },
  tyre_life_one_lap: {
    standard: [
      'The {wheel} has about one lap left.',
      'One lap left on these tyres, the {wheel} goes first.',
      'About one more lap before the {wheel} is at the limit.',
      'About one lap left on these tyres.',
      'These tyres are nearly done, about one lap left.',
      'The tyres have about a lap left in them.',
      'One more lap in these tyres, then they are finished.',
    ],
  },
  elimination_drop_zone: {
    standard: [
      'That is in the drop zone.',
      "That's the drop zone.",
      'Not enough, we are in the drop zone.',
    ],
  },
  elimination_last_through: {
    standard: [
      'Last car through, not safe yet.',
      'Right on the cut line.',
      'That is the last place through, at risk.',
    ],
  },
} satisfies Record<ReportPhrase, RadioPhrasePool>;

/**
 * What the engineer says in a push-to-talk exchange besides the answer itself. `{driver}` is the
 * callsign.
 * - say_again: the driver keyed the radio but no words came through.
 * - radio_fault: the radio itself isn't working, so the driver can't be heard (the microphone is
 *   blocked or missing, the speech service is down).
 * - stand_by: the question came through and the answer is still on its way.
 * - answer_failed: the pit wall couldn't get an answer.
 */
export const exchange_phrases = {
  say_again: {
    bono: [
      "Say again, {driver}, we didn't get that.",
      'Sorry, {driver}, you broke up. Say again.',
    ],
    colapinto: [
      'Say again, {driver}! Nothing came through.',
      "We didn't catch that, {driver}. Say again!",
    ],
    standard: [
      "Say again, {driver}, we didn't copy.",
      'Nothing came through, {driver}. Please say again.',
    ],
  },
  radio_fault: {
    bono: [
      "We have a radio problem, {driver}. We can't hear you.",
      "Radio issue on our side, {driver}. Nothing's coming through.",
    ],
    colapinto: [
      "Sorry, {driver}, we can't hear you! The radio isn't working.",
      'Radio problem, {driver}! Nothing is reaching the pit wall.',
    ],
    standard: [
      "Sorry, {driver}, we can't hear you. The radio is not working.",
      'Radio problem, {driver}. We are not receiving you.',
    ],
  },
  stand_by: {
    bono: [
      'Copy, {driver}, stand by.',
      'Understood, {driver}. Stand by, checking.',
    ],
    colapinto: [
      'Copy that, {driver}! Give us a second.',
      'Copy, {driver}. Checking now, stand by!',
    ],
    standard: [
      'Copy that, {driver}. Checking, stand by.',
      'Received, {driver}. One moment, please.',
    ],
  },
  answer_failed: {
    bono: [
      "Sorry, {driver}, we can't get you that right now.",
      "We've no answer on that at the moment, {driver}.",
    ],
    colapinto: [
      "Sorry, {driver}, the pit wall can't get you that right now!",
      "We can't check that right now, {driver}. Sorry!",
    ],
    standard: [
      'Sorry, {driver}, we cannot get you that information right now.',
      'We have no answer for that right now, {driver}.',
    ],
  },
} satisfies Record<ExchangeLine, RadioPhrasePool>;

/**
 * The words the call's wheel, axle and tyre are said with. Phrases use them as "the {wheel}" or
 * "{wheel} tyre", "{axle} axle", "{compound} tyres" or "{compound}s".
 */
export const value_words = {
  wheel: {
    front_left: 'front left',
    front_right: 'front right',
    rear_left: 'rear left',
    rear_right: 'rear right',
  },
  axle: {
    front: 'front',
    rear: 'rear',
  },
  compound: {
    soft: 'soft',
    medium: 'medium',
    hard: 'hard',
    inter: 'intermediate',
    wet: 'full wet',
  },
} satisfies RadioValueWords;
