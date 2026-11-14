import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { getNickname, getTeam, getUid } from '../lib/identity.js';
import { joinRoom, usePresenceCounts } from '../lib/room.js';
import './room.css';

export default function Room() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const team = getTeam();
  const counts = usePresenceCounts(gameId);

  const valid = Boolean(game && team && game.teams[team]);

  useEffect(() => {
    if (!valid) return undefined;
    return joinRoom(gameId, { uid: getUid(), team, nickname: getNickname() });
  }, [gameId, team, valid]);

  // 팀을 아직 안 골랐거나 없는 경기면 팀 선택으로 보낸다.
  if (!valid) return <Navigate to={game ? `/game/${gameId}` : '/sports'} replace />;

  const entries = Object.entries(game.teams);

  return (
    <div className="screen">
      <h2 className="room-title">
        {entries.map(([, t]) => t.name).join(' vs ')}
      </h2>
      <div className="presence">
        {entries.map(([id, t]) => (
          <span key={id} className="presence-team" style={{ background: t.color }}>
            {t.name} {counts[id] || 0}명
          </span>
        ))}
      </div>
      <p className="me">
        나: {getNickname()} ({game.teams[team].name})
      </p>
    </div>
  );
}
