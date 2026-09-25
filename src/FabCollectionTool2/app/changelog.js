/*
 * changelog.js - records every change to the collection, so that the user can trace it later
 * ("did I already add this card?") and undo single changes.
 *
 * Entries are kept in memory and shown in the app. On saving, the entries not yet written go
 * into a log file next to the collection (<collection>-log.csv), see app.js. The log keeps the
 * latest LIMIT entries - in memory and in the file - so it never grows without bounds. When a
 * collection is opened again, its earlier entries are loaded (load), so the log goes on.
 */
FCT.changelog = (function () {
    var HEADER = ['Time', 'Action', 'Id', 'Name', 'Variant', 'Column', 'Old', 'New'];
    var LIMIT = 1000;
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

    function notify(entry) {
        listeners.forEach(function (listener) { listener(entry); });
    }

    // Drops the oldest entries beyond the limit (written ones first, as they are in the file).
    function trim() {
        var extra = entries.length - LIMIT;
        if (extra <= 0) return;
        entries.splice(0, extra);
        written = Math.max(0, written - extra);
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
        trim();
        notify(entry);
        return entry;
    }

    // Converts entries to CSV records (without header).
    function toRecords(list) {
        return list.map(function (e) {
            return [e.time, e.action, e.id, e.name, e.variant, e.column, e.old, e.new];
        });
    }

    // Converts CSV records (without header) back to entries.
    function fromRecords(records) {
        return records.filter(function (r) { return r.length >= HEADER.length; })
            .map(function (r) {
                return { time: r[0], action: r[1], id: r[2], name: r[3], variant: r[4],
                    column: r[5], old: r[6], new: r[7] };
            });
    }

    /*
     * Loads the entries of earlier sessions (records without header), e.g. from the log file.
     * writtenCount says how many of them are already in the log file (default: all). Entries
     * of this session that are not written yet are kept behind them.
     */
    function load(records, writtenCount) {
        var old = fromRecords(records || []);
        var fresh = entries.slice(written);
        written = writtenCount == null ? old.length : Math.min(writtenCount, old.length);
        entries = old.concat(fresh);
        trim();
        notify(null);
    }

    // Content of the log file: the existing records plus the new ones, the latest LIMIT only.
    function fileRecords(existing, added) {
        return existing.concat(added).slice(-LIMIT);
    }

    return {
        HEADER: HEADER,
        LIMIT: LIMIT,
        add: add,
        load: load,
        entries: function () { return entries; },
        // Entries that have not been written to the log file yet.
        pending: function () { return entries.slice(written); },
        written: function () { return written; },
        // Marks the entries up to the given one (default: all) as written. Entries added while
        // the file was written stay pending.
        markWritten: function (last) {
            var index = last ? entries.indexOf(last) : entries.length - 1;
            if (index >= 0) written = Math.max(written, index + 1);
        },
        // Starts over, e.g. when another collection is opened.
        clear: function () {
            entries = [];
            written = 0;
            notify(null);
        },
        onChange: function (listener) { listeners.push(listener); },
        variant: variant,
        toRecords: toRecords,
        fromRecords: fromRecords,
        fileRecords: fileRecords
    };
})();
