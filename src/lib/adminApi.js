// 운영자 API: 화면(React)과 분리된 순수 JS 모듈.
// 어떤 화면에서든 이 파일만 import하면 운영자 기능을 만들 수 있다.
// 자세한 설명과 REST(curl) 호출법은 docs/ADMIN_API.md 참고.
import {
  ADJUST_MAX,
  ADJUST_MIN,
  BATTLE_MS,
  OBJECTION_THRESHOLD,
  OBJECTION_WINDOW_MS,
  RESULT_MS,
  THRESHOLD_MAX,
  THRESHOLD_MIN,
  computePhase,
  endGame,
  resetCurrentBattle,
  setBattleDuration,
  setCountAdjust,
  setThreshold,
  startBattle,
  startGame,
  subscribeBattle,
  subscribeBattleDuration,
  subscribeCheer,
  subscribeCountAdjust,
  subscribeGame,
  subscribeObjections,
  subscribePresence,
  subscribeShakes,
  subscribeThreshold,
} from './room.js';
import { serverNow } from './serverTime.js';
import { getGame } from '../data/games.js';

/**
 * 방 상태를 실시간으로 구독한다. 값이 바뀌거나 250ms마다 cb(status)를 호출한다.
 * 반환: 구독 해제 함수
 *
 * status = {
 *   gameId, serverNow,
 *   gameState: 'wait' | 'live' | 'end',   // 경기 시작 전 / 진행 중 / 종료
 *   startedAt, endedAt,                    // 경기 시작/종료 서버 시각(ms). 없으면 null
 *   phase: 'idle' | 'cutscene' | 'battle' | 'result',  // 경기 진행 중의 세부 단계 (idle = 평소 응원 중)
 *   phaseLeftMs,                 // 현재 단계가 끝날 때까지 남은 시간 (idle이면 0)
 *   battle: {id, cutsceneAt, startAt, endAt} | null,
 *   battleMs,                    // 다음 배틀부터 적용되는 배틀 길이
 *   teams: { [teamId]: {
 *     name, color,
 *     count,        // 화면에 보이는 인원수 (실제 + 운영자 가감)
 *     realCount,    // 실제 접속자 수
 *     adjust,       // 운영자 가감값
 *     score,        // 이번 배틀 점수
 *     cheer,        // 이번 경기 응원 점수
 *   } },
 *   presenceTotal,               // 실제 전체 접속자
 *   objections: { count, threshold, leftMs },   // threshold = 발동 기준 인원
 *   can: { startGame, endGame, startBattle, next },   // 지금 누를 수 있는 동작 (버튼 활성/회색 판단용)
 * }
 */
export function subscribeAdminStatus(gameId, cb) {
  const game = getGame(gameId);
  let gameInfo = { state: 'wait', runId: null };
  let presence = {};
  let objections = {};
  let battle = null;
  let battleMs = BATTLE_MS;
  let threshold = OBJECTION_THRESHOLD;
  let adjust = {};
  let shakes = {};
  let cheer = {};
  let shakeBattleId = null;
  let cheerRunId = null;
  let unsubShakes = () => {};
  let unsubCheer = () => {};

  const emit = () => {
    const now = serverNow();
    const phase = computePhase(battle, now);

    const teams = {};
    Object.entries((game && game.teams) || {}).forEach(([id, t]) => {
      const a = adjust[id] || 0;
      teams[id] = { name: t.name, color: t.color, count: 0, realCount: 0, adjust: a, score: 0, cheer: 0 };
    });
    Object.values(presence).forEach((u) => {
      if (teams[u.team]) teams[u.team].realCount += 1;
    });
    Object.values(teams).forEach((t) => {
      t.count = Math.max(0, t.realCount + t.adjust);
    });
    Object.values(shakes).forEach((s) => {
      if (teams[s.team]) teams[s.team].score += s.count || 0;
    });
    Object.values(cheer).forEach((s) => {
      if (teams[s.team]) teams[s.team].cheer += s.count || 0;
    });

    const recent = Object.values(objections)
      .map((o) => o.at)
      .filter((at) => typeof at === 'number' && at > now - OBJECTION_WINDOW_MS);
    const oldest = recent.length ? Math.min(...recent) : null;

    let phaseLeftMs = 0;
    if (phase === 'cutscene') phaseLeftMs = battle.startAt - now;
    else if (phase === 'battle') phaseLeftMs = battle.endAt - now;
    else if (phase === 'result') phaseLeftMs = battle.endAt + RESULT_MS - now;

    const live = gameInfo.state === 'live';
    cb({
      gameId,
      serverNow: now,
      gameState: gameInfo.state,
      startedAt: gameInfo.startedAt || null,
      endedAt: gameInfo.endedAt || null,
      phase,
      phaseLeftMs: Math.max(0, phaseLeftMs),
      battle: battle && battle.state === 'cutscene' ? battle : null,
      battleMs,
      teams,
      presenceTotal: Object.keys(presence).length,
      objections: {
        count: recent.length,
        threshold,
        leftMs: oldest ? Math.max(0, OBJECTION_WINDOW_MS - (now - oldest)) : 0,
      },
      can: {
        startGame: !live,
        endGame: live && phase === 'idle', // 배틀 중에는 종료할 수 없다
        startBattle: live && phase === 'idle',
        next: live && phase === 'result',
      },
    });
  };

  const watchShakes = () => {
    const id = battle && battle.state === 'cutscene' ? battle.id : null;
    if (id === shakeBattleId) return;
    shakeBattleId = id;
    unsubShakes();
    shakes = {};
    unsubShakes = id ? subscribeShakes(gameId, id, (v) => { shakes = v; emit(); }) : () => {};
  };

  const watchCheer = () => {
    const id = gameInfo.runId || null;
    if (id === cheerRunId) return;
    cheerRunId = id;
    unsubCheer();
    cheer = {};
    unsubCheer = id ? subscribeCheer(gameId, id, (v) => { cheer = v; emit(); }) : () => {};
  };

  const unsubs = [
    subscribeGame(gameId, (v) => { gameInfo = v; watchCheer(); emit(); }),
    subscribePresence(gameId, (v) => { presence = v; emit(); }),
    subscribeObjections(gameId, (v) => { objections = v; emit(); }),
    subscribeBattle(gameId, (v) => { battle = v; watchShakes(); emit(); }),
    subscribeBattleDuration(gameId, (v) => { battleMs = v; emit(); }),
    subscribeThreshold(gameId, (v) => { threshold = v; emit(); }),
    subscribeCountAdjust(gameId, (v) => { adjust = v; emit(); }),
  ];
  const timer = setInterval(emit, 250);

  return () => {
    clearInterval(timer);
    unsubs.forEach((u) => u());
    unsubShakes();
    unsubCheer();
  };
}

/** 운영자 동작. 모두 Promise를 반환하고, 서버 연결 문제면 reject 된다. */
export const adminActions = {
  /** 경기 시작: 시작 전/종료 상태에서만 성공 → true/false. 응원 점수가 0부터 다시 시작한다 */
  startGame: (gameId) => startGame(gameId),
  /** 경기 종료: 진행 중일 때만 성공 → true/false */
  endGame: (gameId) => endGame(gameId),
  /** 벤치클리어링 시작(= 판정 배틀 강제 시작). 경기 진행 중이고 평소 응원 중일 때만 성공 → true/false */
  startBattle: (gameId) => startBattle(gameId),
  /** 다음 판정: 결과 화면을 끝내고 평소 응원으로. 진행 중인 배틀이 있을 때만 성공 → true/false */
  next: (gameId) => resetCurrentBattle(gameId),
  /** 다음 배틀부터 적용할 배틀 길이(초). 5~60초로 보정된다 */
  setBattleSeconds: (gameId, seconds) => setBattleDuration(gameId, seconds * 1000),
  /** 이의 있음이 몇 명 모이면 배틀이 시작되는지 (1~50) */
  setThreshold: (gameId, n) => setThreshold(gameId, n),
  /** 화면에 보이는 팀별 인원수에 더할 값을 정한다 (-99~99). 0이면 실제 수 그대로 */
  setCountAdjust: (gameId, teamId, n) => setCountAdjust(gameId, teamId, n),
};

export const ADMIN_LIMITS = { THRESHOLD_MIN, THRESHOLD_MAX, ADJUST_MIN, ADJUST_MAX };
