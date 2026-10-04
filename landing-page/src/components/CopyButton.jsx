import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyButton({ textToCopy, className = '', label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      className={`copy-btn ${copied ? 'copied' : ''} ${className}`}
      onClick={handleCopy}
      title="Copy to clipboard"
      type="button"
    >
      {copied ? (
        <>
          <Check size={14} />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy size={14} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}
