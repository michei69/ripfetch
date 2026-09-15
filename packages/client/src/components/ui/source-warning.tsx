import { createEffect, createSignal, Show, untrack } from "solid-js";
import type { JSX } from "@solidjs/web";
import { ExternalLink, TriangleAlert, X, Copy, Check } from "../icons";
import { copyToClipboard } from "../../lib/clipboard";

type SourceWarningModalProps = {
  open: boolean;
  source: string;
  domain: string;
  onConfirm: () => void;
  onDismiss: () => void;
  onDismissPermanently: () => void;
};

function CopyClickCode(props: { children: string }) {
  const [work, setWork] = createSignal(false);
  const [error, setError] = createSignal(false);

  createEffect(
    () => work() || error(),
    (settled) => {
      if (!settled) return;
      const timer = setTimeout(() => {
        setWork(false);
        setError(false);
      }, 2000);
      return () => clearTimeout(timer);
    },
  );

  const copyLink = async () => {
    if (await copyToClipboard(props.children)) setWork(true);
    else setError(true);
  };

  return (
    <button
      type="button"
      aria-label={`Copy password ${props.children}`}
      class={{
        "mono inline-flex cursor-pointer items-center gap-1.5 border-b border-dashed border-line-strong align-baseline text-[12.5px]": true,
        "text-ink": !work() && !error(),
        "text-ink-mute": work(),
        "text-danger": error(),
      }}
      onClick={copyLink}
    >
      {props.children}
      <Show
        when={work()}
        fallback={
          <Show when={error()} fallback={<Copy size={12} />}>
            <X size={12} />
          </Show>
        }
      >
        <Check size={12} />
      </Show>
    </button>
  );
}

const WARNINGS: Record<string, { title: string; body: JSX.Element }> = {
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

export function SourceWarningModal(props: SourceWarningModalProps) {
  let dialog: HTMLDialogElement | undefined;
  let returnFocus: HTMLElement | null = null;
  const [activeSource, setActiveSource] = createSignal(props.source);

  // Keep the last real source around while the dialog closes so the element
  // stays mounted and focus restoration can run.
  createEffect(
    () => props.source,
    (source) => {
      if (source) setActiveSource(source);
    },
  );

  const warning = () => WARNINGS[activeSource()];

  // A native dialog owns its own open state: `showModal`/`close` are the only
  // way to get the top layer, the backdrop and the focus trap, so the effect
  // mirrors the prop onto the element instead of unmounting it.
  //
  // `connected` is a signal the ref raises once the element exists: the ref
  // callback runs while the element is being built, before this component's
  // effects, so without it the first `open` would be dropped. The element is
  // rendered unconditionally for the same reason — the closed state is the
  // attribute, not the absence of the node — which also leaves it in place
  // for focus restoration while it closes.
  const [connected, setConnected] = createSignal(false);
  createEffect(
    () => [props.open, connected()] as const,
    ([open]) => {
      if (!dialog || !connected()) return;

      if (open && !dialog.open) {
        returnFocus = document.activeElement as HTMLElement | null;
        dialog.showModal();
      } else if (!open && dialog.open) {
        dialog.close();
        returnFocus?.focus();
        returnFocus = null;
      }
    },
  );

  const titleId = "source-warning-title";
  const bodyId = "source-warning-body";

  return (
    <dialog
      ref={(element) => {
        dialog = element;
        setConnected(true);
      }}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      class="warning-dialog"
      onCancel={() => untrack(props.onDismiss)}
    >
      <Show when={warning()}>
        {(content) => (
          <>
            <div class="dialog-head">
              <span class="mt-0.5 flex-none text-warn">
                <TriangleAlert size={18} />
              </span>
              <div class="min-w-0 flex-1">
                <h3 id={titleId} class="dialog-title">
                  {content().title}
                </h3>
                <p class="dialog-sub">
                  redirecting to <span class="text-ink">{props.domain}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={props.onDismiss}
                aria-label="Close warning"
                class="btn"
                data-size="icon"
                data-variant="quiet"
              >
                <X size={16} />
              </button>
            </div>

            <p id={bodyId} class="dialog-body">
              {content().body}
            </p>

            <div class="dialog-actions">
              <button
                type="button"
                class="btn"
                data-variant="solid"
                onClick={props.onConfirm}
              >
                <ExternalLink size={15} />
                Continue anyway
              </button>
              <button
                type="button"
                class="btn"
                data-grow="0"
                onClick={props.onDismiss}
              >
                Go back
              </button>
            </div>

            <button
              type="button"
              onClick={props.onDismissPermanently}
              class="dialog-dismiss"
            >
              Don&apos;t show this warning for {activeSource()} again
            </button>
          </>
        )}
      </Show>
    </dialog>
  );
}

export { WARNINGS };
