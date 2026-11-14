import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GAMES } from '../data/games.js';
import { serverNow } from '../lib/serverTime.js';
import Cutscene from '../pixel/Cutscene.jsx';
import Battle from './Battle.jsx';

// 배틀 이펙트 미리보기: [연타!] 버튼(또는 키보드 아무 키)을 누를 때마다 +1, 상대 점수는 자동으로 오른다
export function PreviewBattle() {
  const game = GAMES[0];
  const [endAt] = useState(() => serverNow() + 30000);
  const [count, setCount] = useState(0);
  const [opp, setOpp] = useState(0);
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    const t = setInterval(() => {
      setNow(serverNow());
      setOpp((n) => n + Math.floor(Math.random() * 3));
    }, 100);
    const key = () => setCount((n) => n + 1);
    window.addEventListener('keydown', key);
    return () => {
      clearInterval(t);
      window.removeEventListener('keydown', key);
    };
  }, []);

  return (
    <Battle
      game={game}
      team="lg"
      battle={{ endAt }}
      now={now}
      myCount={count}
      totals={{ lg: count, hh: opp }}
      sensorOk={false}
      onTap={() => setCount((n) => n + 1)}
    />
  );
}

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
