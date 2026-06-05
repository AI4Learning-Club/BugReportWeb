import { Prisma, Severity } from '@prisma/client';

export type ActivityChange = {
  field: string;
  from: string | null;
  to: string | null;
};

const SEVERITY_LABELS: Record<Severity, string> = {
  LOW: '低',
  MEDIUM: '中',
  HIGH: '高',
  CRITICAL: '严重'
};

export function formatSeverityLabel(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return SEVERITY_LABELS[value as Severity] ?? value;
}

export function formatPriorityLabel(value: string | null | undefined) {
  return formatSeverityLabel(value);
}

export async function resolveSystemName(
  tx: Prisma.TransactionClient,
  systemId: string | null | undefined
) {
  if (!systemId) {
    return null;
  }
  const system = await tx.trackedSystem.findUnique({
    where: { id: systemId },
    select: { name: true }
  });
  return system?.name ?? systemId;
}

function formatChangeFieldValue(field: string, value: string | null) {
  if (value === null || value === undefined) {
    return null;
  }
  if (field === 'severity' || field === 'priority') {
    return formatSeverityLabel(value) ?? value;
  }
  return value;
}

export async function enrichActivityChanges(
  tx: Prisma.TransactionClient,
  changes: ActivityChange[]
) {
  const systemIds = new Set<string>();
  for (const change of changes) {
    if (change.field === 'systemId') {
      if (change.from) {
        systemIds.add(change.from);
      }
      if (change.to) {
        systemIds.add(change.to);
      }
    }
  }

  const systemNames = new Map<string, string>();
  if (systemIds.size > 0) {
    const systems = await tx.trackedSystem.findMany({
      where: { id: { in: [...systemIds] } },
      select: { id: true, name: true }
    });
    for (const system of systems) {
      systemNames.set(system.id, system.name);
    }
  }

  return changes.map((change) => {
    if (change.field === 'systemId') {
      return {
        field: change.field,
        from: change.from ? (systemNames.get(change.from) ?? change.from) : null,
        to: change.to ? (systemNames.get(change.to) ?? change.to) : null
      };
    }
    return {
      field: change.field,
      from: formatChangeFieldValue(change.field, change.from),
      to: formatChangeFieldValue(change.field, change.to)
    };
  });
}

export function buildBugCreatedSnapshot(
  bug: {
    title: string;
    severity: Severity;
    environment: string | null;
  },
  systemName: string
): ActivityChange[] {
  const changes: ActivityChange[] = [
    { field: 'title', from: null, to: bug.title },
    { field: 'systemId', from: null, to: systemName },
    { field: 'severity', from: null, to: formatSeverityLabel(bug.severity) }
  ];
  if (bug.environment) {
    changes.push({ field: 'environment', from: null, to: bug.environment });
  }
  return changes;
}

export function buildFeatureCreatedSnapshot(
  feature: {
    title: string;
    priority: Severity;
  },
  systemName: string
): ActivityChange[] {
  return [
    { field: 'title', from: null, to: feature.title },
    { field: 'systemId', from: null, to: systemName },
    { field: 'priority', from: null, to: formatPriorityLabel(feature.priority) }
  ];
}

export function buildLogTextPreview(logText: string | null | undefined, maxLength = 200) {
  if (!logText) {
    return null;
  }
  const trimmed = logText.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return trimmed.slice(0, maxLength) + '…';
}
