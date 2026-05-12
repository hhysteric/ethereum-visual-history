# Ethereum — A Visual History

以太坊可视化编年史。学术/报纸风格的多页单文件站,按知识路径分区浏览以太坊的历史、技术、现状与未来。

## 特性

- **6 个板块** · 首页 / 入门 / 技术 / 现状 / 未来 / 工具
- **侧边栈导航 + hash 路由** · 单 HTML,`#/basics` 样式的页面切换,无刷新
- **实时数据** · CoinGecko 价格 + Etherscan Gas/区块 + beaconcha.in 验证者,带 24h localStorage 缓存与失败回退
- **4 个 Chart.js 图表** · 能耗对比 / Gas 历史 / 质押分布 / 客户端分布
- **3 个交互工具** · 质押收益计算器 · Gas 费模拟器 · 迷你区块浏览器
- **零依赖构建** · 纯 HTML + CSS + JS,Chart.js 走 CDN

## 本地预览

```bash
# 任选一种
python -m http.server 8000
# 或
npx serve .
```

然后访问 `http://localhost:8000`。

## 文件结构

```
├── index.html     # 单页骨架 · 侧边栈 + 6 页容器
├── style.css      # 学术白底 · 报纸风样式
└── script.js      # hash 路由 · 实时数据 · 图表 · 工具
```

## 设计风格

米白纸张底(`#faf8f3`)+ 近黑正文 + 学术红/蓝强调色,Source Serif Pro 衬线刊头 + JetBrains Mono 数字。
整体参考 historyofmarket.com 的学术编年史风格。

## License

仅作教育用途整理。数据来源详见页内注释。
