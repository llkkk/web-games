# 🎮 Web Games

在线小游戏合集（Vite + React），纯前端、打开即玩。浅色极简工具风。

## 本地运行

```bash
npm install
npm run dev          # 大厅 http://localhost:5173/，游戏页 /minesweeper/ /sonar-maze/
```

## 构建

```bash
npm run build   # 多页构建，产物在 dist/
```

## 新增一个游戏（4 步）

1. 在 `src/games/<游戏id>/` 下新建游戏组件（default export）。
2. 在 `src/pages/<游戏id>.jsx` 下新建页面入口（照抄 `src/pages/minesweeper.jsx` 的结构：顶栏 + 返回链接 + `.game-stage` 包裹游戏）。
3. 在根目录加 `<游戏id>/index.html`（独立 `<title>` + meta description），并在 `vite.config.js` 的 `input` 里加一行。
4. 在 `src/games/registry.js` 里加一行（含 `path: '/<游戏id>/'` 与 `meta: '单人 · 约 X 分钟 · 类型'`），在 `public/sitemap.xml` 里加一条 URL。

大厅会自动出现新游戏卡片。每个游戏是独立 URL + 独立 title/meta，便于搜索引擎收录。

## 部署

Cloudflare Pages：构建命令 `npm run build`，输出目录 `dist`。
线上地址：https://web-games-c0n.pages.dev/

## 已有游戏

- 💣 扫雷（`/minesweeper/`）：初级 9×9 / 中级 16×16 / 高级 16×30；首次点击必不踩雷；支持右键标记、手机触屏标记模式、点击数字快速展开（chord）
- 🦇 声呐迷宫（`/sonar-maze/`）：黑暗迷宫 + 声呐探路；三档难度；"听声者"会被声呐惊动并追击；金币收集与最高分
