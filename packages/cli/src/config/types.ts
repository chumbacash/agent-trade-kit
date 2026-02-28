export interface CliProfile {
  api_key?: string;
  secret_key?: string;
  passphrase?: string;
  base_url?: string;
  timeout_ms?: number;
  demo?: boolean;
}

export interface CliConfig {
  default_profile?: string;
  profiles: Record<string, CliProfile>;
}
