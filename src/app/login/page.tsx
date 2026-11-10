import { signIn } from '../actions';

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <div>
        <h1>Sign in</h1>
        <p className="muted" style={{ marginTop: 8 }}>For admission agents and administrators.</p>
      </div>
      {error && <p className="error" role="alert">That email and password did not match.</p>}
      <form action={signIn} className="stack">
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        <button className="btn primary">Sign in</button>
      </form>
    </main>
  );
}
