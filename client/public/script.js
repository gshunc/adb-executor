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
      output.textContent = data.result;
    } else {
      output.textContent = `Error: ${data.error}`;
    }
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
}

async function takeScreenshot(command, args = []) {
  const output = document.getElementById("output");
  const deviceScreen = document.getElementById("device-screen");
  output.textContent = "Taking screenshot...";

  try {
    const response = await fetch("/api/screenshot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command, args }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Screenshot failed");
    }

    output.textContent = data.message;
    deviceScreen.src = `/api${data.filename}`;
    deviceScreen.style.display = "block";
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
}

async function typeText() {
  const input = document.getElementById("input-text").value;

  if (!input) {
    document.getElementById("output").textContent =
      "Please enter a string to be typed.";
  }

  try {
    await executeCommand("shell", ["input", "text", `"${input}"`]);
  } catch (error) {
    document.getElementById("output").textContent = `Error: ${error.message}`;
  }
}

async function pressScreen(e) {
  let cursorX = e.pageX;
  let cursorY = e.pageY;

  try {
    const response = await fetch("/api/dimensions", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    let screen_width = document.getElementById("device-screen").scrollWidth;

    let screen_height = document.getElementById("device-screen").scrollHeight;

    let origin_x = document
      .getElementById("device-screen")
      .getBoundingClientRect().left;

    let origin_y =
      document.getElementById("device-screen").getBoundingClientRect().top +
      window.scrollY;

    let y_offset = cursorY - origin_y;
    let x_offset = cursorX - origin_x;

    let converted_y_offset = Math.round((y_offset / screen_height) * data.y);
    let converted_x_offset = Math.round((x_offset / screen_width) * data.x);

    await executeCommand("shell", [
      "input",
      "tap",
      converted_x_offset,
      converted_y_offset,
    ]);
  } catch (error) {
    console.error(error);
  }
}

document
  .getElementById("device-screen")
  .addEventListener("click", pressScreen, true);

let isScreenshotLoopRunning = false;

async function eventLoop(persistent_screenshots = true) {
  isScreenshotLoopRunning = true;

  while (isScreenshotLoopRunning) {
    await takeScreenshot();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

function stopScreenshotLoop() {
  isScreenshotLoopRunning = false;
}

function resetDevice() {}

async function pollDevice() {
  var command = "devices";
  var args = [];

  const response = await fetch("/api/adb", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ command, args }),
  });

  const data = await response.json();

  return data.result != "List of devices attached\n\n";
}

let isRunning = true;

async function pollingLoop() {
  while (isRunning) {
    try {
      let device_online = await pollDevice();
      if (device_online) {
        document.getElementById("status-indicator").style.border =
          "5px solid green";
        document.getElementById("status-indicator").style.color = "green";
        document.getElementById("status-indicator").textContent =
          "Device Status: Connected";
      } else {
        document.getElementById("status-indicator").style.border =
          "5px dashed red";
        document.getElementById("status-indicator").style.color = "red";
        document.getElementById("status-indicator").textContent =
          "Device Status: Offline";
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

async function goHome() {
  try {
    await executeCommand("shell", ["input", "keyevent", "KEYCODE_HOME"]);
  } catch (error) {
    console.error(error);
  }
}

async function scrollUp() {
  try {
    setTimeout(
      await executeCommand("shell", ["input", "swipe", 300, 300, 500, 1000]),
      20
    );
  } catch (error) {
    console.error(error);
  }
}

async function scrollDown() {
  try {
    setTimeout(
      await executeCommand("shell", ["input", "swipe", 500, 1000, 300, 300]),
      20
    );
  } catch (error) {
    console.error(error);
  }
}
