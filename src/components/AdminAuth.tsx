import React, { useState, useEffect } from 'react';
import { BookOpenText, KeyRound, ShieldAlert, CheckCircle2, RefreshCw, Eye, EyeOff, User } from 'lucide-react';

interface AdminAuthProps {
  onSuccess: (isExplicitLogin?: boolean) => void;
  initialIsInitialized?: boolean | null;
}

export default function AdminAuth({ onSuccess, initialIsInitialized = null }: AdminAuthProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [checkingSession, setCheckingSession] = useState<boolean>(initialIsInitialized === null);

  // Check initial state
  const checkStatus = async () => {
    try {
      setCheckingSession(true);
      setError('');
      console.log('[DEBUG] AdminAuth: Fetching session from /api/auth/session...');
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        console.log(`[DEBUG] SESSION: authenticated=${data.authenticated}`);
        
        if (data.authenticated) {
          console.log('[DEBUG] SESSION: Already authenticated, bypassing login page.');
          onSuccess();
          return;
        }
      } else {
        console.error('[DEBUG] Session fetch failed with status:', res.status);
        setError('Failed to fetch security status.');
      }
    } catch (err) {
      console.error('[DEBUG] Error checking auth session status:', err);
      setError('Connection to security services failed. Please check backend.');
    } finally {
      setCheckingSession(false);
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (data.token) {
          localStorage.setItem('trackbook_session', data.token);
        }
        onSuccess(true);
      } else {
        setError(data.error || 'Invalid username or password.');
      }
    } catch (err) {
      console.error('Error during login:', err);
      setError('Network error during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans" id="admin-auth-checking">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Checking system security status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans" id="admin-auth-screen">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 relative overflow-hidden transition-all duration-300" id="admin-auth-card">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-6" id="brand-header">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-md shadow-blue-100" id="brand-icon-wrapper">
            <BookOpenText className="w-6 h-6" id="brand-icon" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight" id="brand-title">TrackBook</h1>
          <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mt-1" id="brand-subtitle">Admin Panel</p>
        </div>

        {/* Info Banner */}
        <div className="mb-6 flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800" id="auth-info-banner">
          <KeyRound className="w-5 h-5 text-blue-600 flex-shrink-0" id="auth-info-icon" />
          <div className="text-xs leading-relaxed font-medium" id="auth-info-text">
            Please log in with your administrator credentials.
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex items-start gap-2.5 text-xs font-medium animate-shake" id="auth-error-banner">
            <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" id="auth-error-icon" />
            <div className="leading-relaxed" id="auth-error-text">{error}</div>
          </div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleLogin} className="space-y-4" id="login-form">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="login-username">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                id="login-username"
                name="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                autoFocus
                required
                className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-sm text-slate-800 placeholder:text-slate-400"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5" htmlFor="login-password">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                id="login-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="w-full h-11 pl-10 pr-10 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all text-sm text-slate-800 placeholder:text-slate-400"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <button
                type="button"
                id="toggle-password-visibility"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="login-submit-button"
            disabled={loading}
            className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Log In to Dashboard</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
