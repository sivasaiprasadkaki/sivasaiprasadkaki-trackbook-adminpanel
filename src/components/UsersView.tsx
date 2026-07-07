import React, { useState, useEffect } from 'react';
import {
  Users,
  UserCheck,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Download,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  CheckCircle2
} from 'lucide-react';
import { User } from '../types';

const fetch = (input: RequestInfo | URL, init?: RequestInit) => window.fetch(input, { ...init, credentials: 'include' });

interface UsersViewProps {
  onRefreshStats?: () => void;
}

export default function UsersView({ onRefreshStats }: UsersViewProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'today'>('all');

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    role: 'User' as 'Admin' | 'Manager' | 'User',
    email: '',
    phone: '',
    status: 'Active' as 'Active' | 'Pending' | 'Inactive'
  });

  const [notification, setNotification] = useState<string | null>(null);

  // Helper: check if user joined today
  const isJoinedToday = (joinedDateStr?: string) => {
    if (!joinedDateStr) return false;
    try {
      const date = new Date(joinedDateStr);
      const today = new Date();
      return date.getDate() === today.getDate() &&
             date.getMonth() === today.getMonth() &&
             date.getFullYear() === today.getFullYear();
    } catch (e) {
      return false;
    }
  };

  // Helper: format last seen timestamp
  const formatLastSeen = (lastSeenStr?: string) => {
    if (!lastSeenStr) return 'Never';
    try {
      const date = new Date(lastSeenStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffMins < 1440) {
        const hrs = Math.floor(diffMins / 60);
        return `${hrs}h ago`;
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Never';
    }
  };

  // Fetch users from server
  const fetchUsers = async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(true);
    // Real-time auto-refresh interval for user status
    const interval = setInterval(() => fetchUsers(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Submit form (Create / Update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email) return;

    try {
      const url = isEditMode && selectedUser ? `/api/users/${selectedUser.id}` : '/api/users';
      const method = isEditMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        triggerNotification(isEditMode ? 'User profile updated successfully!' : 'New user registered successfully!');
        setIsModalOpen(false);
        setFormData({ name: '', role: 'User', email: '', phone: '', status: 'Active' });
        setSelectedUser(null);
        fetchUsers();
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err) {
      console.error('Error saving user:', err);
    }
  };

  // Delete User
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (res.ok) {
        triggerNotification('User deleted from registry.');
        fetchUsers();
        if (onRefreshStats) onRefreshStats();
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  // Open Edit Modal
  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setIsEditMode(true);
    setFormData({
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone || '',
      status: user.status
    });
    setIsModalOpen(true);
  };

  // Export CSV
  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Name,Role,Email,Phone,Status,JoinedDate"].join(",") + "\n"
      + users.map(u => `"${u.name}","${u.role}","${u.email}","${u.phone || ''}","${u.status}","${u.joinedDate}"`).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TrackBook_Users_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerNotification('Users registry exported to CSV format.');
  };

  // Filters
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.phone && user.phone.includes(searchQuery));
    
    const matchesRole = roleFilter === 'All' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'All' || user.status === statusFilter;

    let matchesTab = true;
    if (activeTab === 'live') {
      matchesTab = !!user.isOnline;
    } else if (activeTab === 'today') {
      matchesTab = isJoinedToday(user.joinedDate);
    }

    return matchesSearch && matchesRole && matchesStatus && matchesTab;
  });

  // Dynamic calculations for real stats
  const totalUsersCount = users.length;
  const liveUsersCount = users.filter(u => u.isOnline).length;
  const newUsersTodayCount = users.filter(u => isJoinedToday(u.joinedDate)).length;

  return (
    <div className="space-y-6">
      {/* Top Notification banner */}
      {notification && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-4 flex items-center gap-3 transition-all duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Users Management</h2>
          <p className="text-slate-500 text-sm mt-1">Manage platform users, view their activity, and update roles.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExport}
            className="h-10 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-400" />
            <span>Export</span>
          </button>
          <button
            onClick={() => {
              setIsEditMode(false);
              setFormData({ name: '', role: 'User', email: '', phone: '', status: 'Active' });
              setIsModalOpen(true);
            }}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Stat 1 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalUsersCount}</h3>
            </div>
            <div className="w-10 h-10 rounded bg-blue-50 flex items-center justify-center text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 relative z-10 text-xs text-slate-500">
            <span className="text-emerald-600 font-mono font-bold flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> Direct Sync
            </span>
            <span>with Supabase Auth</span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Live Users</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
                <span>{liveUsersCount}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </h3>
            </div>
            <div className="w-10 h-10 rounded bg-emerald-50 flex items-center justify-center text-emerald-600">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 relative z-10 text-xs text-slate-500">
            <span className="text-emerald-600 font-mono font-bold flex items-center">
              Online State
            </span>
            <span>last seen &lt; 2m ago</span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/5 rounded-full group-hover:scale-110 transition-transform"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">New Users Today</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{newUsersTodayCount}</h3>
            </div>
            <div className="w-10 h-10 rounded bg-rose-50 flex items-center justify-center text-rose-600">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-center gap-1.5 relative z-10 text-xs text-slate-500">
            <span className="text-emerald-600 font-mono font-bold flex items-center">
              Real-time
            </span>
            <span>registered today</span>
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-slate-50/50">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-3.5 px-4 font-sans text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-150 cursor-pointer ${
              activeTab === 'all'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            All Users ({totalUsersCount})
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`py-3.5 px-4 font-sans text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'live'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
            Live Users ({liveUsersCount})
          </button>
          <button
            onClick={() => setActiveTab('today')}
            className={`py-3.5 px-4 font-sans text-xs font-semibold uppercase tracking-wider border-b-2 transition-all duration-150 cursor-pointer ${
              activeTab === 'today'
                ? 'border-blue-600 text-blue-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            New Users Today ({newUsersTodayCount})
          </button>
        </div>

        <div className="p-6 border-b border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users by name, email or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter role */}
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
              >
                <option value="All">All Roles</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="User">User</option>
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>

            {/* Filter status */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 pl-3 pr-8 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer appearance-none"
              >
                <option value="All">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Pending">Pending</option>
                <option value="Inactive">Inactive</option>
              </select>
              <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Contact Details</th>
                <th className="px-6 py-3">Online Status</th>
                <th className="px-6 py-3">Last Seen</th>
                <th className="px-6 py-3">Signup Date</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    Loading users registry...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                    No registry matches found.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const initials = user.name
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors h-[56px] group">
                      {/* Name & Role */}
                      <td className="px-6 py-2">
                        <div className="flex items-center gap-3">
                          {user.avatarUrl ? (
                            <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                              <img alt={user.name} src={user.avatarUrl} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                              {initials}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-slate-900">
                              {user.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">{user.role}</div>
                          </div>
                        </div>
                      </td>

                      {/* Contact details */}
                      <td className="px-6 py-2">
                        <div className="text-slate-900">{user.email}</div>
                        <div className="font-mono text-xs text-slate-400 mt-0.5">{user.phone || 'N/A'}</div>
                      </td>

                      {/* Online Status */}
                      <td className="px-6 py-2">
                        {user.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm animate-fade-in">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-500 border border-slate-200">
                            <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                            Offline
                          </span>
                        )}
                      </td>

                      {/* Last Seen */}
                      <td className="px-6 py-2 font-mono text-xs text-slate-600">
                        {formatLastSeen(user.lastSeen)}
                      </td>

                      {/* Signup Date */}
                      <td className="px-6 py-2 text-slate-500 font-sans">
                        {user.joinedDate}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-2 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            onClick={() => openEditModal(user)}
                            title="Edit user details"
                            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDelete(user.id)}
                            title="Delete user from system"
                            className="w-8 h-8 rounded-md flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-white text-xs">
          <div className="text-slate-500 font-sans">
            Showing <span className="font-semibold text-slate-800">1</span> to{' '}
            <span className="font-semibold text-slate-800">{filteredUsers.length}</span> of{' '}
            <span className="font-semibold text-slate-800">{users.length}</span> users
          </div>
          <div className="flex items-center gap-1 font-mono">
            <button className="w-7 h-7 rounded border border-slate-200 text-slate-400 flex items-center justify-center cursor-not-allowed" disabled>
              &lt;
            </button>
            <button className="w-7 h-7 rounded border border-blue-500 bg-blue-50 text-blue-600 font-bold flex items-center justify-center">
              1
            </button>
            <button className="w-7 h-7 rounded border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 cursor-pointer">
              2
            </button>
            <button className="w-7 h-7 rounded border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 cursor-pointer">
              3
            </button>
            <span className="px-1 text-slate-400">...</span>
            <button className="w-7 h-7 rounded border border-slate-200 text-slate-600 flex items-center justify-center hover:bg-slate-50 cursor-pointer">
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* Modal overlays */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-fade-in mx-4">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-sans text-base font-bold text-slate-900">
                {isEditMode ? 'Modify User Profile' : 'Register New User'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elena Rodriguez"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. elena@company.net"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. +1 (555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              {/* Grid: Role & Status */}
              <div className="grid grid-cols-2 gap-4">
                {/* Role */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    System Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                    className="w-full h-10 px-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="User">User</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Status State
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full h-10 px-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Pending">Pending</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 h-10 border border-slate-200 hover:bg-slate-50 rounded-lg text-sm font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer shadow-sm"
                >
                  {isEditMode ? 'Save Changes' : 'Register User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
