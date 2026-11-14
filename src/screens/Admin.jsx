import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { adminActions, subscribeAdminStatus } from '../lib/adminApi.js';
import { showToast } from '../lib/toast.js';
import PushBar from '../pixel/PushBar.jsx';
import './admin.css';

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 60];

// 운영자 화면: 로직은 전부 lib/adminApi.js를 쓴다 (이 파일은 그 API를 부르는 예제이기도 하다).
// 꾸미지 않고, 잘못 누르지 않는 것이 우선: 지금 누를 수 있는 버튼만 노랑, 나머지는 회색.
export default function Admin() {
  const { gameId } = useParams();
  const game = getGame(gameId);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeAdminStatus(gameId, setStatus), [gameId]);

  if (!game) return <div className="screen">없는 경기입니다</div>;
  if (!status) return <div className="screen">불러오는 중…</div>;

  const [aId, bId] = Object.keys(game.teams);
  const A = status.teams[aId];
  const B = status.teams[bId];
  const sec = Math.ceil(status.phaseLeftMs / 1000);
  const safe = (c) => (c === '#131230' ? '#ffffff' : c);

  const statusText = {
    idle: '대기 중',
    cutscene: '컷신 재생 중',
    battle: `배틀 진행 중 ${sec}초`,
    result: `결과 발표 중 ${sec}초`,
  }[status.phase];

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

  return (
    <div className="screen admin">
      <h2 className="admin-cap">운영자 화면 · {A.name} vs {B.name}</h2>

      <div className="admin-now">{statusText}</div>

      <table className="admin-table">
        <thead>
          <tr>
            <th />
            <th style={{ color: safe(A.color) }}>A {A.name}</th>
            <th style={{ color: safe(B.color) }}>B {B.name}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>인원</td>
            <td>{A.count}</td>
            <td>{B.count}</td>
          </tr>
          <tr>
            <td>배틀 점수</td>
            <td>{A.score}</td>
            <td>{B.score}</td>
          </tr>
          <tr>
            <td>이의 있음</td>
            <td colSpan={2}>
              {Math.min(status.objections.count, status.objections.threshold)} /{' '}
              {status.objections.threshold}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="admin-tug">
        <PushBar scoreA={A.score} scoreB={B.score} colorA={A.color} colorB={B.color} />
      </div>

      <div className="admin-keys">
        <button
          className="admin-btn"
          disabled={!status.can.start || busy}
          onClick={() => run(() => adminActions.forceStart(gameId), '시작 실패! 다시 눌러주세요')}
        >
          강제 판정 시작
        </button>
        <button
          className="admin-btn"
          disabled={!status.can.next || busy}
          onClick={() => run(() => adminActions.next(gameId), '리셋 실패! 다시 눌러주세요')}
        >
          다음 판정
        </button>
        <label className="admin-duration">
          <span>배틀 시간 (다음 배틀부터)</span>
          <select
            value={Math.round(status.battleMs / 1000)}
            onChange={(e) =>
              run(() => adminActions.setBattleSeconds(gameId, Number(e.target.value)), '설정 실패')
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
