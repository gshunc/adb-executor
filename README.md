# ADB Executor

ADB Executor is a project for my mentored research at UNC. The goal of it is to provide a web interface for experimentation with ADB, building infrastructure for mobile agents, and collection of data for model training.

## Startup

This project uses a node backend. Install node, npm i, npm run start.

### Android Platform Tools

Visit this page: https://developer.android.com/tools/releases/platform-tools#downloads, and download the android platform tools. Place them in the server directory of the project.

### Environment Variables

Create a .env file in the root directory of the project. Add the following variables:

- PORT=3000
- NODE_ENV=development
- SCREENSHOT_PATH="./screencaps"
- ADB_PATH="./platform-tools/adb"
- OPENAI_API_KEY
- OPENAI_MODEL
- GEMINI_MODEL
- GEMINI_API_KEY
- GEMINI_PROJECT_NUMBER
- MODEL_PROVIDER
  - "openai" or "google"

### Device Usage

In order to use the software, you will have to connect an android device over USB-C or use the AVD (android virtual device) emulator inside of Android Studio.

### Model Provider

The model provider is the service that will be used to generate responses. It can be either OpenAI or Google Gemini.

OpenAI is the default model provider, but you can also use Google Gemini. While using Gemini, embedding for model scoring is still done by OpenAI.

    - While you can exclusively use OpenAI (i.e. exclude Gemini environment variables [provided you have OpenAI credits]), if you plan to use any code related to embeddings while using Gemini, an OpenAI token is required.

### OCR Setup

The OCR server is a FastAPI application that handles the OCR processing for the 2048 game board. It requires the following setup:

- Install dependencies: `cd ocr_server && pip install -r requirements.txt`
- Install Tesseract, the OCR engine: `brew install tesseract`
- Run the OCR server: `cd ocr_server && uvicorn ocr_api:app --reload`

### Running the Project

Run the server: `npm run start`

Run the OCR server: `cd ocr_server && uvicorn ocr_api:app --reload`

### Accessing the Application

The application can be accessed at http://localhost:3000.
