import { useCallback, useEffect, useId, useRef, useState } from "react";

const styles = `
.reviews-toolbar { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
.reviews-download { position:relative; }
.reviews-download-options { position:absolute; right:0; top:calc(100% + 8px); z-index:10; width:220px; padding:6px; background:#fff; border:1px solid #cddfeb; border-radius:12px; box-shadow:0 8px 24px #244b6b20; }
.reviews-download-options button { display:block; width:100%; padding:12px; border:0; background:#fff; color:#204b6c; text-align:left; box-shadow:none; }
.reviews-download-options button:hover:not(:disabled) { background:#edf7ff; color:#133b5a; }
.reviews-download-options small { display:block; margin-top:3px; color:#60778b; font-weight:400; }
.review-delete-link { margin-top:12px; color:#a02e36; border-color:#e7c9cc; }
.review-delete-dialog { box-sizing:border-box; width:min(460px,calc(100vw - 32px)); max-height:calc(100svh - 40px); padding:28px; margin:auto; border:1px solid #cee3f2; border-radius:18px; background:#fff; color:#20394d; box-shadow:0 20px 70px #18496d30; text-align:left; color-scheme:light; }
.review-delete-dialog::backdrop { background:rgba(108,154,186,.26); backdrop-filter:blur(3px); }
.review-delete-dialog h2 { margin:0 0 12px; font-size:1.35rem; color:#193f5c; }
.review-delete-dialog p { margin:0 0 14px; line-height:1.55; overflow-wrap:anywhere; }
.review-delete-dialog .review-delete-target { padding:12px 14px; border-radius:10px; background:#f0f8ff; border:1px solid #dfedf8; }
.review-delete-dialog .review-delete-target small { display:block; margin-top:5px; color:#60778b; }
.review-delete-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:10px; margin-top:22px; }
.review-delete-dialog .review-confirm-delete { background:#b93642; color:#fff; border:1px solid #b93642; }
.review-delete-dialog .review-confirm-delete:hover:not(:disabled) { background:#9b2732; }
.review-delete-dialog [role="alert"] { padding:10px; background:#fff2f3; color:#8f2730; border-radius:8px; }
@media (max-width:600px) { .reviews-download-options { left:0; right:auto; max-width:calc(100vw - 64px); } }
.review-notice { padding:10px 14px; background:#edf7ff; color:#235775; border-radius:8px; }
`;

function savedTime(value) {
  if (!value) return "Unknown";
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function SavedReviews({ active = true }) {
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [pendingReview, setPendingReview] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const request = useRef(null);
  const deletion = useRef(null);
  const downloadRequest = useRef(null);
  const dialog = useRef(null);
  const refreshButton = useRef(null);
  const menu = useRef(null);
  const menuButton = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  const optionsId = useId();

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/reviews/genitives", {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Could not load reviews");
      const data = await response.json();
      if (!Array.isArray(data.reviews)) throw new Error("Unexpected response");
      if (!controller.signal.aborted) {
        setWords(data.reviews);
        setLoaded(true);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setError("Reviews could not be refreshed. Please try again.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    window.addEventListener("genitive-review-saved", load);
    return () => {
      request.current?.abort();
      deletion.current?.abort();
      downloadRequest.current?.abort();
      window.removeEventListener("genitive-review-saved", load);
    };
  }, [load]);

  useEffect(() => {
    if (active && pendingReview) {
      if (!dialog.current.open) dialog.current.showModal();
    } else if (dialog.current.open) dialog.current.close();
    if (!active) {
      setPendingReview(null);
      setMenuOpen(false);
    }
  }, [active, pendingReview]);

  useEffect(() => {
    if (!menuOpen) return;
    function outside(event) {
      if (!menu.current?.contains(event.target)) setMenuOpen(false);
    }
    function escape(event) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menuOpen]);

  async function downloadReviews(format) {
    if (downloadRequest.current) return;
    const controller = new AbortController();
    downloadRequest.current = controller;
    setDownloading(true);
    setDownloadError("");
    setMenuOpen(false);
    menuButton.current?.focus();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const url =
        format === "csv"
          ? "/reviews/genitives/export.csv"
          : "/reviews/genitives/export";
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Download failed");
      const type = response.headers.get("content-type") || "";
      if (!type.includes(format === "csv" ? "text/csv" : "application/json"))
        throw new Error("Unexpected download format");
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `genitive-reviews.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    } catch {
      setDownloadError(
        "The download could not be completed. Please try again.",
      );
    } finally {
      clearTimeout(timer);
      downloadRequest.current = null;
      setDownloading(false);
    }
  }

  async function deleteReview() {
    if (!pendingReview || deletion.current) return;
    const review = pendingReview;
    const controller = new AbortController();
    deletion.current = controller;
    request.current?.abort();
    setLoading(false);
    setDeleting(true);
    setDeleteError("");
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20000);
    try {
      const response = await fetch(`/reviews/genitives/${review.id}`, {
        method: "DELETE",
        signal: controller.signal,
      });
      const data = await response.json();
      const alreadyRemoved =
        response.status === 404 && data.detail === "Review not found.";
      if (
        !alreadyRemoved &&
        (!response.ok || data.deleted !== true || data.review_id !== review.id)
      ) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "The review could not be deleted.",
        );
      }
      if (controller.signal.aborted) return;
      setWords((previous) => previous.filter((item) => item.id !== review.id));
      await load();
      window.dispatchEvent(
        new CustomEvent("genitive-review-deleted", {
          detail: { review_id: review.id },
        }),
      );
      setDeleteMessage(
        alreadyRemoved
          ? `Review #${review.id} was already removed.`
          : `Genitive review #${review.id} deleted.`,
      );
      setPendingReview(null);
    } catch (error) {
      if (timedOut)
        setDeleteError(
          "Confirmation timed out. Cancel and refresh the list to check whether the review was removed.",
        );
      else if (!controller.signal.aborted)
        setDeleteError(
          error.message || "The review could not be deleted. Please try again.",
        );
    } finally {
      clearTimeout(timer);
      deletion.current = null;
      if (!controller.signal.aborted || timedOut) setDeleting(false);
    }
  }

  return (
    <section aria-label="Saved review records">
      <style>{styles}</style>
      <div className="reviews-toolbar">
        <button
          type="button"
          ref={refreshButton}
          onClick={load}
          disabled={loading || deleting}
        >
          {loading ? "Loading reviews…" : "Refresh saved reviews"}
        </button>
        <div
          className="reviews-download"
          ref={menu}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setMenuOpen(false);
          }}
        >
          <button
            type="button"
            className="secondary-button"
            ref={menuButton}
            aria-expanded={menuOpen}
            aria-controls={optionsId}
            disabled={downloading || deleting}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {downloading ? "Downloading…" : "Download reviews"}{" "}
            <span aria-hidden="true">▾</span>
          </button>
          {menuOpen && (
            <div className="reviews-download-options" id={optionsId}>
              <button type="button" onClick={() => downloadReviews("csv")}>
                CSV (.csv)<small>Open in Excel or Numbers</small>
              </button>
              <button type="button" onClick={() => downloadReviews("json")}>
                JSON (.json)<small>Keep the structured review data</small>
              </button>
            </div>
          )}
        </div>
      </div>
      <p>
        Reviews refresh after a successful save. Downloads include all saved
        genitive reviews, your decisions, and their source paragraphs.
      </p>
      {downloadError && <p role="alert">{downloadError}</p>}
      {error && <p role="alert">{error}</p>}
      {deleteMessage && (
        <p role="status" className="review-notice">
          {deleteMessage}
        </p>
      )}
      {loaded && (
        <p role="status">
          {words.length} saved genitive {words.length === 1 ? "review" : "reviews"}.
        </p>
      )}
      <h2 style={{ marginTop: 24 }}>Genitive annotation reviews</h2>
      {loaded && !loading && !words.length && !error && (
        <p>No genitive reviews saved yet.</p>
      )}
      {words.map((review) => (
        <article key={`genitive-${review.id}`}>
          <h3>Genitive review #{review.id}: {review.final.construction || review.selected_text}</h3>
          <p>{review.source_file} · Paragraph {review.paragraph_number} · {review.variant} candidate</p>
          <div style={{overflowX:"auto"}}><table style={{width:"100%",textAlign:"left"}}>
            <thead><tr><th>Factor</th><th>Model suggestion</th><th>Reviewed coding</th></tr></thead>
            <tbody>{[["classification","Classification"],["alternation_eligible","Alternation eligible"],["possessor","Possessor"],["possessum","Possessum"],["animacy","Possessor animacy"],["definiteness","Possessor definiteness"],["final_sibilancy","Final sibilancy"],["semantic_relation","Semantic relation"],["semantic_detail","Finer semantic sense"]].map(([key,title])=><tr key={key}><th>{title}</th><td>{review.original?.[key]?.replaceAll("_"," ") || "—"}</td><td>{review.final[key]?.replaceAll("_"," ") || "—"}</td></tr>)}</tbody>
          </table></div>
          <p><strong>Syntactic weight:</strong> possessor {review.possessor_words ?? "not assessed"}; possessum {review.possessum_words ?? "not assessed"} words.</p>
          <p><strong>Givenness:</strong> {review.givenness.replaceAll("_"," ")}. <strong>Topicality proxy:</strong> {review.topicality_per_1000_words ?? "not assessed"}{review.topicality_per_1000_words != null ? " referent mentions / 1,000 text words" : ""}.</p>
          <p><strong>Persistence (current):</strong> {review.persistence_current?.previous_variant?.replaceAll("_"," ") || "not applicable"}{review.persistence_current?.previous_review_id ? ` — previous review #${review.persistence_current.previous_review_id}` : ""}</p>
          <p className="muted">{review.persistence_current?.persistence_basis}</p>
          <p><strong>Text scope:</strong> {review.scope ? `${review.scope.text_id}, paragraphs ${review.scope.start_paragraph}–${review.scope.end_paragraph}` : "not defined"}</p>
          {review.discourse_evidence && <p><strong>Discourse evidence:</strong> {review.discourse_evidence}</p>}
          {review.reviewer_note && <p><strong>Your note:</strong> {review.reviewer_note}</p>}
          <details><summary>Coding explanation and uncertainty</summary><p>{review.final.explanation}</p><p>{review.final.uncertainty}</p>{review.original && <p><strong>Original model explanation:</strong> {review.original.explanation}</p>}</details>
          <details><summary>Source paragraph at save time</summary><p style={{whiteSpace:"pre-wrap"}}>{review.paragraph_snapshot}</p></details>
          <p className="muted">Model: {review.model_name} · Scheme: {review.coding_scheme} · Saved: {savedTime(review.created_at)}</p>
          <button type="button" className="secondary-button review-delete-link" aria-label={`Delete genitive review #${review.id}`} disabled={deleting} onClick={()=>{setPendingReview(review);setDeleteError("");setDeleteMessage("");}}>Delete review</button>
        </article>
      ))}

      <dialog
        ref={dialog}
        className="review-delete-dialog"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onCancel={(event) => {
          event.preventDefault();
          if (!deletion.current) setPendingReview(null);
        }}
        onClose={() => {
          if (deleteMessage) refreshButton.current?.focus();
        }}
      >
        <h2 id={titleId}>Delete this review?</h2>
        <p className="review-delete-target">
          <strong>
            Review #{pendingReview?.id}: {pendingReview?.selected_text}
          </strong>
          <small>
            {pendingReview?.source_file} · Paragraph{" "}
            {pendingReview?.paragraph_number}
          </small>
        </p>
        <p id={descriptionId}>
          This permanently removes this saved review. Your corpus text stays
          unchanged.
        </p>
        {deleteError && <p role="alert">{deleteError}</p>}
        {deleting && <p role="status">Deleting review…</p>}
        <div className="review-delete-actions">
          <button
            type="button"
            className="secondary-button"
            autoFocus
            disabled={deleting}
            onClick={() => setPendingReview(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="review-confirm-delete"
            disabled={deleting}
            onClick={deleteReview}
          >
            {deleting ? "Deleting…" : "Delete review"}
          </button>
        </div>
      </dialog>
    </section>
  );
}
