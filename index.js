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
    
    console.log('📥 RAW INPUT:', {
      logoSize,
      offsetX,
      offsetY,
      position,
      positionType: typeof position,
      positionLength: position ? position.length : 0,
      positionBytes: position ? Buffer.from(position).toString('hex') : 'null'
    });
    
    let baseBuffer, logoBuffer;
    
    if (baseImage) {
      baseBuffer = Buffer.from(baseImage, 'base64');
    } else if (baseImageUrl) {
      baseBuffer = await downloadImage(baseImageUrl);
    } else {
      return res.status(400).json({ error: 'Missing baseImage or baseImageUrl' });
    }
    
    // Clean position string AGGRESSIVELY
    const pos = String(position || 'bottom-right')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z-]/g, '')
      .trim();
    
    console.log('🔍 CLEANED POSITION:', {
      original: position,
      cleaned: pos,
      length: pos.length,
      bytes: Buffer.from(pos).toString('hex')
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
    
    console.log('📐 Dimensions:', {
      baseWidth: baseImg.width,
      baseHeight: baseImg.height,
      logoW: Math.round(logoW),
      logoH: Math.round(logoH),
      offsetX: offX,
      offsetY: offY
    });
    
    // ✅ POSITION CALCULATION - EXACT STRING MATCHING
    let x, y;
    let verticalPos = 'unknown';
    let horizontalPos = 'unknown';
    
    // Detect VERTICAL position
    if (pos.includes('top')) {
      y = offY;
      verticalPos = 'top';
      console.log('✅ VERTICAL = TOP, y =', y);
    } else if (pos.includes('bottom')) {
      y = baseImg.height - logoH - offY;
      verticalPos = 'bottom';
      console.log('✅ VERTICAL = BOTTOM, y =', y);
    } else if (pos.includes('center') || pos.includes('middle')) {
      y = (baseImg.height - logoH) / 2;
      verticalPos = 'center';
      console.log('✅ VERTICAL = CENTER, y =', y);
    } else {
      y = baseImg.height - logoH - offY;
      verticalPos = 'default-bottom';
      console.log('⚠️ VERTICAL = DEFAULT BOTTOM, y =', y);
    }
    
    // Detect HORIZONTAL position
    if (pos.includes('right')) {
      x = baseImg.width - logoW - offX;
      horizontalPos = 'right';
      console.log('✅ HORIZONTAL = RIGHT, x =', x);
    } else if (pos.includes('left')) {
      x = offX;
      horizontalPos = 'left';
      console.log('✅ HORIZONTAL = LEFT, x =', x);
    } else if (pos.includes('center') || pos.includes('middle')) {
      x = (baseImg.width - logoW) / 2;
      horizontalPos = 'center';
      console.log('✅ HORIZONTAL = CENTER, x =', x);
    } else {
      x = baseImg.width - logoW - offX;
      horizontalPos = 'default-right';
      console.log('⚠️ HORIZONTAL = DEFAULT RIGHT, x =', x);
    }
    
    console.log('🎯 POSITION DETECTED:', {
      vertical: verticalPos,
      horizontal: horizontalPos,
      combined: `${verticalPos}-${horizontalPos}`
    });
    
    // Calculate logo center and distances
    const logoCenterX = x + (logoW / 2);
    const logoCenterY = y + (logoH / 2);
    
    const distFromTop = logoCenterY;
    const distFromBottom = baseImg.height - logoCenterY;
    const distFromLeft = logoCenterX;
    const distFromRight = baseImg.width - logoCenterX;
    
    console.log('📏 Logo center distances:', {
      centerPoint: `(${Math.round(logoCenterX)}, ${Math.round(logoCenterY)})`,
      toTop: Math.round(distFromTop),
      toBottom: Math.round(distFromBottom),
      toLeft: Math.round(distFromLeft),
      toRight: Math.round(distFromRight)
    });
    
    console.log('🎯 FINAL DRAWING POSITION:', {
      x: Math.round(x),
      y: Math.round(y)
    });
    
    // Draw logo
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ 
      success: true, 
      image: final,
      debug: {
        positionInput: position,
        positionCleaned: pos,
        positionDetected: `${verticalPos}-${horizontalPos}`,
        logoTopLeftCorner: {
          x: Math.round(x),
          y: Math.round(y)
        },
        logoCenter: {
          x: Math.round(logoCenterX),
          y: Math.round(logoCenterY)
        },
        distanceFromCenterToEdges: {
          top: Math.round(distFromTop),
          bottom: Math.round(distFromBottom),
          left: Math.round(distFromLeft),
          right: Math.round(distFromRight)
        },
        logoSize: `${Math.round(logoW)}x${Math.round(logoH)}`,
        offsetX: offX,
        offsetY: offY
      }
    });
  } catch (error) {
    console.error('❌ ERROR:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'Image Combiner API v7.1 - Debug Mode',
    endpoint: '/combine'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Debug API running on port ${PORT}`));
