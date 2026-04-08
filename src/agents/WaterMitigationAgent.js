/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * Water Mitigation Agent
 * Specialized in IICRC S500 logic and dry-out scoping
 */

import { BaseAgent } from './BaseAgent';
import { store } from '../state/Store';
import { aiService } from '../services/AiService';

export class WaterMitigationAgent extends BaseAgent {
    constructor() {
        super('WaterMitigation');
    }

    /**
     * S500 Airmover/Dehu Calculation Logic
     */
    calculateEquipment(data) {
        const { width, length, class: waterClass, percent, height = 8 } = data;
        
        const w = parseFloat(width) || 0;
        const l = parseFloat(length) || 0;
        const c = parseInt(waterClass) || 2;
        const p = (parseFloat(percent) || 100) / 100;

        const sf = w * l;
        const vol = sf * height;
        const lf = (w * 2) + (l * 2);

        // IICRC S500 2021 Airmover SF Method
        const airmovers = Math.ceil((sf * p) / 60);
        
        // Dehu LGR Pints/Day
        let dehuPints = 0;
        switch(c) {
            case 1: dehuPints = vol / 100; break;
            case 2: dehuPints = vol / 40; break;
            case 3: dehuPints = vol / 30; break;
            case 4: dehuPints = vol / 25; break;
        }

        return {
            sf, vol, lf,
            airmovers,
            dehu: Math.ceil(dehuPints)
        };
    }

    /**
     * AI Water Loss Scoping
     */
    async generateScope(notes) {
        this.log("Generating Water Loss Scope...");
        
        const systemPrompt = `You are a Water Mitigation Agent specialist. 
        Analyze the field notes and convert them into a structured draft scope.
        Follow IICRC S500 logic for repairs vs tear-out.`;

        try {
            const scope = await aiService.callGrok(systemPrompt, notes);
            store.setState({ waterMitigationData: scope });
            return scope;
        } catch (error) {
            this.handleError(error);
        }
    }
}

export const waterMitigationAgent = new WaterMitigationAgent();
