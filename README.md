# TrackFit

TrackFit 是一个使用 Nuxt 4、Vue 3 和 TypeScript 构建的个人身体指标记录工具。业务数据由浏览器管理，Nitro 服务端只负责原子读写一个 JSON 文件，不依赖数据库。

## 本地运行

要求：Node.js 22+、pnpm 11。

```bash
pnpm install
pnpm dev
```

浏览器访问 `http://127.0.0.1:3000`。开发服务默认只监听 `127.0.0.1`；确实需要从局域网设备访问开发环境时，使用 `pnpm dev --host 0.0.0.0`。

默认数据文件为 `data/trackfit-data.json`，首次访问时自动创建。可通过环境变量指定其他位置：

```dotenv
TRACKFIT_DATA_FILE=/absolute/path/trackfit-data.json
```

## Docker Compose 部署

```bash
docker compose up -d --build
```

Compose 只启动 TrackFit 应用，宿主机 `./data` 挂载为容器 `/app/data`。默认只监听本机，需要允许家庭局域网访问时配置：

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
