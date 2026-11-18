import { defineMeta } from "@/kit/types";
export default defineMeta({
  "slug": "image-lightbox",
  "name": "Image lightbox",
  "family": "content",
  "summary": "A modal enlarged-image viewer launched from a thumbnail.",
  "whenToUse": [
    "Inspect image detail without leaving the surrounding gallery.",
    "Navigate peer images with explicit controls; use carousel for inline image browsing."
  ],
  "avoidWhen": [
    "Text-rich object editing: use card-expand.",
    "A small nonblocking preview: use popover."
  ],
  "promptTerm": "modal image lightbox",
  "promptExample": "Use the “modal image lightbox” pattern to build an image lightbox that zooms from the clicked thumbnail to a large modal image, supports previous/next arrows and Escape, traps focus, and returns to the source thumbnail.",
  "aliases": [
    "Image lightbox",
    "Image viewer",
    "Gallery overlay"
  ],
  "timing": [
    {
      "phase": "enter",
      "ms": 220,
      "easing": "cubic-bezier(0.2,0.8,0.2,1)"
    },
    {
      "phase": "exit",
      "ms": 160,
      "easing": "cubic-bezier(0.4,0,1,1)"
    },
    {
      "phase": "reduced-motion",
      "ms": 0,
      "easing": "linear"
    }
  ],
  "loopMs": 5000,
  "a11y": [
    "Use a named role=dialog with aria-modal=true, an accessible close button, and meaningful image alt text.",
    "Move focus into the viewer, trap Tab, make the background inert, and lock background scroll.",
    "Escape closes; Left/Right change images unless focus is in a control that owns those keys.",
    "Name previous/next controls, announce the current image/count politely, and return focus to the originating thumbnail.",
    "Reduced motion: Open/close/switch images in 0 ms without zoom or crossfade."
  ],
  "primitives": [
    "Base UI Dialog 1.9.0 (MIT)",
    "Motion 14.8.0 (MIT)"
  ],
  "status": "ready"
});
