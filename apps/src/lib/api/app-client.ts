import { invoke } from "./transport";
import { AppSettings, CodexLatestVersionInfo } from "../../types";
import { normalizeAppSettings } from "./normalize";
import {
  checkForWebUpdate,
  UpdateCheckResult,
} from "./app-updates";
import {
  GatewayConcurrencyRecommendation,
  readGatewayConcurrencyRecommendation,
} from "./gateway-settings";

export const appClient = {
  async getSettings(): Promise<AppSettings> {
    const result = await invoke<unknown>("app_settings_get");
    return normalizeAppSettings(result);
  },
  async setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const result = await invoke<unknown>("app_settings_set", { patch });
    return normalizeAppSettings(result);
  },
  async getGatewayConcurrencyRecommendation(): Promise<GatewayConcurrencyRecommendation> {
    const result = await invoke<unknown>("service_gateway_concurrency_recommend_get");
    return readGatewayConcurrencyRecommendation(result);
  },
  getCodexLatestVersion: () =>
    invoke<CodexLatestVersionInfo>("service_gateway_codex_latest_version_get"),

  openInBrowser: (url: string) => invoke("open_in_browser", { url }),

  checkUpdate: (): Promise<UpdateCheckResult> => checkForWebUpdate(),
};
