export interface DevVersionInfo {
  version: string;
  releaseTag: string;
  repository: string;
  builtAt: string | null;
}

const DEFAULT_DEV_SERVICE_ADDR = "127.0.0.1:48760";
const DEFAULT_REPOSITORY = "chengliang4810/Codex-Manager-Server";
const DEFAULT_RUNTIME_RPC_BASE_URL = "/api/rpc";

function trimString(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeDevServiceBaseUrl(
  raw: string | null | undefined,
): string {
  const trimmed = trimString(raw);
  if (!trimmed) {
    return `http://${DEFAULT_DEV_SERVICE_ADDR}`;
  }

  let normalized = trimmed
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .trim();

  if (!normalized) {
    return `http://${DEFAULT_DEV_SERVICE_ADDR}`;
  }

  if (/^\d+$/.test(normalized)) {
    normalized = `127.0.0.1:${normalized}`;
  }

  const [host, port] = normalized.split(":");
  if (port) {
    if (host === "0.0.0.0" || host === "::" || host === "[::]") {
      normalized = `127.0.0.1:${port}`;
    }
  }

  return `http://${normalized}`;
}

export function resolveDevVersionInfo(
  env: Record<string, string | undefined>,
  fallbackVersion: string,
): DevVersionInfo {
  const version = trimString(env.CODEXMANAGER_RELEASE_VERSION) || fallbackVersion;
  const releaseTag =
    trimString(env.CODEXMANAGER_RELEASE_TAG) || `v${version}`;
  const repository =
    trimString(env.CODEXMANAGER_RELEASE_REPOSITORY) || DEFAULT_REPOSITORY;
  const builtAt = trimString(env.CODEXMANAGER_RELEASE_BUILT_AT) || null;

  return {
    version,
    releaseTag,
    repository,
    builtAt,
  };
}

export function buildVersionInfoPayload(
  versionInfo: DevVersionInfo,
): DevVersionInfo {
  return versionInfo;
}

export function buildRuntimeInfoPayload(versionInfo: DevVersionInfo) {
  return {
    mode: "web-gateway",
    rpcBaseUrl: DEFAULT_RUNTIME_RPC_BASE_URL,
    canUseBrowserFileImport: true,
    canUseBrowserDownloadExport: true,
    currentVersion: versionInfo.version,
    releaseTag: versionInfo.releaseTag,
    releaseRepository: versionInfo.repository,
    builtAt: versionInfo.builtAt,
  };
}

export function readRpcTokenFromEnvOrFile(
  env: Record<string, string | undefined>,
  readFile: (filePath: string) => string | null = () => null,
): string {
  const envToken = trimString(env.CODEXMANAGER_RPC_TOKEN);
  if (envToken) {
    return envToken;
  }

  const tokenFile = trimString(env.CODEXMANAGER_RPC_TOKEN_FILE);
  if (!tokenFile) {
    return "";
  }

  return trimString(readFile(tokenFile));
}

export function buildServiceTargetUrl(
  serviceBaseUrl: string,
  pathname: string,
  search = "",
): string {
  const base = serviceBaseUrl.replace(/\/+$/, "");
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${base}${normalizedPath}${search || ""}`;
}

export function createDevProxyRewrites(
  serviceBaseUrl: string,
  rpcProxyBaseUrl: string,
) {
  return [
    {
      source: "/api/rpc",
      destination: buildServiceTargetUrl(rpcProxyBaseUrl, "/api/rpc"),
    },
    {
      source: "/v1/:path*",
      destination: buildServiceTargetUrl(serviceBaseUrl, "/v1/:path*"),
    },
    {
      source: "/health",
      destination: buildServiceTargetUrl(serviceBaseUrl, "/health"),
    },
    {
      source: "/metrics",
      destination: buildServiceTargetUrl(serviceBaseUrl, "/metrics"),
    },
  ];
}
