const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const https = require('https');
const http = require('http');
const app = express();

app.use(express.json({ limit: '50mb' }));

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
      offsetX = 0,
      offsetY = 0,
      position = 'bottom-right'
    } = req.body;
    
    console.log('📥 INPUT:', { logoSize, offsetX, offsetY, position });
    
    let baseBuffer, logoBuffer;
    
    if (baseImage) {
      baseBuffer = Buffer.from(baseImage, 'base64');
    } else if (baseImageUrl) {
      baseBuffer = await downloadImage(baseImageUrl);
    } else {
      return res.status(400).json({ error: 'Missing baseImage or baseImageUrl' });
    }
    
    const pos = String(position || 'bottom-right').toLowerCase().trim();
    
    console.log('🔍 Position string:', {
      input: position,
      processed: pos,
      length: pos.length,
      chars: pos.split('')
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
    
    ctx.drawImage(baseImg, 0, 0);
    
    const logoW = baseImg.width * (Number(logoSize) / 100);
    const logoH = (logoImg.height / logoImg.width) * logoW;
    const offX = Number(offsetX);
    const offY = Number(offsetY);
    
    console.log('📐 Sizes:', {
      base: `${baseImg.width}x${baseImg.height}`,
      logo: `${Math.round(logoW)}x${Math.round(logoH)}`,
      offset: `${offX}, ${offY}`
    });
    
    // ✅ EXPLICIT POSITION MATCHING
    let x, y;
    
    // Test each string method
    const hasTop = pos.includes('top');
    const hasBottom = pos.includes('bottom');
    const hasLeft = pos.includes('left');
    const hasRight = pos.includes('right');
    const hasCenter = pos.includes('center') || pos.includes('middle');
    
    console.log('🔍 Position tests:', {
      hasTop,
      hasBottom,
      hasLeft,
      hasRight,
      hasCenter
    });
    
    // Y calculation
    if (hasTop) {
      y = offY;
      console.log('✅ Y = TOP:', y);
    } else if (hasBottom) {
      y = baseImg.height - logoH - offY;
      console.log('✅ Y = BOTTOM:', y);
    } else if (hasCenter) {
      y = (baseImg.height - logoH) / 2;
      console.log('✅ Y = CENTER:', y);
    } else {
      y = baseImg.height - logoH - offY;
      console.log('⚠️ Y = DEFAULT (BOTTOM):', y);
    }
    
    // X calculation
    if (hasRight) {
      x = baseImg.width - logoW - offX;
      console.log('✅ X = RIGHT:', x);
    } else if (hasLeft) {
      x = offX;
      console.log('✅ X = LEFT:', x);
    } else if (hasCenter) {
      x = (baseImg.width - logoW) / 2;
      console.log('✅ X = CENTER:', x);
    } else {
      x = baseImg.width - logoW - offX;
      console.log('⚠️ X = DEFAULT (RIGHT):', x);
    }
    
    console.log('🎯 CALCULATED POSITION:', { x: Math.round(x), y: Math.round(y) });
    
    // Verification calculation
    const expectedRightX = baseImg.width - logoW - offX;
    const expectedLeftX = offX;
    console.log('🔢 Expected values:', {
      ifRight: Math.round(expectedRightX),
      ifLeft: Math.round(expectedLeftX),
      actualX: Math.round(x),
      matches: x === expectedRightX ? 'RIGHT' : (x === expectedLeftX ? 'LEFT' : 'NEITHER')
    });
    
    const logoCenterX = x + (logoW / 2);
    const logoCenterY = y + (logoH / 2);
    
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ 
      success: true, 
      image: final,
      debug: {
        position: pos,
        detectedFlags: { hasTop, hasBottom, hasLeft, hasRight, hasCenter },
        logoCorner: { x: Math.round(x), y: Math.round(y) },
        logoCenter: { x: Math.round(logoCenterX), y: Math.round(logoCenterY) },
        distanceFromCenter: {
          top: Math.round(logoCenterY),
          bottom: Math.round(baseImg.height - logoCenterY),
          left: Math.round(logoCenterX),
          right: Math.round(baseImg.width - logoCenterX)
        },
        logoSize: `${Math.round(logoW)}x${Math.round(logoH)}`,
        offsets: { x: offX, y: offY }
      }
    });
  } catch (error) {
    console.error('❌ ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'API v7.2 - Nuclear Debug' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Running on port ${PORT}`));
