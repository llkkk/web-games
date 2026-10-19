import { GAMES } from '../games/registry.js';

export default function Hall({ onPick }) {
  return (
    <div>
      <h1 className="hall-title">🎮 游戏大厅</h1>
      <div className="hall-grid">
        {GAMES.map((g) => (
          <button key={g.id} className="game-card" onClick={() => onPick(g.id)}>
            <div className="game-icon">{g.icon}</div>
            <div className="game-name">{g.name}</div>
            <p className="game-desc">{g.description}</p>
            <span className="game-play">开始游戏 →</span>
          </button>
        ))}
      </div>
      {GAMES.length === 0 && <p className="hall-empty">还没有游戏，敬请期待。</p>}
    </div>
  );
}
