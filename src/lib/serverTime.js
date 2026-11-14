import { ref, onValue } from 'firebase/database';
import { db } from '../firebase.js';

let offset = 0;

if (db) {
  onValue(
    ref(db, '.info/serverTimeOffset'),
    (snap) => {
      offset = snap.val() || 0;
    },
    (e) => console.error('서버 시각 오프셋 구독 실패', e)
  );
}

/** 모든 시간 판단은 이 함수 기준 (로컬 시계 직접 사용 금지) */
export function serverNow() {
  return Date.now() + offset;
}
