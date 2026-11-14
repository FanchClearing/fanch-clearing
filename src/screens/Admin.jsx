import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getGame } from '../data/games.js';
import { ADMIN_LIMITS, adminActions, subscribeAdminStatus } from '../lib/adminApi.js';
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
  const battling = status.phase !== 'idle';

  let statusText = '경기 시작 전';
  if (status.gameState === 'end') statusText = '경기 종료';
  if (status.gameState === 'live') {
    statusText = {
      idle: '경기 중 · 응원 중',
      cutscene: '벤치클리어링 컷신',
      battle: `벤치클리어링 배틀 ${sec}초`,
      result: `판정 결과 발표 ${sec}초`,
    }[status.phase];
  }

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

  const { THRESHOLD_MIN, THRESHOLD_MAX, ADJUST_MIN, ADJUST_MAX } = ADMIN_LIMITS;
  const th = status.objections.threshold;

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
            <td>응원 점수</td>
            <td>{A.cheer}</td>
            <td>{B.cheer}</td>
          </tr>
          <tr>
            <td>배틀 점수</td>
            <td>{A.score}</td>
            <td>{B.score}</td>
          </tr>
          <tr>
            <td>표시 인원</td>
            <td>{A.count}</td>
            <td>{B.count}</td>
          </tr>
          <tr>
            <td>실제 접속</td>
            <td>{A.realCount}</td>
            <td>{B.realCount}</td>
          </tr>
          <tr>
            <td>이의 있음</td>
            <td colSpan={2}>
              {Math.min(status.objections.count, th)} / {th}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="admin-tug">
        {battling ? (
          <PushBar scoreA={A.score} scoreB={B.score} colorA={A.color} colorB={B.color} />
        ) : (
          <PushBar scoreA={A.cheer} scoreB={B.cheer} colorA={A.color} colorB={B.color} />
        )}
      </div>

      <div className="admin-keys">
        <button
          className="admin-btn"
          disabled={!status.can.startGame || busy}
          onClick={() => run(() => adminActions.startGame(gameId), '시작 실패! 다시 눌러주세요')}
        >
          경기 시작
        </button>
        <button
          className="admin-btn"
          disabled={!status.can.startBattle || busy}
          onClick={() => run(() => adminActions.startBattle(gameId), '시작 실패! 다시 눌러주세요')}
        >
          벤치클리어링 시작
        </button>
        <button
          className="admin-btn"
          disabled={!status.can.next || busy}
          onClick={() => run(() => adminActions.next(gameId), '리셋 실패! 다시 눌러주세요')}
        >
          다음 판정
        </button>
        <button
          className="admin-btn"
          disabled={!status.can.endGame || busy}
          onClick={() => {
            if (window.confirm('경기를 종료할까요?')) {
              run(() => adminActions.endGame(gameId), '종료 실패! 다시 눌러주세요');
            }
          }}
        >
          경기 종료
        </button>
      </div>

      <h3 className="admin-sub">인원수 조작</h3>
      <div className="admin-row">
        <span>이의 있음 발동 기준</span>
        <Stepper
          value={th}
          min={THRESHOLD_MIN}
          max={THRESHOLD_MAX}
          suffix="명"
          disabled={busy}
          onChange={(v) => run(() => adminActions.setThreshold(gameId, v), '설정 실패')}
        />
      </div>
      {[[aId, A, 'A'], [bId, B, 'B']].map(([id, t, letter]) => (
        <div className="admin-row" key={id}>
          <span style={{ color: safe(t.color) }}>
            {letter} {t.name} 표시 인원 {t.count}명
          </span>
          <Stepper
            value={t.adjust}
            min={ADJUST_MIN}
            max={ADJUST_MAX}
            plus
            disabled={busy}
            onChange={(v) => run(() => adminActions.setCountAdjust(gameId, id, v), '설정 실패')}
          />
        </div>
      ))}
      <p className="admin-hint">표시 인원 = 실제 접속자 + 가감값 (연출용, 실제 접속자 수는 그대로)</p>

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
  );
}

// − 값 + 버튼
function Stepper({ value, min, max, onChange, disabled, suffix = '', plus = false }) {
  const label = `${plus && value > 0 ? '+' : ''}${value}${suffix}`;
  return (
    <span className="stepper">
      <button disabled={disabled || value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <b>{label}</b>
      <button disabled={disabled || value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </span>
  );
}
