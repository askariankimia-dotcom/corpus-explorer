import { useState } from "react";

export default function ReviewForm({ record, example, modelName }) {
  const [status, setStatus] = useState("");
  const [correction, setCorrection] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState("");

  async function handleSave(event) {
    event.preventDefault();
    if (saving || saved) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_file: record.source_file,
          paragraph_number: record.paragraph_number,
          quotation: example.quotation,
          verb_form: example.verb_form,
          model_name: modelName,
          predicted_construction: example.construction,
          model_explanation: example.explanation,
          review_status: status,
          corrected_construction:
            status === "incorrect" ? correction.trim() : null,
          reviewer_note: note.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Could not save the review."
        );
      }

      setSaved(result);
    } catch (error) {
      setError(error.message || "The review service is unavailable.");
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return (
      <p role="status">
        Review #{saved.review_id} saved: label marked {saved.review_status}.
        {saved.corrected_construction &&
          ` Correction: ${saved.corrected_construction}.`}
      </p>
    );
  }

  return (
    <form onSubmit={handleSave}>
      <fieldset disabled={saving}>
        <legend>Review the grammatical label</legend>

        <p>
          <label>
            Your judgment:{" "}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              required
            >
              <option value="">Choose…</option>
              <option value="correct">Correct</option>
              <option value="incorrect">Incorrect</option>
            </select>
          </label>
        </p>

        {status === "incorrect" && (
          <p>
            <label>
              Correct grammatical label:{" "}
              <input
                value={correction}
                onChange={(event) => setCorrection(event.target.value)}
                placeholder="For example: past progressive"
                maxLength={100}
                required
              />
            </label>
          </p>
        )}

        <p>
          <label>
            Optional note:
            <br />
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
            />
          </label>
        </p>

        <button
          type="submit"
          disabled={
            saving ||
            !status ||
            (status === "incorrect" && !correction.trim())
          }
        >
          {saving ? "Saving…" : "Save review"}
        </button>
      </fieldset>

      {error && <p role="alert">{error}</p>}
    </form>
  );
}