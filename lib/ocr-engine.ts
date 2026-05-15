/**
 * DataPulse AI — OCR Extraction Engine (TypeScript)
 * Pure regex-based extraction. No external LLM API.
 */

export interface InvoiceData {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  po_number: string | null;
  currency: string;
  vendor: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    tax_id: string | null;
  };
  client: {
    name: string | null;
    email: string | null;
    address: string | null;
  };
  financials: {
    subtotal: number | null;
    discount: number | null;
    tax_rate: string | null;
    tax_amount: number | null;
    shipping: number | null;
    total_amount: number | null;
  };
  line_items: LineItem[];
  notes: string | null;
  raw_text_preview: string;
}

export interface LineItem {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function find(patterns: RegExp[], text: string, group = 1): string | null {
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      try { return m[group]?.trim() || null; } catch { continue; }
    }
  }
  return null;
}

function cleanMoney(val: string | null): number | null {
  if (!val) return null;
  const cleaned = val.replace(/[^\d.]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function normalizeDate(val: string | null): string | null {
  if (!val) return null;
  const months: Record<string, string> = {
    january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
    july:'07',august:'08',september:'09',october:'10',november:'11',december:'12',
    jan:'01',feb:'02',mar:'03',apr:'04',jun:'06',jul:'07',aug:'08',
    sep:'09',oct:'10',nov:'11',dec:'12',
  };
  // "November 15, 2024" or "November 15 2024"
  const m1 = val.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (m1) {
    const mn = months[m1[1].toLowerCase()];
    if (mn) return `${m1[3]}-${mn}-${m1[2].padStart(2,'0')}`;
  }
  // DD/MM/YYYY or MM/DD/YYYY
  const m2 = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m2) return `${m2[3]}-${m2[1].padStart(2,'0')}-${m2[2].padStart(2,'0')}`;
  return val;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function extractInvoiceData(text: string): InvoiceData {
  // Normalize whitespace slightly but preserve structure
  const t = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  const lines = t.split('\n').map(l => l.trim()).filter(Boolean);

  // Invoice Number
  const invoice_number = find([
    /invoice\s*(?:number|no|#|num)[:\s#]*([A-Z0-9\-\/]+)/i,
    /inv[:\s#\-]+([A-Z0-9\-\/]+)/i,
    /#\s*([A-Z]{2,}\-[\d\-]+)/i,
  ], t);

  // Dates
  const invoice_date = normalizeDate(find([
    /invoice\s*date[:\s]+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /^date[:\s]+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/im,
    /date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
    /(?:issued|created)[:\s]+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
  ], t));

  const due_date = normalizeDate(find([
    /due\s*date[:\s]+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /payment\s*due[:\s]+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /due[:\s]+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /due\s*date[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/i,
  ], t));

  // Vendor — first meaningful line not starting with INVOICE/Date/Bill
  let vendor_name: string | null = null;
  for (const line of lines.slice(0, 8)) {
    const clean = line.replace(/\s+Invoice\s*#.*$/i, '').trim();
    if (clean.length > 4 && !/^(INVOICE|Date|Bill|Ship|Tax|Phone|Email|Web)/i.test(clean)) {
      vendor_name = clean;
      break;
    }
  }

  const vendor_email = find([
    /(?:email|e-mail)[:\s]+([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/i,
    /\b([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})\b/i,
  ], t);

  const vendor_phone = find([
    /(?:phone|tel|call|mob)[:\s]+([+\d\s\-(). ]{7,20})/i,
    /(\+\d[\d\s\-(). ]{7,18})/,
  ], t);

  const vendor_address = find([
    /\d{2,}\s+[A-Za-z]+\s+(?:Street|St|Ave|Avenue|Drive|Dr|Blvd|Boulevard|Lane|Ln|Road|Rd|Way|Suite|Ste)[^\n]*/i,
  ], t, 0);

  const tax_id = find([
    /(?:tax\s*id|gst\s*no|tin|ein|vat\s*no)[:\s]+([A-Z0-9\-\/]+)/i,
    /(?:US|IN|GB)[:\-][\d\-]{8,}/,
  ], t, 0);

  // Client — extract BILL TO block
  let client_name: string | null = null;
  let client_email: string | null = null;
  let client_address: string | null = null;

  const billMatch = t.match(/(?:bill(?:ed)?\s*to|client|customer)[:\s]*\n([\s\S]{0,400}?)(?:\n\n|ship\s*to|invoice|date:|$)/i);
  if (billMatch) {
    const block = billMatch[1];
    const blines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (blines[0]) client_name = blines[0];
    const emailM = block.match(/([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})/i);
    if (emailM) client_email = emailM[1];
    const addrParts = blines.slice(1).filter(l => /\d{2,}|Street|Ave|Blvd|Suite|,/.test(l));
    if (addrParts.length) client_address = addrParts.slice(0, 2).join(', ');
  }

  // Financials
  const subtotal = cleanMoney(find([
    /sub[\s\-]?total[:\s$]*([\$\d,\.]+)/i,
    /amount\s*before\s*tax[:\s$]*([\$\d,\.]+)/i,
  ], t));

  const discount = cleanMoney(find([
    /discount[^:\n$]*[:\s$\-]*([\$\d,\.]+)/i,
  ], t));

  const tax_rate = find([
    /tax\s*\((\d+(?:\.\d+)?)\s*%\)/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:tax|gst|vat)/i,
  ], t);

  const tax_amount = cleanMoney(find([
    /(?:tax|gst|vat|hst)[^:\n$\d]*[:\s$]*([\$\d,\.]+)/i,
    /sales\s*tax[:\s$]*([\$\d,\.]+)/i,
  ], t));

  const shipping = cleanMoney(find([
    /(?:shipping|freight|delivery|handling)[^:\n$]*[:\s$]*([\$\d,\.]+)/i,
  ], t));

  const total_amount = cleanMoney(find([
    /(?:total\s*due|balance\s*due|amount\s*due)[:\s$]*([\$\d,\.]+)/i,
    /(?:grand\s*total)[:\s$]*([\$\d,\.]+)/i,
    /TOTAL\s*DUE[:\s$]*([\$\d,\.]+)/,
    /BALANCE\s*DUE[:\s$]*([\$\d,\.]+)/,
    /\bTOTAL[:\s$]+([\$\d,\.]+)/,
  ], t));

  const currency = find([
    /\b(USD|EUR|GBP|CAD|AUD|INR|BDT|JPY|SGD)\b/,
    /currency[:\s]+(\w+)/i,
  ], t) || 'USD';

  const payment_terms = find([
    /payment\s*terms[:\s]+([A-Za-z0-9 ]+)/i,
    /\b(Net\s*\d+)\b/i,
  ], t);

  const po_number = find([
    /(?:po|purchase\s*order)[:\s#\-]+([A-Z0-9\-\/]+)/i,
  ], t);

  const notes = find([
    /(?:notes?|remarks?)[:\s]+([^\n]{10,200})/i,
  ], t);

  // Line items — regex scan for rows with numbers
  const line_items = extractLineItems(t);

  return {
    invoice_number,
    invoice_date,
    due_date,
    payment_terms,
    po_number,
    currency,
    vendor: { name: vendor_name, email: vendor_email, phone: vendor_phone, address: vendor_address, tax_id },
    client: { name: client_name, email: client_email, address: client_address },
    financials: { subtotal, discount, tax_rate, tax_amount, shipping, total_amount },
    line_items,
    notes,
    raw_text_preview: t.slice(0, 600),
  };
}

function extractLineItems(text: string): LineItem[] {
  const items: LineItem[] = [];
  const lines = text.split('\n');

  // Look for lines with description + money amount patterns
  const moneyPat = /\$?([\d,]+\.\d{2})/g;
  const lineItemPat = /^(.{5,60?})\s+(\d+)\s+\$?([\d,]+\.\d{2})\s+.*?\$?([\d,]+\.\d{2})/;

  for (const line of lines) {
    const m = line.match(lineItemPat);
    if (m) {
      items.push({
        description: m[1].trim(),
        quantity: parseFloat(m[2]),
        unit_price: cleanMoney(m[3]),
        amount: cleanMoney(m[4]),
      });
    }
  }

  // Fallback: find any line with a description and at least one dollar amount
  if (items.length === 0) {
    for (const line of lines) {
      const amounts = [...line.matchAll(/\$?([\d,]+\.\d{2})/g)].map(m => cleanMoney(m[1]));
      if (amounts.length >= 1 && line.length > 10 && !/^(subtotal|total|tax|discount|ship)/i.test(line.trim())) {
        const desc = line.replace(/\$?[\d,]+\.\d{2}/g, '').replace(/\s{2,}/g, ' ').trim();
        if (desc.length > 3) {
          items.push({
            description: desc,
            quantity: null,
            unit_price: amounts.length >= 2 ? amounts[0] : null,
            amount: amounts[amounts.length - 1],
          });
        }
      }
    }
  }

  return items.slice(0, 50);
}
