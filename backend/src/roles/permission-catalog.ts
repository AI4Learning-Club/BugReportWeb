import { Permission } from '@prisma/client';

export type PermissionCatalogItem = {
  code: Permission;
  zhName: string;
  enName: string;
  group: string;
  summary: string;
  description: string;
  surfaces: string[];
  apis: string[];
};

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
  {
    code: Permission.CREATE_BUG,
    zhName: '创建 Bug',
    enName: 'Create Bug',
    group: 'Bug 生命周期',
    summary: '允许登记新的 bug 记录。',
    description: '可访问登记页，提交标题、描述、运行环境、复现步骤等初始信息，生成新的 bug。',
    surfaces: ['Bug 列表', '登记 bug 页面'],
    apis: ['POST /bugs']
  },
  {
    code: Permission.RETEST_BUG,
    zhName: '复测 Bug',
    enName: 'Retest Bug',
    group: 'Bug 生命周期',
    summary: '允许提交 bug 复测结果。',
    description: '可在 bug 详情页记录“仍然出现 / 未复现”等复测结论，并附带复测备注。',
    surfaces: ['Bug 详情页'],
    apis: ['POST /bugs/:id/retests']
  },
  {
    code: Permission.MARK_BUG_FIXED,
    zhName: '标记修复',
    enName: 'Mark Bug Fixed',
    group: 'Bug 生命周期',
    summary: '允许切换 bug 的修复状态。',
    description: '可在 bug 详情页把 bug 标记为已修复或重新打开，并记录状态变更备注。',
    surfaces: ['Bug 详情页'],
    apis: ['PATCH /bugs/:id/status']
  },
  {
    code: Permission.ADD_BUG_EVIDENCE,
    zhName: '补充证据',
    enName: 'Add Bug Evidence',
    group: '证据管理',
    summary: '允许上传截图和补充运行信息。',
    description: '可为 bug 新增截图、运行环境、日志等辅助信息，并管理自己可操作的附属记录。',
    surfaces: ['Bug 详情页'],
    apis: ['POST /bugs/:id/screenshots', 'POST /bugs/:id/runtime-info']
  },
  {
    code: Permission.DELETE_BUG,
    zhName: '删除 Bug',
    enName: 'Delete Bug',
    group: 'Bug 生命周期',
    summary: '允许执行 bug 软删除。',
    description: '普通角色仅可软删除自己创建的 bug；管理员可软删除任意 bug。软删除后的 bug 会进入回收站，等待管理员最终彻底删除。',
    surfaces: ['Bug 详情页', 'Bug 列表回收站'],
    apis: ['POST /bugs/:id/delete', 'DELETE /bugs/:id/permanent']
  },
  {
    code: Permission.MANAGE_SYSTEMS,
    zhName: '系统管理',
    enName: 'Manage Systems',
    group: '后台管理',
    summary: '允许维护被跟踪的系统列表。',
    description: '可在管理后台创建、编辑、删除系统，用于 bug 归属和筛选。',
    surfaces: ['管理后台 / 系统'],
    apis: ['GET /systems', 'POST /systems', 'PATCH /systems/:id', 'DELETE /systems/:id']
  },
  {
    code: Permission.MANAGE_ROLES,
    zhName: '角色管理',
    enName: 'Manage Roles',
    group: '后台管理',
    summary: '允许维护角色与权限配置。',
    description: '可在角色权限中心创建角色、调整权限、导入导出角色配置，并查看权限目录详情。',
    surfaces: ['管理后台 / 角色权限中心'],
    apis: ['GET /roles', 'POST /roles', 'PATCH /roles/:id', 'DELETE /roles/:id', 'POST /roles/import']
  },
  {
    code: Permission.MANAGE_USERS,
    zhName: '用户管理',
    enName: 'Manage Users',
    group: '后台管理',
    summary: '允许审批和维护用户账号。',
    description: '可管理用户状态、分配角色、切换管理员标记，并处理待审批用户。',
    surfaces: ['管理后台 / 用户'],
    apis: ['GET /users', 'PATCH /users/:id/*']
  }
];

export const PERMISSION_CODES = new Set(PERMISSION_CATALOG.map((item) => item.code));
