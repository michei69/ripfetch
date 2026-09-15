import { type Component } from "solid-js";

/**
 * Lucide icons, inlined. The `lucide-solid` package still targets Solid 1.x
 * (`solid-js/web` + `mergeProps`), so the dozen glyphs this app draws live here
 * as raw paths instead — same 24px grid and 2px round stroke as upstream.
 */
export type IconProps = { size?: number; class?: string };

const svg = (shapes: string) =>
  function Icon(props: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={props.size ?? 16}
        height={props.size ?? 16}
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class={props.class}
        aria-hidden="true"
        innerHTML={shapes}
      />
    );
  };

const shape = (name: string, attrs: Record<string, string>) =>
  `<${name} ${Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ")}/>`;

const path = (d: string) => shape("path", { d });

export const ArrowLeft = svg(path("m12 19-7-7 7-7") + path("M19 12H5"));

export const Check = svg(path("M20 6 9 17l-5-5"));

export const ChevronDown = svg(path("m6 9 6 6 6-6"));

export const Copy = svg(
  shape("rect", { width: "14", height: "14", x: "8", y: "8", rx: "2" }) +
    path("M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"),
);

export const ExternalLink = svg(
  path("M15 3h6v6") +
    path("M10 14 21 3") +
    path("M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"),
);

export const Monitor = svg(
  shape("rect", { width: "20", height: "14", x: "2", y: "3", rx: "2" }) +
    path("M8 21h8") +
    path("M12 17v4"),
);

export const Moon = svg(
  path(
    "M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401",
  ),
);

export const RefreshCw = svg(
  path("M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8") +
    path("M21 3v5h-5") +
    path("M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16") +
    path("M8 16H3v5"),
);

export const Search = svg(
  path("m21 21-4.34-4.34") + shape("circle", { cx: "11", cy: "11", r: "8" }),
);

export const Sun = svg(
  shape("circle", { cx: "12", cy: "12", r: "4" }) +
    path("M12 2v2") +
    path("M12 20v2") +
    path("m4.93 4.93 1.41 1.41") +
    path("m17.66 17.66 1.41 1.41") +
    path("M2 12h2") +
    path("M20 12h2") +
    path("m6.34 17.66-1.41 1.41") +
    path("m19.07 4.93-1.41 1.41"),
);

export const TriangleAlert = svg(
  path(
    "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
  ) +
    path("M12 9v4") +
    path("M12 17h.01"),
);

export const X = svg(path("M18 6 6 18") + path("m6 6 12 12"));

export type Icon = Component<IconProps>;
