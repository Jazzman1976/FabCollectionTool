/*
 * fabrary-map.js - maps the names of the reference data (the-fab-cube) to Fabrary's names
 * (issue #17, addendum).
 *
 * Fabrary sometimes names things differently: another set name, the full list of treatments,
 * an identifier without dots. A mapping holds only these differences:
 *   { sets: { <set code>: <Fabrary set name> },
 *     variants: { <key>: { identifier?, treatment?, set? } } }
 * The app ships one (FCT.DATA.fabraryMap, built from a Fabrary export by
 * tools/build-fabrary-map.mjs); each collection can add its own in its configuration file.
 * Per field the own variant entry wins, then the shipped variant entry, the own set entry,
 * the shipped set entry and last the rule of the export.
 *
 * compare() reads a Fabrary export and finds where Fabrary's names differ. It is used by the
 * dialog "Fabrary-Zuordnung" and by the build tool.
 */
FCT.fabraryMap = (function () {
    var FIELDS = ['identifier', 'set', 'treatment'];
    // Position of the mapped fields in an export row identity
    // [identifier, name, pitch, set, set number, edition, foiling, treatment].
    var INDEX = { identifier: 0, set: 3, treatment: 7 };
    var REQUIRED = ['Identifier', 'Name', 'Set', 'Set number', 'Edition', 'Foiling',
        'Treatment'];
    // Typed into a field of the dialog, this stands for an explicitly empty value.
    var EMPTY_MARK = '-';

    function empty() {
        return { sets: {}, variants: {} };
    }

    function has(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    function shippedMap() {
        return FCT.DATA.fabraryMap || empty();
    }

    // Key of an export row: set number | edition | foiling | full treatment | identifier.
    function key(setNumber, edition, foiling, art, identifier) {
        return [setNumber, edition, foiling, art, identifier].join('|');
    }

    // Checks a mapping read from a file; unknown fields and non-text values are dropped.
    function normalize(value) {
        var result = empty();
        if (!value || typeof value !== 'object') return result;
        var sets = value.sets && typeof value.sets === 'object' ? value.sets : {};
        Object.keys(sets).forEach(function (code) {
            if (typeof sets[code] === 'string') result.sets[code] = sets[code];
        });
        var variants = value.variants && typeof value.variants === 'object' ? value.variants
            : {};
        Object.keys(variants).forEach(function (k) {
            var entry = variants[k] || {};
            var clean = {};
            FIELDS.forEach(function (field) {
                if (typeof entry[field] === 'string') clean[field] = entry[field];
            });
            if (Object.keys(clean).length) result.variants[k] = clean;
        });
        return result;
    }

    function isEmpty(map) {
        return !map || (!Object.keys(map.sets).length && !Object.keys(map.variants).length);
    }

    /*
     * Value of one field for an export row and where it comes from ('own', 'shipped' or
     * 'rule'). row: { key, setCode, identity }. skipOwn: the value without the own mapping.
     */
    function value(row, field, own, shipped, skipOwn) {
        own = own || empty();
        shipped = shipped || shippedMap();
        var ov = own.variants[row.key] || {};
        var sv = shipped.variants[row.key] || {};
        if (!skipOwn && has(ov, field)) return { value: ov[field], from: 'own' };
        if (has(sv, field)) return { value: sv[field], from: 'shipped' };
        if (field === 'set') {
            if (!skipOwn && has(own.sets, row.setCode)) {
                return { value: own.sets[row.setCode], from: 'own' };
            }
            if (has(shipped.sets, row.setCode)) {
                return { value: shipped.sets[row.setCode], from: 'shipped' };
            }
        }
        return { value: row.identity[INDEX[field]], from: 'rule' };
    }

    // The identity of an export row with the mapping applied.
    function apply(row, own, shipped) {
        var identity = row.identity.slice();
        var changed = false;
        var byOwn = false;
        FIELDS.forEach(function (field) {
            var v = value(row, field, own, shipped);
            if (v.value === identity[INDEX[field]]) return;
            identity[INDEX[field]] = v.value;
            changed = true;
            if (v.from === 'own') byOwn = true;
        });
        return { identity: identity, changed: changed, own: byOwn };
    }

    // The mapped values { identifier, set, treatment } of a row.
    function values(row, own, shipped, skipOwn) {
        var result = {};
        FIELDS.forEach(function (field) {
            result[field] = value(row, field, own, shipped, skipOwn).value;
        });
        return result;
    }

    /*
     * Sets the own entry of a variant to the wanted values { identifier?, set?, treatment? }:
     * only fields that differ from the value without the own mapping are kept.
     */
    function setVariant(own, row, wanted, shipped) {
        var base = values(row, own, shipped, true);
        var entry = {};
        FIELDS.forEach(function (field) {
            if (has(wanted, field) && wanted[field] !== base[field]) {
                entry[field] = wanted[field];
            }
        });
        if (Object.keys(entry).length) own.variants[row.key] = entry;
        else delete own.variants[row.key];
    }

    // Sets the own set name of a set code; a name equal to the one without it removes it.
    function setSet(own, code, name, shipped) {
        shipped = shipped || shippedMap();
        var base = has(shipped.sets, code) ? shipped.sets[code] : FCT.reference.setName(code);
        if (name === base) delete own.sets[code];
        else own.sets[code] = name;
    }

    // Treatments as a set of parts, to compare lists regardless of their order.
    function parts(treatment) {
        return String(treatment || '').split(',').map(function (t) {
            return t.trim();
        }).filter(Boolean).sort().join(',');
    }

    // Picks the Fabrary row of one export row from the rows with the same number, edition
    // and foiling. Returns { match } or { candidates } if it is not clear.
    function pick(row, candidates) {
        var util = FCT.util;
        var names = new Set(candidates.map(function (c) { return util.fold(c.Name); }));
        if (names.size > 1) {
            var byName = candidates.filter(function (c) {
                return util.fold(c.Name) === util.fold(row.identity[1]);
            });
            if (byName.length) candidates = byName;
        }
        if (candidates.length === 1) return { match: candidates[0] };
        var tests = [
            function (c) { return parts(c.Treatment) === parts(row.art); },
            function (c) { return c.Treatment === row.identity[7]; }
        ];
        for (var i = 0; i < tests.length; i++) {
            var found = candidates.filter(tests[i]);
            if (found.length === 1) return { match: found[0] };
        }
        return { candidates: candidates };
    }

    /*
     * Compares the export rows (without mapping) with a Fabrary export. Only differences to
     * the mapping in effect (own and shipped) are returned:
     *   sets: [{ code, current, fabrary }]  - set codes whose Fabrary name is the same for all
     *                                         their rows
     *   variants: [{ row, current, fabrary }] - clear findings, values { identifier, set,
     *                                           treatment }
     *   unclear: [{ row, current, candidates: [values] }]
     *   matched, notInFabrary: [row], error
     */
    function compare(rows, text, own, shipped) {
        var result = { sets: [], variants: [], unclear: [], matched: 0, notInFabrary: [],
            error: '' };
        var table = FCT.csv.parseTable(text);
        var missing = REQUIRED.filter(function (c) { return table.header.indexOf(c) < 0; });
        if (missing.length) {
            result.error = 'Keine Fabrary-Exportdatei, es fehlen Spalten: ' + missing.join(', ');
            return result;
        }

        // Fabrary rows by number, edition and foiling; identical rows count once.
        var groups = new Map();
        var seen = new Set();
        table.rows.forEach(function (source) {
            var identity = ['Identifier', 'Set number', 'Edition', 'Foiling', 'Treatment']
                .map(function (c) { return source[c]; }).join('|');
            if (seen.has(identity)) return;
            seen.add(identity);
            var group = [source['Set number'], source.Edition, source.Foiling].join('|');
            if (!groups.has(group)) groups.set(group, []);
            groups.get(group).push(source);
        });

        // Each export row picks its Fabrary row; a Fabrary row picked twice is not clear.
        var picks = [];
        var usedBy = new Map();
        rows.forEach(function (row) {
            var group = groups.get([row.identity[4], row.identity[5], row.identity[6]]
                .join('|'));
            if (!group) { result.notInFabrary.push(row); return; }
            var found = pick(row, group);
            picks.push({ row: row, found: found });
            if (found.match) usedBy.set(found.match, (usedBy.get(found.match) || 0) + 1);
        });
        picks.forEach(function (p) {
            if (p.found.match && usedBy.get(p.found.match) > 1) {
                p.found = { candidates: [p.found.match] };
            }
        });

        // Set names: one finding per set code if Fabrary uses one name for all its rows.
        var setNames = new Map();
        picks.forEach(function (p) {
            if (!p.found.match) return;
            var code = p.row.setCode;
            if (!setNames.has(code)) setNames.set(code, new Set());
            setNames.get(code).add(p.found.match.Set);
        });
        var uniform = new Map();
        setNames.forEach(function (names, code) {
            if (names.size === 1) uniform.set(code, names.values().next().value);
        });
        uniform.forEach(function (name, code) {
            var current = setValue(code, own, shipped);
            if (name !== current) result.sets.push({ code: code, current: current, fabrary: name });
        });

        // Variants: differences to the mapping in effect; the set name only where Fabrary's
        // names of the set code differ, otherwise the set finding covers it.
        picks.forEach(function (p) {
            var current = values(p.row, own, shipped);
            var bySet = uniform.has(p.row.setCode);
            var candidates = (p.found.match ? [p.found.match] : p.found.candidates)
                .map(function (c) {
                    var found = { identifier: c.Identifier, treatment: c.Treatment };
                    if (!bySet) found.set = c.Set;
                    return found;
                });
            var same = candidates.some(function (c) { return equal(c, current); });
            if (p.found.match) result.matched++;
            if (same) return;
            if (p.found.match) {
                result.variants.push({ row: p.row, current: current, fabrary: candidates[0] });
            } else {
                result.unclear.push({ row: p.row, current: current, candidates: candidates });
            }
        });
        return result;
    }

    // Set name in effect for a set code.
    function setValue(code, own, shipped) {
        own = own || empty();
        shipped = shipped || shippedMap();
        if (has(own.sets, code)) return own.sets[code];
        if (has(shipped.sets, code)) return shipped.sets[code];
        return FCT.reference.setName(code);
    }

    // True if the found values (a set name only where given) are those in effect.
    function equal(found, current) {
        return FIELDS.every(function (field) {
            return !has(found, field) || found[field] === current[field];
        });
    }

    return { FIELDS: FIELDS, EMPTY_MARK: EMPTY_MARK, empty: empty, key: key,
        normalize: normalize, isEmpty: isEmpty, value: value, values: values, apply: apply,
        setVariant: setVariant, setSet: setSet, setValue: setValue, compare: compare };
})();
