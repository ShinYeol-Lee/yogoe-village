// 아침: 결산, 랜덤 사건, 장군 승급
import * as D from './data.js';
import { state, roleOf, generalCount, gain, save, takeSnapshot } from './state.js';
import { showCard, updateHud } from './ui.js';

function weighted(list) {
  let r = Math.random() * list.reduce((s, x) => s + x.weight, 0);
  for (const x of list) { r -= x.weight; if (r < 0) return x; }
  return list[list.length - 1];
}

export function rollGeneral() {
  const grade = weighted(D.GENERAL.grades);
  const types = Object.keys(D.GENERALS).filter(k => D.GENERALS[k].grade === grade.id);
  return types[Math.floor(Math.random() * types.length)];
}

export function promote(r) {
  r.general = { type: rollGeneral(), level: 1 };
  return r;
}

// 밤 결과를 상태에 반영하고 보고서 데이터를 돌려준다
function settle(N) {
  const s = state;
  const rep = { day: s.day, kills: N.kills, coins: N.coins, treeDamage: Math.round(N.treeDamage), fled: N.fled, rice: 0, wood: 0, upkeep: 0, hungry: false, promoted: [], levelUps: 0, event: null };

  s.coin += N.coins;
  s.totalKills += N.kills;

  // 수호대 생존·장군 레벨업
  const downIds = new Set(N.units.filter(u => u.down).map(u => u.resId));
  for (const r of s.residents) {
    if (roleOf(r) !== 'guard') continue;
    if (r.general) {
      if (r.general.level < D.GENERAL.maxLevel) { r.general.level++; rep.levelUps++; }
    } else if (!downIds.has(r.id)) {
      r.survivals++;
    }
  }
  for (const r of s.residents) {
    if (!r.general && roleOf(r) === 'guard' && r.survivals >= D.GENERAL.promoteSurvivals && generalCount() < D.GENERAL.maxCount) {
      rep.promoted.push(promote(r));
    }
  }

  // 생산
  for (let i = 0; i < s.grid.length; i++) {
    const b = s.grid[i];
    if (b !== 'field' && b !== 'lumber') continue;
    const x = i % D.GRID_W, y = Math.floor(i / D.GRID_W);
    const worked = s.residents.some(r => r.x === x && r.y === y);
    for (const [k, v] of Object.entries(D.BUILDINGS[b].produce)) rep[k] += v * (worked ? D.WORKER_MULT : 1);
  }
  s.rice += rep.rice;
  s.wood += rep.wood;

  // 주민 유지비
  rep.upkeep = s.residents.length * D.RESIDENT.riceUpkeep;
  s.hungry = s.rice < rep.upkeep;
  rep.hungry = s.hungry;
  s.rice = Math.max(0, s.rice - rep.upkeep);

  // 다음 날로
  s.day++;
  s.ap = D.DAILY_AP;

  // 랜덤 사건
  if (s.day >= D.EVENT_START_DAY) {
    rep.event = weighted(D.EVENTS);
    if (rep.event.reward) gain(rep.event.reward);
  }
  return rep;
}

function resText(obj) {
  return Object.entries(obj).filter(([, v]) => v).map(([k, v]) => `${D.RESOURCES[k].emoji}+${v}`).join(' ');
}

export function showMorning(N, done) {
  const rep = settle(N);
  takeSnapshot();
  save();
  updateHud();

  const ev = rep.event;
  let evHtml = '';
  if (ev) {
    evHtml = `<div class="event"><div class="ev-title">${ev.emoji} ${ev.name}</div><div>${ev.text}</div>`;
    if (ev.reward) evHtml += `<div class="ev-reward">${resText(ev.reward)}</div>`;
    if (ev.trade) {
      const t = ev.trade;
      evHtml += `<div class="row trade">
        <button data-act="r2w" ${state.rice < t ? 'disabled' : ''}>🍚${t} → 🪵${t}</button>
        <button data-act="w2r" ${state.wood < t ? 'disabled' : ''}>🪵${t} → 🍚${t}</button>
        <button data-act="no" class="ghost">거절</button></div>`;
    }
    evHtml += '</div>';
  }

  const html = `
    <h2>☀️ ${rep.day + 1}일차 아침</h2>
    <p class="sub">${rep.day}일차 밤을 무사히 넘겼어요!</p>
    <ul class="report">
      <li>👊 처치 <b>${rep.kills}</b>마리 → 🪙+${rep.coins}</li>
      ${rep.fled ? `<li>🌅 동이 트자 ${rep.fled}마리가 도망갔어요</li>` : ''}
      <li>🌳 당산나무 피해 <b>${rep.treeDamage}</b> (아침에 회복)</li>
      <li>🌾 생산 🍚+${rep.rice} 🪵+${rep.wood}</li>
      <li>🍚 주민 식사 -${rep.upkeep}${rep.hungry ? ' <span class="warn">쌀 부족! 오늘 밤 수호대 체력 감소</span>' : ''}</li>
      ${rep.levelUps ? `<li>⚔️ 장군 레벨업 ×${rep.levelUps}</li>` : ''}
    </ul>
    ${evHtml}
    <button data-act="next" class="big">${rep.promoted.length ? '다음 ▶' : '☀️ 낮 시작'}</button>`;

  const finishEvent = () => { takeSnapshot(); save(); updateHud(); };
  const actions = {
    r2w: () => { state.rice -= ev.trade; state.wood += ev.trade; tradeDone('🪵 나무를 받았어요'); },
    w2r: () => { state.wood -= ev.trade; state.rice += ev.trade; tradeDone('🍚 쌀을 받았어요'); },
    no: () => tradeDone('상인이 떠났어요'),
    next: () => showPromotions(rep.promoted, done),
  };
  function tradeDone(msg) {
    finishEvent();
    const row = document.querySelector('.trade');
    if (row) row.outerHTML = `<div class="ev-reward">${msg}</div>`;
  }
  showCard(html, actions);
}

function showPromotions(list, done) {
  if (!list.length) { done(); return; }
  const r = list[0];
  const g = D.GENERALS[r.general.type];
  const grade = D.GENERAL.grades.find(x => x.id === g.grade);
  showCard(`
    <h2>🎉 장군이 되었습니다!</h2>
    <p class="sub">수호대가 ${D.GENERAL.promoteSurvivals}번의 밤을 버텼어요</p>
    <div class="gacha"><span class="gacha-emoji">❔</span></div>
    <div class="gacha-result hidden">
      <div class="grade" style="background:${grade.color}">${grade.name}</div>
      <div class="gname">${g.emoji} ${g.name}</div>
      <div class="gdesc">${g.desc}</div>
    </div>
    <button data-act="next" class="big" disabled>...</button>`, {
    next: () => showPromotions(list.slice(1), done),
  }, 'promo');

  // 뽑기 연출: 이모지가 빠르게 돌다가 멈춘다
  const el = document.querySelector('.gacha-emoji');
  const emojis = Object.values(D.GENERALS).map(x => x.emoji);
  let n = 0;
  const timer = setInterval(() => {
    el.textContent = emojis[n++ % emojis.length];
    if (n > 14) {
      clearInterval(timer);
      el.textContent = g.emoji;
      el.parentElement.classList.add('done', g.grade);
      document.querySelector('.gacha-result').classList.remove('hidden');
      const btn = document.querySelector('.card [data-act="next"]');
      btn.disabled = false;
      btn.textContent = list.length > 1 ? '다음 ▶' : '☀️ 낮 시작';
    }
  }, 90);
}
