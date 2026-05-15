import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const docs = await sql`
      SELECT extracted_data, created_at
      FROM documents
      WHERE user_id = ${user.userId} AND status = 'done' AND extracted_data IS NOT NULL
      ORDER BY created_at DESC
    `;

    // ── Vendor spend ─────────────────────────────────────────────────────────
    const vendorMap: Record<string, { total: number; count: number; invoices: string[] }> = {};
    for (const doc of docs) {
      const d = doc.extracted_data as Record<string, unknown>;
      const vendorName = (d?.vendor as Record<string, unknown>)?.name as string | null;
      const total = (d?.financials as Record<string, unknown>)?.total_amount as number | null;
      if (vendorName && total) {
        if (!vendorMap[vendorName]) vendorMap[vendorName] = { total: 0, count: 0, invoices: [] };
        vendorMap[vendorName].total += total;
        vendorMap[vendorName].count += 1;
        const invNum = d?.invoice_number as string | null;
        if (invNum) vendorMap[vendorName].invoices.push(invNum);
      }
    }
    const vendorSpend = Object.entries(vendorMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    // ── Overdue invoices ──────────────────────────────────────────────────────
    const today = new Date();
    const overdue: Array<{
      invoice_number: string | null;
      vendor: string | null;
      due_date: string;
      total_amount: number | null;
      days_overdue: number;
    }> = [];

    for (const doc of docs) {
      const d = doc.extracted_data as Record<string, unknown>;
      const dueDate = d?.due_date as string | null;
      const total = (d?.financials as Record<string, unknown>)?.total_amount as number | null;
      if (dueDate) {
        const due = new Date(dueDate);
        if (!isNaN(due.getTime()) && due < today) {
          const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          overdue.push({
            invoice_number: d?.invoice_number as string | null,
            vendor: (d?.vendor as Record<string, unknown>)?.name as string | null,
            due_date: dueDate,
            total_amount: total,
            days_overdue: daysOverdue,
          });
        }
      }
    }
    overdue.sort((a, b) => b.days_overdue - a.days_overdue);

    // ── Monthly totals ────────────────────────────────────────────────────────
    const monthlyMap: Record<string, number> = {};
    for (const doc of docs) {
      const d = doc.extracted_data as Record<string, unknown>;
      const total = (d?.financials as Record<string, unknown>)?.total_amount as number | null;
      if (total) {
        const month = new Date(doc.created_at as string).toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlyMap[month] = (monthlyMap[month] || 0) + total;
      }
    }
    const monthlyTotals = Object.entries(monthlyMap)
      .map(([month, total]) => ({ month, total }))
      .slice(0, 6)
      .reverse();

    // ── Category breakdown (from line items) ─────────────────────────────────
    const categoryMap: Record<string, number> = {};
    for (const doc of docs) {
      const d = doc.extracted_data as Record<string, unknown>;
      const lineItems = d?.line_items as Array<{ description: string | null; amount: number | null }> | null;
      if (lineItems) {
        for (const item of lineItems) {
          if (item.description && item.amount) {
            const desc = item.description.toLowerCase();
            let category = 'Other';
            if (/design|logo|brand|creative|art|graphic/.test(desc)) category = 'Design';
            else if (/dev|code|software|api|web|app|tech|engineer/.test(desc)) category = 'Development';
            else if (/consult|strateg|advis|manag/.test(desc)) category = 'Consulting';
            else if (/host|server|cloud|aws|infra|domain/.test(desc)) category = 'Infrastructure';
            else if (/market|ads|seo|social|content/.test(desc)) category = 'Marketing';
            else if (/copy|writ|blog|article|text/.test(desc)) category = 'Copywriting';
            categoryMap[category] = (categoryMap[category] || 0) + item.amount;
          }
        }
      }
    }
    const categories = Object.entries(categoryMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      vendor_spend: vendorSpend,
      overdue_invoices: overdue,
      monthly_totals: monthlyTotals,
      categories,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Analytics failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
