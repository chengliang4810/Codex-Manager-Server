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

test("accounts page supports compact, list, and grid view modes", async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 960 });

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
            name: "",
            label: "Alpha Workspace",
            plan_type: "plus",
            status: "active",
            note: "Primary routing account",
            tags: ["主力", "稳定"],
            sort: 0,
            preferred: true,
            statusReason: "",
            has_subscription: true,
            subscription_plan: "plus",
            subscription_expires_at: 1777000000,
          },
          {
            id: "acct-free-1",
            name: "beta@example.com",
            label: "Beta Sandbox",
            plan_type: "free",
            status: "disabled",
            note: "备用账号",
            tags: ["备用"],
            sort: 5,
            preferred: false,
            statusReason: "disabled",
            has_subscription: false,
            subscription_plan: "free",
          },
          {
            id: "acct-pro-1",
            name: "gamma@example.com",
            label: "Gamma Pro",
            plan_type: "pro",
            status: "active",
            note: "高频调用",
            tags: ["高频"],
            sort: 10,
            preferred: false,
            statusReason: "",
            has_subscription: true,
            subscription_plan: "pro",
            subscription_expires_at: 1777100000,
          },
          {
            id: "acct-team-1",
            name: "delta@example.com",
            label: "Delta Team",
            plan_type: "team",
            status: "active",
            note: "团队共享",
            tags: ["团队"],
            sort: 15,
            preferred: false,
            statusReason: "",
            has_subscription: true,
            subscription_plan: "team",
            subscription_expires_at: 1777200000,
          },
          {
            id: "acct-ent-1",
            name: "epsilon@example.com",
            label: "Epsilon Enterprise",
            plan_type: "enterprise",
            status: "active",
            note: "企业账号",
            tags: ["企业"],
            sort: 20,
            preferred: false,
            statusReason: "",
            has_subscription: true,
            subscription_plan: "enterprise",
            subscription_expires_at: 1777300000,
          },
        ],
        total: 5,
        page: 1,
        pageSize: 20,
      });
      return;
    }
    if (method === "account/usage/list") {
      await ok([
        {
          account_id: "acct-plus-1",
          used_percent: 12,
          window_minutes: 300,
          resets_at: 1777003600,
          secondary_used_percent: 44,
          secondary_window_minutes: 10080,
          secondary_resets_at: 1777600000,
          captured_at: 1776999999,
        },
        {
          account_id: "acct-free-1",
          used_percent: 88,
          window_minutes: 300,
          resets_at: 1777007200,
          captured_at: 1776999999,
        },
        {
          account_id: "acct-pro-1",
          used_percent: 8,
          window_minutes: 300,
          resets_at: 1777001200,
          secondary_used_percent: 30,
          secondary_window_minutes: 10080,
          secondary_resets_at: 1777609000,
          captured_at: 1776999999,
        },
        {
          account_id: "acct-team-1",
          used_percent: 18,
          window_minutes: 300,
          resets_at: 1777004200,
          secondary_used_percent: 41,
          secondary_window_minutes: 10080,
          secondary_resets_at: 1777612000,
          captured_at: 1776999999,
        },
        {
          account_id: "acct-ent-1",
          used_percent: 22,
          window_minutes: 300,
          resets_at: 1777005200,
          secondary_used_percent: 48,
          secondary_window_minutes: 10080,
          secondary_resets_at: 1777615000,
          captured_at: 1776999999,
        },
      ]);
      return;
    }

    await ok({});
  });

  await page.goto("/accounts/");

  const cardViewButton = page.getByRole("button", { name: "卡片视图" });
  const listViewButton = page.getByRole("button", { name: "列表视图" });
  const compactViewButton = page.getByRole("button", { name: "紧凑视图" });
  await expect(cardViewButton).toBeVisible();
  await expect(listViewButton).toBeVisible();
  await expect(compactViewButton).toBeVisible();
  const cardButtonBox = await cardViewButton.boundingBox();
  const listButtonBox = await listViewButton.boundingBox();
  const compactButtonBox = await compactViewButton.boundingBox();
  expect(cardButtonBox).not.toBeNull();
  expect(listButtonBox).not.toBeNull();
  expect(compactButtonBox).not.toBeNull();
  expect((cardButtonBox?.x ?? 0) < (listButtonBox?.x ?? 0)).toBe(true);
  expect((listButtonBox?.x ?? 0) < (compactButtonBox?.x ?? 0)).toBe(true);

  await expect(page.getByText("Alpha Workspace")).toBeVisible();
  await expect(page.getByText("PLUS", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("5小时额度").first()).toBeVisible();
  await expect(page.getByTitle("编辑账号信息").first()).toBeVisible();
  await expect(page.getByTitle("取消优先").first()).toBeVisible();
  await expect(page.getByTitle("导出账号").first()).toBeVisible();
  await expect(page.getByTitle("删除账号").first()).toBeVisible();
  await expect(page.getByText("acct-plus-1")).toHaveCount(0);
  await expect(page.getByText("已订阅 · PLUS")).toHaveCount(0);
  await expect(page.getByText("未知 · FREE")).toHaveCount(0);
  const alphaCard = page
    .getByText("Alpha Workspace", { exact: true })
    .locator("xpath=ancestor::*[@data-slot='card'][1]");
  const refreshMeta = alphaCard.getByText("最近刷新：2026/04/24 11:06:39");
  await expect(refreshMeta).toBeVisible();
  const alphaCardBox = await alphaCard.boundingBox();
  const refreshMetaBox = await refreshMeta.boundingBox();
  const quotaBox = await alphaCard.getByText("5小时额度").first().boundingBox();
  expect(alphaCardBox).not.toBeNull();
  expect(refreshMetaBox).not.toBeNull();
  expect(quotaBox).not.toBeNull();
  expect((refreshMetaBox?.y ?? 0) < (quotaBox?.y ?? 0)).toBe(true);
  expect(((refreshMetaBox?.x ?? 0) - (alphaCardBox?.x ?? 0)) < 24).toBe(true);
  const cardNames = [
    "Alpha Workspace",
    "Beta Sandbox",
    "Gamma Pro",
    "Delta Team",
    "Epsilon Enterprise",
  ];
  const gridTops: number[] = [];
  for (const name of cardNames) {
    const top = await page
      .getByText(name, { exact: true })
      .locator("xpath=ancestor::*[@data-slot='card'][1]")
      .evaluate((node) => Math.round((node as HTMLElement).getBoundingClientRect().top));
    gridTops.push(top);
  }
  const firstRowY = gridTops[0] ?? 0;
  const firstRowCount = gridTops.filter((top) => Math.abs(top - firstRowY) < 8).length;
  expect(firstRowCount >= 4).toBe(true);

  await compactViewButton.click();
  await expect(page.getByText("acct-plus-1")).toHaveCount(0);
  await expect(page.getByText("主力")).toBeVisible();
  await expect(page.getByText("5h").first()).toBeVisible();
  await expect(page.getByText("7d").first()).toBeVisible();

  await listViewButton.click();
  await expect(page.getByRole("columnheader", { name: "账号信息" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "额度详情" })).toBeVisible();
  await expect(page.getByText("acct-plus-1")).toHaveCount(0);
  await page.getByText("Alpha Workspace", { exact: true }).hover();
  await expect(page.getByText("账号 ID")).toBeVisible();
  await expect(page.getByText("acct-plus-1", { exact: true })).toBeVisible();
  await expect(page.getByText("5小时额度").first()).toBeVisible();
  await expect(page.getByText("重置: 2026/04/24 12:06:40")).toBeVisible();
});
