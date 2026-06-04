import { Trash2 } from 'lucide-react';
import { BugActivity, BugStatus, FeatureActivity, FeatureStatus } from './api';

export type ItemActivityKind = 'bug' | 'feature';
export type ItemActivity = BugActivity | FeatureActivity;

const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  PLANNED: '规划中',
  IN_PROGRESS: '进行中',
  DONE: '已完成'
};

export function activityTitle(activity: ItemActivity, kind: ItemActivityKind) {
  if (kind === 'bug') {
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
      RETEST_RECORDED: '提交复测',
      OWNER_CLAIMED: '认领负责人',
      OWNER_DELEGATED: '委派负责人',
      OWNER_REVOKED: '撤销负责人',
      RELATED_JOINED: '加入相关人',
      RELATED_ADDED: '添加相关人',
      RELATED_REMOVED: '移除相关人'
    }[(activity as BugActivity).type];
  }

  return {
    CREATED: '创建功能',
    UPDATED: '编辑功能',
    STATUS_CHANGED: '变更状态',
    DELETED: '移入回收站',
    OWNER_CLAIMED: '认领负责人',
    OWNER_DELEGATED: '委派负责人',
    OWNER_REVOKED: '撤销负责人',
    RELATED_JOINED: '加入相关人',
    RELATED_ADDED: '添加相关人',
    RELATED_REMOVED: '移除相关人'
  }[(activity as FeatureActivity).type];
}

export function fieldLabel(field: string) {
  return {
    systemId: '所属系统',
    title: '标题',
    description: '描述',
    severity: '严重程度',
    priority: '优先级',
    environment: '运行环境',
    steps: '复现步骤',
    expected: '期望结果',
    actual: '实际结果',
    logText: '日志内容'
  }[field] ?? field;
}

export function statusLabel(status: BugStatus) {
  return status === 'FIXED' ? '已修复' : '未修复';
}

export function featureStatusLabel(status: FeatureStatus) {
  return FEATURE_STATUS_LABELS[status];
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function formatChangeValue(value: string | null) {
  return value && value.length > 0 ? value : '空';
}

function describePersonnelContext(activity: ItemActivity) {
  const get = (key: string) => {
    const value = activity.context?.[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  };

  switch (activity.type) {
    case 'OWNER_CLAIMED':
    case 'OWNER_DELEGATED':
    case 'OWNER_REVOKED': {
      const previous = get('previousOwnerName');
      const next = get('newOwnerName');
      if (activity.type === 'OWNER_REVOKED') {
        return previous ? `原负责人：${previous}` : '';
      }
      if (activity.type === 'OWNER_CLAIMED') {
        return next ? `负责人：${next}` : '';
      }
      return [previous ? `原负责人：${previous}` : '', next ? `新负责人：${next}` : ''].filter(Boolean).join('，');
    }
    case 'RELATED_JOINED':
    case 'RELATED_ADDED':
    case 'RELATED_REMOVED':
      return get('userNames') ? `相关人员：${get('userNames')}` : '';
    default:
      return '';
  }
}

export function describeActivityContext(activity: ItemActivity | null, kind: ItemActivityKind) {
  if (!activity) {
    return '';
  }

  const personnelSummary = describePersonnelContext(activity);
  if (!activity.context) {
    return personnelSummary;
  }

  const get = (key: string) => {
    const value = activity.context?.[key];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  };

  if (kind === 'bug') {
    const bugActivity = activity as BugActivity;
    switch (bugActivity.type) {
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
        return personnelSummary;
    }
  }

  if (activity.type === 'DELETED') {
    return get('deletedBy') ? `执行人：${get('deletedBy')}` : personnelSummary;
  }

  return personnelSummary;
}

export function ActivityItemBody({
  activity,
  kind,
  showDelete,
  onDelete
}: {
  activity: ItemActivity;
  kind: ItemActivityKind;
  showDelete?: boolean;
  onDelete?: () => void;
}) {
  const contextSummary = describeActivityContext(activity, kind);
  const bugActivity = kind === 'bug' ? (activity as BugActivity) : null;
  const featureActivity = kind === 'feature' ? (activity as FeatureActivity) : null;

  return (
    <article className="activity-item">
      <header>
        <div>
          <strong>{activityTitle(activity, kind)}</strong>
          <span>
            {activity.actor.displayName}
            {' · '}
            {formatDateTime(activity.createdAt)}
          </span>
        </div>
        {showDelete && onDelete && (
          <button className="icon-button danger" type="button" title="删除活动记录" onClick={onDelete}>
            <Trash2 size={16} />
          </button>
        )}
      </header>
      {activity.note && <p>{activity.note}</p>}
      {bugActivity?.fromStatus && bugActivity.toStatus && (
        <p className="muted">
          状态：{statusLabel(bugActivity.fromStatus)} {'->'} {statusLabel(bugActivity.toStatus)}
        </p>
      )}
      {featureActivity?.fromStatus && featureActivity.toStatus && (
        <p className="muted">
          状态：{featureStatusLabel(featureActivity.fromStatus)} {'->'}{' '}
          {featureStatusLabel(featureActivity.toStatus)}
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
}
