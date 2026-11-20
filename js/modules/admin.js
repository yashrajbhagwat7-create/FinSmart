/**
 * FinSmart Protected Admin & Research Data Management Module
 * Provides passcode-protected administrative access, response inspection,
 * RFC-4180 CSV export for researchers, and dataset reset utilities.
 */

import { state } from './state.js';
import { showToast, navigateTo } from './router.js';
import { supabaseService, ADMIN_EMAIL } from './supabaseService.js';
import { openSupabaseConfigModal } from './auth.js';

let isAdminAuthenticated = false;

export function renderAdminDashboard(container) {
  if (!container) return;

  const currentUser = state.currentUser;
  const isOwnerSession = currentUser && currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // If a standard user is signed in, display access restricted message
  if (currentUser && !isOwnerSession) {
    renderAccessDenied(container);
    return;
  }

  // If not authenticated as the owner, render the admin login portal
  if (!isAdminAuthenticated && !isOwnerSession) {
    renderAdminLogin(container);
    return;
  }

  const dataset = state.researchData || [];
  const total = dataset.length;

  const avgOverall = Math.round(dataset.reduce((acc, r) => acc + (r.overall_score || 0), 0) / (total || 1));
  const avgKnowledge = Math.round(dataset.reduce((acc, r) => acc + (r.knowledge_score || 0), 0) / (total || 1));
  const avgSaving = Math.round(dataset.reduce((acc, r) => acc + (r.saving_score || 0), 0) / (total || 1));
  const avgInvesting = Math.round(dataset.reduce((acc, r) => acc + (r.investment_score || 0), 0) / (total || 1));
  const avgDebt = Math.round(dataset.reduce((acc, r) => acc + (r.debt_score || 0), 0) / (total || 1));
  const avgInsurance = Math.round(dataset.reduce((acc, r) => acc + (r.insurance_score || 0), 0) / (total || 1));

  const recentRows = dataset.slice(0, 15);
  const isCloud = supabaseService.isConfigured();
  const dbStatus = supabaseService.getStatus();

  const html = `
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <!-- Admin Top Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-semibold uppercase tracking-wider mb-2">
            <i data-lucide="shield-alert" class="w-3.5 h-3.5"></i> Platform Administrator Panel (${ADMIN_EMAIL})
          </div>
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">Research Data Repository</h1>
          <p class="text-slate-600 text-xs sm:text-sm mt-1">
            Manage respondent datasets, download research CSV exports, and monitor incoming survey submissions.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button id="btn-export-csv" type="button" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md transition">
            <i data-lucide="download" class="w-4 h-4"></i> Export Dataset (CSV)
          </button>
          <button id="btn-reset-data" type="button" class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 text-xs sm:text-sm transition">
            <i data-lucide="refresh-cw" class="w-4 h-4"></i> Re-seed Base Data
          </button>
          <button id="btn-admin-logout" type="button" class="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition">
            <i data-lucide="log-out" class="w-4 h-4"></i> Logout
          </button>
        </div>
      </div>

      <!-- Cloud Database Integration Banner -->
      <div class="p-4 rounded-2xl mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isCloud ? 'bg-emerald-50 border border-emerald-200 text-emerald-950' : 'bg-slate-100 border border-slate-200 text-slate-800'
      }">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl ${isCloud ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'} flex items-center justify-center">
            <i data-lucide="database" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <strong class="text-xs sm:text-sm font-bold">
                ${isCloud ? 'Supabase PostgreSQL Cloud Active' : 'Local Storage Mode (Standby)'}
              </strong>
              <span class="w-2 h-2 rounded-full ${isCloud ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
            </div>
            <p class="text-[11px] text-slate-600">
              ${isCloud ? 'Connected to remote database cluster' : 'Surveys are persisting to browser encrypted storage. Connect Supabase for remote PostgreSQL sync.'}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          ${isCloud ? `
            <button id="btn-sync-local-to-cloud" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition">
              <i data-lucide="cloud-upload" class="w-3.5 h-3.5"></i> Push Local to Cloud
            </button>
            <button id="btn-fetch-cloud" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition">
              <i data-lucide="cloud-download" class="w-3.5 h-3.5"></i> Fetch Cloud Records
            </button>
          ` : ''}
          <button id="btn-admin-db-settings" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition">
            <i data-lucide="settings" class="w-3.5 h-3.5"></i> Database Settings
          </button>
        </div>
      </div>

      <!-- Overview Stats Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <div class="bg-white p-4 rounded-2xl border border-slate-200 text-center">
          <span class="text-[11px] font-semibold text-slate-600 block">Total Records</span>
          <strong class="text-xl font-bold text-slate-900 block mt-1">${total.toLocaleString('en-IN')}</strong>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 text-center">
          <span class="text-[11px] font-semibold text-slate-600 block">Overall Avg</span>
          <strong class="text-xl font-bold text-emerald-700 block mt-1">${avgOverall}%</strong>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 text-center">
          <span class="text-[11px] font-semibold text-slate-600 block">Knowledge</span>
          <strong class="text-xl font-bold text-slate-800 block mt-1">${avgKnowledge}%</strong>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 text-center">
          <span class="text-[11px] font-semibold text-slate-600 block">Saving</span>
          <strong class="text-xl font-bold text-slate-800 block mt-1">${avgSaving}%</strong>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 text-center">
          <span class="text-[11px] font-semibold text-slate-600 block">Investing</span>
          <strong class="text-xl font-bold text-slate-800 block mt-1">${avgInvesting}%</strong>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-slate-200 text-center">
          <span class="text-[11px] font-semibold text-slate-600 block">Insurance</span>
          <strong class="text-xl font-bold text-slate-800 block mt-1">${avgInsurance}%</strong>
        </div>
      </div>

      <!-- Recent Records Table -->
      <div class="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Recent Anonymous Submissions (Preview)</h2>
            <p class="text-xs text-slate-600 mt-0.5">Showing last 15 recorded submissions. Full dataset available via CSV download.</p>
          </div>
          <span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
            Zero PII Stored
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <th class="p-3.5">ID</th>
                <th class="p-3.5">Age Cohort</th>
                <th class="p-3.5">Education</th>
                <th class="p-3.5">Occupation</th>
                <th class="p-3.5">Income Bracket</th>
                <th class="p-3.5">Region</th>
                <th class="p-3.5">Overall</th>
                <th class="p-3.5">Level</th>
                <th class="p-3.5">Date</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${recentRows.map(row => `
                <tr class="hover:bg-slate-50/80 transition">
                  <td class="p-3.5 font-mono text-slate-500">${row.id}</td>
                  <td class="p-3.5 font-medium text-slate-800">${row.age_group}</td>
                  <td class="p-3.5 text-slate-600">${row.education}</td>
                  <td class="p-3.5 text-slate-600">${row.occupation}</td>
                  <td class="p-3.5 text-slate-600">${row.income_range}</td>
                  <td class="p-3.5 text-slate-600">${row.location}</td>
                  <td class="p-3.5 font-bold text-slate-900">${row.overall_score}%</td>
                  <td class="p-3.5">
                    <span class="px-2 py-0.5 rounded-md font-semibold ${
                      row.literacy_level === 'Excellent' ? 'bg-emerald-50 text-emerald-700' :
                      row.literacy_level === 'Good' ? 'bg-teal-50 text-teal-700' :
                      row.literacy_level === 'Developing' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                    }">
                      ${row.literacy_level}
                    </span>
                  </td>
                  <td class="p-3.5 text-slate-500 whitespace-nowrap">${row.created_at || 'Recent'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;
  if (window.lucide) window.lucide.createIcons();

  // Supabase Database Settings
  container.querySelector('#btn-admin-db-settings')?.addEventListener('click', () => {
    openSupabaseConfigModal();
  });

  // Push Local Records to Supabase Cloud
  container.querySelector('#btn-sync-local-to-cloud')?.addEventListener('click', async () => {
    const syncBtn = container.querySelector('#btn-sync-local-to-cloud');
    if (syncBtn) syncBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Syncing...`;
    if (window.lucide) window.lucide.createIcons();

    // Collect all local respondent records
    const localRecords = (state.researchData || []).filter(r => r.id && String(r.id).startsWith('user_'));
    if (state.userProfile) {
      localRecords.unshift({
        age_group: state.userProfile.demographics?.age_group,
        education: state.userProfile.demographics?.education,
        occupation: state.userProfile.demographics?.occupation,
        income_range: state.userProfile.demographics?.income_range,
        location: state.userProfile.demographics?.location,
        knowledge_score: state.userProfile.categoryScores?.knowledge || 0,
        saving_score: state.userProfile.categoryScores?.saving || 0,
        investment_score: state.userProfile.categoryScores?.investing || 0,
        debt_score: state.userProfile.categoryScores?.debt || 0,
        insurance_score: state.userProfile.categoryScores?.insurance || 0,
        overall_score: state.userProfile.overallScore || 0,
        literacy_level: state.userProfile.literacyLevel || 'Developing',
        budgetsRegularly: state.userProfile.categoryScores?.saving >= 50,
        savesRegularly: state.userProfile.categoryScores?.saving >= 50,
        invests: state.userProfile.categoryScores?.investing >= 50,
        hasEmergencyFund: state.userProfile.categoryScores?.saving >= 65,
        hasInsurance: state.userProfile.categoryScores?.insurance >= 60,
        raw_answers: state.userProfile.answers || {}
      });
    }

    if (localRecords.length === 0) {
      renderAdminDashboard(container);
      showToast('No locally recorded survey submissions found to push.', 'info');
      return;
    }

    const res = await supabaseService.syncLocalRecordsToCloud(localRecords);
    renderAdminDashboard(container);
    if (res.success && res.count > 0) {
      showToast(`Pushed ${res.count} survey submissions to Supabase Cloud!`, 'success');
    } else {
      showToast(res.error || 'Sync completed.', 'info');
    }
  });

  // Fetch from Supabase Cloud
  container.querySelector('#btn-fetch-cloud')?.addEventListener('click', async () => {
    const fetchBtn = container.querySelector('#btn-fetch-cloud');
    if (fetchBtn) fetchBtn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Fetching...`;
    if (window.lucide) window.lucide.createIcons();

    const res = await supabaseService.fetchSurveyResponses(50);
    if (res.success && res.data?.length) {
      // Merge unique cloud records
      res.data.forEach(cloudRow => {
        if (!state.researchData.some(r => r.id === cloudRow.id)) {
          state.researchData.unshift(cloudRow);
        }
      });
      state.saveToStorage('finsmart_research_data_v1', state.researchData);
      renderAdminDashboard(container);
      showToast(`Fetched ${res.data.length} records from Supabase PostgreSQL!`, 'success');
    } else {
      renderAdminDashboard(container);
      showToast('No new remote records found in Supabase.', 'info');
    }
  });

  // Attach CSV Export
  container.querySelector('#btn-export-csv')?.addEventListener('click', () => {
    exportDatasetAsCSV(dataset);
  });

  // Attach Re-seed
  container.querySelector('#btn-reset-data')?.addEventListener('click', () => {
    if (confirm('Re-seed survey research dataset back to baseline 1,420 records?')) {
      state.resetResearchData();
      renderAdminDashboard(container);
      showToast('Research dataset successfully re-seeded.', 'success');
    }
  });

  // Logout
  container.querySelector('#btn-admin-logout')?.addEventListener('click', () => {
    isAdminAuthenticated = false;
    supabaseService.logoutUser();
    state.setCurrentUser(null);
    renderAdminDashboard(container);
    showToast('Logged out of Admin Panel.', 'info');
  });
}

function renderAccessDenied(container) {
  const user = state.currentUser;
  container.innerHTML = `
    <div class="max-w-md mx-auto px-4 py-16 text-center">
      <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
        <div class="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <i data-lucide="shield-alert" class="w-7 h-7"></i>
        </div>
        <h1 class="text-2xl font-bold text-slate-900">Access Restricted</h1>
        <p class="text-xs text-slate-600 mt-2 leading-relaxed">
          You are currently signed in as <strong class="text-slate-800">${user?.email || 'a standard user'}</strong>.
        </p>
        <p class="text-xs text-rose-600 font-semibold mt-1.5 p-2 bg-rose-50 rounded-xl border border-rose-200">
          Admin privileges are strictly restricted to the verified platform owner (${ADMIN_EMAIL}).
        </p>

        <div class="mt-6 flex flex-col gap-2.5">
          <button 
            type="button" 
            id="btn-admin-switch-account" 
            class="w-full py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2">
            <i data-lucide="log-in" class="w-4 h-4"></i> Sign In as Administrator
          </button>
          <button 
            type="button" 
            id="btn-admin-return-profile" 
            class="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition">
            Return to My User Profile
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  container.querySelector('#btn-admin-switch-account')?.addEventListener('click', () => {
    supabaseService.logoutUser();
    state.setCurrentUser(null);
    isAdminAuthenticated = false;
    renderAdminLogin(container);
  });

  container.querySelector('#btn-admin-return-profile')?.addEventListener('click', () => {
    navigateTo('profile');
  });
}

function renderAdminLogin(container) {
  container.innerHTML = `
    <div class="max-w-md mx-auto px-4 py-16">
      <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center">
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-4">
          <i data-lucide="shield-check" class="w-6 h-6"></i>
        </div>

        <h1 class="text-2xl font-bold text-slate-900">Administrator Portal</h1>
        <p class="text-xs text-slate-600 mt-1">
          Restricted access. Sign in with the verified platform administrator email & password.
        </p>

        <form id="admin-login-form" class="mt-6 space-y-4 text-left" onsubmit="return false;">
          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Administrator Email</label>
            <input 
              type="email" 
              id="admin-email" 
              value="${ADMIN_EMAIL}" 
              placeholder="${ADMIN_EMAIL}" 
              class="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-medium text-slate-800">
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Administrator Password</label>
            <input 
              type="password" 
              id="admin-password" 
              required
              placeholder="Enter administrator password" 
              class="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500">
          </div>

          <div id="login-error" class="text-rose-600 text-xs hidden font-medium p-2.5 rounded-xl bg-rose-50 border border-rose-200">
          </div>

          <button 
            type="submit" 
            id="btn-admin-submit" 
            class="w-full py-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2">
            <i data-lucide="lock" class="w-4 h-4"></i> Unlock Admin Panel
          </button>
        </form>

        <div class="mt-6 pt-4 border-t border-slate-100 text-center">
          <a href="#home" class="text-xs text-slate-500 hover:text-slate-800 transition">
            ← Return to FinSmart Home
          </a>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();

  const form = container.querySelector('#admin-login-form');
  const emailInput = container.querySelector('#admin-email');
  const passInput = container.querySelector('#admin-password');
  const errEl = container.querySelector('#login-error');
  const submitBtn = container.querySelector('#btn-admin-submit');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (errEl) errEl.classList.add('hidden');
    const email = emailInput?.value.trim().toLowerCase() || '';
    const password = passInput?.value || '';

    if (!email || !password) {
      if (errEl) {
        errEl.textContent = 'Please enter both administrator email and password.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (email !== ADMIN_EMAIL.toLowerCase()) {
      if (errEl) {
        errEl.textContent = `Access Denied: Only the platform administrator (${ADMIN_EMAIL}) has access to this portal.`;
        errEl.classList.remove('hidden');
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Authenticating...`;
      if (window.lucide) window.lucide.createIcons();
    }

    const res = await supabaseService.loginUser(email, password);

    if (res.success && res.user && res.user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      isAdminAuthenticated = true;
      await state.setCurrentUser(res.user);
      renderAdminDashboard(container);
      showToast('Administrator authenticated successfully!', 'success');
    } else {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i data-lucide="lock" class="w-4 h-4"></i> Unlock Admin Panel`;
        if (window.lucide) window.lucide.createIcons();
      }
      if (errEl) {
        errEl.textContent = res.error || 'Authentication failed. Please verify your password.';
        errEl.classList.remove('hidden');
      }
    }
  });
}

/**
 * Downloads full research dataset as a standard CSV file
 */
function exportDatasetAsCSV(data) {
  if (!data || data.length === 0) {
    showToast('No records available to export.', 'error');
    return;
  }

  const headers = [
    'Respondent_ID',
    'Age_Group',
    'Education',
    'Occupation',
    'Income_Range',
    'Location',
    'Overall_Score',
    'Knowledge_Score',
    'Saving_Score',
    'Investment_Score',
    'Debt_Score',
    'Insurance_Score',
    'Literacy_Level',
    'Budgets_Regularly',
    'Invests',
    'Has_Emergency_Fund',
    'Has_Insurance',
    'Submission_Date'
  ];

  const escapeCSV = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = data.map(r => [
    escapeCSV(r.id),
    escapeCSV(r.age_group),
    escapeCSV(r.education),
    escapeCSV(r.occupation),
    escapeCSV(r.income_range),
    escapeCSV(r.location),
    r.overall_score,
    r.knowledge_score,
    r.saving_score,
    r.investment_score,
    r.debt_score,
    r.insurance_score,
    escapeCSV(r.literacy_level),
    r.budgetsRegularly ? 'YES' : 'NO',
    r.invests ? 'YES' : 'NO',
    r.hasEmergencyFund ? 'YES' : 'NO',
    r.hasInsurance ? 'YES' : 'NO',
    escapeCSV(r.created_at || '')
  ].join(','));

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `FinSmart_Survey_Research_Dataset_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Downloaded CSV with ${data.length} anonymous respondent records.`, 'success');
}
