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

// Type line split into the spreadsheet columns (2.0.1.0).
{
    const split = FCT.reference.splitTypes;
    const same = (a, b) => JSON.stringify(a) === JSON.stringify({ Talent: '', Class1: '',
        Class2: '', Type1: '', Type2: '', Sub1: '', Sub2: '', Sub3: '', ...b });
    check('Type line split',
        same(split('Light, Illusionist, Action, Attack'),
            { Talent: 'Light', Class1: 'Illusionist', Type1: 'Action', Sub1: 'Attack' }) &&
        same(split('Generic, Equipment, Chest'),
            { Class1: 'Generic', Type1: 'Equipment', Sub1: 'Chest' }) &&
        same(split('Ice, Earth, Guardian, Weapon, Hammer, 2H'), { Talent: 'Ice Earth',
            Class1: 'Guardian', Type1: 'Weapon', Sub1: 'Hammer', Sub2: '(2H)' }));
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
    const columns = ['Set', 'Edition', 'Rarity', 'Pitch', 'Art Treatment', 'Talent', 'Class1',
        'Type1', 'Sub1'];
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

// Line length of hand-written source files (generated data files are exempt). Only source
// files count; a collection the user saved into the app folder is not checked.
{
    const files = ['index.html', 'app', 'tools', 'reference/vocab.js'].flatMap((entry) => {
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
