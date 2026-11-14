import { useState } from 'react';
import { ADMIN_LIMITS, adminActions } from '../lib/adminApi.js';
import { showToast } from '../lib/toast.js';
import './admin.css';

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 60];
const safe = (c) => (c === '#131230' ? '#ffffff' : c);

/**
 * 운영 조작부 (운영자 화면과 전광판이 같이 쓴다).
 * status: subscribeAdminStatus 가 주는 값. 지금 누를 수 있는 버튼만 노랑, 나머지는 회색.
 * compact: 전광판 옆 패널용으로 버튼을 2열로 촘촘하게 배치
 */
export default function AdminControls({ gameId, status, compact = false }) {
  const [busy, setBusy] = useState(false);
  if (!status) return <p>불러오는 중…</p>;

  const [aId, bId] = Object.keys(status.teams);
  const th = status.objections.threshold;
  const { THRESHOLD_MIN, THRESHOLD_MAX, ADJUST_MIN, ADJUST_MAX } = ADMIN_LIMITS;

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
    <div className={'admin-controls' + (compact ? ' compact' : '')}>
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
      {[aId, bId].map((id, i) => {
        const t = status.teams[id];
        return (
          <div className="admin-row" key={id}>
            <span style={{ color: safe(t.color) }}>
              {i === 0 ? 'A' : 'B'} {t.name} 표시 {t.count}명
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
        );
      })}
      <p className="admin-hint">표시 인원 = 실제 접속자 + 가감값 (연출용)</p>

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
