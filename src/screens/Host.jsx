import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getGame } from '../data/games.js';
import { subscribeAdminStatus } from '../lib/adminApi.js';
import {
  OBJECTION_WINDOW_MS,
  subscribePresence,
  useBattlePhase,
  useCheerScores,
  usePresenceCounts,
  useShakeScores,
  useTauntScores,
} from '../lib/room.js';
import Cutscene from '../pixel/Cutscene.jsx';
import SoundToggle from '../pixel/SoundToggle.jsx';
import GameBanner, { useGameBanner } from '../pixel/GameBanner.jsx';
import { sceneFor, useSceneSound } from '../lib/sound.js';
import PushBar from '../pixel/PushBar.jsx';
import { CheerParticles, TAUNT_KINDS } from '../pixel/Effects.jsx';
import AdminControls from './AdminControls.jsx';
import Result from './Result.jsx';
import './room.css';
import './battle.css';
import './host.css';

const safe = (c) => (c === '#131230' ? '#ffffff' : c);

const fmtTime = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

/** 새로 입장한 사람 알림 목록 (화면을 연 뒤의 입장만. 처음 값은 기준으로만 쓴다) */
function usePresenceFeed(gameId) {
  const [feed, setFeed] = useState([]);
  const known = useRef(null);
  useEffect(
    () =>
      subscribePresence(gameId, (users) => {
        const ids = Object.keys(users);
        if (known.current === null) {
          known.current = new Set(ids);
          return;
        }
        const fresh = ids.filter((id) => !known.current.has(id));
        ids.forEach((id) => known.current.add(id));
        if (!fresh.length) return;
        const at = Date.now();
        const items = fresh.map((id) => ({ id: `${id}-${at}`, team: users[id].team, nick: users[id].nickname }));
        setFeed((f) => [...items, ...f].slice(0, 6));
      }),
    [gameId]
  );
  return feed;
}

/**
 * 벤치클리어링 배틀 중 전광판 화면. 순서: 점수(맨 위, 가장 크게) → 남은 시간(작게) → 밀어내기 바.
 * 시간이 점수보다 눈에 띄면 숫자가 점수로 오해된다는 의견이 있어서 시간은 작게 점수 아래에 둔다.
 */
export function HostBattleView({ A, B, scoreA, scoreB, secLeft }) {
  return (
    <div className="hx-battle">
      <div className="hx-teams">
        <div className="hx-team" style={{ background: A.color }}>
          <div className="hx-team-name">A {A.name}</div>
          <div className="hx-team-score">{scoreA}</div>
        </div>
        <div className="hx-team" style={{ background: B.color }}>
          <div className="hx-team-name">B {B.name}</div>
          <div className="hx-team-score">{scoreB}</div>
        </div>
      </div>
      <div className="hx-timeleft">
        남은 시간 <b>{secLeft}</b>초
      </div>
      <PushBar scoreA={scoreA} scoreB={scoreB} colorA={A.color} colorB={B.color} height={80} />
    </div>
  );
}

// 전광판(큰 화면, 가로): 경기 상황 + 운영 조작 + MVP + 입장 알림을 한 화면에 모은다.
export default function Host() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const counts = usePresenceCounts(gameId); // 운영자 가감이 반영된 표시 인원
  const { phase, battle, now, objectionCount, objectionLeftMs, threshold, gameState, gameReady, runId } =
    useBattlePhase(gameId);
  const gameBanner = useGameBanner(gameState, gameReady); // 경기 시작!/종료! 배너
  const battleId = battle && battle.state === 'cutscene' ? battle.id : null;
  const { totals, list } = useShakeScores(gameId, battleId);
  const { totals: cheer, list: cheerList } = useCheerScores(gameId, runId);
  const { total: tauntTotal } = useTauntScores(gameId, battleId, null); // 이긴 팀이 놀린 횟수
  const feed = usePresenceFeed(gameId);
  const [status, setStatus] = useState(null); // 운영 조작부용 상태

  useEffect(() => subscribeAdminStatus(gameId, setStatus), [gameId]);

  // 전광판에서도 같은 음악을 튼다 (브라우저 정책상 화면을 한 번 눌러야 시작된다)
  useSceneSound(game ? sceneFor(gameState, phase) : null);

  if (!game) return <div className="screen wide">없는 경기입니다</div>;

  const joinUrl = `${window.location.origin}/game/${gameId}`;
  const [aId, bId] = Object.keys(game.teams);
  const A = game.teams[aId];
  const B = game.teams[bId];
  const sec = (ms) => Math.max(0, Math.ceil(ms / 1000));
  const live = gameState === 'live';

  const cheerA = cheer[aId] || 0;
  const cheerB = cheer[bId] || 0;
  const winner = cheerA === cheerB ? null : cheerA > cheerB ? A : B;
  const bA = totals[aId] || 0;
  const bB = totals[bId] || 0;
  const battleWinner = bA === bB ? null : bA > bB ? A : B; // 벤치클리어링 승리 팀

  // 머리 줄: 지금 상태 배지 + 경기 시간
  let stateLabel = '경기 시작 전';
  if (gameState === 'end') stateLabel = '경기 종료';
  if (live) {
    stateLabel = {
      idle: '응원 중',
      cutscene: '벤치클리어링!',
      battle: '벤치클리어링 배틀',
      result: '판정 발표',
    }[phase];
  }
  let elapsed = null;
  if (status && status.startedAt) {
    if (gameState === 'live') elapsed = now - status.startedAt;
    else if (gameState === 'end' && status.endedAt) elapsed = status.endedAt - status.startedAt;
  }

  const qr = (size) => (
    <div className="qr-box">
      <QRCodeSVG value={joinUrl} size={size} bgColor="#ffffff" fgColor="#1a1c2c" />
      <p>QR 찍고 참전하기</p>
      <small>{joinUrl}</small>
    </div>
  );

  // 팀별 큰 점수 카드 (응원 중)
  const teamCard = (id, T, letter, score, other) => (
    <div className="hx-team" style={{ background: T.color }}>
      <div className="hx-team-name">
        {letter} {T.name}
        {score > other && <b className="hx-lead">▲ 앞서는 중</b>}
      </div>
      <div className="hx-team-score">{score}</div>
      <div className="hx-team-live">
        <i /> LIVE · 팬 {counts[id] || 0}명
      </div>
    </div>
  );

  return (
    <div className="screen wide host hx">
      <SoundToggle />
      <GameBanner banner={gameBanner} />

      <header className="hx-head">
        <h1>
          {A.name} <small>vs</small> {B.name}
        </h1>
        <span className={'hx-state' + (live ? ' on' : '')}>{stateLabel}</span>
        <div className="hx-stats">
          <span>
            경기 시간 <b>{elapsed === null ? '--:--' : fmtTime(elapsed)}</b>
          </span>
          <span>
            <i className="hx-dot" /> 접속 <b>{counts.total || 0}</b>명
          </span>
        </div>
      </header>

      <main className="hx-main">
        {gameState === 'wait' && (
          <div className="host-idle">
            {qr(340)}
            <div className="host-side">
              <p className="host-gauge">곧 시작합니다</p>
              <p>QR을 찍고 팀을 고르세요</p>
              <p className="hx-wait-count">
                지금까지 <b>{counts.total || 0}</b>명 입장
              </p>
            </div>
          </div>
        )}

        {live && phase === 'idle' && (
          <>
            <div className="hx-teams">
              {teamCard(aId, A, 'A', cheerA, cheerB)}
              {teamCard(bId, B, 'B', cheerB, cheerA)}
            </div>
            <PushBar scoreA={cheerA} scoreB={cheerB} colorA={A.color} colorB={B.color} height={80} />
            <div className="hx-lower">
              <div className="hx-obj">
                <p className="host-gauge">
                  이의 있음 {Math.min(objectionCount, threshold)} / {threshold}
                </p>
                <div className="timebar">
                  <div
                    className="timebar-fill"
                    style={{ width: `${(objectionLeftMs / OBJECTION_WINDOW_MS) * 100}%` }}
                  />
                </div>
                <small>기준 인원이 모이면 심판이 휘슬을 불고 벤치클리어링이 시작됩니다</small>
              </div>
              {qr(150)}
            </div>
          </>
        )}

        {live && phase === 'cutscene' && (
          <Cutscene game={game} team={aId} battle={battle} fullscreen={false} />
        )}

        {live && phase === 'battle' && (
          <HostBattleView A={A} B={B} scoreA={bA} scoreB={bB} secLeft={sec(battle.endAt - now)} />
        )}

        {live && phase === 'result' && battleWinner && (
          // 이긴 팀의 메롱 파티클이 전광판 화면 전체에서 올라온다
          <CheerParticles hit={tauntTotal} color={battleWinner.color} kinds={TAUNT_KINDS} scale={2.2} wide />
        )}

        {live && phase === 'result' && (
          <div className="host-result">
            <Result game={game} team={null} battle={battle} now={now} totals={totals} list={list} myCount={0} />
          </div>
        )}

        {gameState === 'end' && (
          <div className="host-battle">
            <p className="host-gauge">{winner ? `${winner.name} 팬 승리!` : '무승부'}</p>
            <div className="hx-teams">
              {teamCard(aId, A, 'A', cheerA, cheerB)}
              {teamCard(bId, B, 'B', cheerB, cheerA)}
            </div>
            <PushBar scoreA={cheerA} scoreB={cheerB} colorA={A.color} colorB={B.color} height={80} />
          </div>
        )}
      </main>

      <aside className="hx-side">
        <section className="hx-panel">
          <h3>운영 컨트롤</h3>
          <AdminControls gameId={gameId} status={status} compact />
        </section>

        <section className="hx-panel">
          <h3>응원 MVP TOP 5</h3>
          {cheerList.length === 0 && <p className="hx-empty">아직 응원 기록이 없어요</p>}
          <ol className="hx-mvp">
            {cheerList.slice(0, 5).map((p, i) => (
              <li key={p.uid}>
                <span className="hx-rank">{i + 1}</span>
                <span className="hx-dotteam" style={{ background: game.teams[p.team]?.color }} />
                <span className="hx-nick">{p.nickname}</span>
                <em>{p.count}</em>
              </li>
            ))}
          </ol>
        </section>

        <section className="hx-panel">
          <h3>실시간 입장</h3>
          {feed.length === 0 && <p className="hx-empty">새로 입장하면 여기에 떠요</p>}
          <ul className="hx-feed">
            {feed.map((f) => (
              <li key={f.id} style={{ color: safe(game.teams[f.team]?.color || '#fff') }}>
                {f.team === aId ? 'A' : 'B'}팀 팬 {f.nick} 입장!
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
