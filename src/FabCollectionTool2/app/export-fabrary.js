/*
 * export-fabrary.js - writes the collection as a Fabrary import file (CSV).
 *
 * The rows come from the reference data of the-fab-cube, the source of truth (issue #17):
 * one row per card, printing variant and foiling that exists - for all sets, whether they are
 * in the collection or not. "Have" and "Extra for trade" always carry a number; a card the
 * collection does not have gets 0, so that Fabrary shows it as missing. Identifier, name and
 * set are written as the first tool did (FabraryDto.cs); where Fabrary names things
 * differently, the Fabrary mapping (fabrary-map.js) replaces identifier, set or treatment.
 * Collection rows whose variant or foiling the reference data does not know are skipped and
 * reported - they are never guessed.
 */
FCT.exportFabrary = (function () {

    var HEADER = ['Identifier', 'Name', 'Pitch', 'Set', 'Set number', 'Edition', 'Foiling',
        'Treatment', 'Have', 'Want in trade', 'Want to buy', 'Extra for trade', 'Extra to sell'];
    var FABRARY_EDITIONS = ['', 'Alpha', 'First', 'Unlimited'];

    // Foiling letters of the reference data with Fabrary's names, in Fabrary's order.
    var FOILINGS = ['S', 'R', 'C', 'G'];
    var FOILING_NAMES = { S: '', R: 'Rainbow', C: 'Cold', G: 'Gold' };
    var FOILING_COLUMNS = { S: 'ST', R: 'RF', C: 'CF', G: 'GF' };

    /*
     * Fabrary knows one treatment per row, the reference data sometimes several. The
     * comparison with Fabrary's own export gives this order (e.g. "Alternate Art, Extended
     * Art" is "Alternate Art", "Alternate Border, Extended Art" is "Alternate Border").
     */
    var TREATMENT_ORDER = ['Alternate Art', 'Alternate Border', 'Alternate Text', 'Full Art',
        'Extended Art'];

    /*
     * Identifier as the first tool built it: name and pitch, without accents and special
     * characters (letters, digits, space . _ - | stay), spaces and "|" as "-", lower case.
     * "Arcane Seeds // Life" (Red) gives "arcane-seeds--life-red", as in Fabrary.
     */
    function identifier(name, pitch) {
        var text = (pitch ? name + ' ' + pitch : name).trim()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/ {2,}/g, ' ')
            .replace(/[^0-9A-Za-z ._\-|]/g, '');
        return text.replace(/[ |]/g, '-').toLowerCase();
    }

    // Treatment as Fabrary names it, including the known exceptions.
    function treatment(art, foilingName, id) {
        var vocab = FCT.DATA.vocab;
        var parts = String(art || '').split(',').map(function (t) {
            t = t.trim();
            return vocab.fabraryTreatments[t] || t;
        });
        var result = TREATMENT_ORDER.filter(function (t) { return parts.indexOf(t) >= 0; })[0]
            || '';
        var isException = vocab.fabraryExtendedArtAsNormal.indexOf(id) >= 0;
        if (result === 'Extended Art' && foilingName === '' && isException) result = '';
        return result;
    }

    // The treatments of the reference data as Fabrary names them, all of them, e.g.
    // "Alternate Art, Alternate Border, Extended Art" (Micro Text Box is Extended Art).
    function fullTreatment(art) {
        var vocab = FCT.DATA.vocab;
        var result = [];
        String(art || '').split(',').forEach(function (t) {
            t = t.trim();
            t = vocab.fabraryTreatments[t] || t;
            if (t && result.indexOf(t) < 0) result.push(t);
        });
        return result.join(', ');
    }

    // Lookup key of a Fabrary variant: card number | edition | foiling | treatment.
    function variantKey(id, edition, foilingName, art) {
        return [id, edition, foilingName, treatment(art, foilingName, id)].join('|');
    }

    /*
     * The rows of the export from the reference data, without mapping: one per card,
     * printing variant (with all its treatments) and foiling. Each row is
     * { identity, setCode, art, key, variantKey, order }; identity is
     * [identifier, name, pitch, set, set number, edition, foiling, treatment] by the rules
     * of the export, key the key of the Fabrary mapping. Printings that only differ in names
     * Fabrary does not know (e.g. "Micro Text Box" and "Extended Art") give one row.
     */
    function baseRows() {
        var cards = new Map();
        FCT.reference.data().cards.forEach(function (c) {
            cards.set(c[0], { name: c[1], pitch: c[2] });
        });

        var rows = [];
        var seen = new Set();
        FCT.reference.allPrintings().forEach(function (p) {
            var card = cards.get(p[6]);
            if (!card) return;
            FOILINGS.forEach(function (letter) {
                if (String(p[5]).indexOf(letter) < 0) return;
                var foilingName = FOILING_NAMES[letter];
                var id = identifier(card.name, card.pitch);
                var art = fullTreatment(p[3]);
                var key = FCT.fabraryMap.key(p[0], p[2], foilingName, art, id);
                if (seen.has(key)) return;
                seen.add(key);
                rows.push({
                    identity: [id, card.name, card.pitch, FCT.reference.setName(p[1]), p[0],
                        p[2], foilingName, treatment(p[3], foilingName, p[0])],
                    setCode: p[1], art: art, key: key, order: FOILINGS.indexOf(letter),
                    variantKey: variantKey(p[0], p[2], foilingName, p[3])
                });
            });
        });
        return rows;
    }

    /*
     * The rows of the export with the Fabrary mapping applied (own = the collection's own
     * mapping), sorted like Fabrary's own export, and a lookup variantKey -> row indexes
     * (several cards can share a card number, e.g. an angel and its figment; Fabrary lists
     * each of them).
     */
    function referenceRows(own) {
        var rows = baseRows().map(function (row) {
            var mapped = FCT.fabraryMap.apply(row, own);
            return { identity: mapped.identity, order: row.order, key: row.variantKey,
                art: row.art, mapped: mapped.changed, byOwn: mapped.own, have: 0, extra: 0 };
        });

        rows.sort(function (a, b) {
            var x = a.identity, y = b.identity;
            return compare(x[0], y[0]) || compare(x[4], y[4]) || compare(x[5], y[5]) ||
                a.order - b.order || compare(x[7], y[7]);
        });
        var index = new Map();
        rows.forEach(function (row, i) {
            if (!index.has(row.key)) index.set(row.key, []);
            index.get(row.key).push(i);
        });
        return { rows: rows, index: index };
    }

    function compare(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
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
        var report = FCT.createReport('Export nach Fabrary');
        var target = referenceRows(collection.fabraryOverrides);
        var exported = 0;
        var skipped = 0;

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
            FOILINGS.forEach(function (letter) {
                var column = FOILING_COLUMNS[letter];
                var count = util.toInt(row[column]);
                if (isNaN(count)) {
                    report.add('error', 'Ungültige Menge als 0 exportiert',
                        row.Id + ' ' + column + ': "' + row[column] + '"');
                    count = 0;
                }
                var foilingName = FOILING_NAMES[letter];
                var key = variantKey(row.Id, edition, foilingName, row['Art Treatment']);
                var candidates = target.index.get(key);

                // Variants and foilings the reference data does not know are reported, but
                // only if owned.
                if (!candidates) {
                    if (count > 0) {
                        skipped += count;
                        report.add('warn', 'Übersprungen: nicht in den Stammdaten',
                            [row.Id, edition, foilingName || 'Standard',
                                row['Art Treatment']].filter(Boolean).join(' / ') +
                                ' (' + count + ')');
                    }
                    return;
                }

                // Several cards share one card number (e.g. an angel and its figment): the
                // name decides, then the full treatment. Without an exact match the first
                // row is taken and reported.
                var at = candidates[0];
                if (candidates.length > 1) {
                    var byName = candidates.filter(function (i) {
                        return util.fold(target.rows[i].identity[1]) === util.fold(row.Name);
                    });
                    var art = fullTreatment(row['Art Treatment']);
                    var byArt = byName.filter(function (i) {
                        return target.rows[i].art === art;
                    });
                    if (byArt.length) at = byArt[0];
                    else if (byName.length) at = byName[0];
                    else if (count > 0) {
                        report.add('warn', 'Mehrdeutig, erste passende Fabrary-Zeile genommen',
                            row.Id + ' ' + row.Name);
                    }
                }

                target.rows[at].have += count;
                if (trade) target.rows[at].extra = trade[column];
                rowExported = true;
            });
            if (rowExported) exported++;
        });

        // Write the rows in the same style as Fabrary's own export: the first five (text)
        // columns quoted, the others unquoted, LF line ends. Have and Extra for trade are
        // never empty: 0 tells Fabrary that the card is missing.
        var records = [HEADER].concat(target.rows.map(function (row) {
            return row.identity.concat([String(row.have), '', '', String(row.extra), '']);
        }));
        var text = FCT.csv.stringify(records, {
            lineEnd: '\n',
            trailingLineEnd: false,
            shouldQuote: function (value, column) { return column < 5; }
        });
        // The header line is never quoted.
        text = HEADER.join(',') + text.slice(text.indexOf('\n'));

        var withQuantity = target.rows.filter(function (row) { return row.have > 0; });
        report.summary.push(rows.length + ' Bestandszeilen gelesen, ' + exported +
            ' davon exportiert');
        report.summary.push(target.rows.length + ' Fabrary-Zeilen aus den Stammdaten ' +
            'geschrieben, ' + withQuantity.length + ' mit Menge > 0, die übrigen mit 0');
        var mapped = target.rows.filter(function (row) { return row.mapped; });
        if (mapped.length) {
            var byOwn = mapped.filter(function (row) { return row.byOwn; }).length;
            report.summary.push(mapped.length + ' Zeilen per Fabrary-Zuordnung angepasst' +
                (byOwn ? ' (davon ' + byOwn + ' mit eigener Zuordnung)' : ''));
        }
        if (skipped) {
            report.summary.push(skipped + ' Exemplare übersprungen: Variante oder Foiling ' +
                'kennen die Stammdaten nicht');
        }
        return { text: text, report: report, skipped: skipped };
    }

    return { exportFabrary: exportFabrary, identifier: identifier, treatment: treatment,
        fullTreatment: fullTreatment, baseRows: baseRows, HEADER: HEADER };
})();
