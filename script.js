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
// 周报导出 · 浏览器原生打印生成 PDF
// 走 window.print() —— 文字是真文字层(可复制可搜索),中文走系统字体,
// 体积通常仅 100~300 KB,远小于位图 PDF。
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

  const escapeHTML = (s) => String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // 提取纯文本(剔除 HTML 标签),保留链接 URL 用于附加引用
  const stripHTML = (html) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || "").replace(/\s+/g, " ").trim();
  };

  function collectColumn(selector) {
    const col = document.querySelector(selector);
    if (!col) return [];
    return Array.from(col.querySelectorAll(".recent-item")).map((it) => {
      const links = Array.from(it.querySelectorAll(".recent-link")).map((a) => ({
        text: (a.textContent || "").replace(/→\s*$/, "").trim(),
        href: a.getAttribute("href") || "",
      }));
      return {
        when:   (it.querySelector(".recent-when")?.textContent || "").trim(),
        source: (it.querySelector(".recent-source")?.textContent || "").trim(),
        sourceClass: it.querySelector(".recent-source")?.className || "",
        body:   stripHTML(it.querySelector("p")?.innerHTML || ""),
        links,
      };
    });
  }

  function collectStars() {
    return Array.from(document.querySelectorAll(".sm-star")).map((s) => {
      const stage = s.querySelector(".sm-stage")?.textContent.trim() || "";
      const name = s.querySelector("h4")?.textContent.trim() || "";
      const tag = s.querySelector(".sm-star-tag")?.textContent.trim() || "";
      const detail = stripHTML(s.querySelector(".sm-stage-detail")?.innerHTML || "");
      const stageClass = s.className.match(/sm-s\d/)?.[0] || "";
      return { name, tag, stage, detail, stageClass };
    });
  }

  function collectAll() {
    const wk = collectColumn(".recent-week");
    const mo = collectColumn(".recent-month");
    const halfStops = Array.from(document.querySelectorAll(".recent-half-band .rh-stop")).map((s) => ({
      label: s.querySelector(".rh-month b")?.textContent.trim() || "",
      sub:   s.querySelector(".rh-month span")?.textContent.trim() || "",
      items: Array.from(s.querySelectorAll(".recent-item")).map((it) => {
        const links = Array.from(it.querySelectorAll(".recent-link")).map((a) => ({
          text: (a.textContent || "").replace(/→\s*$/, "").trim(),
          href: a.getAttribute("href") || "",
        }));
        return {
          when:   (it.querySelector(".recent-when")?.textContent || "").trim(),
          source: (it.querySelector(".recent-source")?.textContent || "").trim(),
          sourceClass: it.querySelector(".recent-source")?.className || "",
          body:   stripHTML(it.querySelector("p")?.innerHTML || ""),
          links,
        };
      }),
    }));
    return { wk, mo, halfStops, stars: collectStars() };
  }

  // 来源徽标颜色(0-255 RGB,稍后 pdf-lib 用 rgb(r/255,...))
  const SOURCE_BG = {
    "recent-src-vitalik": [113, 86, 234],
    "recent-src-ef":      [25, 118, 210],
    "recent-src-eips":    [200, 80, 60],
    "recent-src-mainnet": [120, 80, 30],
    "recent-src-erc":     [180, 100, 40],
    "recent-src-press":   [120, 120, 130],
    "recent-src-market":  [200, 100, 40],
  };
  const sourceBG = (cls) => {
    const k = Object.keys(SOURCE_BG).find((c) => cls.includes(c));
    return k ? SOURCE_BG[k] : [136, 136, 136];
  };

  // 影响路径与项目影响推断规则(纯数据,渲染时引用)
  const impactRules = [
	      {
	        match: /原生隐私|Privacy|Kohaku|private reads|keyed nonces/i,
	        impacts: [
	          { label: "Native Privacy / 隐私转账原生化", cls: "i-privacy" },
	          { label: "架构: AA + FOCIL + RPC 访问层", cls: "i-arch" },
	        ],
	      },
	      {
	        match: /Clear Signing|ERC-7730|盲签|签名/i,
	        impacts: [
	          { label: "应用层: 钱包-DApp 签名安全", cls: "i-app" },
	          { label: "体验: 可读交易意图", cls: "i-ux" },
	        ],
	      },
	      {
	        match: /formal verification|形式化验证|zkVM|后量子|AI 辅助/i,
	        impacts: [
	          { label: "Post-Quantum / 长期安全", cls: "i-resilience" },
	          { label: "架构: 客户端 + zk 系统正确性", cls: "i-arch" },
	        ],
	      },
	      {
	        match: /200M gas|Gigagas|gas limit|EIP-8037|repricing/i,
	        impacts: [
	          { label: "Gigagas L1 / 主网吞吐", cls: "i-gigagas" },
	          { label: "架构: 执行层资源重定价", cls: "i-arch" },
	        ],
	      },
	      {
	        match: /Glamsterdam|6s|slot|SSF|秒级终局/i,
	        impacts: [
	          { label: "Fast L1 / 秒级终局性", cls: "i-fast" },
	          { label: "架构: 共识节奏与升级打包", cls: "i-arch" },
	        ],
	      },
	      {
	        match: /ePBS|BAL|Hegot|Soldøgn|Interop|多客户端|Protocol Cluster/i,
	        impacts: [
	          { label: "架构: 提议者-构建者分离与抗审查", cls: "i-arch" },
	          { label: "路线图: Glamsterdam / Hegotá 协同", cls: "i-roadmap" },
	        ],
	      },
	      {
	        match: /Danksharding|PeerDAS|Blob|L2|rollup/i,
	        impacts: [
	          { label: "Teragas L2 / Blob 带宽", cls: "i-teragas" },
	          { label: "架构: Rollup-centric 数据可用性", cls: "i-arch" },
	        ],
	      },
	    ];
	    const noDirectImpact = /ETF|净流出|净赎回|EPF|Fellowship|Allocation Update|资金继续投向|资金|招募|出售 ETH|Bankless/i;

	    const projectRules = [
	      {
	        match: /原生隐私|Privacy|Kohaku|private reads|keyed nonces/i,
	        projects: [
	          { tone: "利好/关注", name: "RAILGUN ($RAIL)", reason: "Kohaku/隐私工具链与 shielded transfer 叙事相关", cls: "p-positive" },
	          { tone: "利好/关注", name: "Privacy Pools", reason: "原生隐私路线提高合规隐私方案能见度", cls: "p-positive" },
	          { tone: "利好/关注", name: "Kohaku", reason: "作为访问层隐私与钱包 SDK 方向被点名", cls: "p-positive" },
	        ],
	      },
	      {
	        match: /Clear Signing|ERC-7730|盲签|签名/i,
	        projects: [
	          { tone: "利好/关注", name: "Ledger / Trezor", reason: "硬件签名与 ERC-7730 元数据标准直接相关", cls: "p-positive" },
	          { tone: "利好/关注", name: "MetaMask / WalletConnect", reason: "钱包连接与交易展示层可能优先受益", cls: "p-positive" },
	          { tone: "利好/关注", name: "Sourcify / Cyfrin / Fireblocks", reason: "合约验证、安全审计与机构签名基础设施相关", cls: "p-positive" },
	        ],
	      },
	      {
	        match: /formal verification|形式化验证|zkVM|后量子|AI 辅助/i,
	        projects: [
	          { tone: "利好/关注", name: "zkVM / ZK infra", reason: "验证工具链、安全证明与客户端正确性需求上升", cls: "p-positive" },
	          { tone: "利好/关注", name: "形式化验证工具", reason: "AI 辅助证明与审计可能提升采用", cls: "p-positive" },
	        ],
	      },
	      {
	        match: /200M gas|Gigagas|gas limit|EIP-8037|repricing/i,
	        projects: [
	          { tone: "利好/关注", name: "L1 高频应用", reason: "更高 gas 上限改善主网吞吐空间", cls: "p-positive" },
	          { tone: "利好/关注", name: "Uniswap / Aave 等 L1 DeFi", reason: "主网容量提升有利于高价值 DeFi 交互", cls: "p-positive" },
	          { tone: "潜在压力", name: "依赖低费叙事的部分 L2", reason: "若 L1 容量显著提升,部分需求可能回流主网", cls: "p-risk" },
	        ],
	      },
	      {
	        match: /Glamsterdam|6s|slot|SSF|秒级终局/i,
	        projects: [
	          { tone: "利好/关注", name: "L1 DeFi / 支付应用", reason: "更短确认时间改善交互体验", cls: "p-positive" },
	          { tone: "利好/关注", name: "预确认 / 排序基础设施", reason: "更快 L1 节奏改变交易确认与排序设计空间", cls: "p-positive" },
	        ],
	      },
	      {
	        match: /ePBS|BAL|Hegot|Soldøgn|Interop|多客户端|Protocol Cluster/i,
	        projects: [
	          { tone: "影响/重构", name: "MEV-Boost / relay 生态", reason: "ePBS 把 PBS 机制纳入协议,削弱对中间件信任依赖", cls: "p-neutral" },
	          { tone: "影响/重构", name: "block builder / searcher", reason: "区块构建与支付路径可能被协议化重塑", cls: "p-neutral" },
	          { tone: "利好/关注", name: "客户端团队", reason: "多客户端 devnet 与互操作测试重要性上升", cls: "p-positive" },
	        ],
	      },
	      {
	        match: /Danksharding|PeerDAS|Blob|L2|rollup/i,
	        projects: [
	          { tone: "利好/关注", name: "Optimism / Arbitrum / Base", reason: "Blob 带宽与 DA 改善直接影响 rollup 成本", cls: "p-positive" },
	          { tone: "利好/关注", name: "DA / rollup infra", reason: "数据可用性扩容提高 L2 总吞吐天花板", cls: "p-positive" },
	        ],
	      },
	    ];

  function impactsFor(it) {
    const text = `${it.when} ${it.source} ${it.body}`;
    if (noDirectImpact.test(text)) return [];
    const seen = new Set();
    return impactRules.flatMap((rule) => {
      if (!rule.match.test(text)) return [];
      return rule.impacts.filter((im) => {
        if (seen.has(im.label)) return false;
        seen.add(im.label); return true;
      });
    }).slice(0, 3);
  }
  function projectsFor(it) {
    const text = `${it.when} ${it.source} ${it.body}`;
    if (noDirectImpact.test(text)) return [];
    const seen = new Set();
    return projectRules.flatMap((rule) => {
      if (!rule.match.test(text)) return [];
      return rule.projects.filter((p) => {
        const k = `${p.tone}:${p.name}`;
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
    }).slice(0, 3);
  }

  // ============== 文本式 PDF 渲染:pdf-lib + fontkit 子集化 ==============
  // 直接生成 PDF Blob 并触发下载,文字保持可选可搜索可复制,
  // 字体由 fontkit 子集化,只嵌入实际用到的字符,文件 200~500KB。

  let _fontBytesCache = null;
  // 通过 <script> 预加载的 base64(避免 file:// 下 fetch 被拒)
  function loadFontBytes() {
    if (_fontBytesCache) return _fontBytesCache;
    const b64 = window.__SIMHEI_FONT_B64;
    if (!b64) {
      throw new Error("中文字体未加载:vendor/SimHei.font.js 缺失或未加载完成");
    }
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    _fontBytesCache = bytes.buffer;
    return _fontBytesCache;
  }

  function downloadBlob(bytes, filename) {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // 文本布局工具:基于嵌入字体测量字宽,做按字符级折行(适合 CJK)
  function makeLayout(font) {
    // 字体无法编码的字符(emoji 等)替换为空格,避免 pdf-lib 抛错
    const sanitize = (s) => {
      let out = "";
      for (const ch of String(s ?? "")) {
        try {
          font.widthOfTextAtSize(ch, 10);
          out += ch;
        } catch (_) {
          out += " ";
        }
      }
      return out;
    };
    const measure = (text, size) => font.widthOfTextAtSize(sanitize(text), size);
    const wrap = (raw, size, maxWidth) => {
      const text = sanitize(raw);
      if (!text) return [""];
      const lines = [];
      let cur = "";
      for (const ch of String(text)) {
        if (ch === "\n") { lines.push(cur); cur = ""; continue; }
        const next = cur + ch;
        if (measure(next, size) > maxWidth && cur.length) {
          lines.push(cur);
          cur = ch;
        } else {
          cur = next;
        }
      }
      if (cur.length) lines.push(cur);
      return lines.length ? lines : [""];
    };
    return { measure, wrap, sanitize };
  }

  async function exportWeekly() {
    if (!window.PDFLib || !window.fontkit) {
      alert("PDF 组件还在加载,稍候重试。");
      return;
    }

    btn.disabled = true;
    const labelEl = btn.querySelector(".export-btn-label");
    const originalText = labelEl.textContent;
    labelEl.textContent = "生成中…";

    try {
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const data = collectAll();
      const t = today();

      const fontBytes = loadFontBytes();
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(window.fontkit);
      const cn = await pdfDoc.embedFont(fontBytes, { subset: true });
      const en = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // ---- A4 尺寸 (pt) ----
      const PAGE_W = 595.28;
      const PAGE_H = 841.89;
      const MARGIN = 28;
      const CONTENT_W = PAGE_W - MARGIN * 2;
      const COL_GAP = 14;
      const COL_W = (CONTENT_W - COL_GAP) / 2;

      let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
      const RGB = (r, g, b) => rgb(r / 255, g / 255, b / 255);
      const COL = {
        ink:    RGB(31, 35, 48),
        dim:    RGB(107, 107, 118),
        line:   RGB(216, 216, 222),
        accent: RGB(82, 54, 168),
        accentBg: RGB(236, 231, 248),
        cream:  RGB(250, 247, 240),
        link:   RGB(42, 102, 200),
        bandBg: RGB(245, 240, 230),
      };

      const lay = makeLayout(cn);

      // 跨页/跨栏游标
      const state = {
        col: 0,           // 0 = 左, 1 = 右
        x: MARGIN,
        y: PAGE_H - MARGIN,
        topY: PAGE_H - MARGIN,  // 当前栏顶部 y
        bottomY: MARGIN + 26,   // 页脚保留区
      };

      const newPage = () => {
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        state.col = 0;
        state.x = MARGIN;
        state.topY = PAGE_H - MARGIN;
        state.y = state.topY;
      };
      const switchCol = () => {
        if (state.col === 0) {
          state.col = 1;
          state.x = MARGIN + COL_W + COL_GAP;
          state.y = state.topY;
        } else {
          newPage();
        }
      };
      // 实际剩余高度需求 h 时确保有空间,不够则切栏。h 不能 > 单栏可用高度
      const ensureSpace = (h) => {
        const colMax = state.topY - state.bottomY;
        const need = Math.min(h, colMax - 1);
        if (state.y - need < state.bottomY) switchCol();
      };
      // 推进游标:消耗 d pt 高度。若超出栏底,先把超出部分截断,然后 switchCol
      // 这样即使估算失败,也绝不会让后续 item 的起始 y 重叠到上一条 item
      const advance = (d) => {
        if (!Number.isFinite(d) || d <= 0) return;
        state.y -= d;
        if (state.y < state.bottomY) {
          switchCol();
        }
      };

      // ---- 绘制原语 ----
      const drawText = (text, x, y, opts = {}) => {
        const size = opts.size || 9;
        const color = opts.color || COL.ink;
        const f = opts.font || cn;
        const safe = (f === cn) ? lay.sanitize(text) : String(text);
        page.drawText(safe, { x, y, size, font: f, color });
      };
      const drawWrapped = (text, x, y, w, opts = {}) => {
        const size = opts.size || 9;
        const lh = opts.lh || size * 1.45;
        const color = opts.color || COL.ink;
        const lines = lay.wrap(text, size, w);
        let cy = y;
        for (const line of lines) {
          page.drawText(line, { x, y: cy, size, font: cn, color });
          cy -= lh;
        }
        return y - lh * lines.length;
      };
      const drawRect = (x, y, w, h, color, opts = {}) => {
        page.drawRectangle({
          x, y, width: w, height: h, color,
          borderColor: opts.borderColor,
          borderWidth: opts.borderWidth || 0,
        });
      };
      const drawLine = (x1, y1, x2, y2, color = COL.line, thickness = 0.5) => {
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, color, thickness });
      };

      // ---- 头部封面 ----
      drawRect(0, PAGE_H - 64, PAGE_W, 64, COL.bandBg);
      drawText("ETHEREUM WEEKLY", MARGIN, PAGE_H - 30, { size: 18, font: en, color: COL.ink });
      drawText("以太坊周报", MARGIN + en.widthOfTextAtSize("ETHEREUM WEEKLY", 18) + 8, PAGE_H - 30, { size: 11, color: COL.dim });
      const dateStr = `出版日期  ${t.cn}`;
      const dateW = lay.measure(dateStr, 9);
      drawText(dateStr, PAGE_W - MARGIN - dateW, PAGE_H - 30, { size: 9, color: COL.dim });
      drawLine(MARGIN, PAGE_H - 64, PAGE_W - MARGIN, PAGE_H - 64, COL.ink, 1);

      state.topY = PAGE_H - 78;
      state.y = state.topY;

      // ---- 章节标题 ----
      const sectionHeader = (label) => {
        // 章节至少要能放下标题 + 一条 item,否则切到下一栏/页
        ensureSpace(80);
        // 与上一段拉开间距(若不在栏顶)
        if (state.y < state.topY - 6) advance(10);
        const padX = 7, h = 14;
        const tw = lay.measure(label, 9);
        drawRect(state.x, state.y - h, tw + padX * 2, h, COL.accentBg);
        drawText(label, state.x + padX, state.y - 11, { size: 9, color: COL.accent });
        advance(h + 14);
      };

      // ---- 来源徽标(小色块 + 白字) ----
      // y 参数为日期文字 baseline。徽标矩形整体落在 baseline 下方一点点 + 上方文字 cap 高度区,
      // 矩形覆盖 [y-2, y+8],高 10pt,与日期文字垂直居中对齐
      const drawPill = (text, x, y, cls) => {
        const [r, g, b] = sourceBG(cls);
        const size = 7;
        const tw = lay.measure(text, size);
        const padX = 4, h = 9;
        drawRect(x, y - 2, tw + padX * 2, h, RGB(r, g, b));
        drawText(text, x + padX, y + 0.5, { size, color: rgb(1, 1, 1) });
        return tw + padX * 2;
      };

      // ---- 单条 item 渲染(在当前栏中流式) ----
      // 关键约束:绘制时实时检查 state.y,每画一行如果跌破栏底就 switchCol,
      // 这样即便估算失败也不会让两条 item 在视觉上重叠
      const renderItem = (it, opts = {}) => {
        const w = COL_W;
        const compact = !!opts.compact;
        const bodySize = compact ? 8 : 8.5;
        const bodyLH = bodySize * 1.42;

        const bodyLines = lay.wrap(it.body, bodySize, w);
        const impacts = impactsFor(it);
        const projects = projectsFor(it);
        const links = (it.links || []).filter((l) => l.href);

        // 估算首屏需要的最小高度(meta + 至少正文一行),空间不够先切栏
        ensureSpace(16 + bodyLH);

        // 元数据行: 日期 + 来源徽标
        let cx = state.x;
        const metaY = state.y - 10;
        if (it.when) {
          drawText(it.when, cx, metaY, { size: 7.5, color: COL.dim });
          cx += lay.measure(it.when, 7.5) + 5;
        }
        if (it.source) {
          drawPill(it.source, cx, metaY, it.sourceClass);
        }
        advance(15);

        // 绘制单行的小工具:画之前确保空间,画完前进 lh
        const drawRow = (txt, size, color, lh) => {
          ensureSpace(lh);
          drawText(txt, state.x, state.y - size, { size, color });
          advance(lh);
        };
        const drawRowAt = (txt, dx, size, color, lh) => {
          // 与 drawRow 相同,但 x 偏移 dx;画完前进 lh
          ensureSpace(lh);
          drawText(txt, state.x + dx, state.y - size, { size, color });
          advance(lh);
        };

        // 正文
        for (const line of bodyLines) drawRow(line, bodySize, COL.ink, bodyLH);

        // 链接(取首条,避免膨胀)
        if (links.length) {
          const lk = links[0];
          const linkText = `↗ ${lk.text || lk.href}`;
          for (const line of lay.wrap(linkText, 7, w)) drawRow(line, 7, COL.link, 9);
        }

        // 影响路径
        if (impacts.length) {
          const head = "影响路径 ";
          const headW = lay.measure(head, 7);
          const labels = impacts.map((im) => `→ ${im.label}`).join("  ");
          const lines = lay.wrap(labels, 7, Math.max(40, w - headW));
          // 第一行:头标签 + 首行内容
          ensureSpace(9);
          drawText(head, state.x, state.y - 7, { size: 7, color: COL.accent });
          drawText(lines[0] || "", state.x + headW, state.y - 7, { size: 7, color: COL.ink });
          advance(9);
          for (let i = 1; i < lines.length; i++) drawRow(lines[i], 7, COL.ink, 9);
        }

        // 项目影响
        if (projects.length) {
          for (const pj of projects) {
            const positive = pj.cls === "p-positive";
            const risk = pj.cls === "p-risk";
            const tone = positive ? RGB(31, 128, 67) : risk ? RGB(196, 57, 60) : RGB(107, 107, 118);
            const head = `[${pj.tone}] ${pj.name}`;
            const headW = lay.measure(head, 7);
            const reason = ` — ${pj.reason}`;
            const reasonLines = lay.wrap(reason, 7, Math.max(40, w - headW - 2));
            ensureSpace(9);
            drawText(head, state.x, state.y - 7, { size: 7, color: tone });
            drawText(reasonLines[0] || "", state.x + headW + 2, state.y - 7, { size: 7, color: COL.dim });
            advance(9);
            for (let i = 1; i < reasonLines.length; i++) drawRow(reasonLines[i], 7, COL.dim, 9);
          }
        }

        // 分隔线 + 段间距
        if (state.y - 8 >= state.bottomY) {
          drawLine(state.x, state.y - 2, state.x + w, state.y - 2, COL.line, 0.3);
          advance(8);
        } else {
          advance(8);
        }
      };

      // ============= 内容渲染 =============

      // 近一周(左栏)
      sectionHeader("近一周");
      if (data.wk.length === 0) {
        ensureSpace(14);
        drawText("本周无重大公开事件。", state.x, state.y - 9, { size: 9, color: COL.dim });
        advance(14);
      } else {
        data.wk.forEach((it) => renderItem(it));
      }

      // 近一月 — 在左栏继续(若没空间则切右栏)
      sectionHeader("近一月");
      data.mo.forEach((it) => renderItem(it));

      // 近半年 — 紧凑显示,允许跨栏
      sectionHeader("近半年");
      for (const stop of data.halfStops) {
        ensureSpace(40);
        drawText(stop.label, state.x, state.y - 9, { size: 9, color: COL.ink });
        const lw = lay.measure(stop.label, 9);
        if (stop.sub) {
          drawText("· " + stop.sub, state.x + lw + 4, state.y - 9, { size: 7.5, color: COL.dim });
        }
        advance(13);
        stop.items.forEach((it) => renderItem(it, { compact: true }));
        advance(4);
      }

      // 五大北极星(若仍有空间)
      if (data.stars.length) {
        sectionHeader("五大北极星");
        for (const s of data.stars) {
          ensureSpace(20);
          drawText(s.name, state.x, state.y - 9, { size: 9, color: COL.ink });
          const nw = lay.measure(s.name, 9);
          if (s.stage) {
            drawText("· " + s.stage, state.x + nw + 4, state.y - 9, { size: 7, color: COL.accent });
          }
          advance(11);
          if (s.tag) {
            for (const ln of lay.wrap(s.tag, 7.5, COL_W)) {
              ensureSpace(9);
              drawText(ln, state.x, state.y - 7, { size: 7.5, color: COL.dim });
              advance(9);
            }
          }
          if (s.detail) {
            for (const ln of lay.wrap(s.detail, 7.5, COL_W)) {
              ensureSpace(9);
              drawText(ln, state.x, state.y - 7, { size: 7.5, color: COL.ink });
              advance(9);
            }
          }
          advance(3);
        }
      }

      // ---- 页脚(每页) ----
      const pages = pdfDoc.getPages();
      pages.forEach((p, i) => {
        const total = pages.length;
        p.drawLine({
          start: { x: MARGIN, y: 22 }, end: { x: PAGE_W - MARGIN, y: 22 },
          color: COL.line, thickness: 0.4,
        });
        p.drawText("来源: blog.ethereum.org · vitalik.eth.limo · 公开媒体资料  ·  本文非投资建议", {
          x: MARGIN, y: 10, size: 7, font: cn, color: COL.dim,
        });
        const pageStr = `${i + 1} / ${total}`;
        const w = en.widthOfTextAtSize(pageStr, 7);
        p.drawText(pageStr, { x: PAGE_W - MARGIN - w, y: 10, size: 7, font: en, color: COL.dim });
      });

      const bytes = await pdfDoc.save({ useObjectStreams: true });
      downloadBlob(bytes, `ethereum-weekly-${t.iso}.pdf`);
    } catch (err) {
      console.error(err);
      alert("PDF 导出失败:" + (err && err.message || err));
    } finally {
      btn.disabled = false;
      labelEl.textContent = originalText;
    }
  }

  btn.addEventListener("click", exportWeekly);
})();

// =======================================================
// 周报导出 · html2canvas 生成 PNG
// 离屏渲染一个排版固定的 1200px 宽报纸样式画布,转 PNG 下载。
// 与 PDF 导出并存:PNG 适合社媒分享/截图,PDF 适合打印/存档。
// =======================================================
(function initWeeklyExportPNG() {
  const btn = document.getElementById("export-weekly-png-btn");
  if (!btn) return;

  const today = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { iso: `${y}-${m}-${day}`, cn: `${y} 年 ${parseInt(m, 10)} 月 ${parseInt(day, 10)} 日` };
  };

  // PNG 版本保留 innerHTML,让链接/强调样式能渲出来
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

  function collectStars() {
    return Array.from(document.querySelectorAll(".sm-star")).map((s) => ({
      name: s.querySelector("h4")?.textContent.trim() || "",
      tag: s.querySelector(".sm-star-tag")?.textContent.trim() || "",
      stage: s.querySelector(".sm-stage")?.textContent.trim() || "",
      detail: s.querySelector(".sm-stage-detail")?.innerHTML || "",
      stageClass: s.className.match(/sm-s\d/)?.[0] || "",
    }));
  }

  // 把 .recent-half-band 的紧凑时间柱展平成一组 item,适配三列等宽布局
  function collectHalfFlat() {
    const out = [];
    document.querySelectorAll(".recent-half-band .rh-stop").forEach((s) => {
      const label = s.querySelector(".rh-month b")?.textContent.trim() || "";
      Array.from(s.querySelectorAll(".recent-item")).forEach((it) => {
        out.push({
          when: label + " · " + ((it.querySelector(".recent-when")?.textContent || "").trim()),
          source: (it.querySelector(".recent-source")?.textContent || "").trim(),
          sourceClass: it.querySelector(".recent-source")?.className || "",
          body: it.querySelector("p")?.innerHTML || "",
        });
      });
    });
    return out;
  }

  const sourceClassMap = {
    "recent-src-vitalik": "s-vitalik",
    "recent-src-ef":      "s-ef",
    "recent-src-eips":    "s-eips",
    "recent-src-mainnet": "s-mainnet",
    "recent-src-erc":     "s-erc",
  };
  const remapSourceClass = (raw) => {
    const found = Object.keys(sourceClassMap).find((k) => raw.includes(k));
    return "ex-source " + (found ? sourceClassMap[found] : "");
  };

  // 影响路径 & 项目影响推断(与 PDF IIFE 保持同步)
  const stripForMatch = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const impactRules = [
    { match: /原生隐私|Privacy|Kohaku|private reads|keyed nonces/i, impacts: ["Native Privacy / 隐私转账原生化", "架构: AA + FOCIL + RPC 访问层"] },
    { match: /Clear Signing|ERC-7730|盲签|签名/i, impacts: ["应用层: 钱包-DApp 签名安全", "体验: 可读交易意图"] },
    { match: /formal verification|形式化验证|zkVM|后量子|AI 辅助/i, impacts: ["Post-Quantum / 长期安全", "架构: 客户端 + zk 系统正确性"] },
    { match: /200M gas|Gigagas|gas limit|EIP-8037|repricing/i, impacts: ["Gigagas L1 / 主网吞吐", "架构: 执行层资源重定价"] },
    { match: /Glamsterdam|6s|slot|SSF|秒级终局/i, impacts: ["Fast L1 / 秒级终局性", "架构: 共识节奏与升级打包"] },
    { match: /ePBS|BAL|Hegot|Soldøgn|Interop|多客户端|Protocol Cluster/i, impacts: ["架构: 提议者-构建者分离与抗审查", "路线图: Glamsterdam / Hegotá 协同"] },
    { match: /Danksharding|PeerDAS|Blob|L2|rollup/i, impacts: ["Teragas L2 / Blob 带宽", "架构: Rollup-centric 数据可用性"] },
  ];
  const projectRules = [
    { match: /原生隐私|Privacy|Kohaku|private reads|keyed nonces/i, projects: [
      { tone: "利好", name: "RAILGUN ($RAIL)", reason: "隐私工具链与 shielded transfer 叙事相关" },
      { tone: "利好", name: "Privacy Pools", reason: "原生隐私路线提高合规隐私方案能见度" },
    ]},
    { match: /Clear Signing|ERC-7730|盲签|签名/i, projects: [
      { tone: "利好", name: "Ledger / Trezor", reason: "硬件签名与 ERC-7730 标准直接相关" },
      { tone: "利好", name: "MetaMask / WalletConnect", reason: "钱包连接与交易展示层优先受益" },
    ]},
    { match: /formal verification|形式化验证|zkVM|后量子|AI 辅助/i, projects: [
      { tone: "利好", name: "zkVM / ZK infra", reason: "验证工具链、安全证明需求上升" },
      { tone: "利好", name: "形式化验证工具", reason: "AI 辅助证明与审计可能提升采用" },
    ]},
    { match: /200M gas|Gigagas|gas limit|EIP-8037|repricing/i, projects: [
      { tone: "利好", name: "L1 高频应用 / DeFi", reason: "更高 gas 上限改善主网吞吐空间" },
      { tone: "潜在压力", name: "部分 L2", reason: "若 L1 容量显著提升,部分需求可能回流主网" },
    ]},
    { match: /Glamsterdam|6s|slot|SSF|秒级终局/i, projects: [
      { tone: "利好", name: "L1 DeFi / 支付应用", reason: "更短确认时间改善交互体验" },
    ]},
    { match: /ePBS|BAL|Hegot|Soldøgn|Interop|多客户端|Protocol Cluster/i, projects: [
      { tone: "影响", name: "MEV-Boost / relay 生态", reason: "ePBS 把 PBS 纳入协议,削弱中间件依赖" },
      { tone: "利好", name: "客户端团队", reason: "多客户端 devnet 测试重要性上升" },
    ]},
    { match: /Danksharding|PeerDAS|Blob|L2|rollup/i, projects: [
      { tone: "利好", name: "Optimism / Arbitrum / Base", reason: "Blob 带宽与 DA 改善直接影响 rollup 成本" },
    ]},
  ];
  const noDirectImpact = /ETF|净流出|净赎回|EPF|Fellowship|Allocation Update|资金|招募|出售 ETH|Bankless/i;

  function impactsFor(it) {
    const text = `${it.when} ${it.source} ${stripForMatch(it.body)}`;
    if (noDirectImpact.test(text)) return [];
    const seen = new Set();
    const out = [];
    for (const rule of impactRules) {
      if (!rule.match.test(text)) continue;
      for (const label of rule.impacts) {
        if (!seen.has(label)) { seen.add(label); out.push(label); }
      }
    }
    return out.slice(0, 3);
  }
  function projectsFor(it) {
    const text = `${it.when} ${it.source} ${stripForMatch(it.body)}`;
    if (noDirectImpact.test(text)) return [];
    const seen = new Set();
    const out = [];
    for (const rule of projectRules) {
      if (!rule.match.test(text)) continue;
      for (const pj of rule.projects) {
        const k = `${pj.tone}:${pj.name}`;
        if (!seen.has(k)) { seen.add(k); out.push(pj); }
      }
    }
    return out.slice(0, 3);
  }

  function buildExportNode() {
    const wk = collectColumn(".recent-week");
    const mo = collectColumn(".recent-month");
    const hf = collectHalfFlat();
    const stars = collectStars();
    const t = today();

    const itemHTML = (it) => {
      const impacts = impactsFor(it);
      const projects = projectsFor(it);
      let extra = "";
      if (impacts.length) {
        extra += `<div class="ex-impacts"><span class="ex-impacts-label">影响路径</span> ${impacts.map(l => `<span class="ex-impact-tag">→ ${l}</span>`).join(" ")}</div>`;
      }
      if (projects.length) {
        extra += `<div class="ex-projects">${projects.map(pj => `<span class="ex-project-tag ex-pj-${pj.tone === "潜在压力" ? "risk" : "pos"}">[${pj.tone}] ${pj.name} — ${pj.reason}</span>`).join("")}</div>`;
      }
      return `
      <div class="ex-item">
        <div class="ex-item-meta">
          <span class="ex-when">${it.when}</span>
          <span class="${remapSourceClass(it.sourceClass)}">${it.source}</span>
        </div>
        <p class="ex-body">${it.body}</p>
        ${extra}
      </div>`;
    };

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

        <section class="ex-cols">
          <div class="ex-col ex-col-week">
            <div class="ex-col-head"><span class="ex-tag">近一周</span></div>
            ${wk.map(itemHTML).join("") || '<p class="ex-empty">本周无重大公开事件。</p>'}
          </div>
          <div class="ex-col ex-col-month">
            <div class="ex-col-head"><span class="ex-tag">近一月</span></div>
            ${mo.map(itemHTML).join("")}
          </div>
          <div class="ex-col ex-col-half">
            <div class="ex-col-head"><span class="ex-tag">近半年</span></div>
            ${hf.map(itemHTML).join("")}
          </div>
        </section>

        ${stars.length ? `
        <section class="ex-stars-band">
          <h2>📍 五大北极星进度速览</h2>
          <div class="ex-stars-grid">${stars.map(starHTML).join("")}</div>
        </section>` : ""}

        <footer class="ex-foot">
          <span>来源:blog.ethereum.org · vitalik.eth.limo · 公开媒体资料</span>
          <span class="ex-foot-mark">本图由站点自动生成 · 不构成投资建议</span>
        </footer>
      </div>
    `;
    return node;
  }

  async function exportWeeklyPNG() {
    if (typeof window.html2canvas !== "function") {
      alert("html2canvas 还在加载,稍候重试。");
      return;
    }

    btn.disabled = true;
    const labelEl = btn.querySelector(".export-btn-label");
    const originalText = labelEl.textContent;
    labelEl.textContent = "生成中…";

    const node = buildExportNode();
    document.body.appendChild(node);

    try {
      const canvas = await window.html2canvas(node, {
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
      alert("PNG 导出失败:" + (err && err.message || err));
    } finally {
      node.remove();
      btn.disabled = false;
      labelEl.textContent = originalText;
    }
  }

  btn.addEventListener("click", exportWeeklyPNG);
})();
