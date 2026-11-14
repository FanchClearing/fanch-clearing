export const SPORTS = [
  { id: 'baseball', name: '야구', icon: '⚾', enabled: true },
  { id: 'basketball', name: '농구', icon: '🏀', enabled: false },
  { id: 'volleyball', name: '배구', icon: '🏐', enabled: false },
  { id: 'soccer', name: '축구', icon: '⚽', enabled: false },
];

export const GAMES = [
  { id: 'kbo-lg-hh', sport: 'baseball', status: 'live',
    teams: { lg: { name: 'LG', color: '#c30452', sub: '#1a1a1a' },
             hh: { name: '한화', color: '#ff6600', sub: '#1a1a1a' } } },
  { id: 'kbo-ss-kia', sport: 'baseball', status: 'scheduled',
    teams: { ss: { name: '삼성', color: '#074ca1', sub: '#ffffff' },
             kia: { name: 'KIA', color: '#ea0029', sub: '#06141f' } } },
  { id: 'kbo-dsb-lot', sport: 'baseball', status: 'scheduled',
    teams: { ds: { name: '두산', color: '#131230', sub: '#ffffff' },
             lot: { name: '롯데', color: '#041e42', sub: '#d00f31' } } },
];

export function getGame(gameId) {
  return GAMES.find((g) => g.id === gameId) || null;
}
