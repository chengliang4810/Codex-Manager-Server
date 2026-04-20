export type AvailabilityLevel = "ok" | "warn" | "bad" | "unknown";

export type RuntimeMode = "web-gateway";

export interface RuntimeCapabilities {
  mode: RuntimeMode;
  rpcBaseUrl: string;
  canUseBrowserFileImport: boolean;
  canUseBrowserDownloadExport: boolean;
}

export interface ServiceStatus {
  connected: boolean;
  version: string;
  uptime: number;
  addr: string;
}

export interface ServiceInitializationResult {
  userAgent: string;
  codexHome: string;
  platformFamily: string;
  platformOs: string;
}
