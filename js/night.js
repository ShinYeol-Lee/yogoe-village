// 밤: 요괴 이동(BFS), 자동 전투, 이펙트
import * as D from './data.js';
import { state, idx, inGrid, roleOf } from './state.js';

export let N = null; // 현재 밤 상태
let onEnd = null;

const INF = 1e9;
const TX = D.TREE_POS.x + 0.5, TY = D.TREE_POS.y + 0.5;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

export function startNight(endCallback) {
  onEnd = endCallback;
  const day = state.day;
  const wave = D.WAVES[Math.min(day, D.WAVES.length) - 1];
  const generals = state.residents.filter(r => r.general && roleOf(r) === 'guard');
  const hasGen = t => generals.filter(r => r.general.type === t);

  N = {
    t: 0, speed: 1, done: false, endTimer: -1,
    enemies: [], units: [], towers: [], walls: {}, projectiles: [], fx: [], texts: [],
    spawnQueue: [], shake: 0, bossAlert: 0, bossBanner: null,
    kills: 0, coins: 0, treeDamage: 0, fled: 0,
    tree: { hp: D.TREE.hp, maxHp: D.TREE.hp, cd: 0 },
    treeDamageMult: 1, speedMult: 1, tigerLeft: 0,
  };

  // 장군 능력 (패시브)
  const owls = hasGen('owl');
  if (owls.length) {
    const lv = Math.max(...owls.map(r => r.general.level));
    N.speedMult = Math.max(0.4, D.GENERALS.owl.slowMult - D.GENERALS.owl.slowPerLevel * (lv - 1));
  }
  if (hasGen('bear').length) N.treeDamageMult = D.GENERALS.bear.treeDamageMult;
  if (hasGen('tiger').length) N.tigerLeft = D.GENERALS.tiger.count;

  // 수호대(빈 칸에 놓인 주민)
  let bearSlot = 0;
  for (const r of state.residents) {
    if (roleOf(r) !== 'guard') continue;
    let maxHp, damage, cooldown, range;
    if (r.general) {
      const lv = r.general.level;
      maxHp = D.GENERAL.hp + D.GENERAL.hpPerLevel * (lv - 1);
      damage = D.GENERAL.damage + D.GENERAL.damagePerLevel * (lv - 1);
      cooldown = D.GENERAL.cooldown;
      range = D.GENERAL.range;
    } else {
      ({ hp: maxHp, damage, cooldown, range } = D.RESIDENT.guard);
    }
    if (state.hungry) maxHp = Math.round(maxHp * D.RESIDENT.hungryHpMult);
    const u = { resId: r.id, general: r.general, x: r.x + 0.5, y: r.y + 0.5, hp: maxHp, maxHp, damage, cooldown, range, cd: 0, down: false, flash: 0, skillTimer: 0 };
    if (r.general && r.general.type === 'bear') { // 곰 장군은 당산나무 앞을 지킨다
      u.x = TX + (bearSlot++ * 0.3); u.y = TY - 0.85;
    }
    N.units.push(u);
  }

  // 돌담 (거북 장군 근처는 내구도 배수)
  const turtles = hasGen('turtle');
  // 망루 (매 장군 근처는 사거리·공속 증가)
  const hawks = hasGen('hawk');
  for (let y = 0; y < D.GRID_H; y++) for (let x = 0; x < D.GRID_W; x++) {
    const b = state.grid[idx(x, y)];
    if (b === 'wall') {
      let hp = D.BUILDINGS.wall.hp;
      if (turtles.some(r => dist(r.x, r.y, x, y) <= D.GENERALS.turtle.radius)) hp *= D.GENERALS.turtle.wallHpMult;
      N.walls[idx(x, y)] = { hp, maxHp: hp };
    } else if (b === 'tower') {
      const T = D.BUILDINGS.tower;
      const buffed = hawks.some(r => dist(r.x, r.y, x, y) <= D.GENERALS.hawk.radius);
      N.towers.push({
        x: x + 0.5, y: y + 0.5, damage: T.damage, cd: rand(0, 0.5),
        range: T.range + (buffed ? D.GENERALS.hawk.rangeBonus : 0),
        cooldown: T.cooldown * (buffed ? D.GENERALS.hawk.cooldownMult : 1),
      });
    }
  }
  computeFields();

  // 등장 순서
  for (const g of wave) {
    const gap = Math.min(D.NIGHT.maxSpawnGap, D.NIGHT.spawnWindow / g.count);
    for (let i = 0; i < g.count; i++) N.spawnQueue.push({ time: (g.delay || 0) + i * gap + rand(0, 0.3), type: g.type, dir: g.dir });
  }
  N.spawnQueue.sort((a, b) => a.time - b.time);
}

// ---- 경로: 당산나무에서 BFS ----
// dist1: 돌담을 피해 가는 거리, dist2: 돌담을 무시한 거리(막혔을 때 부수며 가는 길)
function computeFields() {
  N.dist1 = bfs(true);
  N.dist2 = bfs(false);
}

function bfs(wallsBlock) {
  const d = new Array(D.GRID_W * D.GRID_H).fill(INF);
  const q = [[D.TREE_POS.x, D.TREE_POS.y]];
  d[idx(D.TREE_POS.x, D.TREE_POS.y)] = 0;
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (!inGrid(nx, ny)) continue;
      const i = idx(nx, ny);
      if (d[i] !== INF) continue;
      if (wallsBlock && N.walls[i]) continue;
      d[i] = d[idx(x, y)] + 1;
      q.push([nx, ny]);
    }
  }
  return d;
}

function nextCell(e) {
  const c = idx(e.cx, e.cy);
  const field = N.dist1[c] < INF ? N.dist1 : N.dist2;
  const options = [];
  for (const [nx, ny] of [[e.cx + 1, e.cy], [e.cx - 1, e.cy], [e.cx, e.cy + 1], [e.cx, e.cy - 1]]) {
    if (!inGrid(nx, ny)) continue;
    if (field[idx(nx, ny)] === field[c] - 1) options.push([nx, ny]);
  }
  return options.length ? pick(options) : null;
}

// ---- 생성 ----
function spawn(item) {
  const def = D.ENEMIES[item.type];
  let x, y, cx, cy;
  if (item.dir === 'top') {
    cx = Math.floor(Math.random() * D.GRID_W); cy = 0;
    if (def.boss) cx = D.TREE_POS.x;
    x = cx + 0.5; y = -0.5;
  } else {
    cy = Math.floor(Math.random() * D.NIGHT.sideRows);
    cx = item.dir === 'left' ? 0 : D.GRID_W - 1;
    x = item.dir === 'left' ? -0.5 : D.GRID_W + 0.5; y = cy + 0.5;
  }
  const hp = def.boss ? def.hp : Math.round(def.hp * (1 + D.ENEMY_HP_PER_DAY * (state.day - 1)));
  const e = {
    type: item.type, x, y, cx, cy, hp, maxHp: hp, cd: 0, age: 0, flash: 0,
    jx: def.boss ? 0 : rand(-0.12, 0.12), jy: def.boss ? 0 : rand(-0.12, 0.12),
    engaged: null, wallTarget: -1, tiger: false,
  };
  if (!def.flying && N.walls[idx(cx, cy)]) e.wallTarget = idx(cx, cy); // 입구가 돌담이면 바로 부수기 시작
  if (N.tigerLeft > 0) { N.tigerLeft--; e.tiger = true; }
  N.enemies.push(e);
  if (def.boss) {
    N.shake = D.FX.shakeBoss;
    N.bossAlert = D.FX.bossBannerTime;
    N.bossBanner = `⚠️ ${def.name} 출현! ⚠️`;
    N.boss = e;
  }
}

// ---- 이펙트 ----
function addFx(f) { if (N.fx.length < D.FX.maxEffects) N.fx.push(f); }
function addText(x, y, text, color, size = 0.32) {
  if (N.texts.length < D.FX.maxEffects) N.texts.push({ x, y, text, color, size, t: 0, life: D.FX.textLife });
}
function burst(x, y, color, size) {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(0.4, 0.8) * size * 1.5;
    parts.push({ vx: Math.cos(a) * s, vy: Math.sin(a) * s });
  }
  addFx({ kind: 'burst', x, y, color, size, parts, t: 0, life: D.FX.burstLife });
}

function damageEnemy(e, amount, color = '#fff') {
  if (e.hp <= 0) return;
  e.hp -= amount;
  e.flash = D.FX.flashTime;
  addText(e.x + e.jx, e.y + e.jy - 0.3, String(Math.round(amount)), color, D.ENEMIES[e.type].boss ? 0.42 : 0.32);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  const def = D.ENEMIES[e.type];
  N.kills++;
  N.coins += def.coin;
  burst(e.x + e.jx, e.y + e.jy, def.boss ? '#ffb347' : '#fff3b0', def.boss ? 1.4 : 0.5);
  addFx({ kind: 'emoji', emoji: '💥', x: e.x + e.jx, y: e.y + e.jy, size: def.boss ? 1.5 : 0.6, t: 0, life: 0.4 });
  addText(e.x + e.jx, e.y + e.jy - 0.5, def.boss ? '펑!!!' : '펑!', '#ffe066', def.boss ? 0.6 : 0.3);
  if (def.boss) N.shake = D.FX.shakeBoss;
}

function damageUnit(u, amount) {
  u.hp -= amount;
  u.flash = D.FX.flashTime;
  addText(u.x, u.y - 0.4, String(Math.round(amount)), '#ff8a80', 0.26);
  if (u.hp <= 0) {
    u.hp = 0; u.down = true;
    addFx({ kind: 'emoji', emoji: '💫', x: u.x, y: u.y, size: 0.5, t: 0, life: 0.6 });
  }
}

function damageTree(amount, big) {
  const dmg = amount * N.treeDamageMult;
  N.tree.hp -= dmg;
  N.treeDamage += dmg;
  addText(TX, TY - 0.5, String(Math.round(dmg)), '#ff5252', big ? 0.45 : 0.3);
  if (big) N.shake = Math.max(N.shake, D.FX.shakeBigHit);
}

// ---- 업데이트 ----
export function update(realDt) {
  if (!N || N.done) return;
  let left = realDt * N.speed;
  while (left > 0 && !N.done) {
    const dt = Math.min(D.NIGHT.step, left);
    step(dt);
    left -= dt;
  }
}

// 남은 밤을 즉시 계산
export function skip() {
  if (!N || N.done) return;
  let guard = 0;
  while (!N.done && guard++ < 100000) step(D.NIGHT.skipStep);
  N.fx.length = 0; N.texts.length = 0; N.shake = 0; N.bossBanner = null;
}

function step(dt) {
  N.t += dt;
  N.shake = Math.max(0, N.shake - D.FX.shakeDecay * dt);
  N.bossAlert = Math.max(0, N.bossAlert - dt);

  while (N.spawnQueue.length && N.spawnQueue[0].time <= N.t) spawn(N.spawnQueue.shift());

  for (const e of N.enemies) updateEnemy(e, dt);
  for (const u of N.units) updateUnit(u, dt);
  for (const t of N.towers) updateTower(t, dt);
  updateTree(dt);
  updateProjectiles(dt);
  N.enemies = N.enemies.filter(e => e.hp > 0);

  for (const f of N.fx) f.t += dt;
  for (const t of N.texts) t.t += dt;
  N.fx = N.fx.filter(f => f.t < f.life);
  N.texts = N.texts.filter(t => t.t < t.life);

  // 끝 판정
  if (N.tree.hp <= 0) { N.tree.hp = 0; finish(false); return; }
  if (N.endTimer < 0) {
    if (!N.spawnQueue.length && !N.enemies.length) N.endTimer = D.NIGHT.endDelay;
    else if (N.t >= D.NIGHT.maxDuration) { // 동이 트면 남은 요괴는 도망
      N.fled = N.enemies.length + N.spawnQueue.length;
      N.enemies = []; N.spawnQueue = [];
      N.endTimer = D.NIGHT.endDelay;
    }
  } else {
    N.endTimer -= dt;
    if (N.endTimer <= 0) finish(true);
  }
}

function finish(win) {
  N.done = true;
  N.win = win;
  const cb = onEnd;
  setTimeout(() => cb && cb(N), win ? 0 : 900);
}

function nearestEnemy(x, y, range) {
  let best = null, bd = range;
  for (const e of N.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(x, y, e.x, e.y);
    if (d <= bd) { bd = d; best = e; }
  }
  return best;
}

function updateEnemy(e, dt) {
  const def = D.ENEMIES[e.type];
  e.age += dt;
  e.flash = Math.max(0, e.flash - dt);
  e.cd = Math.max(0, e.cd - dt);
  if (e.hp <= 0) return;

  // 호랑이 장군: 처음 오는 요괴 한 방
  if (e.tiger && e.age >= D.GENERALS.tiger.delay) {
    e.tiger = false;
    addFx({ kind: 'emoji', emoji: '🐯', x: e.x, y: e.y - 0.2, size: 1.0, t: 0, life: 0.6 });
    addFx({ kind: 'line', x: e.x - 0.5, y: e.y - 0.5, x2: e.x + 0.5, y2: e.y + 0.5, color: '#ffcc33', t: 0, life: 0.35 });
    N.shake = Math.max(N.shake, D.FX.shakeBigHit);
    damageEnemy(e, def.boss ? e.maxHp * D.GENERALS.tiger.bossDamageRatio : e.hp, '#ffcc33');
    if (e.hp <= 0) return;
  }

  // 당산나무 공격
  if (dist(e.x, e.y, TX, TY) <= D.NIGHT.treeReach * Math.max(1, def.size)) {
    if (e.cd <= 0) { e.cd = def.cooldown; damageTree(def.damage, def.boss); }
    return;
  }

  // 수호대에 붙잡힘 (날아다니는 요괴 제외)
  if (!def.flying) {
    if (e.engaged && (e.engaged.down || dist(e.x, e.y, e.engaged.x, e.engaged.y) > D.NIGHT.engageDist * Math.max(1, def.size) + 0.2)) e.engaged = null;
    if (!e.engaged) {
      for (const u of N.units) {
        if (!u.down && dist(e.x, e.y, u.x, u.y) <= D.NIGHT.engageDist * Math.max(1, def.size)) { e.engaged = u; break; }
      }
    }
    if (e.engaged) {
      if (e.cd <= 0) {
        e.cd = def.cooldown; damageUnit(e.engaged, def.damage);
        if (def.boss) N.shake = Math.max(N.shake, D.FX.shakeBigHit);
      }
      return;
    }
  }

  const speed = def.speed * N.speedMult;

  // 도깨비불: 곧장 날아온다
  if (def.flying) {
    moveToward(e, TX, TY, speed * dt);
    return;
  }

  // 돌담 공격 중
  if (e.wallTarget >= 0) {
    const w = N.walls[e.wallTarget];
    if (!w) { e.wallTarget = -1; return; }
    if (e.cd <= 0) {
      e.cd = def.cooldown;
      w.hp -= def.damage;
      const wx = e.wallTarget % D.GRID_W + 0.5, wy = Math.floor(e.wallTarget / D.GRID_W) + 0.5;
      addText(wx, wy - 0.3, String(def.damage), '#ffcc80', 0.24);
      if (w.hp <= 0) {
        delete N.walls[e.wallTarget];
        burst(wx, wy, '#b0a090', 0.6);
        computeFields();
        e.wallTarget = -1;
        // 길이 뚫렸으면 다른 돌담을 치던 요괴도 다시 걷는다
        for (const o of N.enemies) if (o.wallTarget >= 0 && N.dist1[idx(o.cx, o.cy)] < INF) o.wallTarget = -1;
      }
    }
    return;
  }

  // 칸 중심으로 이동, 도착하면 다음 칸 결정
  const gx = e.cx + 0.5, gy = e.cy + 0.5;
  if (dist(e.x, e.y, gx, gy) > 0.02) {
    moveToward(e, gx, gy, speed * dt);
    return;
  }
  const n = nextCell(e);
  if (!n) return;
  const ni = idx(n[0], n[1]);
  if (N.walls[ni]) { e.wallTarget = ni; return; }
  e.cx = n[0]; e.cy = n[1];
}

function moveToward(e, x, y, d) {
  const dx = x - e.x, dy = y - e.y;
  const len = Math.hypot(dx, dy);
  if (len <= d) { e.x = x; e.y = y; return; }
  e.x += dx / len * d;
  e.y += dy / len * d;
}

function updateUnit(u, dt) {
  u.flash = Math.max(0, u.flash - dt);
  if (u.down) return;
  u.cd = Math.max(0, u.cd - dt);

  // 멧돼지 장군: 요괴 무리에 돌진
  if (u.general && u.general.type === 'boar') {
    u.skillTimer += dt;
    const B = D.GENERALS.boar;
    if (u.skillTimer >= B.interval) {
      let best = null, bestCount = 0;
      for (const e of N.enemies) {
        if (e.hp <= 0 || dist(u.x, u.y, e.x, e.y) > B.reach) continue;
        const c = N.enemies.filter(o => o.hp > 0 && dist(o.x, o.y, e.x, e.y) <= B.radius).length;
        if (c > bestCount) { bestCount = c; best = e; }
      }
      if (best) {
        u.skillTimer = 0;
        const tx = best.x, ty = best.y;
        addFx({ kind: 'line', x: u.x, y: u.y, x2: tx, y2: ty, color: '#c58b4a', t: 0, life: 0.4 });
        addFx({ kind: 'emoji', emoji: '🐗', x: tx, y: ty, size: 0.9, t: 0, life: 0.5 });
        burst(tx, ty, '#e0b080', B.radius);
        N.shake = Math.max(N.shake, D.FX.shakeBigHit);
        const dmg = B.damage + B.damagePerLevel * (u.general.level - 1);
        for (const e of N.enemies) if (dist(tx, ty, e.x, e.y) <= B.radius) damageEnemy(e, dmg, '#ffb74d');
      }
    }
  }

  if (u.cd > 0) return;
  const target = nearestEnemy(u.x, u.y, u.range);
  if (!target) return;
  u.cd = u.cooldown;
  addFx({ kind: 'emoji', emoji: '⚔️', x: (u.x + target.x) / 2, y: (u.y + target.y) / 2, size: 0.35, t: 0, life: 0.2 });
  damageEnemy(target, u.damage, u.general ? '#ffe066' : '#fff');
}

function updateTower(t, dt) {
  t.cd = Math.max(0, t.cd - dt);
  if (t.cd > 0) return;
  const target = nearestEnemy(t.x, t.y, t.range);
  if (!target) return;
  t.cd = t.cooldown;
  N.projectiles.push({ x: t.x, y: t.y - 0.25, target, damage: t.damage });
}

function updateTree(dt) {
  N.tree.cd = Math.max(0, N.tree.cd - dt);
  if (N.tree.cd > 0) return;
  const target = nearestEnemy(TX, TY, D.TREE.range);
  if (!target) return;
  N.tree.cd = D.TREE.cooldown;
  addFx({ kind: 'emoji', emoji: '🍃', x: target.x, y: target.y, size: 0.4, t: 0, life: 0.3 });
  damageEnemy(target, D.TREE.damage, '#b9f6ca');
}

function updateProjectiles(dt) {
  for (const p of N.projectiles) {
    const e = p.target;
    if (e.hp <= 0) { p.dead = true; continue; }
    const d = D.NIGHT.projectileSpeed * dt;
    if (dist(p.x, p.y, e.x, e.y) <= d) {
      p.dead = true;
      damageEnemy(e, p.damage);
    } else {
      moveToward(p, e.x, e.y, d);
    }
  }
  N.projectiles = N.projectiles.filter(p => !p.dead);
}
