/*
 * storage.js - opening and saving files. The app keeps nothing in the browser; the collection
 * lives in a file chosen by the user (e.g. in a OneDrive folder for a cloud backup).
 *
 * Where the browser supports it (Chrome, Edge), the opened file is written back in place.
 * Otherwise (e.g. Firefox) saving works as a download.
 */
FCT.storage = (function () {

    // True if files can be written back directly (File System Access API).
    var canWriteBack = window.isSecureContext === true &&
        typeof window.showOpenFilePicker === 'function';

    var CSV_TYPES = [{ description: 'CSV-Datei', accept: { 'text/csv': ['.csv'] } }];

    // Lets the user pick a file via a hidden input element. Resolves with a File or null.
    function pickFile(accept) {
        return new Promise(function (resolve) {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = accept;
            input.style.display = 'none';
            input.addEventListener('change', function () {
                resolve(input.files[0] || null);
                input.remove();
            });
            document.body.appendChild(input);
            input.click();
        });
    }

    // Reads a File as text or ArrayBuffer.
    function readFile(file, asBuffer) {
        return asBuffer ? file.arrayBuffer() : file.text();
    }

    // Asks for permission to write into a file without further questions (needed for
    // automatic saving). Must run right after a click; resolves true or false.
    function requestWrite(handle) {
        if (!handle || typeof handle.requestPermission !== 'function') {
            return Promise.resolve(false);
        }
        return handle.requestPermission({ mode: 'readwrite' }).then(function (result) {
            return result === 'granted';
        }, function () {
            return false;
        });
    }

    // Opens a collection file. Resolves with { name, text, handle } or null if cancelled.
    // Write permission for automatic saving is asked for separately (see app.js).
    function openCollection() {
        if (canWriteBack) {
            return window.showOpenFilePicker({ types: CSV_TYPES }).then(function (handles) {
                var handle = handles[0];
                return handle.getFile().then(function (file) {
                    return file.text().then(function (text) {
                        return { name: file.name, text: text, handle: handle };
                    });
                });
            }, cancelled);
        }
        return pickFile('.csv,text/csv').then(function (file) {
            if (!file) return null;
            return file.text().then(function (text) {
                return { name: file.name, text: text, handle: null };
            });
        });
    }

    // A cancelled file dialog is not an error.
    function cancelled(error) {
        if (error && error.name === 'AbortError') return null;
        throw error;
    }

    // Offers text as a file download.
    function download(name, text, type) {
        var blob = new Blob([text], { type: type || 'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
    }

    // Writes text into a file handle.
    function writeHandle(handle, text) {
        return handle.createWritable().then(function (writable) {
            return writable.write(text).then(function () { return writable.close(); });
        });
    }

    // Saves the collection. Resolves with { name, handle, method } or null if cancelled.
    // method is 'file' (written in place) or 'download'.
    function saveCollection(text, current) {
        var name = (current && current.name) || 'collection.csv';
        if (canWriteBack && current && current.handle) {
            return writeHandle(current.handle, text).then(function () {
                return { name: name, handle: current.handle, method: 'file' };
            });
        }
        return saveAs(name, text);
    }

    // Asks for a file name and location (or downloads, if the browser cannot do that).
    function saveAs(suggestedName, text) {
        if (canWriteBack && typeof window.showSaveFilePicker === 'function') {
            return window.showSaveFilePicker({ suggestedName: suggestedName, types: CSV_TYPES })
                .then(function (handle) {
                    return writeHandle(handle, text).then(function () {
                        return { name: handle.name, handle: handle, method: 'file' };
                    });
                }, cancelled);
        }
        download(suggestedName, text);
        return Promise.resolve({ name: suggestedName, handle: null, method: 'download' });
    }

    // Backup: a copy with a time stamp in the name, e.g. collection-backup-20260923-1615.csv.
    function backup(text, baseName) {
        var base = String(baseName || 'collection.csv').replace(/\.csv$/i, '');
        return saveAs(base + '-backup-' + FCT.util.timestamp() + '.csv', text);
    }

    // Appends lines to the log file next to the collection.
    // Chrome/Edge: the first call asks where the log file is (or should be); the handle is
    // kept, the existing content is read and the new lines are appended. Other browsers get
    // a download with only the new lines. Resolves with { name, handle, method } or null if
    // the user cancelled. makeText(existingText) returns the complete new file content.
    function appendLog(suggestedName, handle, makeText, newOnlyText) {
        if (canWriteBack && typeof window.showSaveFilePicker === 'function') {
            var ready = handle ? Promise.resolve(handle) : window.showSaveFilePicker({
                suggestedName: suggestedName, types: CSV_TYPES
            });
            return ready.then(function (h) {
                return h.getFile().then(function (file) {
                    return file.text();
                }, function () {
                    return '';
                }).then(function (existing) {
                    return writeHandle(h, makeText(existing)).then(function () {
                        return { name: h.name, handle: h, method: 'file' };
                    });
                });
            }, cancelled);
        }
        var name = suggestedName.replace(/\.csv$/i, '') + '-' + FCT.util.timestamp() + '.csv';
        download(name, newOnlyText);
        return Promise.resolve({ name: name, handle: null, method: 'download' });
    }

    /*
     * Last collection, kept in IndexedDB (decided 23.09.2026): a copy of the collection text,
     * so that it is shown at once at the next start, plus - in Chrome/Edge - the handle of
     * its file (a reference; only IndexedDB can keep it) and the autosave decision.
     * Record: { name, text, fileText, updated, handle, autosave }. The file stays the
     * original: fileText is its content when last read or written, to notice changes made
     * elsewhere. Any failure (e.g. storage blocked) means "nothing remembered".
     */
    var DB_NAME = 'fct2';
    var DB_STORE = 'files';
    var LAST = 'lastCollection';

    function database() {
        return new Promise(function (resolve, reject) {
            var request = window.indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = function () {
                request.result.createObjectStore(DB_STORE);
            };
            request.onsuccess = function () { resolve(request.result); };
            request.onerror = function () { reject(request.error); };
        });
    }

    // Runs one request on the store; resolves with its result.
    function withStore(mode, action) {
        return database().then(function (db) {
            return new Promise(function (resolve, reject) {
                var request = action(db.transaction(DB_STORE, mode).objectStore(DB_STORE));
                request.onsuccess = function () { resolve(request.result); };
                request.onerror = function () { reject(request.error); };
            });
        });
    }

    // Remembers the last collection (see above). Resolves true if it was stored.
    function rememberFile(record) {
        if (!window.indexedDB) return Promise.resolve(false);
        return withStore('readwrite', function (store) {
            return store.put(record, LAST);
        }).then(function () { return true; }, function () { return false; });
    }

    // Resolves with the remembered record, or null.
    function recallFile() {
        if (!window.indexedDB) return Promise.resolve(null);
        return withStore('readonly', function (store) {
            return store.get(LAST);
        }).then(function (record) {
            return record && (record.text || record.handle) ? record : null;
        }, function () { return null; });
    }

    function forgetFile() {
        if (!window.indexedDB) return Promise.resolve();
        return withStore('readwrite', function (store) {
            return store.delete(LAST);
        }).then(function () {}, function () {});
    }

    // True if two handles point to the same file.
    function sameFile(a, b) {
        if (!a || !b || typeof a.isSameEntry !== 'function') return Promise.resolve(false);
        return a.isSameEntry(b).catch(function () { return false; });
    }

    // Current permission of a handle without asking: 'granted', 'prompt' or 'denied'.
    function queryAccess(handle, mode) {
        if (!handle || typeof handle.queryPermission !== 'function') {
            return Promise.resolve('prompt');
        }
        return handle.queryPermission({ mode: mode }).catch(function () { return 'prompt'; });
    }

    // Asks for read (or read and write) permission; must run right after a click.
    function requestAccess(handle, mode) {
        if (!handle || typeof handle.requestPermission !== 'function') {
            return Promise.resolve(false);
        }
        return handle.requestPermission({ mode: mode }).then(function (result) {
            return result === 'granted';
        }, function () { return false; });
    }

    // Reads a remembered file. Resolves with { name, text, handle }.
    function readHandle(handle) {
        return handle.getFile().then(function (file) {
            return file.text().then(function (text) {
                return { name: file.name, text: text, handle: handle };
            });
        });
    }

    return {
        canWriteBack: canWriteBack,
        rememberFile: rememberFile,
        recallFile: recallFile,
        forgetFile: forgetFile,
        sameFile: sameFile,
        queryAccess: queryAccess,
        requestAccess: requestAccess,
        readHandle: readHandle,
        appendLog: appendLog,
        writeFile: writeHandle,
        requestWrite: requestWrite,
        pickFile: pickFile,
        readFile: readFile,
        openCollection: openCollection,
        saveCollection: saveCollection,
        saveAs: saveAs,
        backup: backup,
        download: download
    };
})();
