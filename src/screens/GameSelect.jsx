import { useNavigate, useParams } from 'react-router-dom';
import { GAMES } from '../data/games.js';
import './select.css';

export default function GameSelect() {
  const { sport } = useParams();
  const navigate = useNavigate();
  const games = GAMES.filter((g) => g.sport === sport);

  return (
    <div className="screen">
      <h2 className="title">경기 선택</h2>
      {games.length === 0 && <p className="note">경기가 없습니다</p>}
      {games.map((g) => {
        const [a, b] = Object.values(g.teams);
        const live = g.status === 'live';
        return (
          <button
            key={g.id}
            className="px-btn game-card"
            disabled={!live}
            onClick={() => navigate(`/game/${g.id}`)}
          >
            <span className="team-block" style={{ background: a.color }}>{a.name}</span>
            <span className="vs">vs</span>
            <span className="team-block" style={{ background: b.color }}>{b.name}</span>
            <span className={live ? 'status live' : 'status'}>{live ? 'LIVE' : '예정'}</span>
          </button>
        );
      })}
    </div>
  );
}
