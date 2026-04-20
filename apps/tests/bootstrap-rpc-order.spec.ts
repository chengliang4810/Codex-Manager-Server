import { expect, test } from "@playwright/test";

const SETTINGS_SNAPSHOT = {
  updateAutoCheck: true,
  closeToTrayOnClose: false,
  closeToTraySupported: false,
  lowTransparency: false,
  lightweightModeOnCloseToTray: false,
  codexCliGuideDismissed: true,
  webAccessPasswordConfigured: true,
  locale: "zh-CN",
  localeOptions: ["zh-CN"],
  serviceAddr: "localhost:48761",
  serviceListenMode: "loopback",
  serviceListenModeOptions: ["loopback", "all_interfaces"],
  routeStrategy: "ordered",
  routeStrategyOptions: ["ordered", "balanced"],
  freeAccountMaxModel: "auto",
  freeAccountMaxModelOptions: ["auto", "gpt-5"],
  modelForwardRules: "",
  accountMaxInflight: 1,
  gatewayOriginator: "codex_cli_rs",
  gatewayOriginatorDefault: "codex_cli_rs",
  gatewayUserAgentVersion: "0.121.0",
  gatewayUserAgentVersionDefault: "0.121.0",
  gatewayResidencyRequirement: "",
  gatewayResidencyRequirementOptions: ["", "us"],
  pluginMarketMode: "builtin",
  pluginMarketSourceUrl: "",
  upstreamProxyUrl: "",
  upstreamStreamTimeoutMs: 300000,
  sseKeepaliveIntervalMs: 15000,
  backgroundTasks: {
    usagePollingEnabled: true,
    usagePollIntervalSecs: 600,
    gatewayKeepaliveEnabled: true,
    gatewayKeepaliveIntervalSecs: 180,
    tokenRefreshPollingEnabled: true,
    tokenRefreshPollIntervalSecs: 60,
    usageRefreshWorkers: 4,
    httpWorkerFactor: 4,
    httpWorkerMin: 8,
    httpStreamWorkerFactor: 1,
    httpStreamWorkerMin: 2,
  },
  envOverrides: {},
  envOverrideCatalog: [],
  envOverrideReservedKeys: [],
  envOverrideUnsupportedKeys: [],
  theme: "tech",
  appearancePreset: "classic",
};

test("bootstrap initializes service before requesting app settings", async ({ page }) => {
  const rpcMethods: string[] = [];

  await page.route("**/api/version", async (route) => {
    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: "0.2.4",
        releaseTag: "v0.2.4",
        repository: "chengliang4810/Codex-Manager-Server",
        builtAt: "2026-04-20T00:00:00Z",
      }),
    });
  });

  await page.route("**/api/system/check-updates", async (route) => {
    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        repo: "chengliang4810/Codex-Manager-Server",
        mode: "web-self-update",
        isPortable: false,
        hasUpdate: false,
        canPrepare: true,
        canRollback: false,
        currentVersion: "0.2.4",
        latestVersion: "0.2.4",
        releaseTag: "v0.2.4",
        releaseName: "CodexManager Server v0.2.4",
        publishedAt: "2026-04-20T00:00:00Z",
        reason: "当前已是最新版本",
        checkedAtUnixSecs: 1713542400,
        releaseUrl:
          "https://github.com/chengliang4810/Codex-Manager-Server/releases/tag/v0.2.4",
      }),
    });
  });

  await page.route("**/api/rpc", async (route) => {
    const payload = route.request().postDataJSON();
    const method = typeof payload?.method === "string" ? payload.method : "";
    const id = payload?.id ?? 1;
    rpcMethods.push(method);

    const resultByMethod = {
      initialize: {
        userAgent: "codex_cli_rs/0.121.0",
        codexHome: "/data",
        platformFamily: "unix",
        platformOs: "linux",
      },
      "appSettings/get": SETTINGS_SNAPSHOT,
      "gateway/concurrencyRecommendation/get": {
        usageRefreshWorkers: 4,
        httpWorkerFactor: 4,
        httpWorkerMin: 8,
        httpStreamWorkerFactor: 1,
        httpStreamWorkerMin: 2,
        accountMaxInflight: 1,
      },
    } satisfies Record<string, unknown>;

    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: resultByMethod[method] ?? {},
      }),
    });
  });

  await page.goto("/settings/");
  await expect
    .poll(() => ({
      initializeIndex: rpcMethods.indexOf("initialize"),
      settingsIndex: rpcMethods.indexOf("appSettings/get"),
    }))
    .toEqual({
      initializeIndex: 0,
      settingsIndex: 1,
    });
});
