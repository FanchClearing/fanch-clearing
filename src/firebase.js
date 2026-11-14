import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FB_DATABASE_URL,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

// 설정이 비어 있어도 화면이 하얗게 죽지 않도록 방어한다.
export const firebaseReady = Boolean(firebaseConfig.databaseURL);

let db = null;
if (firebaseReady) {
  try {
    db = getDatabase(initializeApp(firebaseConfig));
  } catch (e) {
    console.error('Firebase 초기화 실패', e);
  }
} else {
  console.error('Firebase 설정(.env.local)이 없습니다. .env.example 참고');
}

export { db };
