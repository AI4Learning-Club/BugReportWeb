function resolveApiBase() {
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  if (window.location.port === '5173') {
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
  | 'MANAGE_SYSTEMS'
  | 'MANAGE_ROLES'
  | 'MANAGE_USERS';

export type Role = {
  id: string;
  name: string;
  permissions: Permission[];
};

export type User = {
  id: string;
  username: string;
  displayName: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  isAdmin: boolean;
  role: Role | null;
};

export type TrackedSystem = {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  versionInfo: string | null;
  deletedAt: string | null;
};

export type BugStatus = 'OPEN' | 'FIXED';

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
    | 'SCREENSHOT_ADDED'
    | 'SCREENSHOT_REMOVED'
    | 'RUNTIME_INFO_ADDED'
    | 'RUNTIME_INFO_UPDATED'
    | 'RUNTIME_INFO_REMOVED'
    | 'RETEST_RECORDED';
  note: string | null;
  fromStatus: BugStatus | null;
  toStatus: BugStatus | null;
  changes: BugActivityChange[] | null;
  context: BugActivityContext | null;
  createdAt: string;
  actor: Pick<User, 'id' | 'username' | 'displayName'>;
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
  creator: Pick<User, 'id' | 'username' | 'displayName'>;
  fixedBy: Pick<User, 'id' | 'username' | 'displayName'> | null;
  fixedAt: string | null;
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
  author?: Pick<User, 'id' | 'username' | 'displayName'>;
};

export type Retest = {
  id: string;
  userId: string;
  result: 'APPEARED' | 'NOT_APPEARED';
  note: string | null;
};

export const ALL_PERMISSIONS: Permission[] = [
  'CREATE_BUG',
  'RETEST_BUG',
  'MARK_BUG_FIXED',
  'ADD_BUG_EVIDENCE',
  'MANAGE_SYSTEMS',
  'MANAGE_ROLES',
  'MANAGE_USERS'
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  CREATE_BUG: '创建 bug',
  RETEST_BUG: '复测 bug',
  MARK_BUG_FIXED: '标记修复',
  ADD_BUG_EVIDENCE: '补充证据',
  MANAGE_SYSTEMS: '系统管理',
  MANAGE_ROLES: '角色管理',
  MANAGE_USERS: '用户管理'
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
    throw new Error(`无法连接后端服务：${API_BASE}`);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText);
  }
  if (response.status === 204) {
    return null as T;
  }
  return response.json() as Promise<T>;
}

export function hasPermission(user: User | null, permission: Permission) {
  return Boolean(user?.isAdmin || user?.role?.permissions.includes(permission));
}
