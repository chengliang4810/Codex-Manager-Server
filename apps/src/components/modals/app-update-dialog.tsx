"use client";

import { useState } from "react";
import { Download, ExternalLink, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { appClient } from "@/lib/api/app-client";
import type { UpdateCheckResult } from "@/lib/api/app-updates";
import { getAppErrorMessage } from "@/lib/api/transport";
import { useI18n } from "@/lib/i18n/provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildReleaseUrl } from "@/app/settings/settings-page-helpers";

type AppUpdateDialogProps = {
  open: boolean;
  summary: UpdateCheckResult | null;
  onOpenChange: (open: boolean) => void;
  onSummaryChange?: (summary: UpdateCheckResult | null) => void;
};

export function AppUpdateDialog({
  open,
  summary,
  onOpenChange,
  onSummaryChange,
}: AppUpdateDialogProps) {
  const { t } = useI18n();
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);
  const [isRollingBackUpdate, setIsRollingBackUpdate] = useState(false);
  const [isRestartingRuntime, setIsRestartingRuntime] = useState(false);

  const handleOpenReleasePage = () => {
    void appClient
      .openInBrowser(buildReleaseUrl(summary))
      .catch((error) => {
        toast.error(`${t("打开发布页失败")}: ${getAppErrorMessage(error)}`);
      });
  };

  const handleApplyUpdate = () => {
    setIsApplyingUpdate(true);
    void appClient
      .performUpdate()
      .then((result) => {
        toast.success(result.message || t("更新包已应用"));
        if (summary && onSummaryChange) {
          onSummaryChange({
            ...summary,
            canRollback: true,
          });
        }
        if (result.needRestart) {
          setIsRestartingRuntime(true);
          return appClient.restartService().then(() => {
            toast.info(t("正在重启服务，请稍候刷新页面"));
          });
        }
        return undefined;
      })
      .catch((error) => {
        toast.error(`${t("应用更新失败")}: ${getAppErrorMessage(error)}`);
      })
      .finally(() => {
        setIsApplyingUpdate(false);
        setIsRestartingRuntime(false);
      });
  };

  const handleRollbackUpdate = () => {
    setIsRollingBackUpdate(true);
    void appClient
      .rollbackUpdate()
      .then((result) => {
        toast.success(result.message || t("已恢复上一版本"));
        if (result.needRestart) {
          setIsRestartingRuntime(true);
          return appClient.restartService().then(() => {
            toast.info(t("正在重启服务，请稍候刷新页面"));
          });
        }
        return undefined;
      })
      .catch((error) => {
        toast.error(`${t("回滚失败")}: ${getAppErrorMessage(error)}`);
      })
      .finally(() => {
        setIsRollingBackUpdate(false);
        setIsRestartingRuntime(false);
      });
  };

  return (
    <Dialog
      open={open && Boolean(summary)}
      onOpenChange={(open) => {
        onOpenChange(open);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="glass-card border-none p-6 sm:max-w-[480px]"
      >
          <DialogHeader>
          <DialogTitle>{t("发现新版本")}</DialogTitle>
          <DialogDescription>
            {`${t("当前版本")} ${summary?.currentVersion || t("未知")}，${t("发现新版本")} ${
              summary?.latestVersion ||
              summary?.releaseTag ||
              t("可用")
            }。`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-2xl border border-border/50 bg-background/45 p-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t("当前版本")}</span>
              <span className="font-medium">
                {summary?.currentVersion || t("未知")}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t("目标版本")}</span>
              <span className="font-medium">
                {summary?.latestVersion ||
                  summary?.releaseTag ||
                  t("未知")}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">{t("推荐方式")}</span>
              <span className="font-medium">
                {summary?.canPrepare
                  ? t("在线升级")
                  : t("手动升级")}
              </span>
            </div>
          </div>

          {summary?.canPrepare ? (
            <div className="rounded-2xl border border-border/50 bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
              {t("当前运行形态支持在线升级。系统会下载最新 Release 里的 Linux 二进制，替换当前程序并在成功后触发重启。")}
            </div>
          ) : summary?.reason ? (
            <div className="rounded-2xl border border-border/50 bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
              {summary.reason}
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-muted/40 p-4 text-xs leading-5 text-muted-foreground">
              {t("Web / Docker 版不会在页面内执行自更新。请打开发布页，按照最新 Release 中的 Docker 或 Linux 包方式完成升级。")}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("稍后")}
          </Button>
          {summary?.canRollback ? (
            <Button
              variant="outline"
              className="gap-2"
              disabled={
                isRollingBackUpdate || isApplyingUpdate || isRestartingRuntime
              }
              onClick={handleRollbackUpdate}
            >
              <RotateCcw className="h-4 w-4" />
              {isRollingBackUpdate ? t("回滚中...") : t("回滚")}
            </Button>
          ) : null}
          {summary?.canPrepare ? (
            <Button
              className="gap-2"
              disabled={
                isApplyingUpdate || isRollingBackUpdate || isRestartingRuntime
              }
              onClick={handleApplyUpdate}
            >
              <Download className="h-4 w-4" />
              {isApplyingUpdate
                ? t("应用更新中...")
                : isRestartingRuntime
                  ? t("正在重启...")
                  : t("立即更新")}
            </Button>
          ) : (
            <Button className="gap-2" onClick={handleOpenReleasePage}>
              <ExternalLink className="h-4 w-4" />
              {t("打开发布页")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
