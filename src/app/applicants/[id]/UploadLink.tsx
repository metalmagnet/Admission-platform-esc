'use client';

import { useState, useTransition } from 'react';
import { createUploadLink, revokeUploadLinks } from '@/app/actions';

export function UploadLink({ applicantId, hasActive }: { applicantId: string; hasActive: boolean }) {
  const [link, setLink] = useState<{ url: string; expires: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setCopied(false);
            setLink(await createUploadLink(applicantId));
          })
        }
      >
        {hasActive || link ? 'Replace the upload link' : 'Create upload link'}
      </button>
      {link && (
        <>
          <p className="linkbox">{link.url}</p>
          <p className="small muted">Valid until {link.expires.slice(0, 10)}. It is shown once, so copy it now. Creating a new one cancels this one.</p>
          <button
            className="btn small"
            onClick={async () => {
              await navigator.clipboard.writeText(link.url);
              setCopied(true);
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </>
      )}
      {(hasActive || link) && (
        <button
          className="btn small quiet"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await revokeUploadLinks(applicantId);
              setLink(null);
            })
          }
        >
          Cancel the active link
        </button>
      )}
    </div>
  );
}
