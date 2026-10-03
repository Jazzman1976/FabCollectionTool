/*
 * selftest.mjs - maintenance tool: automated acceptance checks without a browser.
 *
 * Usage (from the tool folder):
 *   node tools/selftest.mjs <example.ods> <fabrary-export.csv> [folder with source csv files]
 *       [--fabrary-current <current fabrary-export.csv>]
 * The shipped Fabrary mapping is checked against a current export of Fabrary (before a
 * release): the file at .ignore/ressources/fabrary-export.csv (issue #31), or another file given
 * with --fabrary-current. Without either, these checks are skipped, e.g. in the GitHub Action.
 *
 * The inputs are the user's own files; they are only read, never copied into the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { loadApp, appRoot, fabraryExportFile } from './load-app.mjs';

// Read the command line: positional arguments and the optional current Fabrary export.
const args = process.argv.slice(2);
const currentAt = args.indexOf('--fabrary-current');
const givenFile = currentAt >= 0 ? args[currentAt + 1] : '';
if (currentAt >= 0) args.splice(currentAt, 2);
const [odsFile, fabraryFile, sourceDir] = args;
if (!odsFile || !fabraryFile || (currentAt >= 0 && !givenFile)) {
    console.error('Usage: node tools/selftest.mjs <example.ods> <fabrary-export.csv> ' +
        '[source folder] [--fabrary-current <current fabrary-export.csv>]');
    process.exit(1);
}

// The current Fabrary export: the file given, otherwise the one at the fixed local place.
const currentFile = givenFile || (fs.existsSync(fabraryExportFile) ? fabraryExportFile : '');
if (currentFile) console.log(`INFO current Fabrary export: ${currentFile}`);

// Load all logic scripts. Node.js 18 cannot inflate raw deflate data via
// DecompressionStream, so the ODS reader gets a zlib based replacement here.
const FCT = loadApp({
    withReference: true,
    extra: ['app/model.js', 'app/changelog.js', 'app/import-ods.js', 'app/import-fabrary.js',
        'app/fabrary-map.js', 'app/export-fabrary.js', 'app/export-cardmarket.js']
});
FCT.importOds.inflateRaw = async (bytes) => new Uint8Array(zlib.inflateRawSync(bytes));
FCT.reference.install(FCT.DATA, FCT.DATA.info);

let failures = 0;
function check(name, ok, detail) {
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
    if (!ok) failures++;
}

// CSV robustness: commas, quotes, line breaks and special characters survive a round trip.
{
    const collection = FCT.model.create();
    collection.rows.push(FCT.model.newRow({ Id: 'WTR001', Name: 'Rhinar, Reckless Rampage',
        ST: '1', Note: 'Zeile 1\nZeile 2 mit "Anführungszeichen"' }));
    collection.rows.push(FCT.model.newRow({ Id: 'MON254', Name: 'Tremor of íArathael',
        Note: 'Ünïcödé ✓' }));
    // Playset and first set as the reference data expects them (empty ones would be filled
    // in on load).
    collection.rows.forEach((row) => {
        const expected = FCT.reference.expected(row);
        row.Playset = expected.Playset;
        row['First In'] = expected['First In'];
    });
    const text = FCT.model.toCsv(collection);
    const back = FCT.model.fromCsv('﻿' + text).collection;
    check('CSV round trip', FCT.model.toCsv(back) === text &&
        back.rows[0].Name === 'Rhinar, Reckless Rampage' &&
        back.rows[0].Note === collection.rows[0].Note && back.rows[1].Note === 'Ünïcödé ✓');
}

// ODS import.
const odsBuffer = fs.readFileSync(odsFile);
const ods = await FCT.importOds.importOds(odsBuffer.buffer.slice(odsBuffer.byteOffset,
    odsBuffer.byteOffset + odsBuffer.byteLength));
check('ODS import', ods.collection && ods.collection.rows.length > 0,
    ods.report.summary.join('; '));

// Fabrary import.
const example = fs.readFileSync(fabraryFile, 'utf8');
const imported = FCT.importFabrary.importFabrary(example);
const exampleRecords = FCT.csv.parse(example);
check('Fabrary import', imported.collection && imported.collection.rows.length > 0,
    imported.report.summary.join('; '));

/*
 * Fabrary export after ODS import (issue #17): the rows come from the reference data - every
 * printing in each of its foilings, nothing else -, Have and Extra for trade are never empty,
 * the quantities of the collection arrive, and identifier and treatment follow the rules of
 * the first tool and of Fabrary.
 */
{
    const fab = FCT.exportFabrary;
    const exported = fab.exportFabrary(ods.collection);
    const records = FCT.csv.parse(exported.text);
    const header = records.shift();
    check('Fabrary export header', header.join() === exampleRecords[0].join());

    // Every printing variant and foiling of the reference data, and only those.
    const letters = { '': 'S', Rainbow: 'R', Cold: 'C', Gold: 'G' };
    const expected = new Set();
    FCT.reference.allPrintings().forEach((p) => {
        String(p[5]).split('').forEach((f) => expected.add([p[0], p[2], f].join('|')));
    });
    const written = new Set(records.map((r) => [r[4], r[5], letters[r[6]]].join('|')));
    const missing = [...expected].filter((k) => !written.has(k));
    const extra = [...written].filter((k) => !expected.has(k));
    check('Fabrary export: all variants from the reference data, no others',
        missing.length === 0 && extra.length === 0,
        `${records.length} rows, ${missing.length} missing, ${extra.length} unknown`);
    const empty = records.filter((r) => !/^\d+$/.test(r[8]) || !/^\d+$/.test(r[11]));
    check('Fabrary export: Have and Extra for trade never empty', empty.length === 0,
        `${empty.length} rows with an empty value`);

    // The quantities of the collection arrive (except rows the report names as skipped).
    const have = records.reduce((sum, r) => sum + Number(r[8]), 0);
    const owned = ods.collection.rows.reduce((sum, row) => sum + ['ST', 'RF', 'CF', 'GF']
        .reduce((s, c) => s + (FCT.util.toInt(row[c]) || 0), 0), 0);
    check('Fabrary export: quantities arrive', have + exported.skipped === owned,
        `${have} exported + ${exported.skipped} skipped = ${owned} owned`);

    check('Fabrary identifier as in the first tool',
        fab.identifier('Arcane Seeds // Life', 'Red') === 'arcane-seeds--life-red' &&
        fab.identifier('10,000 Year Reunion', 'Red') === '10000-year-reunion-red' &&
        fab.identifier('Twelve Petal Kāṣāya', '') === 'twelve-petal-kasaya' &&
        fab.identifier('Squizzy & Floof', '') === 'squizzy--floof');
    check('Fabrary treatment order',
        fab.treatment('Alternate Art, Extended Art', '', 'X') === 'Alternate Art' &&
        fab.treatment('Alternate Border, Extended Art', '', 'X') === 'Alternate Border' &&
        fab.treatment('Alternate Art, Full Art', '', 'X') === 'Alternate Art' &&
        fab.treatment('Micro Text Box', '', 'X') === 'Extended Art' &&
        fab.treatment('Extended Art', '', 'ROS002') === '' &&
        fab.treatment('Extended Art', 'Rainbow', 'ROS002') === 'Extended Art');

    // Information only: how close the rows are to Fabrary's own export.
    const own = new Set(exampleRecords.slice(1).map((r) => r.slice(0, 8).join('|')));
    const same = records.filter((r) => own.has(r.slice(0, 8).join('|'))).length;
    console.log(`INFO Fabrary export: ${same} of ${own.size} rows of Fabrary's own export ` +
        'written identically');
}

// Round trip: Fabrary import -> export -> import gives the same collection. Only set names
// and treatments are written as the Fabrary mapping says, and cards the reference data does
// not know (e.g. sets of other branches) are skipped by the export. A second export is
// identical.
{
    const first = FCT.exportFabrary.exportFabrary(imported.collection).text;
    const again = FCT.importFabrary.importFabrary(first);
    // The Fabrary mapping writes Fabrary's set names and full treatments, which the import
    // takes over; the variants stay the same.
    const withoutSet = (collection) => {
        const copy = FCT.model.create();
        collection.rows.filter((row) => FCT.reference.printings(row.Id).length)
            .forEach((row) => copy.rows.push(Object.assign({}, row, { Set: '',
                'Art Treatment': FCT.exportFabrary.treatment(row['Art Treatment'], '',
                    row.Id) })));
        return FCT.model.toCsv(copy);
    };
    check('Fabrary round trip',
        withoutSet(again.collection) === withoutSet(imported.collection) &&
        FCT.exportFabrary.exportFabrary(again.collection).text === first);
}

/*
 * Fabrary mapping against a current Fabrary export (issue #17, addendum; only with a current
 * export, see the head of this file): with the shipped mapping every row of the export is
 * written exactly as in that export, except the printings Fabrary does not know; its
 * quantities arrive, and the comparison finds nothing left to map.
 */
if (!currentFile) {
    console.log('SKIP Fabrary mapping against a current Fabrary export ' +
        '(none at .ignore/ressources/fabrary-export.csv, no --fabrary-current)');
} else {
    const map = FCT.fabraryMap;
    const fab = FCT.exportFabrary;
    const fabraryText = fs.readFileSync(currentFile, 'utf8');
    const fabraryRecords = FCT.csv.parse(fabraryText).slice(1);
    const known = new Set(fabraryRecords.map((r) => r.slice(0, 8).join('|')));
    const rows = fab.baseRows();
    const result = map.compare(rows, fabraryText);
    const absent = new Set(result.notInFabrary.map((row) => row.identity.slice(4, 7).join('|')));

    const collection = FCT.importFabrary.importFabrary(fabraryText).collection;
    const records = FCT.csv.parse(fab.exportFabrary(collection).text).slice(1);
    const other = records.filter((r) => !known.has(r.slice(0, 8).join('|')) &&
        !absent.has(r.slice(4, 7).join('|')));
    const exported = new Map(records.map((r) => [r.slice(0, 8).join('|'), r[8]]));
    // Printings the reference data does not know (e.g. sets of other branches) are skipped.
    const numbers = new Set(records.map((r) => r[4]));
    const lost = fabraryRecords.filter((r) => Number(r[8]) > 0 && numbers.has(r[4]) &&
        exported.get(r.slice(0, 8).join('|')) !== r[8]);
    const cards = ['ANQ006', 'FAB375', 'LGS427', 'CRU009', 'SUP208', 'PEN165'];
    const reached = cards.every((id) => records.filter((r) => r[4] === id)
        .every((r) => known.has(r.slice(0, 8).join('|'))));
    check("Fabrary mapping meets Fabrary's export", !other.length && !lost.length && reached,
        `${records.length} rows, ${other.length} unlike Fabrary, ${absent.size} not in ` +
            `Fabrary, ${lost.length} quantities lost, ${cards.join(' ')}: ${reached}`);
    check('Fabrary comparison with the shipped mapping',
        !result.sets.length && !result.variants.length && !result.unclear.length,
        `${result.matched} found, ${result.sets.length} sets, ${result.variants.length} ` +
            `variants, ${result.unclear.length} unclear`);
}

/*
 * Own Fabrary mapping entries (issue #17, addendum), without any file of Fabrary: the export
 * of an empty collection stands in for Fabrary's export. Compared with it, the shipped mapping
 * leaves nothing to map; own entries win over shipped ones, a wrong own entry is found, and
 * values equal to the shipped ones are not kept.
 */
{
    const map = FCT.fabraryMap;
    const fab = FCT.exportFabrary;
    const rows = fab.baseRows();
    const fabraryText = fab.exportFabrary(FCT.model.create()).text;
    const none = map.compare(rows, fabraryText);
    const clean = !none.error && !none.sets.length && !none.variants.length &&
        !none.unclear.length && !none.notInFabrary.length;

    const anq = rows.find((row) => row.identity[4] === 'ANQ006' && row.identity[6] === 'Rainbow');
    const own = map.empty();
    map.setSet(own, 'ANQ', 'Test Set');
    map.setVariant(own, anq, { treatment: 'Alternate Art' });
    const mapped = map.apply(anq, own);
    const ownWins = mapped.own && mapped.identity[3] === 'Test Set' &&
        mapped.identity[7] === 'Alternate Art';
    const wrong = map.compare(rows, fabraryText, own);
    const found = wrong.sets.length === 1 && wrong.variants.length === 1 &&
        wrong.variants[0].fabrary.treatment === 'Alternate Art, Alternate Border, Extended Art';
    map.setSet(own, 'ANQ', 'Promos');
    map.setVariant(own, anq, { treatment: 'Alternate Art, Alternate Border, Extended Art' });
    const normal = map.normalize({ sets: { ANQ: 'X', BAD: 1 }, variants: { k: { set: 'Y',
        other: 'Z' }, empty: {} } });
    check('Fabrary mapping: own entries', clean && ownWins && found && map.isEmpty(own) &&
        JSON.stringify(normal) === '{"sets":{"ANQ":"X"},"variants":{"k":{"set":"Y"}}}',
        `nothing left to map ${clean}, own wins ${ownWins}, wrong entry found ${found}, ` +
            `reset ${map.isEmpty(own)}`);
}

// Cardmarket wants list (issue #7) from the ODS example: line format, sorting, pitch only for
// cards with several pitches, one line per card, filters and name exceptions.
{
    const fold = FCT.util.fold;
    const cm = FCT.exportCardmarket;
    const all = cm.exportCardmarket(ods.collection, { basis: 'total' });
    const lines = all.text.split('\n').filter(Boolean);
    const entries = cm.wants(ods.collection, { basis: 'total' });
    const badFormat = lines.filter((line) => !/^[1-9]\d* \S/.test(line) || /\s{2}|\s$/.test(line));
    const sorted = entries.every((e, i) => !i ||
        fold(entries[i - 1].row.Name).localeCompare(fold(e.row.Name)) <= 0);
    check('Cardmarket format and order', lines.length > 0 && lines.length === all.lines &&
        !badFormat.length && sorted, `${lines.length} lines, ${all.cards} cards, ` +
        `bad ${badFormat.slice(0, 3).join(' / ') || '-'}`);

    // Pitch: written exactly for names with several pitches.
    const pitches = new Map();
    FCT.reference.data().cards.forEach((card) => {
        if (!card[2]) return;
        if (!pitches.has(fold(card[1]))) pitches.set(fold(card[1]), new Set());
        pitches.get(fold(card[1])).add(card[2]);
    });
    const wrongPitch = entries.filter((e) => {
        const several = (pitches.get(fold(e.row.Name)) || new Set()).size > 1;
        return several ? e.pitch !== e.row.Pitch : e.pitch !== '';
    });
    check('Cardmarket pitch only when needed', !wrongPitch.length,
        wrongPitch.slice(0, 3).map((e) => e.row.Name).join(', '));

    // "Missing in total": one line per name, back side and pitch; quantity = largest playset
    // of these rows minus all copies owned (also across peculiarities such as the CC label).
    const cardOf = (r) => [fold(r.Name), fold(r['Backside Name']), r.Pitch].join('|');
    const keys = entries.map((e) => cardOf(e.row));
    const wrongNeed = entries.filter((e) => {
        const rows = ods.collection.rows.filter((r) => r.Id.trim() && cardOf(r) === cardOf(e.row));
        const playset = Math.max(...rows.map((r) => FCT.util.toInt(r.Playset) || 0));
        const have = rows.reduce((sum, r) => sum + r._have, 0);
        return e.quantity !== playset - have;
    });
    check('Cardmarket one line per card', new Set(keys).size === keys.length && !wrongNeed.length,
        `${keys.length - new Set(keys).size} duplicates, ${wrongNeed.length} wrong quantities`);

    // Filters: one set, one rarity; "per set" with the set name writes it at the line end.
    const someSet = entries[0].row.Set;
    const oneSet = cm.wants(ods.collection, { basis: 'total', sets: [someSet] });
    const rares = cm.wants(ods.collection, { basis: 'total', rarities: ['Rare'] });
    const perSet = cm.exportCardmarket(ods.collection, { basis: 'set', suffix: 'set',
        sets: [someSet] });
    const perSetLines = perSet.text.split('\n').filter(Boolean);
    check('Cardmarket set and rarity filter', oneSet.length > 0 &&
        oneSet.every((e) => e.set === someSet) && rares.length > 0 &&
        rares.every((e) => e.row.Rarity === 'Rare') &&
        perSetLines.every((line) => line.endsWith(' (' + someSet + ')')),
        `${someSet}: ${oneSet.length}, Rare: ${rares.length}, per set: ${perSetLines.length}`);

    // "Per set" without the set name (#35): one line per card with the sum of its lines per
    // set, no set name at the line end, no card twice, no card lost.
    // Expected: the lines with set name, the set name taken off, summed per remaining text.
    const perSetAll = cm.wants(ods.collection, { basis: 'set' });
    const named = cm.exportCardmarket(ods.collection, { basis: 'set', suffix: 'set' });
    const plain = cm.exportCardmarket(ods.collection, { basis: 'set', suffix: 'none' });
    const plainLines = plain.text.split('\n').filter(Boolean);
    const sums = new Map();
    named.text.split('\n').filter(Boolean).forEach((line, i) => {
        const card = line.slice(0, -(' (' + perSetAll[i].set + ')').length)
            .replace(/^\d+ /, '');
        sums.set(card, (sums.get(card) || 0) + perSetAll[i].quantity);
    });
    const setNames = new Set(perSetAll.map((e) => ' (' + e.set + ')'));
    const withSet = plainLines.filter((line) => [...setNames].some((s) => line.endsWith(s)));
    const wrongSum = plainLines.filter((line) => {
        const match = /^(\d+) (.*)$/.exec(line);
        return sums.get(match[2]) !== Number(match[1]);
    });
    const cardsPerSet = perSetAll.reduce((sum, e) => sum + e.quantity, 0);
    check('Cardmarket per set without set name', plainLines.length === sums.size &&
        sums.size < perSetAll.length && !wrongSum.length && !withSet.length &&
        plain.cards === cardsPerSet,
        `${perSetAll.length} lines per set -> ${plainLines.length} lines, ` +
        `${plain.cards} of ${cardsPerSet} cards, wrong sums ${wrongSum.length}, ` +
        `with set name ${withSet.length}`);

    // Name exceptions of the first tool.
    const collection = FCT.model.create();
    collection.rows.push(FCT.model.newRow({ Id: 'XXX001', Name: 'Twelve Petal Kāṣāya',
        Playset: '1' }));
    collection.rows.push(FCT.model.newRow({ Id: 'XXX002', Name: 'Lyath Goldmane, Vile Savant',
        'Backside Name': 'Lyath Goldmane', Playset: '1' }));
    collection.rows.push(FCT.model.newRow({ Id: 'XXX003', Name: 'A Card',
        'Backside Name': 'Its Back', Playset: '2', ST: '1' }));
    const names = cm.exportCardmarket(collection, { basis: 'total' }).text;
    check('Cardmarket name exceptions', names === '1 A Card // Its Back\n' +
        '1 Lyath Goldmane, Vile Savant\n1 Twelve Petal Kasaya\n', JSON.stringify(names));
}


// Type line split into the columns Metatype to Sub3 by the rules 2.14.1 (2.0.5.0): words
// are placed by their position; the dash of the printed type line marks the subtypes.
{
    const split = FCT.reference.splitTypes;
    const empty = Object.fromEntries(FCT.model.TYPE_COLUMNS.map((c) => [c, '']));
    const same = (a, b) => JSON.stringify(a) === JSON.stringify({ ...empty, ...b });
    const cases = [
        ['Light, Illusionist, Action, Attack', 'Light Illusionist Action - Attack',
            { Talent1: 'Light', Class1: 'Illusionist', Type1: 'Action', Sub1: 'Attack' }],
        ['Generic, Equipment, Chest', 'Generic Equipment - Chest',
            { Class1: 'Generic', Type1: 'Equipment', Sub1: 'Chest' }],
        ['Ice, Earth, Guardian, Weapon, Hammer, 2H', 'Ice Earth Guardian Weapon - Hammer (2H)',
            { Talent1: 'Ice', Talent2: 'Earth', Class1: 'Guardian', Type1: 'Weapon',
                Sub1: 'Hammer', Sub2: '(2H)' }],
        ['Guardian, Hero, Pit-Fighter', 'Guardian Hero - Pit-Fighter',
            { Class1: 'Guardian', Type1: 'Hero', Sub1: 'Pit-Fighter' }],
        ['Rosetta, Macro', 'Rosetta Macro', { Metatype: 'Rosetta', Type1: 'Macro' }],
        ['Puffin, Companion, Off-Hand, Ally', 'Puffin Companion - Off-Hand Ally',
            { Metatype: 'Puffin', Type1: 'Companion', Sub1: 'Off-Hand', Sub2: 'Ally' }],
        ['Event, Equipment, Head', 'Event Equipment - Head',
            { Metatype: 'Event', Type1: 'Equipment', Sub1: 'Head' }],
        ['Light, Angel, Ally', 'Light - Angel Ally',
            { Talent1: 'Light', Sub1: 'Angel', Sub2: 'Ally' }],
        ['Brute, Attack, Action', 'Brute Action - Attack',
            { Class1: 'Brute', Type1: 'Action', Sub1: 'Attack' }],
        ['Hero, Merchant', 'Hero - Merchant', { Type1: 'Hero', Sub1: 'Merchant' }],
        ['Wizard, Instant, Earth, Instant', 'Wizard Instant // Earth Instant',
            { Talent1: 'Earth', Class1: 'Wizard', Type1: 'Instant' }]
    ];
    const wrong = cases.filter(([types, text, want]) => !same(split(types, text), want));

    // Every word of every type line of the reference data is placed in exactly one column.
    const lost = FCT.DATA.cards.filter((card) => {
        const placed = Object.values(split(card[3], card[10])).filter(Boolean).join(' ');
        const words = ` ${placed.replace(/[()]/g, '')} `;
        return card[3].split(',').map((w) => w.trim()).filter(Boolean)
            .some((w) => !words.includes(` ${w} `));
    });
    const unknown = FCT.log.entries().filter((e) => /Unbekanntes Wort/.test(e.message));
    check('Type line split', !wrong.length && !lost.length && !unknown.length,
        `${cases.length - wrong.length} of ${cases.length} cases, ${lost.length} cards with ` +
        `unplaced words, unknown words: ${unknown.map((e) => e.data).join(', ') || 'none'}` +
        (wrong.length ? `; wrong: ${wrong.map((c) => c[0]).join(' / ')}` : ''));
}

// Files up to 2.0.4.0 (collection.csv and spreadsheet) with one column "Talent" are split into
// Talent1 and Talent2 in the order of the file; a deliberate change moves along (2.0.5.0).
{
    const header = ['Set', 'Id', 'Talent', 'Class1', 'Name', 'ST', 'Overrides'];
    const old = FCT.model.fromCsv(FCT.csv.stringify([header,
        ['Kyloria', 'WTR001', 'Ice Earth', 'Guardian', 'X', '1', 'Rarity;Talent'],
        ['Kyloria', 'WTR002', 'Light', '', 'Y', '1', '']]));
    const [a, b] = old.collection.rows;
    const split = a.Talent1 === 'Ice' && a.Talent2 === 'Earth' && b.Talent1 === 'Light' &&
        b.Talent2 === '' && !('Talent' in a) && !old.collection.extraColumns.length;
    const moved = a.Overrides === 'Rarity;Talent1;Talent2';
    const noted = old.report.groups.some((g) => /Talent1 und Talent2/.test(g.category));
    const quiet = !old.report.groups.some((g) => g.examples.some((e) =>
        FCT.model.NEW_IN_2050.includes(e)));
    const written = FCT.csv.parse(FCT.model.toCsv(old.collection))[0].join('|') ===
        FCT.model.COLUMNS.join('|');
    const fromOds = ods.collection.rows.some((r) => r.Talent2) &&
        !ods.collection.extraColumns.includes('Talent') &&
        ods.report.groups.some((g) => /Talent1 und Talent2/.test(g.category));
    check('Talent split of old files', split && moved && noted && quiet && written && fromOds,
        `split ${split}, override moved ${moved}, noted ${noted}, no missing column ` +
        `${quiet}, written in new format ${written}, spreadsheet ${fromOds}`);
}

// Overrides: kept in collection.csv; files of 2.0.0.0 without the column still load.
{
    const collection = FCT.model.create();
    const row = FCT.model.newRow({ Id: 'WTR001', Name: 'Rhinar, Reckless Rampage' });
    FCT.model.setOverride(row, 'Rarity', true);
    FCT.model.setOverride(row, 'Name', true);
    FCT.model.setOverride(row, 'Rarity', false);
    collection.rows.push(row);
    const back = FCT.model.fromCsv(FCT.model.toCsv(collection));
    check('Overrides round trip', back.collection.rows[0].Overrides === 'Name');

    const old = FCT.model.fromCsv('"Id","Name","ST"\r\n"WTR001","Rhinar","1"\r\n');
    const warned = old.report.groups.some((g) => g.examples.includes('Overrides'));
    check('2.0.0.0 file without Overrides', old.collection.rows[0].Overrides === '' && !warned);
}

// Purple pitch: code 4 of the reference data is "Purple"; rows saved as "4" are converted.
{
    const code = FCT.DATA.vocab.pitchCodes[4] === 'Purple';
    const loaded = FCT.model.fromCsv('"Id","Name","Pitch"\r\n"X001","A","4"\r\n' +
        '"X002","B","Red"\r\n');
    const rows = loaded.collection.rows;
    const converted = rows[0].Pitch === 'Purple' && rows[1].Pitch === 'Red';
    const noted = JSON.stringify(loaded.report).includes('Purple');
    check('Purple pitch', code && converted && noted,
        `code ${code}, converted ${converted}, noted ${noted}`);
}

// Expected reference values against the ODS rows: most rows must match. The deviations per
// column are printed for information.
{
    let known = 0;
    let cells = 0;
    const byColumn = {};
    ods.collection.rows.forEach((row) => {
        const expected = FCT.reference.expected(row);
        if (!expected) return;
        known++;
        FCT.model.REFERENCE_COLUMNS.forEach((c) => {
            cells++;
            if (FCT.model.deviates(row, c, expected)) byColumn[c] = (byColumn[c] || 0) + 1;
        });
    });
    const deviations = Object.values(byColumn).reduce((a, b) => a + b, 0);
    check('Reference values match ODS', known > 0 && deviations / cells < 0.01,
        `${known} rows, ${deviations} of ${cells} cells differ: ` +
        Object.entries(byColumn).map(([c, n]) => `${c} ${n}`).join(', '));
}

// Accordion groups: every row belongs to exactly one set and one talent/class group.
{
    const sets = new Set();
    const groups = new Set();
    let complete = true;
    ods.collection.rows.forEach((row) => {
        const names = FCT.model.groupNames(row);
        if (names.length !== 2 || !names[0] || !names[1]) complete = false;
        sets.add(names[0]);
        groups.add(names.join('|'));
    });
    check('Accordion groups', complete && sets.size > 1 && groups.size > sets.size,
        `${sets.size} sets, ${groups.size} talent/class groups`);
}

// Change log: entries survive the way into the log file and back.
{
    const log = FCT.changelog;
    const row = FCT.model.newRow({ Id: 'WTR001', Name: 'Rhinar, Reckless Rampage',
        Edition: 'Alpha' });
    log.add('Geändert', row, 'ST', '1', '2');
    log.add('Gelöscht', row, '', 'ST=2 "x"', '');
    const text = FCT.csv.stringify([log.HEADER].concat(log.toRecords(log.pending())));
    const records = FCT.csv.parse(text);
    log.markWritten();
    check('Change log round trip', records.length === 3 && records[1][4] === 'Alpha, EN' &&
        records[2][6] === 'ST=2 "x"' && log.pending().length === 0);
}

// Release dates: every set of the ODS import should have one (sets without are listed).
{
    const codes = new Set(ods.collection.rows.map((row) => FCT.model.setCode(row.Id)));
    const without = [...codes].filter((code) => code && !FCT.reference.setDate(code));
    const known = [...codes].filter((code) => FCT.reference.setDate(code));
    check('Set release dates', known.length > 0 && FCT.reference.setDate('WTR') === '2019-10-11',
        `${known.length} sets with date, without: ${without.join(' ')}`);
}

// Gap filling: no gap for a variant the collection has, "Micro Text Box" counts as
// "Extended Art", only sets of the collection, gaps stand in card number order.
{
    const collection = FCT.model.create();
    collection.rows.push(FCT.model.newRow({ Id: 'WTR001', Edition: 'Unlimited', Set: 'Mein WTR' }));
    collection.rows.push(FCT.model.newRow({ Id: 'WTR010', Edition: 'Unlimited', Set: 'Mein WTR' }));
    const mtb = ods.collection.rows.find((row) => row['Art Treatment'] === 'Micro Text Box');
    if (mtb) collection.rows.push(FCT.model.newRow(mtb));
    const all = FCT.model.withGaps(collection);
    const gaps = all.filter((row) => row._reference);
    const codes = new Set(collection.rows.map((row) => FCT.model.setCode(row.Id)));
    const foreign = gaps.filter((row) => !codes.has(FCT.model.setCode(row.Id)));
    const duplicate = gaps.filter((row) => row.Id === 'WTR001' && row.Edition === 'Unlimited');
    const mtbGap = mtb ? gaps.filter((row) => row.Id === mtb.Id &&
        row['Art Treatment'] === 'Extended Art' && !row.Edition) : [];
    const wtr = all.filter((row) => FCT.model.setCode(row.Id) === 'WTR').map((row) => row.Id);
    const sorted = wtr.every((id, i) => i === 0 || wtr[i - 1] <= id);
    const named = gaps.filter((row) => row.Id.startsWith('WTR')).every((row) =>
        row.Set === 'Mein WTR');
    check('Gap filling', gaps.length > 0 && !foreign.length && !duplicate.length &&
        !mtbGap.length && sorted && named,
        `${gaps.length} gaps, foreign ${foreign.length}, duplicate ${duplicate.length}, ` +
        `micro text box ${mtbGap.length}, sorted ${sorted}, set name kept ${named}`);
}

// Taking over reference data never changes the collection itself; the Fabrary export stays
// identical. A change of a protected column is rolled back.
{
    const collection = FCT.model.fromCsv(FCT.model.toCsv(ods.collection)).collection;
    const exportBefore = FCT.exportFabrary.exportFabrary(collection).text;
    const fingerprint = FCT.model.fingerprint(collection);
    const items = collection.rows.map((row) => ({ row, diffs: FCT.model.differences(row) }))
        .filter((item) => item.diffs.length);
    const count = FCT.model.takeOver(collection, items, (row, column, value) => {
        row[column] = value;
        return true;
    });
    const unchanged = FCT.model.fingerprint(collection) === fingerprint &&
        FCT.exportFabrary.exportFabrary(collection).text === exportBefore;

    // A faulty change that also touches a quantity is detected: an error is thrown and the
    // reference values are rolled back.
    const row = collection.rows.find((r) => FCT.model.differences(r).length === 0 &&
        FCT.reference.expected(r));
    const quantity = row.ST;
    row.Rarity = 'Test';
    let rolledBack = false;
    try {
        FCT.model.takeOver(collection, [{ row, diffs: FCT.model.differences(row) }],
            (r, column, value) => { r[column] = value; r.ST = '99'; return true; });
    } catch (error) {
        rolledBack = row.Rarity === 'Test';
    }
    row.ST = quantity;
    check('Take over keeps the collection', count > 0 && unchanged && rolledBack,
        `${count} values taken over, collection and export unchanged: ${unchanged}, ` +
        `faulty change detected and rolled back: ${rolledBack}`);
}

// Value lists of the edit mode contain every value found in the ODS import.
{
    const columns = ['Set', 'Edition', 'Rarity', 'Pitch', 'Art Treatment', 'Metatype',
        'Talent1', 'Talent2', 'Class1', 'Type1', 'Sub1'];
    const missing = [];
    columns.forEach((column) => {
        const list = FCT.model.choices(column, ods.collection.rows);
        ods.collection.rows.forEach((row) => {
            if (row[column] && !list.includes(row[column])) {
                missing.push(`${column}:${row[column]}`);
            }
        });
    });
    check('Value lists complete', missing.length === 0, [...new Set(missing)].join(', '));
}

// Wildcards in filters and search (2.0.3.0): * any text, ? one character, whole value; special
// characters of regular expressions are plain text.
{
    const match = (pattern, value) => FCT.util.wildcard(pattern)(FCT.util.fold(value));
    const ok = FCT.util.wildcard('Gravy') === null &&
        match('*Gravy*', 'Armory Deck - Gravy Bones') &&
        !match('Gravy*', 'Armory Deck - Gravy Bones') &&
        match('armory*', 'Armory Deck - Gravy Bones') &&
        match('W?R*', 'WTR001') && !match('W?R', 'WTR001') &&
        match('*(2H)*', 'Hammer (2H)') && !match('a.b*', 'axb') && match('a.b*', 'a.bc') &&
        match('*[x]*', 'a[x]b');
    check('Wildcard filters', ok);
}

// Taking whole sets (2.0.3.0): every printing variant once, empty quantities, real rows; sets
// of the collection are not offered.
{
    const collection = FCT.model.fromCsv(FCT.model.toCsv(ods.collection)).collection;
    const present = new Set(collection.rows.map((row) => FCT.model.setCode(row.Id)));
    const offered = FCT.model.missingSets(collection);
    const set = offered.find((s) => s.printings > 10);
    const rows = FCT.model.setRows(collection, [set.code]);
    const keys = new Set(rows.map((row) => FCT.model.variantKey(row.Id, row.Edition,
        row['Art Treatment'])));
    const ok = !offered.some((s) => present.has(s.code)) && rows.length === set.printings &&
        keys.size === rows.length &&
        rows.every((row) => FCT.model.setCode(row.Id) === set.code && !row._reference &&
            FCT.model.QUANTITIES.every((q) => row[q] === '') && row.Playset !== '');
    check('Take whole sets', ok, `${offered.length} sets offered, ${set.code}: ` +
        `${rows.length} rows`);
}

/*
 * Sets collected without rows (issue #18): all their printings show up as gaps at the end,
 * the CSV stays unchanged, the set is no longer offered. "Empty" rows are only exact
 * printing variants without quantity, note, local change or other own values.
 */
{
    const m = FCT.model;
    const collection = m.fromCsv(m.toCsv(ods.collection)).collection;
    const set = m.missingSets(collection).find((s) => s.printings > 10);
    const csvBefore = m.toCsv(collection);
    collection.collectedSets.push(set.code);
    const shown = m.withGaps(collection);
    const gaps = shown.filter((row) => row._reference && m.setCode(row.Id) === set.code);
    const atEnd = shown.slice(-gaps.length).every((row) => m.setCode(row.Id) === set.code);
    check('Sets collected without rows', gaps.length === set.printings && atEnd &&
        m.toCsv(collection) === csvBefore &&
        !m.missingSets(collection).some((s) => s.code === set.code) &&
        m.collectedCodes(collection).has(set.code),
        `${set.code}: ${gaps.length} gaps`);

    const empty = m.setRows(m.create(), [set.code])[0];
    const withQuantity = Object.assign({}, empty, { ST: '1' });
    const withZero = Object.assign({}, empty, { ST: '0' });
    const withNote = Object.assign({}, empty, { Note: 'x' });
    const withOverride = Object.assign({}, empty, { Overrides: 'Playset' });
    const language = Object.assign({}, empty, { Language: 'DE' });
    const unknown = Object.assign({}, empty, { Id: 'ZZZ999' });
    check('Empty rows', m.isEmptyRow(empty, collection) && m.isEmptyRow(withZero, collection) &&
        !m.isEmptyRow(withQuantity, collection) && !m.isEmptyRow(withNote, collection) &&
        !m.isEmptyRow(withOverride, collection) && !m.isEmptyRow(language, collection) &&
        !m.isEmptyRow(unknown, collection));
}

// Playset from the reference data (2.0.3.0): legendary cards 1, Evo equipment 3. A differing
// value of a file is kept as override; an empty one is filled in; nothing else changes.
{
    const legendary = FCT.DATA.cards.find((c) => c[4] === 'L');
    const playset = FCT.reference.playset;
    const rules = playset({ types: legendary[3], legendary: true }) === 1 &&
        playset('Mechanologist, Action, Equipment, Evo, Head') === 3 &&
        playset('Generic, Equipment, Chest') === 1 && playset('Warrior, Weapon, Sword, 1H') === 2 &&
        playset('Mystic, Resource, Chi') === 1 && playset('Generic, Action, Attack') === 3;

    const collection = FCT.model.create();
    const differs = FCT.model.newRow({ Id: 'WTR001', Name: 'Rhinar, Reckless Rampage',
        Playset: '3', ST: '1' });
    const empty = FCT.model.newRow({ Id: 'WTR001', Name: 'Rhinar, Reckless Rampage',
        Edition: 'Unlimited', Playset: '', ST: '2' });
    // All other reference values as expected, so that only the playset could differ.
    [differs, empty].forEach((row) => {
        const expected = FCT.reference.expected(row);
        Object.keys(expected).filter((key) => key !== 'Playset')
            .forEach((key) => { row[key] = expected[key]; });
    });
    collection.rows.push(differs, empty);
    const loaded = FCT.model.fromCsv(FCT.model.toCsv(collection)).collection;
    const [a, b] = loaded.rows;
    const transition = a.Playset === '3' && a.Overrides === 'Playset' && b.Playset === '1' &&
        b.Overrides === '' && a.ST === '1' && b.ST === '2' &&
        FCT.model.differences(a).length === 0;
    check('Playset from reference data', rules && transition,
        `rules ${rules}, kept as override / filled in ${transition}`);
}

// First In from the reference data (issue #51): the set with the earliest release date; on the
// same date the larger set; sets without a date last, and if no set has a date the own set.
// A differing value of a file is kept as override, an empty one is filled in, and a row that
// only carries the first set still counts as empty.
{
    const m = FCT.model;
    const first = (id) => FCT.reference.expected(m.newRow({ Id: id }))['First In'];
    const data = FCT.reference.data();
    const dateOf = (code) => FCT.reference.setDate(code);
    // Every printing: the first set is never younger than any dated set of the card.
    const earliest = data.printings.every((p) => {
        const codes = FCT.reference.cardSets(p[6]);
        const dated = codes.filter(dateOf);
        const head = codes[0];
        return !dated.length || dated.every((code) => dateOf(head) && dateOf(head) <= dateOf(code));
    });
    // Ghostly Visit: Monarch and the Chane deck share the date, the larger set wins; the
    // undated promo printing shows the same first set (a reprint).
    const rules = earliest && first('MON203') === 'MON' && first('CHN021') === 'MON' &&
        first('FAB038') === 'MON' && first('WTR001') === 'WTR';
    const undatedCard = data.printings.find((p) => !FCT.reference.cardSets(p[6]).some(dateOf));
    const undated = !undatedCard || first(undatedCard[0]) === undatedCard[1];

    const collection = m.create();
    const differs = m.newRow({ Id: 'CHN021', 'First In': 'CHN', ST: '1' });
    const empty = m.newRow({ Id: 'MON203', 'First In': '', ST: '2' });
    [differs, empty].forEach((row) => {
        const expected = FCT.reference.expected(row);
        Object.keys(expected).filter((key) => key !== 'First In')
            .forEach((key) => { row[key] = expected[key]; });
    });
    collection.rows.push(differs, empty);
    const loaded = m.fromCsv(m.toCsv(collection));
    const [a, b] = loaded.collection.rows;
    const transition = a['First In'] === 'CHN' && a.Overrides === 'First In' &&
        b['First In'] === 'MON' && b.Overrides === '' && m.differences(a).length === 0 &&
        m.columnKind('First In') === 'reference';

    const gaps = m.setRows(m.create(), ['CHN']);
    const filled = gaps.length > 0 && gaps.every((row) => row['First In'] !== '') &&
        gaps.find((row) => row.Id === 'CHN021')['First In'] === 'MON' &&
        m.isEmptyRow(gaps[0], collection);
    check('First In from reference data', rules && undated && transition && filled,
        `rules ${rules}, undated ${undated}, kept / filled in ${transition}, gaps ${filled}`);
}

// Exclusive cards (issue #54): a card whose printings all lie in one set; a reprint in
// another set ends it, the same card in another pitch is a card of its own.
{
    const m = FCT.model;
    const data = FCT.reference.data();
    const exclusive = (id) => FCT.reference.isExclusive(m.newRow({ Id: id }));
    const setsOf = new Map();
    data.printings.forEach((p) => {
        if (!setsOf.has(p[6])) setsOf.set(p[6], new Set());
        setsOf.get(p[6]).add(p[1]);
    });
    // Every printing variant, counted independently; the front face of a row decides.
    const all = data.printings.every((p) => {
        const row = m.newRow({ Id: p[0], Edition: p[2], 'Art Treatment': p[3] });
        const front = FCT.reference.printingFor(row);
        return FCT.reference.isExclusive(row) === (setsOf.get(front.cardId).size === 1);
    });
    // A card with exactly one printing; Ghostly Visit is in MON, CHN and FAB.
    const single = data.printings.find((p) => setsOf.get(p[6]).size === 1 &&
        FCT.reference.printings(p[0]).length === 1);
    const rules = exclusive(single[0]) && !exclusive('MON203') && !exclusive('CHN021') &&
        !exclusive('ZZZ999');
    const gaps = m.setRows(m.create(), [single[1]]);
    const shown = gaps.some((row) => row.Id === single[0] && FCT.reference.isExclusive(row));
    const saved = m.COLUMNS.every((c) => !/exclusiv/i.test(c));
    check('Exclusive cards', all && rules && shown && saved,
        `all printings ${all}, rules ${rules}, gap row ${shown}, not saved ${saved}`);
}

// Which cells can be edited (2.0.3.0): input always; a value that differs from the reference
// data also outside edit mode; everything in edit mode.
{
    const row = FCT.model.newRow({ Id: 'WTR001', Name: 'Rhinar, Reckless Rampage',
        Rarity: 'Majestic' });
    const expected = FCT.reference.expected(row);
    Object.keys(expected).forEach((key) => { row[key] = expected[key]; });
    const same = !FCT.model.isEditable(row, 'Rarity', false);
    row.Rarity = 'Common';
    const differs = FCT.model.isEditable(row, 'Rarity', false);
    const ok = same && differs && FCT.model.isEditable(row, 'ST', false) &&
        FCT.model.isEditable(row, 'Note', false) && !FCT.model.isEditable(row, 'Id', false) &&
        !FCT.model.isEditable(row, 'Playset', false) && FCT.model.isEditable(row, 'Id', true) &&
        !FCT.model.isEditable(row, 'Overrides', true);
    check('Editable cells', ok);
}

// Limits (2.0.3.0): the change log keeps the latest 1,000 entries (memory and file); the
// diagnosis log file is rotated at its size limit.
{
    const log = FCT.changelog;
    log.clear();
    const row = FCT.model.newRow({ Id: 'WTR001', Name: 'Rhinar' });
    for (let i = 0; i < 1100; i++) log.add('Geändert', row, 'ST', String(i), String(i + 1));
    const entries = log.entries();
    const file = log.fileRecords(Array.from({ length: 995 }, (_, i) => [String(i)]),
        Array.from({ length: 10 }, (_, i) => ['new' + i]));
    const back = log.fromRecords(log.toRecords(entries.slice(-2)));
    log.clear();
    const changeLog = entries.length === 1000 && entries[999].new === '1100' &&
        file.length === 1000 && file[999][0] === 'new9' && file[0][0] === '5' &&
        back.length === 2 && back[1].new === '1100';
    const limit = FCT.log.FILE_LIMIT;
    const rotation = !FCT.log.needsRotation(0, limit * 2) &&
        !FCT.log.needsRotation(limit - 100, 50) && FCT.log.needsRotation(limit - 100, 200);
    check('Log limits', changeLog && rotation, `change log ${changeLog}, rotation ${rotation}`);
}

// Column order (2.0.4.0): table and collection.csv share one order (Pitch right before
// Playset, Backside Name before Translated Name); files in the old order are read by name.
// Edition, Language and First In stand behind the quantities and before the note (issue #62).
{
    const cols = FCT.model.COLUMNS;
    const typeLine = FCT.model.TYPE_COLUMNS;
    const details = cols.slice(0, 3).join(',') === 'Set,Id,Rarity' &&
        cols.slice(cols.indexOf('GF'), cols.indexOf('Note') + 1).join(',') ===
            'GF,Edition,Language,First In,Note';
    const order = details && cols.indexOf('Pitch') === cols.indexOf('Playset') - 1 &&
        cols.indexOf('Backside Name') === cols.indexOf('Translated Name') - 1 &&
        cols.indexOf('Art Treatment') < cols.indexOf('Pitch') &&
        cols.slice(cols.indexOf('Metatype'), cols.indexOf('Sub3') + 1).join('|') ===
            typeLine.join('|') && cols.indexOf('Rarity') === cols.indexOf('Metatype') - 1;
    const oldHeader = ['Set', 'Edition', 'Id', 'First In', 'Rarity', 'Talent', 'Class1',
        'Class2', 'Type1', 'Type2', 'Sub1', 'Sub2', 'Sub3', 'Name', 'Translated Name',
        'Backside Name', 'Translated Backside Name', 'Pitch', 'Peculiarity', 'Art Treatment',
        'Playset', 'ST', 'RF', 'CF', 'GF', 'Note', 'Overrides'];
    const values = oldHeader.map((c) => (c === 'Id' ? 'WTR001' : c === 'Playset' ? '1'
        : c === 'ST' ? '2' : 'v-' + c));
    const loaded = FCT.model.fromCsv(FCT.csv.stringify([oldHeader, values]));
    const row = loaded.collection.rows[0];
    const readByName = row.Pitch === 'v-Pitch' && row['Translated Name'] === 'v-Translated Name' &&
        row.ST === '2' && row.Note === 'v-Note';
    const written = FCT.csv.parse(FCT.model.toCsv(loaded.collection))[0].join('|') ===
        cols.join('|');
    const noted = loaded.report.groups.some((g) => /Reihenfolge/.test(g.category));
    const appSource = fs.readFileSync(path.join(appRoot, 'app/app.js'), 'utf8');
    const noHaveThis = !appSource.includes('_haveThis');
    check('Column order', order && readByName && written && noted && noHaveThis,
        `order ${order}, old file read by name ${readByName}, written in new order ${written}, ` +
        `noted ${noted}, "Have (this)" removed ${noHaveThis}`);
}

// Reference data shown only (2.0.5.0): cost, power, defense, keywords, text, printed type
// line, formats a card is not legal in, artists of a printing.
{
    const row = (id) => FCT.model.newRow({ Id: id });
    const p = FCT.reference.printingFor(row('WTR001'));
    const horns = FCT.DATA.cards.find((c) => c[1] === 'Horns of the Despised');
    const fields = p && p.card.typeText === 'Brute Hero' && p.artists &&
        horns[7] === '1' && horns[8].includes('The Crowd Boos') &&
        /crowd boos/.test(horns[9]) && typeof p.card.notLegal === 'string';
    const numbers = FCT.DATA.cards.filter((c) => c[5] && !/^(\d+|X+\d*|\*)$/.test(c[5]));
    const widths = FCT.DATA.cards.every((c) => c.length === 12) &&
        FCT.DATA.printings.every((x) => x.length === 9);
    const unknown = FCT.reference.printingFor(row('XXX999')) === null;
    const notSaved = FCT.model.COLUMNS.every((c) => !/Cost|Power|Defense|Artist/.test(c));
    check('Reference data shown only', fields && !numbers.length && widths && unknown &&
        notSaved, `fields ${!!fields}, odd costs ${numbers.map((c) => c[5]).join(' ')}, ` +
        `record widths ${widths}, unknown id ${unknown}, not in collection.csv ${notSaved}`);
}

// Accordion sections (2.0.5.0): cut by card number, so that no section has a gap; a group
// coming back later is a section of its own; Fabled only = "Fabled"; decks and promos flat.
{
    const rows = FCT.model.referenceRows(FCT.model.create());
    const sec = FCT.model.sections(rows);
    const setOf = (code) => [...sec.rowsOf.keys()].find((name) =>
        sec.rowsOf.get(name).some((row) => FCT.model.setCode(row.Id) === code));
    const labels = (name) => [...new Set(sec.rowsOf.get(name).map((r) => sec.of.get(r)))]
        .map((s) => s.label);

    // Walking a set in card number order, a section once left never comes back.
    let gaps = 0;
    sec.rowsOf.forEach((list) => {
        const left = new Set();
        let current = null;
        list.slice().sort((a, b) => (a.Id < b.Id ? -1 : a.Id > b.Id ? 1 : 0)).forEach((row) => {
            const section = sec.of.get(row);
            if (section === current) return;
            if (left.has(section)) gaps++;
            if (current) left.add(current);
            current = section;
        });
    });
    const omn = setOf('OMN');
    const omnLabels = labels(omn);
    const twice = omnLabels.some((l, i) => omnLabels.indexOf(l) !== i);
    const fabled = sec.of.get(sec.rowsOf.get(omn).find((r) => r.Id === 'OMN000')).label ===
        'Fabled' && labels(setOf('WTR'))[0] === 'Fabled';
    // Flat sets (2.0.6.2): one section "Gemischt" with all rows.
    const mixed = [...sec.flat].every((set) => {
        const names = labels(set);
        return names.length === 1 && names[0] === 'Gemischt';
    });
    const flat = sec.flat.has(setOf('AAZ')) && sec.flat.has(setOf('FAB')) && mixed &&
        !['WTR', 'MON', 'OMN', 'ROS'].some((code) => sec.flat.has(setOf(code)));
    check('Accordion sections', !gaps && twice && fabled && flat,
        `${sec.rowsOf.size} sets, ${sec.flat.size} flat, gaps ${gaps}, a group twice in OMN ` +
        `${twice}, Fabled ${fabled}, decks/promos flat and main sets not ${flat}`);
}

// Card pictures (2.0.4.0): every known row of the old spreadsheet has a picture; URLs in the
// three sizes; full URLs of other hosts are kept.
{
    const t = FCT.referenceTransform;
    const known = ods.collection.rows.filter((row) => FCT.reference.printings(row.Id).length);
    const without = known.filter((row) => !FCT.reference.image(row, 'normal'));
    const sample = known.find((row) => row.Id === 'MON062' && row.Edition === 'Unlimited');
    const urls = t.imageUrl('U-MON062', 'normal').endsWith('/media/cards/normal/U-MON062.webp') &&
        t.imageUrl('X', 'large').includes('/large/X.webp') &&
        t.imageUrl('https://example.org/a.png', 'large') === 'https://example.org/a.png' &&
        t.imageUrl('', 'large') === '';
    const variant = !sample || FCT.reference.image(sample, 'large').includes('MON062');
    check('Card pictures', without.length <= 10 && urls && variant,
        `${known.length - without.length} of ${known.length} rows with picture, ` +
        `urls ${urls}, variant ${variant}`);
}

// Reprints in the large picture (#26): all printings of the card of a row, one per card
// number, edition and art treatment, the newest set first, the row's own printing among them.
{
    const r = FCT.reference;
    const rhinar = r.reprints({ Id: '1HP001', Edition: '', 'Art Treatment': '', Name: '' });
    const sets = new Set(rhinar.map((p) => p.setCode));
    const keys = rhinar.map((p) => [p.id, p.edition, p.art].join('|'));
    const dates = rhinar.map((p) => r.setDate(p.setCode));
    const newestFirst = dates.every((d, i) => !i || dates[i - 1] >= d);
    const same = rhinar.every((p) => p.cardId === rhinar[0].cardId);
    const unknown = r.reprints({ Id: 'XXX999', Edition: '', 'Art Treatment': '', Name: '' });
    check('Card reprints', sets.has('1HP') && sets.has('CRU') && sets.size > 2 &&
        keys.includes('1HP001||') && new Set(keys).size === keys.length && newestFirst &&
        same && !unknown.length,
        `1HP001: ${rhinar.length} printings in ${sets.size} sets, newest first ${newestFirst}`);
}

// Branch of the reference data (2.0.4.0): the source URL follows the chosen branch.
{
    const t = FCT.referenceTransform;
    const ok = t.sourceBase().endsWith('/flesh-and-blood-cards/develop/csvs/english/') &&
        t.sourceBase('usurp-the-shadow-throne')
            .endsWith('/flesh-and-blood-cards/usurp-the-shadow-throne/csvs/english/');
    check('Reference branch URL', ok);
}

// New row below another (2.0.6.0): the next card number keeps its digits; the values shared by
// all variants of that number are filled in, those that differ stay out.
{
    const m = FCT.model;
    const ids = m.nextId('MON062') === 'MON063' && m.nextId('WTR009') === 'WTR010' &&
        m.nextId('DYN999') === 'DYN1000' && m.nextId('ABC') === '' && m.nextId('') === '';
    const byId = new Map();
    FCT.reference.allPrintings().forEach((p) => {
        if (!byId.has(p[0])) byId.set(p[0], new Set());
        byId.get(p[0]).add(p[2] + '|' + p[3]);
    });
    const arts = (id) => new Set([...byId.get(id)].map((v) => v.split('|')[1]));
    const multi = [...byId.keys()].find((id) => arts(id).size > 1);
    const single = [...byId.keys()].find((id) => byId.get(id).size === 1 &&
        FCT.reference.printings(id).length === 1);
    const mv = m.commonValues(multi);
    const sv = m.commonValues(single);
    const want = FCT.reference.expected({ Id: single, Edition: '', 'Art Treatment': '',
        Name: '' });
    const multiOk = !!mv && !('Art Treatment' in mv) && !!mv.Name && !('Set' in mv);
    const singleOk = !!sv && sv.Name === want.Name && sv.Type1 === want.Type1 &&
        sv.Playset === want.Playset && 'Art Treatment' in sv;
    check('New row values', ids && multiOk && singleOk && m.commonValues('XXX999') === null,
        `next id ${ids}, ${multi}: ${multiOk}, ${single}: ${singleOk}`);
}

// Deleting a row (2.0.6.0): a variant of the reference data comes back as ○ at the same place
// (at its card number, in card number order as the accordion shows it; next to other rows of
// the same number it may change places), unless another row covers it. Checked on a sample of
// the rows of the old spreadsheet.
{
    const m = FCT.model;
    const key = (row) => m.variantKey(row.Id, row.Edition, row['Art Treatment']);
    const known = new Set(FCT.reference.allPrintings().map((p) => m.variantKey(p[0], p[2],
        p[3])));
    const rows = ods.collection.rows;
    const counts = new Map();
    rows.forEach((row) => counts.set(key(row), (counts.get(key(row)) || 0) + 1));
    const candidates = rows.filter((row) => row.Id && known.has(key(row)) &&
        counts.get(key(row)) === 1);
    const step = Math.max(1, Math.floor(candidates.length / 40));
    const lost = [];
    const moved = [];
    const collection = { rows: rows.slice(), extraColumns: ods.collection.extraColumns };
    const shown = (list) => list.map((r) => r.Id).sort().join('\n');
    const before = shown(m.withGaps(collection));
    for (let i = 0; i < candidates.length; i += step) {
        const row = candidates[i];
        const at = collection.rows.indexOf(row);
        collection.rows.splice(at, 1);
        const after = m.withGaps(collection);
        const gapAt = after.findIndex((r) => r._reference && key(r) === key(row));
        if (gapAt < 0) lost.push(row.Id);
        else if (shown(after) !== before) moved.push(row.Id);
        collection.rows.splice(at, 0, row);
    }
    check('Delete becomes a gap', !lost.length && !moved.length,
        `${Math.ceil(candidates.length / step)} rows, lost ${lost.join(' ') || '-'}, ` +
        `moved ${moved.join(' ') || '-'}`);
}

// Edition and language are two columns (issue #53). A file without the column "Language" is
// converted: a language in "Edition" moves over, every other row is English; quantities and
// the covered variants stay the same. Rows from the reference data are English, a row in
// another language never counts as empty, and the language is part of a row's identity.
{
    const m = FCT.model;
    const cols = m.COLUMNS;
    const order = cols.indexOf('Language') === cols.indexOf('Edition') + 1;
    const vocab = FCT.DATA.vocab;
    const lists = vocab.editions.join(',') === 'Alpha,First,Unlimited' &&
        vocab.languages[0] === 'EN' && vocab.languages.indexOf('DE') > 0;

    const oldHeader = cols.filter((c) => c !== 'Language');
    const record = (id, edition, st) => oldHeader.map((c) => (c === 'Id' ? id
        : c === 'Edition' ? edition : c === 'ST' ? st : ''));
    const oldText = FCT.csv.stringify([oldHeader, record('WTR001', 'Unlimited', '1'),
        record('MON203', 'EN', '2'), record('MON203', 'DE', '3'), record('MON204', '', '4')]);
    const loaded = m.fromCsv(oldText);
    const got = loaded.collection.rows.map((r) => [r.Edition, r.Language, r.ST].join('/'));
    const moved = got.join(' ') === 'Unlimited/EN/1 /EN/2 /DE/3 /EN/4';
    const reported = JSON.stringify(loaded.report.groups).includes('2 von 4');
    const noWarning = !JSON.stringify(loaded.report.groups).includes('Spalte fehlt');

    // Saved in the new format and read again: nothing changes, nothing is reported.
    const newText = m.toCsv(loaded.collection);
    const again = m.fromCsv(newText);
    const stable = FCT.csv.parse(newText)[0].join(',') === cols.join(',') &&
        m.toCsv(again.collection) === newText &&
        !JSON.stringify(again.report.groups).includes('Language');

    const [, en, de] = loaded.collection.rows;
    const identity = m.identityKey(en) !== m.identityKey(de) &&
        m.variantKey(en.Id, en.Edition, en['Art Treatment']) ===
            m.variantKey(de.Id, de.Edition, de['Art Treatment']);
    const gap = m.setRows(m.create(), ['MON'])[0];
    const german = Object.assign({}, gap, { Language: 'DE' });
    const rows = gap.Language === 'EN' && m.newRow({ Id: 'X' }).Language === 'EN' &&
        m.isEmptyRow(gap, loaded.collection) && !m.isEmptyRow(german, loaded.collection);
    const valid = m.validate(again.collection);
    const known = !JSON.stringify(valid.groups).includes('Unbekannter Wert');

    // The example spreadsheet keeps languages in "Edition": none may be left there.
    const odsClean = ods.collection.rows.every((r) => vocab.languages.indexOf(r.Edition) < 0 &&
        vocab.languages.indexOf(r.Language) >= 0);
    const odsLanguages = new Set(ods.collection.rows.map((r) => r.Language));
    check('Edition and language', order && lists && moved && reported && noWarning && stable &&
        identity && rows && known && odsClean,
        `order ${order}, old file ${moved}, reported ${reported}, stable ${stable}, ` +
        `identity ${identity}, rows ${rows}, ODS ${[...odsLanguages].join('/')}`);
}

// Variants not yet in the collection (2.0.6.3): foilings of exactly the variant; quantity cells
// of foilings that do not exist are locked outside edit mode; the columns of a variant.
{
    const m = FCT.model;
    const alpha = { Id: 'WTR000', Edition: 'Alpha', 'Art Treatment': '' };
    const foils = JSON.stringify(FCT.reference.foilings(alpha));
    const language = FCT.reference.foilings({ Id: 'WTR000', Edition: '', Language: 'DE',
        'Art Treatment': '' });
    const locked = !m.isEditable(alpha, 'ST', false) && m.isEditable(alpha, 'CF', false) &&
        m.isEditable(alpha, 'ST', true) && !m.noPrinting(alpha, 'Note');
    const columns = m.VARIANT_COLUMNS.join(',') === 'Id,Edition,Language,Art Treatment';
    check('Variants: foilings and columns', foils === '["CF"]' && language === null &&
        locked && columns, `WTR000 Alpha ${foils}, DE ${language}, locked ${locked}, ` +
        `variant columns ${m.VARIANT_COLUMNS.join(', ')}`);
}

/*
 * Combined columns (issue #69): the table shows the parts of a kind in one cell, the file
 * keeps one column per part. Words are joined by spaces and filtered one by one; the names
 * follow "Name (Art Treatment) (DE: Translated Name)" and "Backside Name (DE: ...)", every
 * part only if it is filled. No combined column is part of collection.csv.
 */
{
    const m = FCT.model;
    const by = (key) => m.COMBINED_COLUMNS.find((c) => c.key === key);
    const text = (key, row) => m.combinedValue(row, by(key));
    const row = m.newRow({ Id: 'XXX001', Talent1: 'Light', Talent2: 'Shadow', Class2: 'Runeblade',
        Type1: 'Action', Sub1: 'Demon', Sub3: 'Ally', Name: 'Front' });
    const words = text('_talent', row) === 'Light Shadow' && text('_class', row) === 'Runeblade' &&
        text('_type', row) === 'Action' && text('_subtype', row) === 'Demon Ally' &&
        text('_talent', m.newRow({})) === '' &&
        m.combinedParts(row, by('_subtype')).join('|') === 'Demon|Ally' &&
        m.combinedParts(m.newRow({}), by('_class')).length === 0;

    const full = Object.assign({}, row, { 'Art Treatment': 'Full Art', Language: 'DE',
        'Translated Name': 'Vorne', 'Backside Name': 'Back',
        'Translated Backside Name': 'Hinten' });
    const names = text('_name', row) === 'Front' && text('_backside', row) === '' &&
        text('_name', Object.assign({}, row, { 'Art Treatment': 'Full Art' })) ===
            'Front (Full Art)' &&
        text('_name', Object.assign({}, full, { 'Art Treatment': '' })) === 'Front (DE: Vorne)' &&
        text('_name', full) === 'Front (Full Art) (DE: Vorne)' &&
        text('_backside', full) === 'Back (DE: Hinten)' &&
        text('_backside', Object.assign({}, full, { 'Translated Backside Name': '' })) === 'Back';

    // Every part is a column of the file, in the order of the file; the file knows no
    // combined column and is written exactly as before.
    const parts = m.COMBINED_COLUMNS.every((c) => c.parts.every((p) => m.COLUMNS.includes(p)) &&
        !m.COLUMNS.includes(c.key));
    const once = m.toCsv(m.fromCsv(m.toCsv(ods.collection)).collection);
    const header = FCT.csv.parse(once.replace(/^﻿/, ''))[0];
    const file = header.join() === m.COLUMNS.concat(ods.collection.extraColumns).join() &&
        m.toCsv(m.fromCsv(once).collection) === once;

    // The longest subtype cell of the example has more than one part.
    const most = ods.collection.rows.reduce((max, r) =>
        Math.max(max, m.combinedParts(r, by('_subtype')).length), 0);
    check('Combined columns', words && names && parts && file && most > 1,
        `words ${words}, names ${names}, parts ${parts}, file ${file}, ` +
        `up to ${most} subtypes in one cell`);
}

// Version 2.0.7.0: a new collection is called "collection.csv" (or "collection-2.csv" if the
// folder has one); the picture column is only shown, never part of collection.csv; the setup
// assistant is loaded by the page.
{
    const m = FCT.model;
    const names = m.freeName('collection.csv', []) === 'collection.csv' &&
        m.freeName('collection.csv', ['Collection.CSV']) === 'collection-2.csv' &&
        m.freeName('collection.csv', ['collection.csv', 'collection-2.csv']) ===
            'collection-3.csv';
    const csv = m.toCsv(m.create()).split(/\r?\n/)[0];
    const picture = m.COLUMNS.indexOf('_image') < 0 && !/_image|Kartenbild/.test(csv);
    const page = fs.readFileSync(path.join(appRoot, 'index.html'), 'utf8');
    const loaded = /app\/onboarding\.js/.test(page) && /id="btn-onboarding"/.test(page);
    check('Names, picture column, assistant', names && picture && loaded,
        `names ${names}, picture only shown ${picture}, assistant loaded ${loaded}`);
}

// Firefox and other browsers without file access (2.0.6.0): downloads of collection, change
// log and diagnosis log always keep the same name; the word "Druck" is gone from the texts.
{
    const read = (file) => fs.readFileSync(path.join(appRoot, file), 'utf8');
    const storage = read('app/storage.js');
    const appendLog = storage.slice(storage.indexOf('function appendLog'),
        storage.indexOf('/*', storage.indexOf('function appendLog')));
    const fixed = !/timestamp/.test(appendLog) && !/timestamp/.test(read('app/diagnosis.js'));
    const texts = ['index.html', 'doku.html', 'README.md', 'app/app.js', 'app/tour.js',
        'app/grid.js', 'app/reference-update.js'];
    const wording = texts.filter((file) => /druck(?!en\b|t\b)/i.test(read(file).replace(
        /Ausdruck|drucken|gedruckt/gi, '')));
    check('Download names and wording', fixed && !wording.length,
        `fixed names ${fixed}, "Druck" in ${wording.join(', ') || '-'}`);
}

// Line length of hand-written source files (generated data files are exempt). Only source
// files count; a collection the user saved into the app folder is not checked.
{
    const sources = ['index.html', 'doku.html', 'app', 'tools', 'reference/vocab.js'];
    const files = sources.flatMap((entry) => {
        const full = path.join(appRoot, entry);
        return fs.statSync(full).isDirectory()
            ? fs.readdirSync(full).map((f) => path.join(full, f))
            : [full];
    }).filter((file) => /\.(js|mjs|html|css)$/.test(file));
    const long = [];
    files.forEach((file) => {
        fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
            if (line.length > 100) long.push(`${path.relative(appRoot, file)}:${i + 1}`);
        });
    });
    check('Line length <= 100', long.length === 0, long.join(', '));
}

// Optional: the shared transformation reproduces the shipped reference data.
if (sourceDir) {
    const t = FCT.referenceTransform;
    const read = (file) => fs.readFileSync(path.join(sourceDir, file), 'utf8');
    const data = t.transform({ set: read(t.FILES.set), setPrinting: read(t.FILES.setPrinting),
        card: read(t.FILES.card), printing: read(t.FILES.printing) });
    check('Reference transform = shipped data',
        JSON.stringify(data.printings) === JSON.stringify(FCT.DATA.printings) &&
        JSON.stringify(data.cards) === JSON.stringify(FCT.DATA.cards) &&
        JSON.stringify(data.sets) === JSON.stringify(FCT.DATA.sets));
}

console.log(failures ? `${failures} check(s) failed` : 'All checks passed');
process.exit(failures ? 1 : 0);
