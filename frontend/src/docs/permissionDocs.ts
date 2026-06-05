import type { Permission } from '../api';
import { PERMISSION_LABELS } from '../api';

export type PermissionDoc = {
  code: Permission;
  group: string;
  summary: string;
  apis: string[];
};

/** 文档用权限摘要（与后端 permission-catalog 对齐） */
export const PERMISSION_DOCS: PermissionDoc[] = [
  {
    code: 'CREATE_BUG',
    group: 'Bug 生命周期',
    summary: '登记新的 Bug 记录',
    apis: ['POST /bugs']
  },
  {
    code: 'RETEST_BUG',
    group: 'Bug 生命周期',
    summary: '提交 Bug 复测结果',
    apis: ['POST /bugs/:id/retests']
  },
  {
    code: 'MARK_BUG_FIXED',
    group: 'Bug 生命周期',
    summary: '切换 Bug 修复状态',
    apis: ['PATCH /bugs/:id/status']
  },
  {
    code: 'ADD_BUG_EVIDENCE',
    group: '证据管理',
    summary: '上传截图与运行信息',
    apis: ['POST /bugs/:id/screenshots', 'POST /bugs/:id/runtime-info']
  },
  {
    code: 'DELETE_BUG',
    group: 'Bug 生命周期',
    summary: '软删除 Bug',
    apis: ['POST /bugs/:id/delete']
  },
  {
    code: 'DELETE_BUG_ACTIVITY',
    group: 'Bug 生命周期',
    summary: '删除 Bug 活动记录',
    apis: ['DELETE /bugs/:id/activities/:activityId']
  },
  {
    code: 'CREATE_FEATURE',
    group: '功能管理',
    summary: '登记功能需求',
    apis: ['POST /features']
  },
  {
    code: 'UPDATE_FEATURE',
    group: '功能管理',
    summary: '编辑功能与状态',
    apis: ['PATCH /features/:id', 'PATCH /features/:id/status']
  },
  {
    code: 'DELETE_FEATURE',
    group: '功能管理',
    summary: '软删除功能',
    apis: ['POST /features/:id/delete']
  },
  {
    code: 'DELETE_FEATURE_ACTIVITY',
    group: '功能管理',
    summary: '删除功能活动记录',
    apis: ['DELETE /features/:id/activities/:activityId']
  },
  {
    code: 'VIEW_STATS',
    group: '数据分析',
    summary: '查看 KPI 统计',
    apis: ['GET /stats/kpi']
  },
  {
    code: 'MANAGE_SYSTEMS',
    group: '后台管理',
    summary: '维护被跟踪系统',
    apis: ['POST /systems', 'PATCH /systems/:id', 'DELETE /systems/:id']
  },
  {
    code: 'MANAGE_ROLES',
    group: '后台管理',
    summary: '角色与权限配置',
    apis: ['GET /roles/export', 'POST /roles/import', 'POST/PATCH/DELETE /roles*']
  },
  {
    code: 'MANAGE_USERS',
    group: '后台管理',
    summary: '用户审批与账号维护',
    apis: ['GET /users', 'PATCH /users/:id/*']
  },
  {
    code: 'BECOME_ITEM_OWNER',
    group: '人员分配',
    summary: '自荐成为负责人',
    apis: ['POST /bugs/:id/personnel/claim-owner', 'POST /features/:id/personnel/claim-owner']
  },
  {
    code: 'DELEGATE_ITEM_RELATED',
    group: '人员分配',
    summary: '委派 / 移除相关人',
    apis: ['PATCH /bugs/:id/personnel', 'PATCH /features/:id/personnel']
  },
  {
    code: 'DELEGATE_ITEM_OWNER',
    group: '人员分配',
    summary: '委派 / 撤销负责人',
    apis: ['PATCH /bugs/:id/personnel', 'PATCH /features/:id/personnel']
  }
];

export function permissionLabel(code: string) {
  return PERMISSION_LABELS[code as Permission] ?? code;
}
