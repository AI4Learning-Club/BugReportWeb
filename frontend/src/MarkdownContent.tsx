import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** 保留纯文本中的单行换行，与原先 pre-wrap 展示兼容 */
function normalizeMarkdown(text: string) {
  return text.replace(/(?<!\n)\n(?!\n)/g, '  \n').trim();
}

export function MarkdownContent({ text, className }: { text: string; className?: string }) {
  return (
    <div className={['markdown-content', className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noreferrer" {...props}>
              {children}
            </a>
          )
        }}
      >
        {normalizeMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
}
