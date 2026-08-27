const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'src');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.jsx?$/.test(entry.name)) processFile(full);
  }
}

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  // Replace Authorization: `...` (any content between backticks) with Authorization: `Bearer ${token}`
  const updated = content.replace(/Authorization:\s*`[^`]*`/g, "Authorization: `Bearer ${token}`");
  if (updated !== content) {
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log('Patched', filePath);
  }
}

walk(root);
console.log('Done');
