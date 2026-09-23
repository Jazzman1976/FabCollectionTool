/*
 * reference-transform.js - turns the source files of the open card data set
 * (the-fab-cube/flesh-and-blood-cards, csvs/english, tab separated) into the compact reference
 * tables used by the app. The same code runs in two places:
 *   - tools/build-reference.mjs, to generate the shipped reference/*.js files
 *   - app/reference-update.js, to refresh the reference data online at start-up
 */
FCT.referenceTransform = (function () {

    // Where the source files live online, and which columns each of them must provide.
    var SOURCE_REPO = 'the-fab-cube/flesh-and-blood-cards';
    var SOURCE_BRANCH = 'develop';
    var SOURCE_BASE = 'https://raw.githubusercontent.com/' + SOURCE_REPO + '/' +
        SOURCE_BRANCH + '/csvs/english/';
    var REQUIRED = {
        set: ['Identifier', 'Name'],
        card: ['Unique ID', 'Name', 'Pitch', 'Types'],
        printing: ['Card Unique ID', 'Card ID', 'Set ID', 'Edition', 'Rarity', 'Foiling',
            'Art Variations']
    };
    var FOILING_ORDER = 'SRCG';

    // Parses one tab separated source file and checks that the required columns exist.
    function readTable(name, text) {
        var table = FCT.csv.parseTable(text, { delimiter: '\t' });
        var missing = REQUIRED[name].filter(function (column) {
            return table.header.indexOf(column) < 0;
        });
        if (missing.length) {
            throw new Error(name + '.csv: Spalten fehlen (' + missing.join(', ') +
                ') - Format des Datensatzes hat sich geändert');
        }
        return table.rows;
    }

    // Translates a code with a code table; unknown codes are kept as they are.
    function label(table, code) {
        return Object.prototype.hasOwnProperty.call(table, code) ? table[code] : code;
    }

    // Art variations can be combined ("AA, EA"); each code is translated on its own.
    function artLabel(codes) {
        var vocab = FCT.DATA.vocab;
        return codes.split(',')
            .map(function (code) { return code.trim(); })
            .filter(Boolean)
            .map(function (code) { return label(vocab.artCodes, code); })
            .join(', ');
    }

    // Main entry: texts of set.csv, card.csv and card-printing.csv -> reference tables.
    function transform(texts) {
        var vocab = FCT.DATA.vocab;

        // Sets: code -> name.
        var sets = readTable('set', texts.set)
            .map(function (row) { return [row.Identifier.trim(), row.Name.trim()]; })
            .filter(function (set) { return set[0]; })
            .sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });

        // Cards: unique id -> name, pitch and type line.
        var cards = readTable('card', texts.card)
            .map(function (row) {
                return [row['Unique ID'], row.Name, label(vocab.pitchCodes, row.Pitch),
                    row.Types];
            })
            .sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });

        // Printings: one entry per card number, edition, art variation and card face.
        // The foilings of a printing are merged into one string such as "SRC".
        var groups = {};
        var order = [];
        readTable('printing', texts.printing).forEach(function (row) {
            var id = row['Card ID'].trim();
            if (!id) return;
            var key = [id, row.Edition, row['Art Variations'], row['Card Unique ID']].join('|');
            var group = groups[key];
            if (!group) {
                group = { row: row, id: id, foilings: {}, rarityByFoiling: {} };
                groups[key] = group;
                order.push(key);
            }
            var foiling = row.Foiling || 'S';
            group.foilings[foiling] = true;
            if (!group.rarityByFoiling[foiling]) group.rarityByFoiling[foiling] = row.Rarity;
        });

        var printings = order.map(function (key) {
            var group = groups[key];
            var foilings = FOILING_ORDER.split('').filter(function (f) {
                return group.foilings[f];
            }).join('');

            // The rarity of the most basic foiling describes the printing best.
            var rarityCode = group.rarityByFoiling[foilings[0]] || group.row.Rarity;
            return [
                group.id,
                group.row['Set ID'].trim(),
                label(vocab.editionCodes, group.row.Edition),
                artLabel(group.row['Art Variations']),
                label(vocab.rarityCodes, rarityCode),
                foilings,
                group.row['Card Unique ID']
            ];
        }).sort(function (a, b) {
            var ka = a.join('|');
            var kb = b.join('|');
            return ka < kb ? -1 : ka > kb ? 1 : 0;
        });

        return { sets: sets, cards: cards, printings: printings };
    }

    return {
        SOURCE_REPO: SOURCE_REPO,
        SOURCE_BRANCH: SOURCE_BRANCH,
        SOURCE_BASE: SOURCE_BASE,
        FILES: { set: 'set.csv', card: 'card.csv', printing: 'card-printing.csv' },
        transform: transform
    };
})();
