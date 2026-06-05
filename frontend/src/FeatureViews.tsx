import { ArrowLeft, BarChart3, ChevronDown, ChevronRight, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AssignableUser,
  FeatureDetail,
  FeatureGanttEntry,
  FeatureItem,
  FeatureStatus,
  ImplementationItem,
  ImplementationItemStatus,
  TrackedSystem,
  User,
  api,
  hasPermission
} from './api';
import {
  FeatureScheduleDialog,
  ImplementationItemDialog,
  ImplementationItemStatusDialog
} from './AppDialogs';
import { formatDateTime, implementationItemStatusLabel } from './activityUtils';
import { readError } from './errorUtils';
import { notifyError } from './ToastProvider';

export function formatDateRange(start: string | null | undefined, end: string | null | undefined) {
  if (!start && !end) {
    return '—';
  }
  const startText = start ? formatDateTime(start) : '未设';
  const endText = end ? formatDateTime(end) : '未设';
  return `${startText} ~ ${endText}`;
}

function toDateOnlyLabel(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(value));
}

export function FeatureProgressBar({ percent }: { percent: number | null }) {
  if (percent === null) {
    return <span className="muted">—</span>;
  }
  return (
    <div className="feature-progress-cell">
      <div className="feature-progress-track" aria-hidden="true">
        <span className="feature-progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <span>{percent}%</span>
    </div>
  );
}

export function ImplementationItemStatusBadge({ status }: { status: ImplementationItemStatus }) {
  return <span className={`status implementation-item-${status.toLowerCase().replace('_', '-')}`}>{implementationItemStatusLabel(status)}</span>;
}

export function FeatureProgressPanel({
  feature,
  user,
  assignableUsers,
  onUpdated
}: {
  feature: FeatureDetail;
  user: User | null;
  assignableUsers: AssignableUser[];
  onUpdated: () => Promise<void>;
}) {
  const canUpdate = hasPermission(user, 'UPDATE_FEATURE') && !feature.deletedAt;
  const [itemSort, setItemSort] = useState<'sortOrder' | 'plannedStart' | 'plannedEnd' | 'completed'>('sortOrder');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleSubmitting, setScheduleSubmitting] = useState(false);
  const [itemDialog, setItemDialog] = useState<{ mode: 'create' } | { mode: 'edit'; item: ImplementationItem } | null>(null);
  const [itemSubmitting, setItemSubmitting] = useState(false);
  const [statusDialog, setStatusDialog] = useState<ImplementationItem | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  const implementationItems = feature.implementationItems ?? [];
  const implementationItemCount = feature.implementationItemCount ?? implementationItems.length;
  const implementationItemDoneCount =
    feature.implementationItemDoneCount ??
    implementationItems.filter((item) => item.status === 'DONE').length;

  const sortedItems = useMemo(() => {
    const items = [...implementationItems];
    items.sort((left, right) => {
      if (itemSort === 'plannedStart') {
        return (left.plannedStartAt ?? '').localeCompare(right.plannedStartAt ?? '');
      }
      if (itemSort === 'plannedEnd') {
        return (left.plannedEndAt ?? '').localeCompare(right.plannedEndAt ?? '');
      }
      if (itemSort === 'completed') {
        return (left.completedAt ?? '').localeCompare(right.completedAt ?? '');
      }
      return left.sortOrder - right.sortOrder;
    });
    return items;
  }, [implementationItems, itemSort]);

  const allItemsDone =
    implementationItemCount > 0 &&
    implementationItemDoneCount === implementationItemCount &&
    feature.status !== 'DONE';

  async function saveSchedule(payload: { plannedStartAt: string | null; plannedEndAt: string | null }) {
    setScheduleSubmitting(true);
    try {
      await api(`/features/${feature.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setScheduleOpen(false);
      await onUpdated();
    } catch (error) {
      notifyError(readError(error));
    } finally {
      setScheduleSubmitting(false);
    }
  }

  async function saveItem(payload: {
    title: string;
    note: string | null;
    plannedStartAt: string | null;
    plannedEndAt: string | null;
    ownerId: string | null;
  }) {
    if (!itemDialog) return;
    setItemSubmitting(true);
    try {
      if (itemDialog.mode === 'create') {
        await api(`/features/${feature.id}/implementation-items`, {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } else {
        await api(`/features/${feature.id}/implementation-items/${itemDialog.item.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      }
      setItemDialog(null);
      await onUpdated();
    } catch (error) {
      notifyError(readError(error));
    } finally {
      setItemSubmitting(false);
    }
  }

  async function changeItemStatus(status: ImplementationItemStatus, note: string) {
    if (!statusDialog) return;
    setStatusSubmitting(true);
    try {
      await api(`/features/${feature.id}/implementation-items/${statusDialog.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, note })
      });
      setStatusDialog(null);
      await onUpdated();
    } catch (error) {
      notifyError(readError(error));
    } finally {
      setStatusSubmitting(false);
    }
  }

  async function deleteItem(item: ImplementationItem) {
    if (!window.confirm(`确定删除实现项「${item.title}」？`)) {
      return;
    }
    try {
      await api(`/features/${feature.id}/implementation-items/${item.id}`, { method: 'DELETE' });
      await onUpdated();
    } catch (error) {
      notifyError(readError(error));
    }
  }

  const planLabel =
    feature.effectivePlannedStartAt || feature.effectivePlannedEndAt
      ? formatDateRange(feature.effectivePlannedStartAt, feature.effectivePlannedEndAt)
      : '未设置';

  return (
    <section className="panel feature-progress-panel surface-enter">
      <div className="panel-heading-row">
        <h2>实现进度</h2>
        {canUpdate && (
          <button className="ghost compact" type="button" onClick={() => setItemDialog({ mode: 'create' })}>
            <Plus size={16} />
            添加实现项
          </button>
        )}
      </div>

      <div className="feature-progress-meta muted">
        {implementationItemCount > 0 && (
          <>
            <FeatureProgressBar percent={feature.progressPercent} />
            <span>
              {implementationItemDoneCount}/{implementationItemCount} 已完成
            </span>
            <span className="feature-progress-meta-sep" aria-hidden="true">
              ·
            </span>
          </>
        )}
        <span>计划 {planLabel}</span>
        {canUpdate && (
          <button className="ghost compact feature-progress-inline-action" type="button" onClick={() => setScheduleOpen(true)}>
            <Pencil size={14} />
            编辑
          </button>
        )}
      </div>

      {allItemsDone && (
        <p className="feature-progress-hint">全部实现项已完成，可考虑将功能标记为「已完成」。</p>
      )}

      {sortedItems.length > 1 && (
        <div className="feature-progress-list-toolbar">
          <select
            value={itemSort}
            aria-label="实现项排序"
            onChange={(event) => setItemSort(event.target.value as typeof itemSort)}
          >
            <option value="sortOrder">默认顺序</option>
            <option value="plannedStart">计划开始</option>
            <option value="plannedEnd">计划结束</option>
            <option value="completed">完成时间</option>
          </select>
        </div>
      )}

      <div className="implementation-item-list">
        {sortedItems.map((item, index) => (
          <article
            key={item.id}
            className="implementation-item-card row-enter"
            style={{ animationDelay: `${index * 35}ms` }}
          >
            <div className="implementation-item-main">
              <div className="implementation-item-title-row">
                <strong>{item.title}</strong>
                <ImplementationItemStatusBadge status={item.status} />
              </div>
              {item.note && <p className="muted">{item.note}</p>}
              <div className="implementation-item-meta muted">
                <span>计划：{formatDateRange(item.plannedStartAt, item.plannedEndAt)}</span>
                {item.actualStartAt && <span>开始：{formatDateTime(item.actualStartAt)}</span>}
                {item.completedAt && <span>完成：{formatDateTime(item.completedAt)}</span>}
                {item.owner && <span>负责人：{item.owner.displayName}</span>}
              </div>
            </div>
            {canUpdate && (
              <div className="implementation-item-actions">
                <button className="ghost compact" type="button" onClick={() => setStatusDialog(item)}>
                  变更状态
                </button>
                <button className="ghost compact" type="button" onClick={() => setItemDialog({ mode: 'edit', item })}>
                  编辑
                </button>
                <button className="ghost compact danger" type="button" onClick={() => void deleteItem(item)}>
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </article>
        ))}
        {sortedItems.length === 0 && <p className="muted feature-progress-empty">暂无实现项</p>}
      </div>

      {scheduleOpen && (
        <FeatureScheduleDialog
          plannedStartAt={feature.plannedStartAt}
          plannedEndAt={feature.plannedEndAt}
          submitting={scheduleSubmitting}
          onClose={() => {
            if (!scheduleSubmitting) setScheduleOpen(false);
          }}
          onConfirm={(payload) => void saveSchedule(payload)}
        />
      )}
      {itemDialog && (
        <ImplementationItemDialog
          mode={itemDialog.mode}
          item={itemDialog.mode === 'edit' ? itemDialog.item : undefined}
          assignableUsers={assignableUsers}
          submitting={itemSubmitting}
          onClose={() => {
            if (!itemSubmitting) setItemDialog(null);
          }}
          onConfirm={(payload) => void saveItem(payload)}
        />
      )}
      {statusDialog && (
        <ImplementationItemStatusDialog
          currentStatus={statusDialog.status}
          submitting={statusSubmitting}
          onClose={() => {
            if (!statusSubmitting) setStatusDialog(null);
          }}
          onConfirm={(status, note) => void changeItemStatus(status, note)}
        />
      )}
    </section>
  );
}

function ganttBarClass(status: ImplementationItemStatus | FeatureStatus, plannedEndAt: string | null) {
  const overdue =
    plannedEndAt &&
    new Date(plannedEndAt) < new Date() &&
    status !== 'DONE';
  const classes = ['gantt-bar'];
  if (status === 'NOT_STARTED' || status === 'PLANNED') {
    classes.push('gantt-bar-not-started');
  } else if ('IN_PROGRESS' === status) {
    classes.push('gantt-bar-in-progress');
  } else {
    classes.push('gantt-bar-done');
  }
  if (overdue) {
    classes.push('gantt-bar-overdue');
  }
  return classes.join(' ');
}

function computeGanttRange(entries: FeatureGanttEntry[]) {
  const dates: number[] = [];
  for (const entry of entries) {
    if (entry.effectivePlannedStartAt) {
      dates.push(new Date(entry.effectivePlannedStartAt).getTime());
    }
    if (entry.effectivePlannedEndAt) {
      dates.push(new Date(entry.effectivePlannedEndAt).getTime());
    }
    for (const item of entry.implementationItems) {
      if (item.plannedStartAt) dates.push(new Date(item.plannedStartAt).getTime());
      if (item.plannedEndAt) dates.push(new Date(item.plannedEndAt).getTime());
    }
  }
  if (dates.length === 0) {
    const now = Date.now();
    return { start: now, end: now + 7 * 24 * 60 * 60 * 1000 };
  }
  const min = Math.min(...dates);
  const max = Math.max(...dates);
  const padding = Math.max(24 * 60 * 60 * 1000, (max - min) * 0.05);
  return { start: min - padding, end: max + padding };
}

function barStyle(start: string | null, end: string | null, rangeStart: number, rangeEnd: number) {
  if (!start || !end) {
    return { display: 'none' } as const;
  }
  const total = rangeEnd - rangeStart;
  const left = ((new Date(start).getTime() - rangeStart) / total) * 100;
  const width = ((new Date(end).getTime() - new Date(start).getTime()) / total) * 100;
  return {
    left: `${Math.max(0, left)}%`,
    width: `${Math.max(1.5, width)}%`
  };
}

export function FeatureGanttPage() {
  const [entries, setEntries] = useState<FeatureGanttEntry[]>([]);
  const [systems, setSystems] = useState<TrackedSystem[]>([]);
  const [systemId, setSystemId] = useState('');
  const [status, setStatus] = useState<FeatureStatus | ''>('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function load() {
    const params = new URLSearchParams();
    if (systemId) params.set('systemId', systemId);
    if (status) params.set('status', status);
    setEntries(await api<FeatureGanttEntry[]>(`/features/gantt?${params.toString()}`));
  }

  useEffect(() => {
    void api<TrackedSystem[]>('/systems').then(setSystems);
  }, []);

  useEffect(() => {
    void load().catch((error) => notifyError(readError(error)));
  }, [systemId, status]);

  const range = useMemo(() => computeGanttRange(entries), [entries]);
  const rangeDays = Math.max(1, Math.ceil((range.end - range.start) / (24 * 60 * 60 * 1000)));
  const monthTicks = useMemo(() => {
    const ticks: string[] = [];
    const cursor = new Date(range.start);
    cursor.setDate(1);
    while (cursor.getTime() <= range.end) {
      ticks.push(cursor.toISOString());
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return ticks;
  }, [range.end, range.start]);

  return (
    <>
      <header className="page-header">
        <div>
          <h1>功能甘特图</h1>
          <p className="muted">按时间查看功能与实现项计划（约 {rangeDays} 天窗口）</p>
        </div>
        <div className="actions">
          <Link className="ghost compact" to="/features"><ArrowLeft size={16} />返回列表</Link>
        </div>
      </header>

      <div className="toolbar">
        <select value={systemId} onChange={(event) => setSystemId(event.target.value)}>
          <option value="">全部系统</option>
          {systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value as FeatureStatus | '')}>
          <option value="">全部状态</option>
          <option value="PLANNED">规划中</option>
          <option value="IN_PROGRESS">进行中</option>
          <option value="DONE">已完成</option>
        </select>
      </div>

      <div className="gantt-desktop surface-enter">
        <div className="gantt-grid" style={{ '--gantt-days': rangeDays } as CSSProperties}>
          <div className="gantt-header-row">
            <div className="gantt-label-col gantt-header-label">功能 / 实现项</div>
            <div className="gantt-timeline-col">
              <div className="gantt-month-row">
                {monthTicks.map((tick) => (
                  <span key={tick} className="gantt-month-tick">{toDateOnlyLabel(tick)}</span>
                ))}
              </div>
            </div>
          </div>
          {entries.map((entry, index) => {
            const isExpanded = expanded[entry.id] ?? true;
            return (
              <div key={entry.id} className="gantt-feature-group row-enter" style={{ animationDelay: `${index * 35}ms` }}>
                <div className="gantt-row">
                  <div className="gantt-label-col">
                    <button
                      className="gantt-expand-btn"
                      type="button"
                      onClick={() => setExpanded((current) => ({ ...current, [entry.id]: !isExpanded }))}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    <Link to={`/features/${entry.id}`} className="gantt-feature-link">{entry.title}</Link>
                    {entry.progressPercent !== null && (
                      <span className="gantt-progress-chip">{entry.progressPercent}%</span>
                    )}
                  </div>
                  <div className="gantt-timeline-col">
                    <div className="gantt-bar-track">
                      {entry.effectivePlannedStartAt && entry.effectivePlannedEndAt && (
                        <span
                          className={ganttBarClass(entry.status, entry.effectivePlannedEndAt)}
                          style={barStyle(entry.effectivePlannedStartAt, entry.effectivePlannedEndAt, range.start, range.end)}
                          title={formatDateRange(entry.effectivePlannedStartAt, entry.effectivePlannedEndAt)}
                        />
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded &&
                  entry.implementationItems.map((item) => (
                    <div key={item.id} className="gantt-row gantt-sub-row">
                      <div className="gantt-label-col gantt-sub-label">{item.title}</div>
                      <div className="gantt-timeline-col">
                        <div className="gantt-bar-track">
                          {item.plannedStartAt && item.plannedEndAt && (
                            <span
                              className={ganttBarClass(item.status, item.plannedEndAt)}
                              style={barStyle(item.plannedStartAt, item.plannedEndAt, range.start, range.end)}
                              title={formatDateRange(item.plannedStartAt, item.plannedEndAt)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}
          {entries.length === 0 && <p className="muted gantt-empty">暂无带计划时间的功能。</p>}
        </div>
      </div>

      <div className="gantt-mobile surface-enter">
        {entries.map((entry, index) => (
          <article key={entry.id} className="gantt-mobile-card row-enter" style={{ animationDelay: `${index * 35}ms` }}>
            <header>
              <Link to={`/features/${entry.id}`}>{entry.title}</Link>
              {entry.progressPercent !== null && <span>{entry.progressPercent}%</span>}
            </header>
            <p className="muted">{formatDateRange(entry.effectivePlannedStartAt, entry.effectivePlannedEndAt)}</p>
            {entry.implementationItems.map((item) => (
              <div key={item.id} className="gantt-mobile-item">
                <div className="gantt-mobile-item-head">
                  <span>{item.title}</span>
                  <ImplementationItemStatusBadge status={item.status} />
                </div>
                <p className="muted">{formatDateRange(item.plannedStartAt, item.plannedEndAt)}</p>
                <div className={`gantt-mobile-bar ${ganttBarClass(item.status, item.plannedEndAt).split(' ').slice(1).join(' ')}`} />
              </div>
            ))}
          </article>
        ))}
        {entries.length === 0 && <p className="muted">暂无带计划时间的功能。</p>}
      </div>
    </>
  );
}

export function featureListProgressLabel(feature: FeatureItem) {
  if (feature.implementationItemCount === 0) {
    return '—';
  }
  return `${feature.progressPercent ?? 0}% (${feature.implementationItemDoneCount}/${feature.implementationItemCount})`;
}
