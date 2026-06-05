import {
  ArrowLeft,
  Archive,
  BarChart3,
  BookOpen,
  Bug,
  CheckCircle2,
  ClipboardList,
  Eye,
  Layers,
  LogOut,
  Pencil,
  Plus,
  Save,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Upload
} from 'lucide-react';
import { FormEvent, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AssignableUser,
  BugActivity,
  BugDetail,
  BugItem,
  BugStatus,
  FeatureActivity,
  FeatureDetail,
  FeatureItem,
  FeatureStatus,
  KpiOverview,
  PermissionDefinition,
  Role,
  TrackedSystem,
  User,
  api,
  assetUrl,
  hasPermission
} from './api';
import {
  ActivityDetailDialog,
  ActivityListDialog,
  BugActivityDeleteDialog,
  BugDeleteDialog,
  BugStatusDialog,
  ConfirmDeleteDialog,
  CreateSystemDialog,
  EvidenceUploadDialog,
  FeatureActivityDeleteDialog,
  FeatureStatusDialog,
  RuntimeInfoDialog,
  UserManageDialog
} from './AppDialogs';
import { ActivityPanel, ItemActivity, formatDateTime } from './activityUtils';
import { BugRetestDialog, PersonnelPanel } from './PersonnelPanel';
import { RoleAdminPanel } from './RoleAdminPanel';
import DocsPage from './docs/DocsPage';
import { RuntimeInfoFields } from './RuntimeInfoFields';
import { readError } from './errorUtils';
import { notifyError } from './ToastProvider';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

type BugDraft = {
  systemId: string;
  title: string;
  description: string;
  severity: BugItem['severity'];
  environment: string;
  steps: string;
  expected: string;
  actual: string;
};

type SystemDraft = Pick<TrackedSystem, 'name' | 'description' | 'owner' | 'versionInfo'>;

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('AuthContext is missing');
  }
  return value;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    const token = localStorage.getItem('bug-report-token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<User>('/auth/me'));
    } catch {
      localStorage.removeItem('bug-report-token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(username: string, password: string) {
    const result = await api<{ accessToken: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    localStorage.setItem('bug-report-token', result.accessToken);
    setUser(result.user);
  }

  function logout() {
    localStorage.removeItem('bug-report-token');
    setUser(null);
  }

  useEffect(() => {
    void refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/docs/*" element={<DocsPage />} />
        <Route path="/" element={<Protected><Shell><Dashboard /></Shell></Protected>} />
        <Route path="/bugs/new" element={<Protected><Shell><NewBugPage /></Shell></Protected>} />
        <Route path="/bugs/:id/edit" element={<Protected><Shell><BugEditPage /></Shell></Protected>} />
        <Route path="/bugs/:id" element={<Protected><Shell><BugDetailPage /></Shell></Protected>} />
        <Route path="/admin/systems/:id/edit" element={<Protected><Shell><SystemEditPage /></Shell></Protected>} />
        <Route path="/features" element={<Protected><Shell><FeatureDashboard /></Shell></Protected>} />
        <Route path="/features/new" element={<Protected><Shell><NewFeaturePage /></Shell></Protected>} />
        <Route path="/features/:id/edit" element={<Protected><Shell><FeatureEditPage /></Shell></Protected>} />
        <Route path="/features/:id" element={<Protected><Shell><FeatureDetailPage /></Shell></Protected>} />
        <Route path="/stats" element={<Protected><Shell><StatsPage /></Shell></Protected>} />
        <Route path="/admin" element={<Protected><Shell><AdminPage /></Shell></Protected>} />
      </Routes>
    </AuthProvider>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="center-screen">加载中</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const canAdmin = Boolean(
    user?.isAdmin ||
      hasPermission(user, 'MANAGE_SYSTEMS') ||
      hasPermission(user, 'MANAGE_ROLES') ||
      hasPermission(user, 'MANAGE_USERS')
  );
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/features') {
      return location.pathname === '/features' || (location.pathname.startsWith('/features/') && location.pathname !== '/features/new');
    }
    if (path === '/docs') {
      return location.pathname === '/docs' || location.pathname.startsWith('/docs/');
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <Layers size={22} />
          <span>SystemController</span>
        </Link>
        <nav className="nav">
          <Link className={isActive('/') ? 'active' : undefined} to="/"><ClipboardList size={18} />Bug 列表</Link>
          {hasPermission(user, 'CREATE_BUG') && <Link className={isActive('/bugs/new') ? 'active' : undefined} to="/bugs/new"><Plus size={18} />登记 bug</Link>}
          <Link className={isActive('/features') ? 'active' : undefined} to="/features"><Sparkles size={18} />功能列表</Link>
          {hasPermission(user, 'CREATE_FEATURE') && <Link className={isActive('/features/new') ? 'active' : undefined} to="/features/new"><Plus size={18} />登记功能</Link>}
          {hasPermission(user, 'VIEW_STATS') && <Link className={isActive('/stats') ? 'active' : undefined} to="/stats"><BarChart3 size={18} />KPI 统计</Link>}
          {canAdmin && <Link className={isActive('/admin') ? 'active' : undefined} to="/admin"><Settings size={18} />管理后台</Link>}
          <Link className={isActive('/docs') ? 'active' : undefined} to="/docs"><BookOpen size={18} />API 文档</Link>
        </nav>
        <div className="profile">
          <div>
            <strong>{user?.displayName}</strong>
            <span>{user?.isAdmin ? '管理员' : user?.role?.name ?? '未分配角色'}</span>
          </div>
          <button className="icon-button" onClick={logout} title="退出登录">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      <main className="content" key={location.pathname}>{children}</main>
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch (error) {
      notifyError(readError(error));
    }
  }

  return (
    <AuthFrame title="登录">
      <form className="stack" onSubmit={submit}>
        <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="primary" type="submit">登录</button>
        <Link className="text-link" to="/register">注册账号</Link>
      </form>
    </AuthFrame>
  );
}

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', displayName: '', password: '' });
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const result = await api<{ message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setMessage(result.message);
    } catch (error) {
      notifyError(readError(error));
    }
  }

  return (
    <AuthFrame title="注册">
      <form className="stack" onSubmit={submit}>
        <label>用户名<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
        <label>显示名<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
        <label>密码<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        {message && <p className="success">{message}</p>}
        <button className="primary" type="submit">提交注册</button>
        <button className="ghost" type="button" onClick={() => navigate('/login')}>返回登录</button>
      </form>
    </AuthFrame>
  );
}

function AuthFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className="auth-mark"><Shield size={28} /></div>
        <h1>{title}</h1>
        {children}
      </section>
    </div>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const [bugs, setBugs] = useState<BugItem[]>([]);
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [systemId, setSystemId] = useState('');
  const [status, setStatus] = useState('');
  const [participantUserId, setParticipantUserId] = useState('');
  const [deleted, setDeleted] = useState<'active' | 'only' | 'all'>('active');
  const [deleteDialog, setDeleteDialog] = useState<{ bug: BugItem; mode: 'soft' | 'permanent' } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const canCreateBug = hasPermission(user, 'CREATE_BUG');
  const canViewRecycleBin = Boolean(user?.isAdmin);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (systemId) params.set('systemId', systemId);
      if (status) params.set('status', status);
      if (deleted !== 'active') params.set('deleted', deleted);
      if (participantUserId) params.set('participantUserId', participantUserId);
      setBugs(await api<BugItem[]>(`/bugs?${params.toString()}`));
    } catch (error) {
      notifyError(readError(error));
    }
  }

  useEffect(() => {
    void api<TrackedSystem[]>('/systems').then(setSystems);
    void api<AssignableUser[]>('/auth/assignable-users').then(setAssignableUsers).catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
  }, [systemId, status, deleted, participantUserId]);

  function handleBugAction(bug: BugItem, action: 'delete' | 'permanent-delete') {
    if (action === 'delete') {
      setDeleteDialog({ bug, mode: 'soft' });
      return;
    }
    setDeleteDialog({ bug, mode: 'permanent' });
  }

  async function confirmDeleteDialog(reason: string) {
    if (!deleteDialog) {
      return;
    }
    setDeleteSubmitting(true);
    try {
      if (deleteDialog.mode === 'soft') {
        await api(`/bugs/${deleteDialog.bug.id}/delete`, { method: 'POST', body: JSON.stringify({ reason }) });
      } else {
        await api(`/bugs/${deleteDialog.bug.id}/permanent`, { method: 'DELETE' });
      }
      setDeleteDialog(null);
      await load();
    } catch (error) {
      notifyError(readError(error));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={deleted === 'only' ? 'Bug 回收站' : 'Bug 列表'}
        action={
          canCreateBug ? <Link className="primary compact" to="/bugs/new"><Plus size={16} />登记 bug</Link> : undefined
        }
      />
      <div className="toolbar">
        <select value={systemId} onChange={(event) => setSystemId(event.target.value)}>
          <option value="">全部系统</option>
          {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="OPEN">未修复</option>
          <option value="FIXED">已修复</option>
        </select>
        <select value={participantUserId} onChange={(event) => setParticipantUserId(event.target.value)}>
          <option value="">全部相关人员</option>
          {assignableUsers.map((person) => (
            <option key={person.id} value={person.id}>{person.displayName}</option>
          ))}
        </select>
        {canViewRecycleBin && (
          <select value={deleted} onChange={(event) => setDeleted(event.target.value as 'active' | 'only' | 'all')}>
            <option value="active">仅正常数据</option>
            <option value="only">仅回收站</option>
            <option value="all">全部数据</option>
          </select>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>标题</th>
              <th>系统</th>
              <th>状态</th>
              <th>创建人</th>
              <th>负责人</th>
              <th>截图</th>
              <th>运行信息</th>
              <th>确认出现</th>
              <th>未出现</th>
              {deleted !== 'active' && <th>删除信息</th>}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {bugs.map((bug) => {
              const canEditBug = Boolean(!bug.deletedAt && (user?.isAdmin || bug.creator.id === user?.id));
              const canSoftDeleteBug = Boolean(
                !bug.deletedAt &&
                hasPermission(user, 'DELETE_BUG') &&
                (user?.isAdmin || bug.creator.id === user?.id)
              );
              const canPermanentDeleteBug = Boolean(bug.deletedAt && user?.isAdmin);
              return (
                <tr key={bug.id}>
                  <td data-label="标题"><Link className="row-link" to={`/bugs/${bug.id}`}>{bug.title}</Link></td>
                  <td data-label="系统">{bug.system.name}</td>
                  <td data-label="状态"><StatusBadge status={bug.status} /></td>
                  <td data-label="创建人">{bug.creator.displayName}</td>
                  <td data-label="负责人">{bug.owner?.displayName ?? '未指定'}</td>
                  <td data-label="截图">{bug.screenshotCount}</td>
                  <td data-label="运行信息">{bug.runtimeInfoCount}</td>
                  <td data-label="确认出现">{bug.appearedCount}</td>
                  <td data-label="未出现">{bug.notAppearedCount}</td>
                  {deleted !== 'active' && (
                    <td data-label="删除信息">
                      {bug.deletedAt ? (
                        <div className="delete-meta">
                          <span>{bug.deletedBy?.displayName ?? '未知用户'}</span>
                          <span>{formatDateTime(bug.deletedAt)}</span>
                        </div>
                      ) : (
                        '未删除'
                      )}
                    </td>
                  )}
                  <td data-label="操作">
                    <div className="actions bug-row-actions">
                      {canEditBug && (
                        <Link className="ghost compact" to={`/bugs/${bug.id}/edit`}><Pencil size={16} />编辑</Link>
                      )}
                      {canSoftDeleteBug && (
                        <button
                          className="ghost compact danger"
                          type="button"
                          onClick={() => handleBugAction(bug, 'delete')}
                        >
                          <Trash2 size={16} />
                          删除
                        </button>
                      )}
                      {canPermanentDeleteBug && (
                        <button
                          className="ghost compact danger"
                          type="button"
                          onClick={() => handleBugAction(bug, 'permanent-delete')}
                        >
                          <Archive size={16} />
                          彻底删除
                        </button>
                      )}
                      <Link className="ghost compact" to={`/bugs/${bug.id}`}><Eye size={16} />详情</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {bugs.length === 0 && (
              <tr>
                <td colSpan={deleted !== 'active' ? 11 : 10} className="empty-cell">
                  {deleted === 'only' ? '回收站中暂无 bug。' : '暂无匹配的 bug。'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {deleteDialog && (
        <BugDeleteDialog
          mode={deleteDialog.mode}
          submitting={deleteSubmitting}
          title={deleteDialog.bug.title}
          onCancel={() => {
            if (!deleteSubmitting) {
              setDeleteDialog(null);
            }
          }}
          onConfirm={(reason) => void confirmDeleteDialog(reason)}
        />
      )}
    </>
  );
}

function NewBugPage() {
  const navigate = useNavigate();
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [selectedScreenshots, setSelectedScreenshots] = useState<Array<{ id: string; file: File; url: string }>>([]);
  const selectedScreenshotsRef = useRef(selectedScreenshots);
  const [runtimeInfos, setRuntimeInfos] = useState([{ title: '', environment: '', logText: '' }]);
  const [form, setForm] = useState({
    systemId: '',
    title: '',
    description: '',
    severity: 'MEDIUM',
    environment: '',
    steps: '',
    expected: '',
    actual: ''
  });

  useEffect(() => {
    void api<TrackedSystem[]>('/systems').then(setSystems);
  }, []);

  useEffect(() => {
    selectedScreenshotsRef.current = selectedScreenshots;
  }, [selectedScreenshots]);

  useEffect(() => {
    return () => {
      selectedScreenshotsRef.current.forEach((screenshot) => URL.revokeObjectURL(screenshot.url));
    };
  }, []);

  function addSelectedScreenshots(fileList: FileList | null) {
    if (!fileList) return;
    const screenshots = Array.from(fileList)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file)
      }));
    setSelectedScreenshots((current) => [...current, ...screenshots]);
  }

  function removeSelectedScreenshot(id: string) {
    setSelectedScreenshots((current) => {
      const removed = current.find((screenshot) => screenshot.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.url);
      }
      return current.filter((screenshot) => screenshot.id !== id);
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const bug = await api<BugItem>('/bugs', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          runtimeInfos: runtimeInfos.filter((item) => item.title.trim() && item.logText.trim())
        })
      });
      for (const screenshot of selectedScreenshots) {
        const data = new FormData();
        data.append('file', screenshot.file);
        await api(`/bugs/${bug.id}/screenshots`, { method: 'POST', body: data });
      }
      navigate(`/bugs/${bug.id}`);
    } catch (error) {
      notifyError(readError(error));
    }
  }

  return (
    <>
      <PageHeader title="登记 bug" />
      <form className="panel-form" onSubmit={submit}>
        <div className="grid two">
          <label>系统<select required value={form.systemId} onChange={(event) => setForm({ ...form, systemId: event.target.value })}>
            <option value="">选择系统</option>
            {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
          </select></label>
          <label>严重程度<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })}>
            <option value="LOW">低</option>
            <option value="MEDIUM">中</option>
            <option value="HIGH">高</option>
            <option value="CRITICAL">严重</option>
          </select></label>
        </div>
        <label>标题<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>描述<textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <div className="grid two">
          <label>运行环境<textarea value={form.environment} onChange={(event) => setForm({ ...form, environment: event.target.value })} /></label>
          <label>复现步骤<textarea value={form.steps} onChange={(event) => setForm({ ...form, steps: event.target.value })} /></label>
          <label>期望结果<textarea value={form.expected} onChange={(event) => setForm({ ...form, expected: event.target.value })} /></label>
          <label>实际结果<textarea value={form.actual} onChange={(event) => setForm({ ...form, actual: event.target.value })} /></label>
        </div>
        <label>截图<input type="file" accept="image/*" multiple onChange={(event) => {
          addSelectedScreenshots(event.target.files);
          event.currentTarget.value = '';
        }} /></label>
        {selectedScreenshots.length > 0 && (
          <div className="screenshots pending-screenshots">
            {selectedScreenshots.map((screenshot) => (
              <figure key={screenshot.id}>
                <img src={screenshot.url} alt={screenshot.file.name} />
                <figcaption>{screenshot.file.name}</figcaption>
                <button className="icon-button" type="button" onClick={() => removeSelectedScreenshot(screenshot.id)} title="移除截图">
                  <Trash2 size={16} />
                </button>
              </figure>
            ))}
          </div>
        )}
        <section className="subsection">
          <div className="subsection-header">
            <h3>程序运行信息</h3>
            <button className="ghost compact" type="button" onClick={() => setRuntimeInfos([...runtimeInfos, { title: '', environment: '', logText: '' }])}>
              <Plus size={16} />添加
            </button>
          </div>
          {runtimeInfos.map((info, index) => (
            <div className="runtime-editor" key={index}>
              <div className="runtime-editor-header">
                <span>运行信息 {index + 1}</span>
                <div className="runtime-editor-actions">
                  {runtimeInfos.length > 1 ? (
                    <button className="icon-button" type="button" onClick={() => setRuntimeInfos(runtimeInfos.filter((_, itemIndex) => itemIndex !== index))} title="删除运行信息">
                      <Trash2 size={16} />
                    </button>
                  ) : (
                    <span className="runtime-editor-action-placeholder" aria-hidden="true" />
                  )}
                </div>
              </div>
              <RuntimeInfoFields
                value={info}
                onChange={(next) => setRuntimeInfos(runtimeInfos.map((draft, itemIndex) => (itemIndex === index ? next : draft)))}
              />
            </div>
          ))}
        </section>
        <button className="primary" type="submit"><Save size={16} />保存</button>
      </form>
    </>
  );
}

function BugDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [loadFailed, setLoadFailed] = useState(false);
  const [bug, setBug] = useState<BugDetail | null>(null);
  const [activeRuntimeIndex, setActiveRuntimeIndex] = useState(0);
  const [retestDialogOpen, setRetestDialogOpen] = useState(false);
  const [retestDialogSubmitting, setRetestDialogSubmitting] = useState(false);
  const [runtimeDialogOpen, setRuntimeDialogOpen] = useState(false);
  const [runtimeDialogSubmitting, setRuntimeDialogSubmitting] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadDialogSubmitting, setUploadDialogSubmitting] = useState(false);
  const [activityListOpen, setActivityListOpen] = useState(false);
  const [activityDetailTarget, setActivityDetailTarget] = useState<ItemActivity | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogSubmitting, setStatusDialogSubmitting] = useState(false);
  const [softDeleteOpen, setSoftDeleteOpen] = useState(false);
  const [softDeleteSubmitting, setSoftDeleteSubmitting] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [permanentDeleteSubmitting, setPermanentDeleteSubmitting] = useState(false);
  const [activityDeleteTarget, setActivityDeleteTarget] = useState<BugActivity | null>(null);
  const [activityDeleteSubmitting, setActivityDeleteSubmitting] = useState(false);

  async function load() {
    if (!id) return;
    const nextBug = await api<BugDetail>('/bugs/' + id);
    setBug(nextBug);
  }

  useEffect(() => {
    void load().catch((loadError) => { setLoadFailed(true); notifyError(readError(loadError)); });
  }, [id]);

  useEffect(() => {
    setActiveRuntimeIndex(0);
  }, [id]);

  useEffect(() => {
    if (!bug) {
      return;
    }
    const lastRuntimeIndex = Math.max(0, bug.runtimeInfos.length - 1);
    if (activeRuntimeIndex > lastRuntimeIndex) {
      setActiveRuntimeIndex(lastRuntimeIndex);
    }
  }, [activeRuntimeIndex, bug]);

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      await load();
    } catch (actionError) {
      notifyError(readError(actionError));
    }
  }

  if (!bug) {
    return <div>{loadFailed ? '加载失败' : '加载中...'}</div>;
  }

  const canAddEvidence = hasPermission(user, 'ADD_BUG_EVIDENCE');
  const canRetest = hasPermission(user, 'RETEST_BUG') && bug.creator.id !== user?.id;
  const canChangeStatus = hasPermission(user, 'MARK_BUG_FIXED');
  const canEditBug = Boolean(!bug.deletedAt && (user?.isAdmin || bug.creator.id === user?.id));
  const canSoftDelete = Boolean(!bug.deletedAt && hasPermission(user, 'DELETE_BUG') && (user?.isAdmin || bug.creator.id === user?.id));
  const canPermanentDelete = Boolean(bug.deletedAt && user?.isAdmin);
  const canDeleteActivity = hasPermission(user, 'DELETE_BUG_ACTIVITY');
  const nextStatus: BugStatus = bug.status === 'FIXED' ? 'OPEN' : 'FIXED';
  const statusActionLabel = nextStatus === 'FIXED' ? '标记为已修复' : '重新打开 bug';
  const latestFixActivity =
    bug.activities.find((activity) => activity.type === 'STATUS_CHANGED' && activity.toStatus === 'FIXED') ?? null;
  const activeRuntimeInfo = bug.runtimeInfos[activeRuntimeIndex] ?? null;
  const runtimeCount = bug.runtimeInfos.length;

  return (
    <>
      <PageHeader
        title={bug.title}
        action={(
          <div className="actions">
            <Link className="ghost compact" to="/">
              <ArrowLeft size={16} />返回列表
            </Link>
            {canEditBug && (
              <Link className="ghost compact" to={'/bugs/' + bug.id + '/edit'}>
                <Pencil size={16} />编辑
              </Link>
            )}
            {canChangeStatus && !bug.deletedAt && (
              <button
                className="primary compact"
                type="button"
                onClick={() => {
                  setStatusDialogOpen(true);
                }}
              >
                <CheckCircle2 size={16} />
                {statusActionLabel}
              </button>
            )}
            {canRetest && !bug.deletedAt && (
              <button
                className="ghost compact"
                type="button"
                onClick={() => {
                  setRetestDialogOpen(true);
                }}
              >
                提交复测
              </button>
            )}
            {canSoftDelete && (
              <button
                className="ghost compact danger"
                type="button"
                onClick={() => {
                  setSoftDeleteOpen(true);
                }}
              >
                <Trash2 size={16} />
                移入回收站
              </button>
            )}
          </div>
        )}
      />
      {bug.deletedAt && (
        <section className="panel deleted-banner">
          <div>
            <strong>该 bug 已进入回收站</strong>
            <p>
              删除人：{bug.deletedBy?.displayName ?? '未知用户'} · 删除时间：{formatDateTime(bug.deletedAt)}
            </p>
            {bug.deleteReason && <p>删除原因：{bug.deleteReason}</p>}
          </div>
          {canPermanentDelete && (
            <button
              className="ghost compact danger"
              type="button"
              onClick={() => {
                setPermanentDeleteOpen(true);
              }}
            >
              <Archive size={16} />
              彻底删除
            </button>
          )}
        </section>
      )}
      <section className="bug-detail-layout">
        <div className="bug-detail-main">
          <section className="detail-grid bug-detail-top">
            <div className="panel bug-summary-panel">
              <div className="bug-summary-header">
                <div className="meta-row bug-summary-meta">
                  <StatusBadge status={bug.status} />
                  <span>系统：{bug.system.name}</span>
                  <span>创建人：{bug.creator.displayName}</span>
                  <span>严重程度：{severityLabel(bug.severity)}</span>
                </div>
              </div>
              <div className="detail-section-stack">
                <InfoBlock title="描述" value={bug.description} tone="primary" />
                <InfoBlock title="运行环境" value={bug.environment} />
                <InfoBlock title="复现步骤" value={bug.steps} />
                <InfoBlock title="期望结果" value={bug.expected} />
                <InfoBlock title="实际结果" value={bug.actual} />
                {bug.status === 'FIXED' && (
                  <div className="info-block info-block-fixed">
                    <strong>修复信息</strong>
                    <p>
                      {bug.fixedBy?.displayName ?? '未知用户'}
                      {' · '}
                      {bug.fixedAt ? formatDateTime(bug.fixedAt) : '时间未知'}
                    </p>
                    {latestFixActivity?.note && <p>{latestFixActivity.note}</p>}
                  </div>
                )}
                <PersonnelPanel
                  kind="bug"
                  entityId={bug.id}
                  owner={bug.owner}
                  relatedUsers={bug.relatedUsers}
                  disabled={Boolean(bug.deletedAt)}
                  onUpdated={load}
                  user={user}
                />
              </div>
              <div className="stats bug-detail-stats">
                <span>出现次数：{bug.appearedCount}</span>
                <span>未出现：{bug.notAppearedCount}</span>
              </div>
            </div>
            <div className="panel">
              <div className="panel-heading-row">
                <h2>截图</h2>
                {canAddEvidence && !bug.deletedAt && (
                  <button
                    className="ghost compact"
                    type="button"
                    onClick={() => {
                      setUploadDialogOpen(true);
                    }}
                  >
                    <Upload size={16} />上传截图
                  </button>
                )}
              </div>
              <div className="screenshots">
                {bug.screenshots.map((shot) => (
                  <figure key={shot.id}>
                    <img src={assetUrl(shot.path)} alt={shot.caption ?? shot.originalName} />
                    <figcaption>{shot.caption ?? shot.originalName}</figcaption>
                    {canAddEvidence && !bug.deletedAt && (
                      <button
                        className="icon-button"
                        onClick={() => mutate(() => api('/bugs/' + bug.id + '/screenshots/' + shot.id, { method: 'DELETE' }))}
                        title="删除截图"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </figure>
                ))}
                {bug.screenshots.length === 0 && <p className="muted">暂无截图</p>}
              </div>
            </div>
          </section>
          <section className="panel bug-runtime-panel">
            <div className="panel-heading-row">
              <h2>运行信息</h2>
              <div className="runtime-panel-actions">
                {runtimeCount > 0 && (
                  <div className="runtime-pager">
                    <span>{activeRuntimeIndex + 1} / {runtimeCount}</span>
                    <button
                      className="ghost compact"
                      type="button"
                      disabled={runtimeCount < 2}
                      onClick={() => setActiveRuntimeIndex((activeRuntimeIndex + runtimeCount - 1) % runtimeCount)}
                    >
                      上一个
                    </button>
                    <button
                      className="primary compact"
                      type="button"
                      disabled={runtimeCount < 2}
                      onClick={() => setActiveRuntimeIndex((activeRuntimeIndex + 1) % runtimeCount)}
                    >
                      下一个
                    </button>
                  </div>
                )}
                {canAddEvidence && !bug.deletedAt && (
                  <button
                    className="ghost compact"
                    type="button"
                    onClick={() => {
                      setRuntimeDialogOpen(true);
                    }}
                  >
                    <Plus size={16} />
                    添加
                  </button>
                )}
              </div>
            </div>
            <div className="runtime-carousel">
              {activeRuntimeInfo ? (
                <article key={activeRuntimeInfo.id} className="runtime-viewer">
                  <div className="runtime-summary-row">
                    <div className="runtime-title-block">
                      <span>标题</span>
                      <strong>{activeRuntimeInfo.title || '未命名运行信息'}</strong>
                    </div>
                    <div>
                      <span>提交人</span>
                      <strong>{activeRuntimeInfo.author?.displayName ?? '未知作者'}</strong>
                    </div>
                    {activeRuntimeInfo.environment && (
                      <div>
                        <span>环境说明</span>
                        <p>{activeRuntimeInfo.environment}</p>
                      </div>
                    )}
                    {canAddEvidence && !bug.deletedAt && (user?.isAdmin || activeRuntimeInfo.authorId === user?.id) && (
                      <button
                        className="icon-button"
                        onClick={() => mutate(() => api('/bugs/' + bug.id + '/runtime-info/' + activeRuntimeInfo.id, { method: 'DELETE' }))}
                        title="删除运行信息"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <div className="runtime-log-block">
                    <span>日志内容</span>
                    <pre>{activeRuntimeInfo.logText}</pre>
                  </div>
                </article>
              ) : (
                <div className="empty-state">暂无运行信息</div>
              )}
            </div>
          </section>
        </div>
        <ActivityPanel
          activities={bug.activities}
          kind="bug"
          onOpenDetail={setActivityDetailTarget}
          onViewAll={() => setActivityListOpen(true)}
        />
      </section>
      {retestDialogOpen && (
        <BugRetestDialog
          submitting={retestDialogSubmitting}
          onClose={() => {
            if (!retestDialogSubmitting) {
              setRetestDialogOpen(false);
            }
          }}
          onConfirm={async (payload) => {
            setRetestDialogSubmitting(true);
            try {
              await api('/bugs/' + bug.id + '/retests', { method: 'POST', body: JSON.stringify(payload) });
              setRetestDialogOpen(false);
              await load();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setRetestDialogSubmitting(false);
            }
          }}
        />
      )}
      {runtimeDialogOpen && (
        <RuntimeInfoDialog
          submitting={runtimeDialogSubmitting}
          onClose={() => {
            if (!runtimeDialogSubmitting) {
              setRuntimeDialogOpen(false);
            }
          }}
          onConfirm={async (payload) => {
            setRuntimeDialogSubmitting(true);
            try {
              await api('/bugs/' + bug.id + '/runtime-info', { method: 'POST', body: JSON.stringify(payload) });
              setRuntimeDialogOpen(false);
              await load();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setRuntimeDialogSubmitting(false);
            }
          }}
        />
      )}
      {uploadDialogOpen && (
        <EvidenceUploadDialog
          submitting={uploadDialogSubmitting}
          onClose={() => {
            if (!uploadDialogSubmitting) {
              setUploadDialogOpen(false);
            }
          }}
          onConfirm={async (file) => {
            setUploadDialogSubmitting(true);
            try {
              const data = new FormData();
              data.append('file', file);
              await api('/bugs/' + bug.id + '/screenshots', { method: 'POST', body: data });
              setUploadDialogOpen(false);
              await load();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setUploadDialogSubmitting(false);
            }
          }}
        />
      )}
      {activityListOpen && (
        <ActivityListDialog
          activities={bug.activities}
          kind="bug"
          canDeleteActivity={canDeleteActivity}
          onClose={() => setActivityListOpen(false)}
          onOpenDetail={setActivityDetailTarget}
          onDeleteActivity={(activity) => {
            setActivityListOpen(false);
            setActivityDeleteTarget(activity as BugActivity);
          }}
        />
      )}
      {activityDetailTarget && (
        <ActivityDetailDialog
          activity={activityDetailTarget}
          kind="bug"
          canDeleteActivity={canDeleteActivity}
          onClose={() => setActivityDetailTarget(null)}
          onDelete={
            canDeleteActivity
              ? () => {
                  setActivityDeleteTarget(activityDetailTarget as BugActivity);
                  setActivityDetailTarget(null);
                }
              : undefined
          }
        />
      )}
      {statusDialogOpen && (
        <BugStatusDialog
          actionLabel={statusActionLabel}
          currentStatus={bug.status}
          nextStatus={nextStatus}
          submitting={statusDialogSubmitting}
          onCancel={() => {
            if (!statusDialogSubmitting) {
              setStatusDialogOpen(false);
            }
          }}
          onConfirm={async (note) => {
            setStatusDialogSubmitting(true);
            try {
              await api('/bugs/' + bug.id + '/status', {
                method: 'PATCH',
                body: JSON.stringify({ status: nextStatus, note })
              });
              setStatusDialogOpen(false);
              await load();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setStatusDialogSubmitting(false);
            }
          }}
        />
      )}
      {softDeleteOpen && (
        <BugDeleteDialog
          mode="soft"
          submitting={softDeleteSubmitting}
          title={bug.title}
          onCancel={() => {
            if (!softDeleteSubmitting) {
              setSoftDeleteOpen(false);
            }
          }}
          onConfirm={async (reason) => {
            setSoftDeleteSubmitting(true);
            try {
              await api('/bugs/' + bug.id + '/delete', {
                method: 'POST',
                body: JSON.stringify({ reason })
              });
              setSoftDeleteOpen(false);
              await load();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setSoftDeleteSubmitting(false);
            }
          }}
        />
      )}
      {permanentDeleteOpen && (
        <BugDeleteDialog
          mode="permanent"
          submitting={permanentDeleteSubmitting}
          title={bug.title}
          onCancel={() => {
            if (!permanentDeleteSubmitting) {
              setPermanentDeleteOpen(false);
            }
          }}
          onConfirm={async () => {
            setPermanentDeleteSubmitting(true);
            try {
              await api(`/bugs/${bug.id}/permanent`, { method: 'DELETE' });
              window.location.href = '/';
            } catch (actionError) {
              notifyError(readError(actionError));
              setPermanentDeleteSubmitting(false);
            }
          }}
        />
      )}
      {activityDeleteTarget && (
        <BugActivityDeleteDialog
          activity={activityDeleteTarget}
          submitting={activityDeleteSubmitting}
          onCancel={() => {
            if (!activityDeleteSubmitting) {
              setActivityDeleteTarget(null);
            }
          }}
          onConfirm={async () => {
            setActivityDeleteSubmitting(true);
            try {
              await api('/bugs/' + bug.id + '/activities/' + activityDeleteTarget.id, { method: 'DELETE' });
              setActivityDeleteTarget(null);
              await load();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setActivityDeleteSubmitting(false);
            }
          }}
        />
      )}
    </>
  );
}

function BugEditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadFailed, setLoadFailed] = useState(false);
  const [bug, setBug] = useState<BugItem | null>(null);
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [draft, setDraft] = useState<BugDraft | null>(null);

  useEffect(() => {
    if (!id) return;
    void Promise.all([
      api<BugItem>(`/bugs/${id}`),
      api<TrackedSystem[]>('/systems')
    ])
      .then(([nextBug, nextSystems]) => {
        setBug(nextBug);
        setDraft(toBugDraft(nextBug));
        setSystems(nextSystems);
      })
      .catch((error) => { setLoadFailed(true); notifyError(readError(error)); });
  }, [id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!id || !draft) return;
    try {
      await api(`/bugs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(draft)
      });
      navigate(`/bugs/${id}`);
    } catch (error) {
      notifyError(readError(error));
    }
  }

  if (loadFailed && !draft) {
    return <div>加载失败</div>;
  }

  if (!bug || !draft) {
    return <div>加载中</div>;
  }

  const canEditBug = Boolean(user?.isAdmin || bug.creator.id === user?.id);
  if (!canEditBug) {
    return <Navigate to={`/bugs/${bug.id}`} replace />;
  }

  return (
    <>
      <PageHeader
        title="编辑 bug"
        action={<Link className="ghost compact" to={`/bugs/${bug.id}`}><ArrowLeft size={16} />返回详情</Link>}
      />
      <section className="editor-shell">
        <div className="editor-intro">
          <StatusBadge status={bug.status} />
          <strong>{bug.title}</strong>
          <span>{bug.system.name}</span>
        </div>
        <form className="editor-panel" onSubmit={submit}>
          <div className="grid two">
            <label>系统<select required value={draft.systemId} onChange={(event) => setDraft({ ...draft, systemId: event.target.value })}>
              {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
            </select></label>
            <label>严重程度<select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value as BugItem['severity'] })}>
              <option value="LOW">低</option>
              <option value="MEDIUM">中</option>
              <option value="HIGH">高</option>
              <option value="CRITICAL">严重</option>
            </select></label>
          </div>
          <label>标题<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
          <label>描述<textarea required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <div className="grid two">
            <label>运行环境<textarea value={draft.environment} onChange={(event) => setDraft({ ...draft, environment: event.target.value })} /></label>
            <label>复现步骤<textarea value={draft.steps} onChange={(event) => setDraft({ ...draft, steps: event.target.value })} /></label>
            <label>期望结果<textarea value={draft.expected} onChange={(event) => setDraft({ ...draft, expected: event.target.value })} /></label>
            <label>实际结果<textarea value={draft.actual} onChange={(event) => setDraft({ ...draft, actual: event.target.value })} /></label>
          </div>
          <div className="editor-actions">
            <Link className="ghost" to={`/bugs/${bug.id}`}>取消</Link>
            <button className="primary" type="submit"><Save size={16} />保存 bug</button>
          </div>
        </form>
      </section>
    </>
  );
}

function FeatureDashboard() {
  const { user } = useAuth();
  const [features, setFeatures] = useState<FeatureItem[]>([]);
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [systemId, setSystemId] = useState('');
  const [status, setStatus] = useState('');
  const [participantUserId, setParticipantUserId] = useState('');
  const [deleted, setDeleted] = useState<'active' | 'only' | 'all'>('active');
  const [deleteDialog, setDeleteDialog] = useState<{ feature: FeatureItem; mode: 'soft' | 'permanent' } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const canCreate = hasPermission(user, 'CREATE_FEATURE');
  const canViewRecycleBin = Boolean(user?.isAdmin);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (systemId) params.set('systemId', systemId);
      if (status) params.set('status', status);
      if (deleted !== 'active') params.set('deleted', deleted);
      if (participantUserId) params.set('participantUserId', participantUserId);
      setFeatures(await api<FeatureItem[]>(`/features?${params.toString()}`));
    } catch (loadError) {
      notifyError(readError(loadError));
    }
  }

  useEffect(() => {
    void api<TrackedSystem[]>('/systems').then(setSystems);
    void api<AssignableUser[]>('/auth/assignable-users').then(setAssignableUsers).catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
  }, [systemId, status, deleted, participantUserId]);

  function handleFeatureAction(feature: FeatureItem, action: 'delete' | 'permanent-delete') {
    if (action === 'delete') {
      setDeleteDialog({ feature, mode: 'soft' });
      return;
    }
    setDeleteDialog({ feature, mode: 'permanent' });
  }

  async function confirmDeleteDialog(reason: string) {
    if (!deleteDialog) {
      return;
    }
    setDeleteSubmitting(true);
    try {
      if (deleteDialog.mode === 'soft') {
        await api(`/features/${deleteDialog.feature.id}/delete`, {
          method: 'POST',
          body: JSON.stringify({ reason })
        });
      } else {
        await api(`/features/${deleteDialog.feature.id}/permanent`, { method: 'DELETE' });
      }
      setDeleteDialog(null);
      await load();
    } catch (error) {
      notifyError(readError(error));
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={deleted === 'only' ? '功能回收站' : '功能列表'}
        action={canCreate ? <Link className="primary compact" to="/features/new"><Plus size={16} />登记功能</Link> : undefined}
      />
      <div className="toolbar">
        <select value={systemId} onChange={(event) => setSystemId(event.target.value)}>
          <option value="">全部系统</option>
          {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">全部状态</option>
          <option value="PLANNED">规划中</option>
          <option value="IN_PROGRESS">进行中</option>
          <option value="DONE">已完成</option>
        </select>
        <select value={participantUserId} onChange={(event) => setParticipantUserId(event.target.value)}>
          <option value="">全部相关人员</option>
          {assignableUsers.map((person) => (
            <option key={person.id} value={person.id}>{person.displayName}</option>
          ))}
        </select>
        {canViewRecycleBin && (
          <select value={deleted} onChange={(event) => setDeleted(event.target.value as 'active' | 'only' | 'all')}>
            <option value="active">仅正常数据</option>
            <option value="only">仅回收站</option>
            <option value="all">全部数据</option>
          </select>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>标题</th>
              <th>系统</th>
              <th>状态</th>
              <th>优先级</th>
              <th>创建人</th>
              <th>负责人</th>
              {deleted !== 'active' && <th>删除信息</th>}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature) => {
              const canEdit = Boolean(!feature.deletedAt && (user?.isAdmin || feature.creator.id === user?.id));
              const canSoftDelete = Boolean(
                !feature.deletedAt &&
                hasPermission(user, 'DELETE_FEATURE') &&
                (user?.isAdmin || feature.creator.id === user?.id)
              );
              const canPermanentDelete = Boolean(feature.deletedAt && user?.isAdmin);
              return (
                <tr key={feature.id}>
                  <td data-label="标题"><Link className="row-link" to={`/features/${feature.id}`}>{feature.title}</Link></td>
                  <td data-label="系统">{feature.system.name}</td>
                  <td data-label="状态"><FeatureStatusBadge status={feature.status} /></td>
                  <td data-label="优先级">{severityLabel(feature.priority)}</td>
                  <td data-label="创建人">{feature.creator.displayName}</td>
                  <td data-label="负责人">{feature.owner?.displayName ?? '未指定'}</td>
                  {deleted !== 'active' && (
                    <td data-label="删除信息">
                      {feature.deletedAt ? (
                        <div className="delete-meta">
                          <span>{feature.deletedBy?.displayName ?? '未知用户'}</span>
                          <span>{formatDateTime(feature.deletedAt)}</span>
                        </div>
                      ) : (
                        '未删除'
                      )}
                    </td>
                  )}
                  <td data-label="操作">
                    <div className="actions bug-row-actions">
                      {canEdit && hasPermission(user, 'UPDATE_FEATURE') && (
                        <Link className="ghost compact" to={`/features/${feature.id}/edit`}><Pencil size={16} />编辑</Link>
                      )}
                      {canSoftDelete && (
                        <button
                          className="ghost compact danger"
                          type="button"
                          onClick={() => handleFeatureAction(feature, 'delete')}
                        >
                          <Trash2 size={16} />
                          删除
                        </button>
                      )}
                      {canPermanentDelete && (
                        <button
                          className="ghost compact danger"
                          type="button"
                          onClick={() => handleFeatureAction(feature, 'permanent-delete')}
                        >
                          <Archive size={16} />
                          彻底删除
                        </button>
                      )}
                      <Link className="ghost compact" to={`/features/${feature.id}`}><Eye size={16} />详情</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {features.length === 0 && (
              <tr><td colSpan={deleted !== 'active' ? 8 : 7} className="empty-cell">{deleted === 'only' ? '回收站中暂无功能。' : '暂无匹配的功能。'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {deleteDialog && (
        <BugDeleteDialog
          mode={deleteDialog.mode}
          submitting={deleteSubmitting}
          title={deleteDialog.feature.title}
          entityName="功能"
          reasonPlaceholder="例如重复登记、已合并到其他功能或不再需要跟踪"
          onCancel={() => {
            if (!deleteSubmitting) {
              setDeleteDialog(null);
            }
          }}
          onConfirm={(reason) => void confirmDeleteDialog(reason)}
        />
      )}
    </>
  );
}

function NewFeaturePage() {
  const navigate = useNavigate();
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [form, setForm] = useState({ systemId: '', title: '', description: '', priority: 'MEDIUM' });

  useEffect(() => {
    void api<TrackedSystem[]>('/systems').then(setSystems);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const feature = await api<FeatureItem>('/features', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      navigate(`/features/${feature.id}`);
    } catch (submitError) {
      notifyError(readError(submitError));
    }
  }

  return (
    <>
      <PageHeader title="登记功能" />
      <form className="panel-form" onSubmit={submit}>
        <div className="grid two">
          <label>系统<select required value={form.systemId} onChange={(event) => setForm({ ...form, systemId: event.target.value })}>
            <option value="">选择系统</option>
            {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
          </select></label>
          <label>优先级<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            <option value="LOW">低</option>
            <option value="MEDIUM">中</option>
            <option value="HIGH">高</option>
            <option value="CRITICAL">严重</option>
          </select></label>
        </div>
        <label>标题<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>描述<textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <button className="primary" type="submit"><Save size={16} />保存</button>
      </form>
    </>
  );
}

function FeatureDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadFailed, setLoadFailed] = useState(false);
  const [feature, setFeature] = useState<FeatureDetail | null>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusDialogSubmitting, setStatusDialogSubmitting] = useState(false);
  const [softDeleteOpen, setSoftDeleteOpen] = useState(false);
  const [softDeleteSubmitting, setSoftDeleteSubmitting] = useState(false);
  const [permanentDeleteOpen, setPermanentDeleteOpen] = useState(false);
  const [permanentDeleteSubmitting, setPermanentDeleteSubmitting] = useState(false);
  const [activityListOpen, setActivityListOpen] = useState(false);
  const [activityDetailTarget, setActivityDetailTarget] = useState<ItemActivity | null>(null);
  const [activityDeleteTarget, setActivityDeleteTarget] = useState<FeatureActivity | null>(null);
  const [activityDeleteSubmitting, setActivityDeleteSubmitting] = useState(false);

  async function load() {
    if (!id) return;
    setFeature(await api<FeatureDetail>(`/features/${id}`));
  }

  useEffect(() => {
    void load().catch((loadError) => { setLoadFailed(true); notifyError(readError(loadError)); });
  }, [id]);

  if (!feature) {
    return <div>{loadFailed ? '加载失败' : '加载中...'}</div>;
  }

  const canEdit = Boolean(!feature.deletedAt && (user?.isAdmin || feature.creator.id === user?.id));
  const canUpdate = hasPermission(user, 'UPDATE_FEATURE');
  const canSoftDelete = Boolean(
    !feature.deletedAt &&
    hasPermission(user, 'DELETE_FEATURE') &&
    (user?.isAdmin || feature.creator.id === user?.id)
  );
  const canPermanentDelete = Boolean(feature.deletedAt && user?.isAdmin);
  const canDeleteActivity = hasPermission(user, 'DELETE_FEATURE_ACTIVITY');

  return (
    <>
      <PageHeader
        title={feature.title}
        action={(
          <div className="actions">
            <Link className="ghost compact" to="/features"><ArrowLeft size={16} />返回列表</Link>
            {canEdit && canUpdate && (
              <Link className="ghost compact" to={`/features/${feature.id}/edit`}><Pencil size={16} />编辑</Link>
            )}
            {canUpdate && !feature.deletedAt && (
              <button
                className="ghost compact"
                type="button"
                onClick={() => {
                  setStatusDialogOpen(true);
                }}
              >
                变更状态
              </button>
            )}
            {canSoftDelete && (
              <button
                className="ghost compact danger"
                type="button"
                onClick={() => {
                  setSoftDeleteOpen(true);
                }}
              >
                <Trash2 size={16} />
                移入回收站
              </button>
            )}
          </div>
        )}
      />
      {feature.deletedAt && (
        <section className="panel deleted-banner">
          <div>
            <strong>该功能已进入回收站</strong>
            <p>
              删除人：{feature.deletedBy?.displayName ?? '未知用户'} · 删除时间：{formatDateTime(feature.deletedAt)}
            </p>
            {feature.deleteReason && <p>删除原因：{feature.deleteReason}</p>}
          </div>
          {canPermanentDelete && (
            <button
              className="ghost compact danger"
              type="button"
              onClick={() => {
                setPermanentDeleteOpen(true);
              }}
            >
              <Archive size={16} />
              彻底删除
            </button>
          )}
        </section>
      )}
      <section className="bug-detail-layout">
        <div className="bug-detail-main">
          <section className="detail-grid bug-detail-top">
            <div className="panel bug-summary-panel wide">
              <div className="bug-summary-header">
                <div className="meta-row bug-summary-meta">
                  <FeatureStatusBadge status={feature.status} />
                  <span>系统：{feature.system.name}</span>
                  <span>创建人：{feature.creator.displayName}</span>
                  <span>优先级：{severityLabel(feature.priority)}</span>
                </div>
              </div>
              <div className="detail-section-stack">
                <InfoBlock title="描述" value={feature.description} tone="primary" />
                {feature.status === 'DONE' && (
                  <div className="info-block info-block-fixed">
                    <strong>完成信息</strong>
                    <p>
                      {feature.completedBy?.displayName ?? '未知'}
                      {' · '}
                      {feature.completedAt ? formatDateTime(feature.completedAt) : '时间未知'}
                    </p>
                  </div>
                )}
                <PersonnelPanel
                  kind="feature"
                  entityId={feature.id}
                  owner={feature.owner}
                  relatedUsers={feature.relatedUsers}
                  disabled={Boolean(feature.deletedAt)}
                  onUpdated={load}
                  user={user}
                />
              </div>
            </div>
          </section>
        </div>
        <ActivityPanel
          activities={feature.activities}
          kind="feature"
          onOpenDetail={setActivityDetailTarget}
          onViewAll={() => setActivityListOpen(true)}
        />
      </section>
      {activityListOpen && (
        <ActivityListDialog
          activities={feature.activities}
          kind="feature"
          canDeleteActivity={canDeleteActivity}
          onClose={() => setActivityListOpen(false)}
          onOpenDetail={setActivityDetailTarget}
          onDeleteActivity={(activity) => {
            setActivityListOpen(false);
            setActivityDeleteTarget(activity as FeatureActivity);
          }}
        />
      )}
      {activityDetailTarget && (
        <ActivityDetailDialog
          activity={activityDetailTarget}
          kind="feature"
          canDeleteActivity={canDeleteActivity}
          onClose={() => setActivityDetailTarget(null)}
          onDelete={
            canDeleteActivity
              ? () => {
                  setActivityDeleteTarget(activityDetailTarget as FeatureActivity);
                  setActivityDetailTarget(null);
                }
              : undefined
          }
        />
      )}
      {activityDeleteTarget && (
        <FeatureActivityDeleteDialog
          activity={activityDeleteTarget}
          submitting={activityDeleteSubmitting}
          onCancel={() => {
            if (!activityDeleteSubmitting) {
              setActivityDeleteTarget(null);
            }
          }}
          onConfirm={async () => {
            setActivityDeleteSubmitting(true);
            try {
              await api('/features/' + feature.id + '/activities/' + activityDeleteTarget.id, { method: 'DELETE' });
              setActivityDeleteTarget(null);
              await load();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setActivityDeleteSubmitting(false);
            }
          }}
        />
      )}
      {statusDialogOpen && (
        <FeatureStatusDialog
          currentStatus={feature.status}
          submitting={statusDialogSubmitting}
          onClose={() => {
            if (!statusDialogSubmitting) {
              setStatusDialogOpen(false);
            }
          }}
          onConfirm={async (status, note) => {
            setStatusDialogSubmitting(true);
            try {
              await api(`/features/${feature.id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status, note })
              });
              setStatusDialogOpen(false);
              await load();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setStatusDialogSubmitting(false);
            }
          }}
        />
      )}
      {softDeleteOpen && (
        <BugDeleteDialog
          mode="soft"
          submitting={softDeleteSubmitting}
          title={feature.title}
          entityName="功能"
          reasonPlaceholder="例如重复登记、已合并到其他功能或不再需要跟踪"
          onCancel={() => {
            if (!softDeleteSubmitting) {
              setSoftDeleteOpen(false);
            }
          }}
          onConfirm={async (reason) => {
            setSoftDeleteSubmitting(true);
            try {
              await api(`/features/${feature.id}/delete`, {
                method: 'POST',
                body: JSON.stringify({ reason })
              });
              setSoftDeleteOpen(false);
              await load();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setSoftDeleteSubmitting(false);
            }
          }}
        />
      )}
      {permanentDeleteOpen && (
        <BugDeleteDialog
          mode="permanent"
          submitting={permanentDeleteSubmitting}
          title={feature.title}
          entityName="功能"
          onCancel={() => {
            if (!permanentDeleteSubmitting) {
              setPermanentDeleteOpen(false);
            }
          }}
          onConfirm={async () => {
            setPermanentDeleteSubmitting(true);
            try {
              await api(`/features/${feature.id}/permanent`, { method: 'DELETE' });
              navigate('/features');
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setPermanentDeleteSubmitting(false);
            }
          }}
        />
      )}
    </>
  );
}

function FeatureEditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadFailed, setLoadFailed] = useState(false);
  const [feature, setFeature] = useState<FeatureItem | null>(null);
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [form, setForm] = useState({ systemId: '', title: '', description: '', priority: 'MEDIUM' });

  useEffect(() => {
    if (!id) return;
    void Promise.all([api<FeatureItem>(`/features/${id}`), api<TrackedSystem[]>('/systems')])
      .then(([nextFeature, nextSystems]) => {
        setFeature(nextFeature);
        setForm({
          systemId: nextFeature.system.id,
          title: nextFeature.title,
          description: nextFeature.description,
          priority: nextFeature.priority
        });
        setSystems(nextSystems);
      })
      .catch((loadError) => { setLoadFailed(true); notifyError(readError(loadError)); });
  }, [id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    try {
      await api(`/features/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(form)
      });
      navigate(`/features/${id}`);
    } catch (submitError) {
      notifyError(readError(submitError));
    }
  }

  if (!feature) {
    return <div>{loadFailed ? '加载失败' : '加载中'}</div>;
  }

  const canEdit = Boolean(user?.isAdmin || feature.creator.id === user?.id);
  if (!canEdit) {
    return <Navigate to={`/features/${feature.id}`} replace />;
  }

  return (
    <>
      <PageHeader title="编辑功能" action={<Link className="ghost compact" to={`/features/${feature.id}`}><ArrowLeft size={16} />返回详情</Link>} />
      <form className="panel-form editor-panel" onSubmit={submit}>
        <div className="grid two">
          <label>系统<select required value={form.systemId} onChange={(event) => setForm({ ...form, systemId: event.target.value })}>
            {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
          </select></label>
          <label>优先级<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
            <option value="LOW">低</option>
            <option value="MEDIUM">中</option>
            <option value="HIGH">高</option>
            <option value="CRITICAL">严重</option>
          </select></label>
        </div>
        <label>标题<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>描述<textarea required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <button className="primary" type="submit"><Save size={16} />保存修改</button>
      </form>
    </>
  );
}

function StatsPage() {
  const { user } = useAuth();
  const [loadFailed, setLoadFailed] = useState(false);
  const [stats, setStats] = useState<KpiOverview | null>(null);

  useEffect(() => {
    if (!hasPermission(user, 'VIEW_STATS')) {
      return;
    }
    void api<KpiOverview>('/stats/kpi')
      .then(setStats)
      .catch((loadError) => { setLoadFailed(true); notifyError(readError(loadError)); });
  }, [user]);

  if (!hasPermission(user, 'VIEW_STATS')) {
    return <Navigate to="/" replace />;
  }

  if (!stats) {
    return <div>{loadFailed ? '加载失败' : '加载 KPI 数据...'}</div>;
  }

  return (
    <>
      <PageHeader title="KPI 统计" />
      <section className="stats-cards">
        <div className="stat-card"><strong>{stats.totals.openBugs}</strong><span>未修复 Bug</span></div>
        <div className="stat-card"><strong>{stats.totals.fixedBugs}</strong><span>已修复 Bug</span></div>
        <div className="stat-card"><strong>{stats.totals.activeFeatures}</strong><span>进行中功能</span></div>
        <div className="stat-card"><strong>{stats.totals.doneFeatures}</strong><span>已完成功能</span></div>
      </section>
      <p className="muted">统计时间：{formatDateTime(stats.generatedAt)}</p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>成员</th>
              <th>登记 Bug</th>
              <th>修复 Bug</th>
              <th>平均修复(h)</th>
              <th>登记功能</th>
              <th>完成功能</th>
              <th>负责 Bug</th>
              <th>负责功能</th>
              <th>待办负责项</th>
              <th>负载指数</th>
            </tr>
          </thead>
          <tbody>
            {stats.people.map((row) => (
              <tr key={row.user.id}>
                <td data-label="成员">{row.user.displayName}</td>
                <td data-label="登记 Bug">{row.bugsCreated}</td>
                <td data-label="修复 Bug">{row.bugsFixed}</td>
                <td data-label="平均修复">{row.avgFixHours != null ? row.avgFixHours.toFixed(1) : '-'}</td>
                <td data-label="登记功能">{row.featuresCreated}</td>
                <td data-label="完成功能">{row.featuresCompleted}</td>
                <td data-label="负责 Bug">{row.bugsOwned}</td>
                <td data-label="负责功能">{row.featuresOwned}</td>
                <td data-label="待办负责项">{row.openBugsOwned + row.openFeaturesOwned}</td>
                <td data-label="负载指数">{row.workloadScore.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function FeatureStatusBadge({ status }: { status: FeatureStatus }) {
  const label = { PLANNED: '规划中', IN_PROGRESS: '进行中', DONE: '已完成' }[status];
  return <span className={`status feature-${status.toLowerCase()}`}>{label}</span>;
}

function AdminPage() {
  const { user } = useAuth();
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionDefinitions, setPermissionDefinitions] = useState<PermissionDefinition[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'systems' | 'roles' | 'users'>('systems');
  const [createSystemOpen, setCreateSystemOpen] = useState(false);
  const [createSystemSubmitting, setCreateSystemSubmitting] = useState(false);

  const canManageSystems = hasPermission(user, 'MANAGE_SYSTEMS');
  const canManageRoles = hasPermission(user, 'MANAGE_ROLES');
  const canManageUsers = hasPermission(user, 'MANAGE_USERS');
  const adminTabs = useMemo(
    () => [
      ...(canManageSystems ? [{ id: 'systems' as const, label: '系统' }] : []),
      ...(canManageRoles ? [{ id: 'roles' as const, label: '角色' }] : []),
      ...(canManageUsers ? [{ id: 'users' as const, label: '用户' }] : [])
    ],
    [canManageSystems, canManageRoles, canManageUsers]
  );

  async function loadAll() {
    await Promise.all([
      canManageSystems
        ? api<TrackedSystem[]>('/systems').then(setSystems)
        : Promise.resolve(setSystems([])),
      canManageRoles || canManageUsers
        ? api<Role[]>('/roles').then(setRoles)
        : Promise.resolve(setRoles([])),
      canManageRoles
        ? api<PermissionDefinition[]>('/roles/permissions').then(setPermissionDefinitions)
        : Promise.resolve(setPermissionDefinitions([])),
      canManageUsers
        ? api<User[]>('/users').then(setUsers)
        : Promise.resolve(setUsers([]))
    ]);
  }

  useEffect(() => {
    const firstAllowedTab = adminTabs[0]?.id;
    if (firstAllowedTab && !adminTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab(firstAllowedTab);
    }
  }, [activeTab, adminTabs]);

  useEffect(() => {
    if (adminTabs.length) {
      void loadAll().catch((error) => notifyError(readError(error)));
    }
  }, [canManageSystems, canManageRoles, canManageUsers]);

  async function mutate(action: () => Promise<unknown>) {
    try {
      await action();
      await loadAll();
    } catch (error) {
      notifyError(readError(error));
    }
  }

  async function mutateOrThrow(action: () => Promise<unknown>) {
    try {
      await action();
      await loadAll();
    } catch (error) {
      notifyError(readError(error));
      throw error;
    }
  }

  if (!adminTabs.length) {
    return <Navigate to="/" replace />;
  }

  return (
    <>
      <PageHeader title="管理后台" />
      <div className="tabs" role="tablist" aria-label="管理后台分类">
        {adminTabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            role="tab"
            aria-selected={activeTab === tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <section className="admin-tab-panel" role="tabpanel">
        {activeTab === 'systems' && canManageSystems && (
          <div className="panel">
          <div className="panel-heading-row">
            <h2>系统</h2>
            <button
              className="primary compact"
              type="button"
              onClick={() => {
                setCreateSystemOpen(true);
              }}
            >
              <Plus size={16} />新建系统
            </button>
          </div>
          <div className="list">
            {systems.map((system) => (
              <SystemRow
                key={system.id}
                system={system}
                onDelete={async () => {
                  await api(`/systems/${system.id}`, { method: 'DELETE' });
                  await loadAll();
                }}
              />
            ))}
          </div>
          </div>
        )}
        {activeTab === 'roles' && canManageRoles && (
          <RoleAdminPanel
            permissions={permissionDefinitions}
            roles={roles}
            onMutate={mutateOrThrow}
          />
        )}
        {activeTab === 'users' && canManageUsers && (
          <div className="panel">
          <h2>用户</h2>
          <div className="table-wrap">
            <table className="user-table">
              <thead>
                <tr>
                  <th>用户</th>
                  <th>状态</th>
                  <th>角色</th>
                  <th>管理员</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <UserRow key={item.id} user={item} roles={roles} onMutate={mutateOrThrow} />
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>
      {createSystemOpen && (
        <CreateSystemDialog
          submitting={createSystemSubmitting}
          onClose={() => {
            if (!createSystemSubmitting) {
              setCreateSystemOpen(false);
            }
          }}
          onConfirm={async (payload) => {
            setCreateSystemSubmitting(true);
            try {
              await api('/systems', { method: 'POST', body: JSON.stringify(payload) });
              setCreateSystemOpen(false);
              await loadAll();
            } catch (actionError) {
              notifyError(readError(actionError));
            } finally {
              setCreateSystemSubmitting(false);
            }
          }}
        />
      )}
    </>
  );
}

function SystemEditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadFailed, setLoadFailed] = useState(false);
  const [system, setSystem] = useState<TrackedSystem | null>(null);
  const [draft, setDraft] = useState<SystemDraft | null>(null);

  const canManageSystems = hasPermission(user, 'MANAGE_SYSTEMS');

  useEffect(() => {
    if (!id || !canManageSystems) return;
    void api<TrackedSystem>(`/systems/${id}`)
      .then((nextSystem) => {
        setSystem(nextSystem);
        setDraft(toSystemDraft(nextSystem));
      })
      .catch((error) => { setLoadFailed(true); notifyError(readError(error)); });
  }, [id, canManageSystems]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!id || !draft) return;
    try {
      await api(`/systems/${id}`, { method: 'PATCH', body: JSON.stringify(draft) });
      navigate('/admin');
    } catch (error) {
      notifyError(readError(error));
    }
  }

  if (!canManageSystems) {
    return <Navigate to="/admin" replace />;
  }

  if (loadFailed && !draft) {
    return <div>加载失败</div>;
  }

  if (!system || !draft) {
    return <div>加载中</div>;
  }

  return (
    <>
      <PageHeader
        title="编辑系统"
        action={<Link className="ghost compact" to="/admin"><ArrowLeft size={16} />返回后台</Link>}
      />
      <section className="editor-shell">
        <div className="editor-intro">
          <strong>{system.name}</strong>
          <span>{system.owner || '未填写负责人'}</span>
          <span>{system.versionInfo || '未填写版本'}</span>
        </div>
        <form className="editor-panel" onSubmit={submit}>
          <div className="grid two">
            <label>系统名称<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>负责人<input value={draft.owner ?? ''} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /></label>
            <label>版本信息<input value={draft.versionInfo ?? ''} onChange={(event) => setDraft({ ...draft, versionInfo: event.target.value })} /></label>
          </div>
          <label>说明<textarea value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
          <div className="editor-actions">
            <Link className="ghost" to="/admin">取消</Link>
            <button className="primary" type="submit"><Save size={16} />保存系统</button>
          </div>
        </form>
      </section>
    </>
  );
}

function SystemRow({
  system,
  onDelete
}: {
  system: TrackedSystem;
  onDelete: () => Promise<unknown>;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function confirmDelete() {
    setSubmitting(true);
    try {
      await onDelete();
      setDeleteOpen(false);
    } catch (actionError) {
      notifyError(readError(actionError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="system-row">
        <div className="system-main">
          <strong>{system.name}</strong>
          <div className="system-summary">
            <span>负责人：{system.owner || '未填写'}</span>
            <span>版本：{system.versionInfo || '未填写'}</span>
          </div>
          {system.description && <p>{system.description}</p>}
        </div>
        <div className="actions">
          <Link className="icon-button" to={`/admin/systems/${system.id}/edit`} title="编辑系统"><Pencil size={16} /></Link>
          <button className="icon-button" type="button" onClick={() => setDeleteOpen(true)} title="彻底删除系统">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {deleteOpen && (
        <ConfirmDeleteDialog
          title="删除系统"
          description="删除后该系统及其关联数据将无法恢复。"
          targetLabel="目标系统"
          targetName={system.name}
          warning="请确认你要彻底删除这个系统。"
          submitting={submitting}
          confirmLabel="确认删除系统"
          onClose={() => {
            if (!submitting) {
              setDeleteOpen(false);
            }
          }}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </>
  );
}

function UserRow({
  user,
  roles,
  onMutate
}: {
  user: User;
  roles: Role[];
  onMutate: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const initialsSource = (user.displayName || user.username).replace(/\s+/g, '').replace(/^@/, '');
  const initials = initialsSource.slice(0, 2).toUpperCase() || user.username.slice(0, 2).toUpperCase();

  async function run(action: () => Promise<unknown>, closeOnSuccess = false) {
    setSubmitting(true);
    try {
      await onMutate(action);
      if (closeOnSuccess) {
        setManageOpen(false);
      }
    } catch (actionError) {
      notifyError(readError(actionError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <tr className="user-row">
        <td className="user-cell" data-label="用户">
          <div className="user-summary">
            <div className="user-avatar" aria-hidden="true">{initials}</div>
            <div className="user-identity">
              <strong>{user.displayName}</strong>
              <div className="user-meta-row">
                <span className="muted user-handle">@{user.username}</span>
                {user.isAdmin && (
                  <span className="user-chip">
                    <Shield size={14} />
                    系统管理员
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>
        <td className="user-status-cell" data-label="状态">
          <UserStateBadge status={user.status} />
        </td>
        <td className="user-role-cell" data-label="角色">
          {user.isAdmin ? (
            <span className="admin-role-label">
              <Shield size={14} />
              系统管理员
            </span>
          ) : (
            <span>{user.role?.name ?? '无角色'}</span>
          )}
        </td>
        <td className="user-admin-cell" data-label="管理员">
          <span>{user.isAdmin ? '是' : '否'}</span>
        </td>
        <td className="user-actions-cell" data-label="操作">
          <button className="ghost compact" type="button" onClick={() => setManageOpen(true)}>
            管理
          </button>
        </td>
      </tr>
      {manageOpen && (
        <UserManageDialog
          user={user}
          roles={roles}
          submitting={submitting}
          onClose={() => {
            if (!submitting) {
              setManageOpen(false);
            }
          }}
          onSaveDisplayName={(displayName) => void run(() => api(`/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ displayName }) }), true)}
          onRoleChange={(roleId) => void run(() => api(`/users/${user.id}/role`, { method: 'PATCH', body: JSON.stringify({ roleId }) }), true)}
          onAdminChange={(isAdmin) => void run(() => api(`/users/${user.id}/admin`, { method: 'PATCH', body: JSON.stringify({ isAdmin }) }), true)}
          onApprove={() => void run(() => api(`/users/${user.id}/approve`, { method: 'PATCH', body: JSON.stringify({ roleId: user.role?.id }) }), true)}
          onStatusChange={(status) => void run(() => api(`/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }), true)}
        />
      )}
    </>
  );
}

function UserStateBadge({ status }: { status: User['status'] }) {
  const config: Record<User['status'], { label: string; tone: string }> = {
    ACTIVE: { label: 'ACTIVE', tone: 'active' },
    PENDING: { label: 'PENDING', tone: 'pending' },
    DISABLED: { label: 'DISABLED', tone: 'disabled' }
  };
  const current = config[status];
  return <span className={`user-state-badge ${current.tone}`}>{current.label}</span>;
}

function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {action}
    </header>
  );
}


function StatusBadge({ status }: { status: BugStatus }) {
  return <span className={`status ${status.toLowerCase()}`}>{status === 'FIXED' ? '已修复' : '未修复'}</span>;
}

function InfoBlock({ title, value, tone }: { title: string; value: string | null; tone?: 'primary' }) {
  if (!value) return null;
  return (
    <div className={tone ? `info-block info-block-${tone}` : 'info-block'}>
      <strong>{title}</strong>
      <p>{value}</p>
    </div>
  );
}

function toBugDraft(bug: BugItem): BugDraft {
  return {
    systemId: bug.system.id,
    title: bug.title,
    description: bug.description,
    severity: bug.severity,
    environment: bug.environment ?? '',
    steps: bug.steps ?? '',
    expected: bug.expected ?? '',
    actual: bug.actual ?? ''
  };
}

function toSystemDraft(system: TrackedSystem): SystemDraft {
  return {
    name: system.name,
    description: system.description ?? '',
    owner: system.owner ?? '',
    versionInfo: system.versionInfo ?? ''
  };
}

function severityLabel(value: string) {
  return { LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '严重' }[value] ?? value;
}

export default App;
