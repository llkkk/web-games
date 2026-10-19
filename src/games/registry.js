import Minesweeper from './minesweeper/Minesweeper.jsx';
import SonarMaze from './sonar-maze/SonarMaze.jsx';

/**
 * 游戏注册表：新增游戏只需在这里加一行，
 * 大厅会自动渲染卡片，无需改路由。
 */
export const GAMES = [
  {
    id: 'minesweeper',
    name: '扫雷',
    description: '经典扫雷，三种难度，手机电脑都能玩',
    icon: '💣',
    Component: Minesweeper,
  },
  {
    id: 'sonar-maze',
    name: '声呐迷宫',
    description: '化身黑暗中的蝙蝠，用声呐探路找出口，躲开循声而来的怪',
    icon: '🦇',
    Component: SonarMaze,
  },
];
