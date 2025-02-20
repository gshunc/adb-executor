let saveScreenshots = false; // Tracks whether screenshots should be saved
let isScreenshotLoopRunning = false; // Tracks if the screenshot loop is active

/**
 * Executes a command by sending it to the server and displays the result or error.
 * @param {string} command - The command to execute.
 * @param {Array} args - Optional arguments for the command.
 */
async function executeCommand(command, args = []) {
  const output = document.getElementById("output");
  output.textContent = "Executing command...";

  try {
    const response = await fetch("/api/adb", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command, args }),
    });

    const data = await response.json();
    if (response.ok) {
      output.textContent = data.result; // Display command result
    } else {
      output.textContent = `Error: ${data.error}`; // Display error from server
    }
  } catch (error) {
    output.textContent = `Error: ${error.message}`; // Display network or other errors
  }
}

/**
 * Takes a screenshot and updates the UI with the result.
 * @param {boolean} saveScreenshots - Whether to save the screenshot.
 * @param {string} command - The command to execute.
 * @param {Array} args - Optional arguments for the command.
 */
async function takeScreenshot(saveScreenshots, command, args = []) {
  const output = document.getElementById("output");
  const deviceScreen = document.getElementById("device-screen");
  output.textContent = "Taking screenshot...";

  try {
    const response = await fetch("/api/screenshot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command, args, saveScreenshots }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Screenshot failed");
    }

    // If it's a JSON response (for discarded screenshots), handle that
    if (response.headers.get("Content-Type").includes("application/json")) {
      const data = await response.json();
      output.textContent = data.message;
      return;
    }

    // For image responses, create a blob URL
    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);

    deviceScreen.src = imageUrl;
    deviceScreen.style.display = "block";

    // Get metadata from headers
    const count = response.headers.get("X-Screenshot-Count");
    document.getElementById(
      "clear-photos"
    ).textContent = `Clear Photos: ${count} photo(s)`;

    const model_response = JSON.parse(
      response.headers.get("X-Image-Completion")
    );

    switch (model_response.direction) {
      case "down":
        await scrollDown();
      case "up":
        await scrollUp();
      case "right":
        await scrollRight();
      case "left":
        await scrollLeft();
    }

    const llmOutput = document.getElementById("llm-output");

    if (llmOutput.textContent == "No output yet...") {
      llmOutput.textContent = "";
    }
    llmOutput.textContent += model_response.reasoning + "\n";

    output.textContent = `Screenshot captured`;

    // Clean up the blob URL when the image loads to prevent memory leaks
    deviceScreen.onload = () => URL.revokeObjectURL(imageUrl);
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
}

/**
 * Sends text input to the device.
 */
async function typeText() {
  await photoSaveController();
  const input = document.getElementById("input-text").value;

  if (!input) {
    document.getElementById("output").textContent =
      "Please enter a string to be typed.";
    return; // Exit if no input is provided
  }

  try {
    await executeCommand("shell", ["input", "text", `"${input}"`]);
  } catch (error) {
    document.getElementById("output").textContent = `Error: ${error.message}`;
  }
}

/**
 * Handles screen tap events and sends tap coordinates to the device.
 * @param {Event} e - The click event.
 */
async function pressScreen(e) {
  await photoSaveController();
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
    await photoSaveController();
    await executeCommand("shell", ["input", "keyevent", "KEYCODE_HOME"]);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Scrolls up on the device screen.
 */
async function scrollUp() {
  try {
    await photoSaveController();
    await executeCommand("shell", ["input", "swipe", 300, 300, 500, 1000]);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Scrolls down on the device screen.
 */
async function scrollDown() {
  try {
    await photoSaveController();
    await executeCommand("shell", ["input", "swipe", 500, 1000, 300, 300]);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Scrolls left on the device screen.
 */
async function scrollLeft() {
  try {
    await photoSaveController();
    await executeCommand("shell", ["input", "swipe", 300, 500, 1000, 500]);
  } catch (error) {
    console.error(error);
  }
}

/**
 * Scrolls right on the device screen.
 */
async function scrollRight() {
  try {
    await photoSaveController();
    await executeCommand("shell", ["input", "swipe", 1000, 500, 300, 500]);
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
 * Starts the screenshot loop.
 */
async function eventLoop() {
  isScreenshotLoopRunning = true;
  document.getElementById("clear-photos").disabled = true;
  document.getElementById("clear-photos").style.background = "gray";
  document.getElementById("device-starter").style.color = "lime";
  document.getElementById("device-stopper").style.background = "#007bff";
  document.getElementById("device-stopper").disabled = false;

  while (isScreenshotLoopRunning) {
    await takeScreenshot();
  }
}

/**
 * Stops the screenshot loop.
 */
function stopScreenshotLoop() {
  isScreenshotLoopRunning = false;
  document.getElementById("device-starter").style.color = "maroon";
  document.getElementById("clear-photos").disabled = false;
  document.getElementById("clear-photos").style.background = "#007bff";
  document.getElementById("device-stopper").style.background = "gray";
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
        statusIndicator.style.border = "5px solid green";
        statusIndicator.style.color = "green";
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

pollingLoop().catch((error) => {
  console.error("Fatal control loop error:", error);
  isRunning = false;
});

/**
 * Temporarily enforces screenshot saving for 501ms.
 */
async function photoSaveController() {
  try {
    saveScreenshots = true;
    setTimeout(() => {
      saveScreenshots = false;
    }, 1000);
  } catch (error) {
    console.log(error);
  }
}
