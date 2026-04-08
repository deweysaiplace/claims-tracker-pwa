/**
 * Antigravity Desktop Bridge
 * Listens for and responds to Remote Commands
 */

window.remoteBridge = {
    pairingId: null,
    channel: null,

    init() {
        this.pairingId = localStorage.getItem('AG_PAIRING_ID');
        if (!this.pairingId) {
            this.pairingId = Math.random().toString(36).substring(2, 8).toUpperCase();
            localStorage.setItem('AG_PAIRING_ID', this.pairingId);
        }

        console.log(`[Bridge] Initializing with Pairing ID: ${this.pairingId}`);
        const display = document.getElementById('display-pairing-code');
        if (display) display.textContent = this.pairingId;
        this.connect();
    },

    connect() {
        if (!window.supabaseClient) {
            console.warn("[Bridge] Waiting for Supabase Client...");
            setTimeout(() => this.connect(), 1000);
            return;
        }

        this.channel = window.supabaseClient.channel(`ag-remote-${this.pairingId}`);

        this.channel
            .on('broadcast', { event: 'ag-remote-cmd' }, payload => {
                this.handleRemoteCommand(payload.payload);
            })
            .subscribe(status => {
                if (status === 'SUBSCRIBED') {
                    console.log("[Bridge] Connected and listening for Remote.");
                    this.sendStatus("Desktop Ready for Bridge");
                }
            });
    },

    handleRemoteCommand(cmd) {
        console.log(`[Bridge] Remote Command Received: ${cmd.type}`, cmd.payload);
        
        switch(cmd.type) {
            case 'handshake':
                this.sendStatus("Handshake Verified. System Online.");
                if (app) app.showToast("📱 Remote Connected!", "success");
                break;
            
            case 'voice_command':
                if (app) {
                    app.showToast("🎙️ Remote Voice Command...", "info");
                    // Route to AI Brain
                    if (window.aiBrain) {
                        window.aiBrain.processCommand(cmd.payload);
                    }
                }
                this.sendStatus(`Processing: "${cmd.payload.substring(0, 20)}..."`);
                break;

            case 'log':
                console.log(`[Remote Log] ${cmd.payload}`);
                break;

            case 'trigger_email':
                if (window.waterMit) {
                    this.sendStatus("Opening Email Client for Report...");
                    window.waterMit.emailReport();
                }
                break;

            case 'sensor_update':
                if (cmd.payload.pitch) {
                    console.log(`[Bridge] Remote Pitch reading: ${cmd.payload.pitch}°`);
                    // Logic to auto-fill pitch inputs in UI can go here
                }
                break;
        }
    },

    sendStatus(message) {
        if (!this.channel) return;
        this.channel.send({
            type: 'broadcast',
            event: 'ag-status',
            payload: { message, timestamp: Date.now() }
        });
    }
};

// Initialize after app load
window.addEventListener('load', () => window.remoteBridge.init());
