/**
 * ANSI/IICRC S500 2021 Water Mitigation Equipment Calculator
 * Core Engine & Voice Wizard
 */

const waterMit = {
    rooms: [],
    claimId: '',
    wizardActive: false,
    wizardStep: 0,
    
    // Wizard States
    steps: [
        { key: 'claimId', prompt: 'What is the full Claim Number?', type: 'text' },
        { key: 'roomName', prompt: 'What is the name of this room?', type: 'text' },
        { key: 'width', prompt: 'What is the room width in feet?', type: 'number' },
        { key: 'length', prompt: 'What is the room length in feet?', type: 'number' },
        { key: 'class', prompt: 'What is the Class of Water? One, two, three, or four?', type: 'number' },
        { key: 'percent', prompt: 'What percentage of the floor is wet?', type: 'number' }
    ],

    init() {
        this.loadData();
    },

    loadData() {
        const saved = localStorage.getItem('mitigation_data');
        if (saved) {
            const data = JSON.parse(saved);
            this.rooms = data.rooms || [];
            this.claimId = data.claimId || '';
        }
    },

    saveData() {
        localStorage.setItem('mitigation_data', JSON.stringify({
            rooms: this.rooms,
            claimId: this.claimId
        }));
    },

    addRoom(data) {
        const room = {
            id: Date.now(),
            name: data.roomName || 'Unknown Room',
            width: parseFloat(data.width) || 0,
            length: parseFloat(data.length) || 0,
            class: parseInt(data.class) || 2,
            percent: parseFloat(data.percent) || 100,
            calculations: this.calculate(data)
        };
        this.rooms.push(room);
        this.saveData();
        return room;
    },

    calculate(data) {
        const w = parseFloat(data.width) || 0;
        const l = parseFloat(data.length) || 0;
        const c = parseInt(data.class) || 2;
        const p = (parseFloat(data.percent) || 100) / 100;
        const h = 8; // Default ceiling height

        const sf = w * l;
        const vol = sf * h;
        const lf = (w * 2) + (l * 2);

        // IICRC S500 2021 Airmover SF Method (Affected SF / 60 avg)
        const airmoversSF = Math.ceil((sf * p) / 60);
        
        // IICRC S500 2021 Dehu LGR Pints/Day
        let dehuPints = 0;
        switch(c) {
            case 1: dehuPints = vol / 100; break;
            case 2: dehuPints = vol / 40; break;
            case 3: dehuPints = vol / 30; break;
            case 4: dehuPints = vol / 25; break;
        }

        return {
            sf,
            vol,
            lf,
            airmovers: airmoversSF,
            dehu: Math.ceil(dehuPints)
        };
    },

    // --- Voice Wizard ---

    async startWizard() {
        this.wizardActive = true;
        this.wizardStep = 0;
        this.tempRoom = {};
        this.nextStep();
    },

    speak(text) {
        const msg = new SpeechSynthesisUtterance(text);
        msg.rate = 1.1;
        window.speechSynthesis.speak(msg);
    },

    nextStep() {
        if (this.wizardStep < this.steps.length) {
            const step = this.steps[this.wizardStep];
            this.speak(step.prompt);
            
            // Set UI indicator
            document.dispatchEvent(new CustomEvent('wizard-prompt', { detail: { ...step, index: this.wizardStep } }));

            // Start recording after brief delay for speech
            setTimeout(() => {
                if (this.wizardActive) {
                    window.voiceModule.targetElementId = 'mitigation-wizard';
                    window.voiceModule.startRecording();
                }
            }, 2500); 
        } else {
            // Finished room
            this.addRoom(this.tempRoom);
            this.speak("Room added. Would you like to add another room, or finish?");
            this.wizardActive = false;
            document.dispatchEvent(new Event('mitigation-updated'));
        }
    },

    handleVoiceInput(transcript) {
        if (!this.wizardActive) return;

        const step = this.steps[this.wizardStep];
        let val = transcript.trim();

        if (step.type === 'number') {
            // Pick out numbers
            const matches = val.match(/\d+/);
            val = matches ? matches[0] : val;
        }

        if (step.key === 'claimId') {
            this.claimId = val;
            document.getElementById('mit-claim-display').textContent = val;
        } else {
            this.tempRoom[step.key] = val;
        }

        this.wizardStep++;
        
        // Brief pause to allow "Stop Recording" to finish UI changes
        setTimeout(() => this.nextStep(), 500);
    },

    // --- Reporting ---

    async generatePDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const last4 = this.claimId.slice(-4);

        doc.setFontSize(18);
        doc.text("ANSI/IICRC S500 2021 Mitigation Report", 10, 20);
        doc.setFontSize(12);
        doc.text(`Claim ID: ${this.claimId}`, 10, 30);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 37);

        let y = 50;
        this.rooms.forEach((r, i) => {
            doc.setFont("helvetica", "bold");
            doc.text(`${i+1}. ${r.name}`, 10, y);
            doc.setFont("helvetica", "normal");
            doc.text(`   Dims: ${r.width}' x ${r.length}' (${r.calculations.sf} SF)`, 10, y + 7);
            doc.text(`   Equipment: ${r.calculations.airmovers} Airmovers, ${r.calculations.dehu} Pints Dehu`, 10, y + 14);
            y += 25;
        });

        const filename = `Mitigation_Report_${last4}.pdf`;
        doc.save(filename);
        return filename;
    },

    emailReport() {
        const last4 = this.claimId.slice(-4);
        const recipient = "jason.deuermeyer.xm1g@statefarm.com";
        const subject = `Mitigation Report - Claim XXXX${last4}`;
        const body = `Hi Jason,\n\nI have generated the IICRC S500 Mitigation report for Claim ${this.claimId}.\n\nPlease find the data summary below:\n\n` + 
            this.rooms.map(r => `${r.name}: ${r.calculations.airmovers} AM, ${r.calculations.dehu} Dehu`).join('\n') + 
            `\n\nBest regards,\nClaims Experience PWA`;

        window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }
};
