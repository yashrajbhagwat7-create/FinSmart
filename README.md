# FinSmart — Financial Literacy Survey & Awareness Platform

> **Tagline:** *“Understand your money. Build your future.”*

FinSmart is a modern, responsive, fintech-grade web application built to assess, educate, and empower individuals with practical financial literacy while supporting anonymous empirical research on financial awareness.

---

## 🌟 Key Features & Architecture

### 1. Multi-Step Diagnostic Survey
- **10 Core Diagnostic Questions** organized across 5 foundational financial pillars (2 questions per pillar):
  - **Category A:** Basic Financial Knowledge (Inflation, purchasing power, compound interest mechanics)
  - **Category B:** Saving & Budgeting (Monthly budget discipline, emergency fund sufficiency)
  - **Category C:** Investment Awareness (Mutual funds, SIPs, asset diversification)
  - **Category D:** Credit & Debt (CIBIL credit score factors, credit card minimum due trap)
  - **Category E:** Insurance & Financial Security (Standalone health insurance, pure term life coverage)
- **Diverse Question Types:** Multiple choice, True/False, rating scales, and multi-select.
- **Anonymous Research Demographics & Consent:** Collects non-sensitive research cohorts (Age group, Education level, Occupation, Income range in ₹ INR, State/Region) with mandatory privacy consent. Zero personally identifiable information (no names, phone numbers, bank details, or passwords).
- **Progress Persistence:** Automatic caching to browser `localStorage` with "Save Progress" and "Reset" controls.

### 2. Diagnostic Scoring Engine & Profile
- **0–100 Overall Score** with circular progress gauge meter.
- **5 Pillar Category Scores (0–100%):** Knowledge, Saving, Investing, Debt, and Insurance.
- **4 Performance Tiers:** Beginner (0–40), Developing (41–60), Good (61–80), and Excellent (81–100).
- **Diagnostic Feedback:** Automatically diagnoses top strengths and weakest areas requiring improvement.
- **Customized Curriculum Recommendations:** Dynamically suggests targeted learning guides based on lowest scoring pillars.
- **Print / Save PDF Report:** Clean print styling for generating assessment certificates.

### 3. Financial Education / Learn Hub
- **10 In-Depth Beginner-Friendly Modules:**
  1. 💰 Budgeting & Expense Tracking (50/30/20 rule, cash flow, audit)
  2. 🏦 Smart Saving & Cash Reserves (Sinking funds, liquidity, inflation impact)
  3. 📈 Investment Basics & Asset Classes (Mutual funds, index funds, rupee-cost averaging)
  4. 💳 Credit Cards & Credit Health (750+ CIBIL score, utilization ratio, grace periods)
  5. 🧾 Loans, EMIs & Debt Management (Amortization, reducing balance, prepayments)
  6. 🛡️ Insurance & Risk Protection (Pure term insurance, health insurance, deductibles)
  7. 📊 Tax Planning & Deductions (Old vs New regime, 80C, 80D, ELSS)
  8. 🚨 Building an Emergency Fund (3-6 months essentials, liquid funds)
  9. 📈 The Magic of Compound Interest (Rule of 72, time value of money, formula)
  10. 🎯 Setting & Achieving Financial Goals (SMART goals, time horizons)
- **Interactive Modals:** Each module features a simple explanation, a real-world scenario in Indian Rupees (₹), an essential terms glossary, practical action tips, and a **"Test Your Knowledge"** mini-quiz with instant feedback.

### 4. Interactive Financial Calculators (with Charts in ₹ INR)
1. **Compound Interest / SIP Calculator:** Simulates initial lumpsum + monthly SIP investments, projecting total invested vs wealth gained with an interactive growth curve.
2. **Loan EMI Calculator:** Amortizes loan principal and interest with an interactive donut chart.
3. **50/30/20 Budget Planner:** Visualizes essential needs, discretionary spending, and savings potential with an expense distribution chart.
4. **Savings & Cashflow Forecaster:** Calculates monthly cash surplus and forecasts savings accumulation over 1, 3, 5, and 10 years.
5. **Emergency Fund Target Calculator:** Determines recommended emergency buffer in months and evaluates coverage shortfall or surplus.

### 5. Financial Literacy Quiz
- 10 rapid-fire scenario questions covering compounding, inflation, diversification, credit cards, loans, and emergency reserves.
- One question at a time with instant correct/incorrect visual feedback and educational explanations.
- Final performance summary with direct links to learning resources.

### 6. AI Quiz Generator (Powered by Google Gemini AI)
- **Infinite Real-Time Quiz Generation:** Generates customized scenario-based financial literacy quizzes dynamically using Google Gemini AI.
- **Customizable Dimensions:**
  - **Topic:** Choose from popular financial topics (*Tax Planning & 80C, Mutual Funds & SIPs, Compound Interest, Credit Cards & CIBIL, Stock Market, Insurance, Home Loans, Emergency Funds, FIRE, Crypto*) or type any custom topic.
  - **Difficulty:** Beginner, Intermediate, or Advanced.
  - **Length:** 3, 5, or 10 questions.
  - **Target Persona:** College Students, Salaried Professionals, Freelancers, or Pre-Retirees.
  - **Custom Focus Notes:** Specify exact requirements (e.g. "Focus on Indian tax deductions under Section 80C and 80D").
- **Separate Option for Gemini API Key:**
  - Dedicated API Key Management dialog accessible from the top navbar, mobile menu, and generator page.
  - Supports user-provided Google Gemini API keys (obtained free from [Google AI Studio](https://aistudio.google.com/app/apikey)).
  - Security-first: Stored 100% locally in browser `localStorage`. Never transmitted to third-party servers.
  - Real-time connection testing & validation ping before saving.
  - Model selection dropdown: Gemini 2.5 Flash (default & recommended), Gemini 2.0 Flash, Gemini 1.5 Flash, Gemini 1.5 Pro.
- **Built-in Curated Sample AI Quizzes:** Allows learners to test the interactive AI quiz experience immediately even before inputting an API key.
- **Interactive Quiz Player & Review:** Instant visual feedback, detailed educational explanations generated by Gemini, score percentage, confetti celebrations, and comprehensive question-by-question review breakdowns.

### 7. Survey Insights & Research Observatory
- Aggregated research statistics module pre-populated with **1,420+ realistic anonymous survey responses**.
- Any new survey completed on FinSmart automatically merges into the research dataset in real time!
- **6 Dynamic Chart.js Visualizations:**
  1. Score Distribution (Beginner, Developing, Good, Excellent)
  2. Category Averages (Radar / Pillar bars)
  3. Practical Financial Habits Adoption (% budget, save, invest, emergency fund, insurance)
  4. Financial Literacy by Age Group
  5. Financial Literacy by Education Level
  6. Financial Literacy by Annual Income Range
- **Dynamic Demographic Filters:** Filter by Age Group, Education, Occupation, and Income Range to update all charts and KPI metrics on the fly.

### 7. Protected Admin Portal & CSV Export
- Passcode-protected administrative view (`admin123`, with quick demo fill helper).
- Real-time submission logs (anonymized demographic cohort, category scores, date).
- **RFC-4180 CSV Export:** Download the full anonymous research dataset for statistical analysis in Excel, Python, or R.
- Ability to re-seed or restore baseline research data.

### 8. User Authentication, Profiles & Role-Based Access
- **Secure Onboarding & Authentication:** Sign In (`#login`) and Registration (`#register`) with real-time password complexity strength indicator.
- **Role-Based Access Control (RBAC):** Supports *Learners* (Students & Young Adults), *Salaried Professionals*, and *Educators / Academic Researchers*.
- **Security-First Architecture:** Web Crypto API SHA-256 password hashing with unique salts; zero transmission of sensitive credentials.
- **User Profile Dashboard (`#profile`):** Personalized account management displaying active assessment scores, top strengths, growth focus areas, and database synchronization status.

### 9. Supabase PostgreSQL Cloud Database Integration
- **Cloud Database Ready:** First-class Supabase PostgreSQL integration for survey data collection and persistent analytics.
- **SQL Schema Provided:** Ready-to-run `supabase_schema.sql` defining `profiles`, `survey_responses`, `quiz_attempts`, and `learning_progress` tables with Row Level Security (RLS) policies.
- **Graceful Fallback:** If Supabase credentials are not yet entered, seamlessly functions in high-performance local storage mode; automatically syncs when connected.
- **In-App Database Settings Modal:** Configure Supabase Project URL and Anon API key anytime with real-time connection ping.

### 10. UX, Accessibility & Design
- Clean fintech aesthetic: Dark Navy (`#0B192C`, `#07101C`), White, Emerald Green (`#10B981`), and Amber accents.
- Fully responsive on Desktop, Tablet, and Mobile with collapsible navigation drawer.
- Accessible color contrast, touch-friendly targets, and toast feedback notifications.

---

## 🏛️ Academic Research Origin & Copyright Attribution

FinSmart is developed and registered as part of the **Community Engagement Project (CEP) Review 1** study titled:
*“Assessment of Financial Literacy Among Young Adults Aged 18–22”*

- **Institution:** Department of Computer Engineering, Trinity College of Engineering and Research, Pune (Second Year).
- **Student Investigators & Authors:**
  - **Ayush Singh** (Roll No. A-02)
  - **Yashraj Bhagvat** (Roll No. A-09)
  - **Swayam Bidimani** (Roll No. A-12)
  - **Darshan Chaudhari** (Roll No. A-14)
- **Primary Field Research:** Validated empirical baseline of 61 young adults aged 18–22 in Pune documenting urgent gaps in expense tracking (0% regular), month-end shortages (59%), and family emergency dependency (60.7%).

---

## 🚀 How to Run FinSmart

Because FinSmart is engineered with modern ES6 standards, Tailwind CSS, Lucide Icons, and Chart.js, you can run it immediately without complex build tooling:

### Method 1: Using Python Built-in Web Server (Recommended)
Open PowerShell or Command Prompt in the `finsmart` folder and run:
```bash
python -m http.server 8000
```
Then open your browser to:
```
http://localhost:8000
```

### Method 2: Using Node / npx
```bash
npx serve .
```

### Method 3: Direct Browser Launch
Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari).

---

## 🌐 Live Deployments

- **Live Production Web App (Vercel):** [https://fin-smart-rho.vercel.app](https://fin-smart-rho.vercel.app)
- **GitHub Repository:** [https://github.com/yashrajbhagwat7-create/FinSmart](https://github.com/yashrajbhagwat7-create/FinSmart)

---

## 🚀 Deploy on Vercel

FinSmart is optimized for zero-configuration, instant deployment on Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyashrajbhagwat7-create%2FFinSmart)

### Option A: 1-Click Dashboard Import (Recommended)
1. Go to [vercel.com/new](https://vercel.com/new).
2. Connect your GitHub account and import **`yashrajbhagwat7-create/FinSmart`**.
3. Keep the default settings (Framework preset: `Other`, Root directory: `./`).
4. Click **Deploy**. Your site will be live on an HTTPS `.vercel.app` domain in ~15 seconds.

### Option B: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel
```

---

## 📂 File Hierarchy

```
finsmart/
├── index.html                  # Single-page application shell
├── supabase_schema.sql         # Supabase PostgreSQL schema, tables & RLS policies
├── README.md                   # Documentation, research attribution & quick start
├── css/
│   └── styles.css              # Custom styling, print sheets, and animations
└── js/
    ├── app.js                  # Main orchestrator & lifecycle events
    ├── data/
    │   ├── questions.js        # Diagnostic survey questions across core pillars
    │   ├── learnData.js        # 10 comprehensive educational topics
    │   ├── quizData.js         # 10 interactive quiz questions
    │   └── sampleResearchData.js # Synthetic respondents + Pune CEP cohort (N=61)
    └── modules/
        ├── auth.js             # User login, registration & profile management
        ├── supabaseService.js  # Supabase cloud DB, auth & local fallback
        ├── state.js            # Central state & localStorage manager
        ├── router.js           # Client-side hash routing & static views
        ├── survey.js           # Multi-step survey wizard controller
        ├── scoring.js          # Diagnostic scoring & recommendation engine
        ├── results.js          # Personalized score dashboard & gauge
        ├── learn.js            # Learning hub & topic modal dialogs
        ├── calculators.js      # 5 financial calculators with Chart.js
        ├── quiz.js             # 10-question quiz controller
        ├── aiQuiz.js           # Real-time Gemini AI quiz generator
        ├── apiKeyModal.js      # Google Gemini API key dialog
        ├── geminiService.js    # Gemini API client & schema validator
        ├── insights.js         # Research dashboard with 6 dynamic charts & CEP spotlight
        └── admin.js            # Passcode-protected admin, DB sync & CSV exporter
```

---

*FinSmart — For educational and research purposes only. Does not constitute personal financial advice.*
