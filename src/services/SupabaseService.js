/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * Supabase Service (Data Layer)
 */

import { createClient } from '@supabase/supabase-js';
import { store } from '../state/Store';

export class SupabaseService {
    constructor() {
        this.client = null;
    }

    init(url, key) {
        if (!url || !key) return;
        this.client = createClient(url, key);
        this.setupAuthListener();
    }

    setupAuthListener() {
        this.client.auth.onAuthStateChange((event, session) => {
            store.setState({ currentUser: session?.user || null });
        });
    }

    /**
     * Specialized Query: Get Claims
     */
    async getClaims() {
        if (!this.client) return [];
        const { data, error } = await this.client
            .from('claims')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data;
    }

    /**
     * Specialized Query: Add Task
     */
    async addTask(claimId, description, priority = 1) {
        if (!this.client || !store.state.currentUser) return;
        
        const { error } = await this.client
            .from('tasks')
            .insert([{
                user_id: store.state.currentUser.id,
                claim_id: claimId,
                description,
                priority,
                status: 'pending'
            }]);

        if (error) throw error;
    }
}

export const supabaseService = new SupabaseService();
