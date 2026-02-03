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
    
    // ✅ POSITION LOGIC - NO LIMITS, CAN GO OUTSIDE FRAME
    let x, y;
    
    const hasTop = pos.includes('top');
    const hasBottom = pos.includes('bottom');
    const hasLeft = pos.includes('left');
    const hasRight = pos.includes('right');
    const hasCenter = pos.includes('center') || pos.includes('middle');
    
    // Y calculation - offsetY is SUBTRACTED from edge distance
    if (hasTop) {
      y = 0 - offY;  // ✅ offsetY > 0 moves logo UP (can go negative)
      console.log('✅ Y = TOP - offset:', y);
    } else if (hasBottom) {
      y = baseImg.height - logoH + offY;  // ✅ offsetY > 0 moves logo DOWN (can go past bottom)
      console.log('✅ Y = BOTTOM + offset:', y);
    } else if (hasCenter) {
      y = (baseImg.height - logoH) / 2;
      console.log('✅ Y = CENTER:', y);
    } else {
      y = baseImg.height - logoH + offY;
      console.log('⚠️ Y = DEFAULT (BOTTOM):', y);
    }
    
    // X calculation - offsetX is SUBTRACTED from edge distance
    if (hasRight) {
      x = baseImg.width - logoW + offX;  // ✅ offsetX > 0 moves logo RIGHT (can go past edge)
      console.log('✅ X = RIGHT + offset:', x);
    } else if (hasLeft) {
      x = 0 - offX;  // ✅ offsetX > 0 moves logo LEFT (can go negative)
      console.log('✅ X = LEFT - offset:', x);
    } else if (hasCenter) {
      x = (baseImg.width - logoW) / 2;
      console.log('✅ X = CENTER:', x);
    } else {
      x = baseImg.width - logoW + offX;
      console.log('⚠️ X = DEFAULT (RIGHT):', x);
    }
    
    console.log('🎯 FINAL POSITION:', { x: Math.round(x), y: Math.round(y) });
    
    const logoCenterX = x + (logoW / 2);
    const logoCenterY = y + (logoH / 2);
    
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ 
      success: true, 
      image: final,
      debug: {
        position: pos,
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
  res.json({ 
    status: 'API v8.0 - Zero Limits',
    usage: {
      offsetX: 'Positive values move logo AWAY from edge (can go outside)',
      offsetY: 'Positive values move logo AWAY from edge (can go outside)',
      examples: {
        'offsetX: 0, offsetY: 0': 'Logo touches edge',
        'offsetX: -50, offsetY: -50': 'Logo overlaps edge by 50px',
        'offsetX: 100, offsetY: 100': 'Logo 100px inside from edge'
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Zero Limits API on port ${PORT}`));
