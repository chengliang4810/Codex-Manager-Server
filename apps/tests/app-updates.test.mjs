import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";

const appsRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(appsRoot, "src", "lib", "api", "app-updates.ts");

async function loadAppUpdatesModule() {
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "codexmanager-app-updates-")
  );
  const tempFile = path.join(tempDir, "app-updates.mjs");
  await fs.writeFile(tempFile, compiled.outputText, "utf8");
  return import(pathToFileURL(tempFile).href);
}

const appUpdates = await loadAppUpdatesModule();

test("compareVersions 识别新版本大于当前版本", () => {
  assert.equal(appUpdates.compareVersions("0.2.4", "v0.2.5") < 0, true);
  assert.equal(appUpdates.compareVersions("v0.2.5", "0.2.5"), 0);
  assert.equal(appUpdates.compareVersions("0.3.0", "0.2.9") > 0, true);
});

test("readRuntimeVersionInfo 统一解析服务端版本元数据", () => {
  const result = appUpdates.readRuntimeVersionInfo({
    version: "0.2.5",
    releaseTag: "v0.2.5",
    repository: "chengliang4810/Codex-Manager-Server",
    builtAt: "2026-04-17T12:00:00Z",
  });

  assert.equal(result.version, "0.2.5");
  assert.equal(result.releaseTag, "v0.2.5");
  assert.equal(result.repository, "chengliang4810/Codex-Manager-Server");
  assert.equal(result.builtAt, "2026-04-17T12:00:00Z");
});

test("buildUpdateCheckResult 生成仅检查版本的服务端更新结果", () => {
  const result = appUpdates.buildUpdateCheckResult(
    {
      version: "0.2.4",
      releaseTag: "v0.2.4",
      repository: "chengliang4810/Codex-Manager-Server",
      builtAt: "2026-04-17T12:00:00Z",
    },
    {
      tag_name: "v0.2.5",
      name: "CodexManager Server v0.2.5",
      published_at: "2026-04-17T13:00:00Z",
    },
    123456
  );

  assert.equal(result.repo, "chengliang4810/Codex-Manager-Server");
  assert.equal(result.mode, "web-release");
  assert.equal(result.isPortable, false);
  assert.equal(result.canPrepare, false);
  assert.equal(result.currentVersion, "0.2.4");
  assert.equal(result.latestVersion, "0.2.5");
  assert.equal(result.releaseTag, "v0.2.5");
  assert.equal(result.releaseName, "CodexManager Server v0.2.5");
  assert.equal(result.publishedAt, "2026-04-17T13:00:00Z");
  assert.equal(result.hasUpdate, true);
  assert.equal(result.checkedAtUnixSecs, 123456);
});

test("buildInjectedRuntimeVersionInfo 从前端注入环境生成开发态版本元数据", () => {
  const result = appUpdates.buildInjectedRuntimeVersionInfo({
    NEXT_PUBLIC_CODEXMANAGER_RELEASE_VERSION: "0.2.4",
    NEXT_PUBLIC_CODEXMANAGER_RELEASE_TAG: "v0.2.4",
    NEXT_PUBLIC_CODEXMANAGER_RELEASE_REPOSITORY:
      "chengliang4810/Codex-Manager-Server",
    NEXT_PUBLIC_CODEXMANAGER_RELEASE_BUILT_AT: "next-dev",
  });

  assert.equal(result.version, "0.2.4");
  assert.equal(result.releaseTag, "v0.2.4");
  assert.equal(result.repository, "chengliang4810/Codex-Manager-Server");
  assert.equal(result.builtAt, "next-dev");
});

test("normalizeUpdateCheckResult 保留在线升级和回滚字段", () => {
  const result = appUpdates.normalizeUpdateCheckResult({
    repo: "chengliang4810/Codex-Manager-Server",
    mode: "web-self-update",
    isPortable: false,
    hasUpdate: true,
    canPrepare: true,
    canRollback: true,
    currentVersion: "0.2.4",
    latestVersion: "0.2.5",
    releaseTag: "v0.2.5",
    releaseName: "CodexManager Server v0.2.5",
    publishedAt: "2026-04-20T12:00:00Z",
    reason: null,
    checkedAtUnixSecs: 123,
    releaseUrl:
      "https://github.com/chengliang4810/Codex-Manager-Server/releases/tag/v0.2.5",
  });

  assert.equal(result.canPrepare, true);
  assert.equal(result.canRollback, true);
  assert.equal(
    result.releaseUrl,
    "https://github.com/chengliang4810/Codex-Manager-Server/releases/tag/v0.2.5"
  );
});
