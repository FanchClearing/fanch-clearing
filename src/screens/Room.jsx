import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { getNickname, getTeam, getUid } from '../lib/identity.js';
import { serverNow } from '../lib/serverTime.js';
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

  const [toast, setToast] = useState('');
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

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  // 새 배틀이 시작되면 내 카운트 초기화
  useEffect(() => {
    countRef.current = 0;
    sentRef.current = -1;
    setMyCount(0);
  }, [battleId]);

  // 흔들기 1회 = +1. 배틀 시간(startAt~endAt) 안에서만 센다 (서버 시각 기준)
  const addShake = useCallback(() => {
    const b = battleRef.current;
    if (!b || b.state !== 'cutscene') return;
    const t = serverNow();
    if (t < b.startAt || t >= b.endAt) return;
    countRef.current += 1;
    setMyCount(countRef.current);
  }, []);

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
      setToast('연결 실패! 다시 눌러주세요');
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
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
