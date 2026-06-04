import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

type MultiSelectOption = {
  id: string;
  label: string;
};

export function MultiSelectDropdown({
  options,
  selectedIds,
  onToggle,
  placeholder = '请选择',
  disabled = false,
  emptyText = '暂无选项'
}: {
  options: MultiSelectOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const selectedLabels = options
    .filter((option) => selectedIds.includes(option.id))
    .map((option) => option.label);

  const triggerLabel =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join('、')
        : `已选 ${selectedLabels.length} 人`;

  return (
    <div className="multi-select-dropdown" ref={rootRef}>
      <button
        type="button"
        className="multi-select-trigger"
        disabled={disabled || options.length === 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={selectedLabels.length === 0 ? 'multi-select-placeholder' : undefined}>
          {options.length === 0 ? emptyText : triggerLabel}
        </span>
        <ChevronDown size={16} className={open ? 'multi-select-chevron open' : 'multi-select-chevron'} />
      </button>
      {open && options.length > 0 && (
        <ul className="multi-select-menu" id={listId} role="listbox" aria-multiselectable="true">
          {options.map((option) => {
            const selected = selectedIds.includes(option.id);
            return (
              <li key={option.id}>
                <button
                  type="button"
                  className={selected ? 'multi-select-option is-selected' : 'multi-select-option'}
                  role="option"
                  aria-selected={selected}
                  disabled={disabled}
                  onClick={() => onToggle(option.id)}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
