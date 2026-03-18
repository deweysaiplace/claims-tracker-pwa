const voiceModule = {
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
            // Optionally auto-restart if we want continuous listening
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
        
        // Modal task voice button
        document.querySelectorAll('.voice-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                this.targetElementId = 'task-desc';
                this.toggleRecording();
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
            this.finalTranscript = document.getElementById(this.targetElementId)?.value || '';
            this.recognition.start();
        }
    },

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    },

    updateUIStatus(isRecording) {
        // Update Voicemail View UI
        const toggleBtn = document.getElementById('btn-toggle-record');
        const pulseRing = document.querySelector('.pulse-ring');
        const statusText = document.getElementById('voice-status-text');
        const postActions = document.getElementById('post-record-actions');
        
        if (toggleBtn) {
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
