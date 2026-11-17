import { useCallback, useRef, useState } from "react";

/**
 * A live region for drag and drop and other changes that happen without moving focus. Render
 * `region` once, near the component; call `announce(text)` to have screen readers read it.
 */
export function useAnnouncer(politeness: "assertive" | "polite" = "assertive") {
  const [message, setMessage] = useState("");
  const flip = useRef(false);
  const announce = useCallback((text: string) => {
    // A trailing no-break space makes repeated identical messages count as a change.
    flip.current = !flip.current;
    setMessage(flip.current ? text : `${text} `);
  }, []);
  const region = (
    <div aria-live={politeness} aria-atomic="true" className="sr-only-ui" data-testid="announcer">
      {message}
    </div>
  );
  return { announce, region, message };
}
