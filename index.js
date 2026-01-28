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
      paddingX,
      paddingY,
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
    
    // Use separate padding for X and Y if provided, otherwise use padding
    const padX = paddingX !== undefined ? paddingX : padding;
    const padY = paddingY !== undefined ? paddingY : padding;
    
    // Parse position
    let x, y;
    const pos = position.toLowerCase().trim();
    
    // Vertical positioning
    if (pos.includes('top')) {
      y = padY;
    } else if (pos.includes('bottom')) {
      y = baseImg.height - logoH - padY;
    } else if (pos.includes('center') || pos.includes('middle')) {
      y = (baseImg.height - logoH) / 2;
    } else {
      // Default to bottom
      y = baseImg.height - logoH - padY;
    }
    
    // Horizontal positioning
    if (pos.includes('left')) {
      x = padX;
    } else if (pos.includes('right')) {
      x = baseImg.width - logoW - padX;
    } else if (pos.includes('center') || pos.includes('middle')) {
      x = (baseImg.width - logoW) / 2;
    } else {
      // Default to right
      x = baseImg.width - logoW - padX;
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
    version: '1.0.0',
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
        paddingX: 'number (horizontal padding, overrides padding)',
        paddingY: 'number (vertical padding, overrides padding)',
        position: 'string (default: bottom-right)'
      },
      positionOptions: [
        'top-left', 'top-right', 'top-center', 'top',
        'bottom-left', 'bottom-right', 'bottom-center', 'bottom',
        'center-left', 'center-right', 'center', 'middle',
        'left', 'right'
      ],
      examples: [
        {
          description: 'Logo at top-right, very close to edge',
          body: {
            baseImage: 'base64...',
            logoImage: 'base64...',
            logoSize: 15,
            paddingX: 20,
            paddingY: 5,
            position: 'top right'
          }
        },
        {
          description: 'Large logo centered',
          body: {
            baseImageUrl: 'https://example.com/image.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 30,
            position: 'center'
          }
        }
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
