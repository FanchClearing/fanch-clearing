import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// 공통 스타일(global.css)을 가장 먼저 로드해야 화면별 스타일(버튼 색·크기 등)이 덮어쓰지 않고 우선 적용된다
import './styles/global.css';
import App from './App.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { showToast } from './lib/toast.js';

// 처리 못 한 비동기 오류도 화면은 살려두고 토스트로 알린다.
window.addEventListener('unhandledrejection', (e) => {
  console.error('처리되지 않은 오류', e.reason);
  showToast('문제가 생겼어요. 다시 시도해 주세요');
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
