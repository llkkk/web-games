import React from 'react';
import ReactDOM from 'react-dom/client';
import { GAMES } from './games/registry.js';
import './index.css';

function Hall() {
  return (
    <div className="site">
      <header className="topbar">
        <a className="brand" href="/">🎮 Web Games</a>
      </header>
      <main className="hall-main">
        <h1 className="hall-title">在线小游戏合集</h1>
        <p className="hall-sub">打开即玩，无需下载、无需注册</p>
        <div className="hall-grid">
          {GAMES.map((g) => (
            <a key={g.id} className="game-card" href={g.path}>
              <div className="game-icon">{g.icon}</div>
              <div className="game-name">{g.name}</div>
              <p className="game-desc">{g.description}</p>
              <div className="game-meta">{g.meta}</div>
            </a>
          ))}
        </div>
      </main>
      <footer className="footer">Web Games · 免费在线小游戏</footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Hall />
  </React.StrictMode>
);
