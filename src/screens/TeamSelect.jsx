import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { getNickname, setNickname, setTeam } from '../lib/identity.js';
import './select.css';

export default function TeamSelect() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const game = getGame(gameId);
  const [nick, setNick] = useState('');
  const [picked, setPicked] = useState(null);

  if (!game) {
    return (
      <div className="screen center">
        <p>없는 경기입니다</p>
        <button className="px-btn" onClick={() => navigate('/sports')}>돌아가기</button>
      </div>
    );
  }

  const enter = () => {
    if (!picked) return;
    if (nick.trim()) setNickname(nick);
    else getNickname(); // 비었으면 기존/자동 닉네임 유지
    setTeam(picked);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    // 아이폰: 닉네임 입력 기록이 남은 페이지에서 폰을 흔들면 "실행 취소" 창이 뜬다.
    // 입장할 때 화면 이동 대신 페이지를 새로 불러와서 입력 기록이 없는 깨끗한 상태로 게임 화면을 연다.
    // (아이디·닉네임·팀은 저장돼 있어서 그대로 이어진다)
    window.location.assign(`/room/${gameId}`);
  };

  return (
    <div className="screen">
      <h2 className="title">팀 선택</h2>
      <div className="team-pick">
        {Object.entries(game.teams).map(([id, t]) => (
          <button
            key={id}
            className={'px-btn team-btn' + (picked === id ? ' picked' : '')}
            style={{ background: t.color, color: '#fff' }}
            onClick={() => setPicked(id)}
          >
            {t.name}
          </button>
        ))}
      </div>
      <input
        className="nick"
        placeholder="닉네임 (비우면 자동)"
        maxLength={8}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        value={nick}
        onChange={(e) => setNick(e.target.value)}
      />
      <button className="px-btn big" disabled={!picked} onClick={enter}>
        입장
      </button>
    </div>
  );
}
