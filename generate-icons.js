// Simple script to generate icon placeholders
// In production, replace these with your actual logo

const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Icon sizes needed for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create a simple SVG icon with "K" letter
const createSvgIcon = (size) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#3B82F6" rx="${size * 0.15}"/>
  <text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" 
        font-family="Arial, sans-serif" font-size="${size * 0.5}" font-weight="bold" fill="white">
    K
  </text>
</svg>`;
};

// Generate SVG icons for each size
sizes.forEach(size => {
  const svgContent = createSvgIcon(size);
  const fileName = `icon-${size}x${size}.svg`;
  const filePath = path.join(iconsDir, fileName);
  
  fs.writeFileSync(filePath, svgContent);
  console.log(`✅ Created ${fileName}`);
});

// Also create a simple HTML file to convert SVG to PNG
const converterHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Icon Converter</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    .icon-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; }
    .icon-box { text-align: center; padding: 10px; border: 1px solid #ddd; }
    canvas { border: 1px solid #eee; }
    button { margin-top: 10px; padding: 5px 10px; }
  </style>
</head>
<body>
  <h1>KHS CRM Icons</h1>
  <p>Right-click and save each icon as PNG:</p>
  <div class="icon-grid" id="iconGrid"></div>
  
  <script>
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    const iconGrid = document.getElementById('iconGrid');
    
    sizes.forEach(size => {
      const box = document.createElement('div');
      box.className = 'icon-box';
      
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      
      const ctx = canvas.getContext('2d');
      
      // Draw blue square with rounded corners
      const radius = size * 0.15;
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.moveTo(radius, 0);
      ctx.lineTo(size - radius, 0);
      ctx.quadraticCurveTo(size, 0, size, radius);
      ctx.lineTo(size, size - radius);
      ctx.quadraticCurveTo(size, size, size - radius, size);
      ctx.lineTo(radius, size);
      ctx.quadraticCurveTo(0, size, 0, size - radius);
      ctx.lineTo(0, radius);
      ctx.quadraticCurveTo(0, 0, radius, 0);
      ctx.fill();
      
      // Draw "K" letter
      ctx.fillStyle = 'white';
      ctx.font = 'bold ' + (size * 0.5) + 'px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('K', size / 2, size / 2);
      
      const label = document.createElement('div');
      label.textContent = size + 'x' + size;
      
      const downloadBtn = document.createElement('button');
      downloadBtn.textContent = 'Download';
      downloadBtn.onclick = () => {
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'icon-' + size + 'x' + size + '.png';
          a.click();
          URL.revokeObjectURL(url);
        });
      };
      
      box.appendChild(canvas);
      box.appendChild(label);
      box.appendChild(downloadBtn);
      iconGrid.appendChild(box);
    });
  </script>
</body>
</html>`;

// Save the converter HTML
fs.writeFileSync(path.join(iconsDir, 'icon-converter.html'), converterHtml);
console.log('✅ Created icon-converter.html - Open this in a browser to generate PNG icons');

// For now, let's create simple placeholder PNG files using a data URL
const Canvas = require('canvas');

// Check if canvas is available, if not, create placeholder files
try {
  const { createCanvas } = require('canvas');
  
  sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Draw blue background
    ctx.fillStyle = '#3B82F6';
    const radius = size * 0.15;
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(size - radius, 0);
    ctx.quadraticCurveTo(size, 0, size, radius);
    ctx.lineTo(size, size - radius);
    ctx.quadraticCurveTo(size, size, size - radius, size);
    ctx.lineTo(radius, size);
    ctx.quadraticCurveTo(0, size, 0, size - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.fill();
    
    // Draw K letter
    ctx.fillStyle = 'white';
    ctx.font = `bold ${size * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('K', size / 2, size / 2);
    
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), buffer);
    console.log(`✅ Created icon-${size}x${size}.png`);
  });
} catch (err) {
  console.log('Canvas module not found. Creating placeholder text files instead.');
  console.log('To generate actual PNG icons:');
  console.log('1. Open public/icons/icon-converter.html in a browser');
  console.log('2. Download each icon as PNG');
  console.log('OR');
  console.log('npm install canvas (requires build tools)');
  
  // Create placeholder files so the app doesn't break
  sizes.forEach(size => {
    const placeholderPath = path.join(iconsDir, `icon-${size}x${size}.png`);
    if (!fs.existsSync(placeholderPath)) {
      // Create a minimal 1x1 PNG as placeholder
      const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
      fs.writeFileSync(placeholderPath, minimalPng);
      console.log(`📝 Created placeholder ${size}x${size}.png`);
    }
  });
}

console.log('\n✅ Icon generation complete!');
console.log('Icons are located in: public/icons/');