/* Pre-paint theme application.

   Runs as a same-origin classic script before the body renders so the
   production CSP (`script-src 'self'`) needs no inline-script exception. */
(function () {
    try {
        var stored = window.localStorage.getItem("ripfetch:theme") || "system";
        var dark =
            stored === "dark" ||
            (stored !== "light" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        var theme = dark ? "dark" : "light";
        var root = document.documentElement;
        root.setAttribute("data-theme", theme);
        root.style.colorScheme = theme;
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute("content", dark ? "#0B0B0C" : "#F4F1EA");
    } catch {
        /* first paint falls back to the light token set */
    }
})();
