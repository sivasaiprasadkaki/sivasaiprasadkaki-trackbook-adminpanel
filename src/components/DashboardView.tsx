import { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  FileSpreadsheet,
  IndianRupee,
  TrendingUp,
  Brain,
  Cloud,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Search,
  Database,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { Entry, DashboardStats } from '../types';

interface DashboardViewProps {
  entries: Entry[];
  onAddEntryClick: () => void;
  onNavigateToTab: (tab: string) => void;
}

export default function DashboardView({ entries, onAddEntryClick, onNavigateToTab }: DashboardViewProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalEntries: 0,
    totalRevenue: 0,
    accuracy: 0,
    storageUsed: 0,
    storageLimit: 100,
    aiProcessed: 0,
    manualProcessed: 0
  });

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch server stats
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    // Real-time stats auto-refresh
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [entries]);

  // Format currency in Indian Rupees format (Lakhs/Crores)
  const formatINR = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  };

  // Format storage size based on user preference (e.g., 0.800 GB for <1GB, and 1.2, 1.02, 1.67 for >=1GB)
  const formatStorage = (gbValue: number) => {
    if (gbValue < 1) {
      return gbValue.toFixed(3);
    } else {
      const formatted = gbValue.toFixed(2);
      if (formatted.endsWith('0') && !formatted.endsWith('.00')) {
        return gbValue.toFixed(1);
      }
      return formatted;
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Reset page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredEntries = entries.filter(e => {
    const query = searchQuery.toLowerCase();
    return (
      e.userName.toLowerCase().includes(query) ||
      e.action.toLowerCase().includes(query) ||
      e.cashbookName.toLowerCase().includes(query)
    );
  });

  // Sort entries by date/timestamp descending so newer entries appear at the very top
  const sortedEntries = [...filteredEntries].sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    if (timeA && timeB) return timeB - timeA;
    return b.id.localeCompare(a.id);
  });

  const totalItems = sortedEntries.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEntries = sortedEntries.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      {/* Header and Last Updated */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Dashboard Overview</h2>
          <p className="text-slate-500 text-sm mt-1">High-level metrics and recent platform activity.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStats}
            title="Refresh statistics"
            className="p-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="text-slate-500 font-mono text-xs">
            Last updated: Just now
          </div>
        </div>
      </div>

      {/* Dynamic Supabase Connectivity Banner */}
      {stats.supabaseConfigured === false ? (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-5 shadow-sm">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-700 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">Sandbox Simulator Mode Active</span>
                <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Mock Local Data</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                The application is currently running with standard pre-seeded mock records. To query and update your real production backend, add your credentials in the <span className="font-semibold text-slate-900">Secrets panel</span> (as <code className="font-mono bg-amber-100/50 px-1 py-0.5 rounded text-amber-900 font-bold">SUPABASE_URL</code> and <code className="font-mono bg-amber-100/50 px-1 py-0.5 rounded text-amber-900 font-bold">SUPABASE_ANON_KEY</code>) or configure them in your environment settings.
              </p>
              <div className="pt-2 flex items-center gap-3">
                <button 
                  onClick={() => onNavigateToTab('settings')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Go to System Connection Guide</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : stats.schemaMissing === true ? (
        <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-5 shadow-sm">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-700 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">Supabase Connected, But Tables Missing!</span>
                <span className="text-[10px] bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Schema Missing</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed max-w-4xl">
                The database credentials are authenticated, but the matching tables (<code className="font-mono bg-slate-100 px-1 py-0.5 rounded">users</code>, <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">cashbooks</code>, <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">entries</code>, <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">attachments</code>, <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">receipts</code>) were not found in this Supabase project. To initialize them automatically:
              </p>
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
                <span className="text-slate-500">1. Run the SQL from <code className="font-mono bg-slate-100 px-1 py-0.5 rounded font-bold text-slate-800">supabase-schema.sql</code> in your Supabase Editor</span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <button 
                  onClick={() => onNavigateToTab('settings')}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Go to Settings to Seed Tables</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-emerald-50/50 to-teal-50/20 border border-emerald-100 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-slate-900">Live Supabase Database Connected</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Reading and auditing records directly from your active Supabase database.</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 font-mono">
            <span>SSL SECURE</span>
            <span className="text-slate-300">•</span>
            <span>PRODUCTION STATE</span>
          </div>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 hover:border-blue-500 transition-all duration-200 card-shadow group cursor-pointer" onClick={() => onNavigateToTab('users')}>
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Users</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {stats.totalUsers.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> +12%
            </span>
            <span className="text-slate-500 font-sans">vs last month</span>
          </div>
        </div>

        {/* Live Users */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 hover:border-blue-500 transition-all duration-200 card-shadow group cursor-pointer" onClick={() => onNavigateToTab('users')}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Live Users</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {(stats.liveUsers ?? 0).toLocaleString('en-IN')}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="text-emerald-600 font-mono font-bold flex items-center">
              Real-time
            </span>
            <span className="text-slate-500 font-sans">presence tracking active</span>
          </div>
        </div>

        {/* Total Entries */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 hover:border-blue-500 transition-all duration-200 card-shadow group cursor-pointer" onClick={() => onNavigateToTab('entries')}>
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Entries</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {stats.totalEntries.toLocaleString('en-IN')}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> +18%
            </span>
            <span className="text-slate-500 font-sans">vs last month</span>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 hover:border-blue-500 transition-all duration-200 card-shadow group cursor-pointer" onClick={() => onNavigateToTab('entries')}>
          <div className="flex justify-between items-start mb-4">
            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stats.totalRevenue < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-bold font-mono tracking-tight text-lg ${stats.totalRevenue < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {formatINR(stats.totalRevenue)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className={`px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5 ${stats.totalRevenue < 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
              <TrendingUp className={`w-3.5 h-3.5 ${stats.totalRevenue < 0 ? 'rotate-180 text-rose-600' : 'text-emerald-600'}`} /> {stats.totalRevenue < 0 ? '-14.2%' : '+8.4%'}
            </span>
            <span className="text-slate-500 font-sans">vs last month</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Table) & Right Column (Widgets) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Recent Activity Table (9 Cols on wide screens) */}
        <div className="xl:col-span-8 bg-white border border-slate-200 rounded-xl card-shadow flex flex-col">
          <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div>
              <h3 className="font-sans text-base font-bold text-slate-900">Recent Activity</h3>
              <p className="text-xs text-slate-500 mt-1">Real-time recording of ledger updates.</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input
                  type="text"
                  placeholder="Search activity..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-48 h-8 pl-8 pr-3 border border-slate-200 rounded-md text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                />
              </div>
              <button
                onClick={() => onNavigateToTab('entries')}
                className="text-blue-600 text-xs font-semibold hover:underline flex items-center gap-0.5 shrink-0"
              >
                <span>View All</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-6">User</th>
                  <th className="py-3 px-6">Cashbook</th>
                  <th className="py-3 px-6 text-right">Amount</th>
                  <th className="py-3 px-6">Date & Time</th>
                  <th className="py-3 px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100 text-slate-700">
                {paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                      No matching activity found.
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => {
                    // Extract initials
                    const initials = entry.userName
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2);

                    const isAI = entry.action === 'AI Receipt Scan';

                    // Avatar color backgrounds
                    let avatarBg = 'bg-slate-100 text-slate-600';
                    if (initials === 'AJ') avatarBg = 'bg-blue-50 text-blue-700';
                    if (initials === 'SR') avatarBg = 'bg-purple-50 text-purple-700';
                    if (initials === 'VK') avatarBg = 'bg-indigo-50 text-indigo-700';
                    if (initials === 'PS') avatarBg = 'bg-rose-50 text-rose-700';

                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors h-[56px]">
                        {/* User */}
                        <td className="py-2.5 px-6 font-medium text-slate-800">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center font-bold text-xs`}>
                              {initials}
                            </div>
                            <span>{entry.userName}</span>
                          </div>
                        </td>

                        {/* Cashbook */}
                        <td className="py-2.5 px-6 text-slate-500">
                          {entry.cashbookName}
                        </td>

                        {/* Amount */}
                        <td className="py-2.5 px-6 text-right font-mono font-medium">
                          {entry.amount !== null ? (
                            <span className={entry.status === 'Warning' ? 'text-red-600' : 'text-slate-900'}>
                              ₹ {entry.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        {/* Date & Time */}
                        <td className="py-2.5 px-6 text-xs text-slate-400 font-mono whitespace-nowrap">
                          {entry.timestamp ? (
                            <>
                              <span className="text-slate-600">
                                {new Date(entry.timestamp).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: '2-digit',
                                  year: 'numeric'
                                })}
                              </span>
                              <span className="text-slate-300 mx-1.5">•</span>
                              <span>
                                {new Date(entry.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="text-slate-600">{entry.date}</span>
                              <span className="text-slate-300 mx-1.5">•</span>
                              <span>{entry.time}</span>
                            </>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-6 text-center">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                            entry.status === 'Success'
                              ? 'bg-emerald-50 text-emerald-700'
                              : entry.status === 'Processing'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}>
                            {entry.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-b-xl mt-auto">
              <span className="text-xs text-slate-500">
                Showing <span className="font-semibold text-slate-700">{startIndex + 1}</span> to{' '}
                <span className="font-semibold text-slate-700">
                  {Math.min(endIndex, totalItems)}
                </span>{' '}
                of <span className="font-semibold text-slate-700">{totalItems}</span> entries
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className={`p-1.5 rounded-md border border-slate-200 bg-white transition-all duration-150 ${
                    currentPage === 1
                      ? 'text-slate-300 bg-slate-50 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
                  }`}
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold text-slate-700 min-w-[50px] text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className={`p-1.5 rounded-md border border-slate-200 bg-white transition-all duration-150 ${
                    currentPage === totalPages
                      ? 'text-slate-300 bg-slate-50 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer'
                  }`}
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Widgets (4 Cols on wide screens) */}
        <div className="xl:col-span-4 flex flex-col gap-6">
          {/* AI Processing Stats Widget */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 card-shadow flex flex-col">
            <h3 className="font-sans text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Brain className="w-4.5 h-4.5 text-blue-600" />
              <span>AI Processing Stats</span>
            </h3>

            {/* Simulated Donut Chart using clean responsive SVG */}
            <div className="relative w-40 h-40 mx-auto mb-6 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {/* Background circle */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="#F1F5F9"
                  strokeWidth="12"
                  fill="transparent"
                />
                {/* Accuracy segment representing dynamic accuracy */}
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  stroke="#0066ff"
                  strokeWidth="12"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 50}`}
                  strokeDashoffset={`${2 * Math.PI * 50 * (1 - (stats.accuracy || 98) / 100)}`}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              {/* Inner Label */}
              <div className="absolute text-center">
                <span className="block font-sans text-2xl font-bold text-slate-900">{stats.accuracy}%</span>
                <span className="block text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Accuracy</span>
              </div>
            </div>

            {/* Legends */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <span>Auto-Categorized</span>
                </span>
                <span className="font-semibold text-slate-800">
                  {(stats.aiProcessed ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-200"></span>
                  <span>Manual Review</span>
                </span>
                <span className="font-semibold text-slate-800">
                  {(stats.manualProcessed ?? 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Storage Used Widget */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 card-shadow">
            <h3 className="font-sans text-sm font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Cloud className="w-4.5 h-4.5 text-blue-600" />
              <span>Storage Used</span>
            </h3>

            <div className="mb-4">
              <div className="flex justify-between items-end mb-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight">{formatStorage(stats.storageUsed)} GB</span>
                <span className="text-slate-500 text-xs">/ {stats.storageLimit} GB</span>
              </div>
              
              {/* Custom styled progress bar */}
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                  style={{ width: `${(stats.storageUsed / stats.storageLimit) * 100}%` }}
                ></div>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Primary storage allocated for original receipt scans, audit PDF attachments, and monthly exported financial statements.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
