"use client";

import { useMemo } from "react";
import {
  resolveRuntimeCapabilityView,
  type RuntimeCapabilityView,
} from "@/lib/runtime/runtime-capabilities";
import { useAppStore } from "@/lib/store/useAppStore";

/**
 * 函数 `useRuntimeCapabilities`
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
export function useRuntimeCapabilities(): RuntimeCapabilityView {
  const runtimeCapabilities = useAppStore((state) => state.runtimeCapabilities);

  return useMemo(() => {
    return resolveRuntimeCapabilityView(runtimeCapabilities, false);
  }, [runtimeCapabilities]);
}
