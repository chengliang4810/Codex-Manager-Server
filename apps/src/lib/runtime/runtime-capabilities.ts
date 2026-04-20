import type { RuntimeCapabilities, RuntimeMode } from "@/types";

export const DEFAULT_WEB_RPC_BASE_URL = "/api/rpc";

export type RuntimeCapabilityView = {
  runtimeCapabilities: RuntimeCapabilities | null;
  mode: RuntimeMode;
  isDesktopRuntime: boolean;
  isUnsupportedWebRuntime: boolean;
  canAccessManagementRpc: boolean;
  canUseBrowserFileImport: boolean;
  canUseBrowserDownloadExport: boolean;
};

/**
 * 函数 `asRecord`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - value: 参数 value
 *
 * # 返回
 * 返回函数执行结果
 */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * 函数 `asString`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - value: 参数 value
 *
 * # 返回
 * 返回函数执行结果
 */
function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 函数 `asBoolean`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - value: 参数 value
 * - fallback: 参数 fallback
 *
 * # 返回
 * 返回函数执行结果
 */
function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * 函数 `normalizeRpcBaseUrl`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - value: 参数 value
 *
 * # 返回
 * 返回函数执行结果
 */
export function normalizeRpcBaseUrl(value: string | null | undefined): string {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.endsWith("/")
    ? normalized.replace(/\/+$/, "") || DEFAULT_WEB_RPC_BASE_URL
    : normalized;
}

/**
 * 函数 `isRuntimeMode`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - value: 参数 value
 *
 * # 返回
 * 返回函数执行结果
 */
export function isRuntimeMode(value: string): value is RuntimeMode {
  return value === "web-gateway";
}

/**
 * 函数 `buildWebGatewayRuntimeCapabilities`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - rpcBaseUrl: 参数 rpcBaseUrl
 *
 * # 返回
 * 返回函数执行结果
 */
export function buildWebGatewayRuntimeCapabilities(
  rpcBaseUrl = DEFAULT_WEB_RPC_BASE_URL
): RuntimeCapabilities {
  return {
    mode: "web-gateway",
    rpcBaseUrl: normalizeRpcBaseUrl(rpcBaseUrl) || DEFAULT_WEB_RPC_BASE_URL,
    canUseBrowserFileImport: true,
    canUseBrowserDownloadExport: true,
  };
}

/**
 * 函数 `normalizeRuntimeCapabilities`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - payload: 参数 payload
 * - fallbackRpcBaseUrl: 参数 fallbackRpcBaseUrl
 *
 * # 返回
 * 返回函数执行结果
 */
export function normalizeRuntimeCapabilities(
  payload: unknown,
  fallbackRpcBaseUrl = DEFAULT_WEB_RPC_BASE_URL
): RuntimeCapabilities {
  const source = asRecord(payload) ?? {};
  const modeValue = asString(source.mode);
  const mode: RuntimeMode = isRuntimeMode(modeValue) ? modeValue : "web-gateway";
  const defaultCapabilities =
    buildWebGatewayRuntimeCapabilities(fallbackRpcBaseUrl);

  return {
    mode,
    rpcBaseUrl:
      normalizeRpcBaseUrl(asString(source.rpcBaseUrl)) ||
      defaultCapabilities.rpcBaseUrl,
    canUseBrowserFileImport: asBoolean(
      source.canUseBrowserFileImport,
      defaultCapabilities.canUseBrowserFileImport
    ),
    canUseBrowserDownloadExport: asBoolean(
      source.canUseBrowserDownloadExport,
      defaultCapabilities.canUseBrowserDownloadExport
    ),
  };
}

/**
 * 函数 `resolveRuntimeCapabilityView`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - runtimeCapabilities: 参数 runtimeCapabilities
 * - desktopFallback: 参数 desktopFallback
 *
 * # 返回
 * 返回函数执行结果
 */
export function resolveRuntimeCapabilityView(
  runtimeCapabilities: RuntimeCapabilities | null,
  _desktopFallback: boolean
): RuntimeCapabilityView {
  const resolvedCapabilities =
    runtimeCapabilities ?? buildWebGatewayRuntimeCapabilities();
  const mode = resolvedCapabilities.mode;

  return {
    runtimeCapabilities,
    mode,
    isDesktopRuntime: false,
    isUnsupportedWebRuntime: false,
    canAccessManagementRpc: true,
    canUseBrowserFileImport: resolvedCapabilities.canUseBrowserFileImport,
    canUseBrowserDownloadExport: resolvedCapabilities.canUseBrowserDownloadExport,
  };
}
