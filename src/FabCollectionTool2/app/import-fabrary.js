/*
 * import-fabrary.js - builds a collection from a Fabrary collection export (CSV).
 *
 * Fabrary has one row per foiling; the app has one row per printing variant with the
 * foilings side by side. Rows are therefore grouped by card number (Set number), Edition,
 * Treatment and card name (double-faced cards share one card number), and the foilings are
 * summed up into ST / RF / CF / GF. Rows without quantity are ignored.
 */
FCT.importFabrary = (function () {
    var REQUIRED = ['Name', 'Pitch', 'Set', 'Set number', 'Edition', 'Foiling', 'Treatment',
        'Have'];

    // Main entry: CSV text -> { collection, report }.
    function importFabrary(text) {
        var util = FCT.util;
        var model = FCT.model;
        var vocab = FCT.DATA.vocab;
        var report = FCT.createReport('Import aus Fabrary');
        var table = FCT.csv.parseTable(text);

        // The file must look like a Fabrary export.
        var missing = REQUIRED.filter(function (c) { return table.header.indexOf(c) < 0; });
        if (missing.length) {
            report.add('error', 'Keine Fabrary-Exportdatei, es fehlen Spalten',
                missing.join(', '));
            return { collection: null, report: report };
        }

        // Quantity column for each Fabrary foiling.
        var columnByFoiling = {};
        Object.keys(vocab.fabraryFoilings).forEach(function (column) {
            columnByFoiling[vocab.fabraryFoilings[column]] = column;
        });

        var collection = model.create();
        var byKey = new Map();
        var seen = new Set();
        var withQuantity = 0;
        var ignored = 0;

        table.rows.forEach(function (source) {
            // Fabrary lists a few printings twice with identical data; only the first counts.
            var identity = ['Identifier', 'Set number', 'Edition', 'Foiling', 'Treatment']
                .map(function (c) { return source[c]; }).join('|');
            if (seen.has(identity)) {
                report.add('info', 'Doppelte Zeile im Fabrary-Export (nicht eindeutig ' +
                    'adressierbar, ignoriert)', source['Set number'] + ' ' + source.Name);
                return;
            }
            seen.add(identity);

            // Only rows with a quantity become part of the collection.
            var have = util.toInt(source.Have);
            if (isNaN(have)) {
                report.add('error', 'Ungültige Menge in "Have" (Zeile ignoriert)',
                    source['Set number'] + ': "' + source.Have + '"');
                return;
            }
            if (have <= 0) { ignored++; return; }

            var column = columnByFoiling[source.Foiling];
            if (!column) {
                report.add('error', 'Unbekanntes Foiling (Zeile ignoriert)',
                    source['Set number'] + ': "' + source.Foiling + '"');
                return;
            }
            withQuantity++;

            // Find or create the collection row for this printing variant.
            var key = [source['Set number'], source.Edition, source.Treatment,
                util.fold(source.Name)].join('|');
            var row = byKey.get(key);
            if (!row) {
                row = newRowFromFabrary(source);
                byKey.set(key, row);
                collection.rows.push(row);
            }
            row[column] = String(util.toInt(row[column]) + have);
        });

        // Sort by card number, so that sets stay together.
        collection.rows.sort(function (a, b) {
            var ka = a.Id + '|' + a.Edition + '|' + a['Art Treatment'];
            var kb = b.Id + '|' + b.Edition + '|' + b['Art Treatment'];
            return ka < kb ? -1 : ka > kb ? 1 : 0;
        });

        report.summary.push(table.rows.length + ' Zeilen gelesen');
        report.summary.push(withQuantity + ' Zeilen mit Menge, ' + ignored +
            ' Zeilen ohne Menge ignoriert');
        report.summary.push(collection.rows.length + ' Zeilen im neuen Bestand');
        return { collection: collection, report: report };
    }

    // Creates a collection row from a Fabrary row, completed from the reference data.
    function newRowFromFabrary(source) {
        var model = FCT.model;
        var id = source['Set number'];
        var printings = FCT.reference.printings(id);
        var match = printings.filter(function (p) {
            return p.edition === source.Edition && p.art === source.Treatment;
        })[0] || printings[0];

        return model.newRow({
            Set: source.Set,
            Edition: source.Edition,
            Id: id,
            Rarity: match ? match.rarity : '',
            Name: source.Name,
            Pitch: source.Pitch,
            'Art Treatment': source.Treatment,
            Playset: String(model.defaultPlayset(match ? match.card : ''))
        });
    }

    return { importFabrary: importFabrary };
})();
