const app = {
    currentView: 'home',
    currentDesk: 'field',
    currentClaimId: null,
    currentVisionBase64: [], // Modified to array
    currentEstimateBase64: null,
    currentScanPages: [],
    scannedImagesCount: 0,
    loadedPolicies: [],
    xactimateCodes: [], // The entire local db
    settings: {
        darkMode: true,
        stealthMode: false,
        hapticEnabled: false
    },

    init() {
        this.loadSettings();
        this.bindEvents();
        this.setupErrorHandlers();
        this.updateDBStatus();
        this.loadXactimateCodes();
        
        // Setup simple navigation
        const hash = window.location.hash.replace('#', '') || 'home';
        this.navigate(hash);

        this.setupOfflineDetection();
        this.makeFabDraggable();
    },

    async loadXactimateCodes() {
        try {
            const res = await fetch('./js/xactimate_codes.json');
            this.xactimateCodes = await res.json();
            console.log(`Loaded ${this.xactimateCodes.length} Exact Xactimate Codes.`);
        } catch(e) {
            console.error("Failed to load Xactimate dictionary:", e);
        }
    },

    makeFabDraggable() {
        const fab = document.getElementById('btn-global-brain-dump');
        if (!fab) return;
        
        let isDragging = false;
        let draggedFlag = false;
        let startX, startY, originalTouchX, originalTouchY;

        const onDragStart = (e) => {
            draggedFlag = false;
            // Get coordinates
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            
            const rect = fab.getBoundingClientRect();
            originalTouchX = clientX - rect.left;
            originalTouchY = clientY - rect.top;
            isDragging = true;
        };

        const onDragMove = (e) => {
            if (!isDragging) return;
            const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
            const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

            if (Math.abs(clientX - startX) > 8 || Math.abs(clientY - startY) > 8) {
                draggedFlag = true;
                e.preventDefault();
                fab.style.bottom = 'auto';
                fab.style.right = 'auto';
                fab.style.left = (clientX - originalTouchX) + 'px';
                fab.style.top = (clientY - originalTouchY) + 'px';
            }
        };

        const onDragEnd = () => { isDragging = false; };

        fab.addEventListener('mousedown', onDragStart);
        document.addEventListener('mousemove', onDragMove, {passive: false});
        document.addEventListener('mouseup', onDragEnd);

        fab.addEventListener('touchstart', onDragStart, {passive: true});
        document.addEventListener('touchmove', onDragMove, {passive: false});
        document.addEventListener('touchend', onDragEnd);

        // Prevent click if we actually dragged
        fab.addEventListener('click', (e) => {
            if (draggedFlag) {
                e.preventDefault();
                e.stopPropagation();
                draggedFlag = false;
            }
        }, true);
    },

    searchXactimate(query, maxResults = 5) {
        if (!this.xactimateCodes || this.xactimateCodes.length === 0) return [];
        const sanitized = query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
        const tokens = sanitized.split(' ').filter(x => x.length > 2);
        
        let results = this.xactimateCodes.map(item => {
            let score = 0;
            let textToSearch = (item.desc + " " + item.code).toLowerCase();
            
            // Code exact match is highest weight
            if (item.code.toLowerCase() === sanitized.trim()) score += 20;

            tokens.forEach(token => {
                if (textToSearch.includes(token)) score += 1;
            });
            // Exact phrase match bonus
            if (item.desc.toLowerCase().includes(sanitized.trim())) score += 5;
            
            return { item, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, maxResults);
        
        return results;
    },

    setupOfflineDetection() {
        const updateOnlineStatus = () => {
            const banner = document.getElementById('offline-banner');
            if (navigator.onLine) {
                if (banner) banner.classList.add('hidden');
            } else {
                if (banner) banner.classList.remove('hidden');
            }
        };

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();
    },

    updateDBStatus() {
        const el = document.getElementById('db-status');
        if (!el) return;
        if (window.supabaseClient) {
            el.textContent = "✅ Secure connection established.";
            el.style.color = "var(--success-color)";
        } else {
            el.textContent = "❌ Connection failed. Check your network.";
            el.style.color = "var(--danger-color)";
        }
    },

    hardRefresh() {
        if (confirm("This will clear all temporary app cache and force an update. Your claim data in the database will NOT be affected. Proceed?")) {
            // Clear all site data
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    for(let registration of registrations) { registration.unregister(); }
                });
            }
            window.location.reload(true);
        }
    },

    setupErrorHandlers() {
        window.onerror = (message, source, lineno, colno, error) => {
            const userId = auth.currentUser ? auth.currentUser.id : null;
            db.logError(userId, message, error ? error.stack : `At ${source}:${lineno}`, this.currentView, "v1.8.0");
        };

        window.onunhandledrejection = (event) => {
            const userId = auth.currentUser ? auth.currentUser.id : null;
            db.logError(userId, "Unhandled Promise Rejection: " + event.reason, null, this.currentView, "v1.8.0");
        };
    },

    bindEvents() {
        // Modal close behaviors
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal').classList.add('hidden');
            });
        });

        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        });

        // Brain Submit Button
        const brainSubmitBtn = document.getElementById('btn-brain-submit');
        if (brainSubmitBtn) {
            brainSubmitBtn.addEventListener('click', () => {
                app.submitBrainCommand();
            });
        }
    },

    navigate(viewId) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active-view');
        });
        
        // Don't modify dom for auth view unless we are there
        if (viewId === 'auth-screen') {
            document.getElementById('auth-screen').classList.add('active-view');
            document.getElementById('main-app').classList.add('hidden');
            return;
        }

        // Show requested view
        const viewEl = document.getElementById(`view-${viewId}`);
        if(viewEl) {
            viewEl.classList.add('active-view');
            document.getElementById('main-app').classList.remove('hidden');
            document.getElementById('auth-screen').classList.remove('active-view');
        }

        // Update Bottom Nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.target === viewId) {
                item.classList.add('active');
            }
        });

        // Update Title
        const titles = {
            'home': 'Home',
            'tasks': 'Tasks',
            'claims': 'Claims',
            'brain': 'AI Assistant',
            'voice-note': 'Voicemail',
            'dictate-summary': 'Summary',
            'settings': 'Settings',
            'vision': 'AI Vision',
            'weather': 'Weather Check',
            'dictionary': 'Dictionary',
            'water-loss': 'Water Loss Agent',
            'ctre-translator': 'Estimate Translator',
            'copilot-chat': 'SF Copilot Chat',
            'playbooks': 'Playbook Hub'
        };
        const titleEl = document.getElementById('current-view-title');
        if(titleEl && titles[viewId]) {
            titleEl.textContent = titles[viewId];
        }
        
        // Populate settings if navigating to settings
        if (viewId === 'settings') {
            const apiKeyInput = document.getElementById('setting-api-key');
            if (apiKeyInput) {
                apiKeyInput.value = localStorage.getItem('GROK_API_KEY') || '';
            }
            this.generateAppQRCode();
        }
        
        if (viewId === 'material-id') {
            this.resetMaterialID();
        }
        
        if (viewId === 'drafts') {
            this.loadDrafts();
        }
        
        this.currentView = viewId;
        window.location.hash = viewId;

        // Auto-switch desk based on view if navigated directly
        const strategyViews = ['weather', 'smart-map', 'dictionary', 'local-wonders', 'strategy'];
        if (strategyViews.includes(viewId)) {
            this.switchDesk('strategy', false);
        } else if (viewId === 'home') {
            this.switchDesk('field', false);
        }
    },

    switchDesk(deskId, navigateToHome = true) {
        this.currentDesk = deskId;
        
        // Update Sidebar UI
        document.querySelectorAll('.nav-desk-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = deskId === 'field' ? 
            document.getElementById('btn-tab-field') : 
            document.getElementById('btn-tab-strategy');
        
        if (activeBtn) activeBtn.classList.add('active');

        if (navigateToHome) {
            this.navigate(deskId === 'field' ? 'home' : 'strategy');
        }
    },

    generateAppQRCode() {
        const qrImg = document.getElementById('app-qr-code');
        const urlDisplay = document.getElementById('app-url-display');
        if (!qrImg || !urlDisplay) return;

        const currentUrl = window.location.href.split('#')[0]; // Current base URL
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(currentUrl)}&margin=10&color=1a1a2e`;
        
        qrImg.src = qrUrl;
        urlDisplay.textContent = currentUrl;
    },

    // -------------------------------------------------------------------------
    // Material ID Logic
    // -------------------------------------------------------------------------
    resetMaterialID() {
        this.currentMaterialBase64 = null;
        const preview = document.getElementById('material-photo-preview');
        const placeholder = document.querySelector('#material-camera-container .camera-placeholder');
        const analyzeBtn = document.getElementById('btn-analyze-material');
        const results = document.getElementById('material-results');
        const availSection = document.getElementById('availability-section');

        if (preview) preview.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
        if (analyzeBtn) analyzeBtn.classList.add('hidden');
        if (results) results.classList.add('hidden');
        if (availSection) availSection.classList.add('hidden');
    },

    handleMaterialPhoto(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            this.currentMaterialBase64 = base64;
            
            const preview = document.getElementById('material-photo-preview');
            preview.src = base64;
            preview.classList.remove('hidden');
            
            const placeholder = document.querySelector('#material-camera-container .camera-placeholder');
            if (placeholder) placeholder.classList.add('hidden');
            
            document.getElementById('btn-analyze-material').classList.remove('hidden');
            document.getElementById('material-results').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    },

    async analyzeMaterial() {
        if (!this.currentMaterialBase64) return;

        const loading = document.getElementById('material-loading');
        const loadingText = document.getElementById('material-loading-text');
        const results = document.getElementById('material-results');
        const info = document.getElementById('material-info');

        if (loading) loading.classList.remove('hidden');
        if (loadingText) loadingText.textContent = "Analyzing material profile...";
        if (results) results.classList.add('hidden');

        try {
            const data = await aiBrain.identifyMaterial(this.currentMaterialBase64);
            
            if (data) {
                this.currentMaterialData = data;
                info.innerHTML = `
                    <p><span class="material-label">Category:</span> ${data.category || 'Unknown'}</p>
                    <p><span class="material-label">Material:</span> ${data.material || 'Unknown'}</p>
                    <p><span class="material-label">Profile:</span> ${data.profile || 'Unknown'}</p>
                    <p><span class="material-label">Texture:</span> ${data.texture || 'Unknown'}</p>
                    <p><span class="material-label">Color:</span> ${data.color || 'Unknown'}</p>
                    <p style="margin-top: 10px; font-weight: 500; color: var(--primary-color);">Suggested Xactimate Code: ${data.xactimate_code || 'N/A'}</p>
                `;
                results.classList.remove('hidden');
            } else {
                alert("Could not identify material. Try a clearer photo.");
            }
        } catch (error) {
            console.error("Material ID analysis error:", error);
            alert("Error analyzing material. Please check your connection and API key.");
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    },

    async checkAvailability() {
        if (!this.currentMaterialData) return;

        const loading = document.getElementById('material-loading');
        const loadingText = document.getElementById('material-loading-text');
        const availSection = document.getElementById('availability-section');
        const availStatus = document.getElementById('availability-status');

        if (loading) loading.classList.remove('hidden');
        if (loadingText) loadingText.textContent = "Checking discontinued status...";

        try {
            const description = `${this.currentMaterialData.material} ${this.currentMaterialData.profile} ${this.currentMaterialData.color}`;
            const summary = await aiBrain.checkDiscontinued(description);
            
            availStatus.innerHTML = summary;
            
            // Add visual cue if discontinued
            if (summary.toLowerCase().includes('discontinued') || summary.toLowerCase().includes('obsolete')) {
                availStatus.className = 'availability-status discontinued';
            } else {
                availStatus.className = 'availability-status available';
            }
            
            availSection.classList.remove('hidden');
        } catch (error) {
            console.error("Availability check error:", error);
            alert("Error checking availability.");
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    },

    loadSettings() {
        const saved = localStorage.getItem('APP_SETTINGS');
        if (saved) {
            this.settings = JSON.parse(saved);
        }
        
        // Apply initial settings
        this.applyTheme(this.settings.darkMode);
        this.applyStealth(this.settings.stealthMode);
        
        // Update UI toggles once DOM is ready (handled in navigate/init)
        window.setTimeout(() => this.syncSettingsUI(), 100);
    },

    saveSettings() {
        localStorage.setItem('APP_SETTINGS', JSON.stringify(this.settings));
    },

    syncSettingsUI() {
        const darkToggle = document.getElementById('toggle-dark-mode');
        const stealthToggle = document.getElementById('toggle-stealth-mode');
        const hapticToggle = document.getElementById('toggle-haptic');
        
        if (darkToggle) darkToggle.checked = this.settings.darkMode;
        if (stealthToggle) stealthToggle.checked = this.settings.stealthMode;
        if (hapticToggle) hapticToggle.checked = this.settings.hapticEnabled;
    },

    toggleTheme(isDark) {
        this.settings.darkMode = isDark;
        this.applyTheme(isDark);
        this.saveSettings();
    },

    applyTheme(isDark) {
        if (isDark) {
            document.body.classList.remove('light-theme');
        } else {
            document.body.classList.add('light-theme');
        }
    },

    toggleStealth(isEnabled) {
        this.settings.stealthMode = isEnabled;
        this.applyStealth(isEnabled);
        this.saveSettings();
    },

    applyStealth(isEnabled) {
        if (isEnabled) {
            document.body.classList.add('stealth-mode');
        } else {
            document.body.classList.remove('stealth-mode');
        }
    },

    toggleHaptic(isEnabled) {
        this.settings.hapticEnabled = isEnabled;
        this.saveSettings();
        if (isEnabled && navigator.vibrate) {
            navigator.vibrate(50);
        }
    },

    hapticClick() {
        if (this.settings.hapticEnabled && navigator.vibrate) {
            navigator.vibrate(15);
        }
    },

    checkForUpdate() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(registrations => {
                for (let registration of registrations) {
                    registration.update();
                }
            });
        }
        alert("Checking for updates and force-reloading...");
        window.location.reload(true);
    },

    async loadData() {
        if (!auth.currentUser) return;
        try {
            const claims = await db.getAllClaims(auth.currentUser.id);
            this.renderClaims(claims);
            this.populateClaimDropdown(claims, 'task-claim-id');
            this.populateClaimDropdown(claims, 'draft-claim-id');
            this.populateClaimDropdown(claims, 'water-loss-claim-id');

            const activeClaims = claims.filter(c => c.status !== 'Closed');
            this.renderActiveClaims(activeClaims);

            const tasks = await db.getTasks(auth.currentUser.id);
            this.renderTasks(tasks);
            
            // Load Cross-Device Policies
            const policies = await db.getPolicies(auth.currentUser.id);
            this.populatePolicyDropdown(policies);
        } catch(e) {
            console.error("Error loading data:", e);
        }
    },

    renderActiveClaims(claims) {
        const list = document.getElementById('active-claims-list');
        if (!list) return;
        
        list.innerHTML = '';
        if (claims.length === 0) {
            list.innerHTML = '<li class="empty-state" style="padding: 12px 0;">No open claims.</li>';
            return;
        }

        claims.forEach(claim => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="list-item-content">
                    <strong>${this.escapeHTML(claim.claim_number)}</strong>
                    <p style="font-size: 0.85em; color: var(--text-secondary);">${this.escapeHTML(claim.insured_name || 'No Name Provided')}</p>
                </div>
                <div class="list-item-action">
                    <span class="material-symbols-outlined" style="color: var(--text-secondary);">chevron_right</span>
                </div>
            `;
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '12px 0';
            li.style.borderBottom = '1px solid var(--border-color)';
            li.style.cursor = 'pointer';
            
            list.appendChild(li);
        });
    },

    renderClaims(claims) {
        const list = document.getElementById('claims-list');
        if (!list) return;
        
        list.innerHTML = '';
        if (claims.length === 0) {
            list.innerHTML = '<li class="empty-state" style="padding: 12px 0; color: var(--text-secondary);">No claims found.</li>';
            return;
        }

        claims.forEach(claim => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="list-item-content">
                    <strong>${this.escapeHTML(claim.claim_number)}</strong>
                    <p style="font-size: 0.85em; color: var(--text-secondary);">${this.escapeHTML(claim.insured_name || '')} - ${claim.status}</p>
                </div>
            `;
            li.style.padding = '12px 0';
            li.style.borderBottom = '1px solid var(--border-color)';
            list.appendChild(li);
        });
    },

    populateClaimDropdown(claims, targetId = 'task-claim-id') {
        const select = document.getElementById(targetId);
        if (!select) return;
        
        // Keep the first default option
        const defaultOpt = select.options[0];
        select.innerHTML = '';
        select.appendChild(defaultOpt);

        claims.forEach(claim => {
            if (claim.status !== 'Closed') {
                const opt = document.createElement('option');
                opt.value = claim.id;
                opt.textContent = claim.claim_number;
                select.appendChild(opt);
            }
        });
    },

    populatePolicyDropdown(policies) {
        const select = document.getElementById('policy-select');
        if (!select) return;
        
        // Keep the first default option
        const defaultOpt = select.options[0];
        select.innerHTML = '';
        select.appendChild(defaultOpt);

        // Store policies globally for quick access during chat
        this.loadedPolicies = policies;

        policies.forEach(policy => {
            const opt = document.createElement('option');
            opt.value = policy.id;
            opt.textContent = policy.policy_name;
            select.appendChild(opt);
        });
    },

    renderTasks(tasks) {
        const list = document.getElementById('tasks-list');
        if (!list) return;

        list.innerHTML = '';
        if (tasks.length === 0) {
            list.innerHTML = '<li class="empty-state" style="padding: 12px 0; color: var(--text-secondary);">No tasks right now. You are all caught up!</li>';
            return;
        }

        tasks.forEach(task => {
            const li = document.createElement('li');
            const isCompleted = task.status === 'Completed';
            const claimText = task.claims ? ` - Claim ${task.claims.claim_number}` : '';
            
            li.innerHTML = `
                <div class="task-content">
                    <strong style="${isCompleted ? 'text-decoration: line-through; color: var(--text-secondary);' : ''}">${this.escapeHTML(task.description)}</strong>
                    <p style="font-size: 0.8em; color: var(--text-secondary); margin-top: 4px;">${task.priority}${claimText}</p>
                </div>
                <div class="task-actions" style="display: flex; gap: 10px;">
                    ${!isCompleted ? `<button class="icon-btn" onclick="app.completeTask('${task.id}')" style="color: var(--success-color); padding: 5px;"><span class="material-symbols-outlined">check_circle</span></button>` : ''}
                    <button class="icon-btn" onclick="app.deleteTask('${task.id}')" style="color: var(--danger-color); padding: 5px;"><span class="material-symbols-outlined">delete</span></button>
                </div>
            `;
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '15px 0';
            li.style.borderBottom = '1px solid var(--border-color)';

            list.appendChild(li);
        });
    },

    openNewTaskModal() {
        const modal = document.getElementById('modal-new-task');
        if(modal) {
            modal.classList.remove('hidden');
            document.getElementById('task-desc').focus();
        }
    },

    async saveTask() {
        const desc = document.getElementById('task-desc').value;
        const claimId = document.getElementById('task-claim-id').value;
        if (!desc.trim()) return;
        
        try {
            await db.addTask(auth.currentUser.id, desc, claimId || null);
            document.getElementById('task-desc').value = '';
            document.getElementById('modal-new-task').classList.add('hidden');
            this.loadData();
        } catch (e) {
            console.error(e);
            alert("Error saving task");
        }
    },

    openNewClaimModal() {
        const modal = document.getElementById('modal-new-claim');
        if(modal) {
            modal.classList.remove('hidden');
            document.getElementById('claim-number-input').focus();
        }
    },

    async saveClaim() {
        let claimNum = document.getElementById('claim-number-input').value.toUpperCase().trim();
        const claimName = document.getElementById('claim-name-input').value;
        
        if (!claimNum) {
            alert("Claim Number is required.");
            return;
        }
        
        // Auto-prefix with 30- if not already present
        if (!claimNum.startsWith('30-')) {
            claimNum = '30-' + claimNum;
        }

        try {
            await db.addClaim(auth.currentUser.id, claimNum, claimName || null, null);
            document.getElementById('claim-number-input').value = '';
            document.getElementById('claim-name-input').value = '';
            document.getElementById('modal-new-claim').classList.add('hidden');
            this.loadData(); // reload UI
        } catch(e) {
            console.error(e);
            alert("Error saving claim");
        }
    },

    async completeTask(taskId) {
        try {
            await db.completeTask(taskId);
            this.loadData();
        } catch (e) {
            console.error(e);
        }
    },

    async deleteTask(taskId) {
        try {
            await db.deleteTask(taskId);
            this.loadData();
        } catch (e) {
            console.error(e);
        }
    },

    sendEmail(type) {
        let transcriptId = type === 'summary' ? 'summary-transcript' : 'live-transcript';
        const text = document.getElementById(transcriptId).value;
        if (!text.trim()) {
            alert("Nothing to send! Please dictate or type something first.");
            return;
        }
        
        const to = 'Jason.deuermeyer.xm1h@statefarm.com';
        const subjectName = type === 'summary' ? 'Inspection Summary' : 'Voicemail Transcript';
        const subject = encodeURIComponent(`${subjectName}`);
        
        let fullText = text;

        if (type === 'summary') {
            const xactimateEl = document.getElementById('xactimate-transcript');
            if (xactimateEl && xactimateEl.value.trim() !== '') {
                fullText += "\n\n=== Xactimate Codes ===\n" + xactimateEl.value.trim();
            }
        }
        
        // Add footer for the sender
        fullText += "\n\n---\nSent from Claims Tracker PWA\nvia hiJasonD@gmail.com";
        const body = encodeURIComponent(fullText);
        
        // Trigger the native mailto protocol link
        window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    },

    async submitBrainCommand() {
        const transcriptEl = document.getElementById('brain-transcript');
        const loadingEl = document.getElementById('brain-loading');
        const submitBtn = document.getElementById('btn-brain-submit');
        const brainRecordBtn = document.getElementById('btn-brain-record');
        
        const command = transcriptEl.value.trim();
        if(!command) {
            alert("Please type or speak a command first.");
            return;
        }

        // Prevent spam clicking while loading
        if (submitBtn) submitBtn.disabled = true;
        if (brainRecordBtn) brainRecordBtn.disabled = true;
        if (loadingEl) loadingEl.classList.remove('hidden');

        try {
            // Stop voice recording if it was left on
            if (window.voiceModule && window.voiceModule.isRecording) {
                window.voiceModule.stopRecording();
            }

            // Get live active claims to pass as context
            const claims = await db.getAllClaims(auth.currentUser.id);
            const activeClaims = claims.filter(c => c.status !== 'Closed');

            // Send to Grok!
            const response = await aiBrain.processCommand(command, activeClaims);
            
            // Execute Brain's ruling
            if (response && response.action === 'create_task') {
                if(response.task_description) {
                   await db.addTask(auth.currentUser.id, response.task_description, response.claim_id || null);
                   transcriptEl.value = ''; // wipe on success
                   alert("Brain: " + (response.message || "Task created!"));
                   this.loadData();
                   // Jump to tasks tab to show user
                   this.navigate('tasks');
                } else {
                   alert("Brain: Sorry, I could not determine what the task description was.");
                }
            } else {
                alert("Brain: " + (response.message || "I didn't quite catch the intent there."));
            }
            
        } catch(e) {
            console.error(e);
            alert("Error communicating with AI Brain. Make sure you have a working network connection.");
        } finally {
            if (submitBtn) submitBtn.disabled = false;
            if (brainRecordBtn) brainRecordBtn.disabled = false;
            if (loadingEl) loadingEl.classList.add('hidden');
        }
    },

    async submitVoicemailToBrain() {
        const transcriptEl = document.getElementById('live-transcript');
        const text = transcriptEl.value.trim();
        
        if (!text) {
            alert("No voicemail transcript found to extract a task from.");
            return;
        }

        const btn = document.querySelector('#post-record-actions .btn-success');
        const originalBtnText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Extracting...';
            btn.disabled = true;

            const claims = await db.getAllClaims(auth.currentUser.id);
            const activeClaims = claims.filter(c => c.status !== 'Closed');

            // Prepend context so Grok analyzes it as a voicemail
            const promptContext = "I just listened to the following voicemail on speakerphone on my mobile app. Please extract the most logical action item or next step from this transcript as a task for me. Here is the transcript: " + text;
            
            const response = await aiBrain.processCommand(promptContext, activeClaims);
            
            if (response && response.action === 'create_task') {
                if(response.task_description) {
                   await db.addTask(auth.currentUser.id, response.task_description, response.claim_id || null);
                   alert("Brain Extracted: " + response.task_description + "\n\n(Added to Tasks)");
                   this.loadData();
                   this.navigate('tasks');
                } else {
                   alert("Brain: Could not determine an actionable task from this voicemail.");
                }
            } else {
                alert("Brain: " + (response.message || "No actionable task detected in this transcript."));
            }
        } catch(e) {
            console.error(e);
            alert("Error communicating with AI Brain. Make sure you set your API key in the Brain tab first.");
        } finally {
            btn.innerHTML = originalBtnText;
            btn.disabled = false;
        }
    },

    saveApiKey() {
        const input = document.getElementById('setting-api-key');
        if (!input) return;
        const key = input.value.trim();
        if (key) {
            localStorage.setItem('GROK_API_KEY', key);
            alert('API Key saved successfully!');
        } else {
            localStorage.removeItem('GROK_API_KEY');
            alert('API Key removed.');
        }
    },

    sendFeedback() {
        const to = 'personal.projects@example.com'; 
        const subject = encodeURIComponent('App Feedback / Issue Report');
        const body = encodeURIComponent('Please describe the issue or feature request:\n\n\n\n---\nApp Version: 1.2.1 (Stealth)\nDevice: ' + navigator.userAgent);
        window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    },

    wipeAllData() {
        if (confirm("This will clear all local settings and sign you out. Are you sure?")) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.reload();
        }
    },

    sendEmail(type) {
        let text = '';
        let subject = '';
        if (type === 'summary') {
            text = document.getElementById('summary-transcript').value;
            const xac = document.getElementById('xactimate-transcript').value;
            if (xac) text += '\n\nXACTIMATE ESTIMATE:\n' + xac;
            subject = 'Inspection Summary';
        } else if (type === 'voicemail') {
            text = document.getElementById('live-transcript').value;
            subject = 'Transcribed Voicemail';
        }

        const body = encodeURIComponent(text);
        window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${body}`;
    },

    async extractXactimateCodes() {
        const transcriptEl = document.getElementById('summary-transcript');
        const xacContainer = document.getElementById('xactimate-output-container');
        const xacTranscriptEl = document.getElementById('xactimate-transcript');
        const btn = document.getElementById('btn-extract-xactimate');
        
        const text = transcriptEl.value.trim();
        if (!text) {
            alert("No dictation found to extract codes from. Please dictate first.");
            return;
        }

        const originalBtnHTML = btn.innerHTML;

        try {
            btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Extracting...';
            btn.disabled = true;

            const apiKey = localStorage.getItem('GROK_API_KEY');
            if (!apiKey) {
                alert("Please save your API key in the Settings tab first.");
                this.navigate('settings');
                return;
            }

            // Provide context for AI Brain to understand the task
            const promptContext = "Analyze the following inspection dictation and extract the corresponding Xactimate codes and materials as a concise bulleted list. Do not include unneeded fluff. Dictation: " + text;
            
            // Bypass the strict JSON schema from `processCommand` by calling the backend directly or via new flag. 
            // Wait, we need to add processXactimate to aiBrain
            const responseText = await aiBrain.processXactimate(promptContext);
            
            xacTranscriptEl.value = responseText;
            xacContainer.classList.remove('hidden');

        } catch(e) {
            console.error(e);
            alert("Error extracting Xactimate codes.");
        } finally {
            btn.innerHTML = originalBtnHTML;
            btn.disabled = false;
        }
    },

    // --- NEW ADVANCED FEATURES --- //

    handleVisionImageSelect(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        const previewContainer = document.getElementById('vision-preview-container');
        const previewImg = document.getElementById('vision-preview-img');
        
        this.currentVisionBase64 = []; // Reset array
        previewContainer.classList.remove('hidden');
        document.getElementById('vision-output-container').classList.add('hidden');
        
        // Use the first image for the main preview, but we store all
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
        };
        reader.readAsDataURL(files[0]);

        // Convert all to base64
        files.forEach(file => {
            const r = new FileReader();
            r.onload = (e) => {
                this.currentVisionBase64.push(e.target.result);
            };
            r.readAsDataURL(file);
        });
    },

    async analyzePhoto() {
        if (!this.currentVisionBase64 || this.currentVisionBase64.length === 0) return alert("Select photos first.");
        
        const btn = document.getElementById('btn-analyze-vision');
        const outBox = document.getElementById('vision-output-container');
        const transcript = document.getElementById('vision-transcript');
        const origBtnText = btn.innerHTML;
        
        // Check vision mode
        const modeRadio = document.querySelector('input[name="vision-mode"]:checked');
        const mode = modeRadio ? modeRadio.value : 'damage';
        
        try {
            btn.innerHTML = `<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Analyzing ${mode === 'ale' ? 'Receipts' : 'Damage'}...`;
            btn.disabled = true;

            // EVIDENCE ELITE - Gather Metadata
            let metadata = `[Timestamp: ${new Date().toLocaleString()}]`;
            try {
                const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, {timeout: 5000}));
                metadata += ` [GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}]`;
            } catch(e) { console.warn("GPS metadata skipped"); }

            let result = "";
            if (mode === 'ale') {
                // For ALE, we analyze the first image
                result = await aiBrain.analyzeALEPhoto(this.currentVisionBase64[0]);
            } else {
                // Prepend metadata to the analysis request
                const enhancedPrompt = `Metadata: ${metadata}\n\nAnalyze these photos for insurance claim damage.`;
                result = await aiBrain.analyzeImage(this.currentVisionBase64, enhancedPrompt);
            }
            
            transcript.value = `--- EVIDENCE LOG ---\n${metadata}\n\n--- AI ANALYSIS ---\n${result}`;
            outBox.classList.remove('hidden');
        } catch(e) {
            console.error(e);
            alert("Error analyzing photos. " + e.message);
        } finally {
            btn.innerHTML = origBtnText;
            btn.disabled = false;
        }
    },

    async savePastedPolicy() {
        const nameInput = document.getElementById('paste-policy-name');
        const textInput = document.getElementById('paste-policy-text');
        const name = nameInput.value.trim();
        const text = textInput.value.trim();

        if (!name || !text) return alert("Please enter both a name and the policy text.");

        try {
            if (!window.db) throw new Error("Database client not found. Your workstation might be blocking our connection to Supabase (Database).");
            await db.savePolicy(auth.currentUser.id, name, text);
            alert("Policy saved successfully!");
            nameInput.value = '';
            textInput.value = '';
            this.loadData();
        } catch(e) {
            console.error(e);
            alert("Error saving policy text: " + e.message);
        }
    },

    handleEstimateImageSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const previewContainer = document.getElementById('estimate-preview-container');
        const previewImg = document.getElementById('estimate-preview-img');
        
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            this.currentEstimateBase64 = e.target.result;
            previewContainer.classList.remove('hidden');
            document.getElementById('estimate-output-container').classList.add('hidden');
        };
        reader.readAsDataURL(file);
    },

    async analyzeEstimatePhoto() {
        if (!this.currentEstimateBase64) return alert("Please capture an estimate photo first.");
        
        const btn = document.getElementById('btn-analyze-estimate');
        const outBox = document.getElementById('estimate-output-container');
        const transcript = document.getElementById('estimate-transcript');
        const origBtnText = btn.innerHTML;
        
        try {
            btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Analyzing Estimate...';
            btn.disabled = true;
            
            const result = await aiBrain.analyzeEstimate(this.currentEstimateBase64);
            transcript.value = result;
            outBox.classList.remove('hidden');
        } catch(e) {
            console.error(e);
            alert("Error analyzing estimate. " + e.message);
        } finally {
            btn.innerHTML = origBtnText;
            btn.disabled = false;
        }
    },

    copyEstimateToClipboard() {
        const transcript = document.getElementById('estimate-transcript');
        transcript.select();
        document.execCommand('copy');
        alert("Xactimate codes copied to clipboard!");
    },

    async handleStealthPolicyUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const statusBox = document.getElementById('stealth-upload-status');
        const statusText = document.getElementById('status-text');
        
        if (file.type !== "application/pdf") {
            return;
        }

        try {
            statusBox.classList.remove('hidden');
            statusText.textContent = `Reading ${file.name}...`;
            
            // Extract text using PDF.js locally
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullText = '';
            const maxPages = Math.min(pdf.numPages, 100); 
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                fullText += textContent.items.map(item => item.str).join(' ') + '\\n';
            }
            
            // Save to DB
            statusText.textContent = 'Syncing to Cloud...';
            await db.savePolicy(auth.currentUser.id, file.name.replace('.pdf', ''), fullText);
            
            statusText.textContent = 'Sync Complete!';
            setTimeout(() => { statusBox.classList.add('hidden'); }, 3000);
            
            // Reload UI
            this.loadData();
        } catch(e) {
            console.error("Policy sync failed", e);
            statusText.textContent = 'Sync Failed.';
            setTimeout(() => { statusBox.classList.add('hidden'); }, 5000);
        } finally {
            event.target.value = ''; // Reset input
        }
    },

    async askPolicyQuestion() {
        const select = document.getElementById('policy-select');
        const questionInput = document.getElementById('policy-question');
        const btn = document.getElementById('btn-policy-ask');
        const outBox = document.getElementById('policy-answer-container');
        const answerBox = document.getElementById('policy-answer');
        
        const policyId = select.value;
        const question = questionInput.value.trim();
        
        if (!policyId || !question) return alert("Please select a policy and type a question.");
        
        const policy = this.loadedPolicies.find(p => p.id === policyId);
        if (!policy) return alert("Could not find loaded policy data.");
        
        const origBtnText = btn.innerHTML;
        try {
            btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Thinking...';
            btn.disabled = true;
            
            const result = await aiBrain.askPolicy(policy.policy_text, question);
            answerBox.value = result;
            outBox.classList.remove('hidden');
            
        } catch(e) {
            console.error(e);
            alert("Error communicating with AI. Make sure your API key is correct.");
        } finally {
            btn.innerHTML = origBtnText;
            btn.disabled = false;
        }
    },

    async pullWeather() {
        const address = document.getElementById('weather-address').value.trim();
        const date = document.getElementById('weather-date').value;
        const outBox = document.getElementById('weather-output-container');
        const textEl = document.getElementById('weather-output');
        const btn = document.getElementById('btn-weather-pull');

        if (!address || !date) return alert("Please enter both Address and Date.");

        const origBtnText = btn.innerHTML;
        try {
            btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Querying Storm Desk...';
            btn.disabled = true;
            outBox.classList.add('hidden');

            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1`);
            const geoData = await geoRes.json();
            if(!geoData.results || geoData.results.length === 0) throw new Error("Could not find that location.");
            const loc = geoData.results[0];

            // Pull standard data + wind gusts
            const weatherRes = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${loc.latitude}&longitude=${loc.longitude}&start_date=${date}&end_date=${date}&daily=weather_code,temperature_2m_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=auto`);
            const weatherData = await weatherRes.json();

            if(!weatherData.daily) throw new Error("No weather data found for this date.");
            
            const w = weatherData.daily;
            
            // CONVERSIONS: mm to Inches, km/h to MPH
            const rainIn = (w.precipitation_sum[0] * 0.0393701).toFixed(2);
            const windMph = (w.wind_speed_10m_max[0] * 0.621371).toFixed(1);
            const gustMph = (w.wind_gusts_10m_max[0] * 0.621371).toFixed(1);
            const tempF = (w.temperature_2m_max[0] * 9/5 + 32).toFixed(1);

            // Determine if stormy
            const isStormy = w.wind_gusts_10m_max[0] > 40 || w.precipitation_sum[0] > 10;
            const stormBadge = isStormy ? "⚠️ SIGNIFICANT EVENT DETECTED" : "✅ Normal Conditions";

            textEl.value = `📍 Location: ${loc.name}, ${loc.admin1 || ''}\n📅 Date: ${date}\n---\n${stormBadge}\n\n🌪️ Max Wind: ${windMph} MPH\n🌬️ Peak Gusts: ${gustMph} MPH\n🌧️ Rain total: ${rainIn}"\n🌡️ Max Temp: ${tempF}°F\n\n[Estimation]: Conditions suggest moderate storm activity. Check NEXRAD hail reports for verification.`;
            
            outBox.classList.remove('hidden');
            this.showToast("Detailed weather data retrieved.", "success");
        } catch(e) {
            console.error(e);
            alert(e.message);
        } finally {
            btn.innerHTML = origBtnText;
            btn.disabled = false;
        }
    },

    async calculateDistance() {
        const origin = document.getElementById('map-origin').value.trim();
        const dest = document.getElementById('map-destination').value.trim();
        const results = document.getElementById('map-results');
        const dataText = document.getElementById('map-data-text');
        const openBtn = document.getElementById('btn-open-google-maps');

        if (!origin || !dest) return alert("Please enter both Start and Destination addresses.");

        try {
            dataText.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 1s linear infinite;">sync</span> Running Logistics AI...';
            results.classList.remove('hidden');

            // Find Origin Geo
            const geo1 = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(origin)}&count=1`).then(r => r.json());
            const geo2 = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(dest)}&count=1`).then(r => r.json());

            if (!geo1.results || !geo2.results) throw new Error("Could not geocode one of the addresses.");

            const lat1 = geo1.results[0].latitude;
            const lon1 = geo1.results[0].longitude;
            const lat2 = geo2.results[0].latitude;
            const lon2 = geo2.results[0].longitude;

            // Haversine formula for "As the crow flies"
            const R = 3958.8; // Radius of Earth in MILES
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = (R * c).toFixed(1);

            const estTime = (distance * 1.4).toFixed(0); // Very rough estimate factor for driving

            dataText.innerHTML = `🏁 Distance: <strong>${distance} miles</strong><br>🚗 Est. Drive: <strong>~${estTime} mins</strong>`;
            
            openBtn.onclick = () => {
                window.open(`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=driving`, '_blank');
            };

            this.showToast("Logistics estimation complete.", "success");
        } catch (e) {
            console.error(e);
            alert("Error calculating distance. Try more specific addresses.");
        }
    },

    // --- CAMERA SCAN FEATURES --- //
    
    openCameraScan() {
        document.getElementById('modal-camera-scan').classList.remove('hidden');
        this.currentScanPages = [];
        this.scannedImagesCount = 0;
        document.getElementById('scan-page-count').textContent = 'Pages Scanned: 0';
        document.getElementById('scan-preview-grid').innerHTML = '';
        document.getElementById('btn-finish-scan').disabled = true;
        document.getElementById('btn-finish-scan').classList.add('disabled');
        document.getElementById('scan-progress-area').classList.add('hidden');
    },

    closeCameraScan() {
        if(this.scannedImagesCount > 0 && !confirm("Discard current scan progress?")) return;
        document.getElementById('modal-camera-scan').classList.add('hidden');
    },

    async handlePageCapture(event) {
        const file = event.target.files[0];
        if (!file) return;

        const spinner = document.getElementById('scan-spinner');
        const progressArea = document.getElementById('scan-progress-area');
        const grid = document.getElementById('scan-preview-grid');
        const pageCountEl = document.getElementById('scan-page-count');
        const finishBtn = document.getElementById('btn-finish-scan');

        try {
            progressArea.classList.remove('hidden');
            spinner.classList.remove('hidden');
            
            // Convert to base64 for Grok Vision OCR
            const reader = new FileReader();
            const textResult = await new Promise((resolve, reject) => {
                reader.onload = async (e) => {
                    try {
                        const base64 = e.target.result;
                        
                        // Add thumb to UI immediately
                        const thumb = document.createElement('div');
                        thumb.style.cssText = `background: url(${base64}) center/cover; aspect-ratio: 1; border-radius: 4px; border: 2px solid var(--primary-color); position: relative;`;
                        thumb.innerHTML = `<span style="position: absolute; bottom: 2px; right: 2px; background: rgba(0,0,0,0.7); color: white; font-size: 10px; padding: 2px 4px; border-radius: 3px;">P${this.scannedImagesCount + 1}</span>`;
                        grid.appendChild(thumb);

                        // Run OCR via AI Brain
                        const extractedText = await aiBrain.ocrPolicyPage(base64);
                        resolve(extractedText);
                    } catch(err) {
                        reject(err);
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            this.currentScanPages.push(textResult);
            this.scannedImagesCount++;
            pageCountEl.textContent = `Pages Scanned: ${this.scannedImagesCount}`;
            
            if(this.scannedImagesCount > 0) {
                finishBtn.disabled = false;
                finishBtn.classList.remove('disabled');
            }

        } catch(e) {
            console.error("OCR Error:", e);
            alert("Could not read that page. Please try again with better lighting.");
        } finally {
            spinner.classList.add('hidden');
            event.target.value = ''; // Reset input
        }
    },

    async finishPolicyScan() {
        const name = document.getElementById('scan-policy-name').value.trim() || `Scanned Policy ${new Date().toLocaleDateString()}`;
        const finishBtn = document.getElementById('btn-finish-scan');
        const origText = finishBtn.innerHTML;

        try {
            finishBtn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Saving...';
            finishBtn.disabled = true;

            const fullPolicyText = this.currentScanPages.join('\\n\\n--- PAGE BREAK ---\\n\\n');
            await db.savePolicy(auth.currentUser.id, name, fullPolicyText);
            
            alert("Policy synced successfully!");
            document.getElementById('modal-camera-scan').classList.add('hidden');
            this.loadData();
        } catch(e) {
            console.error(e);
            alert("Error saving scanned policy.");
        } finally {
            finishBtn.innerHTML = origText;
            finishBtn.disabled = false;
        }
    },

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // -------------------------------------------------------------------------
    // Material ID Logic
    // -------------------------------------------------------------------------
    resetMaterialID() {
        this.currentMaterialBase64 = null;
        const preview = document.getElementById('material-photo-preview');
        const placeholder = document.querySelector('#material-camera-container .camera-placeholder');
        const analyzeBtn = document.getElementById('btn-analyze-material');
        const results = document.getElementById('material-results');
        const availSection = document.getElementById('availability-section');

        if (preview) preview.classList.add('hidden');
        if (placeholder) placeholder.classList.remove('hidden');
        if (analyzeBtn) analyzeBtn.classList.add('hidden');
        if (results) results.classList.add('hidden');
        if (availSection) availSection.classList.add('hidden');
    },

    handleMaterialPhoto(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target.result;
            this.currentMaterialBase64 = base64;
            
            const preview = document.getElementById('material-photo-preview');
            if (preview) {
                preview.src = base64;
                preview.classList.remove('hidden');
            }
            
            const placeholder = document.querySelector('#material-camera-container .camera-placeholder');
            if (placeholder) placeholder.classList.add('hidden');
            
            const analyzeBtn = document.getElementById('btn-analyze-material');
            if (analyzeBtn) analyzeBtn.classList.remove('hidden');
            
            const results = document.getElementById('material-results');
            if (results) results.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    },

    async analyzeMaterial() {
        if (!this.currentMaterialBase64) return;

        const loading = document.getElementById('material-loading');
        const loadingText = document.getElementById('material-loading-text');
        const results = document.getElementById('material-results');
        const info = document.getElementById('material-info');

        if (loading) loading.classList.remove('hidden');
        if (loadingText) loadingText.textContent = "Analyzing material profile...";
        if (results) results.classList.add('hidden');

        try {
            const data = await aiBrain.identifyMaterial(this.currentMaterialBase64);
            
            if (data) {
                this.currentMaterialData = data;
                if (info) {
                    info.innerHTML = `
                        <p><span class="material-label">Category:</span> ${data.category || 'Unknown'}</p>
                        <p><span class="material-label">Material:</span> ${data.material || 'Unknown'}</p>
                        <p><span class="material-label">Profile:</span> ${data.profile || 'Unknown'}</p>
                        <p><span class="material-label">Texture:</span> ${data.texture || 'Unknown'}</p>
                        <p><span class="material-label">Color:</span> ${data.color || 'Unknown'}</p>
                        <p style="margin-top: 10px; font-weight: 500; color: var(--primary-color);">Suggested Xactimate Code: ${data.xactimate_code || 'N/A'}</p>
                    `;
                }
                if (results) results.classList.remove('hidden');
            } else {
                alert("Could not identify material. Try a clearer photo.");
            }
        } catch (error) {
            console.error("Material ID analysis error:", error);
            alert("Error analyzing material. Please check your connection and API key.");
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    },

    async checkAvailability() {
        if (!this.currentMaterialData) return;

        const loading = document.getElementById('material-loading');
        const loadingText = document.getElementById('material-loading-text');
        const availSection = document.getElementById('availability-section');
        const availStatus = document.getElementById('availability-status');

        if (loading) loading.classList.remove('hidden');
        if (loadingText) loadingText.textContent = "Checking discontinued status...";

        try {
            const description = `${this.currentMaterialData.material} ${this.currentMaterialData.profile} ${this.currentMaterialData.color}`;
            const summary = await aiBrain.checkDiscontinued(description);
            
            if (availStatus) {
                availStatus.innerHTML = summary;
                
                // Add visual cue if discontinued
                if (summary.toLowerCase().includes('discontinued') || summary.toLowerCase().includes('obsolete')) {
                    availStatus.className = 'availability-status discontinued';
                } else {
                    availStatus.className = 'availability-status available';
                }
            }
            
            if (availSection) availSection.classList.remove('hidden');
        } catch (error) {
            console.error("Availability check error:", error);
            alert("Error checking availability.");
        } finally {
            if (loading) loading.classList.add('hidden');
        }
    },

    toggleBrainDump() {
        if (!window.voiceModule) {
            alert("Voice module not initialized.");
            return;
        }
        
        window.voiceModule.targetElementId = 'global-brain-dump';
        window.voiceModule.toggleRecording();
    },

    async finishBrainDump(transcript) {
        if (!transcript || transcript.trim() === '') {
            console.log("No transcript for brain dump.");
            return;
        }
        
        try {
            const actionData = await aiBrain.processWindshieldBrainDump(transcript);
            this.displayBrainDumpSummary(actionData);
        } catch (e) {
            console.error("Brain Dump Processing Error:", e);
            alert("Error processing brain dump.");
        }
    },

    displayBrainDumpSummary(data) {
        const modal = document.getElementById('modal-brain-dump-summary');
        const resultsContainer = document.getElementById('brain-dump-results');
        if (!modal || !resultsContainer || !data) return;
        
        let html = '';
        
        if (data.tasks && data.tasks.length > 0) {
            html += '<h3 style="color: var(--primary-color); margin-top: 1rem; font-size: 0.9rem;">Tasks Created</h3>';
            data.tasks.forEach(t => {
                const prio = t.priority ? `P${t.priority}` : 'Task';
                html += `<div style="display:flex; gap:10px; padding:10px; background:var(--bg-surface); border-radius:8px; margin-bottom:8px;">
                    <span style="background:var(--primary-color); color:white; padding:2px 6px; border-radius:4px; font-size:0.7rem; height:fit-content;">${prio}</span>
                    <div style="flex:1; font-size: 0.85rem;"><strong>${this.escapeHTML(t.claimName||'General')}</strong>: ${this.escapeHTML(t.description)}</div>
                </div>`;
                
                if (window.auth && window.auth.currentUser && window.db) {
                    window.db.addTask(window.auth.currentUser.id, `[${t.claimName||'General'}] ${t.description}`).then(() => this.loadData());
                }
            });
        }

        if (data.emails && data.emails.length > 0) {
            html += '<h3 style="color: #fbbf24; margin-top: 1rem; font-size: 0.9rem;">Emails Drafted</h3>';
            data.emails.forEach(e => {
                const mailtoUrl = `mailto:?subject=${encodeURIComponent("Claim Update")}&body=${encodeURIComponent(e.content)}`;
                html += `<div style="display:flex; gap:10px; padding:10px; background:var(--bg-surface); border-radius:8px; margin-bottom:8px; justify-content:space-between; align-items:center;">
                    <div style="font-size: 0.85rem;"><strong>To: ${this.escapeHTML(e.recipient)}</strong><br><span style="opacity:0.7;">${this.escapeHTML(e.content)}</span></div>
                    <a href="${mailtoUrl}" class="btn btn-secondary" style="font-size: 0.7rem; padding: 6px 10px; text-decoration: none;">Send</a>
                </div>`;
            });
        }

        if (data.sms && data.sms.length > 0) {
            html += '<h3 style="color: #34d399; margin-top: 1rem; font-size: 0.9rem;">Texts Prepared</h3>';
            data.sms.forEach(s => {
                const smsUrl = `sms:?&body=${encodeURIComponent(s.content)}`;
                html += `<div style="display:flex; gap:10px; padding:10px; background:var(--bg-surface); border-radius:8px; margin-bottom:8px; justify-content:space-between; align-items:center;">
                    <div style="font-size: 0.85rem;"><strong>To: ${this.escapeHTML(s.recipient)}</strong><br><span style="opacity:0.7;">${this.escapeHTML(s.content)}</span></div>
                    <a href="${smsUrl}" class="btn btn-secondary" style="font-size: 0.7rem; padding: 6px 10px; text-decoration: none;">Text</a>
                </div>`;
            });
        }

        if (data.notes && data.notes.length > 0) {
            html += '<h3 style="color: #9ca3af; margin-top: 1rem; font-size: 0.9rem;">Field Notes</h3>';
            data.notes.forEach(n => {
                html += `<div style="padding:10px; background:var(--bg-surface); border-radius:8px; margin-bottom:8px; font-size: 0.85rem; opacity: 0.8;">
                    ${this.escapeHTML(n)}
                </div>`;
            });
        }

        if (html === '') {
            html = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">No actionable items detected from the audio.</div>';
        }

        resultsContainer.innerHTML = html;
        modal.classList.remove('hidden');
    },
    
    escapeHTML(str) {
        if (!str) return '';
        return str.toString().replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    },

    async discoverWonders() {
        const loading = document.getElementById('wonders-loading');
        const list = document.getElementById('wonders-list');
        const btn = document.getElementById('btn-discover-wonders');
        
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser.");
            return;
        }
        
        if (loading) loading.classList.remove('hidden');
        if (list) list.innerHTML = '';
        if (btn) btn.disabled = true;

        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            
            const pois = await aiBrain.findNearbyPOIs(lat, lng);
            
            if (pois.length === 0) {
                list.innerHTML = '<li class="empty-state">No points of interest found automatically. Maybe try manually searching?</li>';
            } else {
                pois.forEach(poi => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <div class="task-content" style="flex:1;">
                            <strong>${this.escapeHTML(poi.name)}</strong>
                            <span class="code-badge" style="background:var(--primary-color); color:white; font-size:0.7em; padding:2px 6px; border-radius:4px; margin-left:8px;">${this.escapeHTML(poi.category)}</span>
                            <p style="font-size: 0.85em; color: var(--text-secondary); margin-top: 5px;">${this.escapeHTML(poi.description)}</p>
                        </div>
                        <div class="task-actions" style="margin-left:15px; display:flex; flex-direction:column; gap:5px;">
                            <a href="https://maps.google.com/?q=${poi.lat},${poi.lng}" target="_blank" class="icon-btn" style="background:rgba(0,122,255,0.1); border-radius:8px; padding:8px; text-decoration:none;">
                                <span class="material-symbols-outlined" style="color:var(--primary-color);">map</span>
                            </a>
                        </div>
                    `;
                    li.style.display = 'flex';
                    li.style.justifyContent = 'space-between';
                    li.style.alignItems = 'center';
                    li.style.padding = '15px';
                    li.style.borderBottom = '1px solid var(--border-color)';
                    li.style.background = 'var(--bg-surface-light)';
                    li.style.borderRadius = '8px';
                    li.style.marginBottom = '10px';
                    
                    list.appendChild(li);
                });
            }
        } catch (e) {
            console.error("Local Wonders Error:", e);
            if (list) list.innerHTML = '<li class="empty-state" style="color:var(--danger-color);">Error fetching local wonders. Make sure you allow GPS tracking and your API key is set.</li>';
        } finally {
            if (loading) loading.classList.add('hidden');
            if (btn) btn.disabled = false;
        }
    },

    async generateBatchReport() {
        if (!confirm("This will analyze your open tasks and active claims to generate a callback priority report. Proceed?")) return;
        
        try {
            // Get all tasks to act as our voicemail/action item context
            let tasks = [];
            if (window.db && window.auth.currentUser) {
                const fetched = await db.getTasks(window.auth.currentUser.id);
                tasks = fetched.filter(t => t.status !== 'Completed');
            }
            
            let context = tasks.map(t => `- Task [P${t.priority || 'Normal'}]: ${t.description} (Claim: ${t.claims ? t.claims.claim_number : 'General'})`).join("\n");
            
            // Look for actual raw voicemails if possible via direct supabase call
            if (window.supabaseClient) {
                 const {data} = await window.supabaseClient.from('voicemails').select('*').eq('user_id', window.auth.currentUser.id).order('created_at', {ascending: false}).limit(10);
                 if (data && data.length > 0) {
                     context += "\n\nRaw Voicemails (Unprocessed):\n" + data.map(v => `- [${new Date(v.created_at).toLocaleString()}] ${v.transcript}`).join("\n");
                 }
            }

            if (!context.trim()) {
                alert("You have no open tasks or raw voicemails to generate a report from.");
                return;
            }

            const modal = document.getElementById('modal-brain-dump-summary'); 
            const resultsContainer = document.getElementById('brain-dump-results');
            
            // Show loading in modal
            if(modal) modal.classList.remove('hidden');
            if(resultsContainer) resultsContainer.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-secondary);"><span class="material-symbols-outlined" style="animation: spin 2s linear infinite; font-size:32px;">sync</span><p>Consulting Grok to build Priority Report...</p></div>';
            
            const rawMarkdown = await aiBrain.generateBatchVoicemailReport(context);
            
            let htmlForm = rawMarkdown
                .replace(/\n\n/g, '</p><p>')
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                
            if(resultsContainer) {
                resultsContainer.innerHTML = `
                    <h3 style="color:var(--primary-color); margin-bottom:10px;">Priority Callback Report</h3>
                    <div style="font-size:0.85rem; line-height:1.5; background:var(--bg-surface-light); padding:15px; border-radius:8px; overflow-x:auto;">
                        <p>${htmlForm}</p>
                    </div>
                `;
            }
        } catch (e) {
            console.error(e);
            alert("Error generating batch report. Do you have a network connection and valid Grok API key?");
            if (modal) modal.classList.add('hidden');
        }
    },

    async searchDictionary() {
        const input = document.getElementById('dict-search-input');
        const query = input.value.trim();
        const loading = document.getElementById('dict-loading');
        const list = document.getElementById('dict-results');
        
        if (!query) return;
        
        loading.classList.remove('hidden');
        list.innerHTML = '';

        try {
            const results = await aiBrain.dictionarySearch(query);
            
            if (results.length === 0) {
                list.innerHTML = '<li class="empty-state">No matching codes found. Try a different term.</li>';
            } else {
                results.forEach(item => {
                    const li = document.createElement('li');
                    li.className = 'code-card';
                    li.innerHTML = `
                        <div class="task-content">
                            <span class="code-label">${item.code}</span>
                            <div style="font-size: 0.85rem; margin-top: 5px;">${this.escapeHTML(item.description)}</div>
                            <span style="font-size: 0.7rem; opacity: 0.6;">Category: ${item.category}</span>
                        </div>
                        <button class="icon-btn" onclick="app.copyToClipboard('${item.code}')">
                            <span class="material-symbols-outlined">content_copy</span>
                        </button>
                    `;
                    list.appendChild(li);
                });
            }
        } catch (e) {
            console.error(e);
            list.innerHTML = '<li class="empty-state" style="color:var(--danger-color);">Error searching dictionary.</li>';
        } finally {
            loading.classList.add('hidden');
        }
    },



    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showToast(`Copied: ${text}`, 'success');
        });
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'info';
        if (type === 'success') icon = 'check_circle';
        if (type === 'error') icon = 'error';

        toast.innerHTML = `
            <span class="material-symbols-outlined">${icon}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'toastFadeOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    async submitBugReport() {
        const descInput = document.getElementById('bug-description');
        const description = descInput.value.trim();
        const btn = document.getElementById('btn-submit-bug');

        if (!description) {
            this.showToast("Please describe the issue.", "error");
            return;
        }

        const origBtnText = btn.innerHTML;
        try {
            btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Sending...';
            btn.disabled = true;

            const userId = auth.currentUser ? auth.currentUser.id : null;
            const context = {
                view: this.currentView,
                claimId: this.currentClaimId,
                userAgent: navigator.userAgent,
                online: navigator.onLine,
                timestamp: new Date().toISOString()
            };

            // Log as a special error type for now
            const res = await db.logError(userId, "USER_FEEDBACK: " + description, JSON.stringify(context), this.currentView, "v1.8.0");
            console.log("Bug Report Response:", res);

            this.showToast("Thank you! Feedback sent.", "success");
            descInput.value = '';
            document.getElementById('modal-report-bug').classList.add('hidden');
        } catch (e) {
            console.error(e);
            this.showToast("Failed to send report.", "error");
        } finally {
            btn.innerHTML = origBtnText;
            btn.disabled = false;
        }
    },

    // -------------------------------------------------------------------------
    // Draft Estimates Logic
    // -------------------------------------------------------------------------
    openSaveDraftModal(source) {
        let codes = "";
        if (source === 'summary') {
            codes = document.getElementById('xactimate-transcript').value;
        } else if (source === 'estimate') {
            codes = document.getElementById('estimate-transcript').value;
        }

        if (!codes || codes.trim() === "") {
            return alert("No codes found to save. Please extract codes first.");
        }

        document.getElementById('draft-codes-hidden').value = codes;
        document.getElementById('draft-title-input').value = "";
        
        // Populate claims dropdown
        const select = document.getElementById('draft-claim-id');
        select.innerHTML = '<option value="">-- No Specific Claim --</option>';
        this.loadedPolicies.forEach(p => {
            // Reusing this.loadedPolicies list or fetching claims?
            // Let's use getActiveClaims if needed, but for now we'll just use what's loaded.
        });

        document.getElementById('modal-save-draft').classList.remove('hidden');
    },

    async saveDraftEstimate() {
        const title = document.getElementById('draft-title-input').value.trim();
        const codes = document.getElementById('draft-codes-hidden').value;
        const claimId = document.getElementById('draft-claim-id').value || null;

        if (!title) return alert("Please enter a title for this draft.");

        try {
            this.showToast("Saving draft...", "info");
            await db.saveDraftEstimate(auth.currentUser.id, title, codes, claimId);
            this.showToast("Draft saved successfully!", "success");
            document.getElementById('modal-save-draft').classList.add('hidden');
            if (this.currentView === 'drafts') this.loadDrafts();
        } catch(e) {
            console.error(e);
            alert("Error saving draft.");
        }
    },

    async loadDrafts() {
        const list = document.getElementById('drafts-list');
        const loading = document.getElementById('drafts-loading');
        
        try {
            loading.classList.remove('hidden');
            list.innerHTML = '';
            
            const drafts = await db.getDraftEstimates(auth.currentUser.id);
            loading.classList.add('hidden');

            if (drafts.length === 0) {
                list.innerHTML = '<li class="empty-state">No drafts saved yet.</li>';
                return;
            }

            drafts.forEach(d => {
                const li = document.createElement('li');
                li.className = 'task-item';
                li.style.flexDirection = 'column';
                li.style.alignItems = 'flex-start';
                li.innerHTML = `
                    <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                        <strong style="color:var(--primary-color);">${this.escapeHTML(d.title)}</strong>
                        <span style="font-size:0.7rem; opacity:0.6;">${new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style="font-family:monospace; font-size:0.75rem; background:rgba(255,255,255,0.05); padding:8px; border-radius:4px; width:100%; margin:8px 0; max-height:100px; overflow-y:auto; white-space:pre-wrap;">${this.escapeHTML(d.codes)}</div>
                    <div style="display:flex; gap:10px; width:100%;">
                        <button class="btn btn-secondary btn-small" style="flex:1" onclick="app.copyText('${d.id}')">Copy Codes</button>
                        <button class="btn btn-danger btn-small" style="background:#442222;" onclick="app.deleteDraft('${d.id}')">Delete</button>
                    </div>
                `;
                // Store actual codes in a hidden way for copy
                li.dataset.codes = d.codes;
                li.id = `draft-${d.id}`;
                list.appendChild(li);
            });
        } catch (e) {
            console.error(e);
            loading.classList.add('hidden');
            list.innerHTML = '<li class="empty-state">Error loading drafts.</li>';
        }
    },

    async deleteDraft(id) {
        if (!confirm("Are you sure you want to delete this draft?")) return;
        try {
            await db.deleteDraftEstimate(id);
            this.showToast("Draft deleted.");
            this.loadDrafts();
        } catch(e) {
            console.error(e);
            alert("Error deleting draft.");
        }
    },

    copyText(id) {
        const el = document.getElementById(`draft-${id}`);
        const codes = el.dataset.codes;
        navigator.clipboard.writeText(codes).then(() => {
            this.showToast("Codes copied to clipboard!");
        });
    },

    // --- CTRE Translator UI Logic ---
    toggleCtreMode() {
        const mode = document.querySelector('input[name="ctre-mode"]:checked').value;
        const sfeBtn = document.getElementById('sfe-upload-btn');
        if (mode === 'compare') {
            sfeBtn.classList.remove('hidden');
        } else {
            sfeBtn.classList.add('hidden');
        }
        this.ctreData = { ctre: null, sfe: null };
        document.getElementById('ctre-preview-container').classList.add('hidden');
        document.getElementById('sfe-status-text').classList.add('hidden');
        document.getElementById('ctre-output-container').classList.add('hidden');
    },

    ctreData: { ctre: null, sfe: null },

    async handleCtreUpload(event, type) {
        const file = event.target.files[0];
        if (!file) return;
        
        const previewContainer = document.getElementById('ctre-preview-container');
        const processBtn = document.getElementById('btn-process-ctre');
        
        previewContainer.classList.remove('hidden');
        processBtn.classList.add('hidden');

        try {
            if (file.type === 'application/pdf') {
                if(typeof pdfjsLib === 'undefined') throw new Error("PDF.js not loaded.");
                const fileReader = new FileReader();
                fileReader.onload = async function() {
                    const typedarray = new Uint8Array(this.result);
                    const pdf = await pdfjsLib.getDocument(typedarray).promise;
                    let fullText = "";
                    for(let i = 1; i <= pdf.numPages; i++){
                        const page = await pdf.getPage(i);
                        const textContent = await page.getTextContent();
                        fullText += textContent.items.map(s => s.str).join(' ') + "\n";
                    }
                    app.ctreData[type] = { type: 'text', content: fullText };
                    app.checkCtreReady(type, processBtn);
                };
                fileReader.readAsArrayBuffer(file);
            } else {
                const reader = new FileReader();
                reader.onload = () => {
                    this.ctreData[type] = { type: 'image', content: reader.result };
                    this.checkCtreReady(type, processBtn);
                };
                reader.readAsDataURL(file);
            }
        } catch (e) {
            console.error("Upload error", e);
            alert("Error loading file. Please try again.");
        }
    },

    checkCtreReady(type, processBtn) {
        if (type === 'sfe') {
            document.getElementById('sfe-status-text').classList.remove('hidden');
        }
        const mode = document.querySelector('input[name="ctre-mode"]:checked').value;
        if (mode === 'translate' && this.ctreData.ctre) {
            processBtn.classList.remove('hidden');
        } else if (mode === 'compare' && this.ctreData.ctre && this.ctreData.sfe) {
            processBtn.classList.remove('hidden');
        }
    },

    async processCtre() {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) return alert("Please configure Grok API Key in Settings.");

        const mode = document.querySelector('input[name="ctre-mode"]:checked').value;
        const processBtn = document.getElementById('btn-process-ctre');
        const outputContainer = document.getElementById('ctre-output-container');
        const transcriptArea = document.getElementById('ctre-transcript');

        // Verify Data
        if (mode === 'translate' && !this.ctreData.ctre) return alert("Upload CTRE first.");
        if (mode === 'compare' && (!this.ctreData.ctre || !this.ctreData.sfe)) return alert("Upload both CTRE and SFE.");

        processBtn.disabled = true;
        processBtn.textContent = "Processing...";
        outputContainer.classList.add('hidden');

        try {
            let prompt = "";
            let contentBlock = [];

            if (mode === 'translate') {
                prompt = "You are an expert Xactimate estimator. Analyze this contractor's estimate (CTRE). Extract each line item and translate it into a valid or best-guess Xactimate category and code. Format your response as a clean, bulleted list: - [CAT] [CODE] [DESCRIPTION]. Provide only the code list.";
            } else {
                prompt = "You are an expert claims adjuster. You are given a Contractor Estimate (CTRE) and a State Farm Estimate (SFE). Compare them. Output EXACTLY what Xactimate codes are missing from the SFE, and any discrepancies in quantities. Format clearly.";
            }

            contentBlock.push({ type: "text", text: prompt });

            // Add CTRE
            if (this.ctreData.ctre.type === 'text') {
                contentBlock.push({ type: "text", text: "CTRE DATA:\\n" + this.ctreData.ctre.content });
            } else {
                const b64 = this.ctreData.ctre.content.split(',')[1] || this.ctreData.ctre.content;
                contentBlock.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } });
            }

            // Add SFE
            if (mode === 'compare' && this.ctreData.sfe) {
                if (this.ctreData.sfe.type === 'text') {
                    contentBlock.push({ type: "text", text: "SFE DATA:\\n" + this.ctreData.sfe.content });
                } else {
                    const b64s = this.ctreData.sfe.content.split(',')[1] || this.ctreData.sfe.content;
                    contentBlock.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64s}` } });
                }
            }

            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: [{ role: 'user', content: contentBlock }],
                    temperature: 0.1
                })
            });

            if(!response.ok) throw new Error("Grok translation failed.");
            
            const data = await response.json();
            transcriptArea.value = data.choices[0].message.content.trim();
            outputContainer.classList.remove('hidden');

            this.showToast("Analysis Complete");
        } catch (e) {
            console.error(e);
            alert("Error processing estimate. Please check console.");
        } finally {
            processBtn.disabled = false;
            processBtn.textContent = "Generate Xactimate Codes";
        }
    },

    // --- Copilot Chat Logic ---
    copilotHistory: [
        { role: 'system', content: 'You are an elite State Farm property claims adjuster and policy expert. Always answer questions accurately based on State Farm standard operating procedures, policies, and property adjusting best practices. Be concise, authoritative, and helpful.' }
    ],

    async sendCopilotMessage() {
        const inputEl = document.getElementById('copilot-chat-input');
        const text = inputEl.value.trim();
        if(!text) return;

        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) return alert("Please configure Grok API Key in Settings.");

        inputEl.value = '';
        this.appendCopilotMessage('User', text, 'flex-end', 'var(--primary-color)', 'white');
        this.copilotHistory.push({ role: 'user', content: text });

        try {
            const response = await fetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: this.copilotHistory,
                    temperature: 0.2
                })
            });

            if(!response.ok) throw new Error("API Error");
            const data = await response.json();
            const aiText = data.choices[0].message.content.trim();
            
            this.copilotHistory.push({ role: 'assistant', content: aiText });
            this.appendCopilotMessage('SF Copilot', aiText, 'flex-start', 'var(--bg-surface-light)', 'var(--text-primary)');

        } catch (e) {
            console.error(e);
            this.appendCopilotMessage('System', 'Failed to connect to SF Copilot.', 'flex-start', 'var(--danger-color)', 'white');
        }
    },

    appendCopilotMessage(sender, text, align, bg, color) {
        const historyEl = document.getElementById('copilot-chat-history');
        if (!historyEl) return;
        const div = document.createElement('div');
        div.style.alignSelf = align;
        div.style.background = bg;
        div.style.color = color;
        div.style.padding = '10px 15px';
        div.style.borderRadius = '12px';
        div.style.maxWidth = '85%';
        div.style.lineHeight = '1.4';
        
        let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        div.innerHTML = `<strong>${sender}:</strong> <br/>${formattedText}`;
        
        historyEl.appendChild(div);
        historyEl.scrollTop = historyEl.scrollHeight;
    },

    // --- Playbooks Logic ---
    loadPlaybook(type) {
        const area = document.getElementById('playbook-content-area');
        const title = document.getElementById('playbook-title');
        const list = document.getElementById('playbook-checklist');
        
        area.classList.remove('hidden');
        list.innerHTML = '';
        
        const playbooks = {
            'water': {
                title: 'Water Loss Procedures',
                checks: [
                    'Ensure safety and mitigate further damage (Stop Source).',
                    'Identify source of water and exact time of loss.',
                    'Classify Category (1, 2, or 3).',
                    'Document age of home. Pre-1980 mandates Asbestos/Lead check before tear out.',
                    'Did you bag an ITEL sample for flooring or siding if unsalvageable?',
                    'Take overview photos of the room before tearing out.',
                    'For each room: Detail what was removed, why, and dimensions.',
                    'Confirm drying equipment logs (Dehus, Fans) and days running.'
                ]
            },
            'wind': {
                title: 'Wind & Hail Procedures',
                checks: [
                    'Determine Date of Loss via weather history.',
                    'Inspect all elevations for collateral damage (Spatter, Dents).',
                    'Complete a standard 10x10 Test Square on all slopes.',
                    'Identify shingle type, layers, and age.',
                    'Document underlayment type and local code upgrades required.',
                    'Check for discontinued siding / ITEL requirement.',
                    'Photograph roof pitch, drip edge, and valley metal.'
                ]
            },
            'fire': {
                title: 'Fire & Smoke Procedures',
                checks: [
                    'Official Cause & Origin report obtained or requested?',
                    'Assess structural safety before entering.',
                    'Scope for smoke web vs soot vs direct charring.',
                    'HVAC system flagged for cleaning & duct inspection?',
                    'Inventory total loss personal property separately.',
                    'Check electrical wiring impacts.',
                    'Address ozone treatments, encapsulation, or sealing needs.'
                ]
            }
        };

        const data = playbooks[type];
        if (!data) return;

        title.textContent = data.title;
        data.checks.forEach(check => {
            const div = document.createElement('div');
            div.style.display = 'flex';
            div.style.gap = '10px';
            div.style.alignItems = 'flex-start';
            div.innerHTML = `<input type="checkbox" style="margin-top:4px;"> <span>${check}</span>`;
            list.appendChild(div);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
