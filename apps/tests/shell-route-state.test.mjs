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
  "app-shell",
  "render-state.ts"
);

async function loadRenderStateModule() {
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "codexmanager-render-state-")
  );
  const tempFile = path.join(tempDir, "render-state.mjs");
  await fs.writeFile(tempFile, compiled.outputText, "utf8");
  return import(pathToFileURL(tempFile).href);
}

const renderState = await loadRenderStateModule();

test("resolveRenderableShellState 在首屏刷新子路由时优先使用真实 pathname", () => {
  const result = renderState.resolveRenderableShellState("/", ["/"], "/settings");

  assert.equal(result.currentPath, "/settings");
  assert.deepEqual(result.tabs, ["/settings", "/"]);
});

test("resolveRenderableShellState 在后续导航时保持 store 中的活动路由", () => {
  const result = renderState.resolveRenderableShellState(
    "/models",
    ["/", "/models"],
    "/settings"
  );

  assert.equal(result.currentPath, "/models");
  assert.deepEqual(result.tabs, ["/", "/models", "/settings"]);
});
