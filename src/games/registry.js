import Minesweeper from './minesweeper/Minesweeper.jsx';
import SonarMaze from './sonar-maze/SonarMaze.jsx';

/**
 * 游戏注册表：新增游戏 3 步
 * 1. 在 src/games/<id>/ 下写游戏组件
 * 2. 在 vite.config.js 的 input 里加 'id/index': resolve(__dirname, 'id.html')
 * 3. 在根目录加 id.html（独立 title/meta），并在 public/sitemap.xml 里加一条
 * 4. 在这里加一行，大厅自动出现卡片
 */
export const GAMES = [
  {
    id: 'minesweeper',
    name: '扫雷',
    description: '经典扫雷，三种难度，手机电脑都能玩',
    icon: '💣',
    path: '/minesweeper/',
    meta: '单人 · 约 5 分钟 · 益智',
    Component: Minesweeper,
  },
  {
    id: 'sonar-maze',
    name: '声呐迷宫',
    description: '化身黑暗中的蝙蝠，用声呐探路找出口，躲开循声而来的怪',
    icon: '🦇',
    path: '/sonar-maze/',
    meta: '单人 · 约 10 分钟 · 解谜',
    Component: SonarMaze,
  },
];
