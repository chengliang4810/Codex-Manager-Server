"use client";

import type { LucideIcon } from "lucide-react";
import { Power, PowerOff, RefreshCw, Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import {
  formatTsFromSeconds,
  getExtraUsageDisplayRows,
  getUsageDisplayBuckets,
  isPrimaryWindowOnlyUsage,
  isSecondaryWindowOnlyUsage,
} from "@/lib/utils/usage";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Account } from "@/types";

export type StatusFilter = "all" | "available" | "low_quota" | "limited" | "banned";
export type AccountExportMode = "single" | "multiple";
export type AccountSizeSortMode = "large-first" | "small-first";
export type AccountsOverviewViewMode = "compact" | "list" | "grid";

const ACCOUNT_SORT_STEP = 5;
export const ACCOUNTS_OVERVIEW_VIEW_MODE_KEY =
  "codexmanager.accounts.overview-view-mode.v2";

export type TranslateFn = (
  key: string,
  values?: Record<string, string | number>,
) => string;

export function normalizeAccountsOverviewViewMode(
  value: string | null | undefined,
): AccountsOverviewViewMode | null {
  if (value === "compact" || value === "list" || value === "grid") {
    return value;
  }
  return null;
}

export function readInitialAccountsOverviewViewMode(): AccountsOverviewViewMode {
  if (typeof window === "undefined") {
    return "grid";
  }
  try {
    return (
      normalizeAccountsOverviewViewMode(
        window.localStorage.getItem(ACCOUNTS_OVERVIEW_VIEW_MODE_KEY),
      ) || "grid"
    );
  } catch {
    return "grid";
  }
}

export function formatAccountPlanValueLabel(value: string, t: TranslateFn) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  switch (normalized) {
    case "free":
      return "FREE";
    case "go":
      return "GO";
    case "plus":
      return "PLUS";
    case "pro":
      return "PRO";
    case "team":
      return "TEAM";
    case "business":
      return "BUSINESS";
    case "enterprise":
      return "ENTERPRISE";
    case "edu":
      return "EDU";
    case "unknown":
      return t("未知");
    default:
      return normalized ? normalized.toUpperCase() : t("未知");
  }
}

export function normalizeAccountPlanKey(account: Account) {
  return (
    String(account.planType || "")
      .trim()
      .toLowerCase() || "unknown"
  );
}

export function formatPlanFilterLabel(value: string, t: TranslateFn) {
  const nextValue = String(value || "").trim();
  if (!nextValue || nextValue === "all") {
    return t("全部类型");
  }
  return formatAccountPlanValueLabel(nextValue, t);
}

export function formatStatusFilterLabel(value: string, t: TranslateFn) {
  const nextValue = String(value || "").trim();
  switch (nextValue) {
    case "available":
      return t("可用");
    case "low_quota":
      return t("低配额");
    case "limited":
      return t("限流");
    case "banned":
      return t("封禁");
    case "all":
    default:
      return t("全部");
  }
}

export interface QuotaProgressProps {
  label: string;
  remainPercent: number | null;
  resetsAt: number | null;
  icon: LucideIcon;
  tone: "green" | "blue" | "amber";
  caption?: string;
  emptyText?: string;
  emptyResetText?: string;
}

export interface QuotaSummaryItem extends QuotaProgressProps {
  id: string;
}

export interface AccountEditorState {
  accountId: string;
  accountName: string;
  currentLabel: string;
  currentTags: string;
  currentNote: string;
  currentSort: number;
}

export type DeleteDialogState =
  | { kind: "single"; account: Account }
  | { kind: "selected"; ids: string[]; count: number }
  | null;

export interface AccountPresentation {
  id: string;
  displayName: string;
  identityText: string;
  planLabel: string | null;
  planClassName: string;
  statusText: string;
  subscriptionStatusText: string;
  subscriptionPlanText: string;
  subscriptionExpiryText: string;
  noteText: string;
  tags: string[];
  quotaItems: QuotaSummaryItem[];
}

export interface AccountCompactQuotaItem {
  key: string;
  label: string;
  valueText: string;
  quotaClassName: string;
  dotClassName: string;
}

export function buildAccountPresentation(
  account: Account,
  t: TranslateFn,
): AccountPresentation {
  const displayName =
    String(account.label || "").trim() ||
    String(account.name || "").trim() ||
    String(account.id || "").trim() ||
    t("未知");
  const rawIdentity =
    String(account.name || "").trim() && String(account.name || "").trim() !== displayName
      ? String(account.name || "").trim()
      : String(account.id || "").trim();
  const planLabel = formatAccountPlanLabel(account, t);
  const noteText = String(account.note || "").trim();

  return {
    id: account.id,
    displayName,
    identityText: rawIdentity || t("未知"),
    planLabel,
    planClassName: getAccountPlanBadgeClassName(planLabel),
    statusText: t(account.availabilityText || "未知"),
    subscriptionStatusText: formatAccountSubscriptionStatusLabel(account, t),
    subscriptionPlanText: formatAccountSubscriptionPlanLabel(account, t),
    subscriptionExpiryText:
      account.subscriptionExpiresAt != null
        ? formatTsFromSeconds(account.subscriptionExpiresAt, t("未知"))
        : account.hasSubscription === false
          ? t("未订阅")
          : t("未知"),
    noteText,
    tags: account.tags,
    quotaItems: buildQuotaSummaryItems(account, t),
  };
}

function resolveQuotaSeverity(
  remainPercent: number | null,
): "high" | "medium" | "low" | "critical" | "unknown" {
  if (remainPercent == null || !Number.isFinite(remainPercent)) {
    return "unknown";
  }
  if (remainPercent >= 80) return "high";
  if (remainPercent >= 40) return "medium";
  if (remainPercent >= 10) return "low";
  return "critical";
}

function getCompactQuotaClassName(item: QuotaSummaryItem): string {
  switch (resolveQuotaSeverity(item.remainPercent)) {
    case "high":
      return "text-green-600 dark:text-green-400";
    case "medium":
      return "text-amber-600 dark:text-amber-400";
    case "low":
      return "text-orange-600 dark:text-orange-400";
    case "critical":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function getCompactQuotaDotClassName(item: QuotaSummaryItem): string {
  switch (item.tone) {
    case "green":
      return "bg-green-500";
    case "blue":
      return "bg-blue-500";
    case "amber":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground";
  }
}

function compactQuotaLabel(label: string): string {
  const normalized = String(label || "").trim();
  if (normalized === "5小时") return "5h";
  if (normalized === "7天") return "7d";
  return normalized;
}

export function buildAccountCompactQuotaItems(
  presentation: AccountPresentation,
): AccountCompactQuotaItem[] {
  return presentation.quotaItems.slice(0, 2).map((item) => ({
    key: item.id,
    label: compactQuotaLabel(item.label),
    valueText:
      item.remainPercent == null
        ? item.emptyText || "--"
        : `${item.remainPercent}%`,
    quotaClassName: getCompactQuotaClassName(item),
    dotClassName: getCompactQuotaDotClassName(item),
  }));
}

function QuotaProgress({
  label,
  remainPercent,
  resetsAt,
  icon: Icon,
  tone,
  caption,
  emptyText = "--",
  emptyResetText = "未知",
}: QuotaProgressProps) {
  const { t } = useI18n();
  const value = remainPercent ?? 0;
  const toneClasses = {
    blue: {
      track: "bg-blue-500/20",
      indicator: "bg-blue-500",
      icon: "text-blue-500",
    },
    green: {
      track: "bg-green-500/20",
      indicator: "bg-green-500",
      icon: "text-green-500",
    },
    amber: {
      track: "bg-amber-500/20",
      indicator: "bg-amber-500",
      icon: "text-amber-500",
    },
  } as const;
  const palette = toneClasses[tone];

  return (
    <div className="flex min-w-[180px] flex-col gap-1.5">
      <div className="flex items-center justify-between text-[10px]">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Icon className={cn("h-3 w-3", palette.icon)} />
            <span>{label}</span>
          </div>
          {caption ? (
            <div className="truncate text-[9px] text-muted-foreground/80">
              {caption}
            </div>
          ) : null}
        </div>
        <span className="font-medium">
          {remainPercent == null ? emptyText : `${value}%`}
        </span>
      </div>
      <Progress
        value={value}
        trackClassName={palette.track}
        indicatorClassName={palette.indicator}
      />
      <div className="text-[10px] text-muted-foreground">
        {t("重置")}: {formatTsFromSeconds(resetsAt, emptyResetText)}
      </div>
    </div>
  );
}

export function QuotaOverviewCell({ items }: { items: QuotaSummaryItem[] }) {
  const { t } = useI18n();
  const summaryItems = items.slice(0, 2);
  const toneClasses = {
    blue: {
      icon: "text-blue-500",
      track: "bg-blue-500/20",
      indicator: "bg-blue-500",
    },
    green: {
      icon: "text-green-500",
      track: "bg-green-500/20",
      indicator: "bg-green-500",
    },
    amber: {
      icon: "text-amber-500",
      track: "bg-amber-500/20",
      indicator: "bg-amber-500",
    },
  } as const;

  return (
    <Tooltip>
      <TooltipTrigger render={<div />} className="block cursor-help">
        <div className="grid gap-2">
          {summaryItems.map((item) => {
            const palette = toneClasses[item.tone];
            return (
              <div
                key={item.id}
                className="rounded-xl border border-border/50 bg-background/35 p-3"
              >
                <div className="mb-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <item.icon className={cn("h-3.5 w-3.5", palette.icon)} />
                    <span>{item.label}额度</span>
                  </div>
                  <span className="font-semibold">
                    {item.remainPercent == null
                      ? item.emptyText || "--"
                      : `${item.remainPercent}%`}
                  </span>
                </div>
                <Progress
                  value={item.remainPercent ?? 0}
                  trackClassName={palette.track}
                  indicatorClassName={palette.indicator}
                />
                <div className="mt-2 text-[10px] text-muted-foreground">
                  {t("重置")}:{" "}
                  {formatTsFromSeconds(
                    item.resetsAt,
                    item.emptyResetText ?? t("未知"),
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        sideOffset={10}
        className="max-w-[340px] rounded-2xl bg-background p-3 text-foreground shadow-2xl"
      >
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {t("额度详情（悬停查看所有额度）")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("标准额度与专属额度统一在这里查看。")}
            </p>
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <QuotaProgress
                key={item.id}
                label={item.label}
                remainPercent={item.remainPercent}
                resetsAt={item.resetsAt}
                icon={item.icon}
                tone={item.tone}
                caption={item.caption}
                emptyText={item.emptyText}
                emptyResetText={item.emptyResetText}
              />
            ))}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function getAccountStatusAction(
  account: Account,
  t: TranslateFn,
): {
  action: "enable" | "disable" | null;
  label: string;
  icon: LucideIcon;
} {
  const normalizedStatus = String(account.status || "")
    .trim()
    .toLowerCase();
  if (normalizedStatus === "disabled") {
    return { action: "enable", label: t("启用账号"), icon: Power };
  }
  if (normalizedStatus === "inactive") {
    return { action: "enable", label: t("恢复账号"), icon: Power };
  }
  if (normalizedStatus === "banned") {
    return { action: null, label: t("封禁账号"), icon: PowerOff };
  }
  return { action: "disable", label: t("禁用账号"), icon: PowerOff };
}

export function formatAccountPlanLabel(
  account: Account,
  t: TranslateFn,
): string | null {
  const normalized = normalizeAccountPlanKey(account);
  return normalized === "unknown"
    ? null
    : formatAccountPlanValueLabel(normalized, t);
}

export function formatAccountSubscriptionPlanLabel(
  account: Account,
  t: TranslateFn,
): string {
  const normalized = String(account.subscriptionPlan || account.planType || "")
    .trim()
    .toLowerCase();
  return normalized
    ? formatAccountPlanValueLabel(normalized, t)
    : t("未知");
}

export function formatAccountSubscriptionStatusLabel(
  account: Account,
  t: TranslateFn,
): string {
  const hasSubscriptionEvidence =
    Boolean(String(account.subscriptionPlan || "").trim()) ||
    account.subscriptionExpiresAt != null ||
    account.subscriptionRenewsAt != null;

  if (account.hasSubscription === true || (account.hasSubscription == null && hasSubscriptionEvidence)) {
    return t("已订阅");
  }
  if (account.hasSubscription === false) {
    return t("未订阅");
  }
  return t("未知");
}

export function getAccountPlanBadgeClassName(planLabel: string | null): string {
  switch (planLabel) {
    case "FREE":
      return "bg-slate-500/10 text-slate-700 dark:text-slate-300";
    case "GO":
      return "bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "PLUS":
      return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "PRO":
      return "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300";
    case "TEAM":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "BUSINESS":
      return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300";
    case "ENTERPRISE":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300";
    case "EDU":
      return "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
    default:
      return "bg-accent/50";
  }
}

export function formatAccountTags(tags: string[]): string {
  return tags
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .join("、");
}

export function normalizeTagsDraft(tagsDraft: string): string[] {
  return tagsDraft
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function buildAccountOrderUpdates(orderedAccounts: Account[]) {
  return orderedAccounts.reduce<Array<{ accountId: string; sort: number }>>(
    (updates, account, index) => {
      const nextSort = index * ACCOUNT_SORT_STEP;
      const currentSort = Number.isFinite(account.priority)
        ? account.priority
        : Number(account.sort) || 0;
      if (currentSort !== nextSort) {
        updates.push({ accountId: account.id, sort: nextSort });
      }
      return updates;
    },
    [],
  );
}

export function getAccountSizeGroup(
  account: Account,
): "large" | "standard" | "small" {
  switch (normalizeAccountPlanKey(account)) {
    case "plus":
    case "pro":
    case "team":
    case "business":
    case "enterprise":
      return "large";
    case "free":
      return "small";
    default:
      return "standard";
  }
}

export function buildAccountsBySizeOrder(
  orderedAccounts: Account[],
  mode: AccountSizeSortMode,
) {
  const buckets = {
    large: [] as Account[],
    standard: [] as Account[],
    small: [] as Account[],
  };

  for (const account of orderedAccounts) {
    buckets[getAccountSizeGroup(account)].push(account);
  }

  return mode === "large-first"
    ? [...buckets.large, ...buckets.standard, ...buckets.small]
    : [...buckets.small, ...buckets.standard, ...buckets.large];
}

export function formatAccountExportModeLabel(value: string, t: TranslateFn) {
  return value === "single" ? t("单 JSON") : t("多 JSON");
}

export function buildQuotaSummaryItems(
  account: Account,
  t: TranslateFn,
): QuotaSummaryItem[] {
  const primaryWindowOnly = isPrimaryWindowOnlyUsage(account.usage);
  const secondaryWindowOnly = isSecondaryWindowOnlyUsage(account.usage);
  const usageBuckets = getUsageDisplayBuckets(account.usage);
  const extraUsageRows = getExtraUsageDisplayRows(account.usage);
  return [
    {
      id: `${account.id}-primary`,
      label: t("5小时"),
      remainPercent: account.primaryRemainPercent,
      resetsAt: usageBuckets.primaryResetsAt,
      icon: RefreshCw,
      tone: "green",
      caption: t("标准模型窗口"),
      emptyText: secondaryWindowOnly ? t("未提供") : "--",
      emptyResetText: secondaryWindowOnly ? t("未提供") : t("未知"),
    },
    {
      id: `${account.id}-secondary`,
      label: t("7天"),
      remainPercent: account.secondaryRemainPercent,
      resetsAt: usageBuckets.secondaryResetsAt,
      icon: RefreshCw,
      tone: "blue",
      caption: t("长周期窗口"),
      emptyText: primaryWindowOnly ? t("未提供") : "--",
      emptyResetText: primaryWindowOnly ? t("未提供") : t("未知"),
    },
    ...extraUsageRows.map((item) => ({
      id: item.id,
      label: `${t(item.label, item.labelValues)}${item.labelSuffix ? t(item.labelSuffix) : ""}`,
      remainPercent: item.remainPercent,
      resetsAt: item.resetsAt,
      icon: Zap,
      tone: "amber" as const,
      caption: t(item.windowLabel, item.windowLabelValues),
      emptyText: "--",
      emptyResetText: t("未知"),
    })),
  ];
}

export function AccountInfoCell({
  account,
  isPreferred,
}: {
  account: Account;
  isPreferred: boolean;
}) {
  const { t } = useI18n();
  const presentation = buildAccountPresentation(account, t);
  const tagsText = formatAccountTags(presentation.tags);
  const showInlineIdentity = presentation.identityText !== account.id;

  return (
    <Tooltip>
      <TooltipTrigger render={<div />} className="block cursor-help text-left">
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="truncate text-sm font-semibold">
              {presentation.displayName}
            </span>
            {presentation.planLabel ? (
              <Badge
                variant="secondary"
                className={cn(
                  "h-4 shrink-0 px-1.5 text-[9px]",
                  presentation.planClassName,
                )}
              >
                {presentation.planLabel}
              </Badge>
            ) : null}
            {isPreferred ? (
              <Badge
                variant="secondary"
                className="h-4 shrink-0 bg-amber-500/15 px-1.5 text-[9px] text-amber-700 dark:text-amber-300"
              >
                {t("优先")}
              </Badge>
            ) : null}
          </div>
          {showInlineIdentity ? (
            <span className="truncate font-mono text-[10px] uppercase text-muted-foreground opacity-60">
              {presentation.identityText}
            </span>
          ) : null}
          <span className="mt-1 text-[10px] text-muted-foreground">
            {t("最近刷新")}:{" "}
            {formatTsFromSeconds(account.lastRefreshAt, t("从未刷新"))}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {t("订阅到期")}: {presentation.subscriptionExpiryText}
          </span>
          {presentation.tags.length > 0 ? (
            <span className="truncate text-[10px] text-muted-foreground">
              {t("标签")}: {tagsText}
            </span>
          ) : null}
          {presentation.noteText ? (
            <span className="truncate text-[10px] text-muted-foreground">
              {presentation.noteText}
            </span>
          ) : null}
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <div className="flex min-w-[260px] flex-col gap-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-0.5">
              <div className="text-[10px] text-background/70">
                {t("账号类型")}
              </div>
              <div className="font-medium">{presentation.planLabel || t("未知")}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-background/70">
                {t("当前状态")}
              </div>
              <div className="font-medium">{presentation.statusText}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-background/70">
                {t("订阅状态")}
              </div>
              <div className="font-medium">{presentation.subscriptionStatusText}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-background/70">
                {t("订阅方案")}
              </div>
              <div className="font-medium">{presentation.subscriptionPlanText}</div>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-0.5">
              <div className="text-[10px] text-background/70">
                {t("到期时间")}
              </div>
              <div className="font-medium">
                {presentation.subscriptionExpiryText}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-background/70">
                {t("续费时间")}
              </div>
              <div className="font-medium">
                {formatTsFromSeconds(account.subscriptionRenewsAt, t("未知"))}
              </div>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-background/70">{t("标签")}</div>
            <div className="break-words">{tagsText || t("未设置")}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-background/70">{t("备注")}</div>
            <div className="whitespace-pre-wrap break-words">
              {presentation.noteText || t("未设置")}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[10px] text-background/70">{t("账号 ID")}</div>
            <div className="break-all font-mono text-[11px]">{account.id}</div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
