const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Recursive copy folder helper
function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

// 1. Read face image as base64 for guaranteed display (never broken image)
const faceImgPath = path.join(__dirname, 'assets/images/veeramani-face.png');
let faceBase64 = '';
if (fs.existsSync(faceImgPath)) {
  faceBase64 = 'data:image/png;base64,' + fs.readFileSync(faceImgPath).toString('base64');
}

// 2. Read CSS and HTML
const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// Replace external face image with embedded Data URI in HTML
if (faceBase64) {
  html = html.replace(/src="assets\/images\/veeramani-face\.png"/g, `src="${faceBase64}"`);
}

// Inline style.css into index.html so page is 100% styled from byte 1
if (!html.includes('/* INLINED_STYLE */')) {
  html = html.replace('</head>', `<style id="inlined-game-styles">/* INLINED_STYLE */\n${css}\n</style>\n</head>`);
}

// 3. Write output to public/ for Vercel static deployment
fs.writeFileSync(path.join(publicDir, 'index.html'), html);
fs.copyFileSync(path.join(__dirname, 'style.css'), path.join(publicDir, 'style.css'));
fs.copyFileSync(path.join(__dirname, 'game.js'), path.join(publicDir, 'game.js'));
fs.copyFileSync(path.join(__dirname, 'audio.js'), path.join(publicDir, 'audio.js'));
copyFolderSync(path.join(__dirname, 'assets'), path.join(publicDir, 'assets'));

// 4. Also update root index.html so both root and public are fully styled
fs.writeFileSync(path.join(__dirname, 'index.html'), html);

console.log('✅ Build complete! Assets generated in public/ and root index.html updated with inline styles.');
