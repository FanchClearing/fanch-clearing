import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 빌드마다 달라지는 값: 화면 구석의 빌드 표시와, 새 버전 자동 감지(version.json)에 쓴다
const BUILD_ID = String(Date.now());
const BUILD_LABEL = new Date().toLocaleString('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const versionJson = () => ({
  name: 'version-json',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) });
  },
});

export default defineConfig({
  plugins: [react(), versionJson()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
    __BUILD_LABEL__: JSON.stringify(BUILD_LABEL),
  },
  server: {
    host: true,
    allowedHosts: ['.trycloudflare.com'],
  },
});
