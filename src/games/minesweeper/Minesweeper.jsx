import { useEffect, useState } from 'react';
import './minesweeper.css';

const DIFFICULTIES = {
  beginner: { label: '初级 9×9', rows: 9, cols: 9, mines: 10 },
  intermediate: { label: '中级 16×16', rows: 16, cols: 16, mines: 40 },
  expert: { label: '高级 16×30', rows: 16, cols: 30, mines: 99 },
};

function neighborsOf(rows, cols, r, c) {
  const res = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) res.push([nr, nc]);
    }
  }
  return res;
}

const cloneBoard = (board) => board.map((row) => row.map((c) => ({ ...c })));

/** 首次点击后布雷：点击格及其周围 3×3 不埋雷，保证开局必有展开 */
function buildBoard(rows, cols, mines, safeR, safeC) {
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ mine: false, revealed: false, flagged: false, adjacent: 0 }))
  );
  const safe = new Set([safeR * cols + safeC]);
  for (const [r, c] of neighborsOf(rows, cols, safeR, safeC)) safe.add(r * cols + c);
  const target = Math.min(mines, rows * cols - safe.size);
  let placed = 0, guard = 0;
  while (placed < target && guard++ < 30000) {
    const r = (Math.random() * rows) | 0;
    const c = (Math.random() * cols) | 0;
    if (safe.has(r * cols + c) || cells[r][c].mine) continue;
    cells[r][c].mine = true;
    placed++;
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells[r][c].adjacent = neighborsOf(rows, cols, r, c).filter(([nr, nc]) => cells[nr][nc].mine).length;
    }
  }
  return { cells, mines: target };
}

/** 从 (sr, sc) 开始的 flood 展开，返回新棋盘与新翻开格数 */
function floodOpen(board, rows, cols, sr, sc) {
  const nb = cloneBoard(board);
  let count = 0;
  const stack = [[sr, sc]];
  while (stack.length) {
    const [r, c] = stack.pop();
    const cell = nb[r][c];
    if (cell.revealed || cell.flagged || cell.mine) continue;
    cell.revealed = true;
    count++;
    if (cell.adjacent === 0) {
      for (const [nr, nc] of neighborsOf(rows, cols, r, c)) {
        if (!nb[nr][nc].revealed) stack.push([nr, nc]);
      }
    }
  }
  return { board: nb, count };
}

/** 获胜时把所有雷自动标旗 */
function flagAllMines(board) {
  const nb = cloneBoard(board);
  for (const row of nb) for (const cell of row) if (cell.mine) cell.flagged = true;
  return nb;
}

/** 三位计数器显示（可为负） */
function fmt(n) {
  const v = Math.max(-99, Math.min(999, n));
  return (v < 0 ? '-' : '') + String(Math.abs(v)).padStart(3, '0');
}

export default function Minesweeper() {
  const [diffKey, setDiffKey] = useState('beginner');
  const { rows, cols, mines } = DIFFICULTIES[diffKey];
  const [cells, setCells] = useState(null); // null = 还没点第一下
  const [totalMines, setTotalMines] = useState(mines);
  const [status, setStatus] = useState('ready'); // ready | playing | won | lost
  const [flagCount, setFlagCount] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [touchMode, setTouchMode] = useState('dig'); // dig=挖掘 | flag=标记（触屏用）
  const [explodedAt, setExplodedAt] = useState(null);

  const reset = () => {
    setCells(null);
    setTotalMines(DIFFICULTIES[diffKey].mines);
    setStatus('ready');
    setFlagCount(0);
    setRevealedCount(0);
    setElapsed(0);
    setExplodedAt(null);
  };

  useEffect(() => { reset(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [diffKey]);

  useEffect(() => {
    if (status !== 'playing') return;
    const t = setInterval(() => setElapsed((e) => Math.min(e + 1, 999)), 1000);
    return () => clearInterval(t);
  }, [status]);

  const checkWin = (newRevealed, board, mineTotal) => {
    if (newRevealed === rows * cols - mineTotal) {
      setCells(flagAllMines(board));
      setRevealedCount(newRevealed);
      setFlagCount(mineTotal);
      setStatus('won');
      return true;
    }
    return false;
  };

  /** chord：点击已翻开的数字，周围旗子凑齐则展开其余邻格 */
  const chord = (r, c, board, mineTotal, baseRevealed) => {
    const cell = board[r][c];
    if (!cell.revealed || cell.adjacent === 0) return;
    const ns = neighborsOf(rows, cols, r, c);
    const flagsAround = ns.filter(([nr, nc]) => board[nr][nc].flagged).length;
    if (flagsAround !== cell.adjacent) return;
    const nb = cloneBoard(board);
    let hitMine = false;
    const stack = [];
    for (const [nr, nc] of ns) {
      const t = nb[nr][nc];
      if (t.flagged || t.revealed) continue;
      if (t.mine) { t.revealed = true; hitMine = true; setExplodedAt([nr, nc]); }
      else stack.push([nr, nc]);
    }
    let count = 0;
    while (stack.length && !hitMine) {
      const [cr, cc] = stack.pop();
      const t = nb[cr][cc];
      if (t.revealed || t.flagged || t.mine) continue;
      t.revealed = true;
      count++;
      if (t.adjacent === 0) {
        for (const [nr, nc] of neighborsOf(rows, cols, cr, cc)) {
          if (!nb[nr][nc].revealed) stack.push([nr, nc]);
        }
      }
    }
    if (hitMine) { setCells(nb); setStatus('lost'); return; }
    const newRevealed = baseRevealed + count;
    if (!checkWin(newRevealed, nb, mineTotal)) {
      setCells(nb);
      setRevealedCount(newRevealed);
    }
  };

  const revealCell = (r, c) => {
    if (status === 'won' || status === 'lost') return;
    let board = cells;
    let mineTotal = totalMines;
    let baseRevealed = revealedCount;
    if (!board) {
      // 第一下：布雷（该格及周围不埋），计时开始
      const built = buildBoard(rows, cols, mines, r, c);
      board = built.cells;
      mineTotal = built.mines;
      setTotalMines(mineTotal);
      setStatus('playing');
      baseRevealed = 0;
    }
    const cell = board[r][c];
    if (cell.flagged) return;
    if (cell.revealed) { chord(r, c, board, mineTotal, baseRevealed); return; }
    if (cell.mine) {
      const nb = cloneBoard(board);
      nb[r][c].revealed = true;
      setCells(nb);
      setExplodedAt([r, c]);
      setStatus('lost');
      return;
    }
    const { board: nb, count } = floodOpen(board, rows, cols, r, c);
    const newRevealed = baseRevealed + count;
    if (!checkWin(newRevealed, nb, mineTotal)) {
      setCells(nb);
      setRevealedCount(newRevealed);
    }
  };

  const toggleFlag = (r, c) => {
    if (status === 'won' || status === 'lost' || !cells) return;
    if (cells[r][c].revealed) return;
    const nb = cloneBoard(cells);
    nb[r][c].flagged = !nb[r][c].flagged;
    setCells(nb);
    setFlagCount((f) => f + (nb[r][c].flagged ? 1 : -1));
  };

  const handleTap = (r, c) => {
    if (touchMode === 'flag') toggleFlag(r, c);
    else revealCell(r, c);
  };

  const renderCell = (cell, r, c) => {
    const isExploded = explodedAt && explodedAt[0] === r && explodedAt[1] === c;
    let cls = 'cell';
    let text = '';
    if (cell.revealed) {
      cls += ' revealed';
      if (cell.mine) {
        text = '💣';
        if (isExploded) cls += ' exploded';
      } else if (cell.adjacent > 0) {
        text = cell.adjacent;
        cls += ` n${cell.adjacent}`;
      }
    } else if (cell.flagged) {
      text = status === 'lost' && !cell.mine ? '❌' : '🚩';
    } else if (status === 'lost' && cell.mine) {
      text = '💣';
    }
    return (
      <button
        key={`${r}-${c}`}
        className={cls}
        onClick={() => handleTap(r, c)}
        onContextMenu={(e) => { e.preventDefault(); toggleFlag(r, c); }}
      >
        {text}
      </button>
    );
  };

  const face = status === 'won' ? '😎' : status === 'lost' ? '😵' : '🙂';

  return (
    <div className="ms-wrap">
      <h1 className="ms-title">💣 扫雷</h1>
      <p className="ms-sub">左键翻开 · 右键标记 · 点击数字快速展开 · 手机用下方标记模式</p>

      <div className="ms-diffs">
        {Object.entries(DIFFICULTIES).map(([key, d]) => (
          <button
            key={key}
            className={`ms-diff${key === diffKey ? ' active' : ''}`}
            onClick={() => setDiffKey(key)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {status === 'won' && <div className="ms-banner won">🎉 扫清了！用时 {elapsed} 秒</div>}
      {status === 'lost' && <div className="ms-banner lost">💥 踩雷了，再来一局？</div>}

      <div className="ms-panel">
        <div className="ms-counter">{fmt(totalMines - flagCount)}</div>
        <button className="ms-face" onClick={reset} title="重新开始">{face}</button>
        <div className="ms-counter">{fmt(elapsed)}</div>
      </div>

      <div className="ms-board-wrap">
        <div className="ms-board" style={{ '--cols': cols }}>
          {cells
            ? cells.map((row, r) => row.map((cell, c) => renderCell(cell, r, c)))
            : Array.from({ length: rows }, (_, r) =>
                Array.from({ length: cols }, (_, c) => (
                  <button key={`${r}-${c}`} className="cell" onClick={() => handleTap(r, c)} />
                ))
              )}
        </div>
      </div>

      <div className="ms-touchbar">
        <button
          className={`ms-mode${touchMode === 'dig' ? ' active' : ''}`}
          onClick={() => setTouchMode('dig')}
        >
          ⛏️ 挖掘
        </button>
        <button
          className={`ms-mode${touchMode === 'flag' ? ' active' : ''}`}
          onClick={() => setTouchMode('flag')}
        >
          🚩 标记
        </button>
      </div>

      <p className="ms-tip">
        首次点击必不踩雷 · 电脑上右键插旗 · 点已翻开的数字可联动展开<br />
        高级 16×30 在手机上可左右滑动棋盘
      </p>
    </div>
  );
}
