import {
  ArrowLeft,
  Archive,
  Bug,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Pencil,
  Plus,
  Save,
  Settings,
  Shield,
  Trash2,
  Upload,
  UserCheck
} from 'lucide-react';
import { FormEvent, createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  BugActivity,
  BugDetail,
  BugItem,
  BugStatus,
  PermissionDefinition,
  Role,
  TrackedSystem,
  User,
  api,
  assetUrl,
  hasPermission
} from './api';
import { RoleAdminPanel } from './RoleAdminPanel';

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
        <Route path="/" element={<Protected><Shell><Dashboard /></Shell></Protected>} />
        <Route path="/bugs/new" element={<Protected><Shell><NewBugPage /></Shell></Protected>} />
        <Route path="/bugs/:id/edit" element={<Protected><Shell><BugEditPage /></Shell></Protected>} />
        <Route path="/bugs/:id" element={<Protected><Shell><BugDetailPage /></Shell></Protected>} />
        <Route path="/admin/systems/:id/edit" element={<Protected><Shell><SystemEditPage /></Shell></Protected>} />
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
  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" to="/">
          <Bug size={22} />
          <span>BugReportWeb</span>
        </Link>
        <nav className="nav">
          <Link className={isActive('/') ? 'active' : undefined} to="/"><ClipboardList size={18} />Bug 列表</Link>
          {hasPermission(user, 'CREATE_BUG') && <Link className={isActive('/bugs/new') ? 'active' : undefined} to="/bugs/new"><Plus size={18} />登记 bug</Link>}
          {canAdmin && <Link className={isActive('/admin') ? 'active' : undefined} to="/admin"><Settings size={18} />管理后台</Link>}
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
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (error) {
      setError(readError(error));
    }
  }

  return (
    <AuthFrame title="登录">
      <form className="stack" onSubmit={submit}>
        <label>用户名<input value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {error && <p className="error">{error}</p>}
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
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const result = await api<{ message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setMessage(result.message);
    } catch (error) {
      setError(readError(error));
    }
  }

  return (
    <AuthFrame title="注册">
      <form className="stack" onSubmit={submit}>
        <label>用户名<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
        <label>显示名<input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label>
        <label>密码<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
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
  const [systemId, setSystemId] = useState('');
  const [status, setStatus] = useState('');
  const [deleted, setDeleted] = useState<'active' | 'only' | 'all'>('active');
  const [error, setError] = useState('');
  const canCreateBug = hasPermission(user, 'CREATE_BUG');
  const canViewRecycleBin = Boolean(user?.isAdmin);

  async function load() {
    setError('');
    try {
      const params = new URLSearchParams();
      if (systemId) params.set('systemId', systemId);
      if (status) params.set('status', status);
      if (deleted !== 'active') params.set('deleted', deleted);
      setBugs(await api<BugItem[]>(`/bugs?${params.toString()}`));
    } catch (error) {
      setError(readError(error));
    }
  }

  useEffect(() => {
    void api<TrackedSystem[]>('/systems').then(setSystems);
  }, []);

  useEffect(() => {
    void load();
  }, [systemId, status, deleted]);

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
        {canViewRecycleBin && (
          <select value={deleted} onChange={(event) => setDeleted(event.target.value as 'active' | 'only' | 'all')}>
            <option value="active">仅正常数据</option>
            <option value="only">仅回收站</option>
            <option value="all">全部数据</option>
          </select>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>标题</th>
              <th>系统</th>
              <th>状态</th>
              <th>创建人</th>
              <th>截图</th>
              <th>运行信息</th>
              <th>确认出现</th>
              <th>未出现</th>
              {deleted !== 'active' && <th>删除信息</th>}
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {bugs.map((bug) => (
              <tr key={bug.id}>
                <td data-label="标题"><Link className="row-link" to={`/bugs/${bug.id}`}>{bug.title}</Link></td>
                <td data-label="系统">{bug.system.name}</td>
                <td data-label="状态"><StatusBadge status={bug.status} /></td>
                <td data-label="创建人">{bug.creator.displayName}</td>
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
                  <div className="actions">
                    {(!bug.deletedAt && (user?.isAdmin || bug.creator.id === user?.id)) && (
                      <Link className="ghost compact" to={`/bugs/${bug.id}/edit`}><Pencil size={16} />编辑</Link>
                    )}
                    {bug.deletedAt && user?.isAdmin && (
                      <button
                        className="ghost compact danger"
                        onClick={() => {
                          if (!confirm(`确认彻底删除 bug「${bug.title}」吗？此操作不可恢复。`)) {
                            return;
                          }
                          void api(`/bugs/${bug.id}/permanent`, { method: 'DELETE' }).then(() => load()).catch((loadError) => setError(readError(loadError)));
                        }}
                      >
                        <Archive size={16} />
                        彻底删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {bugs.length === 0 && (
              <tr>
                <td colSpan={deleted !== 'active' ? 10 : 9} className="empty-cell">
                  {deleted === 'only' ? '回收站中暂无 bug。' : '暂无匹配的 bug。'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function NewBugPage() {
  const navigate = useNavigate();
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [selectedScreenshots, setSelectedScreenshots] = useState<Array<{ id: string; file: File; url: string }>>([]);
  const selectedScreenshotsRef = useRef(selectedScreenshots);
  const [runtimeInfos, setRuntimeInfos] = useState([{ title: '', environment: '', logText: '' }]);
  const [error, setError] = useState('');
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
    setError('');
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
      setError(readError(error));
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
                {runtimeInfos.length > 1 && (
                  <button className="icon-button" type="button" onClick={() => setRuntimeInfos(runtimeInfos.filter((_, itemIndex) => itemIndex !== index))} title="删除运行信息">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <input placeholder="标题" value={info.title} onChange={(event) => updateRuntimeDraft(index, 'title', event.target.value, runtimeInfos, setRuntimeInfos)} />
              <input placeholder="运行环境" value={info.environment} onChange={(event) => updateRuntimeDraft(index, 'environment', event.target.value, runtimeInfos, setRuntimeInfos)} />
              <textarea placeholder="报错日志" value={info.logText} onChange={(event) => updateRuntimeDraft(index, 'logText', event.target.value, runtimeInfos, setRuntimeInfos)} />
            </div>
          ))}
        </section>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit"><Save size={16} />保存</button>
      </form>
    </>
  );
}

function BugDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [bug, setBug] = useState<BugDetail | null>(null);
  const [error, setError] = useState('');
  const [runtime, setRuntime] = useState({ title: '', environment: '', logText: '' });
  const [file, setFile] = useState<File | null>(null);
  const [retest, setRetest] = useState({ result: 'APPEARED', note: '' });
  const [statusNote, setStatusNote] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  async function load() {
    if (!id) return;
    const nextBug = await api<BugDetail>('/bugs/' + id);
    setBug(nextBug);
  }

  useEffect(() => {
    void load().catch((loadError) => setError(readError(loadError)));
  }, [id]);

  async function mutate(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await load();
    } catch (actionError) {
      setError(readError(actionError));
    }
  }

  if (!bug) {
    return <div>{error || '加载中...'}</div>;
  }

  const canAddEvidence = hasPermission(user, 'ADD_BUG_EVIDENCE');
  const canRetest = hasPermission(user, 'RETEST_BUG') && bug.creator.id !== user?.id;
  const canChangeStatus = hasPermission(user, 'MARK_BUG_FIXED');
  const canEditBug = Boolean(!bug.deletedAt && (user?.isAdmin || bug.creator.id === user?.id));
  const canSoftDelete = Boolean(!bug.deletedAt && hasPermission(user, 'DELETE_BUG') && (user?.isAdmin || bug.creator.id === user?.id));
  const canPermanentDelete = Boolean(bug.deletedAt && user?.isAdmin);
  const nextStatus: BugStatus = bug.status === 'FIXED' ? 'OPEN' : 'FIXED';
  const statusActionLabel = nextStatus === 'FIXED' ? '标记为已修复' : '重新打开 bug';
  const latestFixActivity =
    bug.activities.find((activity) => activity.type === 'STATUS_CHANGED' && activity.toStatus === 'FIXED') ?? null;

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
          </div>
        )}
      />
      {error && <p className="error">{error}</p>}
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
              onClick={async () => {
                if (!confirm(`确认彻底删除 bug「${bug.title}」吗？此操作不可恢复。`)) {
                  return;
                }
                setError('');
                try {
                  await api(`/bugs/${bug.id}/permanent`, { method: 'DELETE' });
                  window.location.href = '/';
                } catch (actionError) {
                  setError(readError(actionError));
                }
              }}
            >
              <Archive size={16} />
              彻底删除
            </button>
          )}
        </section>
      )}
      <section className="detail-grid">
        <div className="panel">
          <div className="meta-row">
            <StatusBadge status={bug.status} />
            <span>{bug.system.name}</span>
            <span>{bug.creator.displayName}</span>
            <span>{severityLabel(bug.severity)}</span>
          </div>
          <p>{bug.description}</p>
          <InfoBlock title="运行环境" value={bug.environment} />
          <InfoBlock title="复现步骤" value={bug.steps} />
          <InfoBlock title="期望结果" value={bug.expected} />
          <InfoBlock title="实际结果" value={bug.actual} />
          {bug.status === 'FIXED' && (
            <div className="info-block">
              <strong>修复信息</strong>
              <p>
                {bug.fixedBy?.displayName ?? '未知用户'}
                {' · '}
                {bug.fixedAt ? formatDateTime(bug.fixedAt) : '时间未知'}
              </p>
              {latestFixActivity?.note && <p>{latestFixActivity.note}</p>}
            </div>
          )}
          <div className="stats">
            <span>出现次数：{bug.appearedCount}</span>
            <span>未出现：{bug.notAppearedCount}</span>
          </div>
        </div>
        {canChangeStatus && !bug.deletedAt && (
          <div className="panel">
            <h2>状态操作</h2>
            <form
              className="status-form"
              onSubmit={(event) => {
                event.preventDefault();
                void mutate(() =>
                  api('/bugs/' + bug.id + '/status', {
                    method: 'PATCH',
                    body: JSON.stringify({ status: nextStatus, note: statusNote })
                  })
                ).then(() => setStatusNote(''));
              }}
            >
              <p className="muted">
                当前状态为{statusLabel(bug.status)}，你可以在这里{statusActionLabel}并填写备注。
              </p>
              <textarea
                placeholder={nextStatus === 'FIXED' ? '填写修复说明、影响范围或验证方式' : '填写重新打开的原因'}
                value={statusNote}
                onChange={(event) => setStatusNote(event.target.value)}
              />
              <button className="primary compact" type="submit">
                <CheckCircle2 size={16} />
                {statusActionLabel}
              </button>
            </form>
          </div>
        )}
        {canSoftDelete && (
          <div className="panel">
            <h2>删除 bug</h2>
            <form
              className="status-form"
              onSubmit={async (event) => {
                event.preventDefault();
                setError('');
                try {
                  await api('/bugs/' + bug.id + '/delete', {
                    method: 'POST',
                    body: JSON.stringify({ reason: deleteReason })
                  });
                  setDeleteReason('');
                  await load();
                } catch (actionError) {
                  setError(readError(actionError));
                }
              }}
            >
              <p className="muted">删除后 bug 会进入回收站，仅管理员可以执行最终彻底删除。</p>
              <textarea
                placeholder="填写删除原因，例如重复登记、误报或已合并到其他 bug"
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
              />
              <button className="ghost compact danger" type="submit">
                <Trash2 size={16} />
                移入回收站
              </button>
            </form>
          </div>
        )}
        <div className="panel">
          <h2>截图</h2>
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
          </div>
          {canAddEvidence && !bug.deletedAt && (
            <form
              className="inline-upload"
              onSubmit={(event) => {
                event.preventDefault();
                if (!file) return;
                const data = new FormData();
                data.append('file', file);
                void mutate(() => api('/bugs/' + bug.id + '/screenshots', { method: 'POST', body: data })).then(() =>
                  setFile(null)
                );
              }}
            >
              <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <button className="ghost compact" type="submit"><Upload size={16} />上传</button>
            </form>
          )}
        </div>
      </section>
      <section className="panel">
        <h2>运行信息</h2>
        <div className="runtime-list">
          {bug.runtimeInfos.map((info) => (
            <article key={info.id}>
              <header>
                <div>
                  <strong>{info.title}</strong>
                  <span>{info.author?.displayName ?? '未知作者'}</span>
                </div>
                {canAddEvidence && !bug.deletedAt && (user?.isAdmin || info.authorId === user?.id) && (
                  <button
                    className="icon-button"
                    onClick={() => mutate(() => api('/bugs/' + bug.id + '/runtime-info/' + info.id, { method: 'DELETE' }))}
                    title="删除运行信息"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </header>
              {info.environment && <p>{info.environment}</p>}
              <pre>{info.logText}</pre>
            </article>
          ))}
        </div>
        {canAddEvidence && !bug.deletedAt && (
          <form
            className="runtime-editor"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(() =>
                api('/bugs/' + bug.id + '/runtime-info', { method: 'POST', body: JSON.stringify(runtime) })
              ).then(() => setRuntime({ title: '', environment: '', logText: '' }));
            }}
          >
            <input placeholder="标题" value={runtime.title} onChange={(event) => setRuntime({ ...runtime, title: event.target.value })} />
            <input
              placeholder="环境说明"
              value={runtime.environment}
              onChange={(event) => setRuntime({ ...runtime, environment: event.target.value })}
            />
            <textarea
              placeholder="日志内容"
              value={runtime.logText}
              onChange={(event) => setRuntime({ ...runtime, logText: event.target.value })}
            />
            <button className="ghost compact" type="submit"><Plus size={16} />添加运行信息</button>
          </form>
        )}
      </section>
      {canRetest && !bug.deletedAt && (
        <section className="panel">
          <h2>复测</h2>
          <form
            className="grid two"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate(() => api('/bugs/' + bug.id + '/retests', { method: 'POST', body: JSON.stringify(retest) }));
            }}
          >
            <select value={retest.result} onChange={(event) => setRetest({ ...retest, result: event.target.value })}>
              <option value="APPEARED">仍然出现</option>
              <option value="NOT_APPEARED">未复现</option>
            </select>
            <input placeholder="备注" value={retest.note} onChange={(event) => setRetest({ ...retest, note: event.target.value })} />
            <button className="primary compact" type="submit">提交复测</button>
          </form>
        </section>
      )}
      <section className="panel">
        <h2>活动记录</h2>
        <div className="activity-list">
          {bug.activities.map((activity) => {
            const contextSummary = describeActivityContext(activity);
            return (
              <article key={activity.id} className="activity-item">
                <header>
                  <div>
                    <strong>{activityTitle(activity)}</strong>
                    <span>
                      {activity.actor.displayName}
                      {' · '}
                      {formatDateTime(activity.createdAt)}
                    </span>
                  </div>
                </header>
                {activity.note && <p>{activity.note}</p>}
                {activity.fromStatus && activity.toStatus && (
                  <p className="muted">
                    状态：{statusLabel(activity.fromStatus)} {'->'} {statusLabel(activity.toStatus)}
                  </p>
                )}
                {activity.changes && activity.changes.length > 0 && (
                  <div className="activity-changes">
                    {activity.changes.map((change, index) => (
                      <div key={activity.id + '-' + change.field + '-' + index} className="activity-change-row">
                        <strong>{fieldLabel(change.field)}</strong>
                        <span>{formatChangeValue(change.from)}</span>
                        <span className="muted">-&gt;</span>
                        <span>{formatChangeValue(change.to)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {contextSummary && <p className="muted">{contextSummary}</p>}
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

function BugEditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bug, setBug] = useState<BugItem | null>(null);
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [draft, setDraft] = useState<BugDraft | null>(null);
  const [error, setError] = useState('');

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
      .catch((error) => setError(readError(error)));
  }, [id]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!id || !draft) return;
    setError('');
    try {
      await api(`/bugs/${id}`, { method: 'PATCH', body: JSON.stringify(draft) });
      navigate(`/bugs/${id}`);
    } catch (error) {
      setError(readError(error));
    }
  }

  if (error && !draft) {
    return <div>{error}</div>;
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
          {error && <p className="error">{error}</p>}
          <div className="editor-actions">
            <Link className="ghost" to={`/bugs/${bug.id}`}>取消</Link>
            <button className="primary" type="submit"><Save size={16} />保存 bug</button>
          </div>
        </form>
      </section>
    </>
  );
}

function AdminPage() {
  const { user } = useAuth();
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionDefinitions, setPermissionDefinitions] = useState<PermissionDefinition[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [systemForm, setSystemForm] = useState({ name: '', description: '', owner: '', versionInfo: '' });
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'systems' | 'roles' | 'users'>('systems');

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
      void loadAll().catch((error) => setError(readError(error)));
    }
  }, [canManageSystems, canManageRoles, canManageUsers]);

  async function mutate(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await loadAll();
    } catch (error) {
      setError(readError(error));
    }
  }

  async function mutateOrThrow(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      await loadAll();
    } catch (error) {
      setError(readError(error));
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
      {error && <p className="error">{error}</p>}
      <section className="admin-tab-panel" role="tabpanel">
        {activeTab === 'systems' && canManageSystems && (
          <div className="panel">
          <h2>系统</h2>
          <form className="stack" onSubmit={(event) => {
            event.preventDefault();
            void mutate(() => api('/systems', { method: 'POST', body: JSON.stringify(systemForm) })).then(() => setSystemForm({ name: '', description: '', owner: '', versionInfo: '' }));
          }}>
            <input placeholder="系统名称" value={systemForm.name} onChange={(event) => setSystemForm({ ...systemForm, name: event.target.value })} />
            <input placeholder="负责人" value={systemForm.owner} onChange={(event) => setSystemForm({ ...systemForm, owner: event.target.value })} />
            <input placeholder="版本信息" value={systemForm.versionInfo} onChange={(event) => setSystemForm({ ...systemForm, versionInfo: event.target.value })} />
            <textarea placeholder="说明" value={systemForm.description} onChange={(event) => setSystemForm({ ...systemForm, description: event.target.value })} />
            <button className="primary compact" type="submit"><Plus size={16} />创建系统</button>
          </form>
          <div className="list">
            {systems.map((system) => (
              <SystemRow
                key={system.id}
                system={system}
                onDelete={() => mutate(() => api(`/systems/${system.id}`, { method: 'DELETE' }))}
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
                  <UserRow
                    key={item.id}
                    user={item}
                    roles={roles}
                    onSaveDisplayName={(displayName) => mutate(() => api(`/users/${item.id}`, { method: 'PATCH', body: JSON.stringify({ displayName }) }))}
                    onRoleChange={(roleId) => mutate(() => api(`/users/${item.id}/role`, { method: 'PATCH', body: JSON.stringify({ roleId }) }))}
                    onAdminChange={(isAdmin) => mutate(() => api(`/users/${item.id}/admin`, { method: 'PATCH', body: JSON.stringify({ isAdmin }) }))}
                    onApprove={() => mutate(() => api(`/users/${item.id}/approve`, { method: 'PATCH', body: JSON.stringify({ roleId: item.role?.id }) }))}
                    onStatusChange={(status) => mutate(() => api(`/users/${item.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }))}
                  />
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </section>
    </>
  );
}

function SystemEditPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [system, setSystem] = useState<TrackedSystem | null>(null);
  const [draft, setDraft] = useState<SystemDraft | null>(null);
  const [error, setError] = useState('');

  const canManageSystems = hasPermission(user, 'MANAGE_SYSTEMS');

  useEffect(() => {
    if (!id || !canManageSystems) return;
    void api<TrackedSystem>(`/systems/${id}`)
      .then((nextSystem) => {
        setSystem(nextSystem);
        setDraft(toSystemDraft(nextSystem));
      })
      .catch((error) => setError(readError(error)));
  }, [id, canManageSystems]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!id || !draft) return;
    setError('');
    try {
      await api(`/systems/${id}`, { method: 'PATCH', body: JSON.stringify(draft) });
      navigate('/admin');
    } catch (error) {
      setError(readError(error));
    }
  }

  if (!canManageSystems) {
    return <Navigate to="/admin" replace />;
  }

  if (error && !draft) {
    return <div>{error}</div>;
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
          {error && <p className="error">{error}</p>}
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
  onDelete: () => void;
}) {
  return (
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
        <button className="icon-button" onClick={onDelete} title="彻底删除系统"><Trash2 size={16} /></button>
      </div>
    </div>
  );
}

function UserRow({
  user,
  roles,
  onSaveDisplayName,
  onRoleChange,
  onAdminChange,
  onApprove,
  onStatusChange
}: {
  user: User;
  roles: Role[];
  onSaveDisplayName: (displayName: string) => void;
  onRoleChange: (roleId: string | null) => void;
  onAdminChange: (isAdmin: boolean) => void;
  onApprove: () => void;
  onStatusChange: (status: User['status']) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  useEffect(() => {
    setDisplayName(user.displayName);
  }, [user.displayName]);

  const normalizedDisplayName = displayName.trim();
  const canSaveDisplayName = Boolean(normalizedDisplayName && normalizedDisplayName !== user.displayName);
  const initialsSource = (user.displayName || user.username).replace(/\s+/g, '').replace(/^@/, '');
  const initials = initialsSource.slice(0, 2).toUpperCase() || user.username.slice(0, 2).toUpperCase();

  return (
    <tr className="user-row">
      <td className="user-cell" data-label="用户">
        <div className="user-summary">
          <div className="user-avatar" aria-hidden="true">{initials}</div>
          <div className="user-identity">
            <div className="inline-edit user-inline-edit">
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              <button
                className="icon-button user-save-button"
                disabled={!canSaveDisplayName}
                onClick={() => onSaveDisplayName(normalizedDisplayName)}
                title="保存用户"
              >
                <Save size={16} />
              </button>
            </div>
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
          <div className="user-role-picker">
            <span className="user-field-label">当前角色</span>
            <select value={user.role?.id ?? ''} onChange={(event) => onRoleChange(event.target.value || null)}>
              <option value="">无角色</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </div>
        )}
      </td>
      <td className="user-admin-cell" data-label="管理员">
        <label className="user-admin-toggle">
          <input type="checkbox" checked={user.isAdmin} onChange={(event) => onAdminChange(event.target.checked)} />
          <span>{user.isAdmin ? '已启用' : '普通用户'}</span>
        </label>
      </td>
      <td className="user-actions-cell" data-label="操作">
        <div className="actions user-actions">
          {user.status === 'PENDING' && <button className="primary compact" onClick={onApprove}><UserCheck size={16} />审批</button>}
          {user.status !== 'DISABLED' && <button className="ghost compact" onClick={() => onStatusChange('DISABLED')}>禁用</button>}
          {user.status === 'DISABLED' && <button className="ghost compact" onClick={() => onStatusChange('ACTIVE')}>启用</button>}
        </div>
      </td>
    </tr>
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

function InfoBlock({ title, value }: { title: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="info-block">
      <strong>{title}</strong>
      <p>{value}</p>
    </div>
  );
}

function activityTitle(activity: BugActivity) {
  return {
    CREATED: '创建 bug',
    UPDATED: '编辑 bug',
    STATUS_CHANGED: '变更状态',
    DELETED: '移入回收站',
    SCREENSHOT_ADDED: '上传截图',
    SCREENSHOT_REMOVED: '删除截图',
    RUNTIME_INFO_ADDED: '添加运行信息',
    RUNTIME_INFO_UPDATED: '更新运行信息',
    RUNTIME_INFO_REMOVED: '删除运行信息',
    RETEST_RECORDED: '提交复测'
  }[activity.type];
}

function fieldLabel(field: string) {
  return {
    systemId: '所属系统',
    title: '标题',
    description: '描述',
    severity: '严重程度',
    environment: '运行环境',
    steps: '复现步骤',
    expected: '期望结果',
    actual: '实际结果',
    logText: '日志内容'
  }[field] ?? field;
}

function statusLabel(status: BugStatus) {
  return status === 'FIXED' ? '已修复' : '未修复';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatChangeValue(value: string | null) {
  return value && value.length > 0 ? value : '空';
}

function describeActivityContext(activity: BugActivity | null) {
  if (!activity?.context) {
    return '';
  }

  const get = (key: string) => {
    const value = activity.context?.[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  };

  switch (activity.type) {
    case 'SCREENSHOT_ADDED':
    case 'SCREENSHOT_REMOVED':
      return ['文件：' + get('originalName'), get('caption') ? '说明：' + get('caption') : '']
        .filter(Boolean)
        .join('，');
    case 'RUNTIME_INFO_ADDED':
    case 'RUNTIME_INFO_UPDATED':
    case 'RUNTIME_INFO_REMOVED':
      return ['标题：' + get('title'), get('environment') ? '环境：' + get('environment') : '']
        .filter(Boolean)
        .join('，');
    case 'RETEST_RECORDED':
      return [
        '结果：' + (get('result') === 'NOT_APPEARED' ? '未出现' : '确认出现'),
        get('mode') === 'updated' ? '覆盖了之前的复测结果' : '新增一条复测结果',
        get('note') ? '备注：' + get('note') : ''
      ]
        .filter(Boolean)
        .join('，');
    case 'DELETED':
      return get('deletedBy') ? `执行人：${get('deletedBy')}` : '';
    default:
      return '';
  }
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

function updateRuntimeDraft(
  index: number,
  key: 'title' | 'environment' | 'logText',
  value: string,
  drafts: Array<{ title: string; environment: string; logText: string }>,
  setDrafts: (drafts: Array<{ title: string; environment: string; logText: string }>) => void
) {
  setDrafts(drafts.map((draft, itemIndex) => (itemIndex === index ? { ...draft, [key]: value } : draft)));
}

function severityLabel(value: string) {
  return { LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '严重' }[value] ?? value;
}

function readError(error: unknown) {
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as { message?: string | string[] };
      return Array.isArray(parsed.message) ? parsed.message.join('；') : parsed.message ?? error.message;
    } catch {
      return error.message;
    }
  }
  return '请求失败';
}

export default App;
