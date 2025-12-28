# Features: Retro Gallery & Lightbox System

## 1. Retro Gallery
*   **Layout**: A lightweight, CSS-only masonry layout using Flexbox.
*   **Design**: Images are packed tightly with no gaps (`0` padding/margin), maintaining sequence order.
*   **Captions**: Semi-transparent overlays that slide down from the top upon hovering over an image.
*   **Responsiveness**: Automatically adjusts column counts based on screen width (e.g., 3 columns on desktop, 1 on mobile).
*   **Media Support**: seamless handling of both Images and Videos.

## 2. Lightbox (Image Viewer)
*   **Architecture**: A self-contained "Singleton" module that automatically creates its own user interface when the page loads.
*   **Viewing Modes**:
    1.  **Fit**: Fits the entire image within the screen (default).
    2.  **100%**: Shows the image at its true resolution (scroll to view).
    3.  **Crop**: Smartly fills the entire screen with the image, clipping edges to avoid black bars.
    4.  **Stretch**: Forces the image to fill the screen freely (ignoring aspect ratio).
*   **Interaction**: Supports "Drag-to-Pan" for moving around large images.
*   **Controls**: Keyboard support (Escape to close) and on-screen toolbar.

## 3. Floating Controls
*   **Placement**: A subtle, fixed control panel in the bottom-right corner of the screen.
*   **Behavior**: Low opacity (faded) by default to avoid distraction; brightens when hovered.
*   **Function**: Allows users to instantly change the gallery layout (e.g., switch between 2, 3, or 4 columns) without reloading.
*   **Style***: Retro aesthetics with button-style inputs.
