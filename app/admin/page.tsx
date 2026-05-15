'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User { id: string; username: string; email: string; role: string; is_active: boolean; created_at: string; last_login: string | null; }
interface Document { id: string; original_name: string; status: string; created_at: string; username?: string; extracted_data?: { invoice_number?: string; financials?: { total_amount?: number } }; }
interface Stats { total_users: number; total_admins: number; total_documents: number; documents_today: number; recent_activity: Array<{ original_name: string; status: string; created_at: string; username: string }>; }
interface Log { id: number; action: string; detail: string; ip_addr: string; created_at: string; username: string; }

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'overview' | 'users' | 'docs' | 'audit'>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', password: '', role: 'user' });
  const [modalError, setModalError] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [adminUser, setAdminUser] = useState<{ username: string } | null>(null);

  function showToast(msg: string, type = 'success') { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }
  function headers() { return { Authorization: 'Bearer ' + localStorage.getItem('dp_token'), 'Content-Type': 'application/json' }; }

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/stats', { headers: headers() });
    if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
    setStats(await res.json());
  }, [router]);

  const loadUsers = useCallback(async () => {
    const res = await fetch('/api/admin/users', { headers: headers() });
    const d = await res.json(); setUsers(d.users || []);
  }, []);

  const loadDocs = useCallback(async () => {
    const res = await fetch('/api/documents/list', { headers: headers() });
    const d = await res.json(); setDocs(d.documents || []);
  }, []);

  const loadAudit = useCallback(async () => {
    const res = await fetch('/api/admin/audit', { headers: headers() });
    const d = await res.json(); setLogs(d.logs || []);
  }, []);

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('dp_user') || 'null');
    if (!u || u.role !== 'admin') { router.push('/login'); return; }
    setAdminUser(u);
    loadStats();
  }, [router, loadStats]);

  useEffect(() => {
    if (tab === 'users') loadUsers();
    if (tab === 'docs') loadDocs();
    if (tab === 'audit') loadAudit();
  }, [tab, loadUsers, loadDocs, loadAudit]);

  async function toggleUser(id: string, active: boolean) {
    await fetch('/api/admin/users', { method: 'PATCH', headers: headers(), body: JSON.stringify({ id, is_active: active }) });
    showToast(active ? '✅ User activated' : '🔴 User suspended'); loadUsers();
  }

  async function deleteUser(id: string) {
    if (!confirm('Delete this user?')) return;
    await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE', headers: headers() });
    showToast('🗑 User deleted'); loadUsers(); loadStats();
  }

  async function createUser() {
    setModalError('');
    if (!newUser.username || !newUser.email || !newUser.password) { setModalError('All fields required'); return; }
    const res = await fetch('/api/admin/users', { method: 'POST', headers: headers(), body: JSON.stringify(newUser) });
    const d = await res.json();
    if (!res.ok) { setModalError(d.error); return; }
    setModal(false); setNewUser({ username: '', email: '', password: '', role: 'user' });
    showToast('✅ User created'); loadUsers(); loadStats();
  }

  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return;
    await fetch(`/api/documents/list?id=${id}`, { method: 'DELETE', headers: headers() });
    showToast('🗑 Document deleted'); loadDocs(); loadStats();
  }

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const tabStyle = (t: string) => ({
    display: 'flex' as const, alignItems: 'center' as const, gap: 10, padding: '9px 12px',
    borderRadius: 10, cursor: 'pointer' as const, transition: 'all 0.18s', fontSize: '13.5px',
    fontWeight: 500 as const, width: '100%', border: 'none', fontFamily: 'inherit', textAlign: 'left' as const,
    background: tab === t ? 'rgba(245,158,11,0.12)' : 'transparent',
    color: tab === t ? '#fbbf24' : 'rgba(240,240,245,0.5)',
    borderLeft: tab === t ? '2px solid #f59e0b' : '2px solid transparent',
    marginBottom: 2,
  });

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0a0a0f', color: '#f0f0f5', fontFamily: 'Inter,sans-serif', overflow: 'hidden' }}>
      <style>{`
        input,select{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#f0f0f5;font-size:13px;padding:9px 14px;outline:none;transition:all 0.2s;font-family:inherit}
        input:focus,select:focus{border-color:#f59e0b;box-shadow:0 0 0 3px rgba(245,158,11,0.15)}
        input::placeholder{color:rgba(240,240,245,0.4)}
        .chip{padding:3px 9px;border-radius:20px;font-size:11px;font-weight:600;display:inline-block}
        .btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#f0f0f5;font-family:inherit;transition:all 0.18s;margin:0 2px}
        .btn:hover{background:rgba(255,255,255,0.12)}
        .btn-gold{background:linear-gradient(135deg,#f59e0b,#fbbf24);border-color:#f59e0b;color:#000;box-shadow:0 3px 12px rgba(245,158,11,0.25)}
        .btn-gold:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(245,158,11,0.35)}
        .btn-danger{background:rgba(248,113,113,0.12);border-color:rgba(248,113,113,0.3);color:#f87171}
        table{width:100%;border-collapse:collapse;font-size:13px}
        th{padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:rgba(240,240,245,0.4);text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid rgba(255,255,255,0.08)}
        td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,0.04)}
        tr:hover td{background:rgba(255,255,255,0.02)}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(10px);z-index:100;display:flex;align-items:center;justify-content:center}
        @keyframes toastIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: 240, minWidth: 240, background: '#0d0d15', borderRight: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', padding: '20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>⚡</div>
          <div><div style={{ fontSize: 15, fontWeight: 700 }}>DataPulse</div><div style={{ fontSize: 10, color: 'rgba(240,240,245,0.5)' }}>Admin Panel</div></div>
        </div>
        <div style={{ padding: '0 12px', flex: 1 }}>
          {[
            { id: 'overview', icon: '📊', label: 'Dashboard' },
            { id: 'users', icon: '👥', label: 'User Management' },
            { id: 'docs', icon: '📄', label: 'All Documents' },
            { id: 'audit', icon: '📋', label: 'Audit Log' },
          ].map(item => (
            <button key={item.id} style={tabStyle(item.id)} onClick={() => setTab(item.id as typeof tab)}>
              <span style={{ fontSize: 16, minWidth: 20, textAlign: 'center' }}>{item.icon}</span>{item.label}
            </button>
          ))}
          <div style={{ marginTop: 12 }}>
            <button style={{ ...tabStyle(''), background: 'transparent', color: 'rgba(240,240,245,0.5)', borderLeft: '2px solid transparent' }} onClick={() => router.push('/dashboard')}>
              <span style={{ fontSize: 16, minWidth: 20, textAlign: 'center' }}>🏠</span>User View
            </button>
          </div>
        </div>
        <div style={{ padding: '16px 12px 0', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#f59e0b,#fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>A</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{adminUser?.username || 'Admin'}</div>
              <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.5)' }}>Administrator</div>
            </div>
            <button onClick={() => { localStorage.clear(); router.push('/login'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,240,245,0.4)', fontSize: 14 }}>⏻</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 28px', borderBottom: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(20px)', background: 'rgba(10,10,15,0.8)' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{{ overview: 'Admin Dashboard', users: 'User Management', docs: 'All Documents', audit: 'Audit Log' }[tab]}</div>
          <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>🛡 Admin Access</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {/* Stats row */}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
              {[
                { label: 'Total Users', value: stats.total_users, icon: '👥', color: '#f59e0b' },
                { label: 'Total Documents', value: stats.total_documents, icon: '📄', color: '#6c63ff' },
                { label: 'Uploads Today', value: stats.documents_today, icon: '📅', color: '#4ade80' },
                { label: 'Admins', value: stats.total_admins, icon: '🛡', color: '#60a5fa' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '18px 20px', borderTop: `2px solid ${s.color}` }}>
                  <div style={{ fontSize: 22, marginBottom: 10 }}>{s.icon}</div>
                  <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 4 }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Overview */}
          {tab === 'overview' && stats && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>🕐 Recent Activity</div>
              <table>
                <thead><tr><th>File</th><th>User</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {stats.recent_activity.map((r, i) => (
                    <tr key={i}>
                      <td>{r.original_name}</td><td>{r.username}</td>
                      <td><span className="chip" style={{ background: r.status === 'done' ? 'rgba(74,222,128,0.12)' : 'rgba(250,204,21,0.12)', color: r.status === 'done' ? '#4ade80' : '#facc15' }}>{r.status}</span></td>
                      <td style={{ color: 'rgba(240,240,245,0.5)' }}>{new Date(r.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {stats.recent_activity.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', padding: 30, color: 'rgba(240,240,245,0.4)' }}>No activity yet</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* Users */}
          {tab === 'users' && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search users..." style={{ width: 220 }} />
                <button className="btn btn-gold" onClick={() => { setModal(true); setModalError(''); }}>➕ Create User</button>
              </div>
              <table>
                <thead><tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Last Login</th><th>Actions</th></tr></thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td><b>{u.username}</b></td>
                      <td style={{ color: 'rgba(240,240,245,0.7)' }}>{u.email}</td>
                      <td><span className="chip" style={{ background: u.role === 'admin' ? 'rgba(245,158,11,0.15)' : 'rgba(96,165,250,0.12)', color: u.role === 'admin' ? '#fbbf24' : '#60a5fa', border: `1px solid ${u.role === 'admin' ? 'rgba(245,158,11,0.25)' : 'rgba(96,165,250,0.2)'}` }}>{u.role}</span></td>
                      <td><span className="chip" style={{ background: u.is_active ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: u.is_active ? '#4ade80' : '#f87171' }}>{u.is_active ? 'Active' : 'Suspended'}</span></td>
                      <td style={{ color: 'rgba(240,240,245,0.5)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                      <td style={{ color: 'rgba(240,240,245,0.5)' }}>{u.last_login ? new Date(u.last_login).toLocaleString() : '—'}</td>
                      <td>
                        <button className="btn" onClick={() => toggleUser(u.id, !u.is_active)}>{u.is_active ? '🔴' : '🟢'}</button>
                        <button className="btn btn-danger" onClick={() => deleteUser(u.id)}>🗑</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Docs */}
          {tab === 'docs' && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 24 }}>
              <table>
                <thead><tr><th>Filename</th><th>User</th><th>Invoice #</th><th>Total</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                  {docs.map(d => (
                    <tr key={d.id}>
                      <td>{d.original_name}</td>
                      <td style={{ color: 'rgba(240,240,245,0.6)' }}>{d.username || '—'}</td>
                      <td>{d.extracted_data?.invoice_number || '—'}</td>
                      <td>{d.extracted_data?.financials?.total_amount != null ? `$${d.extracted_data.financials.total_amount.toLocaleString()}` : '—'}</td>
                      <td><span className="chip" style={{ background: d.status === 'done' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: d.status === 'done' ? '#4ade80' : '#f87171' }}>{d.status}</span></td>
                      <td style={{ color: 'rgba(240,240,245,0.5)' }}>{new Date(d.created_at).toLocaleString()}</td>
                      <td><button className="btn btn-danger" onClick={() => deleteDoc(d.id)}>🗑</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Audit */}
          {tab === 'audit' && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 20, padding: 24 }}>
              <table>
                <thead><tr><th>Action</th><th>User</th><th>Detail</th><th>IP</th><th>Time</th></tr></thead>
                <tbody>
                  {logs.map(l => (
                    <tr key={l.id}>
                      <td><b>{l.action}</b></td>
                      <td>{l.username || '—'}</td>
                      <td style={{ color: 'rgba(240,240,245,0.6)' }}>{l.detail || '—'}</td>
                      <td style={{ color: 'rgba(240,240,245,0.5)' }}>{l.ip_addr || '—'}</td>
                      <td style={{ color: 'rgba(240,240,245,0.5)' }}>{new Date(l.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create User Modal */}
      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div style={{ background: '#14141e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32, width: 420, maxWidth: '95vw' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Create New User</h3>
            <p style={{ fontSize: 13, color: 'rgba(240,240,245,0.5)', marginBottom: 22 }}>Add a user or admin account</p>
            {modalError && <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#f87171', marginBottom: 14 }}>{modalError}</div>}
            {[
              { label: 'Username', key: 'username', type: 'text' },
              { label: 'Email', key: 'email', type: 'email' },
              { label: 'Password', key: 'password', type: 'password' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(240,240,245,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{f.label}</label>
                <input type={f.type} style={{ width: '100%' }} value={newUser[f.key as keyof typeof newUser]} onChange={e => setNewUser(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(240,240,245,0.5)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Role</label>
              <select style={{ width: '100%' }} value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                <option value="user">User</option><option value="admin">Admin</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setModal(false)}>Cancel</button>
              <button className="btn btn-gold" onClick={createUser}>Create Account</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'rgba(20,20,30,0.96)', border: `1px solid ${toast.type === 'error' ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}`, borderLeft: `3px solid ${toast.type === 'error' ? '#f87171' : '#4ade80'}`, borderRadius: 12, padding: '12px 18px', fontSize: 13, backdropFilter: 'blur(20px)', zIndex: 1000, color: toast.type === 'error' ? '#f87171' : '#4ade80', animation: 'toastIn 0.3s ease' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
