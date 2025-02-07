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
    deviceScreen.src = data.filename;
    deviceScreen.style.display = "block";
  } catch (error) {
    output.textContent = `Error: ${error.message}`;
  }
}

async function clickCoordinate() {
  const x = document.getElementById("x-coord").value;
  const y = document.getElementById("y-coord").value;

  if (!x || !y) {
    document.getElementById("output").textContent =
      "Please enter both X and Y coordinates";
    return;
  }

  try {
    await executeCommand("shell", ["input", "tap", x, y]);
  } catch (error) {
    document.getElementById("output").textContent = `Error: ${error.message}`;
  }
}

async function typeText() {
  const input = document.getElementById("input-text").value;

  if (!input) {
    document.getElementById("output").textContent =
      "Please enter a string to be typed.";
  }

  try {
    await executeCommand("shell", ["input", "text", input]);
  } catch (error) {
    document.getElementById("output").textContent = `Error: ${error.message}`;
  }
}
