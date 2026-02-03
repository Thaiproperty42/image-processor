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
    
    // ✅ NO MIN PADDING - Use values directly as provided
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
    let x, y;
    
    if (pos.includes('top')) {
      y = padY;
    } else if (pos.includes('bottom')) {
      y = baseImg.height - logoH - padY;
    } else if (pos.includes('center') || pos.includes('middle')) {
      y = (baseImg.height - logoH) / 2 + padY;
    } else {
      // Default bottom
      y = baseImg.height - logoH - padY;
    }
    
    if (pos.includes('left')) {
      x = padX;
    } else if (pos.includes('right')) {
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
        paddingX: padX,
        paddingY: padY,
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
    version: '4.0.0 (No Min Padding)',
    features: [
      '✅ Base64 and URL support for both images',
      '✅ Flexible positioning (9 positions + none)',
      '✅ Logo size as percentage of base width',
      '✅ Full padding control - no restrictions',
      '⚠️ Warning: Logo may be cut off with paddingX/Y = 0 or negative values'
    ],
    usage: {
      endpoint: '/combine',
      method: 'POST',
      parameters: {
        baseImage: 'base64 string OR',
        baseImageUrl: 'URL string',
        logoImage: 'base64 string OR',
        logoImageUrl: 'URL string',
        logoSize: 'number (% of base width, default: 10)',
        paddingX: 'number (pixels from edge, can be 0 or negative, default: 0)',
        paddingY: 'number (pixels from edge, can be 0 or negative, default: 0)',
        position: 'string (default: bottom-right)'
      },
      paddingBehavior: {
        description: 'Padding values are used exactly as provided - NO minimum enforced',
        examples: {
          'paddingX: 0, paddingY: 0': 'Logo sits exactly at corner (may be cut off)',
          'paddingX: -10, paddingY: -10': 'Logo moves 10px outside frame (will be cut off)',
          'paddingX: 30, paddingY: 30': 'Logo has 30px breathing room from edges'
        }
      },
      positionOptions: [
        'top-left', 'top-right', 'top-center',
        'bottom-left', 'bottom-right', 'bottom-center',
        'center-left', 'center-right', 'center',
        'none (no logo)'
      ],
      examples: [
        {
          description: 'Logo exactly at top-right corner (may be cut off)',
          body: {
            baseImageUrl: 'https://example.com/bg.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 15,
            paddingX: 0,
            paddingY: 0,
            position: 'top-right'
          }
        },
        {
          description: 'Logo with safe 30px padding',
          body: {
            baseImageUrl: 'https://example.com/bg.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 15,
            paddingX: 30,
            paddingY: 30,
            position: 'top-right'
          }
        },
        {
          description: 'Logo moved slightly outside frame (negative padding)',
          body: {
            baseImageUrl: 'https://example.com/bg.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 12,
            paddingX: -10,
            paddingY: -5,
            position: 'bottom-right'
          }
        }
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Image Combiner API v4.0 (No Min Padding) running on port ${PORT}`));
