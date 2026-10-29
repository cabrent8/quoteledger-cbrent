import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyTextToClipboard } from '../lib/clipboard';

interface CopyActionButtonProps {
  label: string;
  getText: () => string;
}

export const CopyActionButton: React.FC<CopyActionButtonProps> = ({
  label,
  getText,
}) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClick = async () => {
    const text = getText();
    const ok = await copyTextToClipboard(text);
    if (!ok) return;

    setCopied(true);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, 2000);
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 min-h-10 sm:min-h-8 px-3 py-1.5 text-xs font-medium rounded-md border transition-opacity whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${
        copied
          ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
};
