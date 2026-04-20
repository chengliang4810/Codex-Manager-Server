import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";

const appsRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(appsRoot, "src", "lib", "dev-server-proxy.ts");

async function loadDevServerProxyModule() {
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "codexmanager-dev-server-proxy-"),
  );
  const tempFile = path.join(tempDir, "dev-server-proxy.mjs");
  await fs.writeFile(tempFile, compiled.outputText, "utf8");
  return import(pathToFileURL(tempFile).href);
}

const devProxy = await loadDevServerProxyModule();

test("normalizeDevServiceBaseUrl 收敛地址到本地可连接的 http 地址", () => {
  assert.equal(
    devProxy.normalizeDevServiceBaseUrl("0.0.0.0:48760"),
    "http://127.0.0.1:48760",
  );
  assert.equal(
    devProxy.normalizeDevServiceBaseUrl("localhost:48760"),
    "http://localhost:48760",
  );
  assert.equal(
    devProxy.normalizeDevServiceBaseUrl("https://127.0.0.1:9000/path"),
    "http://127.0.0.1:9000",
  );
  assert.equal(
    devProxy.normalizeDevServiceBaseUrl("48760"),
    "http://127.0.0.1:48760",
  );
});

test("readRpcTokenFromEnvOrFile 优先读取环境变量，其次读取 token 文件", () => {
  assert.equal(
    devProxy.readRpcTokenFromEnvOrFile({
      CODEXMANAGER_RPC_TOKEN: " env-token ",
      CODEXMANAGER_RPC_TOKEN_FILE: "ignored",
    }),
    "env-token",
  );

  assert.equal(
    devProxy.readRpcTokenFromEnvOrFile(
      {
        CODEXMANAGER_RPC_TOKEN_FILE: "D:/tmp/codexmanager.rpc-token",
      },
      (filePath) =>
        filePath === "D:/tmp/codexmanager.rpc-token"
          ? " file-token \n"
          : null,
    ),
    "file-token",
  );

  assert.equal(
    devProxy.readRpcTokenFromEnvOrFile(
      {
        CODEXMANAGER_RPC_TOKEN_FILE: "D:/tmp/empty.rpc-token",
      },
      () => "   ",
    ),
    "",
  );
});

test("buildRuntimeInfoPayload 和 buildVersionInfoPayload 生成开发态元数据", () => {
  const versionInfo = {
    version: "0.2.4",
    releaseTag: "v0.2.4",
    repository: "chengliang4810/Codex-Manager-Server",
    builtAt: null,
  };

  assert.deepEqual(devProxy.buildVersionInfoPayload(versionInfo), versionInfo);
  assert.deepEqual(devProxy.buildRuntimeInfoPayload(versionInfo), {
    mode: "web-gateway",
    rpcBaseUrl: "/api/rpc",
    canUseBrowserFileImport: true,
    canUseBrowserDownloadExport: true,
    currentVersion: "0.2.4",
    releaseTag: "v0.2.4",
    releaseRepository: "chengliang4810/Codex-Manager-Server",
    builtAt: null,
  });
});

test("buildServiceTargetUrl 拼接 service 目标地址和路径", () => {
  assert.equal(
    devProxy.buildServiceTargetUrl(
      "http://127.0.0.1:48760",
      "/v1/models",
      "?limit=20",
    ),
    "http://127.0.0.1:48760/v1/models?limit=20",
  );
  assert.equal(
    devProxy.buildServiceTargetUrl(
      "http://127.0.0.1:48760/",
      "/health",
      "",
    ),
    "http://127.0.0.1:48760/health",
  );
});

test("createDevProxyRewrites 仅代理开发态需要的本地 service 路径", () => {
  assert.deepEqual(
    devProxy.createDevProxyRewrites(
      "http://127.0.0.1:48760",
      "http://127.0.0.1:48762",
    ),
    [
      {
        source: "/api/rpc",
        destination: "http://127.0.0.1:48762/api/rpc",
      },
      {
        source: "/v1/:path*",
        destination: "http://127.0.0.1:48760/v1/:path*",
      },
      {
        source: "/health",
        destination: "http://127.0.0.1:48760/health",
      },
      {
        source: "/metrics",
        destination: "http://127.0.0.1:48760/metrics",
      },
    ],
  );
});
