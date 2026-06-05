import { Shield, UserCheck, Users } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import {
  AssignableUser,
  User,
  api,
  claimBugOwner,
  claimFeatureOwner,
  hasPermission,
  joinBugPersonnel,
  joinFeaturePersonnel,
  patchBugPersonnel,
  patchFeaturePersonnel
} from './api';
import { readError } from './errorUtils';
import { ActionModal, FormModal } from './ModalShell';
import { notifyError } from './ToastProvider';

type PersonnelKind = 'bug' | 'feature';

type PersonnelPatchBody = Parameters<typeof patchBugPersonnel>[1];

function usePersonnelPermissions(
  user: User | null,
  kind: PersonnelKind,
  owner: AssignableUser | null,
  relatedUsers: AssignableUser[],
  disabled?: boolean
) {
  const joinPermission = kind === 'bug' ? 'MARK_BUG_FIXED' : 'UPDATE_FEATURE';
  const isOwner = owner?.id === user?.id;
  const isRelated = relatedUsers.some((person) => person.id === user?.id);

  return {
    canJoin: !disabled && hasPermission(user, joinPermission) && !isOwner && !isRelated,
    canClaimOwner: !disabled && hasPermission(user, 'BECOME_ITEM_OWNER') && !isOwner,
    canDelegateOwner: !disabled && hasPermission(user, 'DELEGATE_ITEM_OWNER'),
    canDelegateRelated: !disabled && hasPermission(user, 'DELEGATE_ITEM_RELATED'),
    canRevokeOwner:
      !disabled &&
      Boolean(owner) &&
      (hasPermission(user, 'DELEGATE_ITEM_OWNER') ||
        (isOwner && hasPermission(user, 'BECOME_ITEM_OWNER'))),
    canLeaveRelated: !disabled && isRelated,
    hasManageDialog:
      !disabled &&
      (hasPermission(user, 'DELEGATE_ITEM_OWNER') ||
        hasPermission(user, 'DELEGATE_ITEM_RELATED') ||
        (Boolean(owner) &&
          (hasPermission(user, 'DELEGATE_ITEM_OWNER') ||
            (isOwner && hasPermission(user, 'BECOME_ITEM_OWNER')))) ||
        isRelated)
  };
}

function isEmptyPersonnelPatch(body: PersonnelPatchBody) {
  const hasOwner = body.ownerId !== undefined;
  const addRelatedUserIds = body.addRelatedUserIds ?? [];
  const removeRelatedUserIds = body.removeRelatedUserIds ?? [];
  return !hasOwner && addRelatedUserIds.length === 0 && removeRelatedUserIds.length === 0;
}

export function PersonnelPanel({
  kind,
  entityId,
  owner,
  relatedUsers,
  disabled,
  onUpdated,
  user
}: {
  kind: PersonnelKind;
  entityId: string;
  owner: AssignableUser | null;
  relatedUsers: AssignableUser[];
  disabled?: boolean;
  onUpdated: () => Promise<void>;
  user: User | null;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const perms = usePersonnelPermissions(user, kind, owner, relatedUsers, disabled);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await onUpdated();
    } catch (actionError) {
      notifyError(readError(actionError));
    } finally {
      setBusy(false);
    }
  }

  const showActions =
    !disabled &&
    (perms.canJoin || perms.canClaimOwner || perms.hasManageDialog);

  return (
    <>
      <div className="info-block personnel-panel">
        <strong>负责人与相关人员</strong>
        <div className="personnel-status-board">
          <div className="personnel-status-card">
            <span className="personnel-status-label">负责人</span>
            <div className="personnel-status-value">
              {owner ? (
                <span className="personnel-chip personnel-chip-owner">{owner.displayName}</span>
              ) : (
                <span className="personnel-status-empty">未指定</span>
              )}
            </div>
          </div>
          <div className="personnel-status-card">
            <span className="personnel-status-label">相关人员</span>
            <div className="personnel-status-value related-user-chips">
              {relatedUsers.length === 0 && <span className="personnel-status-empty">暂无相关人员</span>}
              {relatedUsers.map((person) => (
                <span key={person.id} className="personnel-chip">{person.displayName}</span>
              ))}
            </div>
          </div>
        </div>
        {showActions && (
          <div className="personnel-actions">
            {perms.canJoin && (
              <button
                className="ghost compact"
                type="button"
                disabled={busy}
                onClick={() => void run(() => (kind === 'bug' ? joinBugPersonnel(entityId) : joinFeaturePersonnel(entityId)))}
              >
                <UserCheck size={16} />加入相关人
              </button>
            )}
            {perms.canClaimOwner && (
              <button
                className="ghost compact"
                type="button"
                disabled={busy}
                onClick={() => void run(() => (kind === 'bug' ? claimBugOwner(entityId) : claimFeatureOwner(entityId)))}
              >
                <Shield size={16} />我来负责
              </button>
            )}
            {perms.hasManageDialog && (
              <button className="ghost compact" type="button" disabled={busy} onClick={() => setManageOpen(true)}>
                <Users size={16} />管理人员…
              </button>
            )}
          </div>
        )}
      </div>
      {manageOpen && (
        <PersonnelManageDialog
          kind={kind}
          entityId={entityId}
          owner={owner}
          relatedUsers={relatedUsers}
          user={user}
          disabled={disabled}
          onClose={() => setManageOpen(false)}
          onUpdated={onUpdated}
        />
      )}
    </>
  );
}

function PersonnelManageDialog({
  kind,
  entityId,
  owner,
  relatedUsers,
  user,
  disabled,
  onClose,
  onUpdated
}: {
  kind: PersonnelKind;
  entityId: string;
  owner: AssignableUser | null;
  relatedUsers: AssignableUser[];
  user: User | null;
  disabled?: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
}) {
  const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([]);
  const [delegateOwnerId, setDelegateOwnerId] = useState('');
  const [busy, setBusy] = useState(false);

  const perms = usePersonnelPermissions(user, kind, owner, relatedUsers, disabled);

  useEffect(() => {
    void api<AssignableUser[]>('/auth/assignable-users').then(setAssignableUsers).catch(() => undefined);
  }, []);

  function patch(body: PersonnelPatchBody) {
    return kind === 'bug' ? patchBugPersonnel(entityId, body) : patchFeaturePersonnel(entityId, body);
  }

  async function runPatch(body: PersonnelPatchBody) {
    if (isEmptyPersonnelPatch(body)) {
      notifyError('请先选择要变更的人员');
      return;
    }
    setBusy(true);
    try {
      await patch(body);
      await onUpdated();
      setDelegateOwnerId('');
    } catch (actionError) {
      notifyError(readError(actionError));
    } finally {
      setBusy(false);
    }
  }

  const selectableUsers = useMemo(
    () => assignableUsers.filter((person) => person.id !== owner?.id),
    [assignableUsers, owner?.id]
  );

  function toggleRelatedUser(userId: string) {
    const isRelated = relatedUsers.some((person) => person.id === userId);
    void runPatch(isRelated ? { removeRelatedUserIds: [userId] } : { addRelatedUserIds: [userId] });
  }

  return (
    <FormModal
      title="管理人员"
      description="委派负责人、添加或移除相关人员"
      titleId="personnel-manage-modal-title"
      submitting={busy}
      onClose={onClose}
      modalClassName="personnel-manage-modal"
      footer={(
        <button className="ghost" type="button" onClick={onClose} disabled={busy}>
          关闭
        </button>
      )}
    >
      <div className="stack personnel-manage-body">
        <div className="personnel-status-board">
          <div className="personnel-status-card">
            <span className="personnel-status-label">负责人</span>
            <div className="personnel-status-value">
              {owner ? (
                <span className="personnel-chip personnel-chip-owner">{owner.displayName}</span>
              ) : (
                <span className="personnel-status-empty">未指定</span>
              )}
            </div>
          </div>
          <div className="personnel-status-card">
            <span className="personnel-status-label">相关人员</span>
            <div className="personnel-status-value related-user-chips">
              {relatedUsers.length === 0 && <span className="personnel-status-empty">暂无相关人员</span>}
              {relatedUsers.map((person) => (
                <span key={person.id} className="personnel-chip">{person.displayName}</span>
              ))}
            </div>
          </div>
        </div>

        {perms.canRevokeOwner && (
          <div className="personnel-manage-section">
            <button
              className="ghost compact"
              type="button"
              disabled={busy}
              onClick={() => void runPatch({ ownerId: null })}
            >
              撤销负责人
            </button>
          </div>
        )}

        {perms.canLeaveRelated && user && (
          <div className="personnel-manage-section">
            <button
              className="ghost compact"
              type="button"
              disabled={busy}
              onClick={() => void runPatch({ removeRelatedUserIds: [user.id] })}
            >
              退出相关人
            </button>
          </div>
        )}

        {perms.canDelegateOwner && (
          <div className="personnel-manage-section">
            <label className="personnel-delegate">
              委派负责人
              <div className="personnel-delegate-row">
                <select value={delegateOwnerId} onChange={(event) => setDelegateOwnerId(event.target.value)}>
                  <option value="">选择用户</option>
                  {assignableUsers.map((person) => (
                    <option key={person.id} value={person.id}>{person.displayName}</option>
                  ))}
                </select>
                <button
                  className="primary compact"
                  type="button"
                  disabled={busy || !delegateOwnerId}
                  onClick={() => void runPatch({ ownerId: delegateOwnerId })}
                >
                  确认委派
                </button>
              </div>
            </label>
          </div>
        )}

        {perms.canDelegateRelated && (
          <div className="personnel-manage-section">
            <label className="personnel-delegate">
              添加相关人
              <MultiSelectDropdown
                options={selectableUsers.map((person) => ({ id: person.id, label: person.displayName }))}
                selectedIds={relatedUsers.map((person) => person.id)}
                onToggle={toggleRelatedUser}
                placeholder="选择用户"
                emptyText="暂无可添加的用户"
                disabled={busy}
              />
            </label>
          </div>
        )}
      </div>
    </FormModal>
  );
}

export function BugRetestDialog({
  submitting,
  onClose,
  onConfirm
}: {
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: { result: string; note: string }) => void;
}) {
  const [result, setResult] = useState('APPEARED');
  const [note, setNote] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    onConfirm({ result, note });
  }

  return (
    <ActionModal
      title="提交复测"
      description="记录复测结果，将更新 bug 的出现统计"
      titleId="bug-retest-modal-title"
      submitting={submitting}
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button className="ghost" type="button" onClick={onClose} disabled={submitting}>取消</button>
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? '处理中...' : '提交复测'}
          </button>
        </>
      )}
    >
      <label>
        复测结果
        <select value={result} onChange={(event) => setResult(event.target.value)}>
          <option value="APPEARED">仍然出现</option>
          <option value="NOT_APPEARED">未复现</option>
        </select>
      </label>
      <label>
        备注
        <input placeholder="可选备注" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
    </ActionModal>
  );
}
