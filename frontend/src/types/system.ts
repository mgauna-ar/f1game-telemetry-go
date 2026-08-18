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
