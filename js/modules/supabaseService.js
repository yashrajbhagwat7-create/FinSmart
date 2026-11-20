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
      return saved ? JSON.parse(saved) : { url: '', anonKey: '' };
    } catch (e) {
      return { url: '', anonKey: '' };
    }
  }

  saveConfig(url, anonKey) {
    const cleanUrl = (url || '').trim().replace(/\/$/, '');
    const cleanKey = (anonKey || '').trim();
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify({ url: cleanUrl, anonKey: cleanKey }));
    if (cleanUrl && cleanKey) {
      return this.connect(cleanUrl, cleanKey);
    } else {
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
        if (error.message && error.message.includes('relation "public.survey_responses" does not exist')) {
          this.status = 'connected';
          this.lastError = 'Connected to Supabase! Note: Please execute supabase_schema.sql in SQL Editor to create tables.';
          this.notifyListeners();
          return { success: true, warning: this.lastError };
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

  isConfigured() {
    return this.status === 'connected' && this.client !== null;
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
    const record = {
      user_id: responsePayload.user_id || null,
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
      raw_answers: responsePayload.raw_answers || null,
      created_at: new Date().toISOString()
    };

    if (this.isConfigured()) {
      try {
        const { data, error } = await this.client
          .from('survey_responses')
          .insert([record])
          .select();

        if (error) {
          console.warn('Supabase insert warning, falling back to local sync:', error.message);
          return { success: false, error: error.message, isCloud: false };
        }
        return { success: true, data: data?.[0], isCloud: true };
      } catch (err) {
        console.warn('Supabase save error, local fallback active:', err);
        return { success: false, error: err.message, isCloud: false };
      }
    }

    return { success: true, isCloud: false, message: 'Saved to local database repository' };
  }

  async fetchSurveyResponses(limit = 100) {
    if (this.isConfigured()) {
      try {
        const { data, error } = await this.client
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
    return { success: false, isCloud: false };
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
    
    // 1. If Supabase is connected, attempt Supabase Auth
    if (this.isConfigured()) {
      try {
        const { data: authData, error: authError } = await this.client.auth.signUp({
          email: cleanEmail,
          password: password,
          options: {
            data: {
              full_name: fullName,
              role: role,
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
            role: role,
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
          role: role,
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
      role: role,
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
            fullName: userMeta.full_name || cleanEmail.split('@')[0],
            role: userMeta.role || 'learner',
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
          return { success: true, user: userObj, message: 'Logged in successfully via Supabase Cloud!' };
        }
      } catch (err) {
        console.warn('Supabase login error, checking local store:', err.message);
      }
    }

    // 2. Check local accounts
    const users = this.getLocalUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      // Default Demo Accounts for Evaluation
      if (cleanEmail === 'learner@finsmart.edu' && password === 'Learner@123') {
        const demoUser = {
          id: 'demo_learner_01',
          fullName: 'Swayam Bidimani (Student)',
          email: 'learner@finsmart.edu',
          role: 'learner',
          demographics: {
            age_group: '18-24 years',
            education: 'Undergraduate Degree',
            occupation: 'Student',
            income_range: 'Under ₹2,50,000',
            location: 'Maharashtra'
          },
          isCloud: false,
          createdAt: new Date().toISOString()
        };
        this.setSessionUser(demoUser);
        return { success: true, user: demoUser, message: 'Welcome back, Swayam!' };
      }

      if (cleanEmail === 'researcher@finsmart.edu' && password === 'Research@123') {
        const demoAdmin = {
          id: 'demo_researcher_01',
          fullName: 'Prof. Yashraj Bhagvat (Lead Researcher)',
          email: 'researcher@finsmart.edu',
          role: 'researcher',
          demographics: {
            age_group: '25-34 years',
            education: 'Master / Post-Graduate',
            occupation: 'Educator / Faculty',
            income_range: '₹5,00,000 - ₹10,00,000',
            location: 'Maharashtra'
          },
          isCloud: false,
          createdAt: new Date().toISOString()
        };
        this.setSessionUser(demoAdmin);
        return { success: true, user: demoAdmin, message: 'Welcome back, Professor!' };
      }

      return { success: false, error: 'Invalid email or password. Please check your credentials.' };
    }

    const testHash = await this.hashPassword(password, user.salt);
    if (testHash !== user.passwordHash) {
      return { success: false, error: 'Invalid email or password. Please try again.' };
    }

    const userSession = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      demographics: user.demographics,
      isCloud: false,
      createdAt: user.createdAt
    };

    this.setSessionUser(userSession);
    return { success: true, user: userSession, message: `Welcome back, ${user.fullName}!` };
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
