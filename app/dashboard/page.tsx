'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface InvoiceData {
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  payment_terms: string | null;
  po_number: string | null;
  currency: string;
  vendor: { name: string | null; email: string | null; phone: string | null; address: string | null; tax_id: string | null };
  client: { name: string | null; email: string | null; address: string | null };
  financials: { subtotal: number | null; discount: number | null; tax_rate: string | null; tax_amount: number | null; shipping: number | null; total_amount: number | null };
  line_items: Array<{ description: string | null; quantity: number | null; unit_price: number | null; amount: number | null }>;
  notes: string | null;
}

interface Document {
  id: string; original_name: string; file_size: number;
  status: string; extracted_data: InvoiceData | null; created_at: string;
}

interface User { id: string; username: string; email: string; role: string; }

interface VendorSpend { name: string; total: number; count: number; invoices: string[]; }
interface OverdueInvoice { invoice_number: string | null; vendor: string | null; due_date: string; total_amount: number | null; days_overdue: number; }
interface MonthlyTotal { month: string; total: number; }
interface Category { name: string; total: number; }

interface Analytics {
  vendor_spend: VendorSpend[];
  overdue_invoices: OverdueInvoice[];
  monthly_totals: MonthlyTotal[];
  categories: Category[];
}

interface DuplicateWarning {
  message: string;
  matching_document: string;
  uploaded_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [docs, setDocs] = useState<Document[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [currentData, setCurrentData] = useState<{ data: InvoiceData; filename: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [ocrUsed, setOcrUsed] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateWarning | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, type = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  function headers() {
    return { Authorization: 'Bearer ' + localStorage.getItem('dp_token') };
  }

  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch('/api/documents/list', { headers: headers() });
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setDocs(data.documents || []);
    } catch { /* silent */ }
  }, [router]);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/documents/analytics', { headers: headers() });
      const data = await res.json();
      setAnalytics(data);
    } catch { /* silent */ }
    finally { setAnalyticsLoading(false); }
  }, []);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('dp_user') || 'null');
    if (!u) { router.push('/login'); return; }
    setUser(u);
    loadDocs();
  }, [router, loadDocs]);

  useEffect(() => {
    if (activeSection === 'analytics') loadAnalytics();
  }, [activeSection, loadAnalytics]);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) { showToast('PDF files only', 'error'); return; }
    if (file.size > 10 * 1024 * 1024) { showToast('File too large (max 10MB)', 'error'); return; }
    setUploading(true); setCurrentData(null); setUploadProgress(0); setDuplicateWarning(null); setOcrUsed(false);
    setUploadStatus('⬆️ Uploading ' + file.name + '...');
    const interval = setInterval(() => setUploadProgress(p => Math.min(p + 8, 82)), 200);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/documents/upload', { method: 'POST', headers: headers(), body: fd });
      clearInterval(interval);
      setUploadProgress(100);
      const data = await res.json();
      if (!res.ok) { setUploadStatus('❌ ' + (data.error || 'Upload failed')); showToast(data.error || 'Upload failed', 'error'); return; }
      setUploadStatus('✅ Extraction complete!');
      setCurrentData({ data: data.data, filename: data.filename });
      setOcrUsed(data.ocr_used || false);
      if (data.duplicate_warning) {
        setDuplicateWarning(data.duplicate_warning);
        showToast('⚠️ Possible duplicate invoice detected!', 'warning');
      } else {
        showToast('✅ Data extracted successfully!');
      }
      loadDocs();
      setTimeout(() => setUploadProgress(0), 1500);
    } catch {
      clearInterval(interval);
      setUploadStatus('❌ Connection error');
      showToast('Connection error', 'error');
    } finally { setUploading(false); }
  }

  function downloadCSV() {
    if (!currentData) return;
    const d = currentData.data;
    const rows: string[][] = [
      ['Field', 'Value'],
      ['Invoice Number', d.invoice_number || ''],
      ['Invoice Date', d.invoice_date || ''],
      ['Due Date', d.due_date || ''],
      ['Vendor Name', d.vendor?.name || ''],
      ['Vendor Email', d.vendor?.email || ''],
      ['Client Name', d.client?.name || ''],
      ['Client Email', d.client?.email || ''],
      ['Subtotal', String(d.financials?.subtotal ?? '')],
      ['Tax Amount', String(d.financials?.tax_amount ?? '')],
      ['Total Due', String(d.financials?.total_amount ?? '')],
      ['Currency', d.currency || ''],
    ];
    if (d.line_items?.length) {
      rows.push(['', '']);
      rows.push(['Line Items', '']);
      rows.push(['Description', 'Qty', 'Unit Price', 'Amount']);
      d.line_items.forEach(item => {
        rows.push([item.description || '', String(item.quantity ?? ''), String(item.unit_price ?? ''), String(item.amount ?? '')]);
      });
    }
    const csv = rows.map(r => r.map(v => '"' + v + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'datapulse_' + (d.invoice_number || 'invoice') + '.csv';
    a.click();
    showToast('CSV downloaded!');
  }

  const totalValue = docs.reduce((s, d) => s + (d.extracted_data?.financials?.total_amount || 0), 0);
  const todayCount = docs.filter(d => new Date(d.created_at).toDateString() === new Date().toDateString()).length;
  const overdueCount = analytics?.overdue_invoices?.length || 0;

  const statStyle = (color: string) => ({
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16, padding: '18px 20px', position: 'relative' as const, overflow: 'hidden',
    transition: 'transform 0.2s', cursor: 'default',
    borderTop: '2px solid ' + color,
  });

  const COLORS = ['#6c63ff', '#a78bfa', '#4ade80', '#facc15', '#60a5fa', '#f87171', '#34d399'];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f', color: '#f0f0f5', fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <style>{`
        .nav-item{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:10px;cursor:pointer;transition:all 0.18s;font-size:13.5px;font-weight:500;color:rgba(240,240,245,0.5);margin-bottom:2px;border:none;background:none;width:100%;text-align:left;font-family:inherit}
        .nav-item:hover{background:rgba(255,255,255,0.05);color:#f0f0f5}
        .nav-item.active{background:rgba(108,99,255,0.15);color:#a78bfa;border-left:2px solid #6c63ff}
        .doc-row{display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);margin-bottom:8px;cursor:pointer;transition:all 0.18s}
        .doc-row:hover{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.15)}
        .drop-zone{border:2px dashed rgba(255,255,255,0.15);border-radius:16px;padding:44px 20px;text-align:center;cursor:pointer;transition:all 0.2s;position:relative}
        .drop-zone.dragging,.drop-zone:hover{border-color:#6c63ff;background:rgba(108,99,255,0.06)}
        .btn-primary{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:10px;background:linear-gradient(135deg,#6c63ff,#a78bfa);color:#fff;font-size:13px;font-weight:600;cursor:pointer;border:none;font-family:inherit;transition:all 0.2s;box-shadow:0 3px 15px rgba(108,99,255,0.3)}
        .btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(108,99,255,0.4)}
        .btn-sm{padding:6px 13px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#f0f0f5;font-family:inherit;transition:all 0.18s}
        .btn-sm:hover{background:rgba(255,255,255,0.12)}
        .data-row{display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.04)}
        .data-row:last-child{border-bottom:none}
        @keyframes toastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeSlide{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .result-panel{animation:fadeSlide 0.4s ease}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:rgba(240,240,245,0.5);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08)}
        td{padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04)}
        tr:hover td{background:rgba(255,255,255,0.02)}
        .bar-fill{height:100%;border-radius:99px;transition:width 0.8s cubic-bezier(.16,1,.3,1)}
        .overdue-row{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.15);margin-bottom:8px}
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: 240, minWidth: 240, background: '#0d0d15', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>⚡</div>
          <div><div style={{ fontSize: 15, fontWeight: 700 }}>DataPulse</div><div style={{ fontSize: 10, color: 'rgba(240,240,245,0.5)', letterSpacing: 0.5 }}>AI Dashboard</div></div>
        </div>
        <div style={{ padding: '0 12px', flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(240,240,245,0.4)', padding: '0 8px', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>Main</div>
          {[
            { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
            { id: 'upload', icon: '📤', label: 'Upload Invoice' },
            { id: 'documents', icon: '📄', label: 'My Documents' },
            { id: 'analytics', icon: '📊', label: 'Analytics' },
          ].map(item => (
            <button key={item.id} className={'nav-item ' + (activeSection === item.id ? 'active' : '')} onClick={() => setActiveSection(item.id)}>
              <span style={{ fontSize: 16, minWidth: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
              {item.id === 'analytics' && overdueCount > 0 && (
                <span style={{ marginLeft: 'auto', background: '#f87171', color: '#fff', borderRadius: 99, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{overdueCount}</span>
              )}
            </button>
          ))}
          {user?.role === 'admin' && (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(240,240,245,0.4)', padding: '12px 8px 6px', letterSpacing: 1, textTransform: 'uppercase' }}>Admin</div>
              <button className="nav-item" onClick={() => router.push('/admin')}>
                <span style={{ fontSize: 16, minWidth: 20, textAlign: 'center' }}>🛡</span>Admin Panel
              </button>
            </>
          )}
        </div>
        <div style={{ padding: '16px 12px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</div>
              <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.5)' }}>User</div>
            </div>
            <button onClick={() => { localStorage.clear(); router.push('/login'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,240,245,0.4)', fontSize: 14, padding: 4, borderRadius: 6 }} title="Logout">⏻</button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', background: 'rgba(10,10,15,0.8)' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {activeSection === 'dashboard' ? 'Dashboard' : activeSection === 'upload' ? 'Upload Invoice' : activeSection === 'documents' ? 'My Documents' : 'Analytics'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(108,99,255,0.15)', color: '#a78bfa', border: '1px solid rgba(108,99,255,0.25)' }}>⚡ AI OCR Engine</span>
            <span style={{ fontSize: 13, color: 'rgba(240,240,245,0.5)' }}>👋 {user?.username}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>

          {/* Analytics */}
          {activeSection === 'analytics' && (
            <div>
              {analyticsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(240,240,245,0.4)' }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                  <div>Loading analytics...</div>
                </div>
              ) : !analytics || (analytics.vendor_spend.length === 0 && analytics.overdue_invoices.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(240,240,245,0.4)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
                  <div>Upload some invoices first to see analytics</div>
                </div>
              ) : (
                <div>
                  {analytics.overdue_invoices.length > 0 && (
                    <div style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 20, padding: 24, marginBottom: 24 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        🔴 Overdue Invoices
                        <span style={{ background: '#f87171', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, padding: '1px 8px' }}>{analytics.overdue_invoices.length}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.5)', marginBottom: 16 }}>These invoices have passed their due date</div>
                      {analytics.overdue_invoices.map((inv, i) => (
                        <div key={i} className="overdue-row">
                          <div style={{ fontSize: 20 }}>⚠️</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{inv.vendor || 'Unknown Vendor'} — {inv.invoice_number || 'No Inv#'}</div>
                            <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.5)', marginTop: 2 }}>Due: {inv.due_date}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171' }}>{inv.days_overdue}d overdue</div>
                            {inv.total_amount != null && <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.5)' }}>${inv.total_amount.toLocaleString()}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 24 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🏢 Vendor Spend</div>
                      <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)', marginBottom: 18 }}>Top vendors by invoice total</div>
                      {analytics.vendor_spend.length === 0 ? (
                        <div style={{ color: 'rgba(240,240,245,0.4)', fontSize: 13 }}>No vendor data yet</div>
                      ) : analytics.vendor_spend.map((v, i) => {
                        const max = analytics.vendor_spend[0].total;
                        const pct = Math.round((v.total / max) * 100);
                        return (
                          <div key={i} style={{ marginBottom: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                              <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{v.name}</span>
                              <span style={{ color: '#a78bfa', fontWeight: 700 }}>${v.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                              <div className="bar-fill" style={{ width: pct + '%', background: COLORS[i % COLORS.length] }} />
                            </div>
                            <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.4)', marginTop: 3 }}>{v.count} invoice{v.count !== 1 ? 's' : ''}</div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 24 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🏷️ Spend by Category</div>
                      <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)', marginBottom: 18 }}>Auto-tagged from line items</div>
                      {analytics.categories.length === 0 ? (
                        <div style={{ color: 'rgba(240,240,245,0.4)', fontSize: 13 }}>No line item data yet</div>
                      ) : analytics.categories.map((c, i) => {
                        const total = analytics.categories.reduce((s, x) => s + x.total, 0);
                        const pct = Math.round((c.total / total) * 100);
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                            <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{c.name}</div>
                            <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.5)' }}>{pct}%</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: COLORS[i % COLORS.length] }}>${c.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {analytics.monthly_totals.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 24 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📈 Monthly Invoice Volume</div>
                      <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)', marginBottom: 20 }}>Total invoice value uploaded per month</div>
                      <div style={{ display: 'flex', gap: 12, height: 120, alignItems: 'flex-end' }}>
                        {analytics.monthly_totals.map((m, i) => {
                          const max = Math.max(...analytics.monthly_totals.map(x => x.total));
                          const h = Math.round((m.total / max) * 100);
                          return (
                            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                              <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 700 }}>{Math.round(m.total / 1000) > 0 ? Math.round(m.total / 1000) + 'k' : m.total}</div>
                              <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden', height: 80, display: 'flex', alignItems: 'flex-end' }}>
                                <div style={{ width: '100%', height: h + '%', background: COLORS[i % COLORS.length], borderRadius: '6px 6px 0 0', transition: 'height 0.8s' }} />
                              </div>
                              <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.5)' }}>{m.month}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          {activeSection !== 'documents' && activeSection !== 'analytics' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Total Documents', value: docs.length, icon: '📄', color: '#6c63ff' },
                { label: 'Processed', value: docs.filter(d => d.status === 'done').length, icon: '✅', color: '#4ade80' },
                { label: 'Total Value', value: totalValue > 0 ? '$' + totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '$0', icon: '💰', color: '#facc15' },
                { label: 'Uploads Today', value: todayCount, icon: '⚡', color: '#60a5fa' },
              ].map(s => (
                <div key={s.label} style={statStyle(s.color)}>
                  <div style={{ fontSize: 22, marginBottom: 10 }}>{s.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Upload */}
          {(activeSection === 'upload' || activeSection === 'dashboard') && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 28, marginBottom: 28 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>📤 Upload Invoice PDF</div>
              <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.5)', marginBottom: 20 }}>Drop your PDF — works with both text-based and scanned PDFs.</div>
              <div
                className={'drop-zone' + (dragging ? ' dragging' : '')}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
                <div style={{ fontSize: 44, marginBottom: 14 }}>📁</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Drop PDF here or click to browse</div>
                <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.5)', marginBottom: 18 }}>Text-based & scanned PDFs supported · Max 10MB</div>
                <button className="btn-primary" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }} disabled={uploading}>{uploading ? 'Processing...' : 'Choose File'}</button>
              </div>
              {uploadStatus && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.6)', marginBottom: 8 }}>{uploadStatus}</div>
                  {uploadProgress > 0 && (
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: 'linear-gradient(90deg,#6c63ff,#a78bfa)', borderRadius: 99, width: uploadProgress + '%', transition: 'width 0.3s' }} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Duplicate warning */}
          {duplicateWarning && (
            <div style={{ background: 'rgba(250,204,21,0.08)', border: '1px solid rgba(250,204,21,0.25)', borderRadius: 16, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 22 }}>⚠️</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#facc15', marginBottom: 3 }}>Possible Duplicate Invoice</div>
                <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.6)' }}>
                  Matches <strong>{duplicateWarning.matching_document}</strong> uploaded on {new Date(duplicateWarning.uploaded_at).toLocaleDateString()}. Please verify before processing payment.
                </div>
              </div>
            </div>
          )}

          {/* Result panel */}
          {currentData && (activeSection === 'upload' || activeSection === 'dashboard') && (
            <div className="result-panel" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 28, marginBottom: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  ✅ Extracted — <span style={{ color: '#a78bfa', fontWeight: 500 }}>{currentData.filename}</span>
                  {ocrUsed && <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)' }}>🔍 OCR Used</span>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(currentData.data, null, 2)); showToast('JSON copied!'); }}>📋 Copy JSON</button>
                  <button className="btn-sm" style={{ background: '#6c63ff', borderColor: '#6c63ff', color: '#fff' }} onClick={downloadCSV}>⬇ Export CSV</button>
                </div>
              </div>
              <ResultGrid data={currentData.data} />
            </div>
          )}

          {/* Documents list */}
          {activeSection !== 'analytics' && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 28 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>📂 {activeSection === 'documents' ? 'All Documents' : 'Recent Documents'}</div>
              <div style={{ fontSize: 13, color: 'rgba(240,240,245,0.5)', marginBottom: 20 }}>Click a document to view extracted data</div>
              {docs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(240,240,245,0.4)' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                  <div style={{ fontSize: 14, marginBottom: 6 }}>No documents yet</div>
                  <div style={{ fontSize: 12 }}>Upload your first invoice to get started</div>
                </div>
              ) : docs.map(doc => {
                const isOverdue = (() => { const due = doc.extracted_data?.due_date; if (!due) return false; return new Date(due) < new Date(); })();
                return (
                  <div key={doc.id} className="doc-row" onClick={() => { if (doc.extracted_data) { setCurrentData({ data: doc.extracted_data, filename: doc.original_name }); setActiveSection('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); } }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>📄</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {doc.original_name}
                        {isOverdue && <span style={{ padding: '1px 6px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', flexShrink: 0 }}>OVERDUE</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.5)', marginTop: 2 }}>
                        Inv# {doc.extracted_data?.invoice_number || '—'}
                        {doc.extracted_data?.financials?.total_amount ? ' · $' + doc.extracted_data.financials.total_amount.toLocaleString() : ''}
                        {' · '}{new Date(doc.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: doc.status === 'done' ? '#4ade80' : doc.status === 'error' ? '#f87171' : '#facc15' }} />
                      <span style={{ fontSize: 11, fontWeight: 500, color: doc.status === 'done' ? '#4ade80' : doc.status === 'error' ? '#f87171' : '#facc15' }}>{doc.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'rgba(20,20,30,0.96)', border: '1px solid ' + (toast.type === 'error' ? 'rgba(248,113,113,0.3)' : toast.type === 'warning' ? 'rgba(250,204,21,0.3)' : 'rgba(74,222,128,0.3)'), borderLeft: '3px solid ' + (toast.type === 'error' ? '#f87171' : toast.type === 'warning' ? '#facc15' : '#4ade80'), borderRadius: 12, padding: '12px 18px', fontSize: 13, backdropFilter: 'blur(20px)', zIndex: 1000, color: toast.type === 'error' ? '#f87171' : toast.type === 'warning' ? '#facc15' : '#4ade80', animation: 'toastIn 0.3s ease', maxWidth: 320 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function ResultGrid({ data }: { data: InvoiceData }) {
  const blockStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 16 };
  const titleStyle = { fontSize: 11, fontWeight: 600 as const, color: 'rgba(240,240,245,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.8px', marginBottom: 12 };

  function Row({ label, value, accent }: { label: string; value: string | number | null | undefined; accent?: string }) {
    if (value === null || value === undefined || value === '') return null;
    return (
      <div className="data-row">
        <span style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)', minWidth: 110 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 500, color: accent || '#f0f0f5', textAlign: 'right', maxWidth: 200, wordBreak: 'break-word' }}>{String(value)}</span>
      </div>
    );
  }

  const isOverdue = data.due_date && new Date(data.due_date) < new Date();

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16, marginBottom: 16 }}>
        <div style={blockStyle}>
          <div style={titleStyle}>📋 Invoice Info</div>
          <Row label="Invoice #" value={data.invoice_number} accent="#a78bfa" />
          <Row label="Date" value={data.invoice_date} />
          <Row label="Due Date" value={isOverdue ? '⚠️ ' + data.due_date + ' (OVERDUE)' : data.due_date} accent={isOverdue ? '#f87171' : undefined} />
          <Row label="PO Number" value={data.po_number} />
          <Row label="Terms" value={data.payment_terms} />
          <Row label="Currency" value={data.currency} />
        </div>
        <div style={blockStyle}>
          <div style={titleStyle}>💰 Financials</div>
          <Row label="Subtotal" value={data.financials?.subtotal != null ? '$' + data.financials.subtotal.toFixed(2) : null} />
          <Row label="Discount" value={data.financials?.discount != null ? '-$' + data.financials.discount.toFixed(2) : null} />
          <Row label="Tax Rate" value={data.financials?.tax_rate ? data.financials.tax_rate + '%' : null} />
          <Row label="Tax Amount" value={data.financials?.tax_amount != null ? '$' + data.financials.tax_amount.toFixed(2) : null} />
          <Row label="Shipping" value={data.financials?.shipping != null ? '$' + data.financials.shipping.toFixed(2) : null} />
          <Row label="TOTAL DUE" value={data.financials?.total_amount != null ? '$' + data.financials.total_amount.toFixed(2) : null} accent="#4ade80" />
        </div>
        <div style={blockStyle}>
          <div style={titleStyle}>🏢 Vendor</div>
          <Row label="Name" value={data.vendor?.name} />
          <Row label="Email" value={data.vendor?.email} />
          <Row label="Phone" value={data.vendor?.phone} />
          <Row label="Address" value={data.vendor?.address} />
          <Row label="Tax ID" value={data.vendor?.tax_id} />
        </div>
        <div style={blockStyle}>
          <div style={titleStyle}>👤 Client</div>
          <Row label="Name" value={data.client?.name} />
          <Row label="Email" value={data.client?.email} />
          <Row label="Address" value={data.client?.address} />
          {data.notes && <Row label="Notes" value={data.notes} />}
        </div>
      </div>
      {data.line_items && data.line_items.length > 0 && (
        <div style={blockStyle}>
          <div style={titleStyle}>📦 Line Items ({data.line_items.length})</div>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead><tr><th>#</th><th>Description</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Unit Price</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {data.line_items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ color: 'rgba(240,240,245,0.5)' }}>{i + 1}</td>
                    <td>{item.description || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{item.quantity ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>{item.unit_price != null ? '$' + item.unit_price.toFixed(2) : '—'}</td>
                    <td style={{ textAlign: 'right', color: '#a78bfa', fontWeight: 600 }}>{item.amount != null ? '$' + item.amount.toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
