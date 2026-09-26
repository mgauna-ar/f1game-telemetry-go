export interface SystemVersion {
  version: string;
  commit: string;
  build_date: string;
  is_dev: boolean;
  is_beta: boolean;
}

export interface ReleaseAsset {
  name: string;
  size: number;
  download_url: string;
  platform: 'windows' | 'macos' | 'linux' | 'checksums' | 'other';
}

export interface UpdateCheckResponse {
  update_available: boolean;
  current_version: string;
  latest_version?: string;
  release_name?: string;
  release_notes?: string;
  html_url?: string;
  published_at?: string;
  is_prerelease?: boolean;
  assets?: ReleaseAsset[];
}

/** Where the game has to send its UDP telemetry, from GET /api/system/network. */
export interface TelemetryEndpoint {
  /** Listen address as configured on the server, e.g. "0.0.0.0:20777". */
  udp_addr: string;
  udp_port: number;
  /** Address to enter in the game when it runs on this PC. */
  local_ip: string;
  /** Addresses a console or another PC can send to, the primary one first. */
  lan_ips: string[];
}
