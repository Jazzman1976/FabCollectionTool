/*
 * csv.js - reading and writing CSV according to RFC 4180.
 * Reading is tolerant (BOM, CRLF or LF, quoted fields with commas, quotes and line breaks,
 * other delimiters such as tab). Writing is conservative: every field is quoted by default,
 * so that other tools cannot misinterpret commas, quotes or leading zeros.
 */
FCT.csv = (function () {

    // Splits text into records (arrays of strings). Completely empty lines are skipped.
    function parse(text, options) {
        var delimiter = (options && options.delimiter) || ',';
        var records = [];
        var record = [];
        var field = '';
        var inQuotes = false;
        var fieldStarted = false;
        var recordHadQuotes = false;
        var i = 0;
        var length = text.length;

        // Skip a leading byte order mark.
        if (text.charCodeAt(0) === 0xFEFF) i = 1;

        // Finishes the current field and, on line end, the current record.
        function endField() {
            record.push(field);
            field = '';
            fieldStarted = false;
        }
        function endRecord() {
            endField();
            var isEmptyLine = record.length === 1 && record[0] === '' && !recordHadQuotes;
            if (!isEmptyLine) records.push(record);
            record = [];
            recordHadQuotes = false;
        }

        // Walk through the text character by character.
        for (; i < length; i++) {
            var ch = text[i];

            // Inside quotes: everything is data, a doubled quote is a literal quote.
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else inQuotes = false;
                } else {
                    field += ch;
                }
                continue;
            }

            // Outside quotes: delimiters and line ends structure the data.
            if (ch === '"' && !fieldStarted) {
                inQuotes = true;
                fieldStarted = true;
                recordHadQuotes = true;
            } else if (ch === delimiter) {
                endField();
            } else if (ch === '\r') {
                if (text[i + 1] === '\n') i++;
                endRecord();
            } else if (ch === '\n') {
                endRecord();
            } else {
                field += ch;
                fieldStarted = true;
            }
        }

        // The last record may end without a line break.
        if (fieldStarted || field !== '' || record.length > 0) endRecord();
        return records;
    }

    // Parses text with a header line into { header, rows } where rows are objects by column name.
    function parseTable(text, options) {
        var records = parse(text, options);
        var header = (records.shift() || []).map(function (name) { return name.trim(); });
        var rows = records.map(function (record) {
            var row = {};
            header.forEach(function (name, index) {
                row[name] = record[index] == null ? '' : record[index];
            });
            return row;
        });
        return { header: header, rows: rows, records: records };
    }

    // Quotes one field: surrounding quotes, inner quotes doubled.
    function quote(value) {
        return '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
    }

    // Joins records to CSV text.
    // options.shouldQuote(value, columnIndex) decides quoting; default is "always".
    // options.lineEnd defaults to CRLF as required by RFC 4180.
    function stringify(records, options) {
        var shouldQuote = (options && options.shouldQuote) || function () { return true; };
        var lineEnd = (options && options.lineEnd) || '\r\n';
        var lines = records.map(function (record) {
            return record.map(function (value, index) {
                var text = value == null ? '' : String(value);
                var needsQuotes = /[",\r\n]/.test(text);
                return needsQuotes || shouldQuote(text, index) ? quote(text) : text;
            }).join(',');
        });
        var trailing = options && options.trailingLineEnd === false ? '' : lineEnd;
        return lines.join(lineEnd) + trailing;
    }

    return { parse: parse, parseTable: parseTable, stringify: stringify };
})();
