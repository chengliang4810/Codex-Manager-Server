"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { HelpCircle, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store/useAppStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AppUpdateDialog } from "@/components/modals/app-update-dialog";
import { useI18n } from "@/lib/i18n/provider";
import { getTopLevelRouteLabel } from "@/lib/app-shell/top-level-routes";
import { resolveRenderableShellState } from "@/lib/app-shell/render-state";
import { appClient } from "@/lib/api/app-client";
import { getAppErrorMessage } from "@/lib/api/transport";
import {
  compareVersions,
  fetchRuntimeVersionInfo,
  type RuntimeVersionInfo,
  type UpdateCheckResult,
} from "@/lib/api/app-updates";
import { copyTextToClipboard } from "@/lib/utils/clipboard";

/**
 * 函数 `Header`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * 无
 *
 * # 返回
 * 返回函数执行结果
 */
export function Header() {
  const pathname = usePathname();
  const {
    serviceStatus,
    currentShellPath,
    openCodexCliGuide,
  } = useAppStore();
  const { t } = useI18n();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [runtimeVersion, setRuntimeVersion] = useState<RuntimeVersionInfo | null>(null);
  const [updateSummary, setUpdateSummary] = useState<UpdateCheckResult | null>(null);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [didAnnounceUpdate, setDidAnnounceUpdate] = useState(false);
  const renderState = resolveRenderableShellState(
    currentShellPath,
    [currentShellPath],
    pathname,
  );

  /**
   * 函数 `getPageTitle`
   *
   * 作者: gaohongshun
   *
   * 时间: 2026-04-02
   *
   * # 参数
   * 无
   *
   * # 返回
   * 返回函数执行结果
   */
  const getPageTitle = () => {
      if (renderState.currentPath === "/settings") {
        return t("应用设置");
      }

      return t(getTopLevelRouteLabel(renderState.currentPath));
  };

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setIsCheckingUpdate(true);
    void fetchRuntimeVersionInfo()
      .then((result) => {
        if (!cancelled) {
          setRuntimeVersion(result);
        }
      })
      .catch(() => undefined);

    void appClient
      .checkUpdate()
      .then((result) => {
        if (!cancelled) {
          setUpdateSummary(result);
          if (result.hasUpdate) {
            toast.info(
              `${t("发现新版本")} ${result.latestVersion || result.releaseTag || t("可用")}`
            );
            setDidAnnounceUpdate(true);
          }
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("check update failed", error);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingUpdate(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!updateSummary?.hasUpdate || didAnnounceUpdate) {
      return;
    }
    toast.info(
      `${t("发现新版本")} ${updateSummary.latestVersion || updateSummary.releaseTag || t("可用")}`
    );
    setDidAnnounceUpdate(true);
  }, [didAnnounceUpdate, t, updateSummary]);

  const versionLabel = useMemo(() => {
    const currentVersion =
      updateSummary?.currentVersion ||
      runtimeVersion?.version ||
      (hasHydrated ? serviceStatus.version : "") ||
      "0.0.0";
    const latestVersion = updateSummary?.latestVersion || "";
    const hasUpdate =
      updateSummary?.hasUpdate ||
      (latestVersion && compareVersions(currentVersion, latestVersion) < 0);

    if (hasUpdate) {
      return `v${currentVersion} -> v${latestVersion}`;
    }

    return `v${currentVersion}`;
  }, [hasHydrated, runtimeVersion?.version, serviceStatus.version, updateSummary]);

  const serviceGatewayUrl = useMemo(() => {
    if (!hasHydrated || typeof window === "undefined") {
      return "http://localhost:48761/v1";
    }
    return `${window.location.origin}/v1`;
  }, [hasHydrated]);

  const handleCopyServiceUrl = () => {
    void copyTextToClipboard(serviceGatewayUrl)
      .then(() => {
        toast.success(t("服务地址已复制到剪贴板"));
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : String(error));
      });
  };

  const handleCheckUpdate = () => {
    setIsCheckingUpdate(true);
    void appClient
      .checkUpdate()
      .then((result) => {
        setUpdateSummary(result);
        if (result.hasUpdate) {
          setUpdateDialogOpen(true);
          toast.success(
            `${t("发现新版本")} ${result.latestVersion || result.releaseTag || t("可用")}`
          );
        } else {
          toast.success(
            result.reason
              ? `${t("已检查更新：")}${result.reason}`
              : `${t("当前已是最新版本")} ${result.currentVersion || ""}`.trim()
          );
        }
      })
      .catch((error) => {
        toast.error(`${t("检查更新失败")}: ${getAppErrorMessage(error)}`);
      })
      .finally(() => {
        setIsCheckingUpdate(false);
      });
  };

  const handleLogout = () => {
    if (typeof window === "undefined") {
      return;
    }
    window.location.assign("/__logout");
  };

  return (
    <header className="sticky top-0 z-30 grid h-16 grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] items-center gap-3 glass-header px-4 xl:px-6">
      <div className="flex min-w-0 items-center gap-3 overflow-hidden">
        <h1 className="truncate text-lg font-semibold">{getPageTitle()}</h1>
      </div>

      <div />

      <div className="ml-auto flex shrink-0 items-center gap-2 xl:gap-3">
        <div className="flex items-center gap-2 rounded-lg border bg-card/30 px-2.5 py-1.5 shadow-sm">
          <Badge
            variant={hasHydrated && serviceStatus.connected ? "default" : "secondary"}
            className="h-5"
          >
            {hasHydrated
              ? serviceStatus.connected
                ? t("服务已连接")
                : t("服务未连接")
              : t("连接检测中")}
          </Badge>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            className="text-xs font-mono text-muted-foreground transition-colors hover:text-foreground"
            onClick={handleCopyServiceUrl}
            title={t("点击复制服务地址")}
          >
            {serviceGatewayUrl}
          </button>
          <div className="h-4 w-px bg-border" />
          <button
            type="button"
            className="inline-flex h-6 items-center gap-1.5 px-0 text-xs text-muted-foreground transition-colors hover:text-foreground"
            onClick={handleCheckUpdate}
          >
            {isCheckingUpdate ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
            <span>{versionLabel}</span>
          </button>
          {updateSummary?.hasUpdate ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 rounded-full bg-amber-500/15 px-2 text-[10px] text-amber-700 hover:bg-amber-500/20"
              onClick={() => setUpdateDialogOpen(true)}
            >
              {t("可更新")}
            </Button>
          ) : null}
          <div className="h-4 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={openCodexCliGuide}
            title={t("重新打开 Codex CLI 引导")}
            aria-label={t("重新打开 Codex CLI 引导")}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t("退出登录")}
        </Button>
      </div>
      <AppUpdateDialog
        open={updateDialogOpen}
        summary={updateSummary}
        onOpenChange={setUpdateDialogOpen}
        onSummaryChange={setUpdateSummary}
      />
    </header>
  );
}
