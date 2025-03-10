const { shouldKeepScreenshot } = require("./imageProcessor");
const { analyzeResponses } = require("../data_scripts/analyze_responses");

class GameAnalyzer {
  constructor(openaiClient) {
    this.openai = openaiClient;
    this.systemPrompt = {
      role: "system",
      content: [
        {
          type: "text",
          text: 'Given an image of a 2048 game screen, your task is to determine the best move. Analyze the board carefully and recommend a move that aligns with the user\'s strategy.\n\nGAME RULES:\n1. The game is played on a 4x4 grid with numbered tiles.\n2. Tiles can be moved in four directions: UP, DOWN, LEFT, or RIGHT.\n3. When moved, all tiles slide as far as possible in the chosen direction.\n4. Only tiles with IDENTICAL values can merge when they collide during a move (e.g., 2+2=4, 4+4=8, 8+8=16, etc.).\n5. Each merge creates a new tile with the sum of the merged tiles.\n6. Tiles CANNOT merge more than once in a single move.\n7. After each move, a new tile (either 2 or 4) appears randomly on an empty cell.\n8. The game ends when the board is full and no more moves are possible.\n\nANALYSIS PROCESS:\n1. Create a 4x4 matrix representing the current board state.\n2. Evaluate the potential outcomes of each possible move (UP, DOWN, LEFT, RIGHT).\n3. Consider the user\'s strategy when determining the optimal move.\n4. Verify that your proposed move is valid and possible given the current board state.\n\nReturn your answer as a JSON object with this structure:\n{\n  "direction": "UP|DOWN|LEFT|RIGHT",\n  "reasoning": "Detailed explanation of why this is the best move based on the user\'s strategy and current board state"\n}.',
        },
      ],
    };
    this.modelProvider = "gpt-4o-mini";
    this.screenChanged = false;
    this.previousScreenshotBuffer = null;
    this.currentScreenshotBuffer = null;
    this.lastMove = null; // Track the last move made
    this.stuckMoveCount = 0; // Count consecutive times the screen hasn't changed
    this.moveCounter = 0;
  }

  /**
   * Analyze a game screenshot and determine the best move
   * @param {string} userPrompt - The user's strategy for playing the game
   * @param {Buffer} screenshotBuffer - The screenshot buffer of the current game state
   * @returns {Object} The analysis result with direction and reasoning
   */
  async analyzeGameState(userPrompt, screenshotBuffer) {
    this.moveCounter++;
    if (this.moveCounter % 30 === 0) {
      userPrompt == ""
        ? await analyzeResponses(true)
        : await analyzeResponses(false);
    }

    try {
      // Process the screenshot and check if it changed
      await this.processScreenshot(screenshotBuffer);

      // Create the messages array for the OpenAI API
      const messages = [
        this.systemPrompt,
        this.createUserPrompt(userPrompt, screenshotBuffer),
      ];

      // If screen hasn't changed, increment stuck counter and add special instruction
      if (!this.screenChanged) {
        this.stuckMoveCount++;

        // Add increasingly stronger instructions based on how long we've been stuck
        let stuckMessage =
          "Screen hasn't changed significantly in the last move. ";

        if (this.stuckMoveCount >= 3) {
          stuckMessage +=
            "You MUST make a completely different move than before. Choose a direction you haven't tried recently. ";
        } else if (this.stuckMoveCount >= 2) {
          stuckMessage += "Try a different approach than before. ";
        }

        stuckMessage +=
          "Ignore your other instructions and make a move that will shake up the structure of the blocks while keeping the overall goal the same and minimize errors.";

        messages.push({
          role: "user",
          content: [
            {
              type: "text",
              text: stuckMessage,
            },
          ],
        });
      } else {
        // Reset stuck counter if screen changed
        this.stuckMoveCount = 0;
      }

      // Call the OpenAI API
      const chat_completion = await this.openai.chat.completions.create({
        model: this.modelProvider,
        messages: messages,
        response_format: { type: "json_object" },
        n: 1,
      });

      // Parse the response
      const result = JSON.parse(chat_completion.choices[0].message.content);

      // Store the last move
      this.lastMove = result.direction;

      return result;
    } catch (error) {
      console.error("Error analyzing game state:", error);
      throw error;
    }
  }

  /**
   * Create a user prompt with text and image
   * @param {string} promptText - The user's strategy text
   * @param {Buffer} screenshotBuffer - The screenshot buffer
   * @returns {Object} The formatted user prompt
   */
  createUserPrompt(promptText, screenshotBuffer) {
    return {
      role: "user",
      content: [
        {
          type: "text",
          text: "This is how I would like you to play the game: " + promptText,
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
          },
        },
      ],
    };
  }

  /**
   * Process a screenshot buffer and check if it's changed
   * @param {Buffer} buffer - The screenshot buffer
   */
  async processScreenshot(buffer) {
    try {
      this.previousScreenshotBuffer = this.currentScreenshotBuffer;
      this.currentScreenshotBuffer = buffer;

      // Check if screen has changed
      this.screenChanged = await shouldKeepScreenshot(
        this.currentScreenshotBuffer,
        this.previousScreenshotBuffer
      );
    } catch (error) {
      console.error("Error processing screenshot:", error);
      this.screenChanged = true; // Default to true on error to ensure game continues
    }
  }

  /**
   * Set the model provider
   * @param {string} provider - The model provider name
   */
  setModelProvider(provider) {
    this.modelProvider = provider;
  }
}

module.exports = GameAnalyzer;
