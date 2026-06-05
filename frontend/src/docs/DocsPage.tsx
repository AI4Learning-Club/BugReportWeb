import { Layers } from 'lucide-react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import ApiReference from './ApiReference';
import ApiGuide from './ApiGuide';
import AiGuide from './AiGuide';
import '../docs.css';

export default function DocsPage() {
  return (
    <div className="docs-app">
      <header className="docs-header">
        <div className="docs-header-inner">
          <div className="docs-brand">
            <LinkBrand />
            <div className="docs-brand-text">
              <span className="docs-brand-title">SystemController</span>
            </div>
          </div>
          <nav className="docs-nav" aria-label="文档导航">
            <NavLink to="/docs" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
              API 参考
            </NavLink>
            <NavLink to="/docs/api-guide" className={({ isActive }) => (isActive ? 'active' : undefined)}>
              API 指南
            </NavLink>
            <NavLink to="/docs/ai-guide" className={({ isActive }) => (isActive ? 'active' : undefined)}>
              AI 代理指南
            </NavLink>
          </nav>
        </div>
      </header>
      <main className="docs-main">
        <Routes>
          <Route index element={<ApiReference />} />
          <Route path="api-guide" element={<ApiGuide />} />
          <Route path="ai-guide" element={<AiGuide />} />
          <Route path="*" element={<Navigate to="/docs" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function LinkBrand() {
  return (
    <NavLink to="/" className="docs-brand-link" title="返回应用">
      <Layers size={20} />
    </NavLink>
  );
}
