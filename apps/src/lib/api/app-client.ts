import { getAppErrorMessage, invoke } from "./transport";
import { AppSettings, CodexLatestVersionInfo } from "../../types";
import { normalizeAppSettings } from "./normalize";
import {
  checkForWebUpdate,
  normalizeUpdateCheckResult,
  UpdateActionResult,
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

  async checkUpdate(): Promise<UpdateCheckResult> {
    try {
      const response = await fetch("/api/system/check-updates", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
      if (response.ok) {
        return normalizeUpdateCheckResult(await response.json());
      }
    } catch {
      // Fallback to client-side release check below.
    }
    return checkForWebUpdate();
  },

  async performUpdate(): Promise<UpdateActionResult> {
    const response = await fetch("/api/system/update", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getAppErrorMessage(payload));
    }
    return {
      message: String(payload?.message || "").trim() || "update applied",
      needRestart: payload?.needRestart === true,
    };
  },

  async rollbackUpdate(): Promise<UpdateActionResult> {
    const response = await fetch("/api/system/rollback", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getAppErrorMessage(payload));
    }
    return {
      message: String(payload?.message || "").trim() || "rollback applied",
      needRestart: payload?.needRestart === true,
    };
  },

  async restartService(): Promise<{ message: string }> {
    const response = await fetch("/api/system/restart", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getAppErrorMessage(payload));
    }
    return {
      message: String(payload?.message || "").trim() || "restart initiated",
    };
  },
};
