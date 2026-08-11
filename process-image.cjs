const Jimp = require('jimp');
const fs = require('fs');

async function processImage() {
  try {
    console.log('Reading image...');
    const image = await Jimp.read('./public/poster.jpeg');
    
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    
    console.log(`Image loaded: ${width}x${height}`);
    
    image.rgba(true);
    
    // We assume the point (width/2, height * 0.4) is inside the white circle
    const startX = Math.floor(width / 2);
    const startY = Math.floor(height * 0.4);
    
    // Simple BFS for flood fill
    const queue = [[startX, startY]];
    const visited = new Uint8Array(width * height);
    
    let minX = width;
    let maxX = 0;
    let minY = height;
    let maxY = 0;
    
    const isWhite = (x, y) => {
      const idx = (image.bitmap.width * y + x) << 2;
      const r = image.bitmap.data[idx];
      const g = image.bitmap.data[idx + 1];
      const b = image.bitmap.data[idx + 2];
      return r > 200 && g > 200 && b > 200;
    };
    
    visited[startY * width + startX] = 1;
    
    let pixelsProcessed = 0;
    
    console.log('Starting flood fill...');
    while (queue.length > 0) {
      const [x, y] = queue.shift();
      
      // Mark as transparent
      const idx = (width * y + x) << 2;
      image.bitmap.data[idx + 3] = 0; // Alpha = 0
      
      // Update bounding box
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      
      pixelsProcessed++;
      
      // Check neighbors
      const neighbors = [
        [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]
      ];
      
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const vIdx = ny * width + nx;
          if (visited[vIdx] === 0) {
            visited[vIdx] = 1;
            if (isWhite(nx, ny)) {
              queue.push([nx, ny]);
            }
          }
        }
      }
    }
    
    console.log(`Flood fill completed. Processed ${pixelsProcessed} pixels.`);
    console.log(`Bounding box: x=${minX}, y=${minY}, w=${maxX - minX}, h=${maxY - minY}`);
    
    console.log('Saving transparent image...');
    await image.writeAsync('./public/poster-transparent.png');
    
    const config = {
      x: (minX / width) * 100,
      y: (minY / height) * 100,
      width: ((maxX - minX) / width) * 100,
      height: ((maxY - minY) / height) * 100
    };
    
    fs.writeFileSync('./src/poster-config.json', JSON.stringify(config, null, 2));
    console.log('Config saved to src/poster-config.json');
    console.log('Done!');
    
  } catch (err) {
    console.error('Error processing image:', err);
  }
}

processImage();
