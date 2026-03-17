'use client';

import { useState } from 'react';
import { Link2, ExternalLink, Share2, Check } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  title: string;
  originalUrl?: string;
}

export function ShareButtons({ url, title, originalUrl }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      const fullUrl = typeof window !== 'undefined'
        ? `${window.location.origin}${url}`
        : url;
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title,
          url: typeof window !== 'undefined'
            ? `${window.location.origin}${url}`
            : url,
        });
      } catch {
        // User cancelled or not supported
      }
    }
  };

  const hasNativeShare =
    typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopyLink}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
        aria-label="Copy link"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-green-600" />
            Copied!
          </>
        ) : (
          <>
            <Link2 className="w-4 h-4" />
            Copy link
          </>
        )}
      </button>

      {originalUrl && (
        <a
          href={originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          View original
        </a>
      )}

      {hasNativeShare && (
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          aria-label="Share"
        >
          <Share2 className="w-4 h-4" />
          Share
        </button>
      )}
    </div>
  );
}
