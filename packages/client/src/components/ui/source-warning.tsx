import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, TriangleAlert, X, Copy, Check } from "lucide-react";
import { Button } from "./button";

type SourceWarningModalProps = {
  open: boolean;
  source: string;
  domain: string;
  onConfirm: () => void;
  onDismiss: () => void;
  onDismissPermanently: () => void;
}

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
      className={`cursor-pointer hover:brightness-75 inline-flex flex-row items-center ml-2 font-mono ${work ? "text-phosphor" : ""} ${error ? "text-destructive" : ""}`}
      onClick={copyLink}
    >
      {children} {!work && !error && <Copy className="w-3 h-3 mr-2 ml-1" />}
      {work && <Check className="w-3 h-3 mr-2 ml-1" />}
      {error && <X className="w-3 h-3 mr-2 ml-1" />}
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
    title: "Beware of Malware!",
    body: (
      <>
        IGG Games (and its many clones) have been caught embedding their own
        DRM, crypto miners, etc. into their repacked games. Please be wary of
        any suspicious files. This source is still available here just in case
        there's no other one. Just be careful and have fun!
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
    title: "Use an adblocker!",
    body: (
      <>
        Please use{" "}
        <a
          href="https://www.firefox.com/"
          className="inline-flex flex-row items-center hover:brightness-75"
        >
          Firefox <ExternalLink className="h-3 w-3 ml-1" />
        </a>{" "}
        +{" "}
        <a
          href="https://addons.mozilla.org/en-GB/firefox/addon/ublock-origin/"
          className="inline-flex flex-row items-center hover:brightness-75"
        >
          uBlock Origin <ExternalLink className="h-3 w-3 ml-1" />
        </a>{" "}
        +{" "}
        <a
          href="https://violentmonkey.github.io/"
          className="inline-flex flex-row items-center hover:brightness-75"
        >
          ViolentMonkey <ExternalLink className="h-3 w-3 ml-1" />
        </a>{" "}
        +{" "}
        <a
          href="https://codeberg.org/Amm0ni4/bypass-all-shortlinks-debloated"
          className="inline-flex flex-row items-center hover:brightness-75"
        >
          bypass-all-shortlinks-debloated{" "}
          <ExternalLink className="h-3 w-3 ml-1" />
        </a>
        . Dodi's download links are shoved through layers of ad-powered
        redirects. Trust me, you don't want to go through them manually.
      </>
    ),
  },
  game3rb: {
    title: "Beware of Malware!",
    body: (
      <>
        Game3rb sometimes embeds malicious links / ads into their webpage, which
        this scraper is unable to detect. Please make sure you're downloading
        from a legitimate file hoster. If you're unsure, try using other
        sources.
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

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const warning = WARNINGS[source];

  if (!open || !warning) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="source-warning-title"
      aria-describedby="source-warning-body"
      className="fixed inset-0 z-50 m-auto w-full max-w-md border bg-background p-0 shadow-2xl backdrop:bg-black/55 open:animate-in fade-in"
      onCancel={onDismiss}
    >
      <div className="flex items-center justify-between gap-3 border-b bg-muted px-4 py-2">
        <h3
          id="source-warning-title"
          className="font-mono text-sm font-medium text-foreground"
        >
          <span className="mr-2 text-amber">[!]</span>
          {warning.title}
        </h3>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close warning"
          className="p-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-amber/50 bg-amber/10">
            <TriangleAlert className="h-5 w-5 text-amber" />
          </div>
          <p
            id="source-warning-body"
            className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground"
          >
            {warning.body}
          </p>
        </div>

        <p className="mb-6 text-xs leading-relaxed text-muted-foreground">
          Redirecting to:{" "}
          <span className="text-foreground">{domain}</span>
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={onConfirm} className="flex-1 rounded-none">
            <ExternalLink className="h-4 w-4" />
            Continue Anyway
          </Button>
          <Button
            variant="outline"
            className="rounded-none text-foreground"
            onClick={onDismiss}
          >
            Go Back
          </Button>
        </div>

        <button
          type="button"
          onClick={onDismissPermanently}
          className="mt-4 w-full text-center text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
        >
          Don&apos;t show this warning for {source} again
        </button>
      </div>
    </dialog>
  );
}

export { WARNINGS };
