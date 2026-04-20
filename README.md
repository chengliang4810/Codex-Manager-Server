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
- 以 Docker / Docker Compose 为主部署面，默认推荐单容器镜像
- `main` 分支每次推送自动生成新的 GitHub Release、GHCR 镜像和 Linux 二进制包

## 当前交付物

- `codexmanager`
  - 推荐部署镜像
  - 单容器内同时包含 `codexmanager-web` 与 `codexmanager-service`
  - 适合 Docker 场景下的页面内在线升级
- `codexmanager-service`
  - OpenAI 兼容网关、管理 RPC、数据存储
  - 保留为兼容性的拆分部署镜像
- `codexmanager-web`
  - 浏览器管理界面
  - `/api/runtime` 与 `/api/rpc` 代理
  - 保留为兼容性的拆分部署镜像
- `codexmanager-start`
  - Linux 二进制便捷启动器
- GHCR 镜像
  - `ghcr.io/chengliang4810/codexmanager:vX.Y.Z`
  - `ghcr.io/chengliang4810/codexmanager:latest`
  - `ghcr.io/chengliang4810/codexmanager-service:vX.Y.Z`
  - `ghcr.io/chengliang4810/codexmanager-service:latest`
  - `ghcr.io/chengliang4810/codexmanager-web:vX.Y.Z`
  - `ghcr.io/chengliang4810/codexmanager-web:latest`

## 快速部署

### 方式 1：Docker Compose（推荐，单容器）

直接在当前目录创建一个 `docker-compose.yml`，内容如下：

```yaml
services:
  codexmanager:
    image: ghcr.io/chengliang4810/codexmanager:latest
    restart: unless-stopped
    environment:
      CODEXMANAGER_WEB_ACCESS_PASSWORD: admin123 # 首次访问密码，部署后可在页面修改
    volumes:
      - ./data:/data # 持久化数据库和 RPC token 到当前目录 ./data
    ports:
      - "48761:48761" # Web 管理页与对外 /v1 入口
```

启动命令：

```bash
mkdir -p ./data
docker compose up -d
```

说明：

- 单容器镜像内部会以 `codexmanager-web` 作为主进程，并自动拉起同镜像内的 `codexmanager-service`
- 对外通常只需要暴露 `48761`
- `./data` 会持久化数据库、RPC token 等运行数据
- 如果要使用页面内在线升级，请保留 `restart: unless-stopped`

### 方式 2：Docker 直接运行（推荐，单容器）

```bash
mkdir -p ./data

docker run -d \
  --name codexmanager \
  --restart unless-stopped \
  -p 48761:48761 \
  -v "$(pwd)/data:/data" \
  -e CODEXMANAGER_WEB_ACCESS_PASSWORD=admin123 \
  ghcr.io/chengliang4810/codexmanager:latest
```

### 方式 3：双容器兼容部署（可选）

如果你明确需要拆分 `service` / `web` 两个容器，仍然可以继续使用下面两类镜像：

- `ghcr.io/chengliang4810/codexmanager-service:latest`
- `ghcr.io/chengliang4810/codexmanager-web:latest`

这套模式仍然可用，但默认不再作为首选部署方式。详细示例见：

- [运行与部署指南](docs/zh-CN/report/运行与部署指南.md)

### Docker 默认值说明

- 单容器 `codexmanager` 镜像已经内置下面这些默认值，所以部署时通常不用再手动写：
  - `CODEXMANAGER_SERVICE_ADDR=0.0.0.0:48760`
  - `CODEXMANAGER_WEB_ADDR=0.0.0.0:48761`
  - `CODEXMANAGER_DB_PATH=/data/codexmanager.db`
  - `CODEXMANAGER_RPC_TOKEN_FILE=/data/codexmanager.rpc-token`
  - `CODEXMANAGER_WEB_NO_OPEN=1`
- 双容器 `codexmanager-web` 镜像额外内置：
  - `CODEXMANAGER_WEB_NO_SPAWN_SERVICE=1`
  - `CODEXMANAGER_SERVICE_ADDR=codexmanager-service:48760`
- 真正建议用户显式配置的通常只有访问密码等个性化项
- 如果使用 `./data:/data` 目录映射，镜像启动时会自动修正 `/data` 目录权限，然后再降权到应用用户运行，一般不需要再手动 `chown ./data`

浏览器访问：

- `http://localhost:48761/`
- `http://localhost:48761/v1/...`

## Linux 二进制部署

Release 会附带：

- `CodexManager-service-linux-x86_64.zip`
- `CodexManager-web-linux-x86_64.zip`
- `CodexManager-start-linux-x86_64.zip`
- `checksums.txt`

如果你不走 Docker，推荐把 `codexmanager-service` 与 `codexmanager-web` 放在同一目录，并直接启动 `codexmanager-web`：

```bash
# web 会自动拉起同目录下的 service
CODEXMANAGER_WEB_ACCESS_PASSWORD=admin123 \
./codexmanager-web
```

如果你需要手动拆开两个进程，也可以继续按 `service -> web` 的方式分别启动。

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
- Release 会同时发布单容器镜像和双容器兼容镜像
- 镜像内部会生成 `/app/version.json`
- 单容器 `codexmanager` 镜像和同目录双二进制部署，支持页面内在线升级

升级说明：

1. 设置页或顶部版本入口检查到新版本后，可直接点击“立即更新”
2. 系统会下载 Release 中的 `CodexManager-service-linux-x86_64.zip` 与 `CodexManager-web-linux-x86_64.zip`
3. 通过 `checksums.txt` 校验后，原地替换当前运行二进制
4. `codexmanager-web` 会主动退出主进程，并依赖 Docker `restart` 策略或进程守护重新拉起

补充：

- 如果你使用的是单容器 `codexmanager` 镜像，请保留 `restart: unless-stopped`
- 如果你使用的是双容器 `codexmanager-service` + `codexmanager-web`，当前仍建议手动拉取新镜像并重启容器

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
