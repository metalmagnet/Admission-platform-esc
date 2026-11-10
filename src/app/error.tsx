'use client';

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="shell" style={{ maxWidth: 640 }}>
      <div className="page-head">
        <h1>That did not go through</h1>
      </div>
      <p className="error" role="alert">{error.message}</p>
      <p style={{ marginTop: 16 }}>
        <button className="btn" onClick={() => reset()}>Try again</button>
      </p>
    </main>
  );
}
