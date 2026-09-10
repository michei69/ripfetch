import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, TriangleAlert, X, Copy, Check } from "lucide-react";

type SourceWarningModalProps = {
  open: boolean;
  source: string;
  domain: string;
  onConfirm: () => void;
  onDismiss: () => void;
  onDismissPermanently: () => void;
};

const CopyClickCode = ({ children }: { children: string }) => {
  const [work, setWork] = useState(false);
  const [error, setError] = useState(false);

  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (work || error) {
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => {
        setWork(false);
        setError(false);
      }, 2000);
    }
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, [work, error]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setWork(true);
    } catch {
      setError(true);
    }
  }, [children]);

  return (
    <button
      type="button"
      aria-label={`Copy password ${children}`}
      className={`mono inline-flex cursor-pointer items-center gap-1.5 border-b border-dashed border-line-strong align-baseline text-[12.5px] text-ink ${work ? "text-ink-mute" : ""} ${error ? "text-danger" : ""}`}
      onClick={copyLink}
    >
      {children}
      {!work && !error && <Copy className="size-3" aria-hidden="true" />}
      {work && <Check className="size-3" aria-hidden="true" />}
      {error && <X className="size-3" aria-hidden="true" />}
    </button>
  );
};

const WARNINGS: Record<string, { title: string; body: ReactNode }> = {
  "online-fix.me": {
    title: "Online-Fix.me zips are password protected",
    body: (
      <>
        Use the password <CopyClickCode>online-fix.me</CopyClickCode> to
        decompress the zip files.
      </>
    ),
  },
  ovagames: {
    title: "OvaGames zips are password protected",
    body: (
      <>
        Use the password <CopyClickCode>www.ovagames.com</CopyClickCode> to
        decompress the zip files.
      </>
    ),
  },
  igg: {
    title: "Beware of malware",
    body: (
      <>
        IGG Games (and its many clones) have been caught embedding their own
        DRM, crypto miners, etc. into their repacked games. Please be wary of
        any suspicious files. This source is still available here just in case
        there&apos;s no other one. Just be careful and have fun!
      </>
    ),
  },
  steamunlocked: {
    title: "Slow downloads",
    body: (
      <>
        SteamUnlocked is notorious for limiting its download speeds severly. Not
        only that, but often times they directly reupload packs from IGG or
        other sources. This should be your last resort.
      </>
    ),
  },
  dodirepacks: {
    title: "Use an adblocker",
    body: (
      <>
        Please use{" "}
        <a href="https://www.firefox.com/" target="_blank" rel="noreferrer">
          Firefox
        </a>{" "}
        +{" "}
        <a
          href="https://addons.mozilla.org/en-GB/firefox/addon/ublock-origin/"
          target="_blank"
          rel="noreferrer"
        >
          uBlock Origin
        </a>{" "}
        +{" "}
        <a
          href="https://violentmonkey.github.io/"
          target="_blank"
          rel="noreferrer"
        >
          ViolentMonkey
        </a>{" "}
        +{" "}
        <a
          href="https://codeberg.org/Amm0ni4/bypass-all-shortlinks-debloated"
          target="_blank"
          rel="noreferrer"
        >
          bypass-all-shortlinks-debloated
        </a>
        . Dodi&apos;s download links are shoved through layers of ad-powered
        redirects. Trust me, you don&apos;t want to go through them manually.
      </>
    ),
  },
  game3rb: {
    title: "Beware of malware",
    body: (
      <>
        Game3rb sometimes embeds malicious links / ads into their webpage, which
        this scraper is unable to detect. Please make sure you&apos;re
        downloading from a legitimate file hoster. If you&apos;re unsure, try
        using other sources.
      </>
    ),
  },
};

export function SourceWarningModal({
  open,
  source,
  domain,
  onConfirm,
  onDismiss,
  onDismissPermanently,
}: SourceWarningModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [activeSource, setActiveSource] = useState(source);

  // Keep the last real source around while the dialog closes so the
  // element stays mounted and focus restoration can run.
  useEffect(() => {
    if (source) setActiveSource(source);
  }, [source]);

  const warning = WARNINGS[activeSource];

  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;

    if (open && !element.open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      element.showModal();
    } else if (!open && element.open) {
      element.close();
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    }
  }, [open, activeSource]);

  if (!warning) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="source-warning-title"
      aria-describedby="source-warning-body"
      className="warning-dialog"
      onCancel={onDismiss}
    >
      <div className="dialog-head">
        <span className="mt-0.5 flex-none text-warn">
          <TriangleAlert size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="source-warning-title" className="dialog-title">
            {warning.title}
          </h3>
          <p className="dialog-sub">
            redirecting to <span className="text-ink">{domain}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close warning"
          className="btn"
          data-size="icon"
          data-variant="quiet"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <p id="source-warning-body" className="dialog-body">
        {warning.body}
      </p>

      <div className="dialog-actions">
        <button
          type="button"
          className="btn"
          data-variant="solid"
          onClick={onConfirm}
        >
          <ExternalLink size={15} aria-hidden="true" />
          Continue anyway
        </button>
        <button type="button" className="btn" data-grow="0" onClick={onDismiss}>
          Go back
        </button>
      </div>

      <button
        type="button"
        onClick={onDismissPermanently}
        className="dialog-dismiss"
      >
        Don&apos;t show this warning for {activeSource} again
      </button>
    </dialog>
  );
}

export { WARNINGS };
