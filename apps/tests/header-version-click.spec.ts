import { expect, test } from "@playwright/test";

const SETTINGS_SNAPSHOT = {
  updateAutoCheck: true,
  closeToTrayOnClose: false,
  closeToTraySupported: false,
  lowTransparency: false,
  lightweightModeOnCloseToTray: false,
  codexCliGuideDismissed: true,
  webAccessPasswordConfigured: false,
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

test("clicking header version triggers a fresh update check", async ({ page }) => {
  let releaseRequestCount = 0;

  await page.route("**/api/version", async (route) => {
    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        version: "0.2.4",
        releaseTag: "v0.2.4",
        repository: "chengliang4810/Codex-Manager-Server",
        builtAt: "2026-04-18T00:00:00Z",
      }),
    });
  });

  await page.route("https://api.github.com/repos/**/releases?per_page=1", async (route) => {
    releaseRequestCount += 1;
    const tagName = releaseRequestCount === 1 ? "v0.2.4" : "v0.2.5";
    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify([
        {
          tag_name: tagName,
          name: `CodexManager Server ${tagName}`,
          published_at: "2026-04-18T00:00:00Z",
        },
      ]),
    });
  });

  await page.route("**/api/rpc", async (route) => {
    const payload = route.request().postDataJSON();
    const method = typeof payload?.method === "string" ? payload.method : "";
    const id = payload?.id ?? 1;

    const resultByMethod = {
      "appSettings/get": SETTINGS_SNAPSHOT,
      initialize: {
        userAgent: "codex_cli_rs/0.1.19",
        codexHome: "C:/Users/Test/.codex",
        platformFamily: "windows",
        platformOs: "windows",
      },
      "gateway/concurrencyRecommendation/get": {
        usageRefreshWorkers: 4,
        httpWorkerFactor: 4,
        httpWorkerMin: 8,
        httpStreamWorkerFactor: 1,
        httpStreamWorkerMin: 2,
        accountMaxInflight: 1,
      },
    } satisfies Record<string, unknown>;

    if (!(method in resultByMethod)) {
      await route.fulfill({
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result: {},
        }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: resultByMethod[method],
      }),
    });
  });

  await page.goto("/settings/");

  const versionButton = page.getByRole("button", { name: /v0\.2\.4/ });
  await expect(versionButton).toBeVisible();
  await expect(page.getByText("可更新")).toHaveCount(0);

  await versionButton.click();

  await expect(page.getByText("可更新")).toBeVisible();
  await expect(versionButton).toHaveText(/v0\.2\.4 -> v0\.2\.5/);
});
