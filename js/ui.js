// 화면 공통 DOM 도우미: 상단 정보줄, 토스트, 오버레이 카드
import * as D from './data.js';
import { state, maxResidents } from './state.js';

export const $ = id => document.getElementById(id);

export function updateHud() {
  const s = state;
  $('hud').innerHTML = `
    <span class="day">${s.day}일차${s.day === D.FINAL_DAY ? ' 🐍' : ''}</span>
    <span>${D.RESOURCES.rice.emoji}${s.rice}</span>
    <span>${D.RESOURCES.wood.emoji}${s.wood}</span>
    <span>${D.RESOURCES.coin.emoji}${s.coin}</span>
    <span>👥${s.residents.length}/${maxResidents()}</span>
    <span class="ap">⚡${s.ap}</span>`;
}

let toastTimer = 0;
export function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// 카드 오버레이. actions: { 액션이름: 함수 } — 버튼에 data-act="액션이름"
export function showCard(html, actions = {}, extraClass = '') {
  const ov = $('overlay');
  const card = $('card');
  card.className = 'card ' + extraClass;
  card.innerHTML = html;
  ov.classList.remove('hidden');
  card.onclick = e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const fn = actions[btn.dataset.act];
    if (fn) fn(btn);
  };
}

export function hideCard() {
  $('overlay').classList.add('hidden');
  $('card').onclick = null;
}

export function setPanel(html, onAction) {
  const p = $('panel');
  p.innerHTML = html;
  p.onclick = e => {
    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    onAction(btn.dataset.act, btn);
  };
}

export function setInfo(html) {
  $('info').innerHTML = html;
}

let bannerTimer = 0;
export function showBanner(text, time, kind = '') {
  const b = $('banner');
  b.textContent = text;
  b.className = kind;
  b.style.animation = 'none';
  void b.offsetWidth; // 애니메이션 재시작
  b.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.add('hidden'), time * 1000);
}
