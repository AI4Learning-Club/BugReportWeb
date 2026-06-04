import { CheckCircle2, Plus, Save, Trash2, Upload } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { BugActivity, BugStatus, FeatureActivity, FeatureStatus, Role, TrackedSystem, User } from './api';
import { ActionModal, FormModal } from './ModalShell';
import { RuntimeInfoDraft, RuntimeInfoFields } from './RuntimeInfoFields';
import {
  ActivityItemBody,
  ItemActivity,
  ItemActivityKind,
  activityTitle,
  formatDateTime,
  statusLabel
} from './activityUtils';

export function RuntimeInfoDialog({
  submitting,
  error,
  onClose,
  onConfirm
}: {
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (payload: RuntimeInfoDraft) => void;
}) {
  const [runtime, setRuntime] = useState<RuntimeInfoDraft>({ title: '', environment: '', logText: '' });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    onConfirm(runtime);
  }

  return (
    <ActionModal
      title="添加运行信息"
      description="填写运行环境说明与日志内容"
      titleId="runtime-info-modal-title"
      submitting={submitting}
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button className="ghost" type="button" onClick={onClose} disabled={submitting}>取消</button>
          <button className="primary" type="submit" disabled={submitting}>
            <Plus size={16} />
            {submitting ? '处理中...' : '保存运行信息'}
          </button>
        </>
      )}
    >
      <RuntimeInfoFields value={runtime} onChange={setRuntime} />
      {error && <p className="error">{error}</p>}
    </ActionModal>
  );
}

export function EvidenceUploadDialog({
  submitting,
  error,
  onClose,
  onConfirm
}: {
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !file) return;
    onConfirm(file);
  }

  return (
    <ActionModal
      title="上传截图"
      description="选择图片文件作为 bug 证据"
      titleId="evidence-upload-modal-title"
      submitting={submitting}
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button className="ghost" type="button" onClick={onClose} disabled={submitting}>取消</button>
          <button className="primary" type="submit" disabled={submitting || !file}>
            <Upload size={16} />
            {submitting ? '上传中...' : '上传'}
          </button>
        </>
      )}
    >
      <label>
        选择文件
        <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      </label>
      {file && <p className="muted">已选：{file.name}</p>}
      {error && <p className="error">{error}</p>}
    </ActionModal>
  );
}

export function ActivityListDialog({
  activities,
  kind,
  canDeleteActivity,
  onClose,
  onDeleteActivity
}: {
  activities: ItemActivity[];
  kind: ItemActivityKind;
  canDeleteActivity: boolean;
  onClose: () => void;
  onDeleteActivity: (activity: ItemActivity) => void;
}) {
  return (
    <FormModal
      title="全部活动记录"
      description={`共 ${activities.length} 条操作历史`}
      titleId="activity-list-modal-title"
      onClose={onClose}
      modalClassName="activity-list-modal"
      footer={(
        <button className="ghost" type="button" onClick={onClose}>关闭</button>
      )}
    >
      <div className="activity-list activity-list-modal-body">
        {activities.map((activity) => (
          <ActivityItemBody
            key={activity.id}
            activity={activity}
            kind={kind}
            showDelete={canDeleteActivity}
            onDelete={() => onDeleteActivity(activity)}
          />
        ))}
        {activities.length === 0 && <p className="muted">暂无活动记录</p>}
      </div>
    </FormModal>
  );
}

const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  PLANNED: '规划中',
  IN_PROGRESS: '进行中',
  DONE: '已完成'
};

export function FeatureStatusDialog({
  currentStatus,
  submitting,
  error,
  onClose,
  onConfirm
}: {
  currentStatus: FeatureStatus;
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (status: FeatureStatus) => void;
}) {
  const [nextStatus, setNextStatus] = useState<FeatureStatus>(currentStatus);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || nextStatus === currentStatus) return;
    onConfirm(nextStatus);
  }

  return (
    <ActionModal
      title="变更功能状态"
      description="确认后将更新功能的当前状态"
      titleId="feature-status-modal-title"
      submitting={submitting}
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button className="ghost" type="button" onClick={onClose} disabled={submitting}>取消</button>
          <button className="primary" type="submit" disabled={submitting || nextStatus === currentStatus}>
            <CheckCircle2 size={16} />
            {submitting ? '处理中...' : '确认变更'}
          </button>
        </>
      )}
    >
      <div className="delete-target action-target">
        <span>状态变更</span>
        <strong>{FEATURE_STATUS_LABELS[currentStatus]} {'->'} {FEATURE_STATUS_LABELS[nextStatus]}</strong>
      </div>
      <label>
        目标状态
        <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as FeatureStatus)}>
          <option value="PLANNED">规划中</option>
          <option value="IN_PROGRESS">进行中</option>
          <option value="DONE">已完成</option>
        </select>
      </label>
      {error && <p className="error">{error}</p>}
    </ActionModal>
  );
}

export function CreateSystemDialog({
  submitting,
  error,
  onClose,
  onConfirm
}: {
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onConfirm: (payload: { name: string; description: string; owner: string; versionInfo: string }) => void;
}) {
  const [form, setForm] = useState({ name: '', description: '', owner: '', versionInfo: '' });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !form.name.trim()) return;
    onConfirm(form);
  }

  return (
    <ActionModal
      title="新建系统"
      description="登记新的跟踪系统"
      titleId="create-system-modal-title"
      submitting={submitting}
      onClose={onClose}
      onSubmit={submit}
      footer={(
        <>
          <button className="ghost" type="button" onClick={onClose} disabled={submitting}>取消</button>
          <button className="primary" type="submit" disabled={submitting || !form.name.trim()}>
            <Plus size={16} />
            {submitting ? '处理中...' : '创建系统'}
          </button>
        </>
      )}
    >
      <label>系统名称<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <label>负责人<input value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} /></label>
      <label>版本信息<input value={form.versionInfo} onChange={(event) => setForm({ ...form, versionInfo: event.target.value })} /></label>
      <label>说明<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      {error && <p className="error">{error}</p>}
    </ActionModal>
  );
}

export function ConfirmDeleteDialog({
  title,
  description,
  targetLabel,
  targetName,
  warning,
  submitting,
  error,
  confirmLabel,
  onClose,
  onConfirm
}: {
  title: string;
  description: string;
  targetLabel: string;
  targetName: string;
  warning?: string;
  submitting: boolean;
  error?: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ActionModal
      title={title}
      description={description}
      titleId="confirm-delete-modal-title"
      submitting={submitting}
      onClose={onClose}
      footer={(
        <>
          <button className="ghost" type="button" onClick={onClose} disabled={submitting}>取消</button>
          <button className="ghost danger" type="button" disabled={submitting} onClick={onConfirm}>
            <Trash2 size={16} />
            {submitting ? '处理中...' : confirmLabel}
          </button>
        </>
      )}
    >
      <div className="delete-target">
        <span>{targetLabel}</span>
        <strong>{targetName}</strong>
      </div>
      {warning && <p className="delete-warning">{warning}</p>}
      {error && <p className="error">{error}</p>}
    </ActionModal>
  );
}

export function UserManageDialog({
  user,
  roles,
  submitting,
  error,
  onClose,
  onSaveDisplayName,
  onRoleChange,
  onAdminChange,
  onApprove,
  onStatusChange
}: {
  user: User;
  roles: Role[];
  submitting: boolean;
  error?: string;
  onClose: () => void;
  onSaveDisplayName: (displayName: string) => void;
  onRoleChange: (roleId: string | null) => void;
  onAdminChange: (isAdmin: boolean) => void;
  onApprove: () => void;
  onStatusChange: (status: User['status']) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [roleId, setRoleId] = useState(user.role?.id ?? '');
  const [isAdmin, setIsAdmin] = useState(user.isAdmin);

  const normalizedDisplayName = displayName.trim();
  const canSaveDisplayName = Boolean(normalizedDisplayName && normalizedDisplayName !== user.displayName);
  const roleChanged = (roleId || null) !== (user.role?.id ?? null);
  const adminChanged = isAdmin !== user.isAdmin;

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (canSaveDisplayName) {
      onSaveDisplayName(normalizedDisplayName);
    }
    if (roleChanged && !user.isAdmin) {
      onRoleChange(roleId || null);
    }
    if (adminChanged) {
      onAdminChange(isAdmin);
    }
  }

  return (
    <FormModal
      title="管理用户"
      description={`@${user.username}`}
      titleId="user-manage-modal-title"
      submitting={submitting}
      onClose={onClose}
      modalClassName="user-manage-modal"
      footer={(
        <>
          <button className="ghost" type="button" onClick={onClose} disabled={submitting}>取消</button>
          <button
            className="primary"
            type="submit"
            form="user-manage-form"
            disabled={submitting || (!canSaveDisplayName && !roleChanged && !adminChanged)}
          >
            <Save size={16} />
            {submitting ? '保存中...' : '保存更改'}
          </button>
        </>
      )}
    >
      <form id="user-manage-form" className="stack user-manage-body" onSubmit={saveProfile}>
        <label>
          显示名称
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </label>
        {!user.isAdmin && (
          <label>
            角色
            <select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
              <option value="">无角色</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </label>
        )}
        <label className="user-admin-toggle">
          <input type="checkbox" checked={isAdmin} onChange={(event) => setIsAdmin(event.target.checked)} />
          <span>{isAdmin ? '系统管理员' : '普通用户'}</span>
        </label>

        <div className="user-manage-actions">
          <span className="muted">当前状态：{user.status}</span>
          {user.status === 'PENDING' && (
            <button className="primary compact" type="button" disabled={submitting} onClick={onApprove}>
              审批通过
            </button>
          )}
          {user.status !== 'DISABLED' && (
            <button className="ghost compact danger" type="button" disabled={submitting} onClick={() => onStatusChange('DISABLED')}>
              禁用用户
            </button>
          )}
          {user.status === 'DISABLED' && (
            <button className="ghost compact" type="button" disabled={submitting} onClick={() => onStatusChange('ACTIVE')}>
              启用用户
            </button>
          )}
        </div>
        {error && <p className="error">{error}</p>}
      </form>
    </FormModal>
  );
}

export function BugStatusDialog({
  actionLabel,
  currentStatus,
  error,
  nextStatus,
  submitting,
  onCancel,
  onConfirm
}: {
  actionLabel: string;
  currentStatus: BugStatus;
  error?: string;
  nextStatus: BugStatus;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  const normalizedNote = note.trim();
  const canSubmit = Boolean(normalizedNote);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    onConfirm(normalizedNote);
  }

  return (
    <ActionModal
      title="状态操作"
      description={`填写操作说明后，将当前 bug 从${statusLabel(currentStatus)}变更为${statusLabel(nextStatus)}。`}
      titleId="bug-status-modal-title"
      submitting={submitting}
      onClose={onCancel}
      onSubmit={submit}
      footer={(
        <>
          <button className="ghost" type="button" onClick={onCancel} disabled={submitting}>取消</button>
          <button className="primary" type="submit" disabled={!canSubmit || submitting}>
            <CheckCircle2 size={16} />
            {submitting ? '处理中...' : actionLabel}
          </button>
        </>
      )}
    >
      <div className="delete-target action-target">
        <span>状态变更</span>
        <strong>{statusLabel(currentStatus)} {'->'} {statusLabel(nextStatus)}</strong>
      </div>
      <label>
        操作说明
        <textarea
          autoFocus
          placeholder={nextStatus === 'FIXED' ? '填写修复说明、影响范围或验证方式' : '填写重新打开的原因'}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
    </ActionModal>
  );
}

export function BugDeleteDialog({
  error,
  mode,
  submitting,
  title,
  onCancel,
  onConfirm
}: {
  error?: string;
  mode: 'soft' | 'permanent';
  submitting: boolean;
  title: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const isPermanent = mode === 'permanent';
  const normalizedReason = reason.trim();
  const canSubmit = isPermanent || Boolean(normalizedReason);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit || submitting) return;
    onConfirm(normalizedReason);
  }

  return (
    <ActionModal
      title={isPermanent ? '彻底删除 bug' : '移入回收站'}
      description={isPermanent ? '此操作会永久删除数据，删除后无法恢复。' : '删除后 bug 会进入回收站，管理员仍可彻底删除。'}
      titleId="bug-delete-modal-title"
      submitting={submitting}
      onClose={onCancel}
      onSubmit={submit}
      footer={(
        <>
          <button className="ghost" type="button" onClick={onCancel} disabled={submitting}>取消</button>
          <button className="ghost danger" type="submit" disabled={!canSubmit || submitting}>
            <Trash2 size={16} />
            {submitting ? '处理中...' : isPermanent ? '确认彻底删除' : '移入回收站'}
          </button>
        </>
      )}
    >
      <div className="delete-target">
        <span>目标 bug</span>
        <strong>{title}</strong>
      </div>
      {isPermanent ? (
        <p className="delete-warning">请确认你要彻底删除这条 bug。该操作不会进入回收站，也不能撤销。</p>
      ) : (
        <label>
          删除原因
          <textarea
            autoFocus
            placeholder="例如重复登记、误报或已合并到其他 bug"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
      )}
      {error && <p className="error">{error}</p>}
    </ActionModal>
  );
}

export function BugActivityDeleteDialog({
  activity,
  error,
  submitting,
  onCancel,
  onConfirm
}: {
  activity: BugActivity;
  error?: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ItemActivityDeleteDialog
      activity={activity}
      kind="bug"
      error={error}
      submitting={submitting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

export function FeatureActivityDeleteDialog({
  activity,
  error,
  submitting,
  onCancel,
  onConfirm
}: {
  activity: FeatureActivity;
  error?: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ItemActivityDeleteDialog
      activity={activity}
      kind="feature"
      error={error}
      submitting={submitting}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}

function ItemActivityDeleteDialog({
  activity,
  kind,
  error,
  submitting,
  onCancel,
  onConfirm
}: {
  activity: ItemActivity;
  kind: ItemActivityKind;
  error?: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const entityLabel = kind === 'bug' ? 'bug' : '功能';

  return (
    <ActionModal
      title="删除活动记录"
      description={`删除后这条操作历史将从当前 ${entityLabel} 的活动记录中移除。`}
      titleId="activity-delete-modal-title"
      submitting={submitting}
      onClose={onCancel}
      footer={(
        <>
          <button className="ghost" type="button" onClick={onCancel} disabled={submitting}>取消</button>
          <button className="ghost danger" type="button" disabled={submitting} onClick={onConfirm}>
            <Trash2 size={16} />
            {submitting ? '处理中...' : '确认删除记录'}
          </button>
        </>
      )}
    >
      <div className="delete-target">
        <span>目标记录</span>
        <strong>{activityTitle(activity, kind)}</strong>
        <span>
          {activity.actor.displayName}
          {' · '}
          {formatDateTime(activity.createdAt)}
        </span>
      </div>
      {activity.note && <p className="delete-warning">{activity.note}</p>}
      {error && <p className="error">{error}</p>}
    </ActionModal>
  );
}
