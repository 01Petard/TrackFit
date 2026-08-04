# TrackFit

TrackFit 是一个使用 Nuxt 4、Vue 3 和 TypeScript 构建的个人身体指标记录工具。业务计算主要在浏览器完成，Nitro 服务端负责登录、角色权限以及 JSON 数据持久化。本地和 Docker 使用数据文件，Vercel 使用 Private Blob，不依赖数据库。

当前支持身体测量、训练与睡眠记录、趋势和均线、行为相关性、周/月报告、记录热力图以及 JSON/CSV 备份导出。相关性分析至少需要 14 个有效重叠日，仅用于观察趋势，不作为医疗诊断。

## 准备工作

1. 复制`.env.example`，并修改为`.env`。

2. 使用下列命令生成管理员密码哈希：

```bash
pnpm auth:hash '<your-password>'
```

3. 使用下列命令生成`NUXT_SESSION_PASSWORD`：

```shell
openssl rand -base64 48
```

`NUXT_SESSION_PASSWORD` 必须是至少 32 位的随机字符串。管理员可以增删改、恢复和导出数据；访客只能查看页面。如需在登录页公开提示只读账号，另行配置 `TRACKFIT_VIEWER_DISPLAY_USERNAME` 和 `TRACKFIT_VIEWER_DISPLAY_PASSWORD`；这两项仅用于展示，不参与认证，任一为空时不展示。

4. 复制`data/trackfit-data.json.example`，并修改为`data/trackfit-data.json`。

## 本地运行

要求：Node.js 22+、pnpm 11。

```bash
pnpm install
pnpm dev
```

本机浏览器访问 `http://127.0.0.1:3000`。开发服务监听所有网卡，局域网设备可通过 `http://<部署机器的局域网 IP>:3000` 访问。

默认数据文件为 `data/trackfit-data.json`，首次访问时自动创建。可通过环境变量指定其他位置：

```dotenv
TRACKFIT_DATA_FILE=/absolute/path/trackfit-data.json
```

## Docker Compose 部署

```bash
docker compose up -d --build
```

Compose 只启动 TrackFit 应用，宿主机 `./data` 挂载为容器 `/app/data`。账号和会话环境变量必须先在 `.env` 配置完整。默认监听所有网卡：

```dotenv
TRACKFIT_BIND_ADDRESS=0.0.0.0
TRACKFIT_PORT=3000
```

如需恢复为仅本机访问，将 `TRACKFIT_BIND_ADDRESS` 改为 `127.0.0.1`。如映射到公网，还应在反向代理配置 HTTPS 和登录接口限流。

## Vercel 部署

1. 在 Vercel Marketplace 为项目创建 Private Blob Store
2. 只在 Production 环境配置正式 Blob，Preview 使用独立 Blob 或不配置写入凭证
3. 配置以下环境变量：

```dotenv
TRACKFIT_STORAGE=blob
TRACKFIT_BLOB_PATH=trackfit/trackfit-data.json
BLOB_READ_WRITE_TOKEN=<created-by-vercel>
NUXT_SESSION_PASSWORD=<at-least-32-random-characters>
TRACKFIT_ADMIN_USERNAME=<admin-username>
TRACKFIT_ADMIN_PASSWORD_HASH=<scrypt-hash>
TRACKFIT_VIEWER_USERNAME=<viewer-username>
TRACKFIT_VIEWER_PASSWORD_HASH=<scrypt-hash>
TRACKFIT_VIEWER_DISPLAY_USERNAME=<display-only-username>
TRACKFIT_VIEWER_DISPLAY_PASSWORD=<display-only-password>
```

4. 部署后用管理员账号登录，在设置页通过“从 JSON 恢复数据”上传现有 `trackfit-data.json`
5. 在 Vercel Firewall 为 `/api/auth/login` 添加固定窗口限流：每 IP 每 60 秒最多 10 次，超限返回 `429`

Vercel 部署包内的文件不可作为运行时持久化介质。Blob 中只保存一份私有 JSON，写入时使用 ETag 条件更新，过期修改会返回 `409`。

常用命令：

```bash
docker compose ps
docker compose logs -f app
docker compose down
```

容器重建不会删除 `data/trackfit-data.json`。在 Linux 上如果容器提示目录不可写，将数据目录交给容器内 UID 1000：

```bash
sudo chown -R 1000:1000 data
```

## 数据迁移与备份

日常数据全部保存在 `data/trackfit-data.json`。迁移时停止应用并复制这个文件到新环境的同一路径，然后启动新版即可。

从旧 MySQL 版本迁移：

1. 在旧版设置页下载 JSON 全量备份
2. 停止旧版并保留 MySQL 数据卷
3. 将备份复制为新版 `data/trackfit-data.json`
4. 启动新版，核对指标数、记录数和最新记录

设置页仍支持下载 JSON、导出 CSV 和从 JSON 恢复。恢复文件会先完整校验，再原子替换正式文件。

数据格式当前为 v3。v1/v2 数据文件和备份会在读取时自动补齐新增字段；v2 睡眠评分按百分比换算、训练强度按十分制换算，并在下次保存时写回 v3，不需要手工迁移。

## 并发与安全边界

- 登录用户共享同一份 JSON 数据，只有管理员可以写入
- 写入通过 ETag 检测版本冲突，不会静默覆盖其他设备的修改
- 本地文件模式仍只允许单个 TrackFit 服务实例写同一文件；Blob 模式支持 Vercel 多实例条件写入
- 访客页面不提供导出入口，但已能浏览的数据无法从技术上阻止复制

## 常用命令

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```
