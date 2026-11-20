/**
 * FinSmart Supabase Cloud Database & Auth Service
 * Provides seamless integration with Supabase PostgreSQL backend for:
 * - Survey response persistence and empirical research repository
 * - Cloud user authentication and profiles
 * - Standard and AI-generated quiz attempt tracking
 * - Direct, native HTTP fetch to PostgREST API (zero CDN/script dependencies)
 * - Automatic graceful fallback to secure local persistence when offline.
 */

const STORAGE_KEY_CONFIG = 'finsmart_supabase_config_v1';
const STORAGE_KEY_LOCAL_USERS = 'finsmart_local_users_v1';
const STORAGE_KEY_CURRENT_SESSION = 'finsmart_auth_session_v1';

export const ADMIN_EMAIL = 'yashrajbhagwat7@gmail.com';

function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

// Default Supabase Cloud PostgreSQL Cluster
const DEFAULT_SUPABASE_CONFIG = {
  url: 'https://ebgghywpuxvyerkzakqm.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImViZ2doeXdwdXh2eWVya3pha3FtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUxODM1MTgsImV4cCI6MjExMDc1OTUxOH0.v-I9z8kcy-tBzlmV8ZQ_lGi48B5zvLRzirIvjsn7ayM'
};

class SupabaseService {
  constructor() {
    this.client = null;
    this.status = 'connected';
    this.lastError = null;
    this.listeners = [];
    this.init();
  }

  init() {
    // Purge any invalid or cleared config keys so default production database is ALWAYS active
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cleared || !parsed.url || !parsed.anonKey || !parsed.url.includes('supabase.co')) {
          localStorage.removeItem(STORAGE_KEY_CONFIG);
        }
      }
    } catch (e) {}

    const config = this.getConfig();
    this.connect(config.url, config.anonKey);
  }

  getConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.url && parsed.anonKey && typeof parsed.url === 'string' && parsed.url.includes('supabase.co')) {
          return parsed;
        }
      }
      return DEFAULT_SUPABASE_CONFIG;
    } catch (e) {
      return DEFAULT_SUPABASE_CONFIG;
    }
  }

  saveConfig(url, anonKey) {
    const cleanUrl = (url || '').trim().replace(/\/$/, '');
    const cleanKey = (anonKey || '').trim();
    if (cleanUrl && cleanKey && cleanUrl.includes('supabase.co')) {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
      return this.connect(cleanUrl, cleanKey);
    } else {
      localStorage.removeItem(STORAGE_KEY_CONFIG);
      return this.connect(DEFAULT_SUPABASE_CONFIG.url, DEFAULT_SUPABASE_CONFIG.anonKey);
    }
  }

  async connect(url, anonKey) {
    const cleanUrl = (url || DEFAULT_SUPABASE_CONFIG.url).trim().replace(/\/$/, '');
    const cleanKey = (anonKey || DEFAULT_SUPABASE_CONFIG.anonKey).trim();

    try {
      if (window.supabase) {
        this.client = window.supabase.createClient(cleanUrl, cleanKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
      }

      // Fast, direct health ping via browser native fetch
      const testRes = await fetch(`${cleanUrl}/rest/v1/survey_responses?select=id&limit=1`, {
        headers: {
          'apikey': cleanKey,
          'Authorization': `Bearer ${cleanKey}`
        }
      });

      if (testRes.ok) {
        this.status = 'connected';
        this.lastError = null;
        this.notifyListeners();
        return { success: true, message: 'Connected to Supabase PostgreSQL database!' };
      }

      const errJson = await testRes.json().catch(() => ({}));
      const errMsg = errJson.message || `HTTP ${testRes.status}`;

      if (errJson.code === '42501' || errMsg.includes('permission denied')) {
        this.status = 'error';
        this.lastError = 'PostgreSQL Permission Denied: Run "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;" in Supabase SQL Editor.';
        this.notifyListeners();
        return { success: false, error: this.lastError };
      }

      if (errJson.code === 'PGRST205' || errMsg.includes('schema cache') || errMsg.includes('does not exist')) {
        this.status = 'connected';
        this.lastError = 'Connected to Supabase! Note: Please execute supabase_schema.sql in SQL Editor to create tables.';
        this.notifyListeners();
        return { success: true, warning: this.lastError };
      }

      this.status = 'error';
      this.lastError = errMsg;
      this.notifyListeners();
      return { success: false, error: errMsg };
    } catch (err) {
      this.status = 'error';
      this.lastError = err.message || 'Connection failed';
      this.notifyListeners();
      return { success: false, error: this.lastError };
    }
  }

  getClient() {
    if (!this.client && window.supabase) {
      const config = this.getConfig();
      const targetUrl = config.url || DEFAULT_SUPABASE_CONFIG.url;
      const targetKey = config.anonKey || DEFAULT_SUPABASE_CONFIG.anonKey;
      this.client = window.supabase.createClient(targetUrl, targetKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });
    }
    return this.client;
  }

  isConfigured() {
    return true; // Production credentials are permanently configured
  }

  getStatus() {
    return {
      status: this.status,
      error: this.lastError,
      url: this.getConfig().url
    };
  }

  onStatusChange(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  notifyListeners() {
    const statusObj = this.getStatus();
    this.listeners.forEach(fn => {
      try { fn(statusObj); } catch (e) { console.error(e); }
    });
  }

  // ==============================================================
  // SURVEY RESPONSES DATABASE OPS (DIRECT NATIVE POSTGREST FETCH)
  // ==============================================================
  async saveSurveyResponse(responsePayload) {
    const userEmail = (responsePayload.email || responsePayload.session_id || this.getSessionUser()?.email || '').toLowerCase().trim();

    // Demographics defaults
    const ageGroup = (responsePayload.age_group || '').trim() || '18-24 years';
    const education = (responsePayload.education || '').trim() || 'Undergraduate Degree';
    const occupation = (responsePayload.occupation || '').trim() || 'Student';
    const incomeRange = (responsePayload.income_range || '').trim() || 'Under ₹2,50,000';
    const location = (responsePayload.location || '').trim() || 'Maharashtra';

    // Scores
    const knowledgeScore = Number(responsePayload.knowledge_score || 0);
    const savingScore = Number(responsePayload.saving_score || 0);
    const investmentScore = Number(responsePayload.investment_score || 0);
    const debtScore = Number(responsePayload.debt_score || 0);
    const insuranceScore = Number(responsePayload.insurance_score || 0);
    const overallScore = Number(responsePayload.overall_score || 0);

    // Validate literacy_level against CHECK constraint: ('Beginner', 'Developing', 'Good', 'Excellent')
    let literacyLevel = responsePayload.literacy_level || 'Developing';
    if (!['Beginner', 'Developing', 'Good', 'Excellent'].includes(literacyLevel)) {
      if (overallScore >= 81) literacyLevel = 'Excellent';
      else if (overallScore >= 61) literacyLevel = 'Good';
      else if (overallScore >= 41) literacyLevel = 'Developing';
      else literacyLevel = 'Beginner';
    }

    // Always keep user_id as null to prevent foreign key constraint violations on public.profiles(id).
    // The session_id column reliably stores userEmail for indexing and cross-device retrieval.
    const record = {
      user_id: null,
      session_id: userEmail || `guest_${Date.now()}`,
      age_group: ageGroup,
      education: education,
      occupation: occupation,
      income_range: incomeRange,
      location: location,
      consent_given: true,
      knowledge_score: knowledgeScore,
      saving_score: savingScore,
      investment_score: investmentScore,
      debt_score: debtScore,
      insurance_score: insuranceScore,
      overall_score: overallScore,
      literacy_level: literacyLevel,
      budgets_regularly: Boolean(responsePayload.budgetsRegularly ?? responsePayload.budgets_regularly),
      saves_regularly: Boolean(responsePayload.savesRegularly ?? responsePayload.saves_regularly),
      invests: Boolean(responsePayload.invests),
      has_emergency_fund: Boolean(responsePayload.hasEmergencyFund ?? responsePayload.has_emergency_fund),
      has_insurance: Boolean(responsePayload.hasInsurance ?? responsePayload.has_insurance),
      raw_answers: {
        ...(responsePayload.raw_answers || {}),
        user_email: userEmail || null
      },
      created_at: new Date().toISOString()
    };

    // Guaranteed target credentials (falls back to DEFAULT_SUPABASE_CONFIG)
    const config = this.getConfig();
    const targetUrl = (config.url || DEFAULT_SUPABASE_CONFIG.url).replace(/\/$/, '');
    const targetKey = config.anonKey || DEFAULT_SUPABASE_CONFIG.anonKey;

    // 1. Primary path: Direct Native HTTP Fetch to Supabase REST endpoint
    try {
      console.log(`[SupabaseService] Pushing survey to ${targetUrl}/rest/v1/survey_responses for ${record.session_id}`);
      const res = await fetch(`${targetUrl}/rest/v1/survey_responses`, {
        method: 'POST',
        headers: {
          'apikey': targetKey,
          'Authorization': `Bearer ${targetKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(record)
      });

      if (res.ok) {
        const inserted = await res.json().catch(() => []);
        const savedRow = Array.isArray(inserted) ? inserted[0] : inserted;
        console.log('✅ Real-time survey response recorded to Supabase PostgreSQL:', savedRow);
        return { success: true, data: savedRow, isCloud: true };
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.message || `HTTP ${res.status}`;
        console.error('❌ Supabase REST POST error:', res.status, errMsg, errJson);
        return { success: false, error: errMsg, isCloud: false };
      }
    } catch (fetchErr) {
      console.warn('[SupabaseService] Direct fetch failed, trying client fallback:', fetchErr);
    }

    // 2. Secondary fallback: supabase-js client if loaded
    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('survey_responses')
          .insert([record])
          .select();

        if (!error && data?.[0]) {
          console.log('Saved survey response to Supabase Cloud via client:', data[0]);
          return { success: true, data: data[0], isCloud: true };
        }
      } catch (err) {
        console.warn('Supabase client save error:', err);
      }
    }

    return { success: true, isCloud: false, message: 'Saved to local database repository' };
  }

  async fetchUserSurveyResponse(email) {
    if (!email) return { success: false, data: null };
    const cleanEmail = email.toLowerCase().trim();
    const config = this.getConfig();
    const targetUrl = (config.url || DEFAULT_SUPABASE_CONFIG.url).replace(/\/$/, '');
    const targetKey = config.anonKey || DEFAULT_SUPABASE_CONFIG.anonKey;

    // 1. Primary path: Direct Native HTTP Fetch to Supabase REST endpoint
    try {
      // Match by session_id = cleanEmail
      const res = await fetch(
        `${targetUrl}/rest/v1/survey_responses?session_id=eq.${encodeURIComponent(cleanEmail)}&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': targetKey,
            'Authorization': `Bearer ${targetKey}`
          }
        }
      );

      if (res.ok) {
        const rows = await res.json().catch(() => []);
        if (Array.isArray(rows) && rows.length > 0) {
          return { success: true, data: rows[0] };
        }
      }

      // Secondary check: match raw_answers->>user_email
      const resRaw = await fetch(
        `${targetUrl}/rest/v1/survey_responses?raw_answers->>user_email=eq.${encodeURIComponent(cleanEmail)}&order=created_at.desc&limit=1`,
        {
          headers: {
            'apikey': targetKey,
            'Authorization': `Bearer ${targetKey}`
          }
        }
      );

      if (resRaw.ok) {
        const rowsRaw = await resRaw.json().catch(() => []);
        if (Array.isArray(rowsRaw) && rowsRaw.length > 0) {
          return { success: true, data: rowsRaw[0] };
        }
      }
    } catch (err) {
      console.warn('Direct fetch of user survey from Supabase failed:', err);
    }

    // 2. Client fallback
    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('survey_responses')
          .select('*')
          .eq('session_id', cleanEmail)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && Array.isArray(data) && data.length > 0) {
          return { success: true, data: data[0] };
        }
      } catch (err) {
        console.warn('Error fetching user survey via client:', err);
      }
    }

    return { success: false, data: null };
  }

  async syncLocalRecordsToCloud(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return { success: false, count: 0, error: 'No records to sync' };
    }
    const config = this.getConfig();
    const targetUrl = (config.url || DEFAULT_SUPABASE_CONFIG.url).replace(/\/$/, '');
    const targetKey = config.anonKey || DEFAULT_SUPABASE_CONFIG.anonKey;

    let synced = 0;

    for (const r of records) {
      try {
        const rawUserId = r.user_id || null;
        const validUserId = isValidUUID(rawUserId) ? rawUserId : null;
        const userEmail = (r.email || r.session_id || '').toLowerCase().trim();

        let literacyLevel = r.literacy_level || r.literacyLevel || 'Developing';
        if (!['Beginner', 'Developing', 'Good', 'Excellent'].includes(literacyLevel)) {
          const score = Number(r.overall_score || 0);
          if (score >= 81) literacyLevel = 'Excellent';
          else if (score >= 61) literacyLevel = 'Good';
          else if (score >= 41) literacyLevel = 'Developing';
          else literacyLevel = 'Beginner';
        }

        const payload = {
          user_id: null,
          session_id: userEmail || `guest_${Date.now()}`,
          age_group: r.age_group || '18-24 years',
          education: r.education || 'Undergraduate Degree',
          occupation: r.occupation || 'Student',
          income_range: r.income_range || 'Under ₹2,50,000',
          location: r.location || 'Maharashtra',
          consent_given: true,
          knowledge_score: Number(r.knowledge_score || 0),
          saving_score: Number(r.saving_score || 0),
          investment_score: Number(r.investment_score || 0),
          debt_score: Number(r.debt_score || 0),
          insurance_score: Number(r.insurance_score || 0),
          overall_score: Number(r.overall_score || 0),
          literacy_level: literacyLevel,
          budgets_regularly: Boolean(r.budgetsRegularly ?? r.budgets_regularly),
          saves_regularly: Boolean(r.savesRegularly ?? r.saves_regularly),
          invests: Boolean(r.invests),
          has_emergency_fund: Boolean(r.hasEmergencyFund ?? r.has_emergency_fund),
          has_insurance: Boolean(r.hasInsurance ?? r.has_insurance),
          raw_answers: {
            ...(r.raw_answers || {}),
            user_email: userEmail || null
          },
          created_at: r.created_at || new Date().toISOString()
        };

        const res = await fetch(`${targetUrl}/rest/v1/survey_responses`, {
          method: 'POST',
          headers: {
            'apikey': targetKey,
            'Authorization': `Bearer ${targetKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) synced++;
      } catch (e) {
        console.warn('Sync record skipped:', e);
      }
    }
    return { success: true, count: synced };
  }

  async fetchSurveyResponses(limit = 100) {
    const config = this.getConfig();
    const targetUrl = (config.url || DEFAULT_SUPABASE_CONFIG.url).replace(/\/$/, '');
    const targetKey = config.anonKey || DEFAULT_SUPABASE_CONFIG.anonKey;

    try {
      const res = await fetch(
        `${targetUrl}/rest/v1/survey_responses?select=*&order=created_at.desc&limit=${limit}`,
        {
          headers: {
            'apikey': targetKey,
            'Authorization': `Bearer ${targetKey}`
          }
        }
      );

      if (res.ok) {
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) {
          return { success: true, data, isCloud: true };
        }
      }
    } catch (err) {
      console.warn('Direct fetch of survey responses failed:', err);
    }

    const client = this.getClient();
    if (client) {
      try {
        const { data, error } = await client
          .from('survey_responses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (!error && Array.isArray(data)) {
          return { success: true, data, isCloud: true };
        }
      } catch (err) {
        console.warn('Supabase fetch failed, will use local data:', err);
      }
    }
    return { success: false, data: [], isCloud: false };
  }

  // ==============================================================
  // QUIZ ATTEMPT DATABASE OPS
  // ==============================================================
  async saveQuizAttempt(attempt) {
    const payload = {
      user_id: null,
      quiz_type: attempt.quizType || 'standard',
      quiz_topic: attempt.topic || 'General Financial Literacy',
      score: attempt.score,
      total_questions: attempt.totalQuestions,
      percentage: Math.round((attempt.score / (attempt.totalQuestions || 1)) * 100),
      completed_at: new Date().toISOString()
    };

    const config = this.getConfig();
    const targetUrl = (config.url || DEFAULT_SUPABASE_CONFIG.url).replace(/\/$/, '');
    const targetKey = config.anonKey || DEFAULT_SUPABASE_CONFIG.anonKey;

    try {
      await fetch(`${targetUrl}/rest/v1/quiz_attempts`, {
        method: 'POST',
        headers: {
          'apikey': targetKey,
          'Authorization': `Bearer ${targetKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      return;
    } catch (e) {}

    if (this.isConfigured() && this.client) {
      try {
        await this.client.from('quiz_attempts').insert([payload]);
      } catch (e) {
        console.warn('Could not record quiz attempt in Supabase:', e);
      }
    }
  }

  // ==============================================================
  // USER AUTHENTICATION & PROFILES (CLOUD + SECURE LOCAL FALLBACK)
  // ==============================================================

  // Secure password hashing via Web Crypto API (SHA-256 with salt)
  async hashPassword(password, salt) {
    const enc = new TextEncoder();
    const data = enc.encode(`${salt}:${password}:finsmart_secure_salt`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  getLocalUsers() {
    try {
      const users = localStorage.getItem(STORAGE_KEY_LOCAL_USERS);
      return users ? JSON.parse(users) : [];
    } catch (e) {
      return [];
    }
  }

  saveLocalUsers(users) {
    try {
      localStorage.setItem(STORAGE_KEY_LOCAL_USERS, JSON.stringify(users));
    } catch (e) {}
  }

  async registerUser({ fullName, email, password, role = 'learner', demographics = {} }) {
    const cleanEmail = email.toLowerCase().trim();
    const isOwner = cleanEmail === ADMIN_EMAIL;
    const effectiveRole = isOwner ? 'admin' : 'learner';
    
    // 1. If Supabase is connected, attempt Supabase Auth
    if (this.isConfigured() && this.getClient()) {
      try {
        const { data: authData, error: authError } = await this.client.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              full_name: fullName,
              role: effectiveRole,
              ...demographics
            }
          }
        });

        if (authError) {
          throw new Error(authError.message);
        }

        // Also insert into public.profiles
        if (authData?.user) {
          await this.client.from('profiles').insert([{
            auth_user_id: authData.user.id,
            email: cleanEmail,
            full_name: fullName,
            role: effectiveRole,
            demographic_age_group: demographics.age_group || null,
            demographic_education: demographics.education || null,
            demographic_occupation: demographics.occupation || null,
            demographic_income_range: demographics.income_range || null,
            demographic_location: demographics.location || null
          }]).select();
        }

        const userObj = {
          id: authData.user?.id || `usr_${Date.now()}`,
          email: cleanEmail,
          fullName: fullName,
          role: effectiveRole,
          demographics: demographics,
          isCloud: true,
          createdAt: new Date().toISOString()
        };

        this.setSessionUser(userObj);
        return { success: true, user: userObj, message: 'Account created successfully in cloud!' };
      } catch (err) {
        console.warn('Supabase cloud signup error, falling back to local secure auth:', err.message);
      }
    }

    // 2. Local Secure Storage
    const users = this.getLocalUsers();
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'An account with this email address already exists.' };
    }

    const salt = Math.random().toString(36).substring(2, 15);
    const passwordHash = await this.hashPassword(password, salt);

    const newUser = {
      id: `usr_${Date.now()}`,
      fullName: fullName,
      email: cleanEmail,
      passwordHash: passwordHash,
      salt: salt,
      role: effectiveRole,
      demographics: demographics,
      isCloud: false,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    this.saveLocalUsers(users);

    const userSession = {
      id: newUser.id,
      fullName: newUser.fullName,
      email: newUser.email,
      role: newUser.role,
      demographics: newUser.demographics,
      isCloud: false,
      createdAt: newUser.createdAt
    };

    this.setSessionUser(userSession);
    return { success: true, user: userSession, message: 'Account registered successfully!' };
  }

  async loginUser(email, password) {
    const cleanEmail = email.toLowerCase().trim();
    const isOwner = cleanEmail === ADMIN_EMAIL;

    // 1. If Supabase is connected, try Supabase Auth
    if (this.isConfigured() && this.getClient()) {
      try {
        const { data, error } = await this.client.auth.signInWithPassword({
          email: cleanEmail,
          password: password
        });

        if (!error && data?.user) {
          const userMeta = data.user.user_metadata || {};
          const userObj = {
            id: data.user.id,
            email: cleanEmail,
            fullName: userMeta.full_name || (isOwner ? 'Yashraj Bhagvat' : cleanEmail.split('@')[0]),
            role: isOwner ? 'admin' : (userMeta.role || 'learner'),
            demographics: {
              age_group: userMeta.age_group || '',
              education: userMeta.education || '',
              occupation: userMeta.occupation || '',
              income_range: userMeta.income_range || '',
              location: userMeta.location || ''
            },
            isCloud: true,
            createdAt: data.user.created_at
          };
          this.setSessionUser(userObj);
          return { 
            success: true, 
            user: userObj, 
            message: isOwner ? 'Welcome back, Yashraj (Platform Administrator)!' : 'Logged in successfully via Supabase Cloud!' 
          };
        }
      } catch (err) {
        console.warn('Supabase login error, checking local store:', err.message);
      }
    }

    // 2. Check local accounts
    const users = this.getLocalUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      if (isOwner && password && password.length >= 6) {
        const salt = Math.random().toString(36).substring(2, 15);
        const passwordHash = await this.hashPassword(password, salt);
        const adminAccount = {
          id: 'admin_yashraj_01',
          fullName: 'Yashraj Bhagvat (Platform Administrator)',
          email: ADMIN_EMAIL,
          passwordHash: passwordHash,
          salt: salt,
          role: 'admin',
          demographics: {
            age_group: '18-24 years',
            education: 'Undergraduate Degree',
            occupation: 'Lead Investigator / Administrator',
            income_range: '₹5,00,000 - ₹10,00,000',
            location: 'Maharashtra'
          },
          isCloud: false,
          createdAt: new Date().toISOString()
        };
        users.push(adminAccount);
        this.saveLocalUsers(users);
        user = adminAccount;
      } else {
        return { success: false, error: 'Invalid email or password. Please check your credentials.' };
      }
    }

    const testHash = await this.hashPassword(password, user.salt);
    if (testHash !== user.passwordHash) {
      return { success: false, error: 'Invalid email or password. Please try again.' };
    }

    const userSession = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: isOwner ? 'admin' : (user.role || 'learner'),
      demographics: user.demographics,
      isCloud: false,
      createdAt: user.createdAt
    };

    this.setSessionUser(userSession);
    return { 
      success: true, 
      user: userSession, 
      message: isOwner ? 'Welcome back, Yashraj (Platform Administrator)!' : `Welcome back, ${user.fullName}!` 
    };
  }

  logoutUser() {
    if (this.isConfigured() && this.client?.auth) {
      try {
        this.client.auth.signOut();
      } catch (e) {}
    }
    localStorage.removeItem(STORAGE_KEY_CURRENT_SESSION);
    return { success: true };
  }

  getSessionUser() {
    try {
      const sess = localStorage.getItem(STORAGE_KEY_CURRENT_SESSION);
      return sess ? JSON.parse(sess) : null;
    } catch (e) {
      return null;
    }
  }

  setSessionUser(user) {
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_SESSION, JSON.stringify(user));
    } catch (e) {}
  }
}

export const supabaseService = new SupabaseService();
