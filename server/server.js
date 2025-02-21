const express = require("express");
require("dotenv").config();
const { checkAndUpdateScreenshot } = require("./utilities");
const fs = require("fs").promises;
const cors = require("cors");
const path = require("path");
const { execFile } = require("child_process");
const util = require("util");
const app = express();
const adbPath = process.env.ADB_PATH;
const execFileAsync = util.promisify(execFile);
const OpenAI = require("openai");
const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: openaiApiKey,
  organization: "org-M5bbHKG9FdHkKrOqHzDxVc3R",
  project: "proj_RAuvfuwRyarO0VoX7GmVgEVT",
});

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
    // Get screenshot data directly
    const { stdout } = await execFileAsync(
      "./platform-tools/adb",
      ["exec-out", "screencap -p"],
      { maxBuffer: 25 * 1024 * 1024, encoding: "buffer" }
    );

    const screenshotBuffer = stdout;

    const image_completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: "You are a game playing agent. Given an image of a 2048 game screen, it's your task to intelligently determine the best move. Think like a strategist. Carefully analyze the positions of the blocks, and determine how you can best accomplish the user's strategy. Tightly adhere to the user's entered strategy even if it's bad, but do the best you can with it. Determine an optimal move step by step, and then verify that your answer is possible. Give a detailed account of your reasoning in determining the optimal move. Return your answer as a json object similar to what follows: {direction: string, reasoning: string}.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "This is how I would like you to play the game: " +
                req.body.userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${screenshotBuffer.toString(
                  "base64"
                )}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const analysisJson = JSON.parse(
      image_completion.choices[0].message.content
    );

    res.json(analysisJson);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/screenshot/capture", async (req, res) => {
  try {
    // Get count first since we need it for comparison
    const files = await fs.readdir("./public/screencaps");
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
      path.join("./public/screencaps", filename),
      screenshotBuffer
    ).catch(console.error);

    res.set({
      "Content-Type": "image/png",
      "X-Screenshot-Count": currentCount,
      "X-Screenshot-Filename": filename
    });
    res.send(screenshotBuffer);
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
