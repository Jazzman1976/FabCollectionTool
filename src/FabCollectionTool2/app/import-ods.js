/*
 * import-ods.js - imports the old LibreOffice Calc collection (.ods) into a new collection.
 *
 * An .ods file is a ZIP archive; the table data lives in content.xml. The archive is read
 * directly (central directory -> local header -> deflate data) and unpacked with the browser's
 * DecompressionStream, so no library is needed. content.xml is then read with a small XML
 * tokenizer that only understands what spreadsheets need (tables, rows, cells, paragraphs).
 *
 * Columns are always matched by their header names, never by position, and repeated cells
 * (table:number-columns-repeated) advance the column position correctly. There is no column
 * limit. This rules out the old tool's findings C1, C2 and C3 by construction.
 */
FCT.importOds = (function () {

    // Spreadsheet columns that were calculated by formulas; the app calculates them itself.
    var FORMULA_COLUMNS = ['Have (this)', 'Need (set)', 'Left (this)', 'Have (total)',
        'Need (total)', 'Left (total)'];

    /*
     * ZIP reading
     */

    // Unpacks raw deflate data. Replaced by a zlib based function in the Node.js self test.
    function inflateRaw(bytes) {
        var stream = new Blob([bytes]).stream()
            .pipeThrough(new DecompressionStream('deflate-raw'));
        return new Response(stream).arrayBuffer().then(function (buffer) {
            return new Uint8Array(buffer);
        });
    }

    // Returns the unpacked bytes of one file inside a ZIP archive.
    function readZipEntry(buffer, wantedName) {
        var view = new DataView(buffer);
        var bytes = new Uint8Array(buffer);
        var decoder = new TextDecoder('utf-8');

        // Find the "end of central directory" record, searching backwards from the end.
        var end = -1;
        var stop = Math.max(0, bytes.length - 22 - 65535);
        for (var i = bytes.length - 22; i >= stop; i--) {
            if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
        }
        if (end < 0) return Promise.reject(new Error('Keine gültige ODS-Datei (kein ZIP)'));

        // Walk through the central directory until the wanted file is found.
        var count = view.getUint16(end + 10, true);
        var pos = view.getUint32(end + 16, true);
        for (var n = 0; n < count; n++) {
            if (view.getUint32(pos, true) !== 0x02014b50) break;
            var method = view.getUint16(pos + 10, true);
            var compressedSize = view.getUint32(pos + 20, true);
            var nameLength = view.getUint16(pos + 28, true);
            var extraLength = view.getUint16(pos + 30, true);
            var commentLength = view.getUint16(pos + 32, true);
            var localOffset = view.getUint32(pos + 42, true);
            var name = decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength));

            if (name === wantedName) {
                // The local header has its own name and extra field lengths.
                var localName = view.getUint16(localOffset + 26, true);
                var localExtra = view.getUint16(localOffset + 28, true);
                var start = localOffset + 30 + localName + localExtra;
                var data = bytes.subarray(start, start + compressedSize);
                if (method === 0) return Promise.resolve(data);
                if (method === 8) return FCT.importOds.inflateRaw(data);
                return Promise.reject(new Error('Nicht unterstützte ZIP-Kompression ' + method));
            }
            pos += 46 + nameLength + extraLength + commentLength;
        }
        return Promise.reject(new Error(wantedName + ' nicht in der ODS-Datei gefunden'));
    }

    /*
     * content.xml reading
     */

    // Replaces XML entities by their characters.
    function decodeEntities(text) {
        return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, function (m, e) {
            if (e[0] === '#') {
                var code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
                return String.fromCodePoint(code);
            }
            return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e];
        });
    }

    // Reads one attribute value from the attribute part of a tag.
    function attribute(attrs, name) {
        var match = new RegExp('\\s' + name + '="([^"]*)"').exec(attrs);
        return match ? decodeEntities(match[1]) : null;
    }

    // Reads all tables of content.xml. Result: [{ name, rows: [{ cells, repeat }] }].
    // cells is a sparse array indexed by the real spreadsheet column.
    function readTables(xml) {
        var tables = [];
        var table = null;
        var row = null;
        var cell = null;
        var inParagraph = false;
        var annotationDepth = 0;
        var tokens = /<(\/?)([\w:.-]+)([^>]*?)(\/?)>|([^<]+)/g;
        var match;

        // Stores the finished cell at the current column and advances the column.
        function endCell() {
            if (cell.text !== '') {
                for (var r = 0; r < cell.repeat; r++) row.cells[row.column + r] = cell.text;
            }
            row.column += cell.repeat;
            cell = null;
        }

        while ((match = tokens.exec(xml)) !== null) {
            var closing = match[1] === '/';
            var tag = match[2];
            var attrs = match[3] || '';
            var selfClosing = match[4] === '/';
            var text = match[5];

            // Text is only taken from paragraphs inside cells, never from comments.
            if (text !== undefined) {
                if (cell && inParagraph && annotationDepth === 0) {
                    cell.text += decodeEntities(text);
                }
                continue;
            }

            // Comments (annotations) inside cells are skipped completely.
            if (tag === 'office:annotation') {
                if (!selfClosing) annotationDepth += closing ? -1 : 1;
                continue;
            }
            if (annotationDepth > 0) continue;

            if (tag === 'table:table') {
                if (!closing) {
                    table = { name: attribute(attrs, 'table:name') || '', rows: [] };
                } else {
                    tables.push(table);
                    table = null;
                }
            } else if (tag === 'table:table-row' && table) {
                if (!closing) {
                    var rowRepeat = parseInt(attribute(attrs, 'table:number-rows-repeated') ||
                        '1', 10);
                    row = { cells: [], column: 0, repeat: rowRepeat };
                }
                if (closing || selfClosing) {
                    table.rows.push({ cells: row.cells, repeat: row.repeat });
                    row = null;
                }
            } else if ((tag === 'table:table-cell' || tag === 'table:covered-table-cell') &&
                row) {
                if (!closing) {
                    var cellRepeat = parseInt(
                        attribute(attrs, 'table:number-columns-repeated') || '1', 10);
                    cell = { text: '', repeat: cellRepeat, paragraphs: 0 };
                }
                if (closing || selfClosing) endCell();
            } else if (tag === 'text:p' && cell) {
                if (!closing) {
                    if (cell.paragraphs++ > 0) cell.text += '\n';
                    inParagraph = !selfClosing;
                } else {
                    inParagraph = false;
                }
            } else if (cell && inParagraph) {
                // Special characters inside paragraphs.
                if (tag === 'text:s') {
                    cell.text += ' '.repeat(parseInt(attribute(attrs, 'text:c') || '1', 10));
                } else if (tag === 'text:tab') {
                    cell.text += '\t';
                } else if (tag === 'text:line-break') {
                    cell.text += '\n';
                }
            }
        }
        return tables;
    }

    /*
     * Mapping spreadsheet rows to collection rows
     */

    // Returns the first table with a header row containing "Id" and "Name", or null.
    function findHeader(tables) {
        for (var t = 0; t < tables.length; t++) {
            var rows = tables[t].rows;
            for (var r = 0; r < Math.min(rows.length, 30); r++) {
                var cells = rows[r].cells.map(function (v) { return String(v).trim(); });
                if (cells.indexOf('Id') >= 0 && cells.indexOf('Name') >= 0) {
                    return { table: tables[t], rowIndex: r };
                }
            }
        }
        return null;
    }

    // Converts the tables of the spreadsheet into a collection and a report.
    function toCollection(tables) {
        var report = FCT.createReport('Import aus ODS');
        var model = FCT.model;
        var collection = model.create();

        // Locate the header row.
        var found = findHeader(tables);
        if (!found) {
            report.add('error', 'Keine Tabelle mit den Spalten "Id" und "Name" gefunden');
            return { collection: null, report: report };
        }
        report.summary.push('Tabellenblatt "' + found.table.name + '", Kopfzeile in Zeile ' +
            (found.rowIndex + 1));

        // Map header names to columns. Unknown columns are kept as extra columns.
        var columns = [];
        var headerCells = found.table.rows[found.rowIndex].cells;
        headerCells.forEach(function (value, index) {
            var name = String(value).trim();
            if (!name) return;
            if (columns.some(function (c) { return c && c.name === name; })) {
                report.add('warn', 'Doppelte Spaltenüberschrift, nur die erste zählt', name);
                return;
            }
            if (FORMULA_COLUMNS.indexOf(name) >= 0) {
                report.add('info', 'Formelspalte übersprungen (wird neu berechnet)', name);
                return;
            }
            if (model.COLUMNS.indexOf(name) < 0) {
                report.add('info', 'Unbekannte Spalte wird als Zusatzspalte übernommen', name);
                collection.extraColumns.push(name);
            }
            columns[index] = { name: name };
        });
        model.COLUMNS.forEach(function (name) {
            var present = columns.some(function (c) { return c && c.name === name; });
            if (!present && name !== 'Note' && name !== model.OVERRIDES) {
                report.add(name === 'Id' ? 'error' : 'warn', 'Spalte fehlt in der Tabelle', name);
            }
        });
        if (report.count('error')) return { collection: null, report: report };

        // Convert the data rows below the header.
        var rows = found.table.rows;
        var sections = 0;
        for (var r = found.rowIndex + 1; r < rows.length; r++) {
            var cells = rows[r].cells;
            if (!cells.some(function (v) { return String(v).trim() !== ''; })) continue;

            var values = {};
            columns.forEach(function (column, index) {
                if (column && cells[index] != null) values[column.name] = cells[index];
            });

            // Rows without card number, name and quantities are section titles.
            var hasContent = values.Id || values.Name || model.QUANTITIES.some(function (q) {
                return values[q];
            });
            if (!hasContent) {
                sections++;
                report.add('info', 'Zwischenüberschrift übersprungen',
                    cells.filter(Boolean).join(' '));
                continue;
            }

            // Repeated rows with content are materialized as often as they are repeated.
            for (var n = 0; n < rows[r].repeat; n++) {
                var row = model.newRow(values);
                collection.extraColumns.forEach(function (name) {
                    row[name] = values[name] || '';
                });
                collection.rows.push(row);
            }
        }

        report.summary.push(collection.rows.length + ' Zeilen übernommen, ' + sections +
            ' Zwischenüberschriften übersprungen');
        return { collection: collection, report: report };
    }

    // Main entry: ArrayBuffer of an .ods file -> Promise of { collection, report }.
    function importOds(buffer) {
        return readZipEntry(buffer, 'content.xml').then(function (bytes) {
            var xml = new TextDecoder('utf-8').decode(bytes);
            return toCollection(readTables(xml));
        });
    }

    return {
        inflateRaw: inflateRaw,
        readZipEntry: readZipEntry,
        readTables: readTables,
        toCollection: toCollection,
        importOds: importOds
    };
})();
