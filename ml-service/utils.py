import cv2

"""Function intended to detect the corners of a tile in the 2048 board. 
Finding corners and their relative positions is necessary for matrix ground truth generation."""
def tile_corner_detection(image):
    # TODO: Implement tile corner detection logic

    # Find contours
    contours, _ = cv2.findContours(image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # TODO: Implement corner detection logic

    tile_contours = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if 30000 < area < 67600:
            x, y, w, h = cv2.boundingRect(contour)
            if float(w) / float(h) > 0.9:
                tile_contours.append((x, y, w, h))
    
    
                

    return tile_contours