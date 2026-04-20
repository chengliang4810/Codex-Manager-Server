import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";

const appsRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(
  appsRoot,
  "src",
  "lib",
  "runtime",
  "runtime-capabilities.ts"
);

/**
 * 函数 `loadRuntimeModule`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * 无
 *
 * # 返回
 * 返回函数执行结果
 */
async function loadRuntimeModule() {
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "codexmanager-runtime-capabilities-")
  );
  const tempFile = path.join(tempDir, "runtime-capabilities.mjs");
  await fs.writeFile(tempFile, compiled.outputText, "utf8");
  return import(pathToFileURL(tempFile).href);
}

const runtime = await loadRuntimeModule();

test("normalizeRuntimeCapabilities 为 Web 网关补齐默认能力", () => {
  const capabilities = runtime.normalizeRuntimeCapabilities(
    {
      mode: "web-gateway",
      rpcBaseUrl: "/gateway/rpc/",
    },
    "/api/rpc"
  );

  assert.equal(capabilities.mode, "web-gateway");
  assert.equal(capabilities.rpcBaseUrl, "/gateway/rpc");
  assert.equal(capabilities.canUseBrowserFileImport, true);
  assert.equal(capabilities.canUseBrowserDownloadExport, true);
});

test("normalizeRuntimeCapabilities 会把旧的 unsupported-web 收敛到 web-gateway", () => {
  const capabilities = runtime.normalizeRuntimeCapabilities(
    {
      mode: "unsupported-web",
    },
    "/proxy/rpc"
  );

  assert.equal(capabilities.mode, "web-gateway");
  assert.equal(capabilities.rpcBaseUrl, "/proxy/rpc");
  assert.equal(capabilities.canUseBrowserFileImport, true);
  assert.equal(capabilities.canUseBrowserDownloadExport, true);
});

test("normalizeRuntimeCapabilities 在未知 mode 下回退到 web-gateway", () => {
  const capabilities = runtime.normalizeRuntimeCapabilities(
    {
      mode: "legacy-web",
      rpcBaseUrl: "",
    },
    "/custom/rpc"
  );

  assert.equal(capabilities.mode, "web-gateway");
  assert.equal(capabilities.rpcBaseUrl, "/custom/rpc");
});

test("desktop-tauri 不再属于受支持的运行时模式", () => {
  assert.equal(runtime.isRuntimeMode("desktop-tauri"), false);
  assert.equal(runtime.isRuntimeMode("unsupported-web"), false);
});

test("resolveRuntimeCapabilityView 默认走 web-gateway", () => {
  const view = runtime.resolveRuntimeCapabilityView(null, true);

  assert.equal(view.mode, "web-gateway");
  assert.equal(view.isDesktopRuntime, false);
  assert.equal(view.canAccessManagementRpc, true);
});

test("resolveRuntimeCapabilityView 在未探测到能力前也保持 Web 主路径", () => {
  const view = runtime.resolveRuntimeCapabilityView(null, false);

  assert.equal(view.mode, "web-gateway");
  assert.equal(view.isUnsupportedWebRuntime, false);
  assert.equal(view.canAccessManagementRpc, true);
  assert.equal(view.canUseBrowserFileImport, true);
  assert.equal(view.canUseBrowserDownloadExport, true);
});

test("resolveRuntimeCapabilityView 直接复用已探测到的 Web 网关能力", () => {
  const capabilities = runtime.buildWebGatewayRuntimeCapabilities("/managed/rpc");
  const view = runtime.resolveRuntimeCapabilityView(capabilities, false);

  assert.equal(view.mode, "web-gateway");
  assert.equal(view.isDesktopRuntime, false);
  assert.equal(view.canAccessManagementRpc, true);
  assert.equal(view.canUseBrowserFileImport, true);
  assert.equal(view.canUseBrowserDownloadExport, true);
});
