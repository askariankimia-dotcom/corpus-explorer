export function exportKwic(data) {
  const rows = [
    ["Source", "Paragraph", "Left context", "Match", "Right context"],
    ...data.kwic_results.map((row) => [
      row.source_file,
      row.paragraph_number,
      row.left_context,
      row.match,
      row.right_context,
    ]),
  ];

  function escapeCell(value) {
    let text = String(value);

    // Prevent spreadsheet software from treating text as a formula.
    if (/^\s*[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  }

  const csv = rows
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");

  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "corpus-concordance.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}