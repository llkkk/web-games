import { useEffect, useState } from 'react';
import './sonar-maze.css';

const DIFFS = {
  beginner:     { label: '初级', rows: 11, cols: 11, monsters: 1, pings: 8,  coins: 6,  alertTurns: 5, radius: 5 },
  intermediate: { label: '中级', rows: 15, cols: 15, monsters: 2, pings: 8,  coins: 10, alertTurns: 6, radius: 5 },
  expert:       { label: '高级', rows: 19, cols: 19, monsters: 3, pings: 10, coins: 14, alertTurns: 7, radius: 6 },
};

const DIRS = { n: [-1, 0], s: [1, 0], w: [0, -1], e: [0, 1] };
const OPP = { n: 's', s: 'n', e: 'w', w: 'e' };
const REVEAL_MS = 2200;   // 声呐照亮持续时间
const PREVIEW_MS = 3000;  // 开局预览时间

function bestKey(d) { return `webgames-sonar-best-${d}`; }
function loadBest(d) {
  try {
    const v = localStorage.getItem(bestKey(d));
    return v == null ? null : parseInt(v, 10);
  } catch {
    return null;
  }
}

/** 递归回溯生成迷宫，并随机打通少量环路 */
function genMaze(rows, cols) {
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ n: true, e: true, s: true, w: true })));
  const visited = new Set([0]);
  const stack = [[0, 0]];
  while (stack.length) {
    const [r, c] = stack[stack.length - 1];
    const opts = [];
    if (r > 0 && !visited.has((r - 1) * cols + c)) opts.push('n');
    if (r < rows - 1 && !visited.has((r + 1) * cols + c)) opts.push('s');
    if (c > 0 && !visited.has(r * cols + c - 1)) opts.push('w');
    if (c < cols - 1 && !visited.has(r * cols + c + 1)) opts.push('e');
    if (!opts.length) { stack.pop(); continue; }
    const dir = opts[(Math.random() * opts.length) | 0];
    const [dr, dc] = DIRS[dir];
    const nr = r + dr, nc = c + dc;
    cells[r][c][dir] = false;
    cells[nr][nc][OPP[dir]] = false;
    visited.add(nr * cols + nc);
    stack.push([nr, nc]);
  }
  const extra = Math.floor(rows * cols * 0.06);
  for (let i = 0; i < extra; i++) {
    const r = (Math.random() * rows) | 0, c = (Math.random() * cols) | 0;
    const dir = ['n', 's', 'e', 'w'][(Math.random() * 4) | 0];
    const [dr, dc] = DIRS[dir];
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
    cells[r][c][dir] = false;
    cells[nr][nc][OPP[dir]] = false;
  }
  return cells;
}

function openNeighbors(maze, rows, cols, r, c) {
  const res = [];
  const cell = maze[r][c];
  for (const d of ['n', 's', 'w', 'e']) {
    if (cell[d]) continue;
    const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
    if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) res.push([nr, nc]);
  }
  return res;
}

/** 声呐：从 (sr,sc) 出发、不穿墙的 BFS，返回被照亮格子的 key 数组 */
function sonarCells(maze, rows, cols, sr, sc, radius) {
  const seen = new Set([sr * cols + sc]);
  const out = [sr * cols + sc];
  const q = [[sr, sc, 0]];
  while (q.length) {
    const [r, c, d] = q.shift();
    if (d === radius) continue;
    for (const [nr, nc] of openNeighbors(maze, rows, cols, r, c)) {
      const k = nr * cols + nc;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(k);
      q.push([nr, nc, d + 1]);
    }
  }
  return out;
}

/** BFS 求怪到玩家的下一步（警觉时追击用） */
function bfsStep(maze, rows, cols, sr, sc, tr, tc) {
  if (sr === tr && sc === tc) return null;
  const startK = sr * cols + sc;
  const prev = new Map();
  const seen = new Set([startK]);
  const q = [[sr, sc]];
  while (q.length) {
    const [r, c] = q.shift();
    for (const [nr, nc] of openNeighbors(maze, rows, cols, r, c)) {
      const k = nr * cols + nc;
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, r * cols + c);
      if (nr === tr && nc === tc) {
        let cur = k;
        while (prev.get(cur) !== startK) cur = prev.get(cur);
        return [Math.floor(cur / cols), cur % cols];
      }
      q.push([nr, nc]);
    }
  }
  return null;
}

export default function SonarMaze() {
  const [diffKey, setDiffKey] = useState('beginner');
  const [maze, setMaze] = useState(null);
  const [pr, setPr] = useState(0);
  const [pc, setPc] = useState(0);
  const [exit, setExit] = useState({ r: 0, c: 0 });
  const [coins, setCoins] = useState(new Set());
  const [collected, setCollected] = useState(new Set());
  const [monsters, setMonsters] = useState([]);
  const [pingsLeft, setPingsLeft] = useState(0);
  const [reveals, setReveals] = useState([]);
  const [status, setStatus] = useState('playing');
  const [preview, setPreview] = useState(true);
  const [previewUntil, setPreviewUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [score, setScore] = useState(0);
  const [coinsGot, setCoinsGot] = useState(0);
  const [best, setBest] = useState(() => loadBest('beginner'));
  const [isNewBest, setIsNewBest] = useState(false);

  const startLevel = (key) => {
    const d = DIFFS[key];
    const m = genMaze(d.rows, d.cols);
    const ex = { r: d.rows - 1, c: d.cols - 1 };
    const coinSet = new Set();
    let guard = 0;
    while (coinSet.size < d.coins && guard++ < 1000) {
      const r = (Math.random() * d.rows) | 0, c = (Math.random() * d.cols) | 0;
      const k = r * d.cols + c;
      if (k === 0 || (r === ex.r && c === ex.c)) continue;
      coinSet.add(k);
    }
    const mons = [];
    guard = 0;
    while (mons.length < d.monsters && guard++ < 3000) {
      const r = (Math.random() * d.rows) | 0, c = (Math.random() * d.cols) | 0;
      if (Math.abs(r) + Math.abs(c) < 6) continue;
      if (r === ex.r && c === ex.c) continue;
      if (mons.some(mm => mm.r === r && mm.c === c)) continue;
      mons.push({ r, c, alert: 0 });
    }
    setMaze(m);
    setPr(0); setPc(0);
    setExit(ex);
    setCoins(coinSet);
    setCollected(new Set());
    setMonsters(mons);
    setPingsLeft(d.pings);
    setReveals([]);
    setStatus('playing');
    setScore(0);
    setCoinsGot(0);
    setIsNewBest(false);
    setBest(loadBest(key));
    setPreview(true);
    setPreviewUntil(Date.now() + PREVIEW_MS);
  };

  useEffect(() => {
    startLevel(diffKey);
    const t = setTimeout(() => setPreview(false), PREVIEW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diffKey]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const doMove = (nr, nc) => {
    if (status !== 'playing' || preview || !maze) return;
    const d = DIFFS[diffKey];
    if (nr < 0 || nr >= d.rows || nc < 0 || nc >= d.cols) return;
    if (Math.abs(nr - pr) + Math.abs(nc - pc) !== 1) return;
    const dir = nr < pr ? 'n' : nr > pr ? 's' : nc < pc ? 'w' : 'e';
    if (maze[pr][pc][dir]) return; // 撞墙
    if (monsters.some(m => m.r === nr && m.c === nc)) {
      setPr(nr); setPc(nc);
      setStatus('lost');
      return;
    }
    const k = nr * d.cols + nc;
    let got = coinsGot;
    if (coins.has(k) && !collected.has(k)) {
      const next = new Set(collected);
      next.add(k);
      setCollected(next);
      got = coinsGot + 1;
      setCoinsGot(got);
    }
    if (nr === exit.r && nc === exit.c) {
      const sc = got * 100 + pingsLeft * 50;
      const pb = loadBest(diffKey);
      const rec = pb == null || sc > pb;
      if (rec) {
        try { localStorage.setItem(bestKey(diffKey), String(sc)); } catch { /* ignore */ }
        setBest(sc);
      }
      setIsNewBest(rec);
      setScore(sc);
      setPr(nr); setPc(nc);
      setStatus('won');
      return;
    }
    const nm = monsters.map(m => {
      let { r, c, alert } = m;
      let tr = r, tc = c;
      if (alert > 0) {
        const s = bfsStep(maze, d.rows, d.cols, r, c, nr, nc);
        if (s) { tr = s[0]; tc = s[1]; }
        alert -= 1;
      } else {
        const opts = openNeighbors(maze, d.rows, d.cols, r, c);
        if (opts.length) {
          const o = opts[(Math.random() * opts.length) | 0];
          tr = o[0]; tc = o[1];
        }
      }
      return { r: tr, c: tc, alert };
    });
    setMonsters(nm);
    setPr(nr); setPc(nc);
    if (nm.some(m => m.r === nr && m.c === nc)) setStatus('lost');
  };

  const doPing = () => {
    if (status !== 'playing' || preview || !maze || pingsLeft <= 0) return;
    const d = DIFFS[diffKey];
    const cellKeys = sonarCells(maze, d.rows, d.cols, pr, pc, d.radius);
    const keySet = new Set(cellKeys);
    const t = Date.now();
    setReveals(rs => [...rs.filter(r => r.expiresAt > t), { cells: cellKeys, expiresAt: t + REVEAL_MS }]);
    setMonsters(ms => ms.map(m =>
      keySet.has(m.r * d.cols + m.c) ? { ...m, alert: d.alertTurns } : m));
    setPingsLeft(p => p - 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === ' ') { e.preventDefault(); doPing(); return; }
      const mv = {
        ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
        w: [-1, 0], s: [1, 0], a: [0, -1], d: [0, 1],
        W: [-1, 0], S: [1, 0], A: [0, -1], D: [0, 1],
      }[e.key];
      if (mv) { e.preventDefault(); doMove(pr + mv[0], pc + mv[1]); return; }
      if (e.key === 'r' || e.key === 'R') startLevel(diffKey);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!maze) return null;
  const d = DIFFS[diffKey];

  // 各格子被照亮的剩余时间（取多次声呐的最大值）
  const remain = new Map();
  for (const r of reveals) {
    const left = r.expiresAt - now;
    if (left <= 0) continue;
    for (const k of r.cells) remain.set(k, Math.max(remain.get(k) || 0, left));
  }

  const face = status === 'won' ? '😎' : status === 'lost' ? '😵' : '🦇';
  const previewCount = Math.max(0, Math.ceil((previewUntil - now) / 1000));
  const myOpen = openNeighbors(maze, d.rows, d.cols, pr, pc);
  const canGoTo = (r, c) => myOpen.some(([nr, nc]) => nr === r && nc === c);

  const renderCell = (r, c) => {
    const k = r * d.cols + c;
    const cell = maze[r][c];
    const isPlayer = pr === r && pc === c;
    const monster = monsters.find(m => m.r === r && m.c === c);
    const distP = Math.abs(pr - r) + Math.abs(pc - c);
    const lit = preview || remain.has(k);
    const fading = !preview && remain.has(k) && remain.get(k) < 700;
    let cls = 'sm-cell';
    if (lit) cls += ' lit';
    if (fading) cls += ' fade';
    let text = '';
    if (isPlayer) {
      text = '🦇';
    } else if (monster && lit) {
      text = '👹';
    } else if (monster && distP <= 2 && status === 'playing') {
      text = '👹';
      cls += ' sensed';
    } else if (r === exit.r && c === exit.c && lit) {
      text = '🚪';
    } else if (coins.has(k) && !collected.has(k) && lit) {
      text = '🪙';
    }
    if (!isPlayer && !lit && status === 'playing' && !preview && canGoTo(r, c)) cls += ' hint';
    const wallC = '#4a5f8f';
    return (
      <button
        key={k}
        className={cls}
        style={{
          borderTop: `2px solid ${cell.n ? wallC : 'transparent'}`,
          borderLeft: `2px solid ${cell.w ? wallC : 'transparent'}`,
        }}
        onClick={() => doMove(r, c)}
        aria-label={`格子 ${r},${c}`}
      >
        {text}
      </button>
    );
  };

  return (
    <div className="sm-wrap">
      <h1 className="sm-title">🦇 声呐迷宫</h1>
      <p className="sm-sub">你是黑暗中的蝙蝠。用声呐探路、收集金币、找到出口——但声呐会惊动"听声者"</p>

      <div className="sm-diffs">
        {Object.entries(DIFFS).map(([key, df]) => (
          <button
            key={key}
            className={`sm-diff${key === diffKey ? ' active' : ''}`}
            onClick={() => setDiffKey(key)}
          >
            {df.label} {df.rows}×{df.cols}
          </button>
        ))}
      </div>
      <div className="sm-best">{best != null ? `🏆 本难度最高分：${best}` : '🏆 本难度暂无纪录，来创一个吧'}</div>

      {preview && <div className="sm-banner info">👁 先记住地形，{previewCount} 秒后陷入黑暗…</div>}
      {status === 'won' && <div className="sm-banner won">🎉 逃出迷宫！得分 {score}{isNewBest ? ' · 新纪录！' : ''}</div>}
      {status === 'lost' && <div className="sm-banner lost">👹 被听声者抓住了…再来一局？</div>}

      <div className="sm-panel">
        <button
          className="sm-ping"
          onClick={doPing}
          disabled={pingsLeft <= 0 || status !== 'playing' || preview}
          title="发射声呐（空格）"
        >
          📡 声呐 × {pingsLeft}
        </button>
        <div className="sm-stat">🪙 {coinsGot}/{coins.size}</div>
        <button className="sm-face" onClick={() => startLevel(diffKey)} title="重新开始">{face}</button>
        <div className="sm-stat">👹 × {monsters.length}</div>
      </div>

      <div className="sm-board-wrap">
        <div className="sm-board" style={{ '--cols': d.cols }}>
          {maze.map((row, r) => row.map((_, c) => renderCell(r, c)))}
        </div>
      </div>

      <p className="sm-tip">
        点相邻格子移动（电脑用 WASD / 方向键，空格发射声呐，R 重开）<br />
        声呐照亮周围、不穿墙，约 2 秒后熄灭；范围内的"听声者"会被惊动并来抓你<br />
        离你 2 格内的怪能隐约听到（红色闪烁）；金币 +100，剩余声呐每个 +50
      </p>
    </div>
  );
}
