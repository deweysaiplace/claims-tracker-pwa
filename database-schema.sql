-- SQL Schema for Supabase Setup
-- Copy and run this in your Supabase SQL Editor

-- 1. Create Claims Table
CREATE TABLE public.claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    claim_number TEXT NOT NULL,
    insured_name TEXT,
    insured_phone TEXT,
    status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Pending', 'Waiting', 'Closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Claims
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only view their own claims" ON public.claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own claims" ON public.claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own claims" ON public.claims FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own claims" ON public.claims FOR DELETE USING (auth.uid() = user_id);

-- 2. Create Tasks Table
CREATE TABLE public.tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    claim_id UUID REFERENCES public.claims(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    priority TEXT DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'High')),
    status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'Completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS for Tasks
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only view their own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only update their own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- 3. Create Voicemails Table
CREATE TABLE public.voicemails (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
    transcript TEXT NOT NULL,
    caller_name TEXT,
    callback_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Voicemails
ALTER TABLE public.voicemails ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only view their own voicemails" ON public.voicemails FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own voicemails" ON public.voicemails FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own voicemails" ON public.voicemails FOR DELETE USING (auth.uid() = user_id);

-- 4. Create Inspection Summaries Table
CREATE TABLE public.inspection_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
    summary_text TEXT NOT NULL,
    email_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Inspection Summaries
ALTER TABLE public.inspection_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only view their own summaries" ON public.inspection_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own summaries" ON public.inspection_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own summaries" ON public.inspection_summaries FOR DELETE USING (auth.uid() = user_id);

-- 5. Create Policies Table (Cross-Device Sync)
CREATE TABLE public.policies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    policy_name TEXT NOT NULL,
    policy_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Policies
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only view their own policies" ON public.policies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only insert their own policies" ON public.policies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can only delete their own policies" ON public.policies FOR DELETE USING (auth.uid() = user_id);
