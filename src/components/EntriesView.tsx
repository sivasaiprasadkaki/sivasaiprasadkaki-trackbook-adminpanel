import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  Search,
  BookOpen,
  User,
  IndianRupee,
  CheckCircle2,
  Trash2,
  Filter,
  Grid,
  List,
  Eye,
  AlertTriangle,
  RefreshCw,
  X,
  Calendar,
  Tag,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import { Entry, Cashbook, User as AppUser } from '../types';

interface EntriesViewProps {
  onEntryLogged: () => void;
  entries: Entry[]; // Maintained for backward compatibility, but we fetch scoped entries dynamically
}

export default function EntriesView({ onEntryLogged }: EntriesViewProps) {
  // Global directory states
  const [users, setUsers] = useState<AppUser[]>([]);
  const [cashbooks, setCashbooks] = useState<Cashbook[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingCashbooks, setLoadingCashbooks] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Workflow Selections
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [selectedCashbook, setSelectedCashbook] = useState<any | null>(null);
  const [entries, setEntries] = useState<any[]>([]);

  // User search dropdown states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // View mode (Persisted in session)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (sessionStorage.getItem('entries_view_mode') as 'grid' | 'list') || 'list';
  });

  // Entry List States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [modeFilter, setModeFilter] = useState('All');
  const [aiFilter, setAiFilter] = useState('All'); // 'All' | 'AI' | 'Manual'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Form State for Adding Record
  const [formData, setFormData] = useState({
    description: '',
    category: 'Misc',
    mode: 'Cash',
    amount: '',
    type: 'out' as 'in' | 'out',
    date: new Date().toISOString().split('T')[0],
    status: 'Success' as 'Success' | 'Processing' | 'Warning'
  });

  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);

  // Categories list
  const categories = ['Food & Beverage', 'Travel', 'IT & Software', 'Utilities', 'Misc', 'Rent', 'Salary', 'Marketing'];
  // Payment modes
  const paymentModes = ['Cash', 'Online', 'Bank Transfer', 'Card', 'UPI'];

  // Handle outside clicks for user dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch Directory on Mount
  useEffect(() => {
    fetchUsersAndCashbooks();
  }, []);

  // Remember view mode preference
  useEffect(() => {
    sessionStorage.setItem('entries_view_mode', viewMode);
  }, [viewMode]);

  // Load entries when cashbook is selected
  useEffect(() => {
    if (selectedCashbook) {
      fetchEntriesForCashbook(selectedCashbook.id);
    } else {
      setEntries([]);
    }
  }, [selectedCashbook]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchUsersAndCashbooks = async () => {
    try {
      setLoadingUsers(true);
      setLoadingCashbooks(true);
      const [usersRes, cashbooksRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/cashbooks')
      ]);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData);
      }
      if (cashbooksRes.ok) {
        const cData = await cashbooksRes.json();
        setCashbooks(cData);
      }
    } catch (err) {
      console.error('Error fetching directory:', err);
      showNotification('Failed to load system directories.', 'error');
    } finally {
      setLoadingUsers(false);
      setLoadingCashbooks(false);
    }
  };

  const fetchEntriesForCashbook = async (cbId: string) => {
    try {
      setLoadingEntries(true);
      const res = await fetch(`/api/entries?cashbookId=${cbId}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      } else {
        showNotification('Failed to fetch entries.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Failed to fetch entries from server.', 'error');
    } finally {
      setLoadingEntries(false);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      showNotification('Please select a Customer / User first.', 'error');
      return;
    }
    if (!selectedCashbook) {
      showNotification('Please select a Target Cashbook.', 'error');
      return;
    }
    if (!formData.description || !formData.amount) {
      showNotification('Please complete all required fields.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          userName: selectedUser.name,
          cashbookId: selectedCashbook.id,
          amount: parseFloat(formData.amount),
          type: formData.type,
          description: formData.description,
          category: formData.category,
          mode: formData.mode,
          date: formData.date,
          status: formData.status
        })
      });

      if (res.ok) {
        showNotification('Transaction recorded successfully!');
        setFormData(prev => ({
          ...prev,
          description: '',
          amount: '',
          date: new Date().toISOString().split('T')[0]
        }));
        // Reload statistics and current cashbook's logs
        fetchEntriesForCashbook(selectedCashbook.id);
        onEntryLogged();
      } else {
        const errData = await res.json();
        showNotification(errData.error || 'Failed to record entry.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Server communication failure.', 'error');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction entry? This action is irreversible.')) {
      return;
    }

    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        showNotification('Transaction deleted successfully!');
        if (selectedCashbook) {
          fetchEntriesForCashbook(selectedCashbook.id);
        }
        onEntryLogged();
      } else {
        showNotification('Failed to delete transaction.', 'error');
      }
    } catch (err) {
      console.error(err);
      showNotification('Server communication failure during deletion.', 'error');
    }
  };

  // Filter users by typing search query
  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  // Filter cashbooks for selected user
  const userCashbooks = selectedUser
    ? cashbooks.filter((c: any) => c.userId === selectedUser.id)
    : [];

  // Calculate dynamic running balances (chronological order)
  const chronologicalEntries = [...entries].reverse();
  let currentRunning = 0;
  const runningBalancesMap = new Map<string, number>();

  chronologicalEntries.forEach(e => {
    const amt = Number(e.amount || 0);
    if (e.type === 'in') {
      currentRunning += amt;
    } else {
      currentRunning -= amt;
    }
    runningBalancesMap.set(e.id, currentRunning);
  });

  // Filter scoped entries based on filters
  const filteredEntries = entries.filter(e => {
    // Search terms
    const sTerm = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      e.description?.toLowerCase().includes(sTerm) ||
      e.category?.toLowerCase().includes(sTerm) ||
      e.mode?.toLowerCase().includes(sTerm) ||
      e.userName?.toLowerCase().includes(sTerm) ||
      e.cashbookName?.toLowerCase().includes(sTerm) ||
      (e.amount !== null && e.amount.toString().includes(sTerm)) ||
      (e.date && e.date.toLowerCase().includes(sTerm));

    // Category
    const matchesCategory = categoryFilter === 'All' || e.category === categoryFilter;

    // Payment Mode
    const matchesMode = modeFilter === 'All' || e.mode === modeFilter;

    // AI or Manual
    let matchesAiManual = true;
    const isAi = e.id?.includes('ai') || e.userName?.toLowerCase().includes('ai') || e.attachments?.some((a: any) => a.isAi);
    if (aiFilter === 'AI') {
      matchesAiManual = isAi;
    } else if (aiFilter === 'Manual') {
      matchesAiManual = !isAi;
    }

    // Date range
    let matchesDateRange = true;
    if (startDate) {
      matchesDateRange = matchesDateRange && new Date(e.date) >= new Date(startDate);
    }
    if (endDate) {
      matchesDateRange = matchesDateRange && new Date(e.date) <= new Date(endDate);
    }

    return matchesSearch && matchesCategory && matchesMode && matchesAiManual && matchesDateRange;
  });

  return (
    <div className="space-y-6">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 id="entries-view-heading" className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Entries Administration</h2>
          <p className="text-slate-500 text-sm mt-1">
            Search, view, audit, and manage users' granular transactions with real-time running balances.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shrink-0 shadow-sm">
          <button
            id="view-mode-list-toggle"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-blue-50 text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <List className="w-4 h-4" />
            <span>List View</span>
          </button>
          <button
            id="view-mode-grid-toggle"
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-blue-50 text-blue-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Grid View</span>
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Scoped Flow & Creator form (4 Cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* User & Cashbook Selectors Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <h3 className="font-sans text-base font-bold text-slate-900">Audit scope selector</h3>
            </div>

            {/* Notification alert */}
            {notification && (
              <div className={`p-3 rounded-lg text-xs font-semibold flex items-center gap-2 border ${
                notification.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                <CheckCircle2 className={`w-4 h-4 shrink-0 ${notification.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`} />
                <span>{notification.message}</span>
              </div>
            )}

            {/* Step 1: User selection */}
            <div className="space-y-1.5 relative" ref={userDropdownRef}>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Customer / User <span className="text-rose-500">*</span>
              </label>

              {!selectedUser ? (
                <div className="relative">
                  <input
                    id="user-search-input"
                    type="text"
                    placeholder="Search register user (Shiva, Sai, etc.)..."
                    value={userSearchQuery}
                    onFocus={() => setIsUserDropdownOpen(true)}
                    onChange={(e) => {
                      setUserSearchQuery(e.target.value);
                      setIsUserDropdownOpen(true);
                    }}
                    className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  
                  {isUserDropdownOpen && (
                    <div className="absolute left-0 right-0 mt-1 max-h-56 bg-white border border-slate-200 rounded-lg shadow-lg overflow-y-auto z-50 divide-y divide-slate-100">
                      {loadingUsers ? (
                        <div className="p-3 text-xs text-slate-400 flex items-center justify-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Searching registered database...</span>
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="p-3 text-xs text-slate-400 text-center">
                          No matching users found
                        </div>
                      ) : (
                        filteredUsers.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setUserSearchQuery('');
                              setIsUserDropdownOpen(false);
                              // Auto-select cashbook if user has some
                              const userCbs = cashbooks.filter((cb: any) => cb.userId === u.id);
                              if (userCbs.length > 0) {
                                setSelectedCashbook(userCbs[0]);
                              } else {
                                setSelectedCashbook(null);
                              }
                            }}
                            className="w-full text-left p-2.5 hover:bg-slate-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold shrink-0 uppercase">
                              {u.name.substring(0, 2)}
                            </div>
                            <div className="truncate">
                              <p className="text-xs font-bold text-slate-800">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono truncate">{u.email}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 shadow-inner">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-extrabold uppercase shrink-0">
                      {selectedUser.name.substring(0, 2)}
                    </div>
                    <div className="truncate">
                      <h4 className="text-xs font-bold text-slate-800">{selectedUser.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{selectedUser.email}</p>
                    </div>
                  </div>
                  <button
                    id="change-selected-user-btn"
                    onClick={() => {
                      setSelectedUser(null);
                      setSelectedCashbook(null);
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors cursor-pointer shrink-0"
                    title="Change User"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Step 2: Cashbook selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Target Cashbook <span className="text-rose-500">*</span>
              </label>

              {!selectedUser ? (
                <div className="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-lg p-3 text-center">
                  Select a user to populate target cashbooks
                </div>
              ) : userCashbooks.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 border border-dashed border-amber-100 rounded-lg p-3 text-center font-medium">
                  This user doesn't have any cashbooks yet
                </div>
              ) : (
                <div className="relative">
                  <select
                    id="cashbook-selection-dropdown"
                    value={selectedCashbook ? selectedCashbook.id : ''}
                    onChange={(e) => {
                      const cb = userCashbooks.find(c => c.id === e.target.value);
                      setSelectedCashbook(cb || null);
                    }}
                    className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none font-medium"
                  >
                    {userCashbooks.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>

          </div>

          {/* New Entry Form Card (Enabled only when Scope is fully resolved) */}
          {selectedUser && selectedCashbook && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-sans text-base font-bold text-slate-900">Add Ledger Record</h3>
              </div>

              <form onSubmit={handleCreateEntry} className="space-y-4">
                
                {/* Type toggle: Cash In or Cash Out */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 border border-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'out' }))}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      formData.type === 'out'
                        ? 'bg-rose-500 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Cash Out (Expense)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, type: 'in' }))}
                    className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                      formData.type === 'in'
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Cash In (Income)
                  </button>
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="entry-amount-input"
                      type="number"
                      required
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full h-10 pl-9 pr-3 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-semibold"
                    />
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  </div>
                </div>

                {/* Merchant / Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Merchant / Details <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="entry-merchant-input"
                    type="text"
                    required
                    placeholder="e.g. Amazon Cloud, Pizza Hut"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Category & Mode */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Category
                    </label>
                    <select
                      id="entry-category-select"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full h-10 px-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {categories.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Payment Mode
                    </label>
                    <select
                      id="entry-mode-select"
                      value={formData.mode}
                      onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                      className="w-full h-10 px-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      {paymentModes.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Date & Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Date
                    </label>
                    <input
                      id="entry-date-input"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Status
                    </label>
                    <select
                      id="entry-status-select"
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full h-10 px-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="Success">Success</option>
                      <option value="Processing">Processing</option>
                      <option value="Warning">Warning</option>
                    </select>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  id="record-ledger-submit-btn"
                  type="submit"
                  className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 mt-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Record Ledger Entry</span>
                </button>
              </form>
            </div>
          )}

        </div>

        {/* Right Side: Log Stage & filters (8 Cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            
            {/* Search and Simple Category/Mode Quick filters */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  id="entries-search-input"
                  type="text"
                  placeholder="Search merchant, category, amount, date, cashbook, user..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Scope lock summary */}
              {selectedCashbook && (
                <div className="h-10 px-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-xs text-slate-500">
                  <BookOpen className="w-4 h-4 text-slate-400" />
                  <span>Auditing: <strong className="text-slate-800 uppercase">{selectedCashbook.name}</strong></span>
                </div>
              )}
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
              
              {/* Category Filter */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Category</label>
                <select
                  id="filter-category"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              {/* Payment Mode Filter */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Mode</label>
                <select
                  id="filter-payment-mode"
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Modes</option>
                  {paymentModes.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Source (AI vs Manual) Filter */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Source</label>
                <select
                  id="filter-ai-source"
                  value={aiFilter}
                  onChange={(e) => setAiFilter(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="All">All Entries</option>
                  <option value="AI">AI Entries Only</option>
                  <option value="Manual">Manual Entries Only</option>
                </select>
              </div>

              {/* Start Date */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Start Date</label>
                <input
                  id="filter-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none"
                />
              </div>

              {/* End Date */}
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">End Date</label>
                <input
                  id="filter-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-none"
                />
              </div>
            </div>

            {/* Clear Filters helper */}
            {(categoryFilter !== 'All' || modeFilter !== 'All' || aiFilter !== 'All' || startDate || endDate || searchQuery) && (
              <div className="flex justify-end pt-1">
                <button
                  id="clear-filters-btn"
                  onClick={() => {
                    setCategoryFilter('All');
                    setModeFilter('All');
                    setAiFilter('All');
                    setStartDate('');
                    setEndDate('');
                    setSearchQuery('');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                  <span>Clear Filters</span>
                </button>
              </div>
            )}
          </div>

          {/* Core Content View */}
          {!selectedUser || !selectedCashbook ? (
            /* Unselected State Prompt */
            <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="max-w-md">
                <h3 className="text-base font-bold text-slate-800">Resolve audit scope scope</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select a <strong>Customer / User</strong> and a corresponding <strong>Target Cashbook</strong> on the left panel to fetch and audit granular transactions.
                </p>
              </div>
            </div>
          ) : loadingEntries ? (
            /* Loading State */
            <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-xs font-semibold text-slate-500 font-mono">Fetching scoped ledger rows...</p>
            </div>
          ) : filteredEntries.length === 0 ? (
            /* Empty entries state */
            <div className="bg-white border border-slate-200 rounded-xl p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-3">
              <FileText className="w-10 h-10 text-slate-300" />
              <h3 className="text-sm font-bold text-slate-700">No transactions recorded</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                No ledger logs found matching the current search parameters or active filters for this cashbook.
              </p>
            </div>
          ) : viewMode === 'list' ? (
            
            /* LIST VIEW: Professional Data Table */
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="py-3.5 px-4 font-semibold">Date</th>
                      <th className="py-3.5 px-4 font-semibold">Merchant / Details</th>
                      <th className="py-3.5 px-4 font-semibold">Category</th>
                      <th className="py-3.5 px-4 font-semibold">Payment Mode</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Cash In</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Cash Out</th>
                      <th className="py-3.5 px-4 font-semibold text-right">Balance</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Attachment</th>
                      <th className="py-3.5 px-4 font-semibold">Created By</th>
                      <th className="py-3.5 px-4 font-semibold">Created Time</th>
                      <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700 bg-white">
                    {filteredEntries.map(e => {
                      const balance = runningBalancesMap.get(e.id) ?? 0;
                      const hasAttachments = e.attachments && e.attachments.length > 0;
                      const firstAttachment = hasAttachments ? e.attachments[0] : null;

                      return (
                        <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                          {/* Date */}
                          <td className="py-3.5 px-4 font-mono font-medium text-slate-500 whitespace-nowrap">
                            {e.date || 'N/A'}
                          </td>

                          {/* Merchant / Details */}
                          <td className="py-3.5 px-4 font-bold text-slate-900 max-w-xs truncate" title={e.description}>
                            {e.description}
                          </td>

                          {/* Category */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700">
                              <Tag className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                              <span>{e.category}</span>
                            </span>
                          </td>

                          {/* Payment Mode */}
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 uppercase">
                              <CreditCard className="w-2.5 h-2.5 shrink-0" />
                              <span>{e.mode}</span>
                            </span>
                          </td>

                          {/* Cash In */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                            {e.type === 'in' && e.amount !== null ? (
                              `₹ ${e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Cash Out */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                            {e.type === 'out' && e.amount !== null ? (
                              `₹ ${e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Running Balance */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700 bg-slate-50/40 whitespace-nowrap">
                            ₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>

                          {/* Attachment Thumbnail */}
                          <td className="py-3.5 px-4 text-center">
                            {firstAttachment ? (
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(firstAttachment)}
                                className="inline-block relative rounded border border-slate-200 overflow-hidden hover:ring-2 hover:ring-blue-500 transition-all shadow-sm cursor-pointer"
                              >
                                {firstAttachment.fileType?.toLowerCase().includes('pdf') ? (
                                  <div className="w-8 h-8 bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-[8px] uppercase">
                                    PDF
                                  </div>
                                ) : (
                                  <img
                                    src={firstAttachment.url}
                                    alt="thumb"
                                    referrerPolicy="no-referrer"
                                    className="w-8 h-8 object-cover"
                                  />
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>

                          {/* Created By */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">
                                {e.userName?.substring(0, 2).toUpperCase() || 'AD'}
                              </div>
                              <span className="font-semibold text-slate-700">{e.userName}</span>
                            </div>
                          </td>

                          {/* Created Time */}
                          <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                            {e.time}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => handleDeleteEntry(e.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer inline-flex items-center justify-center"
                              title="Delete Transaction"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Audit validation Footer */}
              <div className="bg-slate-50 border-t border-slate-100 px-4 py-3 text-right text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">
                {filteredEntries.length} Transactions Audit Logs Loaded
              </div>
            </div>

          ) : (

            /* GRID VIEW: Modern Bento Cards Layout */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredEntries.map(e => {
                const balance = runningBalancesMap.get(e.id) ?? 0;
                const hasAttachments = e.attachments && e.attachments.length > 0;
                const firstAttachment = hasAttachments ? e.attachments[0] : null;

                return (
                  <div
                    key={e.id}
                    className="bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    {/* Card Header: Category & Date */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>{e.category}</span>
                      </span>

                      <span className="text-[11px] font-mono text-slate-400 font-medium">
                        {e.date}
                      </span>
                    </div>

                    {/* Card Body: Description and Amount */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{e.description}</h4>
                      
                      <div className="flex items-baseline justify-between mt-3">
                        {/* Transaction In or Out */}
                        <div className="flex items-center gap-1">
                          {e.type === 'in' ? (
                            <div className="flex items-center gap-1 text-emerald-600 font-bold text-base font-mono">
                              <ArrowUpRight className="w-4 h-4 shrink-0" />
                              <span>₹ {e.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-rose-600 font-bold text-base font-mono">
                              <ArrowDownLeft className="w-4 h-4 shrink-0" />
                              <span>₹ {e.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>

                        {/* Running Balance */}
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider font-mono">Running Bal.</p>
                          <p className="text-xs font-bold text-slate-700 font-mono">
                            ₹ {balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Attachment Thumbnail block if exists */}
                    {firstAttachment && (
                      <div className="relative rounded-lg border border-slate-200 bg-slate-50 overflow-hidden group shadow-sm">
                        {firstAttachment.fileType?.toLowerCase().includes('pdf') ? (
                          <div className="flex items-center justify-between p-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs uppercase">
                                PDF
                              </div>
                              <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{firstAttachment.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setPreviewAttachment(firstAttachment)}
                              className="p-1 bg-white hover:bg-slate-100 border border-slate-200 rounded text-slate-600 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Audit</span>
                            </button>
                          </div>
                        ) : (
                          <div className="h-28 relative">
                            <img
                              src={firstAttachment.url}
                              alt="Attachment preview"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => setPreviewAttachment(firstAttachment)}
                                className="px-3 py-1.5 bg-white text-slate-800 text-xs font-bold rounded-lg hover:bg-slate-100 shadow flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Preview Attachment</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Footer: Metadata and Actions */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      
                      <div className="flex items-center gap-1 truncate">
                        <span className="font-semibold text-slate-700 truncate">{e.userName}</span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono text-slate-400">{e.time}</span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Type Indicator */}
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-600 uppercase font-mono">
                          {e.mode}
                        </span>

                        <button
                          onClick={() => handleDeleteEntry(e.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

          )}

        </div>

      </div>

      {/* Attachment Full Modal Preview */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{previewAttachment.name}</h3>
                  <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider mt-0.5">
                    Format: {previewAttachment.fileType || 'Image'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: File display */}
            <div className="p-6 flex items-center justify-center bg-slate-100/40 min-h-[300px] max-h-[500px] overflow-y-auto">
              {previewAttachment.fileType?.toLowerCase().includes('pdf') ? (
                <div className="text-center p-8 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-2xl font-black mx-auto">
                    PDF
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">PDF Document Attachment</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-xs">
                      This is a PDF audit receipt. You can download the file or view it directly in your native browser tool.
                    </p>
                  </div>
                  <a
                    href={previewAttachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
                  >
                    Open PDF in New Tab
                  </a>
                </div>
              ) : (
                <img
                  src={previewAttachment.url}
                  alt="Full receipt"
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[400px] object-contain rounded-lg shadow border border-slate-200"
                />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setPreviewAttachment(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Close Audit View
              </button>
              <a
                href={previewAttachment.url}
                download
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Download Attachment
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
