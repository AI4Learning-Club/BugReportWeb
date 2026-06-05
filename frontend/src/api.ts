import { ApiError } from './errorUtils';

function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  const isLocalVite =
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    /^517\d$/.test(window.location.port);
  if (isLocalVite) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return window.location.origin;
}

export const API_BASE = resolveApiBase();

export function assetUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${normalizedPath}`;
}

export type Permission =
  | 'CREATE_BUG'
  | 'RETEST_BUG'
  | 'MARK_BUG_FIXED'
  | 'ADD_BUG_EVIDENCE'
  | 'DELETE_BUG'
  | 'DELETE_BUG_ACTIVITY'
  | 'CREATE_FEATURE'
  | 'UPDATE_FEATURE'
  | 'DELETE_FEATURE'
  | 'DELETE_FEATURE_ACTIVITY'
  | 'ADD_FEATURE_EVIDENCE'
  | 'VIEW_STATS'
  | 'MANAGE_SYSTEMS'
  | 'MANAGE_ROLES'
  | 'MANAGE_USERS'
  | 'DELETE_DISABLED_USER'
  | 'BECOME_ITEM_OWNER'
  | 'DELEGATE_ITEM_RELATED'
  | 'DELEGATE_ITEM_OWNER';

export type Role = {
  id: string;
  name: string;
  permissions: Permission[];
  userCount?: number;
  permissionCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type User = {
  id: string;
  username: string;
  displayName: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  isAdmin: boolean;
  role: Role | null;
};

export type AssignableUser = Pick<User, 'id' | 'username' | 'displayName'>;

export type TrackedSystem = {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  versionInfo: string | null;
  deletedAt: string | null;
};

export type BugStatus = 'OPEN' | 'FIXED';
export type FeatureStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE';
export type ImplementationItemStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE';

export type PersonnelPatchBody = {
  ownerId?: string | null;
  addRelatedUserIds?: string[];
  removeRelatedUserIds?: string[];
};

export type BugActivityChange = {
  field: string;
  from: string | null;
  to: string | null;
};

export type BugActivityContext = Record<string, string | number | boolean | null>;

export type BugActivity = {
  id: string;
  type:
    | 'CREATED'
    | 'UPDATED'
    | 'STATUS_CHANGED'
    | 'DELETED'
    | 'SCREENSHOT_ADDED'
    | 'SCREENSHOT_REMOVED'
    | 'RUNTIME_INFO_ADDED'
    | 'RUNTIME_INFO_UPDATED'
    | 'RUNTIME_INFO_REMOVED'
    | 'RETEST_RECORDED'
    | 'OWNER_CLAIMED'
    | 'OWNER_DELEGATED'
    | 'OWNER_REVOKED'
    | 'RELATED_JOINED'
    | 'RELATED_ADDED'
    | 'RELATED_REMOVED';
  note: string | null;
  fromStatus: BugStatus | null;
  toStatus: BugStatus | null;
  changes: BugActivityChange[] | null;
  context: BugActivityContext | null;
  createdAt: string;
  actor: AssignableUser;
};

export type BugItem = {
  id: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: BugStatus;
  environment: string | null;
  steps: string | null;
  expected: string | null;
  actual: string | null;
  system: TrackedSystem;
  creator: AssignableUser;
  owner: AssignableUser | null;
  relatedUsers: AssignableUser[];
  fixedBy: AssignableUser | null;
  fixedAt: string | null;
  deletedBy: AssignableUser | null;
  deletedAt: string | null;
  deleteReason: string | null;
  screenshots: Screenshot[];
  runtimeInfos: RuntimeInfo[];
  retests: Retest[];
  screenshotCount: number;
  runtimeInfoCount: number;
  appearedCount: number;
  notAppearedCount: number;
  createdAt: string;
  updatedAt: string;
};

export type BugDetail = BugItem & {
  activities: BugActivity[];
};

export type FeatureActivityChange = {
  field: string;
  from: string | null;
  to: string | null;
};

export type FeatureActivityContext = Record<string, string | number | boolean | null>;

export type FeatureActivity = {
  id: string;
  type:
    | 'CREATED'
    | 'UPDATED'
    | 'STATUS_CHANGED'
    | 'DELETED'
    | 'SCREENSHOT_ADDED'
    | 'SCREENSHOT_REMOVED'
    | 'IMPLEMENTATION_ITEM_ADDED'
    | 'IMPLEMENTATION_ITEM_UPDATED'
    | 'IMPLEMENTATION_ITEM_REMOVED'
    | 'IMPLEMENTATION_ITEM_STATUS_CHANGED'
    | 'OWNER_CLAIMED'
    | 'OWNER_DELEGATED'
    | 'OWNER_REVOKED'
    | 'RELATED_JOINED'
    | 'RELATED_ADDED'
    | 'RELATED_REMOVED';
  note: string | null;
  fromStatus: FeatureStatus | null;
  toStatus: FeatureStatus | null;
  changes: FeatureActivityChange[] | null;
  context: FeatureActivityContext | null;
  createdAt: string;
  actor: AssignableUser;
};

export type ImplementationItem = {
  id: string;
  featureId: string;
  sortOrder: number;
  title: string;
  note: string | null;
  status: ImplementationItemStatus;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  completedAt: string | null;
  owner: AssignableUser | null;
  createdAt: string;
  updatedAt: string;
};

export type FeatureItem = {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  priority: BugItem['severity'];
  system: TrackedSystem;
  creator: AssignableUser;
  owner: AssignableUser | null;
  relatedUsers: AssignableUser[];
  completedBy: AssignableUser | null;
  completedAt: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  effectivePlannedStartAt: string | null;
  effectivePlannedEndAt: string | null;
  progressPercent: number | null;
  implementationItemCount: number;
  implementationItemDoneCount: number;
  screenshotCount: number;
  deletedBy: AssignableUser | null;
  deletedAt: string | null;
  deleteReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeatureDetail = FeatureItem & {
  screenshots?: Screenshot[];
  implementationItems?: ImplementationItem[];
  activities: FeatureActivity[];
};

export function normalizeFeatureItem(feature: FeatureItem | FeatureDetail): FeatureItem {
  const detail = feature as FeatureDetail;
  const items = detail.implementationItems ?? [];
  const doneCount =
    feature.implementationItemDoneCount ??
    items.filter((item) => item.status === 'DONE').length;
  const itemCount = feature.implementationItemCount ?? items.length;

  return {
    ...feature,
    screenshotCount: feature.screenshotCount ?? detail.screenshots?.length ?? 0,
    implementationItemCount: itemCount,
    implementationItemDoneCount: doneCount,
    progressPercent:
      feature.progressPercent ??
      (itemCount > 0 ? Math.round((doneCount / itemCount) * 100) : null),
    plannedStartAt: feature.plannedStartAt ?? null,
    plannedEndAt: feature.plannedEndAt ?? null,
    effectivePlannedStartAt: feature.effectivePlannedStartAt ?? feature.plannedStartAt ?? null,
    effectivePlannedEndAt: feature.effectivePlannedEndAt ?? feature.plannedEndAt ?? null
  };
}

export function normalizeFeatureDetail(feature: FeatureDetail): FeatureDetail {
  const items = feature.implementationItems ?? [];
  const screenshots = feature.screenshots ?? [];
  const normalized = normalizeFeatureItem({
    ...feature,
    implementationItems: items,
    screenshots
  });

  return {
    ...normalized,
    screenshots,
    implementationItems: items,
    activities: feature.activities ?? []
  };
}

export type FeatureGanttEntry = Pick<
  FeatureItem,
  | 'id'
  | 'title'
  | 'status'
  | 'system'
  | 'owner'
  | 'plannedStartAt'
  | 'plannedEndAt'
  | 'effectivePlannedStartAt'
  | 'effectivePlannedEndAt'
  | 'progressPercent'
  | 'implementationItemCount'
  | 'implementationItemDoneCount'
> & {
  implementationItems: ImplementationItem[];
};

export type Screenshot = {
  id: string;
  path: string;
  originalName: string;
  caption: string | null;
  uploaderId: string;
};

export type RuntimeInfo = {
  id: string;
  title: string;
  environment: string | null;
  logText: string;
  authorId: string;
  author?: AssignableUser;
};

export type Retest = {
  id: string;
  userId: string;
  result: 'APPEARED' | 'NOT_APPEARED';
  note: string | null;
};

export type KpiPersonStats = {
  user: AssignableUser;
  bugsCreated: number;
  bugsFixed: number;
  avgFixHours: number | null;
  featuresCreated: number;
  featuresCompleted: number;
  retestsSubmitted: number;
  retestsAppeared: number;
  bugsOwned: number;
  featuresOwned: number;
  openBugsOwned: number;
  openFeaturesOwned: number;
  workloadScore: number;
};

export type KpiOverview = {
  generatedAt: string;
  totals: {
    activeUsers: number;
    openBugs: number;
    fixedBugs: number;
    activeFeatures: number;
    doneFeatures: number;
  };
  people: KpiPersonStats[];
};

export type PermissionDefinition = {
  code: Permission;
  zhName: string;
  enName: string;
  group: string;
  summary: string;
  description: string;
  surfaces: string[];
  apis: string[];
};

export type RoleConfigDocument = {
  version: number;
  exportedAt?: string;
  roles: Array<Pick<Role, 'name' | 'permissions'>>;
};

export const ALL_PERMISSIONS: Permission[] = [
  'CREATE_BUG',
  'RETEST_BUG',
  'MARK_BUG_FIXED',
  'ADD_BUG_EVIDENCE',
  'DELETE_BUG',
  'DELETE_BUG_ACTIVITY',
  'CREATE_FEATURE',
  'UPDATE_FEATURE',
  'DELETE_FEATURE',
  'DELETE_FEATURE_ACTIVITY',
  'ADD_FEATURE_EVIDENCE',
  'VIEW_STATS',
  'MANAGE_SYSTEMS',
  'MANAGE_ROLES',
  'MANAGE_USERS',
  'DELETE_DISABLED_USER',
  'BECOME_ITEM_OWNER',
  'DELEGATE_ITEM_RELATED',
  'DELEGATE_ITEM_OWNER'
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  CREATE_BUG: '创建 bug',
  RETEST_BUG: '复测 bug',
  MARK_BUG_FIXED: '标记修复',
  ADD_BUG_EVIDENCE: '补充证据',
  DELETE_BUG: '删除 bug',
  DELETE_BUG_ACTIVITY: '删除活动记录',
  CREATE_FEATURE: '登记功能',
  UPDATE_FEATURE: '更新功能',
  DELETE_FEATURE: '删除功能',
  DELETE_FEATURE_ACTIVITY: '删除功能活动记录',
  ADD_FEATURE_EVIDENCE: '补充功能证据',
  VIEW_STATS: '查看 KPI 统计',
  MANAGE_SYSTEMS: '系统管理',
  MANAGE_ROLES: '角色管理',
  MANAGE_USERS: '用户管理',
  DELETE_DISABLED_USER: '删除已禁用用户',
  BECOME_ITEM_OWNER: '成为负责人',
  DELEGATE_ITEM_RELATED: '委派相关人',
  DELEGATE_ITEM_OWNER: '委派负责人'
};

export async function api<T>(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('bug-report-token');
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error('无法连接后端服务');
  }
  if (!response.ok) {
    const text = await response.text();
    let message: string | string[] = response.statusText || '请求失败';
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      if (parsed.message) {
        message = parsed.message;
      }
    } catch {
      if (text) message = text;
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) {
    return null as T;
  }
  return response.json() as Promise<T>;
}

export function hasPermission(user: User | null, permission: Permission) {
  return Boolean(user?.isAdmin || user?.role?.permissions.includes(permission));
}

export function joinBugPersonnel(bugId: string) {
  return api<BugDetail>(`/bugs/${bugId}/personnel/join`, { method: 'POST' });
}

export function claimBugOwner(bugId: string) {
  return api<BugDetail>(`/bugs/${bugId}/personnel/claim-owner`, { method: 'POST' });
}

export function patchBugPersonnel(bugId: string, body: PersonnelPatchBody) {
  return api<BugDetail>(`/bugs/${bugId}/personnel`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

export function joinFeaturePersonnel(featureId: string) {
  return api<FeatureItem>(`/features/${featureId}/personnel/join`, { method: 'POST' });
}

export function claimFeatureOwner(featureId: string) {
  return api<FeatureItem>(`/features/${featureId}/personnel/claim-owner`, { method: 'POST' });
}

export function patchFeaturePersonnel(featureId: string, body: PersonnelPatchBody) {
  return api<FeatureItem>(`/features/${featureId}/personnel`, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}
