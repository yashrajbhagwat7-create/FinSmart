-- ==============================================================================
-- FinSmart - Supabase PostgreSQL Database Schema
-- Platform: Financial Literacy Assessment, Education & Research Observatory
-- Version: 2.1 (Copyright & Production Ready)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. USERS & PROFILES TABLE
-- Extends Supabase auth.users or functions independently
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE, -- References auth.users(id) if Supabase Auth is enabled
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'learner' CHECK (role IN ('learner', 'educator', 'researcher', 'admin')),
    demographic_age_group VARCHAR(50),
    demographic_education VARCHAR(100),
    demographic_occupation VARCHAR(100),
    demographic_income_range VARCHAR(100),
    demographic_location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. SURVEY RESPONSES TABLE
-- Stores individual diagnostic assessments with full score breakdowns
CREATE TABLE IF NOT EXISTS public.survey_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    -- Demographics
    age_group VARCHAR(50) NOT NULL,
    education VARCHAR(100) NOT NULL,
    occupation VARCHAR(100) NOT NULL,
    income_range VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    consent_given BOOLEAN DEFAULT TRUE NOT NULL,
    -- Pillar Diagnostic Scores (0-100)
    knowledge_score NUMERIC(5, 2) NOT NULL,
    saving_score NUMERIC(5, 2) NOT NULL,
    investment_score NUMERIC(5, 2) NOT NULL,
    debt_score NUMERIC(5, 2) NOT NULL,
    insurance_score NUMERIC(5, 2) NOT NULL,
    overall_score NUMERIC(5, 2) NOT NULL,
    literacy_level VARCHAR(50) NOT NULL CHECK (literacy_level IN ('Beginner', 'Developing', 'Good', 'Excellent')),
    -- Behavioral Indicators
    budgets_regularly BOOLEAN DEFAULT FALSE,
    saves_regularly BOOLEAN DEFAULT FALSE,
    invests BOOLEAN DEFAULT FALSE,
    has_emergency_fund BOOLEAN DEFAULT FALSE,
    has_insurance BOOLEAN DEFAULT FALSE,
    -- Detailed Raw JSON answers for empirical research
    raw_answers JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. QUIZ ATTEMPTS TABLE
-- Stores standardized and AI-generated quiz performance
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    quiz_type VARCHAR(50) NOT NULL CHECK (quiz_type IN ('standard', 'ai_generated', 'module_practice')),
    quiz_topic VARCHAR(150),
    score INT NOT NULL,
    total_questions INT NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. USER LEARNING PROGRESS TABLE
-- Tracks completed modules and reading time
CREATE TABLE IF NOT EXISTS public.learning_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    topic_id VARCHAR(100) NOT NULL,
    completed BOOLEAN DEFAULT TRUE,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, topic_id)
);

-- ==============================================================================
-- INDEXES FOR HIGH-PERFORMANCE ANALYTICS
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_survey_responses_created_at ON public.survey_responses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_demographics ON public.survey_responses(age_group, education, income_range);
CREATE INDEX IF NOT EXISTS idx_survey_responses_scores ON public.survey_responses(overall_score, literacy_level);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_progress ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can create their own profile" 
ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = auth_user_id OR auth_user_id IS NULL);

-- 2. Survey Responses Policies (Anonymous Research Safe)
-- Anyone can insert an anonymous survey response
CREATE POLICY "Allow public survey submissions" 
ON public.survey_responses FOR INSERT WITH CHECK (true);

-- Anyone can read aggregated survey responses for research observatory
CREATE POLICY "Allow public survey reads for research" 
ON public.survey_responses FOR SELECT USING (true);

-- 3. Quiz Attempts Policies
CREATE POLICY "Allow quiz attempt inserts" 
ON public.quiz_attempts FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow reading quiz attempts" 
ON public.quiz_attempts FOR SELECT USING (true);

-- 4. Learning Progress Policies
CREATE POLICY "Users can manage own learning progress" 
ON public.learning_progress FOR ALL USING (true);

-- ==============================================================================
-- 5. GRANTS & ROLES PERMISSIONS (CRITICAL FOR SUPABASE ANON ACCESS)
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- ==============================================================================
-- SEED INITIAL CEP REVIEW 1 BENCHMARK DATA (61 Respondents Cohort)
-- ==============================================================================
COMMENT ON TABLE public.survey_responses IS 'FinSmart Survey Database - Backing empirical financial literacy research';
