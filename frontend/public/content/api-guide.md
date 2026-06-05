# BugReportWeb API 使用指南

> **文档版本**：1.0.0（与 OpenAPI `info.version` 对齐）  
> **读者**：集成 BugReportWeb 的前端 / 后端开发者、运维与自动化脚本作者。  
> **端点明细**：请切换到顶栏 **[API 参考](/docs)** 查看按 Tag 分组的完整端点、Schema 示例与权限标注。

---

## 1. 集成前提

### 1.1 Base URL

**始终直连后端 origin**，不要以前端 Vite 开发服务器（`:5173`）作为 API 基址。

| 环境 | Base URL |
|------|----------|
| 本地开发 | `http://localhost:3001` |
| 生产 / 自定义 | 部署环境的 API 地址 |

静态资源（截图等）URL 形如 `{API_BASE}/uploads/...`。

### 1.2 认证与会话

1. `POST /auth/login` 获取 `accessToken`（JWT，**7 天**有效，无 refresh token）
2. 后续请求添加 `Authorization: Bearer <accessToken>`
3. 写操作前调用 `GET /auth/me` 确认 `status === 'ACTIVE'` 与 `role.permissions`

公开端点：`POST /auth/register`、`POST /auth/login`。

---

## 2. 典型工作流

### 2.1 Bug 全生命周期

```
GET /systems                    → 选择 systemId
POST /bugs                      → 创建（CREATE_BUG）
POST /bugs/:id/personnel/claim-owner → 认领负责人（BECOME_ITEM_OWNER）
PATCH /bugs/:id/status          → 标记 FIXED（MARK_BUG_FIXED）
POST /bugs/:id/retests          → 他人复测（RETEST_BUG，不可自测）
POST /bugs/:id/delete           → 软删除（DELETE_BUG）
```

创建时可附带 `runtimeInfos`；证据阶段使用 `POST /bugs/:id/screenshots`（multipart）与 `POST /bugs/:id/runtime-info`。

### 2.2 功能需求生命周期

| 步骤 | 端点 | 权限 |
|------|------|------|
| 创建 | `POST /features` | `CREATE_FEATURE` |
| 编辑 | `PATCH /features/:id` | `UPDATE_FEATURE` + 创建者或 admin |
| 改状态 | `PATCH /features/:id/status` | `UPDATE_FEATURE` |
| 上传截图 | `POST /features/:id/screenshots` | `ADD_FEATURE_EVIDENCE` |
| 拆分实现项 | `POST /features/:id/implementation-items` | `UPDATE_FEATURE` |
| 更新实现项 / 状态 | `PATCH .../implementation-items/:itemId` 或 `.../status` | `UPDATE_FEATURE` |
| 甘特图数据 | `GET /features/gantt` | JWT |
| 认领负责人 | `POST /features/:id/personnel/claim-owner` | `BECOME_ITEM_OWNER` |
| 软删除 | `POST /features/:id/delete` | `DELETE_FEATURE` |

列表支持 `sortBy=createdAt|plannedStart|plannedEnd|progress|title` 与 `sortOrder=asc|desc`。

### 2.3 人员协作

推荐使用语义明确的专用端点，而非直接构造复杂 PATCH：

| 意图 | 推荐端点 |
|------|----------|
| 自荐负责人 | `POST /bugs/:id/personnel/claim-owner` |
| 加入相关人（Bug） | `POST /bugs/:id/personnel/join` |
| 加入相关人（Feature） | `POST /features/:id/personnel/join` |
| 委派负责人 / 相关人 | `PATCH /bugs/:id/personnel` 或 Feature 对应路径 |

可选用户列表：`GET /auth/assignable-users`。

### 2.4 管理类操作

需 admin 或对应管理权限，默认普通角色不可用：

- 用户审批 / 状态：`PATCH /users/:id/*`（`MANAGE_USERS`）
- 删除已禁用用户：`DELETE /users/:id`（`DELETE_DISABLED_USER`）
- 角色配置：`GET/POST/PATCH/DELETE /roles*`（`MANAGE_ROLES`）
- 系统维护：`POST/PATCH/DELETE /systems*`（`MANAGE_SYSTEMS`）
- KPI：`GET /stats/kpi`（`VIEW_STATS`）

---

## 3. 撤销与对称操作

业务撤销应使用**对称 API**，而非删除活动记录。

| 原操作 | 撤销 / 反向操作 | 说明 |
|--------|-----------------|------|
| 认领负责人 | `PATCH .../personnel` + `{ "ownerId": null }` | 需 `DELEGATE_ITEM_OWNER` 或负责人自荐卸任 |
| 委派负责人 | 同上，或委派给他人 | `DELEGATE_ITEM_OWNER` |
| 加入相关人 | `PATCH .../personnel` + `{ "removeRelatedUserIds": ["<self>"] }` | 可自行退出 |
| 移除相关人 | `PATCH .../personnel` + `{ "removeRelatedUserIds": ["<id>"] }` | `DELEGATE_ITEM_RELATED` |
| 标记 FIXED | `PATCH .../status` + `{ "status": "OPEN" }` | `MARK_BUG_FIXED` |
| 功能 DONE → 进行中 | `PATCH /features/:id/status` 改回先前状态 | `UPDATE_FEATURE` |
| 删实现项 | 重新 `POST /features/:id/implementation-items` 同名项 | `UPDATE_FEATURE` |
| 实现项状态变更 | `PATCH .../implementation-items/:itemId/status` 改回先前状态 | `UPDATE_FEATURE` |
| 删功能截图 | 重新 `POST /features/:id/screenshots` | `ADD_FEATURE_EVIDENCE` |
| 软删除 Bug / Feature | 管理员可从回收站恢复（UI）；永久删除仅 admin | 见下节 |

**禁止**用 `DELETE .../activities/:activityId` 掩盖业务操作。该 API 仅供 `DELETE_BUG_ACTIVITY` / `DELETE_FEATURE_ACTIVITY` 权限下的审计管理，不是通用撤销。

### 3.1 软删除 vs 永久删除

| 操作 | Bug 端点 | Feature 端点 | 规则 |
|------|----------|--------------|------|
| 软删除 | `POST /bugs/:id/delete` | `POST /features/:id/delete` | 非 admin 通常仅自己的记录 |
| 永久删除 | `DELETE /bugs/:id/permanent` | `DELETE /features/:id/permanent` | **仅 admin** |

软删除后列表需 `deleted=only`（非 admin 可能受限）；详情页对已删记录 admin 仍可访问。

---

## 4. 活动记录类型

Bug 与 Feature 详情均含 `activities[]`，每次写入会在事务内追加一条审计记录。

### 4.1 Bug 活动 `type`

| type | 含义 | 常见撤销 |
|------|------|----------|
| `CREATED` | 创建 Bug | — |
| `UPDATED` | 字段变更 | 反向 PATCH 字段 |
| `STATUS_CHANGED` | 状态变更 | 反向 PATCH status |
| `DELETED` | 软删除 | 管理员恢复（UI） |
| `SCREENSHOT_ADDED` / `SCREENSHOT_REMOVED` | 截图增删 | DELETE screenshot |
| `RUNTIME_INFO_*` | 运行信息增删改 | 对应 DELETE/PATCH |
| `RETEST_RECORDED` | 复测记录 | 一般不可撤销，可追加新复测 |
| `OWNER_CLAIMED` | 自荐负责人 | `ownerId: null` |
| `OWNER_DELEGATED` | 委派负责人 | `ownerId: null` 或改派 |
| `OWNER_REVOKED` | 撤销负责人 | 再次 claim / delegate |
| `RELATED_JOINED` | 自行加入相关人 | removeRelatedUserIds 自己 |
| `RELATED_ADDED` | 委派添加相关人 | removeRelatedUserIds |
| `RELATED_REMOVED` | 移除相关人 | addRelatedUserIds |

`context` 为扁平键值，含 `previousOwnerName`、`newOwnerName`、`userNames` 等展示字段；前端活动面板据此渲染中文摘要。

### 4.2 Feature 活动 `type`

与 Bug 类似，含 `CREATED`、`UPDATED`、`STATUS_CHANGED`、`DELETED`、`OWNER_*`、`RELATED_*` 等；无截图 / 复测类类型。

---

## 5. 权限矩阵摘要

### 5.1 装饰器语义

- `@Permissions(A, B)` = **OR**：拥有 A 或 B 任一即可
- `x-permissions: []` = 仅需有效 JWT（服务层可能有 `x-service-rules`）
- `isAdmin: true` 绕过所有 Permission 检查

### 5.2 人员 PATCH 动态鉴权

`PATCH /bugs/:id/personnel` 与 `PATCH /features/:id/personnel` **无固定装饰器**，按 body 字段校验：

| Body 字段 | 所需权限 |
|-----------|----------|
| `ownerId`（设为某人） | `DELEGATE_ITEM_OWNER` |
| `ownerId: null` | `DELEGATE_ITEM_OWNER` 或 `BECOME_ITEM_OWNER`（自荐卸任） |
| `addRelatedUserIds` | `DELEGATE_ITEM_RELATED` |
| `removeRelatedUserIds`（他人） | `DELEGATE_ITEM_RELATED` |
| `removeRelatedUserIds`（自己） | 允许相关人自行退出 |

### 5.3 权限 × 端点速查

| 权限 | 中文名 | 主要 API |
|------|--------|----------|
| `CREATE_BUG` | 创建 Bug | `POST /bugs` |
| `RETEST_BUG` | 复测 | `POST /bugs/:id/retests` |
| `MARK_BUG_FIXED` | 标记修复 | `PATCH /bugs/:id/status` |
| `ADD_BUG_EVIDENCE` | 补充证据 | screenshots / runtime-info |
| `DELETE_BUG` | 软删除 Bug | `POST /bugs/:id/delete` |
| `DELETE_BUG_ACTIVITY` | 删 Bug 活动 | `DELETE /bugs/:id/activities/:id` |
| `CREATE_FEATURE` | 登记功能 | `POST /features` |
| `UPDATE_FEATURE` | 更新功能 / 实现项 | `PATCH /features/:id`, `.../status`, `.../implementation-items*` |
| `ADD_FEATURE_EVIDENCE` | 功能截图 | `POST/DELETE /features/:id/screenshots` |
| `DELETE_FEATURE` | 软删除功能 | `POST /features/:id/delete` |
| `DELETE_FEATURE_ACTIVITY` | 删功能活动 | `DELETE /features/:id/activities/:id` |
| `VIEW_STATS` | KPI | `GET /stats/kpi` |
| `MANAGE_SYSTEMS` | 系统管理 | `/systems*` 写操作 |
| `MANAGE_ROLES` | 角色管理 | `/roles*` 写操作、import/export |
| `MANAGE_USERS` | 用户管理 | `/users*`（不含删除） |
| `DELETE_DISABLED_USER` | 删除已禁用用户 | `DELETE /users/:id` |
| `BECOME_ITEM_OWNER` | 成为负责人 | `POST .../personnel/claim-owner` |
| `DELEGATE_ITEM_RELATED` | 委派相关人 | `PATCH .../personnel` |
| `DELEGATE_ITEM_OWNER` | 委派负责人 | `PATCH .../personnel` |

完整权限目录（含 description / surfaces）：`GET /roles/permissions`（需 `MANAGE_ROLES` 或 `MANAGE_USERS`）。

### 5.4 无装饰器但有限制的端点

| 端点 | 服务层规则摘要 |
|------|----------------|
| `PATCH /bugs/:id` | admin 或创建者可编辑 |
| `PATCH /features/:id` | 需 `UPDATE_FEATURE` + admin 或创建者 |
| `DELETE /bugs/:id/permanent` | 仅 admin |
| `GET /bugs?deleted=only` | 非 admin 可能被拒绝 |

---

## 6. 错误处理建议

| 状态码 | 含义 | 建议 |
|--------|------|------|
| `401` | 未认证 / token 失效 | 重新 login |
| `403` | 权限或服务层拒绝 | `GET /auth/me` 核对权限 |
| `404` | 资源不存在 | 检查 id 与 deleted 过滤 |
| `400` | 参数无效 | 对照 OpenAPI Schema 修正 |
| `409` | 冲突 | 如用户名重复 |

响应体：`{ "statusCode": number, "message": string | string[] }`。

---

## 7. 相关资源

- **[API 参考](/docs)**：OpenAPI 驱动的端点列表、示例与 cURL
- **[AI 代理指南](/docs/ai-guide)**：面向自主代理的决策树与禁止事项
- **OpenAPI 文件**：`/openapi.yaml`
- **项目约束**：仓库根目录 `AGENTS.md`
