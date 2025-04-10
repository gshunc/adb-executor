const { shouldKeepScreenshot } = require("./imageProcessor");
const { generateEmbedding, cosineSimilarity } = require("./embeddingService");
require("dotenv").config();
const OpenAI = require("openai");
const { Type, createPartFromText } = require("@google/genai");
const fs = require("fs");
const path = require("path");

class GameAnalyzer {
  constructor(modelProvider) {
    this.modelProvider = modelProvider;
    let promptText =
      'Given an image of a 2048 game screen, your task is to determine the best move. Analyze the board carefully and recommend a move that aligns with the user\'s strategy.\n\nGAME RULES:\n1. The game is played on a 4x4 grid with numbered tiles.\n2. Tiles can be moved in four directions: UP, DOWN, LEFT, or RIGHT.\n3. When moved, all tiles slide as far as possible in the chosen direction.\n4. Only tiles with IDENTICAL values can merge when they collide during a move (e.g., 2+2=4, 4+4=8, 8+8=16, etc.).\n5. Each merge creates a new tile with the sum of the merged tiles.\n6. Tiles CANNOT merge more than once in a single move.\n7. After each move, a new tile (either 2 or 4) appears randomly on an empty cell.\n8. The game ends when the board is full and no more moves are possible.\n\nANALYSIS PROCESS:\n1. Create a 4x4 matrix representing the current board state.\n2. Evaluate the potential outcomes of each possible move (UP, DOWN, LEFT, RIGHT).\n3. Consider the user\'s strategy when determining the optimal move.\n4. Verify that your proposed move is valid and possible given the current board state.\n\nReturn your answer as a JSON object with this structure:\n{\n  "direction": string,\n  "reasoning": string\n}.';
    if (modelProvider instanceof OpenAI) {
      this.systemPrompt = {
        role: "system",
        content: [
          {
            type: "text",
            text: promptText,
          },
        ],
      };
    } else {
      this.analysisPrompt =
        "Given an image of a 2048 game screen, analyze the current board state and develop a strategy for the next move.\\n\\nGAME RULES:\\n1. The game is played on a 4x4 grid with numbered tiles.\\n2. Tiles can be moved in four directions: UP, DOWN, LEFT, or RIGHT.\\n3. When moved, all tiles slide as far as possible in the chosen direction.\\n4. Only tiles with IDENTICAL values can merge when they collide during a move (e.g., 2+2=4, 4+4=8, 8+8=16, etc.).\\n5. Each merge creates a new tile with the sum of the merged tiles.\\n6. Tiles CANNOT merge more than once in a single move.\\n7. After each move, a new tile (either 2 or 4) appears randomly on an empty cell.\\n8. The game ends when the board is full and no more moves are possible.\\n\\nANALYSIS TASKS:\\n1. Create a 4x4 matrix representing the current board state.\\n2. Consider the user's strategy if provided.\\n3. Describe your reasoning process in detail.\\n\\nProvide a detailed analysis of the board state and explain your strategic thinking. Additionally, keep track of the score of the game, and output that in your response.";
      this.decisionPrompt =
        'Based on your previous analysis of the 2048 game board, determine the optimal move direction.\\n\\nDECISION PROCESS:\\n1. Review your matrix representation and strategic analysis.\\n2. Carefully evaluate the advantages and disadvantages of each possible move (UP, DOWN, LEFT, RIGHT).\\n3. Consider how each move aligns with the user\'s strategy (if provided).\\n4. Select the single best direction that maximizes score potential and board position.\\n5. Provide clear reasoning for your choice.\\n\\nReturn your answer as a JSON object with this exact structure:\\n{\\n  "direction": string,\\n  "reasoning": string\\n, "gameScore": number\\n}\\n\\nThe direction MUST be one of: "UP", "DOWN", "LEFT", or "RIGHT".\\nYour reasoning should be concise but complete, explaining why your chosen direction is optimal.';
    }
    this.screenChanged = false;
    this.previousScreenshotBuffer = null;
    this.currentScreenshotBuffer = null;
    this.lastMove = null; // Track the last move made
    this.stuckMoveCount = 0; // Count consecutive times the screen hasn't changed
    this.moveCounter = 0;
    this.gameScore = 0;
    this.embeddings = [];
  }

  /**
   * Create a user prompt with text and image
   * @param {string} promptText - The user's strategy text
   * @param {Buffer} screenshotBuffer - The screenshot buffer
   * @returns {Object} The formatted user prompt
   */
  createUserPrompt(promptText, screenshotBuffer) {
    if (this.modelProvider instanceof OpenAI) {
      const content = [];

      if (promptText !== "") {
        content.push({
          type: "text",
          text: "This is how I would like you to play the game: " + promptText,
        });
      }

      content.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${screenshotBuffer.toString("base64")}`,
        },
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

      parts.push({
        inlineData: {
          data: Buffer.from(screenshotBuffer).toString("base64"),
          mimeType: "image/png",
        },
      });

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
   * Analyze a game screenshot and determine the best move
   * @param {string} userPrompt - The user's strategy for playing the game
   * @param {Buffer} screenshotBuffer - The screenshot buffer of the current game state
   * @returns {Object} The analysis result with direction and reasoning
   */
  async analyzeGameState(userPrompt, rulesInput, screenshotBuffer) {
    this.moveCounter++;
    // if (this.moveCounter % 30 === 0) {
    //   userPrompt == ""
    //     ? await analyzeResponses(true)
    //     : await analyzeResponses(false);
    // }

    try {
      // Process the screenshot and check if it changed
      await this.processScreenshot(screenshotBuffer);

      // Create the messages array for the OpenAI API
      let messages;
      if (this.modelProvider instanceof OpenAI) {
        messages = [
          this.systemPrompt,
          this.createUserPrompt(userPrompt, screenshotBuffer),
          { role: "user", content: rulesInput },
        ];
      } else {
        messages = [this.createUserPrompt(userPrompt, screenshotBuffer)];
      }

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
        messages.push({
          parts: [createPartFromText(this.analysisPrompt)],
          role: "user",
        });
        messages.push({
          parts: [createPartFromText(rulesInput)],
          role: "user",
        });
        const response = await this.modelProvider.models.generateContent({
          model: process.env.GEMINI_MODEL,
          contents: messages,
        });

        // Actually just write the embeddings one at a time to jsonl
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

        messages.push({
          parts: [createPartFromText(response.text)],
          role: "assistant",
        });

        messages.push({
          parts: [createPartFromText(this.decisionPrompt)],
          role: "user",
        });

        const response2 = await this.modelProvider.models.generateContent({
          model: process.env.GEMINI_MODEL,
          contents: messages,
          generationConfig: {
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                direction: { type: Type.STRING },
                reasoning: { type: Type.STRING },
                gameScore: { type: Type.NUMBER },
              },
            },
          },
        });

        result = JSON.parse(
          response2.text.slice(
            response2.text.indexOf("{"),
            response2.text.indexOf("}") + 1
          )
        );
        result.adherence = adherance;
      }

      // Store the last move
      this.lastMove = result.direction;
      this.gameScore = result.gameScore;

      return result;
    } catch (error) {
      console.error("Error analyzing game state:", error);
      throw error;
    }
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
