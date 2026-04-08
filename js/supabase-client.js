// Supabase configuration
// PASTE YOUR SUPABASE URL AND ANON KEY HERE
const SUPABASE_URL = 'https://hmccsbyhubmgrxfamhfw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_b8AXhrbQDkVdfzz_p1ZiQw_koRnf7kG';

// Initialize Supabase client
window.supabaseClient = null;
try {
    if (window.supabase) {
        window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("Supabase library not found in window object.");
    }
} catch (e) {
    console.error("Supabase initialization failed:", e);
}

// Global DB object
window.db = {
    _getClient() {
        if (!window.supabaseClient) {
            throw new Error("Database client not initialized. Check your network or API key.");
        }
        return window.supabaseClient;
    },

    // -------------------------------------------------------------------------
    // Claims
    // -------------------------------------------------------------------------
    async getActiveClaims(userId) {
        const { data, error } = await this._getClient()
            .from('claims')
            .select('*')
            .eq('user_id', userId)
            .neq('status', 'Closed')
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching claims:', error);
            return [];
        }
        return data;
    },

    async getAllClaims(userId) {
        const { data, error } = await this._getClient()
            .from('claims')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching claims:', error);
            return [];
        }
        return data;
    },

    async addClaim(userId, claimNumber, insuredName, insuredPhone) {
        const { data, error } = await this._getClient()
            .from('claims')
            .insert([{
                user_id: userId,
                claim_number: claimNumber,
                insured_name: insuredName,
                insured_phone: insuredPhone,
                status: 'Open'
            }]);
        if (error) throw error;
        return data;
    },

    // -------------------------------------------------------------------------
    // Tasks
    // -------------------------------------------------------------------------
    async getTasks(userId) {
        const { data, error } = await this._getClient()
            .from('tasks')
            .select(`
                *,
                claims (
                    claim_number
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching tasks:', error);
            return [];
        }
        return data;
    },

    async addTask(userId, description, claimId = null, priority = 'Normal') {
        const { data, error } = await this._getClient()
            .from('tasks')
            .insert([{
                user_id: userId,
                claim_id: claimId,
                description: description,
                priority: priority,
                status: 'Open'
            }]);
        if (error) throw error;
        return data;
    },

    async completeTask(taskId) {
        const { data, error } = await this._getClient()
            .from('tasks')
            .update({ 
                status: 'Completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', taskId);
        if (error) throw error;
        return data;
    },

    async deleteTask(taskId) {
        const { data, error } = await this._getClient()
            .from('tasks')
            .delete()
            .eq('id', taskId);
        if (error) throw error;
        return data;
    },

    // -------------------------------------------------------------------------
    // Voicemails & Summaries
    // -------------------------------------------------------------------------
    async saveVoicemail(userId, transcript, claimId = null) {
        const { data, error } = await this._getClient()
            .from('voicemails')
            .insert([{
                user_id: userId,
                claim_id: claimId,
                transcript: transcript
            }]);
        if (error) throw error;
        return data;
    },

    async saveInspectionSummary(userId, transcript, claimId = null) {
        const { data, error } = await this._getClient()
            .from('inspection_summaries')
            .insert([{
                user_id: userId,
                claim_id: claimId,
                summary_text: transcript
            }]);
        if (error) throw error;
        return data;
    },

    // -------------------------------------------------------------------------
    // Policies (Cross-Device Sync)
    // -------------------------------------------------------------------------
    async savePolicy(userId, policyName, policyText) {
        const { data, error } = await this._getClient()
            .from('policies')
            .insert([{
                user_id: userId,
                policy_name: policyName,
                policy_text: policyText
            }]);
        if (error) throw error;
        return data;
    },

    async getPolicies(userId) {
        const { data, error } = await this._getClient()
            .from('policies')
            .select('id, policy_name, policy_text, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching policies:', error);
            return [];
        }
        return data;
    },

    // -------------------------------------------------------------------------
    // Draft Estimates
    // -------------------------------------------------------------------------
    async saveDraftEstimate(userId, title, codes, claimId = null) {
        const client = this._getClient();
        const { data, error } = await client
            .from('draft_estimates')
            .insert([{
                user_id: userId,
                claim_id: claimId,
                title: title,
                codes: codes
            }]);
        if (error) throw error;
        return data;
    },

    async getDraftEstimates(userId) {
        const client = this._getClient();
        const { data, error } = await client
            .from('draft_estimates')
            .select(`
                *,
                claims (
                    claim_number
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching drafts:', error);
            return [];
        }
        return data;
    },

    async deleteDraftEstimate(id) {
        const client = this._getClient();
        const { data, error } = await client
            .from('draft_estimates')
            .delete()
            .eq('id', id);
        if (error) throw error;
        return data;
    },

    // -------------------------------------------------------------------------
    // Error Logs
    // -------------------------------------------------------------------------
    async logError(userId, message, stack, viewId, appVersion) {
        try {
            if (!window.supabaseClient) return; // Silent fail if no DB
            const { data, error } = await window.supabaseClient
                .from('error_logs')
                .insert([{
                    user_id: userId,
                    message: message,
                    stack: stack,
                    view_id: viewId,
                    app_version: appVersion,
                    user_agent: navigator.userAgent
                }]);
            if (error) console.error("Failed to log error to DB:", error);
            return data;
        } catch (e) {
            console.error("Critical failure in logError:", e);
        }
    }
};
