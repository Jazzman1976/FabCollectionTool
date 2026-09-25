/*
 * core.js - global namespace, version and small shared helpers.
 * Every other script attaches itself to the FCT namespace. Classic scripts only (no modules),
 * because ES modules are blocked when the page is opened via file://.
 */
var FCT = window.FCT || {};
window.FCT = FCT;

// Version of this tool; must match the VERSION file in the tool folder.
FCT.VERSION = '2.0.6.2';

// Reference data files (reference/*.js) fill this object before the app scripts run.
FCT.DATA = FCT.DATA || {};

FCT.util = (function () {

    // Parses a quantity cell. Empty means 0; anything that is not a whole number is NaN.
    function toInt(value) {
        var text = String(value == null ? '' : value).trim();
        if (text === '') return 0;
        return /^-?\d+$/.test(text) ? parseInt(text, 10) : NaN;
    }

    // Case-insensitive, accent-insensitive form of a text for searching and comparing names.
    function fold(value) {
        return String(value == null ? '' : value)
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .trim();
    }

    /*
     * Wildcards as in the old spreadsheet: "*" stands for any text, "?" for one character.
     * Returns a test function for folded texts, or null if the pattern has no wildcard (then
     * the usual "contains" applies). With wildcards the whole value must match, so "Gravy*"
     * means "starts with Gravy" and "*Gravy*" "contains Gravy".
     */
    function wildcard(pattern) {
        var text = fold(pattern);
        if (!/[*?]/.test(text)) return null;
        var source = text.split('').map(function (c) {
            if (c === '*') return '.*';
            if (c === '?') return '.';
            return c.replace(/[\\^$.|+()[\]{}\/-]/g, '\\$&');
        }).join('');
        var re = new RegExp('^' + source + '$');
        return function (value) { return re.test(value); };
    }

    // Timestamp for file names, e.g. 20260923-161502.
    function timestamp(date) {
        var d = date || new Date();
        function pad(n) { return String(n).padStart(2, '0'); }
        return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
            pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    }

    // Creates a DOM element with attributes and children in one call.
    function el(tag, attrs, children) {
        var node = document.createElement(tag);
        Object.keys(attrs || {}).forEach(function (key) {
            var value = attrs[key];
            if (value == null || value === false) return;
            if (key === 'text') node.textContent = value;
            else if (key === 'className') node.className = value;
            else if (key.indexOf('on') === 0) node.addEventListener(key.slice(2), value);
            else node.setAttribute(key, value === true ? '' : value);
        });
        (children || []).forEach(function (child) {
            if (child == null) return;
            node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
        });
        return node;
    }

    return { toInt: toInt, fold: fold, wildcard: wildcard, timestamp: timestamp, el: el };
})();

/*
 * Report: collects messages grouped by category, so that thousands of similar findings
 * show up as one line with a count and a few examples instead of flooding the screen.
 */
FCT.createReport = function (title) {
    var groups = [];
    var byKey = {};
    var MAX_EXAMPLES = 50;

    // Adds one finding. level is 'error', 'warn' or 'info'.
    function add(level, category, example) {
        var key = level + '|' + category;
        var group = byKey[key];
        if (!group) {
            group = { level: level, category: category, count: 0, examples: [] };
            byKey[key] = group;
            groups.push(group);
        }
        group.count++;
        if (example != null && group.examples.length < MAX_EXAMPLES) {
            group.examples.push(String(example));
        }
    }

    // Counts findings of one level, e.g. to decide whether an import can be accepted.
    function count(level) {
        return groups
            .filter(function (g) { return !level || g.level === level; })
            .reduce(function (sum, g) { return sum + g.count; }, 0);
    }

    return { title: title, groups: groups, add: add, count: count, summary: [] };
};
