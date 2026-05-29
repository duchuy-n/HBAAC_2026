import React from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  ClipboardList,
  DollarSign,
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

const SkuSearchContext = React.createContext([]);

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
  if (!response.ok) throw new Error(`Không tải được ${path}`);
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
  { key: "risk", label: "SKU Risk Monitor", icon: ShieldCheck },
  { key: "planner", label: "Planner nhập hàng", icon: ClipboardList },
  { key: "detail", label: "Chi tiết Forecast", icon: LineChart },
  { key: "rescue", label: "Rescue Room", icon: AlertTriangle },
  { key: "agent", label: "AI Agent", icon: Bot },
  { key: "scenario", label: "Scenario Simulator", icon: Settings2 },
];

const riskLabel = {
  "Stockout risk": "Rủi ro stockout",
  "Overstock risk": "Rủi ro overstock",
  Healthy: "Bình thường",
  "Commercial priority": "Ưu tiên thương mại",
};

const actionLabel = {
  "Prioritize replenishment and confirm supplier availability":
    "Ưu tiên nhập hàng và xác nhận khả năng đáp ứng của supplier",
  "Review replenishment need; margin data is limited": "Rà soát nhu cầu nhập hàng; dữ liệu margin còn hạn chế",
  "Slow purchase orders and consider promotion/bundling": "Giảm tốc PO và cân nhắc promotion/bundling",
  Monitor: "Theo dõi",
};

const severityLabel = {
  Critical: "Rất gấp",
  High: "Cao",
  Watchlist: "Theo dõi",
  Overstock: "Overstock",
};

const urgencyLabel = {
  High: "Cao",
  Medium: "Trung bình",
  Low: "Thấp",
};

const statusLabel = {
  Open: "Mở",
  "In Review": "Đang review",
  Approved: "Đã duyệt",
  Deferred: "Tạm hoãn",
  Resolved: "Đã xử lý",
};

const ownerLabel = {
  "Inventory Lead": "Inventory Lead",
  "Sales Ops": "Sales Ops",
};

const scenarioNameLabel = {
  Baseline: "Baseline",
  "Supplier Delay": "Supplier Delay",
  "Peak Demand": "Peak Demand",
  "Conservative Stock": "Conservative Stock",
  "Current Custom": "Tuỳ chỉnh hiện tại",
  Custom: "Tuỳ chỉnh",
};

const AI_THINKING_DELAY_MS = 1500;

function goToSkuDetail(skuId) {
  if (!skuId) return;
  const sku = String(skuId).trim().toUpperCase();
  sessionStorage.setItem("selectedSku", sku);
  window.dispatchEvent(new CustomEvent("sku-search", { detail: sku }));
  window.location.hash = "detail";
}

function goToRescue(skuId) {
  if (!skuId) return;
  const sku = String(skuId).trim().toUpperCase();
  sessionStorage.setItem("selectedSku", sku);
  window.dispatchEvent(new CustomEvent("sku-search", { detail: sku }));
  window.location.hash = "rescue";
}

function goToPage(key) {
  if (!key) return;
  window.location.hash = key;
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
  const profit = Number(row.profit_at_risk_proxy || 0);
  if (severity === "Critical" || order >= 100 || profit >= 1_500_000) return "High";
  if (severity === "High" || order >= 25 || profit >= 500_000) return "Medium";
  return row.risk_type === "Overstock risk" ? "Medium" : "Low";
}

function expectedStockoutDate(row, baseDate = "2026-10-03") {
  if (row.risk_type !== "Stockout risk") return "Không dự báo";
  const daily = Number(row.forecast_daily_avg || row.forecast_28d_qty / 28 || 0);
  const stock = Number(row.current_stock_assumed || 0);
  if (daily <= 0) return "Không dự báo";
  const days = Math.max(1, Math.ceil(stock / daily));
  const date = new Date(`${baseDate}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

function plannerReason(row) {
  if (row.risk_type === "Overstock risk") return "Tồn kho giả định cao hơn Forecast demand; nên giảm tốc PO và xem xét promotion/bundling.";
  if (Number(row.current_stock_assumed || 0) < Number(row.reorder_point || 0)) return "Tồn kho giả định thấp hơn reorder point trong khi Forecast demand vẫn đáng kể.";
  if (Number(row.suggested_order_qty || 0) > 0) return "Forecast coverage cho thấy có gap nhập hàng trong 28 ngày tới.";
  return "Theo dõi biến động Forecast và xác thực tồn kho thật trước khi hành động.";
}

function leadTimeImpact(row) {
  if (row.risk_type === "Overstock risk") return "Khuyến nghị giảm tốc PO";
  const stockout = expectedStockoutDate(row);
  if (stockout === "Không dự báo") return "Chưa dự báo thiếu hàng ngay";
  const lead = Number(row.lead_time_days || 7);
  return lead >= 14 ? "Supplier delay có thể vượt coverage window" : "Nhập hàng vẫn có thể bảo vệ coverage";
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
        due_date: urgencyFor(merged) === "High" ? "48h tới" : urgencyFor(merged) === "Medium" ? "Tuần này" : "Theo dõi",
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
      label: "Tồn kho dưới reorder point",
      value: stockGap,
      points: Math.min(35, stockGap > 0 ? 15 + stockGap / Math.max(Number(row.reorder_point || 1), 1) * 20 : 0),
      detail: stockGap > 0 ? `Gap ${number(stockGap, 1)} units` : "Không có reorder gap",
      tone: "red",
    },
    {
      label: "Forecast demand tăng tốc",
      value: demandChange,
      points: Math.min(25, demandChange / 2),
      detail: `${number(row.demand_change_pct || 0, 1)}% so với 28D gần nhất`,
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
      label: "Quy mô nhập hàng đề xuất",
      value: orderQty,
      points: Math.min(15, orderQty / 10),
      detail: `${number(orderQty, 1)} units`,
      tone: "cyan",
    },
  ];
  return drivers.map((driver) => ({ ...driver, points: Math.max(0, Math.round(driver.points)) }));
}

function skuSeed(skuId) {
  return String(skuId || "").split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function rescueRowForSku(summary, risk, skuId) {
  const summaryRow = summary.find((row) => row.sku_id === skuId) || summary[0];
  const riskRow = risk.find((row) => row.sku_id === skuId) || summaryRow;
  return { ...summaryRow, ...riskRow };
}

function buildRescuePlan(row, summary) {
  const seed = skuSeed(row.sku_id);
  const warehouses = ["Hanoi", "Da Nang", "Hai Phong", "HCMC"];
  const suppliers = ["Supplier A", "Supplier B", "Supplier C"];
  const bundles = ["Brake replacement", "Suspension repair", "Oil service", "Transmission service", "Cooling system repair"];
  const models = ["Toyota Vios", "Ford Ranger", "Hyundai Accent", "Kia K3", "Mazda CX-5", "Honda City", "Mitsubishi Xpander"];
  const cyclePick = (items, start, count) => Array.from({ length: count }, (_, index) => items[(start + index) % items.length]);
  const unitPrice = Number(row.unit_price_proxy || row.forecast_28d_revenue / Math.max(row.forecast_28d_qty, 1) || 0);
  const unitCost = Number(row.unit_cost_proxy || unitPrice * 0.62 || 0);
  const forecastDemand = Number(row.forecast_28d_qty || 0);
  const assumedStock = Number(row.current_stock_assumed || 0);
  const reorderGap = Math.max(Number(row.reorder_point || 0) - assumedStock, 0);
  const statedRevenueRisk = Number(row.revenue_at_risk_proxy || 0);
  const statedShortageUnits = unitPrice > 0 && statedRevenueRisk > 0 ? statedRevenueRisk / unitPrice : 0;
  const unfulfilled = statedShortageUnits || Math.max(reorderGap, Number(row.suggested_order_qty || 0) * 0.35, forecastDemand - assumedStock);
  const directRevenue = statedRevenueRisk || unfulfilled * unitPrice;
  const bundleMultiplier = 1.55 + (seed % 45) / 100;
  const affectedBundles = 2 + (seed % 3);
  const affectedModels = 3 + (seed % 4);
  const candidates = summary
    .filter((item) => item.sku_id !== row.sku_id)
    .sort((a, b) => Math.abs(skuSeed(a.sku_id) - seed) - Math.abs(skuSeed(b.sku_id) - seed))
    .slice(0, 3);
  const substitutes = candidates.map((item, index) => {
    const compatibility = Math.max(72, 96 - index * 8 - (seed % 5));
    const availableStock = Math.max(12, Math.round(Number(item.current_stock_assumed || item.forecast_28d_qty * 0.4 || 0) + 12 + (seed % 17)));
    const recoveredUnits = Math.min(availableStock, Math.round(unfulfilled * (compatibility / 100)));
    return {
      sku_id: item.sku_id,
      compatibility,
      available_stock: availableStock,
      revenue_recovered: recoveredUnits * unitPrice,
      risk: compatibility >= 90 ? "Thấp" : compatibility >= 82 ? "Trung bình" : "Cao",
    };
  });
  const transfers = [0, 1].map((index) => {
    const from = warehouses[(seed + index) % warehouses.length];
    const to = warehouses[(seed + 2) % warehouses.length];
    const transferQty = Math.max(8, Math.round(Math.min(unfulfilled, 18 + (seed % 23) + index * 9)));
    return {
      from,
      to: from === to ? warehouses[(seed + 3) % warehouses.length] : to,
      transfer_qty: transferQty,
      revenue_protected: transferQty * unitPrice,
      overstock_reduced: index === 0 ? "Có" : seed % 2 === 0 ? "Có" : "Không",
    };
  });
  const supplier = {
    supplier: suppliers[seed % suppliers.length],
    scenario_skus: 8 + (seed % 9),
    requested_lead_time: `${Number(row.lead_time_days || 14)}d -> 7d`,
    revenue_at_risk: directRevenue,
    expedite_qty: Math.max(10, Math.round(Number(row.suggested_order_qty || unfulfilled || 0))),
  };
  const rescueActions = [
    {
      rank: 1,
      sku_id: row.sku_id,
      action: "Branch transfer",
      cost: transfers[0].transfer_qty * Math.max(50000, unitCost * 0.06),
      revenue_protected: transfers[0].revenue_protected,
      decision_score: 94,
    },
    {
      rank: 2,
      sku_id: substitutes[0]?.sku_id || row.sku_id,
      action: "Substitute part",
      cost: 0,
      revenue_protected: substitutes[0]?.revenue_recovered || 0,
      decision_score: 91,
    },
    {
      rank: 3,
      sku_id: row.sku_id,
      action: "Expedite supplier",
      cost: supplier.expedite_qty * unitCost * 0.18,
      revenue_protected: Math.min(directRevenue, supplier.expedite_qty * unitPrice),
      decision_score: 88,
    },
    {
      rank: 4,
      sku_id: row.sku_id,
      action: "Partial reorder",
      cost: Math.max(0, Number(row.suggested_order_qty || 0)) * unitCost,
      revenue_protected: Math.min(directRevenue, Math.max(0, Number(row.suggested_order_qty || 0)) * unitPrice),
      decision_score: 82,
    },
  ].map((action) => ({
    ...action,
    roi: action.cost > 0 ? action.revenue_protected / action.cost : 99,
  }));
  return {
    impact: {
      forecastDemand,
      assumedStock,
      unfulfilled,
      directRevenue,
      bundleRevenue: directRevenue * bundleMultiplier,
      affectedBundles,
      affectedModels,
      severity: severityFor(row),
      serviceBundles: cyclePick(bundles, seed % bundles.length, affectedBundles),
      vehicleModels: cyclePick(models, seed % models.length, affectedModels),
    },
    substitutes,
    transfers,
    supplier,
    rescueActions,
  };
}

function rescueBriefText(row, plan, selectedActions) {
  const topActions = selectedActions.length ? selectedActions : plan.rescueActions.slice(0, 3);
  return [
    `Kế hoạch Rescue stockout: ${row.sku_id}`,
    "",
    `Kết luận: ${row.sku_id} đang ở mức ưu tiên rescue stockout ${severityLabel[plan.impact.severity] || plan.impact.severity}.`,
    `Bằng chứng: forecast demand ${number(plan.impact.forecastDemand, 1)} units, tồn kho giả định ${number(plan.impact.assumedStock, 1)} units, nhu cầu chưa đáp ứng ${number(plan.impact.unfulfilled, 1)} units.`,
    `Tác động kinh doanh: direct revenue at risk ${money(plan.impact.directRevenue)}, bundle revenue at risk ${money(plan.impact.bundleRevenue)}, ${plan.impact.affectedBundles} service bundles và ${plan.impact.affectedModels} vehicle models bị ảnh hưởng.`,
    "",
    "Hành động rescue khuyến nghị:",
    ...topActions.map((action, index) => `${index + 1}. ${action.action} | Chi phí ${money(action.cost)} | Revenue protected ${money(action.revenue_protected)} | Score ${number(action.decision_score)}`),
    "",
    `Hành động với supplier: đề nghị ${plan.supplier.supplier} nén lead time xuống ${plan.supplier.requested_lead_time} cho ${number(plan.supplier.expedite_qty)} units trên ${number(plan.supplier.scenario_skus)} SKU liên quan trong scenario.`,
    "Guardrail: compatibility thay thế, tồn kho kho và supplier lead time là giả định demo. Cần xác thực trước khi triển khai.",
  ].join("\n");
}

function briefText({ title, rows, metrics = [] }) {
  const lines = [
    title,
    "",
    ...metrics.map((item) => `${item.label}: ${item.value}`),
    "",
    "Hành động ưu tiên:",
    ...rows.slice(0, 8).map((row, index) => `${index + 1}. ${row.sku_id} | ${severityLabel[severityFor(row)] || severityFor(row)} | ${riskLabel[row.risk_type] || row.risk_type || "Ưu tiên"} | Profit at risk ${money(row.profit_at_risk_proxy || row.forecast_28d_profit || 0)} | ${actionLabel[row.recommended_action] || row.recommended_action || "Theo dõi và review kế hoạch nhập hàng"}`),
    "",
    "Decision note: Forecast là model output; inventory, lead time, stockout và overstock là giả định scenario để hỗ trợ quyết định.",
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
      <p className="brandCopy">Điều hành inventory bằng Forecast cho đội sales, logistics và planning.</p>
      <div className="sideStats">
        <div><span>Chu kỳ</span><strong>28D</strong></div>
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
        <div className="scopeTitle">Phạm vi dữ liệu</div>
        <ScopeMetric label="Dòng Forecast 56 ngày" value={forecast.length} />
        <ScopeMetric label="SKU trong workspace" value={summary.length} />
        <ScopeMetric label="SKU có cảnh báo" value={risk.length} />
        <p>Inventory, lead time và cảnh báo stockout/overstock là giả định scenario, không phải dữ liệu ERP/WMS live.</p>
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
  const [searchError, setSearchError] = React.useState("");
  const skuIds = React.useContext(SkuSearchContext);
  const skuSet = React.useMemo(() => new Set(skuIds), [skuIds]);
  const submitSearch = (event) => {
    event.preventDefault();
    const value = query.trim().toUpperCase();
    if (!value) return;
    if (skuSet.size && !skuSet.has(value)) {
      setSearchError(`${value} không có trong Forecast workspace.`);
      return;
    }
    setSearchError("");
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
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (searchError) setSearchError("");
              }}
              placeholder="Tìm SKU, sản phẩm, kho..."
              aria-label="Tìm SKU"
              aria-describedby={searchError ? "sku-search-error" : undefined}
            />
          </form>
          <div className="headerFilter">28D · Tất cả kênh · Tất cả kho</div>
          <button type="button" className="iconButton" aria-label="Trung tâm thông báo"><Bell size={18} /></button>
        </div>
        {searchError ? <div id="sku-search-error" className="searchError">{searchError}</div> : null}
      </div>
      <div className="headerPills">
        <span>Forecast output</span>
        <span>Giả định inventory mô phỏng</span>
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
      <div className="miniTrend"><span /> tín hiệu vận hành</div>
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

function ForecastChart({ series, yLabel = "Số lượng/ngày", height = 320, showArea = false }) {
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
      <svg className="forecastChart" style={{ height: `${height}px` }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${yLabel} chart`}>
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
    <div className="tableWrap" tabIndex="0" aria-label="Scrollable data table">
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
              onKeyDown={(event) => {
                if (!onRowClick) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onRowClick(row);
                }
              }}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
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
  return <span className={`severityBadge ${cls}`}>{severityLabel[severity] || severity}</span>;
}

function DecisionBrief({ title, rows, metrics, filename = "decision-brief.txt" }) {
  const text = briefText({ title, rows, metrics });
  return (
    <div className="decisionBrief">
      <div>
        <span>Brief điều hành</span>
        <strong>{title}</strong>
        <p>Tạo brief vận hành ngắn gọn cho nhập hàng, review risk và follow-up thương mại.</p>
      </div>
      <button type="button" className="primaryButton" onClick={() => downloadText(filename, text)}>Tải brief</button>
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
  const topRisk = actionQueue[0];
  const revenueAtRisk = stockout.reduce((s, row) => s + Number(row.revenue_at_risk_proxy || 0), 0);
  const profitAtRisk = stockout.reduce((s, row) => s + Number(row.profit_at_risk_proxy || 0), 0);

  return (
    <>
      <TopHeader pageTitle="Trung tâm điều hành Forecast tồn kho" subtitle="Theo dõi Forecast bán hàng, risk inventory và hành động ưu tiên." />
      <section className="commandBrief">
        <div className="commandSignal">
          <span>Trung tâm điều hành</span>
          <h2>{topRisk?.sku_id || "SKU queue"} cần quyết định vận hành tiếp theo</h2>
          <p>
            Bảo vệ {money(topRisk?.revenue_at_risk_proxy || revenueAtRisk)} revenue exposure ngay, sau đó dùng scenario stress test
            và AI brief để biến risk queue thành action plan sẵn sàng trình quản lý.
          </p>
        </div>
        <div className="commandMetrics">
          <ScopeMetric label="Revenue exposure" value={money(revenueAtRisk)} />
          <ScopeMetric label="Profit exposure" value={money(profitAtRisk)} />
          <ScopeMetric label="Hành động top" value={topRisk ? number(topRisk.suggested_order_qty, 1) : "0"} />
        </div>
        <div className="commandActions">
          <button type="button" onClick={() => goToPage("risk")}>Mở risk queue</button>
          <button type="button" onClick={() => goToPage("scenario")}>Stress-test delay</button>
          <button type="button" onClick={() => goToRescue(topRisk?.sku_id)}>Rescue SKU top</button>
          <button type="button" onClick={() => goToPage("agent")}>Tạo AI brief</button>
        </div>
      </section>
      <div className="kpiGrid six">
        <KpiCard icon={Boxes} label="SKU quản lý" value={number(summary.length)} sub="Catalog đang hoạt động" tone="teal" />
        <KpiCard icon={TrendingUp} label="Demand 28 ngày tới" value={number(summary.reduce((s, r) => s + r.forecast_28d_qty, 0))} sub="Forecast batch" tone="cyan" />
        <KpiCard icon={DollarSign} label="Revenue ước tính" value={shortMoney(summary.reduce((s, r) => s + r.forecast_28d_revenue, 0))} sub="Forecast x price" tone="green" />
        <KpiCard icon={BarChart3} label="Profit Proxy" value={shortMoney(summary.reduce((s, r) => s + r.forecast_28d_profit, 0))} sub="Margin proxy" tone="green" />
        <KpiCard icon={AlertTriangle} label="Stockout Risk" value={number(stockout.length)} sub="Action queue" tone="red" />
        <KpiCard icon={PackageSearch} label="Overstock Risk" value={number(overstock.length)} sub="Điều hành inventory" tone="amber" />
      </div>
      <Card title="Action Queue ưu tiên" tag="value at risk cao nhất" className="priorityHeroCard">
        <DecisionBrief
          title="Ưu tiên nhập hàng 28 ngày"
          rows={actionQueue}
          filename="autoparts-priority-brief.txt"
          metrics={[
            { label: "SKU stockout-risk", value: number(stockout.length) },
            { label: "SKU overstock-risk", value: number(overstock.length) },
            { label: "Forecast revenue", value: money(summary.reduce((s, r) => s + r.forecast_28d_revenue, 0)) },
          ]}
        />
        <DataTable rows={actionQueue} limit={8} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "severity", label: "Mức độ", render: (_, row) => <SeverityBadge row={row} /> },
          { key: "risk_type", label: "Loại risk", render: (v) => <RiskBadge type={v} /> },
          { key: "revenue_at_risk_proxy", label: "Revenue at Risk", render: money },
          { key: "profit_at_risk_proxy", label: "Profit at Risk", render: money },
          { key: "suggested_order_qty", label: "Order đề xuất", render: (v) => number(v, 1) },
          { key: "recommended_action", label: "Hành động khuyến nghị", render: (v) => actionLabel[v] || v },
        ]} />
      </Card>
      <div className="grid twoOne">
        <Card title="Tổng quan Demand Forecast" tag="28 ngày tới">
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
        <Card title="Trạng thái Inventory" tag="alert mix">
          <DonutChart stockout={stockout.length} overstock={overstock.length} />
        </Card>
      </div>
      <div className="grid two">
        <Card title="Top SKU theo Profit Proxy" tag="ưu tiên thương mại">
          <DataTable rows={topProfit} limit={7} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
            { key: "sku_id", label: "SKU" },
            { key: "forecast_28d_qty", label: "Demand 28D", render: (v) => number(v, 1) },
            { key: "forecast_28d_revenue", label: "Revenue", render: money },
            { key: "forecast_28d_profit", label: "Profit Proxy", render: money },
          ]} />
        </Card>
        <Card title="Cơ cấu cảnh báo" tag="stockout vs overstock">
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
      <MixRow label="Rủi ro stockout" value={stockout} color="#EF4444" total={total} />
      <MixRow label="Rủi ro overstock" value={overstock} color="#F59E0B" total={total} />
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
      <TopHeader pageTitle="SKU Risk Monitor" subtitle="Xếp hạng SKU theo mức phơi nhiễm stockout/overstock dựa trên Forecast output và giả định inventory." />
      <Card title="Bộ lọc Risk Queue" tag="priority queue">
        <div className="filterRow">
          <label>Nhóm cảnh báo<select value={group} onChange={(e) => setGroup(e.target.value)}><option value="All">Tất cả</option><option value="Stockout risk">Stockout risk</option><option value="Overstock risk">Overstock risk</option></select></label>
          <label>Số SKU hiển thị<input type="range" min="5" max="100" step="5" value={topN} onChange={(e) => setTopN(Number(e.target.value))} /><span>{topN}</span></label>
          <label>Sắp xếp theo<select value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="profit_at_risk_proxy">Profit at risk</option><option value="revenue_at_risk_proxy">Revenue at risk</option><option value="risk_score">Risk score</option></select></label>
          <label>Tìm SKU<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="SKU-00003" /></label>
        </div>
      </Card>
      <div className="kpiGrid four">
        <KpiCard icon={Boxes} label="SKU trong list" value={number(filtered.length)} sub="Theo bộ lọc hiện tại" />
        <KpiCard icon={DollarSign} label="Revenue at risk" value={money(revenue)} sub="Danh sách đang xem" tone="red" />
        <KpiCard icon={BarChart3} label="Profit proxy at risk" value={money(profit)} sub="Danh sách đang xem" tone="amber" />
        <KpiCard icon={Gauge} label="Risk score TB" value={number(avgRisk, 1)} sub="Thang 0-100" tone="teal" />
      </div>
      <Card title="Bảng Risk">
        <DataTable rows={filtered} limit={filtered.length} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "severity", label: "Mức độ", render: (_, row) => <SeverityBadge row={row} /> },
          { key: "risk_type", label: "Nhóm cảnh báo", render: (v) => <RiskBadge type={v} /> },
          { key: "risk_score", label: "Risk Score", render: (v) => <RiskScore value={v} /> },
          { key: "forecast_28d_qty", label: "Demand 28D", render: (v) => number(v, 1) },
          { key: "current_stock_assumed", label: "Tồn giả định", render: (v) => number(v, 1) },
          { key: "reorder_point", label: "Reorder Point", render: (v) => number(v, 1) },
          { key: "revenue_at_risk_proxy", label: "Revenue at Risk", render: money },
          { key: "profit_at_risk_proxy", label: "Profit Proxy at Risk", render: money },
          { key: "recommended_action", label: "Khuyến nghị", render: (v) => actionLabel[v] || v },
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
      <TopHeader pageTitle="Planner hành động nhập hàng" subtitle="Chuyển tín hiệu Forecast risk thành kế hoạch vận hành cho nhập hàng, review và điều hành inventory." />
      <div className="kpiGrid four">
        <KpiCard icon={ClipboardList} label="Action items" value={number(rows.length)} sub="Plan đang xem" />
        <KpiCard icon={AlertTriangle} label="Ưu tiên cao" value={number(high.length)} sub="Cần review nhanh" tone="red" />
        <KpiCard icon={Boxes} label="Order qty đề xuất" value={number(suggestedQty, 1)} sub="Dựa trên scenario" tone="cyan" />
        <KpiCard icon={DollarSign} label="Profit protected" value={shortMoney(protectedProfit)} sub="Proxy impact" tone="green" />
      </div>
      <Card title="Điều khiển Planner" tag="workflow filters">
        <div className="filterRow twoCols">
          <label>Độ ưu tiên<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="All">Tất cả</option><option value="High">Cao</option><option value="Medium">Trung bình</option><option value="Low">Thấp</option></select></label>
          <label>Owner<select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="All">Tất cả</option><option>Inventory Lead</option><option>Sales Ops</option></select></label>
        </div>
      </Card>
      <Card title="Kế hoạch hành động nhập hàng" tag="duyệt, hoãn hoặc review">
        <DataTable rows={rows} limit={rows.length} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "urgency", label: "Ưu tiên", render: (value) => <span className={`urgencyBadge ${String(value).toLowerCase()}`}>{urgencyLabel[value] || value}</span> },
          { key: "risk_type", label: "Cảnh báo", render: (value) => <RiskBadge type={value} /> },
          { key: "suggested_order_qty", label: "Order đề xuất", render: (value) => number(value, 1) },
          { key: "expected_stockout_date", label: "Stockout dự kiến", render: (value) => value },
          { key: "lead_time_impact", label: "Lead time impact" },
          { key: "business_impact", label: "Profit protected", render: money },
          { key: "owner", label: "Owner" },
          { key: "due_date", label: "Due" },
          { key: "status", label: "Trạng thái", render: (value, row) => (
            <select className="statusSelect" value={value} onClick={(event) => event.stopPropagation()} onChange={(event) => setStatus(row.sku_id, event.target.value)}>
              {Object.entries(statusLabel).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
            </select>
          ) },
          { key: "rescue", label: "Rescue", render: (_, row) => row.risk_type === "Stockout risk"
            ? <button type="button" className="tableActionButton" onClick={(event) => { event.stopPropagation(); goToRescue(row.sku_id); }}>Rescue</button>
            : <span className="mutedCell">Chưa cần</span> },
          { key: "reason", label: "Lý do" },
        ]} />
      </Card>
    </>
  );
}

function StockoutRescueRoom({ data }) {
  const { summary, risk } = data;
  const rescueCandidates = React.useMemo(() => buildPlannerRows(summary, risk, 80).filter((row) => row.risk_type === "Stockout risk"), [summary, risk]);
  const savedSku = sessionStorage.getItem("selectedSku");
  const defaultSku = rescueCandidates.some((row) => row.sku_id === savedSku) ? savedSku : rescueCandidates[0]?.sku_id || summary[0]?.sku_id;
  const [sku, setSku] = React.useState(defaultSku);
  const [budget, setBudget] = React.useState(50_000_000);
  const [approved, setApproved] = React.useState(false);
  const row = rescueRowForSku(summary, risk, sku);
  const plan = React.useMemo(() => buildRescuePlan(row, summary), [row, summary]);
  const selectedActions = [];
  let spent = 0;
  [...plan.rescueActions].sort((a, b) => b.decision_score - a.decision_score).forEach((action) => {
    if (action.cost === 0 || spent + action.cost <= budget) {
      selectedActions.push(action);
      spent += action.cost;
    }
  });
  const protectedRevenue = Math.min(plan.impact.directRevenue, selectedActions.reduce((sum, action) => sum + Number(action.revenue_protected || 0), 0));

  const selectSku = (nextSku) => {
    const normalized = String(nextSku || "").trim().toUpperCase();
    setSku(normalized);
    sessionStorage.setItem("selectedSku", normalized);
    window.dispatchEvent(new CustomEvent("sku-search", { detail: normalized }));
  };

  const brief = rescueBriefText(row, plan, selectedActions);
  const supplierEmail = [
    `Subject: Yêu cầu expedite cho ${row.sku_id}`,
    "",
    `Chào ${plan.supplier.supplier},`,
    "",
    `Chúng tôi đang review kế hoạch rescue stockout cho ${row.sku_id}. Vui lòng xác nhận có thể expedite ${number(plan.supplier.expedite_qty)} units theo lead time yêu cầu ${plan.supplier.requested_lead_time} hay không.`,
    "",
    `Scenario impact hiện tại: ${money(plan.impact.directRevenue)} direct revenue at risk và ${money(plan.impact.bundleRevenue)} bundle revenue at risk.`,
    "",
    "Vui lòng xác nhận availability, ngày ship sớm nhất và expedite premium nếu có.",
  ].join("\n");

  return (
    <>
      <TopHeader pageTitle="Stockout Rescue Room" subtitle="Biến tín hiệu SKU risk nghiêm trọng thành kế hoạch rescue: substitute, transfer, expedite và ưu tiên theo budget." />
      <Card title="Mục tiêu Rescue" tag="critical SKU">
        <div className="filterRow twoCols">
          <label>SKU cần rescue<select value={sku} onChange={(event) => selectSku(event.target.value)}>{rescueCandidates.map((item) => <option key={item.sku_id}>{item.sku_id}</option>)}</select></label>
          <label>Budget rescue khả dụng (VND)<input value={budget} onChange={(event) => setBudget(Number(event.target.value || 0))} /></label>
        </div>
      </Card>
      <div className="kpiGrid four">
        <KpiCard icon={AlertTriangle} label="Mức độ" value={severityLabel[plan.impact.severity] || plan.impact.severity} sub="Ưu tiên rescue" tone="red" />
        <KpiCard icon={Boxes} label="Unfulfilled demand" value={number(plan.impact.unfulfilled, 1)} sub="Scenario units" tone="amber" />
        <KpiCard icon={DollarSign} label="Direct Revenue Risk" value={money(plan.impact.directRevenue)} sub="Risk cấp SKU" tone="green" />
        <KpiCard icon={BarChart3} label="Bundle Revenue Risk" value={money(plan.impact.bundleRevenue)} sub="Service impact" tone="red" />
      </div>
      <Card title="Impact: điều gì bị ảnh hưởng nếu SKU này stockout?" tag="service bundle risk">
        <div className="rescueImpactGrid">
          <ImpactTile label="Forecast demand" value={number(plan.impact.forecastDemand, 1)} />
          <ImpactTile label="Tồn giả định" value={number(plan.impact.assumedStock, 1)} />
          <ImpactTile label="Bundle bị ảnh hưởng" value={number(plan.impact.affectedBundles)} detail={plan.impact.serviceBundles.join(", ")} />
          <ImpactTile label="Dòng xe bị ảnh hưởng" value={number(plan.impact.affectedModels)} detail={plan.impact.vehicleModels.join(", ")} />
        </div>
        <p className="agentNote">Bundle và vehicle impact là giả định scenario sinh từ SKU ID để kể câu chuyện demo. Cần đối chiếu catalog compatibility thật trước khi triển khai.</p>
      </Card>
      <div className="grid three">
        <RescueOptionCard title="Option A - Substitute Part" tag="compatibility match">
          <DataTable rows={plan.substitutes} limit={3} columns={[
            { key: "sku_id", label: "Substitute SKU" },
            { key: "compatibility", label: "Compatibility", render: (value) => `${number(value)}%` },
            { key: "available_stock", label: "Stock khả dụng", render: (value) => number(value, 1) },
            { key: "revenue_recovered", label: "Revenue recover", render: money },
            { key: "risk", label: "Risk" },
          ]} />
        </RescueOptionCard>
        <RescueOptionCard title="Option B - Branch Transfer" tag="rebalance stock">
          <DataTable rows={plan.transfers} limit={2} columns={[
            { key: "from", label: "Từ" },
            { key: "to", label: "Đến" },
            { key: "transfer_qty", label: "Transfer Qty", render: (value) => number(value, 1) },
            { key: "revenue_protected", label: "Revenue protected", render: money },
            { key: "overstock_reduced", label: "Giảm overstock" },
          ]} />
        </RescueOptionCard>
        <RescueOptionCard title="Option C - Expedite Supplier" tag="lead-time compression">
          <div className="supplierRescue">
            <span>Supplier</span><strong>{plan.supplier.supplier}</strong>
            <span>SKU liên quan trong scenario</span><strong>{number(plan.supplier.scenario_skus)}</strong>
            <span>Lead time yêu cầu</span><strong>{plan.supplier.requested_lead_time}</strong>
            <span>Revenue at risk</span><strong>{money(plan.supplier.revenue_at_risk)}</strong>
          </div>
        </RescueOptionCard>
      </div>
      <Card title="Budget Optimizer" tag="rescue mix impact cao nhất">
        <div className="scenarioInsight">
          <strong>Với budget rescue {money(budget)}, plan được chọn bảo vệ {money(protectedRevenue)} revenue bằng {number(selectedActions.length)} hành động ưu tiên.</strong>
          <span>Actions được xếp theo revenue protected, chi phí ước tính và severity. Cost là scenario proxy, không phải accounting data.</span>
        </div>
        <DataTable rows={plan.rescueActions} limit={plan.rescueActions.length} columns={[
          { key: "rank", label: "Hạng", render: (value) => number(value) },
          { key: "sku_id", label: "SKU" },
          { key: "action", label: "Action" },
          { key: "cost", label: "Chi phí", render: money },
          { key: "revenue_protected", label: "Revenue protected", render: money },
          { key: "decision_score", label: "Decision Score", render: (value) => number(value) },
          { key: "roi", label: "ROI Proxy", render: (value) => value >= 99 ? "Không tốn cost" : `${number(value, 1)}x` },
        ]} />
      </Card>
      <Card title="AI Copilot Action Brief" tag={approved ? "đã duyệt" : "sẵn sàng duyệt"}>
        <div className="rescueBriefBox">
          <pre>{brief}</pre>
          <div className="rescueBriefActions">
            <button type="button" className="primaryButton" onClick={() => downloadText(`${row.sku_id}-manager-brief.txt`, brief)}>Tạo manager brief</button>
            <button type="button" className="primaryButton" onClick={() => downloadText(`${row.sku_id}-supplier-email.txt`, supplierEmail)}>Tạo supplier email</button>
            <button type="button" className="primaryButton" onClick={() => downloadText(`${row.sku_id}-rescue-plan.txt`, brief)}>Tải rescue plan</button>
            <button type="button" className="primaryButton" onClick={() => setApproved(true)}>{approved ? "Đã duyệt" : "Đánh dấu đã duyệt"}</button>
          </div>
        </div>
      </Card>
    </>
  );
}

function ImpactTile({ label, value, detail }) {
  return <div className="impactTile"><span>{label}</span><strong>{value}</strong>{detail ? <p>{detail}</p> : null}</div>;
}

function RescueOptionCard({ title, tag, children }) {
  return <Card title={title} tag={tag} className="rescueOptionCard">{children}</Card>;
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
  const topStockoutSku = summary.find((item) => item.risk_type === "Stockout risk")?.sku_id || row.sku_id;
  const canRescueSelectedSku = row.risk_type === "Stockout risk";
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
      title: "Forecast sau train vs Market mô phỏng",
      tag: "hero analysis",
      note: "Đây là view demo chính: model Forecast được so với market data mô phỏng trong tương lai để kể câu chuyện sau giai đoạn train.",
      series: [
        { name: "Forecast", color: "#1E40AF", points: forecastRows },
        { name: "Market data mô phỏng", color: "#F97316", dash: "7 5", points: simulatedRows },
      ],
    },
    forecastOnly: {
      title: "Chỉ hiển thị Model Forecast",
      tag: "model output",
      note: "View này chỉ hiển thị model output cho 28 ngày sau giai đoạn train. Không overlay actual sales lịch sử lên ngày tương lai.",
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
      <TopHeader pageTitle="Chi tiết Forecast" subtitle="Góc nhìn cấp SKU về actual sales gần đây, Forecast 28 ngày tới, demand change và revenue/profit proxy." />
      <Card title="SKU Workspace" tag="drilldown">
        <div className="filterRow twoCols">
          <label>SKU workspace<select><option>Ưu tiên thương mại</option><option>Stockout risk</option><option>Overstock risk</option></select></label>
          <label>SKU đang chọn<select value={sku} onChange={(e) => selectSku(e.target.value)}>{skuOptions.map((r) => <option key={r.sku_id}>{r.sku_id}</option>)}</select></label>
        </div>
      </Card>
      <div className="kpiGrid five">
        <KpiCard icon={Boxes} label="Actual sales 28D gần nhất" value={number(row.last_28d_qty, 1)} sub="Dữ liệu train lịch sử" />
        <KpiCard icon={TrendingUp} label="Forecast Demand 28D" value={number(row.forecast_28d_qty, 1)} sub="Từ Forecast batch" tone="cyan" />
        <KpiCard icon={Gauge} label="Demand Change" value={`${number(row.demand_change_pct, 1)}%`} sub="so với 28D gần nhất" tone="amber" />
        <KpiCard icon={DollarSign} label="Revenue ước tính" value={money(row.forecast_28d_revenue)} sub="Tác động tài chính" tone="green" />
        <KpiCard icon={BarChart3} label="Profit Proxy" value={money(row.forecast_28d_profit)} sub="Tác động tài chính" tone="red" />
      </div>
      <div className="grid two">
        <Card title={row.risk_type === "Healthy" ? "Tín hiệu quyết định" : "Vì sao SKU này rủi ro?"} tag="explainability">
          <div className="driverList">
            {riskDrivers.map((driver) => <RiskDriver key={driver.label} driver={driver} />)}
          </div>
        </Card>
        <Card title="Mức sẵn sàng quyết định" tag="action rationale">
          <div className="readinessPanel">
            <div><span>Điểm risk được giải thích</span><strong>{number(riskPointTotal)}</strong><p>Rule-based breakdown từ Forecast demand, giả định stock và financial exposure.</p></div>
            <div><span>Stockout dự kiến</span><strong>{expectedStockoutDate(row)}</strong><p>{leadTimeImpact(row)}</p></div>
            <div><span>Lý do planner</span><strong>Ưu tiên {urgencyLabel[urgencyFor(row)] || urgencyFor(row)}</strong><p>{plannerReason(row)}</p></div>
          </div>
        </Card>
      </div>
      <Card title={chartConfig.title} tag={chartConfig.tag} className="heroChartCard">
        <DecisionBrief
          title={`Quyết định nhập hàng cho ${sku}`}
          rows={[{ ...row, sku_id: sku, risk_type: row.risk_type || "Watchlist", profit_at_risk_proxy: row.profit_at_risk_proxy || 0, recommended_action: row.recommended_action || "Monitor" }]}
          filename={`${sku}-decision-brief.txt`}
          metrics={[
            { label: "Forecast demand 28D", value: number(row.forecast_28d_qty, 1) },
            { label: "Revenue ước tính", value: money(row.forecast_28d_revenue) },
            { label: "Profit proxy", value: money(row.forecast_28d_profit) },
          ]}
        />
        <div className="rescueActionBar">
          <div>
            <span>{canRescueSelectedSku ? "Workflow rescue stockout" : "Queue rescue stockout"}</span>
            <strong>{canRescueSelectedSku ? "Chuyển SKU risk này thành hành động substitute, transfer, expedite và budget." : "SKU này chưa bị gắn stockout risk; mở rescue queue ưu tiên cao nhất thay thế."}</strong>
          </div>
          <button type="button" className="primaryButton" onClick={() => goToRescue(canRescueSelectedSku ? sku : topStockoutSku)}>{canRescueSelectedSku ? "Rescue SKU này" : "Mở rescue queue"}</button>
        </div>
        <ForecastChart
          height={470}
          yLabel="Số lượng/ngày"
          series={chartConfig.series}
        />
        <div className="segmented">
          <button type="button" className={chartView === "post" ? "active" : ""} onClick={() => setChartView("post")}>Forecast tương lai vs dữ liệu mô phỏng</button>
          <button type="button" className={chartView === "forecastOnly" ? "active" : ""} onClick={() => setChartView("forecastOnly")}>Chỉ Forecast</button>
        </div>
        <p className="note">{chartConfig.note}</p>
      </Card>
      <Card title="Chế độ so sánh SKU" tag="priority comparison">
        <div className="compareControls">
          <label>SKU chính<input value={sku} readOnly /></label>
          {[0, 1].map((index) => (
            <label key={index}>SKU so sánh {index + 1}
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
                <span>{item.sku_id === sku ? "Chính" : `Peer ${index}`}</span>
                <strong>{item.sku_id}</strong>
              </div>
              <div className="compareMetrics">
                <CompareMetric label="Demand 28D" value={number(item.forecast_28d_qty, 1)} max={Math.max(...compareRows.map((r) => Number(r.forecast_28d_qty || 0)), 1)} raw={item.forecast_28d_qty} />
                <CompareMetric label="Revenue" value={money(item.forecast_28d_revenue)} max={Math.max(...compareRows.map((r) => Number(r.forecast_28d_revenue || 0)), 1)} raw={item.forecast_28d_revenue} tone="green" />
                <CompareMetric label="Profit Proxy" value={money(item.forecast_28d_profit)} max={Math.max(...compareRows.map((r) => Number(r.forecast_28d_profit || 0)), 1)} raw={item.forecast_28d_profit} tone="green" />
                <CompareMetric label="Demand Change" value={`${number(item.demand_change_pct, 1)}%`} max={Math.max(...compareRows.map((r) => Math.abs(Number(r.demand_change_pct || 0))), 1)} raw={Math.abs(Number(item.demand_change_pct || 0))} tone="amber" />
                <CompareMetric label="Order đề xuất" value={number(item.suggested_order_qty, 1)} max={Math.max(...compareRows.map((r) => Number(r.suggested_order_qty || 0)), 1)} raw={item.suggested_order_qty} tone="red" />
              </div>
              <button type="button" className="compareDrillButton" onClick={() => goToSkuDetail(item.sku_id)}>Mở chi tiết SKU</button>
            </div>
          ))}
        </div>
        <DataTable rows={compareRows} limit={compareRows.length} onRowClick={(item) => goToSkuDetail(item.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "forecast_28d_qty", label: "Demand 28D", render: (v) => number(v, 1) },
          { key: "forecast_28d_revenue", label: "Revenue", render: money },
          { key: "forecast_28d_profit", label: "Profit Proxy", render: money },
          { key: "demand_change_pct", label: "Demand Change", render: (v) => `${number(v, 1)}%` },
          { key: "suggested_order_qty", label: "Order đề xuất", render: (v) => number(v, 1) },
          { key: "risk_type", label: "Tín hiệu risk", render: (v) => <RiskBadge type={v} /> },
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
        <strong>{driver.points} điểm</strong>
      </div>
      <i><b style={{ width: `${Math.min(driver.points, 40) * 2.5}%` }} /></i>
      <p>{driver.detail}</p>
    </div>
  );
}

function AiThinking({ compact = false }) {
  const steps = compact
    ? ["Đọc Forecast", "Xếp hạng risk", "Soạn brief"]
    : ["Đọc Forecast output", "Kiểm tra stockout/overstock", "Xếp hạng profit exposure", "Soạn action brief"];
  return (
    <div className={compact ? "aiThinking compact" : "aiThinking"} role="status" aria-live="polite">
      <div className="thinkingHeader">
        <span className="thinkingAvatar"><Bot size={compact ? 16 : 20} /></span>
        <div>
          <strong>AI Agent đang suy nghĩ</strong>
          <p>Đang phân tích Forecast, risk table và action queue...</p>
        </div>
        <span className="thinkingDots" aria-hidden="true"><i /><i /><i /></span>
      </div>
      <div className="thinkingSteps">
        {steps.map((step, index) => (
          <span key={step} style={{ "--delay": `${index * 90}ms` }}>{step}</span>
        ))}
      </div>
    </div>
  );
}

function Agent({ data }) {
  const { summary, risk } = data;
  const [question, setQuestion] = React.useState("");
  const [submitted, setSubmitted] = React.useState("");
  const [thinkingQuestion, setThinkingQuestion] = React.useState("");
  const [selectedSku, setSelectedSku] = React.useState(sessionStorage.getItem("selectedSku") || "");
  const thinkingTimer = React.useRef(null);
  const contextRow = summary.find((row) => row.sku_id === selectedSku);
  const contextRisk = risk.find((row) => row.sku_id === selectedSku);
  const answer = React.useMemo(() => localizeAgentAnswer(buildAgentAnswer(submitted, summary, risk, selectedSku), submitted), [submitted, summary, risk, selectedSku]);
  const isThinking = Boolean(thinkingQuestion);
  const quickPrompts = [
    "SKU nào cần nhập gấp?",
    "Tạo brief cho quản lý tuần này",
    "Stress test supplier delay",
  ];

  React.useEffect(() => {
    const syncSku = (event) => setSelectedSku(String(event.detail || sessionStorage.getItem("selectedSku") || ""));
    window.addEventListener("sku-search", syncSku);
    window.addEventListener("storage", syncSku);
    return () => {
      window.removeEventListener("sku-search", syncSku);
      window.removeEventListener("storage", syncSku);
    };
  }, []);

  React.useEffect(() => () => window.clearTimeout(thinkingTimer.current), []);

  const runAnalysis = (value = question) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return;
    setQuestion(cleaned);
    setSubmitted("");
    setThinkingQuestion(cleaned);
    window.clearTimeout(thinkingTimer.current);
    thinkingTimer.current = window.setTimeout(() => {
      setSubmitted(cleaned);
      setThinkingQuestion("");
    }, AI_THINKING_DELAY_MS);
  };
  return (
    <>
      <TopHeader pageTitle="AI Agent khuyến nghị" subtitle="Q&A rule-based trên các bảng CSV đã chuẩn bị, có guardrail để không bịa dữ liệu vận hành." />
      <div className="agentGrid">
        <Card title="AI Decision Copilot" tag="bảng điều hành">
          <div className="copilotHero"><Bot size={34} /><div><strong>AI Decision Copilot</strong><p>{contextRow ? `SKU đang chọn: ${selectedSku}` : "Nhập câu hỏi nghiệp vụ để chuyển Forecast output thành brief vận hành."}</p></div></div>
          {contextRow ? (
            <div className="skuContextCard">
              <span>SKU đang chọn</span>
              <strong>{selectedSku}</strong>
              <p>{money(contextRow.forecast_28d_revenue)} revenue | {money(contextRow.forecast_28d_profit)} profit proxy | {riskLabel[contextRisk?.risk_type] || "Ưu tiên thương mại"}</p>
            </div>
          ) : null}
          <div className="promptChips" aria-label="Gợi ý nhanh cho AI Agent">
            {quickPrompts.map((prompt) => (
              <button type="button" key={prompt} onClick={() => runAnalysis(prompt)}>{prompt}</button>
            ))}
          </div>
          <label className="stackLabel">Nhập câu hỏi<input value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") runAnalysis(); }} placeholder={contextRow ? `Hỏi logistics nên làm gì với ${selectedSku}...` : "Hỏi về replenishment, stockout risk, profit priority hoặc hành động tuần này..."} /></label>
          <button className="primaryButton" onClick={() => runAnalysis()} disabled={isThinking}>{isThinking ? "Đang phân tích..." : "Chạy phân tích"}</button>
          <div className="smallMetricRow">
            <ScopeMetric label="Forecast revenue" value={shortMoney(summary.reduce((s, r) => s + r.forecast_28d_revenue, 0))} />
            <ScopeMetric label="Profit proxy" value={shortMoney(summary.reduce((s, r) => s + r.forecast_28d_profit, 0))} />
          </div>
        </Card>
        <Card title={isThinking ? "AI đang suy nghĩ" : submitted ? "Kết quả khuyến nghị" : "Sẵn sàng phân tích"} tag={isThinking ? "đang phân tích" : submitted ? "decision brief" : "chưa có câu hỏi"}>
          {isThinking ? (
            <div className="answerPane" aria-busy="true">
              <div className="questionBubble">{thinkingQuestion}</div>
              <AiThinking />
            </div>
          ) : !submitted ? (
            <div className="emptyState"><Bot size={46} /><strong>Sẵn sàng tạo operating brief</strong><p>Nhập câu hỏi rồi chạy phân tích. Agent sẽ trả lời theo dạng brief vận hành.</p></div>
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

function isVietnameseQuestion(value) {
  const raw = String(value || "").toLowerCase();
  const normalized = normalizeQuery(raw);
  return /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(raw)
    || hasAny(normalized, ["sku nao", "thieu hang", "nhap gap", "quan ly", "ke hoach", "doanh thu", "loi nhuan", "rui ro", "ton kho", "du hang", "tom tat", "cuu", "kich ban", "nguon du lieu"]);
}

function localizeAgentAnswer(answer, question) {
  if (!answer) return answer;
  const actionMap = {
    "Review these SKUs first": "Rà soát các SKU này trước",
    "Confirm available stock": "Xác nhận tồn kho thực tế",
    "Prioritize supplier follow-up": "Ưu tiên làm việc với supplier",
    "Open Replenishment Planner": "Mở Planner nhập hàng",
    "Approve or defer each item": "Duyệt hoặc tạm hoãn từng action item",
    "Validate real stock before purchase": "Xác thực tồn kho thật trước khi mua",
    "Open Scenario Simulator": "Mở Scenario Simulator",
    "Stress-test supplier delay": "Stress test supplier delay",
    "Review SKUs newly exposed by lead time": "Rà soát SKU mới bị ảnh hưởng bởi lead time",
    "Open Stockout Rescue Room": "Mở Stockout Rescue Room",
    "Validate substitute compatibility": "Kiểm tra khả năng thay thế linh kiện",
    "Confirm branch stock and supplier lead time": "Xác nhận tồn kho chi nhánh và supplier lead time",
    "Use as decision support": "Dùng như decision support",
    "Do not claim live ERP integration": "Không trình bày như tích hợp ERP live",
    "Approve high-urgency replenishment review": "Duyệt review nhập hàng ưu tiên cao",
    "Watch overstock SKUs for promotion or PO slowdown": "Theo dõi SKU overstock để promotion hoặc giảm PO",
    "Assign planner review": "Giao planner review",
    "Check recent sales context": "Kiểm tra sales context gần đây",
    "Confirm real stock and supplier coverage": "Xác nhận tồn kho thật và supplier coverage",
    "Review purchase slowdown": "Rà soát giảm tốc PO",
    "Validate replenishment coverage": "Xác thực replenishment coverage",
    "Confirm supplier availability": "Xác nhận khả năng đáp ứng của supplier",
    "Monitor demand change vs last 28D": "Theo dõi demand change so với 28D gần nhất",
    "Stress-test supplier coverage": "Stress test supplier coverage",
    "Reserve purchase capacity for highest exposure": "Dành purchase capacity cho SKU phơi nhiễm cao nhất",
    "Escalate SKUs with large suggested orders": "Escalate SKU có suggested order lớn",
    "Slow purchase orders": "Giảm tốc PO",
    "Review promotion or bundling": "Rà soát promotion hoặc bundling",
    "Monitor demand before replenishment": "Theo dõi demand trước khi replenishment",
    "Protect availability": "Bảo vệ availability",
    "Review supplier coverage": "Rà soát supplier coverage",
    "Prioritize high-margin SKUs": "Ưu tiên SKU margin cao",
    "Protect availability for high revenue SKUs": "Bảo vệ availability cho SKU revenue cao",
    "Check pricing and margin before final priority": "Kiểm tra pricing và margin trước khi chốt ưu tiên",
    "Coordinate sales and logistics follow-up": "Phối hợp sales và logistics follow-up",
    "Review demand drivers": "Rà soát demand drivers",
    "Validate abnormal movement with sales team": "Xác thực biến động bất thường với sales team",
    "Use SKU drilldown before final order decision": "Dùng SKU drilldown trước khi chốt order",
    "Prioritize replenishment": "Ưu tiên replenishment",
    "Escalate high-exposure SKUs": "Escalate SKU phơi nhiễm cao",
    "Prepare replenishment review": "Chuẩn bị replenishment review",
    "Escalate critical SKUs": "Escalate SKU critical",
  };
  const localized = {
    ...answer,
    intent: {
      "Top SKU operating priority": "Ưu tiên vận hành SKU",
      "Executive operating summary": "Tóm tắt điều hành",
      "Scenario comparison action mode": "So sánh Scenario",
      "Stockout rescue action mode": "Kế hoạch rescue stockout",
      "Replenishment action plan": "Kế hoạch nhập hàng",
      "Data governance and demo guardrail": "Quản trị dữ liệu và guardrail demo",
      "Manual review queue": "Hàng đợi manual review",
      "SKU risk explanation": "Giải thích risk cấp SKU",
      "Single-SKU decision brief": "Decision brief cấp SKU",
      "Overstock containment brief": "Brief kiểm soát overstock",
      "Commercial profit priority": "Ưu tiên theo profit",
      "Revenue impact priority": "Ưu tiên theo revenue impact",
      "Demand movement monitor": "Theo dõi demand movement",
      "Budget-constrained replenishment queue": "Hàng đợi replenishment theo giới hạn budget",
      "Stockout-risk replenishment queue": "Hàng đợi replenishment theo stockout risk",
      "Default operating brief": "Operating brief mặc định",
    }[answer.intent] || answer.intent,
    actions: answer.actions?.map((action) => actionMap[action] || action) || [],
  };
  return localized;
}

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
    { key: "severity", label: "Mức ưu tiên", render: (_, row) => <SeverityBadge row={row} /> },
    { key: "risk_type", label: "Nhóm cảnh báo", render: (v) => <RiskBadge type={v} /> },
    { key: "risk_score", label: "Risk Score", render: (v) => number(v, 1) },
    { key: "forecast_28d_qty", label: "Demand 28D", render: (v) => number(v, 1) },
    ...(includeOrder ? [{ key: "suggested_order_qty", label: "Suggested order", render: (v) => number(v, 1) }] : []),
    { key: "revenue_at_risk_proxy", label: "Revenue at Risk", render: money },
    { key: "profit_at_risk_proxy", label: "Profit at Risk", render: money },
    { key: "recommended_action", label: "Khuyến nghị", render: (v) => actionLabel[v] || v },
  ];
}

const commercialColumns = [
  { key: "sku_id", label: "SKU" },
  { key: "forecast_28d_qty", label: "Demand 28D", render: (v) => number(v, 1) },
  { key: "demand_change_pct", label: "Demand Change", render: (v) => `${number(v, 1)}%` },
  { key: "forecast_28d_revenue", label: "Revenue", render: money },
  { key: "forecast_28d_profit", label: "Profit Proxy", render: money },
  { key: "recommended_action", label: "Khuyến nghị", render: (v) => actionLabel[v] || v },
];

const dataGovernanceColumns = [
  { key: "asset", label: "Data Asset" },
  { key: "role", label: "Vai trò trong demo" },
  { key: "guardrail", label: "Guardrail" },
];

const plannerColumns = [
  { key: "sku_id", label: "SKU" },
  { key: "urgency", label: "Độ ưu tiên", render: (value) => <span className={`urgencyBadge ${String(value).toLowerCase()}`}>{urgencyLabel[value] || value}</span> },
  { key: "risk_type", label: "Cảnh báo", render: (value) => <RiskBadge type={value} /> },
  { key: "suggested_order_qty", label: "Suggested order", render: (value) => number(value, 1) },
  { key: "expected_stockout_date", label: "Stockout dự kiến" },
  { key: "business_impact", label: "Profit Protected", render: money },
  { key: "owner", label: "Owner" },
  { key: "reason", label: "Lý do" },
];

const scenarioComparisonColumns = [
  { key: "name", label: "Scenario", render: (value) => scenarioNameLabel[value] || value },
  { key: "lead_time", label: "Lead Time", render: (value) => `${value}D` },
  { key: "demand_uplift", label: "Demand Uplift", render: (value) => `${value > 0 ? "+" : ""}${value}%` },
  { key: "stockout_count", label: "Stockout SKUs", render: (value) => number(value) },
  { key: "revenue_at_risk", label: "Revenue at Risk", render: money },
  { key: "delta_vs_baseline", label: "Revenue Delta", render: money },
];

const rescueActionColumns = [
  { key: "rank", label: "Hạng", render: (value) => number(value) },
  { key: "sku_id", label: "SKU" },
  { key: "action", label: "Rescue action" },
  { key: "cost", label: "Chi phí", render: money },
  { key: "revenue_protected", label: "Revenue Protected", render: money },
  { key: "decision_score", label: "Score", render: (value) => number(value) },
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
  const asksRescue = hasAny(q, ["rescue", "stockout rescue", "save revenue", "substitute", "branch transfer", "expedite supplier", "cuu sku", "cuu doanh thu"]);
  const asksExplain = hasAny(q, ["explain", "why", "tai sao", "vi sao", "critical", "risky", "rui ro"]);
  const asksScenarioCompare = hasAny(q, ["compare scenario", "baseline vs", "so sanh kich ban", "scenario comparison"]);
  const asksExecutive = hasAny(q, ["executive summary", "board summary", "management summary", "summary for this week", "tom tat", "brief", "quan ly", "manager brief"]);
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
      summary: "Demo này không phải màn hình ERP/WMS real-time. Ứng dụng đọc các bảng Forecast và risk đã chuẩn bị, sau đó chuyển thành khuyến nghị decision support cho 28 ngày tới.",
      metrics: [
        { label: "Forecast horizon", value: "28D" },
        { label: "SKU đang quản lý", value: number(summary.length) },
        { label: "Dòng risk", value: number(risk.length) },
      ],
      actions: ["Dùng như decision support", "Xác thực tồn kho thật trước khi mua", "Không trình bày như tích hợp ERP live"],
      rows: [
        { asset: "sku_forecast_summary.csv", role: "Demand, revenue, profit proxy và demand change ở cấp SKU", guardrail: "Forecast output, không phải live sales feed" },
        { asset: "sku_risk_table.csv", role: "Xếp hạng stockout/overstock và recommended actions", guardrail: "Inventory và lead time là giả định scenario" },
        { asset: "forecast_long.csv", role: "Đường Forecast 28 ngày theo ngày để vẽ chart", guardrail: "Precomputed batch Forecast" },
      ],
      columns: dataGovernanceColumns,
      note: "Decision note: agent chỉ giải thích và xếp hạng dữ liệu đã nạp trong CSV; không bịa live inventory, supplier commitment hoặc purchase order.",
    };
  }

  if (asksExecutive) {
    const actionRows = buildPlannerRows(summary, risk, 10);
    const stockout = risk.filter((row) => row.risk_type === "Stockout risk");
    const overstock = risk.filter((row) => row.risk_type === "Overstock risk");
    return {
      intent: "Executive operating summary",
      summary: `Trong 28 ngày tới: ${number(summary.length)} SKU đang quản lý, ${number(stockout.length)} SKU có stockout risk và ${number(overstock.length)} SKU có overstock risk. Trọng tâm quản lý nên là bảo vệ nhóm stockout có profit exposure cao, đồng thời giảm tốc PO cho tín hiệu overstock.`,
      metrics: [
        { label: "Demand 28D", value: number(summary.reduce((sum, row) => sum + Number(row.forecast_28d_qty || 0), 0), 1) },
        { label: "Revenue Proxy", value: shortMoney(summary.reduce((sum, row) => sum + Number(row.forecast_28d_revenue || 0), 0)) },
        { label: "Action Items", value: number(actionRows.length) },
      ],
      actions: ["Duyệt review nhập hàng ưu tiên cao", "Xác thực tồn kho thật trước khi mua", "Theo dõi SKU overstock để promotion hoặc giảm PO"],
      rows: actionRows,
      columns: plannerColumns,
      note: "Executive brief được tạo từ Forecast và risk table đã chuẩn bị; inventory vẫn là giả định scenario.",
    };
  }

  if (asksScenarioCompare) {
    const rows = buildScenarioComparison(summary, { lead: 14, safety: 7, uplift: 0 });
    const supplierDelay = rows.find((row) => row.name === "Supplier Delay");
    const baseline = rows[0];
    return {
      intent: "Scenario comparison action mode",
      summary: `Supplier Delay so với Baseline làm thay đổi ${number((supplierDelay?.stockout_count || 0) - (baseline?.stockout_count || 0))} SKU stockout risk và làm revenue at risk thay đổi ${money((supplierDelay?.revenue_at_risk || 0) - (baseline?.revenue_at_risk || 0))}.`,
      metrics: [
        { label: "Baseline revenue risk", value: shortMoney(baseline?.revenue_at_risk || 0) },
        { label: "Supplier delay risk", value: shortMoney(supplierDelay?.revenue_at_risk || 0) },
        { label: "Revenue delta", value: shortMoney((supplierDelay?.revenue_at_risk || 0) - (baseline?.revenue_at_risk || 0)) },
      ],
      actions: ["Mở Scenario Simulator", "Stress test supplier delay", "Rà soát SKU mới bị ảnh hưởng bởi lead time"],
      rows,
      columns: scenarioComparisonColumns,
      note: "Scenario comparison là rule-based và dùng giả định lead time, safety stock, Forecast demand.",
    };
  }

  if (asksRescue) {
    const targetSku = skuSummary?.sku_id || topBy(stockoutRows, "profit_at_risk_proxy", 1)[0]?.sku_id || summary[0]?.sku_id;
    const targetRow = rescueRowForSku(summary, risk, targetSku);
    const plan = buildRescuePlan(targetRow, summary);
    return {
      intent: "Stockout rescue action mode",
      summary: `${targetSku} cần rescue plan: bảo vệ ${money(plan.impact.directRevenue)} direct revenue và ${money(plan.impact.bundleRevenue)} bundle revenue bằng cách kết hợp branch transfer, substitute part và expedite supplier.`,
      metrics: [
        { label: "Demand chưa đáp ứng", value: number(plan.impact.unfulfilled, 1) },
        { label: "Bundle bị ảnh hưởng", value: number(plan.impact.affectedBundles) },
        { label: "Best score", value: number(plan.rescueActions[0]?.decision_score || 0) },
      ],
      actions: ["Mở Stockout Rescue Room", "Kiểm tra khả năng substitute", "Xác nhận branch stock và supplier lead time"],
      rows: plan.rescueActions,
      columns: rescueActionColumns,
      note: "Rescue options là giả định scenario. Cần xác thực substitute, branch stock và supplier commitment trước khi triển khai.",
    };
  }

  if (asksActionPlan) {
    const rows = buildPlannerRows(summary, risk, 10);
    return {
      intent: "Replenishment action plan",
      summary: "Agent đã tạo kế hoạch replenishment theo thứ tự ưu tiên từ Forecast risk, suggested order quantity, thời điểm stockout dự kiến và profit exposure.",
      metrics: [
        { label: "Ưu tiên cao", value: number(rows.filter((row) => row.urgency === "High").length) },
        { label: "Suggested order qty", value: number(rows.reduce((sum, row) => sum + Number(row.suggested_order_qty || 0), 0), 1) },
        { label: "Profit protected", value: shortMoney(rows.reduce((sum, row) => sum + Number(row.business_impact || 0), 0)) },
      ],
      actions: ["Mở Planner nhập hàng", "Duyệt hoặc tạm hoãn từng action item", "Xác thực tồn kho thật trước khi mua"],
      rows,
      columns: plannerColumns,
      note: "Kế hoạch này là decision support. Phê duyệt mua cuối cùng vẫn thuộc owner phụ trách.",
    };
  }

  if (asksManualReview) {
    const rows = buildPlannerRows(summary, risk, 30)
      .filter((row) => row.urgency !== "Low" && (Number(row.risk_score || 0) < 20 || Math.abs(Number(row.demand_change_pct || 0)) > 40))
      .slice(0, 10);
    return {
      intent: "Manual review queue",
      summary: "Các SKU này nên được manual review vì tín hiệu hành động đủ đáng chú ý, nhưng demand movement hoặc độ tin cậy risk cần planner kiểm tra trước khi duyệt.",
      metrics: [
        { label: "Review SKUs", value: number(rows.length) },
        { label: "Profit exposure", value: shortMoney(rows.reduce((sum, row) => sum + Number(row.business_impact || 0), 0)) },
      ],
      actions: ["Giao planner review", "Kiểm tra sales context gần đây", "Xác nhận tồn kho thật và supplier coverage"],
      rows,
      columns: plannerColumns,
      note: "Manual review là một lớp workflow thận trọng, không phải tín hiệu retrain model.",
    };
  }

  if (asksGenericTopSku) {
    const rows = topBy(stockoutRows, "profit_at_risk_proxy", 10);
    return {
      intent: "Top SKU operating priority",
      summary: "Đây là các SKU nên review trước. Danh sách được xếp theo stockout exposure và profit-at-risk proxy, nên phù hợp để ưu tiên replenishment thay vì chỉ nhìn Forecast volume.",
      metrics: [
        { label: "Stockout SKUs", value: number(stockoutRows.length) },
        { label: "Top 10 profit at risk", value: shortMoney(rows.reduce((s, row) => s + Number(row.profit_at_risk_proxy || 0), 0)) },
        { label: "Top 10 order qty", value: number(rows.reduce((s, row) => s + Number(row.suggested_order_qty || 0), 0), 1) },
      ],
      actions: ["Rà soát các SKU này trước", "Xác nhận tồn kho thực tế", "Ưu tiên làm việc với supplier"],
      rows,
      columns: riskColumns({ includeOrder: true }),
      note: "Có thể hỏi thêm top SKU theo revenue, profit, demand, stockout risk hoặc overstock risk.",
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
        ? `${skuInQuestion} rủi ro vì ${drivers.filter((driver) => driver.points > 0).slice(0, 3).map((driver) => driver.label.toLowerCase()).join(", ")}. SKU này có ${money(skuSummary.forecast_28d_profit)} profit proxy và suggested order quantity ${number(briefRow.suggested_order_qty || 0, 1)}.`
        : `${skuInQuestion} được Forecast ${number(skuSummary.forecast_28d_qty, 1)} units trong 28 ngày tới, ${trend === "up" ? "tăng" : "giảm"} ${number(Math.abs(skuSummary.demand_change_pct || 0), 1)}% so với 28 ngày gần nhất. Revenue ước tính ${money(skuSummary.forecast_28d_revenue)}, profit proxy ${money(skuSummary.forecast_28d_profit)}.`,
      metrics: [
        { label: "Actual 28D gần nhất", value: number(skuSummary.last_28d_qty, 1) },
        { label: "Forecast 28D", value: number(skuSummary.forecast_28d_qty, 1) },
        { label: "Suggested order", value: number(briefRow.suggested_order_qty || 0, 1) },
      ],
      actions: [
        briefRow.risk_type === "Overstock risk" ? "Rà soát giảm tốc PO" : "Xác thực replenishment coverage",
        "Xác nhận khả năng đáp ứng của supplier",
        "Theo dõi demand change so với 28D gần nhất",
      ],
      rows: [briefRow],
      columns: riskColumns({ includeOrder: true }),
      note: "Đây là recommendation brief. Phê duyệt mua cuối cùng vẫn thuộc planner hoặc manager phụ trách.",
    };
  }

  if (asksLeadTime) {
    const lead = leadTimeFromQuestion(question) || 14;
    const rows = calculateScenario(summary, lead, 7, 0)
      .filter((row) => row.risk_type === "Stockout risk")
      .sort((a, b) => Number(b.profit_at_risk_proxy || 0) - Number(a.profit_at_risk_proxy || 0))
      .slice(0, 10);
    return {
      intent: `Lead-time stress test (${lead} ngày)`,
      summary: `Nếu lead time được mô phỏng ở mức ${lead} ngày, các SKU này trở thành hàng đợi replenishment ưu tiên vì Forecast coverage và tồn kho giả định tạo stockout exposure cao nhất.`,
      metrics: [
        { label: "Lead time", value: `${lead}D` },
        { label: "Stockout-risk SKUs", value: number(rows.length) },
        { label: "Profit at risk", value: shortMoney(rows.reduce((s, row) => s + Number(row.profit_at_risk_proxy || 0), 0)) },
      ],
      actions: ["Stress test supplier coverage", "Dành purchase capacity cho SKU phơi nhiễm cao nhất", "Escalate SKU có suggested order lớn"],
      rows,
      columns: riskColumns({ includeOrder: true }),
      note: "Lead time là giả định scenario trong demo, không phải supplier SLA live.",
    };
  }

  if (asksOverstock) {
    const rows = topBy(overstockRows, "risk_score", 10);
    return {
      intent: "Overstock containment brief",
      summary: rows.length
        ? "Các SKU này có tín hiệu overstock mạnh nhất. Hướng vận hành là giảm tốc mua hàng, rà soát bundle/promotion và tránh khóa vốn ở inventory quay chậm."
        : "Risk table hiện tại chưa gắn cờ SKU overstock đáng kể.",
      metrics: [
        { label: "Overstock SKUs", value: number(overstockRows.length) },
        { label: "Highest score", value: rows[0] ? number(rows[0].risk_score, 1) : "0.0" },
      ],
      actions: ["Giảm tốc PO", "Rà soát promotion hoặc bundling", "Theo dõi demand trước khi replenishment"],
      rows,
      columns: riskColumns(),
      note: "Overstock được tính từ Forecast demand và inventory giả định, nên đây là planning signal chứ không phải số đếm kho thật.",
    };
  }

  if (asksProfit) {
    const rows = topBy(summary, "forecast_28d_profit", 10);
    return {
      intent: "Commercial profit priority",
      summary: "Commercial priority brief: các SKU này có profit proxy 28 ngày cao nhất và nên được bảo vệ trước khi supply hoặc logistics capacity bị giới hạn.",
      metrics: [
        { label: "Top SKU profit", value: money(rows[0]?.forecast_28d_profit || 0) },
        { label: "Top 10 profit", value: shortMoney(rows.reduce((s, row) => s + Number(row.forecast_28d_profit || 0), 0)) },
      ],
      actions: ["Bảo vệ availability", "Rà soát supplier coverage", "Ưu tiên SKU margin cao"],
      rows,
      columns: commercialColumns,
      note: "Profit proxy được suy ra từ dataset đã chuẩn bị, không phải hệ thống kế toán live.",
    };
  }

  if (asksRevenue) {
    const rows = topBy(summary, "forecast_28d_revenue", 10);
    return {
      intent: "Revenue impact priority",
      summary: "Các SKU này có revenue exposure 28 ngày ước tính lớn nhất. Danh sách phù hợp để ưu tiên thương mại khi team cần bảo vệ sales impact trước.",
      metrics: [
        { label: "Top SKU revenue", value: money(rows[0]?.forecast_28d_revenue || 0) },
        { label: "Top 10 revenue", value: shortMoney(rows.reduce((s, row) => s + Number(row.forecast_28d_revenue || 0), 0)) },
      ],
      actions: ["Bảo vệ availability cho SKU revenue cao", "Kiểm tra pricing và margin trước khi chốt ưu tiên", "Phối hợp sales và logistics follow-up"],
      rows,
      columns: commercialColumns,
      note: "Revenue impact được tính từ Forecast quantity nhân price proxy trong dữ liệu đã chuẩn bị.",
    };
  }

  if (asksTrend) {
    const rows = [...summary]
      .sort((a, b) => Math.abs(Number(b.demand_change_pct || 0)) - Math.abs(Number(a.demand_change_pct || 0)))
      .slice(0, 10);
    return {
      intent: "Demand movement monitor",
      summary: "Các SKU này có Forecast movement lớn nhất so với actual window 28 ngày gần nhất, nên cần review trước khi chốt replenishment hoặc promotion actions.",
      metrics: [
        { label: "Tăng mạnh nhất", value: `${number(Math.max(...summary.map((row) => Number(row.demand_change_pct || 0))), 1)}%` },
        { label: "Giảm mạnh nhất", value: `${number(Math.min(...summary.map((row) => Number(row.demand_change_pct || 0))), 1)}%` },
      ],
      actions: ["Rà soát demand drivers", "Xác thực biến động bất thường với sales team", "Dùng SKU drilldown trước khi chốt order"],
      rows,
      columns: commercialColumns,
      note: "Demand change so sánh Forecast 28 ngày với actual window 28 ngày gần nhất trong demo data đã chuẩn bị.",
    };
  }

  if (asksBudget || asksStockout) {
    const rows = topBy(stockoutRows, "profit_at_risk_proxy", 10);
    return {
      intent: asksBudget ? "Budget-constrained replenishment queue" : "Stockout-risk replenishment queue",
      summary: asksBudget
        ? "Khi replenishment budget hoặc logistics capacity bị giới hạn, hãy ưu tiên các SKU này vì chúng kết hợp stockout risk với profit exposure cao nhất."
        : "Các SKU này nên được review trước cho replenishment vì risk table gắn cờ stockout exposure đáng kể trong 28 ngày tới.",
      metrics: [
        { label: "Stockout SKUs", value: number(stockoutRows.length) },
        { label: "Top 10 profit at risk", value: shortMoney(rows.reduce((s, row) => s + Number(row.profit_at_risk_proxy || 0), 0)) },
        { label: "Top 10 order qty", value: number(rows.reduce((s, row) => s + Number(row.suggested_order_qty || 0), 0), 1) },
      ],
      actions: ["Ưu tiên replenishment", "Xác nhận khả năng đáp ứng của supplier", "Escalate SKU phơi nhiễm cao"],
      rows,
      columns: riskColumns({ includeOrder: true }),
      note: "Suggested order quantity dựa trên scenario và cần được xác thực với tồn kho thật cùng supplier constraints.",
    };
  }

  const rows = topBy(stockoutRows, "profit_at_risk_proxy", 10);
  return {
    intent: "Default operating brief",
    summary: "Replenishment command brief: ưu tiên SKU có Forecast demand, risk score và profit exposure cùng chỉ ra stockout impact đáng kể.",
    metrics: [
      { label: "Stockout SKUs", value: number(stockoutRows.length) },
      { label: "Overstock SKUs", value: number(overstockRows.length) },
      { label: "SKU đang quản lý", value: number(summary.length) },
    ],
    actions: ["Chuẩn bị replenishment review", "Xác nhận khả năng đáp ứng của supplier", "Escalate SKU critical"],
    rows,
    columns: riskColumns({ includeOrder: true }),
    note: "Agent trả lời từ Forecast và SKU risk tables đã nạp. Với dữ kiện live ERP, supplier hoặc warehouse, cần xác thực ngoài demo.",
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
    ? `${scenarioNameLabel[stressScenario.name] || stressScenario.name} tạo thêm ${number(stressScenario.stockout_count - baselineScenario.stockout_count)} SKU stockout risk và làm revenue at risk thay đổi ${money(stressScenario.revenue_at_risk - baselineScenario.revenue_at_risk)} so với baseline.`
    : "Scenario comparison được tính từ Forecast demand, lead time, safety stock và inventory giả định.";
  const scenarioRows = rows.filter((r) => r.risk_type !== "Healthy").sort((a, b) => b.profit_at_risk_proxy - a.profit_at_risk_proxy);
  const activePreset = scenarioPresets.find((preset) => preset.lead === lead && preset.safety === safety && preset.uplift === uplift)?.name || "Custom";
  const activePresetLabel = scenarioNameLabel[activePreset] || activePreset;
  const deltaRevenue = revenueAtRisk - baseRevenueAtRisk;
  const deltaProfit = profitAtRisk - baseProfitAtRisk;
  const applyPreset = (preset) => {
    setLead(preset.lead);
    setSafety(preset.safety);
    setUplift(preset.uplift);
  };
  const exportScenarioBrief = () => {
    downloadText(
      `scenario-${activePreset.toLowerCase().replace(/\s+/g, "-")}.txt`,
      scenarioBriefText({ lead, safety, uplift, stockout, overstock, revenueAtRisk, profitAtRisk, deltaRevenue, deltaProfit, rows: scenarioRows })
    );
  };
  return (
    <>
      <TopHeader pageTitle="Scenario Simulator" subtitle="Ước tính tác động vận hành khi thay đổi giả định lead time, safety stock và demand uplift." />
      <div className="scenarioTop">
        <Card title="Điều khiển Scenario" tag="tham số vận hành">
          <div className="presetBar" aria-label="Preset Scenario">
            {scenarioPresets.map((preset) => (
              <button
                type="button"
                key={preset.name}
                className={activePreset === preset.name ? "active" : ""}
                onClick={() => applyPreset(preset)}
              >
                {scenarioNameLabel[preset.name] || preset.name}
              </button>
            ))}
          </div>
          <Slider label="Lead time (ngày)" value={lead} setValue={setLead} min={3} max={30} />
          <Slider label="Safety stock (ngày)" value={safety} setValue={setSafety} min={0} max={21} />
          <Slider label="Demand uplift (%)" value={uplift} setValue={setUplift} min={-30} max={50} />
          <div className="scenarioNote">
            <strong>Ghi chú giả định</strong>
            <span>Reorder point được tính lại từ Forecast demand, lead time và safety stock. Inventory vẫn là giả định demo; không tạo purchase order.</span>
          </div>
          <button type="button" className="secondaryButton" onClick={exportScenarioBrief}>Tải scenario brief</button>
        </Card>
      </div>
      <Card title="So sánh Scenario" tag="so với baseline">
        <div className={`impactBanner ${deltaRevenue > 500_000_000 ? "critical" : "steady"}`}>
          <div>
            <span>{activePresetLabel} scenario</span>
            <strong>{stockout.length - baseStockout.length >= 0 ? "+" : ""}{number(stockout.length - baseStockout.length)} SKU stockout so với baseline</strong>
          </div>
          <p>Revenue-at-risk delta: {money(deltaRevenue)} · Profit-at-risk delta: {money(deltaProfit)}</p>
        </div>
        <div className="scenarioInsight">
          <strong>{scenarioInsight}</strong>
          <span>Tất cả scenario là giả định decision support và không tạo purchase order.</span>
        </div>
        <DataTable rows={scenarioSummary} limit={scenarioSummary.length} columns={[
          { key: "name", label: "Scenario", render: (value) => scenarioNameLabel[value] || value },
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
        <KpiCard icon={AlertTriangle} label="SKU stockout risk" value={number(stockout.length)} sub={`${stockout.length - baseStockout.length >= 0 ? "+" : ""}${number(stockout.length - baseStockout.length)} vs baseline`} tone="red" />
        <KpiCard icon={PackageSearch} label="SKU overstock risk" value={number(overstock.length)} sub={`${overstock.length - baseOverstock.length >= 0 ? "+" : ""}${number(overstock.length - baseOverstock.length)} vs baseline`} tone="purple" />
        <KpiCard icon={DollarSign} label="Revenue at Risk" value={money(revenueAtRisk)} sub={`${money(deltaRevenue)} delta`} tone="green" />
        <KpiCard icon={BarChart3} label="Profit Proxy at Risk" value={money(profitAtRisk)} sub={`${money(deltaProfit)} delta`} tone="amber" />
      </div>
      <Card title="Delta của Scenario" tag="baseline: 7D lead, 7D safety">
        <div className="deltaGrid">
          <DeltaTile label="Stockout delta" value={`${stockout.length - baseStockout.length >= 0 ? "+" : ""}${number(stockout.length - baseStockout.length)}`} />
          <DeltaTile label="Revenue at risk delta" value={money(deltaRevenue)} />
          <DeltaTile label="Profit at risk delta" value={money(deltaProfit)} />
          <DeltaTile label="SKU mới bị phơi nhiễm" value={number(newlyCritical.length)} />
        </div>
        <DataTable rows={newlyCritical.length ? newlyCritical : stockout.sort((a, b) => b.profit_at_risk_proxy - a.profit_at_risk_proxy)} limit={8} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "severity", label: "Mức ưu tiên", render: (_, row) => <SeverityBadge row={row} /> },
          { key: "risk_score", label: "Risk Score", render: (v) => number(v, 1) },
          { key: "profit_at_risk_proxy", label: "Profit at Risk", render: money },
          { key: "suggested_order_qty", label: "Suggested order", render: (v) => number(v, 1) },
        ]} />
      </Card>
      <Card title="Bảng kết quả Scenario">
        <DataTable rows={scenarioRows} limit={25} onRowClick={(row) => goToSkuDetail(row.sku_id)} columns={[
          { key: "sku_id", label: "SKU" },
          { key: "severity", label: "Mức ưu tiên", render: (_, row) => <SeverityBadge row={row} /> },
          { key: "risk_type", label: "Nhóm cảnh báo", render: (v) => <RiskBadge type={v} /> },
          { key: "risk_score", label: "Risk Score", render: (v) => number(v, 1) },
          { key: "scenario_forecast_28d_qty", label: "Scenario Demand", render: (v) => number(v, 1) },
          { key: "scenario_reorder_point", label: "Reorder Point", render: (v) => number(v, 1) },
          { key: "profit_at_risk_proxy", label: "Profit at Risk", render: money },
          { key: "suggested_order_qty", label: "Suggested order", render: (v) => number(v, 1) },
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

const scenarioPresets = [
  { name: "Baseline", lead: 7, safety: 7, uplift: 0 },
  { name: "Supplier Delay", lead: 14, safety: 7, uplift: 0 },
  { name: "Peak Demand", lead: 14, safety: 7, uplift: 20 },
  { name: "Conservative Stock", lead: 10, safety: 14, uplift: 10 },
];

function scenarioBriefText({ lead, safety, uplift, stockout, overstock, revenueAtRisk, profitAtRisk, deltaRevenue, deltaProfit, rows }) {
  return [
    "Brief Stress Test Scenario",
    "",
    `Lead time: ${lead} ngày`,
    `Safety stock: ${safety} ngày`,
    `Demand uplift: ${uplift}%`,
    `SKU stockout risk: ${stockout.length}`,
    `SKU overstock risk: ${overstock.length}`,
    `Revenue at risk: ${money(revenueAtRisk)}`,
    `Profit proxy at risk: ${money(profitAtRisk)}`,
    `Revenue delta vs baseline: ${money(deltaRevenue)}`,
    `Profit delta vs baseline: ${money(deltaProfit)}`,
    "",
    "Top SKU phơi nhiễm",
    ...rows.slice(0, 10).map((row, index) =>
      `${index + 1}. ${row.sku_id} | ${riskLabel[row.risk_type] || row.risk_type} | score ${number(row.risk_score, 1)} | profit risk ${money(row.profit_at_risk_proxy)} | suggested order ${number(row.suggested_order_qty, 1)}`
    ),
    "",
    "Guardrail: đây là scenario decision support. Cần xác thực real inventory, branch stock và supplier commitments trước khi triển khai.",
  ].join("\n");
}

function FloatingCopilot({ data, setActive }) {
  const { summary, risk } = data;
  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [submitted, setSubmitted] = React.useState("");
  const [thinkingQuestion, setThinkingQuestion] = React.useState("");
  const [selectedSku, setSelectedSku] = React.useState(sessionStorage.getItem("selectedSku") || "");
  const thinkingTimer = React.useRef(null);
  const answer = React.useMemo(() => localizeAgentAnswer(buildAgentAnswer(submitted, summary, risk, selectedSku), submitted), [submitted, summary, risk, selectedSku]);
  const contextRow = summary.find((row) => row.sku_id === selectedSku);
  const isThinking = Boolean(thinkingQuestion);
  const quickPrompts = ["SKU nào cần nhập gấp?", "Tạo brief cho quản lý", "Stress test supplier delay"];

  React.useEffect(() => {
    const syncSku = (event) => setSelectedSku(String(event.detail || sessionStorage.getItem("selectedSku") || ""));
    window.addEventListener("sku-search", syncSku);
    window.addEventListener("storage", syncSku);
    return () => {
      window.removeEventListener("sku-search", syncSku);
      window.removeEventListener("storage", syncSku);
    };
  }, []);

  React.useEffect(() => () => window.clearTimeout(thinkingTimer.current), []);

  const run = (value = question) => {
    const cleaned = String(value || "").trim();
    if (!cleaned) return;
    setQuestion(cleaned);
    setSubmitted("");
    setThinkingQuestion(cleaned);
    window.clearTimeout(thinkingTimer.current);
    thinkingTimer.current = window.setTimeout(() => {
      setSubmitted(cleaned);
      setThinkingQuestion("");
    }, AI_THINKING_DELAY_MS);
  };

  const runQuickAction = (target) => {
    const firstSku = answer?.rows?.find((row) => row.sku_id)?.sku_id || selectedSku;
    if (target === "detail" && firstSku) {
      setOpen(false);
      goToSkuDetail(firstSku);
      return;
    }
    if (target === "rescue" && firstSku) {
      setOpen(false);
      goToRescue(firstSku);
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
              <strong>{contextRow ? `Ngữ cảnh: ${selectedSku}` : "Hỏi từ Forecast và risk tables"}</strong>
            </div>
            <button type="button" className="iconButton" onClick={() => setOpen(false)} aria-label="Đóng AI copilot"><X size={18} /></button>
          </div>
          <div className="copilotMessages">
            {isThinking ? (
              <>
                <div className="miniQuestion">{thinkingQuestion}</div>
                <AiThinking compact />
              </>
            ) : !submitted ? (
              <div className="copilotEmpty">
                <Bot size={38} />
                <strong>Sẵn sàng tạo operating brief</strong>
                <p>Hỏi về replenishment, stockout risk, profit priority, demand trend, lead time hoặc SKU đang chọn.</p>
                <div className="copilotPromptChips">
                  {quickPrompts.map((prompt) => (
                    <button type="button" key={prompt} onClick={() => run(prompt)}>{prompt}</button>
                  ))}
                </div>
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
                    <button type="button" onClick={() => runQuickAction("detail")}>Mở chi tiết SKU</button>
                    <button type="button" onClick={() => runQuickAction("rescue")}>Rescue SKU</button>
                    <button type="button" onClick={() => runQuickAction("planner")}>Mở Planner</button>
                    <button type="button" onClick={() => runQuickAction("risk")}>Xem Risk Queue</button>
                    <button type="button" onClick={() => runQuickAction("scenario")}>Chạy Scenario</button>
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
              placeholder={contextRow ? `Hỏi nên làm gì với ${selectedSku}...` : "Hỏi về SKU, stockout, profit, lead time..."}
            />
            <button type="button" onClick={() => run()} disabled={isThinking} aria-label="Chạy AI analysis"><SendHorizontal size={18} /></button>
          </div>
          <button type="button" className="workspaceLink" onClick={openWorkspace}>Mở workspace AI đầy đủ</button>
        </div>
      ) : null}
      <button type="button" className="copilotLauncher" onClick={() => setOpen((value) => !value)} aria-label="Mở AI decision copilot">
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
    return <div className="loading"><Warehouse size={44} /><strong>Đang tải AutoParts Demand Intelligence...</strong><span>Đang chuẩn bị Forecast, SKU risk và action queue tables.</span></div>;
  }
  if (data.error) {
    return <div className="loading error"><AlertTriangle size={44} /><strong>Tải dữ liệu thất bại</strong><span>{data.error.message}</span></div>;
  }

  const page = {
    dashboard: <Dashboard data={data} />,
    risk: <RiskMonitor data={data} />,
    planner: <ReplenishmentPlanner data={data} />,
    detail: <ForecastDetail data={data} />,
    rescue: <StockoutRescueRoom data={data} />,
    agent: <Agent data={data} />,
    scenario: <Scenario data={data} />,
  }[active];
  const skuIds = data.summary.map((row) => String(row.sku_id).toUpperCase());

  return (
    <SkuSearchContext.Provider value={skuIds}>
      <div className="appShell">
        <Sidebar active={active} setActive={setActive} summary={data.summary} risk={data.risk} forecast={data.forecast} />
        <main>{page}</main>
        <FloatingCopilot data={data} setActive={setActive} />
      </div>
    </SkuSearchContext.Provider>
  );
}

createRoot(document.getElementById("root")).render(<App />);
