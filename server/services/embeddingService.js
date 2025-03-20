/**
 * Service for generating text embeddings using OpenAI
 */
require("dotenv").config(); // Load environment variables from .env file
const { OpenAI } = require("openai");

// Initialize OpenAI client with fallback for missing API key
let openai = null;
try {
  openai = new OpenAI(process.env.OPENAI_API_KEY);
} catch (error) {
  console.warn(
    "OpenAI client initialization failed. Embeddings will not be available:",
    error.message
  );
}

/**
 * Generate an embedding for the given text
 * @param {string} text - The text to generate an embedding for
 * @returns {Promise<number[]|null>} - The embedding vector or null if generation failed
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== "string" || text.trim() === "") {
    return null;
  }

  const normalizedText = text.trim();

  // If OpenAI client isn't available, return null
  if (!openai) {
    console.warn("OpenAI client not available. Skipping embedding generation.");
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: normalizedText,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @param {number[]} embeddingA - First embedding vector
 * @param {number[]} embeddingB - Second embedding vector
 * @returns {number} - Cosine similarity score between 0 and 1
 */
function cosineSimilarity(embeddingA, embeddingB) {
  if (
    !embeddingA ||
    !embeddingB ||
    !Array.isArray(embeddingA) ||
    !Array.isArray(embeddingB)
  ) {
    return 0;
  }

  const dotProduct = embeddingA.reduce(
    (sum, a, i) => sum + a * embeddingB[i],
    0
  );
  const magnitudeA = Math.sqrt(embeddingA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(embeddingB.reduce((sum, b) => sum + b * b, 0));

  return dotProduct / (magnitudeA * magnitudeB);
}

module.exports = {
  generateEmbedding,
  cosineSimilarity,
};
