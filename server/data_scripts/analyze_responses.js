const fs = require("fs");
const path = require("path");
const {
  generateEmbedding,
  cosineSimilarity,
} = require("../services/embeddingService");

async function analyzeResponses(dryRun = false) {
  let userStrategy = "";
  if (dryRun) {
    userStrategy = "Keep the highest valued tile in the top left corner.";
  }
  // Define absolute paths
  const logsDir = path.join(__dirname, "..", "logs");
  const logFilePath = path.join(logsDir, "model_directions.jsonl");

  // Check if the file exists, if not create an empty one
  try {
    await fs.promises.access(logFilePath);
  } catch (error) {
    // Create the logs directory if it doesn't exist
    try {
      await fs.promises.mkdir(logsDir, { recursive: true });
    } catch (dirError) {
      if (dirError.code !== "EEXIST") {
        console.error("Error creating logs directory:", dirError);
        return;
      }
    }
    // Create an empty file
    await fs.promises.writeFile(logFilePath, "");
    return; // Exit early as there's nothing to analyze
  }

  // Read the file content
  let logs;
  try {
    logs = fs.readFileSync(logFilePath, "utf-8");
    if (!logs.trim()) {
      console.log("Log file is empty, nothing to analyze");
      return;
    }
  } catch (error) {
    console.error("Error reading log file:", error);
    return;
  }

  // Replace newlines within JSON objects to make them parseable
  let jsonContent = "[" + logs.replace(/}\s*{/g, "},{") + "]";

  let entries = [];
  try {
    entries = JSON.parse(jsonContent);
    console.log(`Successfully parsed ${entries.length} entries`);
  } catch (error) {
    console.error("Error parsing the JSON file:", error.message);
    return;
  }

  const entryCounts = entries.reduce((acc, entry) => {
    if (entry && entry.direction && entry.direction !== "USER STRATEGY") {
      acc[entry.direction] = (acc[entry.direction] || 0) + 1;
    }
    return acc;
  }, {});

  // Calculate percentages
  const total = Object.values(entryCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  Object.entries(entryCounts).forEach(([direction, count]) => {
    if (direction !== "USER STRATEGY") {
      const percentage = ((count / total) * 100).toFixed(2);
      console.log(`${direction}: ${percentage}%`);
    }
  });

  // Perform embedding-based similarity analysis
  console.log("Generating embeddings and calculating similarity...");

  // Get user strategy from the first entry
  if (!dryRun)
    userStrategy = entries.length > 0 ? entries[0].userPrompt || "" : "";

  // Generate embedding for user strategy
  const userStrategyEmbedding = await generateEmbedding(userStrategy);

  // Calculate similarity for each model reasoning
  const similarityScores = [];
  const directionSimilarities = {};

  // Process each entry for similarity calculation
  for (const entry of entries) {
    // Skip USER STRATEGY entries
    if (entry.direction === "USER STRATEGY") continue;

    // Generate embedding for the reasoning
    const reasoningEmbedding = await generateEmbedding(entry.reasoning);

    // Skip if either embedding failed
    if (!userStrategyEmbedding || !reasoningEmbedding) continue;

    // Calculate cosine similarity
    const similarity = cosineSimilarity(
      userStrategyEmbedding,
      reasoningEmbedding
    );

    // Store the score
    similarityScores.push({
      timestamp: entry.timestamp,
      direction: entry.direction,
      similarity: similarity,
    });

    // Group by direction
    if (!directionSimilarities[entry.direction]) {
      directionSimilarities[entry.direction] = [];
    }
    directionSimilarities[entry.direction].push(similarity);
  }

  // Calculate average similarity by direction
  const avgSimilarityByDirection = {};
  Object.entries(directionSimilarities).forEach(([direction, scores]) => {
    if (scores.length > 0) {
      const avgSimilarity =
        scores.reduce((sum, score) => sum + score, 0) / scores.length;
      avgSimilarityByDirection[direction] = avgSimilarity.toFixed(4);
    }
  });

  // Calculate overall average similarity
  const overallAvgSimilarity =
    similarityScores.length > 0
      ? (
          similarityScores.reduce((sum, score) => sum + score.similarity, 0) /
          similarityScores.length
        ).toFixed(4)
      : 0;

  console.log("Similarity analysis complete");
  console.log("Average similarity by direction:", avgSimilarityByDirection);
  console.log("Overall average similarity:", overallAvgSimilarity);

  // No need to save cache as it's been removed

  // Reset the logs file
  fs.writeFileSync(logFilePath, "");

  const statsFilePath = path.join(logsDir, "stats.json");
  fs.writeFileSync(
    statsFilePath,
    JSON.stringify(
      {
        userPrompt: userStrategy,
        dryRun: dryRun,
        totalEntries: entries.length,
        directionCounts: entryCounts,
        percentages: Object.entries(entryCounts).reduce(
          (acc, [direction, count]) => {
            if (direction !== "USER STRATEGY") {
              acc[direction] = ((count / total) * 100).toFixed(2);
            }
            return acc;
          },
          {}
        ),
        // Add similarity statistics
        similarityAnalysis: {
          overallAverage: overallAvgSimilarity,
          byDirection: avgSimilarityByDirection,
          similarityScores: similarityScores.map((score) => ({
            timestamp: score.timestamp,
            direction: score.direction,
            similarity: parseFloat(score.similarity.toFixed(4)),
          })),
        },
      },
      null,
      2
    )
  );
}

// Export as a function
module.exports = { analyzeResponses };

// Allow running this script directly from the command line
if (require.main === module) {
  console.log("Running analysis script directly...");
  analyzeResponses()
    .then(() => console.log("Analysis complete"))
    .catch((err) => console.error("Error running analysis:", err));
}
