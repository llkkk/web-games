import { useEffect, useRef, useState, useCallback } from 'react';
import './kitchen-defense.css';

/**
 * 深夜厨房保卫战：格子塔防
 * 玩法骨架（建塔/升级/卖出/波次/漏怪扣血）脱胎于经典手机塔防，主题与素材全部原创。
 */

// ---------- 基础常量 ----------
const COLS = 15;
const ROWS = 10;
const CELL = 64;
const W = COLS * CELL; // 960
const H = ROWS * CELL; // 640

// 路径拐点（格子坐标，可出界）：从左侧下水口进，S 形走向右侧冰箱
const WAYPOINTS = [[-1, 1], [12, 1], [12, 4], [2, 4], [2, 7], [15, 7]];

function cellCenter(c, r) { return [(c + 0.5) * CELL, (r + 0.5) * CELL]; }

// 路径像素折线与分段长度
const PATH_PTS = WAYPOINTS.map(([c, r]) => cellCenter(c, r));
const SEGS = [];
let PATH_LEN = 0;
for (let i = 0; i < PATH_PTS.length - 1; i++) {
  const [x1, y1] = PATH_PTS[i];
  const [x2, y2] = PATH_PTS[i + 1];
  const len = Math.hypot(x2 - x1, y2 - y1);
  SEGS.push({ x1, y1, x2, y2, len, start: PATH_LEN });
  PATH_LEN += len;
}
const ESCAPE_DIST = PATH_LEN - 46; // 走到冰箱门口（画面内）即算漏怪
function posAt(dist) {
  const d = Math.max(0, Math.min(dist, PATH_LEN - 0.001));
  for (const s of SEGS) {
    if (d <= s.start + s.len) {
      const t = s.len === 0 ? 0 : (d - s.start) / s.len;
      return [s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t];
    }
  }
  const last = PATH_PTS[PATH_PTS.length - 1];
  return [last[0], last[1]];
}
// 路径占用的格子（不可建造）
const PATH_CELLS = new Set();
for (let i = 0; i < WAYPOINTS.length - 1; i++) {
  let [c1, r1] = WAYPOINTS[i];
  let [c2, r2] = WAYPOINTS[i + 1];
  const dc = Math.sign(c2 - c1), dr = Math.sign(r2 - r1);
  let c = c1, r = r1;
  while (c !== c2 || r !== r2) {
    if (c >= 0 && c < COLS && r >= 0 && r < ROWS) PATH_CELLS.add(c + ',' + r);
    c += dc; r += dr;
  }
  if (c >= 0 && c < COLS && r >= 0 && r < ROWS) PATH_CELLS.add(c + ',' + r);
}

// ---------- 塔 ----------
const TOWERS = {
  chili:  { name: '辣椒塔',   icon: '🌶️', cost: 50,  range: 2.3, dmg: 9,  rate: 2.0, color: '#ff5340', desc: '快速喷火，单体输出' },
  melon:  { name: '西瓜塔',   icon: '🍉', cost: 100, range: 2.7, dmg: 24, rate: 0.55, splash: 0.95, color: '#59d977', desc: '瓜瓣溅射，范围杀伤' },
  soda:   { name: '冰汽水塔', icon: '🥤', cost: 70,  range: 2.5, dmg: 3,  rate: 1.3, slow: 0.45, slowDur: 1.6, color: '#57c8ff', desc: '冰镇减速，控场担当' },
  garlic: { name: '大蒜塔',   icon: '🧄', cost: 80,  range: 1.8, dps: 7,  color: '#e8e3d5', desc: '蒜香熏燎，范围内持续掉血' },
  coffee: { name: '咖啡塔',   icon: '☕', cost: 90,  range: 2.4, buff: [0.35, 0.5, 0.7], color: '#ffb35c', desc: '提神光环：周围塔攻速提升' },
};
const TOWER_KEYS = Object.keys(TOWERS);
const LV_DMG = [1, 1.7, 2.8];       // 各等级伤害倍率
const LV_RANGE = [0, 0.25, 0.5];    // 各等级射程加成（格）
function upgradeCost(t) {
  const base = TOWERS[t.type].cost;
  return t.level === 1 ? Math.round(base * 0.8) : Math.round(base * 1.2);
}

// ---------- 敌人 ----------
const ENEMIES = {
  ant:   { name: '蚂蚁', icon: '🐜', hp: 20,   speed: 1.2,  reward: 4,  dmg: 1, size: 30 },
  roach: { name: '蟑螂', icon: '🪳', hp: 50,   speed: 0.82, reward: 6,  dmg: 1, size: 36 },
  fly:   { name: '苍蝇', icon: '🪰', hp: 28,   speed: 1.75, reward: 7,  dmg: 1, size: 32 },
  rat:   { name: '老鼠', icon: '🐀', hp: 165,  speed: 0.55, reward: 14, dmg: 2, size: 42 },
  boss:  { name: '蟑螂王', icon: '🪳', hp: 1500, speed: 0.42, reward: 150, dmg: 5, size: 58 },
};

// ---------- 波次（10 波主线） ----------
const G = (type, count, gap, hp) => ({ type, count, gap, hp });
const WAVES = [
  [G('roach', 8, 1.1)],
  [G('ant', 12, 0.55)],
  [G('roach', 10, 0.9), G('ant', 8, 0.5)],
  [G('fly', 6, 0.8), G('roach', 8, 0.9)],
  [G('roach', 10, 0.8), G('boss', 1, 1, 620)],
  [G('ant', 18, 0.4), G('rat', 4, 1.6)],
  [G('fly', 10, 0.6), G('roach', 10, 0.7)],
  [G('rat', 6, 1.4), G('ant', 14, 0.4)],
  [G('roach', 14, 0.6), G('fly', 8, 0.6), G('rat', 4, 1.5)],
  [G('boss', 1, 1), G('roach', 10, 0.8), G('rat', 3, 1.5)],
];
function waveHpMul(wave) { return 1 + (wave - 1) * 0.18; }
function endlessWave(wave) {
  const groups = [
    G('roach', 10 + wave, 0.6),
    G('ant', 10 + wave, 0.35),
    G('fly', 6 + (wave >> 1), 0.55),
    G('rat', 3 + (wave >> 1), 1.3),
  ];
  if (wave % 5 === 0) groups.unshift(G('boss', 1 + ((wave / 5) >> 0) - 1, 2));
  return groups;
}

const BEST_KEY = 'webgames-kitchen-best';
function loadBest() {
  try {
    const v = localStorage.getItem(BEST_KEY);
    return v == null ? null : parseInt(v, 10);
  } catch { return null; }
}

let UID = 1;

export default function KitchenDefense() {
  const canvasRef = useRef(null);
  const worldRef = useRef(null);
  const [hud, setHud] = useState({ gold: 150, lives: 10, wave: 0, phase: 'build', score: 0, enemiesLeft: 0 });
  const [shopSel, setShopSel] = useState(null);       // 选中的待建造塔
  const [selTower, setSelTower] = useState(null);     // 选中的已建塔 {c,r}
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState('');
  const [best, setBest] = useState(loadBest);
  const [endless, setEndless] = useState(false);
  const speedRef = useRef(1);
  const pausedRef = useRef(false);
  speedRef.current = speed;
  pausedRef.current = paused;

  const newWorld = useCallback(() => ({
    gold: 150, lives: 10, wave: 0, score: 0,
    phase: 'build', // build | wave | won | lost
    towers: new Map(), // "c,r" -> tower
    enemies: [], projectiles: [], particles: [],
    spawnQueue: [], spawnTimer: 0, time: 0,
    endless: false, wonBonusGiven: false,
  }), []);

  if (!worldRef.current) worldRef.current = newWorld();

  const showBanner = useCallback((text, ms = 1600) => {
    setBanner(text);
    window.setTimeout(() => setBanner(''), ms);
  }, []);

  // ---------- 出怪 ----------
  function startWave(w) {
    const wave = w.wave + 1;
    w.wave = wave;
    const groups = (w.endless || wave > 10) && wave > 10 ? endlessWave(wave) : WAVES[wave - 1];
    const mul = waveHpMul(wave);
    const queue = [];
    for (const g of groups) {
      for (let i = 0; i < g.count; i++) {
        queue.push({ type: g.type, gap: g.gap, hpMul: g.hp ? 1 : mul, hpBase: g.hp || null, delay: i === 0 && queue.length ? 1.2 : 0 });
      }
    }
    w.spawnQueue = queue;
    w.spawnTimer = 0.5;
    w.phase = 'wave';
    showBanner(wave === 10 ? '🌙 最后一波！蟑螂王来了！' : `🌙 第 ${wave} 波来袭`);
  }

  // ---------- 主循环 ----------
  useEffect(() => {
    const cv = canvasRef.current;
    const ctx = cv.getContext('2d');
    let raf = 0;
    let last = performance.now();
    let hudTimer = 0;

    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = worldRef.current;
      if (!pausedRef.current && (w.phase === 'wave' || w.phase === 'build')) {
        dt *= speedRef.current;
        w.time += dt;
        step(w, dt);
      }
      draw(ctx, w);
      hudTimer += dt;
      if (hudTimer > 0.12) {
        hudTimer = 0;
        setHud((prev) => {
          const enemiesLeft = w.enemies.length + w.spawnQueue.length;
          if (prev.gold === w.gold && prev.lives === w.lives && prev.wave === w.wave &&
              prev.phase === w.phase && prev.score === w.score && prev.enemiesLeft === enemiesLeft) return prev;
          return { gold: w.gold, lives: w.lives, wave: w.wave, phase: w.phase, score: w.score, enemiesLeft };
        });
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- 逻辑步进 ----------
  function step(w, dt) {
    // 出怪
    if (w.spawnQueue.length) {
      w.spawnTimer -= dt;
      if (w.spawnTimer <= 0) {
        const item = w.spawnQueue.shift();
        const def = ENEMIES[item.type];
        const hp = Math.round((item.hpBase || def.hp) * item.hpMul);
        const [x, y] = posAt(0);
        w.enemies.push({
          id: UID++, type: item.type, hp, maxHp: hp, dist: 0,
          speed: def.speed * CELL, reward: def.reward, dmg: def.dmg,
          slowUntil: 0, slowFactor: 0, x, y, wobble: Math.random() * Math.PI * 2,
        });
        w.spawnTimer = item.gap;
      }
    }
    // 敌人移动
    for (const e of w.enemies) {
      const slowed = w.time < e.slowUntil;
      e.dist += e.speed * (slowed ? 1 - e.slowFactor : 1) * dt;
      const [x, y] = posAt(e.dist);
      e.x = x; e.y = y;
      if (e.dist >= ESCAPE_DIST) {
        e.escaped = true;
        w.lives -= e.dmg;
        burst(w, x, y, '#ff5340', 8);
        if (w.lives <= 0) { w.lives = 0; w.phase = 'lost'; finishScore(w); }
      }
    }
    w.enemies = w.enemies.filter((e) => !e.escaped && e.hp > 0);
    // 咖啡光环
    const coffees = [...w.towers.values()].filter((t) => t.type === 'coffee');
    const buffOf = (t) => {
      let b = 0;
      for (const cf of coffees) {
        if (cf === t) continue;
        const d = Math.hypot(cf.c - t.c, cf.r - t.r);
        if (d <= TOWERS.coffee.range + LV_RANGE[cf.level - 1]) b = Math.max(b, TOWERS.coffee.buff[cf.level - 1]);
      }
      return b;
    };
    // 塔攻击
    for (const t of w.towers.values()) {
      const def = TOWERS[t.type];
      const range = (def.range + LV_RANGE[t.level - 1]) * CELL;
      if (t.type === 'garlic') {
        const dps = def.dps * LV_DMG[t.level - 1];
        for (const e of w.enemies) {
          if (Math.hypot(e.x - t.x, e.y - t.y) <= range) {
            e.hp -= dps * dt;
            if (Math.random() < dt * 2) puff(w, e.x, e.y - 14);
            if (e.hp <= 0 && !e.dead) kill(w, e);
          }
        }
        continue;
      }
      if (t.type === 'coffee') continue;
      t.cool -= dt;
      // 选射程内走得最远的敌人
      let target = null, bestDist = -1;
      for (const e of w.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - t.x, e.y - t.y) <= range && e.dist > bestDist) { bestDist = e.dist; target = e; }
      }
      t.target = target;
      if (target && t.cool <= 0) {
        const rate = def.rate * (1 + buffOf(t));
        t.cool = 1 / rate;
        t.recoil = 1;
        w.projectiles.push({
          x: t.x, y: t.y - 10, target, speed: 460,
          dmg: def.dmg * LV_DMG[t.level - 1],
          splash: def.splash ? (def.splash + (t.level - 1) * 0.15) * CELL : 0,
          slow: def.slow || 0, slowDur: def.slowDur || 0,
          color: def.color, kind: t.type,
        });
      }
    }
    w.enemies = w.enemies.filter((e) => e.hp > 0);
    // 子弹
    for (const p of w.projectiles) {
      const tgt = p.target;
      if (!tgt || tgt.hp <= 0 || tgt.escaped) { p.done = true; continue; }
      const dx = tgt.x - p.x, dy = tgt.y - p.y;
      const d = Math.hypot(dx, dy);
      const stepLen = p.speed * dt;
      if (d <= stepLen + 4) {
        hit(w, p, tgt);
        p.done = true;
      } else {
        p.x += (dx / d) * stepLen;
        p.y += (dy / d) * stepLen;
      }
    }
    w.projectiles = w.projectiles.filter((p) => !p.done);
    // 粒子
    for (const pt of w.particles) { pt.life -= dt; pt.y -= 18 * dt; pt.x += pt.vx * dt; }
    w.particles = w.particles.filter((p) => p.life > 0);
    // 波次结束判定
    if (w.phase === 'wave' && !w.spawnQueue.length && !w.enemies.length) {
      const bonus = 20 + w.wave * 2;
      w.gold += bonus;
      w.score += bonus;
      if (w.wave >= 10 && !w.endless) {
        w.phase = 'won';
        if (!w.wonBonusGiven) { w.wonBonusGiven = true; w.score += w.lives * 50 + w.gold; }
        finishScore(w);
      } else {
        w.phase = 'build';
        showBanner(`✨ 第 ${w.wave} 波守住了！奖励 ${bonus} 金币`);
      }
    }
  }

  function kill(w, e) {
    e.dead = true;
    w.gold += e.reward;
    w.score += e.reward;
    burst(w, e.x, e.y, '#ffd75e', 6);
  }
  function hit(w, p, tgt) {
    if (p.splash) {
      for (const e of w.enemies) {
        if (e.hp > 0 && Math.hypot(e.x - tgt.x, e.y - tgt.y) <= p.splash) {
          e.hp -= p.dmg;
          if (p.slow) applySlow(e, p);
          if (e.hp <= 0 && !e.dead) kill(w, e);
        }
      }
      burst(w, tgt.x, tgt.y, p.color, 7);
    } else {
      tgt.hp -= p.dmg;
      if (p.slow) applySlow(tgt, p);
      burst(w, tgt.x, tgt.y, p.color, 3);
      if (tgt.hp <= 0 && !tgt.dead) kill(w, tgt);
    }
  }
  function applySlow(e, p) {
    if (p.slow >= e.slowFactor || w_time(worldRef.current) > e.slowUntil) e.slowFactor = p.slow;
    e.slowUntil = worldRef.current.time + p.slowDur;
  }
  function w_time(w) { return w.time; }
  function burst(w, x, y, color, n) {
    for (let i = 0; i < n; i++) {
      w.particles.push({ x, y, vx: (Math.random() - 0.5) * 60, life: 0.35 + Math.random() * 0.2, color, r: 2 + Math.random() * 2.5 });
    }
  }
  function puff(w, x, y) {
    w.particles.push({ x: x + (Math.random() - 0.5) * 16, y, vx: 0, life: 0.5, color: 'rgba(232,227,213,0.7)', r: 4 + Math.random() * 3 });
  }
  function finishScore(w) {
    setBest((prev) => {
      const finalScore = w.score;
      if (prev == null || finalScore > prev) {
        try { localStorage.setItem(BEST_KEY, String(finalScore)); } catch { /* ignore */ }
        return finalScore;
      }
      return prev;
    });
  }

  // ---------- 绘制 ----------
  function draw(ctx, w) {
    ctx.clearRect(0, 0, W, H);
    // 台面
    ctx.fillStyle = '#131c30';
    ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if ((c + r) % 2 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.025)'; ctx.fillRect(c * CELL, r * CELL, CELL, CELL); }
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * CELL, 0); ctx.lineTo(c * CELL, H); ctx.stroke(); }
    for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * CELL); ctx.lineTo(W, r * CELL); ctx.stroke(); }
    // 小路（木砧板色）
    for (const key of PATH_CELLS) {
      const [c, r] = key.split(',').map(Number);
      ctx.fillStyle = (c + r) % 2 ? '#77512e' : '#7f5732';
      ctx.fillRect(c * CELL + 1.5, r * CELL + 1.5, CELL - 3, CELL - 3);
    }
    ctx.strokeStyle = 'rgba(255,236,200,0.28)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 14]);
    ctx.beginPath();
    PATH_PTS.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(Math.max(x, 4), y); else ctx.lineTo(x, y); });
    ctx.stroke();
    ctx.setLineDash([]);
    // 入口（下水口）
    ctx.fillStyle = '#04060a';
    ctx.beginPath(); ctx.ellipse(8, 1.5 * CELL, 9, 27, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(140,170,220,0.5)'; ctx.lineWidth = 2; ctx.stroke();
    // 冰箱（终点）
    const fx = W - 54, fy = 6.18 * CELL, fw = 48, fh = 2.64 * CELL;
    const grad = ctx.createLinearGradient(fx, fy, fx + fw, fy);
    grad.addColorStop(0, '#c9d6e4'); grad.addColorStop(1, '#93a7bd');
    ctx.fillStyle = grad;
    roundRect(ctx, fx, fy, fw, fh, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(20,30,45,0.55)'; ctx.lineWidth = 2; roundRect(ctx, fx, fy, fw, fh, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(fx, fy + fh * 0.32); ctx.lineTo(fx + fw, fy + fh * 0.32); ctx.stroke();
    ctx.fillStyle = '#5a7089';
    ctx.fillRect(fx + fw - 10, fy + 12, 4, 26);
    ctx.fillRect(fx + fw - 10, fy + fh * 0.32 + 10, 4, 20);
    ctx.font = '17px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🧀', fx + fw / 2, fy + fh * 0.16);
    // 光环（大蒜/咖啡）
    for (const t of w.towers.values()) {
      if (t.type === 'garlic' || t.type === 'coffee') {
        const def = TOWERS[t.type];
        const range = (def.range + LV_RANGE[t.level - 1]) * CELL;
        ctx.fillStyle = t.type === 'garlic' ? 'rgba(232,227,213,0.05)' : 'rgba(255,179,92,0.055)';
        ctx.beginPath(); ctx.arc(t.x, t.y, range, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 射程预览
    const preview = (x, y, rangeCells, ok) => {
      ctx.fillStyle = ok ? 'rgba(255,255,255,0.06)' : 'rgba(255,60,60,0.08)';
      ctx.strokeStyle = ok ? 'rgba(255,255,255,0.35)' : 'rgba(255,60,60,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, rangeCells * CELL, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    };
    if (selTower) {
      const t = w.towers.get(selTower.c + ',' + selTower.r);
      if (t) preview(t.x, t.y, TOWERS[t.type].range + LV_RANGE[t.level - 1], true);
    }
    if (shopSel && hoverRef.current) {
      const { c, r } = hoverRef.current;
      const [x, y] = cellCenter(c, r);
      const ok = buildable(w, c, r) && w.gold >= TOWERS[shopSel].cost;
      preview(x, y, TOWERS[shopSel].range, ok);
      ctx.globalAlpha = 0.65;
      ctx.font = '34px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(TOWERS[shopSel].icon, x, y);
      ctx.globalAlpha = 1;
    }
    // 塔
    for (const t of w.towers.values()) {
      ctx.fillStyle = '#243354';
      ctx.strokeStyle = 'rgba(160,190,240,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(t.x, t.y, 25, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      t.recoil = Math.max(0, (t.recoil || 0) - 0.06);
      const s = 34 * (1 + 0.18 * (t.recoil || 0));
      ctx.font = `${s}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(TOWERS[t.type].icon, t.x, t.y + 1);
      // 等级点
      for (let i = 0; i < t.level; i++) {
        ctx.fillStyle = '#ffd75e';
        ctx.beginPath(); ctx.arc(t.x - 10 + i * 10, t.y + 21, 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    // 敌人
    for (const e of w.enemies) {
      const def = ENEMIES[e.type];
      const slowed = w.time < e.slowUntil;
      if (slowed) {
        ctx.fillStyle = 'rgba(110,200,255,0.30)';
        ctx.beginPath(); ctx.arc(e.x, e.y, def.size * 0.62, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.ellipse(e.x, e.y + def.size * 0.42, def.size * 0.42, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(e.x, e.y + Math.sin(w.time * 7 + e.wobble) * 2);
      ctx.rotate(Math.sin(w.time * 5 + e.wobble) * 0.07);
      ctx.font = `${def.size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(def.icon, 0, 0);
      ctx.restore();
      if (e.type === 'boss') {
        ctx.font = '19px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('👑', e.x, e.y - def.size * 0.72);
      }
      if (e.hp < e.maxHp) {
        const bw = 36, pct = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - bw / 2, e.y - def.size * 0.62 - 9, bw, 5);
        ctx.fillStyle = pct > 0.45 ? '#5fd35f' : pct > 0.2 ? '#ffb35c' : '#ff5340';
        ctx.fillRect(e.x - bw / 2, e.y - def.size * 0.62 - 9, bw * pct, 5);
      }
    }
    // 子弹
    for (const p of w.projectiles) {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'melon' ? 6.5 : 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    // 粒子
    for (const pt of w.particles) {
      ctx.globalAlpha = Math.max(0, Math.min(1, pt.life * 2.4));
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function roundRect(ctx, x, y, w2, h2, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w2, y, x + w2, y + h2, r);
    ctx.arcTo(x + w2, y + h2, x, y + h2, r);
    ctx.arcTo(x, y + h2, x, y, r);
    ctx.arcTo(x, y, x + w2, y, r);
    ctx.closePath();
  }

  // ---------- 交互 ----------
  const hoverRef = useRef(null);
  const DECOR = new Set(['14,6', '14,8']); // 冰箱两侧装饰格，不可建造
  function buildable(w, c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS &&
      !PATH_CELLS.has(c + ',' + r) && !DECOR.has(c + ',' + r) && !w.towers.has(c + ',' + r);
  }
  function canvasCell(ev) {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (ev.clientX - rect.left) * (W / rect.width);
    const y = (ev.clientY - rect.top) * (H / rect.height);
    return { c: Math.floor(x / CELL), r: Math.floor(y / CELL), x, y };
  }
  function onPointerMove(ev) {
    const { c, r } = canvasCell(ev);
    hoverRef.current = { c, r };
  }
  function onPointerDown(ev) {
    const w = worldRef.current;
    if (w.phase === 'won' || w.phase === 'lost') return;
    const { c, r } = canvasCell(ev);
    if (shopSel) {
      const def = TOWERS[shopSel];
      if (buildable(w, c, r) && w.gold >= def.cost) {
        const [x, y] = cellCenter(c, r);
        w.towers.set(c + ',' + r, { c, r, x, y, type: shopSel, level: 1, cool: 0, invested: def.cost, recoil: 0, target: null });
        w.gold -= def.cost;
        if (w.gold < def.cost) setShopSel(null);
        setSelTower(null);
      }
      return;
    }
    if (w.towers.has(c + ',' + r)) setSelTower({ c, r });
    else setSelTower(null);
  }
  function doUpgrade() {
    const w = worldRef.current;
    if (!selTower) return;
    const t = w.towers.get(selTower.c + ',' + selTower.r);
    if (!t || t.level >= 3) return;
    const cost = upgradeCost(t);
    if (w.gold < cost) return;
    w.gold -= cost;
    t.invested += cost;
    t.level += 1;
    burst(w, t.x, t.y, '#ffd75e', 10);
  }
  function doSell() {
    const w = worldRef.current;
    if (!selTower) return;
    const key = selTower.c + ',' + selTower.r;
    const t = w.towers.get(key);
    if (!t) return;
    w.gold += Math.floor(t.invested * 0.7);
    w.towers.delete(key);
    setSelTower(null);
  }
  function restart() {
    worldRef.current = newWorld();
    setShopSel(null);
    setSelTower(null);
    setPaused(false);
    setEndless(false);
    showBanner('🌙 夜幕降临，守住冰箱！');
  }
  function continueEndless() {
    const w = worldRef.current;
    w.endless = true;
    w.phase = 'build';
    setEndless(true);
    showBanner('♾️ 无尽模式：看看你能守多少波');
  }
  useEffect(() => {
    function onKey(ev) {
      if (ev.key >= '1' && ev.key <= '5') { setShopSel(TOWER_KEYS[Number(ev.key) - 1]); setSelTower(null); }
      if (ev.key === 'Escape') { setShopSel(null); setSelTower(null); }
      if (ev.key === ' ') {
        ev.preventDefault();
        const w = worldRef.current;
        if (w.phase === 'build') startWave(w);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const w = worldRef.current;
  const selObj = selTower ? w.towers.get(selTower.c + ',' + selTower.r) : null;
  const finalScore = hud.score;

  return (
    <div className="kd-wrap">
      <h2 className="kd-title">🌙 深夜厨房保卫战</h2>
      <p className="kd-sub">夜里 12 点，害虫大军来偷冰箱了。用食物塔守住最后一格存粮！</p>

      <div className="kd-hud">
        <span className="kd-stat">🌙 第 {hud.wave} 波{hud.phase === 'wave' ? `（余 ${hud.enemiesLeft}）` : ''}</span>
        <span className="kd-stat">🪙 {hud.gold}</span>
        <span className="kd-stat">🧀 存粮 {hud.lives}</span>
        <span className="kd-stat">⭐ {hud.score}</span>
        {best != null && <span className="kd-stat kd-best">最高 {best}</span>}
      </div>

      <div className="kd-board-wrap">
        <canvas
          ref={canvasRef}
          className="kd-board"
          width={W}
          height={H}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerDown}
        />
        {banner && <div className="kd-banner">{banner}</div>}
        {hud.phase === 'won' && (
          <div className="kd-overlay">
            <div className="kd-overlay-title">🎉 守住了！天亮了</div>
            <p>得分 {finalScore}{best != null && finalScore >= best ? ' · 新纪录！' : ''}</p>
            <div className="kd-overlay-btns">
              <button className="kd-btn primary" onClick={continueEndless}>♾️ 继续无尽模式</button>
              <button className="kd-btn" onClick={restart}>再来一局</button>
            </div>
          </div>
        )}
        {hud.phase === 'lost' && (
          <div className="kd-overlay">
            <div className="kd-overlay-title">😱 冰箱被搬空了…</div>
            <p>你守到了第 {hud.wave} 波 · 得分 {finalScore}</p>
            <div className="kd-overlay-btns">
              <button className="kd-btn primary" onClick={restart}>再来一局</button>
            </div>
          </div>
        )}
      </div>

      <div className="kd-shop">
        {TOWER_KEYS.map((key, i) => {
          const t = TOWERS[key];
          return (
            <button
              key={key}
              className={'kd-card' + (shopSel === key ? ' active' : '')}
              disabled={hud.gold < t.cost}
              onClick={() => { setShopSel(shopSel === key ? null : key); setSelTower(null); }}
              title={t.desc}
            >
              <span className="kd-card-icon">{t.icon}</span>
              <span className="kd-card-name">{t.name}</span>
              <span className="kd-card-cost">🪙{t.cost}</span>
              <span className="kd-card-key">{i + 1}</span>
            </button>
          );
        })}
      </div>

      {selObj ? (
        <div className="kd-panel">
          <span className="kd-panel-name">{TOWERS[selObj.type].icon} {TOWERS[selObj.type].name} · {selObj.level} 级</span>
          <span className="kd-panel-desc">{TOWERS[selObj.type].desc}</span>
          {selObj.level < 3 ? (
            <button className="kd-btn" disabled={hud.gold < upgradeCost(selObj)} onClick={doUpgrade}>
              ⬆ 升级（🪙{upgradeCost(selObj)}）
            </button>
          ) : (
            <span className="kd-panel-desc">已满级</span>
          )}
          <button className="kd-btn" onClick={doSell}>💰 卖出（+{Math.floor(selObj.invested * 0.7)}）</button>
        </div>
      ) : (
        <div className="kd-panel kd-hint">
          {shopSel ? `已选 ${TOWERS[shopSel].name}，点台面空格建造（Esc 取消）` : '点上方食物卡选塔，再点台面建造；点已建的塔可升级/卖出'}
        </div>
      )}

      <div className="kd-controls">
        {hud.phase === 'build' && (
          <button className="kd-btn primary" onClick={() => startWave(worldRef.current)}>
            ▶ 开始第 {hud.wave + 1} 波{endless || hud.wave >= 10 ? '（无尽）' : ''}
          </button>
        )}
        {hud.phase === 'wave' && <span className="kd-controls-note">战斗中…守住！</span>}
        <button className="kd-btn" onClick={() => setPaused(!paused)}>{paused ? '▶ 继续' : '⏸ 暂停'}</button>
        <button className="kd-btn" onClick={() => setSpeed(speed === 1 ? 2 : 1)}>{speed}× 速度</button>
        <button className="kd-btn" onClick={restart}>↺ 重开</button>
      </div>

      <div className="kd-howto">
        <h3>玩法说明</h3>
        <p>
          《深夜厨房保卫战》是一款免费在线塔防小游戏。每到深夜，下水道里的蚂蚁、蟑螂、苍蝇和老鼠就会沿着厨房台面
          向冰箱进发，偷走你的存粮。你要在台面上建造食物塔拦截它们：辣椒塔快速喷火，是便宜可靠的主力；西瓜塔
          瓜瓣溅射，专治成群的蚂蚁；冰汽水塔能把虫子冻慢，为其他塔争取输出时间；大蒜塔用蒜香熏燎范围内的所有
          敌人；咖啡塔不攻击，但能让周围的食物塔攻速大幅提升。击杀害虫获得金币，用来建新塔或把塔升到 3 级，
          摆错了也可以卖掉返还七成。每波结束有额外金币奖励，存粮被偷光则游戏结束。主线共 10 波，第 5 波和
          第 10 波有蟑螂王压阵，守住 10 波即可获胜，之后还能继续挑战无尽模式刷最高分。操作：点食物卡后点台面
          建造（键盘 1–5 快速选塔），空格开始下一波，支持手机触屏和 2 倍速。
        </p>
      </div>
    </div>
  );
}
