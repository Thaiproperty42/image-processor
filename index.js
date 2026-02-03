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
      logoCenter: `${Math.round(logoW/2)}x${Math.round(logoH/2)}`,
      offset: `${offX}, ${offY}`
    });
    
    // ✅ NEW LOGIC: offsetX/offsetY = distance from LOGO CENTER to edge
    let x, y;
    let logoCenterX, logoCenterY;
    
    const hasTop = pos.includes('top');
    const hasBottom = pos.includes('bottom');
    const hasLeft = pos.includes('left');
    const hasRight = pos.includes('right');
    const hasCenter = pos.includes('center') || pos.includes('middle');
    
    // Calculate LOGO CENTER position first, then derive corner position
    
    // Y calculation - offsetY is distance from logo CENTER to top/bottom edge
    if (hasTop) {
      logoCenterY = offY;  // Logo center is offsetY pixels from TOP
      y = logoCenterY - (logoH / 2);  // Calculate top-left corner
      console.log('✅ TOP: centerY =', offY, '→ cornerY =', Math.round(y));
    } else if (hasBottom) {
      logoCenterY = baseImg.height - offY;  // Logo center is offsetY pixels from BOTTOM
      y = logoCenterY - (logoH / 2);
      console.log('✅ BOTTOM: centerY =', Math.round(logoCenterY), '→ cornerY =', Math.round(y));
    } else if (hasCenter) {
      logoCenterY = baseImg.height / 2;
      y = logoCenterY - (logoH / 2);
      console.log('✅ CENTER: centerY =', Math.round(logoCenterY), '→ cornerY =', Math.round(y));
    } else {
      logoCenterY = baseImg.height - offY;
      y = logoCenterY - (logoH / 2);
      console.log('⚠️ DEFAULT BOTTOM: centerY =', Math.round(logoCenterY), '→ cornerY =', Math.round(y));
    }
    
    // X calculation - offsetX is distance from logo CENTER to left/right edge
    if (hasRight) {
      logoCenterX = baseImg.width - offX;  // Logo center is offsetX pixels from RIGHT
      x = logoCenterX - (logoW / 2);  // Calculate top-left corner
      console.log('✅ RIGHT: centerX =', Math.round(logoCenterX), '→ cornerX =', Math.round(x));
    } else if (hasLeft) {
      logoCenterX = offX;  // Logo center is offsetX pixels from LEFT
      x = logoCenterX - (logoW / 2);
      console.log('✅ LEFT: centerX =', offX, '→ cornerX =', Math.round(x));
    } else if (hasCenter) {
      logoCenterX = baseImg.width / 2;
      x = logoCenterX - (logoW / 2);
      console.log('✅ CENTER: centerX =', Math.round(logoCenterX), '→ cornerX =', Math.round(x));
    } else {
      logoCenterX = baseImg.width - offX;
      x = logoCenterX - (logoW / 2);
      console.log('⚠️ DEFAULT RIGHT: centerX =', Math.round(logoCenterX), '→ cornerX =', Math.round(x));
    }
    
    console.log('🎯 FINAL:', {
      logoCenter: `(${Math.round(logoCenterX)}, ${Math.round(logoCenterY)})`,
      logoCorner: `(${Math.round(x)}, ${Math.round(y)})`,
      distFromCenterToTop: Math.round(logoCenterY),
      distFromCenterToRight: Math.round(baseImg.width - logoCenterX),
      distFromCenterToBottom: Math.round(baseImg.height - logoCenterY),
      distFromCenterToLeft: Math.round(logoCenterX)
    });
    
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ 
      success: true, 
      image: final,
      debug: {
        position: pos,
        logoCorner: { x: Math.round(x), y: Math.round(y) },
        logoCenter: { x: Math.round(logoCenterX), y: Math.round(logoCenterY) },
        distanceFromCenterToEdges: {
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
    status: 'API v9.0 - Center-Based Positioning',
    usage: {
      offsetX: 'Distance from logo CENTER to horizontal edge (pixels)',
      offsetY: 'Distance from logo CENTER to vertical edge (pixels)',
      examples: {
        'top-right with offsetX:100, offsetY:50': 'Logo center is 100px from RIGHT edge, 50px from TOP edge',
        'bottom-left with offsetX:0, offsetY:0': 'Logo center touches BOTTOM-LEFT corner',
        'top-right with offsetX:-50, offsetY:50': 'Logo center 50px PAST right edge (chopped), 50px from top'
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Center-Based API on port ${PORT}`));
