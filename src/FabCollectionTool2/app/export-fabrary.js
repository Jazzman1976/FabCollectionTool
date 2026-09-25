/*
 * export-fabrary.js - writes the collection as a Fabrary import file (CSV).
 *
 * Skeleton method: the shipped skeleton (reference/fabrary-skeleton.js) contains the identity
 * columns of every row Fabrary knows, taken character by character from a Fabrary export.
 * The export copies these rows unchanged and only fills in the quantity columns, so Fabrary
 * always recognizes its own rows. Rows of the collection that have no skeleton row are
 * skipped and reported - they are never guessed.
 */
FCT.exportFabrary = (function () {

    // Positions of the columns in the Fabrary format.
    var COL = { name: 1, setNumber: 4, edition: 5, foiling: 6, treatment: 7, have: 8,
        extraForTrade: 11 };
    var FABRARY_EDITIONS = ['', 'Alpha', 'First', 'Unlimited'];

    // Builds a lookup: set number | edition | foiling | treatment -> skeleton row indexes.
    function indexSkeleton(skeleton) {
        var index = new Map();
        skeleton.forEach(function (row, i) {
            var key = [row[COL.setNumber], row[COL.edition], row[COL.foiling],
                row[COL.treatment]].join('|');
            if (!index.has(key)) index.set(key, []);
            index.get(key).push(i);
        });
        return index;
    }

    // Treatment as Fabrary names it, including the known exceptions.
    function fabraryTreatment(row, foiling) {
        var vocab = FCT.DATA.vocab;
        var art = row['Art Treatment'];
        var treatment = vocab.fabraryTreatments[art] || art;
        var isException = vocab.fabraryExtendedArtAsNormal.indexOf(row.Id) >= 0;
        if (treatment === 'Extended Art' && foiling === '' && isException) treatment = '';
        return treatment;
    }

    /*
     * "Extra for trade", same rules as the old tool: keep a playset (for reprints at least
     * one card, for history packs nothing beyond the playset of other sets), better foilings
     * are kept first, everything above is offered for trade.
     */
    function tradeCounts(row, rows, stats) {
        var util = FCT.util;
        if (stats.haveById.get(row.Id) <= 0) return null;

        // Sum each foiling over all rows with the same card number and art treatment.
        var counts = { ST: 0, RF: 0, CF: 0, GF: 0 };
        (stats.byIdAndArt.get(row.Id + '|' + row['Art Treatment']) || []).forEach(function (r) {
            Object.keys(counts).forEach(function (column) {
                var n = util.toInt(r[column]);
                if (!isNaN(n)) counts[column] += n;
            });
        });

        var playset = util.toInt(row.Playset) || 0;
        var leftTotal = row._calc ? row._calc.leftTotal : 0;
        var isHistory = /^history/i.test(row.Set);
        var firstIn = row['First In'].trim();
        var isReprint = firstIn !== '' && firstIn !== row.Id.slice(0, firstIn.length);
        var keepBase = isHistory ? Math.max(0, playset - leftTotal)
            : isReprint ? Math.max(1, playset - leftTotal)
            : playset;

        var keep = {
            ST: Math.max(keepBase - (counts.GF + counts.CF + counts.RF), 0),
            RF: Math.max(keepBase - (counts.GF + counts.CF), 0),
            CF: Math.max(keepBase - counts.GF, 0),
            GF: keepBase
        };
        var trade = {};
        Object.keys(counts).forEach(function (column) {
            trade[column] = Math.max(0, counts[column] - keep[column]);
        });
        return trade;
    }

    // Main entry: collection -> { text, report }.
    function exportFabrary(collection) {
        var util = FCT.util;
        var model = FCT.model;
        var vocab = FCT.DATA.vocab;
        var report = FCT.createReport('Export nach Fabrary');
        var skeleton = FCT.DATA.fabrarySkeleton;
        var header = FCT.DATA.info.fabraryHeader;
        var index = indexSkeleton(skeleton);
        var have = new Map();
        var extra = new Map();
        var exported = 0;

        // Only real collection rows with a card number take part.
        var rows = collection.rows.filter(function (row) {
            if (row.Id.trim()) return true;
            report.add('warn', 'Übersprungen: Zeile ohne Id', row.Name || '(leer)');
            return false;
        });
        model.calculate(rows);

        // Lookups for the trade calculation.
        var stats = { haveById: new Map(), byIdAndArt: new Map() };
        rows.forEach(function (row) {
            stats.haveById.set(row.Id, (stats.haveById.get(row.Id) || 0) + row._have);
            var key = row.Id + '|' + row['Art Treatment'];
            if (!stats.byIdAndArt.has(key)) stats.byIdAndArt.set(key, []);
            stats.byIdAndArt.get(key).push(row);
        });

        rows.forEach(function (row) {
            var edition = model.fabraryEdition(row.Edition);
            if (FABRARY_EDITIONS.indexOf(edition) < 0) {
                report.add('warn', 'Übersprungen: Edition unbekannt', row.Id + ' ' + row.Edition);
                return;
            }
            var trade = tradeCounts(row, rows, stats);
            var rowExported = false;

            // One Fabrary row per foiling.
            model.QUANTITIES.forEach(function (column) {
                var count = util.toInt(row[column]);
                if (isNaN(count)) {
                    report.add('error', 'Ungültige Menge als 0 exportiert',
                        row.Id + ' ' + column + ': "' + row[column] + '"');
                    count = 0;
                }
                var foiling = vocab.fabraryFoilings[column];
                var key = [row.Id, edition, foiling, fabraryTreatment(row, foiling)].join('|');
                var candidates = index.get(key);

                // Printings that Fabrary does not know are reported, but only if owned.
                if (!candidates) {
                    if (count > 0) {
                        report.add('warn', 'Übersprungen: nicht im Fabrary-Skelett',
                            key.replace(/\|/g, ' / ') + ' (' + count + ')');
                    }
                    return;
                }

                // Several rows share one card number (e.g. double-faced cards): the name
                // decides. Without an exact match the first row is taken and reported.
                var target = candidates[0];
                if (candidates.length > 1) {
                    var byName = candidates.filter(function (i) {
                        return util.fold(skeleton[i][COL.name]) === util.fold(row.Name);
                    });
                    if (byName.length) target = byName[0];
                    else if (count > 0) {
                        report.add('warn', 'Mehrdeutig, erste passende Fabrary-Zeile genommen',
                            row.Id + ' ' + row.Name);
                    }
                }

                have.set(target, (have.get(target) || 0) + count);
                if (trade) extra.set(target, trade[column]);
                rowExported = true;
            });
            if (rowExported) exported++;
        });

        // Write the skeleton with the quantities, in the same style as Fabrary's own export:
        // the first five (text) columns quoted, the others unquoted, LF line ends.
        var records = [header].concat(skeleton.map(function (identity, i) {
            return identity.concat([
                have.has(i) ? String(have.get(i)) : '',
                '',
                '',
                extra.has(i) ? String(extra.get(i)) : '',
                ''
            ]);
        }));
        var text = FCT.csv.stringify(records, {
            lineEnd: '\n',
            trailingLineEnd: false,
            shouldQuote: function (value, column) { return column < 5; }
        });
        // The header line is never quoted.
        text = header.join(',') + text.slice(text.indexOf('\n'));

        var withQuantity = Array.from(have.values()).filter(function (n) { return n > 0; });
        report.summary.push(rows.length + ' Bestandszeilen gelesen, ' + exported +
            ' davon exportiert');
        report.summary.push(skeleton.length + ' Fabrary-Zeilen geschrieben, ' + have.size +
            ' mit Mengenangabe, ' + withQuantity.length + ' mit Menge > 0');
        return { text: text, report: report };
    }

    return { exportFabrary: exportFabrary };
})();
