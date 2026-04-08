/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * Playback Agent
 * Specialized in auditory feedback and brief status summaries
 */

import { BaseAgent } from './BaseAgent';
import { store } from '../state/Store';

export class PlaybackAgent extends BaseAgent {
    constructor() {
        super('Playback');
        this.synth = window.speechSynthesis;
    }

    /**
     * Speak a concise summary of an agent's finding.
     * @param {string} text - The raw text result from an agent.
     */
    async speakResult(text) {
        if (!this.synth) return;

        // Cancel previous speech
        this.synth.cancel();

        // If concise mode is on, we've already wrapped the prompt, 
        // but we can also truncate the spoken output if needed.
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        
        this.log(`Speaking result: ${text.substring(0, 30)}...`);
        this.synth.speak(utterance);
    }

    /**
     * Short confirmation tones or phrases
     */
    confirmAction(actionName) {
        this.speakResult(`${actionName} complete.`);
    }
}

export const playbackAgent = new PlaybackAgent();
