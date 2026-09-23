/*
 * changelog.js - records every change to the collection, so that it can be traced later.
 *
 * Entries are kept in memory and shown in the app. On saving, the entries not yet written are
 * appended to a log file next to the collection (<collection>-log.csv), see app.js.
 */
FCT.changelog = (function () {
    var HEADER = ['Time', 'Action', 'Id', 'Name', 'Variant', 'Column', 'Old', 'New'];
    var entries = [];
    var written = 0;
    var listeners = [];

    // Local time in a sortable form, e.g. 2026-09-23 17:05:12.
    function now() {
        var d = new Date();
        function pad(n) { return String(n).padStart(2, '0'); }
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
            pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    // Printing variant of a row in short form, e.g. "First, Rainbow" or "DE, Extended Art".
    function variant(row) {
        if (!row) return '';
        return [row.Edition, row['Art Treatment'], row.Peculiarity].filter(Boolean).join(', ');
    }

    // Adds an entry. row may be null for changes that affect many rows (e.g. an import).
    function add(action, row, column, oldValue, newValue) {
        var entry = {
            time: now(),
            action: action,
            id: row ? row.Id || '' : '',
            name: row ? row.Name || '' : '',
            variant: variant(row),
            column: column || '',
            old: oldValue == null ? '' : String(oldValue),
            new: newValue == null ? '' : String(newValue)
        };
        entries.push(entry);
        listeners.forEach(function (listener) { listener(entry); });
        return entry;
    }

    // Converts entries to CSV records (without header).
    function toRecords(list) {
        return list.map(function (e) {
            return [e.time, e.action, e.id, e.name, e.variant, e.column, e.old, e.new];
        });
    }

    return {
        HEADER: HEADER,
        add: add,
        entries: function () { return entries; },
        // Entries that have not been written to the log file yet.
        pending: function () { return entries.slice(written); },
        markWritten: function () { written = entries.length; },
        // Starts over, e.g. when another collection is opened.
        clear: function () {
            entries = [];
            written = 0;
            listeners.forEach(function (listener) { listener(null); });
        },
        onChange: function (listener) { listeners.push(listener); },
        toRecords: toRecords
    };
})();
