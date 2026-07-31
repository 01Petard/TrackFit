# TrackFit

TrackFit 是一个使用 Nuxt 4、Vue 3、TypeScript 和 MySQL 构建的个人身体指标记录工具。每次测量都按精确时间独立保存，不做每日聚合。

## 本地运行

要求：Node.js 22+、pnpm 11、MySQL 8.0.32。

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
```

浏览器访问 `http://127.0.0.1:3000`。开发服务监听 `0.0.0.0`，同一家庭局域网内可以通过电脑的局域网 IP 访问。

## 数据库

本地 Node 进程连接 Docker 映射端口时使用：

```dotenv
DATABASE_URL=mysql://root:your_password@127.0.0.1:3306/trackfit
```

如果以后将 Nuxt 也放入 Docker，应将主机改为 `host.docker.internal`。真实密码只保存在 `.env`，不得提交到 Git。

## 常用命令

```bash
pnpm dev
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm db:generate
pnpm db:migrate
```

## 局域网安全

项目按单人免登录模式设计。应用不应映射到公网；同一局域网中的其他设备可能访问页面和 API。MySQL `3306` 应只监听本机，不应暴露到局域网。

