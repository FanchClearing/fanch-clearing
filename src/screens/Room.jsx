import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { getNickname, getTeam, getUid } from '../lib/identity.js';
import { serverNow } from '../lib/serverTime.js';
import { showToast } from '../lib/toast.js';
import { HAPTIC, vibrate } from '../lib/haptics.js';
import { requestShakePermission, startShake } from '../lib/shake.js';
import {
  OBJECTION_THRESHOLD,
  OBJECTION_WINDOW_MS,
  SCORE_FLUSH_MS,
  addObjection,
  joinRoom,
  setMyShake,
  useBattlePhase,
  usePresenceCounts,
  useShakeScores,
} from '../lib/room.js';
import Stadium from '../pixel/Stadium.jsx';
import Cutscene from '../pixel/Cutscene.jsx';
import Battle from './Battle.jsx';
import Result from './Result.jsx';
import './room.css';

const SENSOR_LABEL = {
  off: '흔들기 준비',
  ready: '준비 완료 ✓',
  denied: '권한 거부됨 (연타로 참여)',
  none: '센서 없음 (연타로 참여)',
};

export default function Room() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const team = getTeam();
  const counts = usePresenceCounts(gameId);
  const { phase, battle, now, objectionCount, objectionLeftMs } = useBattlePhase(gameId);
  const battleId = battle && battle.state === 'cutscene' ? battle.id : null;
  const { totals, list } = useShakeScores(gameId, battleId);

  const [sensor, setSensor] = useState('off'); // off | ready | denied | none
  const [myCount, setMyCount] = useState(0);

  const countRef = useRef(0);
  const sentRef = useRef(-1);
  const battleRef = useRef(null);
  battleRef.current = battle;

  const valid = Boolean(game && team && game.teams[team]);

  useEffect(() => {
    if (!valid) return undefined;
    return joinRoom(gameId, { uid: getUid(), team, nickname: getNickname() });
  }, [gameId, team, valid]);

  // 새 배틀이 시작되면 내 카운트 초기화
  useEffect(() => {
    countRef.current = 0;
    sentRef.current = -1;
    setMyCount(0);
  }, [battleId]);

  // 배틀 도중 새로고침/재입장하면 서버에 저장된 내 점수에서 이어간다
  useEffect(() => {
    if (!battleId) return;
    const me = list.find((p) => p.uid === getUid());
    if (me && (me.count || 0) > countRef.current) {
      countRef.current = me.count;
      sentRef.current = me.count;
      setMyCount(me.count);
    }
  }, [list, battleId]);

  // 안드로이드 등 권한 팝업이 없는 기기는 자동으로 준비 (iOS는 버튼을 눌러야 한다)
  useEffect(() => {
    if (typeof DeviceMotionEvent === 'undefined') setSensor('none');
    else if (typeof DeviceMotionEvent.requestPermission !== 'function') setSensor('ready');
  }, []);

  // 흔들기 1회 = +1. 배틀 시간(startAt~endAt) 안에서만 센다 (서버 시각 기준)
  const addShake = useCallback(() => {
    const b = battleRef.current;
    if (!b || b.state !== 'cutscene') return;
    const t = serverNow();
    if (t < b.startAt || t >= b.endAt) return;
    countRef.current += 1;
    setMyCount(countRef.current);
    vibrate(HAPTIC.shake); // 흔들 때마다 짧게 "웅"
  }, []);

  // 배틀이 끝나 결과로 넘어가는 순간 크게 한 번 (중간에 들어온 폰은 울리지 않는다)
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current === 'battle' && phase === 'result') vibrate(HAPTIC.end);
    prevPhase.current = phase;
  }, [phase]);

  // 센서 감지
  useEffect(() => {
    if (sensor !== 'ready') return undefined;
    return startShake(addShake, () => setSensor('none'));
  }, [sensor, addShake]);

  // 배틀 중 300ms마다 내 점수 저장, 끝날 때 마지막으로 한 번 더 저장
  useEffect(() => {
    if (phase !== 'battle' || !battleId || !valid) return undefined;
    const flush = () => {
      if (countRef.current === sentRef.current) return;
      sentRef.current = countRef.current;
      setMyShake(gameId, battleId, getUid(), {
        team,
        nickname: getNickname(),
        count: countRef.current,
      }).catch((e) => {
        console.error('점수 저장 실패', e);
        showToast('점수 저장 실패! 계속 흔들어요');
        sentRef.current = -1;
      });
    };
    const t = setInterval(flush, SCORE_FLUSH_MS);
    return () => {
      clearInterval(t);
      flush();
    };
  }, [phase, battleId, gameId, team, valid]);

  // 팀을 아직 안 골랐거나 없는 경기면 팀 선택으로 보낸다.
  if (!valid) return <Navigate to={game ? `/game/${gameId}` : '/sports'} replace />;

  const entries = Object.entries(game.teams);

  const objection = () => {
    addObjection(gameId, getUid(), team).catch((e) => {
      console.error('이의 있음 실패', e);
      showToast('연결 실패! 다시 눌러주세요');
    });
  };

  // iOS 권한 팝업은 버튼 클릭 핸들러 안에서 요청해야 한다
  const prepareShake = async () => {
    const res = await requestShakePermission();
    setSensor(res === 'granted' ? 'ready' : res === 'denied' ? 'denied' : 'none');
  };

  const secLeft = (ms) => Math.max(0, Math.ceil(ms / 1000));

  return (
    <div className="screen">
      <Stadium />
      <h2 className="room-title">{entries.map(([, t]) => t.name).join(' vs ')}</h2>
      <div className="presence">
        {entries.map(([id, t]) => (
          <span key={id} className="presence-team" style={{ background: t.color }}>
            {t.name} {counts[id] || 0}명
          </span>
        ))}
      </div>

      {phase === 'idle' && (
        <div className="idle">
          <button className="px-btn objection-btn" onClick={objection}>
            이의 있음!
          </button>
          <p className="gauge-text">
            {Math.min(objectionCount, OBJECTION_THRESHOLD)} / {OBJECTION_THRESHOLD}
          </p>
          <div className="timebar">
            <div
              className="timebar-fill"
              style={{ width: `${(objectionLeftMs / OBJECTION_WINDOW_MS) * 100}%` }}
            />
          </div>
        </div>
      )}

      {phase === 'cutscene' && <Cutscene game={game} team={team} battle={battle} />}
      {phase === 'battle' && (
        <Battle
          game={game}
          team={team}
          battle={battle}
          now={now}
          myCount={myCount}
          totals={totals}
          sensorOk={sensor === 'ready'}
          onTap={addShake}
        />
      )}
      {phase === 'result' && (
        <Result
          game={game}
          team={team}
          battle={battle}
          now={now}
          totals={totals}
          list={list}
          myCount={myCount}
        />
      )}

      <button className="px-btn ready-btn" disabled={sensor !== 'off'} onClick={prepareShake}>
        {SENSOR_LABEL[sensor]}
      </button>

      <p className="me">
        나: {getNickname()} ({game.teams[team].name})
      </p>
    </div>
  );
}
