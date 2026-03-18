const aiBrain = {
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
    }
};
