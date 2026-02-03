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
    
    // ✅ SMART PADDING: Always enforce minimum safe distance from edges
    const MIN_PADDING = 25; // Minimum 25px from any edge
    const padX = Math.max(Number(paddingX), MIN_PADDING);
    const padY = Math.max(Number(paddingY), MIN_PADDING);
    
    console.log('Calculated:', {
      baseWidth: baseImg.width,
      baseHeight: baseImg.height,
      logoW,
      logoH,
      padX,
      padY,
      appliedMinPadding: MIN_PADDING
    });
    
    // Position calculation
    // paddingX and paddingY are OFFSETS from the corner
    // Minimum padding ensures logo never touches edges
    
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
        requestedPaddingX: Number(paddingX),
        requestedPaddingY: Number(paddingY),
        appliedPaddingX: padX,
        appliedPaddingY: padY,
        minPaddingEnforced: MIN_PADDING,
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
    version: '3.0.0 (Smart Padding Edition)',
    features: [
      '✅ Automatic 25px minimum padding from all edges',
      '✅ Base64 and URL support for both images',
      '✅ Flexible positioning (9 positions + none)',
      '✅ Logo size as percentage of base width',
      '✅ Prevents logo cutoff at borders'
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
        paddingX: 'number (pixels from edge, min: 25, default: 25)',
        paddingY: 'number (pixels from edge, min: 25, default: 25)',
        position: 'string (default: bottom-right)'
      },
      smartPadding: {
        description: 'Minimum 25px padding is ALWAYS enforced',
        examples: {
          'paddingX: 0': 'Auto-upgraded to 25px',
          'paddingX: 10': 'Auto-upgraded to 25px',
          'paddingX: 50': 'Used as-is (already > 25px)',
          'paddingX: 100': 'Used as-is (already > 25px)'
        }
      },
      positionOptions: [
        'top-left', 'top-right', 'top-center',
        'bottom-left', 'bottom-right', 'bottom-center',
        'center-left', 'center-right', 'center',
        'none (no logo)'
      ],
      recommendedSettings: {
        smallWatermark: {
          logoSize: 10,
          paddingX: 30,
          paddingY: 30,
          position: 'bottom-right'
        },
        mediumBranding: {
          logoSize: 18,
          paddingX: 40,
          paddingY: 40,
          position: 'top-right'
        },
        largeCentered: {
          logoSize: 35,
          paddingX: 0,
          paddingY: 0,
          position: 'center'
        }
      },
      examples: [
        {
          description: 'Professional watermark (auto-padded)',
          body: {
            baseImageUrl: 'https://example.com/villa.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 12,
            paddingX: 0,
            paddingY: 0,
            position: 'bottom-right'
          },
          result: 'Logo will be 12% width, 25px from right edge, 25px from bottom'
        },
        {
          description: 'Large top-right branding',
          body: {
            baseImageUrl: 'https://example.com/property.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 20,
            paddingX: 50,
            paddingY: 40,
            position: 'top-right'
          },
          result: 'Logo will be 20% width, 50px from right, 40px from top'
        },
        {
          description: 'Centered overlay (no padding needed)',
          body: {
            baseImageUrl: 'https://example.com/bg.jpg',
            logoImageUrl: 'https://example.com/brand.png',
            logoSize: 40,
            paddingX: 0,
            paddingY: 0,
            position: 'center'
          },
          result: 'Logo centered, 25px safety margin auto-applied'
        }
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Image Combiner API v3.0 running on port ${PORT}`));
