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
    var SOURCE_BRANCH = 'develop';     // default branch; the shipped data come from it

    // Folder of the source files in a branch (new sets appear in branches of their own first).
    function sourceBase(branch) {
        return 'https://raw.githubusercontent.com/' + SOURCE_REPO + '/' +
            encodeURIComponent(branch || SOURCE_BRANCH) + '/csvs/english/';
    }
    var REQUIRED = {
        set: ['Unique ID', 'Identifier', 'Name'],
        setPrinting: ['Set Unique ID', 'Initial Release Date'],
        card: ['Unique ID', 'Name', 'Pitch', 'Types', 'Card Keywords', 'Cost', 'Power',
            'Defense', 'Functional Text', 'Type Text', 'Blitz Legal', 'CC Legal',
            'Silver Age Legal', 'Commoner Legal', 'LL Legal'],
        printing: ['Card Unique ID', 'Card ID', 'Set ID', 'Edition', 'Rarity', 'Foiling',
            'Art Variations', 'Artists', 'Image URL']
    };
    var FILES = {
        set: 'set.csv', setPrinting: 'set-printing.csv', card: 'card.csv',
        printing: 'card-printing.csv'
    };
    var FOILING_ORDER = 'SRCG';

    // Formats with a legality column in card.csv ("No" = not legal) and their short names.
    var FORMATS = [['Blitz Legal', 'Blitz'], ['CC Legal', 'CC'], ['Silver Age Legal',
        'Silver Age'], ['Commoner Legal', 'Commoner'], ['LL Legal', 'LL']];

    // Card images: almost all lie in one place in three sizes (small, normal, large). For
    // those only the file name is kept (e.g. "1HP001"); other images keep their full URL.
    var IMAGE_BASE = 'https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/';
    var IMAGE_LARGE = IMAGE_BASE + 'large/';

    function imageKey(url) {
        var text = String(url || '').trim();
        var name = text.slice(IMAGE_LARGE.length, -'.webp'.length);
        var usual = text.indexOf(IMAGE_LARGE) === 0 && /\.webp$/.test(text) && !!name &&
            !/[/%]/.test(name);
        return usual ? name : text;
    }

    // URL of a card image in a size ('small', 'normal' or 'large') from its key.
    function imageUrl(key, size) {
        if (!key) return '';
        if (/^https?:/.test(key)) return key;
        return IMAGE_BASE + (size || 'large') + '/' + encodeURIComponent(key) + '.webp';
    }

    // Parses one tab separated source file and checks that the required columns exist.
    function readTable(name, text) {
        var table = FCT.csv.parseTable(text, { delimiter: '\t' });
        var missing = REQUIRED[name].filter(function (column) {
            return table.header.indexOf(column) < 0;
        });
        if (missing.length) {
            throw new Error(FILES[name] + ': Spalten fehlen (' + missing.join(', ') +
                ') - Format des Datensatzes hat sich geändert');
        }
        return table.rows;
    }

    // Translates a code with a code table; unknown codes are kept as they are.
    function label(table, code) {
        return Object.prototype.hasOwnProperty.call(table, code) ? table[code] : code;
    }

    // A source value as trimmed text (missing columns give '').
    function text(value) {
        return String(value == null ? '' : value).trim();
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

    // Main entry: texts of the source files (see FILES) -> reference tables.
    function transform(texts) {
        var vocab = FCT.DATA.vocab;

        // Release date of a set: the earliest date of its printings (languages, editions).
        var released = {};
        readTable('setPrinting', texts.setPrinting).forEach(function (row) {
            var date = String(row['Initial Release Date'] || '').slice(0, 10);
            var id = row['Set Unique ID'];
            if (date && (!released[id] || date < released[id])) released[id] = date;
        });

        // Sets: code -> name and release date (YYYY-MM-DD, empty if unknown).
        var sets = readTable('set', texts.set)
            .map(function (row) {
                return [row.Identifier.trim(), row.Name.trim(), released[row['Unique ID']] || ''];
            })
            .filter(function (set) { return set[0]; })
            .sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });

        // Cards: unique id -> name, pitch, type line, 'L' for legendary cards (only one copy
        // allowed in a deck, so their playset is 1), cost, power, defense, card keywords,
        // functional text, printed type line and the formats the card is not legal in.
        var cards = readTable('card', texts.card)
            .map(function (row) {
                var keywords = String(row['Card Keywords'] || '').split(',').map(function (k) {
                    return k.trim();
                }).filter(Boolean);
                var notLegal = FORMATS.filter(function (format) {
                    return String(row[format[0]] || '').trim() === 'No';
                }).map(function (format) { return format[1]; });
                return [row['Unique ID'], row.Name, label(vocab.pitchCodes, row.Pitch),
                    row.Types, keywords.indexOf('Legendary') >= 0 ? 'L' : '',
                    text(row.Cost), text(row.Power), text(row.Defense), keywords.join(', '),
                    text(row['Functional Text']), text(row['Type Text']), notLegal.join(', ')];
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
                group = { row: row, id: id, foilings: {}, rarityByFoiling: {},
                    imageByFoiling: {} };
                groups[key] = group;
                order.push(key);
            }
            var foiling = row.Foiling || 'S';
            group.foilings[foiling] = true;
            if (!group.rarityByFoiling[foiling]) group.rarityByFoiling[foiling] = row.Rarity;
            if (!group.imageByFoiling[foiling] && row['Image URL']) {
                group.imageByFoiling[foiling] = imageKey(row['Image URL']);
            }
        });

        var printings = order.map(function (key) {
            var group = groups[key];
            var foilings = FOILING_ORDER.split('').filter(function (f) {
                return group.foilings[f];
            }).join('');

            // The rarity and image of the most basic foiling describe the printing best.
            var rarityCode = group.rarityByFoiling[foilings[0]] || group.row.Rarity;
            var image = group.imageByFoiling[foilings[0]] || Object.keys(group.imageByFoiling)
                .map(function (f) { return group.imageByFoiling[f]; })[0] || '';
            return [
                group.id,
                group.row['Set ID'].trim(),
                label(vocab.editionCodes, group.row.Edition),
                artLabel(group.row['Art Variations']),
                label(vocab.rarityCodes, rarityCode),
                foilings,
                group.row['Card Unique ID'],
                image,
                text(group.row.Artists)
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
        sourceBase: sourceBase,
        imageUrl: imageUrl,
        FILES: FILES,
        transform: transform
    };
})();
