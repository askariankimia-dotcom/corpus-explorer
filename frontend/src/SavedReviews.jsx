import { useState } from "react";

export default function SavedReviews() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadReviews() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/reviews");

      if (!response.ok) {
        throw new Error("Could not load saved reviews.");
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      setError(error.message || "The review service is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-labelledby="saved-reviews-heading">
      <h2 id="saved-reviews-heading">Saved reviews</h2>

      <button
        type="button"
        onClick={loadReviews}
        disabled={loading}
      >
        {loading
          ? "Loading…"
          : data
            ? "Refresh saved reviews"
            : "Load saved reviews"}
      </button>

      <p>Refresh this list after saving a new review.</p>

      {error && <p role="alert">{error}</p>}

      {data && (
        <>
          <p role="status">
            {data.total_reviews} saved reviews. Newest first.
          </p>

          {data.reviews.length === 0 && (
            <p>You have not saved any reviews yet.</p>
          )}

          {data.reviews.map((review) => (
            <article key={review.id}>
              <h3>
                Review #{review.id}: {review.verb_form}
              </h3>

              <p>
                {review.source_file}
                {" · "}Paragraph {review.paragraph_number}
              </p>

              <blockquote>{review.quotation}</blockquote>

              <p>
                <strong>Model’s label:</strong>{" "}
                {review.predicted_construction}
              </p>

              <p>
                <strong>Your judgment:</strong>{" "}
                {review.review_status}
              </p>

              {review.corrected_construction && (
                <p>
                  <strong>Your correction:</strong>{" "}
                  {review.corrected_construction}
                </p>
              )}

              {review.reviewer_note && (
                <p style={{ whiteSpace: "pre-wrap" }}>
                  <strong>Your note:</strong>{" "}
                  {review.reviewer_note}
                </p>
              )}

              <details>
                <summary>Original model explanation</summary>
                <p>{review.model_explanation}</p>
                <p>Model: {review.model_name}</p>
              </details>

              <p>Saved: {review.created_at} UTC</p>
              <hr />
            </article>
          ))}
        </>
      )}
    </section>
  );
}