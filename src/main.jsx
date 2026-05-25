import React from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  ChevronRight,
  ClipboardList,
  DollarSign,
  Factory,
  Gauge,
  LineChart,
  PackageSearch,
  Search,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import "./styles.css";

const money = (value) => {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B VND`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M VND`;
  return `${Math.round(n).toLocaleString()} VND`;
};

const shortMoney = (value) => {
  const n = Number(value || 0);
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return Math.round(n).toLocaleString();
};

const number = (value, digits = 0) =>
  Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(",");
  return lines.map((line) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, index) => {
      const raw = values[index] ?? "";
      const asNumber = Number(raw);
      row[header] = raw !== "" && !Number.isNaN(asNumber) ? asNumber : raw;
    });
    return row;
  });
}

async function loadCsv(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to load ${path}`);
  return parseCsv(await response.text());
}

function useDashboardData() {
  const [state, setState] = React.useState({ loading: true, error: null });

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      loadCsv("/data/sku_forecast_summary.csv"),
      loadCsv("/data/sku_risk_table.csv"),
      loadCsv("/data/forecast_long.csv"),
      loadCsv("/data/recent_actuals.csv"),
      fetch("/data/demo_metadata.json").then((r) => r.json()),
    ])
      .then(([summary, risk, forecast, actuals, metadata]) => {
        if (!cancelled) setState({ loading: false, summary, risk, forecast, actuals, metadata });
      })
      .catch((error) => {
        if (!cancelled) setState({ loading: false, error });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

const pages = [
  { key: "dashboard", label: "Dashboard", icon: Gauge },
  { key: "engine", label: "Forecast Engine", icon: Factory },
  { key: "risk", label: "SKU Risk Monitor", icon: ShieldCheck },
  { key: "detail", label: "Forecast Detail", icon: LineChart },
  { key: "agent", label: "AI Agent", icon: Bot },
  { key: "scenario", label: "Scenario Simulator", icon: Settings2 },
];

const demoSteps = [
  { key: "dashboard", title: "Control Tower", line: "Start with operating KPIs and the priority action queue." },
  { key: "risk", title: "Risk Monitor", line: "Rank SKUs by stockout, overstock, and financial exposure." },
  { key: "detail", title: "SKU Drilldown", line: "Inspect one SKU forecast and its revenue/profit impact." },
  { key: "agent", title: "Decision Copilot", line: "Turn a business question into an operating brief." },
  { key: "scenario", title: "Scenario Simulator", line: "Stress-test lead time, safety stock, and demand uplift." },
];

const riskLabel = {
  "Stockout risk": "Stockout risk",
  "Overstock risk": "Overstock risk",
  Healthy: "Healthy",
};

const actionLabel = {
  "Prioritize replenishment and confirm supplier availability":
    "Prioritize replenishment and confirm supplier availability",
  "Review replenishment need; margin data is limited": "Review replenishment need; margin data is limited",
  "Slow purchase orders and consider promotion/bundling": "Slow purchase orders and consider promotion/bundling",
  Monitor: "Monitor",
};

function goToSkuDetail(skuId) {
  if (!skuId) return;
  const sku = String(skuId).trim().toUpperCase();
  sessionStorage.setItem("selectedSku", sku);
  window.dispatchEvent(new CustomEvent("sku-search", { detail: sku }));
  window.location.hash = "detail";
}

function severityFor(row) {
  const riskScore = Number(row.risk_score || 0);
  const profit = Number(row.profit_at_risk_proxy || 0);
  if (row.risk_type === "Overstock risk") return "Overstock";
  if (riskScore >= 35 || profit >= 1_500_000) return "Critical";
  if (riskScore >= 20 || profit >= 500_000) return "High";
  return row.risk_type === "Healthy" ? "Watchlist" : "Watchlist";
}

function briefText({ title, rows, metrics = [] }) {
  const lines = [
    title,
    "",
    ...metrics.map((item) => `${item.label}: ${item.value}`),
    "",
    "Priority actions:",
    ...rows.slice(0, 8).map((row, index) => `${index + 1}. ${row.sku_id} | ${severityFor(row)} | ${row.risk_type || "Priority"} | Profit at risk ${money(row.profit_at_risk_proxy || row.forecast_28d_profit || 0)} | ${actionLabel[row.recommended_action] || row.recommended_action || "Monitor and review replenishment plan"}`),
    "",
    "Decision note: forecast is model output; inventory, lead time, stockout and overstock signals are scenario assumptions for decision support.",
  ];
  return lines.join("\n");
}

function downloadText(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Sidebar({ active, setActive, summary, risk, forecast }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandMark">DI</div>
        <div>
          <div className="brandKicker">Demand Intelligence</div>
          <div className="brandTitle">AutoParts Demand Intelligence</div>
        </div>
      </div>
      <p className="brandCopy">Forecast-driven inventory control for sales, logistics, and planning teams.</p>
      <div className="sideStats">
        <div><span>Cycle</span><strong>28D</strong></div>
        <div><span>SKUs</span><strong>{number(summary.length)}</strong></div>
      </div>
      <nav>
        {pages.map(({ key, label, icon: Icon }) => (
          <button className={active === key ? "navItem active" : "navItem"} key={key} onClick={() => setActive(key)}>
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="dataScope">
        <div className="scopeTitle">Data Scope</div>
        <ScopeMetric label="56-day forecast rows" value={forecast.length} />
        <ScopeMetric label="SKUs in workspace" value={summary.length} />
        <ScopeMetric label="Flagged SKUs" value={risk.length} />
        <p>Inventory, lead time, and stockout/overstock alerts are scenario assumptions, not live ERP/WMS data.</p>
      </div>
    </aside>
  );
}

function ScopeMetric({ label, value }) {
  const displayValue = typeof value === "number" ? number(value) : value;
  return (
    <div className="scopeMetric">
      <span>{label}</span>
      <strong>{displayValue}</strong>
    </div>
  );
}

function TopHeader({ pageTitle, subtitle }) {
  const [query, setQuery] = React.useState("");
  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim().toUpperCase();
    if (!value) return;
    sessionStorage.setItem("selectedSku", value);
    window.dispatchEvent(new CustomEvent("sku-search", { detail: value }));
    window.location.hash = "detail";
  };

  return (
    <header className="topHeader">
      <div>
        <h1>{pageTitle}</h1>
        <p>{subtitle}</p>
        <div className="headerControls">
          <form className="searchBox" onSubmit={submitSearch}>
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search SKU, product, warehouse..." />
          </form>
          <div className="headerFilter">28D · All channels · All warehouses</div>
          <div className="iconButton" aria-hidden="true"><Bell size={18} /></div>
        </div>
      </div>
      <div className="headerPills">
        <span>Forecast output</span>
        <span>Simulated inventory assumptions</span>
      </div>
    </header>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone = "teal" }) {
  return (
    <div className={`kpiCard ${tone}`}>
      <div className="kpiTop">
        <span>{label}</span>
        <div className="kpiIcon"><Icon size={20} /></div>
      </div>
      <strong>{value}</strong>
      <p>{sub}</p>
      <div className="miniTrend"><span /> operational signal</div>
    </div>
  );
}

function Card({ title, tag, children, className = "" }) {
  return (
    <section className={`card ${className}`}>
      <div className="cardHead">
        <h2>{title}</h2>
        {tag ? <span>{tag}</span> : null}
      </div>
      {children}
    </section>
  );
}

function dateParts(dateText) {
  const [, , month = "01", day = "01"] = String(dateText).match(/^(\d{4})-(\d{2})-(\d{2})/) || [];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return { day, month: months[Number(month) - 1] || month };
}

function ForecastChart({ series, yLabel = "Daily quantity", height = 320, showArea = false }) {
  const width = 900;
  const pad = { left: 70, right: 24, top: 22, bottom: 58 };
  const allPoints = series.flatMap((item) => item.points);
  const valueOf = (point) => Number(point?.value);
  const isValid = (point) => Number.isFinite(valueOf(point));
  const allValues = allPoints.map(valueOf).filter(Number.isFinite);
  const max = Math.max(...allValues, 1);
  const niceMax = Math.ceil((max * 1.12) / 10) * 10;
  const min = 0;
  const pointCount = Math.max(...series.map((item) => item.points.length), 1);
  const x = (i) => pad.left + (i / Math.max(pointCount - 1, 1)) * (width - pad.left - pad.right);
  const y = (v) => height - pad.bottom - ((Number(v) - min) / Math.max(niceMax - min, 1)) * (height - pad.top - pad.bottom);
  const linePath = (points) => {
    let open = false;
    return points.map((p, i) => {
      if (!isValid(p)) {
        open = false;
        return "";
      }
      const command = open ? "L" : "M";
      open = true;
      return `${command} ${x(i).toFixed(1)} ${y(valueOf(p)).toFixed(1)}`;
    }).filter(Boolean).join(" ");
  };
  const areaPath = (points) => `${linePath(points)} L ${x(points.length - 1).toFixed(1)} ${y(0).toFixed(1)} L ${x(0).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const yTicks = Array.from({ length: 5 }, (_, i) => (niceMax / 4) * i);
  const xTicks = series[0]?.points.filter((_, i) => i % 4 === 0 || i === pointCount - 1) || [];

  return (
    <div className="forecastChartWrap">
      <svg className="forecastChart" style={{ height: `${height}px` }} viewBox={`0 0 ${width} ${height}`} role="img">
        <defs>
          <linearGradient id="forecastFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#BAE6FD" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={width} height={height} rx="18" fill="#ffffff" />
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} stroke="#E2EEF3" />
            <text x={pad.left - 14} y={y(tick) + 4} textAnchor="end" className="axisText">{number(tick)}</text>
          </g>
        ))}
        <text x="20" y={height / 2} textAnchor="middle" className="axisTitle" transform={`rotate(-90 20 ${height / 2})`}>{yLabel}</text>
        {showArea && series[0]?.points.length ? <path d={areaPath(series[0].points)} fill="url(#forecastFill)" /> : null}
        {series.map((item) => (
          <g key={item.name}>
            <path d={linePath(item.points)} fill="none" stroke={item.color} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={item.dash || "none"} />
            {item.points.map((point, i) => isValid(point) ? (
              <circle key={`${item.name}-${point.date}-${i}`} cx={x(i)} cy={y(valueOf(point))} r="3.6" fill="#ffffff" stroke={item.color} strokeWidth="2.4" />
            ) : null)}
          </g>
        ))}
        {xTicks.map((point, tickIndex) => {
          const originalIndex = series[0].points.findIndex((p) => p.date === point.date);
          const part = dateParts(point.date);
          return (
            <text key={`${point.date}-${tickIndex}`} x={x(originalIndex)} y={height - 32} textAnchor="middle" className="axisText">
              <tspan x={x(originalIndex)} dy="0">{part.day}</tspan>
              <tspan x={x(originalIndex)} dy="13">{part.month}</tspan>
            </text>
          );
        })}
      </svg>
      <div className="chartLegend">
        {series.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}</span>)}
      </div>
    </div>
  );
}

function DonutChart({ stockout, overstock }) {
  const total = Math.max(stockout + overstock, 1);
  const stockPct = stockout / total;
  const overPct = overstock / total;
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="donutWrap">
      <svg viewBox="0 0 190 190" className="donut">
        <circle cx="95" cy="95" r={r} fill="none" stroke="#E5EDF0" strokeWidth="28" />
        <circle cx="95" cy="95" r={r} fill="none" stroke="#2563EB" strokeWidth="28" strokeDasharray={`${overPct * c} ${c}`} transform="rotate(-90 95 95)" />
        <circle cx="95" cy="95" r={r} fill="none" stroke="#EF4444" strokeWidth="28" strokeDasharray={`${stockPct * c} ${c}`} strokeDashoffset={-overPct * c} transform="rotate(-90 95 95)" />
        <text x="95" y="92" textAnchor="middle" className="donutValue">{number(total)}</text>
        <text x="95" y="112" textAnchor="middle" className="donutLabel">flagged SKUs</text>
      </svg>
      <div className="legend">
        <span><i className="purple" /> Overstock risk</span>
        <span><i className="red" /> Stockout risk</span>
      </div>
    </div>
  );
}

function DataTable({ rows, columns, limit = 10, onRowClick }) {
  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            {columns.map((col) => <th key={col.key}>{col.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((row, index) => (
            <tr
              key={`${row.sku_id || index}-${index}`}
              className={onRowClick ? "clickableRow" : ""}
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row[col.key], row) : row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RiskBadge({ type }) {
  const cls = type === "Stockout risk" ? "stockout" : type === "Overstock risk" ? "overstock" : "healthy";
  return <span className={`riskBadge ${cls}`}>{riskLabel[type] || type}</span>;
}

function SeverityBadge({ row }) {
  const severity = severityFor(row);
  const cls = severity.toLowerCase();
  return <span className={`severityBadge ${cls}`}>{severity}</span>;
}

function DecisionBrief({ title, rows, metrics, filename = "decision-brief.txt" }) {
  const text = briefText({ title, rows, metrics });
  return (
    <div className="decisionBrief">
      <div>
        <span>Executive decision brief</span>
        <strong>{title}</strong>
        <p>Creates a concise operating brief for replenishment, risk review, and commercial follow-up.</p>
      </div>
      <button type="button" className="primaryButton" onClick={() => downloadText(filename, text)}>Download Brief</button>
    </div>
  );
}

function Dashboard({ data }) {
  const { summary, risk, forecast } = data;
  const first28 = forecast.filter((r) => Number(r.horizon_day) <= 28);
  const demandByDate = Object.values(first28.reduce((acc, row) => {
    acc[row.date] ??= { date: row.date, forecast_qty: 0 };
    acc[row.date].forecast_qty += Number(row.forecast_qty || 0);
    return acc;
  }, {})).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const stockout = risk.filter((r) => r.risk_type === "Stockout risk");
  const overstock = risk.filter((r) => r.risk_type === "Overstock risk");
  const topProfit = [...summary].sort((a, b) => b.forecast_28d_profit - a.forecast_28d_profit).slice(0, 8);
  const actionQueue = [...stockout].sort((a, b) => b.profit_at_risk_proxy - a.profit_at_risk_proxy).slice(0, 8);

  return (
    <>
      <TopHeader pageTitle="Inventory Forecast Control Tower" subtitle="Monitor sales forecast, inventory risk, and priority actions." />
      <div className="kpiGrid six">
        <KpiCard icon={Boxes} label="Managed SKUs" value={number(summary.length)} sub="Active catalog" tone="teal" />
        <KpiCard icon={TrendingUp} label="Next 28-day Demand" value={number(summary.reduce((s, r) => s + r.forecast_28d_qty, 0))} sub="Forecast batch" tone="cyan" />
        <KpiCard icon={DollarSign} label="Estimated Revenue" value={shortMoney(summary.reduce((s, r) => s + r.forecast_28d_revenue, 0))} sub="Forecast x price" tone="green" />
        <KpiCard icon={BarChart3} label="Profit Proxy" value={shortMoney(summary.reduce((s, r) => s + r.forecast_28d_profit, 0))} sub="Margin proxy" tone="amber" />
        <KpiCard icon={AlertTriangle} label="Stockout Risk" value={number(stockout.length)} sub="Action queue" tone="red" />
        <KpiCard icon={PackageSearch} label="Overstock Risk" value={number(overstock.length)} sub="Inventory control" tone="purple" />
      </div>
      <Card title="Priority Action Queue" tag="highest value at risk" className="priorityHeroCard">
        <DecisionBrief
          title="28-day replenishment priority"
          rows={actionQueue}
          filename="autoparts-priority-brief.txt"
          metrics={[
            { label: "Stockout-risk SKUs", value: number(stockout.length) },
            { label: "Overstock-risk SKUs", value: number(overstock.length) },
            { label: "Forecast revenue", value: money(summary.reduce((s, r) => s + r.forecast_28d_revenue, 0)) },
          ]}
        />
        <DataTable rows={actionQueue} limit={8} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "severity", label: "Severity", render: (_, row) => <SeverityBadge row={row} /> },
          { key: "risk_type", label: "Risk Type", render: (v) => <RiskBadge type={v} /> },
          { key: "revenue_at_risk_proxy", label: "Revenue at Risk", render: money },
          { key: "profit_at_risk_proxy", label: "Profit at Risk", render: money },
          { key: "suggested_order_qty", label: "Suggested Order", render: (v) => number(v, 1) },
          { key: "recommended_action", label: "Recommended Action", render: (v) => actionLabel[v] || v },
        ]} />
      </Card>
      <div className="grid twoOne">
        <Card title="Demand Forecast Overview" tag="next 28 days">
          <ForecastChart
            showArea
            yLabel="Forecast demand"
            series={[
              {
                name: "Forecast demand",
                color: "#075985",
                points: demandByDate.map((row) => ({ date: row.date, value: row.forecast_qty })),
              },
            ]}
          />
        </Card>
        <Card title="Inventory Status" tag="alert mix">
          <DonutChart stockout={stockout.length} overstock={overstock.length} />
        </Card>
      </div>
      <div className="grid two">
        <Card title="Top SKUs by Profit Proxy" tag="commercial priority">
          <DataTable rows={topProfit} limit={7} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
            { key: "sku_id", label: "SKU" },
            { key: "forecast_28d_qty", label: "28D Demand", render: (v) => number(v, 1) },
            { key: "forecast_28d_revenue", label: "Revenue", render: money },
            { key: "forecast_28d_profit", label: "Profit Proxy", render: money },
          ]} />
        </Card>
        <Card title="Alert Mix" tag="stockout vs overstock">
          <AlertMix stockout={stockout.length} overstock={overstock.length} />
        </Card>
      </div>
    </>
  );
}

function AlertMix({ stockout, overstock }) {
  const total = Math.max(stockout + overstock, 1);
  return (
    <div className="alertMix">
      <MixRow label="Stockout risk" value={stockout} color="#EF4444" total={total} />
      <MixRow label="Overstock risk" value={overstock} color="#2563EB" total={total} />
    </div>
  );
}

function MixRow({ label, value, color, total }) {
  return (
    <div className="mixRow">
      <div><strong>{label}</strong><span>{number(value)} SKUs</span></div>
      <div className="mixTrack"><i style={{ width: `${(value / total) * 100}%`, background: color }} /></div>
    </div>
  );
}

function ForecastEngine({ data }) {
  const { metadata, summary } = data;
  return (
    <>
      <TopHeader pageTitle="Forecast Engine" subtitle="How the forecast batch is generated, calibrated, and translated into operational decision signals." />
      <div className="kpiGrid four">
        <KpiCard icon={Boxes} label="Forecast Grain" value="SKU-day" sub={`${number(summary.length)} SKUs, 56 forecast days`} />
        <KpiCard icon={TrendingUp} label="Public Score" value={metadata.public_score || "0.48498"} sub={`Rank #${metadata.public_rank || 2}`} tone="green" />
        <KpiCard icon={BarChart3} label="Private Score" value={metadata.private_score || "0.52425"} sub={`Rank #${metadata.private_rank || 4}`} tone="amber" />
        <KpiCard icon={AlertTriangle} label="CV Baseline" value="0.587326" sub="Initial diagnostic" tone="red" />
      </div>
      <div className="grid two">
        <Card title="Forecast Architecture" tag="hybrid model">
          <div className="stepper">
            <Step n="01" title="Statistical backbone" text="Median-56, mean-21, weekday coefficients, and abnormal sales-day handling." />
            <Step n="02" title="Direct XGBoost" text="Top 500 high-profit-weight SKUs are modeled with a Tweedie objective." />
            <Step n="03" title="Calibration layer" text="Volume matching and historical SKU-ratio calibration help control total evaluation demand." />
          </div>
        </Card>
        <Card title="Feature System" tag="about 79 features">
          <div className="featureList">
            <Feature name="Demand history" value="lag_1, lag_7, lag_28; rolling mean 7/21/56/112; median 56" />
            <Feature name="Sparse demand" value="active rate, active days, days since last sale, inactivity state" />
            <Feature name="Calendar" value="weekday, month, weekend, sin/cos seasonality" />
            <Feature name="Business signals" value="unit price, unit cost, profit weight, profit rank" />
          </div>
        </Card>
      </div>
      <Card title="Product Layer Integration" tag="operations">
        <div className="integrationFlow">
          <span>Forecast file</span><ChevronRight size={18} /><span>Risk logic</span><ChevronRight size={18} /><span>Priority queue</span><ChevronRight size={18} /><span>Decision support</span>
        </div>
      </Card>
    </>
  );
}

function Step({ n, title, text }) {
  return <div className="step"><span>{n}</span><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function Feature({ name, value }) {
  return <div className="feature"><strong>{name}</strong><p>{value}</p></div>;
}

function RiskMonitor({ data }) {
  const { risk } = data;
  const [group, setGroup] = React.useState("Stockout risk");
  const [topN, setTopN] = React.useState(25);
  const [sortBy, setSortBy] = React.useState("profit_at_risk_proxy");
  const [search, setSearch] = React.useState("");
  const filtered = risk
    .filter((r) => group === "All" || r.risk_type === group)
    .filter((r) => !search || String(r.sku_id).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b[sortBy] || 0) - Number(a[sortBy] || 0))
    .slice(0, topN);
  const revenue = filtered.reduce((s, r) => s + Number(r.revenue_at_risk_proxy || 0), 0);
  const profit = filtered.reduce((s, r) => s + Number(r.profit_at_risk_proxy || 0), 0);
  const avgRisk = filtered.reduce((s, r) => s + Number(r.risk_score || 0), 0) / Math.max(filtered.length, 1);

  return (
    <>
      <TopHeader pageTitle="SKU Risk Monitor" subtitle="Rank SKUs by stockout or overstock exposure using forecast output and stated inventory assumptions." />
      <Card title="Risk Queue Filters" tag="priority queue">
        <div className="filterRow">
          <label>Alert group<select value={group} onChange={(e) => setGroup(e.target.value)}><option>All</option><option>Stockout risk</option><option>Overstock risk</option></select></label>
          <label>SKUs to show<input type="range" min="5" max="100" step="5" value={topN} onChange={(e) => setTopN(Number(e.target.value))} /><span>{topN}</span></label>
          <label>Sort by<select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="profit_at_risk_proxy">Profit at risk</option><option value="revenue_at_risk_proxy">Revenue at risk</option><option value="risk_score">Risk score</option></select></label>
          <label>Search SKU<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU-00003" /></label>
        </div>
      </Card>
      <div className="kpiGrid four">
        <KpiCard icon={Boxes} label="SKUs in list" value={number(filtered.length)} sub="Current filters" />
        <KpiCard icon={DollarSign} label="Revenue at risk" value={money(revenue)} sub="Visible list" tone="red" />
        <KpiCard icon={BarChart3} label="Profit proxy at risk" value={money(profit)} sub="Visible list" tone="amber" />
        <KpiCard icon={Gauge} label="Avg. risk score" value={number(avgRisk, 1)} sub="Scale 0-100" tone="teal" />
      </div>
      <Card title="Risk Table">
        <DataTable rows={filtered} limit={filtered.length} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "severity", label: "Severity", render: (_, row) => <SeverityBadge row={row} /> },
          { key: "risk_type", label: "Alert Group", render: (v) => <RiskBadge type={v} /> },
          { key: "risk_score", label: "Risk Score", render: (v) => <RiskScore value={v} /> },
          { key: "forecast_28d_qty", label: "28D Demand", render: (v) => number(v, 1) },
          { key: "current_stock_assumed", label: "Assumed Stock", render: (v) => number(v, 1) },
          { key: "reorder_point", label: "Reorder Point", render: (v) => number(v, 1) },
          { key: "revenue_at_risk_proxy", label: "Revenue at Risk", render: money },
          { key: "profit_at_risk_proxy", label: "Profit Proxy at Risk", render: money },
          { key: "recommended_action", label: "Recommendation", render: (v) => actionLabel[v] || v },
        ]} />
      </Card>
    </>
  );
}

function RiskScore({ value }) {
  return <div className="riskScore"><span><i style={{ width: `${Math.min(Number(value), 100)}%` }} /></span><strong>{number(value, 1)}</strong></div>;
}

function ForecastDetail({ data }) {
  const { summary, forecast } = data;
  const top = [...summary].sort((a, b) => b.forecast_28d_profit - a.forecast_28d_profit).slice(0, 100);
  const savedSku = sessionStorage.getItem("selectedSku");
  const [sku, setSku] = React.useState(summary.some((row) => row.sku_id === savedSku) ? savedSku : top[0]?.sku_id);
  const [chartView, setChartView] = React.useState("post");
  const row = summary.find((r) => r.sku_id === sku) || top[0];
  const skuOptions = row && !top.some((item) => item.sku_id === row.sku_id) ? [row, ...top] : top;
  const skuForecast = forecast.filter((r) => r.sku_id === sku && r.horizon_day <= 28).sort((a, b) => a.horizon_day - b.horizon_day);
  const skuNumeric = Number(String(sku || "").replace(/\D/g, "")) || 0;
  const phase = skuNumeric % 7;
  const simulatedRows = skuForecast.map((r, index) => {
    const drift = 0.96 + (index / Math.max(skuForecast.length - 1, 1)) * 0.08;
    const wave = 1 + 0.075 * Math.sin((Number(r.horizon_day) + phase) * Math.PI / 3.5);
    const pulse = [7, 14, 21, 28].includes(Number(r.horizon_day)) ? 0.88 : 1;
    return { date: r.date, value: Math.max(0, Number(r.forecast_qty || 0) * drift * wave * pulse) };
  });
  const forecastRows = skuForecast.map((r) => ({ date: r.date, value: r.forecast_qty }));
  const chartConfig = {
    post: {
      title: "Post-train Forecast vs Simulated Market",
      tag: "hero analysis",
      note: "This is the main demo view: the model forecast is shown against simulated future market data for storytelling after the train period.",
      series: [
        { name: "Forecast", color: "#075985", points: forecastRows },
        { name: "Simulated market data", color: "#F97316", dash: "7 5", points: simulatedRows },
      ],
    },
    forecastOnly: {
      title: "Model Forecast Only",
      tag: "model output",
      note: "This view shows only the model output for the next 28 days after the train period. No historical actual sales are overlaid on future dates.",
      series: [
        { name: "Forecast", color: "#075985", points: forecastRows },
      ],
    },
  }[chartView];

  React.useEffect(() => {
    const onSkuSearch = (event) => {
      const nextSku = String(event.detail || "").trim().toUpperCase();
      if (summary.some((item) => item.sku_id === nextSku)) {
        setSku(nextSku);
      }
    };
    window.addEventListener("sku-search", onSkuSearch);
    return () => window.removeEventListener("sku-search", onSkuSearch);
  }, [summary]);

  return (
    <>
      <TopHeader pageTitle="Forecast Detail" subtitle="SKU-level view of recent actual sales, next 28-day forecast, demand change, and revenue/profit proxy." />
      <Card title="SKU Workspace" tag="drilldown">
        <div className="filterRow twoCols">
          <label>SKU workspace<select><option>Commercial priority</option><option>Stockout risk</option><option>Overstock risk</option></select></label>
          <label>Selected SKU<select value={sku} onChange={(e) => setSku(e.target.value)}>{skuOptions.map((r) => <option key={r.sku_id}>{r.sku_id}</option>)}</select></label>
        </div>
      </Card>
      <div className="kpiGrid five">
        <KpiCard icon={Boxes} label="Last 28D Actual Sales" value={number(row.last_28d_qty, 1)} sub="Historical train data" />
        <KpiCard icon={TrendingUp} label="28D Forecast Demand" value={number(row.forecast_28d_qty, 1)} sub="From forecast batch" tone="cyan" />
        <KpiCard icon={Gauge} label="Demand Change" value={`${number(row.demand_change_pct, 1)}%`} sub="vs. last 28D" tone="amber" />
        <KpiCard icon={DollarSign} label="Estimated Revenue" value={money(row.forecast_28d_revenue)} sub="Financial impact" tone="green" />
        <KpiCard icon={BarChart3} label="Profit Proxy" value={money(row.forecast_28d_profit)} sub="Financial impact" tone="red" />
      </div>
      <Card title={chartConfig.title} tag={chartConfig.tag} className="heroChartCard">
        <DecisionBrief
          title={`${sku} replenishment decision`}
          rows={[{ ...row, sku_id: sku, risk_type: row.forecast_28d_qty > row.last_28d_qty ? "Stockout risk" : "Watchlist", profit_at_risk_proxy: row.forecast_28d_profit, recommended_action: "Prioritize replenishment and confirm supplier availability" }]}
          filename={`${sku}-decision-brief.txt`}
          metrics={[
            { label: "28D forecast demand", value: number(row.forecast_28d_qty, 1) },
            { label: "Estimated revenue", value: money(row.forecast_28d_revenue) },
            { label: "Profit proxy", value: money(row.forecast_28d_profit) },
          ]}
        />
        <ForecastChart
          height={470}
          yLabel="Daily quantity"
          series={chartConfig.series}
        />
        <div className="segmented">
          <button type="button" className={chartView === "post" ? "active" : ""} onClick={() => setChartView("post")}>Future forecast vs simulated data</button>
          <button type="button" className={chartView === "forecastOnly" ? "active" : ""} onClick={() => setChartView("forecastOnly")}>Forecast only</button>
        </div>
        <p className="note">{chartConfig.note}</p>
      </Card>
    </>
  );
}

function Agent({ data }) {
  const { summary, risk } = data;
  const [question, setQuestion] = React.useState("");
  const [submitted, setSubmitted] = React.useState("");
  const [selectedSku, setSelectedSku] = React.useState(sessionStorage.getItem("selectedSku") || "");
  const contextRow = summary.find((row) => row.sku_id === selectedSku);
  const contextRisk = risk.find((row) => row.sku_id === selectedSku);
  const answer = React.useMemo(() => buildAgentAnswer(submitted, summary, risk, selectedSku), [submitted, summary, risk, selectedSku]);

  React.useEffect(() => {
    const syncSku = (event) => setSelectedSku(String(event.detail || sessionStorage.getItem("selectedSku") || ""));
    window.addEventListener("sku-search", syncSku);
    window.addEventListener("storage", syncSku);
    return () => {
      window.removeEventListener("sku-search", syncSku);
      window.removeEventListener("storage", syncSku);
    };
  }, []);

  const runAnalysis = () => {
    const cleaned = question.trim();
    if (cleaned) setSubmitted(cleaned);
  };
  return (
    <>
      <TopHeader pageTitle="Recommendation Agent" subtitle="Rule-based Q&A over prepared CSV tables, designed for controlled presentation without fabricated data." />
      <div className="agentGrid">
        <Card title="Decision Copilot" tag="operator console">
          <div className="copilotHero"><Bot size={34} /><div><strong>AI Decision Copilot</strong><p>{contextRow ? `Current SKU context: ${selectedSku}` : "Type a business question and convert forecast output into an operating brief."}</p></div></div>
          {contextRow ? (
            <div className="skuContextCard">
              <span>Selected SKU</span>
              <strong>{selectedSku}</strong>
              <p>{money(contextRow.forecast_28d_revenue)} revenue · {money(contextRow.forecast_28d_profit)} profit proxy · {contextRisk?.risk_type || "Commercial priority"}</p>
            </div>
          ) : null}
          <label className="stackLabel">Ask a question<input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runAnalysis(); }} placeholder={contextRow ? `Ask what logistics should do for ${selectedSku}...` : "Ask about replenishment, stockout risk, profit priority, or this week's actions..."} /></label>
          <button className="primaryButton" onClick={runAnalysis}>Run Analysis</button>
          <div className="smallMetricRow">
            <ScopeMetric label="Forecast revenue" value={shortMoney(summary.reduce((s, r) => s + r.forecast_28d_revenue, 0))} />
            <ScopeMetric label="Profit proxy" value={shortMoney(summary.reduce((s, r) => s + r.forecast_28d_profit, 0))} />
          </div>
        </Card>
        <Card title={submitted ? "Answer / Recommendation Result" : "Ready to run analysis"} tag={submitted ? "decision brief" : "empty state"}>
          {!submitted ? (
            <div className="emptyState"><Bot size={46} /><strong>Ready to run analysis</strong><p>Type a question and run analysis. The response will be framed as an operating brief.</p></div>
          ) : (
            <div className="answerPane">
              <div className="questionBubble">{submitted}</div>
              <h3>{answer.summary}</h3>
              <div className="briefActions">
                {answer.actions.map((item) => <span key={item}>{item}</span>)}
              </div>
              <DataTable rows={answer.rows} limit={10} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={answer.columns} />
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function buildAgentAnswer(question, summary, risk, selectedSku = "") {
  if (!question) return null;
  const q = question.toLowerCase();
  const skuInQuestion = String(question.match(/sku-\d+/i)?.[0] || selectedSku || "").toUpperCase();
  const skuSummary = summary.find((row) => row.sku_id === skuInQuestion);
  const skuRisk = risk.find((row) => row.sku_id === skuInQuestion);
  const asksGlobalList = q.includes("top") || q.includes("which skus") || q.includes("highest") || q.includes("list");
  const asksSkuContext = q.includes(skuInQuestion.toLowerCase()) || q.includes("this") || q.includes("selected") || q.includes("current") || q.includes("sku") || (!asksGlobalList && Boolean(selectedSku));
  if (skuSummary && asksSkuContext) {
    const briefRow = skuRisk || {
      ...skuSummary,
      risk_type: "Commercial priority",
      risk_score: Math.max(0, Number(skuSummary.demand_change_pct || 0)),
      profit_at_risk_proxy: skuSummary.forecast_28d_profit,
      recommended_action: "Prioritize replenishment and confirm supplier availability",
    };
    return {
      summary: `${skuInQuestion} decision brief: forecast demand is ${number(skuSummary.forecast_28d_qty, 1)} units over the next 28 days, with ${money(skuSummary.forecast_28d_revenue)} estimated revenue and ${money(skuSummary.forecast_28d_profit)} profit proxy.`,
      actions: [
        briefRow.risk_type === "Overstock risk" ? "Review purchase slowdown" : "Validate replenishment coverage",
        "Confirm supplier availability",
        "Monitor demand change vs last 28D",
      ],
      rows: [briefRow],
      columns: [
        { key: "sku_id", label: "SKU" },
        { key: "severity", label: "Severity", render: (_, row) => <SeverityBadge row={row} /> },
        { key: "risk_type", label: "Alert Group", render: (v) => <RiskBadge type={v} /> },
        { key: "forecast_28d_qty", label: "28D Demand", render: (v) => number(v, 1) },
        { key: "profit_at_risk_proxy", label: "Profit / Risk Proxy", render: money },
        { key: "recommended_action", label: "Recommendation", render: (v) => actionLabel[v] || v },
      ],
    };
  }
  if (q.includes("profit")) {
    return {
      summary: "Commercial priority brief: these SKUs carry the strongest 28-day profit proxy and should be protected first when supply or logistics capacity is constrained.",
      actions: ["Protect availability", "Review supplier coverage", "Prioritize high-margin SKUs"],
      rows: [...summary].sort((a, b) => b.forecast_28d_profit - a.forecast_28d_profit).slice(0, 10),
      columns: [
        { key: "sku_id", label: "SKU" },
        { key: "severity", label: "Severity", render: (_, row) => <SeverityBadge row={{ ...row, risk_type: "Stockout risk", profit_at_risk_proxy: row.forecast_28d_profit }} /> },
        { key: "forecast_28d_qty", label: "28D Demand", render: (v) => number(v, 1) },
        { key: "forecast_28d_revenue", label: "Revenue", render: money },
        { key: "forecast_28d_profit", label: "Profit Proxy", render: money },
      ],
    };
  }
  const rows = risk.filter((r) => r.risk_type === "Stockout risk").sort((a, b) => b.profit_at_risk_proxy - a.profit_at_risk_proxy).slice(0, 10);
  return {
    summary: "Replenishment command brief: prioritize SKUs where forecast demand, risk score, and profit exposure point to meaningful stockout impact.",
    actions: ["Prepare replenishment review", "Confirm supplier availability", "Escalate critical SKUs"],
    rows,
    columns: [
      { key: "sku_id", label: "SKU" },
      { key: "severity", label: "Severity", render: (_, row) => <SeverityBadge row={row} /> },
      { key: "risk_score", label: "Risk Score", render: (v) => number(v, 1) },
      { key: "forecast_28d_qty", label: "28D Demand", render: (v) => number(v, 1) },
      { key: "profit_at_risk_proxy", label: "Profit at Risk", render: money },
      { key: "recommended_action", label: "Recommendation", render: (v) => actionLabel[v] || v },
    ],
  };
}

function Scenario({ data }) {
  const { summary } = data;
  const [lead, setLead] = React.useState(7);
  const [safety, setSafety] = React.useState(7);
  const [uplift, setUplift] = React.useState(0);
  const baselineRows = React.useMemo(() => calculateScenario(summary, 7, 7, 0), [summary]);
  const rows = React.useMemo(() => calculateScenario(summary, lead, safety, uplift), [summary, lead, safety, uplift]);
  const stockout = rows.filter((r) => r.risk_type === "Stockout risk");
  const overstock = rows.filter((r) => r.risk_type === "Overstock risk");
  const baseStockout = baselineRows.filter((r) => r.risk_type === "Stockout risk");
  const baseOverstock = baselineRows.filter((r) => r.risk_type === "Overstock risk");
  const revenueAtRisk = stockout.reduce((s, r) => s + r.revenue_at_risk_proxy, 0);
  const profitAtRisk = stockout.reduce((s, r) => s + r.profit_at_risk_proxy, 0);
  const baseRevenueAtRisk = baseStockout.reduce((s, r) => s + r.revenue_at_risk_proxy, 0);
  const baseProfitAtRisk = baseStockout.reduce((s, r) => s + r.profit_at_risk_proxy, 0);
  const newlyCritical = rows
    .filter((row) => row.risk_type === "Stockout risk" && !baseStockout.some((base) => base.sku_id === row.sku_id))
    .sort((a, b) => b.profit_at_risk_proxy - a.profit_at_risk_proxy)
    .slice(0, 8);
  return (
    <>
      <TopHeader pageTitle="Scenario Simulator" subtitle="Estimate the operational impact of lead time, safety stock, and demand uplift assumptions." />
      <div className="scenarioTop">
        <Card title="Scenario Controls" tag="operational parameters">
          <Slider label="Lead time (days)" value={lead} setValue={setLead} min={3} max={30} />
          <Slider label="Safety stock (days)" value={safety} setValue={setSafety} min={0} max={21} />
          <Slider label="Demand uplift (%)" value={uplift} setValue={setUplift} min={-30} max={50} />
          <div className="scenarioNote">
            <strong>Assumption note</strong>
            <span>Reorder points are recalculated from forecast demand, lead time, and safety stock. Inventory remains a demo assumption; no purchase order is created.</span>
          </div>
        </Card>
      </div>
      <div className="kpiGrid four">
        <KpiCard icon={AlertTriangle} label="Stockout-risk SKUs" value={number(stockout.length)} sub={`${stockout.length - baseStockout.length >= 0 ? "+" : ""}${number(stockout.length - baseStockout.length)} vs baseline`} tone="red" />
        <KpiCard icon={PackageSearch} label="Overstock-risk SKUs" value={number(overstock.length)} sub={`${overstock.length - baseOverstock.length >= 0 ? "+" : ""}${number(overstock.length - baseOverstock.length)} vs baseline`} tone="purple" />
        <KpiCard icon={DollarSign} label="Revenue at Risk" value={money(revenueAtRisk)} sub={`${money(revenueAtRisk - baseRevenueAtRisk)} delta`} tone="green" />
        <KpiCard icon={BarChart3} label="Profit Proxy at Risk" value={money(profitAtRisk)} sub={`${money(profitAtRisk - baseProfitAtRisk)} delta`} tone="amber" />
      </div>
      <Card title="Scenario Delta View" tag="baseline: 7D lead, 7D safety">
        <div className="deltaGrid">
          <DeltaTile label="Stockout delta" value={`${stockout.length - baseStockout.length >= 0 ? "+" : ""}${number(stockout.length - baseStockout.length)}`} />
          <DeltaTile label="Revenue at risk delta" value={money(revenueAtRisk - baseRevenueAtRisk)} />
          <DeltaTile label="Profit at risk delta" value={money(profitAtRisk - baseProfitAtRisk)} />
          <DeltaTile label="Newly exposed SKUs" value={number(newlyCritical.length)} />
        </div>
        <DataTable rows={newlyCritical.length ? newlyCritical : stockout.sort((a, b) => b.profit_at_risk_proxy - a.profit_at_risk_proxy)} limit={8} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "severity", label: "Severity", render: (_, row) => <SeverityBadge row={row} /> },
          { key: "risk_score", label: "Risk Score", render: (v) => number(v, 1) },
          { key: "profit_at_risk_proxy", label: "Profit at Risk", render: money },
          { key: "suggested_order_qty", label: "Suggested Order", render: (v) => number(v, 1) },
        ]} />
      </Card>
      <Card title="Scenario Result Table">
        <DataTable rows={rows.filter((r) => r.risk_type !== "Healthy").sort((a, b) => b.profit_at_risk_proxy - a.profit_at_risk_proxy)} limit={25} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "severity", label: "Severity", render: (_, row) => <SeverityBadge row={row} /> },
          { key: "risk_type", label: "Alert Group", render: (v) => <RiskBadge type={v} /> },
          { key: "risk_score", label: "Risk Score", render: (v) => number(v, 1) },
          { key: "scenario_forecast_28d_qty", label: "Scenario Demand", render: (v) => number(v, 1) },
          { key: "scenario_reorder_point", label: "Reorder Point", render: (v) => number(v, 1) },
          { key: "profit_at_risk_proxy", label: "Profit at Risk", render: money },
          { key: "suggested_order_qty", label: "Suggested Order", render: (v) => number(v, 1) },
        ]} />
      </Card>
    </>
  );
}

function Slider({ label, value, setValue, min, max }) {
  return <label className="sliderLabel"><span>{label}<strong>{value}</strong></span><input type="range" min={min} max={max} value={value} onChange={(e) => setValue(Number(e.target.value))} /></label>;
}

function DeltaTile({ label, value }) {
  return (
    <div className="deltaTile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function calculateScenario(summary, lead, safety, uplift) {
  return summary.map((row) => {
    const demand = Number(row.forecast_28d_qty || 0) * (1 + uplift / 100);
    const daily = demand / 28;
    const reorder = daily * (lead + safety);
    const stock = Number(row.current_stock_assumed || row.forecast_28d_qty * 0.3 || 0);
    const shortage = Math.max(reorder - stock, 0);
    const surplus = Math.max(stock - demand * 2, 0);
    const stockoutScore = reorder > 0 ? shortage / reorder : 0;
    const overstockScore = demand > 0 ? surplus / (demand * 2) : 0;
    const riskType = demand >= 1 && stockoutScore >= 0.15 ? "Stockout risk" : overstockScore >= 0.25 ? "Overstock risk" : "Healthy";
    return {
      ...row,
      risk_type: riskType,
      risk_score: riskType === "Stockout risk" ? stockoutScore * 100 : riskType === "Overstock risk" ? overstockScore * 100 : 0,
      scenario_forecast_28d_qty: demand,
      scenario_reorder_point: reorder,
      profit_at_risk_proxy: shortage * Number(row.unit_profit_proxy || 0),
      revenue_at_risk_proxy: shortage * Number(row.unit_price_proxy || 0),
      suggested_order_qty: Math.max(0, reorder + demand - stock),
    };
  });
}

function DemoDock({ active, demoIndex, setDemoIndex, setActive }) {
  const isRunning = demoIndex >= 0;
  const currentIndex = isRunning ? demoIndex : Math.max(0, demoSteps.findIndex((step) => step.key === active));
  const current = demoSteps[currentIndex] || demoSteps[0];
  const startDemo = () => {
    setDemoIndex(0);
    setActive(demoSteps[0].key);
  };
  const nextStep = () => {
    const next = Math.min(currentIndex + 1, demoSteps.length - 1);
    setDemoIndex(next);
    setActive(demoSteps[next].key);
  };
  const stopDemo = () => setDemoIndex(-1);

  return (
    <div className={`demoDock ${isRunning ? "running" : ""}`}>
      <div>
        <span>{isRunning ? `Pitch step ${currentIndex + 1}/${demoSteps.length}` : "Pitch mode"}</span>
        <strong>{isRunning ? current.title : "Guided product demo"}</strong>
        <p>{isRunning ? current.line : "Walk through dashboard, risk, SKU detail, agent, and scenario in order."}</p>
      </div>
      <div className="demoActions">
        {!isRunning ? <button type="button" onClick={startDemo}>Start Demo</button> : null}
        {isRunning && currentIndex < demoSteps.length - 1 ? <button type="button" onClick={nextStep}>Next</button> : null}
        {isRunning ? <button type="button" className="ghostButton" onClick={stopDemo}>End</button> : null}
      </div>
    </div>
  );
}

function App() {
  const data = useDashboardData();
  const getInitialPage = () => {
    const key = window.location.hash.replace("#", "");
    return pages.some((page) => page.key === key) ? key : "dashboard";
  };
  const [active, setActiveState] = React.useState(getInitialPage);
  const [demoIndex, setDemoIndex] = React.useState(-1);

  React.useEffect(() => {
    const onHashChange = () => {
      const key = window.location.hash.replace("#", "");
      if (pages.some((page) => page.key === key)) {
        setActiveState(key);
        const index = demoSteps.findIndex((step) => step.key === key);
        if (demoIndex >= 0 && index >= 0) setDemoIndex(index);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [demoIndex]);

  const setActive = (key) => {
    setActiveState(key);
    if (window.location.hash !== `#${key}`) window.location.hash = key;
  };

  if (data.loading) {
    return <div className="loading"><Warehouse size={44} /><strong>Loading AutoParts Demand Intelligence...</strong><span>Preparing forecast, SKU risk, and action queue tables.</span></div>;
  }
  if (data.error) {
    return <div className="loading error"><AlertTriangle size={44} /><strong>Data load failed</strong><span>{data.error.message}</span></div>;
  }

  const page = {
    dashboard: <Dashboard data={data} />,
    engine: <ForecastEngine data={data} />,
    risk: <RiskMonitor data={data} />,
    detail: <ForecastDetail data={data} />,
    agent: <Agent data={data} />,
    scenario: <Scenario data={data} />,
  }[active];

  return (
    <div className="appShell">
      <Sidebar active={active} setActive={setActive} summary={data.summary} risk={data.risk} forecast={data.forecast} />
      <main className={demoIndex >= 0 ? "demoActive" : ""}>{page}</main>
      <DemoDock active={active} demoIndex={demoIndex} setDemoIndex={setDemoIndex} setActive={setActive} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
