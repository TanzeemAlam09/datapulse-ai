'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);

  // Login fields
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Register fields
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPass2, setRegPass2] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('dp_token');
    const user = JSON.parse(localStorage.getItem('dp_user') || 'null');
    if (token && user) {
      router.replace(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [router]);

  async function doLogin() {
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Login failed'); return; }
      localStorage.setItem('dp_token', data.token);
      localStorage.setItem('dp_user', JSON.stringify(data.user));
      setSuccess('Login successful! Redirecting...');
      setTimeout(() => router.push(data.user.role === 'admin' ? '/admin' : '/dashboard'), 600);
    } catch { setError('Cannot connect. Check your connection.'); }
    finally { setLoading(false); }
  }

  async function doRegister() {
    setError('');
    if (regPass !== regPass2) { setError('Passwords do not match'); return; }
    if (regPass.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: regUser, email: regEmail, password: regPass }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Registration failed'); return; }
      localStorage.setItem('dp_token', data.token);
      localStorage.setItem('dp_user', JSON.stringify(data.user));
      setSuccess('Account created! Redirecting...');
      setTimeout(() => router.push('/dashboard'), 600);
    } catch { setError('Cannot connect.'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a0a0f', position: 'relative', overflow: 'hidden', padding: '24px',
    }}>
      {/* Animated orbs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,#6c63ff,transparent)', filter: 'blur(80px)', opacity: 0.3, top: -100, left: -100, animation: 'float1 8s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,#a78bfa,transparent)', filter: 'blur(80px)', opacity: 0.25, bottom: -80, right: -80, animation: 'float2 10s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle,#3b82f6,transparent)', filter: 'blur(80px)', opacity: 0.2, top: '40%', left: '50%', animation: 'float3 12s ease-in-out infinite' }} />
        {/* Grid */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <style>{`
        @keyframes float1{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-30px)}}
        @keyframes float2{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,20px)}}
        @keyframes float3{0%,100%{transform:translate(0,0)}50%{transform:translate(15px,-15px)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        .card{animation:slideUp 0.55s cubic-bezier(.16,1,.3,1) both}
        input{background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#f0f0f5;font-size:14px;padding:11px 14px;width:100%;outline:none;transition:all 0.2s;font-family:inherit}
        input:focus{border-color:#6c63ff;background:rgba(108,99,255,0.1);box-shadow:0 0 0 3px rgba(108,99,255,0.15)}
        input::placeholder{color:rgba(240,240,245,0.4)}
        .btn-main{width:100%;padding:13px;border:none;border-radius:12px;background:linear-gradient(135deg,#6c63ff,#a78bfa);color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:all 0.2s;box-shadow:0 4px 20px rgba(108,99,255,0.3);font-family:inherit}
        .btn-main:hover{transform:translateY(-1px);box-shadow:0 8px 28px rgba(108,99,255,0.45)}
        .btn-main:disabled{opacity:0.6;cursor:not-allowed;transform:none}
      `}</style>

      <div className="card" style={{
        position: 'relative', zIndex: 1, width: '100%', maxWidth: 420,
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24, padding: '40px 36px',
        backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,#6c63ff,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 20px rgba(108,99,255,0.4)', flexShrink: 0 }}>⚡</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f5' }}>DataPulse AI</div>
            <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.5)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Invoice Extractor</div>
          </div>
        </div>

        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, marginBottom: 6 }}>
          {tab === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(240,240,245,0.5)', marginBottom: 24 }}>
          {tab === 'login' ? 'Sign in to your account' : 'Get started for free'}
        </p>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 4, marginBottom: 24 }}>
          {(['login','register'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); setSuccess(''); }}
              style={{ flex: 1, padding: '8px', border: 'none', cursor: 'pointer', borderRadius: 9, fontSize: 13, fontWeight: 500, transition: 'all 0.2s', fontFamily: 'inherit',
                background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === t ? '#f0f0f5' : 'rgba(240,240,245,0.5)',
                boxShadow: tab === t ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
              }}>
              {t === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Alerts */}
        {error && <div style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#ff6b6b', marginBottom: 16 }}>{error}</div>}
        {success && <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#4ade80', marginBottom: 16 }}>{success}</div>}

        {tab === 'login' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(240,240,245,0.5)', marginBottom: 7, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Username or Email</label>
              <input value={loginUser} onChange={e => setLoginUser(e.target.value)} placeholder="Enter username or email" onKeyDown={e => e.key === 'Enter' && doLogin()} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(240,240,245,0.5)', marginBottom: 7, letterSpacing: '0.4px', textTransform: 'uppercase' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="Enter password" onKeyDown={e => e.key === 'Enter' && doLogin()} style={{ paddingRight: 44 }} />
                <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(240,240,245,0.4)' }}>{showPw ? '🙈' : '👁'}</button>
              </div>
            </div>
            <button className="btn-main" onClick={doLogin} disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Username', value: regUser, set: setRegUser, type: 'text', placeholder: 'Choose a username' },
              { label: 'Email Address', value: regEmail, set: setRegEmail, type: 'email', placeholder: 'your@email.com' },
              { label: 'Password', value: regPass, set: setRegPass, type: 'password', placeholder: 'Min 8 characters' },
              { label: 'Confirm Password', value: regPass2, set: setRegPass2, type: 'password', placeholder: 'Repeat password' },
            ].map(({ label, value, set, type, placeholder }) => (
              <div key={label}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(240,240,245,0.5)', marginBottom: 7, letterSpacing: '0.4px', textTransform: 'uppercase' }}>{label}</label>
                <input type={type} value={value} onChange={e => set(e.target.value)} placeholder={placeholder} onKeyDown={e => e.key === 'Enter' && doRegister()} />
              </div>
            ))}
            <button className="btn-main" onClick={doRegister} disabled={loading} style={{ marginTop: 4 }}>
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 12, color: 'rgba(240,240,245,0.4)', marginTop: 20 }}>
          By continuing you agree to our Terms &amp; Privacy Policy
        </p>
      </div>
    </div>
  );
}
