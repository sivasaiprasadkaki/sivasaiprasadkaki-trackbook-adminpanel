import React, { useState, useEffect, useRef } from 'react';
import {
  Paperclip,
  Search,
  BookOpen,
  User,
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
  Download,
  ExternalLink,
  ChevronDown,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  File as FileIcon,
  Mail,
  Clock,
  ArrowRight,
  UserCheck
} from 'lucide-react';
import { AuditAttachment, Cashbook, User as AppUser, Entry } from '../types';

const fetch = (input: RequestInfo | URL, init?: RequestInit) => window.fetch(input, { ...init, credentials: 'include' });

export default function AttachmentsView() {
  // Directory Lists
  const [users, setUsers] = useState<AppUser[]>([]);
  const [cashbooks, setCashbooks] = useState<Cashbook[]>([]);
  const [loadingDirectory, setLoadingDirectory] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  // Filter form states
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [selectedCashbook, setSelectedCashbook] = useState<Cashbook | null>(null);
  const [attachmentSource, setAttachmentSource] = useState<'all' | 'manual' | 'ai'>('all');
  const [fileTypeFilter, setFileTypeFilter] = useState<'all' | 'image' | 'pdf' | 'excel' | 'csv' | 'other'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // User search dropdown states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Results state
  const [attachments, setAttachments] = useState<AuditAttachment[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(12);

  // Sorting
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // View state: grid vs list
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (sessionStorage.getItem('attachments_view_mode') as 'grid' | 'list') || 'list';
  });

  // Modal / Interaction states
  const [previewAttachment, setPreviewAttachment] = useState<AuditAttachment | null>(null);
  const [parentEntry, setParentEntry] = useState<Entry | null>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Outside click handler for searchable user dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch directory on mount
  useEffect(() => {
    fetchDirectory();
  }, []);

  // Sync viewMode preference
  useEffect(() => {
    sessionStorage.setItem('attachments_view_mode', viewMode);
  }, [viewMode]);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchDirectory = async () => {
    try {
      setLoadingDirectory(true);
      const [usersRes, cashbooksRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/cashbooks')
      ]);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData);
      }
      if (cashbooksRes.ok) {
        const cbData = await cashbooksRes.json();
        setCashbooks(cbData);
      }
    } catch (err) {
      console.error('Error fetching directory data:', err);
      showNotification('Failed to load system directories.', 'error');
    } finally {
      setLoadingDirectory(false);
    }
  };

  // Filter cashbooks to display only those belonging to the selected user
  const userCashbooks = cashbooks.filter(cb => {
    if (!selectedUser) return false;
    return (
      cb.userId === selectedUser.id ||
      cb.ownerEmail === selectedUser.email ||
      cb.manager === selectedUser.name
    );
  });

  // Automatically reset selected cashbook if selected user changes and selected cashbook doesn't belong to them
  useEffect(() => {
    if (selectedUser) {
      if (selectedCashbook) {
        const stillValid = userCashbooks.some(cb => cb.id === selectedCashbook.id);
        if (!stillValid) setSelectedCashbook(null);
      }
    } else {
      setSelectedCashbook(null);
    }
  }, [selectedUser]);

  // Fetch Attachments handler
  const handleFetchAttachments = async () => {
    try {
      setLoadingAttachments(true);
      
      const queryParams = new URLSearchParams();
      if (selectedUser) {
        queryParams.append('userId', selectedUser.id);
      }
      if (selectedCashbook) {
        queryParams.append('cashbookId', selectedCashbook.id);
      }
      queryParams.append('source', attachmentSource);
      queryParams.append('fileType', fileTypeFilter);
      if (startDate) {
        queryParams.append('startDate', startDate);
      }
      if (endDate) {
        queryParams.append('endDate', endDate);
      }

      const res = await fetch(`/api/attachments?${queryParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data);
        setHasFetched(true);
        setVisibleCount(12); // Reset lazy load count
        showNotification(`Successfully synchronized ${data.length} audit attachments.`);
      } else {
        showNotification('Failed to fetch matching attachments.', 'error');
      }
    } catch (err) {
      console.error('Fetch attachments error:', err);
      showNotification('Network error synchronizing documents.', 'error');
    } finally {
      setLoadingAttachments(false);
    }
  };

  // Delete handler
  const handleDeleteAttachment = async (id: string) => {
    try {
      const res = await fetch(`/api/attachments/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        showNotification('Attachment permanently unlinked & deleted.');
        setAttachments(prev => prev.filter(att => att.id !== id));
        if (previewAttachment?.id === id) setPreviewAttachment(null);
        setDeletingId(null);
      } else {
        showNotification('Failed to delete attachment.', 'error');
      }
    } catch (err) {
      console.error('Delete attachment error:', err);
      showNotification('Error contacting server to delete document.', 'error');
    }
  };

  // Open entry details modal
  const handleOpenEntry = async (entryId: string) => {
    if (!entryId) {
      showNotification('This attachment is unlinked or has no transaction entry.', 'error');
      return;
    }

    try {
      setLoadingEntry(true);
      const res = await fetch('/api/entries');
      if (res.ok) {
        const entries: Entry[] = await res.json();
        const match = entries.find(e => e.id === entryId);
        if (match) {
          setParentEntry(match);
        } else {
          showNotification('Matching transaction entry not found in active ledger.', 'error');
        }
      } else {
        showNotification('Failed to load transaction ledger.', 'error');
      }
    } catch (err) {
      console.error('Open entry error:', err);
      showNotification('Error retrieving ledger details.', 'error');
    } finally {
      setLoadingEntry(false);
    }
  };

  // Helper: Get icon based on file extension / type
  const getFileIcon = (fileType?: string) => {
    const ext = (fileType || 'PDF').toLowerCase();
    if (ext.includes('pdf')) {
      return <FileText className="w-5 h-5 text-red-600" />;
    }
    if (ext.includes('xls') || ext.includes('xlsx') || ext.includes('excel') || ext.includes('sheet')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    if (ext.includes('csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-teal-600" />;
    }
    if (ext.includes('png') || ext.includes('jpg') || ext.includes('jpeg') || ext.includes('gif') || ext.includes('image')) {
      return <ImageIcon className="w-5 h-5 text-blue-600" />;
    }
    return <FileIcon className="w-5 h-5 text-slate-500" />;
  };

  // Helper: Get background style for file type icons
  const getFileIconBg = (fileType?: string) => {
    const ext = (fileType || 'PDF').toLowerCase();
    if (ext.includes('pdf')) return 'bg-red-50 border border-red-100';
    if (ext.includes('xls') || ext.includes('xlsx') || ext.includes('excel') || ext.includes('sheet')) return 'bg-emerald-50 border border-emerald-100';
    if (ext.includes('csv')) return 'bg-teal-50 border border-teal-100';
    if (ext.includes('png') || ext.includes('jpg') || ext.includes('jpeg') || ext.includes('gif') || ext.includes('image')) return 'bg-blue-50 border border-blue-100';
    return 'bg-slate-50 border border-slate-100';
  };

  // Filtered attachments by global search query
  const filteredAttachments = attachments.filter(att => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    return (
      att.fileName.toLowerCase().includes(query) ||
      att.userName.toLowerCase().includes(query) ||
      att.userEmail.toLowerCase().includes(query) ||
      att.cashbookName.toLowerCase().includes(query) ||
      att.entryTitle.toLowerCase().includes(query) ||
      att.fileType.toLowerCase().includes(query)
    );
  });

  // Sorted attachments
  const sortedAttachments = [...filteredAttachments].sort((a, b) => {
    let fieldA: any = a.uploadedAt;
    let fieldB: any = b.uploadedAt;

    if (sortBy === 'name') {
      fieldA = a.fileName.toLowerCase();
      fieldB = b.fileName.toLowerCase();
    } else if (sortBy === 'size') {
      // Crude size sorting based on strings, but standard fallback is fine
      fieldA = a.fileSize;
      fieldB = b.fileSize;
    }

    if (fieldA < fieldB) return sortOrder === 'asc' ? -1 : 1;
    if (fieldA > fieldB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const displayedAttachments = sortedAttachments.slice(0, visibleCount);

  // Filtered users for input query
  const searchedUsers = users.filter(u => {
    const q = userSearchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-55 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl transition-all duration-300 animate-slide-in ${
          notification.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
            : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>
          {notification.type === 'success' ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold">✓</div>
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          )}
          <span className="text-sm font-semibold">{notification.message}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Attachment Administration</h2>
          <p className="text-slate-500 text-sm mt-1">Search, view, audit, and manage all users' digital attachments stored in Cloud Storage.</p>
        </div>

        {/* List/Grid View toggles */}
        <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'list'
                ? 'bg-white text-blue-600 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List View</span>
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
              viewMode === 'grid'
                ? 'bg-white text-blue-600 shadow-sm font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Grid View</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT PANEL - FILTER FORM */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative">
            <div className="flex items-center gap-2 pb-4 mb-5 border-b border-slate-100">
              <Filter className="w-4 h-4 text-blue-600" />
              <h3 className="font-sans text-sm font-bold text-slate-900 uppercase tracking-wider">Audit Scope Selector</h3>
            </div>

            <div className="space-y-4">
              {/* Searchable User Selection */}
              <div className="relative" ref={userDropdownRef}>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  1. Customer / User <span className="text-rose-500">*</span>
                </label>
                
                {selectedUser ? (
                  <div className="flex items-center justify-between p-3 bg-blue-50/50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                        {selectedUser.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-800 leading-tight">{selectedUser.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">{selectedUser.email}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedUser(null);
                        setUserSearchQuery('');
                      }}
                      className="p-1 rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search register user (Shiva, Sarah...)"
                        value={userSearchQuery}
                        onFocus={() => setIsUserDropdownOpen(true)}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value);
                          setIsUserDropdownOpen(true);
                        }}
                        className="w-full h-11 pl-9 pr-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {isUserDropdownOpen && (
                      <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-20 max-h-56 overflow-y-auto">
                        {loadingDirectory ? (
                          <div className="p-3 text-center text-xs text-slate-400">Loading directory...</div>
                        ) : searchedUsers.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">No users matched</div>
                        ) : (
                          searchedUsers.map(user => (
                            <button
                              key={user.id}
                              onClick={() => {
                                setSelectedUser(user);
                                setIsUserDropdownOpen(false);
                              }}
                              className="w-full px-4 py-2.5 hover:bg-slate-50 text-left flex items-center gap-3 transition-colors cursor-pointer border-b border-slate-50 last:border-0"
                            >
                              <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-600">
                                {user.name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-800">{user.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{user.email}</div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Target Cashbook Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  2. Target Cashbook
                </label>
                {selectedUser ? (
                  <div className="relative">
                    <select
                      value={selectedCashbook?.id || 'all'}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === 'all') {
                          setSelectedCashbook(null);
                        } else {
                          const matched = userCashbooks.find(cb => cb.id === val);
                          if (matched) setSelectedCashbook(matched);
                        }
                      }}
                      className="w-full h-11 px-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-blue-500 outline-none appearance-none pr-10 cursor-pointer font-sans"
                    >
                      <option value="all">All Cashbooks ({userCashbooks.length})</option>
                      {userCashbooks.map(cb => (
                        <option key={cb.id} value={cb.id}>{cb.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                ) : (
                  <div className="p-3 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg bg-slate-50/50 flex items-center justify-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-slate-300" />
                    <span>Select a user to populate target cashbooks</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 my-4 pt-4 space-y-4">
                {/* Source Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    3. Attachment Source
                  </label>
                  <div className="relative">
                    <select
                      value={attachmentSource}
                      onChange={(e) => setAttachmentSource(e.target.value as any)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-blue-500 outline-none appearance-none pr-10 cursor-pointer font-sans font-medium"
                    >
                      <option value="all">All (Manual & AI)</option>
                      <option value="manual">Manual Attachments</option>
                      <option value="ai">AI Attachments (Receipt Scanning)</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* File Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    4. File Type
                  </label>
                  <div className="relative">
                    <select
                      value={fileTypeFilter}
                      onChange={(e) => setFileTypeFilter(e.target.value as any)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:border-blue-500 outline-none appearance-none pr-10 cursor-pointer font-sans font-medium"
                    >
                      <option value="all">All Formats</option>
                      <option value="image">Image (PNG, JPEG, etc.)</option>
                      <option value="pdf">PDF Document</option>
                      <option value="excel">Excel Document</option>
                      <option value="csv">CSV Spreadsheet</option>
                      <option value="other">Other Extensions</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Date range filters */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">From</label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full h-9 pl-7 pr-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 outline-none font-sans"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">To</label>
                    <div className="relative">
                      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full h-9 pl-7 pr-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:border-blue-500 outline-none font-sans"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleFetchAttachments}
                disabled={loadingAttachments}
                className="w-full h-11 mt-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                {loadingAttachments ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synchronizing Storage...</span>
                  </>
                ) : (
                  <>
                    <Filter className="w-4 h-4" />
                    <span>Fetch Attachments</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL - RESULTS STAGE */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            
            {/* Toolbar section */}
            <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-50/50">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search file name, user name, email, cashbook, entry title..."
                  value={searchQuery}
                  disabled={!hasFetched}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-4 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 outline-none shadow-xs"
                />
              </div>

              {/* Sorting and result count */}
              <div className="flex items-center gap-3 self-end md:self-auto">
                <span className="text-xs font-mono text-slate-400 font-semibold uppercase">
                  {hasFetched ? `${filteredAttachments.length} matches` : '0 matches'}
                </span>
                
                {hasFetched && (
                  <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="h-8 px-2 bg-white border border-slate-200 rounded text-[11px] font-medium text-slate-600 outline-none"
                    >
                      <option value="date">Sort by Date</option>
                      <option value="name">Sort by Name</option>
                      <option value="size">Sort by Size</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                      className="h-8 px-2 bg-white border border-slate-200 hover:bg-slate-50 rounded text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                      title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                    >
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Main Stage Content */}
            {!hasFetched ? (
              /* Instructions Placeholder Stage */
              <div className="p-16 text-center flex flex-col items-center justify-center bg-white min-h-[420px]">
                <div className="w-16 h-16 rounded-full bg-blue-50/60 border border-blue-100 flex items-center justify-center text-blue-600 mb-5 animate-pulse">
                  <Paperclip className="w-7 h-7" />
                </div>
                <h3 className="font-sans text-lg font-bold text-slate-900 tracking-tight">Resolve Audit Scope</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-md leading-relaxed">
                  Select a registered <strong className="text-slate-800 font-semibold">Customer / User</strong> and a corresponding <strong className="text-slate-800 font-semibold">Target Cashbook</strong> on the left selector panel, then click <strong className="text-blue-600">Fetch Attachments</strong> to pull matched digital assets from Supabase storage.
                </p>
                <div className="flex items-center gap-2 mt-6 p-2.5 bg-blue-50/30 rounded-lg text-xs font-mono text-blue-700 border border-blue-100/50">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Real-time storage auditor v1.2</span>
                </div>
              </div>
            ) : loadingAttachments ? (
              /* Loading Spinner Stage */
              <div className="p-16 text-center flex flex-col items-center justify-center bg-white min-h-[420px]">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                <h4 className="font-sans text-sm font-semibold text-slate-800">Synchronizing storage directory...</h4>
                <p className="text-xs text-slate-400 mt-1.5 font-mono">Fetching blobs and matching ledger entries from database...</p>
              </div>
            ) : filteredAttachments.length === 0 ? (
              /* Empty matched state */
              <div className="p-16 text-center flex flex-col items-center justify-center bg-white min-h-[420px]">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h4 className="font-sans text-sm font-bold text-slate-900">No matching attachments found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                  No files matched your active filter rules or user cashbook assignments. Adjust the left selector or the global search terms.
                </p>
              </div>
            ) : viewMode === 'list' ? (
              /* List View layout */
              <div className="overflow-auto max-h-[500px] relative">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="sticky top-0 bg-slate-100 z-10 px-5 py-3 shadow-[inset_0_-1px_0_rgba(226,232,240,1)]">Attachment</th>
                      <th className="sticky top-0 bg-slate-100 z-10 px-5 py-3 shadow-[inset_0_-1px_0_rgba(226,232,240,1)]">Creator / Owner</th>
                      <th className="sticky top-0 bg-slate-100 z-10 px-5 py-3 shadow-[inset_0_-1px_0_rgba(226,232,240,1)]">Destination Link</th>
                      <th className="sticky top-0 bg-slate-100 z-10 px-5 py-3 shadow-[inset_0_-1px_0_rgba(226,232,240,1)]">Type & Size</th>
                      <th className="sticky top-0 bg-slate-100 z-10 px-5 py-3 shadow-[inset_0_-1px_0_rgba(226,232,240,1)]">Audit Details</th>
                      <th className="sticky top-0 bg-slate-100 z-10 px-5 py-3 text-right shadow-[inset_0_-1px_0_rgba(226,232,240,1)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {displayedAttachments.map(att => {
                      const isImage = att.fileType.includes('PNG') || att.fileType.includes('JPG') || att.fileType.includes('JPEG');
                      
                      return (
                        <tr key={att.id} className="hover:bg-slate-50/70 group transition-colors">
                          {/* File Details with Thumb */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-11 h-11 rounded-lg flex items-center justify-center overflow-hidden shrink-0 ${getFileIconBg(att.fileType)}`}>
                                {isImage && att.fileUrl ? (
                                  <img src={att.fileUrl} alt="Thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  getFileIcon(att.fileType)
                                )}
                              </div>
                              <div className="max-w-[160px] md:max-w-[200px]">
                                <div className="font-bold text-slate-900 truncate leading-snug" title={att.fileName}>
                                  {att.fileName}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate" title={att.cloudStoragePath}>
                                  {att.cloudStoragePath}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Creator Info */}
                          <td className="px-5 py-3">
                            <div className="font-semibold text-slate-800">{att.userName}</div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{att.userEmail}</div>
                          </td>

                          {/* Destination links */}
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1 font-semibold text-blue-600">
                              <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[120px]" title={att.cashbookName}>{att.cashbookName}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium truncate max-w-[140px] mt-0.5" title={att.entryTitle}>
                              {att.entryTitle}
                            </div>
                          </td>

                          {/* Extension and size */}
                          <td className="px-5 py-3 font-mono">
                            <div className="font-bold text-slate-700">{att.fileType}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{att.fileSize}</div>
                          </td>

                          {/* Audit details / source badge */}
                          <td className="px-5 py-3">
                            <div className="flex flex-col items-start gap-1">
                              {att.source === 'AI Attachment' ? (
                                <button
                                  onClick={() => {
                                    setAttachmentSource('ai');
                                    handleFetchAttachments();
                                  }}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100 hover:bg-purple-100 transition-colors shadow-xs"
                                >
                                  AI Attachment
                                </button>
                              ) : (
                                <button
                                  onClick={() => {
                                    setAttachmentSource('manual');
                                    handleFetchAttachments();
                                  }}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 hover:bg-blue-100 transition-colors shadow-xs"
                                >
                                  Manual
                                </button>
                              )}
                              <div className="text-[9px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(att.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                              </div>
                            </div>
                          </td>

                          {/* Action controls */}
                          <td className="px-5 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                              {att.fileUrl && (
                                <>
                                  <button
                                    onClick={() => setPreviewAttachment(att)}
                                    title="Preview file"
                                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center shadow-xs cursor-pointer transition-colors"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <a
                                    href={att.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Download copy"
                                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center shadow-xs cursor-pointer transition-colors"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                </>
                              )}
                              {att.entryId && (
                                <button
                                  onClick={() => handleOpenEntry(att.entryId)}
                                  title="Open Ledger Entry"
                                  className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-blue-600 hover:text-blue-700 flex items-center justify-center shadow-xs cursor-pointer transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setDeletingId(att.id)}
                                title="Delete Attachment"
                                className="w-8 h-8 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 flex items-center justify-center shadow-xs cursor-pointer transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid View layout */
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-slate-50/30">
                {displayedAttachments.map(att => {
                  const isImage = att.fileType.includes('PNG') || att.fileType.includes('JPG') || att.fileType.includes('JPEG');

                  return (
                    <div
                      key={att.id}
                      className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-blue-500 group transition-all flex flex-col h-[320px]"
                    >
                      {/* File visual frame */}
                      <div className="h-32 bg-slate-100 relative border-b border-slate-100 flex items-center justify-center overflow-hidden">
                        {isImage && att.fileUrl ? (
                          <img
                            src={att.fileUrl}
                            alt={att.fileName}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getFileIconBg(att.fileType)}`}>
                              {getFileIcon(att.fileType)}
                            </div>
                            <span className="font-mono text-[10px] font-bold text-slate-400 tracking-wider">
                              {att.fileType} DOCUMENT
                            </span>
                          </div>
                        )}

                        {/* Source overlay tag */}
                        <div className="absolute top-2.5 left-2.5">
                          {att.source === 'AI Attachment' ? (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-purple-100/90 backdrop-blur-xs text-purple-800 border border-purple-200 shadow-xs">
                              AI Scanned
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-100/90 backdrop-blur-xs text-blue-800 border border-blue-200 shadow-xs">
                              Manual
                            </span>
                          )}
                        </div>

                        {/* Size tag */}
                        <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 bg-slate-900/80 text-white rounded font-mono text-[9px] font-semibold">
                          {att.fileSize}
                        </span>
                      </div>

                      {/* Info Frame */}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <h4 className="font-sans text-xs font-bold text-slate-900 leading-tight truncate group-hover:text-blue-600 transition-colors" title={att.fileName}>
                            {att.fileName}
                          </h4>
                          
                          {/* Owner details */}
                          <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-slate-500">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate font-semibold" title={`${att.userName} (${att.userEmail})`}>
                              {att.userName}
                            </span>
                          </div>

                          {/* Cashbook / Entry detail links */}
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-slate-400 font-medium">
                            <div className="truncate">
                              <span className="font-mono uppercase text-[8px] text-slate-400 block tracking-wider">CASHBOOK</span>
                              <span className="text-slate-700 font-semibold truncate block" title={att.cashbookName}>
                                {att.cashbookName}
                              </span>
                            </div>
                            <div className="truncate">
                              <span className="font-mono uppercase text-[8px] text-slate-400 block tracking-wider">ENTRY</span>
                              <span className="text-slate-500 font-medium truncate block" title={att.entryTitle}>
                                {att.entryTitle}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Card actions */}
                        <div className="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(att.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}
                          </span>

                          <div className="flex items-center gap-1">
                            {att.fileUrl && (
                              <>
                                <button
                                  onClick={() => setPreviewAttachment(att)}
                                  className="w-7 h-7 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Preview document"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                                <a
                                  href={att.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="w-7 h-7 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center transition-colors"
                                  title="Download"
                                >
                                  <Download className="w-3 h-3" />
                                </a>
                              </>
                            )}
                            {att.entryId && (
                              <button
                                onClick={() => handleOpenEntry(att.entryId)}
                                className="w-7 h-7 rounded bg-blue-50/50 border border-blue-100 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors cursor-pointer"
                                title="Inspect Entry"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingId(att.id)}
                              className="w-7 h-7 rounded bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination / Lazy load footer */}
            {hasFetched && sortedAttachments.length > visibleCount && (
              <div className="p-4 bg-white border-t border-slate-100 text-center flex flex-col items-center justify-center gap-2">
                <span className="text-xs text-slate-500 font-medium">
                  Showing {displayedAttachments.length} of {sortedAttachments.length} attachments
                </span>
                <button
                  onClick={() => setVisibleCount(prev => prev + 12)}
                  className="h-9 px-6 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>Load More Attachments</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: PREVIEW ATTACHMENT */}
      {previewAttachment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col h-[520px]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getFileIconBg(previewAttachment.fileType)}`}>
                  {getFileIcon(previewAttachment.fileType)}
                </div>
                <div>
                  <h3 className="font-sans text-xs font-bold text-slate-900 leading-tight max-w-[400px] truncate" title={previewAttachment.fileName}>
                    {previewAttachment.fileName}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Size: <strong className="text-slate-600 font-mono">{previewAttachment.fileSize}</strong> | Format: <strong className="text-slate-600 font-mono">{previewAttachment.fileType}</strong></p>
                </div>
              </div>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Blob body preview */}
            <div className="flex-1 bg-slate-900 relative p-4 flex items-center justify-center">
              {previewAttachment.fileType.toLowerCase().match(/(png|jpg|jpeg|gif)/) ? (
                <img
                  src={previewAttachment.fileUrl}
                  alt={previewAttachment.fileName}
                  className="max-w-full max-h-full object-contain rounded-md shadow-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-center text-white p-8 max-w-sm">
                  <FileIcon className="w-16 h-16 mx-auto text-slate-500 mb-4 animate-pulse" />
                  <h4 className="font-sans text-sm font-bold">Document Preview Not Supported In Browser</h4>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    This file format ({previewAttachment.fileType}) cannot be rendered directly inside the frame. Download or open in a new tab to inspect its raw content.
                  </p>
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <a
                      href={previewAttachment.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Action panel footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <div className="text-[10px] text-slate-500 font-medium">
                Uploaded by <strong className="text-slate-700">{previewAttachment.userName}</strong> on {new Date(previewAttachment.uploadedAt).toLocaleDateString()}
              </div>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="h-9 px-4 border border-slate-200 hover:bg-white text-slate-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OPEN ENTRY DETAILS */}
      {parentEntry && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                <h3 className="font-sans text-sm font-bold tracking-tight">Ledger Entry Audit</h3>
              </div>
              <button
                onClick={() => setParentEntry(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-blue-100 hover:bg-blue-700 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Entry fields information */}
            <div className="p-6 space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">Transaction ID</h4>
                  <p className="text-xs font-bold text-slate-800 font-mono mt-0.5">{parentEntry.id}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  parentEntry.status === 'Success'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : parentEntry.status === 'Processing'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  {parentEntry.status}
                </span>
              </div>

              {/* Title / Description */}
              <div>
                <h4 className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">Description / Action</h4>
                <p className="text-sm font-bold text-slate-900 mt-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  {parentEntry.action}
                </p>
              </div>

              {/* Amount Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">Flow Type</h4>
                  <span className={`inline-flex items-center gap-1 mt-1 text-xs font-bold ${
                    parentEntry.type === 'in' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {parentEntry.type === 'in' ? '▲ Cash Inflow' : '▼ Cash Outflow'}
                  </span>
                </div>
                <div>
                  <h4 className="font-mono text-[10px] uppercase font-bold tracking-wider text-slate-400">Ledger Amount</h4>
                  <p className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                    ₹ {(parentEntry.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-100 my-4 pt-4 grid grid-cols-2 gap-4 text-xs">
                {/* Cashbook */}
                <div>
                  <span className="text-slate-400 font-semibold block">Target Cashbook</span>
                  <span className="text-slate-800 font-bold block mt-0.5">{parentEntry.cashbookName || 'N/A'}</span>
                </div>

                {/* Logged by */}
                <div>
                  <span className="text-slate-400 font-semibold block">Logged By</span>
                  <span className="text-slate-800 font-bold block mt-0.5">{parentEntry.userName || 'Admin'}</span>
                </div>

                {/* Category */}
                <div>
                  <span className="text-slate-400 font-semibold block flex items-center gap-1">
                    <Tag className="w-3 h-3 text-slate-400" />
                    <span>Category</span>
                  </span>
                  <span className="text-slate-800 font-bold block mt-0.5">{parentEntry.category || 'Misc'}</span>
                </div>

                {/* Mode */}
                <div>
                  <span className="text-slate-400 font-semibold block flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-slate-400" />
                    <span>Payment Mode</span>
                  </span>
                  <span className="text-slate-800 font-bold block mt-0.5">{parentEntry.mode || 'Cash'}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-between text-xs font-mono text-slate-500 border border-slate-100">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{parentEntry.date}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>{parentEntry.time || 'N/A'}</span>
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setParentEntry(null)}
                className="h-10 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-sans text-base font-bold text-slate-900">Confirm Asset Deletion</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you absolutely sure you want to delete this attachment? This will permanently unlink and remove the document record from Supabase. This action cannot be undone.
            </p>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 h-10 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => deletingId && handleDeleteAttachment(deletingId)}
                className="flex-1 h-10 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs shadow-sm transition-all cursor-pointer animate-pulse"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
