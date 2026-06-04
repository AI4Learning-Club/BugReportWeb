# Agent 开发指南

本文档约定在本仓库中**新增或扩展功能**时必须满足的约束。实现前先对照检查，交付前逐项自检。

## 总览

| 维度 | 要求 |
|------|------|
| 权限 | 新能力若需鉴权，必须纳入权限体系并在**角色管理**中可配置 |
| 布局 | 兼顾桌面与手机，适配不同视口（含窄屏、矮屏） |
| 写入与审计 | 所有**写入操作**写入活动记录，并提供可理解的**撤销**路径 |

---

## 1. 权限

### 原则

- 任何会改变数据、访问敏感能力或跨越用户边界的操作，都应通过**显式权限**控制，而不是仅靠前端隐藏按钮。
- 若新功能需要新权限：**必须**出现在管理后台的**角色管理**页面中，供管理员分配给角色。
- 管理员账号（`isAdmin`）仍绕过权限检查；普通用户只拥有其角色中的权限。

### 何时需要新权限

- 新的 API 写操作（创建 / 更新 / 删除 / 状态变更 / 委派等）
- 新的管理后台模块
- 与现有权限语义不符的能力（不要复用含义模糊的权限凑合）

若多个操作属于同一业务域且风险相同，可合并为一个权限，但须在目录中写清 `description` 与 `apis`。

### 实现清单（新权限）

1. **数据库枚举** — `backend/prisma/schema.prisma` 的 `enum Permission` 增加枚举值。
2. **迁移** — `backend/prisma/migrations/` 下新增 SQL：`ALTER TYPE "Permission" ADD VALUE '...'`。
3. **权限目录（后端）** — `backend/src/roles/permission-catalog.ts` 的 `PERMISSION_CATALOG` 增加条目（`zhName`、`summary`、`description`、`surfaces`、`apis`）。
4. **种子数据** — `backend/prisma/seed.ts` 中为默认角色补充新权限（如适用）。
5. **接口守卫** — 在对应 Controller 方法上使用 `@Permissions(Permission.XXX)`；服务层用 `hasPermission` / `assert*` 做二次校验（参考 `backend/src/personnel/personnel.util.ts`）。
6. **前端类型与文案** — `frontend/src/api.ts`：`Permission` 联合类型、`PERMISSIONS` 数组、`PERMISSION_LABELS`。
7. **角色管理 UI** — `frontend/src/RoleAdminPanel.tsx`：`PERMISSION_UI_META` 中为该权限补充 `module`、`category`、`permissionType`、`dataScope` 等展示元数据。
8. **前端 gated UI** — 使用 `hasPermission(user, 'XXX')` 控制按钮、链接、面板是否展示（参考 `frontend/src/App.tsx`）。

权限定义由 `GET /roles/permissions` 提供给角色管理页；**不要**只改前端而不改目录与枚举。

### 参考

- 权限目录：`backend/src/roles/permission-catalog.ts`
- 角色管理：`frontend/src/RoleAdminPanel.tsx`
- 人员相关权限示例：`BECOME_ITEM_OWNER`、`DELEGATE_ITEM_OWNER`、`DELEGATE_ITEM_RELATED`

---

## 2. 响应式布局

### 原则

- 新页面、新面板、新表格、新表单必须在**桌面宽屏**与**手机窄屏**下均可使用，避免横向溢出、遮挡或无法点击。
- 样式变更优先沿用现有断点与组件类名，保持全站一致。

### 断点与样式文件

- 全局样式：`frontend/src/styles.css`
- 窄屏 / 矮屏覆盖：`frontend/src/mobile.css`  
  - 主断点：`@media (max-width: 900px), (max-height: 560px)`
- 入口已引入：`frontend/src/main.tsx` 中 `import './mobile.css'`

### 实现要点

- **表格**：为 `<td>` 设置 `data-label="列名"`，以便在移动端以卡片行展示（见 Bug/功能/统计列表）。
- **操作区**：多按钮时使用 `ghost compact` 等已有类；窄屏下允许换行（`.personnel-actions`、`.personnel-delegate-row` 等已有 flex + wrap 模式）。
- **弹层 / 侧栏**：确认在矮屏下可滚动且不被裁切。
- **触控**：可点击区域不宜过小；避免仅 hover 才出现的必要操作。
- **动效**：尊重 `prefers-reduced-motion`（见 `styles.css`）。

### 自检

- 浏览器宽度约 390px（手机）与 900px 边界附近各看一遍。
- 检查长标题、长用户名、多 chip 是否撑破布局。
- 新增 CSS 若仅适用于小屏，写在 `mobile.css`；通用样式写在 `styles.css`。

---

## 3. 活动记录与撤销

### 原则

- **所有写入操作**（创建、编辑、删除、状态变更、上传/删除附件、人员变更、复测等）都应在活动记录中留下可追溯条目。
- 每条记录应能表达：**谁**、**何时**、**做了什么**；必要时用 `context` / `changes` 存放结构化细节。
- 用户可执行的写入，在业务允许时须提供**撤销**（或对称的反向操作），不能只可进不可退。

### 当前实现范围

- **Bug**：`BugActivity` + `BugActivityType`（`backend/prisma/schema.prisma`），详情页「活动记录」面板（`frontend/src/App.tsx`）。
- 记录逻辑集中在事务内创建活动（参考 `backend/src/bugs/bugs.service.ts` 的 `createActivity`，`backend/src/personnel/personnel.service.ts` + `personnel-activity.util.ts`）。
- 前端展示：`activityTitle()`、`describeActivityContext()`；类型定义见 `frontend/src/api.ts` 的 `BugActivity`。
- **功能（Feature）**：尚无独立活动表；新增 Feature 侧写入时，应同步设计 `FeatureActivity`（或统一审计模型），避免仅 Bug 有审计。

### 新增写入时的清单

1. **枚举** — 在 `BugActivityType`（或对应实体活动枚举）中增加类型；编写 Prisma 迁移。
2. **后端** — 在与业务相同的 `$transaction` 内调用 `createActivity` / `recordBugPersonnelActivity`，写入 `actorId`、`type`、`context` / `changes`。
3. **前端** — 更新 `BugActivity['type']`、`activityTitle`、`describeActivityContext`。
4. **撤销** — 明确撤销语义并实现，例如：
   - 人员：撤销负责人（`ownerId: null`）、退出相关人（`removeRelatedUserIds: [self]`）、移除被委派的相关人；
   - 状态/字段：提供反向 PATCH 或专用撤销 API；
   - 删除类：回收站恢复或对称创建活动。
5. **权限** — 撤销操作如需不同于原操作的权限，单独定义并在角色管理中登记。
6. **删除活动** — 仅 `DELETE_BUG_ACTIVITY` 可删活动行；业务撤销不应依赖删活动记录掩盖历史。

### 活动 `context` 约定

- 使用扁平键值（字符串为主），便于前端 `describeActivityContext` 拼接中文说明。
- 人员类建议包含：`previousOwnerName`、`newOwnerName`、`userNames` 等展示名，避免仅暴露 ID。

### 参考活动类型（Bug 人员）

| 类型 | 含义 |
|------|------|
| `OWNER_CLAIMED` | 认领负责人 |
| `OWNER_DELEGATED` | 委派负责人 |
| `OWNER_REVOKED` | 撤销负责人 |
| `RELATED_JOINED` | 自行加入相关人 |
| `RELATED_ADDED` | 委派添加相关人 |
| `RELATED_REMOVED` | 移除 / 退出相关人 |

---

## 4. 交付前检查表

```
[ ] 是否需要新 Permission？若是，已完成 schema、migration、catalog、seed、@Permissions、api.ts、RoleAdminPanel、hasPermission UI
[ ] 新 UI 在 mobile.css 断点下已手动验证，表格含 data-label（如适用）
[ ] 每个新写入 API 均在事务中写入活动记录，且前端能展示标题与摘要
[ ] 用户可见的写入具备撤销或反向操作，权限与活动记录已对齐
[ ] npm run build（backend + frontend）通过
```

---

## 5. 仓库结构速查

| 路径 | 用途 |
|------|------|
| `backend/src/roles/permission-catalog.ts` | 权限说明与 API 面对照表 |
| `backend/src/personnel/` | 人员分配与 Bug 人员活动 |
| `backend/src/bugs/bugs.service.ts` | Bug 业务与活动记录 |
| `frontend/src/RoleAdminPanel.tsx` | 角色与权限管理 UI |
| `frontend/src/App.tsx` | 主业务 UI、活动记录展示、人员面板 |
| `frontend/src/mobile.css` | 响应式覆盖 |
| `backend/prisma/schema.prisma` | 数据模型与枚举 |

---

## 6. 与其他文档的关系

- 本地启动与环境：见根目录 `README.md`。
- 本文件面向 **Agent / 贡献者** 的功能扩展约束，优先级高于临时实现习惯。
