/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * Xactimate Agent
 * Specialized in line-item lookups and code matching
 */

import { BaseAgent } from './BaseAgent';
import { aiService } from '../services/AiService';
import Fuse from 'fuse.js';

export class XactimateAgent extends BaseAgent {
    constructor() {
        super('Xactimate');
        this.dictionary = [];
        this.fuse = null;
    }

    /**
     * Load the local Xactimate dictionary
     */
    async init() {
        try {
            const res = await fetch('/xactimate_codes.json');
            this.dictionary = await res.json();
            
            this.fuse = new Fuse(this.dictionary, {
                keys: ['code', 'description', 'category'],
                threshold: 0.3
            });
            this.log(`Dictionary Loaded: ${this.dictionary.length} codes ready.`);
        } catch (error) {
            this.handleError(new Error("Failed to load Xactimate dictionary."));
        }
    }

    /**
     * Fuzzy search for a code or description
     */
    search(query) {
        if (!this.fuse) return [];
        return this.fuse.search(query).slice(0, 10).map(r => r.item);
    }

    /**
     * AI-Driven Code Suggestion
     */
    async suggestCodes(dictation) {
        this.log("Suggesting codes for dictation...");
        
        const systemPrompt = `You are an expert Xactimate estimator. 
        Analyze the dictation and extract the likely Xactimate category/code.
        Return a clean bulleted list.`;

        try {
            return await aiService.callGrok(systemPrompt, dictation);
        } catch (error) {
            this.handleError(error);
        }
    }
}

export const xactimateAgent = new XactimateAgent();
