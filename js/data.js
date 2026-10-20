// 모든 수치·밸런스는 이 파일 한 곳에서만 관리한다.

export const GRID_W = 7;
export const GRID_H = 9;
export const TREE_POS = { x: 3, y: 6 }; // 0부터 센 좌표 (기획서 기준 4열, 7행)

export const FINAL_DAY = 7;       // 1단계: 7일차 보스 밤을 넘기면 클리어
export const ROLLBACK_DAYS = 3;   // 패배 시 되돌아갈 날 수
export const DAILY_AP = 3;        // 하루 행동력

export const START = {
  rice: 8,
  wood: 12,
  coin: 4,
  buildings: [
    { type: 'house', x: 3, y: 8 },
    { type: 'field', x: 2, y: 7 },
    { type: 'lumber', x: 4, y: 7 },
  ],
  residents: [
    { x: 2, y: 7 }, // 농부
    { x: 3, y: 5 }, // 수호대 (당산나무 앞)
  ],
};

export const RESOURCES = {
  rice: { name: '쌀', emoji: '🍚' },
  wood: { name: '나무', emoji: '🪵' },
  coin: { name: '엽전', emoji: '🪙' },
};

export const BUILDINGS = {
  house:  { name: '초가집', emoji: '🛖', cost: { wood: 5 }, capacity: 2, desc: '주민 최대 수 +2' },
  field:  { name: '논', emoji: '🌾', cost: { wood: 3 }, produce: { rice: 2 }, desc: '아침마다 쌀 +2 (농부 있으면 2배)' },
  lumber: { name: '벌목장', emoji: '🪓', cost: { rice: 3 }, produce: { wood: 2 }, desc: '아침마다 나무 +2 (나무꾼 있으면 2배)' },
  tower:  { name: '망루', emoji: '🗼', cost: { wood: 6 }, range: 2.6, damage: 8, cooldown: 1.0, desc: '가까운 요괴를 자동으로 쏜다' },
  wall:   { name: '돌담', emoji: '🧱', cost: { wood: 2 }, hp: 80, desc: '요괴의 길을 막는다 (도깨비불은 넘어감)' },
};
export const BUILD_ORDER = ['house', 'field', 'lumber', 'tower', 'wall'];
export const WORKER_MULT = 2; // 농부·나무꾼 배치 시 생산 배수

export const TREE = { name: '당산나무', emoji: '🌳', hp: 200, range: 1.8, damage: 5, cooldown: 1.0 };

export const RESIDENT = {
  hireCost: { coin: 5 },
  hireAp: 1,
  riceUpkeep: 1,          // 아침마다 주민 1명당 쌀
  hungryHpMult: 0.7,      // 쌀이 모자란 날 밤 수호대 체력 배수
  emoji: { guard: '💂', farmer: '👩‍🌾', lumber: '🧔' },
  guard: { hp: 100, damage: 6, cooldown: 0.8, range: 1.2 },
};

export const GENERAL = {
  promoteSurvivals: 5,
  maxCount: 3,
  maxLevel: 5,
  hp: 110, hpPerLevel: 20,
  damage: 10, damagePerLevel: 3,
  cooldown: 0.7,
  range: 1.4,
  grades: [
    { id: 'common', name: '보통', weight: 60, color: '#7a8a6a' },
    { id: 'rare', name: '희귀', weight: 30, color: '#3d7bd8' },
    { id: 'legend', name: '전설', weight: 10, color: '#e0a020' },
  ],
};

export const GENERALS = {
  turtle: { name: '거북 장군', emoji: '🐢', grade: 'common', desc: '근처 돌담 내구도 2배', radius: 2.5, wallHpMult: 2 },
  owl:    { name: '부엉이 장군', emoji: '🦉', grade: 'common', desc: '밤 동안 요괴 이동 느려짐', slowMult: 0.75, slowPerLevel: 0.03 },
  hawk:   { name: '매 장군', emoji: '🦅', grade: 'rare', desc: '근처 망루 사거리·공격속도 증가', radius: 2.5, rangeBonus: 1, cooldownMult: 0.6 },
  boar:   { name: '멧돼지 장군', emoji: '🐗', grade: 'rare', desc: '몰려오는 요괴 무리에 돌진', interval: 5, reach: 4, damage: 20, damagePerLevel: 5, radius: 1.3 },
  bear:   { name: '곰 장군', emoji: '🐻', grade: 'legend', desc: '당산나무 앞을 지키며 받는 피해 절반', treeDamageMult: 0.5 },
  tiger:  { name: '호랑이 장군', emoji: '🐯', grade: 'legend', desc: '매일 밤 처음 오는 요괴 3마리 한 방에 처치', count: 3, delay: 1.0, bossDamageRatio: 0.15 },
};

export const ENEMIES = {
  dokkaebi: { name: '도깨비', emoji: '👹', hp: 30, speed: 0.8, damage: 4, cooldown: 1.2, coin: 2, size: 0.8 },
  egg:      { name: '달걀귀신', emoji: '🥚', hp: 14, speed: 1.5, damage: 3, cooldown: 0.9, coin: 1, size: 0.62 },
  wisp:     { name: '도깨비불', emoji: '🔥', hp: 18, speed: 1.0, damage: 4, cooldown: 1.0, coin: 2, size: 0.7, flying: true },
  imugi:    { name: '이무기', emoji: '🐍', hp: 1000, speed: 0.35, damage: 20, cooldown: 1.5, coin: 20, size: 1.6, boss: true },
};

export const ENEMY_HP_PER_DAY = 0.1; // 날마다 요괴 체력 +10% (보스 제외)

export const DIRS = {
  top: { name: '위', arrow: '⬇️' },
  left: { name: '왼쪽', arrow: '➡️' },
  right: { name: '오른쪽', arrow: '⬅️' },
};

// WAVES[일차-1] = 그날 밤 요괴 무리 목록. delay: 무리 등장 시작(초)
export const WAVES = [
  [{ type: 'dokkaebi', count: 3, dir: 'top' }],
  [{ type: 'dokkaebi', count: 3, dir: 'top' }, { type: 'egg', count: 3, dir: 'left', delay: 3 }],
  [{ type: 'dokkaebi', count: 4, dir: 'top' }, { type: 'egg', count: 3, dir: 'right', delay: 2 }, { type: 'wisp', count: 2, dir: 'top', delay: 5 }],
  [{ type: 'dokkaebi', count: 5, dir: 'top' }, { type: 'egg', count: 4, dir: 'left', delay: 2 }, { type: 'wisp', count: 3, dir: 'right', delay: 5 }],
  [{ type: 'dokkaebi', count: 4, dir: 'top' }, { type: 'dokkaebi', count: 3, dir: 'left', delay: 3 }, { type: 'egg', count: 5, dir: 'right', delay: 2 }, { type: 'wisp', count: 4, dir: 'top', delay: 6 }],
  [{ type: 'dokkaebi', count: 5, dir: 'top' }, { type: 'dokkaebi', count: 3, dir: 'right', delay: 3 }, { type: 'egg', count: 6, dir: 'left', delay: 2 }, { type: 'wisp', count: 5, dir: 'top', delay: 6 }],
  [{ type: 'imugi', count: 1, dir: 'top', delay: 2 }, { type: 'dokkaebi', count: 5, dir: 'left', delay: 4 }, { type: 'egg', count: 5, dir: 'right', delay: 6 }, { type: 'wisp', count: 4, dir: 'top', delay: 8 }],
];

export const NIGHT = {
  spawnWindow: 10,     // 한 무리가 다 나오는 데 걸리는 시간(초)
  maxSpawnGap: 1.6,    // 같은 무리 안 등장 간격 최대(초)
  maxDuration: 60,     // 이 시간이 지나면 동이 트고 남은 요괴는 도망
  endDelay: 1.2,       // 마지막 요괴 처치 후 아침까지 여유(초)
  step: 1 / 60,        // 시뮬레이션 한 스텝(초)
  skipStep: 1 / 30,    // 건너뛰기 때 스텝
  engageDist: 0.7,     // 요괴가 수호대에 붙잡히는 거리(칸)
  treeReach: 0.8,      // 요괴가 당산나무를 공격하는 거리(칸)
  projectileSpeed: 9,  // 망루 화살 속도(칸/초)
  sideRows: 6,         // 좌우 등장 가능 행 수 (위에서부터)
};

export const FX = {
  maxEffects: 80,
  shakeBoss: 14,
  shakeBigHit: 5,
  shakeDecay: 30,
  flashTime: 0.12,
  textLife: 0.8,
  burstLife: 0.45,
  bossBannerTime: 2.5,
};

export const EVENT_START_DAY = 2; // 이 날 아침부터 사건 발생
export const EVENTS = [
  { id: 'harvest', name: '풍년', emoji: '🌾', weight: 40, reward: { rice: 5 }, text: '올해는 풍년! 쌀을 더 거뒀어요.' },
  { id: 'merchant', name: '떠돌이 상인', emoji: '🧳', weight: 30, trade: 5, text: '떠돌이 상인이 물물교환을 제안해요.' },
  { id: 'gift', name: '도깨비의 선물', emoji: '🎁', weight: 30, reward: { coin: 4 }, text: '착한 도깨비가 엽전을 두고 갔어요.' },
];

export const DEBUG_GIFT = { rice: 20, wood: 20, coin: 20 };
