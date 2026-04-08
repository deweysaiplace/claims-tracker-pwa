window.aiBrain = {
    apiUrl: 'https://api.x.ai/v1/chat/completions',
    
    getApiKey() {
        let key = localStorage.getItem('GROK_API_KEY');
        if (!key) {
            // Use the hardcoded system key if no user key is provided
            key = 'xai-1dZkQTImZSpmm6clOdE6VIlhXuDwjpXmVjQsPPMPSrK9IJdu0Tb5mwxTJWo4cykYSZH8jd68WPdjulzk';
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
                    model: 'grok-4.20-reasoning', // Latest flagship model (multimodal)
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
        
        const apiKey = this.getApiKey();
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
                    model: 'grok-4.20-reasoning',
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
    
    apiKey: 'xai-1dZkQTImZSpmm6clOdE6VIlhXuDwjpXmVjQsPPMPSrK9IJdu0Tb5mwxTJWo4cykYSZH8jd68WPdjulzk', // DEFAULT KEY

    async analyzeImage(base64DataUrl, promptOverride = null) {
        const apiKey = localStorage.getItem('GROK_API_KEY') || this.apiKey;
        if (!apiKey) throw new Error("API Key required.");

        // Normalize to array for multi-vision support
        const base64Array = Array.isArray(base64DataUrl) ? base64DataUrl : [base64DataUrl];
        
        // Clean all base64 strings
        const cleanedImages = base64Array.map(item => {
            const b64 = item.includes(',') ? item.split(',')[1] : item;
            if (!b64) throw new Error("Invalid image format");
            return b64;
        });

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    // Use stable version
                    model: 'grok-4.20-reasoning',
                    messages: [
                        { 
                            role: 'user', 
                            content: [
                                {
                                    type: "text",
                                    text: "You are an expert claims adjuster. Analyze these photos. List any visible damage (hail, wind, water, wear and tear) and its severity. Be concise and professional."
                                },
                                // Map over cleanedImages
                                ...cleanedImages.map(b64 => ({
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${b64}`
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
                    model: 'grok-4.20-reasoning',
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
                    model: 'grok-4.20-reasoning',
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

            if (!response.ok) {
                const errText = await response.text();
                throw new Error("Grok OCR Error: " + errText);
            }
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("OCR Error:", error);
            throw error;
        }
    },

    async analyzeEstimate(base64DataUrl) {
        const apiKey = localStorage.getItem('GROK_API_KEY') || this.apiKey;
        if (!apiKey) throw new Error("API Key required");

        // Normalize to array for multi-page estimate support
        const base64Array = Array.isArray(base64DataUrl) ? base64DataUrl : [base64DataUrl];
        
        // Clean all base64 strings
        const cleanedImages = base64Array.map(item => {
            const b64 = item.includes(',') ? item.split(',')[1] : item;
            if (!b64) throw new Error("Invalid image format");
            return b64;
        });
        
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
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
                                // Map over all pages/photos
                                ...cleanedImages.map(b64 => ({
                                    type: "image_url",
                                    image_url: {
                                        url: `data:image/jpeg;base64,${b64}`
                                    }
                                }))
                            ]
                        }
                    ],
                    temperature: 0.2
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Grok Estimate Analysis Error (Status ${response.status}): ${errText}`);
            }
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("Estimate Analysis Error:", error);
            throw error;
        }
    },

    async identifyMaterial(base64DataUrl) {
        const apiKey = localStorage.getItem('GROK_API_KEY') || this.apiKey;
        if (!apiKey) throw new Error("API Key required");

        const base64Image = base64DataUrl.split(',')[1];
        
        const prompt = `You are an expert exterior building material specialist and insurance adjuster.
Analyze this photo of a building material (siding, soffit, or fascia).
Identify the following details with high precision:
1. Category: (e.g., Siding, Soffit, Fascia)
2. Material: (e.g., Vinyl, Aluminum, Fiber Cement, Wood, Steel)
3. Profile: (e.g., Double 4", Double 5", Triple 3", Dutch Lap, Beaded, Vented vs Smooth)
4. Texture: (e.g., Woodgrain, Smooth, Cedar Grain)
5. Color: (Provide the most likely matching color name)
6. Suggested Xactimate Code: (The most appropriate line item code, e.g., SDG V4, SFG VSOF, etc.)

Return your response as a raw JSON object only:
{
    "category": "...",
    "material": "...",
    "profile": "...",
    "texture": "...",
    "color": "...",
    "xactimate_code": "..."
}`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: [
                        { 
                            role: 'user', 
                            content: [
                                { type: "text", text: prompt },
                                {
                                    type: "image_url",
                                    image_url: { url: `data:image/jpeg;base64,${base64Image}` }
                                }
                            ]
                        }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error("Grok Material ID Error: " + errText);
            }
            const data = await response.json();
            let content = data.choices[0].message.content.trim();
            
            // Cleanup JSON markdown if present
            if (content.startsWith('```json')) content = content.replace(/^```json\n/, '').replace(/\n```$/, '');
            else if (content.startsWith('```')) content = content.replace(/^```\n/, '').replace(/\n```$/, '');
            
            return JSON.parse(content);
        } catch (error) {
            console.error("Material ID Error:", error);
            throw error;
        }
    },

    async checkDiscontinued(description) {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("API Key required");

        const prompt = `You are an insurance claims resource specialist. 
Check if the following building material is currently DISCONTINUED or AVAILABLE:
"${description}"

Search your internal knowledge for discontinuation notices from major manufacturers (e.g., Alcoa, Mastic, CertainTeed, James Hardie). 
If it is discontinued, explain WHY and if there are known technical matches.
If you are unsure, state that it may require an ITEL report for confirmation.

Provide a concise summary in HTML format (using <b> tags for emphasis).`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3
                })
            });

            if (!response.ok) throw new Error("Grok Availability Error");
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("Availability Error:", error);
            throw error;
        }
    },

    async processWindshieldBrainDump(transcriptionText) {
        if (!transcriptionText) return null;

        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("API Key required");

        const prompt = `You are a professional claims adjuster's AI assistant. 
    Analyze this "windshield time brain dump" dictated while driving.
    Categorize the actionable items into a strict JSON format with these exact keys:
    1. "tasks": Array of objects { "claimName": "Name/ID", "description": "task detail", "priority": 1-3 }
    2. "emails": Array of objects { "recipient": "Name or relation", "content": "Brief email summary to draft" }
    3. "sms": Array of objects { "recipient": "Name or relation", "content": "Brief text message to draft" }
    4. "notes": Array of strings (general thoughts or intel not tied to specific actions)
    
    Transcript: "${transcriptionText}"
    
    Return ONLY JSON. Do not include markdown formatting block.`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: [
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) throw new Error("Grok Brain Dump Error");
            const data = await response.json();
            const result = data.choices[0].message.content.trim();
            const cleaned = result ? result.replace(/```json|```/g, '').trim() : "{}";
            return JSON.parse(cleaned);
        } catch (error) {
            console.error("Error parsing Brain Dump:", error);
            return { tasks: [], emails: [], sms: [], notes: [] };
        }
    },

    async findNearbyPOIs(lat, lng) {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("API Key required");

        let area = "this location";
        try {
            const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const geoData = await geoRes.json();
            const address = geoData.address;
            area = address.city || address.town || address.county || address.state || "this location";
        } catch (e) { console.warn("Reverse geocoding failed", e); }

        const prompt = `You are a local architectural and historical tour guide for ${area}. 
        Identify 10-15 highly notable Points of Interest within a 50-mile radius of latitude ${lat}, longitude ${lng}.
        Categories to focus on: American History, Architectural Sites, Famous/Historic Diners, and Major Landmarks.
        Provide approximate, but highly accurate, latitude and longitude coordinates for each location so they can be plotted on a map.
        
        Return STRICTLY in JSON format:
        {
          "pois": [
            { "name": "Name of Place", "category": "Category", "description": "1-2 sentence compelling hook", "lat": 0.0, "lng": 0.0 }
          ]
        }`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: [ { role: 'user', content: prompt } ],
                    temperature: 0.2
                })
            });

            if (!response.ok) throw new Error("Grok POI Error");
            const data = await response.json();
            const result = data.choices[0].message.content.trim();
            const cleaned = result ? result.replace(/```json|```/g, '').trim() : "{}";
            return JSON.parse(cleaned).pois || [];
        } catch (error) {
            console.error("Error finding POIs:", error);
            return [];
        }
    },

    async analyzeALEPhoto(base64DataUrl) {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("API Key required");

        const base64Image = base64DataUrl.split(',')[1];
        if (!base64Image) throw new Error("Invalid image format");

        const prompt = `You are a specialist in State Farm ALE (Additional Living Expenses) documentation. 
        Analyze this photo of a receipt, document, or computer screen:
        1. **Identify Attachment Type**: (e.g., Meals & Expenses, Lodging, Mileage).
        2. **Extract Figures**: Tally up all dollar amounts and quantities listed.
        3. **Format**: return a structured Markdown summary including:
           - Category Name
           - Total Amount extracted
           - Itemized breakdown of individual entries`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: [
                        { 
                            role: 'user', 
                            content: [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: base64DataUrl.startsWith('data:') ? base64DataUrl : `data:image/jpeg;base64,${base64Image}` } }
                            ]
                        }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) throw new Error("Grok ALE Analysis Error");
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("ALE Analysis Error:", error);
            throw error;
        }
    },

    async processXactimate(prompt) {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("API Key required");

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: [ { role: 'user', content: prompt } ],
                    temperature: 0.1
                })
            });

            if (!response.ok) throw new Error("Grok Xactimate Error");
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("Xactimate Extraction Error:", error);
            throw error;
        }
    },

    async generateBatchVoicemailReport(voicemailsContext) {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("API Key required");

        try {
            const prompt = `You are a claims adjuster assistant.
            Review the following list of transcribed voicemails.
            Generate an urgent "Markdown Priority Callback Table" and summarize the most critical action items.
            Format the response in cleanly formatted Markdown.
            
            Voicemails:
            ${voicemailsContext}`;

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: [ { role: 'user', content: prompt } ],
                    temperature: 0.2
                })
            });

            if (!response.ok) throw new Error("Grok Batch Report Error");
            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error("Batch Report Error:", error);
            throw error;
        }
    },

    async dictionarySearch(query) {
        const apiKey = localStorage.getItem('GROK_API_KEY');
        if (!apiKey) throw new Error("API Key required");

        const prompt = `You are a Master Xactimate Line Item Expert. 
        The user is searching for: "${query}".
        
        1. Identify the primary line item.
        2. Identify COMPLEMENTARY items that typically go with this trade (e.g., if it's roofing, suggest the shingles + underlayment + starter + ridge cap).
        3. Return a list of the top 8 most relevant Xactimate codes.
        Include Code, Description, and Category.
        
        Return STRICTLY in JSON format:
        {
          "items": [
            { "code": "RFG300", "description": "Comp. shingles - w/ felt - 3-tab - 20-25 yr", "category": "Roofing" }
          ]
        }`;

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'grok-4.20-reasoning',
                    messages: [ { role: 'user', content: prompt } ],
                    temperature: 0.1
                })
            });

            if (!response.ok) throw new Error("Grok Dictionary Error");
            const data = await response.json();
            const result = data.choices[0].message.content.trim();
            const cleaned = result ? result.replace(/```json|```/g, '').trim() : "{}";
            return JSON.parse(cleaned).items || [];
        } catch (error) {
            console.error("Dictionary Search Error:", error);
            return [];
        }
    }
};
