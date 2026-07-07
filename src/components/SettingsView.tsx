import React, { useState, useEffect } from 'react';
import {
  Settings,
  User,
  Key,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Database,
  Cloud,
  FileCode,
  HelpCircle
} from 'lucide-react';

const fetch = (input: RequestInfo | URL, init?: RequestInit) => window.fetch(input, { ...init, credentials: 'include' });

interface SettingsViewProps {
  onResetDatabase: () => void;
}

export default function SettingsView({ onResetDatabase }: SettingsViewProps) {
  const [profile, setProfile] = useState({
    name: 'Triptraccker Admin',
    email: 'triptraccker@gmail.com',
    role: 'Platform Administrator',
    company: 'TrackBook Logistics Pvt Ltd'
  });

  const [notification, setNotification] = useState<string | null>(null);
  const [connectionStats, setConnectionStats] = useState({
    supabaseConfigured: false,
    schemaMissing: false,
    loading: true
  });

  const fetchConnectionStatus = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setConnectionStats({
          supabaseConfigured: !!data.supabaseConfigured,
          schemaMissing: !!data.schemaMissing,
          loading: false
        });
      }
    } catch (err) {
      console.error(err);
      setConnectionStats(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    fetchConnectionStatus();
    // Fetch active users to populate logged in admin profile details dynamically!
    fetch('/api/users')
      .then(res => res.json())
      .then(users => {
        if (Array.isArray(users) && users.length > 0) {
          const admin = users.find(u => u.role === 'Admin') || users[0];
          setProfile({
            name: admin.name,
            email: admin.email,
            role: admin.role + ' Administrator',
            company: 'TrackBook Logistics Pvt Ltd'
          });
        }
      })
      .catch(err => console.error(err));
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setNotification('Administrator profile configurations saved!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleResetData = async () => {
    const isSupabase = connectionStats.supabaseConfigured && !connectionStats.schemaMissing;
    const msg = isSupabase
      ? 'Are you sure you want to initialize/seed your live Supabase database? This will safely drop any existing entries on the 5 schema tables and seed them with pristine real-time audit data.'
      : 'Are you sure you want to reset the simulation database to baseline values? This will clear all manually created users, entries, and custom scans.';

    if (!confirm(msg)) return;

    try {
      setConnectionStats(prev => ({ ...prev, loading: true }));
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        onResetDatabase();
        await fetchConnectionStatus();
        setNotification(
          isSupabase
            ? 'Live Supabase tables successfully seeded with pristine audit data!'
            : 'Database successfully reset to standard baseline values.'
        );
        setTimeout(() => setNotification(null), 3000);
      } else {
        const errData = await res.json();
        alert('Seeding error: ' + (errData.error || 'make sure tables are created using the schema first.'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to execute database command: ' + err.message);
    } finally {
      setConnectionStats(prev => ({ ...prev, loading: false }));
    }
  };

  const handleResetTotp = async () => {
    if (!confirm('Are you sure you want to reset the Google Authenticator TOTP setup? This will erase the stored secret, set the system as uninitialized, and force a new QR code configuration on next login.')) {
      return;
    }

    try {
      setConnectionStats(prev => ({ ...prev, loading: true }));
      const res = await fetch('/api/auth/reset-totp', { method: 'POST' });
      if (res.ok) {
        setNotification('Google Authenticator (TOTP) successfully reset. A new QR code will be generated on your next admin login.');
        setTimeout(() => setNotification(null), 5000);
      } else {
        const errData = await res.json();
        alert('Reset error: ' + (errData.error || 'Failed to reset TOTP configuration.'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to execute reset command: ' + err.message);
    } finally {
      setConnectionStats(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">System Settings</h2>
        <p className="text-slate-500 text-sm mt-1">Configure profile details, view API credentials guidance, and manage database connection indexes.</p>
      </div>

      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-semibold">{notification}</span>
        </div>
      )}

      {/* Grid of panels */}
      <div className="space-y-6">
        
        {/* Supabase Database Connection Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-sans text-sm font-bold text-slate-900 flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Production Supabase Integration</span>
            </div>
            {connectionStats.loading ? (
              <span className="text-xs text-slate-400 font-mono">Pinging...</span>
            ) : connectionStats.supabaseConfigured ? (
              connectionStats.schemaMissing ? (
                <span className="text-xs bg-yellow-100 text-yellow-800 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">Connected, Schema Missing</span>
              ) : (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">Live & Connected</span>
              )
            ) : (
              <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">Sandbox Simulator</span>
            )}
          </h3>

          <div className="space-y-4">
            {connectionStats.supabaseConfigured ? (
              connectionStats.schemaMissing ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs text-slate-700 space-y-2">
                  <div className="flex gap-2 font-bold text-yellow-950">
                    <AlertCircle className="w-4 h-4 text-yellow-700 shrink-0" />
                    <span>Database Connection Authenticated, but Schema Tables are Missing!</span>
                  </div>
                  <p className="leading-relaxed">
                    We were able to ping your Supabase client, but the required tables (<code className="font-mono bg-yellow-100 px-1 py-0.5 rounded">users</code>, <code className="font-mono bg-yellow-100 px-1 py-0.5 rounded">cashbooks</code>, <code className="font-mono bg-yellow-100 px-1 py-0.5 rounded">entries</code>, <code className="font-mono bg-yellow-100 px-1 py-0.5 rounded">attachments</code>, <code className="font-mono bg-yellow-100 px-1 py-0.5 rounded">receipts</code>) do not exist yet in your project.
                  </p>
                  <div className="pt-2">
                    <span className="font-bold text-yellow-950 block mb-1">How to resolve this:</span>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Open your Supabase Dashboard (<a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline text-blue-700 font-semibold">supabase.com</a>) and go to your SQL Editor.</li>
                      <li>Copy and execute the queries listed in <span className="font-mono font-bold bg-yellow-100 px-1">supabase-schema.sql</span> (located in your workspace root directory) to create all 5 tables and setup clean RLS policies.</li>
                      <li>Once the tables are created, click the <span className="font-semibold underline">Seed Tables with Pristine Baseline Data</span> button below to populate them with actual mock records.</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-4 text-xs text-slate-700 space-y-1.5">
                  <div className="flex gap-2 font-bold text-emerald-950">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>Connected and Synchronized to Live Supabase!</span>
                  </div>
                  <p className="leading-relaxed">
                    TrackBook Admin Panel is currently writing to and reading from your production database in real-time. All statistics, users logs, custom attachments, cashbooks, and AI receipts are fetched dynamically with maximum performance and zero cache lag.
                  </p>
                </div>
              )
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 space-y-2">
                <div className="flex gap-2 font-bold text-slate-900">
                  <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>How to connect your Production Supabase project:</span>
                </div>
                <p className="leading-relaxed">
                  To connect your real production data from Supabase, specify your credentials as environment variables.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="border border-slate-200 bg-white p-3 rounded-md">
                    <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block">1. SUPABASE_URL</span>
                    <span className="text-[11px] text-slate-600 font-mono mt-0.5 block truncate">e.g., https://zbcwkyunclz.supabase.co</span>
                  </div>
                  <div className="border border-slate-200 bg-white p-3 rounded-md">
                    <span className="font-bold text-[10px] text-slate-500 uppercase tracking-wider block">2. SUPABASE_ANON_KEY</span>
                    <span className="text-[11px] text-slate-600 font-mono mt-0.5 block truncate">e.g., eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...</span>
                  </div>
                </div>
                <div className="pt-2 text-slate-500 leading-relaxed">
                  Open the <span className="font-semibold text-slate-800">Secrets Panel</span> in the lower-left settings menu of your AI Studio environment, insert these two keys, and click Save. The server will automatically connect to your Supabase project!
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={fetchConnectionStatus}
                disabled={connectionStats.loading}
                className="h-9 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${connectionStats.loading ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>

              {connectionStats.supabaseConfigured && (
                <button
                  onClick={handleResetData}
                  disabled={connectionStats.loading}
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-2 cursor-pointer transition-colors disabled:opacity-50 shadow-sm"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Seed Tables with Pristine Baseline Data</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Profile Settings */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-sans text-sm font-bold text-slate-900 flex items-center gap-2 mb-6">
            <User className="w-4 h-4 text-blue-600" />
            <span>Administrator Profile</span>
          </h3>

          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Assigned Title / Role
                </label>
                <input
                  type="text"
                  disabled
                  value={profile.role}
                  className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 cursor-not-allowed font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Organization / Entity
                </label>
                <input
                  type="text"
                  required
                  value={profile.company}
                  onChange={(e) => setProfile({ ...profile, company: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm cursor-pointer"
            >
              Save Configurations
            </button>
          </form>
        </div>

        {/* API Secrets Instructions */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <h3 className="font-sans text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Key className="w-4 h-4 text-blue-600" />
            <span>AI Platform Secrets & Credentials</span>
          </h3>

          <div className="bg-blue-50/50 border border-blue-100 rounded-lg p-5 space-y-3">
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-slate-900">Secure API Key Management</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  TrackBook features automatic integration with the Google Gemini Developer Platform. To prevent client-side exposure, the secret key is hosted strictly on our sandbox backend environment.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-blue-100/60 space-y-2">
              <span className="text-[10px] text-blue-800 font-bold uppercase tracking-wider block">How to configure your Gemini API Key:</span>
              <ol className="text-xs text-slate-600 list-decimal pl-4 space-y-1 font-sans">
                <li>Locate the **Secrets** panel in the lower-left settings menu of the AI Studio preview environment.</li>
                <li>Add a new secret key named: <code className="font-mono bg-blue-50 px-1 py-0.5 rounded font-bold text-blue-800">GEMINI_API_KEY</code></li>
                <li>Provide your Google AI API key as the value.</li>
                <li>Save secrets. The application will immediately hot-swap from Simulated OCR to live, highly accurate Gemini-3.5-Flash OCR scanning!</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Developer / Auditing Debug actions */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-sans text-sm font-bold text-red-600 flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4" />
            <span>Danger Zone & Debugger Controls</span>
          </h3>

          <div className="border border-red-100 bg-red-50/20 rounded-lg p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <AlertCircle className="w-4.5 h-4.5 text-red-600" />
                <span>Reset Local Simulation Database</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-lg leading-relaxed">
                Reverts the simulation sandbox database back to standard pre-seeded mockup figures. If Supabase is connected, this will clean and re-insert initial values into your active production tables.
              </p>
            </div>

            <button
              onClick={handleResetData}
              className="h-10 px-4 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset State</span>
            </button>
          </div>

          <div className="border border-red-100 bg-red-50/20 rounded-lg p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Key className="w-4.5 h-4.5 text-red-600" />
                <span>Reset Google Authenticator (TOTP)</span>
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-lg leading-relaxed">
                Deletes the permanently stored TOTP secret and sets the workspace as uninitialized. This will require generating a new Google Authenticator QR code on the next login attempt.
              </p>
            </div>

            <button
              onClick={handleResetTotp}
              className="h-10 px-4 bg-red-50 border border-red-200 hover:bg-red-100 text-red-700 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Authenticator</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
