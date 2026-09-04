export interface TelemetrySamplePoint {
  lap_distance: number;
  session_time: number;
  speed: number;
  throttle: number;
  brake: number;
  steer?: number;
  gear?: number;
  engine_rpm?: number;
  ers_store_energy?: number;
  ers_deploy_mode?: number;
  active_aero_mode?: number;
  active_aero_available?: number;
  overtake_active?: number;
  world_pos_x?: number;
  world_pos_y?: number;
  world_pos_z?: number;
}

