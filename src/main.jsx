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
  SendHorizontal,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Warehouse,
  X,
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
  { key: "planner", label: "Replenishment Planner", icon: ClipboardList },
  { key: "detail", label: "Forecast Detail", icon: LineChart },
  { key: "agent", label: "AI Agent", icon: Bot },
  { key: "scenario", label: "Scenario Simulator", icon: Settings2 },
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

function urgencyFor(row) {
  const severity = severityFor(row);
  const order = Number(row.suggested_order_qty || 0);
  const profit = Number(row.profit_at_risk_proxy || row.forecast_28d_profit || 0);
  if (severity === "Critical" || order >= 100 || profit >= 1_500_000) return "High";
  if (severity === "High" || order >= 25 || profit >= 500_000) return "Medium";
  return row.risk_type === "Overstock risk" ? "Medium" : "Low";
}

function expectedStockoutDate(row, baseDate = "2026-10-03") {
  if (row.risk_type !== "Stockout risk") return "Not projected";
  const daily = Number(row.forecast_daily_avg || row.forecast_28d_qty / 28 || 0);
  const stock = Number(row.current_stock_assumed || 0);
  if (daily <= 0) return "Not projected";
  const days = Math.max(1, Math.ceil(stock / daily));
  const date = new Date(`${baseDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function plannerReason(row) {
  if (row.risk_type === "Overstock risk") return "Assumed stock is high versus forecast demand; slow purchase orders and review promotion or bundling.";
  if (Number(row.current_stock_assumed || 0) < Number(row.reorder_point || 0)) return "Assumed stock is below reorder point while forecast demand remains material.";
  if (Number(row.suggested_order_qty || 0) > 0) return "Forecast coverage indicates a replenishment gap within the next 28 days.";
  return "Monitor forecast movement and validate real stock before committing action.";
}

function leadTimeImpact(row) {
  if (row.risk_type === "Overstock risk") return "Purchase slowdown recommended";
  const stockout = expectedStockoutDate(row);
  if (stockout === "Not projected") return "No immediate shortage projected";
  const lead = Number(row.lead_time_days || 7);
  return lead >= 14 ? "Supplier delay may miss coverage window" : "Replenishment can still protect coverage";
}

function buildPlannerRows(summary, risk, limit = 40) {
  const riskBySku = new Map(risk.map((row) => [row.sku_id, row]));
  return [...summary]
    .map((row) => {
      const riskRow = riskBySku.get(row.sku_id) || row;
      const merged = { ...row, ...riskRow };
      return {
        ...merged,
        urgency: urgencyFor(merged),
        owner: merged.risk_type === "Overstock risk" ? "Sales Ops" : "Inventory Lead",
        status: "Open",
        due_date: urgencyFor(merged) === "High" ? "Next 48h" : urgencyFor(merged) === "Medium" ? "This week" : "Monitor",
        expected_stockout_date: expectedStockoutDate(merged),
        lead_time_impact: leadTimeImpact(merged),
        reason: plannerReason(merged),
        business_impact: Number(merged.profit_at_risk_proxy || merged.forecast_28d_profit || 0),
      };
    })
    .filter((row) => row.risk_type !== "Healthy" || Number(row.suggested_order_qty || 0) > 0)
    .sort((a, b) => {
      const score = { High: 3, Medium: 2, Low: 1 };
      return (score[b.urgency] - score[a.urgency]) || Number(b.business_impact || 0) - Number(a.business_impact || 0);
    })
    .slice(0, limit);
}

function riskDriversFor(row) {
  const stockGap = Math.max(Number(row.reorder_point || 0) - Number(row.current_stock_assumed || 0), 0);
  const demandChange = Math.max(Number(row.demand_change_pct || 0), 0);
  const profit = Number(row.profit_at_risk_proxy || row.forecast_28d_profit || 0);
  const orderQty = Number(row.suggested_order_qty || 0);
  const maxProfit = 2_000_000;
  const drivers = [
    {
      label: "Stock below reorder point",
      value: stockGap,
      points: Math.min(35, stockGap > 0 ? 15 + stockGap / Math.max(Number(row.reorder_point || 1), 1) * 20 : 0),
      detail: stockGap > 0 ? `${number(stockGap, 1)} units gap` : "No reorder gap",
      tone: "red",
    },
    {
      label: "Forecast demand acceleration",
      value: demandChange,
      points: Math.min(25, demandChange / 2),
      detail: `${number(row.demand_change_pct || 0, 1)}% vs last 28D`,
      tone: "amber",
    },
    {
      label: "Profit exposure",
      value: profit,
      points: Math.min(25, (profit / maxProfit) * 25),
      detail: money(profit),
      tone: "green",
    },
    {
      label: "Suggested replenishment size",
      value: orderQty,
      points: Math.min(15, orderQty / 10),
      detail: `${number(orderQty, 1)} units`,
      tone: "cyan",
    },
  ];
  return drivers.map((driver) => ({ ...driver, points: Math.max(0, Math.round(driver.points)) }));
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
            <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.04" />
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
            <path d={linePath(item.points)} fill="none" stroke={item.color} strokeWidth="3.9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={item.dash || "none"} />
            {item.points.map((point, i) => isValid(point) ? (
              <circle className="forecastPoint" key={`${item.name}-${point.date}-${i}`} cx={x(i)} cy={y(valueOf(point))} r="2.4" fill="#ffffff" stroke={item.color} strokeWidth="1.8" />
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
        <circle cx="95" cy="95" r={r} fill="none" stroke="#E2E8F0" strokeWidth="28" />
        <circle cx="95" cy="95" r={r} fill="none" stroke="#CBD5E1" strokeWidth="28" strokeDasharray={`${overPct * c} ${c}`} transform="rotate(-90 95 95)" />
        <circle cx="95" cy="95" r={r} fill="none" stroke="#EF4444" strokeWidth="28" strokeLinecap="round" strokeDasharray={`${stockPct * c} ${c}`} strokeDashoffset={-overPct * c} transform="rotate(-90 95 95)" />
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
        <KpiCard icon={BarChart3} label="Profit Proxy" value={shortMoney(summary.reduce((s, r) => s + r.forecast_28d_profit, 0))} sub="Margin proxy" tone="green" />
        <KpiCard icon={AlertTriangle} label="Stockout Risk" value={number(stockout.length)} sub="Action queue" tone="red" />
        <KpiCard icon={PackageSearch} label="Overstock Risk" value={number(overstock.length)} sub="Inventory control" tone="amber" />
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
                color: "#1E40AF",
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
      <MixRow label="Overstock risk" value={overstock} color="#F59E0B" total={total} />
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

function ReplenishmentPlanner({ data }) {
  const { summary, risk } = data;
  const baseRows = React.useMemo(() => buildPlannerRows(summary, risk, 60), [summary, risk]);
  const [statusBySku, setStatusBySku] = React.useState({});
  const [filter, setFilter] = React.useState("All");
  const [owner, setOwner] = React.useState("All");
  const rows = baseRows
    .map((row) => ({ ...row, status: statusBySku[row.sku_id] || row.status }))
    .filter((row) => filter === "All" || row.urgency === filter)
    .filter((row) => owner === "All" || row.owner === owner);
  const high = rows.filter((row) => row.urgency === "High");
  const protectedProfit = rows.reduce((sum, row) => sum + Number(row.business_impact || 0), 0);
  const suggestedQty = rows.reduce((sum, row) => sum + Number(row.suggested_order_qty || 0), 0);

  const setStatus = (skuId, status) => {
    setStatusBySku((current) => ({ ...current, [skuId]: status }));
  };

  return (
    <>
      <TopHeader pageTitle="Replenishment Action Planner" subtitle="Convert forecast risk signals into an operating plan for replenishment, review, and inventory control." />
      <div className="kpiGrid four">
        <KpiCard icon={ClipboardList} label="Action Items" value={number(rows.length)} sub="Visible plan" />
        <KpiCard icon={AlertTriangle} label="High Urgency" value={number(high.length)} sub="Needs fast review" tone="red" />
        <KpiCard icon={Boxes} label="Suggested Order Qty" value={number(suggestedQty, 1)} sub="Scenario-based" tone="cyan" />
        <KpiCard icon={DollarSign} label="Profit Protected" value={shortMoney(protectedProfit)} sub="Proxy impact" tone="green" />
      </div>
      <Card title="Planner Controls" tag="workflow filters">
        <div className="filterRow twoCols">
          <label>Urgency<select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>High</option><option>Medium</option><option>Low</option></select></label>
          <label>Owner<select value={owner} onChange={(event) => setOwner(event.target.value)}><option>All</option><option>Inventory Lead</option><option>Sales Ops</option></select></label>
        </div>
      </Card>
      <Card title="Replenishment Action Plan" tag="approve, defer, or review">
        <DataTable rows={rows} limit={rows.length} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "urgency", label: "Urgency", render: (value) => <span className={`urgencyBadge ${String(value).toLowerCase()}`}>{value}</span> },
          { key: "risk_type", label: "Alert", render: (value) => <RiskBadge type={value} /> },
          { key: "suggested_order_qty", label: "Suggested Order", render: (value) => number(value, 1) },
          { key: "expected_stockout_date", label: "Expected Stockout", render: (value) => value },
          { key: "lead_time_impact", label: "Lead Time Impact" },
          { key: "business_impact", label: "Profit Protected", render: money },
          { key: "owner", label: "Owner" },
          { key: "due_date", label: "Due" },
          { key: "status", label: "Status", render: (value, row) => (
            <select className="statusSelect" value={value} onClick={(event) => event.stopPropagation()} onChange={(event) => setStatus(row.sku_id, event.target.value)}>
              <option>Open</option><option>In Review</option><option>Approved</option><option>Deferred</option><option>Resolved</option>
            </select>
          ) },
          { key: "reason", label: "Reason" },
        ]} />
      </Card>
    </>
  );
}

function ForecastDetail({ data }) {
  const { summary, forecast } = data;
  const top = [...summary].sort((a, b) => b.forecast_28d_profit - a.forecast_28d_profit).slice(0, 100);
  const savedSku = sessionStorage.getItem("selectedSku");
  const [sku, setSku] = React.useState(summary.some((row) => row.sku_id === savedSku) ? savedSku : top[0]?.sku_id);
  const [chartView, setChartView] = React.useState("post");
  const [comparePeers, setComparePeers] = React.useState(() => top.slice(1, 3).map((item) => item.sku_id));
  const row = summary.find((r) => r.sku_id === sku) || top[0];
  const skuOptions = row && !top.some((item) => item.sku_id === row.sku_id) ? [row, ...top] : top;
  const availableCompareSkus = skuOptions.filter((item) => item.sku_id !== sku);
  const compareRows = [sku, ...comparePeers]
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .map((id) => summary.find((item) => item.sku_id === id))
    .filter(Boolean);
  const riskDrivers = riskDriversFor(row);
  const riskPointTotal = riskDrivers.reduce((sum, driver) => sum + driver.points, 0);
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
        { name: "Forecast", color: "#1E40AF", points: forecastRows },
        { name: "Simulated market data", color: "#F97316", dash: "7 5", points: simulatedRows },
      ],
    },
    forecastOnly: {
      title: "Model Forecast Only",
      tag: "model output",
      note: "This view shows only the model output for the next 28 days after the train period. No historical actual sales are overlaid on future dates.",
      series: [
        { name: "Forecast", color: "#1E40AF", points: forecastRows },
      ],
    },
  }[chartView];

  const selectSku = (nextSku) => {
    const normalized = String(nextSku || "").trim().toUpperCase();
    if (!summary.some((item) => item.sku_id === normalized)) return;
    setSku(normalized);
    sessionStorage.setItem("selectedSku", normalized);
    window.dispatchEvent(new CustomEvent("sku-search", { detail: normalized }));
  };

  React.useEffect(() => {
    setComparePeers((previous) => {
      const availableIds = availableCompareSkus.map((item) => item.sku_id);
      const next = previous.filter((id) => id !== sku && availableIds.includes(id));
      availableIds.forEach((id) => {
        if (next.length < 2 && !next.includes(id)) next.push(id);
      });
      return next.slice(0, 2);
    });
  }, [sku]);

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
          <label>Selected SKU<select value={sku} onChange={(e) => selectSku(e.target.value)}>{skuOptions.map((r) => <option key={r.sku_id}>{r.sku_id}</option>)}</select></label>
        </div>
      </Card>
      <div className="kpiGrid five">
        <KpiCard icon={Boxes} label="Last 28D Actual Sales" value={number(row.last_28d_qty, 1)} sub="Historical train data" />
        <KpiCard icon={TrendingUp} label="28D Forecast Demand" value={number(row.forecast_28d_qty, 1)} sub="From forecast batch" tone="cyan" />
        <KpiCard icon={Gauge} label="Demand Change" value={`${number(row.demand_change_pct, 1)}%`} sub="vs. last 28D" tone="amber" />
        <KpiCard icon={DollarSign} label="Estimated Revenue" value={money(row.forecast_28d_revenue)} sub="Financial impact" tone="green" />
        <KpiCard icon={BarChart3} label="Profit Proxy" value={money(row.forecast_28d_profit)} sub="Financial impact" tone="red" />
      </div>
      <div className="grid two">
        <Card title="Why Is This SKU Risky?" tag="explainability">
          <div className="driverList">
            {riskDrivers.map((driver) => <RiskDriver key={driver.label} driver={driver} />)}
          </div>
        </Card>
        <Card title="Decision Readiness" tag="action rationale">
          <div className="readinessPanel">
            <div><span>Risk points explained</span><strong>{number(riskPointTotal)}</strong><p>Rule-based breakdown from forecast demand, stock assumptions, and financial exposure.</p></div>
            <div><span>Expected stockout</span><strong>{expectedStockoutDate(row)}</strong><p>{leadTimeImpact(row)}</p></div>
            <div><span>Planner reason</span><strong>{urgencyFor(row)} urgency</strong><p>{plannerReason(row)}</p></div>
          </div>
        </Card>
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
      <Card title="SKU Compare Mode" tag="priority comparison">
        <div className="compareControls">
          <label>Primary SKU<input value={sku} readOnly /></label>
          {[0, 1].map((index) => (
            <label key={index}>Compare SKU {index + 1}
              <select value={comparePeers[index] || ""} onChange={(event) => {
                const next = [...comparePeers];
                next[index] = event.target.value;
                setComparePeers(next);
              }}>
                {availableCompareSkus.map((item) => <option key={item.sku_id}>{item.sku_id}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="compareGrid">
          {compareRows.map((item, index) => (
            <div className={`compareCard ${item.sku_id === sku ? "primary" : ""}`} key={item.sku_id}>
              <div className="compareTitle">
                <span>{item.sku_id === sku ? "Primary" : `Peer ${index}`}</span>
                <strong>{item.sku_id}</strong>
              </div>
              <div className="compareMetrics">
                <CompareMetric label="28D Demand" value={number(item.forecast_28d_qty, 1)} max={Math.max(...compareRows.map((r) => Number(r.forecast_28d_qty || 0)), 1)} raw={item.forecast_28d_qty} />
                <CompareMetric label="Revenue" value={money(item.forecast_28d_revenue)} max={Math.max(...compareRows.map((r) => Number(r.forecast_28d_revenue || 0)), 1)} raw={item.forecast_28d_revenue} tone="green" />
                <CompareMetric label="Profit Proxy" value={money(item.forecast_28d_profit)} max={Math.max(...compareRows.map((r) => Number(r.forecast_28d_profit || 0)), 1)} raw={item.forecast_28d_profit} tone="green" />
                <CompareMetric label="Demand Change" value={`${number(item.demand_change_pct, 1)}%`} max={Math.max(...compareRows.map((r) => Math.abs(Number(r.demand_change_pct || 0))), 1)} raw={Math.abs(Number(item.demand_change_pct || 0))} tone="amber" />
                <CompareMetric label="Suggested Order" value={number(item.suggested_order_qty, 1)} max={Math.max(...compareRows.map((r) => Number(r.suggested_order_qty || 0)), 1)} raw={item.suggested_order_qty} tone="red" />
              </div>
              <button type="button" className="compareDrillButton" onClick={() => goToSkuDetail(item.sku_id)}>Open SKU Detail</button>
            </div>
          ))}
        </div>
        <DataTable rows={compareRows} limit={compareRows.length} onRowClick={(item) => goToSkuDetail(item.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "forecast_28d_qty", label: "28D Demand", render: (v) => number(v, 1) },
          { key: "forecast_28d_revenue", label: "Revenue", render: money },
          { key: "forecast_28d_profit", label: "Profit Proxy", render: money },
          { key: "demand_change_pct", label: "Demand Change", render: (v) => `${number(v, 1)}%` },
          { key: "suggested_order_qty", label: "Suggested Order", render: (v) => number(v, 1) },
          { key: "risk_type", label: "Risk Signal", render: (v) => <RiskBadge type={v} /> },
        ]} />
      </Card>
    </>
  );
}

function CompareMetric({ label, value, raw, max, tone = "cyan" }) {
  const width = Math.max(4, Math.min(100, (Number(raw || 0) / Math.max(Number(max || 1), 1)) * 100));
  return (
    <div className={`compareMetric ${tone}`}>
      <div><span>{label}</span><strong>{value}</strong></div>
      <i><b style={{ width: `${width}%` }} /></i>
    </div>
  );
}

function RiskDriver({ driver }) {
  return (
    <div className={`riskDriver ${driver.tone}`}>
      <div>
        <span>{driver.label}</span>
        <strong>{driver.points} pts</strong>
      </div>
      <i><b style={{ width: `${Math.min(driver.points, 40) * 2.5}%` }} /></i>
      <p>{driver.detail}</p>
    </div>
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
              <p>{money(contextRow.forecast_28d_revenue)} revenue | {money(contextRow.forecast_28d_profit)} profit proxy | {contextRisk?.risk_type || "Commercial priority"}</p>
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
              {answer.intent ? <div className="intentLine"><Bot size={16} /> {answer.intent}</div> : null}
              <h3>{answer.summary}</h3>
              {answer.metrics?.length ? (
                <div className="answerMetrics">
                  {answer.metrics.map((item) => <ScopeMetric key={item.label} label={item.label} value={item.value} />)}
                </div>
              ) : null}
              <div className="briefActions">
                {answer.actions.map((item) => <span key={item}>{item}</span>)}
              </div>
              <DataTable rows={answer.rows} limit={10} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={answer.columns} />
              {answer.note ? <p className="agentNote">{answer.note}</p> : null}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

const normalizeQuery = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const hasAny = (text, words) => words.some((word) => text.includes(word));

const topBy = (rows, key, limit = 10) =>
  [...rows].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0)).slice(0, limit);

function leadTimeFromQuestion(text) {
  const normalized = normalizeQuery(text);
  const direct = normalized.match(/lead\s*time\D{0,12}(\d{1,2})/i);
  if (direct) return Number(direct[1]);
  const dayMention = normalized.match(/(\d{1,2})\s*(ngay|day|days)/i);
  return dayMention ? Number(dayMention[1]) : null;
}

function riskColumns({ includeOrder = false } = {}) {
  return [
    { key: "sku_id", label: "SKU" },
    { key: "severity", label: "Severity", render: (_, row) => <SeverityBadge row={row} /> },
    { key: "risk_type", label: "Alert Group", render: (v) => <RiskBadge type={v} /> },
    { key: "risk_score", label: "Risk Score", render: (v) => number(v, 1) },
    { key: "forecast_28d_qty", label: "28D Demand", render: (v) => number(v, 1) },
    ...(includeOrder ? [{ key: "suggested_order_qty", label: "Suggested Order", render: (v) => number(v, 1) }] : []),
    { key: "revenue_at_risk_proxy", label: "Revenue at Risk", render: money },
    { key: "profit_at_risk_proxy", label: "Profit at Risk", render: money },
    { key: "recommended_action", label: "Recommendation", render: (v) => actionLabel[v] || v },
  ];
}

const commercialColumns = [
  { key: "sku_id", label: "SKU" },
  { key: "forecast_28d_qty", label: "28D Demand", render: (v) => number(v, 1) },
  { key: "demand_change_pct", label: "Demand Change", render: (v) => `${number(v, 1)}%` },
  { key: "forecast_28d_revenue", label: "Revenue", render: money },
  { key: "forecast_28d_profit", label: "Profit Proxy", render: money },
  { key: "recommended_action", label: "Recommendation", render: (v) => actionLabel[v] || v },
];

const dataGovernanceColumns = [
  { key: "asset", label: "Data Asset" },
  { key: "role", label: "Role in Demo" },
  { key: "guardrail", label: "Guardrail" },
];

const plannerColumns = [
  { key: "sku_id", label: "SKU" },
  { key: "urgency", label: "Urgency", render: (value) => <span className={`urgencyBadge ${String(value).toLowerCase()}`}>{value}</span> },
  { key: "risk_type", label: "Alert", render: (value) => <RiskBadge type={value} /> },
  { key: "suggested_order_qty", label: "Suggested Order", render: (value) => number(value, 1) },
  { key: "expected_stockout_date", label: "Expected Stockout" },
  { key: "business_impact", label: "Profit Protected", render: money },
  { key: "owner", label: "Owner" },
  { key: "reason", label: "Reason" },
];

const scenarioComparisonColumns = [
  { key: "name", label: "Scenario" },
  { key: "lead_time", label: "Lead Time", render: (value) => `${value}D` },
  { key: "demand_uplift", label: "Demand Uplift", render: (value) => `${value > 0 ? "+" : ""}${value}%` },
  { key: "stockout_count", label: "Stockout SKUs", render: (value) => number(value) },
  { key: "revenue_at_risk", label: "Revenue at Risk", render: money },
  { key: "delta_vs_baseline", label: "Revenue Delta", render: money },
];

function buildAgentAnswer(question, summary, risk, selectedSku = "") {
  if (!question) return null;
  const q = normalizeQuery(question);
  const skuInQuestion = String(question.match(/sku-\d+/i)?.[0] || selectedSku || "").toUpperCase();
  const skuSummary = summary.find((row) => row.sku_id === skuInQuestion);
  const skuRisk = risk.find((row) => row.sku_id === skuInQuestion);
  const stockoutRows = risk.filter((row) => row.risk_type === "Stockout risk");
  const overstockRows = risk.filter((row) => row.risk_type === "Overstock risk");
  const asksDataGuardrail = hasAny(q, ["real time", "realtime", "du lieu", "data", "source", "lay o dau", "thuc te", "actual", "inventory that", "ton kho that"]);
  const asksOverstock = hasAny(q, ["overstock", "du hang", "ton kho du", "ton du", "slow purchase", "promotion", "bundle"]);
  const asksProfit = hasAny(q, ["profit", "loi nhuan", "margin", "high margin"]);
  const asksRevenue = hasAny(q, ["revenue", "doanh thu", "sales impact"]);
  const asksTrend = hasAny(q, ["trend", "xu huong", "increase", "decrease", "tang", "giam", "demand change", "bien dong"]);
  const asksLeadTime = hasAny(q, ["lead time", "supplier delay", "delay", "14 ngay", "14 days"]);
  const asksBudget = hasAny(q, ["budget", "limited", "gioi han", "uu tien", "priority", "prioritize", "nhap gap", "nhap them", "mua them", "logistics", "this week", "tuan nay"]);
  const asksStockout = hasAny(q, ["stockout", "thieu hang", "het hang", "replenishment", "reorder", "nhap hang", "nhap them", "mua them"]);
  const asksActionPlan = hasAny(q, ["action plan", "create plan", "replenishment plan", "ke hoach", "planner", "approve order"]);
  const asksExplain = hasAny(q, ["explain", "why", "tai sao", "vi sao", "critical", "risky", "rui ro"]);
  const asksScenarioCompare = hasAny(q, ["compare scenario", "baseline vs", "so sanh kich ban", "scenario comparison"]);
  const asksExecutive = hasAny(q, ["executive summary", "board summary", "management summary", "summary for this week", "tom tat"]);
  const asksManualReview = hasAny(q, ["manual review", "review manually", "can xem", "review before action"]);
  const asksGlobalList = hasAny(q, ["top", "which skus", "sku nao", "list", "danh sach", "highest", "cao nhat"]);
  const asksGenericTopSku = asksGlobalList && !asksProfit && !asksRevenue && !asksOverstock && !asksTrend && !asksLeadTime;
  const asksSkuContext = Boolean(skuInQuestion) && (
    q.includes(skuInQuestion.toLowerCase()) ||
    (!asksGlobalList && (hasAny(q, ["this", "selected", "current", "sku", "ma hang", "san pham"]) || Boolean(selectedSku)))
  );

  if (asksDataGuardrail) {
    return {
      intent: "Data governance and demo guardrail",
      summary: "This demo is not a real-time ERP/WMS screen. It reads prepared forecast and risk tables, then turns them into decision-support recommendations for the next 28 days.",
      metrics: [
        { label: "Forecast horizon", value: "28D" },
        { label: "Managed SKUs", value: number(summary.length) },
        { label: "Risk records", value: number(risk.length) },
      ],
      actions: ["Use as decision support", "Validate real stock before purchase", "Do not claim live ERP integration"],
      rows: [
        { asset: "sku_forecast_summary.csv", role: "SKU-level demand, revenue, profit proxy, and demand change", guardrail: "Forecast output, not live sales feed" },
        { asset: "sku_risk_table.csv", role: "Stockout/overstock ranking and recommended actions", guardrail: "Inventory and lead time are scenario assumptions" },
        { asset: "forecast_long.csv", role: "Daily 28-day forecast curve for charting", guardrail: "Precomputed batch forecast" },
      ],
      columns: dataGovernanceColumns,
      note: "Decision note: the agent can explain and rank what is loaded in the CSV tables; it should not invent live inventory, supplier commitments, or purchase orders.",
    };
  }

  if (asksExecutive) {
    const actionRows = buildPlannerRows(summary, risk, 10);
    const stockout = risk.filter((row) => row.risk_type === "Stockout risk");
    const overstock = risk.filter((row) => row.risk_type === "Overstock risk");
    return {
      intent: "Executive operating summary",
      summary: `Next 28 days: ${number(summary.length)} managed SKUs, ${number(stockout.length)} stockout-risk SKUs, and ${number(overstock.length)} overstock-risk SKUs. The recommended management focus is protecting high-profit stockout exposure while slowing purchase orders for overstock signals.`,
      metrics: [
        { label: "28D Demand", value: number(summary.reduce((sum, row) => sum + Number(row.forecast_28d_qty || 0), 0), 1) },
        { label: "Revenue Proxy", value: shortMoney(summary.reduce((sum, row) => sum + Number(row.forecast_28d_revenue || 0), 0)) },
        { label: "Action Items", value: number(actionRows.length) },
      ],
      actions: ["Approve high-urgency replenishment review", "Validate real stock before purchase", "Watch overstock SKUs for promotion or PO slowdown"],
      rows: actionRows,
      columns: plannerColumns,
      note: "Executive brief is generated from prepared forecast and risk tables; inventory remains a scenario assumption.",
    };
  }

  if (asksScenarioCompare) {
    const rows = buildScenarioComparison(summary, { lead: 14, safety: 7, uplift: 0 });
    const supplierDelay = rows.find((row) => row.name === "Supplier Delay");
    const baseline = rows[0];
    return {
      intent: "Scenario comparison action mode",
      summary: `Supplier Delay versus Baseline changes stockout-risk SKUs by ${number((supplierDelay?.stockout_count || 0) - (baseline?.stockout_count || 0))} and revenue at risk by ${money((supplierDelay?.revenue_at_risk || 0) - (baseline?.revenue_at_risk || 0))}.`,
      metrics: [
        { label: "Baseline revenue risk", value: shortMoney(baseline?.revenue_at_risk || 0) },
        { label: "Supplier delay risk", value: shortMoney(supplierDelay?.revenue_at_risk || 0) },
        { label: "Revenue delta", value: shortMoney((supplierDelay?.revenue_at_risk || 0) - (baseline?.revenue_at_risk || 0)) },
      ],
      actions: ["Open Scenario Simulator", "Stress-test supplier delay", "Review SKUs newly exposed by lead time"],
      rows,
      columns: scenarioComparisonColumns,
      note: "Scenario comparison is rule-based and uses assumed lead time, safety stock, and forecast demand.",
    };
  }

  if (asksActionPlan) {
    const rows = buildPlannerRows(summary, risk, 10);
    return {
      intent: "Replenishment action plan",
      summary: "I created a prioritized replenishment action plan from forecast risk, suggested order quantity, expected stockout timing, and profit exposure.",
      metrics: [
        { label: "High urgency", value: number(rows.filter((row) => row.urgency === "High").length) },
        { label: "Suggested order qty", value: number(rows.reduce((sum, row) => sum + Number(row.suggested_order_qty || 0), 0), 1) },
        { label: "Profit protected", value: shortMoney(rows.reduce((sum, row) => sum + Number(row.business_impact || 0), 0)) },
      ],
      actions: ["Open Replenishment Planner", "Approve or defer each item", "Validate real stock before purchase"],
      rows,
      columns: plannerColumns,
      note: "This plan is decision support. Final purchase approval remains with the responsible owner.",
    };
  }

  if (asksManualReview) {
    const rows = buildPlannerRows(summary, risk, 30)
      .filter((row) => row.urgency !== "Low" && (Number(row.risk_score || 0) < 20 || Math.abs(Number(row.demand_change_pct || 0)) > 40))
      .slice(0, 10);
    return {
      intent: "Manual review queue",
      summary: "These SKUs should be reviewed manually because their action signal is meaningful but the demand movement or risk confidence deserves a planner check before approval.",
      metrics: [
        { label: "Review SKUs", value: number(rows.length) },
        { label: "Profit exposure", value: shortMoney(rows.reduce((sum, row) => sum + Number(row.business_impact || 0), 0)) },
      ],
      actions: ["Assign planner review", "Check recent sales context", "Confirm real stock and supplier coverage"],
      rows,
      columns: plannerColumns,
      note: "Manual review is a conservative workflow layer, not a model retraining signal.",
    };
  }

  if (asksGenericTopSku) {
    const rows = topBy(stockoutRows, "profit_at_risk_proxy", 10);
    return {
      intent: "Top SKU operating priority",
      summary: "Here are the top SKUs to review first. I rank them by stockout exposure and profit-at-risk proxy, so the list is useful for replenishment prioritization rather than just raw forecast volume.",
      metrics: [
        { label: "Stockout SKUs", value: number(stockoutRows.length) },
        { label: "Top 10 profit at risk", value: shortMoney(rows.reduce((s, row) => s + Number(row.profit_at_risk_proxy || 0), 0)) },
        { label: "Top 10 order qty", value: number(rows.reduce((s, row) => s + Number(row.suggested_order_qty || 0), 0), 1) },
      ],
      actions: ["Review these SKUs first", "Confirm available stock", "Prioritize supplier follow-up"],
      rows,
      columns: riskColumns({ includeOrder: true }),
      note: "If you want a different definition, ask for top SKU by revenue, profit, demand, stockout risk, or overstock risk.",
    };
  }

  if (skuSummary && asksSkuContext) {
    const briefRow = skuRisk || {
      ...skuSummary,
      risk_type: "Commercial priority",
      risk_score: Math.max(0, Number(skuSummary.demand_change_pct || 0)),
      profit_at_risk_proxy: skuSummary.forecast_28d_profit,
      recommended_action: "Prioritize replenishment and confirm supplier availability",
    };
    const trend = Number(skuSummary.demand_change_pct || 0) >= 0 ? "up" : "down";
    const drivers = riskDriversFor({ ...skuSummary, ...briefRow });
    return {
      intent: asksExplain ? "SKU risk explanation" : "Single-SKU decision brief",
      summary: asksExplain
        ? `${skuInQuestion} is risky because ${drivers.filter((driver) => driver.points > 0).slice(0, 3).map((driver) => driver.label.toLowerCase()).join(", ")}. The item has ${money(skuSummary.forecast_28d_profit)} profit proxy and ${number(briefRow.suggested_order_qty || 0, 1)} suggested order quantity.`
        : `${skuInQuestion} is forecast at ${number(skuSummary.forecast_28d_qty, 1)} units over the next 28 days, ${trend} ${number(Math.abs(skuSummary.demand_change_pct || 0), 1)}% versus the last 28 days. Estimated revenue is ${money(skuSummary.forecast_28d_revenue)} with ${money(skuSummary.forecast_28d_profit)} profit proxy.`,
      metrics: [
        { label: "Last 28D actual", value: number(skuSummary.last_28d_qty, 1) },
        { label: "28D forecast", value: number(skuSummary.forecast_28d_qty, 1) },
        { label: "Suggested order", value: number(briefRow.suggested_order_qty || 0, 1) },
      ],
      actions: [
        briefRow.risk_type === "Overstock risk" ? "Review purchase slowdown" : "Validate replenishment coverage",
        "Confirm supplier availability",
        "Monitor demand change vs last 28D",
      ],
      rows: [briefRow],
      columns: riskColumns({ includeOrder: true }),
      note: "This is a recommendation brief. Purchase approval still belongs to the responsible planner or manager.",
    };
  }

  if (asksLeadTime) {
    const lead = leadTimeFromQuestion(question) || 14;
    const rows = calculateScenario(summary, lead, 7, 0)
      .filter((row) => row.risk_type === "Stockout risk")
      .sort((a, b) => Number(b.profit_at_risk_proxy || 0) - Number(a.profit_at_risk_proxy || 0))
      .slice(0, 10);
    return {
      intent: `Lead-time stress test (${lead} days)`,
      summary: `If lead time is modeled at ${lead} days, these SKUs become the priority replenishment queue because forecast coverage and assumed stock create the highest stockout exposure.`,
      metrics: [
        { label: "Lead time", value: `${lead}D` },
        { label: "Stockout-risk SKUs", value: number(rows.length) },
        { label: "Profit at risk", value: shortMoney(rows.reduce((s, row) => s + Number(row.profit_at_risk_proxy || 0), 0)) },
      ],
      actions: ["Stress-test supplier coverage", "Reserve purchase capacity for highest exposure", "Escalate SKUs with large suggested orders"],
      rows,
      columns: riskColumns({ includeOrder: true }),
      note: "Lead time is a scenario assumption in this demo, not a live supplier SLA.",
    };
  }

  if (asksOverstock) {
    const rows = topBy(overstockRows, "risk_score", 10);
    return {
      intent: "Overstock containment brief",
      summary: rows.length
        ? "These SKUs show the strongest overstock signals. The operating move is to slow purchasing, review bundles or promotions, and avoid tying cash in slow-moving inventory."
        : "No material overstock-risk SKU is currently flagged in the loaded risk table.",
      metrics: [
        { label: "Overstock SKUs", value: number(overstockRows.length) },
        { label: "Highest score", value: rows[0] ? number(rows[0].risk_score, 1) : "0.0" },
      ],
      actions: ["Slow purchase orders", "Review promotion or bundling", "Monitor demand before replenishment"],
      rows,
      columns: riskColumns(),
      note: "Overstock is calculated from forecast demand and assumed inventory, so it is a planning signal rather than a warehouse count.",
    };
  }

  if (asksProfit) {
    const rows = topBy(summary, "forecast_28d_profit", 10);
    return {
      intent: "Commercial profit priority",
      summary: "Commercial priority brief: these SKUs carry the strongest 28-day profit proxy and should be protected first when supply or logistics capacity is constrained.",
      metrics: [
        { label: "Top SKU profit", value: money(rows[0]?.forecast_28d_profit || 0) },
        { label: "Top 10 profit", value: shortMoney(rows.reduce((s, row) => s + Number(row.forecast_28d_profit || 0), 0)) },
      ],
      actions: ["Protect availability", "Review supplier coverage", "Prioritize high-margin SKUs"],
      rows,
      columns: commercialColumns,
      note: "Profit proxy is derived from the prepared dataset, not from a live accounting system.",
    };
  }

  if (asksRevenue) {
    const rows = topBy(summary, "forecast_28d_revenue", 10);
    return {
      intent: "Revenue impact priority",
      summary: "These SKUs represent the largest estimated 28-day revenue exposure. They are useful for commercial prioritization when the team needs to protect sales impact first.",
      metrics: [
        { label: "Top SKU revenue", value: money(rows[0]?.forecast_28d_revenue || 0) },
        { label: "Top 10 revenue", value: shortMoney(rows.reduce((s, row) => s + Number(row.forecast_28d_revenue || 0), 0)) },
      ],
      actions: ["Protect availability for high revenue SKUs", "Check pricing and margin before final priority", "Coordinate sales and logistics follow-up"],
      rows,
      columns: commercialColumns,
      note: "Revenue impact is forecast quantity multiplied by price proxy from the prepared data.",
    };
  }

  if (asksTrend) {
    const rows = [...summary]
      .sort((a, b) => Math.abs(Number(b.demand_change_pct || 0)) - Math.abs(Number(a.demand_change_pct || 0)))
      .slice(0, 10);
    return {
      intent: "Demand movement monitor",
      summary: "These SKUs show the largest forecast movement versus the recent 28-day actual window, so they deserve review before committing replenishment or promotion actions.",
      metrics: [
        { label: "Largest increase", value: `${number(Math.max(...summary.map((row) => Number(row.demand_change_pct || 0))), 1)}%` },
        { label: "Largest decrease", value: `${number(Math.min(...summary.map((row) => Number(row.demand_change_pct || 0))), 1)}%` },
      ],
      actions: ["Review demand drivers", "Validate abnormal movement with sales team", "Use SKU drilldown before final order decision"],
      rows,
      columns: commercialColumns,
      note: "Demand change compares the 28-day forecast against the recent 28-day actual window in the prepared demo data.",
    };
  }

  if (asksBudget || asksStockout) {
    const rows = topBy(stockoutRows, "profit_at_risk_proxy", 10);
    return {
      intent: asksBudget ? "Budget-constrained replenishment queue" : "Stockout-risk replenishment queue",
      summary: asksBudget
        ? "With limited replenishment budget or logistics capacity, prioritize these SKUs first because they combine stockout risk with the highest profit exposure."
        : "These SKUs should be reviewed first for replenishment because the risk table flags meaningful stockout exposure over the next 28 days.",
      metrics: [
        { label: "Stockout SKUs", value: number(stockoutRows.length) },
        { label: "Top 10 profit at risk", value: shortMoney(rows.reduce((s, row) => s + Number(row.profit_at_risk_proxy || 0), 0)) },
        { label: "Top 10 order qty", value: number(rows.reduce((s, row) => s + Number(row.suggested_order_qty || 0), 0), 1) },
      ],
      actions: ["Prioritize replenishment", "Confirm supplier availability", "Escalate high-exposure SKUs"],
      rows,
      columns: riskColumns({ includeOrder: true }),
      note: "Suggested order quantity is scenario-based and should be validated against real stock and supplier constraints.",
    };
  }

  const rows = topBy(stockoutRows, "profit_at_risk_proxy", 10);
  return {
    intent: "Default operating brief",
    summary: "Replenishment command brief: prioritize SKUs where forecast demand, risk score, and profit exposure point to meaningful stockout impact.",
    metrics: [
      { label: "Stockout SKUs", value: number(stockoutRows.length) },
      { label: "Overstock SKUs", value: number(overstockRows.length) },
      { label: "Managed SKUs", value: number(summary.length) },
    ],
    actions: ["Prepare replenishment review", "Confirm supplier availability", "Escalate critical SKUs"],
    rows,
    columns: riskColumns({ includeOrder: true }),
    note: "I can answer questions from the loaded forecast and SKU risk tables. For live ERP, supplier, or warehouse facts, validate outside this demo.",
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
  const scenarioSummary = React.useMemo(() => buildScenarioComparison(summary, { lead, safety, uplift }), [summary, lead, safety, uplift]);
  const baselineScenario = scenarioSummary[0];
  const stressScenario = scenarioSummary.find((item) => item.name === "Supplier Delay") || scenarioSummary[1];
  const scenarioInsight = stressScenario && baselineScenario
    ? `${stressScenario.name} creates ${number(stressScenario.stockout_count - baselineScenario.stockout_count)} additional stockout-risk SKUs and changes revenue at risk by ${money(stressScenario.revenue_at_risk - baselineScenario.revenue_at_risk)} versus baseline.`
    : "Scenario comparison is calculated from forecast demand, lead time, safety stock, and assumed inventory.";
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
      <Card title="Scenario Comparison Mode" tag="compare to baseline">
        <div className="scenarioInsight">
          <strong>{scenarioInsight}</strong>
          <span>All scenarios are decision-support assumptions and do not create purchase orders.</span>
        </div>
        <DataTable rows={scenarioSummary} limit={scenarioSummary.length} columns={[
          { key: "name", label: "Scenario" },
          { key: "lead_time", label: "Lead Time", render: (value) => `${value}D` },
          { key: "safety_stock", label: "Safety Stock", render: (value) => `${value}D` },
          { key: "demand_uplift", label: "Demand Uplift", render: (value) => `${value > 0 ? "+" : ""}${value}%` },
          { key: "stockout_count", label: "Stockout SKUs", render: (value) => number(value) },
          { key: "revenue_at_risk", label: "Revenue at Risk", render: money },
          { key: "profit_at_risk", label: "Profit at Risk", render: money },
          { key: "delta_vs_baseline", label: "Revenue Delta", render: money },
        ]} />
      </Card>
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

function summarizeScenario(summary, name, lead, safety, uplift, baselineRevenue = 0) {
  const rows = calculateScenario(summary, lead, safety, uplift);
  const stockout = rows.filter((row) => row.risk_type === "Stockout risk");
  const overstock = rows.filter((row) => row.risk_type === "Overstock risk");
  const revenue = stockout.reduce((sum, row) => sum + Number(row.revenue_at_risk_proxy || 0), 0);
  const profit = stockout.reduce((sum, row) => sum + Number(row.profit_at_risk_proxy || 0), 0);
  return {
    name,
    lead_time: lead,
    safety_stock: safety,
    demand_uplift: uplift,
    stockout_count: stockout.length,
    overstock_count: overstock.length,
    revenue_at_risk: revenue,
    profit_at_risk: profit,
    delta_vs_baseline: revenue - baselineRevenue,
  };
}

function buildScenarioComparison(summary, custom) {
  const baseline = summarizeScenario(summary, "Baseline", 7, 7, 0, 0);
  const baselineRevenue = baseline.revenue_at_risk;
  return [
    { ...baseline, delta_vs_baseline: 0 },
    summarizeScenario(summary, "Supplier Delay", 14, 7, 0, baselineRevenue),
    summarizeScenario(summary, "Peak Demand", 14, 7, 20, baselineRevenue),
    summarizeScenario(summary, "Conservative Stock", 10, 14, 10, baselineRevenue),
    summarizeScenario(summary, "Current Custom", custom.lead, custom.safety, custom.uplift, baselineRevenue),
  ];
}

function FloatingCopilot({ data, setActive }) {
  const { summary, risk } = data;
  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [submitted, setSubmitted] = React.useState("");
  const [selectedSku, setSelectedSku] = React.useState(sessionStorage.getItem("selectedSku") || "");
  const answer = React.useMemo(() => buildAgentAnswer(submitted, summary, risk, selectedSku), [submitted, summary, risk, selectedSku]);
  const contextRow = summary.find((row) => row.sku_id === selectedSku);

  React.useEffect(() => {
    const syncSku = (event) => setSelectedSku(String(event.detail || sessionStorage.getItem("selectedSku") || ""));
    window.addEventListener("sku-search", syncSku);
    window.addEventListener("storage", syncSku);
    return () => {
      window.removeEventListener("sku-search", syncSku);
      window.removeEventListener("storage", syncSku);
    };
  }, []);

  const run = () => {
    const cleaned = question.trim();
    if (cleaned) setSubmitted(cleaned);
  };

  const runQuickAction = (target) => {
    const firstSku = answer?.rows?.find((row) => row.sku_id)?.sku_id || selectedSku;
    if (target === "detail" && firstSku) {
      setOpen(false);
      goToSkuDetail(firstSku);
      return;
    }
    setOpen(false);
    setActive(target);
  };

  const openWorkspace = () => {
    setOpen(false);
    setActive("agent");
  };

  return (
    <div className={`floatingCopilot ${open ? "open" : ""}`}>
      {open ? (
        <div className="copilotPanel">
          <div className="copilotPanelHeader">
            <div className="copilotAvatar"><Bot size={22} /></div>
            <div>
              <span>AI Decision Copilot</span>
              <strong>{contextRow ? `Context: ${selectedSku}` : "Ask from forecast and risk tables"}</strong>
            </div>
            <button type="button" className="iconButton" onClick={() => setOpen(false)} aria-label="Close AI copilot"><X size={18} /></button>
          </div>
          <div className="copilotMessages">
            {!submitted ? (
              <div className="copilotEmpty">
                <Bot size={38} />
                <strong>Ready for an operating brief</strong>
                <p>Ask about replenishment, stockout risk, profit priority, demand trend, lead time, or a selected SKU.</p>
              </div>
            ) : (
              <>
                <div className="miniQuestion">{submitted}</div>
                <div className="miniAnswer">
                  <span>{answer.intent || "Decision brief"}</span>
                  <strong>{answer.summary}</strong>
                  {answer.metrics?.length ? (
                    <div className="miniMetricRow">
                      {answer.metrics.slice(0, 3).map((item) => <ScopeMetric key={item.label} label={item.label} value={item.value} />)}
                    </div>
                  ) : null}
                  <div className="miniActions">
                    {answer.actions.slice(0, 3).map((item) => <em key={item}>{item}</em>)}
                  </div>
                  <div className="aiQuickActions">
                    <button type="button" onClick={() => runQuickAction("detail")}>Open SKU Detail</button>
                    <button type="button" onClick={() => runQuickAction("planner")}>Open Planner</button>
                    <button type="button" onClick={() => runQuickAction("risk")}>View Risk Queue</button>
                    <button type="button" onClick={() => runQuickAction("scenario")}>Run Scenario</button>
                  </div>
                  <DataTable rows={answer.rows} limit={5} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={answer.columns} />
                  {answer.note ? <p className="agentNote">{answer.note}</p> : null}
                </div>
              </>
            )}
          </div>
          <div className="copilotInputRow">
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") run(); }}
              placeholder={contextRow ? `Ask what to do for ${selectedSku}...` : "Ask about SKUs, stockout, profit, lead time..."}
            />
            <button type="button" onClick={run} aria-label="Run AI analysis"><SendHorizontal size={18} /></button>
          </div>
          <button type="button" className="workspaceLink" onClick={openWorkspace}>Open full AI workspace</button>
        </div>
      ) : null}
      <button type="button" className="copilotLauncher" onClick={() => setOpen((value) => !value)} aria-label="Open AI decision copilot">
        <Bot size={30} />
        <span>AI</span>
      </button>
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

  React.useEffect(() => {
    const onHashChange = () => {
      const key = window.location.hash.replace("#", "");
      if (pages.some((page) => page.key === key)) {
        setActiveState(key);
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

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
    planner: <ReplenishmentPlanner data={data} />,
    detail: <ForecastDetail data={data} />,
    agent: <Agent data={data} />,
    scenario: <Scenario data={data} />,
  }[active];

  return (
    <div className="appShell">
      <Sidebar active={active} setActive={setActive} summary={data.summary} risk={data.risk} forecast={data.forecast} />
      <main>{page}</main>
      <FloatingCopilot data={data} setActive={setActive} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
