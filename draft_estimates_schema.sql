-- Draft Estimates Table for v1.8.0
CREATE TABLE IF NOT EXISTS public.draft_estimates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    claim_id UUID REFERENCES public.claims(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    codes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.draft_estimates ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
CREATE POLICY "Users can view their own drafts" ON public.draft_estimates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own drafts" ON public.draft_estimates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own drafts" ON public.draft_estimates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own drafts" ON public.draft_estimates
    FOR DELETE USING (auth.uid() = user_id);
