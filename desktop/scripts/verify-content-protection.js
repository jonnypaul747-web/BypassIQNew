#!/usr/bin/env node
// Quick verification script — checks that setContentProtection is called in built code
const fs = require('fs');
const path = require('path');

const mainJs = path.join(__dirname, '../dist/app/electron/main/index.js');

if (!fs.existsSync(mainJs)) {
  console.error('❌ Built main.js not found. Run: npm run build');
  process.exit(1);
}

const code = fs.readFileSync(mainJs, 'utf8');
const matches = (code.match(/setContentProtection\(true\)/g) || []).length;
const unconditional = code.includes('ALWAYS hide from screen capture') || 
                       code.includes('ALWAYS hide HUD from screen capture');

console.log('=== JustCilledAI Content Protection Verification ===');
console.log(`✅ setContentProtection(true) calls found: ${matches}`);
console.log(`✅ Unconditional (no settings check): ${unconditional}`);

if (matches >= 2) {
  console.log('\n✅ PASS — App will be hidden from screen sharing in Google Meet, Zoom, Teams etc.');
  console.log('   macOS API used: NSWindowSharingNone (via Electron setContentProtection)');
} else {
  console.log('\n❌ FAIL — Not enough content protection calls found!');
  process.exit(1);
}

