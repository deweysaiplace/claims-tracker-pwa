/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * Voicemail Agent
 * Specialized in audio transcription analysis and prioritization
 */

import { BaseAgent } from './BaseAgent';
import { aiService } from '../services/AiService';
import { supabaseService } from '../services/SupabaseService';

export class VoicemailAgent extends BaseAgent {
    constructor() {
        super('Voicemail');
    }

    /**
     * Analyze a batch of transcribed voicemails
     * @param {Array} voicemails - List of transcriptions
     */
    async generatePriorityReport(voicemails) {
        this.log("Generating Priority Callback Report...");
        
        const systemPrompt = `You are a Voicemail Agent. 
        Review these transcriptions and generate a "Priority Callback Table".
        Identify the most urgent items first.`;

        try {
            const context = voicemails.map(v => v.text).join('\n---\n');
            const report = await aiService.callGrok(systemPrompt, context, false); // No cache for reports
            return report;
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Map a single transcript to a task
     */
    async extractTask(transcript) {
        // Implementation for single VM analysis
    }
}

export const voicemailAgent = new VoicemailAgent();
