import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { GAMES } from '../data/games.js';
import { serverNow } from '../lib/serverTime.js';
import Cutscene from '../pixel/Cutscene.jsx';

// 개발 전용 미리보기 (배포 빌드에서는 라우트가 빠진다). 서버 없이 컷신을 확인한다.
export default function Preview() {
  const { teamId } = useParams();
  const game = GAMES[0];
  const team = game.teams[teamId] ? teamId : Object.keys(game.teams)[0];
  const [run, setRun] = useState(() => ({ key: 1, cutsceneAt: serverNow() }));

  const replay = () => setRun((r) => ({ key: r.key + 1, cutsceneAt: serverNow() }));

  return (
    <div className="screen">
      <p>컷신 미리보기 ({game.teams[team].name} 시점) — 5초</p>
      <button className="px-btn" onClick={replay}>다시 재생</button>{' '}
      <a href="/preview/cutscene/hh" style={{ color: '#ffcd75' }}>한화</a>{' / '}
      <a href="/preview/cutscene/lg" style={{ color: '#ffcd75' }}>LG</a>
      <Cutscene
        key={run.key}
        game={game}
        team={team}
        battle={{ cutsceneAt: run.cutsceneAt }}
        fullscreen={false}
      />
    </div>
  );
}
