const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'outputs');
const files = fs.readdirSync(dir).filter(f => f.startsWith('document-')).sort();
const latestFiles = files.slice(-2);

latestFiles.forEach(file => {
    console.log(`\n--- File: ${file} ---`);
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    
    // Look at structured data
    let structured = {};
    if (data.pages && data.pages[0] && data.pages[0].structuredData) {
        structured = data.pages[0].structuredData;
        console.log("Structured Data Keys:", Object.keys(structured));
        
        // Print out 5 structured fields to see what LLM extracted
        const keys = Object.keys(structured);
        for(let i = 0; i < Math.min(5, keys.length); i++) {
           console.log(`Field '${keys[i]}': ${JSON.stringify(structured[keys[i]])}`);
        }
    } else {
        // If structured data is merged in root
        structured = Object.keys(data).filter(k => !['documentName','pageCount','processedAt','fraudAnalysis','pages'].includes(k)).reduce((obj, key) => {
            obj[key] = data[key];
            return obj;
        }, {});
        console.log("Merged Structured Data:", structured);
    }
    
    // Check words
    if (data.pages && data.pages[0] && data.pages[0].words) {
        const words = data.pages[0].words;
        console.log(`Total words extracted: ${words.length}`);
        
        // Let's run the fuzzy match on a few fields!
        const searchTargets = [];
        if (structured) {
             Object.values(structured).forEach(v => {
                 if (typeof v === 'string') searchTargets.push(v);
                 if (typeof v === 'object' && !Array.isArray(v)) {
                      Object.values(v).forEach(vv => {
                          if (typeof vv === 'string') searchTargets.push(vv);
                      });
                 }
                 if (Array.isArray(v)) {
                      v.forEach(item => {
                          if (typeof item === 'object') {
                              Object.values(item).forEach(vv => {
                                  if (typeof vv === 'string') searchTargets.push(vv);
                                  if (typeof vv === 'number') searchTargets.push(vv.toString());
                              });
                          }
                      });
                 }
             });
        }
        
        console.log(`Testing fuzzy match on ${searchTargets.length} extracted values...`);
        let matches = 0;
        let perfectMatches = 0;
        let substringMatches = 0;
        let missed = [];
        
        searchTargets.forEach(target => {
             const searchTarget = target.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
             if (!searchTarget) return;
             
             let minBloat = Infinity;
             let matched = false;
             
             for (let i = 0; i < words.length; i++) {
                 let combinedText = '';
                 for (let j = i; j < Math.min(words.length, i + 8); j++) {
                     combinedText += words[j].text.toLowerCase().replace(/[^a-z0-9]/g, '');
                     
                     const isExactMatch = combinedText === searchTarget;
                     const isSubstringMatch = combinedText.includes(searchTarget) && searchTarget.length > 3;

                     if (isExactMatch || isSubstringMatch) {
                         const bloat = combinedText.length - searchTarget.length;
                         if (bloat < minBloat && (isExactMatch || bloat <= 3)) {
                             minBloat = bloat;
                             matched = true;
                             if (isExactMatch) break;
                         }
                     }
                 }
                 if (minBloat === 0) break;
             }
             
             if (matched) {
                 matches++;
                 if (minBloat === 0) perfectMatches++;
                 else substringMatches++;
             } else {
                 missed.push(target);
             }
        });
        
        console.log(`Matched: ${matches}/${searchTargets.length} (Perfect: ${perfectMatches}, Substring: ${substringMatches})`);
        if (missed.length > 0) {
            console.log(`Missed Examples:`, missed.slice(0, 5));
        }
    }
});
