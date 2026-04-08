/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * Estimate Agent (The Comparer)
 * Specialized in SFE vs CTRE analysis
 */

import { BaseAgent } from './BaseAgent';
import { store } from '../state/Store';
import { jsPDF } from 'jspdf';

export class EstimateAgent extends BaseAgent {
    constructor() {
        super('Estimate');
        this.results = null;
    }

    /**
     * Core Comparison Logic
     * @param {Object} ctreData - Contractor Estimate Data (text or items)
     * @param {Object} sfeData - State Farm Estimate Data (text or items)
     */
    async compareEstimates(ctreData, sfeData) {
        this.log("Starting High-Fidelity Comparison...");

        const prompt = `Perform a deep scope audit between these two estimates.
        
        CONTRACTOR ESTIMATE (CTRE): ${JSON.stringify(ctreData)}
        STATE FARM ESTIMATE (SFE): ${JSON.stringify(sfeData)}
        
        IDENTIFY:
        1. SCOPE GAPS: Specific items present in CTRE but missing from SFE.
        2. PRICE VARIANCES: Labor or material unit costs that significantly differ.
        3. MATERIAL MISMATCHES: Quality level differences (e.g. Laminate vs Vinyl).
        
        OUTPUT FORMAT: Provide a clear, factual, and professional Markdown breakdown.`;

        try {
            // Using the AI Service (to be refactored next)
            const analysis = await window.aiBrain.processXactimate(this.wrapPrompt(prompt));
            this.results = analysis;
            store.setState({ estimateComparison: analysis });
            return analysis;
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Generate PDF Report (Basic font for claim file inclusion)
     */
    async generatePdfReport() {
        if (!this.results) return;

        const doc = new jsPDF();
        const margin = 10;
        let y = 20;

        doc.setFont("helvetica", "normal"); // Basic font as requested
        doc.setFontSize(16);
        doc.text("Estimate Comparison Report", margin, y);
        y += 10;

        doc.setFontSize(10);
        doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y);
        y += 15;

        // Simple text wrapping for the markdown-like content
        const lines = doc.splitTextToSize(this.results, 180);
        doc.text(lines, margin, y);

        doc.save(`Estimate_Comparison_${Date.now()}.pdf`);
        this.log("PDF Report Generated.");
    }
}

export const estimateAgent = new EstimateAgent();
