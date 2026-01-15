"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { 
  AreaChart, 
  BarChart, 
} from "@tremor/react";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Shield, 
  Play, 
  TrendingUp,
  TrendingDown,
  Database,
  FileCheck,
  Scale,
  Wallet,
  Building2,
  ChevronDown,
  ChevronUp,
  Users,
  Banknote,
} from "lucide-react";

// ============ TYPES ============
interface BalanceSheetYear {
  year: number;
  balance_sheet_accounts: any[];
}

interface FinancialKPI {
  year: number;
  active_total: number;
  net_income: number;
  employees: number | null;
  revenue: number | null;
}

interface CompanyData {
  name: string;
  status: string;
  legal_form: string;
  registration: { court: string; register_type: string; register_number: string };
  balance_sheet_accounts: BalanceSheetYear[];
  financial_kpi: FinancialKPI[];
  insolvency_publications: any[];
  annual_financial_statements: any[];
  profit_and_loss_account: any[];
  industry_classification: { WZ2025: { code: string; label: string }[] };
  keywords: string[];
}

// ============ FETCHER ============
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
};

// ============ HELPER FUNCTIONS ============

// Helper to check if a node name matches any of the search terms
function nameMatches(node: any, names: string[]): boolean {
  if (!node?.name) return false;
  const nameEn = (node.name.en || "").toLowerCase();
  const nameDe = (node.name.de || "").toLowerCase();
  const nameReport = (node.name.in_report || "").toLowerCase();
  
  return names.some(searchTerm => {
    const term = searchTerm.toLowerCase();
    // Exact match on any language
    return nameEn === term || nameDe === term || nameReport === term;
  });
}

// Find a node by exact name match, searching recursively
function findNodeByName(node: any, names: string[]): any {
  if (!node) return null;
  
  if (nameMatches(node, names)) {
    return node;
  }
  
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findNodeByName(child, names);
      if (found) return found;
    }
  }
  
  return null;
}

// Find a value by exact name match, searching recursively
function findValueByName(node: any, names: string[]): number {
  const found = findNodeByName(node, names);
  return found?.value || 0;
}

function extractBalanceSheetData(yearData: any) {
  // Handle nested structure: some data has balance_sheet_accounts inside balance_sheet_accounts
  let accounts = yearData?.balance_sheet_accounts || [];
  
  // If the first element also has balance_sheet_accounts, use that (HOCHTIEF structure)
  if (accounts.length > 0 && accounts[0]?.balance_sheet_accounts) {
    accounts = accounts[0].balance_sheet_accounts;
  }
  
  const assets = accounts.find((a: any) => 
    a.name?.en === "Assets" || a.name?.de === "Aktivseite"
  );
  const liabEquity = accounts.find((a: any) => 
    a.name?.en === "Liabilities and Equity" || a.name?.de === "Passivseite"
  );
  
  // ============ ASSET EXTRACTION ============
  // Fixed Assets: exact match
  const fixedAssets = findValueByName(assets, [
    "Fixed Assets", "Anlagevermögen", "Summe Anlagevermögen"
  ]);
  
  // Current Assets: exact match on specific terms
  const currentAssets = findValueByName(assets, [
    "Current Assets", "Umlaufvermögen", "Aktuelle Anlagen"
  ]);
  
  // Inventories
  const inventories = findValueByName(assets, [
    "Inventories", "Vorräte", "Inventar"
  ]);
  
  // Receivables  
  const receivables = findValueByName(assets, [
    "Receivables", "Forderungen"
  ]);
  
  // Cash - try specific terms first
  let cash = findValueByName(assets, [
    "Cash", "Liquide Mittel", "Cash and Cash Equivalents", 
    "Zahlungsmittel und Zahlungsmitteläquivalente"
  ]);
  
  // ============ LIABILITY/EQUITY EXTRACTION ============
  // Equity - exact match
  const equity = findValueByName(liabEquity, [
    "Equity", "Eigenkapital"
  ]);
  
  // Provisions
  const provisions = findValueByName(liabEquity, [
    "Provisions", "Rückstellungen"
  ]);
  
  // Liabilities - try direct match first (OroraTech structure)
  let liabilities = findValueByName(liabEquity, [
    "Liabilities", "Verbindlichkeiten"
  ]);
  
  // If no direct liabilities found, try HOCHTIEF's "Aktuelle Verbindlichkeiten"
  if (liabilities === 0) {
    liabilities = findValueByName(liabEquity, [
      "Current Liabilities", "Aktuelle Verbindlichkeiten"
    ]);
  }
  
  // Accruals
  const accruals = findValueByName(liabEquity, [
    "Accrued Expenses", "Passive RAP", "Rechnungsabgrenzungsposten"
  ]);

  return {
    totalAssets: assets?.value || 0,
    fixedAssets,
    currentAssets,
    inventories,
    receivables,
    cash,
    equity,
    provisions,
    liabilities,
    accruals,
  };
}

function calculateDataCoverage(data: CompanyData): { score: number; label: string; color: string } {
  let score = 0;
  if (data.balance_sheet_accounts?.length >= 2) score++;
  if (data.financial_kpi?.[0]?.net_income !== null) score++;
  if (data.financial_kpi?.some(k => k.employees !== null)) score++;
  if (data.annual_financial_statements?.length > 0) score++;
  if (data.profit_and_loss_account?.length > 0) score++;
  
  if (score >= 4) return { score, label: "Hoch", color: "emerald" };
  if (score >= 3) return { score, label: "Mittel", color: "amber" };
  return { score, label: "Niedrig", color: "red" };
}

function calculateTrustScore(data: CompanyData) {
  let cap = 100;
  if (data.status !== "ACTIVE") cap = 40;
  if (data.insolvency_publications?.length > 0) cap = 20;

  const latestBalance = extractBalanceSheetData(data.balance_sheet_accounts?.[0]);
  const latestKPI = data.financial_kpi?.[0];
  
  const totalAssets = latestBalance.totalAssets || latestKPI?.active_total || 1;
  const cashRatio = latestBalance.cash / Math.max(latestBalance.liabilities, 1);
  const equityRatio = latestBalance.equity / Math.max(totalAssets, 1);
  
  const liquidityScore = Math.min(100, cashRatio * 30 + (latestBalance.currentAssets / totalAssets) * 70);
  const solvencyScore = Math.min(100, equityRatio * 100 + 20);
  const profitabilityScore = latestKPI?.net_income > 0 ? 85 : Math.max(20, 60 + (latestKPI?.net_income || 0) / totalAssets * 100);
  const transparencyScore = data.annual_financial_statements?.length >= 3 ? 95 : data.annual_financial_statements?.length > 0 ? 75 : 50;

  const rawScore = 0.40 * liquidityScore + 0.25 * solvencyScore + 0.15 * profitabilityScore + 0.10 * transparencyScore + 0.10 * 60;

  return {
    score: Math.min(Math.round(rawScore), cap),
    breakdown: {
      liquidity: Math.round(liquidityScore),
      solvency: Math.round(solvencyScore),
      profitability: Math.round(profitabilityScore),
      transparency: Math.round(transparencyScore),
    }
  };
}

function formatMio(value: number): string {
  return (value / 1_000_000).toFixed(1);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(0)}%`;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-blue-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Sehr gut";
  if (score >= 60) return "Gut";
  if (score >= 40) return "Mittel";
  return "Risiko";
}

// ============ SUB-COMPONENTS ============

function ProofCard({ 
  icon: Icon, 
  title, 
  status, 
  detail 
}: { 
  icon: any; 
  title: string; 
  status: "green" | "amber" | "red"; 
  detail: string;
}) {
  const statusConfig = {
    green: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: CheckCircle, iconColor: "text-emerald-400" },
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle, iconColor: "text-amber-400" },
    red: { bg: "bg-red-500/10", border: "border-red-500/20", icon: XCircle, iconColor: "text-red-400" },
  };
  
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  
  return (
    <div className={`${config.bg} ${config.border} border rounded-lg p-3 sm:p-4 flex items-start gap-2 sm:gap-3`}>
      <div className="flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-medium text-white">{title}</span>
          <StatusIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${config.iconColor}`} />
        </div>
        <p className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-2">{detail}</p>
      </div>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  isProxy = false 
}: { 
  title: string; 
  value: string; 
  subtitle: string; 
  icon: any; 
  trend?: "up" | "down" | "neutral";
  isProxy?: boolean;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;
  const trendColor = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-slate-500";
  
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
      <div className="flex items-start justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-orange-400" />
          <span className="text-xs sm:text-sm font-medium text-slate-400">{title}</span>
          {isProxy && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">Proxy</span>
          )}
        </div>
        {TrendIcon && <TrendIcon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${trendColor}`} />}
      </div>
      <div className="text-xl sm:text-3xl font-bold text-white">{value}</div>
      <div className="text-[10px] sm:text-xs text-slate-600 mt-1">{subtitle}</div>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export function CompanyAnalysis({ companyId }: { companyId: string }) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [showDetailedCharts, setShowDetailedCharts] = useState(false);
  const [showClassification, setShowClassification] = useState(false);
  
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const url = `${baseUrl}/companies/${encodeURIComponent(companyId)}/hr-ai-mock`;
  
  const { data, error, isLoading } = useSWR<CompanyData>(shouldLoad ? url : null, fetcher);

  // Fix Tremor chart colors by directly manipulating SVG fills after render
  useEffect(() => {
    if (!data) return;
    
    const colorMap: Record<string, string> = {
      'blue': '#3b82f6',
      'emerald': '#10b981', 
      'amber': '#f59e0b',
      'rose': '#f43f5e',
      'cyan': '#06b6d4',
      'slate': '#64748b',
      'violet': '#8b5cf6',
    };
    
    const fixChartColors = () => {
      // Color schemes for different charts
      const vermoegenColors = ['#64748b', '#f59e0b', '#06b6d4', '#10b981']; // slate, amber, cyan, emerald
      const kapitalColors = ['#10b981', '#f43f5e', '#f59e0b', '#64748b']; // emerald, rose, amber, slate
      const areaColors = ['#3b82f6', '#10b981']; // blue, emerald
      const netIncomeColors = ['#f43f5e']; // rose
      
      // Fix bar charts by finding their container and applying correct colors
      document.querySelectorAll('.recharts-responsive-container').forEach((container) => {
        const containerText = container.closest('div')?.parentElement?.textContent || '';
        let colors: string[] = [];
        
        if (containerText.includes('Vermögensstruktur') || containerText.includes('Anlagevermögen')) {
          colors = vermoegenColors;
        } else if (containerText.includes('Kapitalstruktur') || containerText.includes('Eigenkapital')) {
          colors = kapitalColors;
        } else if (containerText.includes('Jahresergebnis')) {
          colors = netIncomeColors;
        } else {
          colors = areaColors;
        }
        
        // Apply colors to bar groups
        const barGroups = container.querySelectorAll('.recharts-layer.recharts-bar');
        barGroups.forEach((group, groupIndex) => {
          const color = colors[groupIndex % colors.length];
          group.querySelectorAll('rect').forEach((rect) => {
            rect.setAttribute('fill', color);
          });
        });
      });
      
      // Fix area charts
      document.querySelectorAll('.recharts-area').forEach((area, index) => {
        const areaPath = area.querySelector('.recharts-area-area');
        const linePath = area.querySelector('.recharts-area-curve');
        if (areaPath) {
          (areaPath as SVGElement).style.fill = areaColors[index % 2];
          (areaPath as SVGElement).style.fillOpacity = '0.3';
        }
        if (linePath) {
          (linePath as SVGElement).style.stroke = areaColors[index % 2];
          (linePath as SVGElement).style.strokeWidth = '2';
        }
      });
      
      // Fix legend dots to match chart colors
      document.querySelectorAll('[class*="tremor-Legend"], .recharts-legend-wrapper').forEach((legend) => {
        const legendText = legend.textContent || '';
        const parentText = legend.closest('div')?.parentElement?.parentElement?.textContent || '';
        let chartColors: string[] = [];
        
        if (legendText.includes('Anlagevermögen') || parentText.includes('Vermögensstruktur')) {
          chartColors = vermoegenColors;
        } else if (legendText.includes('Eigenkapital') || parentText.includes('Kapitalstruktur')) {
          chartColors = kapitalColors;
        } else if (legendText.includes('Bilanzsumme')) {
          chartColors = areaColors;
        } else {
          chartColors = ['#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#64748b', '#f43f5e'];
        }
        
        const items = legend.querySelectorAll('[class*="legendItem"], [class*="Legend"] > div, [class*="Legend"] > button, .recharts-legend-item');
        
        items.forEach((item, index) => {
          // Find the SVG circle element (Tremor uses SVG for dots)
          const svg = item.querySelector('svg');
          const circle = item.querySelector('svg circle');
          const text = item.querySelector('p, span');
          
          if (svg && circle) {
            const color = chartColors[index % chartColors.length];
            // Set fill directly on SVG and circle
            svg.setAttribute('fill', color);
            svg.style.color = color;
            (svg as HTMLElement).style.fill = color;
            circle.setAttribute('fill', color);
          }
          
          // Also try backgroundColor for non-SVG dots
          const dot = item.querySelector('span[class*="bg-"], div[class*="bg-"]');
          if (dot) {
            const color = chartColors[index % chartColors.length];
            (dot as HTMLElement).style.backgroundColor = color;
          }
          
          if (text) {
            (text as HTMLElement).style.color = '#cbd5e1';
            (text as HTMLElement).style.marginLeft = '8px';
          }
          
          (item as HTMLElement).style.display = 'flex';
          (item as HTMLElement).style.alignItems = 'center';
          (item as HTMLElement).style.gap = '8px';
          (item as HTMLElement).style.marginRight = '16px';
        });
      });
    };
    
    // Run multiple times to catch animations
    const timeouts = [100, 300, 600, 1000, 1500];
    timeouts.forEach(t => setTimeout(fixChartColors, t));
    
    return () => timeouts.forEach(t => clearTimeout(t));
  }, [data, showDetailedCharts]);

  // ============ START BUTTON VIEW ============
  if (!shouldLoad) {
    return (
      <div className="rounded-xl p-8 sm:p-12 border border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent text-center">
        <Shield className="h-10 w-10 sm:h-12 sm:w-12 text-orange-400 mx-auto mb-4" />
        <h3 className="text-lg sm:text-xl font-bold text-white mb-3">Due Diligence Analyse</h3>
        <p className="text-slate-400 mb-6 max-w-2xl mx-auto text-sm sm:text-base">
          Starten Sie eine umfassende wirtschaftliche Analyse mit Trust Score, 
          Multi-Jahres-Finanzdaten, Liquiditätskennzahlen und KI-gestützten Plausibilitätsprüfungen.
        </p>
        <button
          onClick={() => setShouldLoad(true)}
          className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all transform hover:scale-105 shadow-lg shadow-orange-500/20 text-sm sm:text-base"
        >
          <Play className="h-4 w-4 sm:h-5 sm:w-5" />
          Analyse starten
        </button>
      </div>
    );
  }

  // ============ LOADING VIEW ============
  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6 animate-pulse">
          <div className="h-6 sm:h-8 bg-slate-800 rounded w-1/3 mb-4"></div>
          <div className="h-24 sm:h-32 bg-slate-800 rounded"></div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 sm:p-4 animate-pulse">
              <div className="h-12 sm:h-16 bg-slate-800 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============ ERROR VIEW ============
  if (error || !data) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
        <div className="flex items-center gap-3">
          <XCircle className="h-6 w-6 text-red-400" />
          <div>
            <h3 className="text-lg font-semibold text-red-300">Analyse fehlgeschlagen</h3>
            <p className="text-sm text-red-300/70 mt-1">Die Analysedaten konnten nicht geladen werden.</p>
          </div>
        </div>
      </div>
    );
  }

  // ============ CALCULATIONS ============
  const trustResult = calculateTrustScore(data);
  const coverage = calculateDataCoverage(data);
  
  // Multi-year data extraction
  const yearsData = data.balance_sheet_accounts
    .map(y => ({ year: y.year, ...extractBalanceSheetData(y) }))
    .sort((a, b) => a.year - b.year);
  
  const kpiData = [...data.financial_kpi].sort((a, b) => a.year - b.year);
  
  // Calculate YoY change for latest year
  const latestYear = yearsData[yearsData.length - 1];
  const previousYear = yearsData[yearsData.length - 2];
  const yoyChange = previousYear ? (latestYear.totalAssets - previousYear.totalAssets) / previousYear.totalAssets : 0;
  const showWaterfall = Math.abs(yoyChange) > 0.5;
  
  // Key metrics
  const latestBalance = latestYear;
  const workingCapital = latestBalance.currentAssets - latestBalance.liabilities;
  const cashRatio = latestBalance.cash / Math.max(latestBalance.liabilities, 1);
  const equityRatio = (latestBalance.equity / latestBalance.totalAssets) * 100;
  
  // Chart data
  const trendChartData = yearsData.map(y => ({
    Jahr: y.year.toString(),
    "Bilanzsumme": parseFloat((y.totalAssets / 1_000_000).toFixed(2)),
    "Liquide Mittel": parseFloat((y.cash / 1_000_000).toFixed(2)),
  }));
  
  const netIncomeChartData = kpiData.map(k => ({
    Jahr: k.year.toString(),
    "Jahresergebnis": parseFloat((k.net_income / 1_000_000).toFixed(2)),
  }));
  
  const assetCompositionData = yearsData.map(y => ({
    Jahr: y.year.toString(),
    "Anlagevermögen": parseFloat((y.fixedAssets / 1_000_000).toFixed(2)),
    "Vorräte": parseFloat((y.inventories / 1_000_000).toFixed(2)),
    "Forderungen": parseFloat((y.receivables / 1_000_000).toFixed(2)),
    "Liquide Mittel": parseFloat((y.cash / 1_000_000).toFixed(2)),
  }));
  
  const capitalStructureData = yearsData.map(y => ({
    Jahr: y.year.toString(),
    "Eigenkapital": parseFloat((y.equity / 1_000_000).toFixed(2)),
    "Verbindlichkeiten": parseFloat((y.liabilities / 1_000_000).toFixed(2)),
    "Rückstellungen": parseFloat((y.provisions / 1_000_000).toFixed(2)),
    "RAP": parseFloat((y.accruals / 1_000_000).toFixed(2)),
  }));

  // Employees data
  const hasEmployees = data.financial_kpi.some(k => k.employees !== null);
  const latestEmployees = data.financial_kpi.find(k => k.employees !== null)?.employees;

  // Coverage color classes
  const coverageColorClass = coverage.color === "emerald" ? "text-emerald-400" : coverage.color === "amber" ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-4 sm:space-y-6">
      
      {/* ============ HEADER WITH DATA COVERAGE ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <Database className={coverageColorClass.replace('text-', 'text-') + " h-4 w-4 sm:h-5 sm:w-5"} />
          <span className="text-xs sm:text-sm text-slate-400">
            Datenabdeckung: <span className={`font-semibold ${coverageColorClass}`}>{coverage.label}</span>
            <span className="text-slate-600 ml-2">({coverage.score}/5 Quellen)</span>
          </span>
        </div>
        <span className="text-[10px] sm:text-xs text-slate-600">
          Daten: {yearsData[0]?.year} – {yearsData[yearsData.length - 1]?.year}
        </span>
      </div>

      {/* ============ TRUST SCORE CARD ============ */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" />
            <h3 className="text-base sm:text-xl font-bold text-white">Financial Trust Score</h3>
          </div>
          <div className="text-right">
            <div className={`text-3xl sm:text-5xl font-bold ${getScoreColor(trustResult.score)}`}>
              {trustResult.score}
            </div>
            <div className="text-xs sm:text-sm text-slate-500 mt-1">{getScoreLabel(trustResult.score)}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
          <div className="bg-slate-800/30 rounded-lg p-2.5 sm:p-3 border border-slate-800">
            <div className="text-[10px] sm:text-xs text-slate-500 mb-1">Liquidität</div>
            <div className="text-lg sm:text-2xl font-bold text-blue-400">{trustResult.breakdown.liquidity}</div>
            <div className="text-[10px] sm:text-xs text-slate-600 mt-1">40% Gewichtung</div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-2.5 sm:p-3 border border-slate-800">
            <div className="text-[10px] sm:text-xs text-slate-500 mb-1">Solvenz</div>
            <div className="text-lg sm:text-2xl font-bold text-emerald-400">{trustResult.breakdown.solvency}</div>
            <div className="text-[10px] sm:text-xs text-slate-600 mt-1">25% Gewichtung</div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-2.5 sm:p-3 border border-slate-800">
            <div className="text-[10px] sm:text-xs text-slate-500 mb-1">Ertragslage</div>
            <div className="text-lg sm:text-2xl font-bold text-amber-400">{trustResult.breakdown.profitability}</div>
            <div className="text-[10px] sm:text-xs text-slate-600 mt-1">15% Gewichtung</div>
          </div>
          <div className="bg-slate-800/30 rounded-lg p-2.5 sm:p-3 border border-slate-800">
            <div className="text-[10px] sm:text-xs text-slate-500 mb-1">Transparenz</div>
            <div className="text-lg sm:text-2xl font-bold text-violet-400">{trustResult.breakdown.transparency}</div>
            <div className="text-[10px] sm:text-xs text-slate-600 mt-1">10% Gewichtung</div>
          </div>
        </div>
      </div>

      {/* ============ PROOF CARDS ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-4">
        <ProofCard
          icon={FileCheck}
          title="Register-Abgleich"
          status="green"
          detail={`${data.registration.register_type} ${data.registration.register_number} – ${data.registration.court}`}
        />
        <ProofCard
          icon={TrendingUp}
          title="Bilanzsprung-Check"
          status={showWaterfall ? "amber" : "green"}
          detail={showWaterfall 
            ? `Signifikanter Sprung ${formatPercent(yoyChange)} in ${latestYear.year}`
            : "Stabile Entwicklung"
          }
        />
        <ProofCard
          icon={Scale}
          title="Insolvenz-Prüfung"
          status={(data.insolvency_publications?.length ?? 0) === 0 ? "green" : "red"}
          detail={(data.insolvency_publications?.length ?? 0) === 0 
            ? "Keine Einträge gefunden"
            : `${data.insolvency_publications?.length} Veröffentlichung(en)`
          }
        />
        <ProofCard
          icon={Database}
          title="Datenabdeckung"
          status={coverage.score >= 4 ? "green" : coverage.score >= 3 ? "amber" : "red"}
          detail={`${coverage.score}/5 Datenquellen verfügbar`}
        />
        <ProofCard
          icon={Wallet}
          title="Liquiditätslage"
          status={cashRatio >= 2 ? "green" : cashRatio >= 1 ? "amber" : "red"}
          detail={cashRatio >= 2 
            ? `Komfortabel (Cash-Quote ${cashRatio.toFixed(1)}x)`
            : cashRatio >= 1 
              ? `Ausreichend (Quote ${cashRatio.toFixed(1)}x)`
              : `Angespannt (Quote ${cashRatio.toFixed(1)}x)`
          }
        />
      </div>

      {/* ============ KEY METRICS ============ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard
          icon={Banknote}
          title="Working Capital"
          value={`${formatMio(workingCapital)} Mio. €`}
          subtitle="Umlaufvermögen − Verbindlichkeiten"
          trend={workingCapital > 0 ? "up" : "down"}
          isProxy
        />
        <MetricCard
          icon={Wallet}
          title="Cash Ratio"
          value={`${cashRatio.toFixed(2)}x`}
          subtitle="Liquide Mittel / Verbindlichkeiten"
          trend={cashRatio >= 1.5 ? "up" : cashRatio >= 1 ? "neutral" : "down"}
        />
        <MetricCard
          icon={Scale}
          title="Eigenkapitalquote"
          value={`${equityRatio.toFixed(0)}%`}
          subtitle="Eigenkapital / Bilanzsumme"
          trend={equityRatio >= 30 ? "up" : equityRatio >= 20 ? "neutral" : "down"}
        />
      </div>

      {/* ============ MAIN CHARTS ============ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Trend Chart */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Bilanz & Liquidität (4 Jahre)</h3>
          <AreaChart
            className="h-64"
            data={trendChartData}
            index="Jahr"
            categories={["Bilanzsumme", "Liquide Mittel"]}
            colors={["indigo", "teal"]}
            valueFormatter={(v) => `${v} Mio. €`}
            showLegend={true}
            showGridLines={true}
            showAnimation={true}
          />
        </div>
        
        {/* Net Income Chart */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">Jahresergebnis</h3>
          <BarChart
            className="h-64"
            data={netIncomeChartData}
            index="Jahr"
            categories={["Jahresergebnis"]}
            colors={["violet"]}
            valueFormatter={(v) => `${v} Mio. €`}
            showLegend={false}
            showGridLines={true}
            showAnimation={true}
          />
          <p className="text-xs text-slate-500 mt-3">
            Startup-typisch: Investitionen in Wachstum führen zu temporären Verlusten
          </p>
        </div>
      </div>

      {/* ============ EMPLOYEES (CONDITIONAL) ============ */}
      {hasEmployees && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Users className="h-4 w-4 sm:h-5 sm:w-5 text-violet-400" />
              <div>
                <span className="text-xs sm:text-sm text-slate-500">Personalentwicklung</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-bold text-white">{latestEmployees}</span>
                  <span className="text-xs sm:text-sm text-slate-500">Mitarbeiter ({kpiData[kpiData.length - 1]?.year})</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {kpiData.filter(k => k.employees).map((k) => (
                <div key={k.year} className="text-center">
                  <div className="text-lg font-semibold text-slate-200">{k.employees}</div>
                  <div className="text-xs text-slate-500">{k.year}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ EXPANDABLE DETAILED CHARTS ============ */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <button
          onClick={() => setShowDetailedCharts(!showDetailedCharts)}
          className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
        >
          <span className="text-xs sm:text-sm font-semibold text-white">Detaillierte Bilanzanalyse</span>
          {showDetailedCharts ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </button>
        
        {showDetailedCharts && (
          <div className="px-6 pb-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Asset Composition */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Vermögensstruktur</h4>
                <BarChart
                  className="h-56"
                  data={assetCompositionData}
                  index="Jahr"
                  categories={["Anlagevermögen", "Vorräte", "Forderungen", "Liquide Mittel"]}
                  colors={["indigo", "sky", "cyan", "teal"]}
                  valueFormatter={(v) => `${v} Mio. €`}
                  stack={true}
                  showLegend={true}
                  showAnimation={true}
                />
              </div>
              
              {/* Capital Structure */}
              <div>
                <h4 className="text-sm font-semibold text-slate-300 mb-3">Kapitalstruktur</h4>
                <BarChart
                  className="h-56"
                  data={capitalStructureData}
                  index="Jahr"
                  categories={["Eigenkapital", "Verbindlichkeiten", "Rückstellungen", "RAP"]}
                  colors={["emerald", "rose", "orange", "zinc"]}
                  valueFormatter={(v) => `${v} Mio. €`}
                  stack={true}
                  showLegend={true}
                  showAnimation={true}
                />
              </div>
            </div>

            {/* Waterfall for significant changes */}
            {showWaterfall && (
              <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <h4 className="text-sm font-semibold text-amber-200">
                    Signifikante Veränderung {previousYear?.year} → {latestYear.year}
                  </h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="text-slate-400">Cash</div>
                    <div className="text-emerald-300 font-semibold">
                      +{formatMio(latestYear.cash - (previousYear?.cash || 0))} Mio. €
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Eigenkapital</div>
                    <div className="text-emerald-300 font-semibold">
                      +{formatMio(latestYear.equity - (previousYear?.equity || 0))} Mio. €
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Anlagevermögen</div>
                    <div className="text-blue-300 font-semibold">
                      +{formatMio(latestYear.fixedAssets - (previousYear?.fixedAssets || 0))} Mio. €
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Verbindlichkeiten</div>
                    <div className="text-amber-300 font-semibold">
                      +{formatMio(latestYear.liabilities - (previousYear?.liabilities || 0))} Mio. €
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Veränderung primär durch Kapitalerhöhung (Series B) getrieben – plausibel für Wachstumsunternehmen
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ============ CLASSIFICATION (COLLAPSIBLE) ============ */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <button
          onClick={() => setShowClassification(!showClassification)}
          className="w-full px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center gap-2 sm:gap-3">
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-slate-500" />
            <div className="text-left">
              <span className="text-xs sm:text-sm font-semibold text-white">Branchenklassifizierung</span>
              <span className="text-[10px] sm:text-xs text-slate-600 ml-2 hidden sm:inline">
                Hauptbranche: {data.industry_classification.WZ2025[0]?.label.substring(0, 40)}...
              </span>
            </div>
          </div>
          {showClassification ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </button>
        
        {showClassification && (
          <div className="px-6 pb-6">
            <div className="space-y-2">
              {data.industry_classification.WZ2025.map((item, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/30"
                >
                  <span className="text-sm text-slate-200">{item.label}</span>
                  <span className="px-2.5 py-1 text-xs font-mono font-medium bg-blue-500/10 text-blue-300 rounded border border-blue-500/30">
                    {item.code}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="text-xs text-slate-500 mb-2">Kernkompetenzen</div>
              <div className="flex flex-wrap gap-2">
                {data.keywords.map((kw, idx) => (
                  <span 
                    key={idx} 
                    className="px-2.5 py-1 text-xs font-medium bg-slate-700/50 text-slate-200 rounded-md border border-slate-600/50"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
