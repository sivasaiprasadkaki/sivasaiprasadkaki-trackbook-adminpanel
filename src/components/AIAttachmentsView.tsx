import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FileText,
  Image as ImageIcon,
  Search,
  Grid,
  List as ListIcon,
  Download,
  ExternalLink,
  Trash2,
  Edit2,
  Move,
  Info,
  Filter,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Check,
  X,
  FileSpreadsheet,
  FileArchive,
  Brain,
  Paperclip,
  Copy,
  PlusCircle,
  Database
} from 'lucide-react';

const fetch = (input: RequestInfo | URL, init?: RequestInit) => window.fetch(input, { ...init, credentials: 'include' });

interface CloudFile {
  public_id: string;
  filename: string;
  folder: string;
  format: string;
  resource_type: string;
  type: string;
  created_at: string;
  updated_at: string;
  bytes: number;
  width: number | null;
  height: number | null;
  url: string;
  secure_url: string;
  tags: string[];
  context: Record<string, any>;
}

interface FolderTreeNode {
  name: string;
  path: string;
  children: FolderTreeNode[];
}

interface AIAttachmentsViewProps {
  onProcessSuccess: () => void;
}

export default function AIAttachmentsView({ onProcessSuccess }: AIAttachmentsViewProps) {
  // Config & Data States
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [cloudName, setCloudName] = useState<string | null>(null);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layout & Navigation States
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>(''); // empty means root/all
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({ 'TrackBook Cloud': true });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter States
  const [selectedResourceType, setSelectedResourceType] = useState<string>('all'); // all, image, pdf, excel, csv, zip, ai, manual

  // Interactive States / Modals
  const [previewFile, setPreviewFile] = useState<CloudFile | null>(null);
  const [renameFile, setRenameFile] = useState<CloudFile | null>(null);
  const [newName, setNewName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const [moveFile, setMoveFile] = useState<CloudFile | null>(null);
  const [targetFolder, setTargetFolder] = useState('');
  const [moveLoading, setMoveLoading] = useState(false);

  const [deleteFile, setDeleteFile] = useState<CloudFile | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Notification / Feedback State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Polling ref for cleanup
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Fetch Configuration & Data
  const checkConfigAndFetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Check config first
      const configRes = await fetch('/api/cloudinary/config');
      if (configRes.ok) {
        const configData = await configRes.json();
        setConfigured(configData.configured);
        setCloudName(configData.cloudName);

        if (configData.configured) {
          // Fetch Cloudinary resource index
          const dataRes = await fetch('/api/cloudinary/resources');
          if (dataRes.ok) {
            const data = await dataRes.json();
            if (data.success) {
              setFiles(data.resources || []);
              setFolders(data.folders || []);
              setError(null);
            } else {
              setError(data.error || 'Failed to fetch storage resources.');
            }
          } else {
            const errData = await dataRes.json().catch(() => ({}));
            setError(errData.error || 'Failed to communicate with storage server.');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('A network exception occurred while loading storage contents.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial Fetch & Active Polling Setup
  useEffect(() => {
    checkConfigAndFetchData();

    // Start Realtime Polling (Every 5 seconds) to automatically detect uploads
    pollingIntervalRef.current = setInterval(() => {
      checkConfigAndFetchData(true);
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    checkConfigAndFetchData(true);
    showToast('Refreshing storage index...', 'info');
  };

  // 2. Folder Hierarchy Builder
  const folderTree = React.useMemo(() => {
    const rootNodes: FolderTreeNode[] = [];
    const map: Record<string, FolderTreeNode> = {};

    // Sort paths so parents are always processed before their children
    const sortedFolders = [...folders].sort((a, b) => a.localeCompare(b));

    sortedFolders.forEach(path => {
      const parts = path.split('/');
      const name = parts[parts.length - 1];
      const parentPath = parts.slice(0, -1).join('/');

      const node: FolderTreeNode = {
        name,
        path,
        children: []
      };

      map[path] = node;

      if (parentPath && map[parentPath]) {
        map[parentPath].children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }, [folders]);

  // Expand / collapse helper
  const toggleFolderExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // 3. Dynamic Statistics Calculation
  // Calculates stats recursively for files inside a folder and its children folders
  const getFolderStats = (path: string) => {
    const targetFiles = files.filter(f => !path || f.folder === path || f.folder.startsWith(path + '/'));
    const totalFiles = targetFiles.length;
    const images = targetFiles.filter(f => f.resource_type === 'image' && f.format !== 'pdf').length;
    const pdfs = targetFiles.filter(f => f.format.toLowerCase() === 'pdf').length;
    const otherFiles = totalFiles - images - pdfs;
    const storageUsed = targetFiles.reduce((acc, f) => acc + f.bytes, 0);

    return {
      totalFiles,
      images,
      pdfs,
      otherFiles,
      storageUsed
    };
  };

  const totalCloudStats = React.useMemo(() => {
    return getFolderStats('');
  }, [files]);

  // 4. Client-side File Filtering & Search
  const filteredFiles = React.useMemo(() => {
    let result = [...files];

    // Path Filter
    if (selectedFolderPath) {
      result = result.filter(f => f.folder === selectedFolderPath || f.folder.startsWith(selectedFolderPath + '/'));
    }

    // Resource Type / Extensions Filter
    if (selectedResourceType !== 'all') {
      if (selectedResourceType === 'image') {
        result = result.filter(f => f.resource_type === 'image' && f.format.toLowerCase() !== 'pdf');
      } else if (selectedResourceType === 'pdf') {
        result = result.filter(f => f.format.toLowerCase() === 'pdf');
      } else if (selectedResourceType === 'excel') {
        result = result.filter(f => ['xls', 'xlsx'].includes(f.format.toLowerCase()));
      } else if (selectedResourceType === 'csv') {
        result = result.filter(f => f.format.toLowerCase() === 'csv');
      } else if (selectedResourceType === 'zip') {
        result = result.filter(f => ['zip', 'rar', 'tar', 'gz', '7z'].includes(f.format.toLowerCase()));
      } else if (selectedResourceType === 'ai') {
        result = result.filter(f => 
          f.tags.includes('ai') || 
          f.folder.toLowerCase().includes('ai attachments') ||
          f.public_id.toLowerCase().includes('ai_')
        );
      } else if (selectedResourceType === 'manual') {
        result = result.filter(f => 
          f.tags.includes('manual') || 
          f.folder.toLowerCase().includes('manual attachments') ||
          f.public_id.toLowerCase().includes('manual_')
        );
      }
    }

    // Global Text Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => {
        const matchesName = f.filename.toLowerCase().includes(q);
        const matchesFolder = f.folder.toLowerCase().includes(q);
        const matchesId = f.public_id.toLowerCase().includes(q);
        const matchesUser = f.context?.custom?.user_name?.toLowerCase().includes(q) || 
                            f.context?.user_name?.toLowerCase().includes(q) || 
                            f.tags.some(t => t.toLowerCase().includes(q));
        return matchesName || matchesFolder || matchesId || matchesUser;
      });
    }

    return result;
  }, [files, selectedFolderPath, selectedResourceType, searchQuery]);

  // 5. Utility Formatter functions
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getFileIcon = (format: string, resourceType: string) => {
    const fmt = format.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(fmt)) {
      return <ImageIcon className="w-5 h-5 text-blue-500" />;
    }
    if (fmt === 'pdf') {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(fmt)) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(fmt)) {
      return <FileArchive className="w-5 h-5 text-amber-600" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  // Helper to extract a userName from tags or context (No sample placeholders!)
  const getUserNameFromFile = (file: CloudFile) => {
    const contextName = file.context?.custom?.user_name || file.context?.user_name;
    if (contextName) return contextName;

    // Check if there is a tag denoting user
    const userTag = file.tags.find(t => t.startsWith('user_'));
    if (userTag) return userTag.replace('user_', '');

    // Try parsing user from public id path
    const parts = file.public_id.split('/');
    if (parts.length > 2 && parts[0] === 'TrackBook Cloud') {
      return parts[1]; // TrackBook Cloud/User A/Receipts -> User A
    }

    return 'System Admin';
  };

  // 6. Action Handlers (Live calling to server APIs)
  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast('Copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const triggerDownload = (file: CloudFile) => {
    // Generate a secure download trigger or open secure url
    const link = document.createElement('a');
    link.href = file.secure_url;
    link.setAttribute('download', file.filename);
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Initiating file download...', 'success');
  };

  const handleRenameSubmit = async () => {
    if (!renameFile || !newName.trim()) return;
    setRenameLoading(true);

    const oldPublicId = renameFile.public_id;
    const ext = renameFile.format ? `.${renameFile.format}` : '';
    
    // Assemble new public_id while maintaining the directory folder
    const prefix = renameFile.folder ? `${renameFile.folder}/` : '';
    const cleanNewFilename = newName.trim().replace(/\.[^/.]+$/, ''); // remove manual extensions if added
    const newPublicId = `${prefix}${cleanNewFilename}`;

    try {
      const res = await fetch('/api/cloudinary/resources/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_public_id: oldPublicId,
          to_public_id: newPublicId,
          resource_type: renameFile.resource_type
        })
      });

      if (res.ok) {
        showToast('Resource renamed successfully!', 'success');
        setRenameFile(null);
        setNewName('');
        checkConfigAndFetchData(true);
        onProcessSuccess(); // Sync ledger view
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to rename storage asset.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while renaming resource.', 'error');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleMoveSubmit = async () => {
    if (!moveFile || !targetFolder) return;
    setMoveLoading(true);

    const oldPublicId = moveFile.public_id;
    const filename = moveFile.filename;
    const newPublicId = `${targetFolder}/${filename}`;

    try {
      const res = await fetch('/api/cloudinary/resources/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_public_id: oldPublicId,
          to_public_id: newPublicId,
          resource_type: moveFile.resource_type
        })
      });

      if (res.ok) {
        showToast('File moved successfully!', 'success');
        setMoveFile(null);
        setTargetFolder('');
        checkConfigAndFetchData(true);
        onProcessSuccess(); // Sync dashboard entries
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to move asset.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error while moving file.', 'error');
    } finally {
      setMoveLoading(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deleteFile) return;
    setDeleteLoading(true);

    try {
      const res = await fetch('/api/cloudinary/resources', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_id: deleteFile.public_id,
          resource_type: deleteFile.resource_type
        })
      });

      if (res.ok) {
        showToast('Resource permanently deleted!', 'success');
        setDeleteFile(null);
        checkConfigAndFetchData(true);
        onProcessSuccess(); // Sync global stats
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || 'Failed to delete asset.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error deleting resource.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Render a folder branch in the sidebar tree view
  const renderFolderBranch = (node: FolderTreeNode, depth = 0) => {
    const isExpanded = !!expandedFolders[node.path];
    const isSelected = selectedFolderPath === node.path;
    const hasChildren = node.children.length > 0;
    const stats = getFolderStats(node.path);

    return (
      <div key={node.path} className="select-none">
        <div
          onClick={() => setSelectedFolderPath(node.path)}
          className={`flex items-center justify-between px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all duration-150 ${
            isSelected
              ? 'bg-blue-50 text-blue-700 font-medium'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              onClick={(e) => {
                if (hasChildren) toggleFolderExpand(node.path, e);
              }}
              className="p-0.5 hover:bg-slate-200/60 rounded text-slate-400 cursor-pointer"
            >
              {hasChildren ? (
                isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <span className="w-3.5 h-3.5 block" />
              )}
            </span>
            {isExpanded || isSelected ? (
              <FolderOpen className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-amber-500'}`} />
            ) : (
              <Folder className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-amber-500'}`} />
            )}
            <span className="truncate text-xs">{node.name}</span>
          </div>
          <span className="text-[10px] font-semibold bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-500">
            {stats.totalFiles}
          </span>
        </div>

        {hasChildren && isExpanded && (
          <div className="mt-0.5">
            {node.children.map(child => renderFolderBranch(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Handle Unconfigured State
  if (configured === false) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-2xl mx-auto mt-12 text-center shadow-sm">
        <Database className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-pulse" />
        <h2 className="text-xl font-bold text-slate-900 font-sans tracking-tight">Cloudary Storage Offline</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto leading-relaxed">
          Cloudary Manager requires direct connection to the production Cloudinary environment.
          Please declare your account details securely using settings panel:
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 my-6 text-left font-mono text-xs text-slate-600 max-w-md mx-auto space-y-2">
          <div>CLOUDINARY_CLOUD_NAME=your_cloud_name</div>
          <div>CLOUDINARY_API_KEY=your_api_key</div>
          <div>CLOUDINARY_API_SECRET=your_api_secret</div>
        </div>
        <div className="text-xs text-slate-400">
          * Refer to the <strong>.env.example</strong> file in your directory root. Secrets are securely hidden server-side.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Status Banner */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-xl text-xs font-semibold text-white animate-bounce ${
          toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-rose-600' : 'bg-blue-600'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANEL: Cloudinary Folder Hierarchy & Sidebar (3 columns) */}
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-5 min-h-[580px]">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Storage Folders</span>
              <div className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="text-[10px] text-slate-400 font-sans font-medium">Realtime</span>
              </div>
            </div>
            
            {/* Tree root reset */}
            <div
              onClick={() => setSelectedFolderPath('')}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-150 mb-2 ${
                selectedFolderPath === ''
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs">All Cloud Files</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                selectedFolderPath === '' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {totalCloudStats.totalFiles}
              </span>
            </div>

            {/* Folder list */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="text-xs mt-2">Connecting...</span>
              </div>
            ) : folders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No folders found.
              </div>
            ) : (
              <div className="space-y-0.5 max-h-[350px] overflow-y-auto pr-1">
                {folderTree.map(node => renderFolderBranch(node, 0))}
              </div>
            )}
          </div>

          {/* Quick Storage Meter */}
          <div className="mt-auto border-t border-slate-100 pt-4">
            <h4 className="text-[10px] font-bold text-slate-800 uppercase tracking-wider mb-2">Account Storage</h4>
            <div className="bg-slate-100 h-2 rounded-full overflow-hidden mb-1.5">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, (totalCloudStats.storageUsed / (1024 * 1024 * 1024)) * 100)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>{formatBytes(totalCloudStats.storageUsed)} Used</span>
              <span>10 GB Limit</span>
            </div>
          </div>
        </div>

        {/* RIGHT AREA: Top Bar, Filters, Folder stats & Contents Display (9 columns) */}
        <div className="lg:col-span-9 space-y-4">
          
          {/* TOP BAR & Filters */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              
              {/* Global Search */}
              <div className="relative w-full md:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by file name, public ID, folder or user name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-slate-50/50"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* View Mode & Refresh Actions */}
              <div className="flex items-center gap-3 self-end md:self-auto">
                <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                    title="Grid Layout"
                  >
                    <Grid className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-700'}`}
                    title="List Layout"
                  >
                    <ListIcon className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all cursor-pointer ${
                    refreshing ? 'opacity-70' : ''
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Quick Filter
              </span>
              {[
                { id: 'all', label: 'All Files' },
                { id: 'image', label: 'Images' },
                { id: 'pdf', label: 'PDF Documents' },
                { id: 'excel', label: 'Excel' },
                { id: 'csv', label: 'CSV' },
                { id: 'zip', label: 'ZIP Archives' },
                { id: 'ai', label: 'AI Attachments' },
                { id: 'manual', label: 'Manual Attachments' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedResourceType(filter.id)}
                  className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                    selectedResourceType === filter.id
                      ? 'bg-blue-50 text-blue-700 border border-blue-200 font-medium'
                      : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* FOLDER METADATA INFORMATION SUMMARY CARD */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Info className="w-4 h-4 text-blue-500" />
                  <span>{selectedFolderPath ? selectedFolderPath : 'TrackBook Cloud Root'}</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Folder summary statistics aggregated from live Cloudinary API indexing.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-slate-50 px-2.5 py-1 border border-slate-150 rounded">
                Path: /{selectedFolderPath}
              </span>
            </div>

            {/* Metric widgets */}
            {(() => {
              const currentStats = getFolderStats(selectedFolderPath);
              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Total Files</span>
                    <div className="text-lg font-bold font-mono text-slate-800 mt-1">{currentStats.totalFiles}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Images</span>
                    <div className="text-lg font-bold font-mono text-slate-800 mt-1">{currentStats.images}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">PDF Documents</span>
                    <div className="text-lg font-bold font-mono text-slate-800 mt-1">{currentStats.pdfs}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3">
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Storage Volume</span>
                    <div className="text-lg font-bold font-mono text-slate-800 mt-1">{formatBytes(currentStats.storageUsed)}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* MAIN CONTENTS DISPLAY GRID/LIST */}
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center shadow-sm">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
              <p className="text-xs text-slate-500 mt-3 font-medium">Synchronizing with live Cloudinary repositories...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-16 text-center shadow-sm">
              <Folder className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800">No storage assets match criteria</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No files match your filters or query in this folder. Uploaded ledger attachments will show up dynamically.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            
            /* GRID LAYOUT */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredFiles.map(file => {
                const user = getUserNameFromFile(file);
                const isImg = file.resource_type === 'image' && file.format !== 'pdf';

                return (
                  <div key={file.public_id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-blue-400 transition-all duration-200 shadow-sm flex flex-col group">
                    
                    {/* Media Header Preview */}
                    <div className="relative aspect-video bg-slate-50 border-b border-slate-100 flex items-center justify-center overflow-hidden">
                      {isImg ? (
                        <img
                          src={file.secure_url}
                          alt={file.filename}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="p-6 bg-slate-100 rounded-xl flex items-center justify-center">
                          {getFileIcon(file.format, file.resource_type)}
                        </div>
                      )}

                      {/* File format badge */}
                      <span className="absolute top-2 left-2 bg-slate-950/80 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded shadow">
                        {file.format}
                      </span>

                      {/* Quick Origin Badge (AI vs Manual) */}
                      {(file.tags.includes('ai') || file.folder.toLowerCase().includes('ai attachments') || file.public_id.toLowerCase().includes('ai_')) ? (
                        <span className="absolute top-2 right-2 bg-blue-100 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-0.5">
                          <Brain className="w-3 h-3" /> AI
                        </span>
                      ) : (
                        <span className="absolute top-2 right-2 bg-slate-100 text-slate-600 text-[9px] font-bold px-2 py-0.5 rounded shadow flex items-center gap-0.5">
                          <Paperclip className="w-3 h-3" /> Manual
                        </span>
                      )}
                    </div>

                    {/* File info card metadata */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 truncate" title={file.filename}>
                          {file.filename}
                        </h4>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                          ID: {file.public_id}
                        </p>
                      </div>

                      {/* Details Table */}
                      <div className="text-[10px] space-y-1.5 border-t border-b border-slate-50 py-2.5 flex-1">
                        <div className="flex justify-between">
                          <span className="text-slate-400">User:</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[120px]">{user}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Folder:</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[120px]" title={file.folder}>
                            /{file.folder.split('/').pop() || 'Root'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Size:</span>
                          <span className="font-mono font-semibold text-slate-600">{formatBytes(file.bytes)}</span>
                        </div>
                        {file.width && file.height && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Resolution:</span>
                            <span className="font-mono text-slate-600">{file.width} x {file.height} px</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-400">Created:</span>
                          <span className="text-slate-600 font-mono">
                            {new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                      </div>

                      {/* Grid Action Panel */}
                      <div className="grid grid-cols-4 gap-1 pt-1 border-t border-slate-100">
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="flex flex-col items-center gap-1 p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-blue-600 cursor-pointer"
                          title="Preview File"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="text-[9px]">Preview</span>
                        </button>
                        <button
                          onClick={() => triggerDownload(file)}
                          className="flex flex-col items-center gap-1 p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-blue-600 cursor-pointer"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="text-[9px]">Get</span>
                        </button>
                        <button
                          onClick={() => handleCopyText(file.secure_url, file.public_id + '_url')}
                          className="flex flex-col items-center gap-1 p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-blue-600 cursor-pointer"
                          title="Copy Link"
                        >
                          {copiedId === file.public_id + '_url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          <span className="text-[9px]">Link</span>
                        </button>
                        
                        {/* More Actions Menu Trigger inside card */}
                        <div className="relative group/menu flex justify-center">
                          <button className="flex flex-col items-center gap-1 p-1 hover:bg-slate-50 rounded text-slate-500 hover:text-blue-600 w-full cursor-pointer">
                            <Edit2 className="w-3.5 h-3.5" />
                            <span className="text-[9px]">Manage</span>
                          </button>
                          
                          {/* Dropup / Dropdown nested actions popup */}
                          <div className="absolute right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 hidden group-hover/menu:block z-20 min-w-[130px] text-xs text-left">
                            <button
                              onClick={() => {
                                setRenameFile(file);
                                setNewName(file.filename);
                              }}
                              className="w-full px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 text-slate-400" /> Rename
                            </button>
                            <button
                              onClick={() => {
                                setMoveFile(file);
                                setTargetFolder(file.folder);
                              }}
                              className="w-full px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                            >
                              <Move className="w-3 h-3 text-slate-400" /> Move File
                            </button>
                            <div className="border-t border-slate-100 my-1"></div>
                            <button
                              onClick={() => setDeleteFile(file)}
                              className="w-full px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-medium"
                            >
                              <Trash2 className="w-3 h-3 text-rose-400" /> Delete
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            
            /* LIST LAYOUT */
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200 font-sans">
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Folder Path</th>
                      <th className="py-3 px-4">Format</th>
                      <th className="py-3 px-4 text-right">Size</th>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Uploaded</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-slate-100 text-slate-700 font-mono">
                    {filteredFiles.map(file => {
                      const user = getUserNameFromFile(file);
                      return (
                        <tr key={file.public_id} className="hover:bg-slate-50/80 transition-all duration-150">
                          <td className="py-2.5 px-4 font-sans font-bold text-slate-800 max-w-[180px] truncate">
                            <div className="flex items-center gap-2">
                              {getFileIcon(file.format, file.resource_type)}
                              <span className="truncate" title={file.filename}>{file.filename}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-slate-400 font-medium max-w-[150px] truncate" title={file.folder}>
                            /{file.folder || 'Root'}
                          </td>
                          <td className="py-2.5 px-4 text-slate-500 font-bold uppercase">{file.format}</td>
                          <td className="py-2.5 px-4 text-right text-slate-600 font-semibold">{formatBytes(file.bytes)}</td>
                          <td className="py-2.5 px-4 font-sans text-slate-700 truncate max-w-[100px]">{user}</td>
                          <td className="py-2.5 px-4 text-slate-500">
                            {new Date(file.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setPreviewFile(file)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 cursor-pointer"
                                title="Preview Link"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => triggerDownload(file)}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 cursor-pointer"
                                title="Download File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleCopyText(file.secure_url, file.public_id + '_list_url')}
                                className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 cursor-pointer"
                                title="Copy Link"
                              >
                                {copiedId === file.public_id + '_list_url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                              
                              {/* Manage file drop action */}
                              <div className="relative group/listmenu">
                                <button className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 cursor-pointer">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl py-1 hidden group-hover/listmenu:block z-20 min-w-[130px] text-xs text-left">
                                  <button
                                    onClick={() => {
                                      setRenameFile(file);
                                      setNewName(file.filename);
                                    }}
                                    className="w-full px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                                  >
                                    <Edit2 className="w-3 h-3 text-slate-400" /> Rename
                                  </button>
                                  <button
                                    onClick={() => {
                                      setMoveFile(file);
                                      setTargetFolder(file.folder);
                                    }}
                                    className="w-full px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                                  >
                                    <Move className="w-3 h-3 text-slate-400" /> Move File
                                  </button>
                                  <div className="border-t border-slate-100 my-1"></div>
                                  <button
                                    onClick={() => setDeleteFile(file)}
                                    className="w-full px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer font-medium"
                                  >
                                    <Trash2 className="w-3 h-3 text-rose-400" /> Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 7. PREVIEW MODAL */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{previewFile.filename}</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">/{previewFile.folder}/{previewFile.filename}.{previewFile.format}</p>
              </div>
              <button onClick={() => setPreviewFile(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 p-6 overflow-y-auto bg-slate-50 flex items-center justify-center min-h-[350px]">
              {previewFile.format.toLowerCase() === 'pdf' ? (
                <iframe
                  src={previewFile.secure_url}
                  className="w-full h-[550px] border border-slate-200 rounded-lg shadow-sm"
                  title="PDF Preview"
                />
              ) : previewFile.resource_type === 'image' ? (
                <img
                  src={previewFile.secure_url}
                  alt={previewFile.filename}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[500px] object-contain rounded-lg shadow border border-slate-200"
                />
              ) : (
                <div className="text-center p-8 bg-white border border-slate-200 rounded-xl max-w-sm shadow-sm">
                  {getFileIcon(previewFile.format, previewFile.resource_type)}
                  <h4 className="text-xs font-bold text-slate-800 mt-3">Interactive Preview Unavailable</h4>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Direct iframe rendering is not supported for .{previewFile.format} assets. Please download the file to inspect its content locally.
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-3 justify-between items-center text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-600">Type:</span>
                <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded uppercase">{previewFile.format}</span>
                <span className="text-slate-300">|</span>
                <span className="font-semibold text-slate-600">Volume:</span>
                <span className="font-mono text-slate-700 font-semibold">{formatBytes(previewFile.bytes)}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyText(previewFile.secure_url, 'prev_url')}
                  className="px-3 py-1.5 border border-slate-200 bg-white rounded-lg hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy URL
                </button>
                <button
                  onClick={() => triggerDownload(previewFile)}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. RENAME MODAL */}
      {renameFile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2 mb-2">
              <Edit2 className="w-4 h-4 text-blue-500" /> Rename Storage Asset
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-normal">
              Changing the filename updates its resource public key descriptor within Cloudinary instantly.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Folder Context
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-500 font-mono">
                  /{renameFile.folder || 'Root'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  New File Name
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter filename without extension..."
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                />
              </div>
              
              <div className="flex gap-2 justify-end pt-3">
                <button
                  onClick={() => setRenameFile(null)}
                  disabled={renameLoading}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded-lg cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameSubmit}
                  disabled={renameLoading || !newName.trim()}
                  className="px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {renameLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 9. MOVE FILE MODAL */}
      {moveFile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2 mb-2">
              <Move className="w-4 h-4 text-blue-500" /> Relocate Storage Asset
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-normal">
              Select an existing destination subdirectory. This moves the resource directly inside Cloudinary by updating its public folder key.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Active Folder Path
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded px-3 py-1.5 text-xs text-slate-400 font-mono">
                  /{moveFile.folder || 'Root'}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Destination Directory Folder
                </label>
                <select
                  value={targetFolder}
                  onChange={(e) => setTargetFolder(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 bg-white cursor-pointer"
                >
                  <option value="">/ (Root Storage)</option>
                  {folders.map(f => (
                    <option key={f} value={f}>
                      /{f}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex gap-2 justify-end pt-3">
                <button
                  onClick={() => setMoveFile(null)}
                  disabled={moveLoading}
                  className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded-lg cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleMoveSubmit}
                  disabled={moveLoading}
                  className="px-4 py-1.5 bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {moveLoading ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" /> Moving...
                    </>
                  ) : (
                    'Relocate Asset'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. DELETE CONFIRMATION MODAL */}
      {deleteFile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 mb-3">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-950 mb-1">
              Delete Storage Asset?
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-semibold text-slate-800">"{deleteFile.filename}"</span>? This operation is irreversible and will destroy the media link inside your Cloudinary account.
            </p>
            
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-50">
              <button
                onClick={() => setDeleteFile(null)}
                disabled={deleteLoading}
                className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs rounded-lg cursor-pointer transition-all"
              >
                Keep File
              </button>
              <button
                onClick={handleDeleteSubmit}
                disabled={deleteLoading}
                className="px-4 py-1.5 bg-rose-600 text-white hover:bg-rose-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> Deleting...
                  </>
                ) : (
                  'Permanently Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
