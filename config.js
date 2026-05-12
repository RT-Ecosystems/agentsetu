// ============================================
// AgentSetu — config.js
// ============================================

const AGENTSETU_CONFIG = {

  // ✅ FIREBASE — filled
  firebase: {
    apiKey:            "AIzaSyDvBi_wj9P8l1cQhlbLCmX5ZgLS-8OlCA0",
    authDomain:        "botsetu-67839.firebaseapp.com",
    projectId:         "botsetu-67839",
    storageBucket:     "botsetu-67839.firebasestorage.app",
    messagingSenderId: "560696459155",
    appId:             "1:560696459155:web:a51b61537dac625a3f3266"
  },

  // ✏️ SUPABASE — तुम भरो
  supabase: {
    url:     "https://uzlskyrcjptpbaxpikih.supabase.co",
    anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bHNreXJjanB0cGJheHBpa2loIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTUwNDQsImV4cCI6MjA5MzkzMTA0NH0.jSy-xZ4EsRpX9EsHxvQbZqeFbDg1LUvybQV6G5tZJ7A"
  },

  // ✏️ GROQ — तुम भरो
  groq: {
    key:   "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",
    model: "llama3-8b-8192"
  },

  // ✏️ DEEPSEEK — तुम भरो
  deepseek: {
    key:   "sk-8fce47b5fcb84c53b8c0dce68b685df2",
    model: "deepseek-chat"
  },

  // ✏️ SARVAM — तुम भरो
  sarvam: {
    key: "sk_78ebkicn_R2FjNdoSexoCnR3eAn4qSzRP"
  },

  // ✏️ UPI — तुम भरो
  upi: {
    id:   "ashutoshjignabari@okaxis",
    name: "Ashutosh Singh"
  },

  encryptionKey: "AgentSetu2024SecureKey32CharLong"
};

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
      const text = await r.text();
      return text ? JSON.parse(text) : [];
    } catch (e) { console.error('DB Error:', e); return null; }
  }
  async select(table, query = '') { return this.fetch(`${table}?${query}`); }
  async insert(table, data) { return this.fetch(table, { method: 'POST', body: JSON.stringify(data) }); }
  async update(table, query, data) { return this.fetch(`${table}?${query}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  async delete(table, query) { return this.fetch(`${table}?${query}`, { method: 'DELETE' }); }
}
const db = new SupabaseClient();

// ============================================
// ENCRYPTION — AES-256
// ============================================
const Crypto = {
  async getKey(password) {
    const enc = new TextEncoder();
    const km = await window.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode('AgentSetuSalt2024'), iterations: 100000, hash: 'SHA-256' },
      km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
  },
  async encrypt(text, password) {
    try {
      const key = await this.getKey(password);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const enc = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
      const combined = new Uint8Array(12 + enc.byteLength);
      combined.set(iv); combined.set(new Uint8Array(enc), 12);
      return btoa(String.fromCharCode(...combined));
    } catch(e) { return null; }
  },
  async decrypt(encText, password) {
    try {
      const key = await this.getKey(password);
      const combined = new Uint8Array(atob(encText).split('').map(c => c.charCodeAt(0)));
      const dec = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv: combined.slice(0,12) }, key, combined.slice(12));
      return new TextDecoder().decode(dec);
    } catch(e) { return null; }
  }
};

// ============================================
// USER MANAGER
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
    const d = await db.select('users', `id=eq.${uid}`);
    return d?.[0] || null;
  },
  async updatePlan(uid, plan) {
    return db.update('users', `id=eq.${uid}`, { plan });
  },
  getPlanLimits(plan) {
    return {
      free:    { agents:1, bots:5, superAgents:0, messages:500 },
      starter: { agents:5, bots:15, superAgents:1, messages:5000 },
      growth:  { agents:10, bots:100, superAgents:1, messages:12000 },
      pro:     { agents:25, bots:250, superAgents:3, messages:25000 },
      ultra:   { agents:999, bots:9999, superAgents:999, messages:999999 }
    }[plan] || { agents:1, bots:5, superAgents:0, messages:500 };
  }
};

// ============================================
// AI MANAGER
// ============================================
const AI = {
  async groqChat(messages, userKey = null) {
    const key = userKey || AGENTSETU_CONFIG.groq.key;
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: AGENTSETU_CONFIG.groq.model, messages, max_tokens: 1000 })
      });
      return (await r.json()).choices?.[0]?.message?.content || '';
    } catch(e) { return 'AI connection error. Check API key in Settings.'; }
  },
  async deepseekChat(messages, userKey = null) {
    const key = userKey || AGENTSETU_CONFIG.deepseek.key;
    try {
      const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: AGENTSETU_CONFIG.deepseek.model, messages, max_tokens: 2000 })
      });
      return (await r.json()).choices?.[0]?.message?.content || '';
    } catch(e) { return this.groqChat(messages); }
  },
  async checkTemplate(type, lang) {
    const d = await db.select('bot_templates', `template_type=eq.${type}&language=eq.${lang}&limit=1`);
    return d?.[0] || null;
  },
  async saveTemplate(type, lang, prompt) {
    await db.insert('bot_templates', { template_type: type, language: lang, base_prompt: prompt, usage_count: 1 });
  }
};

// ============================================
// UPI HELPER
// ============================================
const UPI = {
  generateLink(amount, note, id = null, name = null) {
    return `upi://pay?pa=${id||AGENTSETU_CONFIG.upi.id}&pn=${encodeURIComponent(name||AGENTSETU_CONFIG.upi.name)}&am=${amount}&tn=${encodeURIComponent(note)}&cu=INR`;
  },
  generateQRUrl(amount, note) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(this.generateLink(amount, note))}`;
  }
};

// ============================================
// THEME
// ============================================
const Theme = {
  init() {
    const s = localStorage.getItem('agentsetu-theme') || 'light';
    document.documentElement.dataset.theme = s;
    this.updateIcon(s);
  },
  toggle() {
    const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = n;
    localStorage.setItem('agentsetu-theme', n);
    this.updateIcon(n);
  },
  updateIcon(t) {
    document.querySelectorAll('.theme-toggle,.theme-btn').forEach(b => b.textContent = t === 'dark' ? '☀️' : '🌙');
  }
};
Theme.init();
        
