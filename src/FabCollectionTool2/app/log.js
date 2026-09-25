/*
 * log.js - diagnostic logging for troubleshooting and for later changes to the app.
 *
 * Entries are kept in a ring buffer in memory (the latest MAX_ENTRIES). A sink can be attached
 * (see app.js) that writes new lines to a log file in the working folder; that file is rotated
 * at a size limit, so logs never grow without bounds. Changes to the collection are not logged
 * here - they are in the change log (changelog.js).
 */
FCT.log = (function () {
    var MAX_ENTRIES = 2000;
    var LEVELS = ['debug', 'info', 'warn', 'error'];
    var entries = [];
    var unsent = [];
    var sink = null;

    // Local time with milliseconds, e.g. 2026-09-24 17:05:12.345.
    function now() {
        var d = new Date();
        function pad(n, width) { return String(n).padStart(width || 2, '0'); }
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' +
            pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + '.' +
            pad(d.getMilliseconds(), 3);
    }

    // Extra data as short text; errors with their stack.
    function describe(data) {
        if (data == null) return '';
        if (data instanceof Error) return data.message + (data.stack ? '\n' + data.stack : '');
        if (typeof data === 'string') return data;
        try {
            return JSON.stringify(data);
        } catch (e) {
            return String(data);
        }
    }

    // One entry as a line of the log file.
    function format(entry) {
        var text = entry.time + ' ' + entry.level.toUpperCase().padEnd(5) + ' [' + entry.area +
            '] ' + entry.message;
        return entry.data ? text + ' ' + entry.data : text;
    }

    // Adds an entry; the ring buffer drops the oldest ones.
    function add(level, area, message, data) {
        var entry = { time: now(), level: level, area: area || 'app',
            message: String(message), data: describe(data) };
        entries.push(entry);
        if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
        unsent.push(entry);
        if (unsent.length > MAX_ENTRIES) unsent.splice(0, unsent.length - MAX_ENTRIES);
        if (level === 'error' && window.console) window.console.error(format(entry));
        if (sink) sink.changed();
        return entry;
    }

    /*
     * Rotation rule of the log file: if the file plus the new lines would exceed the limit,
     * the file becomes the backup (<name>.1.log, replacing an older one) and a new file
     * starts. So at most about twice the limit is ever kept.
     */
    var FILE_LIMIT = 512 * 1024;

    function needsRotation(fileSize, addedSize, limit) {
        return fileSize > 0 && fileSize + addedSize > (limit || FILE_LIMIT);
    }

    // Takes the lines not yet written to the sink (and forgets them).
    function takeUnsent() {
        var lines = unsent.map(format);
        unsent = [];
        return lines;
    }

    // Uncaught errors are logged as well, so they are not lost after the page is closed.
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('error', function (event) {
            add('error', 'window', event.message || 'Fehler', event.error ||
                (event.filename + ':' + event.lineno));
        });
        window.addEventListener('unhandledrejection', function (event) {
            add('error', 'promise', 'Unbehandelter Fehler', event.reason);
        });
    }

    var api = {
        LEVELS: LEVELS,
        MAX_ENTRIES: MAX_ENTRIES,
        FILE_LIMIT: FILE_LIMIT,
        format: format,
        needsRotation: needsRotation,
        takeUnsent: takeUnsent,
        entries: function () { return entries; },
        // Full text of the ring buffer, e.g. for "Diagnose herunterladen".
        text: function () { return entries.map(format).join('\n') + '\n'; },
        // Restores entries of earlier sessions (kept in the browser) in front of the new ones.
        restore: function (old) {
            entries = (old || []).concat(entries).slice(-MAX_ENTRIES);
        },
        // sink: { changed() } is told about new entries; it fetches them with takeUnsent().
        setSink: function (value) {
            sink = value;
            if (sink && unsent.length) sink.changed();
        }
    };
    LEVELS.forEach(function (level) {
        api[level] = function (area, message, data) { return add(level, area, message, data); };
    });
    return api;
})();
