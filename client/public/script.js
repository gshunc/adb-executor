let saveScreenshots = false;

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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Screenshot failed");
    }

    output.textContent = data.message;
    if (data.kept == true) {
      console.log("hit");
      deviceScreen.src = `/api${data.filename}`;
      deviceScreen.style.display = "block";
      document.getElementById(
        "clear-photos"
      ).textContent = `Clear Photos: ${data.count} photo(s)`;
    }
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
}

async function typeText() {
  await photoSaveController();
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
  await photoSaveController();
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

async function eventLoop() {
  isScreenshotLoopRunning = true;
  document.getElementById("clear-photos").disabled = true;
  document.getElementById("clear-photos").style.background = "gray";
  document.getElementById("device-starter").style.color = "lime";

  while (isScreenshotLoopRunning) {
    await takeScreenshot();
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  document.getElementById("device-starter").style.color = "maroon";
  document.getElementById("clear-photos").disabled = false;
  document.getElementById("clear-photos").style.background = "#007bff";
}

function stopScreenshotLoop() {
  isScreenshotLoopRunning = false;
}

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
    await photoSaveController();
    await executeCommand("shell", ["input", "keyevent", "KEYCODE_HOME"]);
  } catch (error) {
    console.error(error);
  }
}

async function scrollUp() {
  try {
    await photoSaveController();
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
    await photoSaveController();
    setTimeout(
      await executeCommand("shell", ["input", "swipe", 500, 1000, 300, 300]),
      20
    );
  } catch (error) {
    console.error(error);
  }
}

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
    console.log(document.getElementById("clear-photos").textContent);
  } catch (error) {
    console.error("Error clearing photos:", error);
  }
}

async function photoSaveController() {
  try {
    saveScreenshots = true;
    setTimeout(() => {
      saveScreenshots = !saveScreenshots;
    }, 501);
  } catch (error) {
    console.log(error);
  }
}
