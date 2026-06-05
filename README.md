# BugReportWeb

前后端分离的 bug 登记与追踪系统。

## Stack

- Frontend: Vite + React + TypeScript
- Backend: NestJS + Prisma
- Database: PostgreSQL

## Local Setup

```bash
npm install
docker compose up -d
copy backend\.env.example backend\.env
npm run prisma:migrate
npm run seed
npm run dev
```

默认管理员账号由 seed 创建：

- username: `admin`
- password: `admin123`

首次部署后请立刻修改默认密码。

## API 基址

**请直连后端**，不要以前端 Vite 开发服务器（`:5173`）作为 API 基址。

| 环境 | API Base URL |
|------|----------------|
| 本地开发 | `http://localhost:3001` |
| 生产同域部署 | `http(s)://<host>:<PORT>`（与后端监听地址一致） |

认证方式：`Authorization: Bearer <JWT>`（`POST /auth/login` 获取，有效期 7 天）。

环境变量见 `backend/.env.example`（`PORT=3001`、`JWT_SECRET`、`FRONTEND_ORIGIN` 等）。

## API 文档

文档已嵌入主 Web 应用，侧边栏 **API 文档** 入口，或直接访问：

- API 参考（Stoplight Elements）：`/docs`
- AI 代理指南：`/docs/ai-guide`

开发时：`npm run dev` 后打开 `http://localhost:5173/docs`

OpenAPI 规范：`frontend/public/openapi.yaml`  
AI 代理指南：`frontend/public/content/ai-guide.md`

代码块使用内嵌 **JetBrains Mono** 字体。
