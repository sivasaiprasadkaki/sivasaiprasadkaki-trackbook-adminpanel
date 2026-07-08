import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DashboardView from './components/DashboardView';
import UsersView from './components/UsersView';
import CashbooksView from './components/CashbooksView';
import EntriesView from './components/EntriesView';
import AttachmentsView from './components/AttachmentsView';
import AIAttachmentsView from './components/AIAttachmentsView';
import SettingsView from './components/SettingsView';
import AdminAuth from './components/AdminAuth';
import SplashScreen from './components/SplashScreen';
import { Entry } from './types';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    return sessionStorage.getItem('loginSuccessSplash') === 'true';
  });

  // Check initial authentication state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('[DEBUG] App: Checking authentication session status...');
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          console.log(`[DEBUG] App SESSION: authenticated=${data.authenticated}, is_initialized=${data.is_initialized}`);
          setIsInitialized(data.is_initialized);
          setIsAuthenticated(data.authenticated);
        } else {
          console.error('[DEBUG] App: Session endpoint returned error status:', res.status);
          setIsAuthenticated(false);
          setIsInitialized(true); // default fallback to prevent setup screens on fetch error
        }
      } catch (err) {
        console.error('[DEBUG] App: Error checking auth session:', err);
        setIsAuthenticated(false);
        setIsInitialized(true); // default fallback
      }
    };
    checkAuth();
  }, [location.pathname]);

  // Resolve currentTab from pathname (e.g. "/users" -> "users", "/" or "/dashboard" -> "dashboard")
  const getTabFromPath = (path: string) => {
    const cleanPath = path.replace(/^\//, '');
    if (cleanPath === '' || cleanPath === 'dashboard') return 'dashboard';
    return cleanPath;
  };

  const currentTab = getTabFromPath(location.pathname);

  // Validate and redirect routes to /dashboard if necessary
  useEffect(() => {
    if (isAuthenticated === false) {
      if (location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
      return;
    }
    const validTabs = ['dashboard', 'users', 'cashbooks', 'entries', 'attachments', 'cloud', 'settings'];
    const tab = location.pathname.replace(/^\//, '');
    if (location.pathname === '/' || location.pathname === '' || location.pathname === '/login') {
      navigate('/dashboard', { replace: true });
    } else if (!validTabs.includes(tab)) {
      navigate('/dashboard', { replace: true });
    }
  }, [location.pathname, navigate, isAuthenticated]);

  // Dynamic Browser Title Updater
  useEffect(() => {
    const titleMap: Record<string, string> = {
      'dashboard': 'TrackBook Admin Panel | Dashboard',
      'users': 'TrackBook Admin Panel | Users',
      'cashbooks': 'TrackBook Admin Panel | Cashbooks',
      'entries': 'TrackBook Admin Panel | Entries',
      'attachments': 'TrackBook Admin Panel | Attachments',
      'cloud': 'TrackBook Admin Panel | Cloud',
      'settings': 'TrackBook Admin Panel | Settings',
    };
    document.title = titleMap[currentTab] || 'TrackBook Admin Panel';
  }, [currentTab]);

  // Clear search on tab changes (detected via route change)
  useEffect(() => {
    setSearchValue('');
  }, [location.pathname]);

  // Fetch entries ledger
  const fetchEntries = async () => {
    if (isAuthenticated === false) return;
    try {
      setLoading(true);
      const res = await fetch('/api/entries', { credentials: 'include' });
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (err) {
      console.error('Error fetching entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated === true) {
      fetchEntries();
    }
  }, [isAuthenticated]);

  // Setup real-time presence ping loop
  useEffect(() => {
    if (isAuthenticated !== true) return;
    const updatePresence = async () => {
      try {
        const res = await fetch('/api/users/presence', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'triptraccker@gmail.com' })
        });
        if (res.status === 401) {
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error('Error updating user presence:', err);
      }
    };

    // Update immediately on mount
    updatePresence();

    // Update periodically every 30 seconds
    const interval = setInterval(updatePresence, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Logout handler
  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (res.ok) {
        localStorage.removeItem('trackbook_session');
        setIsAuthenticated(false);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Map tabs to active labels
  const tabTitles: Record<string, string> = {
    'dashboard': 'Dashboard Overview',
    'users': 'Users Directory',
    'cashbooks': 'Cashbook Accounts',
    'entries': 'Ledger Records',
    'attachments': 'Audit Attachments',
    'cloud': 'Cloud Storage Manager',
    'settings': 'System Settings'
  };

  // Render the appropriate panel view
  const renderTabContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardView
            entries={entries}
            onAddEntryClick={() => navigate('/entries')}
            onNavigateToTab={(tab) => navigate('/' + tab)}
          />
        );
      case 'users':
        return <UsersView onRefreshStats={fetchEntries} />;
      case 'cashbooks':
        return <CashbooksView onAddCashbook={fetchEntries} />;
      case 'entries':
        return (
          <EntriesView
            entries={entries}
            onEntryLogged={fetchEntries}
          />
        );
      case 'attachments':
        return <AttachmentsView />;
      case 'cloud':
        return <AIAttachmentsView onProcessSuccess={fetchEntries} />;
      case 'settings':
        return <SettingsView onResetDatabase={fetchEntries} />;
      default:
        return (
          <DashboardView
            entries={entries}
            onAddEntryClick={() => navigate('/entries')}
            onNavigateToTab={(tab) => navigate('/' + tab)}
          />
        );
    }
  };

  // If loading authentication state, show minimal beautiful loading splash
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-sm font-medium text-slate-500">Checking system authorization status...</p>
        </div>
      </div>
    );
  }

  // If splash flag is set, show the beautiful post-login splash screen
  if (showSplash) {
    return (
      <SplashScreen
        onComplete={() => {
          sessionStorage.removeItem('loginSuccessSplash');
          setShowSplash(false);
          navigate('/dashboard', { replace: true });
        }}
      />
    );
  }

  // If unauthenticated, display the TrackBook custom verification / setup screen
  if (isAuthenticated === false) {
    return (
      <AdminAuth
        onSuccess={(isExplicitLogin) => {
          if (isExplicitLogin) {
            sessionStorage.setItem('loginSuccessSplash', 'true');
            setShowSplash(true);
          }
          setIsInitialized(true);
          setIsAuthenticated(true);
        }}
        initialIsInitialized={isInitialized}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex text-slate-800 animate-fade-in">
      {/* Sidebar - fixed left panel */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          navigate('/' + tab);
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Stage */}
      <div className="flex-1 pl-[260px] min-h-screen flex flex-col transition-all duration-200">
        
        {/* Topbar Header */}
        <Topbar
          title={tabTitles[currentTab] || 'TrackBook'}
          searchValue={searchValue}
          onSearchChange={
            currentTab === 'dashboard' || currentTab === 'entries' || currentTab === 'users' || currentTab === 'cashbooks'
              ? setSearchValue
              : undefined
          }
          onCreateNew={() => navigate('/entries')}
        />

        {/* Dynamic Panel view container */}
        <main className="flex-1 p-8 pt-24 bg-slate-50 overflow-y-auto max-w-[1400px] w-full mx-auto">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
}
