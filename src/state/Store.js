/**
 * THE CLAIMS EXPERIENCE - v2.0.0
 * Central State Store (Reactive Singleton)
 */

class Store {
    constructor() {
        this.state = {
            currentView: 'home',
            currentClaimId: null,
            currentUser: null,
            isOnline: navigator.onLine,
            syncStatus: 'connected',
            
            // Agent Results
            estimateComparison: null,
            waterMitigationData: null,
            activeTasks: [],
            
            // Settings
            settings: {
                darkMode: true,
                stealthMode: false,
                hapticEnabled: false,
                conciseMode: true // USER-REQUESTED
            }
        };

        this.listeners = new Set();
    }

    // Simple observer pattern
    subscribe(callback) {
        this.listeners.add(callback);
        return () => this.listeners.delete(callback);
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.notify();
    }

    notify() {
        this.listeners.forEach(callback => callback(this.state));
    }

    // Persist critical settings
    saveSettings() {
        localStorage.setItem('tce_settings', JSON.stringify(this.state.settings));
    }

    loadSettings() {
        const saved = localStorage.getItem('tce_settings');
        if (saved) {
            this.state.settings = JSON.parse(saved);
        }
    }
}

export const store = new Store();
