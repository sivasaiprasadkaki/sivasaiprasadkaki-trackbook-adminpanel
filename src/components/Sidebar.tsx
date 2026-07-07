import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  Paperclip,
  Cloud,
  Settings,
  BookOpenText,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange?: (tab: string) => void;
  onLogout?: () => void;
}

export default function Sidebar({ currentTab, onTabChange, onLogout }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'cashbooks', label: 'Cashbooks', icon: BookOpen },
    { id: 'entries', label: 'Entries', icon: ClipboardList },
    { id: 'attachments', label: 'Attachments', icon: Paperclip },
    { id: 'cloud', label: 'Cloud', icon: Cloud },
  ];

  return (
    <nav className="w-[260px] h-screen fixed left-0 top-0 bg-white border-r border-slate-200 flex flex-col py-6 z-50">
      {/* Brand Header */}
      <div className="px-6 pb-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
          <BookOpenText className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-sans text-xl font-bold text-slate-900 leading-none tracking-tight">TrackBook</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase font-semibold tracking-wider">Admin Panel</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <Link
              key={item.id}
              to={`/${item.id}`}
              onClick={() => onTabChange && onTabChange(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
                isActive
                  ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600 font-bold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-5 h-5 transition-colors ${
                isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'
              }`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Bottom Settings & Logout Links */}
      <div className="px-4 pt-4 border-t border-slate-100 space-y-1">
        <Link
          to="/settings"
          onClick={() => onTabChange && onTabChange('settings')}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out group ${
            currentTab === 'settings'
              ? 'bg-blue-50 text-blue-600 border-r-4 border-blue-600 font-bold'
              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <Settings className={`w-5 h-5 transition-colors ${
            currentTab === 'settings' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'
          }`} />
          <span>Settings</span>
        </Link>

        <button
          onClick={() => onLogout && onLogout()}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-150 ease-in-out text-rose-600 hover:bg-rose-50 hover:text-rose-700 group cursor-pointer"
        >
          <LogOut className="w-5 h-5 text-rose-400 group-hover:text-rose-600 transition-colors" />
          <span>Log Out</span>
        </button>
      </div>
    </nav>
  );
}
