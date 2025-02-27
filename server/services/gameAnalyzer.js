const { shouldKeepScreenshot } = require("./imageProcessor");

class GameAnalyzer {
  constructor(openaiClient) {
    this.openai = openaiClient;
    this.systemPrompt = {
      role: "system",
      content: [
        {
          type: "text",
          text: "Given an image of a 2048 game screen, it's your task to determine the best move. Carefully analyze the positions of the number blocks, and determine how you can best accomplish the user's strategy. Create a matrix representing the screen, and decide based on that how to make a move and put this into your reasoning response. Tightly adhere to the user's entered strategy even if it's bad. Game rules: only like tiles can merge. Determine an optimal move and verify that your answer is possible. Only like tiles can be merged, for example 4+4 or 8+8, but not 4+2 or 8+4. Return your answer as a json object similar to what follows: {direction: string, reasoning: string}.",
        },
      ],
    };
    this.modelProvider = "gpt-4o-mini";
    this.screenChanged = false;
    this.previousScreenshotBuffer = null;
    this.currentScreenshotBuffer = null;
    this.lastMove = null; // Track the last move made
    this.stuckMoveCount = 0; // Count consecutive times the screen hasn't changed
  }

  /**
   * Analyze a game screenshot and determine the best move
   * @param {string} userPrompt - The user's strategy for playing the game
   * @param {Buffer} screenshotBuffer - The screenshot buffer of the current game state
   * @returns {Object} The analysis result with direction and reasoning
   */
  async analyzeGameState(userPrompt, screenshotBuffer) {
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
