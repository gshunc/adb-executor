/**
 * Service for generating text embeddings using OpenAI
 */
require('dotenv').config(); // Load environment variables from .env file
const { OpenAI } = require('openai');
const fs = require('fs').promises;
const path = require('path');

// Initialize OpenAI client with fallback for missing API key
let openai = null;
try {
  openai = new OpenAI(process.env.OPENAI_API_KEY);
} catch (error) {
  console.warn('OpenAI client initialization failed. Embeddings will not be available:', error.message);
}

// Cache file path
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const EMBEDDING_CACHE_FILE = path.join(CACHE_DIR, 'embedding_cache.json');

// In-memory cache
let embeddingCache = {};

/**
 * Initialize the cache
 */
async function initializeCache() {
  try {
    // Ensure cache directory exists
    try {
      await fs.access(CACHE_DIR);
    } catch (error) {
      await fs.mkdir(CACHE_DIR, { recursive: true });
    }

    // Try to load existing cache
    try {
      const cacheData = await fs.readFile(EMBEDDING_CACHE_FILE, 'utf-8');
      embeddingCache = JSON.parse(cacheData);
      console.log(`Loaded ${Object.keys(embeddingCache).length} cached embeddings`);
    } catch (error) {
      // Create empty cache file if it doesn't exist
      await fs.writeFile(EMBEDDING_CACHE_FILE, '{}');
      console.log('Created new embedding cache file');
    }
  } catch (error) {
    console.error('Error initializing embedding cache:', error);
  }
}

/**
 * Save the cache to disk
 */
async function saveCache() {
  try {
    await fs.writeFile(EMBEDDING_CACHE_FILE, JSON.stringify(embeddingCache, null, 2));
  } catch (error) {
    console.error('Error saving embedding cache:', error);
  }
}

/**
 * Generate an embedding for the given text
 * @param {string} text - The text to generate an embedding for
 * @returns {Promise<number[]|null>} - The embedding vector or null if generation failed
 */
async function generateEmbedding(text) {
  if (!text || typeof text !== 'string' || text.trim() === '') {
    return null;
  }

  const normalizedText = text.trim();
  
  // Check cache first
  if (embeddingCache[normalizedText]) {
    return embeddingCache[normalizedText];
  }

  // If OpenAI client isn't available, return null
  if (!openai) {
    console.warn('OpenAI client not available. Skipping embedding generation.');
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: normalizedText,
    });

    const embedding = response.data[0].embedding;
    
    // Cache the result
    embeddingCache[normalizedText] = embedding;
    
    // Save cache every 10 new embeddings
    if (Object.keys(embeddingCache).length % 10 === 0) {
      await saveCache();
    }
    
    return embedding;
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
  if (!embeddingA || !embeddingB || !Array.isArray(embeddingA) || !Array.isArray(embeddingB)) {
    return 0;
  }
  
  const dotProduct = embeddingA.reduce((sum, a, i) => sum + a * embeddingB[i], 0);
  const magnitudeA = Math.sqrt(embeddingA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(embeddingB.reduce((sum, b) => sum + b * b, 0));
  
  return dotProduct / (magnitudeA * magnitudeB);
}

// Initialize the cache when the module is loaded
initializeCache();

module.exports = {
  generateEmbedding,
  cosineSimilarity,
  saveCache
};
