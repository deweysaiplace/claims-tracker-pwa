window.waterLossAgent = {
    isDictating: false,
    photos: [],

    getSystemPrompt() {
        return `You are a water-loss estimating copilot for a property claims adjuster that works for State Farm.

Your job is to take field notes, dictated inspection observations, measurements, and policy excerpts, then convert them into a structured draft scope for estimate building in Xactimate.

You are not the final decision-maker. You do not make coverage decisions, and you do not finalize estimates. You suggest likely scope items, likely Xactimate-style code candidates, and missing-info questions for adjuster review. 

PRIMARY GOALS
1. Convert messy inspection notes into a clean, room-by-room damage scope.
2. Suggest likely estimate items and Xactimate-style code candidates that would look familiar to an experienced property adjuster.
3. Identify missing details that could materially change pricing, quantity, category, or repair-vs-replace decisions.
4. Separate observed damage from assumptions.
5. Flag possible policy or coverage issues for manual adjuster review only.
6. Help the adjuster move faster from inspection notes to estimate draft.

INPUTS YOU MAY RECEIVE
- Dictated inspection notes.
- Room-by-room observations.
- Measurements or dimensions.
- Photos summarized in text by the adjuster.
- Policy excerpts or endorsements.
- Moisture/mold/dry-out notes.
- Contractor or insured statements.
- Prior estimate fragments or line items.

HOW TO THINK
- Focus first on scope clarity, then line-item suggestions, then follow-up questions.
- Use plain, practical estimating language.
- Stay conservative where facts are unclear.
- Do not invent facts, dimensions, or damages that were not provided.
- If details are missing, say so clearly.
- If multiple scope paths are possible, present the most likely options and explain what detail would decide between them.
- Treat line item suggestions as candidates for adjuster review, not as final selections.

WHEN REVIEWING A WATER LOSS
Analyze for:
- Source of loss.
- Category if stated or inferable from the notes, but label inference clearly.
- Duration/suddenness if stated.
- Areas affected.
- Materials affected.
- Repair vs replace decision points.
- Tear-out and access needs.
- Detach/reset opportunities.
- Dry-out related impacts.
- Baseboard, insulation, drywall, paint, flooring, subfloor, cabinetry, trim, vanity, countertop, doors, and fixtures.
- Matching or continuity concerns if noted.
- Whether damage is direct, consequential, or unclear.
- Whether something appears wet, stained, swollen, deteriorated, delaminated, warped, contaminated, or unaffected.

OUTPUT FORMAT
Always respond in this structure unless the adjuster requests a different format:

1. LOSS SNAPSHOT
- Brief description of what happened.
- Date/source/cause details if provided.
- Any major uncertainty.

2. ROOM-BY-ROOM SCOPE
For each room or area:
- Observed damage.
- Likely repair actions.
- Likely replace actions.
- Likely detach/reset items.
- Measurements provided.
- Missing measurements or facts needed.

3. LIKELY LINE ITEMS (JSON BLOCK)
At the end of your response, you MUST output a raw JSON array block wrapped in <ESTIMATE_ITEMS> and </ESTIMATE_ITEMS> tags. 
Do not include formatting backticks around the json inside the tag.
Provide a list of recommended repair operations. The PWA will use this block to map these operations to actual Xactimate codes.
Format exactly like this:
<ESTIMATE_ITEMS>
[
  {"room": "Living Room", "operation": "Tear out and bag drywall", "reason": "Mentioned 2ft flood cut", "confidence": "High"}
]
</ESTIMATE_ITEMS>

4. PROCEDURAL BLIND SPOT SCANNER [🚨 CRITICAL]
- Cross-reference the notes against standard State Farm water loss procedures.
- If the notes omit critical procedural mandates for this loss, display a glaring red [🚨 BLIND SPOT WARNING].
- Critical mandates to check for include:
  * Was the exact source of water identified and stopped?
  * Was the Category (1/2/3) explicitly established?
  * If the home is pre-1980, did they mention bagging an ITEL, asbestos, or lead test?
  * Are baseboards pulled/tested?
  * Are drying logs/dehumidifiers mentioned?
- If all procedural mandates appear accounted for, output "No blind spots detected."

5. ESTIMATE BUILD NOTES
- Items likely needed for setup, protection, manipulation, detach/reset, access, masking, cleaning, sealing, painting, finish matching, or moisture-related work.
- Notes that would help the adjuster build the estimate faster.

5. COVERAGE / POLICY REVIEW FLAGS
- List possible issues for manual review only.
- Never decide coverage.
- Examples: repeated seepage wording, rot/deterioration indicators, mold limitations, wear/tear overlap, vacancy, matching language, tear-out language, ensuing loss considerations.

6. FOLLOW-UP QUESTIONS
Ask only the most important unanswered questions that would materially change the estimate.
Keep this concise and practical.

7. DRAFT SUMMARY FOR FILE
- A short professional summary the adjuster can paste into claim notes.

RULES FOR LINE ITEMS
- Use Xactimate-style wording and code patterns only as practical estimate-building suggestions.
- Do not pretend certainty where none exists.
- If you are unsure of the best code, provide 2-3 likely candidates and explain the difference.
- Do not over-scope.
- Do not omit common supporting items if they are reasonably implied by the facts.
- Distinguish between detach/reset and replace.
- Distinguish between wet but salvageable vs non-salvageable materials.

RULES FOR POLICY
- If policy text is provided, summarize relevant considerations neutrally.
- Do not deny, extend, or interpret coverage definitively.
- Say "review required" whenever policy application is uncertain.

TONE
- Think like a seasoned field adjuster helping another adjuster.
- Be concise, organized, and practical.
- Avoid legalistic language unless quoting policy text.

IF THE USER PASTES NOTES
Start by organizing the loss, then produce the full output.

IF THE USER PASTES ONLY ROUGH NOTES
Do your best with the facts given, but prominently list missing details.

IF THE USER ASKS FOR A QUICK VERSION
Return:
- Loss snapshot.
- Room-by-room scope.
- Likely code candidates.
- Top 5 follow-up questions.

NEVER
- Never fabricate measurements.
- Never make final coverage decisions.
- Never present code suggestions as guaranteed correct.
- Never confuse insured statements with confirmed observations.`;
    },

    toggleDictation() {
        if (!window.voiceModule) return alert("Microphone system not initialized.");
        if (this.isDictating) {
            window.voiceModule.stopRecording();
            this.isDictating = false;
            document.getElementById('wl-dictate-icon').classList.remove('pulse');
            document.getElementById('wl-dictate-icon').style.color = "var(--primary-color)";
        } else {
            this.openTextInput();
            window.voiceModule.startRecording('wl-live-transcript', true); // Append mode
            this.isDictating = true;
            document.getElementById('wl-dictate-icon').classList.add('pulse');
            document.getElementById('wl-dictate-icon').style.color = "var(--danger-color)";
        }
    },

    openTextInput() {
        document.getElementById('wl-active-input-area').classList.remove('hidden');
        document.getElementById('wl-live-transcript').focus();
    },

    handlePhotos(event) {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        
        // Show input area to indicate we got photos
        this.openTextInput();
        const liveTranscript = document.getElementById('wl-live-transcript');
        
        let processedCount = 0;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const base64 = e.target.result;
                this.photos.push(base64);
                processedCount++;
                if (processedCount === files.length) {
                    liveTranscript.value += `\n[Attached ${files.length} Photo(s) for AI Analysis]\n`;
                    app.hapticClick();
                }
            };
            reader.readAsDataURL(file);
        });
    },

    async processInput() {
        const text = document.getElementById('wl-live-transcript').value.trim();
        if (!text && this.photos.length === 0) {
            alert("Please dictate notes, type text, or upload photos first.");
            return;
        }

        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) {
            alert("No Grok API key found. Please define it in Settings.");
            return;
        }

        const loading = document.getElementById('wl-loading');
        const outputContainer = document.getElementById('wl-draft-output-container');
        const renderedScope = document.getElementById('wl-rendered-scope');
        const btnProcess = document.getElementById('btn-wl-process');

        loading.classList.remove('hidden');
        outputContainer.classList.add('hidden');
        btnProcess.disabled = true;

        // Construct context message block
        const messages = [
            { role: 'system', content: this.getSystemPrompt() }
        ];

        let contentBlock = [
            { type: "text", text: "Here is the inspection data. Please generate the draft scope: " + text }
        ];

        // Add photos to the request if they exist
        if (this.photos.length > 0) {
            this.photos.forEach(base64 => {
                const base64Clean = base64.split(',')[1] || base64;
                contentBlock.push({
                    type: "image_url",
                    image_url: {
                        url: `data:image/jpeg;base64,${base64Clean}`
                    }
                });
            });
        }

        messages.push({ role: 'user', content: contentBlock });

        try {
            const response = await window.aiBrain.safeFetch('https://api.x.ai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4',
                    messages: messages
                })
            });

            const data = await response.json();

            if (!response.ok) {
                const errText = await response.text();
                throw new Error("Grok AI Error: " + errText);
            }

            let resultText = data.choices[0].message.content.trim();

            // Extract ESTIMATE_ITEMS JSON
            let estimateItems = [];
            const itemsMatch = resultText.match(/<ESTIMATE_ITEMS>\s*([\s\S]*?)\s*<\/ESTIMATE_ITEMS>/);
            if (itemsMatch) {
                try {
                    estimateItems = JSON.parse(itemsMatch[1].trim());
                    resultText = resultText.replace(itemsMatch[0], ''); // Remove from markdown
                } catch(e) {
                    console.error("Failed to parse estimate items JSON", e);
                }
            }

            this.currentDraftOutput = resultText.trim();
            
            // Simple markdown rendering to HTML (since no markdown parser library is imported)
            let htmlFormatted = resultText
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/### (.*?)\n/g, '<h4 style="margin: 10px 0 5px 0;">$1</h4>')
                .replace(/## (.*?)\n/g, '<h3 style="margin: 15px 0 5px 0; color: var(--primary-color); border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">$1</h3>')
                .replace(/# (.*?)\n/g, '<h2 style="margin: 20px 0 5px 0; color: var(--primary-color);">$1</h2>')
                .replace(/- (.*?)(\n|$)/g, '<li style="margin-left: 20px;">$1</li>')
                .replace(/\n/g, '<br>');

            if (estimateItems && estimateItems.length > 0) {
                htmlFormatted += `<div class="zero-hallucination-table" style="margin-top: 30px;">
                    <h3 style="color: var(--primary-color); margin-bottom: 10px;"><i class="fas fa-microchip"></i> Zero-Hallucination Scope Translator</h3>
                    <p style="font-size: 0.85em; color: var(--text-muted); margin-bottom: 15px;">Locally verified against 14,000+ Xactimate codes. Will force manual selection if AI intent is ambiguous.</p>
                    <div style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-color); border-radius: 8px; padding: 10px; overflow-x: auto;">
                        <table style="width: 100%; text-align: left; border-collapse: collapse; min-width: 600px;">
                            <thead>
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); font-size: 0.85em; text-transform: uppercase;">
                                    <th style="padding: 10px;">Room</th>
                                    <th style="padding: 10px;">AI Operation Intent</th>
                                    <th style="padding: 10px;">Verified Xactimate Code</th>
                                </tr>
                            </thead>
                            <tbody>`;
                            
                for (let i = 0; i < estimateItems.length; i++) {
                    const item = estimateItems[i];
                    // Call the local search
                    const matches = window.app.searchXactimate(item.operation, 10);
                    let controlHtml = `<span style="color: var(--danger-color); font-size: 0.9em;">[No Valid Match In Database]</span>`;
                    
                    if (matches.length > 0) {
                        // High confidence if score >= 3 AND significantly beats alternatives
                        if (matches[0].score >= 3 && (matches.length === 1 || matches[0].score > matches[1].score + 2)) {
                            controlHtml = `<div style="display: flex; flex-direction: column; gap: 4px;">
                                <span style="color: var(--success-color); font-weight: bold; background: rgba(0,255,100,0.1); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(0,255,100,0.3); display: inline-block; width: fit-content;"><i class="fas fa-check-circle"></i> ${matches[0].item.code}</span>
                                <span style="font-size: 0.8em; color: var(--text-muted);">${matches[0].item.desc}</span>
                            </div>`;
                        } else {
                            // Ambiguous: Requires Adjuster Selection
                            controlHtml = `<select style="background: var(--input-bg); color: var(--text-color); border: 1px solid var(--border-color); padding: 5px; border-radius: 4px; border-left: 3px solid var(--warning-color); font-size: 0.85em; max-width: 250px;">
                                <option value="">[🫵 REQUIRES ADJUSTER SELECTION]</option>
                                ${matches.map(m => `<option value="${m.item.code}">${m.item.code} - ${m.item.desc}</option>`).join('')}
                            </select>`;
                        }
                    }

                    htmlFormatted += `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <td style="padding: 10px; font-weight: bold; font-size: 0.9em; vertical-align: top;">${item.room || '-'}</td>
                            <td style="padding: 10px; vertical-align: top;">
                                <span style="font-size: 0.95em;">${item.operation}</span><br>
                                <span style="font-size: 0.8em; color: var(--text-muted);"><i class="fas fa-info-circle"></i> ${item.reason || ''}</span>
                            </td>
                            <td style="padding: 10px; vertical-align: top;">${controlHtml}</td>
                        </tr>
                    `;
                }
                
                htmlFormatted += `</tbody></table></div></div>`;
            }

            renderedScope.innerHTML = htmlFormatted;
            
            outputContainer.classList.remove('hidden');
            
            // Cleanup input fields after successful processing
            document.getElementById('wl-live-transcript').value = '';
            this.photos = [];
        } catch (error) {
            console.error("Water Loss Agent Error:", error);
            alert("Error processing Water Loss data. Please try again or check connection.");
        } finally {
            loading.classList.add('hidden');
            btnProcess.disabled = false;
        }
    },

    copyScope() {
        if (!this.currentDraftOutput) return;
        navigator.clipboard.writeText(this.currentDraftOutput).then(() => {
            alert("Scope copied to clipboard!");
            app.hapticClick();
        });
    },

    saveAsDraft() {
        if (!this.currentDraftOutput) return;
        const claimId = document.getElementById('water-loss-claim-id').value;
        const claimText = document.getElementById('water-loss-claim-id').options[document.getElementById('water-loss-claim-id').selectedIndex].text;
        
        let titleName = "Water Loss Scope";
        if (claimId) {
            titleName = claimText + " - Water Loss Scope";
        } else {
            const result = prompt("Enter a title for this draft:");
            if (!result) return;
            titleName = result;
        }

        // Send to supabase Drafts schema
        db.saveDraft(auth.currentUser.id, claimId || null, titleName, this.currentDraftOutput)
            .then(() => {
                alert("Scope saved to Drafts!");
                app.loadData();
            })
            .catch(err => {
                console.error("Draft Save fail:", err);
                alert("Failed to save draft.");
            });
    }
};
