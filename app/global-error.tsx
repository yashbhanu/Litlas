"use client";

/**
 * Last-resort error page when the root layout itself fails. It replaces the whole
 * document, so it can't rely on the app's CSS: styles are inline.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f5f7f9",
          color: "#1f2937",
        }}
      >
        <title>Something went wrong · Literary World Map</title>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#64748b" }}>
            Literary World Map couldn&apos;t load. Please try again.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#64748b" }}>Error {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={() => retry()}
            style={{
              marginTop: 16,
              padding: "10px 18px",
              borderRadius: 12,
              border: "none",
              background: "#0f766e",
              color: "white",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
