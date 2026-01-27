const express = require('express');
const { createCanvas, loadImage } = require('canvas');
const app = express();

app.use(express.json({ limit: '50mb' }));

app.post('/combine', async (req, res) => {
  try {
    const { baseImage, logoImage, logoSize = 10, padding = 40 } = req.body;
    
    const baseBuffer = Buffer.from(baseImage, 'base64');
    const logoBuffer = Buffer.from(logoImage, 'base64');
    
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
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
