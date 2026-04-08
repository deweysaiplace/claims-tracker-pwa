/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * Base Agent Interface
 */

import { store } from '../state/Store';

export class BaseAgent {
    constructor(name) {
        this.name = name;
    }

    /**
     * Wrap prompt with 'Concise Mode' instructions if enabled in settings.
     */
    wrapPrompt(prompt) {
        const { settings } = store.state;
        if (settings.conciseMode) {
            return `${prompt}\n\n[CONCISE MODE ACTIVE]: Provide an accurate, factual summary. Limit your response to 1-3 professional sentences. Focus on the core discrepancy or action.`;
        }
        return prompt;
    }

    /**
     * Common logging / debugging for agent activity.
     */
    log(message, type = 'info') {
        console.log(`[${this.name} Agent] [${type.toUpperCase()}]: ${message}`);
    }

    /**
     * Standard error handler for agents.
     */
    handleError(error) {
        this.log(error.message, 'error');
        // Toast logic will go here
    }
}
