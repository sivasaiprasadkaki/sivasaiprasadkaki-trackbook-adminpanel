import { Bell, Calendar, Search, Plus } from 'lucide-react';

interface TopbarProps {
  title: string;
  onSearchChange?: (val: string) => void;
  searchValue?: string;
  onCreateNew?: () => void;
}

export default function Topbar({ title, onSearchChange, searchValue = '', onCreateNew }: TopbarProps) {
  return (
    <header className="h-16 fixed top-0 right-0 left-[260px] bg-white border-b border-slate-200 shadow-sm flex justify-between items-center px-6 z-40 transition-all duration-200">
      {/* Search Bar / Title */}
      <div className="flex items-center gap-6">
        <h2 className="font-sans text-lg font-bold text-slate-800 hidden md:block">{title}</h2>
        
        {onSearchChange && (
          <div className="relative w-80 lg:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search attachments, merchants, or entries..."
              className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all duration-150"
            />
          </div>
        )}
      </div>

      {/* Action triggers and Admin Profile */}
      <div className="flex items-center gap-4">
        {/* Helper Action Buttons */}
        <div className="flex items-center gap-1 border-r border-slate-200 pr-4">
          <button
            title="Notifications"
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-blue-600 rounded-full"></span>
          </button>
          
          <button
            title="Calendar Schedule"
            className="w-10 h-10 flex items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <Calendar className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Action */}
        <button
          onClick={onCreateNew}
          className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-sans text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create New</span>
        </button>

        {/* Admin Portrait Avatar */}
        <div className="w-10 h-10 rounded-full overflow-hidden border border-slate-200 ml-1 hover:border-blue-500 transition-colors cursor-pointer" title="Logged in as Sarah Jenkins">
          <img
            alt="Sarah Jenkins"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBO1o25NK3SZ7T_pxOln08lQHRQa3iBaI00IoDHQYDVc100XULC0jr-HoSt-lVZPFmAiZnptHQpHxjUWa8TZOAExbGhnJsUFusD3FNZEbRgLrVe9xkLHMvn4Ljo-vzt9_ZjdEsqhcpxYHcxujaFspSMZkonFiIqXw0r-7mZM60xglNRSElACW6fba00itXyQJycXTaaHJ6FXnD6gujJsIxPDhWYWOQDFL8Lh0oDeBRiZWz3r-Wp8DBbxjFlmolbpn5NSOZTGAvcO8E"
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    </header>
  );
}
