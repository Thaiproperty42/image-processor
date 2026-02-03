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
      padding = 30,  // ✅ SINGLE PADDING VALUE FOR ALL SIDES
      position = 'bottom-right'
    } = req.body;
    
    console.log('📥 Received params:', {
      logoSize,
      padding,
      position,
      positionType: typeof position
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
    console.log('🔍 Position processed:', {
      original: position,
      processed: pos,
      includesTop: pos.includes('top'),
      includesBottom: pos.includes('bottom'),
      includesLeft: pos.includes('left'),
      includesRight: pos.includes('right'),
      includesCenter: pos.includes('center')
    });
    
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
    
    // ✅ USE SAME PADDING FOR ALL SIDES
    const pad = Number(padding);
    
    console.log('📐 Calculated dimensions:', {
      baseWidth: baseImg.width,
      baseHeight: baseImg.height,
      logoW: Math.round(logoW),
      logoH: Math.round(logoH),
      padding: pad
    });
    
    // Position calculation - EQUAL PADDING ON ALL SIDES
    let x, y;
    
    // Calculate Y position (vertical) - ALWAYS USE PADDING
    if (pos.includes('top')) {
      y = pad;  // ✅ PADDING FROM TOP
      console.log('✅ Y = TOP with padding:', y);
    } else if (pos.includes('bottom')) {
      y = baseImg.height - logoH - pad;  // ✅ PADDING FROM BOTTOM
      console.log('✅ Y = BOTTOM with padding:', y);
    } else if (pos.includes('center') || pos.includes('middle')) {
      y = (baseImg.height - logoH) / 2;  // ✅ CENTER (no padding adjustment)
      console.log('✅ Y = CENTER:', y);
    } else {
      // Default to BOTTOM with padding
      y = baseImg.height - logoH - pad;
      console.log('⚠️ Y = DEFAULT (BOTTOM) with padding:', y);
    }
    
    // Calculate X position (horizontal) - ALWAYS USE PADDING
    if (pos.includes('left')) {
      x = pad;  // ✅ PADDING FROM LEFT
      console.log('✅ X = LEFT with padding:', x);
    } else if (pos.includes('right')) {
      x = baseImg.width - logoW - pad;  // ✅ PADDING FROM RIGHT
      console.log('✅ X = RIGHT with padding:', x);
    } else if (pos.includes('center') || pos.includes('middle')) {
      x = (baseImg.width - logoW) / 2;  // ✅ CENTER (no padding adjustment)
      console.log('✅ X = CENTER:', x);
    } else {
      // Default to RIGHT with padding
      x = baseImg.width - logoW - pad;
      console.log('⚠️ X = DEFAULT (RIGHT) with padding:', x);
    }
    
    console.log('🎯 Final position calculated:', { 
      x: Math.round(x), 
      y: Math.round(y),
      padding: pad,
      willDrawAt: `(${Math.round(x)}, ${Math.round(y)})`,
      logoSize: `${Math.round(logoW)}x${Math.round(logoH)}`
    });
    
    // Draw logo
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ 
      success: true, 
      image: final,
      debug: {
        logoSize: Number(logoSize),
        padding: pad,
        position: pos,
        finalX: Math.round(x),
        finalY: Math.round(y),
        logoWidth: Math.round(logoW),
        logoHeight: Math.round(logoH),
        baseImageSize: `${baseImg.width}x${baseImg.height}`
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'Image combiner API running',
    version: '5.0.0 (Equal Padding All Sides)',
    features: [
      '✅ Base64 and URL support for both images',
      '✅ Flexible positioning (9 positions + none)',
      '✅ Logo size as percentage of base width',
      '✅ EQUAL padding on all sides (mandatory)',
      '✅ Detailed debug logging'
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
        padding: 'number (pixels from ALL edges, default: 30)',
        position: 'string (default: bottom-right)'
      },
      positionOptions: [
        'top-left', 'top-right', 'top-center',
        'bottom-left', 'bottom-right', 'bottom-center',
        'center-left', 'center-right', 'center',
        'none (no logo)'
      ],
      examples: [
        {
          description: 'Logo at top-right with 30px padding on all sides',
          body: {
            baseImageUrl: 'https://example.com/bg.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 15,
            padding: 30,
            position: 'top-right'
          }
        },
        {
          description: 'Logo at bottom-left with 50px padding on all sides',
          body: {
            baseImageUrl: 'https://example.com/bg.jpg',
            logoImageUrl: 'https://example.com/logo.png',
            logoSize: 12,
            padding: 50,
            position: 'bottom-left'
          }
        }
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Image Combiner API v5.0 (Equal Padding) running on port ${PORT}`));
