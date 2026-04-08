/**
 * THE CLAIMS EXPERIENCE - v2.0.0 (Agent Suite)
 * Main Orchestrator
 */

import './styles/main.css';
import { store } from './state/Store';
import { aiService } from './services/AiService';
import { supabaseService } from './services/SupabaseService';

// Agents
import { estimateAgent } from './agents/EstimateAgent';
import { waterMitigationAgent } from './agents/WaterMitigationAgent';
import { taskAgent } from './agents/TaskAgent';
import { voicemailAgent } from './agents/VoicemailAgent';
import { xactimateAgent } from './agents/XactimateAgent';
import { playbackAgent } from './agents/PlaybackAgent';

// Initialize Ecosystem
window.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 The Claims Experience: Agent Suite Initializing...");

    try {
        // 1. Initial State & Settings
        store.loadSettings();

        // 2. Data Persistence Layer
        supabaseService.init(
            import.meta.env.VITE_SUPABASE_URL, 
            import.meta.env.VITE_SUPABASE_ANON_KEY
        );

        // 3. Agent Initialization
        await xactimateAgent.init(); // Load dictionary

        // 4. Global Bridge (Legacy Compatibility)
        // This allows existing HTML event handlers to talk to the new Agent Suite
        window.agents = {
            estimate: estimateAgent,
            waterMit: waterMitigationAgent,
            task: taskAgent,
            voicemail: voicemailAgent,
            xactimate: xactimateAgent,
            playback: playbackAgent
        };

        // Bridge legacy global objects to the agents
        window.waterLossAgent = waterMitigationAgent;
        window.aiBrain = aiService;
        window.db = supabaseService;

        console.log("✅ The Claims Experience: Ecosystem Stable.");
    } catch (error) {
        console.error("❌ Critical System Failure:", error);
    }
});
