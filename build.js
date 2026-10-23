// Copies the source into dist/ as Apps Script files, strips the Node only export guard
const fs = require('node:fs');
const path = require('node:path');

// The files in the order Apps Script should see them, core first so its helpers exist
const order = ['core.js', 'client.js', 'functions.js', 'sidebar.js'];

// Make dist clean
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');

// Copy each script with the export guard removed
for (const f of order) {
	const src = fs.readFileSync(path.join('src', f), 'utf8');
	fs.writeFileSync(path.join('dist', f.replace(/\.js$/, '.gs')), src.replace(/\n\/\/ node only[\s\S]*$/, '\n'));
}

// The manifest and the sidebar page as they are
fs.copyFileSync('appsscript.json', 'dist/appsscript.json');
fs.copyFileSync('src/Sidebar.html', 'dist/Sidebar.html');
console.log('dist ready');
