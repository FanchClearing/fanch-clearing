import { useEffect, useMemo, useRef, useState } from 'react';
import { serverNow } from '../lib/serverTime.js';
import { rect, seededRandom, setupCanvas } from './draw.js';
import { STADIUM_H, STADIUM_W, drawStadium } from './Stadium.jsx';
import './cutscene.css';

const W = STADIUM_W; // 160
const H = STADIUM_H; // 284
const CLOSEUP_END = 2; // 초
const WIDE_END = 4;
const TOTAL = 5;
const PLAYERS_PER_TEAM = 8;

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, v + amt));
  const r = c((n >> 16) & 255);
  const g = c((n >> 8) & 255);
  const b = c(n & 255);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

const ease = (p) => p * p * (3 - 2 * p);

/** 클로즈업: 무표정으로 노려보는 선수 상반신 (얼굴·로고 없이 팀 컬러 모자·유니폼만) */
function drawCloseup(ctx, color, sub, blink) {
  // 잔디 단색 + 노이즈
  rect(ctx, 0, 0, W, H, '#38b764');
  const rand = seededRandom(11);
  for (let i = 0; i < 260; i += 1) {
    rect(ctx, Math.floor(rand() * W), Math.floor(rand() * H), 2, 1, rand() > 0.5 ? '#3ea85a' : '#2f9e57');
  }

  const U = 4; // 1칸 = 4픽셀
  const R = (x, y, w, h, c) => rect(ctx, x * U, (y + 18) * U, w * U, h * U, c);
  const skin = '#e0b79a';
  const dark = '#1a1c2c';

  // 유니폼(어깨)
  R(3, 44, 34, 20, color);
  R(3, 44, 34, 2, shade(color, 35));
  R(0, 52, 5, 12, shade(color, -25));
  R(35, 52, 5, 12, shade(color, -25));
  R(8, 46, 2, 18, '#f4f4f4'); // 소매 라인 장식
  R(30, 46, 2, 18, '#f4f4f4');
  // 목 + 칼라
  R(16, 36, 8, 6, skin);
  R(14, 41, 12, 5, sub);
  // 얼굴
  R(12, 20, 16, 18, skin);
  R(11, 27, 1, 5, shade(skin, -20));
  R(28, 27, 1, 5, shade(skin, -20));
  // 모자
  R(11, 11, 18, 12, color);
  R(11, 11, 18, 2, shade(color, 35));
  R(9, 22, 22, 3, shade(color, -45));
  // 눈썹(안쪽이 내려간 노려보는 각도)
  R(13, 27, 3, 1, dark);
  R(16, 28, 2, 1, dark);
  R(22, 28, 2, 1, dark);
  R(24, 27, 3, 1, dark);
  // 눈 (깜빡일 때는 한 줄)
  if (blink) {
    R(14, 31, 4, 1, dark);
    R(22, 31, 4, 1, dark);
  } else {
    R(14, 30, 4, 2, '#f4f4f4');
    R(22, 30, 4, 2, '#f4f4f4');
    R(16, 30, 2, 2, dark);
    R(22, 30, 2, 2, dark);
  }
  // 입 (무표정)
  R(17, 35, 6, 1, shade(skin, -70));
}

/** 와이드: 위에서 내려다본 구장 + 양 팀 8명씩 몰려가 뭉치기 */
function drawWide(ctx, players, p, t, colA, colB) {
  drawStadium(ctx);
  const e = ease(Math.max(0, Math.min(1, p)));
  const sorted = [...players].sort((a, b) => a.y0 + (a.y1 - a.y0) * e - (b.y0 + (b.y1 - b.y0) * e));
  sorted.forEach((pl) => {
    const x = pl.x0 + (pl.x1 - pl.x0) * e + Math.sin(t * 14 + pl.ph) * (e > 0.9 ? 1.2 : 0.4);
    const y = pl.y0 + (pl.y1 - pl.y0) * e + Math.cos(t * 12 + pl.ph) * (e > 0.9 ? 0.8 : 0.3);
    const c = pl.team === 0 ? colA : colB;
    rect(ctx, x, y, 2, 1, '#e0b79a'); // 머리
    rect(ctx, x, y + 1, 2, 2, c); // 몸
  });
}

function makePlayers() {
  const rand = seededRandom(23);
  const list = [];
  for (let team = 0; team < 2; team += 1) {
    for (let i = 0; i < PLAYERS_PER_TEAM; i += 1) {
      const ang = rand() * Math.PI * 2;
      const rad = Math.sqrt(rand()) * 13;
      list.push({
        team,
        x0: team === 0 ? 8 + rand() * 12 : 140 + rand() * 12, // 3루 / 1루 덕아웃
        y0: 196 + rand() * 22,
        x1: 80 + Math.cos(ang) * rad + (team === 0 ? -3 : 3),
        y1: 236 + Math.sin(ang) * rad * 0.7,
        ph: rand() * 6,
      });
    }
  }
  return list;
}

/**
 * 컷신 5초: 클로즈업(0~2s) → 와이드 벤치클리어링(2~4s) → START!!(4~5s)
 * 장면은 battle.cutsceneAt 기준 서버 시각 경과로 정하므로 폰끼리 싱크가 맞는다.
 * team: 클로즈업에 나올 팀 id. fullscreen: 폰에서는 화면 전체 오버레이.
 */
export default function Cutscene({ game, team, battle, fullscreen = true }) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const flashRef = useRef(null);
  const [scene, setScene] = useState('closeup');
  const players = useMemo(makePlayers, []);

  const ids = Object.keys(game.teams);
  const mine = game.teams[team] || game.teams[ids[0]];
  const otherId = ids.find((id) => game.teams[id] !== mine) || ids[1];
  const other = game.teams[otherId];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let ctx;
    let off;
    let offCtx;
    try {
      ctx = setupCanvas(canvas, W, H);
      off = document.createElement('canvas');
      offCtx = setupCanvas(off, W, H);
    } catch (e) {
      console.error('컷신 canvas 준비 실패', e);
      return undefined;
    }

    let raf = 0;
    let lastScene = 'closeup';

    const frame = () => {
      const t = Math.max(0, (serverNow() - battle.cutsceneAt) / 1000);
      const nextScene = t < CLOSEUP_END ? 'closeup' : t < WIDE_END ? 'wide' : 'start';
      if (nextScene !== lastScene) {
        lastScene = nextScene;
        setScene(nextScene);
      }

      try {
        if (nextScene === 'closeup') {
          const blink = t % 1 > 0.88; // 1초마다 눈 깜빡임
          drawCloseup(offCtx, mine.color, mine.sub, blink);
          // 아래에서 위로 살짝 줌인 (정수에 가까운 단계로)
          const s = 1 + Math.round(Math.min(t / CLOSEUP_END, 1) * 6) * 0.02;
          ctx.clearRect(0, 0, W, H);
          ctx.drawImage(off, 0, 0, W, H, -((s - 1) * W) / 2, -(s - 1) * H * 0.7, W * s, H * s);
        } else {
          const p = (t - CLOSEUP_END) / (WIDE_END - CLOSEUP_END);
          drawWide(ctx, players, p, t, mine.color, other.color);
        }
      } catch (e) {
        console.error('컷신 그리기 실패', e);
      }

      // START 구간: 화면 흔들림(±8px)과 첫 프레임 흰색 플래시
      const box = boxRef.current;
      if (box) {
        if (nextScene === 'start') {
          const dx = (Math.random() * 2 - 1) * 8;
          const dy = (Math.random() * 2 - 1) * 8;
          box.style.transform = `translate(${dx}px, ${dy}px)`;
        } else {
          box.style.transform = '';
        }
      }
      if (flashRef.current) {
        flashRef.current.style.opacity = t >= WIDE_END && t < WIDE_END + 0.05 ? '1' : '0';
      }

      if (t < TOTAL + 0.5) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [battle.cutsceneAt, mine, other, players]);

  return (
    <div className={fullscreen ? 'cutscene fullscreen' : 'cutscene inline'}>
      <div className="cutscene-box" ref={boxRef}>
        <canvas ref={canvasRef} className="cutscene-canvas" />
        {scene === 'closeup' && <div className="cut-label">…</div>}
        {scene === 'wide' && <div className="cut-label">벤치클리어링!</div>}
        {scene === 'start' && <div className="cut-start">START!!</div>}
        <div className="cut-flash" ref={flashRef} />
      </div>
    </div>
  );
}
