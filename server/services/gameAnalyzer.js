const { shouldKeepScreenshot } = require("./imageProcessor");
const { generateEmbedding, cosineSimilarity } = require("./embeddingService");
require("dotenv").config();
const OpenAI = require("openai");
const { Type, createPartFromText } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const axios = require("axios");

class GameAnalyzer {
  constructor(modelProvider) {
    this.modelProvider = modelProvider;
    this.decisionPrompt =
      'Based on the 2048 game board, determine the optimal move direction.\\n\\nDECISION PROCESS:\\n1. Review your matrix representation and strategic analysis.\\n2. Carefully evaluate the advantages and disadvantages of each possible move (UP, DOWN, LEFT, RIGHT).\\n3. Consider how each move aligns with the user\'s strategy (if provided).\\n4. Select the single best direction that maximizes score potential and board position.\\n5. Provide clear reasoning for your choice.\\n\\nReturn your answer as a JSON object with this exact structure:\\n{\\n  "direction": string,\\n  "reasoning": string\\n, "gameScore": number\\n}\\n\\nThe direction MUST be one of: "UP", "DOWN", "LEFT", or "RIGHT".\\nYour reasoning should be concise but complete, explaining why your chosen direction is optimal.';
    this.screenChanged = false;
    this.previousScreenshotBuffer = null;
    this.currentScreenshotBuffer = null;
    this.stuckMoveCount = 0; // Count consecutive times the screen hasn't changed
    this.moveCounter = 0;
    this.gameScore = 0;
    this.embeddings = [];
    this.moveHistory = [];
  }

  /**
   * Create a user prompt with text and image
   * @param {string} promptText - The user's strategy text
   * @param {Buffer} screenshotBuffer - The screenshot buffer
   * @returns {Object} The formatted user prompt
   */
  createUserPrompt(promptText, board) {
    if (this.modelProvider instanceof OpenAI) {
      const content = [];

      if (promptText !== "") {
        content.push({
          type: "text",
          text: "This is how I would like you to play the game: " + promptText,
        });
      }

      content.push({
        type: "text",
        text:
          "This is the active game board. Given the board, determine the best move direction.\n\n" +
          JSON.stringify(board.board),
      });

      return {
        role: "user",
        content,
      };
    } else {
      const parts = [];

      if (promptText !== "") {
        parts.push(
          createPartFromText(
            "This is how I would like you to play the game: " + promptText
          )
        );
      }

      parts.push(
        createPartFromText(
          "This is the active game board. Given the board, determine the best move direction.\n\n" +
            JSON.stringify(board.board)
        )
      );

      return {
        parts,
        role: "user",
      };
    }
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

  /**
   * Get the board state from a screenshot
   * @param {Buffer} screenshotBuffer - The screenshot buffer
   * @returns {Object} The board state
   */
  async _getBoardState(screenshotBuffer) {
    await this.processScreenshot(screenshotBuffer);
    const board = await this.analyzeWithOCR(screenshotBuffer);

    let messages = [];

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

      this.modelProvider instanceof OpenAI
        ? messages.push({
            role: "user",
            content: [
              {
                type: "text",
                text: stuckMessage,
              },
            ],
          })
        : messages.push({
            parts: [createPartFromText(stuckMessage)],
            role: "user",
          });
    } else {
      // Reset stuck counter if screen changed
      this.stuckMoveCount = 0;
    }

    return { board, messages };
  }

  /**
   * Build a prompt for the model
   * @param {Array} messages - The messages to build the prompt from
   * @param {string} userPrompt - The user's prompt
   * @param {string} rulesInput - The rules input
   * @param {Array} board - The current game board
   */
  _buildPrompt(messages, userPrompt, rulesInput, board) {
    if (this.modelProvider instanceof OpenAI) {
      messages.push({ role: "system", content: this.decisionPrompt });
      messages.push({ role: "user", content: rulesInput });
      messages.push({ role: "user", content: userPrompt });
      messages.push({
        role: "user",
        content:
          "Move History up to this point: " +
          // Move History has to be a string of only text, not json. Each entry in the moveHistory is an object.
          this.moveHistory.map((move) => JSON.stringify(move)).join("\n"),
      });
      messages.push({
        role: "user",
        content: "This is the active game board. " + JSON.stringify(board),
      });
    } else {
      messages.push({
        parts: [createPartFromText(rulesInput)],
        role: "user",
      });

      messages.push({
        parts: [createPartFromText(this.decisionPrompt)],
        role: "user",
      });

      messages.push({
        parts: [
          createPartFromText(
            "Move History up to this point: " +
              // Move History has to be a string of only text, not json. Each entry in the moveHistory is an object.
              this.moveHistory.map((move) => JSON.stringify(move)).join("\n")
          ),
        ],
        role: "user",
      });

      messages.push(this.createUserPrompt(userPrompt, board));
    }
  }

  async _determineAdherance(response, userPrompt) {
    let adherance = 0;
    if (userPrompt == "") {
      const embedding = await generateEmbedding(response.text);
      console.log("Embedding generated.");
      if (embedding) {
        this.embeddings.push(embedding);
        if (
          !fs.existsSync(
            path.join(__dirname, "..", "public", "embeddings.jsonl")
          )
        ) {
          fs.writeFileSync(
            path.join(__dirname, "..", "public", "embeddings.jsonl"),
            ""
          );
        }
        fs.appendFileSync(
          path.join(__dirname, "..", "public", "embeddings.jsonl"),
          JSON.stringify(embedding) + "\n"
        );
      }
    } else {
      const response_embedding = await generateEmbedding(response.text);
      const prompt_embedding = await generateEmbedding(userPrompt);
      const centroid = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "..", "public", "centroid.jsonl"),
          "utf-8"
        )
      );
      if (response_embedding && prompt_embedding) {
        const orthogonal_similarity = cosineSimilarity(
          this.orthogonalize(response_embedding, centroid),
          this.orthogonalize(prompt_embedding, centroid)
        );
        const base_similarity = cosineSimilarity(
          response_embedding,
          prompt_embedding
        );
        adherance = (base_similarity + orthogonal_similarity) / 2;
      }
    }
    return adherance;
  }

  /**
   * Analyze a game screenshot and determine the best move
   * @param {string} userPrompt - The user's strategy for playing the game
   * @param {Buffer} screenshotBuffer - The screenshot buffer of the current game state
   * @returns {Object} The analysis result with direction and reasoning
   */
  async analyzeGameState(userPrompt, rulesInput, screenshotBuffer) {
    try {
      const activeMove = { direction: null, board: null, reasoning: null };
      const { board, messages } = await this._getBoardState(screenshotBuffer);

      activeMove.board = board;

      this._buildPrompt(messages, userPrompt, rulesInput, board);

      // Call the model API
      let result;
      if (this.modelProvider instanceof OpenAI) {
        const chat_completion = await this.openai.chat.completions.create({
          model: process.env.MODEL_NAME,
          messages: messages,
          response_format: { type: "json_object" },
          n: 1,
        });
        result = JSON.parse(chat_completion.choices[0].message.content);
      } else {
        const response = await this.modelProvider.models.generateContent({
          model: process.env.GEMINI_MODEL,
          contents: messages,
        });

        result = JSON.parse(
          response.text.slice(
            response.text.indexOf("{"),
            response.text.indexOf("}") + 1
          )
        );
      }

      this.gameScore = result.gameScore;
      activeMove.direction = result.direction;
      activeMove.reasoning = result.reasoning;
      this.moveHistory.push(activeMove);

      result.adherence = await this._determineAdherance(result, userPrompt);

      return result;
    } catch (error) {
      console.error("Error analyzing game state:", error);
      throw error;
    }
  }

  /**
   * Analyze a game screenshot with OCR
   * @param {Buffer} screenshotBuffer - The screenshot buffer of the current game state
   * @returns {Object} The OCR result
   */
  async analyzeWithOCR(screenshotBuffer) {
    const formData = new FormData();
    formData.append("image", screenshotBuffer, {
      filename: "screenshot.png",
      contentType: "image/png",
    });
    const ocrResult = await axios.post("http://localhost:8000/ocr", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return ocrResult.data;
  }

  /**
   * Orthogonalize a vector with respect to a centroid
   * @param {number[]} vector - The vector to orthogonalize
   * @param {number[]} centroid - The centroid to orthogonalize against
   * @returns {number[]} The orthogonalized vector
   */
  orthogonalize(vector, centroid) {
    if (
      !vector ||
      !centroid ||
      !Array.isArray(vector) ||
      !Array.isArray(centroid)
    ) {
      if (!vector) console.log("vector is undefined");
      if (!centroid) console.log("centroid is undefined");
      if (!Array.isArray(vector)) console.log("vector is not an array");
      if (!Array.isArray(centroid)) console.log("centroid is not an array");
      throw new Error(
        "Invalid input: both vector and centroid must be non-empty arrays"
      );
    }

    const dot = (a, b) => a.map((x, i) => a[i] * b[i]).reduce((m, n) => m + n);
    const dotProduct = dot(vector, centroid);
    const centroidNorm = dot(centroid, centroid);

    const scale = dotProduct / centroidNorm;
    const scaledCentroid = centroid.map((x) => x * scale);

    const orthogonalized = vector.map((x, i) => x - scaledCentroid[i]);
    return orthogonalized;
  }
}

module.exports = GameAnalyzer;
