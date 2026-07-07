export interface User {
  id: string;
  name: string;
  role: 'Admin' | 'Manager' | 'User';
  email: string;
  phone: string;
  status: 'Active' | 'Pending' | 'Inactive';
  joinedDate: string;
  lastLogin?: string;
  avatarUrl?: string;
  lastSeen?: string;
  isOnline?: boolean;
}

export interface Cashbook {
  id: string;
  name: string;
  manager: string;
  entriesCount: number;
  totalInflow: number;
  totalOutflow: number;
  status: 'Active' | 'Under Budget' | 'Nearing Limit';
}

export interface Entry {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  action: string;
  cashbookId: string;
  cashbookName: string;
  amount: number | null;
  time: string;
  status: 'Success' | 'Processing' | 'Warning';
  timestamp?: string; // ISO String
  date?: string;
}

export interface Attachment {
  id: string;
  name: string;
  fileType: string;
  fileSize: string;
  uploadedAt: string;
  uploadedBy: string;
  url?: string;
}

export interface AuditAttachment {
  id: string;
  entryId: string;
  entryTitle: string;
  userId: string;
  userName: string;
  userEmail: string;
  cashbookId: string;
  cashbookName: string;
  source: 'AI Attachment' | 'Manual Attachment';
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  uploadedAt: string;
  cloudStoragePath: string;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Receipt {
  id: string;
  amount: number | null;
  confidence: number; // e.g., 95 for 95%
  date: string; // Oct 24, 2023
  status: 'Processed' | 'Review' | 'Pending' | 'Failed';
  imageUrl: string;
  merchantName?: string;
  category?: string;
  items?: ReceiptItem[];
  jobId?: string;
  errorReason?: string;
}

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  liveUsers?: number;
  totalEntries: number;
  totalRevenue: number;
  accuracy: number;
  storageUsed: number; // in GB
  storageLimit: number; // in GB
  supabaseConfigured?: boolean;
  schemaMissing?: boolean;
  aiProcessed?: number;
  manualProcessed?: number;
}
