/*
 * export-cardmarket.js - writes a wants list for Cardmarket (issue #7).
 *
 * The file is a deck list as Cardmarket takes it under Wants -> "Add Deck List", one card per
 * line, in the same format as cm-wants.txt of the first FabCollectionTool:
 *   <quantity> <name>[ // <back side>][ <pitch>][ (<set>[ - <edition>])]
 * Only cards still missing for a playset are listed. The pitch is only written for cards that
 * exist in several pitches; Cardmarket does not expect it for the others.
 */
FCT.exportCardmarket = (function () {

    var PITCH_ORDER = ['Red', 'Yellow', 'Blue', 'Purple'];

    /*
     * Pitches of each card name: folded name -> Set of pitches. The reference data decides;
     * the collection only counts for names the reference data does not know (e.g. a set that
     * is not in it yet), so a deviating pitch in the collection does not add a second one.
     */
    function pitchesByName(collectionRows) {
        var util = FCT.util;
        var result = new Map();
        function add(target, name, pitch) {
            var key = util.fold(name);
            if (!target.has(key)) target.set(key, new Set());
            if (pitch) target.get(key).add(pitch);
        }
        var data = FCT.reference.data();
        (data ? data.cards : []).forEach(function (card) { add(result, card[1], card[2]); });
        var own = new Map();
        collectionRows.forEach(function (row) { add(own, row.Name, row.Pitch); });
        own.forEach(function (pitches, key) { if (!result.has(key)) result.set(key, pitches); });
        return result;
    }

    // Name as Cardmarket writes it, with the known exceptions of vocab.cardmarketNames.
    function cardmarketName(row, report) {
        var names = FCT.DATA.vocab.cardmarketNames || {};
        var full = row['Backside Name'] ? row.Name + ' // ' + row['Backside Name'] : row.Name;
        var fixed = names[full] || names[row.Name] || null;
        if (fixed === null) return full;
        if (!names[full] && row['Backside Name']) fixed += ' // ' + row['Backside Name'];
        if (report) report.add('info', 'Name für Cardmarket angepasst', full + ' → ' + fixed);
        return fixed;
    }

    /*
     * The wanted cards: [{ quantity, pitch, set, edition, row }], sorted by name.
     *
     * Cardmarket knows a card by its name (and pitch), so, as in the first tool, all rows with
     * the same name, back side and pitch count together - also across peculiarities such as
     * the CC label: wanted = the largest playset of these rows minus all copies owned.
     *
     * collection  the collection; the copies owned are always counted over all its rows
     * options:
     *   rows      rows to take the cards from (default: all rows of the collection)
     *   sets      set names (column Set) to include; empty or missing = all
     *   rarities  rarities to include; empty or missing = all
     *   basis     'total': missing over all sets, one line per card;
     *             'set': missing in each set on its own, one line per card and set
     */
    function wants(collection, options) {
        var util = FCT.util;
        var sets = options.sets && options.sets.length ? new Set(options.sets) : null;
        var rarities = options.rarities && options.rarities.length
            ? new Set(options.rarities) : null;
        var perSet = options.basis === 'set';

        function cardKey(row) {
            return [util.fold(row.Name), util.fold(row['Backside Name']), row.Pitch,
                perSet ? row.Set : ''].join('|');
        }
        function isCard(row) {
            return !row._reference && String(row.Id || '').trim() !== '';
        }

        // Copies owned and largest playset per card, over the whole collection: a reprint
        // owned in another set counts even if only one set is exported.
        FCT.model.calculate(collection.rows);
        var cards = new Map();
        collection.rows.forEach(function (row) {
            if (!isCard(row)) return;
            var key = cardKey(row);
            var card = cards.get(key) || { have: 0, playset: 0 };
            card.have += row._have || 0;
            card.playset = Math.max(card.playset, util.toInt(row.Playset) || 0);
            cards.set(key, card);
        });
        var pitches = pitchesByName(collection.rows);

        // One line per card among the chosen rows; the first row gives set and edition.
        var byKey = new Map();
        (options.rows || collection.rows).forEach(function (row) {
            if (!isCard(row)) return;
            if (sets && !sets.has(row.Set)) return;
            if (rarities && !rarities.has(row.Rarity)) return;
            var key = cardKey(row);
            if (byKey.has(key)) return;
            var card = cards.get(key);
            var quantity = card ? card.playset - card.have : 0;
            if (quantity <= 0) return;
            var several = (pitches.get(util.fold(row.Name)) || new Set()).size > 1;
            byKey.set(key, { quantity: quantity, pitch: several ? row.Pitch : '', set: row.Set,
                edition: row.Edition, row: row });
        });

        return Array.from(byKey.values()).sort(function (a, b) {
            return util.fold(a.row.Name).localeCompare(util.fold(b.row.Name)) ||
                PITCH_ORDER.indexOf(a.pitch) - PITCH_ORDER.indexOf(b.pitch) ||
                a.set.localeCompare(b.set);
        });
    }

    /*
     * Lines of the same card from several sets as one line with the sum of their quantities
     * (#35): "missing per set" without the set name at the line end. The key is the line as
     * Cardmarket reads it (name and pitch as written), so no card appears twice. The entries
     * are sorted by name and pitch, so the merged list stays sorted.
     */
    function mergeSets(entries) {
        var byCard = new Map();
        entries.forEach(function (entry) {
            var key = FCT.util.fold(cardmarketName(entry.row) + ' ' + entry.pitch);
            var merged = byCard.get(key);
            if (merged) merged.quantity += entry.quantity;
            else byCard.set(key, Object.assign({}, entry));
        });
        return Array.from(byCard.values());
    }

    /*
     * Main entry: collection -> { text, report, lines, cards }.
     * options as for wants, plus suffix: 'none', 'set' or 'setEdition'. With basis 'set' and
     * no set name, the lines of a card from several sets are added up (mergeSets).
     */
    function exportCardmarket(collection, options) {
        var report = FCT.createReport('Export nach Cardmarket');
        var suffix = options.suffix || 'none';

        var entries = wants(collection, options);
        if (options.basis === 'set' && suffix === 'none') entries = mergeSets(entries);
        var cards = 0;
        var lines = entries.map(function (entry) {
            cards += entry.quantity;
            var line = entry.quantity + ' ' + cardmarketName(entry.row, report);
            if (entry.pitch) line += ' ' + entry.pitch;
            if (suffix !== 'none' && entry.set) {
                var edition = suffix === 'setEdition' && entry.edition
                    ? ' - ' + entry.edition : '';
                line += ' (' + entry.set + edition + ')';
            }
            return line.replace(/\s+/g, ' ').trim();
        });

        report.summary.push(describe(lines.length, cards));
        if (!lines.length) report.add('info', 'Keine fehlenden Karten für diese Auswahl');
        return { text: lines.join('\n') + (lines.length ? '\n' : ''), report: report,
            lines: lines.length, cards: cards };
    }

    // "3 Zeilen mit zusammen 5 Karten", singular where needed.
    function describe(lines, cards) {
        return lines.toLocaleString('de-DE') + (lines === 1 ? ' Zeile' : ' Zeilen') +
            ' mit zusammen ' + cards.toLocaleString('de-DE') + (cards === 1 ? ' Karte' : ' Karten');
    }

    return { wants: wants, exportCardmarket: exportCardmarket, describe: describe };
})();
