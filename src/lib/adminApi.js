// 운영자 API: 화면(React)과 분리된 순수 JS 모듈.
// 어떤 화면에서든 이 파일만 import하면 운영자 기능을 만들 수 있다.
// 자세한 설명과 REST(curl) 호출법은 docs/ADMIN_API.md 참고.
import {
  OBJECTION_THRESHOLD,
  OBJECTION_WINDOW_MS,
  RESULT_MS,
  BATTLE_MS,
  computePhase,
  resetCurrentBattle,
  setBattleDuration,
  startBattle,
  subscribeBattle,
  subscribeBattleDuration,
  subscribeObjections,
  subscribePresence,
  subscribeShakes,
} from './room.js';
import { serverNow } from './serverTime.js';
import { getGame } from '../data/games.js';

/**
 * 방 상태를 실시간으로 구독한다. 값이 바뀌거나 250ms마다 cb(status)를 호출한다.
 * 반환: 구독 해제 함수
 *
 * status = {
 *   gameId, serverNow,
 *   phase: 'idle' | 'cutscene' | 'battle' | 'result',
 *   phaseLeftMs,                 // 현재 단계가 끝날 때까지 남은 시간 (idle이면 0)
 *   battle: {id, cutsceneAt, startAt, endAt} | null,
 *   battleMs,                    // 다음 배틀부터 적용되는 배틀 길이
 *   teams: { [teamId]: { name, color, count, score } },   // 인원, 이번 배틀 점수
 *   presenceTotal,
 *   objections: { count, threshold, leftMs },
 *   can: { start, next },        // 지금 누를 수 있는 동작
 * }
 */
export function subscribeAdminStatus(gameId, cb) {
  const game = getGame(gameId);
  let presence = {};
  let objections = {};
  let battle = null;
  let battleMs = BATTLE_MS;
  let shakes = {};
  let shakeBattleId = null;
  let unsubShakes = () => {};

  const emit = () => {
    const now = serverNow();
    const phase = computePhase(battle, now);

    const teams = {};
    Object.entries((game && game.teams) || {}).forEach(([id, t]) => {
      teams[id] = { name: t.name, color: t.color, count: 0, score: 0 };
    });
    Object.values(presence).forEach((u) => {
      if (teams[u.team]) teams[u.team].count += 1;
    });
    Object.values(shakes).forEach((s) => {
      if (teams[s.team]) teams[s.team].score += s.count || 0;
    });

    const recent = Object.values(objections)
      .map((o) => o.at)
      .filter((at) => typeof at === 'number' && at > now - OBJECTION_WINDOW_MS);
    const oldest = recent.length ? Math.min(...recent) : null;

    let phaseLeftMs = 0;
    if (phase === 'cutscene') phaseLeftMs = battle.startAt - now;
    else if (phase === 'battle') phaseLeftMs = battle.endAt - now;
    else if (phase === 'result') phaseLeftMs = battle.endAt + RESULT_MS - now;

    cb({
      gameId,
      serverNow: now,
      phase,
      phaseLeftMs: Math.max(0, phaseLeftMs),
      battle: battle && battle.state === 'cutscene' ? battle : null,
      battleMs,
      teams,
      presenceTotal: Object.keys(presence).length,
      objections: {
        count: recent.length,
        threshold: OBJECTION_THRESHOLD,
        leftMs: oldest ? Math.max(0, OBJECTION_WINDOW_MS - (now - oldest)) : 0,
      },
      can: { start: phase === 'idle', next: phase === 'result' },
    });
  };

  const watchShakes = () => {
    const id = battle && battle.state === 'cutscene' ? battle.id : null;
    if (id === shakeBattleId) return;
    shakeBattleId = id;
    unsubShakes();
    shakes = {};
    unsubShakes = id
      ? subscribeShakes(gameId, id, (v) => {
          shakes = v;
          emit();
        })
      : () => {};
  };

  const unsubs = [
    subscribePresence(gameId, (v) => { presence = v; emit(); }),
    subscribeObjections(gameId, (v) => { objections = v; emit(); }),
    subscribeBattle(gameId, (v) => { battle = v; watchShakes(); emit(); }),
    subscribeBattleDuration(gameId, (v) => { battleMs = v; emit(); }),
  ];
  const timer = setInterval(emit, 250);

  return () => {
    clearInterval(timer);
    unsubs.forEach((u) => u());
    unsubShakes();
  };
}

/** 운영자 동작. 모두 Promise를 반환하고, 실패하면 reject 된다. */
export const adminActions = {
  /** 강제 판정 시작 (이의 있음 기준 무시). 대기(idle)일 때만 성공 → true/false */
  forceStart: (gameId) => startBattle(gameId),
  /** 다음 판정: 현재 배틀을 끝내고 대기로. 진행 중인 배틀이 있을 때만 성공 → true/false */
  next: (gameId) => resetCurrentBattle(gameId),
  /** 다음 배틀부터 적용할 배틀 길이(초). 5~60초로 보정된다 */
  setBattleSeconds: (gameId, seconds) => setBattleDuration(gameId, seconds * 1000),
};
