"use client";

import {
  lazy,
  Suspense,
  useEffect,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import { Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import {
  type TopLevelRoutePath,
  getTopLevelRouteLabel,
  toTopLevelRoutePath,
} from "@/lib/app-shell/top-level-routes";
import { resolveRenderableShellState } from "@/lib/app-shell/render-state";
import { useI18n } from "@/lib/i18n/provider";
import { useAppStore } from "@/lib/store/useAppStore";
import { cn } from "@/lib/utils";

const ROOT_ROUTE_PATH = "/";

const LAZY_PAGE_COMPONENTS: Record<
  Exclude<TopLevelRoutePath, typeof ROOT_ROUTE_PATH>,
  LazyExoticComponent<ComponentType>
> = {
  "/accounts": lazy(() => import("@/app/accounts/page")),
  "/apikeys": lazy(() => import("@/app/apikeys/page")),
  "/models": lazy(() => import("@/app/models/page")),
  "/plugins": lazy(() => import("@/app/plugins/page")),
  "/logs": lazy(() => import("@/app/logs/page")),
  "/settings": lazy(() => import("@/app/settings/page")),
};

const ROOT_PAGE_COMPONENT = lazy(() => import("@/app/page"));

function PagePanelFallback({ title }: { title: string }) {
  return (
    <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-border/50 bg-background/35 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">正在加载页面内容...</p>
        </div>
      </div>
    </div>
  );
}

function LazyPagePanel({ path }: { path: TopLevelRoutePath }) {
  const LazyPage = path === ROOT_ROUTE_PATH ? ROOT_PAGE_COMPONENT : LAZY_PAGE_COMPONENTS[path];

  return (
    <Suspense fallback={<PagePanelFallback title={getTopLevelRouteLabel(path)} />}>
      <LazyPage />
    </Suspense>
  );
}

export function PageKeepAliveViewport({
  initialChildren,
}: {
  initialChildren: ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [initialRoutePath] = useState<TopLevelRoutePath>(() =>
    toTopLevelRoutePath(pathname),
  );
  const currentShellPath = useAppStore((state) => state.currentShellPath);
  const openShellTabs = useAppStore((state) => state.openShellTabs);
  const syncShellPathFromLocation = useAppStore(
    (state) => state.syncShellPathFromLocation,
  );
  const renderState = resolveRenderableShellState(
    currentShellPath,
    openShellTabs,
    pathname,
  );

  useEffect(() => {
    syncShellPathFromLocation(pathname);
  }, [pathname, syncShellPathFromLocation]);

  useEffect(() => {
    const handlePopState = () => {
      syncShellPathFromLocation(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [syncShellPathFromLocation]);

  useEffect(() => {
    document.title = `${t(getTopLevelRouteLabel(renderState.currentPath))} - CodexManagerServer`;
  }, [renderState.currentPath, t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-0 flex-1">
        {renderState.tabs.map((path) => {
          const isActive = path === renderState.currentPath;
          const isInitialPanel = path === initialRoutePath;

          return (
            <section
              key={path}
              aria-hidden={!isActive}
              data-shell-path={path}
              className={cn(
                "relative min-h-[calc(100vh-11rem)]",
                isActive ? "block" : "hidden",
              )}
            >
              {isInitialPanel ? initialChildren : <LazyPagePanel path={path} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}
