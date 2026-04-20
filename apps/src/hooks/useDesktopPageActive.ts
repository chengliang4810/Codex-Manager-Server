"use client";

import { usePathname } from "next/navigation";
import { normalizeRoutePath } from "@/lib/utils/static-routes";
import { useAppStore } from "@/lib/store/useAppStore";
import { resolveRenderableShellState } from "@/lib/app-shell/render-state";

/**
 * 函数 `useDesktopPageActive`
 *
 * 作者: gaohongshun
 *
 * 时间: 2026-04-02
 *
 * # 参数
 * - expectedPath: 参数 expectedPath
 *
 * # 返回
 * 返回函数执行结果
 */
export function useDesktopPageActive(expectedPath: string): boolean {
  const pathname = usePathname();
  const currentShellPath = useAppStore((state) => state.currentShellPath);
  const resolved = resolveRenderableShellState(
    currentShellPath,
    [currentShellPath],
    pathname,
  );
  return resolved.currentPath === normalizeRoutePath(expectedPath);
}
