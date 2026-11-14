import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { getNickname, getTeam, getUid } from '../lib/identity.js';
import {
  OBJECTION_THRESHOLD,
  OBJECTION_WINDOW_MS,
  addObjection,
  joinRoom,
  useBattlePhase,
  usePresenceCounts,
} from '../lib/room.js';
import './room.css';

export default function Room() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const team = getTeam();
  const counts = usePresenceCounts(gameId);
  const { phase, battle, now, objectionCount, objectionLeftMs } = useBattlePhase(gameId);
  const [toast, setToast] = useState('');

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

  // 팀을 아직 안 골랐거나 없는 경기면 팀 선택으로 보낸다.
  if (!valid) return <Navigate to={game ? `/game/${gameId}` : '/sports'} replace />;

  const entries = Object.entries(game.teams);

  const objection = () => {
    addObjection(gameId, getUid(), team).catch((e) => {
      console.error('이의 있음 실패', e);
      setToast('연결 실패! 다시 눌러주세요');
    });
  };

  const secLeft = (ms) => Math.max(0, Math.ceil(ms / 1000));

  return (
    <div className="screen">
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

      {/* T4 임시 화면: 컷신/배틀/결과는 이후 작업에서 교체 */}
      {phase === 'cutscene' && (
        <p className="temp">컷신 {secLeft(battle.startAt - now)}</p>
      )}
      {phase === 'battle' && (
        <p className="temp">배틀 {secLeft(battle.endAt - now)}</p>
      )}
      {phase === 'result' && (
        <p className="temp">결과 {secLeft(battle.endAt + 15000 - now)}</p>
      )}

      <p className="me">
        나: {getNickname()} ({game.teams[team].name})
      </p>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
