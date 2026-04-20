export interface RuntimeVersionInfo {
  version: string;
  releaseTag: string;
  repository: string;
  builtAt: string | null;
}

export interface UpdateCheckResult {
  repo: string;
  mode: string;
  isPortable: boolean;
  hasUpdate: boolean;
  canPrepare: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTag: string;
  releaseName: string | null;
  publishedAt: string | null;
  reason: string | null;
  checkedAtUnixSecs: number;
}

type GitHubLatestRelease = {
  tag_name?: string;
  name?: string | null;
  published_at?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeVersion(value: string): string {
  return value.trim().replace(/^[vV]/, "");
}

function parseVersionParts(value: string): number[] {
  const normalized = normalizeVersion(value);
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return [0, 0, 0];
  }
  return match.slice(1).map((item) => Number(item) || 0);
}

export function compareVersions(left: string, right: string): number {
  const leftParts = parseVersionParts(left);
  const rightParts = parseVersionParts(right);

  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
}

export function readRuntimeVersionInfo(payload: unknown): RuntimeVersionInfo {
  const source = asRecord(payload) ?? {};
  const version = normalizeVersion(asString(source.version)) || "0.0.0";
  const releaseTag = asString(source.releaseTag) || `v${version}`;
  const repository =
    asString(source.repository) || "chengliang4810/Codex-Manager-Server";
  const builtAt = asString(source.builtAt) || null;

  return {
    version,
    releaseTag,
    repository,
    builtAt,
  };
}

export function buildInjectedRuntimeVersionInfo(
  env: Record<string, string | undefined>,
): RuntimeVersionInfo {
  return readRuntimeVersionInfo({
    version: env.NEXT_PUBLIC_CODEXMANAGER_RELEASE_VERSION,
    releaseTag: env.NEXT_PUBLIC_CODEXMANAGER_RELEASE_TAG,
    repository: env.NEXT_PUBLIC_CODEXMANAGER_RELEASE_REPOSITORY,
    builtAt: env.NEXT_PUBLIC_CODEXMANAGER_RELEASE_BUILT_AT,
  });
}

export function buildUpdateCheckResult(
  runtimeInfo: RuntimeVersionInfo,
  release: GitHubLatestRelease | null,
  checkedAtUnixSecs: number
): UpdateCheckResult {
  const latestTag = asString(release?.tag_name) || runtimeInfo.releaseTag;
  const latestVersion = normalizeVersion(latestTag) || runtimeInfo.version;
  const hasUpdate = compareVersions(runtimeInfo.version, latestVersion) < 0;

  return {
    repo: runtimeInfo.repository,
    mode: "web-release",
    isPortable: false,
    hasUpdate,
    canPrepare: false,
    currentVersion: runtimeInfo.version,
    latestVersion,
    releaseTag: latestTag || runtimeInfo.releaseTag,
    releaseName: asString(release?.name) || null,
    publishedAt: asString(release?.published_at) || null,
    reason: hasUpdate ? null : "当前已是最新版本",
    checkedAtUnixSecs,
  };
}

export async function fetchRuntimeVersionInfo(): Promise<RuntimeVersionInfo> {
  try {
    const response = await fetch("/api/version", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`版本信息请求失败（HTTP ${response.status}）`);
    }

    return readRuntimeVersionInfo(await response.json());
  } catch {
    return buildInjectedRuntimeVersionInfo(process.env);
  }
}

export async function fetchLatestRelease(
  repository: string
): Promise<GitHubLatestRelease | null> {
  const response = await fetch(
    `https://api.github.com/repos/${repository}/releases?per_page=1`,
    {
      method: "GET",
      headers: {
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GitHub Release 请求失败（HTTP ${response.status}）`);
  }

  const releases = (await response.json()) as GitHubLatestRelease[];
  return Array.isArray(releases) && releases.length > 0 ? releases[0] : null;
}

export async function checkForWebUpdate(): Promise<UpdateCheckResult> {
  const runtimeInfo = await fetchRuntimeVersionInfo();
  const latestRelease = await fetchLatestRelease(runtimeInfo.repository);

  return buildUpdateCheckResult(
    runtimeInfo,
    latestRelease,
    Math.floor(Date.now() / 1000)
  );
}
