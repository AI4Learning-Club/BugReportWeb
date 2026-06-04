export type RuntimeInfoDraft = {
  title: string;
  environment: string;
  logText: string;
};

export function RuntimeInfoFields({
  value,
  onChange
}: {
  value: RuntimeInfoDraft;
  onChange: (next: RuntimeInfoDraft) => void;
}) {
  return (
    <>
      <label>
        标题
        <input
          placeholder="标题"
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
      </label>
      <label>
        环境说明
        <input
          placeholder="环境说明"
          value={value.environment}
          onChange={(event) => onChange({ ...value, environment: event.target.value })}
        />
      </label>
      <label>
        日志内容
        <textarea
          placeholder="日志内容"
          value={value.logText}
          onChange={(event) => onChange({ ...value, logText: event.target.value })}
        />
      </label>
    </>
  );
}

export function updateRuntimeDraft(
  index: number,
  key: keyof RuntimeInfoDraft,
  value: string,
  drafts: RuntimeInfoDraft[],
  setDrafts: (drafts: RuntimeInfoDraft[]) => void
) {
  setDrafts(drafts.map((draft, itemIndex) => (itemIndex === index ? { ...draft, [key]: value } : draft)));
}
