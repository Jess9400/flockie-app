import { useEffect } from "react";

// Close a modal/sheet on the Escape key. Pass `active` so the listener only
// runs while the surface is open.
export function useEsc(onClose: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, active]);
}
