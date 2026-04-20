import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";

const appsRoot = path.resolve(import.meta.dirname, "..");

async function importTsModule(sourcePath, tempName) {
  const source = await fs.readFile(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: sourcePath,
  });

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "codexmanager-cleanup-"));
  const tempFile = path.join(tempDir, `${tempName}.mjs`);
  await fs.writeFile(tempFile, compiled.outputText, "utf8");
  return import(pathToFileURL(tempFile).href);
}

test("/author no longer exists in root page paths", async () => {
  const module = await importTsModule(
    path.join(appsRoot, "src", "lib", "routes", "root-page-paths.ts"),
    "root-page-paths"
  );

  assert.equal(module.ROOT_PAGE_PATHS.includes("/author"), false);
});

test("logs page no longer contains aggregate-api compatibility UI", async () => {
  const logsPageSource = await fs.readFile(
    path.join(appsRoot, "src", "app", "logs", "page.tsx"),
    "utf8"
  );

  assert.equal(logsPageSource.includes("aggregateApiMap"), false);
  assert.equal(logsPageSource.includes("resolveAggregateApiDisplayName"), false);
  assert.equal(logsPageSource.includes("AggregateApi"), false);
});
