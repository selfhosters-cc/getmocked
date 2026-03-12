# Template Image Editor Design

**Goal:** Add crop and rotate editing to template images in the library, with server-side processing via sharp.

## Editor Modal

A modal component opened from library/template image cards. Contains:

- **Canvas area:** Full image with draggable, resizable crop overlay. Dark semi-transparent mask outside crop region.
- **Toolbar:** Rotate 90° left/right buttons, aspect ratio pills (Free, 1:1, 4:3, 3:2, 16:9), Cancel/Apply buttons.

## Flow

1. User clicks edit on a template image card (library page, site templates page)
2. Modal opens with full image, crop overlay defaults to full image area
3. User rotates and/or adjusts crop region with visual feedback
4. "Apply" sends crop coordinates + rotation to server
5. Server processes with sharp (rotate then crop), saves as new file (copy-on-edit)
6. Updates TemplateImage.imagePath and thumbnailPath, regenerates thumbnail
7. Modal closes, card refreshes

## API

`PATCH /api/template-images/[id]/edit`

```json
{
  "rotation": 90,
  "crop": { "x": 100, "y": 50, "width": 800, "height": 600 }
}
```

- `rotation`: 0, 90, 180, 270 degrees clockwise
- `crop`: pixel coordinates relative to the rotated image, optional

Server processing:
1. Load original with sharp
2. Apply `.rotate(rotation)` if non-zero
3. Apply `.extract()` if crop provided
4. Save as new file: `templates/library/{newUuid}.ext`
5. Generate thumbnail with `.rotate().resize(400)`
6. Update TemplateImage record (imagePath, thumbnailPath)
7. Old files stay on disk

## Crop Tool

- Preset aspect ratios: Free, 1:1, 4:3, 3:2, 16:9
- Draggable crop box with resize handles on corners/edges
- Dark overlay outside crop region
- Ratio pills toggle the constraint

## No Schema Changes

Reuses existing TemplateImage.imagePath and thumbnailPath fields.
