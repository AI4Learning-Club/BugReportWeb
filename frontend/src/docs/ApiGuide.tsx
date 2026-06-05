import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type TocItem = { id: string; text: string; level: number };

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-');
}

function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  for (const line of markdown.split('\n')) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].replace(/\s+#*$/, '').trim();
    items.push({ id: slugify(text), text, level });
  }
  return items;
}

export default function ApiGuide() {
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}content/api-guide.md`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`加载失败 (${response.status})`);
        }
        return response.text();
      })
      .then(setMarkdown)
      .catch((err: Error) => setError(err.message));
  }, []);

  const toc = useMemo(() => extractToc(markdown), [markdown]);

  if (error) {
    return <div className="ai-guide-error">无法加载 API 使用指南：{error}</div>;
  }

  if (!markdown) {
    return <div className="ai-guide-loading">加载 API 使用指南…</div>;
  }

  return (
    <div className="ai-guide-layout">
      <aside className="ai-guide-toc" aria-label="目录">
        <p className="ai-guide-toc-title">目录</p>
        <ul>
          {toc.map((item) => (
            <li key={item.id} className={item.level === 3 ? 'level-3' : undefined}>
              <a href={`#${item.id}`}>{item.text}</a>
            </li>
          ))}
        </ul>
      </aside>
      <article className="ai-guide-content prose">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children, ...props }) => {
              const text = String(children);
              return (
                <h2 id={slugify(text)} {...props}>
                  {children}
                </h2>
              );
            },
            h3: ({ children, ...props }) => {
              const text = String(children);
              return (
                <h3 id={slugify(text)} {...props}>
                  {children}
                </h3>
              );
            },
            a: ({ href, children, ...props }) => {
              if (href?.startsWith('/')) {
                return (
                  <Link to={href} {...props}>
                    {children}
                  </Link>
                );
              }
              return (
                <a href={href} target="_blank" rel="noreferrer" {...props}>
                  {children}
                </a>
              );
            },
            code: ({ className, children, ...props }) => {
              const isBlock = Boolean(className?.includes('language-'));
              if (isBlock) {
                return (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              }
              return (
                <code className="ai-guide-inline-code" {...props}>
                  {children}
                </code>
              );
            },
            pre: ({ children, ...props }) => (
              <pre className="ai-guide-code-block" {...props}>
                {children}
              </pre>
            )
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  );
}
