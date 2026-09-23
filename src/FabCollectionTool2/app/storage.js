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

    // Opens a collection file. Resolves with { name, text, handle } or null if cancelled.
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

    return {
        canWriteBack: canWriteBack,
        appendLog: appendLog,
        pickFile: pickFile,
        readFile: readFile,
        openCollection: openCollection,
        saveCollection: saveCollection,
        saveAs: saveAs,
        backup: backup,
        download: download
    };
})();
