const sharp = require("sharp");

async function shouldKeepScreenshot(currentBuffer, previousBuffer) {
  if (!previousBuffer) return true;

  // Create Sharp instances from the buffers
  const currentImage = sharp(Buffer.from(currentBuffer));
  const previousImage = sharp(Buffer.from(previousBuffer));

  // Get image dimensions from the current buffer
  const metadata = await currentImage.metadata();
  const WIDTH = metadata.width;
  const HEIGHT = metadata.height;

  // Calculate block size - aim for roughly 9x20 blocks
  const BLOCK_SIZE = Math.floor(Math.min(WIDTH / 9, HEIGHT / 20));
  const BLOCKS_X = Math.floor(WIDTH / BLOCK_SIZE);
  const BLOCKS_Y = Math.floor(HEIGHT / BLOCK_SIZE);

  // Convert both buffers to raw pixel data
  const [currentRaw, previousRaw] = await Promise.all([
    currentImage.raw().toBuffer(),
    previousImage.raw().toBuffer(),
  ]);

  // Function to get blocks in spiral order (starting from the center)
  function* spiralOrder(blocksX, blocksY) {
    let x = Math.floor(blocksX / 2);
    let y = Math.floor(blocksY / 2);
    let dx = 0;
    let dy = -1;
    let steps = 1;
    let stepCount = 0;

    for (let i = 0; i < blocksX * blocksY; i++) {
      if (x >= 0 && x < blocksX && y >= 0 && y < blocksY) {
        yield [x, y];
      }

      x += dx;
      y += dy;
      stepCount++;

      if (stepCount === steps) {
        [dx, dy] = [-dy, dx];
        stepCount = 0;

        if (dy === 0) {
          steps++;
        }
      }
    }
  }

  // Sample blocks in spiral order
  for (const [x, y] of spiralOrder(BLOCKS_X, BLOCKS_Y)) {
    const blockCenter = [
      x * BLOCK_SIZE + Math.floor(BLOCK_SIZE / 2),
      y * BLOCK_SIZE + Math.floor(BLOCK_SIZE / 2),
    ];
    const blockTopLeft = [x * BLOCK_SIZE, y * BLOCK_SIZE];

    const points = [blockCenter, blockTopLeft];

    for (const [px, py] of points) {
      if (px >= WIDTH || py >= HEIGHT) continue;

      const pos = (py * WIDTH + px) * 3;
      if (
        currentRaw[pos] !== previousRaw[pos] ||
        currentRaw[pos + 1] !== previousRaw[pos + 1] ||
        currentRaw[pos + 2] !== previousRaw[pos + 2]
      ) {
        return true;
      }
    }
  }

  return false;
}

// Store the last screenshot buffer in memory
let previousScreenshotBuffer = null;

async function checkAndUpdateScreenshot(newBuffer) {
  const shouldKeep = await shouldKeepScreenshot(
    newBuffer,
    previousScreenshotBuffer
  );
  if (shouldKeep) {
    previousScreenshotBuffer = newBuffer;
  }
  return shouldKeep;
}

module.exports = {
  checkAndUpdateScreenshot,
};
