import { X } from 'lucide-react';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export const MODAL_EXIT_MS = 180;

export function useModalClose(onCancel: () => void, submitting: boolean) {
  const [isClosing, setIsClosing] = useState(false);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        window.clearTimeout(closeTimer.current);
      }
    };
  }, []);

  function requestClose() {
    if (submitting || isClosing) {
      return;
    }
    setIsClosing(true);
    closeTimer.current = window.setTimeout(() => {
      onCancel();
      setIsClosing(false);
    }, MODAL_EXIT_MS);
  }

  return { isClosing, requestClose };
}

type ModalShellProps = {
  title: string;
  description?: string;
  titleId: string;
  submitting?: boolean;
  onClose: () => void;
  variant: 'action' | 'form';
  backdropClosable?: boolean;
  modalClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: (event: FormEvent) => void;
};

export function ModalShell({
  title,
  description,
  titleId,
  submitting = false,
  onClose,
  variant,
  backdropClosable = false,
  modalClassName = '',
  children,
  footer,
  onSubmit
}: ModalShellProps) {
  const { isClosing, requestClose } = useModalClose(onClose, submitting);

  function handleBackdropClick() {
    if (backdropClosable) {
      requestClose();
    }
  }

  const closingClass = isClosing ? ' closing' : '';
  const backdropClass =
    variant === 'form'
      ? `permission-modal-backdrop${closingClass}`
      : `bug-delete-modal-backdrop${closingClass}`;
  const modalClass =
    variant === 'form'
      ? `permission-modal ${modalClassName}`.trim()
      : `bug-delete-modal${variant === 'action' && modalClassName !== 'plain' ? ' action-modal' : ''} ${modalClassName}`.trim();

  const bodyContent = (
    <>
      {children}
      {variant !== 'form' && footer}
    </>
  );

  const modalTree = (
    <div
      className={backdropClass}
      role="presentation"
      onClick={backdropClosable ? handleBackdropClick : undefined}
    >
      <section
        className={modalClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={backdropClosable ? (event) => event.stopPropagation() : undefined}
      >
        <header className={variant === 'form' ? 'permission-modal-header' : 'bug-delete-modal-header'}>
          <div>
            <h2 id={titleId}>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" type="button" onClick={requestClose} disabled={submitting} title="关闭窗口">
            <X size={20} />
          </button>
        </header>
        {onSubmit ? (
          <form className="bug-delete-modal-body" onSubmit={onSubmit}>
            {bodyContent}
          </form>
        ) : variant === 'form' ? (
          <>
            <div className="permission-modal-scroll">{children}</div>
            {footer && <footer className="permission-modal-footer">{footer}</footer>}
          </>
        ) : (
          <div className="bug-delete-modal-body">{bodyContent}</div>
        )}
      </section>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalTree, document.body) : modalTree;
}

export function ActionModal({
  title,
  description,
  titleId,
  submitting = false,
  onClose,
  actionModal = true,
  children,
  footer,
  onSubmit
}: {
  title: string;
  description?: string;
  titleId: string;
  submitting?: boolean;
  onClose: () => void;
  actionModal?: boolean;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: (event: FormEvent) => void;
}) {
  return (
    <ModalShell
      title={title}
      description={description}
      titleId={titleId}
      submitting={submitting}
      onClose={onClose}
      variant="action"
      modalClassName={actionModal ? '' : 'plain'}
      onSubmit={onSubmit}
      footer={footer}
    >
      {children}
    </ModalShell>
  );
}

export function FormModal({
  title,
  description,
  titleId,
  submitting = false,
  onClose,
  modalClassName = '',
  children,
  footer
}: {
  title: string;
  description?: string;
  titleId: string;
  submitting?: boolean;
  onClose: () => void;
  modalClassName?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const shellClassName = ['dialog-panel-modal', modalClassName].filter(Boolean).join(' ');

  return (
    <ModalShell
      title={title}
      description={description}
      titleId={titleId}
      submitting={submitting}
      onClose={onClose}
      variant="form"
      backdropClosable
      modalClassName={shellClassName}
      footer={footer}
    >
      {children}
    </ModalShell>
  );
}
