window.auth = {
    currentUser: null,

    init() {
        this.bindEvents();
        
        // AUTO-LOGIN BYPASS: Try to log in silently, but don't block the user
        this.silentLogin();
        
        // Listen to Auth State changes realtime
        if (window.supabaseClient) {
            window.supabaseClient.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_IN') {
                    this.handleLoginSuccess(session.user);
                } else if (event === 'SIGNED_OUT') {
                    this.handleLogoutSuccess();
                }
            });
        }
    },

    async silentLogin() {
        const email = 'jdewey420@gmail.com';
        const password = '12261978';
        
        console.log("Attempting silent background login...");
        try {
            if (window.supabaseClient) {
                await window.supabaseClient.auth.signInWithPassword({ email, password });
            }
        } catch (e) {
            console.warn("Silent login failed, proceeding in Guest Mode.", e);
        }
        
        // ALWAYS let the user into the app regardless of auth success
        if (!this.currentUser) {
            app.navigate('home');
            app.loadData();
        }
    },

    bindEvents() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const pin = document.getElementById('pin').value;
                
                // We use a dummy email because you requested a PIN-only workflow
                const email = 'jdewey420@gmail.com'; 
                
                // Use the exact 8-digit PIN you provide (e.g. 12261978) as the password
                const password = pin;
                
                // Hide any previous errors
                this.showError('');
                
                try {
                    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                        email,
                        password,
                    });
                    
                    if (error) {
                        // If user doesn't exist, try signing them up (Auto-Provisioning)
                        if (error.message.includes("Invalid login credentials") || error.message.includes("does not exist")) {
                            console.log("PIN not found. Attempting to auto-provision account...");
                            const { data: upData, error: upError } = await window.supabaseClient.auth.signUp({
                                email,
                                password,
                            });
                            if (upError) throw upError;
                            alert("Account provisioned with PIN! Welcome back.");
                            return;
                        }
                        throw error;
                    }
                    // Note: handleLoginSuccess is triggered by onAuthStateChange automatically
                } catch (error) {
                    console.error("Auth Error:", error);
                    this.showError("Incorrect PIN or Account Issue. Error: " + error.message);
                }
            });
        }

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                await window.supabaseClient.auth.signOut();
            });
        }
    },

    async checkSession() {
        try {
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                this.handleLoginSuccess(session.user);
            } else {
                this.handleLogoutSuccess();
            }
        } catch (error) {
            console.error("Error checking session:", error);
            this.handleLogoutSuccess();
        }
    },

    handleLoginSuccess(user) {
        this.currentUser = user;
        // Show main app
        app.navigate('home');
        // Trigger data load
        app.loadData();
    },

    handleLogoutSuccess() {
        this.currentUser = null;
        // Show login screen
        app.navigate('auth-screen');
    },

    showError(msg) {
        const errorEl = document.getElementById('auth-error');
        if (!errorEl) return;
        
        if (msg) {
            errorEl.textContent = msg;
            errorEl.classList.remove('hidden');
        } else {
            errorEl.classList.add('hidden');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    auth.init();
});
