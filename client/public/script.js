let isScreenshotLoopRunning = false; // Tracks if the screenshot loop is active

/**
 * Executes a command by sending it to the server and displays the result or error.
 * @param {string} command - The command to execute.
 * @param {Array} args - Optional arguments for the command.
 */
async function executeCommand(command, args = []) {
  try {
    const response = await fetch("/api/adb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command, args }),
    });

    const data = await response.json();
  } catch (error) {
    console.log(error);
  }
}

/**
 * Sends text input to the device.
 */
async function typeText() {
  const input = document.getElementById("input-text").value;

  if (!input) {
    return; // Exit if no input is provided
  }

  try {
    await executeCommand("shell", ["input", "text", `"${input}"`]);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Sets the model provider based on the selected option.
 */
async function setModel() {
  const modelSelect = document.getElementById("model-select");
  const model = modelSelect.value;
  await fetch("/api/model", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model }),
  });
}

/**
 * Handles screen tap events and sends tap coordinates to the device.
 * @param {Event} e - The click event.
 */
async function pressScreen(e) {
  const cursorX = e.pageX;
  const cursorY = e.pageY;

  try {
    const response = await fetch("/api/dimensions", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    const screenWidth = document.getElementById("device-screen").scrollWidth;
    const screenHeight = document.getElementById("device-screen").scrollHeight;
    const originX = document
      .getElementById("device-screen")
      .getBoundingClientRect().left;
    const originY =
      document.getElementById("device-screen").getBoundingClientRect().top +
      window.scrollY;

    const yOffset = cursorY - originY;
    const xOffset = cursorX - originX;

    const convertedYOffset = Math.round((yOffset / screenHeight) * data.y);
    const convertedXOffset = Math.round((xOffset / screenWidth) * data.x);

    await executeCommand("shell", [
      "input",
      "tap",
      convertedXOffset,
      convertedYOffset,
    ]);
    await Promise.all([captureScreenshot(), setTimeout(resolve, 200)]);
  } catch (error) {
    console.error(error);
  }
}

// Attach event listener to the device screen
document
  .getElementById("device-screen")
  .addEventListener("click", pressScreen, true);

/**
 * Sends the "Home" command to the device.
 */
async function goHome() {
  try {
    await executeCommand("shell", ["input", "keyevent", "KEYCODE_HOME"]);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Swipes down on the device screen.
 */
async function swipeUp() {
  try {
    await executeCommand("shell", ["input", "swipe", 500, 1000, 500, 500]);
    await captureScreenshot();
  } catch (error) {
    console.error(error);
  }
}

/**
 * swipes up on the device screen.
 */
async function swipeDown() {
  try {
    await executeCommand("shell", ["input", "swipe", 500, 500, 500, 1000]);
    await captureScreenshot();
  } catch (error) {
    console.error(error);
  }
}

/**
 * swipes left on the device screen.
 */
async function swipeRight() {
  try {
    await executeCommand("shell", ["input", "swipe", 100, 500, 500, 500]);
    await captureScreenshot();
  } catch (error) {
    console.error(error);
  }
}

/**
 * swipes right on the device screen.
 */
async function swipeLeft() {
  try {
    await executeCommand("shell", ["input", "swipe", 500, 500, 100, 500]);
    await captureScreenshot();
  } catch (error) {
    console.error(error);
  }
}

/**
 * Clears saved photos from the server.
 */
async function clearPhotos() {
  try {
    const response = await fetch("/api/screencaps", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to clear photos");
    }

    const data = await response.json();
    document.getElementById("clear-photos").textContent = `Clear Photos: ${
      data.count || 0
    } photo(s)`;
  } catch (error) {
    console.error("Error clearing photos:", error);
  }
}

/**
 * Toggles the visibility of the output container.
 */
function toggleOutput() {
  const outputContainer = document.getElementById("output-container");
  if (outputContainer.style.display === "none") {
    outputContainer.style.display = "flex";
  } else {
    outputContainer.style.display = "none";
  }
  const button = document.getElementById("toggle-output");
  if (outputContainer.style.display === "none") {
    button.textContent = "Show";
  } else {
    button.textContent = "Hide";
  }
}

/**
 * Starts the screenshot loop.
 */
async function eventLoop() {
  isScreenshotLoopRunning = true;
  modelReasoningHistory = [];
  document.getElementById("device-starter").style.background = "lime";
  document.getElementById("device-stopper").style.background = "#007bff";
  document.getElementById("device-stopper").disabled = false;

  // Clear logs when event loop starts
  document.getElementById("llm-output").textContent = "No output yet...";
  try {
    await fetch("/api/clear-logs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
    console.log("Logs cleared successfully");
  } catch (error) {
    console.error("Error clearing logs:", error);
  }

  const userPrompt = document.getElementById("prompt-input").value;

  await fetch("/api/log-direction", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      direction: "USER STRATEGY",
      reasoning: "INITIAL USER STRATEGY CHECKPOINT",
      timestamp: new Date().toISOString(),
      userPrompt: userPrompt,
    }),
  });

  while (isScreenshotLoopRunning) {
    await screenshotAndMove();
    await captureScreenshot();
  }
}

/**
 * Takes a screenshot using the simplified capture endpoint.
 * @returns {Promise<void>}
 */
async function captureScreenshot() {
  try {
    const response = await fetch("/api/screenshot/capture", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const imageBlob = await response.blob();

    // Update the screenshot display
    const screenshotImg = document.getElementById("device-screen");
    screenshotImg.src = URL.createObjectURL(imageBlob);
    screenshotImg.style.display = "block";
  } catch (error) {
    console.error("Error taking screenshot:", error);
    document.getElementById(
      "status"
    ).textContent = `Error taking screenshot: ${error.message}`;
  }
}

let modelReasoningHistory = [];
let scoreHistory = [];
let adheranceHistory = [];

/**
 * Takes a screenshot and updates the UI with the result.
 * @param {string} command - The command to execute.
 * @param {Array} args - Optional arguments for the command.
 */
async function screenshotAndMove(command, args = []) {
  const promptInput = document.getElementById("prompt-input");
  const reasoningOutput = document.getElementById("llm-output");

  try {
    const userPrompt = promptInput.value;
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command, args, userPrompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Screenshot failed");
    }

    const model_response = await response.json();

    await fetch("/api/log-direction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        direction: model_response.direction,
        reasoning: model_response.reasoning,
        timestamp: new Date().toISOString(),
        userPrompt: userPrompt,
      }),
    });

    switch (model_response.direction) {
      case "DOWN":
        await swipeDown();
        break;
      case "UP":
        await swipeUp();
        break;
      case "RIGHT":
        await swipeRight();
        break;
      case "LEFT":
        await swipeLeft();
        break;
    }

    if (reasoningOutput.textContent == "No output yet...") {
      reasoningOutput.textContent = "";
    }

    modelReasoningHistory.push(model_response.reasoning);
    scoreHistory.push(model_response.gameScore);
    adheranceHistory.push(Math.round(model_response.adherence * 100));

    document.getElementById("game-score").textContent =
      model_response.gameScore;

    // Auto-scroll to the bottom of the reasoning output
    reasoningOutput.textContent = modelReasoningHistory.join("\n\n");
    nextStep();

    reasoningOutput.scrollTop = reasoningOutput.scrollHeight;
  } catch (error) {
    console.error(error);
  }
}

/**
 * Stops the screenshot loop.
 */
function stopScreenshotLoop() {
  isScreenshotLoopRunning = false;
  document.getElementById("device-starter").style.background = "maroon";
  document.getElementById("device-stopper").style.background = "dimgray";
  document.getElementById("device-stopper").disabled = true;
}

/**
 * Polls the device to check if it is online.
 * @returns {boolean} - True if the device is online, false otherwise.
 */
async function pollDevice() {
  const command = "devices";
  const args = [];

  const response = await fetch("/api/adb", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command, args }),
  });

  const data = await response.json();
  return data.result !== "List of devices attached\n\n";
}

let isRunning = true;

/**
 * Continuously polls the device status and updates the UI.
 */
async function pollingLoop() {
  while (isRunning) {
    try {
      const deviceOnline = await pollDevice();
      const statusIndicator = document.getElementById("status-indicator");

      if (deviceOnline) {
        statusIndicator.style.border = "5px solid lime";
        statusIndicator.style.color = "lime";
        statusIndicator.textContent = "Device Status: Connected";
      } else {
        statusIndicator.style.border = "5px dashed red";
        statusIndicator.style.color = "red";
        statusIndicator.textContent = "Device Status: Offline";
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } catch (error) {
      console.error("Fatal control loop error:", error);
      isRunning = false;
    }
  }
}

let currentStep = 0;

function nextStep() {
  if (currentStep < modelReasoningHistory.length - 1) {
    currentStep++;
  }

  updateReasoningOutput(currentStep);
}

function previousStep() {
  if (currentStep > 0) {
    currentStep--;
  }
  updateReasoningOutput(currentStep);
}

function updateReasoningOutput(step = currentStep) {
  const reasoningOutput = document.getElementById("llm-output");
  reasoningOutput.textContent = modelReasoningHistory
    .slice(0, step + 1)
    .join("\n");
  reasoningOutput.scrollTop = reasoningOutput.scrollHeight;
  document.getElementById("step-number").textContent = `${step + 1}/${
    modelReasoningHistory.length
  }`;
  document.getElementById("adherance-score").textContent =
    adheranceHistory[step];
  document.getElementById("game-score").textContent = scoreHistory[step];
}

pollingLoop().catch((error) => {
  console.error("Fatal control loop error:", error);
  isRunning = false;
});
