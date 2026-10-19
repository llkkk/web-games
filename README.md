# 🎮 Web Games

在线网页小游戏合集（Vite + React），纯前端、打开即玩。

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build   # 产物在 dist/
```

## 新增一个游戏（3 步）

1. 在 `src/games/<游戏id>/` 下新建游戏组件（例如 `Minesweeper.jsx` + 样式文件），default export 组件。
2. 在 `src/games/registry.js` 里加一行：

```js
import MyGame from './my-game/MyGame.jsx';
// ...
{ id: 'my-game', name: '我的游戏', description: '一句话介绍', icon: '🎯', Component: MyGame },
```

3. 大厅会自动出现新游戏卡片，无需改路由。

## 部署

Cloudflare Pages：构建命令 `npm run build`，输出目录 `dist`。

## 已有游戏

- 💣 扫雷：初级 9×9 / 中级 16×16 / 高级 16×30；首次点击必不踩雷；支持右键标记、手机触屏标记模式、点击数字快速展开（chord）
