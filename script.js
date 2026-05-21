// ---- 背景粒子网络(白底主题已关闭) ----
(function () {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas || getComputedStyle(canvas).display === "none") return;
  const ctx = canvas.getContext("2d");
  let w, h, nodes;

  function resize() {
    w = canvas.width = window.innerWidth * devicePixelRatio;
    h = canvas.height = window.innerHeight * devicePixelRatio;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
  }

  function init() {
    resize();
    const count = Math.min(80, Math.floor((window.innerWidth * window.innerHeight) / 16000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4 * devicePixelRatio,
      vy: (Math.random() - 0.5) * 0.4 * devicePixelRatio,
      r: (Math.random() * 1.5 + 0.5) * devicePixelRatio,
    }));
  }

  function step() {
    ctx.clearRect(0, 0, w, h);

    // draw links
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        const max = 140 * devicePixelRatio;
        if (d < max) {
          const alpha = 1 - d / max;
          ctx.strokeStyle = `rgba(125,140,255,${alpha * 0.25})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // draw nodes
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > w) n.vx *= -1;
      if (n.y < 0 || n.y > h) n.vy *= -1;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(169,180,255,0.75)";
      ctx.fill();
    }

    requestAnimationFrame(step);
  }

  window.addEventListener("resize", init);
  init();
  step();
})();

// ---- 滚动出现动画 ----
(function () {
  const targets = document.querySelectorAll(
    ".section-head, .card, .layer, .split-card, .evm-box, .pos-item, .cf-step, " +
    ".trie-card, .acc, .gas-card, .rc-card, .danksharding, .timeline li, " +
    ".note, .opcode-table, .op-cost, .gas-formula, " +
    ".intro-card, .vs-table, .ht-item, .vs-col, .energy-chart-wrap, " +
    ".pain-card, .chart-card, .rm-card, .eip-table, .tool-card, .faq-item, " +
    ".eco-group"
  );
  targets.forEach((el) => el.classList.add("reveal"));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("on");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  targets.forEach((el) => io.observe(el));
})();

// =======================================================
// Hash 路由：#/home / #/basics / #/tech / #/today / #/future / #/tools
// =======================================================
(function () {
  const PAGES = ["home", "basics", "tech", "today", "future", "tools"];
  const DEFAULT = "home";
  const pageEls = document.querySelectorAll(".page[data-page]");
  const linkEls = document.querySelectorAll(".side-links a[data-link]");

  function currentRoute() {
    const h = (location.hash || "").replace(/^#\/?/, "");
    return PAGES.includes(h) ? h : DEFAULT;
  }

  function showPage(name) {
    pageEls.forEach((el) => {
      const match = el.dataset.page === name;
      el.classList.toggle("active", match);
    });
    linkEls.forEach((a) => {
      a.classList.toggle("active", a.dataset.link === name);
    });
    // 切页后回到顶部（只滚动主区，不影响 side-nav）
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    // 再次触发 IntersectionObserver（新页的元素初次进入视口）
    document.querySelectorAll(".page.active .reveal:not(.on)").forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.95) el.classList.add("on");
    });
  }

  function onHashChange() {
    showPage(currentRoute());
  }

  // 如果进入时没有 hash，设置默认
  if (!location.hash) {
    history.replaceState(null, "", "#/" + DEFAULT);
  }

  window.addEventListener("hashchange", onHashChange);
  // 首屏
  document.addEventListener("DOMContentLoaded", onHashChange);
  // 若脚本在 body 尾部加载且 DOM 已就绪，直接调用
  if (document.readyState !== "loading") onHashChange();
})();

// =======================================================
// 全局状态：ETH 价格（供工具换算使用）
// =======================================================
const App = {
  ethPrice: 3000, // fallback
};

// =======================================================
// 实时数据接入：CoinGecko + Etherscan + beaconcha.in
// 带：超时 · 失败回退 · localStorage 缓存
// =======================================================
function fmtNum(n, digits = 2) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
function fmtCompact(n) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return String(n);
}

// 带超时的 fetch
function fetchWithTimeout(url, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// localStorage 简易缓存
const Cache = {
  set(key, value) {
    try {
      localStorage.setItem("eth_" + key, JSON.stringify({ t: Date.now(), v: value }));
    } catch (e) {}
  },
  get(key, maxAge = 24 * 3600 * 1000) {
    try {
      const raw = localStorage.getItem("eth_" + key);
      if (!raw) return null;
      const { t, v } = JSON.parse(raw);
      if (Date.now() - t > maxAge) return null;
      return v;
    } catch (e) { return null; }
  },
};

// 渲染：价格
function renderPrice(price, chg, stale = false) {
  if (price == null) return;
  App.ethPrice = price;
  const el = document.getElementById("live-price");
  el.textContent = "$" + fmtNum(price, 2);
  el.title = stale ? "数据来自本地缓存" : "";
  const chgEl = document.getElementById("live-price-chg");
  if (chg != null) {
    chgEl.textContent = (stale ? "⟲ " : "") + (chg >= 0 ? "▲ " : "▼ ") + Math.abs(chg).toFixed(2) + "% · 24h";
    chgEl.className = chg >= 0 ? "up" : "down";
  } else if (stale) {
    chgEl.textContent = "⟲ 缓存";
    chgEl.className = "";
  }
  if (typeof updateStakeCalc === "function") updateStakeCalc();
  if (typeof updateGasCalc === "function") updateGasCalc();
}

async function fetchPrice() {
  try {
    const res = await fetchWithTimeout(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true"
    );
    if (!res.ok) throw new Error("coingecko " + res.status);
    const data = await res.json();
    const price = data?.ethereum?.usd;
    const chg = data?.ethereum?.usd_24h_change;
    if (price) {
      Cache.set("price", { price, chg });
      renderPrice(price, chg, false);
    }
  } catch (e) {
    console.warn("price fetch failed", e);
    const cached = Cache.get("price");
    if (cached) renderPrice(cached.price, cached.chg, true);
  }
}

function renderGas(res, stale = false) {
  if (!res) return;
  const { SafeGasPrice, ProposeGasPrice, FastGasPrice } = res;
  const el = document.getElementById("live-gas");
  el.textContent = ProposeGasPrice;
  el.title = stale ? "数据来自本地缓存" : "";
  document.getElementById("live-gas-sub").textContent =
    (stale ? "⟲ " : "") + `快 ${FastGasPrice} · 标准 ${ProposeGasPrice} · 慢 ${SafeGasPrice}`;
}

async function fetchGas() {
  try {
    const res = await fetchWithTimeout("https://api.etherscan.io/api?module=gastracker&action=gasoracle");
    const data = await res.json();
    if (data?.status === "1") {
      Cache.set("gas", data.result);
      renderGas(data.result, false);
    } else {
      throw new Error("gas api error");
    }
  } catch (e) {
    console.warn("gas fetch failed", e);
    const cached = Cache.get("gas");
    if (cached) renderGas(cached, true);
  }
}

function renderBeacon(data, stale = false) {
  if (!data?.validators) return;
  const stakedEth = data.validators * 32;
  const el = document.getElementById("live-staked");
  el.textContent = fmtCompact(stakedEth) + " ETH";
  el.title = stale ? "数据来自本地缓存" : "";
  document.getElementById("live-validators").textContent =
    (stale ? "⟲ " : "") + fmtCompact(data.validators) + " 验证者";
}

async function fetchBeacon() {
  try {
    const res = await fetchWithTimeout("https://beaconcha.in/api/v1/epoch/latest");
    if (!res.ok) throw new Error("beacon " + res.status);
    const data = await res.json();
    const validators = data?.data?.validatorscount;
    if (validators) {
      Cache.set("beacon", { validators });
      renderBeacon({ validators }, false);
    }
  } catch (e) {
    console.warn("beacon fetch failed", e);
    const cached = Cache.get("beacon");
    if (cached) renderBeacon(cached, true);
  }
}

function renderBlock(n, stale = false) {
  if (n == null) return;
  const el = document.getElementById("live-block");
  el.textContent = "#" + n.toLocaleString();
  el.title = stale ? "数据来自本地缓存" : "";
  document.getElementById("live-block-time").textContent =
    (stale ? "⟲ 缓存 · " : "") + new Date().toLocaleTimeString("zh-CN");
}

async function fetchLatestBlock() {
  try {
    const res = await fetchWithTimeout(
      "https://api.etherscan.io/api?module=proxy&action=eth_blockNumber"
    );
    const data = await res.json();
    if (data?.result) {
      const n = parseInt(data.result, 16);
      Cache.set("block", n);
      renderBlock(n, false);
    }
  } catch (e) {
    console.warn("block fetch failed", e);
    const cached = Cache.get("block");
    if (cached) renderBlock(cached, true);
  }
}

function initLiveData() {
  fetchPrice();
  fetchGas();
  fetchBeacon();
  fetchLatestBlock();
  // 每 60 秒刷新（避免限流）
  setInterval(() => {
    fetchPrice();
    fetchGas();
    fetchLatestBlock();
  }, 60 * 1000);
  setInterval(fetchBeacon, 5 * 60 * 1000);
}

// =======================================================
// Chart.js 图表（等 DOM & Chart 就绪再渲染）
// =======================================================
function ensureChart(cb) {
  if (typeof Chart !== "undefined") return cb();
  const t = setInterval(() => {
    if (typeof Chart !== "undefined") {
      clearInterval(t);
      cb();
    }
  }, 100);
}

// 学术白底 · 报纸风配色
const CHART_INK = "#1a1a1a";
const CHART_MUTED = "#6b6b6b";
const CHART_RULE = "#d9d3c4";
const CHART_SERIF = "'Source Serif Pro', Georgia, serif";
const CHART_PALETTE = ["#1a1a1a", "#8b2a2a", "#2a4a8b", "#8b5a1a", "#2d6a3e", "#6b6b6b"];

function drawEnergyChart() {
  const el = document.getElementById("energy-chart");
  if (!el) return;
  new Chart(el, {
    type: "bar",
    data: {
      labels: ["Bitcoin (PoW)", "Ethereum PoW (前)", "Ethereum PoS (后)"],
      datasets: [{
        label: "年度能耗 (TWh)",
        data: [120, 78, 0.01],
        backgroundColor: ["#8b5a1a", "#8b2a2a", "#2d6a3e"],
        borderColor: CHART_INK,
        borderWidth: 1,
        borderRadius: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (c) => c.parsed.y + " TWh/年" },
        },
      },
      scales: {
        x: { ticks: { color: CHART_INK, font: { family: CHART_SERIF } }, grid: { display: false } },
        y: {
          type: "logarithmic",
          ticks: { color: CHART_MUTED, font: { family: CHART_SERIF }, callback: (v) => v + " TWh" },
          grid: { color: CHART_RULE, drawBorder: true },
        },
      },
    },
  });
}

function drawGasHistoryChart() {
  const el = document.getElementById("gas-history-chart");
  if (!el) return;
  new Chart(el, {
    type: "line",
    data: {
      labels: ["2020", "2021 NFT 热", "2022", "2023 上海", "2024 Dencun", "2025", "2026"],
      datasets: [{
        label: "主网平均 Gas 费 (USD)",
        data: [1.5, 52, 18, 8, 3, 1.2, 0.9],
        borderColor: CHART_INK,
        backgroundColor: "rgba(26,26,26,0.06)",
        fill: true,
        tension: 0,
        pointRadius: 4,
        pointBackgroundColor: "#8b2a2a",
        pointBorderColor: CHART_INK,
        pointBorderWidth: 1,
        borderWidth: 1.5,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => "$" + c.parsed.y.toFixed(2) } },
      },
      scales: {
        x: { ticks: { color: CHART_INK, font: { family: CHART_SERIF } }, grid: { color: CHART_RULE } },
        y: {
          ticks: { color: CHART_MUTED, font: { family: CHART_SERIF }, callback: (v) => "$" + v },
          grid: { color: CHART_RULE },
        },
      },
    },
  });
}

function drawStakingChart() {
  const el = document.getElementById("staking-chart");
  if (!el) return;
  new Chart(el, {
    type: "doughnut",
    data: {
      labels: ["Lido", "Coinbase", "Binance", "其他 CEX", "Rocket Pool", "Solo + 其他"],
      datasets: [{
        data: [28, 13, 4, 10, 3, 42],
        backgroundColor: CHART_PALETTE,
        borderColor: "#faf8f3",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: CHART_INK, font: { size: 11, family: CHART_SERIF }, boxWidth: 12 },
        },
        tooltip: { callbacks: { label: (c) => c.label + ": " + c.parsed + "%" } },
      },
    },
  });
}

function drawClientChart() {
  const el = document.getElementById("client-chart");
  if (!el) return;
  new Chart(el, {
    type: "doughnut",
    data: {
      labels: ["Geth", "Nethermind", "Besu", "Erigon", "Reth"],
      datasets: [{
        data: [52, 24, 10, 9, 5],
        backgroundColor: CHART_PALETTE,
        borderColor: "#faf8f3",
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: CHART_INK, font: { size: 11, family: CHART_SERIF }, boxWidth: 12 },
        },
        tooltip: { callbacks: { label: (c) => c.label + ": " + c.parsed + "%" } },
      },
    },
  });
}

ensureChart(() => {
  drawEnergyChart();
  drawGasHistoryChart();
  drawStakingChart();
  drawClientChart();
});

// =======================================================
// 工具 1：质押收益计算器
// =======================================================
function updateStakeCalc() {
  const amount = parseFloat(document.getElementById("stake-amount-num").value) || 0;
  const apr = parseFloat(document.getElementById("stake-apr-num").value) || 0;
  const yearly = amount * (apr / 100);
  const daily = yearly / 365;
  const monthly = yearly / 12;
  document.getElementById("stake-daily").textContent = daily.toFixed(6) + " ETH";
  document.getElementById("stake-monthly").textContent = monthly.toFixed(4) + " ETH";
  document.getElementById("stake-yearly").textContent = yearly.toFixed(4) + " ETH";
  document.getElementById("stake-yearly-usd").textContent =
    "$" + (yearly * App.ethPrice).toLocaleString("en-US", { maximumFractionDigits: 2 });
}
(function initStakeCalc() {
  const range = document.getElementById("stake-amount");
  const num = document.getElementById("stake-amount-num");
  const aprRange = document.getElementById("stake-apr");
  const aprNum = document.getElementById("stake-apr-num");
  if (!range) return;
  const sync = (a, b) => a.addEventListener("input", () => { b.value = a.value; updateStakeCalc(); });
  sync(range, num); sync(num, range);
  sync(aprRange, aprNum); sync(aprNum, aprRange);
  updateStakeCalc();
})();

// =======================================================
// 工具 2：Gas 费模拟器
// =======================================================
function updateGasCalc() {
  const gasLimit = parseFloat(document.getElementById("gas-type").value) || 0;
  const gasPrice = parseFloat(document.getElementById("gas-price-num").value) || 0; // gwei
  const feeEth = (gasLimit * gasPrice) / 1e9;
  const feeUsd = feeEth * App.ethPrice;
  document.getElementById("gas-eth").textContent = feeEth.toFixed(6) + " ETH";
  document.getElementById("gas-usd").textContent =
    "$" + feeUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
(function initGasCalc() {
  const type = document.getElementById("gas-type");
  const range = document.getElementById("gas-price");
  const num = document.getElementById("gas-price-num");
  if (!type) return;
  type.addEventListener("change", updateGasCalc);
  const sync = (a, b) => a.addEventListener("input", () => { b.value = a.value; updateGasCalc(); });
  sync(range, num); sync(num, range);
  document.querySelectorAll(".gas-presets button").forEach((b) => {
    b.addEventListener("click", () => {
      range.value = num.value = b.dataset.g;
      updateGasCalc();
    });
  });
  updateGasCalc();
})();

// =======================================================
// 工具 3：迷你区块浏览器
// =======================================================
async function fetchBlocks() {
  const btn = document.getElementById("blocks-refresh");
  const tbody = document.getElementById("blocks-tbody");
  if (!btn || !tbody) return;
  btn.disabled = true;
  btn.textContent = "⏳ 拉取中…";
  tbody.innerHTML = '<tr><td colspan="6" class="blocks-empty">正在从 Etherscan 获取最新 5 个区块…</td></tr>';
  try {
    // 先拿最新高度
    const headRes = await fetch("https://api.etherscan.io/api?module=proxy&action=eth_blockNumber");
    const headJson = await headRes.json();
    const latest = parseInt(headJson.result, 16);
    if (!latest) throw new Error("no head");
    const targets = Array.from({ length: 5 }, (_, i) => latest - i);
    const blocks = await Promise.all(
      targets.map(async (n) => {
        const hex = "0x" + n.toString(16);
        const r = await fetch(
          `https://api.etherscan.io/api?module=proxy&action=eth_getBlockByNumber&tag=${hex}&boolean=false`
        );
        const j = await r.json();
        return j.result;
      })
    );
    tbody.innerHTML = "";
    blocks.forEach((b) => {
      if (!b) return;
      const num = parseInt(b.number, 16);
      const ts = new Date(parseInt(b.timestamp, 16) * 1000);
      const txCount = Array.isArray(b.transactions) ? b.transactions.length : 0;
      const gasUsed = parseInt(b.gasUsed, 16);
      const gasLimit = parseInt(b.gasLimit, 16);
      const baseFee = b.baseFeePerGas ? (parseInt(b.baseFeePerGas, 16) / 1e9).toFixed(2) : "—";
      const miner = b.miner ? b.miner.slice(0, 10) + "…" + b.miner.slice(-6) : "—";
      const ago = Math.floor((Date.now() - ts.getTime()) / 1000);
      const agoStr = ago < 60 ? ago + " 秒前" : Math.floor(ago / 60) + " 分前";
      const row = document.createElement("tr");
      row.innerHTML = `
        <td class="num">#${num.toLocaleString()}</td>
        <td>${agoStr}</td>
        <td>${txCount}</td>
        <td>${(gasUsed / 1e6).toFixed(2)}M / ${(gasLimit / 1e6).toFixed(0)}M</td>
        <td>${baseFee}</td>
        <td>${miner}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (e) {
    console.warn("blocks fetch failed", e);
    tbody.innerHTML = '<tr><td colspan="6" class="blocks-empty">获取失败（可能被限流），稍后再试。</td></tr>';
  } finally {
    btn.disabled = false;
    btn.textContent = "🔄 刷新最新区块";
  }
}
(function initBlocksTool() {
  const btn = document.getElementById("blocks-refresh");
  if (!btn) return;
  btn.addEventListener("click", fetchBlocks);
})();

// =======================================================
// TECH 页架构塔:小卡 hover 同步高亮对应楼层
// =======================================================
(function initTechTower() {
  const wrap = document.querySelector(".tech-tower-wrap");
  if (!wrap) return;
  const steps = wrap.querySelectorAll(".tt-step");
  const stepByN = {};
  steps.forEach((s) => { stepByN[s.dataset.layer] = s; });

  const setHover = (n) => {
    for (let i = 1; i <= 6; i++) wrap.classList.remove("is-hover-" + i);
    if (n) wrap.classList.add("is-hover-" + n);
  };

  // 左侧 SVG 楼层 hover:除了点亮,还把对应小卡滚到视口中央
  const scrollStepIntoView = (n) => {
    const step = stepByN[n];
    if (!step) return;
    const r = step.getBoundingClientRect();
    const vh = window.innerHeight;
    // 若小卡不在视口中间区域,居中滚入
    if (r.top < 80 || r.bottom > vh - 40) {
      step.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  // 右侧小卡 hover:只点亮,不滚动(否则自己会抖)
  steps.forEach((s) => {
    const n = s.dataset.layer;
    s.addEventListener("mouseenter", () => setHover(n));
    s.addEventListener("focusin", () => setHover(n));
  });

  // SVG 楼层 hover:点亮 + 滚动对应小卡
  wrap.querySelectorAll(".tt-layer[data-layer]").forEach((g) => {
    const n = g.dataset.layer;
    g.addEventListener("mouseenter", () => {
      setHover(n);
      scrollStepIntoView(n);
    });
    g.addEventListener("focusin", () => {
      setHover(n);
      scrollStepIntoView(n);
    });
  });

  wrap.addEventListener("mouseleave", () => setHover(null));
})();

// =======================================================
// 若锚点落到 <details id="..."> 内,自动展开
// =======================================================
// 交易生命周期流程图：图 + 卡片双向悬停联动
// =======================================================
(function initTxFlow() {
  const flow = document.querySelector(".tx-flow");
  if (!flow) return;
  const stops = flow.querySelectorAll(".tx-stop");
  const nodes = flow.querySelectorAll("svg .tx-node");
  if (!stops.length) return;

  const setStep = (n) => {
    flow.classList.remove(
      "is-step-1","is-step-2","is-step-3","is-step-4","is-step-5","is-step-6"
    );
    if (n) flow.classList.add("is-step-" + n);
  };

  // 卡片 → SVG 节点
  stops.forEach((card) => {
    const n = card.getAttribute("data-step");
    card.addEventListener("mouseenter", () => setStep(n));
    card.addEventListener("focusin",   () => setStep(n));
    card.addEventListener("mouseleave",() => setStep(null));
    card.addEventListener("focusout", () => setStep(null));
  });

  // SVG 节点 → 卡片(根据 class tx-n1..tx-n6 推出 step 序号)
  nodes.forEach((node) => {
    const cls = node.getAttribute("class") || "";
    const m = cls.match(/tx-n([1-6])/);
    if (!m) return;
    const n = m[1];
    node.style.cursor = "default";
    node.addEventListener("mouseenter", () => setStep(n));
    node.addEventListener("mouseleave", () => setStep(null));
  });
})();

// =======================================================
// Gas 模拟器：用户拖滑杆,实时算 ETH / USD 花费 + 销毁/给验证者拆分
// =======================================================
(function initGasCalc() {
  const root = document.getElementById("gas-calc");
  if (!root) return;

  const $used = root.querySelector("#gc-used");
  const $base = root.querySelector("#gc-base");
  const $tip  = root.querySelector("#gc-tip");

  const $usedVal = root.querySelector("#gc-used-val");
  const $baseVal = root.querySelector("#gc-base-val");
  const $tipVal  = root.querySelector("#gc-tip-val");

  const $eth   = root.querySelector("#gc-eth");
  const $usd   = root.querySelector("#gc-usd");
  const $burn  = root.querySelector("#gc-burn");
  const $tipE  = root.querySelector("#gc-tip");
  const $burnP = root.querySelector("#gc-burn-pct");
  const $tipP  = root.querySelector("#gc-tip-pct");
  const $barB  = root.querySelector("#gc-bar-burn");
  const $barT  = root.querySelector("#gc-bar-tip");

  const $usedMini  = root.querySelector("#gc-used-mini");
  const $baseMini  = root.querySelector("#gc-base-mini");
  const $tipMini   = root.querySelector("#gc-tip-mini");
  const $totalGwei = root.querySelector("#gc-total-gwei");

  const fmtInt = (n) => n.toLocaleString("en-US");
  const fmtETH = (n) => {
    if (n === 0) return "0";
    if (n < 0.0001) return n.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
    if (n < 1) return n.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    return n.toFixed(4);
  };
  const fmtUSD = (n) => {
    if (n < 0.01) return "$" + n.toFixed(4);
    if (n < 100) return "$" + n.toFixed(2);
    return "$" + Math.round(n).toLocaleString("en-US");
  };

  // 从顶部"实时数据"取 ETH 价格(若已加载),否则用一个合理默认值
  const getEthPrice = () => {
    const el = document.getElementById("live-price");
    if (!el) return 3200;
    const txt = (el.textContent || "").replace(/[^0-9.]/g, "");
    const v = parseFloat(txt);
    return v && v > 0 ? v : 3200;
  };

  const recompute = () => {
    const used = parseInt($used.value, 10);
    const base = parseFloat($base.value);
    const tip  = parseFloat($tip.value);

    const totalGwei = used * (base + tip);
    const burnGwei  = used * base;
    const tipGwei   = used * tip;

    // gwei → ETH:1 ETH = 1e9 gwei
    const ethTotal = totalGwei / 1e9;
    const ethBurn  = burnGwei  / 1e9;
    const ethTip   = tipGwei   / 1e9;

    const price = getEthPrice();
    const usd = ethTotal * price;

    // 文案
    $usedVal.textContent = fmtInt(used);
    $baseVal.textContent = base;
    $tipVal.textContent  = tip;

    $eth.textContent  = fmtETH(ethTotal);
    $usd.textContent  = fmtUSD(usd);
    $burn.textContent = fmtETH(ethBurn);
    $tipE.textContent = fmtETH(ethTip);

    const sum = base + tip || 1;
    const burnPct = (base / sum) * 100;
    const tipPct  = (tip  / sum) * 100;
    $burnP.textContent = burnPct.toFixed(0) + "%";
    $tipP.textContent  = tipPct.toFixed(0) + "%";
    $barB.style.width = burnPct + "%";
    $barT.style.width = tipPct  + "%";

    // 公式行
    $usedMini.textContent  = fmtInt(used);
    $baseMini.textContent  = base;
    $tipMini.textContent   = tip;
    $totalGwei.textContent = fmtInt(Math.round(totalGwei));
  };

  // 预设按钮:点一下填入 Gas Used + 高亮自身
  root.querySelectorAll(".gc-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      root.querySelectorAll(".gc-preset").forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const g = parseInt(btn.getAttribute("data-gas"), 10);
      // 若超出 max,扩展 max
      if (g > parseInt($used.max, 10)) $used.max = String(g);
      $used.value = String(g);
      recompute();
    });
  });

  // 滑杆变化 → 重算;用户手动拖时取消预设高亮
  [$used, $base, $tip].forEach((el) => {
    el.addEventListener("input", () => {
      if (el === $used) {
        const cur = parseInt($used.value, 10);
        const matched = root.querySelector('.gc-preset[data-gas="' + cur + '"]');
        root.querySelectorAll(".gc-preset").forEach((b) => b.classList.remove("is-active"));
        if (matched) matched.classList.add("is-active");
      }
      recompute();
    });
  });

  // 实时价格刷新后再算一次
  const priceEl = document.getElementById("live-price");
  if (priceEl) {
    new MutationObserver(recompute).observe(priceEl, { childList: true, characterData: true, subtree: true });
  }

  recompute();
})();

// =======================================================
(function autoOpenDetails() {
  const open = () => {
    const h = location.hash.replace(/^#/, "");
    if (!h) return;
    const el = document.getElementById(h);
    if (el && el.tagName === "DETAILS") el.open = true;
  };
  open();
  window.addEventListener("hashchange", open);
})();

// =======================================================
// 启动：实时数据
// =======================================================
initLiveData();

// =======================================================
// 周报导出 · 抓取 #recent 三栏 → 渲染专用容器 → html2canvas → 下载 PNG
// =======================================================
(function initWeeklyExport() {
  const btn = document.getElementById("export-weekly-btn");
  if (!btn) return;

  const today = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { iso: `${y}-${m}-${day}`, cn: `${y} 年 ${parseInt(m,10)} 月 ${parseInt(day,10)} 日` };
  };

  // 从原 .recent-col 中抽出条目纯数据
  function collectColumn(selector) {
    const col = document.querySelector(selector);
    if (!col) return [];
    return Array.from(col.querySelectorAll(".recent-item")).map((it) => ({
      when: (it.querySelector(".recent-when")?.textContent || "").trim(),
      source: (it.querySelector(".recent-source")?.textContent || "").trim(),
      sourceClass: it.querySelector(".recent-source")?.className || "",
      body: it.querySelector("p")?.innerHTML || "",
    }));
  }

  // 北极星阶段
  function collectStars() {
    return Array.from(document.querySelectorAll(".sm-star")).map((s) => {
      const stage = s.querySelector(".sm-stage")?.textContent.trim() || "";
      const name = s.querySelector("h4")?.textContent.trim() || "";
      const tag = s.querySelector(".sm-star-tag")?.textContent.trim() || "";
      const detail = s.querySelector(".sm-stage-detail")?.innerHTML || "";
      const stageClass = s.className.match(/sm-s\d/)?.[0] || "";
      return { name, tag, stage, detail, stageClass };
    });
  }

  function buildExportNode() {
    const wk  = collectColumn(".recent-week");
    const mo  = collectColumn(".recent-month");
    // 近半年:按月份柱采集
    const halfStops = Array.from(document.querySelectorAll(".recent-half-band .rh-stop")).map((s) => ({
      label: s.querySelector(".rh-month b")?.textContent.trim() || "",
      sub:   s.querySelector(".rh-month span")?.textContent.trim() || "",
      items: Array.from(s.querySelectorAll(".recent-item")).map((it) => ({
        when:   (it.querySelector(".recent-when")?.textContent || "").trim(),
        source: (it.querySelector(".recent-source")?.textContent || "").trim(),
        sourceClass: it.querySelector(".recent-source")?.className || "",
        body:   it.querySelector("p")?.innerHTML || "",
      })),
    }));
    const stars = collectStars();
    const t = today();

    const sourceClassMap = {
      "recent-src-vitalik": "s-vitalik",
      "recent-src-ef":      "s-ef",
      "recent-src-eips":    "s-eips",
      "recent-src-mainnet": "s-mainnet",
      "recent-src-erc":     "s-erc",
      "recent-src-press":   "s-press",
      "recent-src-market":  "s-market",
    };
    const remapSourceClass = (raw) => {
      const found = Object.keys(sourceClassMap).find((k) => raw.includes(k));
      return "ex-source " + (found ? sourceClassMap[found] : "");
    };

    const itemHTML = (it) => `
      <div class="ex-item">
        <div class="ex-item-meta">
          ${it.when ? `<span class="ex-when">${it.when}</span>` : ""}
          <span class="${remapSourceClass(it.sourceClass)}">${it.source}</span>
        </div>
        <p class="ex-body">${it.body}</p>
      </div>`;

    const halfStopHTML = (s) => `
      <div class="ex-stop">
        <div class="ex-stop-head">
          <b>${s.label}</b>
          <span>${s.sub}</span>
        </div>
        ${s.items.map(itemHTML).join("")}
      </div>`;

    const starHTML = (s) => `
      <div class="ex-star ${s.stageClass}">
        <div class="ex-star-row">
          <h4>${s.name}</h4>
          <span class="ex-stage">${s.stage}</span>
        </div>
        <div class="ex-star-tag">${s.tag}</div>
        <div class="ex-star-detail">${s.detail}</div>
      </div>`;

    const node = document.createElement("div");
    node.className = "weekly-export-canvas";
    node.innerHTML = `
      <div class="ex-frame">
        <header class="ex-header">
          <div class="ex-brand">
            <span class="ex-mast">ETHEREUM</span>
            <span class="ex-mast-sub">WEEKLY · 以太坊周报</span>
          </div>
          <div class="ex-date">
            <span class="ex-date-label">出版日期</span>
            <b>${t.cn}</b>
          </div>
        </header>

        <div class="ex-title-band">
          <h1>Vitalik 与 EF 公开事件 · 五大北极星进度</h1>
        </div>

        <section class="ex-cols ex-cols-2">
          <div class="ex-col ex-col-week">
            <div class="ex-col-head"><span class="ex-tag">近一周</span></div>
            ${wk.map(itemHTML).join("") || '<p class="ex-empty">本周无重大公开事件。</p>'}
          </div>
          <div class="ex-col ex-col-month">
            <div class="ex-col-head"><span class="ex-tag">近一月</span></div>
            ${mo.map(itemHTML).join("")}
          </div>
        </section>

        <section class="ex-half-band">
          <div class="ex-col-head"><span class="ex-tag">近半年</span></div>
          <div class="ex-stops">
            ${halfStops.map(halfStopHTML).join("")}
          </div>
        </section>

        <section class="ex-stars-band">
          <h2>📍 五大北极星进度速览</h2>
          <div class="ex-stars-grid">${stars.map(starHTML).join("")}</div>
        </section>

        <footer class="ex-foot">
          <span>来源:blog.ethereum.org · vitalik.eth.limo · strawmap.org · EIPs Repo</span>
          <span class="ex-foot-mark">ethereum-visual-history</span>
        </footer>
      </div>
    `;
    return node;
  }

  async function exportWeekly() {
    if (typeof html2canvas !== "function") {
      alert("html2canvas 还在加载,稍候重试。");
      return;
    }
    btn.disabled = true;
    const originalText = btn.querySelector(".export-btn-label").textContent;
    btn.querySelector(".export-btn-label").textContent = "生成中…";

    const node = buildExportNode();
    document.body.appendChild(node);

    try {
      const canvas = await html2canvas(node, {
        backgroundColor: "#faf8f3",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `ethereum-weekly-${today().iso}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
      alert("导出失败,请检查浏览器控制台。");
    } finally {
      node.remove();
      btn.disabled = false;
      btn.querySelector(".export-btn-label").textContent = originalText;
    }
  }

  btn.addEventListener("click", exportWeekly);
})();
