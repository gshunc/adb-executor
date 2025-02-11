const sharp = require("sharp");
const path = require("path");

async function shouldKeepScreenshot(currentCount) {
  if (currentCount === 0) return true;

  const currentPath = path.join(
    "./public/screencaps",
    `screenshot${currentCount}.png`
  );
  const previousPath = path.join(
    "./public/screencaps",
    `screenshot${currentCount - 1}.png`
  );

  // Get image dimensions
  const metadata = await sharp(currentPath).metadata();
  const WIDTH = metadata.width;
  const HEIGHT = metadata.height;

  // Calculate block size - aim for roughly 9x20 blocks
  const BLOCK_SIZE = Math.floor(Math.min(WIDTH / 9, HEIGHT / 20));
  const BLOCKS_X = Math.floor(WIDTH / BLOCK_SIZE);
  const BLOCKS_Y = Math.floor(HEIGHT / BLOCK_SIZE);

  const [currentBuffer, previousBuffer] = await Promise.all([
    sharp(currentPath).raw().toBuffer(),
    sharp(previousPath).raw().toBuffer(),
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

      // Move to the next block in the spiral
      x += dx;
      y += dy;
      stepCount++;

      // Change direction when steps are completed
      if (stepCount === steps) {
        // Rotate direction (dx, dy) by 90 degrees
        [dx, dy] = [-dy, dx];
        stepCount = 0;

        // Increase steps every two direction changes
        if (dy === 0) {
          steps++;
        }
      }
    }
  }

  // Sample blocks in spiral order
  for (const [x, y] of spiralOrder(BLOCKS_X, BLOCKS_Y)) {
    // Sample the center pixel of the block
    const blockCenter = [
      x * BLOCK_SIZE + Math.floor(BLOCK_SIZE / 2),
      y * BLOCK_SIZE + Math.floor(BLOCK_SIZE / 2),
    ];

    // Optionally, sample one additional pixel (e.g., top-left corner)
    const blockTopLeft = [x * BLOCK_SIZE, y * BLOCK_SIZE];

    // Array of points to sample (center + optional corner)
    const points = [blockCenter, blockTopLeft];

    for (const [px, py] of points) {
      // Ensure we don't check pixels outside the image bounds
      if (px >= WIDTH || py >= HEIGHT) continue;

      const pos = (py * WIDTH + px) * 3;
      if (
        currentBuffer[pos] !== previousBuffer[pos] ||
        currentBuffer[pos + 1] !== previousBuffer[pos + 1] ||
        currentBuffer[pos + 2] !== previousBuffer[pos + 2]
      ) {
        return true;
      }
    }
  }

  return false;
}

module.exports = {
  shouldKeepScreenshot,
};
