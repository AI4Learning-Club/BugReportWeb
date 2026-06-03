import { Download, Plus, Save, Search, Shield, Trash2, Upload, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Permission,
  PermissionDefinition,
  Role,
  api
} from './api';

type RoleAdminPanelProps = {
  permissions: PermissionDefinition[];
  roles: Role[];
  onMutate: (action: () => Promise<unknown>) => Promise<void>;
};

type PermissionScope = 'tenant' | 'user';
type SearchField = 'zhName' | 'enName';
type PermissionStatusFilter = 'all' | 'enabled' | 'disabled';
type JsonModalTab = 'import' | 'export';

type PermissionView = PermissionDefinition & {
  scope: PermissionScope;
  scopeLabel: string;
  scopeToken: string;
  module: string;
  category: string;
  permissionType: string;
  requiresApproval: boolean;
  dataScope: string;
  relatedEntries: Array<{ kind: 'API' | '页面'; label: string }>;
};

const PERMISSION_UI_META: Record<Permission, Omit<PermissionView, keyof PermissionDefinition | 'relatedEntries'>> = {
  CREATE_BUG: {
    scope: 'user',
    scopeLabel: '用户身份权限',
    scopeToken: 'user_access_token',
    module: 'Bug 提报',
    category: '提报与录入',
    permissionType: '写入',
    requiresApproval: false,
    dataScope: '当前用户可登记的系统'
  },
  RETEST_BUG: {
    scope: 'user',
    scopeLabel: '用户身份权限',
    scopeToken: 'user_access_token',
    module: 'Bug 提报',
    category: '复测与流转',
    permissionType: '写入',
    requiresApproval: false,
    dataScope: '当前用户可参与复测的 bug'
  },
  MARK_BUG_FIXED: {
    scope: 'user',
    scopeLabel: '用户身份权限',
    scopeToken: 'user_access_token',
    module: 'Bug 提报',
    category: '复测与流转',
    permissionType: '写入',
    requiresApproval: true,
    dataScope: '当前用户可处理的 bug 状态'
  },
  ADD_BUG_EVIDENCE: {
    scope: 'user',
    scopeLabel: '用户身份权限',
    scopeToken: 'user_access_token',
    module: '证据管理',
    category: '附件与日志',
    permissionType: '写入',
    requiresApproval: false,
    dataScope: '当前用户可补充的截图和运行信息'
  },
  DELETE_BUG: {
    scope: 'user',
    scopeLabel: '用户身份权限',
    scopeToken: 'user_access_token',
    module: 'Bug 提报',
    category: '复测与流转',
    permissionType: '管理',
    requiresApproval: true,
    dataScope: '当前角色允许删除的 bug'
  },
  DELETE_BUG_ACTIVITY: {
    scope: 'user',
    scopeLabel: '用户身份权限',
    scopeToken: 'user_access_token',
    module: 'Bug 提报',
    category: '活动记录',
    permissionType: '管理',
    requiresApproval: true,
    dataScope: '当前角色可访问的 bug 活动记录'
  },
  MANAGE_SYSTEMS: {
    scope: 'tenant',
    scopeLabel: '应用身份权限',
    scopeToken: 'tenant_access_token',
    module: '后台管理',
    category: '系统配置',
    permissionType: '管理',
    requiresApproval: true,
    dataScope: '全部系统配置'
  },
  MANAGE_ROLES: {
    scope: 'tenant',
    scopeLabel: '应用身份权限',
    scopeToken: 'tenant_access_token',
    module: '后台管理',
    category: '角色与权限',
    permissionType: '管理',
    requiresApproval: true,
    dataScope: '全部角色和权限配置'
  },
  MANAGE_USERS: {
    scope: 'tenant',
    scopeLabel: '应用身份权限',
    scopeToken: 'tenant_access_token',
    module: '后台管理',
    category: '用户与审批',
    permissionType: '管理',
    requiresApproval: true,
    dataScope: '全部用户账号和审批流'
  }
};

export function RoleAdminPanel({ permissions, roles, onMutate }: RoleAdminPanelProps) {
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [createName, setCreateName] = useState('');
  const [renameDraft, setRenameDraft] = useState('');
  const [search, setSearch] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('zhName');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<PermissionStatusFilter>('all');
  const [grantOpen, setGrantOpen] = useState(false);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonTab, setJsonTab] = useState<JsonModalTab>('import');
  const [jsonDraft, setJsonDraft] = useState('');
  const [grantScope, setGrantScope] = useState<PermissionScope>('tenant');
  const [grantCategory, setGrantCategory] = useState('全部');
  const [grantSearch, setGrantSearch] = useState('');
  const [grantSearchField, setGrantSearchField] = useState<SearchField>('zhName');
  const [draftPermissions, setDraftPermissions] = useState<Permission[]>([]);
  const [expandedRelated, setExpandedRelated] = useState<string[]>([]);
  const [focusedPermissionCode, setFocusedPermissionCode] = useState<Permission | ''>('');
  const [localError, setLocalError] = useState('');
  const [roleDeleteOpen, setRoleDeleteOpen] = useState(false);
  const [roleDeleteSubmitting, setRoleDeleteSubmitting] = useState(false);
  const [roleDeleteError, setRoleDeleteError] = useState('');

  useEffect(() => {
    if (!roles.length) {
      setSelectedRoleId('');
      return;
    }
    if (!roles.some((role) => role.id === selectedRoleId)) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  useEffect(() => {
    setRenameDraft(selectedRole?.name ?? '');
  }, [selectedRole?.id, selectedRole?.name]);

  const permissionViews = useMemo<PermissionView[]>(() => {
    return permissions.map((permission) => {
      const meta = PERMISSION_UI_META[permission.code];
      return {
        ...permission,
        ...meta,
        relatedEntries: [
          ...permission.apis.map((item) => ({ kind: 'API' as const, label: item })),
          ...permission.surfaces.map((item) => ({ kind: '页面' as const, label: item }))
        ]
      };
    });
  }, [permissions]);

  const selectedPermissionSet = useMemo(
    () => new Set(selectedRole?.permissions ?? []),
    [selectedRole?.permissions]
  );

  const moduleOptions = useMemo(
    () => ['all', ...new Set(permissionViews.map((permission) => permission.module))],
    [permissionViews]
  );

  const typeOptions = useMemo(
    () => ['all', ...new Set(permissionViews.map((permission) => permission.permissionType))],
    [permissionViews]
  );

  const tablePermissions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return permissionViews.filter((permission) => {
      const fieldValue = permission[searchField].toLowerCase();
      const matchesKeyword = !keyword || fieldValue.includes(keyword);
      const matchesModule = moduleFilter === 'all' || permission.module === moduleFilter;
      const matchesType = typeFilter === 'all' || permission.permissionType === typeFilter;
      const enabled = selectedPermissionSet.has(permission.code);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'enabled' && enabled) ||
        (statusFilter === 'disabled' && !enabled);

      return matchesKeyword && matchesModule && matchesType && matchesStatus;
    });
  }, [moduleFilter, permissionViews, search, searchField, selectedPermissionSet, statusFilter, typeFilter]);

  const grantPermissionSet = useMemo(() => new Set(draftPermissions), [draftPermissions]);

  const grantPermissions = useMemo(() => {
    const keyword = grantSearch.trim().toLowerCase();
    return permissionViews.filter((permission) => {
      const fieldValue = permission[grantSearchField].toLowerCase();
      const matchesKeyword = !keyword || fieldValue.includes(keyword);
      const matchesScope = permission.scope === grantScope;
      const matchesCategory = grantCategory === '全部' || permission.category === grantCategory;

      return matchesKeyword && matchesScope && matchesCategory;
    });
  }, [grantCategory, grantScope, grantSearch, grantSearchField, permissionViews]);

  const grantCategories = useMemo(() => {
    const scopedPermissions = permissionViews.filter((permission) => permission.scope === grantScope);
    return ['全部', ...new Set(scopedPermissions.map((permission) => permission.category))];
  }, [grantScope, permissionViews]);

  const renameChanged = Boolean(selectedRole && renameDraft.trim() && renameDraft.trim() !== selectedRole.name);
  const selectedRolePermissionCount = selectedRole?.permissionCount ?? selectedRole?.permissions.length ?? 0;
  const selectedRoleUserCount = selectedRole?.userCount ?? 0;

  useEffect(() => {
    if (!grantCategories.includes(grantCategory)) {
      setGrantCategory('全部');
    }
  }, [grantCategories, grantCategory]);

  async function createRole() {
    const name = createName.trim();
    if (!name) {
      setLocalError('角色名称不能为空');
      return;
    }
    setLocalError('');
    try {
      await onMutate(() =>
        api('/roles', {
          method: 'POST',
          body: JSON.stringify({ name, permissions: [] })
        })
      );
      setCreateName('');
    } catch {}
  }

  async function saveRoleName() {
    if (!selectedRole) {
      return;
    }
    const name = renameDraft.trim();
    if (!name) {
      setLocalError('角色名称不能为空');
      return;
    }
    setLocalError('');
    try {
      await onMutate(() =>
        api(`/roles/${selectedRole.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name })
        })
      );
    } catch {}
  }

  async function removeRole() {
    if (!selectedRole) {
      return;
    }
    setRoleDeleteOpen(true);
    setRoleDeleteError('');
  }

  async function confirmRemoveRole() {
    if (!selectedRole) {
      return;
    }
    setRoleDeleteError('');
    setRoleDeleteSubmitting(true);
    try {
      await onMutate(() => api(`/roles/${selectedRole.id}`, { method: 'DELETE' }));
      setRoleDeleteOpen(false);
    } catch (error) {
      setRoleDeleteError(error instanceof Error ? error.message : '删除角色失败');
    } finally {
      setRoleDeleteSubmitting(false);
    }
  }

  function openGrantModal(code?: Permission) {
    if (!selectedRole) {
      setLocalError('请先选择角色');
      return;
    }
    const currentPermissions = [...selectedRole.permissions];
    setDraftPermissions(currentPermissions);
    setGrantSearch('');
    setGrantSearchField('zhName');
    setFocusedPermissionCode(code ?? '');

    const focusPermission = code ? permissionViews.find((permission) => permission.code === code) : null;
    setGrantScope(focusPermission?.scope ?? 'tenant');
    setGrantCategory(focusPermission?.category ?? '全部');
    setGrantOpen(true);
  }

  function closeGrantModal() {
    setGrantOpen(false);
    setFocusedPermissionCode('');
  }

  function openJsonModal(tab: JsonModalTab) {
    if (!selectedRole) {
      setLocalError('请先选择角色');
      return;
    }
    setJsonTab(tab);
    setJsonDraft(buildPermissionScopeJson(selectedRole.permissions, permissionViews));
    setJsonOpen(true);
  }

  function closeJsonModal() {
    setJsonOpen(false);
  }

  async function togglePermission(code: Permission, enabled: boolean) {
    if (!selectedRole) {
      return;
    }

    const nextPermissions = enabled
      ? uniquePermissions([...selectedRole.permissions, code])
      : selectedRole.permissions.filter((permission) => permission !== code);

    setLocalError('');
    try {
      await onMutate(() =>
        api(`/roles/${selectedRole.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: selectedRole.name,
            permissions: nextPermissions
          })
        })
      );
    } catch {}
  }

  function toggleDraftPermission(code: Permission, checked: boolean) {
    setDraftPermissions((current) =>
      checked ? uniquePermissions([...current, code]) : current.filter((permission) => permission !== code)
    );
  }

  async function confirmGrantPermissions() {
    if (!selectedRole) {
      return;
    }

    setLocalError('');
    try {
      await onMutate(() =>
        api(`/roles/${selectedRole.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: selectedRole.name,
            permissions: uniquePermissions(draftPermissions)
          })
        })
      );
      closeGrantModal();
    } catch {}
  }

  async function confirmJsonImport() {
    if (!selectedRole) {
      return;
    }

    try {
      const nextPermissions = parsePermissionScopeJson(jsonDraft, permissionViews);
      setLocalError('');
      await onMutate(() =>
        api(`/roles/${selectedRole.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: selectedRole.name,
            permissions: nextPermissions
          })
        })
      );
      closeJsonModal();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'JSON 导入失败');
    }
  }

  function restoreJsonDefault() {
    if (!selectedRole) {
      return;
    }
    setJsonDraft(buildPermissionScopeJson(selectedRole.permissions, permissionViews));
  }

  function formatJsonDraft() {
    try {
      setJsonDraft(JSON.stringify(JSON.parse(jsonDraft), null, 2));
      setLocalError('');
    } catch {
      setLocalError('当前 JSON 无法格式化，请先修正格式');
    }
  }

  async function downloadCurrentRoleJson() {
    if (!selectedRole) {
      return;
    }
    const blob = new Blob([buildPermissionScopeJson(selectedRole.permissions, permissionViews)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedRole.name}-permissions.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="permission-center-shell">
      <section className="panel permission-role-panel">
        <div className="permission-role-head">
          <div className="permission-role-picker">
            <span className="permission-field-label">当前角色</span>
            <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            <span className="muted">{selectedRoleUserCount} 个用户 · {selectedRolePermissionCount} 项权限</span>
          </div>
          <div className="permission-role-actions">
            <input
              placeholder="重命名当前角色"
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
            />
            <button
              className="ghost compact"
              type="button"
              disabled={!renameChanged}
              onClick={() => void saveRoleName()}
            >
              <Save size={16} />
              保存
            </button>
            <button className="ghost compact danger" type="button" disabled={!selectedRole} onClick={() => void removeRole()}>
              <Trash2 size={16} />
              删除角色
            </button>
          </div>
        </div>

        <div className="permission-role-create">
          <input
            placeholder="新增角色名称"
            value={createName}
            onChange={(event) => setCreateName(event.target.value)}
          />
          <button className="primary compact" type="button" onClick={() => void createRole()}>
            <Plus size={16} />
            创建角色
          </button>
        </div>

        {localError && <p className="error">{localError}</p>}
      </section>

      <section className="panel permission-table-panel">
        <div className="permission-toolbar">
          <div className="permission-toolbar-actions">
            <button className="primary" type="button" onClick={() => openGrantModal()}>
              开通权限
            </button>
            <button className="ghost" type="button" onClick={() => openJsonModal('import')}>
              批量导入/导出权限
            </button>
          </div>

          <div className="permission-toolbar-filters">
            <label className="search-field permission-search">
              <Search size={16} />
              <input
                placeholder="例如：创建 Bug、Manage Users"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select value={searchField} onChange={(event) => setSearchField(event.target.value as SearchField)}>
              <option value="zhName">权限名称</option>
              <option value="enName">英文名称</option>
            </select>
            <select value={moduleFilter} onChange={(event) => setModuleFilter(event.target.value)}>
              <option value="all">业务模块</option>
              {moduleOptions.filter((item) => item !== 'all').map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="all">权限类型</option>
              {typeOptions.filter((item) => item !== 'all').map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PermissionStatusFilter)}>
              <option value="all">权限状态</option>
              <option value="enabled">已开通</option>
              <option value="disabled">未开通</option>
            </select>
          </div>
        </div>

        <div className="table-wrap permission-table-wrap">
          <table className="permission-table">
            <thead>
              <tr>
                <th>权限名称</th>
                <th>权限类型</th>
                <th>权限状态</th>
                <th>可访问的数据范围</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tablePermissions.map((permission) => {
                const enabled = selectedPermissionSet.has(permission.code);
                const expanded = expandedRelated.includes(permission.code);
                const relatedPreview = expanded ? permission.relatedEntries : permission.relatedEntries.slice(0, 2);
                return (
                  <Fragment key={permission.code}>
                    <tr>
                      <td data-label="权限名称">
                        <div className="permission-name-cell">
                          <strong>{permission.zhName}</strong>
                          <span>{permission.code}</span>
                        </div>
                      </td>
                      <td data-label="权限类型">
                        <div className="permission-type-cell">
                          <strong>{permission.scopeLabel}</strong>
                          <span>{permission.scopeToken}</span>
                        </div>
                      </td>
                      <td data-label="权限状态">
                        <span className={`permission-status-chip ${enabled ? 'enabled' : 'disabled'}`}>
                          {enabled ? '已开通' : '未开通'}
                        </span>
                      </td>
                      <td data-label="可访问的数据范围">
                        <div className="permission-scope-cell">
                          <span>{permission.dataScope}</span>
                          <button className="text-link-button" type="button" onClick={() => openGrantModal(permission.code)}>
                            配置
                          </button>
                        </div>
                      </td>
                      <td data-label="操作">
                        <div className="permission-actions-cell">
                          <button
                            className="text-link-button"
                            type="button"
                            onClick={() =>
                              setExpandedRelated((current) =>
                                current.includes(permission.code)
                                  ? current.filter((item) => item !== permission.code)
                                  : [...current, permission.code]
                              )
                            }
                          >
                            相关 API/事件
                          </button>
                          <button
                            className="text-link-button"
                            type="button"
                            onClick={() => {
                              if (enabled) {
                                void togglePermission(permission.code, false);
                              } else {
                                openGrantModal(permission.code);
                              }
                            }}
                          >
                            {enabled ? '关闭' : '开通'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="permission-related-row">
                        <td colSpan={5}>
                          <div className="permission-related-panel">
                            <p>{permission.description}</p>
                            <div className="permission-related-links">
                              {relatedPreview.map((entry, index) => (
                                <span key={permission.code + '-' + entry.kind + '-' + entry.label + '-' + index}>
                                  [{entry.kind}] {entry.label}
                                </span>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {tablePermissions.length === 0 && (
                <tr>
                  <td className="empty-cell" colSpan={5}>没有匹配的权限。</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {grantOpen && (
        <div className="permission-modal-backdrop" role="presentation" onClick={closeGrantModal}>
          <section className="permission-modal grant-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="permission-modal-header">
              <div>
                <h2>开通权限</h2>
                <p>{selectedRole?.name ?? '未选择角色'} · 勾选后确认保存</p>
              </div>
              <button className="icon-button" type="button" onClick={closeGrantModal} title="关闭弹窗">
                <X size={22} />
              </button>
            </header>

            <div className="grant-toolbar">
              <label className="search-field permission-search">
                <Search size={16} />
                <input
                  placeholder="例如：创建 Bug、Delete Bug"
                  value={grantSearch}
                  onChange={(event) => setGrantSearch(event.target.value)}
                />
              </label>
              <select value={grantSearchField} onChange={(event) => setGrantSearchField(event.target.value as SearchField)}>
                <option value="zhName">权限名称</option>
                <option value="enName">英文名称</option>
              </select>
            </div>

            <div className="grant-tabs">
              <button
                className={grantScope === 'tenant' ? 'active' : ''}
                type="button"
                onClick={() => setGrantScope('tenant')}
              >
                应用身份权限 <span>tenant_access_token</span>
              </button>
              <button
                className={grantScope === 'user' ? 'active' : ''}
                type="button"
                onClick={() => setGrantScope('user')}
              >
                用户身份权限 <span>user_access_token</span>
              </button>
            </div>

            <div className="grant-layout">
              <aside className="grant-category-list">
                {grantCategories.map((category) => (
                  <button
                    key={category}
                    className={grantCategory === category ? 'active' : ''}
                    type="button"
                    onClick={() => setGrantCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </aside>

              <div className="grant-list-wrap">
                <table className="grant-list-table">
                  <thead>
                    <tr>
                      <th />
                      <th>权限名称</th>
                      <th>权限描述</th>
                      <th>关联 API/事件</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grantPermissions.map((permission) => {
                      const checked = grantPermissionSet.has(permission.code);
                      const relatedPreview = permission.relatedEntries.slice(0, 2);
                      const focused = focusedPermissionCode === permission.code;
                      return (
                        <tr key={permission.code} className={focused ? 'focused' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => toggleDraftPermission(permission.code, event.target.checked)}
                            />
                          </td>
                          <td>
                            <div className="permission-name-cell">
                              <strong>{permission.zhName}</strong>
                              <span>{permission.code}</span>
                            </div>
                          </td>
                          <td>
                            <div className="grant-description-cell">
                              <strong>{permission.summary}</strong>
                              <span>{permission.description}</span>
                            </div>
                          </td>
                          <td>
                            <div className="grant-related-links">
                              {relatedPreview.map((entry, index) => (
                                <span key={permission.code + '-' + entry.label + '-' + index}>[{entry.kind}] {entry.label}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {grantPermissions.length === 0 && (
                      <tr>
                        <td className="empty-cell" colSpan={4}>没有匹配的权限。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <footer className="permission-modal-footer">
              <button className="ghost" type="button" onClick={closeGrantModal}>取消</button>
              <button className="primary" type="button" onClick={() => void confirmGrantPermissions()}>
                确认开通权限
              </button>
            </footer>
          </section>
        </div>
      )}

      {jsonOpen && (
        <div className="permission-modal-backdrop" role="presentation" onClick={closeJsonModal}>
          <section className="permission-modal json-modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <header className="permission-modal-header">
              <div>
                <h2>批量导入/导出权限</h2>
                <p>{selectedRole?.name ?? '未选择角色'} · 使用当前角色的权限 JSON 结构</p>
              </div>
              <button className="icon-button" type="button" onClick={closeJsonModal} title="关闭弹窗">
                <X size={22} />
              </button>
            </header>

            <div className="json-tabs">
              <button className={jsonTab === 'import' ? 'active' : ''} type="button" onClick={() => setJsonTab('import')}>导入</button>
              <button className={jsonTab === 'export' ? 'active' : ''} type="button" onClick={() => setJsonTab('export')}>导出</button>
            </div>

            <p className="json-description">
              {jsonTab === 'import'
                ? '可按照以下 JSON 结构批量修改当前角色的权限。'
                : '下面展示的是当前角色的权限 JSON，可直接复制或下载。'}
            </p>

            <div className="json-editor-toolbar">
              <strong>JSON</strong>
              <div className="actions">
                {jsonTab === 'import' && (
                  <>
                    <button className="text-link-button" type="button" onClick={restoreJsonDefault}>恢复默认值</button>
                    <button className="text-link-button" type="button" onClick={formatJsonDraft}>格式化 JSON</button>
                  </>
                )}
                {jsonTab === 'export' && (
                  <button className="text-link-button" type="button" onClick={() => void downloadCurrentRoleJson()}>
                    <Download size={16} />
                    下载 JSON
                  </button>
                )}
              </div>
            </div>

            <textarea
              className="json-editor"
              value={jsonTab === 'import' ? jsonDraft : buildPermissionScopeJson(selectedRole?.permissions ?? [], permissionViews)}
              onChange={(event) => {
                if (jsonTab === 'import') {
                  setJsonDraft(event.target.value);
                }
              }}
              readOnly={jsonTab === 'export'}
              spellCheck={false}
            />

            <footer className="permission-modal-footer">
              <button className="ghost" type="button" onClick={closeJsonModal}>取消</button>
              {jsonTab === 'import' ? (
                <button className="primary" type="button" onClick={() => void confirmJsonImport()}>
                  <Upload size={16} />
                  下一步，确认新增权限
                </button>
              ) : (
                <button className="primary" type="button" onClick={() => void downloadCurrentRoleJson()}>
                  <Download size={16} />
                  导出当前 JSON
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
      {roleDeleteOpen && selectedRole && (
        <div className="bug-delete-modal-backdrop" role="presentation">
          <section className="bug-delete-modal" role="dialog" aria-modal="true" aria-labelledby="role-delete-modal-title">
            <header className="bug-delete-modal-header">
              <div>
                <h2 id="role-delete-modal-title">删除角色</h2>
                <p>删除后该角色将不可继续分配给用户，请确认没有仍需保留的配置。</p>
              </div>
              <button
                className="icon-button"
                type="button"
                disabled={roleDeleteSubmitting}
                onClick={() => {
                  if (!roleDeleteSubmitting) {
                    setRoleDeleteOpen(false);
                    setRoleDeleteError('');
                  }
                }}
                title="关闭窗口"
              >
                <X size={20} />
              </button>
            </header>
            <div className="bug-delete-modal-body">
              <div className="delete-target">
                <span>目标角色</span>
                <strong>{selectedRole.name}</strong>
              </div>
              <p className="delete-warning">请确认你要删除这个角色。此操作不会删除用户，但会影响角色配置。</p>
              {roleDeleteError && <p className="error">{roleDeleteError}</p>}
              <footer className="bug-delete-modal-actions">
                <button
                  className="ghost"
                  type="button"
                  disabled={roleDeleteSubmitting}
                  onClick={() => {
                    if (!roleDeleteSubmitting) {
                      setRoleDeleteOpen(false);
                      setRoleDeleteError('');
                    }
                  }}
                >
                  取消
                </button>
                <button className="ghost danger" type="button" disabled={roleDeleteSubmitting} onClick={() => void confirmRemoveRole()}>
                  <Trash2 size={16} />
                  {roleDeleteSubmitting ? '处理中...' : '确认删除角色'}
                </button>
              </footer>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function uniquePermissions(permissions: Permission[]) {
  return [...new Set(permissions)];
}

function buildPermissionScopeJson(selectedPermissions: Permission[], permissionViews: PermissionView[]) {
  const selectedSet = new Set(selectedPermissions);
  const tenant = permissionViews
    .filter((permission) => permission.scope === 'tenant' && selectedSet.has(permission.code))
    .map((permission) => permission.code);
  const user = permissionViews
    .filter((permission) => permission.scope === 'user' && selectedSet.has(permission.code))
    .map((permission) => permission.code);

  return JSON.stringify(
    {
      scopes: {
        tenant,
        user
      }
    },
    null,
    2
  );
}

function parsePermissionScopeJson(jsonDraft: string, permissionViews: PermissionView[]) {
  const parsed = JSON.parse(jsonDraft) as {
    scopes?: {
      tenant?: unknown;
      user?: unknown;
    };
  };

  const tenant = validateScopePermissions(parsed.scopes?.tenant, 'tenant', permissionViews);
  const user = validateScopePermissions(parsed.scopes?.user, 'user', permissionViews);
  return uniquePermissions([...tenant, ...user]);
}

function validateScopePermissions(
  value: unknown,
  scope: PermissionScope,
  permissionViews: PermissionView[]
) {
  if (!Array.isArray(value)) {
    throw new Error(`scopes.${scope} 必须是数组`);
  }

  const scopePermissions = new Set(
    permissionViews.filter((permission) => permission.scope === scope).map((permission) => permission.code)
  );

  const invalid = value.filter((item): item is string => typeof item !== 'string' || !scopePermissions.has(item as Permission));
  if (invalid.length > 0) {
    throw new Error(`scopes.${scope} 中存在无效权限：${invalid.join(', ')}`);
  }

  return value as Permission[];
}
