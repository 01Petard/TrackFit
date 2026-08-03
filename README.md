# TrackFit

TrackFit 是一个使用 Nuxt 4、Vue 3 和 TypeScript 构建的个人身体指标记录工具。业务数据由浏览器管理，Nitro 服务端只负责原子读写一个 JSON 文件，不依赖数据库。

当前支持身体测量、训练与睡眠记录、趋势和均线、行为相关性、周/月报告、记录热力图以及 JSON/CSV 备份导出。相关性分析至少需要 14 个有效重叠日，仅用于观察趋势，不作为医疗诊断。

## 准备工作

复制`.env.example`，并修改为`.env`。

复制`data/trackfit-data.json.example`，并修改为`data/trackfit-data.json`。

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

Compose 只启动 TrackFit 应用，宿主机 `./data` 挂载为容器 `/app/data`。默认监听所有网卡，局域网设备可通过 `http://<部署机器的局域网 IP>:3000` 访问：

```dotenv
TRACKFIT_BIND_ADDRESS=0.0.0.0
TRACKFIT_PORT=3000
```

如需恢复为仅本机访问，将 `TRACKFIT_BIND_ADDRESS` 改为 `127.0.0.1`。请勿将该端口映射到公网；TrackFit 是单人免登录应用，只适合可信家庭局域网。

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

- 局域网设备共享部署机器上的同一份 JSON 数据
- 写入通过 ETag 检测版本冲突，不会静默覆盖其他设备的修改
- 只支持单个 TrackFit 服务实例，不允许多个容器同时写同一文件
- 项目采用单人免登录模式，只应部署在可信家庭局域网，不应暴露到公网

## 常用命令

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```
