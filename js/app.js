const app = {
    currentView: 'home',

    init() {
        this.bindEvents();
        
        // Setup simple navigation
        const hash = window.location.hash.replace('#', '') || 'home';
        this.navigate(hash);
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
            'voice-note': 'Voicemail',
            'dictate-summary': 'Summary',
            'settings': 'Settings'
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
        }
        
        this.currentView = viewId;
        window.location.hash = viewId;
    },

    async loadData() {
        if (!auth.currentUser) return;
        try {
            const claims = await db.getAllClaims(auth.currentUser.id);
            this.renderClaims(claims);
            this.populateClaimDropdown(claims);

            const activeClaims = claims.filter(c => c.status !== 'Closed');
            this.renderActiveClaims(activeClaims);

            const tasks = await db.getTasks(auth.currentUser.id);
            this.renderTasks(tasks);
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

    populateClaimDropdown(claims) {
        const select = document.getElementById('task-claim-id');
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
        const to = 'Jason.deuermeyer.xm1h@statefarm.com'; // Adjust to wherever the feedback goes
        const subject = encodeURIComponent('App Feedback / Issue Report');
        const body = encodeURIComponent('Please describe the issue or feature request:\n\n\n\n---\nApp Version: 1.0.0\nDevice: ' + navigator.userAgent);
        window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
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

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
