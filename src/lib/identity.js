const KEY_UID = 'objection.uid';
const KEY_NICK = 'objection.nickname';
const KEY_TEAM = 'objection.team';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.error('localStorage 읽기 실패', e);
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.error('localStorage 쓰기 실패', e);
  }
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function makeDefaultNickname() {
  return '흔들왕' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

export function getUid() {
  let uid = read(KEY_UID);
  if (!uid) {
    uid = randomId();
    write(KEY_UID, uid);
  }
  return uid;
}

export function getNickname() {
  let nick = read(KEY_NICK);
  if (!nick) {
    nick = makeDefaultNickname();
    write(KEY_NICK, nick);
  }
  return nick;
}

export function setNickname(nick) {
  const clean = (nick || '').trim().slice(0, 8);
  write(KEY_NICK, clean || makeDefaultNickname());
  return getNickname();
}

export function getTeam() {
  return read(KEY_TEAM);
}

export function setTeam(teamId) {
  write(KEY_TEAM, teamId);
}
