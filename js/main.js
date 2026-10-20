// 진입점: 화면 전환과 그리기 루프
import * as D from './data.js';
import { state, newGame, load, hasSave, clearSave, rollback, rollbackTarget, save } from './state.js';
import { $, showCard, hideCard, setPanel, setInfo, updateHud, showBanner, toast } from './ui.js';
import { initRender, resize, cellFromPoint, drawDay, drawNight } from './render.js';
import { enterDay, handleTap, view } from './day.js';
import * as night from './night.js';
import { showMorning } from './morning.js';

let screen = 'title';
const canvas = $('cv');

function goTitle() {
  screen = 'title';
  const can = hasSave() && load();
  showCard(`
    <div class="title-emoji">🌳👹🏮</div>
    <h1>요괴 마을</h1>
    <p class="sub">낮에는 마을을 키우고,<br>밤에는 요괴를 막아내요.</p>
    ${can ? `<button data-act="cont" class="big">이어하기 <small>(${state.day}일차)</small></button>` : ''}
    <button data-act="new" class="big ${can ? 'ghost' : ''}">새로 시작</button>`, {
    cont: () => { hideCard(); goDay(); },
    new: () => {
      if (can && !confirm('저장된 마을을 지우고 새로 시작할까요?')) return;
      newGame(); hideCard(); goDay();
    },
  }, 'title');
}

function goDay() {
  screen = 'day';
  document.body.classList.remove('is-night');
  enterDay({ startNight: goNight, skipDay: debugSkipDay });
}

function goNight() {
  screen = 'night';
  document.body.classList.add('is-night');
  night.startNight(endNight);
  nightPanel();
}

function nightPanel() {
  const N = night.N;
  setPanel(`
    <div class="row">
      <button data-act="speed" class="speed">${N.speed === 1 ? '▶▶ 2배속' : '▶ 1배속'}</button>
      <button data-act="skip" class="skip">⏭ 건너뛰기</button>
    </div>`, act => {
    if (act === 'speed') { N.speed = N.speed === 1 ? 2 : 1; nightPanel(); }
    if (act === 'skip') night.skip();
  });
}

function nightInfo() {
  const N = night.N;
  const left = N.enemies.length + N.spawnQueue.length;
  let html = `<div class="nightbar"><span>🌳</span><div class="hp"><i style="width:${Math.max(0, N.tree.hp / N.tree.maxHp * 100)}%"></i></div><span>👹 ${left}</span></div>`;
  if (N.boss && N.boss.hp > 0) {
    html += `<div class="nightbar boss"><span>🐍</span><div class="hp"><i style="width:${N.boss.hp / N.boss.maxHp * 100}%"></i></div><span>보스</span></div>`;
  }
  setInfo(html);
}

function endNight(N) {
  if (!N.win) { goDefeat(); return; }
  if (state.day >= D.FINAL_DAY) { goClear(N); return; }
  screen = 'morning';
  showMorning(N, () => { hideCard(); goDay(); });
}

function debugSkipDay() {
  // 아무 일 없는 밤을 보낸 것으로 처리
  const fake = { kills: 0, coins: 0, treeDamage: 0, fled: 0, units: [], win: true };
  if (state.day >= D.FINAL_DAY) { goClear(fake); return; }
  screen = 'morning';
  showMorning(fake, () => { hideCard(); goDay(); });
}

function goDefeat() {
  screen = 'defeat';
  const target = rollbackTarget();
  showCard(`
    <div class="title-emoji">🍂</div>
    <h2>당산나무가 쓰러졌어요...</h2>
    <p class="sub">${state.day}일차 밤을 넘기지 못했어요.</p>
    <button data-act="back" class="big">⏪ 3일 전으로 돌아가기 <small>(${target}일차)</small></button>`, {
    back: () => { rollback(); hideCard(); toast(`${state.day}일차 아침으로 돌아왔어요`); goDay(); },
  });
}

function goClear(N) {
  screen = 'clear';
  state.totalKills += N.kills;
  const gens = state.residents.filter(r => r.general).map(r => `${D.GENERALS[r.general.type].emoji} ${D.GENERALS[r.general.type].name} Lv${r.general.level}`);
  const html = `
    <div class="title-emoji">🎊🌳🎊</div>
    <h1>1단계 클리어!</h1>
    <p class="sub">이무기를 물리치고 마을을 지켜냈어요.</p>
    <ul class="report">
      <li>👊 총 처치 <b>${state.totalKills}</b>마리</li>
      <li>👥 주민 ${state.residents.length}명</li>
      <li>⚔️ 장군: ${gens.length ? gens.join(', ') : '없음'}</li>
    </ul>
    <button data-act="new" class="big">새로 시작</button>`;
  clearSave();
  showCard(html, { new: () => { hideCard(); goTitle(); } });
}

// ---- 입력 ----
canvas.addEventListener('pointerup', e => {
  if (screen !== 'day') return;
  const r = canvas.getBoundingClientRect();
  handleTap(cellFromPoint(e.clientX - r.left, e.clientY - r.top));
});
// 더블탭 확대·핀치 방지 (iOS)
document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe($('board'));
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden && screen === 'day') save(); });

// ---- 루프 ----
let last = performance.now();
let infoTimer = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (screen === 'night' || (night.N && (screen === 'defeat' || screen === 'morning' || screen === 'clear'))) {
    if (screen === 'night') {
      night.update(dt);
      const N = night.N;
      if (N.bossBanner) { // 보스 경고
        showBanner(N.bossBanner, D.FX.bossBannerTime);
        N.bossBanner = null;
      }
      infoTimer -= dt;
      if (infoTimer <= 0) { nightInfo(); infoTimer = 0.1; }
    }
    drawNight(night.N);
  } else if (state) {
    drawDay(view);
  }
  requestAnimationFrame(frame);
}

initRender(canvas);
resize();
goTitle();
requestAnimationFrame(frame);
