# apps 前端说明

`apps/` 现在只承载 CodexManager Server 的 Web 管理界面。

## 技术栈

- Next.js App Router
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- TanStack Query
- Zustand

## 目录结构

```text
apps/
├─ src/                # Web UI、页面、hooks、API client、store
├─ public/             # 静态资源
├─ tests/              # Node / Playwright 测试
└─ out/                # 静态导出产物
```

## 常用命令

```bash
pnpm install
pnpm dev
pnpm run build
pnpm exec playwright test
```

说明：

- `pnpm dev`：启动前端开发服务器
- `pnpm run build`：构建静态产物，供 `codexmanager-web` 嵌入或挂载
- `pnpm exec playwright test`：运行端到端回归

## 运行方式

- 生产环境推荐通过 `codexmanager-web` 提供页面
- 反向代理必须同时转发：
  - `/api/runtime`
  - `/api/rpc`
- 单独托管静态文件不足以支撑管理页面

## 当前前端约束

- 所有管理操作统一走 `/api/rpc`
- 浏览器模式保留文件导入、浏览器导出能力
- 不再提供桌面端托盘、桌面端自更新、本地目录打开等能力

## 相关文档

- [根项目说明](../README.md)
- [运行与部署指南](../docs/zh-CN/report/运行与部署指南.md)
- [环境变量与运行配置说明](../docs/zh-CN/report/环境变量与运行配置说明.md)
