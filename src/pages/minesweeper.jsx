import React from 'react';
import ReactDOM from 'react-dom/client';
import Minesweeper from '../games/minesweeper/Minesweeper.jsx';
import '../index.css';

function Page() {
  return (
    <div className="site">
      <header className="topbar">
        <a className="brand" href="/">🎮 Web Games</a>
      </header>
      <main className="game-main">
        <a className="back-link" href="/">‹ 返回游戏大厅</a>
        <div className="game-stage">
          <Minesweeper />
        </div>
      </main>
      <footer className="footer">Web Games · 免费在线小游戏<br /><a href="/about/">关于</a><a href="/privacy/">隐私</a><a href="/contact/">联系</a></footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Page />
  </React.StrictMode>
);
