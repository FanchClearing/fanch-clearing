import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { getGame } from '../data/games.js';
import {
  OBJECTION_THRESHOLD,
  OBJECTION_WINDOW_MS,
  resetBattle,
  setBattleDuration,
  startBattle,
  subscribeBattleDuration,
  useBattlePhase,
  usePresenceCounts,
  useShakeScores,
} from '../lib/room.js';
import Result from './Result.jsx';
import './room.css';
import './battle.css';
import './host.css';

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 60];

export default function Host() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const counts = usePresenceCounts(gameId);
  const { phase, battle, now, objectionCount, objectionLeftMs } = useBattlePhase(gameId);
  const battleId = battle && battle.state === 'cutscene' ? battle.id : null;
  const { totals, list } = useShakeScores(gameId, battleId);
  const [battleMs, setBattleMs] = useState(10000);
  const [toast, setToast] = useState('');

  useEffect(() => subscribeBattleDuration(gameId, setBattleMs), [gameId]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!game) return <div className="screen wide">없는 경기입니다</div>;

  const run = (fn, msg) => fn().catch((e) => {
    console.error(msg, e);
    setToast(msg);
  });

  const joinUrl = `${window.location.origin}/game/${gameId}`;
  const ids = Object.keys(game.teams);
  const [aId, bId] = ids;
  const a = totals[aId] || 0;
  const b = totals[bId] || 0;
  const ratio = a + b === 0 ? 50 : (a / (a + b)) * 100;
  const secLeft = (ms) => Math.max(0, Math.ceil(ms / 1000));

  return (
    <div className="screen wide host">
      <header className="host-head">
        <h1>{ids.map((id) => game.teams[id].name).join(' vs ')}</h1>
        <div className="host-presence">
          {ids.map((id) => (
            <span key={id} style={{ background: game.teams[id].color }}>
              {game.teams[id].name} {counts[id] || 0}명
            </span>
          ))}
        </div>
      </header>

      {phase === 'idle' && (
        <div className="host-idle">
          <div className="qr-box">
            <QRCodeSVG value={joinUrl} size={320} bgColor="#ffffff" fgColor="#1a1c2c" />
            <p>QR 찍고 참전하기</p>
            <small>{joinUrl}</small>
          </div>
          <div className="host-side">
            <p className="host-gauge">
              이의 있음 {Math.min(objectionCount, OBJECTION_THRESHOLD)} / {OBJECTION_THRESHOLD}
            </p>
            <div className="timebar">
              <div
                className="timebar-fill"
                style={{ width: `${(objectionLeftMs / OBJECTION_WINDOW_MS) * 100}%` }}
              />
            </div>
            <button
              className="px-btn host-btn"
              onClick={() => run(() => startBattle(gameId), '시작 실패')}
            >
              강제 판정 시작
            </button>
            <label className="duration">
              배틀 시간
              <select
                value={Math.round(battleMs / 1000)}
                onChange={(e) =>
                  run(() => setBattleDuration(gameId, Number(e.target.value) * 1000), '설정 실패')
                }
              >
                {DURATION_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}초
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {phase === 'cutscene' && <p className="host-big">컷신 {secLeft(battle.startAt - now)}</p>}

      {phase === 'battle' && (
        <div className="host-battle">
          <div className="host-timer">{secLeft(battle.endAt - now)}</div>
          <div className="tug big-tug">
            <div className="tug-mine" style={{ width: `${ratio}%`, background: game.teams[aId].color }} />
            <div className="tug-opp" style={{ background: game.teams[bId].color }} />
          </div>
          <div className="host-totals">
            <span>{game.teams[aId].name} {a}</span>
            <span>{b} {game.teams[bId].name}</span>
          </div>
        </div>
      )}

      {phase === 'result' && (
        <div className="host-result">
          <Result game={game} team={null} battle={battle} now={now} totals={totals} list={list} myCount={0} />
          <button
            className="px-btn host-btn"
            onClick={() => run(() => resetBattle(gameId, battle.id), '리셋 실패')}
          >
            다음 판정
          </button>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
