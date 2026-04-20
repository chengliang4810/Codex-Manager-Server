import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import packageJson from "./package.json";
import {
  createDevProxyRewrites,
  normalizeDevServiceBaseUrl,
} from "./src/lib/dev-server-proxy";

export default function nextConfig(phase: string): NextConfig {
  const serviceBaseUrl = normalizeDevServiceBaseUrl(
    process.env.CODEXMANAGER_SERVICE_ADDR,
  );
  const rpcProxyBaseUrl = normalizeDevServiceBaseUrl(
    process.env.CODEXMANAGER_DEV_RPC_PROXY_ADDR || "127.0.0.1:48762",
  );

  return {
    // 暂时禁用 Beta 版编译器以确保稳定性
    reactCompiler: false,
    experimental: {
      staleTimes: {
        dynamic: 30,
        static: 300,
      },
    },
    env: {
      NEXT_PUBLIC_CODEXMANAGER_RELEASE_VERSION:
        process.env.CODEXMANAGER_RELEASE_VERSION || packageJson.version,
      NEXT_PUBLIC_CODEXMANAGER_RELEASE_TAG:
        process.env.CODEXMANAGER_RELEASE_TAG ||
        `v${process.env.CODEXMANAGER_RELEASE_VERSION || packageJson.version}`,
      NEXT_PUBLIC_CODEXMANAGER_RELEASE_REPOSITORY:
        process.env.CODEXMANAGER_RELEASE_REPOSITORY ||
        "chengliang4810/Codex-Manager-Server",
      NEXT_PUBLIC_CODEXMANAGER_RELEASE_BUILT_AT:
        process.env.CODEXMANAGER_RELEASE_BUILT_AT || "next-dev",
    },
    // 桌面开发态不展示右下角 Next 渲染指示器，避免用户误判为页面卡顿。
    devIndicators: false,
    // Tauri 开发态通过 127.0.0.1 加载 Next 资源，显式放行避免 dev 跨源告警。
    allowedDevOrigins: ["127.0.0.1", "[::1]"],
    async rewrites() {
      if (phase !== PHASE_DEVELOPMENT_SERVER) {
        return [];
      }
      return createDevProxyRewrites(serviceBaseUrl, rpcProxyBaseUrl);
    },
    output: "export",
    // 中文注释：导出静态站点时强制 trailing slash，生成 /xxx/index.html，避免 Tauri 打包后导航丢失。
    trailingSlash: true,
    images: {
      unoptimized: true,
    },
  };
}
