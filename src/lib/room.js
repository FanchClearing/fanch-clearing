import { useEffect, useState } from 'react';
import { ref, set, remove, onValue, onDisconnect, serverTimestamp } from 'firebase/database';
import { db } from '../firebase.js';

// DB 경로 문자열은 이 파일 안에서만 쓴다.
const presencePath = (gameId) => `rooms/${gameId}/presence`;

/**
 * 방 입장: presence 등록 + 연결 끊김 시 자동 제거.
 * 재연결될 때마다 다시 등록한다. 반환값은 퇴장(cleanup) 함수.
 */
export function joinRoom(gameId, { uid, team, nickname }) {
  if (!db) return () => {};
  const myRef = ref(db, `${presencePath(gameId)}/${uid}`);
  const connRef = ref(db, '.info/connected');

  const unsub = onValue(connRef, (snap) => {
    if (snap.val() !== true) return;
    onDisconnect(myRef)
      .remove()
      .then(() => set(myRef, { team, nickname, joinedAt: serverTimestamp() }))
      .catch((e) => console.error('presence 등록 실패', e));
  });

  return () => {
    unsub();
    remove(myRef).catch((e) => console.error('presence 제거 실패', e));
  };
}

/** presence 구독. cb({ [uid]: {team, nickname, joinedAt} }) */
export function subscribePresence(gameId, cb) {
  if (!db) {
    cb({});
    return () => {};
  }
  return onValue(
    ref(db, presencePath(gameId)),
    (snap) => cb(snap.val() || {}),
    (e) => console.error('presence 구독 실패', e)
  );
}

/** 팀별 접속자 수 { [teamId]: n } 와 전체 수 */
export function usePresenceCounts(gameId) {
  const [counts, setCounts] = useState({ total: 0 });
  useEffect(() => {
    if (!gameId) return undefined;
    return subscribePresence(gameId, (users) => {
      const next = { total: 0 };
      Object.values(users).forEach((u) => {
        next[u.team] = (next[u.team] || 0) + 1;
        next.total += 1;
      });
      setCounts(next);
    });
  }, [gameId]);
  return counts;
}
