/**
 * THE CLAIMS EXPERIENCE - v2.0.0 (Agent Suite)
 * Main Orchestrator & Global Bridge
 */

import './styles/main.css';
import { store } from './state/Store';
import { aiService } from './services/AiService';
import { supabaseService } from './services/SupabaseService';

// Legacy UI Bridge
import { app } from './services/app';
import { waterMit } from './services/water-mit';
import { voiceModule } from './services/voice';

// Modular Agents
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

        // 2. Global Bridge (Crucial for Legacy HTML Compatibility)
        // These ensure all 'onclick="app.someFunction()"' handlers work
        window.app = app;
        window.waterMit = waterMit;
        window.voiceModule = voiceModule;
        window.db = supabaseService;
        window.aiBrain = aiService;
        window.waterLossAgent = waterMitigationAgent;

        window.agents = {
            estimate: estimateAgent,
            waterMit: waterMitigationAgent,
            task: taskAgent,
            voicemail: voicemailAgent,
            xactimate: xactimateAgent,
            playback: playbackAgent
        };

        // 3. Data Persistence Layer
        supabaseService.init(
            import.meta.env.VITE_SUPABASE_URL, 
            import.meta.env.VITE_SUPABASE_ANON_KEY
        );

        // 4. UI & Logic Bootstrap
        app.init();
        waterMit.init();
        voiceModule.init();

        // 5. Agent Optimization
        await xactimateAgent.init(); // Load dictionary

        console.log("✅ The Claims Experience: Ecosystem Stable and Legacy Bridged.");
    } catch (error) {
        console.error("❌ Critical System Failure:", error);
    }
});
