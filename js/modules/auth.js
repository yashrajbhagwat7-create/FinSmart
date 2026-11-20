/**
 * FinSmart Secure User Authentication & Profile Management Module
 * Implements:
 * - Learner & Researcher Onboarding & Sign In (Supabase Cloud + Secure Local Cryptography)
 * - Password complexity validation & dynamic strength meter
 * - Role-Based Access Control (Learner, Educator/Researcher, Admin)
 * - User Profile Dashboard & Assessment History
 * - Database configuration modal for Supabase Cloud integration
 */

import { state } from './state.js';
import { supabaseService } from './supabaseService.js';
import { showToast, navigateTo } from './router.js';
import { AGE_GROUPS, EDUCATION_LEVELS, OCCUPATIONS, INCOME_RANGES, STATES_REGIONS } from '../data/sampleResearchData.js';

// ==============================================================
// 1. LOGIN PAGE VIEW
// ==============================================================
export function renderLoginPage(container) {
  if (!container) return;

  const currentUser = state.currentUser;
  if (currentUser) {
    navigateTo('profile');
    return;
  }

  const isCloudActive = supabaseService.isConfigured();

  container.innerHTML = `
    <div class="max-w-md mx-auto px-4 py-12 sm:py-16">
      <!-- Brand Card -->
      <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 relative overflow-hidden">
        
        <!-- Header Glow Accent -->
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4">
          <i data-lucide="shield-check" class="w-6 h-6"></i>
        </div>

        <div class="text-center mb-6">
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Welcome to FinSmart</h1>
          <p class="text-xs sm:text-sm text-slate-600 mt-1">
            Sign in to access your financial literacy score, progress history, and research diagnostics.
          </p>
          <div class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
            isCloudActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
          }">
            <span class="w-1.5 h-1.5 rounded-full ${isCloudActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}"></span>
            ${isCloudActive ? 'Connected to Supabase Cloud' : 'Local Encryption Mode'}
          </div>
        </div>

        <!-- Login Form -->
        <form id="auth-login-form" class="space-y-4" onsubmit="return false;">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <i data-lucide="mail" class="w-4 h-4"></i>
              </span>
              <input 
                type="email" 
                id="login-email" 
                required
                placeholder="name@university.edu" 
                class="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition">
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="block text-xs font-semibold text-slate-700">Password</label>
            </div>
            <div class="relative">
              <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <i data-lucide="lock" class="w-4 h-4"></i>
              </span>
              <input 
                type="password" 
                id="login-password" 
                required
                placeholder="••••••••••••" 
                class="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition">
              <button 
                type="button" 
                id="toggle-login-pass" 
                class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none">
                <i data-lucide="eye" class="w-4 h-4"></i>
              </button>
            </div>
          </div>

          <div id="login-error-msg" class="hidden text-rose-600 text-xs font-medium p-2.5 rounded-lg bg-rose-50 border border-rose-200">
          </div>

          <button 
            type="submit" 
            id="btn-login-submit" 
            class="w-full py-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold text-sm shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
            <span>Sign In to Account</span>
            <i data-lucide="arrow-right" class="w-4 h-4"></i>
          </button>
        </form>

        <!-- Demo Accounts Evaluation Helper -->
        <div class="mt-6 pt-5 border-t border-slate-100">
          <div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-center mb-2.5">
            Quick Demo Sign-In (Evaluation)
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button 
              type="button" 
              id="btn-fill-learner" 
              class="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/70 text-emerald-800 text-[11px] font-semibold transition text-center truncate">
              🎓 Learner Demo
            </button>
            <button 
              type="button" 
              id="btn-fill-researcher" 
              class="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold transition text-center truncate">
              🔬 Researcher Demo
            </button>
          </div>
        </div>

        <!-- Registration Link -->
        <div class="mt-6 text-center text-xs text-slate-600">
          Don't have an account yet? 
          <a href="#register" class="text-emerald-700 hover:text-emerald-800 font-bold underline ml-1">
            Create an Account
          </a>
        </div>

        <div class="mt-3 text-center">
          <a href="#survey" class="text-[11px] text-slate-500 hover:text-slate-700 underline">
            Continue as Guest / Anonymous Survey
          </a>
        </div>

      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const form = container.querySelector('#auth-login-form');
  const emailInput = container.querySelector('#login-email');
  const passInput = container.querySelector('#login-password');
  const togglePassBtn = container.querySelector('#toggle-login-pass');
  const errorBox = container.querySelector('#login-error-msg');
  const submitBtn = container.querySelector('#btn-login-submit');

  // Toggle show/hide password
  togglePassBtn?.addEventListener('click', () => {
    const isPass = passInput.getAttribute('type') === 'password';
    passInput.setAttribute('type', isPass ? 'text' : 'password');
    togglePassBtn.innerHTML = `<i data-lucide="${isPass ? 'eye-off' : 'eye'}" class="w-4 h-4"></i>`;
    if (window.lucide) window.lucide.createIcons();
  });

  // Demo helpers
  container.querySelector('#btn-fill-learner')?.addEventListener('click', () => {
    emailInput.value = 'learner@finsmart.edu';
    passInput.value = 'Learner@123';
    errorBox.classList.add('hidden');
  });

  container.querySelector('#btn-fill-researcher')?.addEventListener('click', () => {
    emailInput.value = 'researcher@finsmart.edu';
    passInput.value = 'Research@123';
    errorBox.classList.add('hidden');
  });

  // Handle Submit
  form?.addEventListener('submit', async () => {
    const email = emailInput.value.trim();
    const pass = passInput.value;

    if (!email || !pass) {
      errorBox.textContent = 'Please enter both your email address and password.';
      errorBox.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> <span>Verifying...</span>`;
    if (window.lucide) window.lucide.createIcons();

    const res = await supabaseService.loginUser(email, pass);

    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Sign In to Account</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
    if (window.lucide) window.lucide.createIcons();

    if (res.success) {
      state.setCurrentUser(res.user);
      showToast(res.message, 'success');
      navigateTo('profile');
    } else {
      errorBox.textContent = res.error || 'Login failed. Please check your credentials.';
      errorBox.classList.remove('hidden');
    }
  });
}

// ==============================================================
// 2. REGISTRATION PAGE VIEW (ONBOARDING)
// ==============================================================
export function renderRegisterPage(container) {
  if (!container) return;

  container.innerHTML = `
    <div class="max-w-xl mx-auto px-4 py-12 sm:py-16">
      <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
        
        <div class="text-center mb-6">
          <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
            <i data-lucide="user-plus" class="w-6 h-6"></i>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Create FinSmart Account</h1>
          <p class="text-xs sm:text-sm text-slate-600 mt-1">
            Join FinSmart's financial capability community. Your data is encrypted and protected.
          </p>
        </div>

        <form id="auth-register-form" class="space-y-4" onsubmit="return false;">
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input 
                type="text" 
                id="reg-name" 
                required
                placeholder="e.g. Yashraj Bhagvat" 
                class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500">
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 mb-1">Account Role</label>
              <select id="reg-role" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white">
                <option value="learner">Student / Young Adult (18-24)</option>
                <option value="learner">Salaried Professional</option>
                <option value="educator">Educator / Faculty</option>
                <option value="researcher">Academic Researcher</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input 
              type="email" 
              id="reg-email" 
              required
              placeholder="you@domain.com" 
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500">
          </div>

          <!-- Password with Strength Meter -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              id="reg-password" 
              required
              placeholder="Minimum 8 characters" 
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500">
            
            <!-- Real-time Password Strength Meter -->
            <div class="mt-2">
              <div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                <span>Password Strength: <strong id="strength-label">Too short</strong></span>
                <span id="strength-reqs">Min 8 chars, 1 number & 1 upper</span>
              </div>
              <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div id="strength-bar" class="bg-rose-500 h-1.5 rounded-full transition-all duration-300" style="width: 15%"></div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
            <input 
              type="password" 
              id="reg-confirm-password" 
              required
              placeholder="Repeat password" 
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500">
          </div>

          <!-- Demographics for Research Alignment -->
          <div class="pt-3 border-t border-slate-100">
            <span class="text-xs font-bold text-slate-800 block mb-2">Research Profile Information (Optional)</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Age Bracket</label>
                <select id="reg-age" class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white">
                  ${AGE_GROUPS.map(g => `<option value="${g}">${g}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">Education</label>
                <select id="reg-edu" class="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white">
                  ${EDUCATION_LEVELS.map(e => `<option value="${e}">${e}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- Consent -->
          <div class="flex items-start gap-2 pt-2">
            <input type="checkbox" id="reg-consent" required class="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500">
            <label for="reg-consent" class="text-xs text-slate-600 leading-normal">
              I agree to the <a href="#privacy" class="text-emerald-700 underline font-medium">Privacy & Research Ethics Terms</a>. My financial literacy scores may be anonymously aggregated for educational research.
            </label>
          </div>

          <div id="reg-error-msg" class="hidden text-rose-600 text-xs font-medium p-2.5 rounded-lg bg-rose-50 border border-rose-200">
          </div>

          <button 
            type="submit" 
            id="btn-reg-submit" 
            class="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
            <span>Complete Registration</span>
            <i data-lucide="check" class="w-4 h-4"></i>
          </button>
        </form>

        <div class="mt-6 text-center text-xs text-slate-600">
          Already have an account? 
          <a href="#login" class="text-emerald-700 hover:text-emerald-800 font-bold underline ml-1">
            Sign In Here
          </a>
        </div>

      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const nameInput = container.querySelector('#reg-name');
  const emailInput = container.querySelector('#reg-email');
  const roleSelect = container.querySelector('#reg-role');
  const passInput = container.querySelector('#reg-password');
  const confirmPassInput = container.querySelector('#reg-confirm-password');
  const strengthBar = container.querySelector('#strength-bar');
  const strengthLabel = container.querySelector('#strength-label');
  const errorBox = container.querySelector('#reg-error-msg');
  const consentBox = container.querySelector('#reg-consent');
  const form = container.querySelector('#auth-register-form');

  // Real-time password evaluation
  passInput.addEventListener('input', () => {
    const val = passInput.value;
    let score = 0;
    if (val.length >= 8) score += 25;
    if (/[A-Z]/.test(val)) score += 25;
    if (/[0-9]/.test(val)) score += 25;
    if (/[^A-Za-z0-9]/.test(val)) score += 25;

    strengthBar.style.width = `${Math.max(15, score)}%`;
    if (score < 50) {
      strengthBar.className = 'bg-rose-500 h-1.5 rounded-full transition-all duration-300';
      strengthLabel.textContent = 'Weak';
      strengthLabel.className = 'text-rose-600 font-bold';
    } else if (score < 100) {
      strengthBar.className = 'bg-amber-500 h-1.5 rounded-full transition-all duration-300';
      strengthLabel.textContent = 'Moderate';
      strengthLabel.className = 'text-amber-600 font-bold';
    } else {
      strengthBar.className = 'bg-emerald-500 h-1.5 rounded-full transition-all duration-300';
      strengthLabel.textContent = 'Strong';
      strengthLabel.className = 'text-emerald-600 font-bold';
    }
  });

  form.addEventListener('submit', async () => {
    errorBox.classList.add('hidden');

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passInput.value;
    const confirm = confirmPassInput.value;
    const role = roleSelect.value;

    if (!name || !email || !password) {
      errorBox.textContent = 'Please fill all required fields.';
      errorBox.classList.remove('hidden');
      return;
    }

    if (password.length < 8) {
      errorBox.textContent = 'Password must be at least 8 characters long.';
      errorBox.classList.remove('hidden');
      return;
    }

    if (password !== confirm) {
      errorBox.textContent = 'Passwords do not match. Please re-enter.';
      errorBox.classList.remove('hidden');
      return;
    }

    if (!consentBox.checked) {
      errorBox.textContent = 'You must agree to the research consent terms.';
      errorBox.classList.remove('hidden');
      return;
    }

    const demographics = {
      age_group: container.querySelector('#reg-age')?.value || '18-24 years',
      education: container.querySelector('#reg-edu')?.value || 'Undergraduate Degree',
      occupation: role === 'learner' ? 'Student' : 'Salaried Professional',
      income_range: 'Under ₹2,50,000',
      location: 'Maharashtra'
    };

    const res = await supabaseService.registerUser({
      fullName: name,
      email: email,
      password: password,
      role: role,
      demographics: demographics
    });

    if (res.success) {
      state.setCurrentUser(res.user);
      showToast(res.message, 'success');
      navigateTo('profile');
    } else {
      errorBox.textContent = res.error || 'Registration failed.';
      errorBox.classList.remove('hidden');
    }
  });
}

// ==============================================================
// 3. USER PROFILE DASHBOARD
// ==============================================================
export function renderProfilePage(container) {
  if (!container) return;

  const user = state.currentUser;
  if (!user) {
    navigateTo('login');
    return;
  }

  const profile = state.userProfile;
  const isCloud = supabaseService.isConfigured();
  const dbStatus = supabaseService.getStatus();

  const initial = (user.fullName || user.email || 'U')[0].toUpperCase();

  container.innerHTML = `
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      
      <!-- Top Account Hero Banner -->
      <div class="bg-navy-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl mb-8 relative overflow-hidden">
        <div class="absolute -right-10 -bottom-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-2xl"></div>

        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-navy-950 font-black text-2xl flex items-center justify-center shadow-lg">
              ${initial}
            </div>
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h1 class="text-2xl font-bold tracking-tight text-white">${user.fullName}</h1>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  user.role === 'researcher' || user.role === 'admin' ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                }">
                  ${user.role}
                </span>
              </div>
              <p class="text-slate-300 text-xs sm:text-sm">${user.email}</p>
              <div class="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                <span>Account ID: #${user.id.substring(0, 10)}</span>
                <span>•</span>
                <span>Active Session</span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2.5">
            <button 
              id="btn-open-db-config" 
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-800 hover:bg-navy-700 text-slate-200 text-xs font-semibold border border-navy-700 transition">
              <i data-lucide="database" class="w-3.5 h-3.5 text-emerald-400"></i>
              <span>Database Settings</span>
            </button>
            <button 
              id="btn-profile-logout" 
              class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-navy-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-300 text-xs font-semibold border border-navy-700 transition">
              <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Grid: Diagnostic Status & Database Details -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        <!-- Diagnostic Score Card -->
        <div class="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i data-lucide="award" class="w-5 h-5 text-emerald-600"></i>
              <span>Financial Literacy Diagnostic Profile</span>
            </h2>
            ${profile && profile.overallScore ? `
              <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
                profile.literacyLevel === 'Excellent' ? 'bg-emerald-100 text-emerald-800' :
                profile.literacyLevel === 'Good' ? 'bg-teal-100 text-teal-800' :
                profile.literacyLevel === 'Developing' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
              }">
                Tier: ${profile.literacyLevel}
              </span>
            ` : ''}
          </div>

          ${profile && profile.overallScore ? `
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 mb-6">
              <div class="text-center sm:text-left">
                <span class="text-[11px] font-semibold text-slate-500 block uppercase">Overall Score</span>
                <strong class="text-3xl font-black text-emerald-700 block mt-1">${profile.overallScore} / 100</strong>
              </div>
              <div class="text-center sm:text-left">
                <span class="text-[11px] font-semibold text-slate-500 block uppercase">Top Strength</span>
                <span class="text-xs font-bold text-slate-800 block mt-1.5">${profile.strengths?.[0] || 'Budgeting'}</span>
              </div>
              <div class="text-center sm:text-left">
                <span class="text-[11px] font-semibold text-slate-500 block uppercase">Growth Focus</span>
                <span class="text-xs font-bold text-slate-800 block mt-1.5">${profile.weaknesses?.[0] || 'Investing'}</span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <a href="#results" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-sm transition">
                <i data-lucide="gauge" class="w-4 h-4"></i> View Full Radar & Breakdown
              </a>
              <a href="#survey" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs sm:text-sm transition">
                <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Retake Assessment
              </a>
            </div>
          ` : `
            <div class="py-8 text-center">
              <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <i data-lucide="clipboard-list" class="w-6 h-6"></i>
              </div>
              <h3 class="text-base font-bold text-slate-800">No Assessment Recorded Yet</h3>
              <p class="text-xs text-slate-600 max-w-sm mx-auto mt-1 mb-5">
                Take the 5-minute diagnostic survey to establish your financial competency baseline.
              </p>
              <a href="#survey" class="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition">
                <i data-lucide="sparkles" class="w-4 h-4"></i> Start Survey Now
              </a>
            </div>
          `}
        </div>

        <!-- Database & Sync Status Card -->
        <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                <i data-lucide="database" class="w-4 h-4 text-emerald-600"></i>
                <span>Database Sync</span>
              </h3>
              <span class="w-2.5 h-2.5 rounded-full ${isCloud ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}"></span>
            </div>

            <div class="space-y-3 text-xs text-slate-600">
              <div class="p-3 rounded-xl ${isCloud ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-slate-50 border border-slate-200'}">
                <div class="font-bold text-[11px] uppercase tracking-wide mb-1">Current Backend</div>
                <div class="font-semibold">${isCloud ? 'Supabase PostgreSQL Cloud' : 'Browser Encrypted Local Store'}</div>
                <div class="text-[10px] text-slate-500 mt-1">
                  ${isCloud ? dbStatus.url : 'Responses cached in localStorage with WebCrypto SHA-256'}
                </div>
              </div>

              <p class="text-[11px] leading-relaxed">
                Connect your Supabase project credentials anytime to store your surveys directly in the cloud PostgreSQL database.
              </p>
            </div>
          </div>

          <button 
            id="btn-card-db-settings" 
            class="mt-6 w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5">
            <i data-lucide="settings" class="w-3.5 h-3.5"></i>
            <span>Configure Supabase Project</span>
          </button>
        </div>

      </div>

      <!-- Quick Platform Actions -->
      <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
        <h3 class="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider text-slate-500 text-xs">Recommended Actions</h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <a href="#ai-quiz" class="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition group">
            <i data-lucide="sparkles" class="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform"></i>
            <strong class="text-xs sm:text-sm font-bold text-slate-900 block">AI Quiz Generator</strong>
            <p class="text-[11px] text-slate-600 mt-1">Test your knowledge with dynamic scenarios powered by Gemini AI.</p>
          </a>
          <a href="#learn" class="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition group">
            <i data-lucide="book-open" class="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform"></i>
            <strong class="text-xs sm:text-sm font-bold text-slate-900 block">Learning Hub</strong>
            <p class="text-[11px] text-slate-600 mt-1">Master 10 structured beginner modules from Budgeting to Taxes.</p>
          </a>
          <a href="#calculators" class="p-4 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 transition group">
            <i data-lucide="calculator" class="w-6 h-6 text-emerald-600 mb-2 group-hover:scale-110 transition-transform"></i>
            <strong class="text-xs sm:text-sm font-bold text-slate-900 block">Financial Calculators</strong>
            <p class="text-[11px] text-slate-600 mt-1">Simulate SIP compounding, Loan EMI amortization, and 50/30/20 budgets.</p>
          </a>
        </div>
      </div>

    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  // Attach handlers
  container.querySelector('#btn-profile-logout')?.addEventListener('click', () => {
    supabaseService.logoutUser();
    state.setCurrentUser(null);
    showToast('Signed out successfully.', 'info');
    navigateTo('home');
  });

  const openDbModal = () => openSupabaseConfigModal();
  container.querySelector('#btn-open-db-config')?.addEventListener('click', openDbModal);
  container.querySelector('#btn-card-db-settings')?.addEventListener('click', openDbModal);
}

// ==============================================================
// 4. SUPABASE DATABASE CONFIGURATION MODAL
// ==============================================================
export function openSupabaseConfigModal() {
  let modal = document.getElementById('supabase-config-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'supabase-config-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/70 backdrop-blur-xs animate-fade-in';
    document.body.appendChild(modal);
  }

  const currentConfig = supabaseService.getConfig();
  const dbStatus = supabaseService.getStatus();

  modal.innerHTML = `
    <div class="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative overflow-hidden">
      
      <div class="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <i data-lucide="database" class="w-5 h-5"></i>
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-900">Supabase Database Settings</h2>
            <p class="text-[11px] text-slate-500">PostgreSQL Cloud Persistence for Survey Data</p>
          </div>
        </div>

        <button id="btn-close-db-modal" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Supabase Project URL</label>
          <input 
            type="text" 
            id="cfg-supabase-url" 
            value="${currentConfig.url || ''}"
            placeholder="https://xyzcompany.supabase.co" 
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500">
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Supabase Anon Public API Key</label>
          <input 
            type="password" 
            id="cfg-supabase-key" 
            value="${currentConfig.anonKey || ''}"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." 
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500">
        </div>

        <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
          <strong class="text-slate-800 block text-[11px] uppercase tracking-wide">Ready-to-Run SQL Schema</strong>
          <p class="text-slate-600 text-[11px] leading-relaxed">
            Execute the included <code class="bg-white px-1.5 py-0.5 rounded border border-slate-300 text-emerald-800 font-mono">supabase_schema.sql</code> file in your Supabase SQL Editor to initialize the database tables, indexes, and Row Level Security policies.
          </p>
        </div>

        <div id="db-test-result" class="text-xs p-2.5 rounded-xl ${
          dbStatus.status === 'connected' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'hidden'
        }">
          ${dbStatus.status === 'connected' ? '✓ Currently connected to Supabase Cloud' : ''}
        </div>

        <div class="flex items-center gap-3 pt-2">
          <button 
            type="button" 
            id="btn-save-db-config" 
            class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5">
            <i data-lucide="check" class="w-4 h-4"></i>
            <span>Save & Connect</span>
          </button>
          <button 
            type="button" 
            id="btn-clear-db-config" 
            class="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-600 font-semibold text-xs transition">
            Use Local DB
          </button>
        </div>
      </div>

    </div>
  `;

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();

  const closeBtn = modal.querySelector('#btn-close-db-modal');
  const saveBtn = modal.querySelector('#btn-save-db-config');
  const clearBtn = modal.querySelector('#btn-clear-db-config');
  const urlInput = modal.querySelector('#cfg-supabase-url');
  const keyInput = modal.querySelector('#cfg-supabase-key');
  const resultBox = modal.querySelector('#db-test-result');

  const closeModal = () => modal.classList.add('hidden');
  closeBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  clearBtn?.addEventListener('click', async () => {
    urlInput.value = '';
    keyInput.value = '';
    await supabaseService.saveConfig('', '');
    showToast('Switched to local database storage.', 'info');
    closeModal();
    const appMain = document.getElementById('app-main');
    if (state.currentRoute === 'profile') renderProfilePage(appMain);
  });

  saveBtn?.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const key = keyInput.value.trim();

    if (!url || !key) {
      resultBox.className = 'text-xs p-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 block';
      resultBox.textContent = 'Please enter both Supabase Project URL and Anon API Key.';
      return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Connecting...`;
    if (window.lucide) window.lucide.createIcons();

    const res = await supabaseService.saveConfig(url, key);

    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i> Save & Connect`;
    if (window.lucide) window.lucide.createIcons();

    if (res.success) {
      resultBox.className = 'text-xs p-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 block';
      resultBox.textContent = '✓ ' + (res.message || 'Connected successfully!');
      showToast('Supabase PostgreSQL connected!', 'success');
      setTimeout(() => {
        closeModal();
        const appMain = document.getElementById('app-main');
        if (state.currentRoute === 'profile') renderProfilePage(appMain);
      }, 1000);
    } else {
      resultBox.className = 'text-xs p-2.5 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 block';
      resultBox.textContent = 'Connection Error: ' + res.error;
    }
  });
}
