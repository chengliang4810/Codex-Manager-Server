export type RenderStateRoutePath =
  | "/"
  | "/accounts"
  | "/apikeys"
  | "/models"
  | "/plugins"
  | "/logs"
  | "/settings";

const TOP_LEVEL_ROUTE_SET = new Set<RenderStateRoutePath>([
  "/",
  "/accounts",
  "/apikeys",
  "/models",
  "/plugins",
  "/logs",
  "/settings",
]);

function normalizeRoutePath(path: string): string {
  if (!path || path === "/") {
    return "/";
  }
  return path.replace(/\/+$/, "");
}

function toRenderableRoutePath(path: string): RenderStateRoutePath {
  const normalizedPath = normalizeRoutePath(path);
  return TOP_LEVEL_ROUTE_SET.has(normalizedPath as RenderStateRoutePath)
    ? (normalizedPath as RenderStateRoutePath)
    : "/";
}

export function resolveRenderableShellState(
  storedPath: string,
  openShellTabs: readonly string[],
  pathname: string,
): {
  currentPath: RenderStateRoutePath;
  tabs: RenderStateRoutePath[];
} {
  const normalizedStoredPath = toRenderableRoutePath(storedPath);
  const normalizedPathname = toRenderableRoutePath(pathname);
  const normalizedTabs = openShellTabs.reduce<RenderStateRoutePath[]>(
    (result, path) => {
      const normalizedPath = toRenderableRoutePath(path);
      if (!result.includes(normalizedPath)) {
        result.push(normalizedPath);
      }
      return result;
    },
    [],
  );

  const isBootstrapRootState =
    normalizedStoredPath === "/" &&
    normalizedTabs.length <= 1 &&
    (normalizedTabs[0] ?? "/") === "/";
  const currentPath =
    normalizedStoredPath === "/" && normalizedPathname !== "/"
      ? normalizedPathname
      : normalizedStoredPath;

  let tabs: RenderStateRoutePath[] =
    normalizedTabs.length > 0 ? [...normalizedTabs] : ["/"];
  if (!tabs.includes(currentPath)) {
    tabs = isBootstrapRootState ? [currentPath, ...tabs] : [...tabs, currentPath];
  }
  if (!tabs.includes(normalizedPathname)) {
    tabs = isBootstrapRootState
      ? [normalizedPathname, ...tabs]
      : [...tabs, normalizedPathname];
  }

  return {
    currentPath,
    tabs,
  };
}
