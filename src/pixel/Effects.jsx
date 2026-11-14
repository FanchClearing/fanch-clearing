import { useEffect, useRef, useState } from 'react';
import { drawSprite, rect, seededRandom, setupCanvas } from './draw.js';
import { BALL, HEART, STICK } from './sprites.js';
import './effects.css';

const HIT_WORDS = ['퍽!', '쾅!', '이의!', '오심!'];
const HIT_COLORS = ['#ffcd75', '#f4f4f4', '#ef7d57', '#73eff7'];

/** hit 값이 증가한 순간에만 true를 알려주는 훅 */
function useIncrease(hit) {
  const prev = useRef(hit);
  const increased = hit > prev.current;
  useEffect(() => {
    prev.current = hit;
  }, [hit]);
  return increased;
}

/** 흔들기 1회마다 150ms 화면 흔들림 (CSS 변수로 랜덤 방향) */
export function ShakeBox({ hit, children, className = '', amp = 8 }) {
  const ref = useRef(null);
  const increased = useIncrease(hit);

  useEffect(() => {
    const el = ref.current;
    if (!el || !increased) return;
    el.style.setProperty('--sx', `${Math.round((Math.random() * 2 - 1) * amp)}px`);
    el.style.setProperty('--sy', `${Math.round((Math.random() * 2 - 1) * amp)}px`);
    el.classList.remove('fx-shake');
    void el.offsetWidth; // 애니메이션 재시작
    el.classList.add('fx-shake');
  });

  return (
    <div ref={ref} className={`fx-shakebox ${className}`}>
      {children}
    </div>
  );
}

/** 랜덤 위치에 타격 텍스트 400ms 페이드 */
export function HitTexts({ hit }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);
  const increased = useIncrease(hit);

  useEffect(() => {
    if (!increased) return;
    idRef.current += 1;
    const id = idRef.current;
    const item = {
      id,
      text: HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)],
      color: HIT_COLORS[Math.floor(Math.random() * HIT_COLORS.length)],
      left: 8 + Math.random() * 60,
      top: 22 + Math.random() * 30,
      size: 28 + Math.floor(Math.random() * 3) * 8,
    };
    setItems((list) => [...list.slice(-6), item]);
    // 정리 타이머는 취소하지 않는다 (리렌더로 deps가 바뀌어도 400ms 뒤에 반드시 제거)
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), 400);
  }, [hit, increased]);

  return (
    <div className="fx-hits">
      {items.map((i) => (
        <span
          key={i.id}
          className="fx-hit"
          style={{ left: `${i.left}%`, top: `${i.top}%`, fontSize: i.size, color: i.color }}
        >
          {i.text}
        </span>
      ))}
    </div>
  );
}

/** 상시 회전하는 방사형 집중선 */
export function SpeedLines() {
  return <div className="fx-speedlines" aria-hidden="true" />;
}

// 주먹 스프라이트 (t = 팀 컬러, T = 어두운 팀 컬러, k = 테두리)
const FIST = [
  '...kkkkkk...',
  '..kttttttk..',
  '.kttttttttk.',
  '.ktttTTtttk.',
  '.kttttttttk.',
  '.kTtttttttk.',
  '.kkttttttkk.',
  '..kkkttkkk..',
  '...kttttk...',
  '...kttttk...',
  '...kttttk...',
  '...kttttk...',
];

function darken(hex) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, v - 50);
  return `#${((1 << 24) + (c((n >> 16) & 255) << 16) + (c((n >> 8) & 255) << 8) + c(n & 255))
    .toString(16)
    .slice(1)}`;
}

function FistCanvas({ color }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      const ctx = setupCanvas(ref.current, 12, 12);
      drawSprite(ctx, FIST, 0, 0, 1, { k: '#1a1c2c', t: color, T: darken(color) });
    } catch (e) {
      console.error('주먹 그리기 실패', e);
    }
  }, [color]);
  return <canvas ref={ref} className="fx-fist-canvas" />;
}

/** 화면 하단 좌우의 내 주먹. 흔들 때마다 좌우 번갈아 앞으로 뻗는다 (2프레임) */
export function Fists({ hit, color }) {
  const [punch, setPunch] = useState({ side: 'l', n: 0 });
  const increased = useIncrease(hit);

  useEffect(() => {
    if (!increased) return;
    setPunch((p) => ({ side: hit % 2 ? 'l' : 'r', n: p.n + 1 }));
    // 취소하지 않는다: 리렌더로 deps가 바뀌어도 140ms 뒤에 반드시 주먹을 되돌린다
    setTimeout(() => setPunch((p) => ({ ...p, side: '' })), 140);
  }, [hit, increased]);

  return (
    <div className="fx-fists">
      <div className={'fx-fist left' + (punch.side === 'l' ? ' punch' : '')}>
        <FistCanvas color={color} />
      </div>
      <div className={'fx-fist right' + (punch.side === 'r' ? ' punch' : '')}>
        <FistCanvas color={color} />
      </div>
    </div>
  );
}

/** 화면 중앙 멀리 서 있는 상대 팀 선수 무리 (상대 팀 컬러) */
export function OpponentCrowd({ color }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      const ctx = setupCanvas(ref.current, 80, 40);
      const rand = seededRandom(5);
      // 뒷줄(작게) → 앞줄(크게) 순서로 그려 원근감을 준다
      [[8, 1, 5], [14, 2, 6], [21, 3, 7]].forEach(([y, size, count]) => {
        for (let i = 0; i < count; i += 1) {
          const x = 8 + (i * 64) / count + rand() * 6;
          rect(ctx, x, y, size, size, '#e0b79a'); // 머리
          rect(ctx, x - 1, y + size, size + 2, size * 2, color); // 몸
          rect(ctx, x - 1, y, size + 2, 1, darken(color)); // 모자
        }
      });
    } catch (e) {
      console.error('상대 선수 그리기 실패', e);
    }
  }, [color]);
  return <canvas ref={ref} className="fx-crowd" />;
}

// ------------------------------------------------------------- 응원 파티클
// 흔들 때마다 오른쪽 아래에서 1개가 떠올라 좌우로 흔들리며 사라진다 (인스타 라이브 하트).
// 동시에 최대 30개까지만 유지한다.

const CHEER_KINDS = ['heart', 'ball', 'stick'];
const MAX_PARTICLES = 30;

function SpriteCanvas({ kind, color }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      const sprite = kind === 'heart' ? HEART : kind === 'stick' ? STICK : BALL;
      const ctx = setupCanvas(ref.current, sprite[0].length, sprite.length);
      drawSprite(ctx, sprite, 0, 0, 1, { r: color, y: color, k: '#1a1c2c', w: '#f4f4f4' });
    } catch (e) {
      console.error('파티클 그리기 실패', e);
    }
  }, [kind, color]);
  return <canvas ref={ref} className="fx-pt-canvas" />;
}

export function CheerParticles({ hit, color }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);
  const increased = useIncrease(hit);

  useEffect(() => {
    if (!increased) return;
    idRef.current += 1;
    const id = idRef.current;
    const dur = 1200 + Math.floor(Math.random() * 600); // 1.2~1.8초
    const item = {
      id,
      kind: CHEER_KINDS[Math.floor(Math.random() * CHEER_KINDS.length)],
      size: 16 + Math.floor(Math.random() * 3) * 8, // 16~32px
      right: 4 + Math.random() * 14, // %
      sway: 8 + Math.random() * 18, // px
      dur,
    };
    setItems((list) => [...list.slice(-(MAX_PARTICLES - 1)), item]);
    // 취소하지 않는다 (리렌더로 deps가 바뀌어도 끝나면 반드시 제거)
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), dur);
  }, [hit, increased]);

  return (
    <div className="fx-particles" aria-hidden="true">
      {items.map((i) => (
        <span
          key={i.id}
          className="fx-pt"
          style={{ right: `${i.right}%`, width: i.size, '--sw': `${i.sway}px`, '--t': `${i.dur}ms` }}
        >
          <SpriteCanvas kind={i.kind} color={color} />
        </span>
      ))}
    </div>
  );
}
