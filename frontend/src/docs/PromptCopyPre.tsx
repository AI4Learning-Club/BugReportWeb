import { type ReactNode, useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';

function extractPreText(children: ReactNode): string {
  if (children == null || typeof children === 'boolean') {
    return '';
  }
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractPreText).join('');
  }
  if (typeof children === 'object' && 'props' in children) {
    return extractPreText((children as { props: { children?: ReactNode } }).props.children);
  }
  return '';
}

type PromptCopyPreProps = React.ComponentProps<'pre'> & {
  children?: ReactNode;
};

export default function PromptCopyPre({ children, className, ...props }: PromptCopyPreProps) {
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => extractPreText(children).replace(/\n$/, ''), [children]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="prompt-copy-wrap">
      <button
        type="button"
        className={`prompt-copy-btn${copied ? ' copied' : ''}`}
        onClick={() => void handleCopy()}
        aria-label={copied ? '已复制' : '复制提示词'}
        title={copied ? '已复制' : '复制到剪贴板'}
      >
        {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        <span>{copied ? '已复制' : '复制'}</span>
      </button>
      <pre className={['ai-guide-code-block', 'prompt-copy-block', className].filter(Boolean).join(' ')} {...props}>
        {children}
      </pre>
    </div>
  );
}
