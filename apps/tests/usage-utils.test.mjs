import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import ts from "../node_modules/typescript/lib/typescript.js";

const appsRoot = path.resolve(import.meta.dirname, "..");
const sourcePath = path.join(appsRoot, "src", "lib", "utils", "usage.ts");

async function loadUsageUtilsModule() {
  const [usageSource, timeSource] = await Promise.all([
    fs.readFile(sourcePath, "utf8"),
    fs.readFile(path.join(appsRoot, "src", "lib", "utils", "time.ts"), "utf8"),
  ]);

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "codexmanager-usage-utils-"),
  );
  const usageFile = path.join(tempDir, "usage-utils.mjs");
  const timeFile = path.join(tempDir, "time.mjs");
  const typesFile = path.join(tempDir, "types.mjs");

  const timeCompiled = ts.transpileModule(timeSource, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: "time.ts",
  });
  const usageCompiled = ts.transpileModule(
    usageSource
      .replace('from "@/lib/utils/time"', 'from "./time.mjs"')
      .replace('from "@/types"', 'from "./types.mjs"'),
    {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: sourcePath,
    },
  );

  await fs.writeFile(timeFile, timeCompiled.outputText, "utf8");
  await fs.writeFile(typesFile, "export {};\n", "utf8");
  await fs.writeFile(usageFile, usageCompiled.outputText, "utf8");
  return import(pathToFileURL(usageFile).href);
}

const usageUtils = await loadUsageUtilsModule();

test("calcAvailability 将用量耗尽区分为限流而不是不可用", () => {
  const limited = usageUtils.calcAvailability(
    {
      availabilityStatus: "unavailable",
      usedPercent: 100,
      windowMinutes: 300,
      secondaryUsedPercent: 12,
      secondaryWindowMinutes: 10080,
    },
    {
      status: "active",
      statusReason: "",
    },
  );

  assert.deepEqual(limited, {
    text: "限流",
    level: "bad",
  });
});

test("isLimitedAccount 识别 limited 状态，低配额不把 0 剩余额度算进去", () => {
  assert.equal(usageUtils.isLimitedAccount({ status: "limited" }), true);
  assert.equal(usageUtils.isLimitedAccount({ status: "active" }), false);

  assert.equal(
    usageUtils.isLowQuotaUsage({
      usedPercent: 100,
      windowMinutes: 300,
      secondaryUsedPercent: 100,
      secondaryWindowMinutes: 10080,
    }),
    false,
  );
});
