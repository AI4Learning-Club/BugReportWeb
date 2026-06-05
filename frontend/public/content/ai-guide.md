# BugReportWeb AI 代理指南

> **文档版本**：1.0.0（与 OpenAPI `info.version` 对齐）  
> **读者**：自主调用 REST API 的外部 AI 代理、自动化脚本、集成工具。  
> **API 参考**：请切换到顶栏 **[API 参考](/docs)** Tab 查看完整端点、Schema 与 Try-it 面板。

---

## 1. 连接与认证（必读）

### 1.1 API 基址

**始终直连后端 origin**，不要以前端 Vite 开发服务器作为 API 基址。

| 环境 | Base URL |
|------|----------|
| 本地开发 | `http://localhost:3001` |
| 生产 / 自定义 | 部署环境的 API 地址（同域部署时与 Web 应用同 host:port） |

- Web UI 开发服务器通常在 `:5173`，**那不是 API 基址**。
- 截图与上传静态资源 URL 为 `{API_BASE}/uploads/...`（例如 `http://localhost:3001/uploads/bug-screenshots/xxx.png`）。

### 1.2 认证流程

1. `POST /auth/login`，body：`{ "username": "...", "password": "..." }`
2. 保存响应中的 `accessToken`（JWT，有效期 **7 天**，无 refresh token）
3. 后续所有受保护请求添加请求头：`Authorization: Bearer <accessToken>`
4. 会话恢复 / 权限预检：`GET /auth/me` → 返回 `user`，含 `isAdmin` 与 `user.role.permissions`

**公开端点**（无需 token）：

- `POST /auth/register`
- `POST /auth/login`

### 1.3 示例：登录并获取当前用户

```bash
# 登录
curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 使用返回的 accessToken
curl -s http://localhost:3001/auth/me \
  -H "Authorization: Bearer <accessToken>"
```

```javascript
const API_BASE = 'http://localhost:3001';

const loginRes = await fetch(`${API_BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});
const { accessToken } = await loginRes.json();

const meRes = await fetch(`${API_BASE}/auth/me`, {
  headers: { Authorization: `Bearer ${accessToken}` }
});
const user = await meRes.json();
// user.isAdmin, user.role.permissions
```

---

## 2. 权限决策树（核心）

在发起**任何写操作**前，必须先理解权限模型。

### 2.1 决策流程

```
1. user.isAdmin === true ?
   → 是：跳过所有 Permission 检查（服务层极少数规则仍可能限制，如不能禁用自己）
   → 否：继续

2. 目标 endpoint 的 x-permissions 为空 [] ?
   → 是：仅需有效 JWT（仍可能有 x-service-rules）
   → 否：user.role.permissions 是否包含 x-permissions 中**任意一项**？
      → 是：通过装饰器权限检查
      → 否：返回 403，停止重试，向用户说明缺失权限

3. 检查 x-service-rules（服务层业务规则）
   → 不满足则 403/400，即使装饰器权限已通过
```

### 2.2 关键语义

- **`@Permissions(A, B)` = OR**：拥有 A **或** B 任一即可，不是 AND。
- **`isAdmin`**：绕过所有 `Permission` 枚举检查。
- **`x-permissions: []`**：Controller 无装饰器，但服务层可能有额外限制（见 OpenAPI `x-service-rules`）。
- **用户状态**：仅 `ACTIVE` 用户可正常调用 API；`PENDING` / `DISABLED` 会被拒绝。

### 2.3 权限 × 端点对照表

| 权限 | 中文名 | 关联 API |
|------|--------|----------|
| `CREATE_BUG` | 创建 Bug | `POST /bugs` |
| `RETEST_BUG` | 复测 Bug | `POST /bugs/:id/retests` |
| `MARK_BUG_FIXED` | 标记修复 | `PATCH /bugs/:id/status`, `POST /bugs/:id/personnel/join` |
| `ADD_BUG_EVIDENCE` | 补充证据 | `POST/PATCH/DELETE /bugs/:id/screenshots*`, `POST/PATCH/DELETE /bugs/:id/runtime-info*` |
| `DELETE_BUG` | 删除 Bug | `POST /bugs/:id/delete` |
| `DELETE_BUG_ACTIVITY` | 删除 Bug 活动 | `DELETE /bugs/:id/activities/:activityId` |
| `CREATE_FEATURE` | 登记功能 | `POST /features` |
| `UPDATE_FEATURE` | 更新功能 / 实现项 | `PATCH /features/:id`, `.../status`, `.../implementation-items*` |
| `ADD_FEATURE_EVIDENCE` | 功能截图 | `POST/DELETE /features/:id/screenshots` |
| `DELETE_FEATURE` | 删除功能 | `POST /features/:id/delete` |
| `DELETE_FEATURE_ACTIVITY` | 删除功能活动 | `DELETE /features/:id/activities/:activityId` |
| `VIEW_STATS` | 查看 KPI | `GET /stats/kpi` |
| `MANAGE_SYSTEMS` | 系统管理 | `POST/PATCH/DELETE /systems*` |
| `MANAGE_ROLES` | 角色管理 | `GET /roles/export`, `POST /roles/import`, `POST/PATCH/DELETE /roles*` |
| `MANAGE_USERS` | 用户管理 | `GET/PATCH /users/*`；`GET /roles`, `GET /roles/permissions`（与 MANAGE_ROLES 二选一） |
| `DELETE_DISABLED_USER` | 删除已禁用用户 | `DELETE /users/:id`（仅 DISABLED 且无关联记录） |
| `BECOME_ITEM_OWNER` | 成为负责人 | `POST /bugs/:id/personnel/claim-owner`, `POST /features/:id/personnel/claim-owner` |
| `DELEGATE_ITEM_RELATED` | 委派相关人 | `PATCH /bugs/:id/personnel`, `PATCH /features/:id/personnel`（按 body 字段） |
| `DELEGATE_ITEM_OWNER` | 委派负责人 | `PATCH /bugs/:id/personnel`, `PATCH /features/:id/personnel`（按 body 字段） |

**仅需 JWT、无 Permission 装饰器的常见端点**（仍有服务层规则）：

| 端点 | 服务层规则摘要 |
|------|----------------|
| `PATCH /bugs/:id` | admin 或创建者可编辑 |
| `PATCH /features/:id` | 需 `UPDATE_FEATURE` + admin 或创建者 |
| `DELETE /bugs/:id/permanent` | 仅 admin |
| `DELETE /features/:id/permanent` | 仅 admin |
| `PATCH /*/personnel` | 按 body 字段动态鉴权（见下节） |

### 2.4 人员 PATCH 动态鉴权

`PATCH /bugs/:id/personnel` 与 `PATCH /features/:id/personnel` **没有固定装饰器权限**，按请求体字段分别校验：

| Body 字段 | 所需权限 / 规则 |
|-----------|-----------------|
| `ownerId`（设为某人） | `DELEGATE_ITEM_OWNER` |
| `ownerId: null`（撤销负责人） | `DELEGATE_ITEM_OWNER` 或 `BECOME_ITEM_OWNER`（负责人自荐卸任） |
| `addRelatedUserIds` | `DELEGATE_ITEM_RELATED` |
| `removeRelatedUserIds`（移除他人） | `DELEGATE_ITEM_RELATED` |
| `removeRelatedUserIds`（移除自己） | 允许相关人自行退出 |

**推荐**：人员变更优先使用语义明确的专用端点：

- 自荐负责人：`POST /bugs/:id/personnel/claim-owner`（需 `BECOME_ITEM_OWNER`）
- 加入相关人：`POST /bugs/:id/personnel/join`（Bug 需 `MARK_BUG_FIXED`；Feature 需 `UPDATE_FEATURE`）

### 2.5 权限预检辅助函数

```javascript
function hasPermission(user, permission) {
  if (user.isAdmin) return true;
  return user.role?.permissions?.includes(permission) ?? false;
}

function canCallEndpoint(user, permissions) {
  if (user.isAdmin) return true;
  if (!permissions || permissions.length === 0) return true;
  return permissions.some((p) => user.role?.permissions?.includes(p));
}

// 写操作前
const me = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders }).then(r => r.json());
if (!canCallEndpoint(me, ['CREATE_BUG'])) {
  throw new Error('当前账号缺少 CREATE_BUG 权限');
}
```

---

## 3. 推荐工作流

### 3.1 登记 Bug

**前置权限**：`CREATE_BUG`

```
GET /systems          → 获取 systemId
POST /bugs            → 创建 Bug
GET /bugs/:id         → 确认详情与 activities
```

```bash
curl -s -X POST http://localhost:3001/bugs \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "systemId": "<system-id>",
    "title": "登录页按钮无响应",
    "description": "点击登录按钮后无任何反应",
    "severity": "HIGH",
    "steps": "1. 打开登录页\n2. 输入账号密码\n3. 点击登录"
  }'
```

### 3.2 标记 Bug 已修复

**前置权限**：`MARK_BUG_FIXED`

```bash
curl -s -X PATCH "http://localhost:3001/bugs/<bug-id>/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"FIXED","note":"已在 v1.2 修复"}'
```

### 3.3 认领负责人

**前置权限**：`BECOME_ITEM_OWNER`

```bash
curl -s -X POST "http://localhost:3001/bugs/<bug-id>/personnel/claim-owner" \
  -H "Authorization: Bearer $TOKEN"
```

### 3.4 委派相关人

**前置权限**：`DELEGATE_ITEM_RELATED`

```bash
curl -s -X PATCH "http://localhost:3001/bugs/<bug-id>/personnel" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"addRelatedUserIds":["<user-id>"]}'
```

可先 `GET /auth/assignable-users` 获取可选用户 ID。

### 3.5 上传截图

**前置权限**：`ADD_BUG_EVIDENCE`

```bash
curl -s -X POST "http://localhost:3001/bugs/<bug-id>/screenshots" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@screenshot.png" \
  -F "caption=错误弹窗"
```

### 3.6 提交复测

**前置权限**：`RETEST_BUG`  
**限制**：不能复测自己创建的 Bug

```bash
curl -s -X POST "http://localhost:3001/bugs/<bug-id>/retests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"result":"NOT_APPEARED","note":"v1.2 验证通过"}'
```

`result` 枚举：`APPEARED`（仍出现）| `NOT_APPEARED`（未复现）

### 3.7 功能需求全生命周期

推荐顺序：创建功能 → 拆分实现项（计划时间）→ 上传截图 → 按项推进状态 → 必要时标记功能 DONE。

| 步骤 | 端点 | 权限 |
|------|------|------|
| 创建 | `POST /features` | `CREATE_FEATURE` |
| 编辑 | `PATCH /features/:id` | `UPDATE_FEATURE` + 创建者或 admin |
| 改状态 | `PATCH /features/:id/status` | `UPDATE_FEATURE` |
| 截图 | `POST /features/:id/screenshots` | `ADD_FEATURE_EVIDENCE` |
| 实现项 CRUD | `/features/:id/implementation-items*` | `UPDATE_FEATURE` |
| 甘特图 | `GET /features/gantt` | JWT |
| 认领负责人 | `POST /features/:id/personnel/claim-owner` | `BECOME_ITEM_OWNER` |
| 软删除 | `POST /features/:id/delete` | `DELETE_FEATURE` |

变更实现项状态须带 `note`；撤销通过对称 `PATCH .../status` 改回先前状态，勿删活动记录。

### 3.8 管理类操作（高权限）

默认普通角色**不可用**，需 admin 或对应管理权限：

- 用户审批：`PATCH /users/:id/approve`（`MANAGE_USERS`）
- 角色配置：`GET/POST/PATCH/DELETE /roles*`（`MANAGE_ROLES`）
- 系统维护：`POST/PATCH/DELETE /systems*`（`MANAGE_SYSTEMS`）
- KPI：`GET /stats/kpi`（`VIEW_STATS`）

---

## 4. 错误处理与禁止事项

### 4.1 HTTP 状态码

| 状态码 | 含义 | AI 应如何处理 |
|--------|------|---------------|
| `401` | token 无效或过期 | 重新 `POST /auth/login`，勿无限重试 |
| `403` | 权限不足或服务层拒绝 | 调用 `GET /auth/me` 核对权限，向用户说明缺失项 |
| `404` | 资源不存在 | 确认 ID 与 deleted 过滤条件 |
| `400` | 参数无效 | 修正请求体后重试 |

错误响应格式（NestJS）：

```json
{ "statusCode": 403, "message": "Forbidden resource" }
```

### 4.2 软删除 vs 永久删除

| 操作 | 端点 | 权限 / 规则 |
|------|------|-------------|
| 软删除 | `POST /bugs/:id/delete` | `DELETE_BUG`；非 admin 仅自己的 |
| 永久删除 | `DELETE /bugs/:id/permanent` | **仅 admin** |

软删除后 Bug 进入回收站；普通用户查询 `deleted=only` 可能被拒绝。

### 4.3 禁止事项

1. **禁止**用 `DELETE .../activities/:activityId` 掩盖或撤销业务操作。业务撤销应使用对称 API：
   - 撤销负责人：`PATCH .../personnel` + `{ "ownerId": null }`
   - 退出相关人：`PATCH .../personnel` + `{ "removeRelatedUserIds": ["<self-id>"] }`
   - 状态回退：`PATCH .../status` 改回先前状态
2. **禁止**在收到 `403` 后尝试伪造 header 或换用无权限账号重复调用。
3. **禁止**将前端 `:5173` 当作 API 基址。
4. 所有写操作会在 `activities` 中留下审计记录；告知用户操作已被记录。

---

## 5. 活动记录（审计）

Bug 与功能的详情响应均含 `activities[]`。常见 `type`：

**Bug**：`CREATED`, `UPDATED`, `STATUS_CHANGED`, `DELETED`, `SCREENSHOT_ADDED`, `RETEST_RECORDED`, `OWNER_CLAIMED`, `OWNER_DELEGATED`, `OWNER_REVOKED`, `RELATED_JOINED`, `RELATED_ADDED`, `RELATED_REMOVED` 等。

**Feature**：`CREATED`, `UPDATED`, `STATUS_CHANGED`, `DELETED`, `OWNER_*`, `RELATED_*` 等。

活动 `context` 为扁平键值，含 `previousOwnerName`, `newOwnerName`, `userNames` 等展示字段。

---

## 6. 快速检查清单

在执行自动化任务前，逐项确认：

- [ ] Base URL 指向后端（如 `http://localhost:3001`）
- [ ] 已通过 `POST /auth/login` 获取 token
- [ ] 已通过 `GET /auth/me` 确认 `status === 'ACTIVE'`
- [ ] 目标 endpoint 的 `x-permissions` 已预检通过
- [ ] 已阅读 `x-service-rules`（创建者限制、不可自测等）
- [ ] 人员变更使用了正确的 PATCH 字段或专用 join/claim 端点
- [ ] 未使用删除活动记录 API 代替业务撤销

---

## 7. 相关资源

- **OpenAPI 规范**：`/openapi.yaml`（API 参考 Tab 可视化）
- **权限目录 API**：`GET /roles/permissions`（需 `MANAGE_ROLES` 或 `MANAGE_USERS`）
- **项目开发约束**：仓库根目录 `AGENTS.md`
