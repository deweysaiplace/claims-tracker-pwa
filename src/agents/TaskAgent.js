/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * Task Agent
 * Specialized in intelligent task management
 */

import { BaseAgent } from './BaseAgent';
import { aiService } from '../services/AiService';
import { supabaseService } from '../services/SupabaseService';
import { store } from '../state/Store';

export class TaskAgent extends BaseAgent {
    constructor() {
        super('Task');
    }

    /**
     * Parse dictation into a structured task
     * @param {string} text - The user's field note or command
     */
    async processTaskCommand(text) {
        this.log("Parsing task command...");
        
        const systemPrompt = `You are a Task Agent. 
        Extract any actionable tasks from the following text. 
        Return a JSON object: { "description": "Concise task", "priority": 1-3 }`;

        try {
            const result = await aiService.callGrok(systemPrompt, text);
            const taskData = JSON.parse(result);
            
            // Persist to Supabase
            await supabaseService.addTask(
                store.state.currentClaimId, 
                taskData.description, 
                taskData.priority
            );

            return this.wrapPrompt(`Task added: ${taskData.description}`);
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Get pending tasks for the current claim
     */
    async getActiveTasks() {
        // Implementation logic for fetching and updating store
    }
}

export const taskAgent = new TaskAgent();
