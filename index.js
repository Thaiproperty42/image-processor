const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const https = require('https');
const http = require('http');
const app = express();

app.use(express.json({ limit: '50mb' }));

// Helper to download image from URL
function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

app.post('/combine', async (req, res) => {
  try {
    const { 
      baseImage, 
      logoImage, 
      baseImageUrl, 
      logoImageUrl, 
      logoSize = 10, 
      padding = 40,
      position = 'bottom-right'
    } = req.body;
    
    // Support both base64 and URLs
    let baseBuffer, logoBuffer;
    
    if (baseImage) {
      baseBuffer = Buffer.from(baseImage, 'base64');
    } else if (baseImageUrl) {
      baseBuffer = await downloadImage(baseImageUrl);
    } else {
      return res.status(400).json({ error: 'Missing baseImage or baseImageUrl' });
    }
    
    if (logoImage) {
      logoBuffer = Buffer.from(logoImage, 'base64');
    } else if (logoImageUrl) {
      logoBuffer = await downloadImage(logoImageUrl);
    } else {
      return res.status(400).json({ error: 'Missing logoImage or logoImageUrl' });
    }
    
    const baseImg = await loadImage(baseBuffer);
    const logoImg = await loadImage(logoBuffer);
    
    const canvas = createCanvas(baseImg.width, baseImg.height);
    const ctx = canvas.getContext('2d');
    
    // Draw base image
    ctx.drawImage(baseImg, 0, 0);
    
    // Calculate logo dimensions
    const logoW = baseImg.width * (logoSize / 100);
    const logoH = (logoImg.height / logoImg.width) * logoW;
    
    // Parse position (supports: top, bottom, left, right, center, and combinations)
    let x, y;
    const pos = position.toLowerCase().trim();
    
    // Vertical positioning
    if (pos.includes('top')) {
      y = padding;
    } else if (pos.includes('bottom')) {
      y = baseImg.height - logoH - padding;
    } else if (pos.includes('center') || pos.includes('middle')) {
      y = (baseImg.height - logoH) / 2;
    } else {
      // Default to bottom
      y = baseImg.height - logoH - padding;
    }
    
    // Horizontal positioning
    if (pos.includes('left')) {
      x = padding;
    } else if (pos.includes('right')) {
      x = baseImg.width - logoW - padding;
    } else if (pos.includes('center') || pos.includes('middle')) {
      x = (baseImg.width - logoW) / 2;
    } else {
      // Default to right
      x = baseImg.width - logoW - padding;
    }
    
    // Draw logo
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ success: true, image: final });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'Image combiner API running',
    usage: {
      endpoint: '/combine',
      method: 'POST',
      parameters: {
        baseImage: 'base64 string (required if baseImageUrl not provided)',
        logoImage: 'base64 string (required if logoImageUrl not provided)',
        baseImageUrl: 'URL string (alternative to baseImage)',
        logoImageUrl: 'URL string (alternative to logoImage)',
        logoSize: 'number (percentage of base image width, default: 10)',
        padding: 'number (pixels from edge, default: 40)',
        position: 'string (default: bottom-right)'
      },
      positionOptions: [
        'top-left', 'top-right', 'top-center',
        'bottom-left', 'bottom-right', 'bottom-center',
        'center-left', 'center-right', 'center',
        'left', 'right', 'top', 'bottom'
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
