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
