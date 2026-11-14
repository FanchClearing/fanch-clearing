import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getGame } from '../data/games.js';
import {
  OBJECTION_WINDOW_MS,
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
import Result from './Result.jsx';
import './room.css';
import './battle.css';
import './host.css';

const safe = (c) => (c === '#131230' ? '#ffffff' : c);

// 전광판(큰 화면, 가로). 보여주기만 하고, 조작은 운영자 화면(/admin/:gameId)에서 한다.
export default function Host() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const counts = usePresenceCounts(gameId); // 운영자 가감이 반영된 표시 인원
  const { phase, battle, now, objectionCount, objectionLeftMs, threshold, gameState, gameReady, runId } =
    useBattlePhase(gameId);
  const gameBanner = useGameBanner(gameState, gameReady); // 경기 시작!/종료! 배너
  const battleId = battle && battle.state === 'cutscene' ? battle.id : null;
  const { totals, list } = useShakeScores(gameId, battleId);
  const { totals: cheer } = useCheerScores(gameId, runId);
  const { total: tauntTotal } = useTauntScores(gameId, battleId, null); // 이긴 팀이 놀린 횟수

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

  const qr = (size) => (
    <div className="qr-box">
      <QRCodeSVG value={joinUrl} size={size} bgColor="#ffffff" fgColor="#1a1c2c" />
      <p>QR 찍고 참전하기</p>
      <small>{joinUrl}</small>
    </div>
  );

  return (
    <div className="screen wide host">
      <SoundToggle />
      <GameBanner banner={gameBanner} />
      <header className="host-head">
        <h1>{A.name} vs {B.name}</h1>
        <div className="host-presence">
          <span style={{ background: A.color }}>A {A.name} {counts[aId] || 0}명</span>
          <span style={{ background: B.color }}>B {B.name} {counts[bId] || 0}명</span>
        </div>
      </header>

      {gameState === 'wait' && (
        <div className="host-idle">
          {qr(320)}
          <div className="host-side">
            <p className="host-gauge">곧 시작합니다</p>
            <p>QR을 찍고 팀을 고르세요</p>
          </div>
        </div>
      )}

      {live && phase === 'idle' && (
        <div className="host-cheer">
          <div className="host-badge">응원 중</div>
          <PushBar scoreA={cheerA} scoreB={cheerB} colorA={A.color} colorB={B.color} height={72} />
          <div className="host-totals">
            <span style={{ color: safe(A.color) }}>A {A.name} {cheerA}</span>
            <span style={{ color: safe(B.color) }}>{cheerB} {B.name} B</span>
          </div>
          <div className="host-bottom">
            <div>
              <p className="host-gauge">
                이의 있음 {Math.min(objectionCount, threshold)} / {threshold}
              </p>
              <div className="timebar">
                <div
                  className="timebar-fill"
                  style={{ width: `${(objectionLeftMs / OBJECTION_WINDOW_MS) * 100}%` }}
                />
              </div>
            </div>
            {qr(160)}
          </div>
        </div>
      )}

      {live && phase === 'cutscene' && (
        <Cutscene game={game} team={aId} battle={battle} fullscreen={false} />
      )}

      {live && phase === 'battle' && (
        <div className="host-battle">
          <div className="host-timer">{sec(battle.endAt - now)}</div>
          <PushBar
            scoreA={totals[aId] || 0}
            scoreB={totals[bId] || 0}
            colorA={A.color}
            colorB={B.color}
            height={72}
          />
          <div className="host-totals">
            <span style={{ color: safe(A.color) }}>A {A.name} {totals[aId] || 0}</span>
            <span style={{ color: safe(B.color) }}>{totals[bId] || 0} {B.name} B</span>
          </div>
        </div>
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
          <div className="host-badge">경기 종료</div>
          <p className="host-gauge">
            {winner ? `${winner.name} 팬 승리!` : '무승부'}
          </p>
          <PushBar scoreA={cheerA} scoreB={cheerB} colorA={A.color} colorB={B.color} height={72} />
          <div className="host-totals">
            <span style={{ color: safe(A.color) }}>A {A.name} {cheerA}</span>
            <span style={{ color: safe(B.color) }}>{cheerB} {B.name} B</span>
          </div>
        </div>
      )}
    </div>
  );
}
