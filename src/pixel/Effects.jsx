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
export function ShakeBox({ hit, children, className = '', amp = 8, growing = false }) {
  const ref = useRef(null);
  const streak = useRef({ n: 0, last: 0 });
  const increased = useIncrease(hit);

  useEffect(() => {
    const el = ref.current;
    if (!el || !increased) return;
    // growing: 0.4초 안에 이어서 흔들면 흔들림이 2px → 8px까지 점점 커진다 (쉬면 처음부터)
    let a = amp;
    if (growing) {
      const t = performance.now();
      streak.current.n = t - streak.current.last < 400 ? streak.current.n + 1 : 0;
      streak.current.last = t;
      a = Math.min(8, Math.max(2, 2 + streak.current.n * 0.5));
    }
    el.style.setProperty('--sx', `${Math.round((Math.random() * 2 - 1) * a)}px`);
    el.style.setProperty('--sy', `${Math.round((Math.random() * 2 - 1) * a)}px`);
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
// 흔들 때마다 화면 오른쪽 아래에서 1개가 떠올라 좌우로 흔들리며 사라진다 (인스타 라이브 하트).
// UI 시안과 같은 값: 하트가 가장 자주(2/4), 위치 68~88%, 크기 20~36px, 화면 높이의 55~90%까지 상승,
// 1.2~1.8초, 동시에 최대 30개.

const CHEER_KINDS = ['heart', 'heart', 'ball', 'stick'];
const MAX_PARTICLES = 30;
const rnd = (a, b) => a + Math.random() * (b - a);

function SpriteCanvas({ kind, color }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      const sprite = kind === 'heart' ? HEART : kind === 'stick' ? STICK : BALL;
      const ctx = setupCanvas(ref.current, sprite[0].length, sprite.length);
      drawSprite(ctx, sprite, 0, 0, 1, { k: '#000000', x: color, w: '#ffffff' });
    } catch (e) {
      console.error('파티클 그리기 실패', e);
    }
  }, [kind, color]);
  return <canvas ref={ref} className="fx-pt-canvas" />;
}

/** 화면 전체(모바일 폭)에 고정된 파티클 층. 화면 흔들림 박스 밖에 둬야 위치가 흔들리지 않는다. */
export function CheerParticles({ hit, color }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);
  const layerRef = useRef(null);
  const increased = useIncrease(hit);

  useEffect(() => {
    if (!increased) return;
    const layer = layerRef.current;
    const w = layer ? layer.clientWidth : 360;
    const h = layer ? layer.clientHeight : 640;
    idRef.current += 1;
    const id = idRef.current;
    const dur = Math.round(rnd(1200, 1800));
    const item = {
      id,
      kind: CHEER_KINDS[Math.floor(Math.random() * CHEER_KINDS.length)],
      size: Math.round(rnd(20, 36)),
      left: rnd(68, 88), // %
      rise: Math.round(h * rnd(0.55, 0.9)), // px
      sway: Math.round(rnd(-1, 1) * Math.max(10, w * 0.03)), // px
      dur,
    };
    setItems((list) => [...list.slice(-(MAX_PARTICLES - 1)), item]);
    // 취소하지 않는다 (리렌더로 deps가 바뀌어도 끝나면 반드시 제거)
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), dur);
  }, [hit, increased]);

  return (
    <div className="fx-particles" ref={layerRef} aria-hidden="true">
      {items.map((i) => (
        <span
          key={i.id}
          className="fx-pt"
          style={{
            left: `${i.left}%`,
            width: i.size,
            '--h': `${i.rise}px`,
            '--dx': `${i.sway}px`,
            '--t': `${i.dur}ms`,
          }}
        >
          <SpriteCanvas kind={i.kind} color={color} />
        </span>
      ))}
    </div>
  );
}
