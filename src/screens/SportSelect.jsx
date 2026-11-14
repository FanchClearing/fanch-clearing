import { useNavigate } from 'react-router-dom';
import { SPORTS } from '../data/games.js';
import './select.css';

export default function SportSelect() {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <h2 className="title">종목 선택</h2>
      <div className="grid">
        {SPORTS.map((s) => (
          <button
            key={s.id}
            className="px-btn card"
            disabled={!s.enabled}
            onClick={() => navigate(`/games/${s.id}`)}
          >
            <span className="icon">{s.icon}</span>
            <span>{s.name}</span>
            {!s.enabled && <span className="badge">준비중</span>}
          </button>
        ))}
      </div>
      <p className="note">모든 종목 지원 예정</p>
    </div>
  );
}
