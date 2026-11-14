import { useEffect, useMemo, useRef, useState } from 'react';
import { serverNow } from '../lib/serverTime.js';
import { HAPTIC, vibrate } from '../lib/haptics.js';
import { playEffect } from '../lib/sound.js';
import { drawSprite, line, rect, seededRandom, setupCanvas } from './draw.js';
import { UMPIRE, UMPIRE_PALETTE, WHISTLE } from './sprites.js';
import { STADIUM_H, STADIUM_W, drawStadium } from './Stadium.jsx';
import './cutscene.css';

const W = STADIUM_W; // 160
const H = STADIUM_H; // 284
const WHISTLE_END = 1.2; // 초: 심판 휘슬 연출 (0~1.2)
const CLOSEUP_END = 3.2; // 클로즈업 (1.2~3.2)
const WIDE_END = 5.2; // 와이드 벤치클리어링 (3.2~5.2)
const TOTAL = 6.2; // START!! (5.2~6.2)  ※ lib/room.js 의 CUTSCENE_MS 와 같아야 한다
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
function drawCloseup(ctx, color, sub, blink, t) {
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

  // 야구 모자: 둥근 크라운 + 솔기 + 꼭지 단추 + 넓고 둥근 챙
  R(13, 8, 14, 2, color);
  R(11, 10, 18, 3, color);
  R(10, 13, 20, 9, color);
  R(13, 8, 5, 1, shade(color, 40)); // 윗면 하이라이트
  R(11, 10, 3, 2, shade(color, 30));
  R(19, 7, 2, 1, shade(color, -40)); // 꼭지 단추
  R(20, 9, 1, 13, shade(color, -35)); // 가운데 솔기
  R(15, 11, 1, 11, shade(color, -25)); // 옆 솔기
  R(25, 11, 1, 11, shade(color, -25));
  R(9, 21, 22, 1, shade(color, -30)); // 크라운 아랫단
  R(7, 22, 26, 2, shade(color, -50)); // 챙 (넓게)
  R(9, 24, 22, 1, shade(color, -75)); // 챙 아래쪽 둥근 가장자리
  R(12, 25, 16, 2, shade(skin, -55)); // 챙 그림자(이마·눈 위)

  // 눈썹: 왼쪽은 찌푸림, 오른쪽은 한쪽만 치켜올림(도발)
  R(13, 27, 3, 1, dark);
  R(16, 28, 2, 1, dark);
  R(22, 27, 2, 1, dark);
  R(24, 26, 3, 1, dark);
  // 눈 (깜빡일 때는 한 줄)
  if (blink) {
    R(14, 31, 4, 1, dark);
    R(22, 31, 4, 1, dark);
  } else {
    // 반쯤 감긴 눈꺼풀로 내려다보는 거만한 눈
    R(14, 31, 4, 1, '#f4f4f4');
    R(22, 31, 4, 1, '#f4f4f4');
    R(16, 31, 2, 1, dark);
    R(22, 31, 2, 1, dark);
    R(14, 30, 4, 1, shade(skin, -45)); // 눈꺼풀
    R(22, 30, 4, 1, shade(skin, -45));
  }
  // 입: 한쪽 입꼬리만 올라간 비웃음
  R(17, 35, 5, 1, shade(skin, -70));
  R(22, 34, 2, 1, shade(skin, -70));

  // 두 손가락(검지·중지)으로 느긋하게 까딱: 0.8초 주기로 천천히 접었다 펴고, 펴고 있는 시간이 더 길다
  const step = Math.floor(((t % 0.8) / 0.8) * 8); // 0~7
  const len = [9, 9, 9, 8, 5, 3, 5, 8][step]; // 손가락이 보이는 길이
  const bob = step >= 4 && step <= 6 ? 1 : 0; // 접을 때 손이 살짝 내려감
  const hx = 30;
  const hy = 38 + bob; // 이전보다 낮게: 힘 빼고 아래에서 까딱
  R(hx + 2, hy + 8, 7, 14, shade(color, -15)); // 소매/팔
  R(hx, hy, 9, 9, skin); // 손바닥(주먹)
  R(hx, hy + 8, 9, 1, shade(skin, -30)); // 손목 선
  // 접어 쥔 약지·소지
  R(hx + 6, hy - 1, 3, 2, shade(skin, -15));
  R(hx + 6, hy + 2, 3, 1, shade(skin, -35));
  // 엄지(접어 넣음)
  R(hx - 1, hy + 3, 3, 3, skin);
  R(hx - 1, hy + 5, 3, 1, shade(skin, -30));
  // 검지·중지 (중지가 조금 더 길다)
  [[1, 0], [4, 1]].forEach(([dx, extra]) => {
    const l = len + extra;
    R(hx + dx, hy - l, 2, l, skin);
    R(hx + dx, hy - l, 2, 1, shade(skin, -25)); // 끝마디 그림자
    R(hx + dx, hy - 1, 2, 1, shade(skin, -20)); // 손가락 밑 마디선
  });
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

/** 휘슬 장면(0~1.2초): 심판이 왼쪽에서 달려 들어와 호루라기를 불고(음파선) 오른쪽으로 빠져나간다 */
function drawWhistle(ctx, t) {
  drawStadium(ctx);
  rect(ctx, 0, 0, W, H, 'rgba(0, 0, 0, 0.4)'); // 심판이 돋보이게 배경을 어둡게

  const S = 5; // 스프라이트 확대 배율 (16x23 → 80x115)
  const p = Math.min(1, t / WHISTLE_END);
  const stand = (W - 16 * S) / 2;
  let x = stand;
  if (p < 0.3) x = -16 * S + (stand + 16 * S) * (1 - (1 - p / 0.3) ** 2); // 들어옴 (점점 느려짐)
  else if (p > 0.8) x = stand + (W - stand + 10) * ((p - 0.8) / 0.2) ** 2; // 빠져나감 (점점 빨라짐)
  const blowing = p >= 0.3 && p <= 0.8;
  const beat = Math.floor(t * 10) % 2; // 0.1초마다 번갈아
  const y = 118 + (blowing && beat ? -2 : 0) + (!blowing ? Math.abs(Math.sin(t * 30)) * -3 : 0); // 달릴 때 통통

  drawSprite(ctx, UMPIRE, x, y, S, UMPIRE_PALETTE);
  if (blowing) {
    // 볼이 부풀었다 들어갔다 하며 호루라기를 문다
    if (beat) {
      rect(ctx, x + 3 * S, y + 10 * S, S, S, '#c99a7c');
      rect(ctx, x + 12 * S, y + 10 * S, S, S, '#c99a7c');
    }
    rect(ctx, x + 7 * S, y + 10 * S, 2 * S, S, '#0b0c14'); // 벌린 입
    drawSprite(ctx, WHISTLE, x + 8 * S, y + 9 * S, S, UMPIRE_PALETTE);
    // 호루라기에서 퍼져 나가는 음파선 3줄
    const ox = x + 14 * S;
    const oy = y + 10 * S;
    [-0.6, 0, 0.6].forEach((ang, i) => {
      const r = 8 + ((t * 70 + i * 9) % 26);
      const x0 = ox + Math.cos(ang) * r;
      const y0 = oy + Math.sin(ang) * r;
      const c = i % 2 ? '#ffd23f' : '#ffffff';
      line(ctx, x0, y0, x0 + Math.cos(ang) * 7, y0 + Math.sin(ang) * 7, c);
      line(ctx, x0, y0 + 1, x0 + Math.cos(ang) * 7, y0 + 1 + Math.sin(ang) * 7, c);
    });
  }
}

/**
 * 컷신 6.2초: 휘슬(0~1.2s) → 클로즈업(1.2~3.2s) → 와이드 벤치클리어링(3.2~5.2s) → START!!(5.2~6.2s)
 * (휘슬 장면은 "이의 있음"이 모여 판정이 시작되는 순간 심판이 호루라기를 부는 연출. 휘슬 효과음은 sound/whistle.mp3) 클로즈업(0~2s) → 와이드 벤치클리어링(2~4s) → START!!(4~5s)
 * 장면은 battle.cutsceneAt 기준 서버 시각 경과로 정하므로 폰끼리 싱크가 맞는다.
 * team: 클로즈업에 나올 팀 id. fullscreen: 폰에서는 화면 전체 오버레이.
 */
export default function Cutscene({ game, team, battle, fullscreen = true }) {
  const canvasRef = useRef(null);
  const boxRef = useRef(null);
  const flashRef = useRef(null);
  const [scene, setScene] = useState('whistle');
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
    let lastScene = 'whistle';
    let whistled = false;

    const frame = () => {
      const t = Math.max(0, (serverNow() - battle.cutsceneAt) / 1000);
      const nextScene =
        t < WHISTLE_END ? 'whistle' : t < CLOSEUP_END ? 'closeup' : t < WIDE_END ? 'wide' : 'start';
      // 휘슬 효과음: 컷신이 막 시작됐을 때만 (중간에 들어온 기기는 울리지 않는다)
      if (!whistled) {
        whistled = true;
        if (t < 0.6) playEffect('whistle');
      }
      if (nextScene !== lastScene) {
        lastScene = nextScene;
        setScene(nextScene);
        // START!! 순간: 폰에서만 세 번 진동 (호스트 대형 화면에서는 울리지 않는다)
        if (nextScene === 'start' && fullscreen) vibrate(HAPTIC.start);
      }

      try {
        if (nextScene === 'whistle') {
          ctx.clearRect(0, 0, W, H);
          drawWhistle(ctx, t);
        } else if (nextScene === 'closeup') {
          const blink = t % 1 > 0.88; // 1초마다 눈 깜빡임
          drawCloseup(offCtx, mine.color, mine.sub, blink, t);
          // 아래에서 위로 살짝 줌인 (정수에 가까운 단계로)
          const s = 1 + Math.round(Math.min((t - WHISTLE_END) / (CLOSEUP_END - WHISTLE_END), 1) * 6) * 0.02;
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
        const whistleFlash = t >= 0.3 && t < 0.35; // 호루라기를 부는 순간
        const startFlash = t >= WIDE_END && t < WIDE_END + 0.05; // START!! 순간
        flashRef.current.style.opacity = whistleFlash || startFlash ? '1' : '0';
      }

      if (t < TOTAL + 0.5) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [battle.cutsceneAt, mine, other, players, fullscreen]);

  return (
    <div className={fullscreen ? 'cutscene fullscreen' : 'cutscene inline'}>
      <div className="cutscene-box" ref={boxRef}>
        <canvas ref={canvasRef} className="cutscene-canvas" />
        {scene === 'whistle' && <div className="cut-whistle">삐—익!</div>}
        {scene === 'wide' && <div className="cut-label">벤치클리어링!</div>}
        {scene === 'start' && <div className="cut-start">START!!</div>}
        <div className="cut-flash" ref={flashRef} />
      </div>
    </div>
  );
}
