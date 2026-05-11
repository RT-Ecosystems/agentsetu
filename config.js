// ============================================
// AgentSetu — config.js
// Central config — सब files यह use करेंगी
// ============================================

const AGENTSETU_CONFIG = {
  // 🔑 Firebase — Vercel env से आएगा
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_FIREBASE_AUTH_DOMAIN",
    projectId: "YOUR_FIREBASE_PROJECT_ID",
    storageBucket: "YOUR_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "YOUR_FIREBASE_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID"
  },

  // 🗄️ Supabase
  supabase: {
    url: "YOUR_SUPABASE_URL",
    anonKey: "YOUR_SUPABASE_ANON_KEY"
  },

  // 🤖 AI APIs
  groq: {
    key: "YOUR_GROQ_API_KEY",
    model: "llama3-8b-8192",
    fastModel: "llama3-8b-8192",
    smartModel: "llama-3.1-70b-versatile"
  },

  deepseek: {
    key: "YOUR_DEEPSEEK_API_KEY",
    model: "deepseek-chat"
  },

  sarvam: {
    key: "YOUR_SARVAM_API_KEY"
  },

  // 💳 UPI
  upi: {
    id: "YOUR_UPI_ID",
    name: "YOUR_UPI_NAME"
  },

  // 🔐 Encryption key (32 chars)
  encryptionKey: "AgentSetu2024SecureKey32CharLong"
};

// ============================================
// AUTO TABLE CREATION — पहली बार automatically
// ============================================
const CREATE_TABLES_SQL = `
create table if not exists users (
  id text primary key,
  email text,
  name text,
  plan text default 'free',
  upi_id text,
  messages_used int8 default 0,
  created_at timestamptz default now()
);

create table if not exists agents (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  agent_name text,
  agent_type text,
  description text,
  system_prompt text,
  sub_agents text,
  bots_list text,
  super_agent_id uuid,
  language text default 'English',
  deploy_type text,
  is_super_agent boolean default false,
  created_at timestamptz default now()
);

create table if not exists bots (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  agent_id uuid,
  bot_name text,
  language text default 'English',
  personality text,
  system_prompt text,
  welcome_message text,
  deploy_type text,
  api_key_encrypted text,
  upi_id text,
  upi_name text,
  created_at timestamptz default now()
);

create table if not exists bot_templates (
  id uuid default gen_random_uuid() primary key,
  template_type text,
  base_prompt text,
  language text,
  usage_count int8 default 0,
  created_at timestamptz default now()
);

create table if not exists conversations (
  id uuid default gen_random_uuid() primary key,
  bot_id uuid,
  agent_id uuid,
  user_msg text,
  bot_reply text,
  created_at timestamptz default now()
);

create table if not exists payments (
  id uuid default gen_random_uuid() primary key,
  user_id text,
  amount int8,
  plan text,
  upi_ref text,
  status text default 'pending',
  screenshot_url text,
  created_at timestamptz default now()
);
`;

// ============================================
// SUPABASE HELPER
// ============================================
class SupabaseClient {
  constructor() {
    this.url = AGENTSETU_CONFIG.supabase.url;
    this.key = AGENTSETU_CONFIG.supabase.anonKey;
  }

  async fetch(path, opts = {}) {
    try {
      const r = await fetch(`${this.url}/rest/v1/${path}`, {
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
          ...opts.headers
        },
        ...opts
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const text = await r.text();
      return text ? JSON.parse(text) : [];
    } catch (e) {
      console.error('Supabase error:', e);
      return null;
    }
  }

  async select(table, query = '') {
    return this.fetch(`${table}?${query}`);
  }

  async insert(table, data) {
    return this.fetch(table, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async update(table, query, data) {
    return this.fetch(`${table}?${query}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async delete(table, query) {
    return this.fetch(`${table}?${query}`, { method: 'DELETE' });
  }

  async rpc(fn, params) {
    try {
      const r = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          'apikey': this.key,
          'Authorization': `Bearer ${this.key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      });
      return r.json();
    } catch (e) { return null; }
  }
}

const db = new SupabaseClient();

// ============================================
// ENCRYPTION — AES-256 (Web Crypto API)
// ============================================
const Crypto = {
  async getKey(password) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']
    );
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('AgentSetuSalt2024'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  },

  async encrypt(text, password) {
    try {
      const key = await this.getKey(password);
      const enc = new TextEncoder();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, enc.encode(text)
      );
      const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.byteLength);
      return btoa(String.fromCharCode(...combined));
    } catch (e) { return null; }
  },

  async decrypt(encryptedText, password) {
    try {
      const key = await this.getKey(password);
      const combined = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)));
      const iv = combined.slice(0, 12);
      const data = combined.slice(12);
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv }, key, data
      );
      return new TextDecoder().decode(decrypted);
    } catch (e) { return null; }
  }
};

// ============================================
// USER MANAGER — Firebase + Supabase sync
// ============================================
const UserManager = {
  async syncUser(firebaseUser) {
    if (!firebaseUser) return null;
    const existing = await db.select('users', `id=eq.${firebaseUser.uid}`);
    if (existing && existing.length > 0) return existing[0];
    const newUser = {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
      plan: 'free',
      messages_used: 0
    };
    await db.insert('users', newUser);
    return newUser;
  },

  async getUser(uid) {
    const data = await db.select('users', `id=eq.${uid}`);
    return data?.[0] || null;
  },

  async updatePlan(uid, plan) {
    return db.update('users', `id=eq.${uid}`, { plan });
  },

  getPlanLimits(plan) {
    const limits = {
      free:    { agents: 1, bots: 5, superAgents: 0, messages: 500, byokMultiplier: 2 },
      starter: { agents: 5, bots: 15, superAgents: 1, messages: 5000, byokMultiplier: 3 },
      growth:  { agents: 10, bots: 100, superAgents: 1, messages: 12000, byokMultiplier: 3 },
      pro:     { agents: 25, bots: 250, superAgents: 3, messages: 25000, byokMultiplier: 3 },
      ultra:   { agents: 999, bots: 9999, superAgents: 999, messages: 999999, byokMultiplier: 3 }
    };
    return limits[plan] || limits.free;
  }
};

// ============================================
// AI MANAGER — Groq + DeepSeek
// ============================================
const AI = {
  async chat(messages, useDeepSeek = false, userApiKey = null) {
    if (useDeepSeek) {
      return this.deepseekChat(messages, userApiKey);
    }
    return this.groqChat(messages, userApiKey);
  },

  async groqChat(messages, userApiKey = null) {
    const key = userApiKey || AGENTSETU_CONFIG.groq.key;
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AGENTSETU_CONFIG.groq.model,
          messages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });
      const data = await r.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (e) { return 'Error connecting to AI. Please check your API key.'; }
  },

  async deepseekChat(messages, userApiKey = null) {
    const key = userApiKey || AGENTSETU_CONFIG.deepseek.key;
    try {
      const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: AGENTSETU_CONFIG.deepseek.model,
          messages,
          max_tokens: 2000
        })
      });
      const data = await r.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (e) { return this.groqChat(messages); }
  },

  async checkTemplate(type, language) {
    const data = await db.select('bot_templates', `template_type=eq.${type}&language=eq.${language}&limit=1`);
    return data?.[0] || null;
  },

  async saveTemplate(type, language, prompt) {
    await db.insert('bot_templates', { template_type: type, language, base_prompt: prompt, usage_count: 1 });
  }
};

// ============================================
// UPI HELPER
// ============================================
const UPI = {
  generateLink(amount, note, upiId = null, name = null) {
    const id = upiId || AGENTSETU_CONFIG.upi.id;
    const n = name || AGENTSETU_CONFIG.upi.name;
    return `upi://pay?pa=${id}&pn=${encodeURIComponent(n)}&am=${amount}&tn=${encodeURIComponent(note)}&cu=INR`;
  },

  generateQRUrl(amount, note) {
    const upiLink = this.generateLink(amount, note);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
  }
};

// ============================================
// THEME MANAGER
// ============================================
const Theme = {
  init() {
    const saved = localStorage.getItem('agentsetu-theme') || 'light';
    document.documentElement.dataset.theme = saved;
    this.updateIcon(saved);
  },
  toggle() {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('agentsetu-theme', next);
    this.updateIcon(next);
  },
  updateIcon(theme) {
    document.querySelectorAll('.theme-toggle, .theme-btn').forEach(btn => {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
    });
  }
};

// Init theme immediately
Theme.init();
