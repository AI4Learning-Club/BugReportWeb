import { Download, Plus, Save, Search, Shield, Trash2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Permission,
  PermissionDefinition,
  Role,
  RoleConfigDocument,
  api
} from './api';

type RoleAdminPanelProps = {
  permissions: PermissionDefinition[];
  roles: Role[];
  onMutate: (action: () => Promise<unknown>) => Promise<void>;
};

export function RoleAdminPanel({ permissions, roles, onMutate }: RoleAdminPanelProps) {
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [createName, setCreateName] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [selectedPermissionCode, setSelectedPermissionCode] = useState<Permission | ''>('');
  const [renameDraft, setRenameDraft] = useState('');
  const [search, setSearch] = useState('');
  const [localError, setLocalError] = useState('');
  const [previewDoc, setPreviewDoc] = useState<RoleConfigDocument | null>(null);

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

  const filteredPermissions = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return permissions;
    }
    return permissions.filter((permission) =>
      [permission.zhName, permission.enName, permission.code, permission.summary]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [permissions, search]);

  useEffect(() => {
    if (!filteredPermissions.length) {
      setSelectedPermissionCode('');
      return;
    }
    if (!selectedPermissionCode || !filteredPermissions.some((permission) => permission.code === selectedPermissionCode)) {
      setSelectedPermissionCode(filteredPermissions[0].code);
    }
  }, [filteredPermissions, selectedPermissionCode]);

  const selectedPermission = filteredPermissions.find((permission) => permission.code === selectedPermissionCode)
    ?? permissions.find((permission) => permission.code === selectedPermissionCode)
    ?? null;

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, PermissionDefinition[]>();
    for (const permission of filteredPermissions) {
      const list = groups.get(permission.group) ?? [];
      list.push(permission);
      groups.set(permission.group, list);
    }
    return Array.from(groups.entries());
  }, [filteredPermissions]);

  const selectedPermissions = new Set(selectedRole?.permissions ?? []);
  const renameChanged = Boolean(selectedRole && renameDraft.trim() && renameDraft.trim() !== selectedRole.name);
  const permissionEnabled = selectedPermission ? selectedPermissions.has(selectedPermission.code) : false;

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

  async function togglePermission(enabled: boolean) {
    if (!selectedRole || !selectedPermission) {
      return;
    }
    setLocalError('');
    const nextPermissions = enabled
      ? [...selectedRole.permissions, selectedPermission.code]
      : selectedRole.permissions.filter((permission) => permission !== selectedPermission.code);
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

  async function exportRoles() {
    setLocalError('');
    const roleConfig = await api<RoleConfigDocument>('/roles/export');
    const blob = new Blob([JSON.stringify(roleConfig, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = `bug-report-roles-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function confirmImport() {
    if (!previewDoc) {
      return;
    }
    setLocalError('');
    try {
      await onMutate(() =>
        api('/roles/import', {
          method: 'POST',
          body: JSON.stringify(previewDoc)
        })
      );
      setPreviewDoc(null);
    } catch {}
  }

  async function removeRole(role: Role) {
    setLocalError('');
    try {
      await onMutate(() => api(`/roles/${role.id}`, { method: 'DELETE' }));
    } catch {}
  }

  async function handleImportFile(file: File | null) {
    if (!file) {
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const document = normalizeRoleConfigDocument(parsed);
      setPreviewDoc(document);
      setLocalError('');
    } catch (error) {
      setPreviewDoc(null);
      setLocalError(error instanceof Error ? error.message : '导入文件解析失败');
    }
  }

  return (
    <div className="role-admin-layout">
      <section className="panel role-admin-sidebar">
        <div className="role-admin-section">
          <div className="role-admin-heading">
            <h2>角色权限中心</h2>
            <span className="muted">按角色管理权限，并支持 JSON 批量维护。</span>
          </div>
          <div className="role-admin-create">
            <input
              placeholder="输入角色名称"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
            />
            <button className="primary compact" type="button" onClick={() => void createRole()}>
              <Plus size={16} />
              创建角色
            </button>
          </div>
          <div className="role-admin-actions">
            <button className="ghost compact" type="button" onClick={() => void exportRoles()}>
              <Download size={16} />
              导出 JSON
            </button>
            <button className="ghost compact" type="button" onClick={() => importInputRef.current?.click()}>
              <Upload size={16} />
              导入 JSON
            </button>
            <input
              ref={importInputRef}
              className="hidden-input"
              type="file"
              accept="application/json"
              onChange={(event) => {
                void handleImportFile(event.target.files?.[0] ?? null);
                event.currentTarget.value = '';
              }}
            />
          </div>
          {previewDoc && (
            <div className="import-preview-card">
              <strong>导入预览</strong>
              <p>版本 {previewDoc.version}，共 {previewDoc.roles.length} 个角色，确认后将整体覆盖现有角色配置。</p>
              <div className="actions">
                <button className="primary compact" type="button" onClick={() => void confirmImport()}>
                  <Upload size={16} />
                  确认覆盖导入
                </button>
                <button className="ghost compact" type="button" onClick={() => setPreviewDoc(null)}>
                  取消
                </button>
              </div>
            </div>
          )}
          {localError && <p className="error">{localError}</p>}
        </div>

        {selectedRole && (
          <div className="role-admin-section role-admin-role-settings">
            <div className="role-admin-heading">
              <h3>当前角色</h3>
              <span className="muted">{selectedRole.userCount ?? 0} 个用户 · {selectedRole.permissionCount ?? selectedRole.permissions.length} 项权限</span>
            </div>
            <input value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} />
            <div className="actions">
              <button
                className="ghost compact"
                type="button"
                disabled={!renameChanged}
                onClick={() => void saveRoleName()}
              >
                <Save size={16} />
                保存名称
              </button>
              <button className="ghost compact danger" type="button" onClick={() => void removeRole(selectedRole)}>
                <Trash2 size={16} />
                删除角色
              </button>
            </div>
          </div>
        )}

        <div className="role-admin-section">
          <div className="role-admin-heading">
            <h3>角色列表</h3>
            <span className="muted">点击角色以切换权限视图。</span>
          </div>
          <div className="role-list">
            {roles.map((role) => (
              <button
                key={role.id}
                className={`role-list-item ${role.id === selectedRoleId ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedRoleId(role.id)}
              >
                <div>
                  <strong>{role.name}</strong>
                  <span>{role.userCount ?? 0} 个用户</span>
                </div>
                <span className="permission-tag">{role.permissionCount ?? role.permissions.length} 项权限</span>
              </button>
            ))}
            {roles.length === 0 && <p className="muted">暂无角色，请先创建角色。</p>}
          </div>
        </div>
      </section>

      <section className="panel role-admin-catalog">
        <div className="role-admin-heading">
          <h2>{selectedRole ? `${selectedRole.name} 的权限目录` : '权限目录'}</h2>
          <span className="muted">主页仅展示核心信息，点击可在右侧查看详细说明。</span>
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            placeholder="按中文名、英文名或权限码搜索"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="permission-group-list">
          {groupedPermissions.map(([group, groupPermissions]) => (
            <section key={group} className="permission-group">
              <header>
                <strong>{group}</strong>
                <span>{groupPermissions.length} 项</span>
              </header>
              <div className="permission-cards">
                {groupPermissions.map((permission) => {
                  const enabled = selectedPermissions.has(permission.code);
                  return (
                    <button
                      key={permission.code}
                      className={`permission-card ${selectedPermissionCode === permission.code ? 'active' : ''}`}
                      type="button"
                      onClick={() => setSelectedPermissionCode(permission.code)}
                    >
                      <div className="permission-card-main">
                        <div className="permission-card-title">
                          <strong>{permission.zhName}</strong>
                          <span>{permission.enName}</span>
                        </div>
                        <p>{permission.summary}</p>
                      </div>
                      <div className="permission-card-meta">
                        <span className="permission-tag">{permission.group}</span>
                        <span className={`permission-state ${enabled ? 'enabled' : 'disabled'}`}>
                          {enabled ? '已授权' : '未授权'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          {groupedPermissions.length === 0 && <p className="muted">没有匹配的权限。</p>}
        </div>
      </section>

      <section className="panel role-admin-detail">
        {selectedRole && selectedPermission ? (
          <>
            <div className="role-admin-heading">
              <h2>{selectedPermission.zhName}</h2>
              <span className="muted">{selectedPermission.enName}</span>
            </div>
            <div className="role-admin-detail-meta">
              <span className="permission-tag">{selectedPermission.group}</span>
              <span className={`permission-state ${permissionEnabled ? 'enabled' : 'disabled'}`}>
                {permissionEnabled ? `${selectedRole.name} 已授权` : `${selectedRole.name} 未授权`}
              </span>
            </div>
            <p>{selectedPermission.description}</p>
            <div className="detail-block">
              <strong>关联页面</strong>
              <ul>
                {selectedPermission.surfaces.map((surface) => <li key={surface}>{surface}</li>)}
              </ul>
            </div>
            <div className="detail-block">
              <strong>关联接口</strong>
              <ul>
                {selectedPermission.apis.map((endpoint) => <li key={endpoint}>{endpoint}</li>)}
              </ul>
            </div>
            <button
              className={permissionEnabled ? 'ghost compact' : 'primary compact'}
              type="button"
              onClick={() => void togglePermission(!permissionEnabled)}
            >
              <Shield size={16} />
              {permissionEnabled ? '取消授权' : '授予权限'}
            </button>
          </>
        ) : (
          <div className="role-admin-empty">
            <Shield size={22} />
            <p>选择一个角色和权限后，在这里查看详细说明并直接调整授权。</p>
          </div>
        )}
      </section>
    </div>
  );
}

function normalizeRoleConfigDocument(input: unknown): RoleConfigDocument {
  if (!input || typeof input !== 'object') {
    throw new Error('导入文件必须是 JSON 对象');
  }
  const value = input as Partial<RoleConfigDocument>;
  if (value.version !== 1) {
    throw new Error('仅支持 version = 1 的角色配置文件');
  }
  if (!Array.isArray(value.roles) || value.roles.length === 0) {
    throw new Error('roles 必须是非空数组');
  }

  const roles = value.roles.map((role) => {
    const name = role.name?.trim();
    if (!name) {
      throw new Error('角色名称不能为空');
    }
    if (!Array.isArray(role.permissions)) {
      throw new Error(`角色 ${name} 的 permissions 必须是数组`);
    }
    return {
      name,
      permissions: role.permissions
    };
  });

  const duplicatedNames = roles
    .map((role) => role.name)
    .filter((name, index, allNames) => allNames.indexOf(name) !== index);

  if (duplicatedNames.length > 0) {
    throw new Error(`导入文件存在重复角色名：${[...new Set(duplicatedNames)].join('、')}`);
  }

  return {
    version: 1,
    roles
  };
}
