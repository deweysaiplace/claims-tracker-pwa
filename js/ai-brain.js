window.aiBrain = {
    apiUrl: 'https://api.x.ai/v1/chat/completions',
    
    getApiKey() {
        let key = localStorage.getItem('GROK_API_KEY');
        if (!key) {
            key = prompt("Please enter your xAI Grok API Key to use the Brain feature:");
            if (key) {
                localStorage.setItem('GROK_API_KEY', key.trim());
            }
        }
        return key;
    },
    
    async processCommand(text, activeClaims) {
        if (!text.trim()) return null;
        
        const apiKey = this.getApiKey();
        if (!apiKey) {
            alert("The AI Brain needs an xAI API Key to function.");
            return null;
        }
        
        // Serialize the claims to give Grok context
        let safeClaims = [];
        if (activeClaims && activeClaims.length > 0) {
            safeClaims = activeClaims.map(c => ({
                id: c.id,
                claim_number: c.claim_number,
                insured_name: c.insured_name
            }));
        }

        const systemPrompt = `You are the AI Brain for a claims adjuster app. 
You are given the user's spoken command and a list of their active claims.
Your job is to determine what action they want to perform and on which claim.

User's Active Claims:
${JSON.stringify(safeClaims)}

ACTIONS YOU CAN TAKE:
1. "create_task": If the user wants to add a task, reminder, or note to do something (e.g. "Remind me to call John", "Add task to pull the roof").
2. "unknown": If you are completely unsure what they want.

You must reply with ONLY a JSON object exactly adhering to this format:
{
    "action": "create_task" | "unknown",
    "claim_id": "UUID_OF_CLAIM_HERE or null if general task/no specific claim found",
    "task_description": "A concise, detailed description of the task string, or null",
    "message": "A friendly confirmation to the user, like 'Added task for Kevin.' or 'I didn't understand that.'"
}
Do NOT wrap the JSON in markdown blocks. Return the raw JSON block directly.`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-beta',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error("Grok API Error:", errText);
                throw new Error("Failed connecting to Grok Brain API.");
            }

            const data = await response.json();
            let contentString = data.choices[0].message.content.trim();
            
            // Clean up Markdown if returned
            if (contentString.startsWith('\`\`\`json')) {
                contentString = contentString.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
            } else if (contentString.startsWith('\`\`\`')) {
                contentString = contentString.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
            }
            
            return JSON.parse(contentString);

        } catch (error) {
            console.error("Brain Parsing Error:", error);
            throw error;
        }
    },

    async processXactimate(text) {
        if (!text.trim()) return null;
        
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("No API key provided.");

        const systemPrompt = `You are an expert Xactimate estimator. 
Analyze the following dictated inspection summary.
Extract the corresponding Xactimate line-item codes and material descriptions.
Return your answer as a clean, concise bulleted list of the codes and short descriptions. 
Ignore quantities unless explicitly dictated.
Output ONLY the bulleted list, no conversational filler.`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-beta',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: text }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error("Grok API Error:", errText);
                throw new Error("Failed connecting to Grok Brain API.");
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("Xactimate Parse Error:", error);
            throw error;
        }
    },
    
    async analyzeImage(base64DataUrl) {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("Please save your API key in the Settings tab.");

        // Clean base64 string
        const base64Image = base64DataUrl.split(',')[1];
        if (!base64Image) throw new Error("Invalid image format");

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    // Use stable version
                    model: 'grok-2-vision-1212',
                    messages: [
                        { 
                            role: 'user', 
                            content: [
                                {
                                    type: "text",
                                    text: "You are an expert claims adjuster. Analyze these photos. List any visible damage (hail, wind, water, wear and tear) and its severity. Be concise and professional."
                                },
                                // Map over base64DataUrls if it's an array
                                ...(Array.isArray(base64DataUrl) ? base64DataUrl : [base64DataUrl]).map(item => ({
                                    type: "image_url",
                                    image_url: {
                                        url: item.startsWith('data:') ? item : `data:image/jpeg;base64,${item}`
                                    }
                                }))
                            ]
                        }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error("Grok Vision API Error: " + errText);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("Vision Error:", error);
            throw error;
        }
    },
    
    async askPolicy(pdfText, question) {
        if (!pdfText.trim() || !question.trim()) return null;
        
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("Please save your API key in the Settings tab.");

        const systemPrompt = `You are a strict and highly knowledgeable insurance policy analyst. 
You will be provided with the raw extracted text of an insurance policy document, followed by a user's question.
Base your answer STRICTLY on the provided policy text. Do not invent coverages.
If the answer is not in the policy text, explicitly state that it is not found.
Cite the relevant section if possible.`;

        const userPrompt = `POLICY TEXT:\n---\n${pdfText}\n---\n\nQUESTION: ${question}`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-beta',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error("Grok API Error: " + errText);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("Policy Chat Error:", error);
            throw error;
        }
    },

    async ocrPolicyPage(base64DataUrl) {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("API Key required");

        const base64Image = base64DataUrl.split(',')[1];
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-2-vision-1212',
                    messages: [
                        { 
                            role: 'user', 
                            content: [
                                {
                                    type: "text",
                                    text: "You are a high-precision OCR machine. Extract every single word from this insurance policy page image. Maintain the structure as much as possible but prioritize accuracy of the text. Output ONLY the extracted text, no conversational filler."
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: base64DataUrl.startsWith('data:') ? base64DataUrl : `data:image/jpeg;base64,${base64Image}`
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: 0
                })
            });

            if (!response.ok) throw new Error("Grok OCR Error");
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("OCR Error:", error);
            throw error;
        }
    },

    async analyzeEstimate(base64DataUrl) {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("API Key required");

        const base64Image = base64DataUrl.split(',')[1];
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-2-vision-1212',
                    messages: [
                        { 
                            role: 'user', 
                            content: [
                                {
                                    type: "text",
                                    text: `You are an expert Xactimate estimator. Analyze this contractor's photo/capture of an estimate.
Extract each line item and translate it into a valid or best-guess Xactimate category and code.

Format your response as a clean, bulleted list:
- [CAT] [CODE] [DESCRIPTION]

Category examples: SFG (shingles), DRY (drywall), WTR (water extraction), PNT (painting), etc.
Provide only the code list. If you are unsure of a code, provide the most likely industry standard for that material/labor. No conversational filler.`
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${base64Image}`
                                    }
                                }
                            ]
                        }
                    ],
                    temperature: 0.2
                })
            });

            if (!response.ok) throw new Error("Grok Estimate Analysis Error");
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("Estimate Analysis Error:", error);
            throw error;
        }
    }
};
