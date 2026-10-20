// 게임 상태와 저장/불러오기
import * as D from './data.js';

const SAVE_KEY = 'yogoe-village-save-v1';
const SNAP_KEY = 'yogoe-village-snapshots-v1';

export let state = null;
let snapshots = {}; // { [일차]: 그날 아침 상태 }

export const idx = (x, y) => y * D.GRID_W + x;
export const inGrid = (x, y) => x >= 0 && y >= 0 && x < D.GRID_W && y < D.GRID_H;

export function newGame() {
  const grid = new Array(D.GRID_W * D.GRID_H).fill(null);
  grid[idx(D.TREE_POS.x, D.TREE_POS.y)] = 'tree';
  for (const b of D.START.buildings) grid[idx(b.x, b.y)] = b.type;
  state = {
    version: 1,
    day: 1,
    rice: D.START.rice,
    wood: D.START.wood,
    coin: D.START.coin,
    ap: D.DAILY_AP,
    grid,
    residents: [],
    nextId: 1,
    totalKills: 0,
    hungry: false,
  };
  for (const r of D.START.residents) addResident(r.x, r.y);
  snapshots = {};
  takeSnapshot();
  save();
}

export function addResident(x, y) {
  const r = { id: state.nextId++, x, y, survivals: 0, general: null };
  state.residents.push(r);
  return r;
}

export const buildingAt = (x, y) => state.grid[idx(x, y)];
export const residentAt = (x, y) => state.residents.find(r => r.x === x && r.y === y);

// 주민 역할은 놓인 칸으로 결정된다
export function roleOf(r) {
  const b = buildingAt(r.x, r.y);
  if (b === 'field') return 'farmer';
  if (b === 'lumber') return 'lumber';
  if (b === 'tower') return 'archer';
  return 'guard';
}

export function maxResidents() {
  return state.grid.filter(b => b === 'house').length * D.BUILDINGS.house.capacity;
}

export const generalCount = () => state.residents.filter(r => r.general).length;

export function canAfford(cost) {
  return Object.entries(cost).every(([k, v]) => state[k] >= v);
}
export function pay(cost) {
  for (const [k, v] of Object.entries(cost)) state[k] -= v;
}
export function gain(obj) {
  for (const [k, v] of Object.entries(obj)) state[k] += v;
}
export function costText(cost) {
  return Object.entries(cost).map(([k, v]) => D.RESOURCES[k].emoji + v).join(' ');
}

// ---- 저장 ----
export function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    localStorage.setItem(SNAP_KEY, JSON.stringify(snapshots));
  } catch (e) { /* 저장 실패해도 게임은 계속 */ }
}

export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s || s.version !== 1) return false;
    state = s;
    try { snapshots = JSON.parse(localStorage.getItem(SNAP_KEY)) || {}; } catch (e) { snapshots = {}; }
    return true;
  } catch (e) {
    return false;
  }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(SNAP_KEY);
  } catch (e) { /* 무시 */ }
}

// 아침(하루 시작) 시점 스냅샷. 오늘 + 이전 3일만 보관
export function takeSnapshot() {
  snapshots[state.day] = JSON.parse(JSON.stringify(state));
  for (const d of Object.keys(snapshots)) {
    if (+d < state.day - D.ROLLBACK_DAYS) delete snapshots[d];
  }
}

export function rollbackTarget() {
  return Math.max(1, state.day - D.ROLLBACK_DAYS);
}

// 패배 시 되돌리기. 해당 스냅샷이 없으면 가장 오래된 스냅샷, 그것도 없으면 새 게임
export function rollback() {
  const target = rollbackTarget();
  const days = Object.keys(snapshots).map(Number).filter(d => d >= target).sort((a, b) => a - b);
  if (days.length === 0) { newGame(); return; }
  const day = days[0];
  state = JSON.parse(JSON.stringify(snapshots[day]));
  for (const d of Object.keys(snapshots)) if (+d > day) delete snapshots[d];
  save();
}
