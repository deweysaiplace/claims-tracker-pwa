window.auth = {
    currentUser: null,

    init() {
        this.bindEvents();
        this.checkSession();
        
        // Listen to Auth State changes realtime
        window.supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                this.handleLoginSuccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                this.handleLogoutSuccess();
            }
        });
    },

    bindEvents() {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const pin = document.getElementById('pin').value;
                
                // We use a dummy email because you requested a PIN-only workflow
                const email = 'jason@claims.com'; 
                
                // Use the exact 8-digit PIN you provide (e.g. 12261978) as the password
                const password = pin;
                
                // Hide any previous errors
                this.showError('');
                
                try {
                    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                        email,
                        password,
                    });
                    
                    if (error) throw error;
                    // Note: handleLoginSuccess is triggered by onAuthStateChange automatically
                } catch (error) {
                    this.showError("Incorrect PIN. Please try again.");
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
