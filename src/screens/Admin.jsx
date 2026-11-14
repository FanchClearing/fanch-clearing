import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { showToast } from '../lib/toast.js';
import {
  OBJECTION_THRESHOLD,
  resetBattle,
  setBattleDuration,
  startBattle,
  subscribeBattleDuration,
  useBattlePhase,
  usePresenceCounts,
  useShakeScores,
} from '../lib/room.js';
import './admin.css';

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 60];

// 운영자 화면 (UI 시안의 "운영자 화면"을 우리 상태 흐름에 맞춰 옮긴 것)
// 꾸미지 않고, 잘못 누르지 않는 것이 우선: 지금 누를 수 있는 버튼만 노랑, 나머지는 회색.
export default function Admin() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const counts = usePresenceCounts(gameId);
  const { phase, battle, now, objectionCount } = useBattlePhase(gameId);
  const battleId = battle && battle.state === 'cutscene' ? battle.id : null;
  const { totals } = useShakeScores(gameId, battleId);
  const [battleMs, setBattleMs] = useState(10000);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeBattleDuration(gameId, setBattleMs), [gameId]);

  if (!game) return <div className="screen">없는 경기입니다</div>;

  const [aId, bId] = Object.keys(game.teams);
  const A = game.teams[aId];
  const B = game.teams[bId];
  const a = totals[aId] || 0;
  const b = totals[bId] || 0;
  // 한쪽이 사라지지 않도록 15%~85% 사이로만 움직인다
  const ratio = a + b === 0 ? 50 : Math.min(85, Math.max(15, (a / (a + b)) * 100));
  const sec = (ms) => Math.max(0, Math.ceil(ms / 1000));

  const statusText = {
    idle: '대기 중',
    cutscene: '컷신 재생 중',
    battle: `배틀 진행 중 ${battle ? sec(battle.endAt - now) : 0}초`,
    result: `결과 발표 중 ${battle ? sec(battle.endAt + 15000 - now) : 0}초`,
  }[phase];

  const run = async (fn, failMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.error(failMsg, e);
      showToast(failMsg);
    } finally {
      setBusy(false);
    }
  };

  const can = {
    start: phase === 'idle',
    next: phase === 'result',
  };

  return (
    <div className="screen admin">
      <h2 className="admin-cap">운영자 화면 · {A.name} vs {B.name}</h2>

      <div className="admin-now">{statusText}</div>

      <table className="admin-table">
        <thead>
          <tr>
            <th />
            <th style={{ color: A.color === '#131230' ? '#fff' : A.color }}>A {A.name}</th>
            <th style={{ color: B.color === '#131230' ? '#fff' : B.color }}>B {B.name}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>인원</td>
            <td>{counts[aId] || 0}</td>
            <td>{counts[bId] || 0}</td>
          </tr>
          <tr>
            <td>배틀 점수</td>
            <td>{a}</td>
            <td>{b}</td>
          </tr>
          <tr>
            <td>이의 있음</td>
            <td colSpan={2}>
              {Math.min(objectionCount, OBJECTION_THRESHOLD)} / {OBJECTION_THRESHOLD}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="admin-tug">
        <div className="admin-tug-a" style={{ width: `${ratio}%`, background: A.color }}>
          <span>A</span>
        </div>
        <div className="admin-tug-b" style={{ background: B.color }}>
          <span>B</span>
        </div>
      </div>

      <div className="admin-keys">
        <button
          className="admin-btn"
          disabled={!can.start || busy}
          onClick={() => run(() => startBattle(gameId), '시작 실패! 다시 눌러주세요')}
        >
          강제 판정 시작
        </button>
        <button
          className="admin-btn"
          disabled={!can.next || busy}
          onClick={() => run(() => resetBattle(gameId, battle.id), '리셋 실패! 다시 눌러주세요')}
        >
          다음 판정
        </button>
        <label className="admin-duration">
          <span>배틀 시간 (다음 배틀부터)</span>
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
  );
}
