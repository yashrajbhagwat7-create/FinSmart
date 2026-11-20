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
            age_group: row.age_group || '18-24 years',
            education: row.education || 'Undergraduate Degree',
            occupation: row.occupation || 'Student',
            income_range: row.income_range || 'Under ₹2,50,000',
            location: row.location || 'Maharashtra',
            consent: true
          },
          categoryScores: {
            knowledge: Number(row.knowledge_score || 0),
            saving: Number(row.saving_score || 0),
            investing: Number(row.investment_score || 0),
            debt: Number(row.debt_score || 0),
            insurance: Number(row.insurance_score || 0)
          },
          overallScore: Number(row.overall_score || 0),
          literacyLevel: row.literacy_level || 'Developing',
          levelColor: row.overall_score >= 81 ? '#10B981' : row.overall_score >= 61 ? '#0284C7' : row.overall_score >= 41 ? '#F59E0B' : '#EF4444',
          levelDescription: row.overall_score >= 81 ? 
            'Outstanding financial acumen! You possess strong command over core economics, disciplined savings habits, diverse investments, and sound risk mitigation.' :
            row.overall_score >= 61 ? 
            'Solid financial understanding! You maintain good day-to-day money habits and basic investment awareness, with great opportunities to optimize risk and compounding.' :
            row.overall_score >= 41 ?
            'You understand key foundational principles, but certain areas such as long-term investing, debt reduction, or insurance coverage need reinforcement.' :
            'You are at the start of your financial literacy journey. Developing structured budgeting, debt caution, and basic compounding knowledge will unlock major improvements.',
          strengths: [
            Number(row.saving_score) >= 70 ? 'Saving & Emergency Funds' : null,
            Number(row.knowledge_score) >= 70 ? 'Financial Fundamentals' : null,
            Number(row.investment_score) >= 70 ? 'Investment Literacy' : null,
            Number(row.debt_score) >= 70 ? 'Debt Management' : null,
            Number(row.insurance_score) >= 70 ? 'Risk Protection' : null
          ].filter(Boolean),
          weaknesses: [
            Number(row.insurance_score) < 60 ? 'Risk & Insurance Planning' : null,
            Number(row.debt_score) < 60 ? 'Debt & Credit Management' : null,
            Number(row.investment_score) < 60 ? 'Compounding & Investing' : null,
            Number(row.saving_score) < 60 ? 'Emergency Buffer & Savings' : null,
            Number(row.knowledge_score) < 60 ? 'Economic Fundamentals' : null
          ].filter(Boolean),
          recommendations: [
            Number(row.saving_score) < 65 ? 'budgeting' : null,
            Number(row.investment_score) < 65 ? 'investing' : null,
            Number(row.debt_score) < 65 ? 'debt' : null,
            Number(row.insurance_score) < 65 ? 'insurance' : null
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

  setSurveyAnswer(questionId, answerIndex) {
    this.recordAnswer(questionId, answerIndex);
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
    const demographics = profile.demographics || {};
    const ageGroup = (demographics.age_group || '').trim() || '18-24 years';
    const education = (demographics.education || '').trim() || 'Undergraduate Degree';
    const occupation = (demographics.occupation || '').trim() || 'Student';
    const incomeRange = (demographics.income_range || '').trim() || 'Under ₹2,50,000';
    const location = (demographics.location || '').trim() || 'Maharashtra';

    const scores = profile.categoryScores || {};
    const knowledgeScore = Number(scores.knowledge ?? 0);
    const savingScore = Number(scores.saving ?? 0);
    const investmentScore = Number(scores.investing ?? scores.investment ?? 0);
    const debtScore = Number(scores.debt ?? 0);
    const insuranceScore = Number(scores.insurance ?? 0);
    const overallScore = Number(profile.overallScore ?? 0);

    let literacyLevel = profile.literacyLevel || 'Developing';
    if (!['Beginner', 'Developing', 'Good', 'Excellent'].includes(literacyLevel)) {
      if (overallScore >= 81) literacyLevel = 'Excellent';
      else if (overallScore >= 61) literacyLevel = 'Good';
      else if (overallScore >= 41) literacyLevel = 'Developing';
      else literacyLevel = 'Beginner';
    }

    const record = {
      id: `user_${Date.now()}`,
      user_id: this.currentUser?.id || null,
      email: userEmail,
      session_id: userEmail || `guest_${Date.now()}`,
      age_group: ageGroup,
      education: education,
      occupation: occupation,
      income_range: incomeRange,
      location: location,
      knowledge_score: knowledgeScore,
      saving_score: savingScore,
      investment_score: investmentScore,
      debt_score: debtScore,
      insurance_score: insuranceScore,
      overall_score: overallScore,
      literacy_level: literacyLevel,
      budgets_regularly: Boolean(scores.saving >= 50),
      saves_regularly: Boolean(scores.saving >= 50),
      invests: Boolean(scores.investing >= 50),
      has_emergency_fund: Boolean(scores.saving >= 65),
      has_insurance: Boolean(scores.insurance >= 60),
      raw_answers: profile.answers || {},
      created_at: new Date().toISOString()
    };

    // Also add to anonymized research dataset locally
    this.addAnonymizedResearchRecord(record);

    // Sync to Supabase Cloud Database immediately via direct native fetch
    let cloudRes = null;
    try {
      cloudRes = await supabaseService.saveSurveyResponse(record);
      if (cloudRes?.isCloud) {
        console.log('✅ Survey successfully pushed to Supabase PostgreSQL database in real time!');
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
