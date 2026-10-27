<?php
declare(strict_types=1);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Allow: GET');
    exit('Please use a GET request.');
}

$databaseFile = dirname(__DIR__, 2) . '/corpus.db';

if (!is_file($databaseFile)) {
    http_response_code(500);
    exit('The corpus database could not be found.');
}

function spreadsheetCell(mixed $value): string
{
    $text = (string) ($value ?? '');

    // Keep spreadsheet applications from interpreting text as formulas.
    if (preg_match('/^\s*[=+\-@]|^[\t\r\n]/u', $text)) {
        return "'" . $text;
    }

    return $text;
}

try {
    $database = new PDO('sqlite:' . $databaseFile);
    $database->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $database->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $database->exec('PRAGMA query_only = ON');
    $database->exec('PRAGMA busy_timeout = 5000');

    $statement = $database->query(
        'SELECT
            id,
            source_file,
            paragraph_number,
            quotation,
            verb_form,
            model_name,
            predicted_construction,
            model_explanation,
            review_status,
            corrected_construction,
            reviewer_note,
            created_at AS created_at_utc
         FROM reviews
         ORDER BY id'
    );

    $reviews = $statement->fetchAll();

    $columns = [
        'id',
        'source_file',
        'paragraph_number',
        'quotation',
        'verb_form',
        'model_name',
        'predicted_construction',
        'model_explanation',
        'review_status',
        'corrected_construction',
        'reviewer_note',
        'created_at_utc'
    ];

    $output = fopen('php://temp', 'w+');

    if ($output === false) {
        throw new RuntimeException('Could not create the CSV.');
    }

    // Help spreadsheet applications recognise UTF-8 characters.
    fwrite($output, "\xEF\xBB\xBF");

    fputcsv($output, $columns, ',', '"', '', "\r\n");

    foreach ($reviews as $review) {
        $cells = [];

        foreach ($columns as $column) {
            $cells[] = spreadsheetCell($review[$column]);
        }

        fputcsv($output, $cells, ',', '"', '', "\r\n");
    }

    rewind($output);

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="corpus-reviews.csv"');
    header('Cache-Control: no-store');

    fpassthru($output);
    fclose($output);
} catch (Throwable $error) {
    error_log($error->getMessage());
    http_response_code(500);
    echo 'The review export failed. Check the PHP terminal for details.';
}