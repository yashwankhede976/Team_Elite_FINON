/**
 * upiParser.ts
 * ────────────────────────────────────────────────────────────
 * Client-side UPI statement parser.
 * All processing happens in the browser — zero data is sent to any server.
 *
 * Supports:
 *  - CSV format (Papa Parse)
 *  - PDF text extraction (pdfjs-dist)
 *
 * Normalises rows into a consistent UPITransaction shape.
 */

import Papa from 'papaparse';

export interface UPITransaction {
  date: string;          // ISO "YYYY-MM-DD"
  description: string;
  debit: number;         // 0 if credit
  credit: number;        // 0 if debit
  balance: number;
  upiRef: string;
  txnId: string;
}

// ─── CSV Parser ────────────────────────────────────────────────────────────────

function parseIndianDate(raw: string): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  raw = raw.trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y.length === 2 ? '20' + y : y;
    return `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})$/);
  if (mdy) {
    const [, m, d, y] = mdy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Try native parse
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);

  return raw;
}

function cleanAmount(raw: string | number | undefined): number {
  if (raw === undefined || raw === null || raw === '') return 0;
  const s = String(raw).replace(/[₹,\s]/g, '').trim();
  return parseFloat(s) || 0;
}

/** Map header name variants to canonical keys */
function detectHeaders(headers: string[]): Record<string, string> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const map: Record<string, string> = {};
  headers.forEach(h => {
    const n = norm(h);
    if (['date', 'txndate', 'transactiondate', 'valuedate'].includes(n)) map['date'] = h;
    else if (['narration', 'description', 'particulars', 'details', 'remarks', 'txndescription', 'transactiondescription'].includes(n)) map['description'] = h;
    else if (['debit', 'debitamount', 'withdrawal', 'withdrawalamount', 'dr', 'amount(dr)'].includes(n)) map['debit'] = h;
    else if (['credit', 'creditamount', 'deposit', 'depositamount', 'cr', 'amount(cr)'].includes(n)) map['credit'] = h;
    else if (['balance', 'closingbalance', 'runningbalance', 'availablebalance'].includes(n)) map['balance'] = h;
    else if (['upiref', 'upirefno', 'referencenumber', 'ref', 'refno', 'refnumber'].includes(n)) map['upiRef'] = h;
    else if (['txnid', 'transactionid', 'id', 'receiptno'].includes(n)) map['txnId'] = h;
    // Handle single "Amount" column — positive=credit, negative=debit by convention
    else if (['amount'].includes(n)) map['amount'] = h;
  });
  return map;
}

export function parseCSV(text: string): UPITransaction[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (!result.data || result.data.length === 0) return [];

  const headers = Object.keys(result.data[0] || {});
  const hMap = detectHeaders(headers);

  const txns: UPITransaction[] = [];
  let runningBalance = 0;

  result.data.forEach((row, i) => {
    const dateRaw = hMap['date'] ? row[hMap['date']] : '';
    const desc = hMap['description'] ? row[hMap['description']] : `Transaction ${i + 1}`;

    let debit = hMap['debit'] ? cleanAmount(row[hMap['debit']]) : 0;
    let credit = hMap['credit'] ? cleanAmount(row[hMap['credit']]) : 0;

    // Single "Amount" column: negative = debit, positive = credit
    if (!debit && !credit && hMap['amount']) {
      const amt = cleanAmount(row[hMap['amount']]);
      if (amt < 0) debit = Math.abs(amt);
      else credit = amt;
    }

    const balance = hMap['balance'] ? cleanAmount(row[hMap['balance']]) : (runningBalance + credit - debit);
    runningBalance = balance;

    const upiRef = hMap['upiRef'] ? (row[hMap['upiRef']] || '') : '';
    const txnId = hMap['txnId'] ? (row[hMap['txnId']] || `TXN${i}`) : `TXN${i}`;

    if (!dateRaw && !desc) return; // skip totally empty rows

    txns.push({
      date: parseIndianDate(dateRaw),
      description: (desc || '').trim(),
      debit,
      credit,
      balance,
      upiRef,
      txnId,
    });
  });

  return txns;
}

// ─── PDF Text Parser ──────────────────────────────────────────────────────────

/**
 * Extract text from a PDF using pdfjs-dist with spatial word grouping.
 * Groups words by Y position to reconstruct table rows correctly.
 */
export async function extractPDFText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group items by rounded Y position (row grouping)
    const rowMap = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ x: item.transform[4], text: item.str });
    }

    // Sort rows by Y descending (top of page first), then tokens by X ascending
    const sortedRows = Array.from(rowMap.entries())
      .sort((a, b) => b[0] - a[0])
      .map(([, tokens]) =>
        tokens.sort((a, b) => a.x - b.x).map(t => t.text).join(' ')
      );

    pageTexts.push(sortedRows.join('\n'));
  }

  return pageTexts.join('\n');
}

// ── Known UPI statement formats ───────────────────────────────────────────────

/**
 * Google Pay statement format (confirmed from lastmonth.pdf):
 *   "01Mar,2026 PaidtoMERCHANTNAME ₹20"
 *   "04:45PM UPITransactionID:642665598810"
 *   "PaidbyJalgaonJanataSahkariBankLtdJalgaon2349"
 *
 * "Received" lines use "ReceivedfromNAME" and are CREDIT transactions.
 * "Selftransfer" lines are neutral (excluded from expenses/income).
 */
function parseGooglePayPDF(text: string): UPITransaction[] {
  const txns: UPITransaction[] = [];
  
  // Pattern: optional merged date+time prefix followed by DD Mon,YYYY
  // Lines look like: "01Mar,2026 PaidtoSomeName ₹20" or "01Mar,2026PaidtoSomeName₹20"
  // The spatial grouper puts a space between columns, so we rely on the space.
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Regex to detect a transaction line
  // Pattern: DDMon,YYYY ... (Paidto|Receivedfrom|Selftransfer) ... ₹AMOUNT
  const TXN_LINE = /^(\d{1,2})\s?([A-Za-z]{3}),?\s?(\d{4})\s+(.*?)\s+(₹[\d,]+\.?\d*)$/;
  // Also handle when date/desc/amount are merged without spaces (raw text mode)
  const TXN_MERGED = /(\d{2}[A-Za-z]{3},\d{4})\s*(Paidto|Receivedfrom|Selftransfer)(.*?)(₹[\d,]+\.?\d*)/i;
  const UPI_REF_LINE = /UPITransactionID[:\s]*(\d+)/i;

  let txnIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip header/footer lines
    if (
      line.startsWith('Note:') ||
      line.startsWith('Page') ||
      line.includes('TransactionstatementperiodSent') ||
      line.includes('Transactionstatementperiod') ||
      line.includes('Date&time') ||
      line.includes('Transactiondetails') ||
      line.includes('yogitawankhede') ||
      line.includes('@gmail') ||
      line.includes('Transaction statement') ||
      line.match(/^[6-9]\d{9},?$/)  // phone number
    ) continue;

    // Try matching the transaction line
    let dateStr = '';
    let desc = '';
    let amtStr = '';
    let matched = false;

    const m1 = line.match(TXN_LINE);
    if (m1) {
      const [, day, mon, year, description, amount] = m1;
      dateStr = `${year}-${monthToNum(mon)}-${day.padStart(2, '0')}`;
      desc = description.trim();
      amtStr = amount;
      matched = true;
    }

    if (!matched) {
      const m2 = line.match(TXN_MERGED);
      if (m2) {
        const rawDate = m2[1]; // "01Mar,2026"
        const action = m2[2];  // "Paidto" | "Receivedfrom" | "Selftransfer"
        const merchant = m2[3];
        amtStr = m2[4];
        dateStr = parseMergedDate(rawDate);
        desc = action + merchant.trim();
        matched = true;
      }
    }

    if (!matched) continue;

    // Determine credit vs debit
    const lowerDesc = desc.toLowerCase();
    const isReceived =
      lowerDesc.startsWith('receivedfrom') ||
      lowerDesc.startsWith('received from') ||
      lowerDesc.includes('received');
    const isSelf = lowerDesc.startsWith('selftransfer') || lowerDesc.startsWith('self transfer');

    // Clean amount
    const amount = parseFloat(amtStr.replace(/[₹,\s]/g, '')) || 0;
    if (amount === 0) continue;

    // Look ahead for UPI ref
    let upiRef = '';
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const refMatch = lines[j].match(UPI_REF_LINE);
      if (refMatch) { upiRef = refMatch[1]; break; }
    }

    // Clean merchant name — remove the "Paidto" / "Receivedfrom" prefix
    let cleanDesc = desc
      .replace(/^Paidto\s*/i, 'Paid to ')
      .replace(/^Receivedfrom\s*/i, 'Received from ')
      .replace(/^Selftransfer(to|from)?\s*/i, 'Self transfer ')
      .trim();

    txns.push({
      date: dateStr,
      description: cleanDesc,
      debit: isReceived || isSelf ? 0 : amount,
      credit: isReceived ? amount : 0,
      balance: 0,
      upiRef,
      txnId: upiRef || `PDF-${txnIndex++}`,
    });
  }

  return txns;
}

function monthToNum(mon: string): string {
  const MAP: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  };
  return MAP[mon.toLowerCase()] || '01';
}

function parseMergedDate(raw: string): string {
  // "01Mar,2026" or "01Mar2026"
  const m = raw.match(/(\d{1,2})([A-Za-z]{3})[,\s]?(\d{4})/);
  if (!m) return new Date().toISOString().slice(0, 10);
  return `${m[3]}-${monthToNum(m[2])}-${m[1].padStart(2, '0')}`;
}

/**
 * Master PDF text parser — detects format and routes to correct parser.
 * Currently supports:
 *   - Google Pay statements (confirmed)
 *   - Generic heuristic fallback
 */
export function parsePDFText(text: string): UPITransaction[] {
  // Detect Google Pay format
  const isGooglePay =
    text.includes('Transaction statement') ||
    text.includes('UPITransactionID') ||
    text.includes('Paidto') ||
    text.includes('Receivedfrom');

  if (isGooglePay) {
    const txns = parseGooglePayPDF(text);
    if (txns.length > 0) return txns;
  }

  // ── Generic heuristic fallback for other bank formats ────────────────────
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const datePattern = /(\d{1,2}[\/\-][A-Za-z]{3}[\/\-]\d{2,4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
  const amtPattern = /₹?[\d,]+\.?\d{0,2}/g;
  const txns: UPITransaction[] = [];
  let idx = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!datePattern.test(line)) continue;

    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const dateStr = parseIndianDate(dateMatch[1]);
    const withoutDate = line.replace(dateMatch[0], '').replace(/\s+/g, ' ').trim();
    const amounts = (withoutDate.match(amtPattern) || [])
      .map(a => parseFloat(a.replace(/[₹,]/g, '')))
      .filter(a => !isNaN(a) && a > 0);

    const descPart = withoutDate.replace(amtPattern, '').replace(/\s+/g, ' ').trim();
    if (amounts.length === 0 || !descPart) continue;

    const lline = line.toLowerCase();
    const isCredit =
      lline.includes('cr') || lline.includes('credit') ||
      lline.includes('received') || lline.includes('salary');
    const amount = amounts[0];

    txns.push({
      date: dateStr,
      description: descPart,
      debit: isCredit ? 0 : amount,
      credit: isCredit ? amount : 0,
      balance: amounts[amounts.length - 1] || 0,
      upiRef: '',
      txnId: `PDF-${idx++}`,
    });
  }

  return txns;
}
