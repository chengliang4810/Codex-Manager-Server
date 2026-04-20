<p align="center">
  <img src="assets/logo/logo.png" alt="CodexManager Server Logo" width="220" />
</p>

<h1 align="center">CodexManager Server</h1>

<p align="center">服务端管理面板 + 网关转发，面向 Docker / Linux 部署。</p>

<p align="center">
  <a href="https://github.com/chengliang4810/Codex-Manager-Server">当前仓库</a> |
  <a href="https://github.com/qxcnm/Codex-Manager">上游原版仓库</a> |
  <a href="docs/zh-CN/report/运行与部署指南.md">运行与部署指南</a> |
  <a href="docs/zh-CN/report/环境变量与运行配置说明.md">环境变量与运行配置</a>
</p>

## 项目定位

这是基于上游 [`qxcnm/Codex-Manager`](https://github.com/qxcnm/Codex-Manager) fork 后持续二开的服务端版本，当前目标已经收敛为：

- 仅保留 `codexmanager-service` 与 `codexmanager-web`
- 不再提供 Tauri 桌面端安装包、托盘、自更新链路
- 以 Docker / Docker Compose 为主部署面
- `main` 分支每次推送自动生成新的 GitHub Release、GHCR 镜像和 Linux 二进制包

## 当前交付物

- `codexmanager-service`
  - OpenAI 兼容网关、管理 RPC、数据存储
- `codexmanager-web`
  - 浏览器管理界面
  - `/api/runtime` 与 `/api/rpc` 代理
- `codexmanager-start`
  - Linux 二进制便捷启动器
- GHCR 镜像
  - `ghcr.io/chengliang4810/codexmanager-service:vX.Y.Z`
  - `ghcr.io/chengliang4810/codexmanager-service:latest`
  - `ghcr.io/chengliang4810/codexmanager-web:vX.Y.Z`
  - `ghcr.io/chengliang4810/codexmanager-web:latest`

## 快速部署

### 方式 1：Docker Compose

直接在当前目录创建一个 `docker-compose.yml`，内容如下：

```yaml
services:
  codexmanager-service:
    image: ghcr.io/chengliang4810/codexmanager-service:latest
    restart: unless-stopped
    environment:
      CODEXMANAGER_WEB_ACCESS_PASSWORD: admin123 # 首次访问密码，部署后可在页面修改
    volumes:
      - ./data:/data # 持久化数据库和 RPC token 到当前目录 ./data

  codexmanager-web:
    image: ghcr.io/chengliang4810/codexmanager-web:latest
    restart: unless-stopped
    depends_on:
      codexmanager-service:
        condition: service_healthy
    volumes:
      - ./data:/data # 与 service 共用当前目录 ./data
    ports:
      - "48761:48761" # Web 管理页与对外 /v1 入口
```

启动命令：

```bash
mkdir -p ./data
docker compose up -d
```

### 方式 2：Docker 直接运行

```bash
# 在当前目录准备持久化目录
mkdir -p ./data

# 创建内部网络，供 web 通过容器服务名访问 service
docker network create codexmanager-net

# 启动 service
docker run -d \
  --name codexmanager-service \
  --network codexmanager-net \
  --network-alias codexmanager-service \
  -v "$(pwd)/data:/data" \  # 持久化数据库与 RPC token 到当前目录 ./data
  -e CODEXMANAGER_WEB_ACCESS_PASSWORD=admin123 \  # 首次访问密码
  ghcr.io/chengliang4810/codexmanager-service:latest

# 启动 web
docker run -d \
  --name codexmanager-web \
  --network codexmanager-net \
  -p 48761:48761 \  # 对外暴露 Web 管理页与 /v1 入口
  -v "$(pwd)/data:/data" \  # 与 service 共用当前目录 ./data
  ghcr.io/chengliang4810/codexmanager-web:latest
```

说明：

- 这两个镜像已经内置下面这些默认值，所以部署时不用再手动写：
  - `CODEXMANAGER_SERVICE_ADDR=0.0.0.0:48760`
  - `CODEXMANAGER_WEB_ADDR=0.0.0.0:48761`
  - `CODEXMANAGER_SERVICE_ADDR=codexmanager-service:48760`（web 镜像内默认）
  - `CODEXMANAGER_DB_PATH=/data/codexmanager.db`
  - `CODEXMANAGER_RPC_TOKEN_FILE=/data/codexmanager.rpc-token`
  - `CODEXMANAGER_WEB_NO_SPAWN_SERVICE=1`
  - `CODEXMANAGER_WEB_NO_OPEN=1`
- 真正建议用户显式配置的只有访问密码等个性化项
- 对外通常只需要暴露 `48761`
- `48760` 是内部 service 端口，默认留在容器网络内，由 `codexmanager-web` 反代 `/api/rpc`、`/v1/*`、`/health`、`/metrics`

浏览器访问：

- `http://localhost:48761/`
- `http://localhost:48761/v1/...`

## Linux 二进制部署

Release 会附带：

- `CodexManager-service-linux-x86_64.zip`
- `CodexManager-web-linux-x86_64.zip`
- `CodexManager-start-linux-x86_64.zip`

如果你不走 Docker，可以直接解压 Linux 包并启动：

```bash
# service
./codexmanager-service

# web
CODEXMANAGER_WEB_NO_SPAWN_SERVICE=1 \
CODEXMANAGER_SERVICE_ADDR=127.0.0.1:48760 \
./codexmanager-web
```

## 本地开发

如果只是本地开发，不需要依赖 Docker。

推荐把源码开发拆成 3 个进程：

1. `codexmanager-service`
2. `apps/scripts/dev-rpc-proxy.mjs`
3. `pnpm -C apps dev`

示例：

```bash
# 终端 1：启动 service
CODEXMANAGER_SERVICE_ADDR=127.0.0.1:48760 \
CODEXMANAGER_DB_PATH=./.tmp-dev/codexmanager.db \
CODEXMANAGER_RPC_TOKEN_FILE=./.tmp-dev/codexmanager.rpc-token \
CODEXMANAGER_WEB_ACCESS_PASSWORD=admin123 \
cargo run -p codexmanager-service

# 终端 2：启动开发态 RPC 代理
cd apps
CODEXMANAGER_SERVICE_ADDR=127.0.0.1:48760 \
CODEXMANAGER_RPC_TOKEN_FILE=../.tmp-dev/codexmanager.rpc-token \
pnpm run dev:rpc-proxy

# 终端 3：启动 Next 开发服务器
cd apps
CODEXMANAGER_SERVICE_ADDR=127.0.0.1:48760 \
pnpm dev
```

说明：

- 开发态 `next dev` 会通过 `rewrites` 把 `/api/rpc` 转发给本地 `dev-rpc-proxy`
- `dev-rpc-proxy` 会自动补 `x-codexmanager-rpc-token`
- `/v1/*`、`/health`、`/metrics` 会直接代理到本地 `codexmanager-service`
- 浏览器访问 `http://localhost:3000/`

## 版本与升级

- `main` 每次推送会自动生成新的 patch 版本 Release
- 镜像会同时推送精确版本标签和 `latest`
- 镜像内部会生成 `/app/version.json`
- Web 端设置页的“检查更新”会读取当前服务端版本并对比 GitHub Release，但不会在页面内执行容器自升级

升级推荐方式：

1. 在设置页检查新版本并打开 Release 页面
2. 选择新的 `vX.Y.Z`
3. 重新拉取镜像并重启容器

## 常用文档

- [运行与部署指南](docs/zh-CN/report/运行与部署指南.md)
- [环境变量与运行配置说明](docs/zh-CN/report/环境变量与运行配置说明.md)
- [构建发布与脚本说明](docs/zh-CN/release/构建发布与脚本说明.md)
- [发布与产物说明](docs/zh-CN/release/发布与产物说明.md)
- [CHANGELOG](docs/zh-CN/CHANGELOG.md)

## 免责声明

- 本项目仅用于学习与开发目的。
- 使用者必须遵守相关平台的服务条款。
- 作者不提供或分发任何账号、API Key 或代理服务。
- 请勿使用本项目绕过速率限制或服务限制。
