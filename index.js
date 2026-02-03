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
      padding = 30,
      position = 'bottom-right'
    } = req.body;
    
    console.log('📥 Received:', { logoSize, padding, position });
    
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
    
    const logoW = baseImg.width * (Number(logoSize) / 100);
    const logoH = (logoImg.height / logoImg.width) * logoW;
    const pad = Number(padding);
    
    console.log('📐 Dimensions:', {
      base: `${baseImg.width}x${baseImg.height}`,
      logo: `${Math.round(logoW)}x${Math.round(logoH)}`,
      padding: pad,
      position: pos
    });
    
    // ✅ POSITION LOGIC - FIXED
    let x, y;
    
    // Y position (vertical)
    if (pos.indexOf('top') >= 0) {
      y = pad;
      console.log('✅ TOP detected, y =', y);
    } else if (pos.indexOf('bottom') >= 0) {
      y = baseImg.height - logoH - pad;
      console.log('✅ BOTTOM detected, y =', y);
    } else if (pos.indexOf('center') >= 0 || pos.indexOf('middle') >= 0) {
      y = (baseImg.height - logoH) / 2;
      console.log('✅ CENTER detected, y =', y);
    } else {
      y = baseImg.height - logoH - pad;
      console.log('⚠️ DEFAULT BOTTOM, y =', y);
    }
    
    // X position (horizontal)
    if (pos.indexOf('right') >= 0) {
      x = baseImg.width - logoW - pad;
      console.log('✅ RIGHT detected, x =', x);
    } else if (pos.indexOf('left') >= 0) {
      x = pad;
      console.log('✅ LEFT detected, x =', x);
    } else if (pos.indexOf('center') >= 0 || pos.indexOf('middle') >= 0) {
      x = (baseImg.width - logoW) / 2;
      console.log('✅ CENTER detected, x =', x);
    } else {
      x = baseImg.width - logoW - pad;
      console.log('⚠️ DEFAULT RIGHT, x =', x);
    }
    
    console.log('🎯 Drawing at:', { x: Math.round(x), y: Math.round(y) });
    
    ctx.drawImage(logoImg, x, y, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ 
      success: true, 
      image: final,
      debug: {
        position: pos,
        x: Math.round(x),
        y: Math.round(y),
        logoSize: `${Math.round(logoW)}x${Math.round(logoH)}`,
        padding: pad
      }
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    status: 'Image Combiner API v5.1',
    endpoint: '/combine'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API running on port ${PORT}`));
