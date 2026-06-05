import type { MouseEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { BugActivity, BugStatus, FeatureActivity, FeatureStatus } from './api';

export type ItemActivityKind = 'bug' | 'feature';
export type ItemActivity = BugActivity | FeatureActivity;

const FEATURE_STATUS_LABELS: Record<FeatureStatus, string> = {
  PLANNED: '规划中',
  IN_PROGRESS: '进行中',
  DONE: '已完成'
};

const LONG_TEXT_FIELDS = new Set(['description', 'steps', 'expected', 'actual', 'logText']);

export function severityLabel(value: string | null | undefined) {
  if (!value) {
    return '空';
  }
  return { LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '严重' }[value] ?? value;
}

export function priorityLabel(value: string | null | undefined) {
  return severityLabel(value);
}

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

function retestResultLabel(result: string | null | undefined) {
  if (!result) {
    return '';
  }
  return result === 'NOT_APPEARED' ? '未出现' : result === 'APPEARED' ? '确认出现' : result;
}

function truncateText(value: string, maxLength = 60) {
  if (value.length <= maxLength) {
    return value;
  }
  return value.slice(0, maxLength) + '…';
}

function localizeFieldValue(field: string, value: string | null) {
  if (!value || value.length === 0) {
    return '空';
  }
  if (field === 'severity') {
    return severityLabel(value);
  }
  if (field === 'priority') {
    return priorityLabel(value);
  }
  return value;
}

export function formatChangeValue(
  field: string,
  value: string | null,
  mode: 'preview' | 'detail' = 'detail'
) {
  const localized = localizeFieldValue(field, value);
  if (localized === '空') {
    return localized;
  }
  if (mode === 'preview' && LONG_TEXT_FIELDS.has(field)) {
    return truncateText(localized);
  }
  return localized;
}

function getContextValue(activity: ItemActivity, key: string) {
  const value = activity.context?.[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

function describePersonnelContext(activity: ItemActivity) {
  const get = (key: string) => getContextValue(activity, key);

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

  const get = (key: string) => getContextValue(activity, key);

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
      case 'RETEST_RECORDED': {
        const result = retestResultLabel(get('result'));
        const previous = retestResultLabel(get('previousResult'));
        const parts = [result ? '结果：' + result : ''];
        if (get('mode') === 'updated' && previous) {
          parts.push('覆盖前：' + previous);
        } else if (get('mode') === 'updated') {
          parts.push('覆盖了之前的复测结果');
        }
        if (get('note')) {
          parts.push('备注：' + truncateText(get('note')));
        }
        return parts.filter(Boolean).join('，');
      }
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

function describeCreatedPreview(activity: ItemActivity) {
  if (!activity.changes || activity.changes.length === 0) {
    return '';
  }
  const parts: string[] = [];
  for (const change of activity.changes) {
    if (change.to && change.from === null) {
      parts.push(`${fieldLabel(change.field)}：${formatChangeValue(change.field, change.to, 'preview')}`);
    }
  }
  return parts.join(' · ');
}

export function activityPreviewLine(activity: ItemActivity, kind: ItemActivityKind) {
  if (activity.type === 'UPDATED' && activity.changes && activity.changes.length > 0) {
    const fields = activity.changes.map((change) => fieldLabel(change.field)).join('、');
    return `修改了 ${fields}`;
  }

  if (activity.type === 'STATUS_CHANGED') {
    if (kind === 'bug') {
      const bugActivity = activity as BugActivity;
      if (bugActivity.fromStatus && bugActivity.toStatus) {
        return `${statusLabel(bugActivity.fromStatus)} → ${statusLabel(bugActivity.toStatus)}`;
      }
    } else {
      const featureActivity = activity as FeatureActivity;
      if (featureActivity.fromStatus && featureActivity.toStatus) {
        return `${featureStatusLabel(featureActivity.fromStatus)} → ${featureStatusLabel(featureActivity.toStatus)}`;
      }
    }
  }

  if (activity.type === 'CREATED') {
    const createdPreview = describeCreatedPreview(activity);
    if (createdPreview) {
      return createdPreview;
    }
  }

  if (activity.note) {
    return truncateText(activity.note);
  }

  const contextSummary = describeActivityContext(activity, kind);
  if (contextSummary) {
    return contextSummary;
  }

  if (activity.changes && activity.changes.length > 0) {
    const fields = activity.changes.map((change) => fieldLabel(change.field)).join('、');
    return `变更字段：${fields}`;
  }

  return '';
}

function hasActivityDetail(activity: ItemActivity, kind: ItemActivityKind) {
  if (activity.note) {
    return true;
  }
  if (activity.changes && activity.changes.length > 0) {
    return true;
  }
  if (activity.context && Object.keys(activity.context).length > 0) {
    return true;
  }
  if (kind === 'bug') {
    const bugActivity = activity as BugActivity;
    if (bugActivity.fromStatus && bugActivity.toStatus) {
      return true;
    }
  }
  if (kind === 'feature') {
    const featureActivity = activity as FeatureActivity;
    if (featureActivity.fromStatus && featureActivity.toStatus) {
      return true;
    }
  }
  return false;
}

function ActivityChangeRow({
  change,
  activityId,
  index,
  mode
}: {
  change: { field: string; from: string | null; to: string | null };
  activityId: string;
  index: number;
  mode: 'preview' | 'detail';
}) {
  const isLong = LONG_TEXT_FIELDS.has(change.field);

  if (mode === 'detail' && change.from === null && change.to !== null) {
    return (
      <div key={activityId + '-' + change.field + '-' + index} className="activity-change-row activity-change-row-initial">
        <strong>{fieldLabel(change.field)}</strong>
        {isLong ? (
          <pre className="activity-detail-long-text">{formatChangeValue(change.field, change.to, 'detail')}</pre>
        ) : (
          <span>{formatChangeValue(change.field, change.to, 'detail')}</span>
        )}
      </div>
    );
  }

  return (
    <div key={activityId + '-' + change.field + '-' + index} className="activity-change-row">
      <strong>{fieldLabel(change.field)}</strong>
      {mode === 'detail' && isLong ? (
        <div className="activity-change-long-values">
          <div>
            <span className="muted">变更前</span>
            <pre className="activity-detail-long-text">{formatChangeValue(change.field, change.from, 'detail')}</pre>
          </div>
          <div>
            <span className="muted">变更后</span>
            <pre className="activity-detail-long-text">{formatChangeValue(change.field, change.to, 'detail')}</pre>
          </div>
        </div>
      ) : (
        <>
          <span>{formatChangeValue(change.field, change.from, mode)}</span>
          <span className="muted">-&gt;</span>
          <span>{formatChangeValue(change.field, change.to, mode)}</span>
        </>
      )}
    </div>
  );
}

function ContextDetailSection({ activity, kind }: { activity: ItemActivity; kind: ItemActivityKind }) {
  const get = (key: string) => getContextValue(activity, key);
  const personnelTypes = new Set([
    'OWNER_CLAIMED',
    'OWNER_DELEGATED',
    'OWNER_REVOKED',
    'RELATED_JOINED',
    'RELATED_ADDED',
    'RELATED_REMOVED'
  ]);

  if (personnelTypes.has(activity.type)) {
    const rows: Array<{ label: string; value: string }> = [];
    if (activity.type === 'OWNER_CLAIMED' || activity.type === 'OWNER_DELEGATED' || activity.type === 'OWNER_REVOKED') {
      if (get('previousOwnerName')) {
        rows.push({ label: '原负责人', value: get('previousOwnerName') });
      }
      if (get('newOwnerName')) {
        rows.push({ label: '新负责人', value: get('newOwnerName') });
      }
    }
    if (activity.type === 'RELATED_JOINED' || activity.type === 'RELATED_ADDED' || activity.type === 'RELATED_REMOVED') {
      if (get('userNames')) {
        rows.push({ label: '相关人员', value: get('userNames') });
      }
    }
    if (rows.length === 0) {
      return null;
    }
    return (
      <section className="activity-detail-section">
        <h3>人员变更</h3>
        <dl className="activity-detail-dl">
          {rows.map((row) => (
            <div key={row.label} className="activity-detail-dl-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  if (kind === 'bug' && activity.type === 'RETEST_RECORDED') {
    const rows: Array<{ label: string; value: string }> = [
      { label: '复测结果', value: retestResultLabel(get('result')) || '—' },
      { label: '记录方式', value: get('mode') === 'updated' ? '覆盖已有记录' : '新增记录' }
    ];
    if (get('mode') === 'updated' && get('previousResult')) {
      rows.push({ label: '覆盖前结果', value: retestResultLabel(get('previousResult')) });
    }
    if (get('note')) {
      rows.push({ label: '备注', value: get('note') });
    }
    if (get('mode') === 'updated' && get('previousNote')) {
      rows.push({ label: '覆盖前备注', value: get('previousNote') });
    }
    return (
      <section className="activity-detail-section">
        <h3>复测详情</h3>
        <dl className="activity-detail-dl">
          {rows.map((row) => (
            <div key={row.label} className="activity-detail-dl-row">
              <dt>{row.label}</dt>
              <dd>{row.label.includes('备注') ? <pre className="activity-detail-long-text inline">{row.value}</pre> : row.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  if (kind === 'bug' && (activity.type === 'SCREENSHOT_ADDED' || activity.type === 'SCREENSHOT_REMOVED')) {
    return (
      <section className="activity-detail-section">
        <h3>截图信息</h3>
        <dl className="activity-detail-dl">
          {get('originalName') && (
            <div className="activity-detail-dl-row">
              <dt>文件名</dt>
              <dd>{get('originalName')}</dd>
            </div>
          )}
          {get('caption') && (
            <div className="activity-detail-dl-row">
              <dt>说明</dt>
              <dd>{get('caption')}</dd>
            </div>
          )}
        </dl>
      </section>
    );
  }

  if (
    kind === 'bug' &&
    (activity.type === 'RUNTIME_INFO_ADDED' ||
      activity.type === 'RUNTIME_INFO_UPDATED' ||
      activity.type === 'RUNTIME_INFO_REMOVED')
  ) {
    return (
      <section className="activity-detail-section">
        <h3>运行信息</h3>
        <dl className="activity-detail-dl">
          {get('title') && (
            <div className="activity-detail-dl-row">
              <dt>标题</dt>
              <dd>{get('title')}</dd>
            </div>
          )}
          {get('environment') && (
            <div className="activity-detail-dl-row">
              <dt>环境</dt>
              <dd>{get('environment')}</dd>
            </div>
          )}
          {get('logTextPreview') && (
            <div className="activity-detail-dl-row">
              <dt>日志摘要</dt>
              <dd>
                <pre className="activity-detail-long-text">{get('logTextPreview')}</pre>
              </dd>
            </div>
          )}
        </dl>
      </section>
    );
  }

  if (activity.type === 'DELETED' && get('deletedBy')) {
    return (
      <section className="activity-detail-section">
        <h3>删除信息</h3>
        <dl className="activity-detail-dl">
          <div className="activity-detail-dl-row">
            <dt>执行人</dt>
            <dd>{get('deletedBy')}</dd>
          </div>
        </dl>
      </section>
    );
  }

  const contextSummary = describeActivityContext(activity, kind);
  if (contextSummary) {
    return (
      <section className="activity-detail-section">
        <h3>附加信息</h3>
        <p className="muted">{contextSummary}</p>
      </section>
    );
  }

  return null;
}

export function ActivityDetailContent({
  activity,
  kind
}: {
  activity: ItemActivity;
  kind: ItemActivityKind;
}) {
  const bugActivity = kind === 'bug' ? (activity as BugActivity) : null;
  const featureActivity = kind === 'feature' ? (activity as FeatureActivity) : null;
  const hasDetail = hasActivityDetail(activity, kind);

  return (
    <div className="activity-detail-content">
      {activity.note && (
        <section className="activity-detail-section">
          <h3>备注</h3>
          <p>{activity.note}</p>
        </section>
      )}

      {bugActivity?.fromStatus && bugActivity.toStatus && (
        <section className="activity-detail-section">
          <h3>状态变更</h3>
          <p>
            {statusLabel(bugActivity.fromStatus)} → {statusLabel(bugActivity.toStatus)}
          </p>
        </section>
      )}

      {featureActivity?.fromStatus && featureActivity.toStatus && (
        <section className="activity-detail-section">
          <h3>状态变更</h3>
          <p>
            {featureStatusLabel(featureActivity.fromStatus)} → {featureStatusLabel(featureActivity.toStatus)}
          </p>
        </section>
      )}

      {activity.changes && activity.changes.length > 0 && (
        <section className="activity-detail-section">
          <h3>{activity.type === 'CREATED' ? '初始内容' : '字段变更'}</h3>
          <div className="activity-changes">
            {activity.changes.map((change, index) => (
              <ActivityChangeRow
                key={activity.id + '-' + change.field + '-' + index}
                change={change}
                activityId={activity.id}
                index={index}
                mode="detail"
              />
            ))}
          </div>
        </section>
      )}

      <ContextDetailSection activity={activity} kind={kind} />

      {!hasDetail && <p className="muted">本条活动无额外详情</p>}
    </div>
  );
}

export function ActivitySummaryRow({
  activity,
  kind,
  clickable = false,
  onClick,
  showDelete,
  onDelete,
  showDetailHint = false
}: {
  activity: ItemActivity;
  kind: ItemActivityKind;
  clickable?: boolean;
  onClick?: () => void;
  showDelete?: boolean;
  onDelete?: (event: MouseEvent) => void;
  showDetailHint?: boolean;
}) {
  const preview = activityPreviewLine(activity, kind);
  const className = clickable ? 'activity-item activity-item-clickable' : 'activity-item';

  const content = (
    <>
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
          <button
            className="icon-button danger"
            type="button"
            title="删除活动记录"
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>
      {preview && <p className="activity-preview-line muted">{preview}</p>}
      {showDetailHint && <p className="activity-detail-hint muted">点击查看详情</p>}
    </>
  );

  if (clickable && onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

export function ActivityPanel({
  activities,
  kind,
  onOpenDetail,
  onViewAll
}: {
  activities: ItemActivity[];
  kind: ItemActivityKind;
  onOpenDetail: (activity: ItemActivity) => void;
  onViewAll: () => void;
}) {
  return (
    <section className="panel bug-activity-panel">
      <h2>活动记录</h2>
      <div className="activity-list activity-list-summary">
        {activities.slice(0, 5).map((activity) => (
          <ActivitySummaryRow
            key={activity.id}
            activity={activity}
            kind={kind}
            clickable
            onClick={() => onOpenDetail(activity)}
          />
        ))}
        {activities.length === 0 && <p className="muted">暂无活动记录</p>}
      </div>
      {activities.length > 0 && (
        <button className="ghost compact activity-view-all" type="button" onClick={onViewAll}>
          查看全部活动 ({activities.length})
        </button>
      )}
    </section>
  );
}

export function ActivityItemBody({
  activity,
  kind,
  showDelete,
  onDelete,
  onOpenDetail
}: {
  activity: ItemActivity;
  kind: ItemActivityKind;
  showDelete?: boolean;
  onDelete?: (event: MouseEvent) => void;
  onOpenDetail?: () => void;
}) {
  return (
    <ActivitySummaryRow
      activity={activity}
      kind={kind}
      clickable={Boolean(onOpenDetail)}
      onClick={onOpenDetail}
      showDelete={showDelete}
      onDelete={onDelete}
      showDetailHint={Boolean(onOpenDetail)}
    />
  );
}
