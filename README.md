# 🔒 UPI Transaction Statement Analyser & Savings Intelligence Tool

> **Team Elite FINON** — FinTech Hackathon Submission

A **privacy-first** web tool that accepts UPI transaction statements (PDF/CSV), auto-categorises every transaction, generates a visual spending dashboard with monthly trends and category breakdowns, identifies top spending merchants, flags potentially recurring subscriptions, and produces 3–5 personalised AI-generated savings recommendations — all **without ever sending your data to a server**.


---

## 🛡️ Privacy Architecture

**Core principle: Your financial data never leaves your browser.**

```
User uploads PDF/CSV
        ↓
  Browser memory (React state)
        ↓
  pdfjs-dist (PDF text extraction) — runs in browser Web Worker
        ↓
  Papa Parse (CSV parsing) — runs in browser
        ↓
  Categorisation engine (merchant_categories.ts) — runs in browser
        ↓
  Recharts visualisation — renders in browser
        ↓
  Rule-based recommendations — computed in browser
        ↓
  Session ends → all data gone (no localStorage, no cookies, no server calls)
```

No server-side storage, no database writes, no third-party analytics on your statement data. The backend (Django) is only used for user authentication — the UPI statement itself is never sent there.

---

## ✨ Features

| Feature | Status |
|---|---|
| PDF Statement Upload | ✅ (pdfjs-dist client-side) |
| CSV Statement Upload | ✅ (Papa Parse client-side) |
| Auto-categorisation (keyword-based) | ✅ 13 categories, 200+ merchants |
| Spending Dashboard (charts) | ✅ Pie, Area, Bar charts |
| Monthly Trend Analysis | ✅ Income vs Expenses by month |
| Top Merchant Ranking | ✅ Top 10 merchants by spend |
| Subscription Detector | ✅ Same merchant ±15% amount, ≥2 months |
| AI Savings Recommendations | ✅ 3–5 personalised, rule-based |
| No Server Storage | ✅ All processing client-side |
| Synthetic Data Generator | ✅ `generate_upi_statement.py` |

---

## 🗂️ Project Structure

```
Team_Elite_FINON/
├── generate_upi_statement.py      ← Synthetic UPI statement generator
├── merchant_categories.json       ← Merchant keyword dictionary (JSON)
├── sample_upi_statement.csv       ← Sample 3-month synthetic CSV
├── sample_upi_statement_jan.csv
├── sample_upi_statement_feb.csv
├── sample_upi_statement_mar.csv
│
├── frontend/
│   └── src/
│       ├── lib/
│       │   ├── upiParser.ts           ← PDF + CSV parsing utilities
│       │   ├── categoriser.ts         ← Categorisation engine
│       │   └── merchant_categories.ts ← Bundled keyword dictionary
│       └── pages/dashboard/
│           └── UPIAnalyser.tsx        ← Main analyser dashboard page
│
└── backend/                        ← Django (auth only, no UPI data stored)
```

---

## 🏪 Merchant Categorisation Dictionary

File: [`merchant_categories.json`](./merchant_categories.json)

The dictionary maps **merchant name keywords** → **spending category**:

```json
{
  "Food & Dining": ["swiggy", "zomato", "dominos", "bigbasket", "blinkit", ...],
  "Transport":     ["ola", "uber", "rapido", "irctc", "fastag", ...],
  "Shopping":      ["amazon", "flipkart", "myntra", "nykaa", ...],
  "Subscriptions": ["netflix", "spotify", "hotstar", "amazon prime", ...],
  ...13 categories total
}
```

**How it works**: Each transaction description is lowercased and matched against the keyword list. The first matching category wins. If no match, tagged as `"Other"`.

---

## 📊 Spending Dashboard

Five analysis tabs:

1. **Overview** — Donut chart by category + monthly income vs expenses area chart
2. **Categories** — Ranked breakdown with progress bars + horizontal bar chart
3. **Top Merchants** — Ranked table of top 10 merchants by total spend
4. **Subscriptions** — Recurring payment detector with monthly average
5. **Savings Tips** — 3–5 personalised recommendations with expandable details

---

## 🔄 Subscription Detector

**Algorithm:**
1. Group all debit transactions by merchant name (lowercased)
2. Extract unique calendar months for each merchant
3. If a merchant appears in ≥ 2 different months AND all amounts are within ±15% of the mean → flag as recurring subscription
4. Sort by monthly average amount (descending)

---

## 🤖 AI Savings Recommendations

**Methodology: Rule-based (no API key needed)**

The prompt logic baked into `categoriser.ts → generateRecommendations()`:

```
1. If Food & Dining > 25% of total income:
   → "Cut Food Delivery Costs" (estimated 30% reduction)

2. If subscriptions >= 3:
   → "Review Subscriptions" (estimated 40% reduction)

3. If Transport > ₹2,000/month:
   → "Optimise Travel Costs" (estimated 25% reduction)

4. If Entertainment > 10% of income:
   → "Set Entertainment Budget" (35% reduction)

5. If savings rate < 20%:
   → "Boost Savings Rate to 20%" (auto-transfer suggestion)

6. If Shopping transactions > 8:
   → "Consolidate Online Shopping" (15% reduction via batching)

7. If savings rate < 10%:
   → "Build Emergency Fund First" (financial security priority)

→ Sort by priority (high > medium > low), return top 5
```

---

## 🧪 Sample Synthetic UPI Statement

File: [`sample_upi_statement.csv`](./sample_upi_statement.csv)

Generated by [`generate_upi_statement.py`](./generate_upi_statement.py) — produces 3 months of realistic UPI transactions:

```csv
Date,Transaction ID,Description,Debit,Credit,Balance,UPI Ref
01/01/2025,TXN123456789012,Salary Credit NEFT,,85000.00,93245.50,456789012345
05/01/2025,TXN234567890123,UPI/Swiggy,420.00,,92825.50,567890123456
...
```

**To regenerate:**
```bash
python generate_upi_statement.py
```

---

## 🚀 Setup & Run

### Prerequisites
- Node.js 18+
- Python 3.8+ (for sample data generator only)

### Frontend (UPI Analyser)
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 → Sign in → Dashboard → **UPI Analyser ✨**

### Generate Sample Data
```bash
python generate_upi_statement.py
# Creates: sample_upi_statement.csv (and jan/feb/mar variants)
```

### Backend (optional, for auth)
```bash
cd backend
pip install -r requirements.txt
python manage.py runserver
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend Framework | React 18 + Vite + TypeScript |
| CSV Parsing | Papa Parse (client-side) |
| PDF Parsing | pdfjs-dist (client-side Web Worker) |
| Charts | Recharts (Pie, Area, Bar) |
| Animations | Framer Motion |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend (auth only) | Django + SQLite |

---

## 📸 Dashboard Screenshots

> Upload `sample_upi_statement.csv` to see all views.

- **Upload Zone** — Drag-and-drop with privacy badge
- **Overview Tab** — Category donut + monthly trend
- **Categories Tab** — Ranked breakdown with bar chart
- **Merchants Tab** — Top 10 ranked by spend
- **Subscriptions Tab** — Auto-detected recurring payments
- **Savings Tips Tab** — Expandable personalised recommendations

---

## 🔐 Privacy Statement

> "We never store your data."

- **Zero server writes** for UPI statement content
- **Session-only memory** — React state clears on page close
- **No third-party analytics** on financial data
- **Open source** — audit the categorisation logic yourself at `frontend/src/lib/categoriser.ts`
- Backend Django server only handles: user login/signup, saved goals, budget preferences

---

*Built with ❤️ by Team Elite FINON*
