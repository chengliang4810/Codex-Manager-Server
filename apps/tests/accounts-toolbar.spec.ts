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
  localeOptions: ["zh-CN", "en"],
  serviceAddr: "localhost:48760",
  serviceListenMode: "loopback",
  serviceListenModeOptions: ["loopback", "all_interfaces"],
  routeStrategy: "ordered",
  routeStrategyOptions: ["ordered", "balanced"],
  freeAccountMaxModel: "auto",
  freeAccountMaxModelOptions: ["auto", "gpt-5"],
  modelForwardRules: "",
  accountMaxInflight: 1,
  gatewayOriginator: "codex-cli",
  gatewayOriginatorDefault: "codex-cli",
  gatewayUserAgentVersion: "1.0.0",
  gatewayUserAgentVersionDefault: "1.0.0",
  gatewayResidencyRequirement: "",
  gatewayResidencyRequirementOptions: ["", "us"],
  pluginMarketMode: "builtin",
  pluginMarketSourceUrl: "",
  upstreamProxyUrl: "",
  upstreamStreamTimeoutMs: 600000,
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

test("accounts toolbar shows warmup button and tooltip", async ({ page }) => {
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

  await page.route("**/api/runtime", async (route) => {
    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        mode: "web-gateway",
        rpcBaseUrl: "/api/rpc",
        canManageService: false,
        canSelfUpdate: false,
        canCloseToTray: false,
        canOpenLocalDir: false,
        canUseBrowserFileImport: true,
        canUseBrowserDownloadExport: true,
      }),
    });
  });

  await page.route("**/api/rpc", async (route) => {
    const payload = route.request().postDataJSON();
    const method = typeof payload?.method === "string" ? payload.method : "";
    const id = payload?.id ?? 1;

    const ok = (result: unknown) =>
      route.fulfill({
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result,
        }),
      });

    if (method === "appSettings/get") {
      await ok(SETTINGS_SNAPSHOT);
      return;
    }
    if (method === "initialize") {
      await ok({
        userAgent: "codex_cli_rs/0.1.19",
        codexHome: "C:/Users/Test/.codex",
        platformFamily: "windows",
        platformOs: "windows",
      });
      return;
    }
    if (method === "account/list") {
      await ok({
        items: [
          {
            id: "acct-plus-1",
            name: "qxcnms@gmail.com",
            label: "qxcnms@gmail.com",
            plan_type: "plus",
            status: "active",
            sort: 0,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      return;
    }
    if (method === "account/usage/list") {
      await ok([]);
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: `Unhandled RPC method in test: ${method}`,
        },
      }),
    });
  });

  await page.goto("/accounts/");

  await expect(page.getByRole("heading", { name: "账号管理" })).toBeVisible();

  const warmupButton = page.getByRole("button", { name: "预热" });
  await expect(warmupButton).toBeVisible();
  await warmupButton.hover();
  await expect(
    page.getByText(
      "向选中账号发送 hi 进行预热；如果未选中账号，则默认预热全部账号。",
    ),
  ).toBeVisible();
});

test("accounts toolbar can select and clear all filtered accounts", async ({ page }) => {
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

  await page.route("**/api/rpc", async (route) => {
    const payload = route.request().postDataJSON();
    const method = typeof payload?.method === "string" ? payload.method : "";
    const id = payload?.id ?? 1;

    const ok = (result: unknown) =>
      route.fulfill({
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify({
          jsonrpc: "2.0",
          id,
          result,
        }),
      });

    if (method === "appSettings/get") {
      await ok(SETTINGS_SNAPSHOT);
      return;
    }
    if (method === "initialize") {
      await ok({
        userAgent: "codex_cli_rs/0.1.19",
        codexHome: "C:/Users/Test/.codex",
        platformFamily: "windows",
        platformOs: "windows",
      });
      return;
    }
    if (method === "account/list") {
      await ok({
        items: [
          {
            id: "acct-plus-1",
            name: "alpha@example.com",
            label: "Alpha Workspace",
            plan_type: "plus",
            status: "active",
            sort: 0,
          },
          {
            id: "acct-free-1",
            name: "beta@example.com",
            label: "Beta Workspace",
            plan_type: "free",
            status: "active",
            sort: 5,
          },
          {
            id: "acct-free-2",
            name: "betacase@example.com",
            label: "Beta Backup",
            plan_type: "free",
            status: "active",
            sort: 10,
          },
        ],
        total: 3,
        page: 1,
        pageSize: 20,
      });
      return;
    }
    if (method === "account/usage/list") {
      await ok([]);
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        error: {
          code: -32000,
          message: `Unhandled RPC method in test: ${method}`,
        },
      }),
    });
  });

  await page.goto("/accounts/");

  await page.getByPlaceholder("搜索账号名 / 编号...").fill("beta");

  const selectAllButton = page.getByRole("button", { name: "全选账号" });
  await expect(selectAllButton).toBeVisible();
  await selectAllButton.click();
  await expect(page.getByText("(已选择 2 个)")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "取消全选" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "取消全选" }).click();
  await expect(page.getByText("(已选择 2 个)")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "全选账号" })).toBeVisible();
});
