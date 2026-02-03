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
      basePadding = 30,  // ✅ BASE PADDING VALUE
      position = 'bottom-right'
    } = req.body;
    
    console.log('📥 Received:', { logoSize, basePadding, position });
    
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
    const basePad = Number(basePadding);
    
    console.log('📐 Dimensions:', {
      base: `${baseImg.width}x${baseImg.height}`,
      logo: `${Math.round(logoW)}x${Math.round(logoH)}`,
      basePadding: basePad
    });
    
    // ✅ SMART PADDING LOGIC
    let x, y;
    
    // Step 1: Calculate base position (where logo WANTS to be)
    let baseX, baseY;
    
    // Y position preference
    if (pos.indexOf('top') >= 0) {
      baseY = basePad;
    } else if (pos.indexOf('bottom') >= 0) {
      baseY = baseImg.height - logoH - basePad;
    } else {
      baseY = (baseImg.height - logoH) / 2;
    }
    
    // X position preference
    if (pos.indexOf('right') >= 0) {
      baseX = baseImg.width - logoW - basePad;
    } else if (pos.indexOf('left') >= 0) {
      baseX = basePad;
    } else {
      baseX = (baseImg.width - logoW) / 2;
    }
    
    console.log('📍 Base position (before smart padding):', {
      x: Math.round(baseX),
      y: Math.round(baseY)
    });
    
    // Step 2: Calculate logo CENTER point
    const logoCenterX = baseX + (logoW / 2);
    const logoCenterY = baseY + (logoH / 2);
    
    console.log('🎯 Logo center point:', {
      x: Math.round(logoCenterX),
      y: Math.round(logoCenterY)
    });
    
    // Step 3: Calculate distances from center to all edges
    const distTop = logoCenterY;
    const distBottom = baseImg.height - logoCenterY;
    const distLeft = logoCenterX;
    const distRight = baseImg.width - logoCenterX;
    
    console.log('📏 Distances from logo center to edges:', {
      top: Math.round(distTop),
      bottom: Math.round(distBottom),
      left: Math.round(distLeft),
      right: Math.round(distRight)
    });
    
    // Step 4: Find closest edges
    const verticalMin = Math.min(distTop, distBottom);
    const horizontalMin = Math.min(distLeft, distRight);
    
    console.log('🔍 Closest edges:', {
      vertical: verticalMin === distTop ? 'TOP' : 'BOTTOM',
      horizontal: horizontalMin === distLeft ? 'LEFT' : 'RIGHT',
      verticalDist: Math.round(verticalMin),
      horizontalDist: Math.round(horizontalMin)
    });
    
    // Step 5: Apply smart padding adjustment
    // The closer to an edge, the MORE we reduce padding
    const maxDistanceForAdjustment = 500; // pixels
    
    let paddingAdjustmentY = 0;
    let paddingAdjustmentX = 0;
    
    // Vertical adjustment (closer to top/bottom = less padding)
    if (verticalMin < maxDistanceForAdjustment) {
      const ratio = 1 - (verticalMin / maxDistanceForAdjustment); // 0 to 1
      paddingAdjustmentY = basePad * ratio * 0.8; // Reduce up to 80% of padding
      
      if (distTop < distBottom) {
        // Closer to TOP - reduce top padding
        baseY = baseY - paddingAdjustmentY;
      } else {
        // Closer to BOTTOM - reduce bottom padding
        baseY = baseY + paddingAdjustmentY;
      }
    }
    
    // Horizontal adjustment (closer to left/right = less padding)
    if (horizontalMin < maxDistanceForAdjustment) {
      const ratio = 1 - (horizontalMin / maxDistanceForAdjustment); // 0 to 1
      paddingAdjustmentX = basePad * ratio * 0.8; // Reduce up to 80% of padding
      
      if (distLeft < distRight) {
        // Closer to LEFT - reduce left padding
        baseX = baseX - paddingAdjustmentX;
      } else {
        // Closer to RIGHT - reduce right padding
        baseX = baseX + paddingAdjustmentX;
      }
    }
    
    console.log('⚡ Smart padding adjustments:', {
      x: Math.round(paddingAdjustmentX),
      y: Math.round(paddingAdjustmentY)
    });
    
    // Step 6: Final position
    x = baseX;
    y = baseY;
    
    console.log('🎯 Final position (after smart padding):', {
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
        position: pos,
        finalX: Math.round(x),
        finalY: Math.round(y),
        logoCenter: {
          x: Math.round(logoCenterX),
          y: Math.round(logoCenterY)
        },
        edgeDistances: {
          top: Math.round(distTop),
          bottom: Math.round(distBottom),
          left: Math.round(distLeft),
          right: Math.round(distRight)
        },
        paddingAdjustments: {
          x: Math.round(paddingAdjustmentX),
          y: Math.round(paddingAdjustmentY)
        },
        logoSize: `${Math.round(logoW)}x${Math.round(logoH)}`,
        basePadding: basePad
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'Image Combiner API v6.0 - Smart Padding',
    features: [
      '✅ Smart padding based on logo center distance to edges',
      '✅ Closer to edge = automatically less padding',
      '✅ Farther from edge = full padding maintained',
      '✅ Works for all 9 positions'
    ],
    usage: {
      endpoint: '/combine',
      parameters: {
        logoSize: 'number (% of base width)',
        basePadding: 'number (base padding, auto-adjusts based on position)',
        position: 'string (top-left, top-right, center, etc.)'
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Smart Padding API running on port ${PORT}`));
