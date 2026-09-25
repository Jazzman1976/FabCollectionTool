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
        // Set names and release dates. A code can appear several times (e.g. "Black
        // Label" variants); the first name and the earliest date count.
        var setNames = new Map();
        var setDates = new Map();
        data.sets.forEach(function (set) {
            if (!setNames.has(set[0])) setNames.set(set[0], set[1]);
            var date = set[2] || '';
            if (date && (!setDates.get(set[0]) || date < setDates.get(set[0]))) {
                setDates.set(set[0], date);
            }
        });

        var cards = new Map();
        data.cards.forEach(function (card) {
            cards.set(card[0], { name: card[1], pitch: card[2], types: card[3],
                legendary: card[4] === 'L', cost: card[5] || '', power: card[6] || '',
                defense: card[7] || '', keywords: card[8] || '', text: card[9] || '',
                typeText: card[10] || '', notLegal: card[11] || '' });
        });

        var printingsById = new Map();
        data.printings.forEach(function (p) {
            var card = cards.get(p[6]) || { name: '', pitch: '', types: '' };
            var printing = {
                id: p[0], setCode: p[1], edition: p[2], art: p[3], rarity: p[4],
                foilings: p[5], card: card, image: p[7] || '', artists: p[8] || ''
            };
            if (!printingsById.has(printing.id)) printingsById.set(printing.id, []);
            printingsById.get(printing.id).push(printing);
        });

        state = {
            data: data, info: info, setNames: setNames, setDates: setDates, cards: cards,
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

    // Release date of a set (YYYY-MM-DD), or '' if the reference data knows none.
    function setDate(code) {
        return (state && state.setDates.get(code)) || '';
    }

    // Type line of a card number, e.g. "Guardian, Weapon, Hammer, 1H".
    function types(id) {
        var list = printings(id);
        return list.length ? list[0].card.types : '';
    }

    /*
     * Playset of a card: how many copies make a complete set for a deck. Legendary cards 1;
     * Evo equipment 3 (it is played from the deck); heroes, equipment, tokens and the like 1;
     * one-handed weapons 2, other weapons 1; Chi resources 1; everything else 3.
     * card: { types, legendary } or just a type line.
     */
    function playset(card) {
        var info = typeof card === 'object' && card ? card : { types: card, legendary: false };
        var types = String(info.types || '').split(',').map(function (t) { return t.trim(); });
        var single = ['Hero', 'Demi-Hero', 'Equipment', 'Token', 'Macro', 'Mentor', 'Landmark',
            'Chi'];
        if (info.legendary) return 1;
        if (types.indexOf('Evo') >= 0) return 3;
        if (types.some(function (t) { return single.indexOf(t) >= 0; })) return 1;
        if (types.indexOf('Weapon') >= 0) return types.indexOf('1H') >= 0 ? 2 : 1;
        return 3;
    }

    // Words of a type line that were already reported as unknown metatypes (once per word).
    var reportedWords = {};

    /*
     * Splits a type line into the columns Metatype, Talent1/2, Class1/2, Type1/2, Sub1-3,
     * following the Comprehensive Rules 2.14.1: "[metatypes] [supertypes] [type] -
     * [subtypes]". typeLine is the comma separated list of card.csv ("Types"), typeText the
     * printed type line ("Type Text"), whose dash tells where the subtypes begin. All values
     * keep the order of the card.
     * Example: "Light, Illusionist, Action, Attack" -> Talent1 "Light", Class1 "Illusionist",
     * Type1 "Action", Sub1 "Attack".
     * A word is placed by its position: types by the list of the rules; supertypes (talents,
     * classes) before the last type; subtypes after the last type or behind the dash of the
     * printed line; everything else in front is a metatype. Cards with two halves ("Null //
     * Shock") list both halves in one line; their words between two types count as well.
     */
    function splitTypes(typeLine, typeText) {
        var vocab = FCT.DATA.vocab;
        var words = String(typeLine || '').split(',').map(function (w) {
            return w.trim();
        }).filter(Boolean);

        // Words behind the dash of each half of the printed type line.
        var behindDash = {};
        String(typeText || '').split(' // ').forEach(function (half) {
            var at = half.indexOf(' - ');
            if (at < 0) return;
            half.slice(at + 3).split(/[\s(),]+/).forEach(function (w) {
                if (w) behindDash[w] = true;
            });
        });

        var typeIndexes = [];
        words.forEach(function (w, i) {
            if (vocab.cardTypes.indexOf(w) >= 0) typeIndexes.push(i);
        });
        var first = typeIndexes.length ? typeIndexes[0] : words.length;
        var last = typeIndexes.length ? typeIndexes[typeIndexes.length - 1] : -1;

        var lists = { meta: [], talents: [], classes: [], types: [], subs: [] };
        function add(list, w) {
            if (lists[list].indexOf(w) < 0) lists[list].push(w);
        }
        words.forEach(function (w, i) {
            var isTalent = vocab.talents.indexOf(w) >= 0;
            var isClass = vocab.classes.indexOf(w) >= 0;
            if (i >= first && i <= last && typeIndexes.indexOf(i) >= 0) add('types', w);
            else if (i > last && last >= 0) add('subs', w);
            else if (behindDash[w]) add('subs', w);
            else if (isTalent) add('talents', w);
            else if (isClass) add('classes', w);
            else if (i > first) add('subs', w);
            else {
                add('meta', w);
                if (vocab.metatypes.indexOf(w) < 0 && !reportedWords[w]) {
                    reportedWords[w] = true;
                    FCT.log.warn('reference', 'Unbekanntes Wort vor dem Kartentyp, als ' +
                        'Metatyp eingeordnet (neue Klasse oder neues Talent?)', w);
                }
            }
        });
        var subs = lists.subs.map(function (w) { return vocab.handSubtypes[w] || w; });
        return {
            Metatype: lists.meta.join(' '),
            Talent1: lists.talents[0] || '', Talent2: lists.talents[1] || '',
            Class1: lists.classes[0] || '', Class2: lists.classes[1] || '',
            Type1: lists.types[0] || '', Type2: lists.types[1] || '',
            Sub1: subs[0] || '', Sub2: subs[1] || '', Sub3: subs[2] || ''
        };
    }

    /*
     * The printing of a collection row: { front, back } (back only for cards with two faces),
     * or null if its card number is unknown. The printing is found by card number, edition
     * and art treatment; for cards with two faces the face is chosen by the row's name.
     */
    function printingOf(row) {
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
        return { front: front, back: back || null };
    }

    // Printing of the front side of a row ({ card, artists, ... }), or null if unknown.
    function printingFor(row) {
        var found = row && row.Id ? printingOf(row) : null;
        return found ? found.front : null;
    }

    // URL of the card image of a row ('small', 'normal' or 'large'), or '' if there is none.
    function image(row, size) {
        var found = row && row.Id ? printingOf(row) : null;
        return found ? FCT.referenceTransform.imageUrl(found.front.image, size) : '';
    }

    // Values the reference data expects for a collection row, or null if its card number is
    // unknown (see printingOf).
    function expected(row) {
        var found = printingOf(row);
        if (!found) return null;
        var front = found.front;
        var back = found.back;

        // The split of the type line is cached on the card, it is needed for every row.
        var card = front.card;
        if (!card.split) card.split = splitTypes(card.types, card.typeText);
        var result = {
            Set: setName(front.setCode),
            Rarity: front.rarity,
            Name: card.name,
            'Backside Name': back ? back.card.name : '',
            Pitch: card.pitch,
            Playset: String(playset(card))
        };
        Object.keys(card.split).forEach(function (key) { result[key] = card.split[key]; });
        return result;
    }

    return {
        install: install,
        printings: printings,
        setName: setName,
        setDate: setDate,
        types: types,
        splitTypes: splitTypes,
        playset: playset,
        expected: expected,
        printingFor: printingFor,
        image: image,
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

    // Columns of collection.csv, in file order. Same names as in the old spreadsheet. The
    // table of the app shows them in exactly this order, so that the file reads the same in
    // external tools (decided 24.09.2026); files in another order are read by column name.
    // Metatype to Sub3 follow the type line of the card (rules 2.14.1, since 2.0.5.0).
    var COLUMNS = [
        'Set', 'Edition', 'Id', 'First In', 'Rarity', 'Metatype', 'Talent1', 'Talent2',
        'Class1', 'Class2', 'Type1', 'Type2', 'Sub1', 'Sub2', 'Sub3', 'Name', 'Backside Name',
        'Translated Name', 'Translated Backside Name', 'Peculiarity', 'Art Treatment', 'Pitch',
        'Playset', 'ST', 'RF', 'CF', 'GF', 'Note', 'Overrides'
    ];
    // Columns of the type line, as filled from the reference data.
    var TYPE_COLUMNS = ['Metatype', 'Talent1', 'Talent2', 'Class1', 'Class2', 'Type1',
        'Type2', 'Sub1', 'Sub2', 'Sub3'];
    var QUANTITIES = ['ST', 'RF', 'CF', 'GF'];
    var NUMBER_COLUMNS = ['Playset'].concat(QUANTITIES);

    // Kinds of columns: the user's own input is always editable; reference columns come from
    // the reference data and identity columns describe the printing - both only in edit mode.
    // "Overrides" lists the reference columns the user changed on purpose (";" separated).
    // Playset is a reference column since 2.0.3.0: it follows from the card and never changes.
    var INPUT_COLUMNS = QUANTITIES.concat(['Note']);
    var REFERENCE_COLUMNS = ['Set', 'Rarity'].concat(TYPE_COLUMNS,
        ['Name', 'Backside Name', 'Pitch', 'Playset']);
    var OVERRIDES = 'Overrides';

    // Up to 2.0.4.0 a single column "Talent" held all talents of a card, separated by spaces
    // ("Ice Earth"). Files of that format are converted when they are read.
    var LEGACY_TALENT = 'Talent';
    var NEW_IN_2050 = ['Metatype', 'Talent1', 'Talent2'];

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

    // True if a record (values by column name) is in the format up to 2.0.4.0.
    function isLegacy(values) {
        return Object.prototype.hasOwnProperty.call(values, LEGACY_TALENT) &&
            !Object.prototype.hasOwnProperty.call(values, 'Talent1');
    }

    /*
     * Converts a record of the format up to 2.0.4.0 in place: "Talent" is split at spaces
     * into Talent1 and Talent2 (order kept), a deliberate change of "Talent" becomes one of
     * Talent1 and Talent2. Returns true if the record was converted.
     */
    function upgradeValues(values) {
        if (!isLegacy(values)) return false;
        var talents = String(values[LEGACY_TALENT] || '').split(/\s+/).filter(Boolean);
        values.Talent1 = talents[0] || '';
        values.Talent2 = talents.slice(1).join(' ');
        delete values[LEGACY_TALENT];
        if (values[OVERRIDES]) {
            var list = [];
            overrides(values).forEach(function (c) {
                var names = c === LEGACY_TALENT ? ['Talent1', 'Talent2'] : [c];
                names.forEach(function (n) { if (list.indexOf(n) < 0) list.push(n); });
            });
            values[OVERRIDES] = '';
            list.forEach(function (c) { setOverride(values, c, true); });
        }
        return true;
    }

    // Reports the conversion of records of the format up to 2.0.4.0 (see upgradeValues).
    function reportUpgrade(report, count) {
        if (!count) return;
        report.add('info', 'Spalte "Talent" in Talent1 und Talent2 aufgeteilt (Format ' +
            '2.0.5.0); Metatype kommt aus den Stammdaten. Beim nächsten Speichern steht das ' +
            'neue Format in der Datei', count + ' Zeilen');
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

    /*
     * Whether a cell may be edited: the user's input always; reference and identity columns
     * in edit mode. Outside edit mode a reference value that differs from the reference data
     * or was changed on purpose can be corrected right where it is marked.
     */
    function isEditable(row, column, editMode) {
        var kind = columnKind(column);
        if (kind === 'input') return true;
        if (kind === 'internal') return false;
        if (editMode) return true;
        if (kind !== 'reference' || row._reference) return false;
        return overrides(row).indexOf(column) >= 0 ||
            deviates(row, column, FCT.reference.expected(row));
    }

    // Accordion groups of a row: level 1 is the set, level 2 metatype, talents and classes.
    function groupNames(row) {
        var parts = [row.Metatype, row.Talent1, row.Talent2, row.Class1, row.Class2];
        var talentClass = parts.map(function (v) {
            return String(v || '').trim();
        }).filter(Boolean).join(' ');
        return [String(row.Set || '').trim() || '(ohne Set)', talentClass || 'Generic'];
    }

    // Separator of the parts of a section key (set name, section name, first card number).
    var SECTION_SEP = '\u0000';

    /*
     * Sections of the accordion (level 2, since 2.0.5.0): the rows of each set, ordered by
     * card number, are cut wherever the talent/class group changes. A group that comes back
     * later makes a section of its own with the same name (e.g. "Lightning" twice), so that
     * no section has a gap in its card numbers. Sections are built from all rows, so that
     * filters do not move them. A section of Fabled cards only is called "Fabled". A set
     * whose groups fall apart too much (more than twice as many sections as groups, e.g.
     * promo sets) gets no sections at all ("flat").
     * allRows: all rows in the order of the table. Returns { of: Map row -> section, flat:
     * Set of flat set names, rowsOf: Map set name -> rows }; a section is { key, label,
     * index }, its key starts with the set name followed by SECTION_SEP.
     */
    function sections(allRows) {
        var positions = new Map();
        var sortId = new Map();
        var previous = '';
        var rowsOf = new Map();
        allRows.forEach(function (row, i) {
            positions.set(row, i);
            if (row.Id) previous = row.Id;
            sortId.set(row, row.Id || previous);
            var set = groupNames(row)[0];
            if (!rowsOf.has(set)) rowsOf.set(set, []);
            rowsOf.get(set).push(row);
        });
        var of = new Map();
        var flat = new Set();
        rowsOf.forEach(function (rows, set) {
            var ordered = rows.slice().sort(function (a, b) {
                var ia = sortId.get(a);
                var ib = sortId.get(b);
                if (ia !== ib) return ia < ib ? -1 : 1;
                return positions.get(a) - positions.get(b);
            });

            // Cut into runs of the same group; talents and classes in any order count
            // as the same group ("Ice Earth" = "Earth Ice").
            var runs = [];
            var groups = new Set();
            ordered.forEach(function (row) {
                var name = groupNames(row)[1];
                var same = name.split(' ').sort().join(' ');
                var run = runs[runs.length - 1];
                if (!run || run.same !== same) {
                    run = { same: same, name: name, rows: [] };
                    runs.push(run);
                    groups.add(same);
                }
                run.rows.push(row);
            });
            if (runs.length > 2 * groups.size) flat.add(set);
            runs.forEach(function (run, index) {
                var fabled = run.rows.every(function (row) {
                    return row.Rarity === 'Fabled';
                });
                var label = fabled ? 'Fabled' : run.name;
                var first = sortId.get(run.rows[0]) || '';
                var section = { key: set + SECTION_SEP + label + SECTION_SEP + first,
                    label: label, index: index };
                run.rows.forEach(function (row) { of.set(row, section); });
            });
        });
        return { of: of, flat: flat, rowsOf: rowsOf };
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

    // Key that identifies a printing variant for coverage checks. Language variants are
    // merged, and "Micro Text Box" counts as "Extended Art" (as in the reference data).
    function variantKey(id, edition, art) {
        var treatments = FCT.DATA.vocab.fabraryTreatments;
        return [id, fabraryEdition(edition), treatments[art] || art].join('|');
    }

    // Key used to find rows that are exact duplicates of each other.
    function identityKey(row) {
        return ['Id', 'Edition', 'Art Treatment', 'Rarity', 'Peculiarity', 'Name',
            'Backside Name'].map(function (c) { return row[c]; }).join('|');
    }

    // Default playset for a card (see FCT.reference.playset).
    function defaultPlayset(card) {
        return FCT.reference.playset(card);
    }

    /*
     * Playsets of earlier versions were typed in by hand. Where such a value differs from the
     * reference data, it is kept as a change on purpose (override), so that nothing changes
     * silently. An empty playset carries no information and is filled in from the reference
     * data. Runs on every load; returns { kept, filled } (card numbers of the rows).
     */
    function keepPlaysets(rows) {
        var result = { kept: [], filled: [] };
        rows.forEach(function (row) {
            if (overrides(row).indexOf('Playset') >= 0) return;
            var expected = FCT.reference.expected(row);
            if (!deviates(row, 'Playset', expected)) return;
            if (String(row.Playset || '').trim() === '') {
                row.Playset = expected.Playset;
                result.filled.push(row.Id);
            } else {
                setOverride(row, 'Playset', true);
                result.kept.push(row.Id + ' ' + row.Name + ': ' + row.Playset + ' (Stammdaten ' +
                    expected.Playset + ')');
            }
        });
        return result;
    }

    // Adds the result of keepPlaysets to a report.
    function reportPlaysets(report, result) {
        result.kept.forEach(function (text) {
            report.add('info', 'Playset weicht von den Stammdaten ab und bleibt als lokale ' +
                'Änderung (✱) erhalten', text);
        });
        result.filled.forEach(function (id) {
            report.add('info', 'Playset war leer und wurde aus den Stammdaten ergänzt', id);
        });
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

        // Columns that are not part of the format are kept, but reported. The column
        // "Talent" of earlier versions is converted (see upgradeValues).
        var legacy = table.header.indexOf(LEGACY_TALENT) >= 0 &&
            table.header.indexOf('Talent1') < 0;
        collection.extraColumns = table.header.filter(function (name) {
            return name && COLUMNS.indexOf(name) < 0 && !(legacy && name === LEGACY_TALENT);
        });
        collection.extraColumns.forEach(function (name) {
            report.add('info', 'Zusätzliche Spalte wird unverändert mitgeführt', name);
        });
        // Files of earlier versions have the columns in another order; the next save
        // writes the current order.
        var known = table.header.filter(function (name) { return COLUMNS.indexOf(name) >= 0; });
        var expectedOrder = COLUMNS.filter(function (name) { return known.indexOf(name) >= 0; });
        if (known.join('|') !== expectedOrder.join('|')) {
            report.add('info', 'Spalten stehen in älterer Reihenfolge; beim nächsten ' +
                'Speichern wird die Reihenfolge der Tabelle übernommen');
        }
        COLUMNS.forEach(function (name) {
            // Files of version 2.0.0.0 have no "Overrides" column yet, files up to 2.0.4.0
            // no Metatype, Talent1 and Talent2; that is expected.
            var expectedMissing = name === OVERRIDES ||
                (legacy && NEW_IN_2050.indexOf(name) >= 0);
            if (table.header.indexOf(name) < 0 && !expectedMissing) {
                report.add('warn', 'Spalte fehlt in der Datei und wird leer ergänzt', name);
            }
        });

        // Create one row per record; nothing is dropped.
        var upgraded = 0;
        table.rows.forEach(function (values) {
            if (legacy && upgradeValues(values)) upgraded++;
            var row = newRow(values);
            collection.extraColumns.forEach(function (name) { row[name] = values[name]; });
            collection.rows.push(row);
        });

        report.summary.push(collection.rows.length + ' Zeilen gelesen');
        reportUpgrade(report, upgraded);
        reportPlaysets(report, keepPlaysets(collection.rows));
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
     * Rows from the reference data that are not yet part of the collection (every printing
     * variant that no row covers).
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
                Playset: String(defaultPlayset(front))
            });

            // Talent, classes, types and subtypes as the reference data expects them.
            var values = FCT.reference.expected(row);
            if (values) {
                TYPE_COLUMNS.forEach(function (c) { row[c] = values[c]; });
            }
            row._reference = true;
            rows.push(row);
        });
        return rows;
    }

    // Set code of a card number, e.g. "MON" for "MON062".
    function setCode(id) {
        var match = /^[A-Z0-9]{3}/.exec(String(id || ''));
        return match ? match[0] : '';
    }

    /*
     * The collection with its gaps filled: printing variants missing from a set that occurs in
     * the collection are placed where they belong (after the last row of the same set with a
     * card number up to theirs). Sets that do not occur in the collection are left out.
     * Gap rows carry _reference = true and become real rows as soon as they are edited.
     */
    function withGaps(collection) {
        var rows = collection.rows;

        // Rows per set code (in file order) and the usual set name of each code.
        var byCode = new Map();
        var names = new Map();
        rows.forEach(function (row, index) {
            var code = setCode(row.Id);
            if (!code) return;
            if (!byCode.has(code)) {
                byCode.set(code, []);
                names.set(code, new Map());
            }
            byCode.get(code).push(index);
            var counts = names.get(code);
            counts.set(row.Set, (counts.get(row.Set) || 0) + 1);
        });
        function usualName(code) {
            var best = '';
            var most = 0;
            names.get(code).forEach(function (count, name) {
                if (name && count > most) { best = name; most = count; }
            });
            return best;
        }

        // Where each gap goes: after a row index, or before the first row of its set.
        var after = new Map();
        var before = new Map();
        referenceRows(collection).forEach(function (gap) {
            var code = setCode(gap.Id);
            var indexes = byCode.get(code);
            if (!indexes) return;
            gap.Set = usualName(code) || gap.Set;
            var at = -1;
            indexes.forEach(function (i) { if (rows[i].Id <= gap.Id) at = i; });
            var target = at >= 0 ? after : before;
            var key = at >= 0 ? at : indexes[0];
            if (!target.has(key)) target.set(key, []);
            target.get(key).push(gap);
        });

        // Gaps at the same place are ordered by card number, edition and art treatment.
        function byVariant(a, b) {
            var ka = [a.Id, a.Edition, a['Art Treatment']].join('|');
            var kb = [b.Id, b.Edition, b['Art Treatment']].join('|');
            return ka < kb ? -1 : ka > kb ? 1 : 0;
        }
        var result = [];
        rows.forEach(function (row, index) {
            if (before.has(index)) {
                Array.prototype.push.apply(result, before.get(index).sort(byVariant));
            }
            result.push(row);
            if (after.has(index)) {
                Array.prototype.push.apply(result, after.get(index).sort(byVariant));
            }
        });
        return result;
    }

    /*
     * Sets of the reference data that do not occur in the collection yet (by set code of the
     * card numbers): [{ code, name, date, printings }], newest first, sets without a date
     * last; printings is the number of rows the set would get.
     */
    function missingSets(collection) {
        var present = new Set(collection.rows.map(function (row) { return setCode(row.Id); }));
        var variants = new Map();   // set code -> Set of printing variants (rows it would get)
        FCT.reference.allPrintings().forEach(function (p) {
            var code = setCode(p[0]);
            if (present.has(code)) return;
            if (!variants.has(code)) variants.set(code, new Set());
            variants.get(code).add(variantKey(p[0], p[2], p[3]));
        });
        return Array.from(variants.keys()).map(function (code) {
            return { code: code, name: FCT.reference.setName(code),
                date: FCT.reference.setDate(code), printings: variants.get(code).size };
        }).sort(function (a, b) {
            if (a.date !== b.date) return !a.date ? 1 : !b.date ? -1 : a.date < b.date ? 1 : -1;
            return a.code < b.code ? -1 : 1;
        });
    }

    /*
     * Rows for taking whole sets into the collection (as in the old spreadsheet): every
     * printing variant of the given set codes that no row covers yet, with empty quantities,
     * ordered by card number. The caller adds them to the collection.
     */
    function setRows(collection, codes) {
        var wanted = new Set(codes);
        var rows = referenceRows(collection).filter(function (row) {
            return wanted.has(setCode(row.Id));
        });
        rows.forEach(function (row) { delete row._reference; });
        return rows.sort(function (a, b) {
            var ka = [a.Id, a.Edition, a['Art Treatment']].join('|');
            var kb = [b.Id, b.Edition, b['Art Treatment']].join('|');
            return ka < kb ? -1 : ka > kb ? 1 : 0;
        });
    }

    // Reference values that differ from a row and are not overridden on purpose:
    // [{ column, value, want }]. Empty for rows without reference data.
    function differences(row) {
        var expected = FCT.reference.expected(row);
        if (!expected) return [];
        var overridden = overrides(row);
        return REFERENCE_COLUMNS.filter(function (column) {
            return overridden.indexOf(column) < 0 && deviates(row, column, expected);
        }).map(function (column) {
            return { column: column, value: row[column] || '', want: expected[column] };
        });
    }

    /*
     * Fingerprint of everything that makes up the collection itself: every column except the
     * reference columns (quantities, playset, note, card number, edition, treatment, ...)
     * and the number of rows. Taking over reference data must never change it.
     */
    function fingerprint(collection) {
        var columns = COLUMNS.filter(function (c) {
            return REFERENCE_COLUMNS.indexOf(c) < 0 && c !== OVERRIDES;
        }).concat(collection.extraColumns);
        return collection.rows.length + '\n' + collection.rows.map(function (row) {
            return columns.map(function (c) { return row[c] == null ? '' : row[c]; })
                .join('\u0001');
        }).join('\n');
    }

    /*
     * Takes over reference values: items are [{ row, diffs }] as from differences(); change
     * (row, column, value) performs one change and returns true if something changed.
     * Only reference columns are ever written. The collection itself must stay exactly as it
     * is - this is checked with the fingerprint before and after; on any difference every
     * change is rolled back and an error is thrown. Returns the number of changed values.
     */
    function takeOver(collection, items, change) {
        var before = fingerprint(collection);
        var undo = [];
        var count = 0;
        items.forEach(function (item) {
            item.diffs.forEach(function (d) {
                if (REFERENCE_COLUMNS.indexOf(d.column) < 0) return;
                undo.push({ row: item.row, column: d.column, value: item.row[d.column],
                    overrides: item.row[OVERRIDES] });
                if (change(item.row, d.column, d.want)) count++;
            });
        });
        if (fingerprint(collection) !== before) {
            undo.reverse().forEach(function (u) {
                u.row[u.column] = u.value;
                u.row[OVERRIDES] = u.overrides;
            });
            throw new Error('Das Übernehmen hätte den Bestand verändert und wurde vollständig ' +
                'zurückgenommen (' + count + ' Werte).');
        }
        return count;
    }

    /*
     * Value lists for the drop-downs of the edit mode: the fixed vocabulary first (in its
     * order), then all other values known from the reference data and the given rows, sorted.
     * Returns null for columns without a value list (free text).
     */
    var CHOICE_VOCAB = {
        Set: null, Edition: 'editions', Rarity: 'rarities', Pitch: 'pitches',
        Peculiarity: 'peculiarities', 'Art Treatment': 'artTreatments', Metatype: null,
        Talent1: 'talents', Talent2: 'talents', Class1: 'classes', Class2: 'classes',
        Type1: 'cardTypes', Type2: 'cardTypes',
        Sub1: null, Sub2: null, Sub3: null
    };
    var choiceCache = { data: null, values: {} };

    // Values of a column as found in the reference data (cached per reference data).
    function referenceChoices(column) {
        var data = FCT.reference.data();
        if (choiceCache.data !== data) choiceCache = { data: data, values: {} };
        if (choiceCache.values[column]) return choiceCache.values[column];
        var found = new Set();
        if (data) {
            if (column === 'Set') {
                data.sets.forEach(function (s) { found.add(s[1]); });
            } else if (column === 'Edition' || column === 'Art Treatment' ||
                column === 'Rarity') {
                var at = { Edition: 2, 'Art Treatment': 3, Rarity: 4 }[column];
                data.printings.forEach(function (p) { found.add(p[at]); });
            } else if (column === 'Pitch') {
                data.cards.forEach(function (c) { found.add(c[2]); });
            } else {
                data.cards.forEach(function (c) {
                    found.add(FCT.reference.splitTypes(c[3], c[10])[column]);
                });
            }
        }
        choiceCache.values[column] = found;
        return found;
    }

    function choices(column, rows) {
        if (!Object.prototype.hasOwnProperty.call(CHOICE_VOCAB, column)) return null;
        var vocab = CHOICE_VOCAB[column] ? FCT.DATA.vocab[CHOICE_VOCAB[column]] : [];
        var others = new Set(referenceChoices(column));
        (rows || []).forEach(function (row) { others.add(row[column]); });
        vocab.forEach(function (v) { others.delete(v); });
        others.delete('');
        others.delete(undefined);
        return vocab.concat(Array.from(others).sort(function (a, b) {
            return String(a).localeCompare(String(b));
        }));
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
        TYPE_COLUMNS: TYPE_COLUMNS,
        LEGACY_TALENT: LEGACY_TALENT,
        NEW_IN_2050: NEW_IN_2050,
        upgradeValues: upgradeValues,
        reportUpgrade: reportUpgrade,
        QUANTITIES: QUANTITIES,
        NUMBER_COLUMNS: NUMBER_COLUMNS,
        INPUT_COLUMNS: INPUT_COLUMNS,
        REFERENCE_COLUMNS: REFERENCE_COLUMNS,
        OVERRIDES: OVERRIDES,
        columnKind: columnKind,
        overrides: overrides,
        setOverride: setOverride,
        deviates: deviates,
        isEditable: isEditable,
        groupNames: groupNames,
        sections: sections,
        SECTION_SEP: SECTION_SEP,
        create: create,
        newRow: newRow,
        fromCsv: fromCsv,
        toCsv: toCsv,
        validate: validate,
        referenceRows: referenceRows,
        withGaps: withGaps,
        setCode: setCode,
        missingSets: missingSets,
        setRows: setRows,
        differences: differences,
        fingerprint: fingerprint,
        takeOver: takeOver,
        choices: choices,
        calculate: calculate,
        totals: totals,
        keepPlaysets: keepPlaysets,
        reportPlaysets: reportPlaysets,
        fabraryEdition: fabraryEdition,
        variantKey: variantKey,
        identityKey: identityKey,
        defaultPlayset: defaultPlayset
    };
})();
