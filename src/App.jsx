import { useState } from 'react';
import Hall from './components/Hall.jsx';
import { GAMES } from './games/registry.js';

export default function App() {
  const [activeId, setActiveId] = useState(null);
  const active = GAMES.find((g) => g.id === activeId);
  const ActiveComponent = active?.Component;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setActiveId(null)}>
          <span>🎮</span>
          <span>Web Games</span>
        </button>
        {active && (
          <button className="back-btn" onClick={() => setActiveId(null)}>
            ← 返回大厅
          </button>
        )}
      </header>
      <main className="main">
        {active && ActiveComponent ? <ActiveComponent /> : <Hall onPick={setActiveId} />}
      </main>
      <footer className="footer">Web Games · 免费在线小游戏</footer>
    </div>
  );
}
