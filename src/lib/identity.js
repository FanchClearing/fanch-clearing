// uid·닉네임·팀은 "탭 단위(sessionStorage)"를 우선하고 localStorage에도 함께 저장한다.
// 이유: 같은 브라우저에서 탭 여러 개로 데모를 돌릴 때 탭마다 다른 사람으로 인식되어야 한다.
// 새로고침해도 sessionStorage가 유지되므로 같은 사람으로 복구된다.
const KEY_UID = 'objection.uid';
const KEY_NICK = 'objection.nickname';
const KEY_TEAM = 'objection.team';

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch (e) {
    console.error('저장소 접근 실패', e);
    return fallback;
  }
}

const sGet = (k) => safe(() => sessionStorage.getItem(k));
const sSet = (k, v) => safe(() => sessionStorage.setItem(k, v));
const lGet = (k) => safe(() => localStorage.getItem(k));
const lSet = (k, v) => safe(() => localStorage.setItem(k, v));

const readScoped = (k) => sGet(k) ?? lGet(k);
function writeScoped(k, v) {
  sSet(k, v);
  lSet(k, v);
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function makeDefaultNickname() {
  return '흔들왕' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

let memoryUid = null; // 저장소가 막힌 환경(시크릿 모드 등)용

export function getUid() {
  let uid = sGet(KEY_UID) || memoryUid;
  if (!uid) {
    uid = randomId();
    memoryUid = uid;
    sSet(KEY_UID, uid);
  }
  return uid;
}

export function getNickname() {
  let nick = readScoped(KEY_NICK);
  if (!nick) {
    nick = makeDefaultNickname();
    writeScoped(KEY_NICK, nick);
  }
  return nick;
}

export function setNickname(nick) {
  const clean = (nick || '').trim().slice(0, 8);
  writeScoped(KEY_NICK, clean || makeDefaultNickname());
  return getNickname();
}

export function getTeam() {
  return readScoped(KEY_TEAM);
}

export function setTeam(teamId) {
  writeScoped(KEY_TEAM, teamId);
}
