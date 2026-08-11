# TrackFit

> 技术栈：Nuxt 4、Vue 3、TypeScript、Nuxt UI、ECharts、Zod、Vitest、Playwright、Vercel Blob

TrackFit（形轨）是一个给个人使用的身体数据记录与趋势分析工具，用来持续记录身体测量、训练和睡眠，并观察习惯与身体变化之间的关系。

它不是健身社区，也不是多人协作系统。项目没有数据库、注册系统和多租户设计：全部业务数据始终是一份 JSON。浏览器负责数据整理与分析，Nuxt 服务端只负责登录校验和 JSON 的读取、写入。

## 功能

- 记录体重、体脂率、腰围等身体指标，同一天可以记录多次
- 增加自定义数值指标，停用暂时不需要的指标
- 记录训练类型、时长，以及睡眠时间和睡眠质量
- 查看指标趋势、区间统计、3/7/30/90 日均线和双指标对比
- 生成本周、本月的训练、睡眠和身体指标摘要
- 在数据足够时计算训练、睡眠与身体指标的相关性
- 通过 JSON 完整备份和恢复，通过 CSV 导出测量、训练、睡眠明细
- 提供管理员账号和可选的只读访客账号
- 适配桌面端和移动端，支持浅色、深色和跟随系统主题
- 支持中英文路由（`/zh/`、`/en/`）与顶部快速切换，首次访问按浏览器语言选择

相关性分析至少需要 14 个有效重叠日。所有分析只用于回顾个人趋势，不构成医疗建议。

## 数据如何保存

TrackFit 不使用 MySQL、PostgreSQL、SQLite 或其他数据库。

| 运行方式 | 数据位置 | 适合场景 |
| --- | --- | --- |
| 开发、调试 | `data/trackfit-data.json` | 个人开发 |
| Docker本地部署 | 宿主机 `./data/trackfit-data.json` | 家庭服务器、NAS、云主机 |
| Vercel | Vercel Private Blob 中的一份 JSON | 无需维护服务器的公网部署 |

每次保存都会写回完整 JSON。服务端在落盘前使用 Zod 校验全部内容；文件模式使用临时文件加重命名完成原子替换，Blob 模式使用条件写入避免旧页面覆盖较新的数据。这只是保护同一个人在多个标签页或设备上操作时的数据，不代表项目面向多人并发。

## 本地运行

要求：Node.js 22+、pnpm 11。

### 1. 安装依赖

```bash
pnpm install
```

### 2. 准备环境变量

```bash
cp .env.example .env
```

生成会话密钥：

```bash
openssl rand -base64 48
```

生成登录密码哈希：

```bash
pnpm auth:hash '你的管理员密码'
```

把结果分别写入 `.env`：

```dotenv
NUXT_SESSION_PASSWORD=<openssl 生成的随机字符串>
TRACKFIT_ADMIN_USERNAME=admin
TRACKFIT_ADMIN_PASSWORD_HASH=<pnpm auth:hash 的输出>
```

`NUXT_SESSION_PASSWORD` 至少需要 32 个字符。密码哈希可以提交给服务端使用，但不要把原始密码或 `.env` 提交到 Git。

只读访客不是必需的。如需启用，再配置：

```dotenv
TRACKFIT_VIEWER_USERNAME=viewer
TRACKFIT_VIEWER_PASSWORD_HASH=<访客密码哈希>
```

`TRACKFIT_VIEWER_DISPLAY_USERNAME` 和 `TRACKFIT_VIEWER_DISPLAY_PASSWORD` 只会把演示账号明文显示在登录页，不参与认证。个人私有部署通常应保持为空。

### 3. 启动

```bash
pnpm dev
```

访问 `http://127.0.0.1:3000`，系统会按浏览器语言进入 `/zh/` 或 `/en/`。开发服务监听 `0.0.0.0`，同一局域网内也可以通过 `http://<本机局域网 IP>:3000` 访问。

首次读取数据时，程序会自动创建 `data/trackfit-data.json` 和内置身体指标，不需要手工复制示例文件。若要把数据放到其他位置，可设置绝对路径：

```dotenv
TRACKFIT_DATA_FILE=/absolute/path/trackfit-data.json
```

## 使用 Docker Compose

先按“本地运行”的方式创建 `.env` 并配置管理员账号。当前 `compose.yaml` 还要求同时提供只读访客账号，因此 Docker 部署需要补充 `TRACKFIT_VIEWER_USERNAME` 和 `TRACKFIT_VIEWER_PASSWORD_HASH`，然后执行：

```bash
docker compose up -d --build
```

默认访问地址为 `http://<部署机器 IP>:3000`。Compose 只运行 TrackFit，不会额外启动数据库；宿主机的 `./data` 会挂载到容器 `/app/data`，所以更新或重建容器不会删除记录。

可在 `.env` 修改监听地址和端口：

```dotenv
TRACKFIT_BIND_ADDRESS=0.0.0.0
TRACKFIT_PORT=3000
```

常用命令：

```bash
docker compose ps
docker compose logs -f app
docker compose down
```

如果只允许部署机器本机访问，将 `TRACKFIT_BIND_ADDRESS` 改为 `127.0.0.1`。通过公网域名访问时，应在反向代理层配置 HTTPS。

Linux 上如果容器提示数据目录不可写，需要让容器内的 `node` 用户（UID 1000）拥有该目录：

```bash
sudo chown -R 1000:1000 data
```

## 部署到 Vercel

Nuxt 可以直接部署到 Vercel，不需要 `vercel.json`。但 Vercel Functions 的项目文件不是持久化磁盘，因此 TrackFit 在 Vercel 上必须使用 Private Blob 保存 JSON，不能继续使用默认的文件模式。

### 1. 导入项目

1. 把仓库推送到 GitHub、GitLab 或 Bitbucket
2. 在 Vercel 点击 **Add New → Project**，导入该仓库
3. 确认 Framework Preset 识别为 **Nuxt.js**
4. 保持默认构建命令 `pnpm build`，不要改成纯静态导出

项目包含 `/server/api`，必须保留 Nuxt/Nitro 服务端函数，不能只部署静态页面。

### 2. 创建并连接 Private Blob

1. 进入 Vercel 项目的 **Storage** 页面
2. 选择 **Create Database → Blob**
3. Access 选择 **Private**；Blob 创建后不能在 Public 和 Private 之间切换
4. 选择离自己较近的区域并创建 Store
5. 确认该 Store 已连接到当前 Vercel Project

新连接默认使用 Vercel OIDC，Vercel 会把 Blob 身份信息提供给部署环境，不需要手工填写长期读写 Token。旧 Store 若仍使用 Token 认证，连接项目后应能看到自动注入的 `BLOB_READ_WRITE_TOKEN`；不要把它写进仓库。

### 3. 配置 Production 环境变量

进入 **Project Settings → Environment Variables**，为 Production 添加：

```dotenv
TRACKFIT_STORAGE=blob
TRACKFIT_BLOB_PATH=trackfit/trackfit-data.json

NUXT_SESSION_PASSWORD=<至少 32 位的随机字符串>
TRACKFIT_ADMIN_USERNAME=<管理员用户名>
TRACKFIT_ADMIN_PASSWORD_HASH=<管理员密码哈希>
```

需要只读访客时，再添加：

```dotenv
TRACKFIT_VIEWER_USERNAME=<访客用户名>
TRACKFIT_VIEWER_PASSWORD_HASH=<访客密码哈希>
```

`TRACKFIT_BLOB_PATH` 是 Blob 内的对象路径，不是本地文件路径。一个部署只使用一个固定路径即可。

不要让 Production 和 Preview 共用同一个 Blob 路径，否则预览分支也会读写正式数据。需要可正常登录、读写的 Preview 时，应连接独立的 Private Blob Store，或至少使用独立路径；不需要 Preview 时则不要为预览环境开放正式数据凭据。

### 4. 重新部署并初始化

环境变量只对新部署生效。配置完成后，在 **Deployments** 中重新部署最新版本，或推送一次提交触发新部署。

首次使用有两种情况：

- 没有旧数据：直接登录，TrackFit 会在 Private Blob 中自动创建空白数据
- 已有 JSON：先登录，再到“设置 → 数据备份 → 从 JSON 恢复数据”上传备份

部署后依次检查：

1. `/api/health` 返回正常
2. 管理员可以登录
3. 新增一条测试记录并刷新页面，记录仍然存在
4. Vercel Storage 中出现 `TRACKFIT_BLOB_PATH` 对应的私有 JSON

公开部署建议在 Vercel Firewall 中针对 `POST /api/auth/login` 增加按 IP 的速率限制。应用本身会校验密码、限制跨域写入并使用 HttpOnly 会话 Cookie，但没有内置登录限流。

参考：[Vercel 的 Nuxt 部署文档](https://vercel.com/docs/frameworks/full-stack/nuxt)、[Vercel Private Blob 文档](https://vercel.com/docs/vercel-blob/private-storage)。

## 备份、恢复与搬家

这里没有数据库迁移。所谓“迁移”，只是移动或恢复一份 TrackFit JSON。

### 日常备份

管理员进入“设置 → 数据备份”后可以：

- 下载 JSON 全量备份：包含设置、指标定义、身体测量、训练和睡眠，可完整恢复
- 导出三个 CSV：便于在 Excel 等表格工具中查看，不能用于完整恢复
- 从 JSON 恢复：校验通过后替换当前全部数据

### 本地或 Docker 搬到另一台机器

停止旧实例，复制 `data/trackfit-data.json` 到新实例的 `data/` 目录，再启动即可。也可以先在旧实例下载 JSON 备份，再在新实例的设置页恢复。

### 本地或 Docker 搬到 Vercel

推荐在 Vercel 部署完成后，通过设置页上传 JSON 备份。如果需要从命令行直接覆盖 Blob，可在本地 `.env` 配置旧式 `BLOB_READ_WRITE_TOKEN`，然后执行：

```bash
pnpm blob:restore
pnpm blob:restore --confirm
```

第一条命令只读取本地 `TRACKFIT_DATA_FILE`、校验格式并显示记录数量；第二条命令才会覆盖 `TRACKFIT_BLOB_PATH` 指向的 Blob。执行覆盖前应先下载一份当前线上备份。

### Vercel 搬回本地或 Docker

在线上设置页下载 JSON 全量备份，然后：

- 在新实例设置页选择“从 JSON 恢复数据”；或
- 停止新实例，将备份文件保存为 `data/trackfit-data.json` 后再启动

当前数据格式版本为 v6。身体测量记录及其指标值统一保存在 `bodyRecords`，训练记录保存在 `trainingRecords`。读取 v1–v5 备份时会自动合并原 `sessions + values`、删除身高快照并迁移旧训练和睡眠字段；下一次保存时会写成 v6，不需要 SQL 或手工改数据。

## 环境变量

| 变量 | 是否必需 | 说明 |
| --- | --- | --- |
| `NUXT_SESSION_PASSWORD` | 是 | 会话加密密钥，至少 32 个字符 |
| `TRACKFIT_ADMIN_USERNAME` | 是 | 管理员用户名 |
| `TRACKFIT_ADMIN_PASSWORD_HASH` | 是 | `pnpm auth:hash` 生成的管理员密码哈希 |
| `TRACKFIT_VIEWER_USERNAME` | 否 | 只读访客用户名 |
| `TRACKFIT_VIEWER_PASSWORD_HASH` | 否 | 只读访客密码哈希 |
| `TRACKFIT_VIEWER_DISPLAY_USERNAME` | 否 | 仅在登录页明文展示的演示用户名 |
| `TRACKFIT_VIEWER_DISPLAY_PASSWORD` | 否 | 仅在登录页明文展示的演示密码 |
| `TRACKFIT_STORAGE` | 否 | `file` 或 `blob`，默认 `file` |
| `TRACKFIT_DATA_FILE` | 否 | 文件模式的数据路径，默认 `data/trackfit-data.json` |
| `TRACKFIT_BLOB_PATH` | Vercel | Blob 模式的对象路径，默认 `trackfit/trackfit-data.json` |
| `BLOB_STORE_ID` | OIDC Blob 自动注入 | 由 Vercel 在连接 Store 时提供，不要手工提交 |
| `BLOB_READ_WRITE_TOKEN` | 旧式 Blob 认证 | 由 Vercel 注入，OIDC 连接不需要手工配置 |
| `TRACKFIT_BIND_ADDRESS` | Docker 可选 | 宿主机监听地址，默认 `0.0.0.0` |
| `TRACKFIT_PORT` | Docker 可选 | 宿主机端口，默认 `3000` |

## 开发命令

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm preview
```
