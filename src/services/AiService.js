/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * AI Service (Intelligent Backbone)
 * Supports Grok-4 and Gemini-1.5-Pro
 */

import { store } from '../state/Store';

export class AiService {
    constructor() {
        this.apiUrl = 'https://api.x.ai/v1/chat/completions';
        this.geminiApiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
        this.cache = new Map();
    }

    getGrokKey() {
        return localStorage.getItem('GROK_API_KEY');
    }

    getGeminiKey() {
        return localStorage.getItem('GEMINI_API_KEY');
    }

    /**
     * Concise Wrapper: Injects brevity instructions into every call
     */
    applyConciseLogic(systemPrompt) {
        if (store.state.settings.conciseMode) {
            return `${systemPrompt}\n\n[CONCISE MODE]: Be brief. No filler. 1-2 sentences unless a report was requested.`;
        }
        return systemPrompt;
    }

    async callGrok(systemPrompt, userPrompt, useCache = true) {
        const apiKey = this.getGrokKey();
        if (!apiKey) throw new Error("Grok API Key missing");

        const cacheKey = btoa(systemPrompt + userPrompt);
        if (useCache && this.cache.has(cacheKey)) {
            console.log("💎 AI Cache Hit");
            return this.cache.get(cacheKey);
        }

        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'grok-4',
                messages: [
                    { role: 'system', content: this.applyConciseLogic(systemPrompt) },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.2
            })
        });

        if (!response.ok) throw new Error("Grok API connection failed");
        const data = await response.json();
        const result = data.choices[0].message.content.trim();
        
        if (useCache) this.cache.set(cacheKey, result);
        return result;
    }

    async callGemini(parts) {
        const apiKey = this.getGeminiKey();
        if (!apiKey) throw new Error("Gemini API Key missing");

        const response = await fetch(`${this.geminiApiUrl}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts }] })
        });

        if (!response.ok) throw new Error("Gemini API connection failed");
        const data = await response.json();
        return data.candidates[0].content.parts[0].text.trim();
    }

    /**
     * Vision / Receipt / Estimate Scan via Gemini
     */
    async analyzeVision(base64Array, prompt) {
        const parts = [
            { text: this.applyConciseLogic(prompt) },
            ...base64Array.map(b64 => ({
                inline_data: {
                    mime_type: "image/jpeg",
                    data: b64.includes(',') ? b64.split(',')[1] : b64
                }
            }))
        ];
        return this.callGemini(parts);
    }
}

export const aiService = new AiService();
