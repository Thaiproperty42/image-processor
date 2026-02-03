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
      offsetX = 0,  // ✅ MANUAL X OFFSET FROM EDGE
      offsetY = 0,  // ✅ MANUAL Y OFFSET FROM EDGE
      position = 'top-right'
    } = req.body;
    
    console.log('📥 Received:', { logoSize, offsetX, offsetY, position });
    
    let baseBuffer, logoBuffer;
    
    if (baseImage) {
      baseBuffer = Buffer.from(baseImage, 'base64');
    } else if (baseImageUrl) {
      baseBuffer = await downloadImage(baseImageUrl);
    } else {
      return res.status(400).json({ error: 'Missing baseImage or baseImageUrl' });
    }
    
    const pos = String(position).toLowerCase().replace(/\s+/g, '').trim();
    
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
    
    // Calculate logo dimensions
    const logoW = baseImg.width * (Number(logoSize) / 100);
    const logoH = (logoImg.height / logoImg.width) * logoW;
    
    const offX = Number(offsetX);
    const offY = Number(offsetY);
    
    console.log('📐 Dimensions:', {
      base: `${baseImg.width}x${baseImg.height}`,
      logo: `${Math.round(logoW)}x${Math.round(logoH)}`,
      offsetX: offX,
      offsetY: offY
    });
    
    // ✅ SIMPLE POSITION CALCULATION
    let x, y;
    
    // Y position (vertical) - DISTANCE FROM EDGE
    if (pos.indexOf('top') >= 0) {
      y = offY;  // Distance from TOP edge
      console.log('✅ TOP: y = offsetY =', y);
    } else if (pos.indexOf('bottom') >= 0) {
      y = baseImg.height - logoH - offY;  // Distance from BOTTOM edge
      console.log('✅ BOTTOM: y = height - logoH - offsetY =', y);
    } else {
      y = (baseImg.height - logoH) / 2;
      console.log('✅ CENTER: y =', y);
    }
    
    // X position (horizontal) - DISTANCE FROM EDGE
    if (pos.indexOf('right') >= 0) {
      x = baseImg.width - logoW - offX;  // Distance from RIGHT edge
      console.log('✅ RIGHT: x = width - logoW - offsetX =', x);
    } else if (pos.indexOf('left') >= 0) {
      x = offX;  // Distance from LEFT edge
      console.log('✅ LEFT: x = offsetX =', x);
    } else {
      x = (baseImg.width - logoW) / 2;
      console.log('✅ CENTER: x =', x);
    }
    
    // Calculate logo center point
    const logoCenterX = x + (logoW / 2);
    const logoCenterY = y + (logoH / 2);
    
    // Calculate distances from logo center to edges
    const distFromTop = logoCenterY;
    const distFromBottom = baseImg.height - logoCenterY;
    const distFromLeft = logoCenterX;
    const distFromRight = baseImg.width - logoCenterX;
    
    console.log('🎯 Logo center:', {
      x: Math.round(logoCenterX),
      y: Math.round(logoCenterY)
    });
    
    console.log('📏 Distance from logo center to edges:', {
      top: Math.round(distFromTop),
      bottom: Math.round(distFromBottom),
      left: Math.round(distFromLeft),
      right: Math.round(distFromRight)
    });
    
    console.log('🎯 Final position:', { x: Math.round(x), y: Math.round(y) });
    
    // Draw logo
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ 
      success: true, 
      image: final,
      debug: {
        position: pos,
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
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'Image Combiner API v7.0 - Manual Offset Control',
    features: [
      '✅ offsetX = distance from LEFT/RIGHT edge (pixels)',
      '✅ offsetY = distance from TOP/BOTTOM edge (pixels)',
      '✅ Returns logo center point coordinates',
      '✅ Returns distances from logo center to all edges',
      '⚠️ Logo can go outside frame - you have full control'
    ],
    usage: {
      endpoint: '/combine',
      parameters: {
        logoSize: 'number (% of base width, default: 10)',
        offsetX: 'number (pixels from horizontal edge, default: 0)',
        offsetY: 'number (pixels from vertical edge, default: 0)',
        position: 'string (determines which edges offsetX/offsetY measure from)'
      },
      examples: {
        'top-right': 'offsetX = distance from RIGHT, offsetY = distance from TOP',
        'top-left': 'offsetX = distance from LEFT, offsetY = distance from TOP',
        'bottom-right': 'offsetX = distance from RIGHT, offsetY = distance from BOTTOM',
        'bottom-left': 'offsetX = distance from LEFT, offsetY = distance from BOTTOM'
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Manual Offset API running on port ${PORT}`));
