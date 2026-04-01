import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, ShieldCheck, FileText, BarChart3, RefreshCw, AlertCircle,
  TrendingDown, TrendingUp, Repeat, Award, Lightbulb, X, Download,
  CheckCircle, Loader2, ChevronDown, ChevronUp, CreditCard,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, BarChart, Bar, Legend,
} from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';
import { parseCSV, parsePDFText, extractPDFText } from '../../lib/upiParser';
import {
  processTransactions, getCategorySummary, getMonthlyTrend,
  getTopMerchants, detectSubscriptions, generateRecommendations,
  CATEGORY_COLORS,
} from '../../lib/categoriser';
import type {
  CategorisedTransaction, CategorySummary, MonthlyTrend,
  MerchantSummary, SubscriptionSummary, SavingsRecommendation,
} from '../../lib/categoriser';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AnalysisResult {
  transactions: CategorisedTransaction[];
  categories: CategorySummary[];
  monthlyTrend: MonthlyTrend[];
  topMerchants: MerchantSummary[];
  subscriptions: SubscriptionSummary[];
  recommendations: SavingsRecommendation[];
  totalIncome: number;
  totalExpenses: number;
  totalTransactions: number;
  fileName: string;
}

const SESSION_KEY = 'upi_local_analysis_v1';

// ─── Sub-components ───────────────────────────────────────────────────────────

const CustomPieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="text-xs px-3 py-2 rounded-xl shadow-xl"
      style={{ background: 'rgba(10,10,26,0.95)', border: '1px solid rgba(168,85,247,0.2)' }}>
      <p className="font-bold text-white">{payload[0]?.name}</p>
      <p className="text-purple-300">₹{payload[0]?.value?.toLocaleString('en-IN')}</p>
      <p className="text-slate-400">{payload[0]?.payload?.percentage?.toFixed(1)}%</p>
    </div>
  );
};

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="text-xs px-3 py-2 rounded-xl shadow-xl"
      style={{ background: 'rgba(10,10,26,0.95)', border: '1px solid rgba(168,85,247,0.2)' }}>
      <p className="text-slate-400 mb-1 font-bold uppercase tracking-widest text-[10px]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-300 capitalize">{p.name}:</span>
          <span className="text-white font-bold">₹{p.value?.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UPIAnalyser() {
  const { isDark } = useTheme();
  const [dragOver, setDragOver] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'categories' | 'merchants' | 'subscriptions' | 'recommendations'>('overview');
  const [expandedRec, setExpandedRec] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore the latest session-only analysis for this browser tab/session.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AnalysisResult;
      if (parsed && Array.isArray(parsed.transactions)) {
        setResult(parsed);
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // ── Process uploaded file ──────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      let rawTxns;

      if (file.name.toLowerCase().endsWith('.csv')) {
        const text = await file.text();
        rawTxns = parseCSV(text);
      } else if (file.name.toLowerCase().endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        const text = await extractPDFText(buffer);
        rawTxns = parsePDFText(text);
      } else {
        throw new Error('Please upload a CSV or PDF file only.');
      }

      if (rawTxns.length === 0) {
        throw new Error('No transactions found in the file. Please check the format.');
      }

      const categorised = processTransactions(rawTxns);
      const categories = getCategorySummary(categorised);
      const monthlyTrend = getMonthlyTrend(categorised);
      const topMerchants = getTopMerchants(categorised, 10);
      const subscriptions = detectSubscriptions(categorised);
      const recommendations = generateRecommendations(categorised, categories, subscriptions);

      const totalIncome = Math.round(categorised.filter(t => t.credit > 0).reduce((s, t) => s + t.credit, 0));
      const totalExpenses = Math.round(categories.reduce((s, c) => s + c.amount, 0));

      const nextResult: AnalysisResult = {
        transactions: categorised,
        categories,
        monthlyTrend,
        topMerchants,
        subscriptions,
        recommendations,
        totalIncome,
        totalExpenses,
        totalTransactions: rawTxns.length,
        fileName: file.name,
      };

      setResult(nextResult);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextResult));
      setActiveTab('overview');
    } catch (err: any) {
      setError(err.message || 'Failed to parse file. Please try a different format.');
    } finally {
      setProcessing(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  // ── CSS helpers ──────────────────────────────────────────────────────────
  const card = `rounded-2xl border ${isDark ? 'bg-[#0a0a1a]/80 border-white/5' : 'bg-white border-black/5 shadow-sm'}`;
  const tabBase = 'px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-xl transition-all duration-200';
  const tabActive = `${tabBase} ${isDark ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-purple-500/10 text-purple-700 border border-purple-500/20'}`;
  const tabInactive = `${tabBase} ${isDark ? 'text-slate-500 hover:text-slate-300 hover:bg-white/5' : 'text-slate-400 hover:text-slate-700 hover:bg-black/5'}`;

  const savingsRate = result && result.totalIncome > 0
    ? ((result.totalIncome - result.totalExpenses) / result.totalIncome * 100).toFixed(1)
    : '0.0';

  // ─── Upload Zone ──────────────────────────────────────────────────────────
  if (!result && !processing) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <ShieldCheck size={13} className="text-purple-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-purple-400">Privacy First — Data Never Leaves Your Browser</span>
          </div>
          <h1 className={`font-bold text-3xl lg:text-4xl tracking-tight mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Document <span className="text-gradient">Analyser</span>
          </h1>
          <p className={`text-sm max-w-lg mx-auto ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Upload your bank statement (PDF or CSV). Get instant spending intelligence — 
            auto-categorised, visualised, and equipped with personalised savings tips.
          </p>
        </div>

        {/* Privacy badges */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: ShieldCheck, label: 'Zero Server Storage', desc: 'All parsing runs in your browser' },
            { icon: FileText, label: 'PDF & CSV Support', desc: 'All major bank formats' },
            { icon: Lightbulb, label: 'AI-Style Insights', desc: '3–5 personalised recommendations' },
          ].map((b) => (
            <div key={b.label} className={`${card} p-4 text-center`}>
              <div className="inline-flex p-2 rounded-xl mb-2" style={{ background: 'rgba(168,85,247,0.1)' }}>
                <b.icon size={16} className="text-purple-400" />
              </div>
              <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{b.label}</p>
              <p className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{b.desc}</p>
            </div>
          ))}
        </div>

        {/* Drop Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer rounded-2xl border-2 border-dashed p-16 text-center transition-all duration-300"
          style={{
            borderColor: dragOver ? 'rgba(168,85,247,0.6)' : 'rgba(168,85,247,0.2)',
            background: dragOver
              ? 'rgba(168,85,247,0.06)'
              : isDark ? 'rgba(168,85,247,0.02)' : 'rgba(168,85,247,0.01)',
          }}>
          <input ref={fileInputRef} type="file" accept=".csv,.pdf" className="hidden" onChange={handleFileChange} />
          <motion.div animate={{ y: dragOver ? -8 : 0 }} className="flex flex-col items-center gap-4">
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(168,85,247,0.1)' }}>
              <Upload size={32} className="text-purple-400" />
            </div>
            <div>
              <p className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {dragOver ? 'Drop to Analyse' : 'Drop your bank statement here'}
              </p>
              <p className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                or <span className="text-purple-400 font-semibold">click to browse</span> — supports PDF & CSV
              </p>
            </div>
            <div className="flex items-center gap-3 mt-2">
              {['PDF', 'CSV'].map(f => (
                <span key={f} className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7' }}>
                  {f}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Sample tip */}
        <div className={`${card} p-4 flex items-start gap-3`}>
          <Award size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className={`text-xs font-bold mb-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Test with Sample Data</p>
            <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
              No statement? Run <code className="px-1.5 py-0.5 rounded text-purple-400" style={{ background: 'rgba(168,85,247,0.1)' }}>python generate_upi_statement.py</code> from the project root to generate a realistic sample CSV.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Processing ───────────────────────────────────────────────────────────
  if (processing) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
          <Loader2 size={36} className="text-purple-400" />
        </motion.div>
        <p className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
          Analysing your statement in your browser…
        </p>
        <p className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
          Zero data sent to any server ✓
        </p>
      </div>
    );
  }

  // ─── Dashboard ────────────────────────────────────────────────────────────
  if (!result) return null;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">

      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between border-b pb-6 ${isDark ? 'border-purple-500/10' : 'border-black/5'}`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className={`text-[10px] font-bold uppercase tracking-[0.4em] ${isDark ? 'text-green-400' : 'text-green-600'}`}>Analysis Complete</span>
          </div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            UPI <span className="text-gradient">Spending Dashboard</span>
          </h1>
          <p className={`text-xs mt-1 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
            {result.fileName} · {result.totalTransactions} transactions · Processed locally in your browser
          </p>
        </div>
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#22c55e' }}>
            <ShieldCheck size={12} /> Data never stored
          </div>
          <button onClick={() => { setResult(null); setError(null); sessionStorage.removeItem(SESSION_KEY); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', color: '#a855f7' }}>
            <Upload size={13} /> New Upload
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Income', value: `₹${result.totalIncome.toLocaleString('en-IN')}`, icon: TrendingUp, color: '#22c55e', bg: 'rgba(34,197,94,0.06)', border: 'rgba(34,197,94,0.15)' },
          { label: 'Total Expenses', value: `₹${result.totalExpenses.toLocaleString('en-IN')}`, icon: TrendingDown, color: '#ef4444', bg: 'rgba(239,68,68,0.06)', border: 'rgba(239,68,68,0.15)' },
          { label: 'Net Savings', value: `₹${(result.totalIncome - result.totalExpenses).toLocaleString('en-IN')}`, icon: BarChart3, color: '#a855f7', bg: 'rgba(168,85,247,0.06)', border: 'rgba(168,85,247,0.15)' },
          { label: 'Savings Rate', value: `${savingsRate}%`, icon: Award, color: parseFloat(savingsRate) >= 20 ? '#22c55e' : '#f59e0b', bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.15)' },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`${card} p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{kpi.label}</span>
              <div className="p-1.5 rounded-lg" style={{ background: kpi.bg, border: `1px solid ${kpi.border}` }}>
                <kpi.icon size={13} style={{ color: kpi.color }} />
              </div>
            </div>
            <p className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ color: kpi.color }}>{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap gap-2">
        {([
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'categories', label: 'Categories', icon: CreditCard },
          { id: 'merchants', label: 'Top Merchants', icon: Award },
          { id: 'subscriptions', label: `Subscriptions (${result.subscriptions.length})`, icon: Repeat },
          { id: 'recommendations', label: `Savings Tips (${result.recommendations.length})`, icon: Lightbulb },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={activeTab === tab.id ? tabActive : tabInactive}>
            <span className="flex items-center gap-1.5">
              <tab.icon size={12} />{tab.label}
            </span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie chart */}
              <div className={`${card} p-6`}>
                <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Spending by Category</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={result.categories} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={55} paddingAngle={2}>
                      {result.categories.map((c) => (
                        <Cell key={c.name} fill={CATEGORY_COLORS[c.name] || '#475569'} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {result.categories.slice(0, 8).map(c => (
                    <div key={c.name} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[c.name] || '#475569' }} />
                      <span className={`text-[11px] truncate ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{c.name}</span>
                      <span className="text-[10px] ml-auto" style={{ color: CATEGORY_COLORS[c.name] || '#475569' }}>{c.percentage.toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly trend */}
              <div className={`${card} p-6`}>
                <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Monthly Income vs Expenses</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={result.monthlyTrend}>
                    <defs>
                      <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="expGrad2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" stroke="#475569" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#475569" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomAreaTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#incGrad)" strokeWidth={2} name="Income" />
                    <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#expGrad2)" strokeWidth={2} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── CATEGORIES TAB ── */}
          {activeTab === 'categories' && (
            <div className="space-y-3">
              <div className={`${card} p-6`}>
                <h3 className={`font-bold text-sm mb-5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Category Breakdown</h3>
                <div className="space-y-4">
                  {result.categories.map((cat) => (
                    <div key={cat.name}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[cat.name] || '#475569' }} />
                          <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{cat.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${isDark ? 'bg-white/5 text-slate-500' : 'bg-black/5 text-slate-400'}`}>{cat.count} txns</span>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{cat.amount.toLocaleString('en-IN')}</span>
                          <span className={`text-[11px] ml-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{cat.percentage.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                        <motion.div className="h-full rounded-full" initial={{ width: 0 }}
                          animate={{ width: `${cat.percentage}%` }} transition={{ duration: 0.8, delay: 0.1 }}
                          style={{ background: CATEGORY_COLORS[cat.name] || '#475569' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar chart comparison */}
              <div className={`${card} p-6`}>
                <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>Spending by Category (Chart)</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={result.categories} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" stroke="#475569" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="#475569" tick={{ fontSize: 10 }} width={110} />
                    <Tooltip content={<CustomPieTooltip />} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                      {result.categories.map(c => (
                        <Cell key={c.name} fill={CATEGORY_COLORS[c.name] || '#475569'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── MERCHANTS TAB ── */}
          {activeTab === 'merchants' && (
            <div className={`${card} p-6`}>
              <h3 className={`font-bold text-sm mb-5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Top Spending Merchants</h3>
              <div className="space-y-3">
                {result.topMerchants.map((m, i) => (
                  <motion.div key={m.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isDark ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]' : 'bg-black/[0.02] border-black/5 hover:bg-black/[0.04]'}`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-500/5 text-purple-600'}`}>
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{m.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: `${CATEGORY_COLORS[m.category] || '#475569'}15`, color: CATEGORY_COLORS[m.category] || '#475569', border: `1px solid ${CATEGORY_COLORS[m.category] || '#475569'}30` }}>
                          {m.category}
                        </span>
                        <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{m.count} transactions</span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>₹{m.totalSpent.toLocaleString('en-IN')}</p>
                      <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>avg ₹{m.avgAmount.toLocaleString('en-IN')}</p>
                    </div>
                  </motion.div>
                ))}
                {result.topMerchants.length === 0 && (
                  <p className={`text-center py-10 text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>No merchant data detected</p>
                )}
              </div>
            </div>
          )}

          {/* ── SUBSCRIPTIONS TAB ── */}
          {activeTab === 'subscriptions' && (
            <div className={`${card} p-6`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <Repeat size={14} className="text-red-400" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>Detected Recurring Subscriptions</h3>
                  <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Same merchant, consistent amount across ≥2 months
                  </p>
                </div>
              </div>
              {result.subscriptions.length > 0 ? (
                <div className="space-y-3">
                  {result.subscriptions.map((sub, i) => (
                    <motion.div key={sub.merchantName} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="flex items-center justify-between p-4 rounded-xl"
                      style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
                      <div>
                        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{sub.merchantName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ background: `${CATEGORY_COLORS[sub.category] || '#475569'}15`, color: CATEGORY_COLORS[sub.category] || '#475569' }}>
                            {sub.category}
                          </span>
                          <span className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            Seen in: {sub.months.join(', ')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0">
                        <p className="text-base font-bold text-red-400">₹{sub.avgAmount.toLocaleString('en-IN')}</p>
                        <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>/month × {sub.occurrences}</p>
                      </div>
                    </motion.div>
                  ))}
                  <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <p className="text-sm text-yellow-400 font-bold">
                      Total monthly subscription cost: ₹{result.subscriptions.reduce((s, sub) => s + sub.avgAmount, 0).toLocaleString('en-IN')}
                    </p>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                      Review and cancel services you no longer actively use.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10">
                  <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>No recurring subscriptions detected</p>
                </div>
              )}
            </div>
          )}

          {/* ── RECOMMENDATIONS TAB ── */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              <div className={`${card} p-5 flex items-center gap-3`}>
                <div className="p-2.5 rounded-xl" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <Lightbulb size={18} className="text-green-400" />
                </div>
                <div>
                  <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    AI-Generated Savings Recommendations
                  </h3>
                  <p className={`text-[11px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    Personalised tips based on your actual UPI spending patterns
                  </p>
                </div>
              </div>

              {result.recommendations.map((rec, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  className={`${card} overflow-hidden`}>
                  <button className="w-full p-5 text-left" onClick={() => setExpandedRec(expandedRec === i ? null : i)}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{rec.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{rec.title}</p>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest"
                            style={{
                              background: rec.priority === 'high' ? 'rgba(239,68,68,0.1)' : rec.priority === 'medium' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                              color: rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#22c55e',
                              border: `1px solid ${rec.priority === 'high' ? 'rgba(239,68,68,0.2)' : rec.priority === 'medium' ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.2)'}`,
                            }}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-green-400 font-bold text-xs mt-0.5">
                          Potential: {rec.potentialSavings}
                        </p>
                      </div>
                      {expandedRec === i ? <ChevronUp size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} /> : <ChevronDown size={16} className={isDark ? 'text-slate-400' : 'text-slate-500'} />}
                    </div>
                  </button>
                  <AnimatePresence>
                    {expandedRec === i && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <div className={`px-5 pb-5 text-sm leading-relaxed border-t ${isDark ? 'text-slate-300 border-white/5' : 'text-slate-700 border-black/5'}`}>
                          <p className="pt-4">{rec.description}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}

              {result.recommendations.length === 0 && (
                <div className={`${card} p-10 text-center`}>
                  <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
                  <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Your spending looks healthy! No major improvements detected.
                  </p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Transaction table preview */}
      {activeTab === 'overview' && (
        <div className={`${card} p-6`}>
          <h3 className={`font-bold text-sm mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Recent Transactions <span className={`text-xs font-normal ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>(Top 20)</span>
          </h3>
          <div className="space-y-2">
            {result.transactions.slice(0, 20).map((t, i) => (
              <motion.div key={t.txnId + i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-black/[0.01] border-black/5'}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: t.debit > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)' }}>
                    {t.debit > 0 ? <TrendingDown size={14} className="text-red-400" /> : <TrendingUp size={14} className="text-green-400" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{t.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ background: `${CATEGORY_COLORS[t.category] || '#475569'}15`, color: CATEGORY_COLORS[t.category] || '#475569' }}>
                        {t.category}
                      </span>
                      <span className={`text-[10px] ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t.date}</span>
                    </div>
                  </div>
                </div>
                <p className={`text-sm font-bold ml-3 flex-shrink-0 ${t.debit > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {t.debit > 0 ? '-' : '+'}₹{(t.debit || t.credit).toLocaleString('en-IN')}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
