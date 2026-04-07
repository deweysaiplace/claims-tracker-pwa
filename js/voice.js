window.voiceModule = {
    recognition: null,
    isRecording: false,
    finalTranscript: '',
    interimTranscript: '',
    targetElementId: null,

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("Speech Recognition API is not supported in this browser.");
            alert("Voice dictation is not supported in this browser. Please use a supported browser like Chrome or Safari.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isRecording = true;
            this.updateUIStatus(true);
            this.finalTranscript = '';
        };

        this.recognition.onresult = (event) => {
            this.interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    this.finalTranscript += event.results[i][0].transcript;
                } else {
                    this.interimTranscript += event.results[i][0].transcript;
                }
            }
            
            this.updateTranscriptUI();
        };

        this.recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error);
            this.stopRecording();
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            this.updateUIStatus(false);
            
            // Trigger finish for Brain Dump
            if (this.targetElementId === 'global-brain-dump') {
                if (window.app && typeof window.app.finishBrainDump === 'function') {
                    window.app.finishBrainDump(this.finalTranscript);
                }
            }
        };

        this.bindEvents();
    },

    bindEvents() {
        // Voicemail page buttons
        const voicemailRecordBtn = document.getElementById('btn-toggle-record');
        if (voicemailRecordBtn) {
            voicemailRecordBtn.addEventListener('click', () => {
                this.targetElementId = 'live-transcript';
                this.toggleRecording();
            });
        }

        // Brain record btn
        const brainRecordBtn = document.getElementById('btn-brain-record');
        if (brainRecordBtn) {
            brainRecordBtn.addEventListener('click', () => {
                this.targetElementId = 'brain-transcript';
                this.toggleRecording();
            });
        }
        
        // Summary dictate record btn
        const summaryRecordBtn = document.getElementById('btn-summary-record');
        if (summaryRecordBtn) {
            summaryRecordBtn.addEventListener('click', () => {
                this.targetElementId = 'summary-transcript';
                this.toggleRecording();
            });
        }
        
        // Modal task voice button
        document.querySelectorAll('.voice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Ensure this is only for the modal task to avoid conflicts
                if (btn.closest('#modal-new-task')) {
                    this.targetElementId = 'task-desc';
                    this.toggleRecording();
                }
            });
        });
    },

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    },

    startRecording() {
        if (this.recognition && !this.isRecording) {
            // Haptic Feedback
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50); // Short pulse
            }
            this.finalTranscript = document.getElementById(this.targetElementId)?.value || '';
            this.recognition.start();
        }
    },

    stopRecording() {
        if (this.recognition && this.isRecording) {
            // Haptic Feedback
            if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate([30, 30]); // Double pulse tap
            }
            this.recognition.stop();
        }
    },

    updateUIStatus(isRecording) {
        // Update Voicemail View UI
        const toggleBtn = document.getElementById('btn-toggle-record');
        const pulseRing = document.querySelector('.pulse-ring');
        const statusText = document.getElementById('voice-status-text');
        const postActions = document.getElementById('post-record-actions');
        
        if (toggleBtn && this.targetElementId === 'live-transcript') {
            if (isRecording) {
                toggleBtn.textContent = 'Stop Recording';
                toggleBtn.classList.replace('btn-primary', 'btn-danger'); // Add btn-danger to css later
                if(pulseRing) pulseRing.classList.remove('hidden');
                if(statusText) statusText.textContent = 'Listening...';
                if(postActions) postActions.classList.add('hidden');
            } else {
                toggleBtn.textContent = 'Start Recording';
                toggleBtn.classList.replace('btn-danger', 'btn-primary');
                if(pulseRing) pulseRing.classList.add('hidden');
                if(statusText) statusText.textContent = 'Tap to start recording';
                if(postActions && this.finalTranscript.trim().length > 0) {
                    postActions.classList.remove('hidden');
                }
            }
        }
        
        // Update Summary View UI
        const summaryBtn = document.getElementById('btn-summary-record');
        const summaryPulse = document.getElementById('summary-pulse-ring');
        const summaryStatus = document.getElementById('summary-status-text');
        
        if (summaryBtn && this.targetElementId === 'summary-transcript') {
            if (isRecording) {
                summaryBtn.innerHTML = '<span class="material-symbols-outlined">stop</span> Stop Dictating';
                summaryBtn.classList.replace('btn-primary', 'btn-danger');
                if(summaryPulse) summaryPulse.classList.remove('hidden');
                if(summaryStatus) summaryStatus.textContent = 'Listening to your dictation...';
            } else {
                summaryBtn.innerHTML = '<span class="material-symbols-outlined">mic</span> Start Dictating';
                summaryBtn.classList.replace('btn-danger', 'btn-primary');
                if(summaryPulse) summaryPulse.classList.add('hidden');
                if(summaryStatus) summaryStatus.textContent = 'Tap to start dictating';
            }
        }
        
        // Update Brain UI
        const brainBtn = document.getElementById('btn-brain-record');
        if (brainBtn && this.targetElementId === 'brain-transcript') {
            if (isRecording) {
                brainBtn.innerHTML = '<span class="material-symbols-outlined">stop</span> Stop Listening';
                brainBtn.classList.replace('btn-primary', 'btn-danger');
            } else {
                brainBtn.innerHTML = '<span class="material-symbols-outlined">mic</span> Start Listening';
                brainBtn.classList.replace('btn-danger', 'btn-primary');
            }
        }

        // Update Brain Dump FAB UI
        const fab = document.getElementById('btn-global-brain-dump');
        const fabPulse = document.getElementById('brain-dump-pulse');
        if (fab && this.targetElementId === 'global-brain-dump') {
            if (isRecording) {
                fab.classList.add('recording-active');
                if(fabPulse) fabPulse.classList.remove('hidden');
            } else {
                fab.classList.remove('recording-active');
                if(fabPulse) fabPulse.classList.add('hidden');
            }
        }
    },

    updateTranscriptUI() {
        if (!this.targetElementId) return;
        const targetEl = document.getElementById(this.targetElementId);
        if (targetEl) {
            // Capitalize first letter and add period if basic logic applies
            targetEl.value = this.finalTranscript + this.interimTranscript;
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    voiceModule.init();
});
