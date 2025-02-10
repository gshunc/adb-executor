const express = require("express");
const fs = require("fs").promises;
const cors = require("cors");
const path = require("path");
const { execFile } = require("child_process");
const util = require("util");
const app = express();
const screenshotPath = process.env.SCREENSHOT_PATH;
const adbPath = process.env.ADB_PATH;
const execFileAsync = util.promisify(execFile);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/public/index.html"));
});

app.post("/api/adb", async (req, res) => {
  try {
    const { command, args = [] } = req.body;
    const { stdout } = await execFileAsync("./platform-tools/adb", [
      command,
      ...args,
    ]);
    res.json({ result: stdout });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/screenshot", async (req, res) => {
  try {
    const files = await fs.readdir("./public/screencaps");

    await execFileAsync("./platform-tools/adb", [
      "shell",
      "screencap",
      "-p",
      "/sdcard/screencap.png",
    ]);

    await execFileAsync("./platform-tools/adb", [
      "pull",
      "/sdcard/screencap.png",
    ]);

    const filename = `screenshot${files.length}.png`;
    const screenshotPath = path.join("./public/screencaps", filename);
    fs.rename("./screencap.png", screenshotPath, (err) => {
      if (err) {
        console.error(err);
        return;
      }
    });

    res.json({
      success: true,
      path: screenshotPath,
      filename: "/screencaps/" + filename,
      message: `Screenshot saved as ${filename}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

app.post("/api/tap", async (req, res) => {
  try {
    const { x, y } = req.body;

    if (!x || !y) {
      return res
        .status(400)
        .json({ error: "X and Y coordinates are required" });
    }

    const { stdout } = await execFileAsync(adbPath, [
      "shell",
      "input",
      "tap",
      x,
      y,
    ]);

    res.json({
      success: true,
      message: `Tapped at coordinates (${x}, ${y})`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/screencaps/:imageName", async (req, res) => {
  const imagePath = path.join(
    __dirname,
    "public/screencaps",
    req.params.imageName
  );
  res.sendFile(imagePath);
});

app.get("/api/dimensions", async (req, res) => {
  try {
    const { stdout } = await execFileAsync("./platform-tools/adb", [
      "shell",
      "wm",
      "size",
    ]);

    if (stdout) {
      let split_dimensions = stdout.split("x");
      var x = Number(split_dimensions[0].slice(-4));
      var y = Number(split_dimensions[1].slice(0, -1));
    } else {
      throw new Error("Dimension retrieval failed, please try again.");
    }

    res.json({
      success: true,
      x: x,
      y: y,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
