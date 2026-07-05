-- TRACKBOOK PRODUCTION SCHEMA FOR SUPABASE
-- Run this in your Supabase SQL Editor to bootstrap the database tables.

-- 1. Create Users/Profiles Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'User', -- 'Admin' | 'Manager' | 'User'
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Active' | 'Pending' | 'Inactive'
  joined_date TEXT,
  avatar_url TEXT
);

-- 2. Create Cashbooks Table
CREATE TABLE IF NOT EXISTS cashbooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manager TEXT NOT NULL,
  entries_count INTEGER DEFAULT 0,
  total_inflow NUMERIC DEFAULT 0,
  total_outflow NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active' -- 'Active' | 'Under Budget' | 'Nearing Limit'
);

-- 3. Create Entries Table
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  action TEXT NOT NULL,
  cashbook_id TEXT,
  cashbook_name TEXT NOT NULL,
  amount NUMERIC,
  time TEXT,
  status TEXT NOT NULL DEFAULT 'Success', -- 'Success' | 'Processing' | 'Warning'
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Attachments Table
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size TEXT NOT NULL DEFAULT '0 KB',
  uploaded_at TEXT,
  uploaded_by TEXT NOT NULL DEFAULT 'Admin',
  url TEXT
);

-- 5. Create Receipts Table
CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  amount NUMERIC,
  confidence INTEGER DEFAULT 0,
  date TEXT,
  status TEXT NOT NULL DEFAULT 'Pending', -- 'Processed' | 'Review' | 'Pending' | 'Failed'
  image_url TEXT,
  merchant_name TEXT,
  category TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  job_id TEXT,
  error_reason TEXT
);

-- Enable row-level security policies as needed, or allow standard inserts for admin access.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Create basic permissive policies for Phase 1 (unauthenticated admin operations)
CREATE POLICY "Allow all read" ON users FOR SELECT USING (true);
CREATE POLICY "Allow all write" ON users FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all read" ON cashbooks FOR SELECT USING (true);
CREATE POLICY "Allow all write" ON cashbooks FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all read" ON entries FOR SELECT USING (true);
CREATE POLICY "Allow all write" ON entries FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all read" ON attachments FOR SELECT USING (true);
CREATE POLICY "Allow all write" ON attachments FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all read" ON receipts FOR SELECT USING (true);
CREATE POLICY "Allow all write" ON receipts FOR ALL USING (true) WITH CHECK (true);
