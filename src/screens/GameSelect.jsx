import { useNavigate, useParams } from 'react-router-dom';
import { GAMES } from '../data/games.js';
import { usePresenceCounts } from '../lib/room.js';
import './select.css';

function GameCard({ game }) {
  const navigate = useNavigate();
  const counts = usePresenceCounts(game.id);
  const [a, b] = Object.values(game.teams);
  const live = game.status === 'live';
  return (
    <button
      className="px-btn game-card"
      disabled={!live}
      onClick={() => navigate(`/game/${game.id}`)}
    >
      <span className="team-block" style={{ background: a.color }}>{a.name}</span>
      <span className="vs">vs</span>
      <span className="team-block" style={{ background: b.color }}>{b.name}</span>
      <span className={live ? 'status live' : 'status'}>{live ? 'LIVE' : '예정'}</span>
      <span className="status">{counts.total}명</span>
    </button>
  );
}

export default function GameSelect() {
  const { sport } = useParams();
  const games = GAMES.filter((g) => g.sport === sport);

  return (
    <div className="screen">
      <h2 className="title">경기 선택</h2>
      {games.length === 0 && <p className="note">경기가 없습니다</p>}
      {games.map((g) => (
        <GameCard key={g.id} game={g} />
      ))}
    </div>
  );
}
