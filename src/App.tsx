import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DashboardView from './components/DashboardView';
import UsersView from './components/UsersView';
import CashbooksView from './components/CashbooksView';
import EntriesView from './components/EntriesView';
import AttachmentsView from './components/AttachmentsView';
import AIAttachmentsView from './components/AIAttachmentsView';
import SettingsView from './components/SettingsView';
import { Entry } from './types';

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  // Fetch entries ledger
  const fetchEntries = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/entries');
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
    fetchEntries();
  }, []);

  // Setup real-time presence ping loop
  useEffect(() => {
    const updatePresence = async () => {
      try {
        await fetch('/api/users/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'triptraccker@gmail.com' })
        });
      } catch (err) {
        console.error('Error updating user presence:', err);
      }
    };

    // Update immediately on mount
    updatePresence();

    // Update periodically every 30 seconds
    const interval = setInterval(updatePresence, 30000);

    return () => clearInterval(interval);
  }, []);

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
            onAddEntryClick={() => setCurrentTab('entries')}
            onNavigateToTab={(tab) => setCurrentTab(tab)}
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
        return <DashboardView entries={entries} onAddEntryClick={() => setCurrentTab('entries')} onNavigateToTab={setCurrentTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans flex text-slate-800">
      {/* Sidebar - fixed left panel */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setSearchValue(''); // Clear search on tab changes
        }}
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
          onCreateNew={() => setCurrentTab('entries')}
        />

        {/* Dynamic Panel view container */}
        <main className="flex-1 p-8 pt-24 bg-slate-50 overflow-y-auto max-w-[1400px] w-full mx-auto animate-fade-in">
          {renderTabContent()}
        </main>
      </div>
    </div>
  );
}
