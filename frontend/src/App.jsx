import { useEffect, useState } from "react";

function HighlightedText({ text, query, mode }) {
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const pattern =
    mode === "whole_word"
      ? `(?<![\\p{L}\\p{N}_])(${escapedQuery})(?![\\p{L}\\p{N}_])`
      : `(${escapedQuery})`;

  const parts = text.split(new RegExp(pattern, "giu"));

  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark
        key={index}
        style={{ backgroundColor: "#ffe08a", color: "#222" }}
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("whole_word");
  const [sources, setSources] = useState([]);
  const [sourceFile, setSourceFile] = useState("");
  const [sourcesError, setSourcesError] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadSources() {
      try {
        const response = await fetch("/sources", {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Could not load books: ${response.status}`);
        }

        const result = await response.json();
        setSources(result.sources);
      } catch (error) {
        if (error.name !== "AbortError") {
          setSourcesError(
            "The book list could not be loaded. You can still search all books."
          );
        }
      }
    }

    loadSources();

    return () => controller.abort();
  }, []);

  async function handleSearch(event) {
    event.preventDefault();

    const term = query.trim();
    if (!term || loading) return;

    setLoading(true);
    setError("");
    setData(null);

    const parameters = new URLSearchParams({
      q: term,
      mode: mode,
    });

    if (sourceFile) {
      parameters.set("source_file", sourceFile);
    }

    try {
      const response = await fetch(`/search?${parameters}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error(error);
      setError("Search is unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>Kimia’s Corpus Explorer</h1>
      <p>Explore English across three Headway coursebooks.</p>

      <form onSubmit={handleSearch}>
        <p>
          <label htmlFor="query">Search word or phrase: </label>
          <input
            id="query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try penguin"
            maxLength={100}
            disabled={loading}
            required
          />
        </p>

        <p>
          <label htmlFor="mode">Match type: </label>
          <select
            id="mode"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            disabled={loading}
          >
            <option value="whole_word">Whole words</option>
            <option value="partial">Partial matches</option>
          </select>
        </p>

        <p>
          <label htmlFor="source">Coursebook: </label>
          <select
            id="source"
            value={sourceFile}
            onChange={(event) => setSourceFile(event.target.value)}
            disabled={loading || sources.length === 0}
          >
            <option value="">All coursebooks</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </p>

        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>

      <p>Search ignores capitalisation.</p>

      {sourcesError && <p role="alert">{sourcesError}</p>}
      {error && <p role="alert">{error}</p>}

      {data && (
        <section>
          <p role="status">
            Found {data.total_occurrences} occurrences across{" "}
            {data.total_matching_paragraphs} paragraphs for “{data.query}”.
            {" "}Showing {data.results.length} paragraphs.
            {" "}Match type:{" "}
            {data.mode === "whole_word" ? "Whole words" : "Partial matches"}.
            {" "}Coursebook: {data.source_file || "All coursebooks"}.
          </p>
<h2>Key Word in Context</h2>
<button
  type="button"
  onClick={() => exportKwic(data)}
  disabled={data.kwic_results.length === 0}
>
  Download displayed KWIC rows as CSV
</button>
<p>
  Showing {data.kwic_results.length} of {data.total_occurrences} occurrences.
</p>

<div style={{ overflowX: "auto" }}>
  <table style={{ width: "100%", borderCollapse: "collapse" }}>
    <thead>
      <tr>
        <th style={{ padding: "8px", textAlign: "right" }}>
          Left context
        </th>
        <th style={{ padding: "8px" }}>Match</th>
        <th style={{ padding: "8px", textAlign: "left" }}>
          Right context
        </th>
        <th style={{ padding: "8px", textAlign: "left" }}>
          Source
        </th>
      </tr>
    </thead>

    <tbody>
      {data.kwic_results.map((row) => (
        <tr
          key={`${row.source_file}:${row.paragraph_number}:${row.start}`}
          style={{ borderBottom: "1px solid #aaa" }}
        >
          <td
            style={{
              padding: "8px",
              textAlign: "right",
              whiteSpace: "nowrap",
            }}
          >
            {row.left_context}
          </td>

          <td
            style={{
              padding: "8px",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            <mark style={{ backgroundColor: "#ffe08a", color: "#222" }}>
              {row.match}
            </mark>
          </td>

          <td style={{ padding: "8px", whiteSpace: "nowrap" }}>
            {row.right_context}
          </td>

          <td style={{ padding: "8px", textAlign: "left" }}>
            {row.source_file} · Paragraph {row.paragraph_number}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

<h2>Matching paragraphs</h2>
          {data.results.map((record) => (
            <article
              key={`${record.source_file}:${record.paragraph_number}`}
            >
              <p>
                <strong>{record.source_file}</strong>
                {" · "}Paragraph {record.paragraph_number}
                {" · "}Occurrences: {record.occurrences}
              </p>

              <p style={{ whiteSpace: "pre-wrap" }}>
                <HighlightedText
                  text={record.text}
                  query={data.query}
                  mode={data.mode}
                />
              </p>

              <hr />
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
import { exportKwic } from "./exportKwic";