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
    code: Permission.DELETE_BUG_ACTIVITY,
    zhName: '删除活动记录',
    enName: 'Delete Bug Activity',
    group: 'Bug 生命周期',
    summary: '允许删除 bug 详情页中的活动记录。',
    description: '可在 bug 详情页移除指定活动记录。默认不分配给普通角色，系统管理员可直接拥有该权限。',
    surfaces: ['Bug 详情页 / 活动记录'],
    apis: ['DELETE /bugs/:id/activities/:activityId']
  },
  {
    code: Permission.CREATE_FEATURE,
    zhName: '登记功能',
    enName: 'Create Feature',
    group: '功能管理',
    summary: '允许登记新的功能需求。',
    description: '可访问功能登记页，提交功能标题、描述与优先级等初始信息。',
    surfaces: ['功能列表', '登记功能页面'],
    apis: ['POST /features']
  },
  {
    code: Permission.UPDATE_FEATURE,
    zhName: '更新功能',
    enName: 'Update Feature',
    group: '功能管理',
    summary: '允许编辑功能信息与状态。',
    description: '可编辑功能内容、状态等基础信息。',
    surfaces: ['功能详情页', '功能编辑页'],
    apis: [
      'PATCH /features/:id',
      'PATCH /features/:id/status',
      'POST /features/:id/personnel/join',
      'POST /features/:id/implementation-items',
      'PATCH /features/:id/implementation-items/:itemId',
      'PATCH /features/:id/implementation-items/:itemId/status',
      'DELETE /features/:id/implementation-items/:itemId'
    ]
  },
  {
    code: Permission.ADD_FEATURE_EVIDENCE,
    zhName: '补充功能证据',
    enName: 'Add Feature Evidence',
    group: '功能管理',
    summary: '允许为功能上传截图证据。',
    description: '可为功能新增截图等辅助信息，并管理自己可操作的截图记录。',
    surfaces: ['功能详情页'],
    apis: ['POST /features/:id/screenshots', 'DELETE /features/:id/screenshots/:screenshotId']
  },
  {
    code: Permission.DELETE_FEATURE,
    zhName: '删除功能',
    enName: 'Delete Feature',
    group: '功能管理',
    summary: '允许软删除功能记录。',
    description: '普通角色可软删除自己创建的功能；管理员可彻底删除。',
    surfaces: ['功能列表', '功能详情页'],
    apis: ['POST /features/:id/delete', 'DELETE /features/:id/permanent']
  },
  {
    code: Permission.DELETE_FEATURE_ACTIVITY,
    zhName: '删除功能活动记录',
    enName: 'Delete Feature Activity',
    group: '功能管理',
    summary: '允许删除功能详情页中的活动记录。',
    description: '可在功能详情页移除指定活动记录。默认不分配给普通角色，系统管理员可直接拥有该权限。',
    surfaces: ['功能详情页 / 活动记录'],
    apis: ['DELETE /features/:id/activities/:activityId']
  },
  {
    code: Permission.VIEW_STATS,
    zhName: '查看 KPI 统计',
    enName: 'View KPI Stats',
    group: '数据分析',
    summary: '允许访问团队 KPI 与效率统计页。',
    description: '可查看各成员 bug/功能处理量、负责项目数、平均修复时长等汇总指标。',
    surfaces: ['KPI 统计页'],
    apis: ['GET /stats/kpi']
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
  },
  {
    code: Permission.DELETE_DISABLED_USER,
    zhName: '删除已禁用用户',
    enName: 'Delete Disabled User',
    group: '后台管理',
    summary: '允许永久删除已禁用的用户账号。',
    description:
      '可在用户管理页彻底删除 status 为 DISABLED 的账号。若用户仍有关联的 Bug/功能创建或活动记录则无法删除。不能删除自己。',
    surfaces: ['管理后台 / 用户'],
    apis: ['DELETE /users/:id']
  },
  {
    code: Permission.BECOME_ITEM_OWNER,
    zhName: '成为负责人',
    enName: 'Become Item Owner',
    group: '人员分配',
    summary: '允许将自己设为 Bug/功能的负责人。',
    description: '可在 Bug 或功能详情页自荐成为总负责人，也可自行卸任当前负责人身份。',
    surfaces: ['Bug 详情页', '功能详情页'],
    apis: ['POST /bugs/:id/personnel/claim-owner', 'POST /features/:id/personnel/claim-owner']
  },
  {
    code: Permission.DELEGATE_ITEM_RELATED,
    zhName: '委派相关人',
    enName: 'Delegate Related Personnel',
    group: '人员分配',
    summary: '允许委派他人成为 Bug/功能的相关人员。',
    description: '可在 Bug 或功能详情页添加或移除相关人员；相关人员也可自行退出。',
    surfaces: ['Bug 详情页', '功能详情页'],
    apis: ['PATCH /bugs/:id/personnel', 'PATCH /features/:id/personnel']
  },
  {
    code: Permission.DELEGATE_ITEM_OWNER,
    zhName: '委派负责人',
    enName: 'Delegate Item Owner',
    group: '人员分配',
    summary: '允许委派他人成为 Bug/功能的负责人。',
    description: '可在 Bug 或功能详情页指定或撤销 Bug/功能的总负责人。',
    surfaces: ['Bug 详情页', '功能详情页'],
    apis: ['PATCH /bugs/:id/personnel', 'PATCH /features/:id/personnel']
  }
];

export const PERMISSION_CODES = new Set(PERMISSION_CATALOG.map((item) => item.code));
