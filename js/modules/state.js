/**
 * FinSmart Central State Management
 * Handles persistent storage, in-progress survey cache, user profile, auth session,
 * and empirical research dataset with Supabase Cloud synchronization.
 */

import { generateBaseResearchDataset } from '../data/sampleResearchData.js';
import { supabaseService } from './supabaseService.js';

const STORAGE_KEYS = {
  SURVEY_PROGRESS: 'finsmart_survey_progress_v1',
  USER_PROFILE: 'finsmart_user_profile_v1',
  RESEARCH_DATA: 'finsmart_research_data_v1',
  QUIZ_HISTORY: 'finsmart_quiz_history_v1',
  ADMIN_AUTH: 'finsmart_admin_auth_v1'
};

class StateManager {
  constructor() {
    this.subscribers = [];
    this.init();
  }

  init() {
    // 1. Current Authenticated User (from Supabase or local session)
    this.currentUser = supabaseService.getSessionUser();

    // Clean up any legacy shared storage key to prevent cross-account contamination
    try {
      localStorage.removeItem('finsmart_user_profile_v1');
    } catch (e) {}

    // 2. In-progress survey state (scoped per user)
    const surveyKey = this.getUserSurveyProgressKey(this.currentUser);
    this.surveyProgress = this.loadFromStorage(surveyKey, {
      demographics: {
        age_group: this.currentUser?.demographics?.age_group || '',
        education: this.currentUser?.demographics?.education || '',
        occupation: this.currentUser?.demographics?.occupation || '',
        income_range: this.currentUser?.demographics?.income_range || '',
        location: this.currentUser?.demographics?.location || '',
        consent: false
      },
      currentStep: 0, // 0: Demographics, 1: Cat A, 2: Cat B, 3: Cat C, 4: Cat D, 5: Cat E
      answers: {}
    });

    // 3. User's saved diagnostic profile (scoped per user)
    const profileKey = this.getUserProfileKey(this.currentUser);
    this.userProfile = this.loadFromStorage(profileKey, null);

    // If active session on this device has no local survey profile yet, check Supabase Cloud
    if (this.currentUser?.email && !this.userProfile) {
      this.fetchCloudSurveyForCurrentUser(this.currentUser);
    }

    // 4. Research dataset
    let storedResearch = this.loadFromStorage(STORAGE_KEYS.RESEARCH_DATA, null);
    if (!storedResearch || !Array.isArray(storedResearch) || storedResearch.length === 0) {
      storedResearch = generateBaseResearchDataset(1420);
      this.saveToStorage(STORAGE_KEYS.RESEARCH_DATA, storedResearch);
    }
    this.researchData = storedResearch;

    // 5. Quiz state
    this.quizState = {
      currentIndex: 0,
      userAnswers: {}, // { [questionId]: { selectedIndex, isCorrect } }
      score: 0,
      isCompleted: false
    };

    // 6. Active route
    this.currentRoute = window.location.hash ? window.location.hash.replace('#', '') : 'home';
  }

  loadFromStorage(key, defaultValue) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      console.warn(`Error loading ${key} from localStorage:`, e);
      return defaultValue;
    }
  }

  saveToStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn(`Error saving ${key} to localStorage:`, e);
    }
  }

  getUserProfileKey(user = this.currentUser) {
    if (user && user.email) {
      return `finsmart_user_profile_${user.email.toLowerCase().trim()}`;
    }
    if (user && user.id) {
      return `finsmart_user_profile_${user.id}`;
    }
    return 'finsmart_user_profile_guest';
  }

  getUserSurveyProgressKey(user = this.currentUser) {
    if (user && user.email) {
      return `finsmart_survey_progress_${user.email.toLowerCase().trim()}`;
    }
    return 'finsmart_survey_progress_guest';
  }

  // Auth state management: strictly isolates diagnostic assessment per account
  async setCurrentUser(user) {
    this.currentUser = user;
    if (user) {
      // 1. Load THIS specific user's saved diagnostic profile (isolated from any previous accounts)
      const profileKey = this.getUserProfileKey(user);
      this.userProfile = this.loadFromStorage(profileKey, null);

      // 2. Load THIS user's in-progress survey state
      const surveyKey = this.getUserSurveyProgressKey(user);
      this.surveyProgress = this.loadFromStorage(surveyKey, {
        demographics: {
          age_group: user.demographics?.age_group || '',
          education: user.demographics?.education || '',
          occupation: user.demographics?.occupation || '',
          income_range: user.demographics?.income_range || '',
          location: user.demographics?.location || '',
          consent: false
        },
        currentStep: 0,
        answers: {}
      });

      // 3. Cross-device persistence: If no local profile found for this user, fetch from Supabase Cloud
      if (!this.userProfile && user.email) {
        await this.fetchCloudSurveyForCurrentUser(user);
      }
    } else {
      // User logged out: clear active user profile and reset survey progress
      this.userProfile = null;
      this.clearSurveyProgress();
    }
    this.notify('auth');
    this.notify('profile');
    this.notify('survey');
  }

  async fetchCloudSurveyForCurrentUser(user = this.currentUser) {
    if (!user || !user.email) return;
    try {
      const res = await supabaseService.fetchUserSurveyResponse(user.email);
      if (res.success && res.data) {
        const row = res.data;
        const profile = {
          id: row.id,
          demographics: {
            age_group: row.age_group,
            education: row.education,
            occupation: row.occupation,
            income_range: row.income_range,
            location: row.location,
            consent: true
          },
          categoryScores: {
            knowledge: Number(row.knowledge_score),
            saving: Number(row.saving_score),
            investing: Number(row.investment_score),
            debt: Number(row.debt_score),
            insurance: Number(row.insurance_score)
          },
          overallScore: Number(row.overall_score),
          literacyLevel: row.literacy_level,
          strengths: [
            row.saving_score >= 70 ? 'Saving & Emergency Funds' : null,
            row.knowledge_score >= 70 ? 'Financial Fundamentals' : null,
            row.investment_score >= 70 ? 'Investment Literacy' : null
          ].filter(Boolean),
          weaknesses: [
            row.insurance_score < 60 ? 'Risk & Insurance Planning' : null,
            row.debt_score < 60 ? 'Debt & Credit Management' : null,
            row.investment_score < 60 ? 'Compounding & Investing' : null
          ].filter(Boolean),
          answers: row.raw_answers || {},
          created_at: row.created_at
        };
        const profileKey = this.getUserProfileKey(user);
        this.userProfile = profile;
        this.saveToStorage(profileKey, profile);
        this.notify('profile');
        console.log(`Cloud survey retrieved from Supabase for ${user.email} (Score: ${profile.overallScore}%)`);
      }
    } catch (e) {
      console.warn('Auto cloud survey retrieval skipped:', e);
    }
  }

  // Survey methods
  updateSurveyDemographics(demographics) {
    this.surveyProgress.demographics = { ...this.surveyProgress.demographics, ...demographics };
    this.persistSurveyProgress();
    this.notify('survey');
  }

  setSurveyStep(step) {
    this.surveyProgress.currentStep = step;
    this.persistSurveyProgress();
    this.notify('survey');
  }

  recordAnswer(questionId, answer) {
    this.surveyProgress.answers[questionId] = answer;
    this.persistSurveyProgress();
    this.notify('survey');
  }

  persistSurveyProgress() {
    const surveyKey = this.getUserSurveyProgressKey(this.currentUser);
    this.saveToStorage(surveyKey, this.surveyProgress);
  }

  clearSurveyProgress() {
    this.surveyProgress = {
      demographics: {
        age_group: this.currentUser?.demographics?.age_group || '',
        education: this.currentUser?.demographics?.education || '',
        occupation: this.currentUser?.demographics?.occupation || '',
        income_range: this.currentUser?.demographics?.income_range || '',
        location: this.currentUser?.demographics?.location || '',
        consent: false
      },
      currentStep: 0,
      answers: {}
    };
    try {
      const surveyKey = this.getUserSurveyProgressKey(this.currentUser);
      localStorage.removeItem(surveyKey);
      localStorage.removeItem('finsmart_survey_progress_guest');
      localStorage.removeItem(STORAGE_KEYS.SURVEY_PROGRESS);
    } catch (e) {}
    this.notify('survey');
  }

  // User Profile
  async saveUserProfile(profile) {
    this.userProfile = profile;
    const profileKey = this.getUserProfileKey(this.currentUser);
    this.saveToStorage(profileKey, profile);

    const userEmail = (this.currentUser?.email || '').toLowerCase().trim();
    const record = {
      id: `user_${Date.now()}`,
      user_id: this.currentUser?.id || null,
      email: userEmail,
      session_id: userEmail || null,
      age_group: profile.demographics.age_group || '18-24 years',
      education: profile.demographics.education || 'Undergraduate Degree',
      occupation: profile.demographics.occupation || 'Student',
      income_range: profile.demographics.income_range || 'Under ₹2,50,000',
      location: profile.demographics.location || 'Maharashtra',
      knowledge_score: profile.categoryScores.knowledge,
      saving_score: profile.categoryScores.saving,
      investment_score: profile.categoryScores.investing,
      debt_score: profile.categoryScores.debt,
      insurance_score: profile.categoryScores.insurance,
      overall_score: profile.overallScore,
      literacy_level: profile.literacyLevel,
      budgetsRegularly: profile.categoryScores.saving >= 50,
      savesRegularly: profile.categoryScores.saving >= 50,
      invests: profile.categoryScores.investing >= 50,
      hasEmergencyFund: profile.categoryScores.saving >= 65,
      hasInsurance: profile.categoryScores.insurance >= 60,
      raw_answers: profile.answers || {},
      created_at: new Date().toISOString()
    };

    // Also add to anonymized research dataset locally
    this.addAnonymizedResearchRecord(record);

    // Sync to Supabase Cloud Database immediately
    let cloudRes = null;
    try {
      cloudRes = await supabaseService.saveSurveyResponse(record);
      if (cloudRes?.isCloud) {
        console.log('Survey successfully pushed to Supabase PostgreSQL database in real time!');
      }
    } catch (e) {
      console.warn('Supabase automatic sync skipped:', e);
    }

    this.notify('profile');
    return cloudRes;
  }

  addAnonymizedResearchRecord(record) {
    this.researchData.unshift(record);
    this.saveToStorage(STORAGE_KEYS.RESEARCH_DATA, this.researchData);
    this.notify('research');
  }

  resetResearchData() {
    this.researchData = generateBaseResearchDataset(1420);
    this.saveToStorage(STORAGE_KEYS.RESEARCH_DATA, this.researchData);
    this.notify('research');
  }

  // Subscriber pattern
  subscribe(callback) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback);
    };
  }

  notify(event) {
    for (const cb of this.subscribers) {
      try {
        cb(event, this);
      } catch (e) {
        console.error('Error in state subscriber:', e);
      }
    }
  }
}

export const state = new StateManager();
