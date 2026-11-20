/**
 * FinSmart Supabase Cloud Database & Auth Service
 * Provides seamless integration with Supabase PostgreSQL backend for:
 * - Survey response persistence and empirical research repository
 * - Cloud user authentication and profiles
 * - Standard and AI-generated quiz attempt tracking
 * - Automatic graceful fallback to secure local persistence when credentials are not yet entered.
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
    this.status = 'not_configured'; // 'connected' | 'not_configured' | 'error'
    this.lastError = null;
    this.listeners = [];
    this.init();
  }

  init() {
    const config = this.getConfig();
    if (config.url && config.anonKey) {
      this.connect(config.url, config.anonKey);
    }
  }

  getConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.cleared) {
          return { url: '', anonKey: '' };
        }
        if (parsed.url && parsed.anonKey) {
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
    if (cleanUrl && cleanKey) {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
      return this.connect(cleanUrl, cleanKey);
    } else {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({ cleared: true, url: '', anonKey: '' }));
      this.client = null;
      this.status = 'not_configured';
      this.notifyListeners();
      return Promise.resolve({ success: true, message: 'Supabase configuration cleared. Using local database.' });
    }
  }

  async connect(url, anonKey) {
    if (!window.supabase) {
      this.status = 'error';
      this.lastError = 'Supabase JS library not loaded. Check script tag.';
      this.notifyListeners();
      return { success: false, error: this.lastError };
    }

    try {
      this.client = window.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true
        }
      });

      // Quick ping test
      const { data, error } = await this.client
        .from('survey_responses')
        .select('id')
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        // If table doesn't exist yet, it's still a valid connection to Supabase project
        const isTableMissing = (error.message && (
          error.message.includes('relation "public.survey_responses" does not exist') ||
          error.message.includes('schema cache')
        )) || error.code === 'PGRST205';

        if (isTableMissing) {
          this.status = 'connected';
          this.lastError = 'Connected to Supabase! Note: Please execute supabase_schema.sql in SQL Editor to create tables.';
          this.notifyListeners();
          return { success: true, warning: this.lastError };
        }

        if (error.code === '42501' || (error.message && error.message.includes('permission denied'))) {
          this.status = 'error';
          this.lastError = 'PostgreSQL Permission Denied: Run "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;" in Supabase SQL Editor.';
          this.notifyListeners();
          return { success: false, error: this.lastError };
        }
        this.status = 'error';
        this.lastError = error.message;
        this.notifyListeners();
        return { success: false, error: error.message };
      }

      this.status = 'connected';
      this.lastError = null;
      this.notifyListeners();
      return { success: true, message: 'Connected to Supabase PostgreSQL database!' };
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
      if (config.url && config.anonKey) {
        this.client = window.supabase.createClient(config.url, config.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
      }
    }
    return this.client;
  }

  isConfigured() {
    return this.getClient() !== null;
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
  // SURVEY RESPONSES DATABASE OPS
  // ==============================================================
  async saveSurveyResponse(responsePayload) {
    const client = this.getClient();
    const userEmail = (responsePayload.email || responsePayload.session_id || this.getSessionUser()?.email || '').toLowerCase().trim();
    
    // Ensure user_id is only passed if it is a valid UUID to prevent PostgreSQL 22P02 error
    const rawUserId = responsePayload.user_id || this.getSessionUser()?.id || null;
    const validUserId = isValidUUID(rawUserId) ? rawUserId : null;

    const record = {
      user_id: validUserId,
      session_id: userEmail || null,
      age_group: responsePayload.age_group || '18-24 years',
      education: responsePayload.education || 'Undergraduate Degree',
      occupation: responsePayload.occupation || 'Student',
      income_range: responsePayload.income_range || 'Under ₹2,50,000',
      location: responsePayload.location || 'Maharashtra',
      consent_given: true,
      knowledge_score: responsePayload.knowledge_score || 0,
      saving_score: responsePayload.saving_score || 0,
      investment_score: responsePayload.investment_score || 0,
      debt_score: responsePayload.debt_score || 0,
      insurance_score: responsePayload.insurance_score || 0,
      overall_score: responsePayload.overall_score || 0,
      literacy_level: responsePayload.literacy_level || 'Developing',
      budgets_regularly: Boolean(responsePayload.budgetsRegularly),
      saves_regularly: Boolean(responsePayload.savesRegularly),
      invests: Boolean(responsePayload.invests),
      has_emergency_fund: Boolean(responsePayload.hasEmergencyFund),
      has_insurance: Boolean(responsePayload.hasInsurance),
      raw_answers: {
        ...(responsePayload.raw_answers || {}),
        user_email: userEmail || null
      },
      created_at: new Date().toISOString()
    };

    if (client) {
      try {
        const { data, error } = await client
          .from('survey_responses')
          .insert([record])
          .select();

        if (error) {
          console.warn('Supabase insert warning, falling back to local sync:', error.message);
          return { success: false, error: error.message, isCloud: false };
        }
        console.log('Saved survey response to Supabase Cloud:', data?.[0]);
        return { success: true, data: data?.[0], isCloud: true };
      } catch (err) {
        console.warn('Supabase save error, local fallback active:', err);
        return { success: false, error: err.message, isCloud: false };
      }
    }

    return { success: true, isCloud: false, message: 'Saved to local database repository' };
  }

  async fetchUserSurveyResponse(email) {
    if (!email) return { success: false, data: null };
    const client = this.getClient();
    if (!client) return { success: false, data: null };

    try {
      const cleanEmail = email.toLowerCase().trim();
      const { data, error } = await client
        .from('survey_responses')
        .select('*')
        .eq('session_id', cleanEmail)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        return { success: true, data: data[0] };
      }
      return { success: false, data: null };
    } catch (err) {
      console.warn('Error fetching user survey from Supabase:', err);
      return { success: false, data: null };
    }
  }

  async syncLocalRecordsToCloud(records) {
    const client = this.getClient();
    if (!client || !Array.isArray(records) || records.length === 0) {
      return { success: false, count: 0, error: 'Database not ready or no records to sync' };
    }

    let synced = 0;
    for (const r of records) {
      try {
        const rawUserId = r.user_id || null;
        const validUserId = isValidUUID(rawUserId) ? rawUserId : null;
        const userEmail = (r.email || r.session_id || '').toLowerCase().trim();

        const payload = {
          user_id: validUserId,
          session_id: userEmail || null,
          age_group: r.age_group || '18-24 years',
          education: r.education || 'Undergraduate Degree',
          occupation: r.occupation || 'Student',
          income_range: r.income_range || 'Under ₹2,50,000',
          location: r.location || 'Maharashtra',
          consent_given: true,
          knowledge_score: r.knowledge_score || 0,
          saving_score: r.saving_score || 0,
          investment_score: r.investment_score || 0,
          debt_score: r.debt_score || 0,
          insurance_score: r.insurance_score || 0,
          overall_score: r.overall_score || 0,
          literacy_level: r.literacy_level || 'Developing',
          budgets_regularly: Boolean(r.budgetsRegularly),
          saves_regularly: Boolean(r.savesRegularly),
          invests: Boolean(r.invests),
          has_emergency_fund: Boolean(r.hasEmergencyFund),
          has_insurance: Boolean(r.hasInsurance),
          raw_answers: {
            ...(r.raw_answers || {}),
            user_email: userEmail || null
          },
          created_at: new Date().toISOString()
        };
        const { error } = await client.from('survey_responses').insert([payload]);
        if (!error) synced++;
      } catch (e) {
        console.warn('Sync record skipped:', e);
      }
    }
    return { success: true, count: synced };
  }

  async fetchSurveyResponses(limit = 100) {
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
      user_id: attempt.userId || null,
      quiz_type: attempt.quizType || 'standard',
      quiz_topic: attempt.topic || 'General Financial Literacy',
      score: attempt.score,
      total_questions: attempt.totalQuestions,
      percentage: Math.round((attempt.score / (attempt.totalQuestions || 1)) * 100),
      completed_at: new Date().toISOString()
    };

    if (this.isConfigured()) {
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
    // Enforce role: Only the platform administrator receives 'admin'; standard visitors receive 'learner'
    const isOwner = cleanEmail === ADMIN_EMAIL;
    const effectiveRole = isOwner ? 'admin' : 'learner';
    
    // 1. If Supabase is connected, attempt Supabase Auth
    if (this.isConfigured()) {
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
        // continue to local registration
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
      id: `usr_local_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      fullName: fullName.trim(),
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
    if (this.isConfigured()) {
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
      // If the administrator is logging in locally for the first time without prior registration,
      // bootstrap the admin account securely with the credentials supplied
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
