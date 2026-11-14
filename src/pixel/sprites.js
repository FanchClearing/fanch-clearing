// 스프라이트: 문자열 배열 + 팔레트. '.'은 투명. 외부 이미지 에셋 없음.
export const PALETTE = {
  k: '#1a1c2c', // 거의 검정(남색)
  w: '#f4f4f4', // 흰색
  g: '#38b764', // 잔디 밝은
  G: '#257179', // 짙은 청록
  d: '#b86f50', // 흙
  D: '#733e39', // 짙은 흙
  y: '#ffcd75', // 노랑
  r: '#b13e53', // 빨강
  s: '#c9b8a8', // 살구(얼굴 대용)
  b: '#3b5dc9', // 파랑
  n: '#333c57', // 짙은 회청
};

// 1루·2루·3루 베이스 (7x7)
export const BASE = [
  '.wwwww.',
  'wwwwwww',
  'wwwwwww',
  'wwwwwww',
  'wwwwwww',
  'wwwwwww',
  '.wwwww.',
];

// 홈플레이트 (7x6)
export const HOME = [
  'wwwwwww',
  'wwwwwww',
  'wwwwwww',
  '.wwwww.',
  '..www..',
  '...w...',
];

// 응원 파티클용 그림 (k = 검은 테두리, x = 팀 컬러, w = 흰색 하이라이트). UI 시안과 같은 모양.
export const HEART = [
  '.kk..kk.',
  'kxxkkxxk',
  'kxwxxxxk',
  'kxxxxxxk',
  '.kxxxxk.',
  '..kxxk..',
  '...kk...',
];

export const BALL = [
  '..kkkk..',
  '.kwwwwk.',
  'kwxwwxwk',
  'kwxwwxwk',
  'kwxwwxwk',
  'kwxwwxwk',
  '.kwwwwk.',
  '..kkkk..',
];

export const STICK = [
  '.kkkk.',
  'kxxxxk',
  'kxwxxk',
  'kxxxxk',
  'kxxxxk',
  '.kxxk.',
  '.kwwk.',
  '.kwwk.',
  '.kwwk.',
  '..kk..',
];
