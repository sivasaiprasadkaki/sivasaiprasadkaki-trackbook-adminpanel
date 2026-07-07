import React, { useState, useEffect } from 'react';
import { BookOpenText, KeyRound, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';

interface AdminAuthProps {
  onSuccess: () => void;
  initialIsInitialized?: boolean | null;
}

export default function AdminAuth({ onSuccess, initialIsInitialized = null }: AdminAuthProps) {
  const [isInitialized, setIsInitialized] = useState<boolean | null>(initialIsInitialized);
  const [qrCode, setQrCode] = useState<string>('');
  const [setupKey, setSetupKey] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [checkingSession, setCheckingSession] = useState<boolean>(initialIsInitialized === null);

  // Check initial state
  const checkStatus = async () => {
    try {
      setCheckingSession(true);
      console.log('[DEBUG] AdminAuth: Fetching session from /api/auth/session...');
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        console.log(`[DEBUG] SESSION: authenticated=${data.authenticated}, initialized=${data.is_initialized}`);
        setIsInitialized(data.is_initialized);
        
        if (data.authenticated) {
          console.log('[DEBUG] SESSION: Already authenticated, bypassing login page.');
          onSuccess();
          return;
        }

        // If not initialized, trigger setup secret generation
        if (data.is_initialized === false) {
          console.log('[DEBUG] SESSION: initialized=false -> generating QR code setup.');
          await triggerSetup();
        } else {
          console.log('[DEBUG] SESSION: authenticated=false, initialized=true -> rendering 6-digit TOTP verification screen only.');
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

  const triggerSetup = async () => {
    try {
      setError('');
      console.log('[DEBUG] AdminAuth: Requesting new setup secret from /api/auth/setup...');
      const res = await fetch('/api/auth/setup', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setQrCode(data.qrCode);
        setSetupKey(data.secret);
        console.log('[DEBUG] AdminAuth: Setup QR code generated successfully.');
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to initialize security key');
      }
    } catch (err) {
      console.error('Error in triggerSetup:', err);
      setError('Connection error initiating TOTP setup.');
    }
  };

  useEffect(() => {
    if (initialIsInitialized !== null) {
      setIsInitialized(initialIsInitialized);
      setCheckingSession(false);
      console.log(`[DEBUG] AdminAuth: Initialized with prop initialIsInitialized=${initialIsInitialized}`);
      
      if (initialIsInitialized === false) {
        console.log('[DEBUG] SESSION: initialized=false -> generating QR code setup.');
        triggerSetup();
      } else {
        console.log('[DEBUG] SESSION: authenticated=false, initialized=true -> rendering 6-digit TOTP verification screen only.');
      }
    } else {
      checkStatus();
    }
  }, [initialIsInitialized]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("VERIFY CLICKED");
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      setError('Please enter a valid 6-digit numeric code.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      console.log("Sending POST /api/auth/verify");
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          isSetup: !isInitialized
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Success!
        onSuccess();
      } else {
        setError(data.error || 'Invalid verification code.');
      }
    } catch (err) {
      console.error('Error during verification:', err);
      setError('Network error verifying your code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Checking system security status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-8 relative overflow-hidden transition-all duration-300">
        
        {/* Top brand header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-3 shadow-md shadow-blue-100">
            <BookOpenText className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">TrackBook</h1>
          <p className="text-xs uppercase font-bold tracking-wider text-slate-400 mt-1">Admin Panel</p>
        </div>

        {/* Security Alert Header */}
        <div className="mb-6 flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-blue-800">
          <KeyRound className="w-5 h-5 text-blue-600 flex-shrink-0" />
          <div className="text-xs leading-relaxed font-medium">
            {isInitialized 
              ? 'Multi-Factor TOTP authentication is active for this workspace.'
              : 'First-time setup: Secure your workspace with Google Authenticator.'}
          </div>
        </div>

        {/* Setup Screen (QR Code + Manual key) */}
        {!isInitialized && qrCode && (
          <div className="mb-6 flex flex-col items-center text-center animate-fade-in">
            <p className="text-sm font-semibold text-slate-700 mb-2">Scan QR Code</p>
            <p className="text-xs text-slate-500 mb-4 px-2">
              Scan this QR code with Google Authenticator or any TOTP app to add this account.
            </p>
            
            <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-inner mb-4">
              <img src={qrCode} alt="TOTP QR Code" className="w-44 h-44 object-contain" />
            </div>

            <p className="text-xs text-slate-400 mb-1">Or enter manual setup key:</p>
            <code className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded text-xs font-mono font-bold text-slate-700 select-all tracking-wider mb-6">
              {setupKey}
            </code>
          </div>
        )}

        {/* Action Form */}
        <form onSubmit={handleVerify} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              {isInitialized ? 'Enter your 6-digit Google Authenticator code' : 'Enter Verification Code'}
            </label>
            <input
              type="text"
              pattern="\d*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="w-full h-12 text-center text-2xl font-mono tracking-[0.75em] pl-[0.375em] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-300"
            />
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              Please input the 6-digit rotating code shown in your authenticator app.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex items-start gap-2.5 text-xs font-medium animate-shake">
              <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Verify & Enter Dashboard</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
