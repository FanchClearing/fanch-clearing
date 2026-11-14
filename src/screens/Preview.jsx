import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { GAMES } from '../data/games.js';
import { serverNow } from '../lib/serverTime.js';
import Cutscene from '../pixel/Cutscene.jsx';
import Stadium from '../pixel/Stadium.jsx';
import Battle from './Battle.jsx';
import Cheer from './Cheer.jsx';
import Result from './Result.jsx';
import { CheerParticles, TAUNT_KINDS } from '../pixel/Effects.jsx';
import './result.css';
import './room.css';
import './cheer.css';

// 평소 응원 화면 미리보기: [응원!] 버튼(또는 키보드 아무 키)으로 응원 점수를 올려 본다
export function PreviewCheer() {
  const game = GAMES[0];
  const [count, setCount] = useState(0);
  const [opp, setOpp] = useState(0);
  const auto = new URLSearchParams(window.location.search).has('auto'); // ?auto=1 이면 저절로 응원

  useEffect(() => {
    const t = setInterval(() => {
      setOpp((n) => n + Math.floor(Math.random() * 3));
      if (auto) setCount((n) => n + 1);
    }, 150);
    const key = () => setCount((n) => n + 1);
    window.addEventListener('keydown', key);
    return () => {
      clearInterval(t);
      window.removeEventListener('keydown', key);
    };
  }, []);

  return (
    <div className="screen">
      <Stadium tint={game.teams.lg.color} dim={0.06} />
      <h2 className="room-title">LG vs 한화</h2>
      <Cheer
        game={game}
        team="lg"
        totals={{ lg: count, hh: opp }}
        counts={{ total: 21, lg: 12, hh: 9 }}
        myCount={count}
        sensorOk={false}
        onTap={() => setCount((n) => n + 1)}
        objection={
          <div className="objection-panel">
            <button className="px-btn objection-btn small">이의 있음!</button>
            <p className="gauge-text">이의 있음 1 / 3</p>
          </div>
        }
      />
    </div>
  );
}

// 결과 화면 + 이긴 팀 [메롱] 놀리기 미리보기 (이긴 팀 = LG). ?auto=1 이면 저절로 연타
export function PreviewTaunt() {
  const game = GAMES[0];
  const [count, setCount] = useState(0);
  const [now] = useState(() => serverNow());
  const auto = new URLSearchParams(window.location.search).has('auto');

  useEffect(() => {
    if (!auto) return undefined;
    const t = setInterval(() => setCount((n) => n + 1), 120);
    return () => clearInterval(t);
  }, [auto]);

  return (
    <div className="screen">
      <Stadium tint={game.teams.lg.color} dim={0.06} />
      <h2 className="room-title">LG vs 한화</h2>
      <Result
        game={game}
        team="lg"
        battle={{ id: 'preview', endAt: now - 2000 }}
        now={now}
        totals={{ lg: 41, hh: 26 }}
        list={[{ uid: 'a', team: 'lg', nickname: '흔들왕123', count: 22 }, { uid: 'b', team: 'hh', nickname: '한화팬', count: 14 }]}
        myCount={19}
      />
      <CheerParticles hit={count} color={game.teams.lg.color} kinds={TAUNT_KINDS} scale={1.3} />
      <div className="taunt-bar">
        <button className="px-btn taunt-btn" onPointerDown={() => setCount((n) => n + 1)}>
          메롱~ <small>{count}</small>
        </button>
      </div>
    </div>
  );
}

// 배틀 이펙트 미리보기: [연타!] 버튼(또는 키보드 아무 키)을 누를 때마다 +1, 상대 점수는 자동으로 오른다
export function PreviewBattle() {
  const game = GAMES[0];
  const [endAt] = useState(() => serverNow() + 30000);
  const [count, setCount] = useState(0);
  const [opp, setOpp] = useState(0);
  const [now, setNow] = useState(() => serverNow());
  const auto = new URLSearchParams(window.location.search).has('auto'); // ?auto=1 이면 저절로 연타

  useEffect(() => {
    const t = setInterval(() => {
      setNow(serverNow());
      setOpp((n) => n + Math.floor(Math.random() * 3));
      if (auto) setCount((n) => n + 1);
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
