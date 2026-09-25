/*
 * storage.js - opening and saving files. The collection lives in a file chosen by the user
 * (e.g. in a OneDrive folder for a cloud backup); the browser keeps only a copy (see below).
 *
 * Where the browser supports it (Chrome, Edge), the opened file is written back in place, and
 * a working folder can be chosen once: collection, change log and diagnosis log then lie
 * together in it, and one permission of the browser covers all of them. Otherwise (e.g.
 * Firefox) saving works as a download.
 */
FCT.storage = (function () {

    // True if files can be written back directly (File System Access API).
    var canWriteBack = window.isSecureContext === true &&
        typeof window.showOpenFilePicker === 'function';

    var CSV_TYPES = [{ description: 'CSV-Datei', accept: { 'text/csv': ['.csv'] } }];

    // True if a working folder can be used (directory access, Chrome and Edge).
    var canUseFolder = canWriteBack && typeof window.showDirectoryPicker === 'function';

    // Dialogs start in the working folder, if there is one.
    var startFolder = null;

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
            return window.showOpenFilePicker(withStart({ types: CSV_TYPES }))
                .then(function (handles) {
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

    // Adds the working folder as start of a file dialog.
    function withStart(options) {
        if (startFolder) options.startIn = startFolder;
        return options;
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

    // Asks for a file name and location (or downloads, if the browser cannot do that). The
    // dialog starts in the working folder, or in the folder of startIn (a file handle).
    function saveAs(suggestedName, text, startIn) {
        if (canWriteBack && typeof window.showSaveFilePicker === 'function') {
            var options = withStart({ suggestedName: suggestedName, types: CSV_TYPES });
            if (!options.startIn && startIn) options.startIn = startIn;
            return window.showSaveFilePicker(options).then(function (handle) {
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
    // a download of the complete log (fullText) under the same name every time, so that it
    // can replace the previous file. Resolves with { name, handle, method } or null if the
    // user cancelled. makeText(existingText) returns the complete new file content.
    function appendLog(suggestedName, handle, makeText, fullText) {
        if (canWriteBack && typeof window.showSaveFilePicker === 'function') {
            var ready = handle ? Promise.resolve(handle) : window.showSaveFilePicker(withStart({
                suggestedName: suggestedName, types: CSV_TYPES
            }));
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
        download(suggestedName, fullText);
        return Promise.resolve({ name: suggestedName, handle: null, method: 'download' });
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

    // Any other value kept in the browser (e.g. the diagnosis log); failures are ignored.
    function rememberValue(key, value) {
        if (!window.indexedDB) return Promise.resolve(false);
        return withStore('readwrite', function (store) {
            return store.put(value, key);
        }).then(function () { return true; }, function () { return false; });
    }

    function recallValue(key) {
        if (!window.indexedDB) return Promise.resolve(null);
        return withStore('readonly', function (store) {
            return store.get(key);
        }).then(function (value) { return value == null ? null : value; },
            function () { return null; });
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

    /*
     * Working folder (Chrome/Edge). Its handle is remembered in IndexedDB. Handles of files
     * inside it are always taken from the folder, so that the folder's permission covers them.
     */
    var FOLDER = 'folder';

    // Lets the user choose the working folder; resolves with its handle or null if cancelled.
    function chooseFolder() {
        var options = { id: 'fct-folder', mode: 'readwrite' };
        if (startFolder) options.startIn = startFolder;
        return window.showDirectoryPicker(options).then(function (handle) {
            startFolder = handle;
            return handle;
        }, cancelled);
    }

    function rememberFolder(handle) {
        startFolder = handle || null;
        if (!window.indexedDB) return Promise.resolve(false);
        return withStore('readwrite', function (store) {
            return handle ? store.put(handle, FOLDER) : store.delete(FOLDER);
        }).then(function () { return true; }, function () { return false; });
    }

    function recallFolder() {
        if (!window.indexedDB || !canUseFolder) return Promise.resolve(null);
        return withStore('readonly', function (store) {
            return store.get(FOLDER);
        }).then(function (handle) {
            startFolder = handle || null;
            return handle || null;
        }, function () { return null; });
    }

    // Handle of a file directly in the folder; create makes it if missing.
    function folderFile(folder, name, create) {
        return folder.getFileHandle(name, { create: !!create });
    }

    // True if a file lies directly in the folder (not in a subfolder).
    function inFolder(folder, handle) {
        if (!folder || !handle || typeof folder.resolve !== 'function') {
            return Promise.resolve(false);
        }
        return folder.resolve(handle).then(function (path) {
            return !!path && path.length === 1;
        }, function () { return false; });
    }

    // Text and size of a file in the folder ('' and 0 if it does not exist yet).
    function readFolderFile(folder, name) {
        return folder.getFileHandle(name).then(function (handle) {
            return handle.getFile().then(function (file) {
                return file.text().then(function (text) {
                    return { text: text, size: file.size };
                });
            });
        }, function () { return { text: '', size: 0 }; });
    }

    // Writes a file into the folder (created if missing).
    function writeFolderFile(folder, name, text) {
        return folderFile(folder, name, true).then(function (handle) {
            return writeHandle(handle, text).then(function () { return handle; });
        });
    }

    // Appends text to a file in the folder, keeping the old content.
    function appendFolderFile(folder, name, text) {
        return folderFile(folder, name, true).then(function (handle) {
            return handle.createWritable({ keepExistingData: true }).then(function (w) {
                return handle.getFile().then(function (file) {
                    return w.seek(file.size);
                }).then(function () {
                    return w.write(text);
                }).then(function () { return w.close(); });
            });
        });
    }

    // Names of the files directly in the folder, sorted.
    function listFolder(folder) {
        var names = [];
        var entries = folder.values();
        function next() {
            return entries.next().then(function (step) {
                if (step.done) return names.sort();
                if (step.value.kind === 'file') names.push(step.value.name);
                return next();
            });
        }
        return next();
    }

    // Removes a file from the folder if it exists.
    function removeFolderFile(folder, name) {
        return folder.removeEntry(name).catch(function () {});
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
        canUseFolder: canUseFolder,
        rememberValue: rememberValue,
        recallValue: recallValue,
        chooseFolder: chooseFolder,
        rememberFolder: rememberFolder,
        recallFolder: recallFolder,
        folderFile: folderFile,
        inFolder: inFolder,
        readFolderFile: readFolderFile,
        writeFolderFile: writeFolderFile,
        appendFolderFile: appendFolderFile,
        removeFolderFile: removeFolderFile,
        listFolder: listFolder,
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
