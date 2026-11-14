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
const gamePath = (gameId) => `rooms/${gameId}/game`;
const cheerPath = (gameId) => `rooms/${gameId}/cheer`;

export const THRESHOLD_MIN = 1;
export const THRESHOLD_MAX = 50;
export const ADJUST_MIN = -99;
export const ADJUST_MAX = 99;

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

/**
 * 팀별 "표시" 접속자 수 { [teamId]: n, total, raw: {실제 접속자 수} }.
 * 운영자가 정한 가감(config/countAdjust)이 더해진 값이 화면에 보이는 수이고, raw가 실제 수다.
 */
export function usePresenceCounts(gameId) {
  const [users, setUsers] = useState({});
  const [adjust, setAdjust] = useState({});
  useEffect(() => (gameId ? subscribePresence(gameId, setUsers) : undefined), [gameId]);
  useEffect(() => (gameId ? subscribeCountAdjust(gameId, setAdjust) : undefined), [gameId]);

  const raw = { total: 0 };
  Object.values(users).forEach((u) => {
    raw[u.team] = (raw[u.team] || 0) + 1;
    raw.total += 1;
  });
  const shown = { total: 0, raw };
  new Set([...Object.keys(raw), ...Object.keys(adjust)]).forEach((id) => {
    if (id === 'total') return;
    shown[id] = Math.max(0, (raw[id] || 0) + (adjust[id] || 0));
    shown.total += shown[id];
  });
  return shown;
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
  // 경기가 진행 중(live)일 때만 시작할 수 있다
  const g = await get(ref(db, gamePath(gameId)));
  if (!g.val() || g.val().state !== 'live') return false;
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
  const [threshold, setThresholdState] = useState(OBJECTION_THRESHOLD);
  const [game, setGame] = useState({ state: 'wait', runId: null });
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => subscribeBattle(gameId, setBattle), [gameId]);
  useEffect(() => subscribeObjections(gameId, setObjections), [gameId]);
  useEffect(() => subscribeThreshold(gameId, setThresholdState), [gameId]);
  useEffect(() => subscribeGame(gameId, setGame), [gameId]);

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

  // 기준 충족 → 트리거 (경기 진행 중이고, transaction이 idle일 때만 통과시킨다)
  const canTrigger = game.state === 'live' && phase === 'idle' && objectionCount >= threshold;
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

  return {
    phase,
    battle,
    now,
    objectionCount,
    objectionLeftMs,
    threshold,
    gameState: game.state,
    runId: game.runId,
  };
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

// ---------------------------------------------------------------------- game
// 경기 상태: 'wait'(시작 전) → 'live'(진행 중, 평소 응원 + 이의 있음) → 'end'(종료)

const DEFAULT_GAME = { state: 'wait', runId: null };

/** cb({ state: 'wait'|'live'|'end', runId, startedAt?, endedAt? }) */
export function subscribeGame(gameId, cb) {
  if (!db) {
    cb(DEFAULT_GAME);
    return () => {};
  }
  return onValue(
    ref(db, gamePath(gameId)),
    (snap) => cb(snap.val() || DEFAULT_GAME),
    (e) => console.error('game 구독 실패', e)
  );
}

/** 경기 시작: 시작 전/종료 상태에서만. 새 runId가 생겨 응원 점수가 0부터 다시 시작한다 → true/false */
export async function startGame(gameId) {
  if (!db) throw new Error('서버 연결 없음');
  const runId = push(ref(db, cheerPath(gameId))).key;
  const result = await runTransaction(ref(db, gamePath(gameId)), (cur) => {
    if (!cur || cur.state !== 'live') return { state: 'live', runId, startedAt: serverNow() };
    return undefined;
  });
  if (result.committed) await remove(ref(db, objectionsPath(gameId)));
  return result.committed;
}

/** 경기 종료: 진행 중일 때만 → true/false */
export async function endGame(gameId) {
  if (!db) throw new Error('서버 연결 없음');
  const result = await runTransaction(ref(db, gamePath(gameId)), (cur) => {
    if (cur && cur.state === 'live') return { ...cur, state: 'end', endedAt: serverNow() };
    return undefined;
  });
  return result.committed;
}

// --------------------------------------------------------------------- cheer
// 평소 응원 점수: cheer/{runId}/{uid} = { team, nickname, count } (경기 시작마다 runId가 새로 생긴다)

export function setMyCheer(gameId, runId, uid, data) {
  if (!db) return Promise.reject(new Error('서버 연결 없음'));
  return set(ref(db, `${cheerPath(gameId)}/${runId}/${uid}`), data);
}

export function subscribeCheer(gameId, runId, cb) {
  if (!db || !runId) {
    cb({});
    return () => {};
  }
  return onValue(
    ref(db, `${cheerPath(gameId)}/${runId}`),
    (snap) => cb(snap.val() || {}),
    (e) => console.error('cheer 구독 실패', e)
  );
}

/** 팀별 응원 합계 { [teamId]: n } 와 참가자 목록 */
export function useCheerScores(gameId, runId) {
  const [cheer, setCheer] = useState({});
  useEffect(() => subscribeCheer(gameId, runId, setCheer), [gameId, runId]);

  const totals = {};
  const list = Object.entries(cheer).map(([uid, s]) => {
    totals[s.team] = (totals[s.team] || 0) + (s.count || 0);
    return { uid, ...s };
  });
  list.sort((a, b) => (b.count || 0) - (a.count || 0));
  return { totals, list };
}

// -------------------------------------------------------------------- config
// 운영자 설정: 이의 있음 발동 기준 인원, 표시 인원수 가감

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v))));

/** 이의 있음이 몇 명 모이면 컷신+배틀이 시작되는지 (1~50) */
export function setThreshold(gameId, n) {
  if (!db) return Promise.reject(new Error('서버 연결 없음'));
  const v = Number(n);
  if (!Number.isFinite(v)) return Promise.reject(new Error('숫자가 아닙니다'));
  return set(ref(db, `${configPath(gameId)}/threshold`), clamp(v, THRESHOLD_MIN, THRESHOLD_MAX));
}

export function subscribeThreshold(gameId, cb) {
  if (!db) {
    cb(OBJECTION_THRESHOLD);
    return () => {};
  }
  return onValue(
    ref(db, `${configPath(gameId)}/threshold`),
    (snap) =>
      cb(snap.val() == null ? OBJECTION_THRESHOLD : clamp(snap.val(), THRESHOLD_MIN, THRESHOLD_MAX)),
    (e) => console.error('threshold 구독 실패', e)
  );
}

/** 화면에 보이는 팀별 인원수에 더할 값 (-99~99). 연출용이라 실제 접속자 수와 다를 수 있다 */
export function setCountAdjust(gameId, teamId, n) {
  if (!db) return Promise.reject(new Error('서버 연결 없음'));
  const v = Number(n);
  if (!Number.isFinite(v)) return Promise.reject(new Error('숫자가 아닙니다'));
  return set(ref(db, `${configPath(gameId)}/countAdjust/${teamId}`), clamp(v, ADJUST_MIN, ADJUST_MAX));
}

/** cb({ [teamId]: 가감값 }) */
export function subscribeCountAdjust(gameId, cb) {
  if (!db) {
    cb({});
    return () => {};
  }
  return onValue(
    ref(db, `${configPath(gameId)}/countAdjust`),
    (snap) => cb(snap.val() || {}),
    (e) => console.error('countAdjust 구독 실패', e)
  );
}

// --------------------------------------------------------------------- taunt
// 벤치클리어링 결과 후 이긴 팀이 "메롱"을 연타해 상대를 놀리는 기능: taunt/{battleId}/{uid} = { team, count }

const tauntPath = (gameId) => `rooms/${gameId}/taunt`;

export function setMyTaunt(gameId, battleId, uid, data) {
  if (!db) return Promise.reject(new Error('서버 연결 없음'));
  return set(ref(db, `${tauntPath(gameId)}/${battleId}/${uid}`), data);
}

export function subscribeTaunt(gameId, battleId, cb) {
  if (!db || !battleId) {
    cb({});
    return () => {};
  }
  return onValue(
    ref(db, `${tauntPath(gameId)}/${battleId}`),
    (snap) => cb(snap.val() || {}),
    (e) => console.error('taunt 구독 실패', e)
  );
}

/** 놀린 횟수 합계. others = 나를 뺀 다른 사람들 합(내 것은 화면에서 바로 반영하므로 따로 센다), total = 전체 */
export function useTauntScores(gameId, battleId, myUid) {
  const [taunt, setTaunt] = useState({});
  useEffect(() => subscribeTaunt(gameId, battleId, setTaunt), [gameId, battleId]);
  let others = 0;
  let total = 0;
  Object.entries(taunt).forEach(([uid, t]) => {
    total += t.count || 0;
    if (uid !== myUid) others += t.count || 0;
  });
  return { others, total };
}
