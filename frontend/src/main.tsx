import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';
import './mobile.css';

let viewportUpdateFrame = 0;

function syncVisualViewportSize() {
  if (viewportUpdateFrame) {
    window.cancelAnimationFrame(viewportUpdateFrame);
  }
  viewportUpdateFrame = window.requestAnimationFrame(() => {
    viewportUpdateFrame = 0;
    const visualViewport = window.visualViewport;
    const viewportHeight = visualViewport?.height ?? window.innerHeight;
    const viewportTop = visualViewport?.offsetTop ?? 0;
    const viewportBottomOffset = Math.max(0, window.innerHeight - viewportHeight - viewportTop);
    document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(viewportHeight)}px`);
    document.documentElement.style.setProperty('--app-viewport-bottom-offset', `${Math.round(viewportBottomOffset)}px`);
  });
}

syncVisualViewportSize();
window.visualViewport?.addEventListener('resize', syncVisualViewportSize);
window.visualViewport?.addEventListener('scroll', syncVisualViewportSize);
window.addEventListener('resize', syncVisualViewportSize);
window.addEventListener('orientationchange', syncVisualViewportSize);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
