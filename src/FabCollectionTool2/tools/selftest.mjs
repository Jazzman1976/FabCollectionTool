/*
 * selftest.mjs - maintenance tool: automated acceptance checks without a browser.
 *
 * Usage (from the tool folder):
 *   node tools/selftest.mjs <example.ods> <fabrary-export.csv> [folder with source csv files]
 *
 * The inputs are the user's own files; they are only read, never copied into the repository.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { loadApp, appRoot } from './load-app.mjs';

const [odsFile, fabraryFile, sourceDir] = process.argv.slice(2);
if (!odsFile || !fabraryFile) {
    console.error('Usage: node tools/selftest.mjs <example.ods> <fabrary-export.csv> ' +
        '[source folder]');
    process.exit(1);
}

// Load all logic scripts. Node.js 18 cannot inflate raw deflate data via
// DecompressionStream, so the ODS reader gets a zlib based replacement here.
const FCT = loadApp({
    withReference: true,
    extra: ['app/model.js', 'app/changelog.js', 'app/import-ods.js', 'app/import-fabrary.js',
        'app/export-fabrary.js']
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
    // Playsets as the reference data expects them (an empty one would be filled in on load).
    collection.rows.forEach((row) => { row.Playset = FCT.reference.expected(row).Playset; });
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

// Fabrary export after ODS import: same header, same rows, identity columns unchanged.
{
    const exported = FCT.exportFabrary.exportFabrary(ods.collection);
    const records = FCT.csv.parse(exported.text);
    const identityDiffs = records.filter((record, i) =>
        record.slice(0, 8).join('|') !== (exampleRecords[i] || []).slice(0, 8).join('|'));
    check('Fabrary export header', records[0].join() === exampleRecords[0].join());
    check('Fabrary export rows', records.length === exampleRecords.length,
        `${records.length} / ${exampleRecords.length}`);
    check('Fabrary export identity columns', identityDiffs.length === 0,
        `${identityDiffs.length} differences`);
}

// Round trip: Fabrary import -> export -> import gives the same collection.
{
    const again = FCT.importFabrary.importFabrary(
        FCT.exportFabrary.exportFabrary(imported.collection).text);
    check('Fabrary round trip',
        FCT.model.toCsv(again.collection) === FCT.model.toCsv(imported.collection));
}

// The skeleton must not contain quantities (it only has the eight identity columns).
{
    const bad = FCT.DATA.fabrarySkeleton.filter((row) => row.length !== 8);
    check('Skeleton without quantities', bad.length === 0,
        `${FCT.DATA.fabrarySkeleton.length} rows, ${bad.length} with extra columns`);
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
    check('Change log round trip', records.length === 3 && records[1][4] === 'Alpha' &&
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
{
    const cols = FCT.model.COLUMNS;
    const typeLine = FCT.model.TYPE_COLUMNS;
    const order = cols.indexOf('Pitch') === cols.indexOf('Playset') - 1 &&
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

// Variants not yet in the collection (2.0.6.3): foilings of exactly the variant; quantity cells
// of foilings that do not exist are locked outside edit mode; the columns of a variant.
{
    const m = FCT.model;
    const alpha = { Id: 'WTR000', Edition: 'Alpha', 'Art Treatment': '' };
    const foils = JSON.stringify(FCT.reference.foilings(alpha));
    const language = FCT.reference.foilings({ Id: 'WTR000', Edition: 'DE',
        'Art Treatment': '' });
    const locked = !m.isEditable(alpha, 'ST', false) && m.isEditable(alpha, 'CF', false) &&
        m.isEditable(alpha, 'ST', true) && !m.noPrinting(alpha, 'Note');
    const columns = m.VARIANT_COLUMNS.join(',') === 'Id,Edition,Art Treatment';
    check('Variants: foilings and columns', foils === '["CF"]' && language === null &&
        locked && columns, `WTR000 Alpha ${foils}, DE ${language}, locked ${locked}, ` +
        `variant columns ${m.VARIANT_COLUMNS.join(', ')}`);
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
