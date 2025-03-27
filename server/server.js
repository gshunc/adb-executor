require("dotenv").config();
const express = require("express");
const fs = require("fs").promises;
const cors = require("cors");
const path = require("path");
const { execFile } = require("child_process");
const util = require("util");
const sharp = require("sharp");
const GameAnalyzer = require("./services/gameAnalyzer");
const app = express();
const adbPath = process.env.ADB_PATH;
const execFileAsync = util.promisify(execFile);
const OpenAI = require("openai");
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiOrganization = process.env.OPENAI_ORGANIZATION;
const openai = new OpenAI({
  apiKey: openaiApiKey,
  organization: openaiOrganization,
});

const gameAnalyzer = new GameAnalyzer(openai);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client/public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/public/index.html"));
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
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

app.post("/api/analyze", async (req, res) => {
  try {
    // Get screenshot data directly
    const { stdout } = await execFileAsync(
      "./platform-tools/adb",
      ["exec-out", "screencap -p"],
      { maxBuffer: 25 * 1024 * 1024, encoding: "buffer" }
    );

    const screenshotBuffer = await sharp(stdout)
      .resize({ width: 512 })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Use the game analyzer to analyze the game state
    const analysisJson = await gameAnalyzer.analyzeGameState(
      req.body.userPrompt,
      screenshotBuffer
    );

    res.json(analysisJson);
  } catch (error) {
    console.error("Error in analyze route:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/screenshot/capture", async (req, res) => {
  try {
    // Get count first since we need it for comparison
    const files = await fs.readdir("./server/public/screencaps");
    const currentCount = files.length;

    // Use exec-out to get PNG data directly
    const { stdout } = await execFileAsync(
      "./platform-tools/adb",
      ["exec-out", "screencap -p"],
      { maxBuffer: 25 * 1024 * 1024, encoding: "buffer" }
    );

    const screenshotBuffer = stdout;

    // Save file asynchronously
    const filename = `screenshot${currentCount}.png`;
    fs.writeFile(
      path.join("./server/public/screencaps", filename),
      screenshotBuffer
    ).catch(console.error);

    res.set({
      "Content-Type": "image/png",
      "X-Screenshot-Count": currentCount,
      "X-Screenshot-Filename": filename,
    });
    res.send(screenshotBuffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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

app.delete("/api/screencaps", async (req, res) => {
  try {
    const imagePath = path.join(__dirname, "public/screencaps");
    const files = await fs.readdir(imagePath);
    await Promise.all(
      files.map((file) => fs.unlink(path.join(imagePath, file)))
    );
    res.json({ success: true, count: 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, count: null });
  }
});

app.post("/api/model/provider", (req, res) => {
  try {
    const { provider } = req.body;
    gameAnalyzer.setModelProvider(provider);
    res.json({ success: true, provider });
  } catch (error) {
    console.error("Error setting model provider:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to log model output directions to a file
app.post("/api/log-direction", async (req, res) => {
  try {
    const { direction, reasoning, timestamp, userPrompt } = req.body;

    // Create logs directory if it doesn't exist
    const logsDir = path.join(__dirname, "logs");
    try {
      await fs.access(logsDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(logsDir, { recursive: true });
    }

    // Ensure we have a valid userPrompt to use for embedding comparisons
    const validUserPrompt = userPrompt || "";

    // Format the log entry
    const logEntry = JSON.stringify(
      {
        direction,
        reasoning,
        timestamp,
        userPrompt: validUserPrompt,
      },
      null,
      2
    );

    // Append to a log file with timestamp in filename
    const logFilePath = path.join(logsDir, "model_directions.jsonl");
    await fs.appendFile(logFilePath, logEntry + "\n");

    res.json({ success: true, message: "Direction logged successfully" });
  } catch (error) {
    console.error("Error logging direction:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to clear the logs
app.post("/api/clear-logs", async (req, res) => {
  try {
    const logsDir = path.join(__dirname, "logs");
    const logFilePath = path.join(logsDir, "model_directions.jsonl");

    // Create logs directory if it doesn't exist
    try {
      await fs.access(logsDir);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(logsDir, { recursive: true });
    }

    // Clear the log file by writing an empty string
    await fs.writeFile(logFilePath, "");

    console.log("Logs cleared successfully");
    res.json({ success: true, message: "Logs cleared successfully" });
  } catch (error) {
    console.error("Error clearing logs:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get the analysis statistics including cosine similarity data
app.get("/api/stats", async (req, res) => {
  try {
    const logsDir = path.join(__dirname, "logs");
    const statsFilePath = path.join(logsDir, "stats.json");

    // Check if stats file exists
    try {
      await fs.access(statsFilePath);
    } catch (error) {
      // Return empty stats if file doesn't exist
      return res.json({
        userPrompt: "",
        totalEntries: 0,
        directionCounts: {},
        percentages: {},
        similarityAnalysis: {
          overallAverage: 0,
          byDirection: {},
          similarityScores: [],
        },
      });
    }

    // Read the stats file
    const statsData = await fs.readFile(statsFilePath, "utf-8");
    const stats = JSON.parse(statsData);

    res.json(stats);
  } catch (error) {
    console.error("Error retrieving stats:", error);
    res.status(500).json({ error: error.message });
  }
});
