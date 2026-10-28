/*
 * cardmarket-prices.js - Cardmarket prices of the collection (issue #94).
 *
 * The prices come from Cardmarket's public price guide (price_guide_16.json), which the user
 * downloads in the browser and chooses in the app. The app keeps them in a file of its own in
 * the working folder, cardmarket-prices.json, never in collection.csv:
 *   { version: 1, priceGuide: <createdAt of the price guide>, imported: <yyyy-mm-dd>,
 *     prices: { <Cardmarket product id>: [avg30, trend] },
 *     corrections: { <key>: [Cardmarket product id, 'confirmed' | 'manual'] } }
 * Prices are kept per product, not per printing, so that a better mapping in a later version
 * of the app works without a new import. The corrections are the user's own checks of the
 * mapping (key as in FCT.cardmarketMap); tools/build-cardmarket-map.mjs takes them over.
 *
 * The value of a row is the sum over its quantity columns of quantity x price, the price being
 * the 30 days average, else the trend.
 */
FCT.cardmarketPrices = (function () {
    var VERSION = 1;
    var FILE_NAME = 'cardmarket-prices.json';
    var DOWNLOAD_URL = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/' +
        'price_guide_16.json';
    // Category of the Flesh and Blood singles in Cardmarket's price guide.
    var SINGLES = 1601;
    var FOILING_LABELS = { ST: 'Standard', RF: 'Rainbow Foil', CF: 'Cold Foil',
        GF: 'Gold Cold Foil' };

    function has(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    function empty() {
        return { version: VERSION, priceGuide: '', imported: '', prices: {}, corrections: {} };
    }

    // A price as a number, or null.
    function number(value) {
        return typeof value === 'number' && isFinite(value) && value > 0 ? value : null;
    }

    // Local date as yyyy-mm-dd.
    function today(date) {
        var d = date || new Date();
        function pad(n) { return String(n).padStart(2, '0'); }
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    /*
     * Builds the local price file from the chosen price guide (parsed JSON). The corrections
     * of the previous file stay. Throws an Error with a message for the user if the file is
     * not Cardmarket's price guide of Flesh and Blood; nothing is changed then.
     */
    function fromPriceGuide(guide, previous, date) {
        var entries = guide && Array.isArray(guide.priceGuides) ? guide.priceGuides : null;
        if (!entries) {
            throw new Error('Das ist keine Preisliste von Cardmarket (price_guide_16.json). ' +
                'Bitte die Datei über den Link herunterladen und genau diese auswählen.');
        }
        var singles = entries.filter(function (e) {
            return e && e.idCategory === SINGLES && Number.isInteger(e.idProduct);
        });
        if (!singles.length) {
            throw new Error('Die Preisliste enthält keine Flesh-and-Blood-Karten – ' +
                'vermutlich die eines anderen Spiels. Gebraucht wird price_guide_16.json.');
        }
        var file = empty();
        Object.keys(previous || {}).forEach(function (k) { file[k] = previous[k]; });
        file.version = VERSION;
        file.priceGuide = String(guide.createdAt || '');
        file.imported = today(date);
        file.prices = {};
        singles.forEach(function (e) {
            file.prices[e.idProduct] = [number(e.avg30), number(e.trend)];
        });
        return file;
    }

    /*
     * Reads the local file. Unknown fields are kept (for later extensions); malformed prices
     * and corrections are dropped. Throws on text that is no JSON.
     */
    function parse(text) {
        var value = JSON.parse(String(text).replace(/^﻿/, ''));
        var file = empty();
        if (!value || typeof value !== 'object') return file;
        Object.keys(value).forEach(function (k) { file[k] = value[k]; });
        file.priceGuide = typeof value.priceGuide === 'string' ? value.priceGuide : '';
        file.imported = typeof value.imported === 'string' ? value.imported : '';
        file.prices = {};
        var prices = value.prices && typeof value.prices === 'object' ? value.prices : {};
        Object.keys(prices).forEach(function (id) {
            var p = prices[id];
            if (Array.isArray(p)) file.prices[id] = [number(p[0]), number(p[1])];
        });
        file.corrections = {};
        var corrections = value.corrections && typeof value.corrections === 'object'
            ? value.corrections : {};
        Object.keys(corrections).forEach(function (k) {
            var c = corrections[k];
            if (Array.isArray(c) && Number.isInteger(c[0]) &&
                FCT.cardmarketMap.KEPT.indexOf(c[1]) >= 0) file.corrections[k] = [c[0], c[1]];
        });
        return file;
    }

    // The file as text: one price and one correction per line, so that it stays readable.
    function stringify(file) {
        function line(k, v) { return JSON.stringify(k) + ': ' + JSON.stringify(v); }
        function block(name, object, keys) {
            var entries = keys.map(function (k) { return '    ' + line(k, object[k]); });
            return ['  "' + name + '": {'].concat(entries.length ? [entries.join(',\n')] : [],
                ['  }']).join('\n');
        }
        var head = Object.keys(file).filter(function (k) {
            return k !== 'prices' && k !== 'corrections';
        }).map(function (k) { return '  ' + line(k, file[k]); });
        var prices = Object.keys(file.prices).sort(function (a, b) { return a - b; });
        var corrections = Object.keys(file.corrections).sort();
        return '{\n' + head.concat([block('prices', file.prices, prices),
            block('corrections', file.corrections, corrections)]).join(',\n') + '\n}\n';
    }

    /*
     * The Cardmarket product of a key: a local correction first, then the shipped mapping.
     * Returns { id, status, corrected } or null.
     */
    function entry(file, map, key) {
        var correction = file && has(file.corrections, key) ? file.corrections[key] : null;
        if (correction) return { id: correction[0], status: correction[1], corrected: true };
        var mapped = map && has(map.printings, key) ? map.printings[key] : null;
        return mapped ? { id: mapped[0], status: mapped[1], corrected: false } : null;
    }

    // Price of a product: 30 days average, else trend. { value, basis } or null.
    function price(file, id) {
        var p = file && has(file.prices, id) ? file.prices[id] : null;
        if (!p) return null;
        if (p[0] != null) return { value: p[0], basis: 'avg30' };
        if (p[1] != null) return { value: p[1], basis: 'trend' };
        return null;
    }

    /*
     * One quantity column of a row: { column, label, quantity, key, product, sure, price,
     * amount }. product is the entry of the mapping (or null), amount quantity x price.
     */
    function part(file, map, row, column) {
        var n = FCT.util.toInt(row[column]);
        var quantity = isNaN(n) ? 0 : n;
        var key = FCT.cardmarketMap.rowKey(row, column);
        var product = entry(file, map, key);
        var p = product ? price(file, product.id) : null;
        return {
            column: column, label: FOILING_LABELS[column], quantity: quantity, key: key,
            product: product, sure: !!product && FCT.cardmarketMap.isSure(product.status),
            price: p, amount: p ? quantity * p.value : 0
        };
    }

    /*
     * Value of a row: { total, estimated, missing, parts }. parts are the quantity columns
     * with a quantity and those of the foilings the printing has (for the tooltip); total is
     * the sum of the amounts, estimated is true if a priced quantity rests on an estimated
     * mapping, missing if a quantity has no price.
     */
    function value(file, map, row) {
        var foilings = FCT.reference.foilings(row) || [];
        var parts = FCT.model.QUANTITIES.filter(function (column) {
            var n = FCT.util.toInt(row[column]);
            return (!isNaN(n) && n > 0) || foilings.indexOf(column) >= 0;
        }).map(function (column) { return part(file, map, row, column); });
        var result = { total: 0, estimated: false, missing: false, parts: parts };
        parts.forEach(function (p) {
            if (!p.quantity) return;
            if (!p.price) { result.missing = true; return; }
            result.total += p.amount;
            if (!p.sure) result.estimated = true;
        });
        return result;
    }

    /*
     * Lowest and highest price per card among the foilings of a row (columns "↓ Preis" and
     * "↑ Preis"), regardless of the quantities: { low, high } with the part of the cheapest
     * and of the dearest foiling, or null if no foiling has a price.
     */
    function range(file, map, row) {
        var priced = value(file, map, row).parts.filter(function (p) { return p.price; });
        if (!priced.length) return null;
        var low = priced[0];
        var high = priced[0];
        priced.forEach(function (p) {
            if (p.price.value < low.price.value) low = p;
            if (p.price.value > high.price.value) high = p;
        });
        return { low: low, high: high };
    }

    // Sets (or with id null removes) the correction of a key.
    function setCorrection(file, key, id, status) {
        if (id == null) delete file.corrections[key];
        else file.corrections[key] = [id, status];
    }

    /*
     * Removes corrections that the shipped mapping already holds just so (same product,
     * checked or set by a person). Returns the keys removed.
     */
    function tidy(file, map) {
        var removed = [];
        Object.keys(file.corrections).forEach(function (k) {
            var mapped = map && has(map.printings, k) ? map.printings[k] : null;
            if (mapped && mapped[0] === file.corrections[k][0] &&
                FCT.cardmarketMap.KEPT.indexOf(mapped[1]) >= 0) {
                delete file.corrections[k];
                removed.push(k);
            }
        });
        return removed;
    }

    /*
     * Products of the same card number and edition in the other foilings and art treatments
     * (to compare on Cardmarket when checking an estimated mapping): [{ key, id, status }].
     */
    function relatives(file, map, key) {
        var head = key.split('|').slice(0, 2).join('|') + '|';
        var keys = Object.keys((map && map.printings) || {}).concat(
            Object.keys((file && file.corrections) || {}));
        var seen = {};
        return keys.filter(function (k) {
            if (k === key || k.indexOf(head) !== 0 || seen[k]) return false;
            seen[k] = true;
            return true;
        }).sort().map(function (k) {
            var e = entry(file, map, k);
            return { key: k, id: e.id, status: e.status };
        });
    }

    // Amount as text, e.g. "1.234,56 €".
    function money(amount) {
        return amount.toLocaleString('de-DE', { minimumFractionDigits: 2,
            maximumFractionDigits: 2 }) + ' €';
    }

    // Date of the price guide as dd.mm.yyyy ('' if unknown).
    function guideDate(file) {
        var m = /^(\d{4})-(\d{2})-(\d{2})/.exec((file && file.priceGuide) || '');
        return m ? m[3] + '.' + m[2] + '.' + m[1] : '';
    }

    return {
        VERSION: VERSION,
        FILE_NAME: FILE_NAME,
        DOWNLOAD_URL: DOWNLOAD_URL,
        FOILING_LABELS: FOILING_LABELS,
        empty: empty,
        fromPriceGuide: fromPriceGuide,
        parse: parse,
        stringify: stringify,
        entry: entry,
        price: price,
        value: value,
        range: range,
        setCorrection: setCorrection,
        tidy: tidy,
        relatives: relatives,
        money: money,
        guideDate: guideDate
    };
})();
