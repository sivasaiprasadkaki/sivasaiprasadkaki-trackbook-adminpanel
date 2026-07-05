import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  X,
  AlertCircle,
  Grid,
  List
} from 'lucide-react';
import { Cashbook } from '../types';

interface CashbooksViewProps {
  onAddCashbook?: () => void;
}

export default function CashbooksView({ onAddCashbook }: CashbooksViewProps) {
  const [cashbooks, setCashbooks] = useState<Cashbook[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // View mode state
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (sessionStorage.getItem('cashbooks_view_mode') as 'grid' | 'list') || 'grid';
  });

  useEffect(() => {
    sessionStorage.setItem('cashbooks_view_mode', viewMode);
  }, [viewMode]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    manager: '',
    status: 'Active' as 'Active' | 'Under Budget' | 'Nearing Limit'
  });

  const fetchCashbooks = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cashbooks');
      if (res.ok) {
        const data = await res.json();
        setCashbooks(data);
      }
    } catch (err) {
      console.error('Error fetching cashbooks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCashbooks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.manager) return;

    try {
      const res = await fetch('/api/cashbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({ name: '', manager: '', status: 'Active' });
        fetchCashbooks();
        if (onAddCashbook) onAddCashbook();
      }
    } catch (err) {
      console.error('Error creating cashbook:', err);
    }
  };

  const filteredCashbooks = cashbooks.filter(cb =>
    cb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cb.manager.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">Cashbooks Registry</h2>
          <p className="text-slate-500 text-sm mt-1">Audit active expense accounts, department budgets, and inflows.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Cashbook</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search cashbooks by name or manager..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-1 shrink-0 shadow-inner">
          <button
            id="cb-view-mode-grid-toggle"
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>Grid View</span>
          </button>
          <button
            id="cb-view-mode-list-toggle"
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'list'
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <List className="w-4 h-4" />
            <span>List View</span>
          </button>
        </div>
      </div>

      {/* Grid or List of Cashbooks */}
      {loading ? (
        <p className="text-center py-10 text-slate-400 text-sm">Loading portfolios...</p>
      ) : filteredCashbooks.length === 0 ? (
        <p className="text-center py-12 text-slate-400 text-sm bg-white rounded-xl border border-slate-200 shadow-sm">No matching cashbooks found.</p>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCashbooks.map(cb => {
            const utilization = cb.totalInflow > 0 ? (cb.totalOutflow / cb.totalInflow) * 100 : 0;
            
            let statusBadge = 'bg-blue-50 text-blue-700';
            if (cb.status === 'Under Budget') statusBadge = 'bg-emerald-50 text-emerald-700';
            if (cb.status === 'Nearing Limit') statusBadge = 'bg-amber-50 text-amber-700';

            return (
              <div key={cb.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md hover:border-blue-500 transition-all duration-200 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge}`}>
                      {cb.status}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{cb.name}</h3>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <p>Managed by: <span className="font-semibold text-slate-700">{cb.manager}</span></p>
                    {(cb as any).ownerEmail && (
                      <p className="text-[11px] text-slate-400 font-mono">{(cb as any).ownerEmail}</p>
                    )}
                  </div>

                  {/* Current Balance */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-medium">Current Balance</span>
                    <span className="text-sm font-bold text-slate-900 font-mono">
                      ₹ {((cb as any).currentBalance !== undefined ? (cb as any).currentBalance : (cb.totalInflow - cb.totalOutflow)).toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 my-4">
                    <div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Total Inflow</span>
                      </div>
                      <div className="text-sm font-bold text-slate-800 mt-1 font-mono">
                        ₹ {cb.totalInflow.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <ArrowDownLeft className="w-3.5 h-3.5 text-red-500" />
                        <span>Total Outflow</span>
                      </div>
                      <div className="text-sm font-bold text-slate-800 mt-1 font-mono">
                        ₹ {cb.totalOutflow.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Audit Budget Utilization</span>
                    <span className="font-mono font-semibold">{utilization.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        utilization > 90 ? 'bg-red-500' : utilization > 75 ? 'bg-amber-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.min(utilization, 100)}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold uppercase tracking-wider font-mono">
                    <span>{cb.entriesCount} Total Logs</span>
                    <span className="text-[9px] text-slate-300">Audit-Validated</span>
                  </div>
                  <div className="pt-2 border-t border-slate-50 flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>Created: {(cb as any).createdDate || 'N/A'}</span>
                    <span>Updated: {(cb as any).updatedDate || 'N/A'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Cashbook / Manager</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Total Inflow</th>
                  <th className="py-3.5 px-4 text-right">Total Outflow</th>
                  <th className="py-3.5 px-4 text-right">Current Balance</th>
                  <th className="py-3.5 px-4">Budget Utilization</th>
                  <th className="py-3.5 px-5 text-right">Entries Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCashbooks.map(cb => {
                  const utilization = cb.totalInflow > 0 ? (cb.totalOutflow / cb.totalInflow) * 100 : 0;
                  
                  let statusBadge = 'bg-blue-50 text-blue-700';
                  if (cb.status === 'Under Budget') statusBadge = 'bg-emerald-50 text-emerald-700';
                  if (cb.status === 'Nearing Limit') statusBadge = 'bg-amber-50 text-amber-700';

                  return (
                    <tr key={cb.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Cashbook / Manager */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <Wallet className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{cb.name}</p>
                            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span>Managed by: {cb.manager}</span>
                              {(cb as any).ownerEmail && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="font-mono text-[11px] text-slate-400">{(cb as any).ownerEmail}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge}`}>
                          {cb.status}
                        </span>
                      </td>

                      {/* Total Inflow */}
                      <td className="py-4 px-4 text-right font-mono font-semibold text-slate-700">
                        ₹ {cb.totalInflow.toLocaleString('en-IN')}
                      </td>

                      {/* Total Outflow */}
                      <td className="py-4 px-4 text-right font-mono font-semibold text-slate-700">
                        ₹ {cb.totalOutflow.toLocaleString('en-IN')}
                      </td>

                      {/* Current Balance */}
                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">
                        ₹ {((cb as any).currentBalance !== undefined ? (cb as any).currentBalance : (cb.totalInflow - cb.totalOutflow)).toLocaleString('en-IN')}
                      </td>

                      {/* Budget Utilization */}
                      <td className="py-4 px-4 min-w-[180px]">
                        <div className="space-y-1.5 max-w-[150px]">
                          <div className="flex justify-between text-xs text-slate-500 font-semibold font-mono">
                            <span>{utilization.toFixed(1)}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                utilization > 90 ? 'bg-red-500' : utilization > 75 ? 'bg-amber-500' : 'bg-blue-600'
                              }`}
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Entries Count */}
                      <td className="py-4 px-5 text-right font-semibold text-slate-600">
                        <span className="bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 text-xs font-mono font-bold">
                          {cb.entriesCount} Logs
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Cashbook Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden animate-fade-in mx-4">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-sans text-base font-bold text-slate-900">Configure New Cashbook</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Cashbook / Account Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Operations Q4"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Account Manager
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={formData.manager}
                  onChange={(e) => setFormData({ ...formData, manager: e.target.value })}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Initial Status State
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full h-10 px-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Active">Active</option>
                  <option value="Under Budget">Under Budget</option>
                  <option value="Nearing Limit">Nearing Limit</option>
                </select>
              </div>

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
                  Configure Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
