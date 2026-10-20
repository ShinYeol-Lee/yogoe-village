// 캔버스 그리기. 좌표는 '칸' 단위(칸 중심 = 정수 + 0.5)
import * as D from './data.js';
import { state, idx, roleOf } from './state.js';

const FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const PAD_SIDE = 0.75; // 격자 좌우 여백(칸) — 요괴 등장 구역
const PAD_TOP = 0.9;
const PAD_BOTTOM = 0.15;

let canvas, ctx, dpr = 1, W = 0, H = 0;
let cs = 40, ox = 0, oy = 0;
const spriteCache = new Map();

export function initRender(c) {
  canvas = c;
  ctx = c.getContext('2d');
}

export function resize() {
  const box = canvas.parentElement.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = box.width; H = box.height;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  cs = Math.floor(Math.min(W / (D.GRID_W + PAD_SIDE * 2), H / (D.GRID_H + PAD_TOP + PAD_BOTTOM)));
  ox = (W - cs * D.GRID_W) / 2;
  oy = (H - cs * (D.GRID_H + PAD_TOP + PAD_BOTTOM)) / 2 + cs * PAD_TOP;
  spriteCache.clear();
}

export function cellFromPoint(px, py) {
  const x = Math.floor((px - ox) / cs);
  const y = Math.floor((py - oy) / cs);
  if (x < 0 || y < 0 || x >= D.GRID_W || y >= D.GRID_H) return null;
  return { x, y };
}

const sx = x => ox + x * cs;
const sy = y => oy + y * cs;

// 이모지는 미리 오프스크린 캔버스에 그려두고 재사용 (저사양 폰 성능)
function sprite(emoji, size) {
  const px = Math.max(8, Math.round(size * dpr));
  const key = emoji + '|' + px;
  let c = spriteCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    const pad = Math.ceil(px * 0.2);
    c.width = c.height = px + pad * 2;
    const g = c.getContext('2d');
    g.font = `${px}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, c.width / 2, c.height / 2 + px * 0.06);
    c.drawSize = c.width / dpr;
    spriteCache.set(key, c);
  }
  return c;
}

function emoji(e, x, y, size, alpha = 1, flash = false) {
  const s = sprite(e, size);
  const d = s.drawSize;
  if (alpha !== 1) ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - d / 2, y - d / 2, d, d);
  if (flash) { // 피격 번쩍임: 같은 그림을 'lighter'로 덧그리기
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(s, x - d / 2, y - d / 2, d, d);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;
}

function bar(x, y, w, ratio, color) {
  const h = Math.max(3, cs * 0.08);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(x - w / 2, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * Math.max(0, ratio), h);
}

function text(t, x, y, size, color, stroke = 'rgba(0,0,0,0.6)') {
  ctx.font = `bold ${Math.round(size)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size * 0.18);
  ctx.strokeStyle = stroke;
  ctx.strokeText(t, x, y);
  ctx.fillStyle = color;
  ctx.fillText(t, x, y);
}

function drawGround(night) {
  ctx.fillStyle = night ? '#1d2440' : '#cfe6b8';
  ctx.fillRect(0, 0, W, H);
  // 등장 구역 표시
  ctx.fillStyle = night ? 'rgba(120,60,140,0.25)' : 'rgba(170,140,100,0.18)';
  ctx.fillRect(0, 0, W, oy);
  ctx.fillRect(0, oy, ox, cs * D.NIGHT.sideRows);
  ctx.fillRect(ox + cs * D.GRID_W, oy, W - ox - cs * D.GRID_W, cs * D.NIGHT.sideRows);
  for (let y = 0; y < D.GRID_H; y++) {
    for (let x = 0; x < D.GRID_W; x++) {
      const even = (x + y) % 2 === 0;
      ctx.fillStyle = night ? (even ? '#2c3a52' : '#28354b') : (even ? '#a9d18e' : '#9fca83');
      ctx.fillRect(sx(x), sy(y), cs, cs);
    }
  }
}

function highlight(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(sx(x) + 2, sy(y) + 2, cs - 4, cs - 4);
}

function outline(x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.strokeRect(sx(x) + 2, sy(y) + 2, cs - 4, cs - 4);
}

// 돌담·망루가 붙어 있으면 이어진 성벽으로 그린다
function isFort(x, y, walls) {
  if (x < 0 || y < 0 || x >= D.GRID_W || y >= D.GRID_H) return false;
  const b = state.grid[idx(x, y)];
  if (b === 'tower') return true;
  return b === 'wall' && (!walls || !!walls[idx(x, y)]);
}

function drawWall(x, y, night, walls) {
  const m = cs * 0.16, X = sx(x), Y = sy(y);
  ctx.fillStyle = night ? '#7d766c' : '#a39886';
  ctx.fillRect(X + m, Y + m, cs - m * 2, cs - m * 2);
  if (isFort(x - 1, y, walls)) ctx.fillRect(X, Y + m, m, cs - m * 2);
  if (isFort(x + 1, y, walls)) ctx.fillRect(X + cs - m, Y + m, m, cs - m * 2);
  if (isFort(x, y - 1, walls)) ctx.fillRect(X + m, Y, cs - m * 2, m);
  if (isFort(x, y + 1, walls)) ctx.fillRect(X + m, Y + cs - m, cs - m * 2, m);
  // 돌 줄눈과 위쪽 성가퀴
  ctx.strokeStyle = night ? '#4f4a43' : '#6e6556';
  ctx.lineWidth = Math.max(1, cs * 0.03);
  ctx.beginPath();
  ctx.moveTo(X + m, Y + cs / 2); ctx.lineTo(X + cs - m, Y + cs / 2);
  ctx.moveTo(X + cs / 2, Y + m); ctx.lineTo(X + cs / 2, Y + cs / 2);
  ctx.moveTo(X + cs * 0.33, Y + cs / 2); ctx.lineTo(X + cs * 0.33, Y + cs - m);
  ctx.moveTo(X + cs * 0.67, Y + cs / 2); ctx.lineTo(X + cs * 0.67, Y + cs - m);
  ctx.stroke();
  ctx.fillStyle = night ? '#958c80' : '#c2b6a2';
  const t = cs * 0.12;
  for (let i = 0; i < 3; i++) ctx.fillRect(X + m + i * (cs - m * 2 - t) / 2, Y + m - t * 0.6, t, t * 0.6);
}

function drawBuildings(night, walls) {
  for (let y = 0; y < D.GRID_H; y++) {
    for (let x = 0; x < D.GRID_W; x++) {
      const b = state.grid[idx(x, y)];
      if (!b || b === 'tree') continue;
      const cx = sx(x + 0.5), cy = sy(y + 0.5);
      if (b === 'wall') {
        const w = walls && walls[idx(x, y)];
        if (walls && !w) { emoji('🪨', cx, cy, cs * 0.35, 0.6); continue; } // 부서진 돌담
        drawWall(x, y, night, walls);
        if (w && w.hp < w.maxHp) bar(cx, sy(y) + cs * 0.86, cs * 0.7, w.hp / w.maxHp, '#d9a066');
        continue;
      }
      emoji(D.BUILDINGS[b].emoji, cx, cy, cs * 0.72, night && b !== 'tower' ? 0.7 : 1);
    }
  }
}

function drawTree(hp, maxHp) {
  const cx = sx(D.TREE_POS.x + 0.5), cy = sy(D.TREE_POS.y + 0.5);
  emoji(D.TREE.emoji, cx, cy, cs * 0.95);
  if (hp !== undefined) bar(cx, sy(D.TREE_POS.y) + cs * 0.9, cs * 0.9, hp / maxHp, '#5cd65c');
}

// 낮 화면
export function drawDay(view) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawGround(false);
  // 선택 모드 표시
  if (view.validCells) for (const c of view.validCells) highlight(c.x, c.y, 'rgba(255,255,255,0.45)');
  drawBuildings(false);
  drawTree();
  for (const r of state.residents) {
    const cx = sx(r.x + 0.5), cy = sy(r.y + 0.5);
    const role = roleOf(r);
    if (r.general) {
      emoji(D.GENERALS[r.general.type].emoji, cx, cy, cs * 0.7);
      text('Lv' + r.general.level, cx, sy(r.y) + cs * 0.88, cs * 0.22, '#ffe066');
    } else if (role === 'guard') {
      emoji(D.RESIDENT.emoji.guard, cx, cy, cs * 0.66);
      // 생존 횟수 점
      const n = D.GENERAL.promoteSurvivals;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i < r.survivals ? '#ffd23f' : 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.arc(cx + (i - (n - 1) / 2) * cs * 0.13, sy(r.y) + cs * 0.9, cs * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      emoji(D.RESIDENT.emoji[role], sx(r.x + 0.75), sy(r.y + 0.72), cs * 0.42);
    }
    if (view.selectedId === r.id) outline(r.x, r.y, '#ffdd00');
  }
  drawPreview(view.wave);
}

// 오늘 밤 올 요괴를 등장 구역에 표시
function drawPreview(wave) {
  if (!wave) return;
  const groups = { top: [], left: [], right: [] };
  for (const g of wave) groups[g.dir].push(g);
  const sz = cs * 0.38;
  groups.top.forEach((g, i) => {
    const n = groups.top.length;
    const x = W / 2 + (i - (n - 1) / 2) * cs * 1.3;
    emoji(D.ENEMIES[g.type].emoji, x - sz * 0.5, oy - cs * 0.45, sz);
    text('×' + g.count, x + sz * 0.6, oy - cs * 0.45, sz * 0.8, '#fff');
  });
  for (const side of ['left', 'right']) {
    const x = side === 'left' ? ox / 2 : W - ox / 2;
    groups[side].forEach((g, i) => {
      const y = oy + cs * (1 + i * 1.2);
      emoji(D.ENEMIES[g.type].emoji, x, y, sz);
      text('×' + g.count, x, y + sz * 0.9, sz * 0.7, '#fff');
    });
  }
}

// 밤 화면
export function drawNight(N) {
  let shx = 0, shy = 0;
  if (N.shake > 0) {
    shx = (Math.random() - 0.5) * N.shake;
    shy = (Math.random() - 0.5) * N.shake;
  }
  ctx.setTransform(dpr, 0, 0, dpr, shx * dpr, shy * dpr);
  drawGround(true);
  drawBuildings(true, N.walls);
  drawTree(N.tree.hp, N.tree.maxHp);

  for (const t of N.towers) {
    if (t.archer) emoji(D.RESIDENT.emoji.archer, sx(t.x + 0.25), sy(t.y + 0.22), cs * 0.4);
    if (N.towerHaste > 0) emoji('✨', sx(t.x - 0.25), sy(t.y - 0.3), cs * 0.3);
  }
  if (N.treeInvuln > 0) {
    ctx.strokeStyle = 'rgba(255,230,100,0.8)';
    ctx.lineWidth = cs * 0.08;
    ctx.beginPath();
    ctx.arc(sx(D.TREE_POS.x + 0.5), sy(D.TREE_POS.y + 0.5), cs * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const u of N.units) {
    const cx = sx(u.x), cy = sy(u.y);
    const e = u.general ? D.GENERALS[u.general.type].emoji : D.RESIDENT.emoji.guard;
    if (u.down) {
      emoji(e, cx, cy, cs * 0.6, 0.35);
      emoji('💫', cx, cy - cs * 0.3, cs * 0.3);
    } else {
      emoji(e, cx, cy, cs * (u.general ? 0.7 : 0.62), 1, u.flash > 0);
      bar(cx, cy + cs * 0.36, cs * 0.6, u.hp / u.maxHp, '#4fc3f7');
    }
  }

  for (const e of N.enemies) {
    const def = D.ENEMIES[e.type];
    const cx = sx(e.x) + e.jx * cs, cy = sy(e.y) + e.jy * cs;
    const bob = Math.sin(e.age * 8) * cs * 0.03;
    emoji(def.emoji, cx, cy + (N.freeze > 0 ? 0 : bob), cs * def.size, 1, e.flash > 0);
    if (N.freeze > 0) emoji('❄️', cx + cs * 0.25, cy - cs * 0.25, cs * 0.3);
    if (e.hp < e.maxHp && !def.boss) bar(cx, cy + cs * def.size * 0.5, cs * 0.6, e.hp / e.maxHp, '#ff5c5c');
  }

  ctx.fillStyle = '#ffe9a8';
  for (const p of N.projectiles) {
    ctx.beginPath();
    ctx.arc(sx(p.x), sy(p.y), Math.max(2, cs * 0.07), 0, Math.PI * 2);
    ctx.fill();
  }

  for (const f of N.fx) {
    const k = f.t / f.life;
    if (f.kind === 'burst') {
      ctx.globalAlpha = 1 - k;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(sx(f.x), sy(f.y), cs * f.size * (0.3 + k), 0, Math.PI * 2);
      ctx.fill();
      for (const p of f.parts) {
        ctx.beginPath();
        ctx.arc(sx(f.x + p.vx * k), sy(f.y + p.vy * k), cs * 0.06 * (1 - k), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (f.kind === 'emoji') {
      emoji(f.emoji, sx(f.x), sy(f.y) - k * cs * 0.3, cs * f.size * (1 + k * 0.4), 1 - k * k);
    } else if (f.kind === 'line') {
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = cs * 0.12;
      ctx.beginPath();
      ctx.moveTo(sx(f.x), sy(f.y));
      ctx.lineTo(sx(f.x2), sy(f.y2));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  for (const t of N.texts) {
    const k = t.t / t.life;
    ctx.globalAlpha = 1 - k * k;
    text(t.text, sx(t.x), sy(t.y) - k * cs * 0.6, cs * t.size, t.color);
    ctx.globalAlpha = 1;
  }

  // 밤 분위기 비네팅
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, N.bossAlert > 0 ? 'rgba(160,0,0,0.45)' : 'rgba(0,0,10,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
