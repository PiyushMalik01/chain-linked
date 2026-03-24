"use client";
import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Global error boundary for capturing unhandled React errors
 * @param props - Error boundary props
 * @param props.error - The error that was thrown
 * @param props.reset - Function to reset the error boundary
 * @returns Fallback UI for unhandled errors
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  );
}
