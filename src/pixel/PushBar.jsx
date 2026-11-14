import { useEffect, useRef, useState } from 'react';
import './pushbar.css';

const MIN = 15;
const MAX = 85;
const clamp = (v) => Math.min(MAX, Math.max(MIN, v));

/**
 * 밀어내기 바: 왼쪽 A색과 오른쪽 B색이 맞닿은 경계가 우세한 쪽에서 열세한 쪽으로 밀린다.
 * - 경계 위치 = A ÷ (A+B), 0:0이면 가운데, 15%~85% 안에서만 움직인다
 * - 점수가 오를 때마다 목표를 살짝 지나쳤다 돌아오는 "툭" 밀기
 * - 직전 갱신에서 오른 점수에 비례해 경계가 떨린다 (아무도 안 흔들면 멈춤)
 * - 접전(45~55%)이면 경계에 충돌 스파크
 */
export default function PushBar({
  scoreA,
  scoreB,
  colorA,
  colorB,
  labelA = 'A',
  labelB = 'B',
  height = 28,
}) {
  const sum = scoreA + scoreB;
  const target = sum === 0 ? 50 : clamp((scoreA / sum) * 100);
  const [shown, setShown] = useState(target);
  const [jit, setJit] = useState(0);
  const prev = useRef({ a: scoreA, b: scoreB });
  const timers = useRef({ settle: 0, calm: 0 });
  const shownRef = useRef(shown);
  shownRef.current = shown;

  useEffect(() => {
    const delta = scoreA - prev.current.a + (scoreB - prev.current.b);
    prev.current = { a: scoreA, b: scoreB };
    clearTimeout(timers.current.settle);
    clearTimeout(timers.current.calm);

    if (delta <= 0) {
      setShown(target);
      setJit(0);
      return;
    }
    // 목표를 살짝 지나쳤다가 돌아온다
    const dir = Math.sign(target - shownRef.current) || 0;
    setShown(clamp(target + dir * 4));
    timers.current.settle = setTimeout(() => setShown(target), 130);
    // 떨림 폭 2~6px, 잠시 뒤 멈춘다
    setJit(Math.min(6, Math.max(2, Math.round(delta / 2) + 1)));
    timers.current.calm = setTimeout(() => setJit(0), 800);
  }, [scoreA, scoreB, target]);

  const close = shown >= 45 && shown <= 55;

  return (
    <div
      className={'pushbar' + (close ? ' close' : '')}
      style={{ '--p': shown, '--j': jit, '--ca': colorA, '--cb': colorB, height }}
    >
      <div className="pb-fill">
        <i className="pb-spark" />
      </div>
      <span className="pb-l">{labelA}</span>
      <span className="pb-r">{labelB}</span>
    </div>
  );
}
