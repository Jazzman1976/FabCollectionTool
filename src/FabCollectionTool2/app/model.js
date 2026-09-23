/*
 * model.js - reference data index, the collection model and its calculations.
 *
 * A collection is a list of rows, one row per printing variant (card number, edition,
 * art treatment, ...), with the quantities ST (standard), RF (rainbow foil), CF (cold foil)
 * and GF (gold foil) side by side - the same layout as the old spreadsheet.
 * All values are kept as the text found in the file, so that nothing is ever lost;
 * numbers are parsed only for calculations, and invalid values are reported.
 */

/*
 * Reference data index: fast lookups into FCT.DATA (shipped or refreshed online).
 */
FCT.reference = (function () {
    var state = null;

    // Builds the lookup tables from reference tables { sets, cards, printings }.
    function install(data, info) {
        var setNames = new Map();
        data.sets.forEach(function (set) {
            if (!setNames.has(set[0])) setNames.set(set[0], set[1]);
        });

        var cards = new Map();
        data.cards.forEach(function (card) {
            cards.set(card[0], { name: card[1], pitch: card[2], types: card[3] });
        });

        var printingsById = new Map();
        data.printings.forEach(function (p) {
            var card = cards.get(p[6]) || { name: '', pitch: '', types: '' };
            var printing = {
                id: p[0], setCode: p[1], edition: p[2], art: p[3], rarity: p[4],
                foilings: p[5], card: card
            };
            if (!printingsById.has(printing.id)) printingsById.set(printing.id, []);
            printingsById.get(printing.id).push(printing);
        });

        state = {
            data: data, info: info, setNames: setNames, cards: cards,
            printingsById: printingsById
        };
    }

    // All printings of a card number (several editions, art variations, card faces).
    function printings(id) {
        return (state && state.printingsById.get(id)) || [];
    }

    // Readable set name for a set code; falls back to the code itself.
    function setName(code) {
        return (state && state.setNames.get(code)) || code;
    }

    // Type line of a card number, e.g. "Guardian, Weapon, Hammer, 1H".
    function types(id) {
        var list = printings(id);
        return list.length ? list[0].card.types : '';
    }

    // Splits a type line into the spreadsheet columns Talent, Class1/2, Type1/2, Sub1-3.
    // Example: "Light, Illusionist, Action, Attack" -> Talent "Light", Class1 "Illusionist",
    // Type1 "Action", Sub1 "Attack".
    function splitTypes(typeLine) {
        var vocab = FCT.DATA.vocab;
        var talents = [];
        var classes = [];
        var cardTypes = [];
        var subtypes = [];
        String(typeLine || '').split(',').forEach(function (part) {
            var t = part.trim();
            if (!t) return;
            if (vocab.talents.indexOf(t) >= 0) talents.push(t);
            else if (vocab.classes.indexOf(t) >= 0) classes.push(t);
            else if (vocab.cardTypes.indexOf(t) >= 0) cardTypes.push(t);
            else subtypes.push(vocab.handSubtypes[t] || t);
        });
        return {
            Talent: talents.join(' '),
            Class1: classes[0] || '', Class2: classes[1] || '',
            Type1: cardTypes[0] || '', Type2: cardTypes[1] || '',
            Sub1: subtypes[0] || '', Sub2: subtypes[1] || '', Sub3: subtypes[2] || ''
        };
    }

    // Values the reference data expects for a collection row, or null if its card number is
    // unknown. The printing is found by card number, edition and art treatment; for cards with
    // two faces the face is chosen by the row's name.
    function expected(row) {
        var list = printings(row.Id);
        if (!list.length) return null;
        var vocab = FCT.DATA.vocab;
        var edition = vocab.languageEditions.indexOf(row.Edition) >= 0 ? '' : row.Edition;
        var art = row['Art Treatment'];

        // Narrow down to the printing variant; fall back step by step if nothing matches.
        var matches = list.filter(function (p) { return p.edition === edition && p.art === art; });
        if (!matches.length) matches = list.filter(function (p) { return p.art === art; });
        if (!matches.length) matches = list;

        // Card faces of the variant, in the same order as the reference rows use.
        var faces = [];
        matches.forEach(function (p) {
            var known = faces.some(function (f) { return f.card === p.card; });
            if (!known) faces.push(p);
        });
        faces.sort(function (a, b) { return a.card.name < b.card.name ? -1 : 1; });
        var name = FCT.util.fold(row.Name);
        var front = faces.filter(function (p) {
            return FCT.util.fold(p.card.name) === name;
        })[0] || faces[0];
        var back = faces.filter(function (p) {
            return p !== front && p.card.name !== front.card.name;
        })[0];

        // The split of the type line is cached on the card, it is needed for every row.
        var card = front.card;
        if (!card.split) card.split = splitTypes(card.types);
        var result = {
            Set: setName(front.setCode),
            Rarity: front.rarity,
            Name: card.name,
            'Backside Name': back ? back.card.name : '',
            Pitch: card.pitch
        };
        Object.keys(card.split).forEach(function (key) { result[key] = card.split[key]; });
        return result;
    }

    return {
        install: install,
        printings: printings,
        setName: setName,
        types: types,
        splitTypes: splitTypes,
        expected: expected,
        info: function () { return state ? state.info : null; },
        data: function () { return state ? state.data : null; },
        allPrintings: function () { return state ? state.data.printings : []; }
    };
})();

/*
 * Collection model.
 */
FCT.model = (function () {
    var util = FCT.util;

    // Columns of collection.csv, in file order. Same names as in the old spreadsheet.
    var COLUMNS = [
        'Set', 'Edition', 'Id', 'First In', 'Rarity', 'Talent', 'Class1', 'Class2', 'Type1',
        'Type2', 'Sub1', 'Sub2', 'Sub3', 'Name', 'Translated Name', 'Backside Name',
        'Translated Backside Name', 'Pitch', 'Peculiarity', 'Art Treatment', 'Playset', 'ST',
        'RF', 'CF', 'GF', 'Note', 'Overrides'
    ];
    var QUANTITIES = ['ST', 'RF', 'CF', 'GF'];
    var NUMBER_COLUMNS = ['Playset'].concat(QUANTITIES);

    // Kinds of columns: the user's own input is always editable; reference columns come from
    // the reference data and identity columns describe the printing - both only in edit mode.
    // "Overrides" lists the reference columns the user changed on purpose (";" separated).
    var INPUT_COLUMNS = NUMBER_COLUMNS.concat(['Note']);
    var REFERENCE_COLUMNS = ['Set', 'Rarity', 'Talent', 'Class1', 'Class2', 'Type1', 'Type2',
        'Sub1', 'Sub2', 'Sub3', 'Name', 'Backside Name', 'Pitch'];
    var OVERRIDES = 'Overrides';

    // Kind of a column: 'input', 'reference', 'identity' or 'internal'.
    function columnKind(column) {
        if (column === OVERRIDES) return 'internal';
        if (INPUT_COLUMNS.indexOf(column) >= 0) return 'input';
        if (REFERENCE_COLUMNS.indexOf(column) >= 0) return 'reference';
        return 'identity';
    }

    // Reference columns of a row that were changed on purpose.
    function overrides(row) {
        return String(row[OVERRIDES] || '').split(';').map(function (c) {
            return c.trim();
        }).filter(Boolean);
    }

    // Marks or unmarks a reference column of a row as changed on purpose.
    function setOverride(row, column, on) {
        var list = overrides(row).filter(function (c) { return c !== column; });
        if (on) list.push(column);
        list.sort(function (a, b) {
            return REFERENCE_COLUMNS.indexOf(a) - REFERENCE_COLUMNS.indexOf(b);
        });
        row[OVERRIDES] = list.join(';');
    }

    // True if a reference column of a row differs from the value the reference data expects.
    // The reference data often knows no back side (e.g. double sided tokens); an empty
    // expected back side is therefore no information and never a difference.
    function deviates(row, column, expectedValues) {
        if (!expectedValues) return false;
        var want = expectedValues[column];
        if (column === 'Backside Name' && !want) return false;
        return String(row[column] || '') !== want;
    }

    // Accordion groups of a row: level 1 is the set, level 2 talent and classes.
    function groupNames(row) {
        var talentClass = [row.Talent, row.Class1, row.Class2].map(function (v) {
            return String(v || '').trim();
        }).filter(Boolean).join(' ');
        return [String(row.Set || '').trim() || '(ohne Set)', talentClass || 'Generic'];
    }

    // Creates an empty collection.
    function create() {
        return { rows: [], extraColumns: [] };
    }

    // Creates a row with all columns present; values are taken from the given object.
    function newRow(values) {
        var row = {};
        COLUMNS.forEach(function (column) {
            row[column] = values && values[column] != null ? String(values[column]) : '';
        });
        return row;
    }

    // Edition as Fabrary understands it: language variants are no edition of their own.
    function fabraryEdition(edition) {
        var vocab = FCT.DATA.vocab;
        return vocab.languageEditions.indexOf(edition) >= 0 ? '' : edition;
    }

    // Key that identifies a printing variant for coverage checks (language variants merged).
    function variantKey(id, edition, art) {
        return [id, fabraryEdition(edition), art].join('|');
    }

    // Key used to find rows that are exact duplicates of each other.
    function identityKey(row) {
        return ['Id', 'Edition', 'Art Treatment', 'Rarity', 'Peculiarity', 'Name',
            'Backside Name'].map(function (c) { return row[c]; }).join('|');
    }

    // Default playset for a card, derived from its type line.
    function defaultPlayset(typeLine) {
        var types = String(typeLine || '').split(',').map(function (t) { return t.trim(); });
        var single = ['Hero', 'Demi-Hero', 'Equipment', 'Token', 'Macro', 'Mentor', 'Landmark'];
        if (types.some(function (t) { return single.indexOf(t) >= 0; })) return 1;
        if (types.indexOf('Weapon') >= 0) return types.indexOf('1H') >= 0 ? 2 : 1;
        return 3;
    }

    /*
     * Reading and writing collection.csv
     */

    // Reads collection.csv text. Unknown columns are kept and written back unchanged.
    function fromCsv(text) {
        var report = FCT.createReport('Bestand laden');
        var table = FCT.csv.parseTable(text);
        var collection = create();

        if (table.header.indexOf('Id') < 0) {
            report.add('error', 'Die Datei hat keine Spalte "Id" - kein Bestand im Format ' +
                'collection.csv');
            return { collection: null, report: report };
        }

        // Columns that are not part of the format are kept, but reported.
        collection.extraColumns = table.header.filter(function (name) {
            return name && COLUMNS.indexOf(name) < 0;
        });
        collection.extraColumns.forEach(function (name) {
            report.add('info', 'Zusätzliche Spalte wird unverändert mitgeführt', name);
        });
        COLUMNS.forEach(function (name) {
            // Files of version 2.0.0.0 have no "Overrides" column yet; that is expected.
            if (table.header.indexOf(name) < 0 && name !== OVERRIDES) {
                report.add('warn', 'Spalte fehlt in der Datei und wird leer ergänzt', name);
            }
        });

        // Create one row per record; nothing is dropped.
        table.rows.forEach(function (values) {
            var row = newRow(values);
            collection.extraColumns.forEach(function (name) { row[name] = values[name]; });
            collection.rows.push(row);
        });

        report.summary.push(collection.rows.length + ' Zeilen gelesen');
        return { collection: collection, report: report };
    }

    // Writes collection.csv text: always quoted, CRLF, UTF-8 (the caller adds no BOM).
    function toCsv(collection) {
        var header = COLUMNS.concat(collection.extraColumns);
        var records = [header].concat(collection.rows.map(function (row) {
            return header.map(function (name) { return row[name] == null ? '' : row[name]; });
        }));
        return FCT.csv.stringify(records);
    }

    /*
     * Validation
     */

    // Checks all rows against reference data and vocabulary; returns a report.
    function validate(collection, title) {
        var vocab = FCT.DATA.vocab;
        var report = FCT.createReport(title || 'Prüfung');
        var seen = new Map();

        // Checks a value against a vocabulary list (empty is always allowed).
        function checkVocab(row, column, list) {
            var value = row[column];
            if (value && list.indexOf(value) < 0) {
                report.add('warn', 'Unbekannter Wert in Spalte "' + column + '"',
                    row.Id + ': ' + value);
            }
        }

        collection.rows.forEach(function (row) {
            // Rows without card number cannot be exported, but are kept.
            if (!row.Id.trim()) {
                report.add('warn', 'Zeile ohne Id (bleibt erhalten, wird nicht exportiert)',
                    row.Name || '(leer)');
                return;
            }

            // Quantities must be whole numbers.
            NUMBER_COLUMNS.forEach(function (column) {
                if (isNaN(util.toInt(row[column]))) {
                    report.add('error', 'Ungültige Zahl (wird als 0 gerechnet)',
                        row.Id + ' ' + column + ': "' + row[column] + '"');
                }
            });

            // Vocabulary.
            checkVocab(row, 'Edition', vocab.editions);
            checkVocab(row, 'Art Treatment', vocab.artTreatments);
            checkVocab(row, 'Rarity', vocab.rarities);
            checkVocab(row, 'Pitch', vocab.pitches);
            checkVocab(row, 'Peculiarity', vocab.peculiarities);

            // Card number and name against the reference data. Never matched by name.
            var printings = FCT.reference.printings(row.Id);
            if (!printings.length) {
                report.add('warn', 'Kartennummer nicht in den Stammdaten', row.Id);
            } else if (row.Name) {
                var names = printings.map(function (p) { return util.fold(p.card.name); });
                if (names.indexOf(util.fold(row.Name)) < 0) {
                    report.add('info', 'Name weicht von den Stammdaten ab',
                        row.Id + ': "' + row.Name + '" / "' + printings[0].card.name + '"');
                }
            }

            // Exact duplicates.
            var key = identityKey(row);
            if (seen.has(key)) report.add('warn', 'Doppelte Zeile', row.Id + ' ' + row.Name);
            seen.set(key, true);
        });
        return report;
    }

    /*
     * Rows from the reference data that are not yet part of the collection.
     * They are shown on demand, so that new cards can be entered without typing their data.
     */
    function referenceRows(collection) {
        var covered = new Set();
        collection.rows.forEach(function (row) {
            covered.add(variantKey(row.Id, row.Edition, row['Art Treatment']));
        });

        // Group printings by variant; several card faces make one row (front and back side).
        var byVariant = new Map();
        FCT.reference.allPrintings().forEach(function (p) {
            var key = variantKey(p[0], p[2], p[3]);
            if (covered.has(key)) return;
            if (!byVariant.has(key)) byVariant.set(key, []);
            byVariant.get(key).push(p);
        });

        var rows = [];
        byVariant.forEach(function (group) {
            var first = group[0];
            var faces = FCT.reference.printings(first[0]).filter(function (p) {
                return p.edition === first[2] && p.art === first[3];
            }).map(function (p) { return p.card; });
            faces.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
            var front = faces[0] || { name: '', pitch: '', types: '' };
            var back = faces.length > 1 ? faces[1] : null;
            var row = newRow({
                Set: FCT.reference.setName(first[1]),
                Edition: first[2],
                Id: first[0],
                Rarity: first[4],
                Name: front.name,
                'Backside Name': back && back.name !== front.name ? back.name : '',
                Pitch: front.pitch,
                'Art Treatment': first[3],
                Playset: String(defaultPlayset(front.types))
            });

            // Talent, classes, types and subtypes as the reference data expects them.
            var values = FCT.reference.expected(row);
            if (values) {
                ['Talent', 'Class1', 'Class2', 'Type1', 'Type2', 'Sub1', 'Sub2', 'Sub3']
                    .forEach(function (c) { row[c] = values[c]; });
            }
            row._reference = true;
            rows.push(row);
        });
        return rows;
    }

    /*
     * Calculations: Have / Need / Left per set (same card number) and in total
     * (same name, pitch and peculiarity, over all sets). Same rules as the old spreadsheet.
     */
    function calculate(rows) {
        var haveById = new Map();
        var haveByCard = new Map();

        // Key of a card over all sets.
        function cardKey(row) {
            return util.fold(row.Name) + '|' + row.Pitch + '|' + row.Peculiarity;
        }

        // First pass: sum up quantities.
        rows.forEach(function (row) {
            var have = 0;
            QUANTITIES.forEach(function (column) {
                var n = util.toInt(row[column]);
                if (!isNaN(n)) have += n;
            });
            row._have = have;
            haveById.set(row.Id, (haveById.get(row.Id) || 0) + have);
            var key = cardKey(row);
            haveByCard.set(key, (haveByCard.get(key) || 0) + have);
        });

        // Second pass: derive need and left from the playset.
        rows.forEach(function (row) {
            var playset = util.toInt(row.Playset);
            if (isNaN(playset)) playset = 0;
            var haveSet = haveById.get(row.Id) || 0;
            var haveTotal = haveByCard.get(cardKey(row)) || 0;
            row._calc = {
                have: row._have,
                haveSet: haveSet,
                needSet: Math.max(0, playset - haveSet),
                leftSet: Math.max(0, haveSet - playset),
                haveTotal: haveTotal,
                needTotal: Math.max(0, playset - haveTotal),
                leftTotal: Math.max(0, haveTotal - playset)
            };
        });
    }

    // Totals for the status line.
    function totals(rows) {
        var result = { rows: 0, cards: 0 };
        rows.forEach(function (row) {
            if (row._reference) return;
            result.rows++;
            result.cards += row._have || 0;
        });
        return result;
    }

    return {
        COLUMNS: COLUMNS,
        QUANTITIES: QUANTITIES,
        NUMBER_COLUMNS: NUMBER_COLUMNS,
        INPUT_COLUMNS: INPUT_COLUMNS,
        REFERENCE_COLUMNS: REFERENCE_COLUMNS,
        OVERRIDES: OVERRIDES,
        columnKind: columnKind,
        overrides: overrides,
        setOverride: setOverride,
        deviates: deviates,
        groupNames: groupNames,
        create: create,
        newRow: newRow,
        fromCsv: fromCsv,
        toCsv: toCsv,
        validate: validate,
        referenceRows: referenceRows,
        calculate: calculate,
        totals: totals,
        fabraryEdition: fabraryEdition,
        variantKey: variantKey,
        identityKey: identityKey,
        defaultPlayset: defaultPlayset
    };
})();
