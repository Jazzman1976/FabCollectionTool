/*
 * diagnosis.js - keeps the diagnostic log (log.js) beyond the session, with a size limit:
 *   - in the working folder as fct-diagnose.log (Chrome/Edge), written in batches every few
 *     seconds; at FCT.log.FILE_LIMIT the file becomes fct-diagnose.1.log (replacing the older
 *     one) and a new file starts, so at most about twice the limit is kept;
 *   - in the browser (IndexedDB), the latest FCT.log.MAX_ENTRIES entries, so that
 *     "Diagnose herunterladen" also covers earlier sessions (all browsers).
 */
FCT.diagnosis = (function () {
    var FILE = 'fct-diagnose.log';
    var BACKUP = 'fct-diagnose.1.log';
    var KEY = 'diagnosis';
    var DELAY = 10000;
    var timer = null;
    var writing = false;
    var folder = null;          // () -> folder handle with write access, or null

    // Writes the new lines into the folder, rotating the file at the size limit.
    function writeFile(dir) {
        var lines = FCT.log.takeUnsent();
        if (!lines.length) return Promise.resolve();
        var text = lines.join('\r\n') + '\r\n';
        var storage = FCT.storage;
        return storage.readFolderFile(dir, FILE).then(function (file) {
            if (!FCT.log.needsRotation(file.size, text.length)) {
                return storage.appendFolderFile(dir, FILE, text);
            }
            return storage.writeFolderFile(dir, BACKUP, file.text).then(function () {
                return storage.writeFolderFile(dir, FILE, text);
            });
        });
    }

    function flush() {
        timer = null;
        if (writing) { schedule(); return Promise.resolve(); }
        writing = true;
        var dir = folder ? folder() : null;
        var copy = FCT.storage.rememberValue(KEY, FCT.log.entries().slice());
        var file = dir ? writeFile(dir) : Promise.resolve();
        return Promise.all([copy, file]).catch(function (error) {
            // Not logged again (that would start the next write); shown in the console.
            if (window.console) window.console.warn('Diagnose-Log: ' + error.message);
        }).then(function () { writing = false; });
    }

    function schedule() {
        if (!timer) timer = setTimeout(flush, DELAY);
    }

    /*
     * Starts keeping the log. getFolder() returns the working folder while the app may write
     * into it (otherwise null); lines logged meanwhile wait in memory.
     */
    function start(getFolder) {
        folder = getFolder;
        return FCT.storage.recallValue(KEY).then(function (old) {
            if (Array.isArray(old)) FCT.log.restore(old);
            FCT.log.setSink({ changed: schedule });
        });
    }

    // Offers the whole log (including earlier sessions) as a download.
    function download() {
        FCT.log.info('diagnose', 'Diagnose heruntergeladen', { entries:
            FCT.log.entries().length });
        FCT.storage.download('fct-diagnose-' + FCT.util.timestamp() + '.log', FCT.log.text(),
            'text/plain;charset=utf-8');
    }

    return { start: start, flush: flush, download: download, schedule: schedule };
})();
