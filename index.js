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
      paddingX = 0,
      paddingY = 0,
      position = 'bottom-right'
    } = req.body;
    
    console.log('Received params:', {
      logoSize,
      paddingX,
      paddingY,
      position
    });
    
    // Support both base64 and URLs
    let baseBuffer, logoBuffer;
    
    if (baseImage) {
      baseBuffer = Buffer.from(baseImage, 'base64');
    } else if (baseImageUrl) {
      baseBuffer = await downloadImage(baseImageUrl);
    } else {
      return res.status(400).json({ error: 'Missing baseImage or baseImageUrl' });
    }
    
    // Check if position is 'none'
    const pos = position.toLowerCase().trim();
    if (pos === 'none') {
      const baseImg = await loadImage(baseBuffer);
      const canvas = createCanvas(baseImg.width, baseImg.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(baseImg, 0, 0);
      const final = canvas.toBuffer('image/png').toString('base64');
      return res.json({ success: true, image: final });
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
    
    // Calculate logo dimensions based on logoSize percentage
    const logoW = baseImg.width * (Number(logoSize) / 100);
    const logoH = (logoImg.height / logoImg.width) * logoW;
    
    // Convert padding to numbers (can be 0)
    const padX = Number(paddingX);
    const padY = Number(paddingY);
    
    console.log('Calculated:', {
      baseWidth: baseImg.width,
      baseHeight: baseImg.height,
      logoW,
      logoH,
      padX,
      padY
    });
    
    // Position calculation
    // paddingX and paddingY are OFFSETS from the corner
    // 0,0 = exactly at corner
    // positive values = move INWARD from edge
    
    let x, y;
    
    if (pos.includes('top')) {
      // Top edge: y = 0 + offset
      y = padY;
    } else if (pos.includes('bottom')) {
      // Bottom edge: start from bottom, move UP by logo height, then apply offset INWARD
      y = baseImg.height - logoH - padY;
    } else if (pos.includes('center') || pos.includes('middle')) {
      y = (baseImg.height - logoH) / 2 + padY;
    } else {
      // Default bottom
      y = baseImg.height - logoH - padY;
    }
    
    if (pos.includes('left')) {
      // Left edge: x = 0 + offset
      x = padX;
    } else if (pos.includes('right')) {
      // Right edge: start from right, move LEFT by logo width, then apply offset INWARD
      x = baseImg.width - logoW - padX;
    } else if (pos.includes('center') || pos.includes('middle')) {
      x = (baseImg.width - logoW) / 2 + padX;
    } else {
      // Default right
      x = baseImg.width - logoW - padX;
    }
    
    console.log('Final position:', { x, y, position: pos });
    
    // Draw logo
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ 
      success: true, 
      image: final,
      debug: {
        logoSize: Number(logoSize),
        padX,
        padY,
        position: pos,
        finalX: Math.round(x),
        finalY: Math.round(y),
        logoWidth: Math.round(logoW),
        logoHeight: Math.round(logoH)
      }
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'Image combiner API running',
    version: '2.0.0',
    usage: {
      endpoint: '/combine',
      method: 'POST',
      parameters: {
        baseImage: 'base64 string OR',
        baseImageUrl: 'URL string',
        logoImage: 'base64 string OR',
        logoImageUrl: 'URL string',
        logoSize: 'number (% of base width, default: 10)',
        paddingX: 'number (pixels from edge, 0 = corner, default: 0)',
        paddingY: 'number (pixels from edge, 0 = corner, default: 0)',
        position: 'string (default: bottom-right)'
      },
      paddingLogic: {
        'bottom-right': 'paddingX=0, paddingY=0 → logo sits exactly at bottom-right corner',
        'bottom-right': 'paddingX=20, paddingY=10 → logo moves 20px left from right edge, 10px up from bottom',
        'top-left': 'paddingX=0, paddingY=0 → logo sits exactly at top-left corner',
        'top-left': 'paddingX=15, paddingY=15 → logo moves 15px inward from both edges'
      },
      positionOptions: [
        'top-left', 'top-right', 'top-center',
        'bottom-left', 'bottom-right', 'bottom-center',
        'center-left', 'center-right', 'center',
        'none (no logo)'
      ],
      examples: [
        {
          description: 'Logo at exact bottom-right corner',
          body: {
            baseImageUrl: 'https://example.com/bg.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 15,
            paddingX: 0,
            paddingY: 0,
            position: 'bottom-right'
          }
        },
        {
          description: 'Logo 20px from right, 10px from bottom',
          body: {
            baseImageUrl: 'https://example.com/bg.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 12,
            paddingX: 20,
            paddingY: 10,
            position: 'bottom-right'
          }
        },
        {
          description: 'Large centered logo',
          body: {
            baseImageUrl: 'https://example.com/bg.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 40,
            paddingX: 0,
            paddingY: 0,
            position: 'center'
          }
        }
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
