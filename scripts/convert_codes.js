const fs = require('fs');
const path = require('path');

const sharedStringsPath = path.join(__dirname, '../temp_code/xl/sharedStrings.xml');
const sheetPath = path.join(__dirname, '../temp_code/xl/worksheets/sheet1.xml');
const outPath = path.join(__dirname, '../js/xactimate_codes.json');

try {
    console.log("Reading shared strings...");
    let stringsData = fs.readFileSync(sharedStringsPath, 'utf8');
    
    let strings = [];
    const tRegex = /<t[^>]*>([\s\S]*?)<\/t>/g;
    let match;
    while ((match = tRegex.exec(stringsData)) !== null) {
        let text = match[1]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
        strings.push(text);
    }
    
    console.log(`Loaded ${strings.length} distinct strings.`);

    console.log("Reading sheet data...");
    let sheetData = fs.readFileSync(sheetPath, 'utf8');
    
    let database = [];
    
    // We want to skip header row (row 1)
    const rowRegex = /<row[^>]*>([\s\S]*?)<\/row>/g;
    let rowMatch;
    
    while ((rowMatch = rowRegex.exec(sheetData)) !== null) {
        let rowContent = rowMatch[1];
        
        let codeIdxMatch = /<c r="A\d+"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/.exec(rowContent);
        let descIdxMatch = /<c r="B\d+"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/.exec(rowContent);
        let unitIdxMatch = /<c r="C\d+"[^>]*t="s"[^>]*><v>(\d+)<\/v><\/c>/.exec(rowContent);
        
        if (codeIdxMatch && descIdxMatch) {
            let code = strings[parseInt(codeIdxMatch[1], 10)];
            let desc = strings[parseInt(descIdxMatch[1], 10)];
            let unit = unitIdxMatch ? strings[parseInt(unitIdxMatch[1], 10)] : "";
            
            if (code && code !== "Component Code") {
                database.push({
                    code: code,
                    desc: desc,
                    unit: unit
                });
            }
        }
    }
    
    console.log(`Extracted ${database.length} unique codes. Saving to JSON...`);
    fs.writeFileSync(outPath, JSON.stringify(database, null, 0)); // No pretty print to save space
    console.log(`Saved successfully to ${outPath}`);
    
} catch (e) {
    console.error("Failed:", e);
}
