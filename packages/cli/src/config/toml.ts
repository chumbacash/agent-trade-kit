import { writeFullConfig, configFilePath } from "@agent-tradekit/core";
import type { OkxTomlConfig } from "@agent-tradekit/core";

// Re-export for backward compat within CLI
export type { OkxTomlConfig as CliConfig };
export { configFilePath as configPath };

export function configDir(): string {
  return configFilePath().replace(/\/config\.toml$/, "");
}

export function writeCliConfig(config: OkxTomlConfig): void {
  writeFullConfig(config);
}
