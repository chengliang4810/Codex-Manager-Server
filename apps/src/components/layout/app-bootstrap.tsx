"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store/useAppStore";
import { serviceClient } from "@/lib/api/service-client";
import {
  buildStartupSnapshotQueryKey,
  STARTUP_SNAPSHOT_REQUEST_LOG_LIMIT,
  STARTUP_SNAPSHOT_STALE_TIME,
} from "@/lib/api/startup-snapshot";
import { appClient } from "@/lib/api/app-client";
import { loadRuntimeCapabilities } from "@/lib/api/transport";
import { Button } from "@/components/ui/button";
import { CodexCliOnboardingDialog } from "@/components/layout/codex-cli-onboarding-dialog";
import { applyAppearancePreset } from "@/lib/appearance";
import { useLocalDayRange } from "@/hooks/useLocalDayRange";
import {
  formatServiceError,
  getDefaultBrowserGatewayAddr,
  isExpectedInitializeResult,
  normalizeServiceAddr,
} from "@/lib/utils/service";
import { useI18n } from "@/lib/i18n/provider";
import {
  getCanonicalStaticRouteUrl,
  normalizeRoutePath,
} from "@/lib/utils/static-routes";

const DEFAULT_SERVICE_ADDR = "localhost:48761";
const STARTUP_WARMUP_LABEL = "[startup warmup]";
/**
 * 函数 `sleep`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - ms: 参数 ms
 *
 * # 返回
 * 返回函数执行结果
 */
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/**
 * 函数 `AppBootstrap`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - params: 参数 params
 *
 * # 返回
 * 返回函数执行结果
 */
export function AppBootstrap({ children }: { children: React.ReactNode }) {
  const {
    setServiceStatus,
    setAppSettings,
    setRuntimeCapabilities,
    closeCodexCliGuide,
    serviceStatus,
    appSettings,
    isCodexCliGuideOpen,
    runtimeCapabilities,
  } = useAppStore();
  const { setTheme } = useTheme();
  const { t } = useI18n();
  const localDayRange = useLocalDayRange();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const [isInitializing, setIsInitializing] = useState(true);
  const hasInitializedOnce = useRef(false);
  const hasBootstrappedOnce = useRef(false);
  const serviceStatusRef = useRef(serviceStatus);
  const runtimeCapabilitiesRef = useRef(runtimeCapabilities);
  const [error, setError] = useState<string | null>(null);
  const [guideSessionDismissed, setGuideSessionDismissed] = useState(false);

  useEffect(() => {
    serviceStatusRef.current = serviceStatus;
  }, [serviceStatus]);

  useEffect(() => {
    runtimeCapabilitiesRef.current = runtimeCapabilities;
  }, [runtimeCapabilities]);

  /**
   * 函数 `applyLowTransparency`
   *
   * 作者: gaohongshun
   *
   * 时间: 2026-04-02
   *
   * # 参数
   * - enabled: 参数 enabled
   *
   * # 返回
   * 返回函数执行结果
   */
  const applyLowTransparency = (enabled: boolean) => {
    if (enabled) {
      document.body.classList.add("low-transparency");
    } else {
      document.body.classList.remove("low-transparency");
    }
  };

  const initializeService = useCallback(async (addr: string, retries = 0) => {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const initializeResult = await serviceClient.initialize(addr);
        if (!isExpectedInitializeResult(initializeResult)) {
          throw new Error("Port is in use or unexpected service responded (invalid initialize response)");
        }
        return initializeResult;
      } catch (serviceError: unknown) {
        lastError = serviceError;
        if (attempt < retries) {
          await sleep(300);
        }
      }
    }

    throw lastError || new Error(t("服务初始化失败: {addr}", { addr }));
  }, [t]);

  const prefetchStartupSnapshot = useCallback(
    async (addr: string) => {
      await queryClient.prefetchQuery({
        queryKey: buildStartupSnapshotQueryKey(
          addr,
          STARTUP_SNAPSHOT_REQUEST_LOG_LIMIT,
          localDayRange.dayStartTs,
        ),
        queryFn: () =>
          serviceClient.getStartupSnapshot({
            requestLogLimit: STARTUP_SNAPSHOT_REQUEST_LOG_LIMIT,
            dayStartTs: localDayRange.dayStartTs,
            dayEndTs: localDayRange.dayEndTs,
          }),
        staleTime: STARTUP_SNAPSHOT_STALE_TIME,
      });
    },
    [localDayRange.dayEndTs, localDayRange.dayStartTs, queryClient]
  );

  const shouldBlockOnInitialDashboardSnapshot = useCallback(
    () => !hasInitializedOnce.current && normalizeRoutePath(pathname) === "/",
    [pathname],
  );

  const applyConnectedServiceState = useCallback(
    async (
      addr: string,
      version: string,
      lowTransparency: boolean,
      options?: { blockOnDashboardSnapshot?: boolean },
    ) => {
      if (options?.blockOnDashboardSnapshot) {
        try {
          await prefetchStartupSnapshot(addr);
        } catch (warmupError) {
          console.warn(
            `${STARTUP_WARMUP_LABEL} initial dashboard snapshot prefetch failed`,
            warmupError,
          );
        }
      }
      setServiceStatus({
        addr,
        connected: true,
        version,
      });
      applyLowTransparency(lowTransparency);
      setIsInitializing(false);
      hasInitializedOnce.current = true;
    },
    [prefetchStartupSnapshot, setServiceStatus],
  );

  const init = useCallback(async () => {
    // Only show full screen loading if we haven't initialized once
    if (!hasInitializedOnce.current) {
      setIsInitializing(true);
    }
    setError(null);

    try {
      const detectedRuntimeCapabilities = await loadRuntimeCapabilities();
      setRuntimeCapabilities(detectedRuntimeCapabilities);
      const shouldBlockOnDashboardSnapshot =
        shouldBlockOnInitialDashboardSnapshot();

      const settings = await appClient.getSettings();
      const fallbackAddr = getDefaultBrowserGatewayAddr();
      const addr = normalizeServiceAddr(
        settings.serviceAddr || fallbackAddr || DEFAULT_SERVICE_ADDR
      );
      const currentServiceStatus = serviceStatusRef.current;
      
      const currentAppliedTheme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null;
      if (settings.theme && settings.theme !== currentAppliedTheme) {
        setTheme(settings.theme);
      }
      applyAppearancePreset(settings.appearancePreset);
      
      setAppSettings(settings);
      
      // CRITICAL: Do not reset status to connected: false if we are already connected
      // This prevents the Header badge from flashing
      if (!currentServiceStatus.connected || currentServiceStatus.addr !== addr) {
        setServiceStatus({ addr, connected: false, version: "" });
      }

      try {
        await initializeService(addr, 1);
        await applyConnectedServiceState(
          addr,
          "",
          settings.lowTransparency,
          { blockOnDashboardSnapshot: shouldBlockOnDashboardSnapshot },
        );
      } catch (serviceError: unknown) {
        if (!hasInitializedOnce.current) {
           setServiceStatus({ addr, connected: false, version: "" });
           setError(formatServiceError(serviceError));
        }
        setIsInitializing(false);
      }
    } catch (appError: unknown) {
      if (!hasInitializedOnce.current) {
        setError(appError instanceof Error ? appError.message : String(appError));
      }
      setIsInitializing(false);
    }
    // 使用 ref 读取最新 serviceStatus，避免把初始化流程绑定到状态抖动上
  }, [
    applyConnectedServiceState,
    initializeService,
    setAppSettings,
    setRuntimeCapabilities,
    setServiceStatus,
    setTheme,
    shouldBlockOnInitialDashboardSnapshot,
    t,
  ]);

  const handleGuideOpenChange = useCallback((open: boolean) => {
    if (open) {
      return;
    }
    if (isCodexCliGuideOpen) {
      closeCodexCliGuide();
      return;
    }
    setGuideSessionDismissed(true);
  }, [closeCodexCliGuide, isCodexCliGuideOpen]);

  const handleGuideAcknowledge = useCallback(
    async (dismissPermanently: boolean) => {
      if (dismissPermanently) {
        try {
          const settings = await appClient.setSettings({
            codexCliGuideDismissed: true,
          });
          setAppSettings(settings);
          toast.success(t("后续将不再显示这份引导"));
        } catch (guideError: unknown) {
          const message =
            guideError instanceof Error ? guideError.message : String(guideError);
          toast.error(t("保存引导状态失败: {message}", { message }));
          throw guideError;
        }
      }

      closeCodexCliGuide();
      setGuideSessionDismissed(true);
    },
    [closeCodexCliGuide, setAppSettings, t]
  );

  useEffect(() => {
    if (hasBootstrappedOnce.current) {
      return;
    }
    hasBootstrappedOnce.current = true;
    const frameId = window.requestAnimationFrame(() => {
      void init();
    });
    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [init]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const canonicalUrl = getCanonicalStaticRouteUrl();
    if (!canonicalUrl) {
      return;
    }

    window.history.replaceState(window.history.state, "", canonicalUrl);
  }, [pathname]);

  const showLoading = isInitializing && !hasInitializedOnce.current;
  const showError = !!error && !hasInitializedOnce.current;
  const showCodexGuide =
    isCodexCliGuideOpen ||
    serviceStatus.connected &&
    !showLoading &&
    !showError &&
    !guideSessionDismissed &&
    !appSettings.codexCliGuideDismissed;
  return (
    <>
      {children}

      <CodexCliOnboardingDialog
        open={showCodexGuide}
        onOpenChange={handleGuideOpenChange}
        onAcknowledge={handleGuideAcknowledge}
      />

      {showError ? (
        <div className="fixed bottom-5 right-5 z-50 max-w-md rounded-2xl border border-destructive/30 bg-background/95 p-4 shadow-2xl backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0 space-y-2">
              <div>
                <p className="text-sm font-semibold text-destructive">
                  {t("无法连接核心服务")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    "请确认 `codexmanager-service` 与 `codexmanager-web` 已启动，且 `/api/rpc` 可以正常访问。",
                  )}
                </p>
              </div>
              <p className="max-h-24 overflow-y-auto break-all rounded-lg bg-muted/50 p-2 font-mono text-[10px] text-muted-foreground">
                {error}
              </p>
              <Button variant="outline" onClick={() => void init()} className="h-9 gap-2">
                <RefreshCw className="h-4 w-4" /> {t("重试")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
