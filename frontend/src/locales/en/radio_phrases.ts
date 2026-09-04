export const radio_phrases = {
  safety_car: {
    bono: [
      'Safety Car deployed, Safety Car. Keep the delta positive, stand by for pit stop.',
      'Safety Car, {driver}. Delta positive, stay positive on the delta and stand by.',
      'Okay {driver}, Safety Car deployed. Keep delta positive, we are looking at the box option.',
    ],
    colapinto: [
      'Safety Car on track, Safety Car. Keep delta positive and confirm if you want to box.',
      'Safety Car deployed, {driver}. Mind the delta and stay alert for pit entry.',
    ],
    standard: [
      'Safety Car deployed, Safety Car. Keep delta positive, stand by for pit stop.',
      'Full Safety Car on track. Maintain positive delta and prepare for strategy call.',
      'Safety Car, {driver}. Keep delta positive and confirm if boxing this lap.',
    ],
  },
  vsc: {
    bono: [
      'Virtual Safety Car deployed, VSC. Keep the delta positive, no overtaking.',
      'VSC deployed, {driver}. Delta positive, keep it positive everywhere.',
    ],
    colapinto: [
      'Virtual Safety Car deployed. Mind the delta, no passing.',
      'VSC on track, {driver}. Keep delta positive and stay focused.',
    ],
    standard: [
      'Virtual Safety Car deployed. Maintain positive delta, no overtaking.',
      'VSC deployed, {driver}. Keep delta positive throughout the lap.',
    ],
  },
  red_flag: {
    bono: [
      'Red flag, red flag. Session suspended, bring it back to the pit lane slowly.',
      'Red flag, {driver}. Session stopped, slow in-lap into the pit lane.',
    ],
    colapinto: [
      'Red flag, red flag! Session stopped, bring the car safely into the pits.',
    ],
    standard: [
      'Red flag, red flag. Session suspended, slow down and return to the pit lane.',
      'Red flag on track, {driver}. Session halted, bring the car into the pit lane.',
    ],
  },
  tyre_puncture: {
    bono: [
      'Puncture, puncture! Box this lap, box box box.',
      'Critical puncture on the tyre! Bring it in this lap, {driver}, carefully.',
    ],
    colapinto: [
      'Puncture, puncture! Box this lap, {driver}, bring it in easy.',
    ],
    standard: [
      'Puncture, puncture! Box this lap, bring it in carefully.',
      'Critical tyre puncture detected, {driver}. Box immediately.',
    ],
  },
  tyre_wear: {
    bono: [
      'Tyre wear is high, {driver}. We need to manage the rear deg out of low-speed turns.',
      'High degradation on the tyres. Manage the pace and protect the rubber.',
    ],
    colapinto: [
      'High tyre wear, {driver}. Watch the traction out of the corners.',
    ],
    standard: [
      'Tyre wear is critical. Manage your pace and protect the tyres.',
      'High tyre degradation detected, {driver}. Focus on smooth traction.',
    ],
  },
  tyre_overheat: {
    bono: [
      'Tyres are overheating, {driver}. Manage slide and slip angles to bring surface temps down.',
      'High surface temperatures on tyres. Back off the steering inputs slightly.',
    ],
    colapinto: [
      'Tyres running very hot, {driver}. Avoid sliding to bring surface temps down.',
    ],
    standard: [
      'Tyres are overheating. Manage slide and traction to bring temperatures down.',
      'Surface tyre temperatures critically high, {driver}. Cool them on the straight.',
    ],
  },
  tyre_cold: {
    bono: [
      'Tyres are cold, {driver}. Weave and get temperature into the carcass before the restart.',
    ],
    colapinto: [
      'Cold tyres, {driver}. Weave hard to build temperature.',
    ],
    standard: [
      'Tyres are cold. Weave to bring core temperature up.',
      'Cold tyre warning, {driver}. Build carcass temperature before the green flag.',
    ],
  },
  wing_damage: {
    bono: [
      'Front wing damage detected, {driver}. Expect understeer in medium and high speed corners.',
      'Front wing flap damage. We have lost front downforce, stand by for nose change.',
    ],
    colapinto: [
      'Front wing damage, {driver}. We lost downforce, be ready for a front wing change.',
    ],
    standard: [
      'Front wing damage detected. Downforce loss, box for a wing change.',
      'Front wing damage, {driver}. Aerodynamic balance is compromised.',
    ],
  },
  floor_damage: {
    bono: [
      'Floor damage detected, {driver}. Downforce levels are compromised.',
    ],
    colapinto: [
      'Floor damage on the car, {driver}. Watch the rear stability.',
    ],
    standard: [
      'Floor damage detected. Downforce levels compromised.',
      'Floor and diffuser damage, {driver}. Expect reduced overall grip.',
    ],
  },
  engine_wear: {
    bono: [
      'High engine wear detected, {driver}. Manage temperatures and short-shift where possible.',
    ],
    colapinto: [
      'Engine wear is high, {driver}. Short shift to protect the power unit.',
    ],
    standard: [
      'High engine wear detected. Manage temperatures and short shift.',
      'Engine component wear warning, {driver}. Protect the internal components.',
    ],
  },
  mechanical_fault: {
    bono: [
      'Mechanical fault detected on the car, {driver}. Check steering wheel switches.',
    ],
    colapinto: [
      'Mechanical fault on the car, {driver}. Check the wheel switches.',
    ],
    standard: [
      'Mechanical fault detected. Check steering wheel switches.',
      'System fault detected, {driver}. Verify wheel controls.',
    ],
  },
  terminal_engine: {
    bono: [
      'Stop the car, stop the car, {driver}! Terminal engine failure, pull off into a safe area and switch off the power unit.',
      'Terminal engine failure! Pull off track immediately, shut everything down.',
    ],
    colapinto: [
      'Stop the car, {driver}! Terminal engine failure, pull off the track and switch it off right now!',
      'Terminal failure on the engine! Pull off line and shut off the PU immediately.',
    ],
    standard: [
      'Terminal engine failure! Pull off line into a safe area, switch off the power unit immediately.',
      'Critical engine failure detected. Stop the car in a safe place and turn off the engine.',
    ],
  },
  ers_low: {
    bono: [
      'Low battery reserve, {driver}. Give us some Lift and Coast to recharge the pack.',
      'Battery SOC is low. Harvest energy in heavy braking zones.',
    ],
    colapinto: [
      'Low battery, {driver}. Lift and coast into the braking zones to recharge.',
    ],
    standard: [
      'Low battery reserve. Give us some Lift and Coast to recharge.',
      'ERS battery level low, {driver}. Focus on energy harvesting.',
    ],
  },
  radiator_overheat: {
    bono: [
      'Engine temperatures running hot, {driver}. We are losing power to thermal derate, introduce Lift & Coast.',
      'High engine core temperature. Move out of the dirty air and use Lift & Coast into heavy braking.',
    ],
    colapinto: [
      'Engine running hot, {driver}. Power unit is losing output, move out of the tow and Lift & Coast.',
    ],
    standard: [
      'Engine temperatures running hot with thermal power loss. Get out of dirty air and apply Lift & Coast.',
      'High engine temperature warning, {driver}. Seek clean air on straights and introduce Lift & Coast.',
    ],
  },
  brake_overheat: {
    bono: [
      'Brakes running hot, {driver}. Move the brake bias rearwards and manage entry.',
    ],
    colapinto: [
      'Brakes are overheating, {driver}. Move bias rearwards.',
    ],
    standard: [
      'Brakes running hot. Move the brake bias rearwards.',
      'Brake temperature warning, {driver}. Adjust brake balance.',
    ],
  },
  brake_cold: {
    bono: [
      'Brakes are cold, {driver}. Put heat into the discs before the restart.',
    ],
    colapinto: [
      'Cold brakes, {driver}. Warm the discs before the green flag.',
    ],
    standard: [
      'Brakes are cold. Put heat into the discs before the restart.',
      'Cold brake drag warning, {driver}. Warm up the discs before the restart.',
    ],
  },
  brake_bias: {
    bono: [
      'Brake thermal imbalance, {driver}. Adjust your brake bias by 1 to 2 percent to balance axle temperatures.',
      'Check brake bias balance, {driver}. We have a significant thermal split between front and rear.',
    ],
    colapinto: [
      'Brake temperatures are split, {driver}. Move brake bias by 1 or 2 clicks to balance them out.',
      'Adjust brake bias, {driver}! Axle temperatures are out of balance.',
    ],
    standard: [
      'Brake bias imbalance detected. Adjust brake balance by 1-2% to manage axle temperatures.',
      'Thermal split on brake discs. Fine tune brake bias to balance front and rear temperatures.',
    ],
  },
  fuel_deficit: {
    bono: [
      'We are in fuel deficit, {driver}. We need some Lift and Coast into turn 1.',
      'Target fuel is negative. Introduce Lift and Coast into heavy braking.',
    ],
    colapinto: [
      'We are down on fuel target, {driver}. Lift and coast into the big stops.',
    ],
    standard: [
      'We are in fuel deficit. We need some Lift and Coast into heavy braking.',
      'Fuel target deficit, {driver}. Apply Lift and Coast to meet delta.',
    ],
  },
  undercut_window: {
    bono: [
      'Undercut window is open, {driver}. Hammer time on this in-lap!',
      'We have an undercut opportunity. Push hard now, {driver}.',
    ],
    colapinto: [
      'Undercut window open, {driver}. Push flat out on this in-lap!',
    ],
    standard: [
      'Undercut window is open. Push hard on this in-lap.',
      'Undercut window active, {driver}. Maximize pace on the in-lap.',
    ],
  },
  pit_window_open: {
    bono: [
      'Pit window is open, {driver}. Box this lap, confirm tyres.',
      'Pit window open. Confirm if boxing this lap, {driver}.',
    ],
    colapinto: [
      'Pit window open, {driver}. Confirm if we box this lap.',
    ],
    standard: [
      'Pit window is open. Confirm if boxing this lap.',
      'Pit stop window open, {driver}. Stand by for box call.',
    ],
  },
  pit_window_close: {
    bono: [
      'Box this lap, box box! Pit window is closing, {driver}, we must box now to protect tyre performance.',
      'Pit stop window closing, {driver}. Box this lap, box box!',
    ],
    colapinto: [
      'Pit window is closing, {driver}! Box this lap, box box, we need fresh tyres now.',
      'Window closing this lap, {driver}. Box now to protect our stint.',
    ],
    standard: [
      'Box this lap, box box! Pit stop window is closing.',
      'Pit stop window closing now, {driver}. Box this lap to maintain tyre delta.',
    ],
  },
  rival_defend: {
    bono: [
      'Car behind within 1 second with DRS, {driver}. Defend the inside into turn 1.',
    ],
    colapinto: [
      'Car behind with DRS within a second, {driver}. Cover the inside line.',
    ],
    standard: [
      'Car behind within one second with DRS. Defend the inside.',
      'Rival within DRS threat behind, {driver}. Defend the racing line.',
    ],
  },
  rival_attack: {
    bono: [
      'Within DRS range, {driver}. Mode overtake available on the straight.',
      'We have DRS on the car ahead. Mode overtake available.',
    ],
    colapinto: [
      'In DRS range, {driver}. Use overtake mode on the main straight.',
    ],
    standard: [
      'Within DRS range. Mode overtake available on the straight.',
      'Rival in DRS range ahead, {driver}. Attack mode available.',
    ],
  },
  qualy_traffic: {
    bono: [
      'Traffic ahead on the out-lap, {driver}. Build at least 4 seconds of clean air before launching.',
    ],
    colapinto: [
      'Traffic ahead, {driver}. Open a 4 second gap before the final corner.',
    ],
    standard: [
      'Traffic ahead on out-lap. Build at least 4 seconds of clean air.',
      'Out-lap traffic warning, {driver}. Build a gap for clean air.',
    ],
  },
  qualy_clean_air: {
    bono: [
      'Track is clear ahead, {driver}. Prepare the front tyres and launch out of the final turn.',
    ],
    colapinto: [
      'Clear track ahead, {driver}. Prepare the tyres and full throttle out of the last corner.',
    ],
    standard: [
      'Track is clear ahead. Prepare front tyres and launch out of the final turn.',
      'Clean air confirmed ahead, {driver}. Launch your flying lap.',
    ],
  },
  qualy_deleted_lap: {
    bono: [
      'Lap deleted for track limits, {driver}. Recharge ERS and reset for the next flying attempt.',
    ],
    colapinto: [
      'Lap deleted for track limits, {driver}. Recharge the battery and go again.',
    ],
    standard: [
      'Lap deleted for track limits. Recharge ERS and reset for next flying lap.',
      'Lap time deleted, {driver}. Recharge battery and prepare another push lap.',
    ],
  },
  qualy_session_time: {
    bono: [
      'Under 3 minutes remaining, {driver}. Leave the box now for the final flying lap.',
    ],
    colapinto: [
      'Under 3 minutes left, {driver}. Head out now to make the flag.',
    ],
    standard: [
      'Under 3 minutes remaining in session. Leave pit lane now for final run.',
      'Session clock critical, {driver}. Box exit now to reach the line before the flag.',
    ],
  },
  qualy_elimination_danger: {
    bono: [
      'We are in the elimination danger zone, {driver}. We need a clean, maximized lap to make the cutoff.',
    ],
    colapinto: [
      'We are in the drop zone, {driver}. We need a monster lap here.',
    ],
    standard: [
      'We are in the elimination danger zone. We need a clean, maximized lap.',
      'Danger zone for elimination, {driver}. Push for a clean improvement.',
    ],
  },
  track_limits_warnings: {
    bono: [
      'That is 3 track limits warnings, {driver}. One more is a time penalty. Keep it on the black stuff.',
    ],
    colapinto: [
      'Three track limits warnings, {driver}. One more is a penalty. Keep it inside the white lines.',
    ],
    standard: [
      'Three track limits warnings. Keep all four wheels within the white lines.',
      'Final track limits warning, {driver}. Another infringement incurs a time penalty.',
    ],
  },
  penalties_incurred: {
    bono: [
      'Time penalty confirmed by the stewards, {driver}. We will serve it at the next stop.',
    ],
    colapinto: [
      'Time penalty from stewards, {driver}. We will serve it in the pit stop.',
    ],
    standard: [
      'Time penalty confirmed by stewards. We will serve it at the next stop.',
      'Penalty confirmed by race control, {driver}. We will serve it in the pits.',
    ],
  },
  weather_rain: {
    bono: [
      'Weather radar confirms rain incoming, {driver}. Prepare for the tyre crossover window.',
      'Radar shows rain arriving in a few minutes. Stay alert for the grip transition.',
    ],
    colapinto: [
      'Rain confirmed on the radar, {driver}. Watch the grip transition.',
    ],
    standard: [
      'Weather radar confirms rain incoming. Prepare for tyre crossover window.',
      'Imminent rain detected on radar, {driver}. Prepare for track conditions changing.',
    ],
  },
  sector_delta: {
    bono: [
      'Delta loss in this sector, {driver}. Focus on apex speed and smooth exit traction.',
      'Time lost in sector vs personal best. Keep steering inputs smooth.',
    ],
    colapinto: [
      'We lost time in this sector, {driver}. Focus on apex speed and get on the power cleanly.',
    ],
    standard: [
      'Time lost in sector vs personal best. Prioritize corner exit traction.',
      'Sector delta loss, {driver}. Focus on minimum corner speed.',
    ],
  },
  teammate_ahead: {
    bono: [
      'Teammate ahead, {driver}. Pace delta is favorable, free to race, keep it clean.',
      'Teammate is ahead on track. Clean racing only, {driver}.',
    ],
    colapinto: [
      'Teammate ahead, {driver}. We have the pace, free to race but keep it clean.',
    ],
    standard: [
      'Teammate ahead. Pace delta is favorable, free to race.',
      'Teammate ahead on track, {driver}. Keep the battle clean.',
    ],
  },
  teammate_pitting: {
    bono: [
      'Teammate is pitting now, {driver}. Focus on a clean in-lap.',
      'Teammate in the pit lane. Track is clear for your run.',
    ],
    colapinto: [
      'Teammate is boxing now, {driver}. Keep pushing with clean air.',
    ],
    standard: [
      'Teammate is pitting now. Focus on a clean lap.',
      'Teammate in boxes, {driver}. Maximize your pace.',
    ],
  },
  teammate_doublestack: {
    bono: [
      'Teammate is in the pit box, {driver}! Stand by for double-stack pit stop, expect a brief hold.',
      'Double-stack pit stop, {driver}! Teammate is pitting ahead of you, be prepared to hold.',
    ],
    colapinto: [
      'Teammate is in the box, {driver}! Double-stack stop, hold your marks!',
      'Watch out, teammate is pitting right now! Double-stack, expect a short delay.',
    ],
    standard: [
      'Teammate is currently in the pit box. Stand by for double-stack pit stop.',
      'Double-stack alert, {driver}. Teammate is in the box, prepare for a brief hold.',
    ],
  },
  pit_clean_air: {
    bono: [
      'Pit window offers clean air on rejoin, {driver}. Prime opportunity for undercut.',
      'Clean air window open on pit exit. Stand by for box call.',
    ],
    colapinto: [
      'Clean air on pit exit if we box now, {driver}. Good undercut chance.',
    ],
    standard: [
      'Pit window offers clean air on rejoin. Ideal opportunity for undercut strategy.',
      'Clean air available on pit exit, {driver}. Strategy window open.',
    ],
  },
  ers_fault: {
    bono: [
      'Hybrid ERS deployment failure detected, {driver}. Electric boost offline, stand by for reset protocol.',
      'ERS failure on power unit. Electric boost unavailable.',
    ],
    colapinto: [
      'ERS failure, {driver}. Electric boost is offline, stand by for system reset.',
    ],
    standard: [
      'Hybrid ERS deployment failure detected. Electric boost offline.',
      'Power unit ERS fault, {driver}. Stand by for system reset instructions.',
    ],
  },
  aero_fault: {
    bono: [
      'Active Aero straight mode fault detected, {driver}. Wing adjustment unavailable.',
      'Active Aero flap fault. Straight mode is currently offline.',
    ],
    colapinto: [
      'Active Aero flap issue, {driver}. Straight mode is not deploying.',
    ],
    standard: [
      'Active Aero flap fault detected. Wing adjustment currently unavailable.',
      'Aerodynamic flap fault, {driver}. Straight mode offline.',
    ],
  },
  rival_defend_override: {
    bono: [
      'Car behind within one second with Override Boost threat, {driver}. Defend the inside line.',
    ],
    colapinto: [
      'Car behind with Override attack threat within a second, {driver}. Protect the inside on the straight.',
    ],
    standard: [
      'Car behind within one second with Override threat. Defend the inside line.',
      'Pressure from car behind with Override Boost available, {driver}. Defend position.',
    ],
  },
  rival_attack_override: {
    bono: [
      'Closing in on car ahead, {driver}. Deploy Straight Mode and prepare Override Boost.',
    ],
    colapinto: [
      'We are catching the car ahead, {driver}. Switch to Straight Mode and use Boost on the straight.',
    ],
    standard: [
      'Closing in on car ahead. Switch to Straight Mode and prepare Override deployment.',
      'Overtake opportunity, {driver}. Use Straight Mode and Override Boost.',
    ],
  },
  race_finish: {
    bono: [
      'Chequered flag! Outstanding drive today, {driver}. Switch to cool down mode, pick up rubber off line and bring the car to parc fermé.',
    ],
    colapinto: [
      'Chequered flag! Brilliant drive, {driver}. Cool the car down, pick up rubber and bring it to parc fermé.',
    ],
    standard: [
      'Chequered flag. Fantastic race. Switch to cool down mode and bring the car safely to parc fermé.',
      'Race finished, {driver}! Pick up rubber off line and head to parc fermé.',
    ],
  },
  inlap_traffic_behind: {
    bono: [
      'Traffic alert: fast car approaching on a flying lap behind, {driver}. Give way cleanly.',
    ],
    colapinto: [
      'Watch out behind, fast car coming on a hot lap, {driver}. Move off line safely.',
    ],
    standard: [
      'Traffic alert: fast car approaching on flying lap behind. Move off the racing line cleanly.',
      'Fast car on flying lap behind, {driver}. Give way safely.',
    ],
  },
  inlap_cooldown: {
    bono: [
      'Flying lap completed, box this lap. Recharge ERS battery, cool the brakes and bring the car home.',
    ],
    colapinto: [
      'Lap done, boxing this lap, {driver}. Recharge the battery, cool down brakes and bring it in.',
    ],
    standard: [
      'Flying lap completed, box this lap. Recharge battery, cool brakes and tyres.',
      'Lap complete, into the pits this lap, {driver}. Focus on cooling.',
    ],
  },
  flags_rain_live: {
    bono: [
      'Rain is falling on track now, {driver}. Be careful on the brakes into Turn 1, grip levels dropping.',
    ],
    colapinto: [
      'Rain has arrived on track, {driver}. Watch your braking points, track is getting slippery.',
    ],
    standard: [
      'Rain is now falling on track! Watch out for changing grip levels into braking zones.',
      'Rain arriving on track, {driver}. Grip is decreasing, adjust braking references.',
    ],
  },
  tyre_crossover: {
    bono: [
      'Conditions at crossover threshold, {driver}. Box this lap, box box for tyre change.',
    ],
    colapinto: [
      'We are at the tyre crossover window, {driver}. Box this lap, box box!',
    ],
    standard: [
      'Tyre crossover threshold reached! Box this lap for tyre compound change.',
      'Crossover window is open, {driver}. Box this lap, box box.',
    ],
  },
  flags_sc_in: {
    bono: [
      'Safety Car in this lap, Safety Car in this lap! Keep the delta, warm the fronts into the final sector.',
      'Safety Car in this lap, {driver}. Prepare for restart, manage the pace.',
    ],
    colapinto: [
      'Safety Car coming in this lap! Warm up the tyres, prepare for the restart.',
      'Safety Car in this lap, {driver}. Stay alert on throttle and warm the front axle.',
    ],
    standard: [
      'Safety Car in this lap, Safety Car in this lap! Maintain delta positive, warm front tyres and prepare for restart.',
      'Safety Car coming in. Prepare for green flag racing.',
    ],
  },
  flags_green: {
    bono: [
      'Green flag, green flag! Track is clear, race is on.',
      'Green flag, {driver}! Hammer time, let us push.',
    ],
    colapinto: [
      'Green flag, green flag! Race resumed, full push now.',
      'Green flag, {driver}! Track clear, push hard.',
    ],
    standard: [
      'Green flag, green flag! Race is restarted, push now.',
      'Track is clear, green flag! Racing resumes.',
    ],
  },
  flags_blue: {
    bono: [
      'Blue flags, {driver}. Leader approaching behind, let them through cleanly.',
      'Blue flags, blue flags. Faster car right behind, yield position into the next corner.',
    ],
    colapinto: [
      'Blue flags, {driver}! Leader is behind, let them pass cleanly to avoid penalty.',
      'Blue flags! Give way to the car behind into the next braking zone.',
    ],
    standard: [
      'Blue flags, {driver}! Leader is approaching from behind, yield position cleanly.',
      'Blue flags. Allow the faster car behind to lap cleanly.',
    ],
  },
  flags_yellow: {
    bono: [
      'Yellow flag in this sector. Incident ahead, no overtaking and prepare to lift.',
      'Yellow flag, {driver}. Watch for debris or slow car ahead in this sector.',
    ],
    colapinto: [
      'Yellow flag ahead in this sector! Incident on track, no overtaking.',
      'Yellow flag, {driver}. Lift off if needed and watch for cars off track.',
    ],
    standard: [
      'Yellow flag in this sector. Incident ahead, no overtaking and be prepared to lift.',
      'Yellow flag on track. Exercise caution and maintain delta.',
    ],
  },
  wrong_way: {
    bono: [
      'Wrong way, wrong way, {driver}! Stop the car or spin it around immediately!',
      'Warning {driver}, you are driving the wrong way against track direction! Turn around now!',
    ],
    colapinto: [
      'Wrong way, {driver}! Turn the car around or stop immediately!',
      'Warning! You are driving the wrong way, turn around right now!',
    ],
    standard: [
      'Warning! You are driving the wrong way! Turn around or stop immediately.',
      'Wrong way alert. Reverse direction or stop the vehicle safely.',
    ],
  },
  flags_drs_enabled: {
    bono: [
      'DRS enabled, {driver}. DRS is now active.',
      'DRS is enabled, make use of it on the straights.',
    ],
    colapinto: [
      'DRS enabled, {driver}! DRS is open, push now.',
      'DRS active, use it whenever within one second.',
    ],
    standard: [
      'DRS enabled, DRS is now active.',
      'DRS has been enabled by race control.',
    ],
  },
  flags_drs_disabled: {
    bono: [
      'DRS disabled, {driver}. Race control has disabled DRS.',
      'DRS disabled across the circuit. Close up without DRS.',
    ],
    colapinto: [
      'DRS disabled, {driver}! No DRS for now, stay close.',
      'Race control disabled DRS, keep the pace up.',
    ],
    standard: [
      'DRS disabled by race control.',
      'DRS is now disabled across the track.',
    ],
  },
  race_fastest_lap: {
    bono: [
      'Fastest lap of the session, {driver}. Purple in all sectors.',
      'And that is the fastest lap, well done. Keep this rhythm.',
    ],
    colapinto: [
      'Fastest lap of the race, {driver}! Brilliant pace!',
      'Fastest lap! Purples across the board, beautiful lap!',
    ],
    standard: [
      'Fastest lap of the session. Outstanding pace.',
      'New overall fastest lap set, excellent drive.',
    ],
  },
  car_collision: {
    bono: [
      'Contact reported, {driver}! Check steering feel and front wing balance.',
      'We saw contact there, {driver}. Confirm steering and front wing feel.',
    ],
    colapinto: [
      'Watch out, contact reported {driver}! Let me know if you feel vibrations in the steering or front wing.',
      'Heavy contact reported! Confirm front wing balance on next straight.',
    ],
    standard: [
      'Contact reported! Check steering and front wing balance, reporting on next radio check.',
      'Collision detected. Monitor telemetry and report handling changes.',
    ],
  },
  car_retirement: {
    bono: [
      'Car retirement reported, {driver}. Watch for yellow flags or debris.',
      'Retirement on track. Keep your eyes open into the braking zones.',
    ],
    colapinto: [
      'Car stopped ahead, {driver}. Watch out for debris or yellow flags.',
      'Retirement on track, stay alert through this sector.',
    ],
    standard: [
      'Car retirement on track. Watch for potential yellow flags or debris.',
      'Retirement reported. Stay alert for track hazards.',
    ],
  },
  formation_lap_start: {
    bono: [
      'Formation lap, {driver}. Weave to put heat into the tyres and warm the brakes.',
      'Formation lap rolling. Work the tyre carcasses and get temperature into front brakes.',
    ],
    colapinto: [
      'Formation lap underway, {driver}! Weave to put heat into the tyres and wake up the brakes.',
      'Formation lap rolling. Build tyre and brake temperatures for the launch.',
    ],
    standard: [
      'Formation lap. Weave to put heat into the tyre carcasses and warm the front brakes.',
      'Formation lap underway. Build tyre and brake temperatures progressively.',
    ],
  },
  grid_approach: {
    bono: [
      'Approaching the grid, {driver}. Line up carefully and find the bite point.',
      'Grid approach. Slot into the box, engage clutch and find the bite point.',
    ],
    colapinto: [
      'Approaching the grid, {driver}. Slot cleanly into your box and prepare the launch.',
      'Grid approach. Line up in the grid box and find the clutch bite point.',
    ],
    standard: [
      'Approaching the grid. Line up carefully in your box and find the clutch bite point.',
      'Grid lineup. Stop in the grid box and prepare clutch launch procedure.',
    ],
  },
  start_reaction_time: {
    bono: [
      'Good reaction off the line, {driver}. Focus on Turn 1 positioning.',
      'Launch reaction was clean. Keep pushing into the opening complex.',
    ],
    colapinto: [
      'Great launch off the line, {driver}! Keep your elbows out into Turn 1.',
      'Clean reaction on the lights! Hold track position through the opening laps.',
    ],
    standard: [
      'Solid start off the line. Maintain track position through the opening corners.',
      'Launch procedure complete. Settle into race pace.',
    ],
  },
  pit_serve_penalty: {
    bono: [
      'Remember we serve the penalty first, {driver}. Car stationary before tyre change.',
      'Penalty to serve. Car must remain completely stationary before mechanics touch it.',
    ],
    colapinto: [
      'Remember to serve the penalty in the box, {driver}! Stop completely before tyre work starts.',
      'Penalty stop. Stay stationary until the count is complete.',
    ],
    standard: [
      'Hold for penalty before tyres are changed. Do not work on the car until served.',
      'Penalty stop. Vehicle must remain stationary for the required duration.',
    ],
  },
  pit_stop_duration: {
    bono: [
      'Good stop, {driver}. Clean tyre change, push hard on the out-lap.',
      'Stop complete. Tyres fitted, push now on cold rubber.',
    ],
    colapinto: [
      'Great pit stop by the boys! Fresh rubber on, push hard on the out-lap.',
      'Clean stop! Now hammer it on the out-lap to make the undercut count.',
    ],
    standard: [
      'Pit stop complete. Push now on the out-lap.',
      'Stationary service complete. Maximise out-lap pace.',
    ],
  },
  pit_limiter_exit: {
    bono: [
      'Pit limiter off, {driver}. Track clear, push now.',
      'Limiter off. Mind the white pit exit line and push.',
    ],
    colapinto: [
      'Pit limiter off, {driver}! Track is clear, give it everything!',
      'Limiter disengaged. Watch the white line on exit and push now.',
    ],
    standard: [
      'Pit limiter off. Mind the white line on exit and push now.',
      'Pit exit clear. Limiter disengaged, resume race pace.',
    ],
  },
  tyre_crossover_wet: {
    bono: [
      'Track is saturated, standing water is too deep for Inters! Box this lap, box box for Full Wets.',
      'Aquaplaning risk is critical, {driver}. Box this lap for Full Wets.',
    ],
    colapinto: [
      'Way too much water on track, aquaplaning risk! Box this lap, {driver}, we need Full Wets!',
      'Standing water is too deep for Inters, box now, box box for Full Wets!',
    ],
    standard: [
      'Track is saturated with standing water, aquaplaning risk! Box this lap for Full Wets.',
      'Heavy rain crossover reached. Box this lap, box box for Extreme Wet tyres.',
    ],
  },
  tyre_crossover_inter: {
    bono: [
      'Rain has eased off and standing water is clearing, {driver}. Intermediate tyre is much faster now, box for Inters.',
      'Track is drying out from heavy wet, {driver}. Inters are the faster compound now, box this lap.',
    ],
    colapinto: [
      'The rain is easing up, the track is draining! Inters are way faster now, box this lap, {driver}!',
      'Standing water is clearing, let us switch to Inters! Box this lap, box box!',
    ],
    standard: [
      'Rain has eased up and standing water is clearing. Intermediate tyre is much faster now, box for Inters.',
      'Drying crossover window open. Box this lap to change from Full Wets to Intermediates.',
    ],
  },
  brake_bias_ok: {
    bono: [
      'Brake temperatures are equalized, {driver}. Axle balance is restored.',
      'Brake temps looking good now, balance restored across the axles.',
    ],
    colapinto: [
      'Brake temps equalized, {driver}! Thermal balance is back in the window.',
      'Brakes balanced nicely now, good job managing the bias.',
    ],
    standard: [
      'Brake temperatures are equalized, axle thermal balance is restored.',
      'Brake balance recovered. Temperatures across front and rear axles are normalized.',
    ],
  },
  fuel_mix_neutralized: {
    bono: [
      'Safety Car on track, {driver}. Switch fuel mix to Lean / Mix 1 to save fuel and manage temps.',
      'Switch to Mix 1 under the Safety Car, protect the engine and build fuel delta.',
    ],
    colapinto: [
      'Safety Car deployed! Switch down to Lean mix, {driver}, save fuel and protect the engine!',
      'Mix 1 on the fuel dial, {driver}. Save as much fuel as you can under neutralization.',
    ],
    standard: [
      'Safety Car deployed. Switch fuel mix to Lean / Mix 1 to conserve fuel and manage engine temperatures.',
      'Neutralization active. Select Lean fuel mix to recover fuel delta.',
    ],
  },
  fuel_mix_restart: {
    bono: [
      'Green flag! Restore fuel mix to Race Mix 2, race is on.',
      'Track is green, {driver}. Back to Mix 2 on the fuel dial, push now.',
    ],
    colapinto: [
      'Green flag, restart! Back to Race Mix 2, {driver}, give it everything!',
      'Green flag racing! Put the fuel back to Mix 2 and hammer it!',
    ],
    standard: [
      'Track is green! Restore fuel mix to Race Mix 2.',
      'Green flag restart. Switch fuel mode back to standard race mix.',
    ],
  },
  ers_clipping: {
    bono: [
      'Clipping, clipping! Maximum per-lap ERS deployment reached, battery boost depleted until the line.',
      'Derating on the straight, {driver}. 4MJ per-lap quota exhausted, no more electric boost this lap.',
    ],
    colapinto: [
      'Clipping, clipping! You hit the 4MJ lap limit, no battery boost until the start-finish line!',
      'Derating, {driver}! Lap battery quota is maxed out, lift and roll into the braking zone.',
    ],
    standard: [
      'Clipping, clipping! Maximum per-lap ERS deployment reached. Battery boost is depleted until the finish line.',
      'ERS derating active. Per-lap 4MJ electrical deployment cap reached.',
    ],
  },
  tyre_set_advisory: {
    bono: [
      'Pit window approaching, {driver}. Fresh set ready in the pit box.',
      'Strategy confirmed for the stop. New rubber prepped and waiting.',
    ],
    colapinto: [
      'Pit window approaching, {driver}! Fresh tyre set is ready in the box, give us a good in-lap!',
      'Tyres prepped in pit lane! We have a fresh set ready to bolt on.',
    ],
    standard: [
      'Pit window approaching. Recommended tyre set allocation is ready in the pit box.',
      'Fresh tyre set prepared for the upcoming pit stop.',
    ],
  },
  aero_straight_anticipation: {
    bono: [
      'Straight Mode in 100 metres, {driver}. Prepare to deploy low-drag aero on exit.',
      'Straight zone approaching. Ready on the Active Aero toggle.',
    ],
    colapinto: [
      'Straight Mode zone in 100 metres, {driver}! Hit the button as soon as you exit the turn!',
      'Aero zone coming up! Prepare low-drag Straight Mode!',
    ],
    standard: [
      'Straight Mode activation zone in 100 metres. Prepare to activate low-drag aero on corner exit.',
      'Active Aero zone approaching. Prepare Straight Mode.',
    ],
  },
  overtake_boost_anticipation: {
    bono: [
      'Override zone in 100 metres, {driver}. Boost button armed, use it for the overtake.',
      'Override activation approaching. Prepare to deploy boost.',
    ],
    colapinto: [
      'Override zone in 100 metres, {driver}! Ready on the boost button, get him on the straight!',
      'Override zone coming up! Full boost on corner exit!',
    ],
    standard: [
      'Override zone ahead in 100 metres. Ready on the boost button.',
      'Override boost activation zone in 100 metres. Prepare deployment.',
    ],
  },
  pit_limiter_overspeed: {
    bono: [
      'Speed limiter, speed limiter! Drop speed now, {driver}, pit entry line approaching!',
      'Watch your speed on pit entry! Hit the limiter, do not get a penalty!',
    ],
    colapinto: [
      'Speed limiter! Drop speed, drop speed! Don\'t speed into the pit lane, {driver}!',
      'Brake for the pit line! Speed limiter now, watch the limit!',
    ],
    standard: [
      'Speed limiter! Drop speed, pit limiter line approaching! Watch pit speed limit!',
      'Pit lane entry overspeed! Engage speed limiter before the line.',
    ],
  },
  tyre_blistering: {
    bono: [
      'Tyre blistering detected, {driver}. Back off lateral load and stay off the aggressive curbs.',
      'We see tyre blistering developing. Manage the slip angle in high-speed turns.',
    ],
    colapinto: [
      'We have tyre blistering, {driver}! Avoid aggressive curbs and manage cornering loads!',
      'Blistering detected on the tyre! Back off lateral slide, keep it smooth!',
    ],
    standard: [
      'Tyre blistering detected. Back off lateral loads and avoid aggressive curb strikes.',
      'Blistering detected on tyre. Manage tyre scrub to avoid surface tearing.',
    ],
  },
  tyre_pressure_high: {
    bono: [
      'Tyre pressure is spiking, {driver}. Manage corner entry scrub to avoid crowning the contact patch.',
      'Tyre pressure imbalance detected. Balance your cornering and traction loads.',
    ],
    colapinto: [
      'Tyre pressure is way too high, {driver}! Stop sliding into the apex, protect the contact patch!',
      'High tyre pressure detected! Smooth out the steering inputs!',
    ],
    standard: [
      'High tyre pressure detected. Manage corner entry scrub to prevent crowning the contact patch.',
      'Tyre pressure disparity is high across the axle. Balance cornering loads.',
    ],
  },
  damage_gearbox_wear: {
    bono: [
      'Gearbox wear is critical, {driver}. Expect delayed shifts and torque sync dropouts.',
      'Gearbox damage is high. Be clean and precise on the upshifts.',
    ],
    colapinto: [
      'Gearbox damage is critical, {driver}! Short shift if needed, watch the gear sync!',
      'Heavy gearbox wear! Take it easy on the downshifts, protect the transmission!',
    ],
    standard: [
      'Gearbox wear critical! Expect delayed gear shifts and torque sync dropouts.',
      'High gearbox damage detected. Transmission sync may drop out.',
    ],
  },
  damage_ice_wear: {
    bono: [
      'ICE wear is critical, {driver}. We will see top-end power loss on the straights.',
      'Internal combustion engine wear is high. Mind the revs, manage engine braking.',
    ],
    colapinto: [
      'Engine ICE wear is critical, {driver}! We are losing top speed on the straights!',
      'Heavy ICE engine wear! Manage engine temperatures and revs!',
    ],
    standard: [
      'Internal Combustion Engine (ICE) wear critical. Expect top-end power loss on the straights.',
      'High engine ICE wear detected. Top speed and power output are degraded.',
    ],
  },
  directive: {
    standard: ['{clean_text}'],
  },
};
