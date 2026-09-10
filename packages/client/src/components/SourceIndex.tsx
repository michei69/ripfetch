import { SOURCES, SOURCE_COUNT, SOURCE_RANK } from "../lib/sources";

const NOTE_TONE: Record<string, string> = {
  "zip password": "warn",
  slow: "warn",
  "malware risk": "danger",
  adblocker: "warn",
};

/**
 * The catalogue of sources ripfetch scrapes, ruled like an index page. It is
 * the rail's answer to "what is this thing actually searching", and it doubles
 * as the legend for the warnings that appear before an external redirect.
 */
export function SourceIndex() {
  return (
    <section>
      <p className="label mb-1">{SOURCE_COUNT} sources</p>
      <div className="border-t border-line-soft">
        {SOURCES.map((source) => (
          <div key={source.key} className="src-item">
            <span className="src-item-no">
              {String(SOURCE_RANK[source.key]! + 1).padStart(2, "0")}
            </span>
            <span className="src-item-name">{source.name}</span>
            {source.note && (
              <span
                className="src-item-note"
                data-tone={NOTE_TONE[source.note]}
              >
                {source.note}
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
