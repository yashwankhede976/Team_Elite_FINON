/**
 * categoriser.ts
 * ────────────────────────────────────────────────────────────
 * Client-side UPI transaction categorisation engine.
 * Uses keyword matching against the merchant dictionary.
 * Also provides:
 *   - Subscription detector (recurring merchants)
 *   - Merchant ranker (top spenders)
 *   - Rule-based savings recommendations
 *
 * Zero network calls — all logic runs in the browser.
 */

import type { UPITransaction } from './upiParser';
import { MERCHANT_CATEGORIES } from './merchant_categories';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategorisedTransaction extends UPITransaction {
  category: string;
  merchantName: string;
}

export interface MerchantSummary {
  name: string;
  totalSpent: number;
  count: number;
  category: string;
  avgAmount: number;
}

export interface SubscriptionSummary {
  merchantName: string;
  category: string;
  avgAmount: number;
  occurrences: number;
  months: string[];
}

export interface CategorySummary {
  name: string;
  amount: number;
  count: number;
  percentage: number;
  color: string;
}

export interface SavingsRecommendation {
  title: string;
  description: string;
  potentialSavings: string;
  priority: 'high' | 'medium' | 'low';
  icon: string;
}

// ─── Category Colours ─────────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining':     '#f59e0b',
  'Transport':         '#06b6d4',
  'Shopping':          '#ec4899',
  'Utilities':         '#8b5cf6',
  'Healthcare':        '#10b981',
  'Entertainment':     '#f97316',
  'Subscriptions':     '#ef4444',
  'Education':         '#6366f1',
  'Housing & Rent':    '#a855f7',
  'Personal Care':     '#14b8a6',
  'Finance & Insurance': '#3b82f6',
  'Travel':            '#84cc16',
  'Transfers':         '#94a3b8',
  'Income':            '#22c55e',
  'Other':             '#475569',
};

// ─── Categorise ───────────────────────────────────────────────────────────────

export function categorise(description: string): string {
  const lower = description.toLowerCase();

  // Quick income detection
  if (
    lower.includes('salary') || lower.includes('neft credit') ||
    lower.startsWith('received from') || lower.includes('cashback') ||
    lower.includes('refund') || lower.includes('credit by') ||
    lower.startsWith('receivedfrom')
  ) {
    return 'Income';
  }

  // Peer transfers — Google Pay "Paid to PersonName" (no business keywords)
  if (
    lower.includes('upi/p2p') || lower.startsWith('sent to') ||
    lower.includes('transfer to') || lower.includes('split') ||
    lower.includes('self transfer') || lower.includes('selftransfer')
  ) {
    return 'Transfers';
  }

  // Check against merchant keyword dictionary
  for (const [category, keywords] of Object.entries(MERCHANT_CATEGORIES)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return category;
    }
  }

  // Google Pay "Paid to PersonName" — if no match, likely a P2P transfer
  if (lower.startsWith('paid to ') || lower.startsWith('paidto')) {
    // If it looks like a person name (all caps or mixed case, no known merchant keywords)
    const merchant = lower.replace(/^paid\s?to\s*/i, '').trim();
    // Person names tend to be short and all letters
    if (merchant.length < 35 && /^[a-z\s]+$/i.test(merchant)) {
      return 'Transfers';
    }
  }

  return 'Other';
}

/** Extract a clean merchant name from description */
function extractMerchantName(description: string): string {
  return description
    // Google Pay prefixes (from PDF)
    .replace(/^Paid to\s*/i, '')
    .replace(/^Received from\s*/i, '')
    .replace(/^Self transfer\s*(to|from)?\s*/i, 'Self Transfer ')
    // Generic UPI prefixes
    .replace(/^UPI[/\-]?/i, '')
    .replace(/^NEFT[/\-]?/i, '')
    .replace(/^IMPS[/\-]?/i, '')
    .replace(/^Paid to\s*/i, '')
    .replace(/^Sent to\s*/i, '')
    .replace(/^Transfer to\s*/i, '')
    .replace(/P2P.*/i, '')
    .split('@')[0]
    .split('/')[0]
    .trim()
    .slice(0, 40);
}

// ─── Main Processor ───────────────────────────────────────────────────────────

export function processTransactions(txns: UPITransaction[]): CategorisedTransaction[] {
  return txns.map(t => ({
    ...t,
    category: categorise(t.description),
    merchantName: extractMerchantName(t.description),
  }));
}

// ─── Category Summary ─────────────────────────────────────────────────────────

export function getCategorySummary(txns: CategorisedTransaction[]): CategorySummary[] {
  const expenses = txns.filter(t => t.debit > 0 && t.category !== 'Income' && t.category !== 'Transfers');
  const total = expenses.reduce((s, t) => s + t.debit, 0);

  const map: Record<string, { amount: number; count: number }> = {};
  for (const t of expenses) {
    if (!map[t.category]) map[t.category] = { amount: 0, count: 0 };
    map[t.category].amount += t.debit;
    map[t.category].count += 1;
  }

  return Object.entries(map)
    .map(([name, { amount, count }]) => ({
      name,
      amount: Math.round(amount),
      count,
      percentage: total > 0 ? (amount / total) * 100 : 0,
      color: CATEGORY_COLORS[name] || '#475569',
    }))
    .sort((a, b) => b.amount - a.amount);
}

// ─── Monthly Trend ────────────────────────────────────────────────────────────

export interface MonthlyTrend {
  month: string;    // "Jan 25"
  income: number;
  expenses: number;
  savings: number;
}

export function getMonthlyTrend(txns: CategorisedTransaction[]): MonthlyTrend[] {
  const map: Record<string, { income: number; expenses: number }> = {};

  for (const t of txns) {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (!map[key]) map[key] = { income: 0, expenses: 0 };
    if (t.credit > 0) map[key].income += t.credit;
    if (t.debit > 0) map[key].expenses += t.debit;
  }

  // Sort chronologically
  return Object.entries(map)
    .map(([month, data]) => ({
      month,
      income: Math.round(data.income),
      expenses: Math.round(data.expenses),
      savings: Math.round(data.income - data.expenses),
    }))
    .sort((a, b) => {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const [am, ay] = a.month.split(' ');
      const [bm, by] = b.month.split(' ');
      if (ay !== by) return parseInt(ay) - parseInt(by);
      return months.indexOf(am) - months.indexOf(bm);
    });
}

// ─── Top Merchants ────────────────────────────────────────────────────────────

export function getTopMerchants(txns: CategorisedTransaction[], limit = 10): MerchantSummary[] {
  const expenses = txns.filter(t => t.debit > 0 && t.category !== 'Transfers');
  const map: Record<string, { total: number; count: number; category: string }> = {};

  for (const t of expenses) {
    const nm = t.merchantName.toLowerCase();
    if (!map[nm]) map[nm] = { total: 0, count: 0, category: t.category };
    map[nm].total += t.debit;
    map[nm].count += 1;
  }

  return Object.entries(map)
    .map(([name, { total, count, category }]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      totalSpent: Math.round(total),
      count,
      category,
      avgAmount: Math.round(total / count),
    }))
    .sort((a, b) => b.totalSpent - a.totalSpent)
    .slice(0, limit);
}

// ─── Subscription Detector ────────────────────────────────────────────────────

export function detectSubscriptions(txns: CategorisedTransaction[]): SubscriptionSummary[] {
  const expenses = txns.filter(t => t.debit > 0);

  // Group by merchant name
  const merchantMonths: Record<string, { amounts: number[]; months: Set<string>; category: string }> = {};

  for (const t of expenses) {
    const nm = t.merchantName.toLowerCase();
    const d = new Date(t.date);
    if (isNaN(d.getTime())) continue;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!merchantMonths[nm]) merchantMonths[nm] = { amounts: [], months: new Set(), category: t.category };
    merchantMonths[nm].amounts.push(t.debit);
    merchantMonths[nm].months.add(monthKey);
  }

  const subs: SubscriptionSummary[] = [];

  for (const [name, data] of Object.entries(merchantMonths)) {
    if (data.months.size < 2) continue; // Need at least 2 months

    const avg = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
    // Check if amounts are consistent (within ±15%)
    const isConsistent = data.amounts.every(a => Math.abs(a - avg) / avg < 0.15);
    if (!isConsistent) continue;

    const months = Array.from(data.months).sort();

    subs.push({
      merchantName: name.charAt(0).toUpperCase() + name.slice(1),
      category: data.category,
      avgAmount: Math.round(avg),
      occurrences: data.months.size,
      months: months.map(m => {
        const [y, mo] = m.split('-');
        return new Date(parseInt(y), parseInt(mo) - 1, 1)
          .toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      }),
    });
  }

  return subs.sort((a, b) => b.avgAmount - a.avgAmount);
}

// ─── AI-Style Savings Recommendations (rule-based) ────────────────────────────

export function generateRecommendations(
  txns: CategorisedTransaction[],
  categories: CategorySummary[],
  subscriptions: SubscriptionSummary[],
): SavingsRecommendation[] {
  const recs: SavingsRecommendation[] = [];
  const totalExpenses = categories.reduce((s, c) => s + c.amount, 0);
  const totalIncome = Math.round(txns.filter(t => t.credit > 0).reduce((s, t) => s + t.credit, 0));

  // ── 1. Food overspending ──
  const food = categories.find(c => c.name === 'Food & Dining');
  if (food && totalIncome > 0 && (food.amount / totalIncome) > 0.25) {
    const excess = Math.round(food.amount * 0.3);
    recs.push({
      title: 'Cut Food Delivery Costs',
      description: `You spent ₹${food.amount.toLocaleString('en-IN')} on food & dining — ${food.percentage.toFixed(0)}% of expenses. Cooking at home 3–4 days a week and limiting delivery to weekends could save you significantly.`,
      potentialSavings: `₹${excess.toLocaleString('en-IN')}/month`,
      priority: 'high',
      icon: '🍽️',
    });
  }

  // ── 2. Subscription audit ──
  const subTotal = subscriptions.reduce((s, sub) => s + sub.avgAmount, 0);
  if (subscriptions.length >= 3) {
    recs.push({
      title: 'Review Your Subscriptions',
      description: `You have ${subscriptions.length} recurring subscriptions costing ₹${subTotal.toLocaleString('en-IN')}/month. Review which ones you actively use — cancelling 2–3 unused subscriptions can free up a meaningful amount.`,
      potentialSavings: `₹${Math.round(subTotal * 0.4).toLocaleString('en-IN')}/month`,
      priority: 'high',
      icon: '📱',
    });
  }

  // ── 3. Transport savings ──
  const transport = categories.find(c => c.name === 'Transport');
  if (transport && transport.amount > 2000) {
    const saving = Math.round(transport.amount * 0.25);
    recs.push({
      title: 'Optimise Travel Costs',
      description: `Your transport spend is ₹${transport.amount.toLocaleString('en-IN')}. Consider monthly metro passes, carpooling, or switching some Uber/Ola rides to Rapido/auto for short distances.`,
      potentialSavings: `₹${saving.toLocaleString('en-IN')}/month`,
      priority: 'medium',
      icon: '🚗',
    });
  }

  // ── 4. Entertainment limits ──
  const entertainment = categories.find(c => c.name === 'Entertainment');
  if (entertainment && totalIncome > 0 && (entertainment.amount / totalIncome) > 0.1) {
    const saving = Math.round(entertainment.amount * 0.35);
    recs.push({
      title: 'Set an Entertainment Budget',
      description: `Entertainment expenses account for ${entertainment.percentage.toFixed(0)}% of your spending. Setting a fixed monthly cap and using free streaming alternatives on some days can help.`,
      potentialSavings: `₹${saving.toLocaleString('en-IN')}/month`,
      priority: 'medium',
      icon: '🎬',
    });
  }

  // ── 5. Savings rate ──
  const expensesTotal = categories.filter(c => c.name !== 'Income').reduce((s, c) => s + c.amount, 0);
  const savingsRate = totalIncome > 0 ? ((totalIncome - expensesTotal) / totalIncome) * 100 : 0;
  if (savingsRate < 20 && totalIncome > 0) {
    const targetSavings = Math.round(totalIncome * 0.2);
    recs.push({
      title: 'Boost Your Savings Rate to 20%',
      description: `Your current savings rate is ~${savingsRate.toFixed(0)}%. Financial experts recommend saving at least 20% of income. Try setting up a recurring auto-transfer to a separate savings account on payday.`,
      potentialSavings: `Target ₹${targetSavings.toLocaleString('en-IN')}/month`,
      priority: 'high',
      icon: '💰',
    });
  }

  // ── 6. Shopping consolidation ──
  const shopping = categories.find(c => c.name === 'Shopping');
  if (shopping && shopping.count > 8) {
    recs.push({
      title: 'Consolidate Online Shopping',
      description: `You made ${shopping.count} shopping transactions. Batching purchases into 1–2 orders per week avoids impulse buys and qualifies for free delivery thresholds, saving on delivery fees too.`,
      potentialSavings: `₹${Math.round(shopping.amount * 0.15).toLocaleString('en-IN')}/month`,
      priority: 'low',
      icon: '🛒',
    });
  }

  // ── 7. Emergency fund nudge ──
  if (savingsRate < 10 && totalIncome > 0) {
    recs.push({
      title: 'Build an Emergency Fund First',
      description: 'With a low savings rate, you may be vulnerable to unexpected expenses. Start by saving ₹500–₹1,000 per week in a liquid fund or savings account until you have 3 months of expenses covered.',
      potentialSavings: 'Financial security',
      priority: 'high',
      icon: '🛡️',
    });
  }

  // Ensure output always has 3-5 actionable recommendations for hackathon requirement.
  if (recs.length < 3) {
    const fallbackPool: SavingsRecommendation[] = [
      {
        title: 'Adopt a Weekly Spending Cap',
        description: 'Set a weekly cap for discretionary categories and track it every Sunday. Short feedback loops reduce overspending faster than monthly reviews.',
        potentialSavings: `₹${Math.max(500, Math.round(totalExpenses * 0.05)).toLocaleString('en-IN')}/month`,
        priority: 'medium',
        icon: '📊',
      },
      {
        title: 'Create a No-Spend Day Routine',
        description: 'Pick 1-2 fixed no-spend days each week for food delivery and impulse purchases. This simple habit reduces small leaks significantly over time.',
        potentialSavings: `₹${Math.max(400, Math.round(totalExpenses * 0.04)).toLocaleString('en-IN')}/month`,
        priority: 'low',
        icon: '🧭',
      },
      {
        title: 'Enable Auto-Save After Salary Credit',
        description: 'Automate a transfer to savings right after salary is credited. Pay-yourself-first prevents leftover-based saving and improves consistency.',
        potentialSavings: `₹${Math.max(1000, Math.round(totalIncome * 0.1)).toLocaleString('en-IN')}/month`,
        priority: 'high',
        icon: '🏦',
      },
    ];

    for (const fallback of fallbackPool) {
      if (recs.length >= 3) break;
      if (!recs.some(r => r.title === fallback.title)) recs.push(fallback);
    }
  }

  // Return top 5 by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recs
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 5);
}
