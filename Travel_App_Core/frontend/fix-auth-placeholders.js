const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, 'src');

function walk(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (/(\.jsx?|\.js)$/.test(name)) files.push(full);
  }
  return files;
}

function ensureAuthHelper(content) {
  if (content.includes('const authHeaders')) return content;
  const apiBaseLine = "const API_BASE = process.env.REACT_APP_BACKEND_URL || '';";
  const idx = content.indexOf(apiBaseLine);
  if (idx === -1) return content;
  const insertAfter = apiBaseLine + '\n\n';
  const helper = `const authHeaders = () => {\n  const token = localStorage.getItem('travelAppToken');\n  return token ? { Authorization: \`Bearer \\${token}\` } : {};\n};\n\n`;
  return content.replace(apiBaseLine + '\n\n', insertAfter + helper);
}

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  if (!content.includes('Authorization') && !content.includes('travelAppToken') && !content.includes('******')) return false;

  content = ensureAuthHelper(content);

  // Replace single-line headers: { Authorization: `...` },
  content = content.replace(/headers:\s*{\s*Authorization:\s*`[^`]*`\s*},/g, 'headers: { ...authHeaders() },');

  // Replace Authorization: `...` lines inside headers blocks with spread helper
  content = content.replace(/(^\s*)Authorization:\s*`[^`]*`\s*,?\s*(?=\n)/gm, '$1...authHeaders()');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    return true;
  }
  return false;
}

const files = walk(root);
const changed = [];
for (const f of files) {
  try {
    if (fixFile(f)) changed.push(f);
  } catch (err) {
    console.error('Failed to process', f, err);
  }
}

console.log('Files changed:', changed.length);
changed.forEach(f => console.log('  ', f));
