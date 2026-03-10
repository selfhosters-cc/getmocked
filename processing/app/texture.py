import cv2
import numpy as np
from PIL import Image


def detect_texture(image: Image.Image, corners: list[dict]) -> dict:
    """Analyze texture within the defined overlay region."""
    img_cv = np.array(image.convert("RGB"))
    gray = cv2.cvtColor(img_cv, cv2.COLOR_RGB2GRAY)

    # Create mask from corners
    pts = np.array([[c["x"], c["y"]] for c in corners], dtype=np.int32)
    mask = np.zeros(gray.shape, dtype=np.uint8)
    cv2.fillConvexPoly(mask, pts, 255)

    # Extract region
    region = cv2.bitwise_and(gray, gray, mask=mask)

    # Edge detection
    edges = cv2.Canny(region, 50, 150)
    edge_pixels = np.count_nonzero(edges)
    total_pixels = np.count_nonzero(mask)
    edge_density = float(edge_pixels / max(total_pixels, 1))

    # Dominant direction via Sobel
    sobel_x = cv2.Sobel(region, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(region, cv2.CV_64F, 0, 1, ksize=3)

    angle = np.arctan2(
        np.mean(np.abs(sobel_y[mask > 0])),
        np.mean(np.abs(sobel_x[mask > 0]))
    )
    angle_deg = float(np.degrees(angle))

    if angle_deg < 30:
        direction = "horizontal"
    elif angle_deg > 60:
        direction = "vertical"
    else:
        direction = "diagonal"

    return {
        "edgeDensity": round(edge_density, 4),
        "dominantDirection": direction,
        "angleDeg": round(angle_deg, 2),
    }
