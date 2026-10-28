/*
 * cardmarket-map.js - maps the printings of the reference data to Cardmarket products
 * (issue #93).
 *
 * Cardmarket publishes a product catalogue and a price guide for Flesh and Blood, but its
 * products carry only a name and an expansion, no card number and no variant. The mapping
 * is therefore built from these public files and the reference data alone:
 *   { version: 1,
 *     expansions: { <Cardmarket expansion id>: [set code, edition, status] },
 *     printings: { <key>: [Cardmarket product id, status] } }
 * key: card number | edition | foiling | art treatment, written as in reference/printings.js
 * (foiling: '' = standard, 'Rainbow', 'Cold', 'Gold'), e.g. "WTR005|Unlimited|Rainbow|".
 * Status of a printing: 'unique' (the only product that fits), 'price' (several products of
 * one card told apart by their price), 'confirmed' (checked by a person), 'manual' (set by a
 * person). Status of an expansion: 'auto', 'price' (edition told by the price), 'manual'.
 *
 * The app ships one mapping (FCT.DATA.cardmarketMap, built by tools/build-cardmarket-map.mjs);
 * corrections made in the app are kept locally and taken over when the mapping is rebuilt.
 */
FCT.cardmarketMap = (function () {
    var VERSION = 1;
    var STATUSES = ['unique', 'price', 'confirmed', 'manual'];
    var EXPANSION_STATUSES = ['auto', 'price', 'manual'];
    // Entries checked or set by a person; the build never replaces them.
    var KEPT = ['confirmed', 'manual'];
    // Cheapest first: the order in which the foilings of one card are expected to cost more.
    var FOILING_ORDER = 'SRCG';
    var FOILING_COLUMNS = { ST: 'S', RF: 'R', CF: 'C', GF: 'G' };
    // Share of names an expansion needs in common with a set, and share of cards that must
    // be cheaper in one of two expansions of a set to tell its editions apart.
    var MIN_SHARE = 0.8;
    // Pitch at the end of a Cardmarket name, including typos found in the catalogue.
    var PITCH = /\s*\((Red|Yel+ow|Blue|Bleu)\)\s*$/i;
    var PITCH_NAMES = { r: 'Red', y: 'Yellow', b: 'Blue' };
    var PRODUCT_URL = 'https://www.cardmarket.com/en/FleshAndBlood/Products?idProduct=';

    function has(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    function empty() {
        return { version: VERSION, expansions: {}, printings: {} };
    }

    // The mapping shipped with the app.
    function shipped() {
        return FCT.DATA.cardmarketMap || empty();
    }

    // Name of a foiling letter as in the key ('' for standard).
    function foilingName(letter) {
        var codes = FCT.DATA.vocab.foilingCodes;
        return has(codes, letter) ? codes[letter] : letter;
    }

    // Key of a printing in one foiling (letter 'S', 'R', 'C' or 'G').
    function key(number, edition, letter, art) {
        return [number, edition || '', foilingName(letter), art || ''].join('|');
    }

    // Key of a row in the foiling of a quantity column ('ST', 'RF', 'CF', 'GF').
    function rowKey(row, column) {
        return key(row.Id, row.Edition, FOILING_COLUMNS[column], row['Art Treatment']);
    }

    // Link to the product page on Cardmarket.
    function productUrl(id) {
        return PRODUCT_URL + encodeURIComponent(id);
    }

    function isSure(status) {
        return status === 'unique' || KEPT.indexOf(status) >= 0;
    }

    // Price of a price guide entry: the 30 days average, else the trend, else the lowest.
    function priceOf(entry) {
        if (!entry) return null;
        var bases = ['avg30', 'trend', 'low'];
        for (var i = 0; i < bases.length; i++) {
            var value = entry[bases[i]];
            if (typeof value === 'number' && value > 0) return { value: value, basis: bases[i] };
        }
        return null;
    }

    // Name and pitch of a Cardmarket product name, e.g. "Head Jab (Blue)".
    function parseName(name) {
        var text = String(name == null ? '' : name).trim();
        var match = text.match(PITCH);
        if (!match) return { name: text, pitch: '' };
        return { name: text.slice(0, match.index).trim(),
            pitch: PITCH_NAMES[match[1].charAt(0).toLowerCase()] };
    }

    /*
     * Folded names under which a Cardmarket name can be found in the reference data: the
     * name itself, the front of "front // back", and the exceptions of
     * vocab.cardmarketNames read backwards.
     */
    function nameKeys(name) {
        var fold = FCT.util.fold;
        var keys = [fold(name)];
        var front = name.split(' // ')[0];
        if (front !== name) keys.push(fold(front));
        var names = FCT.DATA.vocab.cardmarketNames || {};
        Object.keys(names).forEach(function (ours) {
            if (fold(names[ours]) === fold(name)) keys.push(fold(ours.split(' // ')[0]));
        });
        return keys.filter(function (k, i) { return keys.indexOf(k) === i; });
    }

    /*
     * Variants of the reference data: per set code the names of its cards and per set,
     * edition and folded card name the variants { key, number, art, letter, pitch }.
     * printings are rows of reference/printings.js, cards a Map card id -> { name, pitch }.
     */
    function indexReference(printings, cards) {
        var fold = FCT.util.fold;
        var setNames = new Map();
        var variants = new Map();
        var editions = new Map();
        printings.forEach(function (p) {
            var card = cards.get(p[6]);
            if (!card) return;
            var name = fold(card.name);
            if (!setNames.has(p[1])) setNames.set(p[1], new Set());
            setNames.get(p[1]).add(name);
            if (!editions.has(p[1])) editions.set(p[1], new Set());
            editions.get(p[1]).add(p[2]);
            var group = p[1] + '|' + p[2] + '|' + name;
            if (!variants.has(group)) variants.set(group, new Map());
            String(p[5] || '').split('').forEach(function (letter) {
                var k = key(p[0], p[2], letter, p[3]);
                variants.get(group).set(k, { key: k, number: p[0], art: p[3], letter: letter,
                    pitch: card.pitch || '' });
            });
        });
        return { setNames: setNames, variants: variants, editions: editions };
    }

    // Products of the catalogue grouped by expansion, each with its parsed name.
    function byExpansion(products) {
        var result = new Map();
        products.forEach(function (product) {
            var parsed = parseName(product.name);
            var entry = { id: product.idProduct, name: parsed.name, pitch: parsed.pitch,
                keys: nameKeys(parsed.name) };
            if (!result.has(product.idExpansion)) result.set(product.idExpansion, []);
            result.get(product.idExpansion).push(entry);
        });
        return result;
    }

    // Lowest price per folded name of the products of one expansion.
    function cheapestByName(products, prices) {
        var result = new Map();
        products.forEach(function (product) {
            var price = priceOf(prices.get(product.id));
            if (!price) return;
            var name = product.keys[0] + '|' + product.pitch;
            if (!result.has(name) || price.value < result.get(name)) {
                result.set(name, price.value);
            }
        });
        return result;
    }

    /*
     * Step 1: Cardmarket expansion -> [set code, edition, status]. An expansion belongs to
     * the set most similar to it by names (names in common / names in either), if at least
     * MIN_SHARE of its names are in that set and no other set is as similar. Similarity
     * instead of the plain count lets a deck find its own small set rather than a large set
     * that reprints the same cards. Two expansions of a set with the editions Alpha or First
     * and Unlimited are told apart by price: Unlimited has the clearly cheaper cards (decided
     * by Elmar, issue #93). Entries set by hand ('manual') stay as they are.
     */
    function matchExpansions(groups, reference, prices, previous, report) {
        var result = {};
        var bySet = new Map();
        groups.forEach(function (products, expansion) {
            var id = String(expansion);
            var kept = previous.expansions[id];
            if (kept && kept[2] === 'manual') {
                result[id] = kept.slice();
                return;
            }
            var own = new Map();
            products.forEach(function (product) { own.set(product.keys[0], product.keys); });
            var counts = [];
            reference.setNames.forEach(function (names, code) {
                var hits = 0;
                own.forEach(function (keys) {
                    if (keys.some(function (k) { return names.has(k); })) hits++;
                });
                if (hits) {
                    counts.push({ code: code, hits: hits,
                        similarity: hits / (own.size + names.size - hits) });
                }
            });
            counts.sort(function (a, b) { return b.similarity - a.similarity; });
            var best = counts[0];
            var clear = best && best.hits >= MIN_SHARE * own.size &&
                (!counts[1] || counts[1].similarity < best.similarity);
            if (!clear) {
                report.add('info', 'Expansion keinem Set zuzuordnen', id + ' (' +
                    products.length + ' Produkte, z. B. ' + products[0].name + ')');
                return;
            }
            if (!bySet.has(best.code)) bySet.set(best.code, []);
            bySet.get(best.code).push({ id: id, hits: best.hits, products: products });
        });

        // Editions per set: one edition for the expansion with most hits, or Alpha/First and
        // Unlimited told apart by price.
        bySet.forEach(function (expansions, code) {
            var taken = Object.keys(result).filter(function (id) {
                return result[id][0] === code;
            }).map(function (id) { return result[id][1]; });
            var editions = Array.from(reference.editions.get(code) || []).filter(function (e) {
                return taken.indexOf(e) < 0;
            });
            expansions.sort(function (a, b) { return b.hits - a.hits; });
            if (editions.length === 1) {
                result[expansions[0].id] = [code, editions[0], 'auto'];
                expansions.slice(1).forEach(function (e) {
                    report.add('info', 'Weitere Expansion zum selben Set', e.id + ' → ' + code);
                });
                return;
            }
            var collector = editions.filter(function (e) { return e !== 'Unlimited'; });
            if (editions.length !== 2 || collector.length !== 1 || expansions.length !== 2) {
                report.add('warn', 'Edition der Expansions offen', code + ': ' +
                    expansions.map(function (e) { return e.id; }).join(', ') +
                    ' / Editionen ' + editions.join(', '));
                return;
            }
            var a = cheapestByName(expansions[0].products, prices);
            var b = cheapestByName(expansions[1].products, prices);
            var aCheaper = 0;
            var bCheaper = 0;
            a.forEach(function (price, name) {
                if (!b.has(name) || b.get(name) === price) return;
                if (price < b.get(name)) aCheaper++;
                else bCheaper++;
            });
            var compared = aCheaper + bCheaper;
            var share = compared ? Math.max(aCheaper, bCheaper) / compared : 0;
            if (share < MIN_SHARE) {
                report.add('warn', 'Edition der Expansions offen', code + ': ' +
                    expansions[0].id + ' billiger bei ' + aCheaper + ', ' + expansions[1].id +
                    ' bei ' + bCheaper + ' Karten');
                return;
            }
            var unlimited = aCheaper > bCheaper ? 0 : 1;
            result[expansions[unlimited].id] = [code, 'Unlimited', 'price'];
            result[expansions[1 - unlimited].id] = [code, collector[0], 'price'];
            report.add('info', 'Edition über den Preis', code + ': ' +
                expansions[unlimited].id + ' = Unlimited, ' + expansions[1 - unlimited].id +
                ' = ' + collector[0] + ' (' + Math.round(share * 100) + ' % von ' + compared +
                ' Karten)');
        });
        return result;
    }

    /*
     * Step 2 and 3: the products of one expansion with the same name and pitch are matched
     * to the variants of that card in the set and edition. One product and one variant give
     * 'unique'. As many products as variants, all of one card number and each in another
     * foiling, give 'price': the products sorted by price, the variants by foiling (standard
     * < Rainbow < Cold < Gold). The art treatment may differ with the foiling (e.g. Rainbow
     * Foils with Alternate Text in early sets, Cold Foils with Extended Art), because the
     * foiling still names each variant once. Anything else stays open.
     */
    function matchPrintings(groups, expansions, reference, prices, report) {
        var result = {};
        Object.keys(expansions).forEach(function (id) {
            var set = expansions[id][0];
            var edition = expansions[id][1];
            var byName = new Map();
            (groups.get(Number(id)) || groups.get(id) || []).forEach(function (product) {
                var name = product.keys.join('/') + '|' + product.pitch;
                if (!byName.has(name)) byName.set(name, []);
                byName.get(name).push(product);
            });
            byName.forEach(function (products) {
                var first = products[0];
                var found = new Map();
                first.keys.forEach(function (k) {
                    var group = reference.variants.get(set + '|' + edition + '|' + k);
                    if (!group) return;
                    group.forEach(function (v) {
                        if (!first.pitch || v.pitch === first.pitch) found.set(v.key, v);
                    });
                });
                var variants = Array.from(found.values());
                var label = set + ' ' + (edition || '-') + ': ' + first.name +
                    (first.pitch ? ' (' + first.pitch + ')' : '');
                var pitches = new Set(variants.map(function (v) { return v.pitch; }));
                if (!variants.length) {
                    report.add('info', 'Produkt ohne Druck in den Stammdaten', label);
                    return;
                }
                if (pitches.size > 1) {
                    report.add('warn', 'Offen: Pitch fehlt im Cardmarket-Namen', label);
                    return;
                }
                if (products.length === 1 && variants.length === 1) {
                    result[variants[0].key] = [first.id, 'unique'];
                    return;
                }
                var sameCard = variants.every(function (v) {
                    return v.number === variants[0].number;
                });
                var letters = new Set(variants.map(function (v) { return v.letter; }));
                var priced = products.map(function (p) {
                    return { id: p.id, price: priceOf(prices.get(p.id)) };
                });
                if (products.length !== variants.length) {
                    report.add('warn', 'Offen: Anzahl Produkte und Varianten verschieden',
                        label + ' (' + products.length + ' / ' + variants.length + ')');
                } else if (!sameCard || letters.size !== variants.length) {
                    report.add('warn', 'Offen: Varianten nicht nur im Foiling verschieden',
                        label + ' (' + variants.map(function (v) {
                            return v.key;
                        }).join(', ') + ')');
                } else if (priced.some(function (p) { return !p.price; })) {
                    report.add('warn', 'Offen: Produkt ohne Preis', label);
                } else {
                    priced.sort(function (a, b) { return a.price.value - b.price.value; });
                    variants.sort(function (a, b) {
                        return FOILING_ORDER.indexOf(a.letter) - FOILING_ORDER.indexOf(b.letter);
                    });
                    variants.forEach(function (v, i) { result[v.key] = [priced[i].id, 'price']; });
                }
            });
        });
        return result;
    }

    /*
     * Step 4: puts the mapping together. Entries of the previous mapping checked or set by a
     * person stay; local corrections ({ key: [id, 'confirmed' | 'manual'] }) come next, but
     * do not replace a different kept entry (reported as contradiction); automatic entries
     * fill the rest. A product belongs to one key only: automatic entries that use a product
     * already taken are dropped.
     */
    function merge(previous, corrections, automatic, report) {
        var result = {};
        var owner = new Map();
        function take(k, entry) {
            result[k] = [entry[0], entry[1]];
            owner.set(entry[0], k);
        }
        Object.keys(previous.printings).forEach(function (k) {
            var entry = previous.printings[k];
            if (KEPT.indexOf(entry[1]) >= 0) take(k, entry);
        });
        Object.keys(corrections || {}).forEach(function (k) {
            var entry = corrections[k];
            if (!Array.isArray(entry) || KEPT.indexOf(entry[1]) < 0) return;
            var known = result[k];
            if (known && known[0] !== entry[0]) {
                report.add('warn', 'Widerspruch: Korrektur weicht von geprüftem Eintrag ab',
                    k + ': ' + entry[0] + ' statt ' + known[0]);
                return;
            }
            if (owner.has(entry[0]) && owner.get(entry[0]) !== k) {
                report.add('warn', 'Widerspruch: Produkt schon anders geprüft',
                    k + ': ' + entry[0] + ' gehört zu ' + owner.get(entry[0]));
                return;
            }
            if (!known || known[1] !== entry[1]) {
                report.add('info', 'Korrektur übernommen', k + ': ' + entry[0] + ' (' +
                    entry[1] + ')');
            }
            take(k, entry);
        });
        var counts = new Map();
        Object.keys(automatic).forEach(function (k) {
            var id = automatic[k][0];
            counts.set(id, (counts.get(id) || 0) + 1);
        });
        Object.keys(automatic).forEach(function (k) {
            var entry = automatic[k];
            if (has(result, k)) return;
            if (owner.has(entry[0]) || counts.get(entry[0]) > 1) {
                report.add('warn', 'Produkt mehrfach zugeordnet, Eintrag entfällt',
                    k + ': ' + entry[0]);
                return;
            }
            take(k, entry);
        });
        return result;
    }

    /*
     * Builds the mapping. input: products (catalogue entries { idProduct, name, idExpansion }),
     * prices (Map product id -> price guide entry), printings (rows of reference/printings.js),
     * cards (Map card id -> { name, pitch }), previous (mapping so far), corrections (local).
     * Returns { map, report }.
     */
    function build(input) {
        var report = FCT.createReport('Cardmarket-Zuordnung');
        var previous = normalize(input.previous);
        var reference = indexReference(input.printings, input.cards);
        var groups = byExpansion(input.products);
        var expansions = matchExpansions(groups, reference, input.prices, previous, report);
        var automatic = matchPrintings(groups, expansions, reference, input.prices, report);
        var map = empty();
        map.expansions = expansions;
        map.printings = merge(previous, input.corrections, automatic, report);
        return { map: map, report: report };
    }

    // Checks a mapping read from a file; malformed entries are dropped.
    function normalize(value) {
        var result = empty();
        if (!value || typeof value !== 'object') return result;
        var expansions = value.expansions && typeof value.expansions === 'object' ?
            value.expansions : {};
        Object.keys(expansions).forEach(function (id) {
            var e = expansions[id];
            if (Array.isArray(e) && typeof e[0] === 'string' && typeof e[1] === 'string' &&
                EXPANSION_STATUSES.indexOf(e[2]) >= 0) result.expansions[id] = e.slice(0, 3);
        });
        var printings = value.printings && typeof value.printings === 'object' ?
            value.printings : {};
        Object.keys(printings).forEach(function (k) {
            var p = printings[k];
            if (Array.isArray(p) && Number.isInteger(p[0]) && STATUSES.indexOf(p[1]) >= 0 &&
                k.split('|').length === 4) result.printings[k] = p.slice(0, 2);
        });
        return result;
    }

    /*
     * Problems of a mapping: wrong version, keys not of four parts or with an unknown
     * edition or foiling, product ids that are no whole numbers or used twice, unknown status.
     */
    function problems(map) {
        var found = [];
        if (!map || map.version !== VERSION) found.push('Version ist nicht ' + VERSION);
        var editions = [''].concat(FCT.DATA.vocab.editions);
        var foilings = Object.keys(FCT.DATA.vocab.foilingCodes).map(foilingName);
        var seen = new Map();
        Object.keys((map && map.printings) || {}).forEach(function (k) {
            var parts = k.split('|');
            var entry = map.printings[k];
            if (parts.length !== 4 || !parts[0] || editions.indexOf(parts[1]) < 0 ||
                foilings.indexOf(parts[2]) < 0) found.push('Schlüssel ungültig: ' + k);
            if (!Array.isArray(entry) || !Number.isInteger(entry[0])) {
                found.push('Produkt-ID ungültig: ' + k);
                return;
            }
            if (STATUSES.indexOf(entry[1]) < 0) found.push('Status ungültig: ' + k);
            if (seen.has(entry[0])) {
                found.push('Produkt ' + entry[0] + ' doppelt: ' + seen.get(entry[0]) + ', ' + k);
            }
            seen.set(entry[0], k);
        });
        Object.keys((map && map.expansions) || {}).forEach(function (id) {
            var e = map.expansions[id];
            if (!Array.isArray(e) || editions.indexOf(e[1]) < 0 ||
                EXPANSION_STATUSES.indexOf(e[2]) < 0) found.push('Expansion ungültig: ' + id);
        });
        return found;
    }

    return {
        VERSION: VERSION,
        STATUSES: STATUSES,
        KEPT: KEPT,
        FOILING_COLUMNS: FOILING_COLUMNS,
        empty: empty,
        shipped: shipped,
        key: key,
        rowKey: rowKey,
        productUrl: productUrl,
        isSure: isSure,
        priceOf: priceOf,
        parseName: parseName,
        build: build,
        normalize: normalize,
        problems: problems
    };
})();
