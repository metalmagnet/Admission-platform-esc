import type { Metadata } from 'next';
import Link from 'next/link';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import './globals.css';
import { supabaseServer } from '@/lib/supabase/server';
import { signOut } from './actions';

export const metadata: Metadata = {
  title: 'Admissions and visas',
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const db = await supabaseServer();
  const { data } = await db.auth.getUser();
  let name = '';
  if (data.user) {
    const { data: profile } = await db.from('profiles').select('full_name, role').eq('id', data.user.id).single();
    name = profile ? `${profile.full_name} (${profile.role})` : (data.user.email ?? '');
  }

  return (
    <html lang="en">
      <body>
        {data.user && (
          <header className="topbar">
            <div className="shell">
              <span className="brand">Admissions and visas</span>
              <nav>
                <Link href="/applicants">Applicants</Link>
                <Link href="/applicants/new">New applicant</Link>
              </nav>
              <div className="who">
                {name}
                <form action={signOut}>
                  <button className="btn small quiet">Sign out</button>
                </form>
              </div>
            </div>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
