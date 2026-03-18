const auth = {
    currentUser: null,

    init() {
        this.bindEvents();
        this.checkSession();
        
        // Listen to Auth State changes realtime
        supabase.auth.onAuthStateChange((event, session) => {
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
                
                // We use the user's gmail as the hardcoded login user
                const email = 'hiJasonD@gmail.com'; 
                
                // Supabase requires 6 character minimum passwords, 
                // so we pad the 4 digit PIN with '00' behind the scenes.
                const password = pin + '00';
                
                // Hide any previous errors
                this.showError('');
                
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({
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
                await supabase.auth.signOut();
            });
        }
    },

    async checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
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
