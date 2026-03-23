const app = {
    currentView: 'home',
    currentClaimId: null,
    currentVisionBase64: [], // Modified to array
    currentEstimateBase64: null,
    currentScanPages: [],
    scannedImagesCount: 0,
    loadedPolicies: [],

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
            'settings': 'Settings',
            'vision': 'AI Vision',
            'policy-chat': 'Policy Chat',
            'weather': 'Weather Check'
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
        
        try {
            btn.innerHTML = `<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Analyzing ${this.currentVisionBase64.length} Photos...`;
            btn.disabled = true;
            
            const result = await aiBrain.analyzeImage(this.currentVisionBase64);
            transcript.value = result;
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
            btn.innerHTML = '<span class="material-symbols-outlined" style="animation: spin 2s linear infinite;">sync</span> Pulling Data...';
            btn.disabled = true;
            outBox.classList.add('hidden');

            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1`);
            const geoData = await geoRes.json();
            if(!geoData.results || geoData.results.length === 0) throw new Error("Could not find that location.");
            const loc = geoData.results[0];

            const weatherRes = await fetch(`https://archive-api.open-meteo.com/v1/archive?latitude=${loc.latitude}&longitude=${loc.longitude}&start_date=${date}&end_date=${date}&daily=weather_code,temperature_2m_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=auto`);
            const weatherData = await weatherRes.json();

            if(!weatherData.daily) throw new Error("No weather data found for this date.");
            
            const w = weatherData.daily;
            textEl.value = `📍 Location: ${loc.name}, ${loc.admin1 || ''}\\n📅 Date: ${date}\\n\\n🌪️ Max Wind Speed: ${w.wind_speed_10m_max[0]} km/h\\n🌬️ Max Wind Gusts: ${w.wind_gusts_10m_max[0]} km/h\\n🌧️ Precipitation: ${w.precipitation_sum[0]} mm\\n🌡️ Max Temp: ${w.temperature_2m_max[0]}°C`;
            outBox.classList.remove('hidden');
        } catch(e) {
            console.error(e);
            alert(e.message);
        } finally {
            btn.innerHTML = origBtnText;
            btn.disabled = false;
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
    }
};

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
