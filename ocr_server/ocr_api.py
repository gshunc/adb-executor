# Import necessary libraries
from threading import Thread
import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageOps, ImageFilter
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Initialize FastAPI app
app = FastAPI()

# Enable CORS to allow frontend applications to make API requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (change this in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Core Functions ---

def load_and_crop_board_from_array(img_array: np.ndarray) -> Image.Image:
    """
    Detects and crops the 2048 game board from an image.
    - Converts to grayscale
    - Applies Gaussian blur and Canny edge detection
    - Finds square-like contours with large enough area
    - Crops the largest valid board region
    """
    gray = cv2.cvtColor(img_array, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(cv2.GaussianBlur(gray, (5, 5), 0), 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    candidates = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        aspect = w / h
        if 0.85 < aspect < 1.15 and w * h > 30000:
            candidates.append((x, y, w, h))

    if not candidates:
        raise ValueError("⚠️ Board not found in the image!")

    # Use the largest candidate
    x, y, w, h = max(candidates, key=lambda b: b[2] * b[3])
    board = Image.fromarray(cv2.cvtColor(img_array[y:y + h, x:x + w], cv2.COLOR_BGR2RGB))
    return board


def split_into_tiles(board: Image.Image) -> list:
    """
    Splits the cropped board into 16 equally sized tiles (4x4 grid).
    """
    tile_size = board.width // 4
    return [
        board.crop((c * tile_size, r * tile_size, (c + 1) * tile_size, (r + 1) * tile_size))
        for r in range(4) for c in range(4)
    ]


def remove_tile_border(tile: Image.Image, margin_ratio=0.15) -> Image.Image:
    """
    Crops margins from the tile to remove borders for better OCR accuracy.
    """
    w, h = tile.size
    return tile.crop((
        int(w * margin_ratio),
        int(h * margin_ratio),
        int(w * (1 - margin_ratio)),
        int(h * (1 - margin_ratio))
    ))


def preprocess_tile(tile: Image.Image) -> Image.Image:
    """
    Converts the tile to grayscale, enhances contrast, thresholds the image,
    inverts dark tiles, applies a median filter, and removes tile borders.
    """
    tile = tile.convert("L")
    tile = ImageOps.autocontrast(tile)
    tile = tile.point(lambda x: 255 if x > 150 else 0)
    if np.array(tile).mean() < 100:
        tile = ImageOps.invert(tile)
    tile = tile.filter(ImageFilter.MedianFilter(3))
    tile = remove_tile_border(tile)
    return tile


def ocr_tile(tile: Image.Image, val_idx: int, values: list):
    """
    Performs OCR on a single tile and updates the shared `values` list at the specified index.
    Uses Tesseract with digit whitelist and Page Segmentation Mode 10 (single character).
    """
    tile = preprocess_tile(tile)
    config = "--psm 10 -c tessedit_char_whitelist=0123456789"
    text = pytesseract.image_to_string(tile, config=config).strip()
    if text.isdigit():
        val = int(text)
        # Accept only common 2048 tile values
        if val in [2 ** i for i in range(1, 12)] + [32, 128, 512]:
            values[val_idx] = val
            return
    values[val_idx] = 0


def ocr_board(tiles: list) -> np.ndarray:
    """
    Launches parallel OCR threads for all 16 tiles.
    Returns the board as a 4x4 NumPy array of recognized values.
    """
    values = [-1] * 16
    threads = []
    for idx, tile in enumerate(tiles):
        t = Thread(target=ocr_tile, args=(tile, idx, values))
        t.start()
        threads.append(t)

    for t in threads:
        t.join()

    if -1 in values:
        raise ValueError("OCR Failed!")

    return np.array(values).reshape((4, 4))


# --- FastAPI Endpoint ---

@app.post("/ocr")
async def ocr_endpoint(image: UploadFile = File(...)):
    """
    API endpoint to handle 2048 board image uploads.
    - Receives image file
    - Crops the board and splits it into tiles
    - Applies OCR to each tile
    - Returns the 4x4 board as JSON
    """
    try:
        contents = await image.read()
        print("Contents read:", contents)
        img_array = cv2.imdecode(np.frombuffer(contents, np.uint8), cv2.IMREAD_COLOR)

        board = load_and_crop_board_from_array(img_array)
        tiles = split_into_tiles(board)
        board_array = ocr_board(tiles)

        return {"board": board_array.tolist()}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


import os


@app.get("/debug/tessdata")
def find_tessdata():
    """Searches the filesystem for the location of `eng.traineddata` for debugging."""
    for root, dirs, files in os.walk("/"):
        if "eng.traineddata" in files:
            return {"found": os.path.join(root, "eng.traineddata")}
    return {"error": "eng.traineddata not found"}


@app.get("/debug/env")
def get_env():
    """Returns environment configuration for Tesseract path and tessdata prefix."""
    return {
        "tesseract_cmd": pytesseract.pytesseract.tesseract_cmd,
        "TESSDATA_PREFIX": os.environ.get("TESSDATA_PREFIX")
    }