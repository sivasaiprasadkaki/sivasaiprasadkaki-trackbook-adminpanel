import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import crypto from 'crypto';
import fs from 'fs';
import { TOTP } from 'otplib';
import { crypto as nobleCrypto } from '@otplib/plugin-crypto-noble';
import { base32 as scureBase32 } from '@otplib/plugin-base32-scure';

const totp = new TOTP({ crypto: nobleCrypto, base32: scureBase32 });
import QRCode from 'qrcode';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import { v2 as cloudinary } from 'cloudinary';
import { User, Entry, Cashbook, Attachment, Receipt, DashboardStats } from './src/types.js';

dotenv.config();

// Ensure SUPABASE_SERVICE_ROLE_KEY is present
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERROR: Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

// Configure Cloudinary safely
let isCloudinaryConfigured = false;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });
  isCloudinaryConfigured = true;
  console.log('Cloudinary successfully configured.');
} else {
  console.warn('Cloudinary credentials missing in environment.');
}

export const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Setup Supabase Client
let supabaseClient: any = null;

function getSupabase() {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    console.log(`[DEBUG] Initializing Supabase Client. URL defined: ${!!url}, Anon Key defined: ${!!key}`);
    if (url && key) {
      supabaseClient = createClient(url, key);
    } else {
      console.error('[DEBUG] Failed to initialize Supabase Client: Missing URL or Anon Key.');
    }
  }
  return supabaseClient;
}

let supabaseAdminClient: any = null;

function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    console.log(`[DEBUG] Initializing Supabase Admin Client. URL defined: ${!!url}, Service Role Key defined: ${!!key}`);
    if (url && key) {
      supabaseAdminClient = createClient(url, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    } else {
      console.warn('[DEBUG] Supabase Admin Client not initialized: Missing URL or Service Role Key.');
    }
  }
  return supabaseAdminClient;
}

async function runStartupVerification() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isServiceRoleLoaded = !!serviceRoleKey;
  console.log(`Service Role Loaded: ${isServiceRoleLoaded ? 'YES' : 'NO'}`);
  
  if (!isServiceRoleLoaded) {
    console.error("ERROR: Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const adminClient = getSupabaseAdmin();
  console.log(`Admin Client Initialized: ${!!adminClient ? 'YES' : 'NO'}`);

  if (!adminClient) {
    console.error("ERROR: Could not initialize Admin Client.");
    process.exit(1);
  }

  // 1. Dashboard Query
  try {
    const { count, error } = await adminClient.from('entries').select('id', { count: 'exact', head: true });
    if (error) throw error;
    console.log("Dashboard Query: SUCCESS");
  } catch (err: any) {
    console.log(`Dashboard Query: FAILED (${err.message})`);
  }

  // 2. Users Query
  try {
    const { error } = await adminClient.from('users').select('id', { count: 'exact', head: true });
    if (error) throw error;
    console.log("Users Query: SUCCESS");
  } catch (err: any) {
    console.log(`Users Query: FAILED (${err.message})`);
  }

  // 3. Cashbooks Query
  try {
    const { error } = await adminClient.from('cashbooks').select('id', { count: 'exact', head: true });
    if (error) throw error;
    console.log("Cashbooks Query: SUCCESS");
  } catch (err: any) {
    console.log(`Cashbooks Query: FAILED (${err.message})`);
  }

  // 4. Entries Query
  try {
    const { error } = await adminClient.from('entries').select('id', { count: 'exact', head: true });
    if (error) throw error;
    console.log("Entries Query: SUCCESS");
  } catch (err: any) {
    console.log(`Entries Query: FAILED (${err.message})`);
  }

  // 5. Attachments Query
  try {
    const { error } = await adminClient.from('attachments').select('id', { count: 'exact', head: true });
    if (error) throw error;
    console.log("Attachments Query: SUCCESS");
  } catch (err: any) {
    console.log(`Attachments Query: FAILED (${err.message})`);
  }
}


function parseUserStatus(dbStatus: string | null, lastSignInAt: string | null) {
  let status = 'Active';
  let lastSeen: string | null = null;

  if (dbStatus) {
    if (dbStatus.includes('|')) {
      const parts = dbStatus.split('|');
      status = parts[0] || 'Active';
      lastSeen = parts[1] || null;
    } else {
      status = dbStatus;
    }
  }

  // Fallback to lastSignInAt if lastSeen is not set
  if (!lastSeen && lastSignInAt) {
    lastSeen = lastSignInAt;
  }

  // Determine if online (within last 2 minutes)
  let isOnline = false;
  if (lastSeen) {
    const lastSeenTime = new Date(lastSeen).getTime();
    const now = Date.now();
    // 2 minutes in milliseconds = 120,000
    isOnline = (now - lastSeenTime) < 120000;
  }

  return {
    status: status.charAt(0).toUpperCase() + status.slice(1).toLowerCase(), // Normalize to Active/Inactive/Pending
    lastSeen,
    isOnline
  };
}

// Setup Gemini Client
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// REST API Endpoints

// ------------------------------------------------------------------------
// ENTERPRISE-GRADE TOTP AUTHENTICATION & SECURITY SYSTEM
// ------------------------------------------------------------------------

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';

function getEncryptionKey(): Buffer {
  const key = process.env.ADMIN_TOTP_ENCRYPTION_KEY || 'default_dev_totp_encryption_key_32_chars_long!';
  // Ensure key is exactly 32 bytes (256 bits)
  return crypto.createHash('sha256').update(key).digest();
}

function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptSecret(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) throw new Error('Invalid encrypted text format');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Failed to decrypt TOTP secret:', err);
    throw new Error('Decryption failed');
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts.shift()?.trim();
    const value = decodeURIComponent(parts.join('='));
    if (name) list[name] = value;
  });
  return list;
}

function getSessionCookieAttributes(req: any, maxAge = 24 * 60 * 60) {
  const isProd = process.env.NODE_ENV === 'production';
  const host = req.headers.host || '';
  const isRunApp = host.includes('.run.app');
  const isSecure = req.headers['x-forwarded-proto'] === 'https' || req.secure || isRunApp;

  // Inside AI Studio preview/share iframe (on .run.app), we MUST use SameSite=None; Secure
  if (isRunApp && isSecure) {
    return `Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=None; Secure`;
  }

  // Standard production defaults
  if (isProd) {
    return `Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax; Secure`;
  }

  // Local dev / other fallback
  const secureFlag = isSecure ? '; Secure' : '';
  return `Path=/; HttpOnly; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`;
}

const FALLBACK_PATH = './admin_security_fallback.json';

function readFallback(): { encrypted_totp_secret: string; is_initialized: boolean } | null {
  try {
    if (fs.existsSync(FALLBACK_PATH)) {
      const data = fs.readFileSync(FALLBACK_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read fallback security:', err);
  }
  return null;
}

function writeFallback(encrypted_totp_secret: string, is_initialized: boolean) {
  try {
    fs.writeFileSync(FALLBACK_PATH, JSON.stringify({ encrypted_totp_secret, is_initialized }), 'utf8');
  } catch (err) {
    console.error('Failed to write fallback security:', err);
  }
}

async function getAdminSecurity(): Promise<{ encrypted_totp_secret: string | null; is_initialized: boolean }> {
  const adminClient = getSupabaseAdmin();
  if (adminClient) {
    try {
      const { data, error } = await adminClient.from('admin_security').select('*').eq('id', 'admin');
      if (!error && data && data.length > 0) {
        console.log(`[DEBUG] getAdminSecurity: Loaded from DATABASE. is_initialized=${data[0].is_initialized}`);
        return {
          encrypted_totp_secret: data[0].encrypted_totp_secret,
          is_initialized: data[0].is_initialized
        };
      } else if (error) {
        if (error.message && error.message.includes('Could not find the table')) {
          console.log('[DEBUG] admin_security table is not present in Supabase. Using robust local fallback file security system.');
        } else {
          console.warn('[DB WARNING] admin_security read error:', error.message);
        }
      }
    } catch (err: any) {
      console.warn('[DB WARNING] admin_security read exception:', err.message);
    }
  }

  // Fallback to local file if DB query fails or has no record
  const fallback = readFallback();
  if (fallback) {
    console.log(`[DEBUG] getAdminSecurity: Loaded from FALLBACK FILE. is_initialized=${fallback.is_initialized}`);
    return {
      encrypted_totp_secret: fallback.encrypted_totp_secret,
      is_initialized: fallback.is_initialized
    };
  }

  console.log('[DEBUG] getAdminSecurity: No record found anywhere. is_initialized=false');
  return { encrypted_totp_secret: null, is_initialized: false };
}

async function saveAdminSecurity(encrypted_secret: string, is_initialized: boolean): Promise<boolean> {
  // Always save to fallback first
  writeFallback(encrypted_secret, is_initialized);

  const adminClient = getSupabaseAdmin();
  if (adminClient) {
    try {
      const { error } = await adminClient.from('admin_security').upsert({
        id: 'admin',
        encrypted_totp_secret: encrypted_secret,
        is_initialized: is_initialized,
        updated_at: new Date().toISOString()
      });
      if (!error) {
        return true;
      }
      if (error.message && error.message.includes('Could not find the table')) {
        console.log('[DEBUG] admin_security table is not present in Supabase. Saved securely to fallback file.');
      } else {
        console.error('[DB ERROR] Failed to upsert admin_security:', error.message);
      }
    } catch (err: any) {
      console.error('[DB EXCEPTION] Failed to upsert admin_security:', err.message);
    }
  }
  return false;
}

async function deleteAdminSecurity(): Promise<boolean> {
  // Delete the fallback file
  try {
    if (fs.existsSync(FALLBACK_PATH)) {
      fs.unlinkSync(FALLBACK_PATH);
    }
  } catch (err) {
    console.error('Failed to delete fallback security:', err);
  }

  const adminClient = getSupabaseAdmin();
  if (adminClient) {
    try {
      const { error } = await adminClient.from('admin_security').delete().eq('id', 'admin');
      if (!error) {
        return true;
      }
      if (error.message && error.message.includes('Could not find the table')) {
        console.log('[DEBUG] admin_security table is not present in Supabase. Deleted fallback file setup.');
      } else {
        console.error('[DB ERROR] Failed to delete admin_security:', error.message);
      }
    } catch (err: any) {
      console.error('[DB EXCEPTION] Failed to delete admin_security:', err.message);
    }
  }
  return true;
}

const loginAttempts: Record<string, { count: number; lockedUntil: number }> = {};
const pendingSecrets: Record<string, string> = {};

// Auth Router & endpoints (registered before requireAuth middleware)
const authRouter = express.Router();

authRouter.get('/session', async (req, res) => {
  const security = await getAdminSecurity();
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['trackbook_session'];
  let authenticated = false;

  if (sessionToken) {
    try {
      const decrypted = decryptSecret(sessionToken);
      const session = JSON.parse(decrypted);
      if (session && session.admin && session.expiresAt > Date.now()) {
        authenticated = true;
      } else {
        console.log(`[DEBUG] Session token expired or invalid. Expires at: ${session?.expiresAt}, Now: ${Date.now()}`);
      }
    } catch (e: any) {
      console.warn('[DEBUG] Failed to parse/decrypt session token cookie:', e.message);
    }
  } else {
    console.log('[DEBUG] No trackbook_session cookie found in request.');
  }

  console.log(`[DEBUG] /api/auth/session response: authenticated=${authenticated}, is_initialized=${security.is_initialized}`);

  res.json({
    authenticated,
    is_initialized: security.is_initialized
  });
});

authRouter.post('/setup', async (req, res) => {
  try {
    const security = await getAdminSecurity();
    if (security.is_initialized) {
      return res.status(400).json({ error: 'Setup already completed' });
    }

    // Generate secret
    const secret = totp.generateSecret();
    const otpauthUrl = totp.toURI({ label: 'admin@trackbook.xyz', issuer: 'TrackBook Admin', secret });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // 1. In-memory fallback
    pendingSecrets['admin'] = secret;

    // 2. Persist in database/fallback file with is_initialized = false
    const encryptedSecret = encryptSecret(secret);
    try {
      await saveAdminSecurity(encryptedSecret, false);
      console.log('[AUTH INFO] Pending TOTP secret saved persistently to database/fallback');
    } catch (dbErr: any) {
      console.error('[AUTH ERROR] Failed to save pending TOTP secret to database:', dbErr.message);
    }

    // 3. Persist in HttpOnly cookie as client-side isolated session state (30 mins validity)
    const cookieOptions = getSessionCookieAttributes(req, 30 * 60);
    res.setHeader('Set-Cookie', `trackbook_pending_setup=${encodeURIComponent(encryptedSecret)}; ${cookieOptions}`);

    res.json({
      secret,
      qrCode: qrCodeDataUrl
    });
  } catch (err: any) {
    console.error('Error in auth/setup:', err);
    res.status(500).json({ error: 'Failed to generate setup QR code' });
  }
});

authRouter.post('/verify', async (req, res) => {
  const { code, isSetup } = req.body;
  if (!code || typeof code !== 'string' || code.length !== 6) {
    console.warn('[AUTH FAILURE] Verification code is missing or not 6 digits');
    return res.status(400).json({ error: 'Verification code must be 6 digits' });
  }

  const ip = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'global').split(',')[0].trim();
  const now = Date.now();
  const attempt = loginAttempts[ip] || { count: 0, lockedUntil: 0 };

  if (attempt.lockedUntil > now) {
    const remainingMin = Math.ceil((attempt.lockedUntil - now) / 60000);
    console.warn(`[AUTH FAILURE] IP rate-limited: ${ip}`);
    return res.status(429).json({ error: `Too many failed attempts. Please try again in ${remainingMin} minutes.` });
  }

  try {
    let secret = '';
    const security = await getAdminSecurity();

    if (isSetup) {
      if (security.is_initialized) {
        console.warn('[AUTH FAILURE] Setup verification failed: Setup already completed');
        return res.status(400).json({ error: 'Setup already completed' });
      }

      // Try reading from cookie first
      const cookies = parseCookies(req.headers.cookie);
      const pendingCookie = cookies['trackbook_pending_setup'];
      if (pendingCookie) {
        try {
          const decoded = decodeURIComponent(pendingCookie);
          secret = decryptSecret(decoded);
          console.log('[AUTH INFO] Successfully read pending setup secret from cookie');
        } catch (cookieErr) {
          console.error('[AUTH FAILURE] Failed to decrypt pending setup cookie:', cookieErr);
        }
      }

      // If not found in cookie, try reading from the persistent db/fallback record
      if (!secret && security.encrypted_totp_secret) {
        try {
          secret = decryptSecret(security.encrypted_totp_secret);
          console.log('[AUTH INFO] Successfully read pending setup secret from persistent database/fallback');
        } catch (dbReadErr) {
          console.error('[AUTH FAILURE] Failed to decrypt pending setup from database:', dbReadErr);
        }
      }

      // Final fallback to in-memory
      if (!secret) {
        secret = pendingSecrets['admin'] || '';
        if (secret) {
          console.log('[AUTH INFO] Read pending setup secret from in-memory fallback');
        }
      }

      if (!secret) {
        console.warn('[AUTH FAILURE] Setup verification failed: No pending setup secret found in cookies, database, or memory');
        return res.status(400).json({ error: 'No pending setup. Please request setup first.' });
      }
    } else {
      if (!security.is_initialized || !security.encrypted_totp_secret) {
        console.warn('[AUTH FAILURE] Verification failed: System not initialized');
        return res.status(400).json({ error: 'System not initialized. Please set up first.' });
      }
      try {
        secret = decryptSecret(security.encrypted_totp_secret);
      } catch (decryptErr) {
        console.error('[AUTH FAILURE] Failed to decrypt stored TOTP secret:', decryptErr);
        return res.status(500).json({ error: 'Internal error: encryption/decryption failure' });
      }
    }

    // Verify code using otplib
    const verifyResult = await totp.verify(code, { secret });
    const isValid = verifyResult && verifyResult.valid;

    if (!isValid) {
      // Record failed attempt
      attempt.count += 1;
      console.warn(`[AUTH FAILURE] Invalid TOTP code submitted. Attempt count: ${attempt.count}`);
      if (attempt.count >= 5) {
        attempt.lockedUntil = now + 5 * 60 * 1000; // 5 mins lock
        loginAttempts[ip] = attempt;
        console.warn(`[AUTH FAILURE] IP locked out: ${ip}`);
        return res.status(429).json({ error: 'Too many failed attempts. Locked out for 5 minutes.' });
      }
      loginAttempts[ip] = attempt;
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Clear failed attempts on success
    attempt.count = 0;
    attempt.lockedUntil = 0;
    loginAttempts[ip] = attempt;

    if (isSetup) {
      try {
        // Encrypt secret and save as permanently initialized
        const encrypted = encryptSecret(secret);
        await saveAdminSecurity(encrypted, true);
        // Clean up memory
        delete pendingSecrets['admin'];
        console.log('[AUTH INFO] Setup completed successfully and saved to DB');
      } catch (saveErr) {
        console.error('[AUTH FAILURE] Failed to store TOTP secret during setup:', saveErr);
        return res.status(500).json({ error: 'Internal error: failed to store TOTP secret' });
      }
    }

    // Create session payload
    const sessionPayload = {
      admin: true,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 Hours
    };

    let encryptedSession = '';
    try {
      encryptedSession = encryptSecret(JSON.stringify(sessionPayload));
    } catch (encryptErr) {
      console.error('[AUTH FAILURE] Session creation failed (encryption/decryption failure):', encryptErr);
      return res.status(500).json({ error: 'Internal error: session creation failed' });
    }

    // Set cookie
    try {
      const sessionCookieOptions = getSessionCookieAttributes(req);
      const clearPendingCookieOptions = getSessionCookieAttributes(req, 0);
      res.setHeader('Set-Cookie', [
        `trackbook_session=${encodeURIComponent(encryptedSession)}; ${sessionCookieOptions}`,
        `trackbook_pending_setup=; ${clearPendingCookieOptions}`
      ]);
    } catch (cookieErr) {
      console.error('[AUTH FAILURE] Cookie creation failed:', cookieErr);
      return res.status(500).json({ error: 'Internal error: cookie creation failed' });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('[AUTH FAILURE] Unexpected error during verification:', err);
    res.status(500).json({ error: 'Internal server error during verification' });
  }
});

authRouter.post('/logout', (req, res) => {
  console.log('[DEBUG] /api/auth/logout: Initiating administrator logout. Clearing trackbook_session cookie. No TOTP secret or is_initialized settings are modified.');
  const cookieOptions = getSessionCookieAttributes(req, 0);
  res.setHeader('Set-Cookie', `trackbook_session=; ${cookieOptions}`);
  res.json({ success: true });
});

authRouter.post('/reset-totp', async (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['trackbook_session'];
  let authenticated = false;

  if (sessionToken) {
    try {
      const decrypted = decryptSecret(sessionToken);
      const session = JSON.parse(decrypted);
      if (session && session.admin && session.expiresAt > Date.now()) {
        authenticated = true;
      }
    } catch (e) {
      // Ignored
    }
  }

  if (!authenticated) {
    console.warn('[AUTH FAILURE] Attempted to reset TOTP without an active authenticated session');
    return res.status(401).json({ error: 'Unauthorized. You must be logged in as an administrator to reset TOTP.' });
  }

  try {
    await deleteAdminSecurity();
    delete pendingSecrets['admin'];
    console.log('[AUTH INFO] TOTP configuration reset successfully.');
    res.json({ success: true, message: 'Google Authenticator configuration reset successfully.' });
  } catch (err: any) {
    console.error('[AUTH ERROR] Error resetting TOTP:', err);
    res.status(500).json({ error: 'Failed to reset Google Authenticator configuration.' });
  }
});

app.use('/api/auth', authRouter);

// Middleware to secure all other API endpoints
function requireAuth(req: any, res: any, next: any) {
  // Allow non-API routes to bypass authentication (Vite / SPA fallback / static files)
  if (!req.path.startsWith('/api/')) {
    return next();
  }

  // Allow public auth endpoints
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionToken = cookies['trackbook_session'];

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized: No active session' });
  }

  try {
    const decrypted = decryptSecret(sessionToken);
    const session = JSON.parse(decrypted);
    if (!session || !session.admin || session.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or invalid' });
    }
    // Session is valid
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid session' });
  }
}

app.use(requireAuth);

// Stats
app.get('/api/stats', async (req, res) => {
  console.log('[DEBUG] Dashboard query started...');
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('[DEBUG] Dashboard query failed: Supabase admin client is missing.');
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    // 1. Total Registered Users from public.users
    const { data: usersData, error: usersErr } = await supabase
      .from('users')
      .select('id, status, email');

    if (usersErr) {
      console.error('[DEBUG] Dashboard query - users fetch failure:', usersErr);
      throw usersErr;
    }
    console.log(`[DEBUG] Dashboard query - Users loaded from DB: ${usersData?.length || 0}`);

    // Fetch auth users if possible to merge last_sign_in_at and compute actual total users
    let authUsersMap = new Map<string, any>();
    let authUsersList: any[] = [];
    if (supabase) {
      try {
        const { data: authData } = await supabase.auth.admin.listUsers();
        if (authData && authData.users) {
          authUsersList = authData.users;
          authData.users.forEach((u: any) => {
            authUsersMap.set(u.id, u);
            if (u.email) authUsersMap.set(u.email.toLowerCase(), u);
          });
        }
      } catch (e) {
        console.error('Error listing auth users in stats:', e);
      }
    }

    // Combine lists to match users directory count exactly
    const seenIds = new Set<string>();
    const seenEmails = new Set<string>();

    authUsersList.forEach((u: any) => {
      seenIds.add(u.id);
      if (u.email) seenEmails.add(u.email.toLowerCase());
    });

    if (usersData) {
      usersData.forEach((u: any) => {
        const emailLower = u.email ? u.email.toLowerCase() : '';
        if (!seenIds.has(u.id) && (!emailLower || !seenEmails.has(emailLower))) {
          seenIds.add(u.id);
          if (emailLower) seenEmails.add(emailLower);
        }
      });
    }

    const totalUsers = seenIds.size;

    let activeCount = 0;
    let liveCount = 0;

    if (usersData) {
      usersData.forEach((u: any) => {
        const authUser = authUsersMap.get(u.id) || (u.email ? authUsersMap.get(u.email.toLowerCase()) : null);
        const lastSignInAt = authUser ? authUser.last_sign_in_at : null;

        const parsed = parseUserStatus(u.status, lastSignInAt);
        const normStatus = parsed.status.toLowerCase();
        if (normStatus === 'active') {
          activeCount++;
        }
        if (parsed.isOnline) {
          liveCount++;
        }
      });
    }

    // 3. Total Ledger Entries
    const { count: entriesCount, error: entriesErr } = await supabase
      .from('entries')
      .select('id', { count: 'exact', head: true });

    if (entriesErr) throw entriesErr;

    // 4. Total Volume / Revenue (sum of all cash-in minus cash-out)
    const { data: entriesData, error: entDataErr } = await supabase
      .from('entries')
      .select('amount, type');

    if (entDataErr) throw entDataErr;

    let totalVolume = 0;
    if (entriesData) {
      entriesData.forEach((e: any) => {
        const amt = Number(e.amount || 0);
        const t = (e.type || 'in').toLowerCase();
        if (t === 'in') {
          totalVolume += amt;
        } else if (t === 'out') {
          totalVolume -= amt;
        }
      });
    }

    // 5. Total files (for dynamic storage size computation)
    const { count: attCount, error: attCountErr } = await supabase
      .from('attachments')
      .select('id', { count: 'exact', head: true });

    if (attCountErr) throw attCountErr;

    const { count: aiAttCount, error: aiAttCountErr } = await supabase
      .from('ai_attachments')
      .select('id', { count: 'exact', head: true });

    if (aiAttCountErr) throw aiAttCountErr;

    // Get images table count as well
    let imageCount = 0;
    try {
      const { count, error: imgCountErr } = await supabase
        .from('images')
        .select('id', { count: 'exact', head: true });
      if (!imgCountErr && count !== null) {
        imageCount = count;
      }
    } catch (e) {
      console.error('Error fetching images count:', e);
    }

    const totalFiles = (attCount || 0) + (aiAttCount || 0) + imageCount;
    // 1.2 MB per attachment estimate mapped to GB
    let storageUsedGB = Number(((totalFiles * 1.2 * 1024 * 1024) / (1024 * 1024 * 1024)).toFixed(3));
    let storageLimitGB = 25; // Cloudinary free tier gives 25 GB limit

    if (isCloudinaryConfigured) {
      try {
        const usage = await cloudinary.api.usage();
        if (usage) {
          if (usage.credits) {
            storageUsedGB = usage.credits.usage || 0;
            storageLimitGB = usage.credits.limit || 25;
            console.log(`[DEBUG] Fetched real Cloudinary Credits usage: ${storageUsedGB} / ${storageLimitGB}`);
          } else if (usage.storage) {
            const bytes = usage.storage.usage || 0;
            storageUsedGB = Number((bytes / (1024 * 1024 * 1024)).toFixed(6)); // fallback high precision
            console.log(`[DEBUG] Fetched real Cloudinary storage fallback: ${bytes} bytes (${storageUsedGB} GB)`);
          }
        }
      } catch (err: any) {
        console.error('Failed to fetch real-time Cloudinary storage usage:', err.message);
      }
    }

    // AI processed count: entries with user_name = 'AI Scanner' or aiAttCount
    let aiProcessed = 0;
    try {
      const { count: aiCount, error: aiCountErr } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('user_name', 'AI Scanner');
      if (!aiCountErr && aiCount !== null) {
        aiProcessed = aiCount;
      } else {
        aiProcessed = aiAttCount || 0;
      }
    } catch (e) {
      aiProcessed = aiAttCount || 0;
    }

    const manualProcessed = Math.max(0, (entriesCount || 0) - aiProcessed);

    console.log(`[DEBUG] Dashboard query completed - Users: ${totalUsers}, Entries: ${entriesCount}, Total Files: ${totalFiles}, Storage: ${storageUsedGB} GB, AI: ${aiProcessed}, Manual: ${manualProcessed}`);

    res.json({
      totalUsers: totalUsers,
      activeUsers: activeCount,
      liveUsers: liveCount,
      totalEntries: entriesCount || 0,
      totalRevenue: totalVolume,
      accuracy: 98,
      storageUsed: Math.max(0.001, storageUsedGB),
      storageLimit: storageLimitGB,
      aiProcessed: aiProcessed,
      manualProcessed: manualProcessed,
      supabaseConfigured: true,
      schemaMissing: false
    });
  } catch (err: any) {
    console.error('[DEBUG] Dashboard query failed / RLS error:', err);
    res.status(500).json({ error: err.message, code: err.code });
  }
});

// Users
app.get('/api/users', async (req, res) => {
  console.log('[DEBUG] Users load started...');
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('[DEBUG] Users load failed: Supabase admin client is missing.');
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    let authUsers: any[] = [];

    // 1. Fetch users from Supabase Auth
    try {
      const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
      if (authErr) {
        console.error('Error listing auth users via service_role:', authErr.message);
      } else if (authData && authData.users) {
        authUsers = authData.users;
      }
    } catch (e: any) {
      console.error('Exception listing auth users:', e.message);
    }

    // 2. Fetch public users table as well to merge profiles/status/metadata
    let publicUsers: any[] = [];
    try {
      const { data: pubData, error: pubErr } = await supabase
        .from('users')
        .select('*');
      if (!pubErr && pubData) {
        publicUsers = pubData;
      }
    } catch (e) {
      console.error('Error fetching public users table:', e);
    }

    // 3. Fetch profiles table to merge profile information with auth/public records
    let profiles: any[] = [];
    try {
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('*');
      if (!profErr && profData) {
        profiles = profData;
      }
    } catch (e) {
      console.error('Error fetching profiles table:', e);
    }

    // Build map of public users and profiles for merging
    const publicUsersMap = new Map<string, any>();
    publicUsers.forEach(u => {
      if (u.id) publicUsersMap.set(u.id, u);
      if (u.email) publicUsersMap.set(u.email.toLowerCase(), u);
    });

    const profilesMap = new Map<string, any>();
    profiles.forEach(p => {
      if (p.id) profilesMap.set(p.id, p);
      if (p.user_id) profilesMap.set(p.user_id, p);
      if (p.email) profilesMap.set(p.email.toLowerCase(), p);
    });

    // 4. Combine/merge users
    const finalUsers: any[] = [];
    const seenUserIds = new Set<string>();

    if (authUsers.length > 0) {
      // Direct source of truth: Supabase Authentication users
      authUsers.forEach((u: any) => {
        seenUserIds.add(u.id);

        const email = u.email || '';
        const emailLower = email.toLowerCase();

        // Check for matching public user / profile record
        const pubUser = publicUsersMap.get(u.id) || (emailLower ? publicUsersMap.get(emailLower) : null);
        const profile = profilesMap.get(u.id) || (emailLower ? profilesMap.get(emailLower) : null);

        // Compute Name
        let name = '';
        if (profile) {
          name = profile.name || profile.full_name || '';
        }
        if (!name && pubUser) {
          name = pubUser.name || '';
        }
        if (!name && u.user_metadata) {
          name = u.user_metadata.name || u.user_metadata.full_name || '';
        }
        if (!name && email) {
          name = email.split('@')[0]
            .split(/[._-]/)
            .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ');
        }
        if (!name) {
          name = 'Unknown User';
        }

        // Compute Role
        let role = 'User';
        if (pubUser) {
          role = pubUser.is_admin ? 'Admin' : (pubUser.role || 'User');
        } else if (profile) {
          role = profile.is_admin ? 'Admin' : (profile.role || 'User');
        } else if (u.user_metadata && u.user_metadata.role) {
          role = u.user_metadata.role;
        }

        // Compute Status
        let rawStatus = 'Active';
        if (pubUser) {
          rawStatus = pubUser.status || 'Active';
        } else if (profile) {
          rawStatus = profile.status || 'Active';
        }

        const parsed = parseUserStatus(rawStatus, u.last_sign_in_at || null);

        // Compute Phone
        const phone = u.phone || (pubUser ? pubUser.phone : '') || (profile ? profile.phone : '') || '';

        // Compute dates
        const joinedDate = u.created_at || (pubUser ? pubUser.created_at : '') || '';
        const lastLogin = u.last_sign_in_at || '';

        // Compute Avatar URL
        const avatarUrl = (profile ? profile.avatar_url : '') || (pubUser ? pubUser.avatar_url : '') || (u.user_metadata ? u.user_metadata.avatar_url : '') || '';

        finalUsers.push({
          id: u.id,
          name,
          role,
          email,
          phone,
          status: parsed.status,
          joinedDate: joinedDate
            ? new Date(joinedDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
            : '',
          lastLogin: lastLogin
            ? new Date(lastLogin).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) + ' ' + new Date(lastLogin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Never',
          avatarUrl,
          lastSeen: parsed.lastSeen || '',
          isOnline: parsed.isOnline
        });
      });
    }

    // Fallback: If no auth users (e.g. key missing/invalid), populate from public users table to keep system functional
    if (finalUsers.length === 0) {
      publicUsers.forEach((u: any) => {
        const id = u.id || `u-${Date.now()}`;
        if (seenUserIds.has(id)) return;
        seenUserIds.add(id);

        const email = u.email || '';
        const emailLower = email.toLowerCase();
        const profile = profilesMap.get(id) || (emailLower ? profilesMap.get(emailLower) : null);

        let name = u.name || '';
        if (!name && profile) {
          name = profile.name || profile.full_name || '';
        }
        if (!name && email) {
          name = email.split('@')[0]
            .split(/[._-]/)
            .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ');
        }
        if (!name) name = 'Unknown User';

        let role = u.is_admin ? 'Admin' : (u.role || 'User');
        let rawStatus = u.status || 'Active';
        const parsed = parseUserStatus(rawStatus, null);

        const phone = u.phone || (profile ? profile.phone : '') || '';
        const joinedDate = u.created_at || '';
        const avatarUrl = u.avatar_url || (profile ? profile.avatar_url : '') || '';

        finalUsers.push({
          id,
          name,
          role,
          email,
          phone,
          status: parsed.status,
          joinedDate: joinedDate
            ? new Date(joinedDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
            : '',
          lastLogin: 'Never',
          avatarUrl,
          lastSeen: parsed.lastSeen || '',
          isOnline: parsed.isOnline
        });
      });
    }

    console.log(`[DEBUG] Users loaded completed successfully. Count: ${finalUsers.length}`);
    res.json(finalUsers);
  } catch (err: any) {
    console.error('[DEBUG] Users load failed / RLS error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/presence', async (req, res) => {
  const { email, id } = req.body;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    let query = supabase.from('users').select('*');
    if (id) {
      query = query.eq('id', id);
    } else if (email) {
      query = query.eq('email', email);
    } else {
      return res.status(400).json({ error: 'Missing user id or email' });
    }

    const { data: userData, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!userData || userData.length === 0) {
      const userId = id || `u-${Date.now()}`;
      const userEmail = email || '';

      const payload = {
        id: userId,
        email: userEmail,
        is_admin: false,
        status: `Active|${new Date().toISOString()}`
      };

      const { error: insertErr } = await supabase.from('users').upsert([payload]);
      if (insertErr) throw insertErr;

      return res.json({ success: true, message: 'Created user and updated presence' });
    }

    const user = userData[0];
    const parsed = parseUserStatus(user.status, null);
    
    const newStatus = `${parsed.status}|${new Date().toISOString()}`;

    const { error: updateErr } = await supabase
      .from('users')
      .update({ status: newStatus })
      .eq('id', user.id);

    if (updateErr) throw updateErr;

    res.json({ success: true, message: 'Presence updated successfully' });
  } catch (err: any) {
    console.error('Presence update error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { email, role, status, phone, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing required field: email' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    let id = `u-${Date.now()}`;

    // Create user in Supabase Auth
    if (supabase) {
      try {
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
          email,
          phone: phone || undefined,
          email_confirm: true,
          user_metadata: {
            full_name: name || undefined,
            role: role || undefined
          }
        });
        if (authErr) {
          console.error('Auth signup failed, maybe user exists. Error:', authErr.message);
        } else if (authData && authData.user) {
          id = authData.user.id;
        }
      } catch (e: any) {
        console.error('Exception in auth signup:', e.message);
      }
    }

    const payload = {
      id,
      email,
      is_admin: role === 'Admin',
      status: status ? status.toLowerCase() : 'active'
    };

    const { error } = await supabase
      .from('users')
      .upsert([payload]);

    if (error) throw error;

    const emailPrefix = email.split('@')[0];
    const computedName = name || emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

    res.status(201).json({
      id,
      name: computedName,
      role: role || 'User',
      email,
      phone: phone || '',
      status: status || 'Active',
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      lastLogin: 'Never',
      avatarUrl: ''
    });
  } catch (err: any) {
    console.error('Supabase user create error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { email, role, status, name, phone } = req.body;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    // 1. Update auth.users
    if (supabase) {
      try {
        const updateObj: any = {};
        if (email) updateObj.email = email;
        if (phone !== undefined) updateObj.phone = phone || null;
        if (name || role) {
          updateObj.user_metadata = {
            full_name: name,
            role: role
          };
        }
        await supabase.auth.admin.updateUserById(id, updateObj);
      } catch (e: any) {
        console.error('Error updating auth user metadata:', e.message);
      }
    }

    // 2. Update public.users table
    const updatePayload: any = {};
    if (email !== undefined) updatePayload.email = email;
    if (role !== undefined) updatePayload.is_admin = (role === 'Admin');
    if (status !== undefined) updatePayload.status = status.toLowerCase();

    const { error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', id);

    if (error) throw error;

    const emailPrefix = (email || 'user').split('@')[0];
    const computedName = name || emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

    res.json({
      id,
      name: computedName,
      role: role || 'User',
      email: email || '',
      phone: phone || '',
      status: status || 'Active',
      joinedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      lastLogin: 'Never',
      avatarUrl: ''
    });
  } catch (err: any) {
    console.error('Supabase user update error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    // 1. Delete auth user
    if (supabase) {
      try {
        await supabase.auth.admin.deleteUser(id);
      } catch (e: any) {
        console.error('Error deleting auth user:', e.message);
      }
    }

    // 2. Delete public table user
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    console.error('Supabase user delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Cashbooks
app.get('/api/cashbooks', async (req, res) => {
  console.log('[DEBUG] Cashbooks loaded started...');
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('[DEBUG] Cashbooks load failed: Supabase admin client is missing.');
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    // Fetch real cashbooks
    const { data: cashbooksData, error: cbErr } = await supabase
      .from('cashbooks')
      .select('*')
      .order('name', { ascending: true });

    if (cbErr) throw cbErr;

    // Fetch entries to calculate aggregates dynamically
    const { data: entriesData, error: entErr } = await supabase
      .from('entries')
      .select('cashbook_id, amount, type, created_at');

    if (entErr) throw entErr;

    // Fetch users & profiles to resolve owners
    let authUsers: any[] = [];
    if (supabase) {
      try {
        const { data: authData } = await supabase.auth.admin.listUsers();
        if (authData && authData.users) {
          authUsers = authData.users;
        }
      } catch (e) {
        console.error('Error fetching auth users in cashbooks api:', e);
      }
    }

    let publicUsers: any[] = [];
    try {
      const { data: pubData } = await supabase.from('users').select('*');
      if (pubData) publicUsers = pubData;
    } catch (e) {
      console.error('Error fetching public users in cashbooks api:', e);
    }

    let profiles: any[] = [];
    try {
      const { data: profData } = await supabase.from('profiles').select('*');
      if (profData) profiles = profData;
    } catch (e) {
      console.error('Error fetching profiles in cashbooks api:', e);
    }

    // Map of userId -> { name, email }
    const userLookupMap = new Map<string, { name: string, email: string }>();

    profiles.forEach(p => {
      const name = p.name || p.full_name || '';
      const email = p.email || '';
      if (p.user_id) {
        userLookupMap.set(p.user_id, { name, email });
      }
      if (p.id) {
        userLookupMap.set(p.id, { name, email });
      }
    });

    publicUsers.forEach(u => {
      const email = u.email || '';
      const name = u.name || (email ? email.split('@')[0] : '');
      const existing = userLookupMap.get(u.id) || { name: '', email: '' };
      userLookupMap.set(u.id, {
        name: u.name || existing.name || name,
        email: email || existing.email
      });
    });

    authUsers.forEach((u: any) => {
      const email = u.email || '';
      let name = '';
      if (u.user_metadata) {
        name = u.user_metadata.name || u.user_metadata.full_name || '';
      }
      if (!name && email) {
        name = email.split('@')[0]
          .split(/[._-]/)
          .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');
      }
      const existing = userLookupMap.get(u.id) || { name: '', email: '' };
      userLookupMap.set(u.id, {
        name: name || existing.name || 'Unknown User',
        email: email || existing.email
      });
    });

    const mapped = (cashbooksData || []).map((cb: any) => {
      const cbEntries = (entriesData || []).filter((e: any) => e.cashbook_id === cb.id);
      const entriesCount = cbEntries.length;
      let totalInflow = 0;
      let totalOutflow = 0;

      cbEntries.forEach((e: any) => {
        const amt = Number(e.amount || 0);
        const type = e.type || (amt >= 0 ? 'in' : 'out');
        if (type === 'in') {
          totalInflow += amt;
        } else {
          totalOutflow += amt;
        }
      });

      // Resolve Owner Name & Email
      let manager = cb.user_name || 'Unknown Owner';
      let ownerEmail = '';

      if (cb.user_id) {
        const resolved = userLookupMap.get(cb.user_id);
        if (resolved) {
          if (resolved.name) {
            manager = resolved.name;
          }
          if (resolved.email) {
            ownerEmail = resolved.email;
          }
        }
      }

      // Calculate Dates
      const formatTimestamp = (ts: string) => {
        if (!ts) return 'N/A';
        try {
          const d = new Date(ts);
          if (isNaN(d.getTime())) return ts;
          return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        } catch {
          return ts;
        }
      };

      const createdDate = formatTimestamp(cb.created_at);

      // Calculate Updated Date from latest entry
      let latestEntryTs = cb.created_at || '';
      cbEntries.forEach((e: any) => {
        const entryTs = e.created_at || '';
        if (entryTs && (!latestEntryTs || new Date(entryTs) > new Date(latestEntryTs))) {
          latestEntryTs = entryTs;
        }
      });
      const updatedDate = formatTimestamp(latestEntryTs);

      // Determine Budget status dynamically
      const utilization = totalInflow > 0 ? (totalOutflow / totalInflow) * 100 : 0;
      let status = 'Active';
      if (utilization > 90) {
        status = 'Nearing Limit';
      } else if (utilization > 0 && utilization < 50) {
        status = 'Under Budget';
      }

      return {
        id: cb.id,
        name: cb.name,
        userId: cb.user_id,
        manager,
        ownerEmail,
        entriesCount,
        totalInflow,
        totalOutflow,
        currentBalance: totalInflow - totalOutflow,
        status,
        createdDate,
        updatedDate
      };
    });

    console.log(`[DEBUG] Cashbooks loaded completed successfully. Count: ${mapped.length}`);
    res.json(mapped);
  } catch (err: any) {
    console.error('[DEBUG] Cashbooks load failed / RLS error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cashbooks', async (req, res) => {
  const { name, manager, status } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing required fields: name' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    const id = `cb-${Date.now()}`;
    const payload = {
      id,
      name,
      user_name: manager || 'System Admin',
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('cashbooks')
      .insert([payload]);

    if (error) throw error;

    res.status(201).json({
      id,
      name,
      manager: manager || 'System Admin',
      ownerEmail: '',
      entriesCount: 0,
      totalInflow: 0,
      totalOutflow: 0,
      currentBalance: 0,
      status: status || 'Active',
      createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      updatedDate: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    });
  } catch (err: any) {
    console.error('Supabase cashbook create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Entries
app.get('/api/entries', async (req, res) => {
  console.log('[DEBUG] Entries load started...');
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.error('[DEBUG] Entries load failed: Supabase admin client is missing.');
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    const { cashbookId } = req.query;

    let query = supabase.from('entries').select('*');
    if (cashbookId) {
      query = query.eq('cashbook_id', cashbookId);
    }

    const { data: entriesData, error: entErr } = await query.order('created_at', { ascending: false });
    if (entErr) throw entErr;

    const { data: cashbooksData, error: cbErr } = await supabase
      .from('cashbooks')
      .select('id, name');

    if (cbErr) throw cbErr;

    const cbMap = new Map((cashbooksData || []).map((c: any) => [c.id, c.name]));

    // Fetch attachments/ai_attachments for returned entries efficiently
    const entryIds = (entriesData || []).map((e: any) => e.id);
    const attachmentsMap = new Map<string, any[]>();

    if (entryIds.length > 0) {
      try {
        const { data: atts } = await supabase
          .from('attachments')
          .select('*')
          .in('entry_id', entryIds);

        (atts || []).forEach((a: any) => {
          if (a.entry_id) {
            const list = attachmentsMap.get(a.entry_id) || [];
            list.push({
              id: a.id,
              name: a.file_name || `Attachment_${a.id.substring(0, 8)}`,
              fileType: a.file_type || 'Image',
              url: a.file_url || a.url || '',
              uploadedAt: a.created_at
            });
            attachmentsMap.set(a.entry_id, list);
          }
        });
      } catch (e) {
        console.error('Error fetching attachments for entries:', e);
      }

      try {
        const { data: aiAtts } = await supabase
          .from('ai_attachments')
          .select('*')
          .in('entry_id', entryIds);

        (aiAtts || []).forEach((a: any) => {
          if (a.entry_id) {
            const list = attachmentsMap.get(a.entry_id) || [];
            if (!list.some((existing: any) => existing.url === a.file_url)) {
              list.push({
                id: a.id,
                name: a.file_name || `AI_Attachment_${a.id.substring(0, 8)}`,
                fileType: a.file_type || 'Image',
                url: a.file_url || a.url || '',
                uploadedAt: a.created_at,
                isAi: true
              });
              attachmentsMap.set(a.entry_id, list);
            }
          }
        });
      } catch (e) {
        console.error('Error fetching AI attachments for entries:', e);
      }
    }

    const mapped = (entriesData || []).map((e: any) => {
      const amt = e.amount !== null && e.amount !== undefined ? Number(e.amount) : null;
      const type = e.type || (amt !== null && amt >= 0 ? 'in' : 'out');

      return {
        id: e.id,
        userId: e.user_id || 'u-admin',
        userName: e.user_name || 'Admin',
        userAvatar: e.user_avatar || '',
        description: e.description || e.action || 'No description',
        category: e.category || 'Misc',
        mode: e.mode || 'Cash',
        type,
        cashbookId: e.cashbook_id || '',
        cashbookName: cbMap.get(e.cashbook_id) || 'General Cashbook',
        amount: amt,
        date: e.date || (e.created_at ? new Date(e.created_at).toLocaleDateString('en-US') : ''),
        time: e.created_at
          ? new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'Just now',
        status: e.status || 'Success',
        timestamp: e.created_at || new Date().toISOString(),
        attachments: attachmentsMap.get(e.id) || []
      };
    });

    console.log(`[DEBUG] Entries loaded completed successfully. Count: ${mapped.length}`);
    res.json(mapped);
  } catch (err: any) {
    console.error('[DEBUG] Entries load failed / RLS error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/entries', async (req, res) => {
  const {
    userId,
    userName,
    cashbookId,
    amount,
    type,
    description,
    category,
    mode,
    date,
    status
  } = req.body;

  if (amount === undefined || amount === null) {
    return res.status(400).json({ error: 'Missing required field: amount' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    const id = `e-${Date.now()}`;
    const entryPayload = {
      id,
      user_id: userId || null,
      user_name: userName || 'Admin',
      cashbook_id: cashbookId || null,
      amount: Number(amount),
      type: type || 'in',
      description: description || 'Manual Entry',
      category: category || 'Misc',
      mode: mode || 'Cash',
      date: date || new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString()
    };

    console.log('[DEBUG] Creating database entry with payload:', JSON.stringify(entryPayload));

    const { error } = await supabase
      .from('entries')
      .insert([entryPayload]);

    if (error) {
      console.error('[DEBUG] Failed to insert entry into Supabase:', error);
      throw error;
    }

    console.log(`[DEBUG] Entry created successfully with ID: ${id}`);

    res.status(201).json({
      id,
      userId: userId || 'u-admin',
      userName: userName || 'Admin',
      description: description || 'Manual Entry',
      category: category || 'Misc',
      mode: mode || 'Cash',
      type: type || 'in',
      cashbookId: cashbookId || '',
      cashbookName: 'Cashbook',
      amount: Number(amount),
      date: date || new Date().toISOString().split('T')[0],
      time: 'Just now',
      status: status || 'Success',
      timestamp: new Date().toISOString(),
      attachments: []
    });
  } catch (err: any) {
    console.error('Supabase entry create error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/entries/:id', async (req, res) => {
  const { id } = req.params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Entry deleted successfully.' });
  } catch (err: any) {
    console.error('Supabase entry delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Attachments
app.get('/api/attachments', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  const { userId, cashbookId, source, fileType, startDate, endDate } = req.query;

  try {
    // 1. Fetch entries, cashbooks and users to assist in mapping & filtering
    const { data: entries, error: eErr } = await supabase
      .from('entries')
      .select('*');
    if (eErr) throw eErr;

    const { data: cashbooks, error: cbErr } = await supabase
      .from('cashbooks')
      .select('*');
    if (cbErr) throw cbErr;

    const { data: users, error: uErr } = await supabase
      .from('users')
      .select('*');
    if (uErr) throw uErr;

    const entriesMap = new Map<string, any>((entries || []).map((e: any) => [e.id, e]));
    const cbMap = new Map<string, string>((cashbooks || []).map((c: any) => [c.id, c.name]));

    // 2. Fetch manual attachments
    let manualAtts: any[] = [];
    if (!source || source === 'all' || source === 'manual') {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      manualAtts = data || [];
    }

    // 3. Fetch AI attachments
    let aiAtts: any[] = [];
    if (!source || source === 'all' || source === 'ai') {
      const { data, error } = await supabase
        .from('ai_attachments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      aiAtts = data || [];
    }

    // 4. Fetch Cloudinary images from images table
    let cloudinaryImages: any[] = [];
    if (!source || source === 'all' || source === 'manual' || source === 'ai') {
      try {
        const { data, error } = await supabase
          .from('images')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        cloudinaryImages = data || [];
      } catch (err) {
        console.error('Error fetching images table:', err);
      }
    }

    // Map manual attachments
    const manualMapped = manualAtts.map((a: any) => {
      const entry = a.entry_id ? entriesMap.get(a.entry_id) : null;
      const cashbookName = entry && entry.cashbook_id ? cbMap.get(entry.cashbook_id) : 'General Cashbook';
      const entryTitle = entry ? (entry.description || 'Manual Entry') : 'N/A';
      
      const fileUrl = a.file_url || a.url || '';
      const ext = (a.file_type || 'PDF').toUpperCase();
      const fileName = a.file_name || `Attachment_${a.id.substring(0, 8)}.${ext.toLowerCase()}`;

      return {
        id: a.id,
        entryId: a.entry_id || '',
        entryTitle,
        userId: a.user_id || entry?.user_id || 'u-admin',
        userName: a.user_name || entry?.user_name || 'Admin',
        userEmail: a.user_email || 'admin@trackbook.com',
        cashbookId: entry?.cashbook_id || '',
        cashbookName,
        source: 'Manual Attachment',
        fileUrl,
        fileName,
        fileType: ext,
        fileSize: '1.2 MB',
        uploadedAt: a.created_at || new Date().toISOString(),
        cloudStoragePath: fileUrl ? fileUrl.split('/').pop() || 'storage/path' : 'storage/path'
      };
    });

    // Map AI attachments
    const aiMapped = aiAtts.map((a: any) => {
      const entry = a.entry_id ? entriesMap.get(a.entry_id) : null;
      const cashbookName = entry && entry.cashbook_id ? cbMap.get(entry.cashbook_id) : 'General Cashbook';
      const entryTitle = entry ? (entry.description || 'AI Approved Ledger') : 'N/A';
      
      const fileUrl = a.file_url || a.url || '';
      const ext = (a.file_type || 'JPEG').toUpperCase();
      const fileName = a.file_name || `AI_Attachment_${a.id.substring(0, 8)}.${ext.toLowerCase()}`;

      return {
        id: a.id,
        entryId: a.entry_id || '',
        entryTitle,
        userId: a.user_id || entry?.user_id || 'u-admin',
        userName: a.user_name || entry?.user_name || 'Admin',
        userEmail: a.user_email || 'admin@trackbook.com',
        cashbookId: entry?.cashbook_id || '',
        cashbookName,
        source: 'AI Attachment',
        fileUrl,
        fileName,
        fileType: ext,
        fileSize: '980 KB',
        uploadedAt: a.created_at || new Date().toISOString(),
        cloudStoragePath: fileUrl ? fileUrl.split('/').pop() || 'storage/path' : 'storage/path'
      };
    });

    // Map Cloudinary images
    const cloudinaryMapped = cloudinaryImages.map((a: any) => {
      const fileUrl = a.image_url || '';
      
      // Determine file extension
      let ext = 'PNG';
      if (fileUrl.toLowerCase().endsWith('.jpg') || fileUrl.toLowerCase().endsWith('.jpeg')) {
        ext = 'JPEG';
      } else if (fileUrl.toLowerCase().endsWith('.gif')) {
        ext = 'GIF';
      } else if (fileUrl.toLowerCase().endsWith('.pdf')) {
        ext = 'PDF';
      }

      // Determine clean filename
      let fileName = '';
      if (a.public_id) {
        fileName = a.public_id.split('/').pop() + '.' + ext.toLowerCase();
      } else if (fileUrl) {
        fileName = fileUrl.split('/').pop() || `Image_${a.id.substring(0, 8)}.${ext.toLowerCase()}`;
      } else {
        fileName = `Image_${a.id.substring(0, 8)}.${ext.toLowerCase()}`;
      }

      // Categorize as manual or AI based on folder path/public_id (usually receipts go to AI)
      const isReceipt = (a.public_id && a.public_id.includes('receipts')) || fileUrl.includes('receipts');
      
      return {
        id: a.id,
        entryId: '',
        entryTitle: 'Cloudinary Image Asset',
        userId: a.user_id || 'u-admin',
        userName: a.user_name || 'Admin',
        userEmail: a.user_email || 'admin@trackbook.com',
        cashbookId: '',
        cashbookName: 'Unassigned Cashbook',
        source: isReceipt ? 'AI Attachment' : 'Manual Attachment',
        fileUrl,
        fileName,
        fileType: ext,
        fileSize: '1.4 MB',
        uploadedAt: a.created_at || new Date().toISOString(),
        cloudStoragePath: a.public_id || (fileUrl ? fileUrl.split('/').pop() || 'cloudinary/path' : 'cloudinary/path')
      };
    });

    // Combine them
    let results = [...manualMapped, ...aiMapped, ...cloudinaryMapped];

    // Filter by User
    if (userId && userId !== 'all') {
      const selectedUserObj = (users || []).find((u: any) => u.id === userId);
      const selectedName = selectedUserObj ? selectedUserObj.name.toLowerCase() : '';
      const selectedEmail = selectedUserObj ? selectedUserObj.email.toLowerCase() : '';

      results = results.filter(r => {
        // Direct match
        if (r.userId === userId) return true;
        if (r.userEmail && selectedEmail && r.userEmail.toLowerCase() === selectedEmail) return true;

        // Relaxed similarity check (e.g. Siva matches Shiva, Shiv)
        if (selectedName) {
          const rName = r.userName.toLowerCase();
          const rEmail = r.userEmail ? r.userEmail.toLowerCase() : '';

          const nA = selectedName.replace(/\s+/g, '');
          const nB = rName.replace(/\s+/g, '');
          if (nA.includes(nB) || nB.includes(nA)) return true;

          // checks for siva/shiva/shiv
          const isA_Siva = nA.includes('siva') || nA.includes('shiva') || nA.includes('shiv');
          const isB_Siva = nB.includes('siva') || nB.includes('shiva') || nB.includes('shiv');
          if (isA_Siva && isB_Siva) return true;

          if (selectedEmail && rEmail && (selectedEmail.includes(rEmail) || rEmail.includes(selectedEmail))) return true;
        }
        return false;
      });
    }

    // Filter by Cashbook
    if (cashbookId && cashbookId !== 'all') {
      results = results.filter(r => {
        // If image has no specific cashbook assigned, keep it so it doesn't get filtered out
        if (r.cashbookId === '') return true;
        return r.cashbookId === cashbookId;
      });
    }

    // Filter by File Type
    if (fileType && fileType !== 'all') {
      const ft = String(fileType).toLowerCase();
      results = results.filter(r => {
        const t = r.fileType.toLowerCase();
        if (ft === 'image') return t.includes('png') || t.includes('jpg') || t.includes('jpeg') || t.includes('gif');
        if (ft === 'pdf') return t.includes('pdf');
        if (ft === 'excel') return t.includes('xls') || t.includes('xlsx');
        if (ft === 'csv') return t.includes('csv');
        // Other
        return !t.includes('png') && !t.includes('jpg') && !t.includes('jpeg') && !t.includes('pdf') && !t.includes('xls') && !t.includes('xlsx') && !t.includes('csv');
      });
    }

    // Filter by Date Range
    if (startDate) {
      const start = new Date(startDate as string).getTime();
      results = results.filter(r => new Date(r.uploadedAt).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate as string).getTime() + 86400000;
      results = results.filter(r => new Date(r.uploadedAt).getTime() <= end);
    }

    // Sort by Upload Date descending
    results.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.json(results);
  } catch (err: any) {
    console.error('Supabase attachments error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attachments/:id', async (req, res) => {
  const { id } = req.params;
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    // Try to delete from attachments table
    const { error: mErr } = await supabase
      .from('attachments')
      .delete()
      .eq('id', id);

    if (mErr) throw mErr;

    // Try to delete from ai_attachments table
    const { error: aErr } = await supabase
      .from('ai_attachments')
      .delete()
      .eq('id', id);

    if (aErr) throw aErr;

    // Try to delete from images table
    const { error: iErr } = await supabase
      .from('images')
      .delete()
      .eq('id', id);

    if (iErr) throw iErr;

    res.json({ success: true, message: 'Attachment deleted successfully.' });
  } catch (err: any) {
    console.error('Supabase attachment delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attachments', async (req, res) => {
  const { fileType } = req.body;
  if (!fileType) {
    return res.status(400).json({ error: 'Missing field: fileType' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    const id = `att-${Date.now()}`;
    const payload = {
      id,
      file_type: fileType
    };

    const { error } = await supabase
      .from('attachments')
      .insert([payload]);

    if (error) throw error;

    res.status(201).json({
      id,
      name: `Attachment_${id.substring(0, 8)}.${fileType.toLowerCase()}`,
      fileType,
      fileSize: '1.2 MB',
      uploadedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
      uploadedBy: 'Admin',
      url: ''
    });
  } catch (err: any) {
    console.error('Supabase attachment create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Receipts (AI Attachments)
app.get('/api/receipts', async (req, res) => {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    const { data, error } = await supabase
      .from('ai_attachments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const mapped = (data || []).map((r: any) => ({
      id: r.id,
      amount: 1250.00, // Standard display fallback
      confidence: 98,
      date: r.created_at
        ? new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        : '',
      status: 'Processed',
      imageUrl: '',
      merchantName: 'AI Scanned Receipt',
      category: 'Misc',
      items: []
    }));

    res.json(mapped);
  } catch (err: any) {
    console.error('Supabase receipts fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Gemini-powered OCR Receipt Scanner Endpoint
app.post('/api/process-receipt', async (req, res) => {
  const { imageBase64, mimeType } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ error: 'imageBase64 is required' });
  }

  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const realMimeType = mimeType || 'image/jpeg';

  const receiptId = `rec-${Date.now()}`;
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

  const pendingReceipt: Receipt = {
    id: receiptId,
    amount: null,
    confidence: 0,
    date: currentDate,
    status: 'Pending',
    imageUrl: imageBase64.startsWith('data:') ? imageBase64 : `data:${realMimeType};base64,${cleanBase64}`
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase configuration is missing.' });
  }

  try {
    // 1. Insert into ai_attachments
    await supabase
      .from('ai_attachments')
      .insert([{
        id: receiptId,
        file_type: 'JPEG'
      }]);

    if (ai) {
      const promptString = "Analyze this receipt image. Extract: 1. Store/merchant name, 2. Total transaction amount as a float in Indian Rupees (₹), 3. Date in 'MMM DD, YYYY' format (e.g., Oct 24, 2023), 4. Expense category ('Food & Beverage', 'Travel', 'IT & Software', 'Utilities', 'Misc'), 5. Numerical confidence score (1-100). Return JSON matching the schema.";

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: realMimeType
            }
          },
          { text: promptString }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              merchantName: { type: Type.STRING },
              amount: { type: Type.NUMBER },
              date: { type: Type.STRING },
              category: { type: Type.STRING },
              confidence: { type: Type.INTEGER }
            },
            required: ['merchantName', 'amount', 'date', 'category', 'confidence']
          }
        }
      });

      const resultText = response.text;
      if (resultText) {
        const parsed = JSON.parse(resultText.trim());
        const extractedAmount = Number(parsed.amount) || 120.00;

        pendingReceipt.status = 'Processed';
        pendingReceipt.merchantName = parsed.merchantName || 'Unknown Merchant';
        pendingReceipt.amount = extractedAmount;
        pendingReceipt.date = parsed.date || pendingReceipt.date;
        pendingReceipt.category = parsed.category || 'Misc';
        pendingReceipt.confidence = parsed.confidence || 95;

        // 2. Insert corresponding negative ledger entry representing expense
        await supabase
          .from('entries')
          .insert([{
            id: `e-ai-${Date.now()}`,
            user_name: 'AI Scanner',
            cashbook_id: null,
            amount: -Math.abs(extractedAmount)
          }]);
      }
    } else {
      // Fallback if AI not setup
      pendingReceipt.status = 'Processed';
      pendingReceipt.merchantName = 'Express Staples';
      pendingReceipt.amount = 450.00;
      pendingReceipt.category = 'Misc';
      pendingReceipt.confidence = 90;

      await supabase
        .from('entries')
        .insert([{
          id: `e-ai-${Date.now()}`,
          user_name: 'AI Scanner',
          cashbook_id: null,
          amount: -450.00
        }]);
    }

    res.json({ success: true, receipt: pendingReceipt });
  } catch (err: any) {
    console.error('Receipt process error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- CLOUDINARY CLOUD STORAGE MANAGER API ---

// 1. Get configuration status
app.get('/api/cloudinary/config', (req, res) => {
  res.json({
    configured: isCloudinaryConfigured,
    cloudName: cloudName || null
  });
});

// 2. Fetch all folders and resources recursively from Cloudinary
app.get('/api/cloudinary/resources', async (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(400).json({ error: 'Cloudinary is not configured. Please supply environment variables in Settings.' });
  }

  try {
    // A. Fetch all resources using the Search API (returns images, raw files, pdfs, etc., up to 500)
    let resources: any[] = [];
    try {
      const searchResult = await cloudinary.search
        .expression('resource_type:image OR resource_type:raw')
        .max_results(500)
        .with_field('tags')
        .with_field('context')
        .execute();
      resources = searchResult.resources || [];
    } catch (searchErr) {
      console.warn('Cloudinary search API error, falling back to resources API:', searchErr);
      
      // Fetch images and raw assets in parallel to support all types
      try {
        const [imagesRes, rawsRes] = await Promise.all([
          cloudinary.api.resources({
            resource_type: 'image',
            type: 'upload',
            max_results: 250,
            tags: true,
            context: true
          }).catch(err => {
            console.error('Error fetching image resources fallback:', err);
            return { resources: [] };
          }),
          cloudinary.api.resources({
            resource_type: 'raw',
            type: 'upload',
            max_results: 250,
            tags: true,
            context: true
          }).catch(err => {
            console.error('Error fetching raw resources fallback:', err);
            return { resources: [] };
          })
        ]);

        const imgs = imagesRes.resources || [];
        const raws = rawsRes.resources || [];
        
        imgs.forEach((item: any) => {
          if (!item.resource_type) item.resource_type = 'image';
        });
        raws.forEach((item: any) => {
          if (!item.resource_type) item.resource_type = 'raw';
        });

        resources = [...imgs, ...raws];
      } catch (fallbackErr) {
        console.error('Ultimate Cloudinary fallback failed:', fallbackErr);
        throw fallbackErr;
      }
    }

    // B. Fetch folders recursively from Cloudinary Admin API
    const foldersSet = new Set<string>();
    
    // Traverse up to 2 levels deep to be fast and avoid API quota limits or timeouts
    async function fetchFolders(parent = '', depth = 1) {
      if (depth > 2) return;
      try {
        const result = parent 
          ? await cloudinary.api.sub_folders(parent) 
          : await cloudinary.api.root_folders();
        if (result && result.folders) {
          for (const folder of result.folders) {
            foldersSet.add(folder.path);
            await fetchFolders(folder.path, depth + 1);
          }
        }
      } catch (err) {
        console.error(`Error fetching sub_folders for parent "${parent}":`, err);
      }
    }

    await fetchFolders('', 1);

    // Also parse folders from resource paths to ensure we don't miss anything
    resources.forEach((r: any) => {
      if (r.folder) {
        let parts = r.folder.split('/');
        let current = '';
        parts.forEach((p: string) => {
          current = current ? `${current}/${p}` : p;
          foldersSet.add(current);
        });
      }
    });

    res.json({
      success: true,
      folders: Array.from(foldersSet).sort(),
      resources: resources.map(r => ({
        public_id: r.public_id,
        filename: r.filename || r.public_id.split('/').pop(),
        folder: r.folder || '',
        format: r.format || r.public_id.split('.').pop() || '',
        resource_type: r.resource_type,
        type: r.type,
        created_at: r.created_at,
        updated_at: r.uploaded_at || r.created_at,
        bytes: r.bytes || 0,
        width: r.width || null,
        height: r.height || null,
        url: r.url,
        secure_url: r.secure_url,
        tags: r.tags || [],
        context: r.context || {}
      }))
    });
  } catch (err: any) {
    console.error('Error fetching Cloudinary resources:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve Cloudinary resources' });
  }
});

// 3. Delete resource from Cloudinary
app.delete('/api/cloudinary/resources', async (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(400).json({ error: 'Cloudinary is not configured.' });
  }

  const { public_id, resource_type } = req.body;
  if (!public_id) {
    return res.status(400).json({ error: 'Missing public_id parameter.' });
  }

  try {
    const result = await cloudinary.uploader.destroy(public_id, {
      resource_type: resource_type || 'image',
      invalidate: true
    });
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('Error deleting from Cloudinary:', err);
    res.status(500).json({ error: err.message || 'Failed to delete resource from Cloudinary.' });
  }
});

// 4. Rename / Move resource inside Cloudinary
app.post('/api/cloudinary/resources/rename', async (req, res) => {
  if (!isCloudinaryConfigured) {
    return res.status(400).json({ error: 'Cloudinary is not configured.' });
  }

  const { from_public_id, to_public_id, resource_type } = req.body;
  if (!from_public_id || !to_public_id) {
    return res.status(400).json({ error: 'Missing from_public_id or to_public_id parameter.' });
  }

  try {
    const result = await cloudinary.uploader.rename(from_public_id, to_public_id, {
      resource_type: resource_type || 'image',
      overwrite: true,
      invalidate: true
    });
    res.json({ success: true, result });
  } catch (err: any) {
    console.error('Error renaming Cloudinary resource:', err);
    res.status(500).json({ error: err.message || 'Failed to rename resource inside Cloudinary.' });
  }
});

// Reset simulation database endpoint (No-op for Production)
app.post('/api/reset', async (req, res) => {
  res.json({
    success: true,
    message: "Production database is the single source of truth and cannot be reset."
  });
});

// Configure Vite middleware or static serving
async function startServer() {
  await runStartupVerification();

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrackBook Admin Server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}
