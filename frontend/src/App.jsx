import { Fragment, useEffect, useState } from "react";
import { exportKwic } from "./exportKwic";
import WordAnnotation, { SelectedOccurrence } from "./WordAnnotation";
import SavedReviews from "./SavedReviews";
import "./index.css";

function Icon({ name, ...props }) {
  const paths = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    lines: (
      <>
        <path d="M4 6h16M4 12h5m6 0h5M4 18h16" />
        <path d="M12 9v6" />
      </>
    ),
    reviews: (
      <>
        <path d="M8 4H5v17h14V4h-3" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="m8 13 3 3 5-6" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    book: (
      <>
        <path d="M12 5v16M3 4c4-1 6-1 9 1 3-2 5-2 9-1v15c-4-1-6-1-9 2-3-3-5-3-9-2Z" />
      </>
    ),
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

function Logo() {
  return (
    <svg className="brand-logo" viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="13" fill="#2166ac" />
      <path
        d="M10 13q6-2 12 1 6-3 12-1v19q-6-2-12 1-6-3-12-1Z"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M22 14v19M14 19h4m-4 5h4"
        stroke="#b9ddff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="31"
        cy="29"
        r="6"
        fill="#2166ac"
        stroke="white"
        strokeWidth="2"
      />
      <path
        d="m35.5 33.5 5 5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function bookLabel(source) {
  if (!source) return "All coursebooks";
  const match = source.match(/Corpus book (\d+)/i);
  return match ? `Headway ${match[1]}` : source.replace(/\.docx$/i, "");
}

function HighlightedText({ text, query, mode }) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern =
    mode === "whole_word"
      ? `(?<![\\p{L}\\p{N}_])(${escaped})(?![\\p{L}\\p{N}_])`
      : `(${escaped})`;
  return text
    .split(new RegExp(pattern, "giu"))
    .map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part));
}

export default function App() {
  const [view, setView] = useState("concordance");
  const [resultView, setResultView] = useState("kwic");
  const [query, setQuery] = useState("");
  const [searchKind, setSearchKind] = useState("genitive");
  const [variant, setVariant] = useState("all");
  const [mode, setMode] = useState("whole_word");
  const [sources, setSources] = useState([]);
  const [sourceFile, setSourceFile] = useState("");
  const [sourcesError, setSourcesError] = useState("");
  const [sourceAttempt, setSourceAttempt] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedRow, setExpandedRow] = useState(null);
  const [annotations, setAnnotations] = useState({});

  useEffect(() => {
    function clearDeletedReceipt(event) {
      const reviewId = event.detail?.review_id;
      if (!Number.isInteger(reviewId)) return;
      setAnnotations((previous) =>
        Object.fromEntries(
          Object.entries(previous).map(([key, result]) => {
            if (result.savedReview?.review_id !== reviewId)
              return [key, result];
            const updated = { ...result };
            delete updated.savedReview;
            return [key, updated];
          }),
        ),
      );
    }
    window.addEventListener("genitive-review-deleted", clearDeletedReceipt);
    return () =>
      window.removeEventListener("genitive-review-deleted", clearDeletedReceipt);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSources() {
      setSourcesError("");
      try {
        const response = await fetch("/sources", { signal: controller.signal });
        if (!response.ok) throw new Error("Could not load the coursebooks.");
        const result = await response.json();
        setSources(result.sources);
      } catch (error) {
        if (error.name !== "AbortError") {
          setSourcesError(
            "Could not load the book list. You can still search all coursebooks.",
          );
        }
      }
    }
    loadSources();
    return () => controller.abort();
  }, [sourceAttempt]);

  async function handleSearch(event, offset = null) {
    event.preventDefault();
    const term = query.trim();
    if ((searchKind === "word" && !term) || loading) return;
    setLoading(true);
    setError("");
    setData(null);
    setExpandedRow(null);
    setAnnotations({});
    setResultView("kwic");
    const parameters = new URLSearchParams(searchKind === "genitive" ? {variant, offset: String(offset ?? 0)} : { q: term, mode });
    if (offset !== null && data?.mode === "genitive") {
      parameters.set("variant", data.variant);
      if (data.source_file) parameters.set("source_file", data.source_file);
    } else if (sourceFile) parameters.set("source_file", sourceFile);
    try {
      const response = await fetch(`${searchKind === "genitive" ? "/analyse/genitives/candidates" : "/search"}?${parameters}`);
      if (!response.ok)
        throw new Error("Search is unavailable. Please try again.");
      setData(await response.json());
    } catch {
      setError(
        "Search is unavailable. Please check that the Python server is running and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="explorer-app">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <div>
            <span>Kimia’s</span>
            <strong>Corpus Explorer</strong>
          </div>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav aria-label="Workspace navigation">
          <button
            className={`nav-item ${view === "concordance" ? "active" : ""}`}
            type="button"
            aria-pressed={view === "concordance"}
            onClick={() => setView("concordance")}
          >
            <Icon name="lines" />
            <span>Concordance</span>
          </button>
          <button
            className={`nav-item ${view === "reviews" ? "active" : ""}`}
            type="button"
            aria-pressed={view === "reviews"}
            onClick={() => setView("reviews")}
          >
            <Icon name="reviews" />
            <span>Saved reviews</span>
          </button>
        </nav>
        <div className="sidebar-corpus">
          <span className="nav-label">YOUR CORPUS</span>
          <strong>Headway collection</strong>
          <span>English · {sources.length || 3} coursebooks</span>
        </div>
        <div className="sidebar-footer">
          <Icon name="book" />
          <span>
            A workspace for
            <br />
            exploring language.
          </span>
        </div>
      </aside>

      <main id="workspace" className="workspace" tabIndex={-1}>
        <header className="workspace-header">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            {view === "concordance" ? "Concordance" : "Saved reviews"}
          </div>
          <span className="collection-badge">
            <Icon name="book" />
            Headway · English
          </span>
        </header>

        <section
          className="concordance-view"
          hidden={view !== "concordance"}
          aria-labelledby="concordance-title"
        >
          <div className="page-heading">
            <span className="eyebrow">CORPUS TOOLS</span>
            <h1 id="concordance-title">Concordance</h1>
            <p>Find genitive candidates. Check the phrases. Code your research factors.</p>
          </div>
          <form className="search-panel" onSubmit={handleSearch}>
            <div className="view-switch" role="group" aria-label="Search task" style={{marginBottom:16}}>
              <button type="button" aria-pressed={searchKind === "genitive"} disabled={loading} onClick={() => {setSearchKind("genitive");setData(null);}}>Genitive candidates</button>
              <button type="button" aria-pressed={searchKind === "word"} disabled={loading} onClick={() => {setSearchKind("word");setData(null);}}>Word search</button>
            </div>
            <div className="search-fields">
              {searchKind === "genitive" ? <label htmlFor="variant">Construction candidates
                <select id="variant" value={variant} disabled={loading} onChange={e=>setVariant(e.target.value)}>
                  <option value="all">Both s and of</option><option value="s">s-genitives (’s and plural s’)</option><option value="of">of-genitives</option>
                </select>
              </label> : <>
              <label className="query-field" htmlFor="query">
                Word or phrase
                <div className="query-input">
                  <Icon name="search" />
                  <input
                    id="query"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Try penguin"
                    maxLength={100}
                    disabled={loading}
                    required
                  />
                </div>
              </label>
              <label htmlFor="mode">
                Match type
                <select
                  id="mode"
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  disabled={loading}
                >
                  <option value="whole_word">Whole words</option>
                  <option value="partial">Partial matches</option>
                </select>
              </label>
              </>}
              <label htmlFor="source">
                Coursebook
                <select
                  id="source"
                  value={sourceFile}
                  onChange={(event) => setSourceFile(event.target.value)}
                  disabled={loading || sources.length === 0}
                >
                  <option value="">All coursebooks</option>
                  {sources.map((source) => (
                    <option key={source} value={source}>
                      {bookLabel(source)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="search-button"
                type="submit"
                disabled={loading || (searchKind === "word" && !query.trim())}
              >
                <Icon name="search" />
                {loading ? "Searching…" : "Search"}
              </button>
            </div>
            <p className="search-hint">
              Candidates include contractions and non-genitive uses. Review each match before treating it as a genitive. Ordinary word search ignores capitalisation.
            </p>
          </form>

          {sourcesError && (
            <div className="notice" role="alert">
              {sourcesError}
              <button
                type="button"
                className="quiet-button"
                onClick={() => setSourceAttempt(sourceAttempt + 1)}
              >
                Retry book list
              </button>
            </div>
          )}
          {error && (
            <p className="notice error-notice" role="alert">
              {error}
            </p>
          )}
          {loading && (
            <div className="empty-panel" role="status">
              Searching your corpus…
            </div>
          )}
          {!data && !loading && !error && (
            <div className="empty-panel">
              <div className="empty-icon">
                <Icon name="lines" />
              </div>
              <h2>Language in context</h2>
              <p>Choose both variants, s or of, then Search to see candidates in source order.</p>
              <p className="muted">
                Open a line to suggest or manually enter genitive coding.
              </p>
            </div>
          )}

          {data && (
            <section className="results-panel" aria-label="Search results">
              <div className="results-topline">
                <div>
                  <h2>
                    Results for{" "}
                    <span className="query-title">“{data.query}”</span>
                  </h2>
                  <p role="status">
                    <strong>{data.total_occurrences.toLocaleString()}</strong>{" "}
                    occurrences in{" "}
                    <strong>
                      {data.total_matching_paragraphs.toLocaleString()}
                    </strong>{" "}
                    paragraphs <span className="separator">·</span>{" "}
                    {bookLabel(data.source_file)}{" "}
                    <span className="separator">·</span>{" "}
                    {data.mode === "genitive" ? "Candidates — screening required" : data.mode === "whole_word"
                      ? "Whole words"
                      : "Partial matches"}
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button export-button"
                  onClick={() => exportKwic(data)}
                  disabled={data.kwic_results.length === 0}
                  title="Download the displayed concordance rows"
                >
                  <Icon name="download" />
                  Export KWIC CSV
                </button>
              </div>
              {data.mode === "genitive" && <div className="results-toolbar">
                <button type="button" className="secondary-button" disabled={loading || data.offset === 0} onClick={e=>handleSearch(e, Math.max(0,data.offset-data.limit))}>Previous candidates</button>
                <span>Rows {data.total_occurrences ? data.offset+1 : 0}–{Math.min(data.offset+data.limit,data.total_occurrences)} of {data.total_occurrences}</span>
                <button type="button" className="secondary-button" disabled={loading || data.offset+data.limit >= data.total_occurrences} onClick={e=>handleSearch(e,data.offset+data.limit)}>Next candidates</button>
              </div>}
              <div className="results-toolbar">
                <div
                  className="view-switch"
                  role="group"
                  aria-label="Result display"
                >
                  <button
                    type="button"
                    aria-pressed={resultView === "kwic"}
                    onClick={() => setResultView("kwic")}
                  >
                    <Icon name="lines" />
                    KWIC
                  </button>
                  <button
                    type="button"
                    aria-pressed={resultView === "paragraphs"}
                    onClick={() => setResultView("paragraphs")}
                  >
                    <Icon name="book" />
                    Paragraphs
                  </button>
                </div>
                <span className="display-count">
                  {resultView === "kwic"
                    ? `Showing ${data.kwic_results.length} of ${data.total_occurrences} occurrences`
                    : `Showing ${data.results.length} of ${data.total_matching_paragraphs} paragraphs`}
                </span>
              </div>

              {data.total_matching_paragraphs === 0 ? (
                <div className="empty-panel no-match">
                  <h3>No matches found</h3>
                  <p>Check the spelling or try partial matches.</p>
                </div>
              ) : (
                <>
                  <div
                    className="kwic-scroll"
                    hidden={resultView !== "kwic"}
                    tabIndex={0}
                    role="region"
                    aria-label="Concordance table; scroll horizontally on small screens"
                  >
                    <table className="kwic-table">
                      <caption className="sr-only">
                        Concordance for {data.query}. Open a row for context and
                        analysis.
                      </caption>
                      <colgroup>
                        <col className="number-col" />
                        <col className="context-col" />
                        <col className="match-col" />
                        <col className="context-col" />
                        <col className="source-col" />
                        <col className="action-col" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col" className="left-heading">
                            Left context
                          </th>
                          <th scope="col" className="match-heading">
                            Keyword
                          </th>
                          <th scope="col">Right context</th>
                          <th scope="col">Source</th>
                          <th scope="col">
                            <span className="sr-only">Open context</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.kwic_results.map((row, index) => {
                          const key = JSON.stringify([
                            row.source_file,
                            row.paragraph_number,
                            row.start,
                            row.end,
                          ]);
                          const open = expandedRow === key;
                          const record = data.results.find(
                            (item) =>
                              item.source_file === row.source_file &&
                              item.paragraph_number === row.paragraph_number,
                          );
                          return (
                            <Fragment key={key}>
                              <tr className={open ? "selected-row" : ""}>
                                <td className="row-number">{index + 1}</td>
                                <td>
                                  <div
                                    className="left-context"
                                    title={row.left_context}
                                  >
                                    <span>{row.left_context}</span>
                                  </div>
                                </td>
                                <td className="keyword-cell">
                                  <span title={row.match}>
                                    <mark>{row.match}</mark>
                                  </span>
                                </td>
                                <td>
                                  <div
                                    className="right-context"
                                    title={row.right_context}
                                  >
                                    {row.right_context}
                                  </div>
                                </td>
                                <td
                                  className="source-cell"
                                  title={row.source_file}
                                >
                                  <span>{bookLabel(row.source_file)}</span>
                                  <small>¶ {row.paragraph_number}</small>
                                </td>
                                <td>
                                  <button
                                    className="row-toggle"
                                    type="button"
                                    aria-label={`${open ? "Close" : "Open"} context for occurrence ${index + 1}`}
                                    aria-expanded={open}
                                    aria-controls={`context-${index}`}
                                    onClick={() =>
                                      setExpandedRow(open ? null : key)
                                    }
                                  >
                                    <Icon name="arrow" />
                                  </button>
                                </td>
                              </tr>
                              {open && (
                                <tr
                                  id={`context-${index}`}
                                  className="context-row"
                                >
                                  <td colSpan={6}>
                                    <div className="context-detail">
                                      <div className="context-heading">
                                        <strong>
                                          {record
                                            ? "Paragraph context"
                                            : "Context excerpt"}
                                        </strong>
                                        <span>
                                          {bookLabel(row.source_file)} ·
                                          Paragraph {row.paragraph_number}
                                        </span>
                                      </div>
                                      {record ? (
                                        <p className="paragraph-text">
                                          <SelectedOccurrence
                                            text={record.text}
                                            start={row.start}
                                            end={row.end}
                                          />
                                        </p>
                                      ) : (
                                        <div className="excerpt-context">
                                          <span>{row.left_context}</span>
                                          <mark>{row.match}</mark>
                                          <span>{row.right_context}</span>
                                        </div>
                                      )}
                                      <WordAnnotation
                                        row={row}
                                        mode={data.mode}
                                        result={annotations[key]}
                                        onResult={(result) =>
                                          setAnnotations((previous) => ({
                                            ...previous,
                                            [key]: result,
                                          }))
                                        }
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div
                    className="paragraph-list"
                    hidden={resultView !== "paragraphs"}
                  >
                    {data.results.map((record) => (
                      <details
                        className="paragraph-disclosure"
                        key={`${record.source_file}:${record.paragraph_number}`}
                      >
                        <summary>
                          <span className="source-pill">
                            {bookLabel(record.source_file)}
                          </span>
                          <strong>Paragraph {record.paragraph_number}</strong>
                          <span className="muted">
                            {record.occurrences}{" "}
                            {record.occurrences === 1
                              ? "occurrence"
                              : "occurrences"}
                          </span>
                        </summary>
                        <div className="context-detail">
                          <p className="source-filename">
                            {record.source_file}
                          </p>
                          <p className="paragraph-text">
                            <HighlightedText
                              text={record.text}
                              query={data.query}
                              mode={data.mode}
                            />
                          </p>
                          <p className="muted">
                            Switch to KWIC and open a specific occurrence to
                            suggest its annotation.
                          </p>
                        </div>
                      </details>
                    ))}
                  </div>
                  <div className="results-footnote">
                    Open a row for full paragraph context. KWIC exports include the displayed rows; review downloads include all saved genitive reviews.
                  </div>
                </>
              )}
            </section>
          )}
        </section>

        <section
          className="reviews-view"
          hidden={view !== "reviews"}
          aria-labelledby="reviews-title"
        >
          <div className="page-heading review-page-heading">
            <div>
              <span className="eyebrow">RESEARCHER WORKSPACE</span>
              <h1 id="reviews-title">Saved reviews</h1>
              <p>
                Your genitive coding, original suggestions, word lengths and discourse factors.
              </p>
            </div>
          </div>
          <div className="review-content">
            <SavedReviews active={view === "reviews"} />
          </div>
        </section>
        <footer className="workspace-footer">
          Kimia’s Corpus Explorer{" "}
          <span>Corpus evidence · Researcher judgment</span>
        </footer>
      </main>
    </div>
  );
}
