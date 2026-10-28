/*
 * build-cardmarket-map.mjs - maintenance tool, not needed by users of the app.
 * Generates the shipped Cardmarket mapping reference/cardmarket-map.js (issue #93): which
 * Cardmarket product belongs to which printing (card number, edition, foiling, art
 * treatment). Sources are only Cardmarket's public product catalogue and price guide and the
 * reference data; the rules are in app/cardmarket-map.js. Entries checked or set by a person
 * stay; corrections made in the app are taken over with --local.
 *
 * Besides the shipped reference data (default branch of the card data set) the branches of
 * the card data set are loaded, which the user can choose in the app (issue #103): new sets
 * appear there long before they reach the default branch. A set is taken from the branch
 * with the most printings of it, if that is more than the shipped data have.
 *
 * Usage:
 *   node tools/build-cardmarket-map.mjs [--local <cardmarket-prices.json>]
 *       [--catalogue <products_singles_16.json>] [--prices <price_guide_16.json>]
 *       [--branches <name,name> | --no-branches]
 * Without --catalogue and --prices both files are downloaded from Cardmarket. They are only
 * read, never stored in the repository. Without --branches all branches except the default
 * branch and "main" are loaded; --no-branches uses the shipped reference data alone.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadApp, appRoot } from './load-app.mjs';

const CATALOGUE_URL = 'https://downloads.s3.cardmarket.com/productCatalog/productList/' +
    'products_singles_16.json';
const PRICES_URL = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/' +
    'price_guide_16.json';
const TARGET = path.join(appRoot, 'reference', 'cardmarket-map.js');

// Read the command line: optional files instead of the downloads, and local corrections.
const args = process.argv.slice(2);
function option(name) {
    const at = args.indexOf(name);
    if (at < 0) return '';
    if (!args[at + 1]) {
        console.error(`${name} needs a file`);
        process.exit(1);
    }
    return args[at + 1];
}
const localFile = option('--local');
const catalogueFile = option('--catalogue');
const pricesFile = option('--prices');
const branchList = option('--branches');
const noBranches = args.includes('--no-branches');

// Reads a JSON file given on the command line, or downloads it.
async function readJson(file, url) {
    if (file) return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
}

// Loads one URL as text.
async function readText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.text();
}

// Loads one branch of the card data set and transforms it like the app does.
async function readBranch(transform, name) {
    const base = transform.sourceBase(name);
    const files = transform.FILES;
    const [set, setPrinting, card, printing] = await Promise.all([files.set,
        files.setPrinting, files.card, files.printing].map((file) => readText(base + file)));
    const data = transform.transform({ set, setPrinting, card, printing });
    let commit = '';
    try {
        const response = await fetch(`https://api.github.com/repos/${transform.SOURCE_REPO}` +
            `/commits/${encodeURIComponent(name)}`);
        if (response.ok) commit = (await response.json()).sha.slice(0, 7);
    } catch (error) {
        // The commit is only shown in the report.
    }
    return { name, commit, printings: data.printings, cards: data.cards };
}

// Branches of the card data set to load: the given ones, or all except the default branch
// and "main".
async function branchNames(transform) {
    if (noBranches) return [];
    if (branchList) return branchList.split(',').map((b) => b.trim()).filter(Boolean);
    const response = await fetch(`https://api.github.com/repos/${transform.SOURCE_REPO}` +
        '/branches?per_page=100');
    if (!response.ok) throw new Error(`Branches: HTTP ${response.status}`);
    return (await response.json()).map((b) => b.name)
        .filter((b) => b !== transform.SOURCE_BRANCH && b !== 'main');
}

// Load the app with the reference data and the mapping shipped so far (if there is one).
const extra = ['app/cardmarket-map.js'];
if (fs.existsSync(TARGET)) extra.push('reference/cardmarket-map.js');
const FCT = loadApp({ withReference: true, extra: extra });
const cm = FCT.cardmarketMap;

// Read the sources.
const catalogue = await readJson(catalogueFile, CATALOGUE_URL);
const guide = await readJson(pricesFile, PRICES_URL);
if (!Array.isArray(catalogue.products) || !Array.isArray(guide.priceGuides)) {
    console.error('Catalogue or price guide in an unexpected format');
    process.exit(1);
}
const prices = new Map(guide.priceGuides.map((entry) => [entry.idProduct, entry]));

// Reference data: the shipped data plus the sets of the branches that have more printings.
const branches = [];
for (const name of await branchNames(FCT.referenceTransform)) {
    try {
        branches.push(await readBranch(FCT.referenceTransform, name));
    } catch (error) {
        console.error(`Branch ${name} not loaded: ${error.message}`);
    }
}
const reference = cm.mergeReference({ printings: FCT.DATA.printings, cards: FCT.DATA.cards },
    branches);
const cards = new Map(reference.cards.map((card) => [card[0], { name: card[1],
    pitch: card[2] }]));
let corrections = {};
if (localFile) {
    const local = JSON.parse(fs.readFileSync(localFile, 'utf8').replace(/^﻿/, ''));
    corrections = (local && local.corrections) || {};
}
console.log(`Catalogue: ${catalogue.createdAt}, ${catalogue.products.length} products`);
console.log(`Price guide: ${guide.createdAt}, ${guide.priceGuides.length} prices`);
if (localFile) console.log(`Local corrections: ${Object.keys(corrections).length}`);
const fromBranch = Object.keys(reference.fromBranch).sort()
    .map((code) => `${code} from ${reference.fromBranch[code]}`);
console.log(`Branches: ${branches.map((b) => `${b.name} ${b.commit}`.trim()).join(', ') ||
    '-'}; sets taken from them: ${fromBranch.join(', ') || '-'}`);

// Build the mapping.
const previous = FCT.DATA.cardmarketMap || cm.empty();
const { map, report } = cm.build({
    products: catalogue.products,
    prices: prices,
    printings: reference.printings,
    cards: cards,
    previous: previous,
    corrections: corrections
});
const problems = cm.problems(map);
if (problems.length) {
    problems.slice(0, 20).forEach((p) => console.error(`  ${p}`));
    console.error('The mapping has problems; nothing written.');
    process.exit(1);
}

// Write the file with one entry per line, so that Git diffs stay readable. Expansion ids are
// sorted as numbers.
const expansionIds = Object.keys(map.expansions).sort((a, b) => Number(a) - Number(b));
const lines = [
    '/* Cardmarket mapping: expansions: { Cardmarket expansion id: [set code, edition, ' +
        'status] },',
    '   printings: { key: [Cardmarket product id, status] },',
    '   key: set number | edition | foiling | art treatment (as in reference/printings.js) */',
    '/* Generated by tools/build-cardmarket-map.mjs - do not edit by hand. */',
    `/* Catalogue: ${catalogue.createdAt}, price guide: ${guide.createdAt} */`,
    `/* Sets from branches of the card data set: ${fromBranch.join(', ') || '-'} */`,
    'FCT.DATA.cardmarketMap = {',
    `    version: ${cm.VERSION},`,
    '    expansions: {',
    expansionIds.map((id) => `        ${JSON.stringify(id)}: ` +
        JSON.stringify(map.expansions[id])).join(',\n'),
    '    },',
    '    printings: {',
    Object.keys(map.printings).sort().map((k) => `        ${JSON.stringify(k)}: ` +
        JSON.stringify(map.printings[k])).join(',\n'),
    '    }',
    '};',
    ''
];
fs.writeFileSync(TARGET, lines.join('\n'), 'utf8');

// Coverage per set: printings (key per foiling) of the reference data that are sure,
// estimated or open.
const bySet = new Map();
reference.printings.forEach((p) => {
    String(p[5] || '').split('').forEach((letter) => {
        const k = cm.key(p[0], p[2], letter, p[3]);
        if (!bySet.has(p[1])) bySet.set(p[1], new Map());
        bySet.get(p[1]).set(k, map.printings[k]);
    });
});
const total = { sure: 0, price: 0, open: 0 };
const rows = [];
bySet.forEach((keys, code) => {
    const count = { sure: 0, price: 0, open: 0 };
    keys.forEach((entry) => {
        const kind = !entry ? 'open' : entry[1] === 'price' ? 'price' : 'sure';
        count[kind]++;
        total[kind]++;
    });
    rows.push({ code, ...count, all: keys.size });
});
console.log(`cardmarket-map.js: ${expansionIds.length} expansions, ` +
    `${Object.keys(map.printings).length} printings`);
const percent = (n, all) => `${Math.round(100 * n / all)} %`;
const all = total.sure + total.price + total.open;
console.log(`Printings of the reference data: ${all}, sure ${total.sure} ` +
    `(${percent(total.sure, all)}), estimated ${total.price} (${percent(total.price, all)}), ` +
    `open ${total.open} (${percent(total.open, all)})`);
console.log('Per set (sure / estimated / open):');
rows.sort((a, b) => a.code < b.code ? -1 : 1).forEach((r) => console.log(
    `  ${r.code.padEnd(4)} ${String(r.sure).padStart(4)} / ${String(r.price).padStart(4)} / ` +
    `${String(r.open).padStart(4)}  (${percent(r.sure + r.price, r.all)} mapped)`));

// Findings of the build, a few examples each.
report.groups.forEach((g) => {
    console.log(`${g.level.toUpperCase()} ${g.category}: ${g.count}`);
    g.examples.slice(0, 8).forEach((e) => console.log(`    ${e}`));
});
