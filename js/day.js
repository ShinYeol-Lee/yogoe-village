// 낮: 건설, 주민 배치·고용, 오늘 밤 미리보기
import * as D from './data.js';
import {
  state, idx, inGrid, buildingAt, residentAt, roleOf, maxResidents,
  canAfford, pay, costText, addResident, save, gain, generalCount,
} from './state.js';
import { updateHud, toast, setPanel, setInfo, showCard, hideCard } from './ui.js';
import { promote } from './morning.js';

export const view = { mode: null, selectedId: null, validCells: null, wave: null };
let hooks = {};
const debug = new URLSearchParams(location.search).get('debug') === '1';

export function enterDay(h) {
  hooks = h;
  view.mode = null;
  view.selectedId = null;
  view.validCells = null;
  view.wave = D.WAVES[Math.min(state.day, D.WAVES.length) - 1];
  refresh();
  introduceNewEnemies();
}

// 처음 보는 요괴가 오는 날은 소개 카드를 보여준다
function introduceNewEnemies() {
  state.seenEnemies = state.seenEnemies || [];
  const fresh = [...new Set(view.wave.map(g => g.type))]
    .filter(t => !state.seenEnemies.includes(t) && !D.ENEMIES[t].hidden);
  if (!fresh.length) return;
  state.seenEnemies.push(...fresh);
  save();
  const list = fresh.map(t => {
    const e = D.ENEMIES[t];
    return `<li><span class="ne-emoji">${e.emoji}</span><div><b>${e.name}</b><br><small>${e.desc}</small></div></li>`;
  }).join('');
  showCard(`<h2>👀 새로운 요괴!</h2><p class="sub">오늘 밤 처음 보는 요괴가 와요</p>
    <ul class="newenemy">${list}</ul>
    <button data-act="ok" class="big">대비하자!</button>`, { ok: hideCard });
}

function refresh() {
  updateHud();
  renderInfo();
  renderPanel();
  view.validCells = computeValid();
}

function renderInfo() {
  const boss = view.wave.some(g => D.ENEMIES[g.type].boss);
  const list = view.wave.map(g => `<span class="pv">${D.DIRS[g.dir].arrow}${D.ENEMIES[g.type].emoji}×${g.count}</span>`).join('');
  let hint = '건물 버튼 → 칸을 탭해서 지어요 · 주민 탭 → 칸 탭으로 옮겨요';
  if (view.mode === 'build') hint = `${D.BUILDINGS[view.buildType].emoji} ${D.BUILDINGS[view.buildType].name}: 지을 칸을 탭하세요`;
  if (view.mode === 'build' && apCost(view.buildType) === 0) hint += ' (연달아 지을 수 있어요)';
  if (view.mode === 'move') hint = '옮길 칸을 탭하세요 (논=농부, 벌목장=나무꾼, 망루=궁수, 빈 칸=수호대)';
  setInfo(`<div class="preview ${boss ? 'boss' : ''}"><b>${boss ? '🐍 보스의 밤!' : '🌙 오늘 밤'}</b>${list}</div><div class="hint">${hint}</div>`);
}

function renderPanel() {
  const s = state;
  const builds = D.BUILD_ORDER.map(k => {
    const b = D.BUILDINGS[k];
    const ok = s.ap >= apCost(k) && canAfford(b.cost);
    const on = view.mode === 'build' && view.buildType === k;
    return `<button class="bld ${on ? 'on' : ''}" data-act="build:${k}" ${ok || on ? '' : 'disabled'}>
      <span class="e">${b.emoji}</span><span class="n">${b.name}</span><span class="c">${costText(b.cost)}${apCost(k) ? '' : ' ⚡0'}</span></button>`;
  }).join('');
  const canHire = s.ap >= D.RESIDENT.hireAp && canAfford(D.RESIDENT.hireCost) && s.residents.length < maxResidents();
  const dbg = debug ? `<div class="row debug">
      <button data-act="dbg:res">+자원</button>
      <button data-act="dbg:day">하루 건너뛰기</button>
      <button data-act="dbg:gen">장군 승급</button>
      <button data-act="dbg:boss">7일차로</button></div>` : '';
  setPanel(`
    <div class="builds">${builds}</div>
    ${dbg}
    <div class="row">
      <button class="hire" data-act="hire" ${canHire ? '' : 'disabled'}>👥 주민 고용 <small>${costText(D.RESIDENT.hireCost)} ⚡${D.RESIDENT.hireAp}</small></button>
      <button class="night" data-act="night">🌙 밤 맞이하기</button>
    </div>`, onAction);
}

function onAction(act) {
  if (act.startsWith('build:')) {
    const type = act.slice(6);
    if (view.mode === 'build' && view.buildType === type) clearMode();
    else { view.mode = 'build'; view.buildType = type; view.selectedId = null; }
    refresh();
  } else if (act === 'hire') {
    hire();
  } else if (act === 'night') {
    clearMode();
    hooks.startNight();
  } else if (act.startsWith('dbg:')) {
    debugAction(act.slice(4));
  }
}

function clearMode() {
  view.mode = null;
  view.selectedId = null;
}

// 지금 모드에서 탭할 수 있는 칸
function computeValid() {
  const out = [];
  if (!view.mode) return null;
  for (let y = 0; y < D.GRID_H; y++) for (let x = 0; x < D.GRID_W; x++) {
    if (view.mode === 'build' && !buildingAt(x, y) && !residentAt(x, y)) out.push({ x, y });
    if (view.mode === 'move' && canMoveTo(selected(), x, y)) out.push({ x, y });
  }
  return out;
}

const apCost = type => D.BUILDINGS[type].ap ?? D.BUILD_AP;
const selected = () => state.residents.find(r => r.id === view.selectedId);

function canMoveTo(r, x, y) {
  if (!r || residentAt(x, y)) return false;
  const b = buildingAt(x, y);
  if (!b) return true;
  return !r.general && (b === 'field' || b === 'lumber' || b === 'tower');
}

export function handleTap(cell) {
  if (!cell) return;
  const { x, y } = cell;
  if (view.mode === 'build') {
    const type = view.buildType;
    const b = D.BUILDINGS[type];
    if (buildingAt(x, y) || residentAt(x, y)) { toast('빈 칸에만 지을 수 있어요'); return; }
    if (state.ap < apCost(type)) { toast('행동력이 없어요'); return; }
    if (!canAfford(b.cost)) { toast('자원이 모자라요'); return; }
    pay(b.cost);
    state.ap -= apCost(type);
    state.grid[idx(x, y)] = type;
    toast(`${b.emoji} ${b.name} 완성!`);
    // 행동력이 안 드는 건물(돌담)은 계속 이어서 짓기
    if (apCost(type) > 0 || !canAfford(b.cost)) clearMode();
    save();
    refresh();
    return;
  }

  const r = residentAt(x, y);
  if (view.mode === 'move') {
    const sel = selected();
    if (r && r.id === sel.id) { clearMode(); refresh(); return; }
    if (r) { view.selectedId = r.id; refresh(); return; }
    if (!canMoveTo(sel, x, y)) {
      const b = buildingAt(x, y);
      toast(sel.general && b ? '장군은 빈 칸에서만 싸워요' : '그 칸에는 갈 수 없어요');
      return;
    }
    sel.x = x; sel.y = y;
    const role = { guard: '🛡️ 수호대', farmer: '🌾 농부', lumber: '🪓 나무꾼', archer: '🏹 궁수' }[roleOf(sel)];
    toast(sel.general ? `${D.GENERALS[sel.general.type].name} 이동` : `${role}가 되었어요`);
    clearMode();
    save();
    refresh();
    return;
  }

  if (r) {
    view.mode = 'move';
    view.selectedId = r.id;
    refresh();
    return;
  }
  const b = buildingAt(x, y);
  if (b === 'tree') toast(`🌳 당산나무 — 쓰러지면 패배! 체력 ${D.TREE.hp}`);
  else if (b) toast(`${D.BUILDINGS[b].emoji} ${D.BUILDINGS[b].name}: ${D.BUILDINGS[b].desc}`);
}

// 새 주민은 당산나무에서 가까운 빈 칸에 선다
function hire() {
  if (state.residents.length >= maxResidents()) { toast('초가집이 더 필요해요'); return; }
  if (state.ap < D.RESIDENT.hireAp || !canAfford(D.RESIDENT.hireCost)) { toast('엽전이나 행동력이 모자라요'); return; }
  const spot = nearestFreeCell();
  if (!spot) { toast('빈 칸이 없어요'); return; }
  pay(D.RESIDENT.hireCost);
  state.ap -= D.RESIDENT.hireAp;
  const r = addResident(spot.x, spot.y);
  view.mode = 'move';
  view.selectedId = r.id;
  toast('새 주민이 왔어요! 놓을 칸을 탭하세요');
  save();
  refresh();
}

function nearestFreeCell() {
  const seen = new Set([idx(D.TREE_POS.x, D.TREE_POS.y)]);
  const q = [[D.TREE_POS.x, D.TREE_POS.y]];
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    if (!buildingAt(x, y) && !residentAt(x, y)) return { x, y };
    for (const [nx, ny] of [[x, y - 1], [x - 1, y], [x + 1, y], [x, y + 1]]) {
      if (inGrid(nx, ny) && !seen.has(idx(nx, ny))) { seen.add(idx(nx, ny)); q.push([nx, ny]); }
    }
  }
  return null;
}

function debugAction(a) {
  if (a === 'res') { gain(D.DEBUG_GIFT); state.ap = D.DAILY_AP; toast('자원 추가'); }
  if (a === 'gen') {
    const r = state.residents.find(x => !x.general && roleOf(x) === 'guard');
    if (!r) { toast('수호대가 없어요'); return; }
    if (generalCount() >= D.GENERAL.maxCount) { toast('장군은 최대 ' + D.GENERAL.maxCount + '명'); return; }
    promote(r);
    const g = D.GENERALS[r.general.type];
    toast(`${g.emoji} ${g.name} 승급! (${g.desc})`);
  }
  if (a === 'day') { hooks.skipDay(); return; }
  if (a === 'boss') { state.day = D.FINAL_DAY; toast('7일차로 이동'); enterDay(hooks); }
  save();
  refresh();
}
