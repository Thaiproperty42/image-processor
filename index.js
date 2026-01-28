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
    const { baseImage, logoImage, baseImageUrl, logoImageUrl, logoSize = 10, padding = 40 } = req.body;
    
    // Support both base64 and URLs
    let baseBuffer, logoBuffer;
    
    if (baseImage) {
      // Base64 provided
      baseBuffer = Buffer.from(baseImage, 'base64');
    } else if (baseImageUrl) {
      // URL provided
      baseBuffer = await downloadImage(baseImageUrl);
    } else {
      return res.status(400).json({ error: 'Missing baseImage or baseImageUrl' });
    }
    
    if (logoImage) {
      // Base64 provided
      logoBuffer = Buffer.from(logoImage, 'base64');
    } else if (logoImageUrl) {
      // URL provided
      logoBuffer = await downloadImage(logoImageUrl);
    } else {
      return res.status(400).json({ error: 'Missing logoImage or logoImageUrl' });
    }
    
    const baseImg = await loadImage(baseBuffer);
    const logoImg = await loadImage(logoBuffer);
    
    const canvas = createCanvas(baseImg.width, baseImg.height);
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(baseImg, 0, 0);
    
    const logoW = baseImg.width * (logoSize / 100);
    const logoH = (logoImg.height / logoImg.width) * logoW;
    
    ctx.drawImage(logoImg, baseImg.width - logoW - padding, baseImg.height - logoH - padding, logoW, logoH);
    
    const final = canvas.toBuffer('image/png').toString('base64');
    
    res.json({ success: true, image: final });
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'Image combiner API running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
