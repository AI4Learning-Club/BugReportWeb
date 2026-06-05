import { Copy, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalClose } from './ModalShell';
import { notifyError, notifySuccess } from './ToastProvider';

export type ScreenshotGridItem = {
  id: string;
  src: string;
  label: string;
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 4;
const SCALE_STEP = 0.25;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2))));
}

function formatScale(scale: number) {
  return `${Math.round(scale * 100)}%`;
}

function touchDistance(
  first: { clientX: number; clientY: number },
  second: { clientX: number; clientY: number }
) {
  return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
}

async function copyImageToClipboard(src: string) {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('当前浏览器不支持复制图片');
  }

  const response = await fetch(src);
  if (!response.ok) {
    throw new Error('无法读取图片');
  }

  const blob = await response.blob();
  const type = blob.type.startsWith('image/') ? blob.type : 'image/png';
  await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
}

function ScreenshotPreviewDialog({
  item,
  onClose
}: {
  item: ScreenshotGridItem;
  onClose: () => void;
}) {
  const { isClosing, requestClose } = useModalClose(onClose, false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [copying, setCopying] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setScale((current) => {
      const next = clampScale(current + delta);
      if (next <= 1) {
        setOffset({ x: 0, y: 0 });
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback(async () => {
    if (copying) return;
    setCopying(true);
    try {
      await copyImageToClipboard(item.src);
      notifySuccess('图片已复制到剪贴板');
    } catch (error) {
      notifyError(error instanceof Error ? error.message : '复制图片失败');
    } finally {
      setCopying(false);
    }
  }, [copying, item.src]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        requestClose();
        return;
      }
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        zoomBy(SCALE_STEP);
      }
      if (event.key === '-') {
        event.preventDefault();
        zoomBy(-SCALE_STEP);
      }
      if (event.key === '0') {
        event.preventDefault();
        resetView();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [requestClose, resetView, zoomBy]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
    }

    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (scale <= 1 || event.pointerType === 'touch') {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      baseX: offset.x,
      baseY: offset.y
    };
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    setOffset({
      x: drag.baseX + event.clientX - drag.startX,
      y: drag.baseY + event.clientY - drag.startY
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2) {
      return;
    }
    pinchRef.current = {
      distance: touchDistance(event.touches[0]!, event.touches[1]!),
      scale
    };
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const pinch = pinchRef.current;
    if (!pinch || event.touches.length !== 2) {
      return;
    }
    event.preventDefault();
    const distance = touchDistance(event.touches[0]!, event.touches[1]!);
    const next = clampScale(pinch.scale * (distance / pinch.distance));
    setScale(next);
    if (next <= 1) {
      setOffset({ x: 0, y: 0 });
    }
  }

  function handleTouchEnd() {
    if (pinchRef.current) {
      pinchRef.current = null;
    }
  }

  const dialog = (
    <div
      className={`screenshot-preview-backdrop${isClosing ? ' closing' : ''}`}
      role="presentation"
      onClick={requestClose}
    >
      <div className="screenshot-preview-shell" onClick={(event) => event.stopPropagation()}>
        <button
          className="screenshot-preview-close icon-button"
          type="button"
          onClick={requestClose}
          title="关闭预览"
          aria-label="关闭预览"
        >
          <X size={22} />
        </button>

        <div
          ref={stageRef}
          className={`screenshot-preview-stage${scale > 1 ? ' is-zoomed' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <img
            className="screenshot-preview-image"
            src={item.src}
            alt={item.label}
            draggable={false}
            style={{
              transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`
            }}
          />
        </div>

        <p className="screenshot-preview-caption">{item.label}</p>

        <div className="screenshot-preview-toolbar" role="toolbar" aria-label="截图预览工具">
          <div className="screenshot-preview-toolbar-group">
            <button
              className="icon-button"
              type="button"
              onClick={() => zoomBy(-SCALE_STEP)}
              disabled={scale <= MIN_SCALE}
              title="缩小"
              aria-label="缩小"
            >
              <ZoomOut size={18} />
            </button>
            <button
              className="screenshot-preview-scale"
              type="button"
              onClick={resetView}
              title="重置缩放"
              aria-label="重置缩放"
            >
              {formatScale(scale)}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => zoomBy(SCALE_STEP)}
              disabled={scale >= MAX_SCALE}
              title="放大"
              aria-label="放大"
            >
              <ZoomIn size={18} />
            </button>
          </div>
          <button
            className="ghost compact screenshot-preview-copy"
            type="button"
            onClick={() => void handleCopy()}
            disabled={copying}
            title="复制图片"
            aria-label="复制图片"
          >
            <Copy size={16} />
            {copying ? '复制中...' : '复制图片'}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog;
}

export function ScreenshotGrid({
  items,
  emptyLabel = '暂无截图',
  canDelete = false,
  onDelete,
  className = ''
}: {
  items: ScreenshotGridItem[];
  emptyLabel?: string;
  canDelete?: boolean;
  onDelete?: (id: string) => void;
  className?: string;
}) {
  const [preview, setPreview] = useState<ScreenshotGridItem | null>(null);

  if (items.length === 0) {
    return <p className="muted">{emptyLabel}</p>;
  }

  return (
    <>
      <div className={`screenshots${className ? ` ${className}` : ''}`}>
        {items.map((item) => (
          <figure key={item.id}>
            <button
              type="button"
              className="screenshot-open"
              onClick={() => setPreview(item)}
              aria-label={`查看大图：${item.label}`}
            >
              <img src={item.src} alt={item.label} />
            </button>
            <figcaption>{item.label}</figcaption>
            {canDelete && onDelete && (
              <button
                className="icon-button"
                type="button"
                onClick={() => onDelete(item.id)}
                title="删除截图"
              >
                <Trash2 size={16} />
              </button>
            )}
          </figure>
        ))}
      </div>
      {preview && <ScreenshotPreviewDialog item={preview} onClose={() => setPreview(null)} />}
    </>
  );
}
