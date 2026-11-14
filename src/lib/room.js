import { useEffect, useState } from 'react';
import {
  ref,
  set,
  push,
  remove,
  onValue,
  onDisconnect,
  runTransaction,
  get,
  serverTimestamp,
} from 'firebase/database';
import { db } from '../firebase.js';
import { serverNow } from './serverTime.js';
import { showToast } from './toast.js';

export const OBJECTION_WINDOW_MS = 10000;
export const OBJECTION_THRESHOLD = 3;
export const CUTSCENE_MS = 5000;
export const BATTLE_MS = 10000; // 기본값. 운영자가 방 설정으로 바꿀 수 있다
export const BATTLE_MIN_MS = 5000;
export const BATTLE_MAX_MS = 60000;
export const RESULT_MS = 15000;

// DB 경로 문자열은 이 파일 안에서만 쓴다.
const presencePath = (gameId) => `rooms/${gameId}/presence`;
const objectionsPath = (gameId) => `rooms/${gameId}/objections`;
const battlePath = (gameId) => `rooms/${gameId}/battle`;
const shakesPath = (gameId) => `rooms/${gameId}/shakes`;
const configPath = (gameId) => `rooms/${gameId}/config`;

function clampBattleMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return BATTLE_MS;
  return Math.min(BATTLE_MAX_MS, Math.max(BATTLE_MIN_MS, Math.round(n)));
}

/** 운영자 설정: 다음 배틀부터 적용되는 배틀 길이(ms) */
export function setBattleDuration(gameId, ms) {
  if (!db) return Promise.reject(new Error('서버 연결 없음'));
  return set(ref(db, `${configPath(gameId)}/battleMs`), clampBattleMs(ms));
}

/** cb(ms) — 설정이 없으면 기본값 */
export function subscribeBattleDuration(gameId, cb) {
  if (!db) {
    cb(BATTLE_MS);
    return () => {};
  }
  return onValue(
    ref(db, `${configPath(gameId)}/battleMs`),
    (snap) => cb(snap.val() == null ? BATTLE_MS : clampBattleMs(snap.val())),
    (e) => console.error('battleMs 구독 실패', e)
  );
}

async function readBattleDuration(gameId) {
  try {
    const snap = await get(ref(db, `${configPath(gameId)}/battleMs`));
    return snap.val() == null ? BATTLE_MS : clampBattleMs(snap.val());
  } catch (e) {
    console.error('battleMs 읽기 실패, 기본값 사용', e);
    return BATTLE_MS;
  }
}

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
      .catch((e) => {
        console.error('presence 등록 실패', e);
        showToast('방 접속에 문제가 있어요');
      });
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

// ---------------------------------------------------------------- objections

/** 이의 있음 기록 (다시 누르면 at 갱신) */
export function addObjection(gameId, uid, team) {
  if (!db) return Promise.reject(new Error('서버 연결 없음'));
  return set(ref(db, `${objectionsPath(gameId)}/${uid}`), { team, at: serverTimestamp() });
}

/** cb({ [uid]: {team, at} }) */
export function subscribeObjections(gameId, cb) {
  if (!db) {
    cb({});
    return () => {};
  }
  return onValue(
    ref(db, objectionsPath(gameId)),
    (snap) => cb(snap.val() || {}),
    (e) => console.error('objections 구독 실패', e)
  );
}

// -------------------------------------------------------------------- battle

/** cb(battle | null) */
export function subscribeBattle(gameId, cb) {
  if (!db) {
    cb(null);
    return () => {};
  }
  return onValue(
    ref(db, battlePath(gameId)),
    (snap) => cb(snap.val()),
    (e) => console.error('battle 구독 실패', e)
  );
}

/**
 * 배틀 시작: 현재 idle(또는 없음)일 때만 cutscene으로 바꾼다 (한 번만).
 * 강제 시작(T7)도 이 함수를 쓴다.
 */
export async function startBattle(gameId) {
  if (!db) throw new Error('서버 연결 없음');
  const id = push(ref(db, shakesPath(gameId))).key; // 키만 생성, 쓰지 않음
  const battleMs = await readBattleDuration(gameId);
  const cutsceneAt = serverNow() + 300;
  const startAt = cutsceneAt + CUTSCENE_MS;
  const endAt = startAt + battleMs;
  const result = await runTransaction(ref(db, battlePath(gameId)), (cur) => {
    if (!cur || cur.state === 'idle') {
      return { state: 'cutscene', id, cutsceneAt, startAt, endAt };
    }
    return undefined; // 이미 진행 중이면 중단
  });
  return result.committed;
}

/** 결과 후 idle 복귀 + objections 삭제. 같은 배틀에 대해서만 한 번 동작 */
export async function resetBattle(gameId, battleId) {
  if (!db) return;
  const result = await runTransaction(ref(db, battlePath(gameId)), (cur) => {
    if (cur && cur.state === 'cutscene' && cur.id === battleId) {
      return { state: 'idle' };
    }
    return undefined;
  });
  if (result.committed) {
    await remove(ref(db, objectionsPath(gameId)));
  }
}

/** 운영자용: 배틀 id를 몰라도 현재 배틀을 끝내고 idle로 되돌린다 (이의 있음 기록도 삭제) */
export async function resetCurrentBattle(gameId) {
  if (!db) throw new Error('서버 연결 없음');
  const result = await runTransaction(ref(db, battlePath(gameId)), (cur) => {
    if (cur && cur.state === 'cutscene') return { state: 'idle' };
    return undefined;
  });
  if (result.committed) await remove(ref(db, objectionsPath(gameId)));
  return result.committed;
}

export function computePhase(battle, now) {
  if (!battle || battle.state !== 'cutscene') return 'idle';
  if (now < battle.startAt) return 'cutscene';
  if (now < battle.endAt) return 'battle';
  if (now < battle.endAt + RESULT_MS) return 'result';
  return 'idle'; // 결과 시간이 지났으면 리셋 대기
}

/**
 * 방의 현재 단계 훅.
 * phase: 'idle' | 'cutscene' | 'battle' | 'result'
 * 이의 있음 개수 집계, 기준 충족 시 배틀 트리거, 결과 후 자동 리셋까지 담당한다.
 */
export function useBattlePhase(gameId) {
  const [battle, setBattle] = useState(null);
  const [objections, setObjections] = useState({});
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => subscribeBattle(gameId, setBattle), [gameId]);
  useEffect(() => subscribeObjections(gameId, setObjections), [gameId]);

  // 100ms마다 서버 시각 기준으로 갱신 (윈도 만료·단계 전환 감지)
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 100);
    return () => clearInterval(t);
  }, []);

  const phase = computePhase(battle, now);

  const recent = Object.values(objections)
    .map((o) => o.at)
    .filter((at) => typeof at === 'number' && at > now - OBJECTION_WINDOW_MS);
  const objectionCount = recent.length;
  const oldest = recent.length ? Math.min(...recent) : null;
  const objectionLeftMs = oldest ? Math.max(0, OBJECTION_WINDOW_MS - (now - oldest)) : 0;

  // 기준 충족 → 트리거 (transaction이 idle일 때만 통과시킨다)
  const canTrigger = phase === 'idle' && objectionCount >= OBJECTION_THRESHOLD;
  const triggerKey = canTrigger ? 'go' : 'wait';
  useEffect(() => {
    if (triggerKey !== 'go') return;
    startBattle(gameId).catch((e) => {
      console.error('배틀 시작 실패', e);
      showToast('판정 시작 실패! 다시 눌러주세요');
    });
  }, [triggerKey, gameId]);

  // 결과 시간이 끝난 배틀은 idle로 리셋
  const staleId =
    battle && battle.state === 'cutscene' && now >= battle.endAt + RESULT_MS ? battle.id : null;
  useEffect(() => {
    if (!staleId) return;
    resetBattle(gameId, staleId).catch((e) => console.error('리셋 실패', e));
  }, [staleId, gameId]);

  return { phase, battle, now, objectionCount, objectionLeftMs };
}

// -------------------------------------------------------------------- shakes

export const SCORE_FLUSH_MS = 300;

/** 내 점수만 쓴다: shakes/{battleId}/{uid} */
export function setMyShake(gameId, battleId, uid, data) {
  if (!db) return Promise.reject(new Error('서버 연결 없음'));
  return set(ref(db, `${shakesPath(gameId)}/${battleId}/${uid}`), data);
}

/** cb({ [uid]: {team, nickname, count} }) */
export function subscribeShakes(gameId, battleId, cb) {
  if (!db || !battleId) {
    cb({});
    return () => {};
  }
  return onValue(
    ref(db, `${shakesPath(gameId)}/${battleId}`),
    (snap) => cb(snap.val() || {}),
    (e) => console.error('shakes 구독 실패', e)
  );
}

/** 팀별 합계 { [teamId]: n } 와 참가자 목록(count 내림차순) */
export function useShakeScores(gameId, battleId) {
  const [shakes, setShakes] = useState({});
  useEffect(() => subscribeShakes(gameId, battleId, setShakes), [gameId, battleId]);

  const totals = {};
  const list = Object.entries(shakes).map(([uid, s]) => {
    totals[s.team] = (totals[s.team] || 0) + (s.count || 0);
    return { uid, ...s };
  });
  list.sort((a, b) => (b.count || 0) - (a.count || 0));
  return { totals, list };
}
