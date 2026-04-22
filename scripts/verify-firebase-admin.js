const fs = require('fs');
const path = require('path');

function verifyServiceAccount() {
    console.log('🔍 Checking Firebase Admin Service Account JSON in .env.local...\n');
    
    const envPath = path.join(__dirname, '..', '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env.local file not found!');
        return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    let keyContent = null;
    
    for (const line of lines) {
        if (line.trim().startsWith('FIREBASE_SERVICE_ACCOUNT_KEY=')) {
            keyContent = line.substring(line.indexOf('=') + 1).trim();
            break;
        }
    }

    if (!keyContent) {
        console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY is missing from .env.local!');
        return;
    }

    try {
        let clean = keyContent;
        if (clean.startsWith("'") && clean.endsWith("'")) {
            clean = clean.substring(1, clean.length - 1);
        }
        if (clean.includes('\\"')) {
            clean = clean.replace(/\\"/g, '"');
        }

        const parsed = JSON.parse(clean);
        if (!parsed.private_key) {
             console.error('❌ The JSON does not have a "private_key" field.');
             return;
        }

        const pk = parsed.private_key.replace(/\\n/g, '\n');
        
        // A standard 2048-bit RSA private key string length from Firebase is typically > 1600 characters.
        if (pk.length < 1600) {
            console.error(`❌ Private key looks too short or truncated! (Length: ${pk.length} chars)`);
            console.error('   A standard Firebase private key is typically around 1650 characters.');
            console.error('   Please regenerate the key from Firebase Console and copy the ENTIRE file contents.');
            return;
        }

        console.log(`✅ FIREBASE_SERVICE_ACCOUNT_KEY is present and parsed successfully!`);
        console.log(`✅ Project ID: ${parsed.project_id}`);
        console.log(`✅ Private Key Length: ${pk.length} chars (Looks valid)`);
        console.log(`\n🎉 Your Firebase Admin SDK should now initialize correctly. Remember to restart your Next.js dev server!`);

    } catch (e) {
        console.error('❌ Failed to parse the JSON string. It might have syntax errors.');
        console.error('   Error details:', e.message);
        console.error('\n   Make sure the entire JSON object is on a SINGLE LINE inside single quotes.');
    }
}

verifyServiceAccount();
