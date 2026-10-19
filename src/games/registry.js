import Minesweeper from './minesweeper/Minesweeper.jsx';

/**
 * 游戏注册表：新增游戏只需在这里加一行，
 * 大厅会自动渲染卡片，无需改路由。
 */
export const GAMES = [
  {
    id: 'minesweeper',
    name: '扫雷',
    description: '经典扫雷：初级 9×9 / 中级 16×16 / 高级 16×30，支持手机触屏标记模式',
    icon: '💣',
    Component: Minesweeper,
  },
];
