/*
 * app.js - wiring of the user interface: state, toolbar, row actions, edit mode, reference
 * data, change log, view settings, status and messages.
 */
FCT.app = (function () {
    var util = FCT.util;
    var el = util.el;
    var model = FCT.model;
    var settings = FCT.settings;
    var changelog = FCT.changelog;

    // Application state. The collection lives in its file; the browser keeps only a copy.
    var state = {
        collection: model.create(),
        file: null,            // { name, handle, inFolder } of the opened or last saved file
        folder: null,          // handle of the working folder (Chrome/Edge), see ensureFolder
        folderAccess: false,   // the browser allows writing into the working folder
        logHandle: null,       // file handle of the change log (Chrome/Edge), access checked
        logCandidate: null,    // remembered log file handle, access not yet checked
        dirty: false,
        shownRows: [],         // collection plus gap rows, as passed to the grid
        editMode: false,
        writable: false,       // the opened file may be written without asking (autosave)
        openedText: null,      // file content when opened, offered as backup
        backupOffered: false,
        autosaveChoice: null,  // autosave decision for the open file: 'on', 'off' or null
        fileText: null,        // file content when last read or written (to notice changes)
        fromCopy: false,       // shown from the browser copy, not yet connected to the file
        autosave: { timer: null, running: false, saved: null, error: '' },
        clipboard: null,       // copied row, see onAction('copy')
        reference: { info: null, online: false, loading: false, error: '' }
    };
    var grid = null;

    function $(id) { return document.getElementById(id); }

    /*
     * Columns. The order is the one of the old spreadsheet; the default view shows the
     * columns asked for in the feedback on 2.0.0.0. Widths are in em, so they follow the
     * font size.
     */
    var DEFAULT_COLUMNS = ['Set', 'Edition', 'Id', 'Rarity', 'Talent', 'Class1', 'Class2',
        'Type1', 'Type2', 'Sub1', 'Sub2', 'Sub3', 'Name', 'Pitch', 'Playset', 'ST', 'RF', 'CF',
        'GF', '_haveSet', '_needSet', '_leftSet', '_haveTotal', '_needTotal', '_leftTotal'];
    var WIDTHS = {
        Set: 12, Edition: 5.5, Id: 5.5, 'First In': 5, Rarity: 6.5, Talent: 6.5, Class1: 7.5,
        Class2: 6.5, Type1: 7.5, Type2: 6, Sub1: 5.5, Sub2: 5, Sub3: 4.5, Name: 16,
        'Translated Name': 14, 'Backside Name': 12, 'Translated Backside Name': 12, Pitch: 4.5,
        Peculiarity: 7, 'Art Treatment': 8.5, Note: 15
    };
    var STEP_WIDTH = 5.5;
    var CALC_WIDTH = 5.5;

    function calc(key) {
        return function (row) { return row._calc ? String(row._calc[key]) : ''; };
    }

    function buildColumns() {
        var columns = model.COLUMNS.filter(function (key) {
            return model.columnKind(key) !== 'internal';
        }).map(function (key) {
            var numeric = model.NUMBER_COLUMNS.indexOf(key) >= 0;
            return {
                key: key, label: key, numeric: numeric, kind: model.columnKind(key),
                step: numeric, width: numeric ? STEP_WIDTH : WIDTHS[key] || 7,
                list: model.choices(key) !== null
            };
        });

        // Calculated columns follow the quantities, as in the old spreadsheet.
        var calculated = [
            { key: '_haveThis', label: 'Have (this)', value: calc('have') },
            { key: '_haveSet', label: 'Have (set)', value: calc('haveSet') },
            { key: '_needSet', label: 'Need (set)', value: calc('needSet') },
            { key: '_leftSet', label: 'Left (set)', value: calc('leftSet') },
            { key: '_haveTotal', label: 'Have (total)', value: calc('haveTotal') },
            { key: '_needTotal', label: 'Need (total)', value: calc('needTotal') },
            { key: '_leftTotal', label: 'Left (total)', value: calc('leftTotal') }
        ].map(function (c) {
            c.numeric = true;
            c.kind = 'calc';
            c.width = CALC_WIDTH;
            return c;
        });
        var types = { key: '_types', label: 'Typen (Stammdaten)', width: 16, kind: 'calc',
            value: function (row) { return FCT.reference.types(row.Id); } };

        var keys = columns.map(function (c) { return c.key; });
        var at = keys.indexOf('GF') + 1;
        var note = keys.indexOf('Note');
        var all = columns.slice(0, at).concat(calculated, columns.slice(at, note),
            columns.slice(note), [types]);

        // Visibility: as last chosen by the user, otherwise the default view.
        var visible = settings.get('columns', DEFAULT_COLUMNS);
        all.forEach(function (c) { c.hidden = visible.indexOf(c.key) < 0; });
        return all;
    }

    /*
     * View and status
     */

    // Recalculates everything and shows the current rows. Sets that occur in the collection
    // are shown complete: missing printings appear as gap rows at their place.
    function rebuild() {
        var rows = model.withGaps(state.collection);
        state.shownRows = rows;
        model.calculate(rows);
        rows.forEach(markProblems);
        grid.setRows(rows);
        updateStatus();
    }

    // Marks rows with unknown card numbers or invalid numbers for the colour mark and filter.
    function markProblems(row) {
        row._unknownId = !!row.Id && !FCT.reference.printings(row.Id).length;
        row._problem = !row._reference && (!row.Id || row._unknownId ||
            model.NUMBER_COLUMNS.some(function (c) { return isNaN(util.toInt(row[c])); }));
    }

    function updateStatus() {
        var totals = model.totals(state.collection.rows);
        var gaps = state.shownRows.length - state.collection.rows.length;
        var name = state.file ? state.file.name : 'kein Bestand geöffnet';
        $('status-file').textContent = name + (state.dirty ? ' • ungespeicherte Änderungen' : '');
        $('status-file').className = state.dirty ? 'dirty' : '';
        $('status-rows').textContent = totals.rows.toLocaleString('de-DE') +
            ' Zeilen im Bestand · ' + totals.cards.toLocaleString('de-DE') + ' Karten · ' +
            Math.max(0, gaps).toLocaleString('de-DE') + ' fehlende Drucke · ' +
            grid.viewCount().toLocaleString('de-DE') + ' angezeigt';
        updateSaveStatus();
        $('status-clipboard').textContent = state.clipboard
            ? 'Kopiert: ' + state.clipboard.Id + ' ' + state.clipboard.Name : '';
    }

    // Marks the collection as changed (or saved). Every change starts the autosave timer.
    // The first change is also the moment to ask the browser for write access if it is still
    // missing: it runs within the click or key press of the change, and the browser's question
    // "Save changes?" then fits what just happened.
    function setDirty(dirty) {
        state.dirty = dirty;
        updateStatus();
        if (dirty && needsWriteAccess()) guarded(function () {
            return askFileAccess('readwrite');
        })();
        else if (dirty) scheduleAutosave();
        if (dirty && state.writable && state.logCandidate) ensureLogAccess(true);
        rememberCurrent();
    }

    // Asks before unsaved changes would be lost.
    function confirmDiscard() {
        return !state.dirty ||
            window.confirm('Es gibt ungespeicherte Änderungen. Trotzdem fortfahren?');
    }

    // Replaces the collection. The change log starts over with it.
    function setCollection(collection, file, dirty) {
        state.collection = collection;
        state.file = file;
        state.logHandle = null;
        state.logCandidate = null;
        state.writable = false;
        state.openedText = null;
        state.backupOffered = false;
        state.autosaveChoice = null;
        state.fileText = null;
        state.fromCopy = false;
        clearTimeout(state.autosave.timer);
        state.autosave = { timer: null, running: false, saved: null, error: '', denied: false };
        state.dirty = !!dirty;
        changelog.clear();
        rebuild();
    }

    /*
     * Messages: every report is shown in the message area, newest first.
     */
    function renderReport(report) {
        var levels = { error: 'Fehler', warn: 'Hinweis', info: 'Info' };
        var groups = report.groups.map(function (g) {
            var summary = el('summary', {}, [
                el('span', { className: 'level ' + g.level, text: levels[g.level] }),
                ' ' + g.category + ' (' + g.count.toLocaleString('de-DE') + ')'
            ]);
            var more = g.count > g.examples.length
                ? el('li', { className: 'more', text: '… und ' + (g.count - g.examples.length) +
                    ' weitere' })
                : null;
            var list = el('ul', {}, g.examples.map(function (e) {
                return el('li', { text: e });
            }).concat([more]));
            return el('details', { className: 'group' }, [summary, list]);
        });
        return el('div', { className: 'report' }, [
            el('h3', { text: report.title + ' – ' + new Date().toLocaleTimeString('de-DE') }),
            el('ul', { className: 'summary' }, report.summary.map(function (s) {
                return el('li', { text: s });
            }))
        ].concat(groups.length || report.summary.length ? groups
            : [el('p', { text: 'Keine Auffälligkeiten.' })]));
    }

    function showReport(report) {
        var box = $('messages-list');
        box.insertBefore(renderReport(report), box.firstChild);
        showPane('messages');
    }

    function showMessage(title, text) {
        var report = FCT.createReport(title);
        report.summary.push(text);
        showReport(report);
    }

    // Shows one of the two panes (messages or change log) and expands the area.
    function showPane(name) {
        var log = name === 'log';
        $('messages-list').hidden = log;
        $('log-list').hidden = !log;
        $('tab-messages').classList.toggle('active', !log);
        $('tab-log').classList.toggle('active', log);
        setMessagesCollapsed(false);
        if (log) renderLog();
    }

    function setMessagesCollapsed(collapsed) {
        $('messages').classList.toggle('collapsed', collapsed);
        var side = !document.body.classList.contains('msg-bottom');
        $('messages-toggle').textContent = collapsed ? (side ? '›' : '▴') : (side ? '‹' : '▾');
        if (grid) grid.refresh();
    }

    // Position of the message area: bottom, left or right.
    function setMessagesPosition(position) {
        document.body.classList.remove('msg-bottom', 'msg-left', 'msg-right');
        document.body.classList.add('msg-' + position);
        $('messages-position').value = position;
        settings.set('messagesPosition', position);
        setMessagesCollapsed($('messages').classList.contains('collapsed'));
    }

    /*
     * Change log pane: newest entries first, by day; also the entries of earlier sessions
     * (see loadLog). Each entry can jump to its row, and a changed cell can be undone.
     */
    var LOG_SHOWN = 1000;
    var UNDOABLE = ['Geändert', 'Zurückgesetzt', 'Stammdaten übernommen', 'Rückgängig'];
    var logPending = false;

    function renderLog() {
        updateSaveStatus();
        var entries = changelog.entries();
        var open = changelog.pending().length;
        $('tab-log').textContent = 'Protokoll (' + entries.length +
            (open ? ' · ' + open + ' offen' : '') + ')';
        var box = $('log-list');
        if (box.hidden) return;
        box.textContent = '';
        if (!entries.length) {
            box.appendChild(el('p', { className: 'hint', text: 'Noch keine Änderungen. ' +
                'Jede Änderung am Bestand wird hier und beim Speichern in einer ' +
                'Protokolldatei festgehalten.' }));
            return;
        }
        // Rows by card number, to find the row of an entry quickly.
        var byId = new Map();
        state.collection.rows.forEach(function (row) {
            if (!byId.has(row.Id)) byId.set(row.Id, []);
            byId.get(row.Id).push(row);
        });
        var list = el('ul', { className: 'log' });
        var day = null;
        entries.slice(-LOG_SHOWN).reverse().forEach(function (e) {
            var date = e.time.slice(0, 10);
            if (date !== day) {
                day = date;
                list.appendChild(el('li', { className: 'day', text: dayLabel(date) }));
            }
            list.appendChild(logItem(e, byId));
        });
        box.appendChild(list);
        if (entries.length > LOG_SHOWN) {
            box.appendChild(el('p', { className: 'hint', text: 'Ältere Einträge stehen in ' +
                'der Protokolldatei.' }));
        }
    }

    // "heute", "gestern" or the date of a day of the log.
    function dayLabel(date) {
        function iso(d) {
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
                String(d.getDate()).padStart(2, '0');
        }
        var today = new Date();
        var yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
        if (date === iso(today)) return 'Heute';
        if (date === iso(yesterday)) return 'Gestern';
        var parts = date.split('-');
        return parts.length === 3 ? parts[2] + '.' + parts[1] + '.' + parts[0] : date;
    }

    // One entry of the log with its buttons.
    function logItem(e, byId) {
        var what = e.column
            ? e.column + ': „' + e.old + '“ → „' + e.new + '“'
            : (e.new || e.old);
        var row = logRow(e, byId);
        var buttons = [];
        if (row) {
            buttons.push(el('button', { type: 'button', className: 'log-action',
                text: 'Zur Zeile', title: 'Die Zeile in der Tabelle zeigen',
                onclick: function () { grid.select(row); grid.focus(); } }));
        }
        if (row && e.column && UNDOABLE.indexOf(e.action) >= 0) {
            buttons.push(el('button', { type: 'button', className: 'log-action',
                text: '↶ Rückgängig', title: e.column + ' wieder auf „' + e.old + '“ setzen',
                onclick: guarded(function () { undoEntry(e, row); }) }));
        }
        return el('li', {}, [
            el('span', { className: 'time', text: e.time.slice(11) }),
            ' ',
            el('strong', { text: e.action }),
            ' ' + [e.id, e.name, e.variant].filter(Boolean).join(' · '),
            buttons.length ? el('span', { className: 'log-actions' }, buttons) : null,
            what ? el('div', { className: 'what', text: what }) : null
        ]);
    }

    // The row a log entry is about: same card number and variant, preferably the same name.
    function logRow(e, byId) {
        var rows = (byId.get(e.id) || []).filter(function (row) {
            return changelog.variant(row) === e.variant;
        });
        return rows.filter(function (row) { return row.Name === e.name; })[0] || rows[0] || null;
    }

    // Undoes a changed cell, if it still has the value the entry set.
    function undoEntry(e, row) {
        var current = row[e.column] == null ? '' : String(row[e.column]);
        if (current !== e.new) {
            showMessage('Rückgängig nicht möglich', e.id + ' ' + e.column + ' wurde inzwischen ' +
                'geändert (jetzt „' + current + '“). Bitte direkt in der Tabelle anpassen.');
            grid.select(row);
            return;
        }
        changeCell(row, e.column, e.old, 'Rückgängig');
        FCT.log.info('log', 'Rückgängig', { id: e.id, column: e.column });
        setDirty(true);
        rebuild();
        grid.select(row);
    }

    // Many changes in a row (e.g. applying reference data) redraw the pane only once.
    function scheduleLog() {
        if (logPending) return;
        logPending = true;
        window.requestAnimationFrame(function () {
            logPending = false;
            renderLog();
        });
    }

    /*
     * Dialog: one modal dialog for import previews, row editing and information.
     * Resolves with the value of the chosen button, or 'cancel' for Escape.
     */
    function openDialog(options) {
        var dialog = $('dialog');
        $('dialog-title').textContent = options.title;
        var body = $('dialog-body');
        body.textContent = '';
        body.appendChild(options.body);
        $('dialog-hint').textContent = options.hint || '';
        dialog.classList.toggle('wide', !!options.wide);
        var menu = $('dialog-buttons');
        menu.textContent = '';

        return new Promise(function (resolve) {
            // The buttons are handled directly; the dialog's close event is not reliable.
            function finish(value, event) {
                if (event) event.preventDefault();
                dialog.removeEventListener('cancel', onCancel);
                dialog.removeEventListener('mousedown', onOutside);
                if (dialog.open) dialog.close();
                if (grid) grid.focus();
                resolve(value);
            }
            function onCancel(event) { finish('cancel', event); }

            // A click next to the dialog (on the dimmed background) cancels it, like the
            // drop-down menus.
            function onOutside(event) {
                var box = dialog.getBoundingClientRect();
                var inside = event.clientX >= box.left && event.clientX <= box.right &&
                    event.clientY >= box.top && event.clientY <= box.bottom;
                if (event.target === dialog && !inside) finish('cancel', event);
            }
            dialog.addEventListener('mousedown', onOutside);
            options.buttons.forEach(function (b) {
                var button = el('button', {
                    type: 'button', text: b.label, disabled: !!b.disabled,
                    className: [b.primary ? 'primary' : '', b.left ? 'left' : ''].join(' '),
                    onclick: function (event) {
                        if (b.onClick) { b.onClick(event); return; }
                        finish(b.value, event);
                    }
                });
                menu.appendChild(button);
            });
            dialog.addEventListener('cancel', onCancel);
            // Elements in the body can close the dialog with a value of their own.
            if (options.setup) options.setup(function (value) { finish(value); });
            dialog.showModal();
        });
    }

    // Shows an import preview and resolves true if the user accepts it.
    function preview(report, canAccept) {
        return openDialog({
            title: 'Vorschau',
            body: renderReport(report),
            hint: 'Mit „Übernehmen“ ersetzt der Import den geöffneten Bestand.',
            buttons: [
                { label: 'Abbrechen', value: 'cancel' },
                { label: 'Übernehmen', value: 'accept', primary: true, disabled: !canAccept }
            ]
        }).then(function (value) { return value === 'accept'; });
    }

    // Runs an action and reports unexpected errors instead of failing silently.
    function guarded(action) {
        return function () {
            Promise.resolve().then(action).catch(function (error) {
                FCT.log.error('app', 'Fehler bei einer Aktion', error);
                showMessage('Fehler', error && error.message ? error.message : String(error));
            });
        };
    }

    /*
     * File actions
     */
    function newCollection() {
        if (!confirmDiscard()) return;
        setCollection(model.create(), null, false);
        FCT.log.info('file', 'Neuer leerer Bestand');
    }

    // Shows a collection read from a file ({ name, text, handle, inFolder }). Resolves true
    // if loaded.
    function loadCollection(result) {
        var loaded = model.fromCsv(result.text);
        if (!loaded.collection) { showReport(loaded.report); return false; }
        setCollection(loaded.collection, { name: result.name, handle: result.handle,
            inFolder: !!result.inFolder }, false);
        state.openedText = result.text;
        state.fileText = withoutBom(result.text);
        updateStatus();
        showReport(loaded.report);
        showReport(model.validate(state.collection, 'Prüfung des Bestands'));
        FCT.log.info('file', 'Bestand geladen', { name: result.name, inFolder: !!result.inFolder,
            rows: state.collection.rows.length, chars: result.text.length });
        rememberCurrent();
        return true;
    }

    /*
     * Opens a collection: from the working folder (a list of its collections) or with the
     * file dialog. For the file opened last time the autosave decision is kept; for any other
     * file ("a new collection") the question comes again. The earlier change log of the
     * collection is loaded, so it goes on. The file is remembered for the next start.
     */
    function open() {
        if (!confirmDiscard()) return null;
        return ensureFolder().then(function () {
            return hasFolder() ? pickFromFolder() : FCT.storage.openCollection();
        }).then(function (result) {
            return result ? openResult(result) : null;
        });
    }

    function openResult(result) {
        return placeFile(result).then(function (placed) {
            if (!loadCollection(placed)) return null;
            FCT.notices.clear('restore');
            return FCT.storage.recallFile().then(function (last) {
                return last ? FCT.storage.sameFile(last.handle, placed.handle)
                    .then(function (same) { return same ? last : null; }) : null;
            }).then(function (last) {
                // The same file as last time keeps its autosave decision and its log file.
                if (last) state.logCandidate = last.logHandle || null;
                return loadLog(last).then(function () {
                    return askAutosave(placed.handle, last ? last.autosave || null : null);
                });
            });
        }).then(function () {
            updateStatus();
            grid.focus();
        });
    }

    /*
     * Working folder (feedback on 2.0.2.0, decided 24.09.2026). Chosen once (Chrome/Edge), it
     * holds the collection, its change log <name>-log.csv, backups and the diagnosis log
     * fct-diagnose.log. One permission of the browser for the folder covers all of them: the
     * log file no longer has to be chosen, and after a restart one question is enough. Files
     * in the folder are always reached through the folder (see placeFile). Other browsers
     * save as downloads, as before.
     */
    var folderSkipped = false;   // "without working folder" was chosen in this session

    // True if the working folder is known and may be written.
    function hasFolder() {
        return !!(state.folder && state.folderAccess);
    }

    // True if the open collection lies in the working folder and the folder may be written.
    function fileInFolder() {
        return !!(state.file && state.file.inFolder && hasFolder());
    }

    function setFolder(handle, access) {
        state.folder = handle || null;
        state.folderAccess = !!(handle && access);
        updateFolderStatus();
        if (state.folderAccess) FCT.diagnosis.schedule();
    }

    function updateFolderStatus() {
        var box = $('status-folder');
        var button = $('btn-folder');
        button.hidden = !FCT.storage.canUseFolder;
        if (!state.folder) {
            box.textContent = FCT.storage.canUseFolder ? 'kein Arbeitsordner' : '';
            button.title = 'Arbeitsordner für Bestand, Protokoll und Backups wählen';
            return;
        }
        box.textContent = 'Ordner: ' + state.folder.name +
            (state.folderAccess ? '' : ' (nicht verbunden)');
        button.title = 'Arbeitsordner: ' + state.folder.name + ' – klicken zum Ändern';
    }

    // Asks for the working folder the first time it is needed, with an explanation. A folder
    // remembered from earlier sessions only needs the browser's permission again.
    function ensureFolder() {
        if (state.folder && !state.folderAccess) return requestFolderAccess();
        if (!FCT.storage.canUseFolder || state.folder || folderSkipped) {
            return Promise.resolve(state.folder);
        }
        return openDialog({
            title: 'Arbeitsordner festlegen',
            body: el('div', {}, [
                el('p', { text: 'Bestand, Änderungsprotokoll, Backups und Diagnose-Log liegen ' +
                    'künftig zusammen in einem Ordner, z. B. in deinem OneDrive. Du wählst ' +
                    'ihn einmal; danach fragt die Anwendung nicht mehr nach einzelnen Dateien.' }),
                el('p', { text: 'Der Browser fragt anschließend, ob die Anwendung Dateien in ' +
                    'diesem Ordner ansehen und bearbeiten darf – bitte erlauben.' })
            ]),
            hint: 'Der Ordner lässt sich jederzeit über „Ordner …“ (Gruppe Bestand) ändern.',
            buttons: [
                { label: 'Ohne Arbeitsordner', value: 'skip' },
                { label: 'Ordner wählen …', value: 'choose', primary: true }
            ]
        }).then(function (value) {
            if (value !== 'choose') { folderSkipped = true; return null; }
            return chooseFolder();
        });
    }

    // Lets the user choose (or change) the working folder.
    function chooseFolder() {
        return FCT.storage.chooseFolder().then(function (handle) {
            if (!handle) return null;
            FCT.storage.rememberFolder(handle);
            setFolder(handle, true);
            FCT.log.info('folder', 'Arbeitsordner gewählt', handle.name);

            // The open collection may lie in the new folder.
            var file = state.file;
            var check = file && file.handle
                ? placeFile({ name: file.name, handle: file.handle })
                : Promise.resolve(null);
            return check.then(function (placed) {
                if (state.file) {
                    state.file.inFolder = !!(placed && placed.inFolder);
                    if (state.file.inFolder) {
                        state.file.handle = placed.handle;
                        state.writable = true;
                    }
                }
                rememberCurrent();
                updateStatus();
                FCT.notices.show('folder', 'ok', 'Arbeitsordner: ' + handle.name);
                return handle;
            });
        });
    }

    // Asks the browser again for access to the remembered folder (only right after a click).
    function requestFolderAccess() {
        var folder = state.folder;
        return FCT.storage.requestAccess(folder, 'readwrite').then(function (granted) {
            FCT.log.info('folder', 'Zugriff auf den Arbeitsordner ' +
                (granted ? 'erlaubt' : 'abgelehnt'), folder.name);
            setFolder(folder, granted);
            if (!granted) return null;
            return deriveFileHandle().then(function () { return folder; });
        });
    }

    // Takes the handle of the open collection from the folder, so its permission covers it.
    function deriveFileHandle() {
        if (!hasFolder() || !state.file || !state.file.inFolder) return Promise.resolve();
        return FCT.storage.folderFile(state.folder, state.file.name, false).then(function (h) {
            state.file.handle = h;
        }, function () {
            // The file is no longer in the folder (moved or renamed).
            state.file.inFolder = false;
            FCT.log.warn('folder', 'Bestand nicht mehr im Arbeitsordner', state.file.name);
        });
    }

    // Relates a picked file to the working folder: a file directly in it gets its handle
    // from the folder and result.inFolder = true.
    function placeFile(result) {
        if (!hasFolder() || !result.handle) return Promise.resolve(result);
        return FCT.storage.inFolder(state.folder, result.handle).then(function (inside) {
            if (!inside) return result;
            return FCT.storage.folderFile(state.folder, result.name, false).then(function (h) {
                result.handle = h;
                result.inFolder = true;
                return result;
            });
        });
    }

    // The collections in the working folder, to open with one click; others via the dialog.
    function pickFromFolder() {
        return FCT.storage.listFolder(state.folder).then(function (names) {
            var files = names.filter(function (name) {
                return /\.csv$/i.test(name) && !/-log\.csv$/i.test(name) &&
                    !/-backup-/i.test(name);
            });
            var choose = null;
            var list = el('ul', { className: 'folder-files' }, files.map(function (name) {
                return el('li', {}, [el('button', { type: 'button', text: name,
                    onclick: function () { choose(name); } })]);
            }));
            return openDialog({
                title: 'Bestand öffnen – Ordner ' + state.folder.name,
                body: files.length ? list
                    : el('p', { text: 'Im Arbeitsordner liegt noch kein Bestand.' }),
                setup: function (done) { choose = done; },
                hint: 'Eine Datei außerhalb des Arbeitsordners öffnet „Andere Datei …“; ihr ' +
                    'Protokoll wird dann beim ersten Speichern gesondert gefragt.',
                buttons: [
                    { label: 'Abbrechen', value: 'cancel' },
                    { label: 'Andere Datei …', value: 'other' }
                ]
            });
        }).then(function (value) {
            if (value === 'cancel') return null;
            if (value === 'other') return FCT.storage.openCollection();
            return FCT.storage.folderFile(state.folder, value, false)
                .then(FCT.storage.readHandle).then(function (result) {
                    result.inFolder = true;
                    return result;
                });
        });
    }

    // Name of a new collection file in the working folder; false if cancelled.
    function askFileName() {
        var input = el('input', { type: 'text', size: '30' });
        input.value = (state.file && state.file.name) || 'collection.csv';
        var done = null;
        input.addEventListener('keydown', function (event) {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            done('save');
        });
        return openDialog({
            title: 'Bestand speichern – Ordner ' + state.folder.name,
            body: el('label', {}, ['Dateiname: ', input]),
            setup: function (finish) { done = finish; },
            buttons: [
                { label: 'Abbrechen', value: 'cancel' },
                { label: 'Speichern', value: 'save', primary: true }
            ]
        }).then(function (value) {
            var name = input.value.trim();
            if (value !== 'save' || !name) return false;
            if (!/\.csv$/i.test(name)) name += '.csv';
            return FCT.storage.folderFile(state.folder, name, false).then(function () {
                return window.confirm(name + ' gibt es im Arbeitsordner schon. Überschreiben?')
                    ? name : false;
            }, function () { return name; });
        });
    }

    // File name of the change log of the open collection, e.g. collection-log.csv.
    function logName() {
        var base = String(state.file ? state.file.name : 'collection.csv').replace(/\.csv$/i, '');
        return base + '-log.csv';
    }

    /*
     * Loads the earlier change log of the opened collection: from its log file in the
     * working folder, otherwise from the browser copy (if it is the same file as last time).
     */
    function loadLog(last) {
        if (fileInFolder()) {
            return FCT.storage.readFolderFile(state.folder, logName()).then(function (file) {
                var records = file.text.trim() ? FCT.csv.parse(withoutBom(file.text)) : [];
                if (records.length && records[0].join('|') === changelog.HEADER.join('|')) {
                    changelog.load(records.slice(1));
                }
            }).catch(function (error) {
                FCT.log.warn('log', 'Protokolldatei nicht lesbar', error);
            });
        }
        if (last && last.log) changelog.load(last.log, last.logWritten);
        return Promise.resolve();
    }

    /*
     * Copy of the last collection in the browser (decided 23.09.2026). After every load,
     * save and change (shortly delayed), the current collection is written to IndexedDB
     * together with its file handle and autosave decision. At the next start it is shown
     * at once; the file stays the original (see restoreLast / connectFile).
     */
    var COPY_DELAY = 1000;
    var copyTimer = null;

    // File texts are compared without byte order mark: the app writes one, but the browser
    // drops it when reading.
    function withoutBom(text) {
        return text && text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
    }

    function rememberCurrent() {
        clearTimeout(copyTimer);
        copyTimer = setTimeout(writeCopy, COPY_DELAY);
    }

    function writeCopy() {
        copyTimer = null;
        // An empty new collection without a file does not replace the remembered one.
        if (!state.file && !state.collection.rows.length) return;
        FCT.storage.rememberFile({
            name: state.file ? state.file.name : '',
            handle: state.file ? state.file.handle : null,
            inFolder: !!(state.file && state.file.inFolder),
            log: changelog.toRecords(changelog.entries()),
            logWritten: changelog.written(),
            logHandle: state.logHandle || state.logCandidate || null,
            autosave: state.autosaveChoice,
            text: model.toCsv(state.collection),
            fileText: state.fileText,
            updated: new Date().toISOString()
        });
    }

    /*
     * Start-up: the copy of the last collection is shown at once. Then the app connects to
     * its file: automatically if the browser still allows access (e.g. "allow on every
     * visit"), otherwise with one click on "Mit Datei verbinden", because the browser only
     * asks for permission after a click.
     */
    function restoreLast() {
        return FCT.storage.recallFile().then(function (last) {
            if (!last || !last.text) return null;
            var loaded = model.fromCsv(last.text);
            if (!loaded.collection) return null;
            var copyChanged = last.fileText != null &&
                model.toCsv(model.fromCsv(last.fileText).collection || model.create()) !==
                last.text;
            setCollection(loaded.collection, last.name ? { name: last.name,
                handle: last.handle || null, inFolder: !!last.inFolder } : null,
                copyChanged || !last.handle);
            changelog.load(last.log || [], last.logWritten);
            state.fileText = last.fileText;
            state.openedText = last.fileText;
            state.logCandidate = last.logHandle || null;
            state.autosaveChoice = last.autosave || null;
            state.fromCopy = true;
            updateStatus();
            var when = last.updated ? new Date(last.updated).toLocaleString('de-DE') : '';
            showMessage('Bestand wiederhergestellt', (last.name || 'Bestand ohne Datei') +
                ' wurde aus der Kopie im Browser geladen' + (when ? ' (Stand ' + when + ')' : '') +
                '. Die Datei bleibt das Original.');
            if (loaded.report.groups.length) showReport(loaded.report);
            FCT.log.info('file', 'Kopie aus dem Browser geladen', { name: last.name,
                rows: state.collection.rows.length, inFolder: !!last.inFolder,
                changed: copyChanged });
            if (!last.handle) {
                showRestoreNotice(last, null, FCT.storage.canWriteBack
                    ? 'Dieser Bestand ist noch mit keiner Datei verbunden – bitte speichern.'
                    : 'Angezeigt wird die Kopie im Browser. Dieser Browser kann nicht direkt in ' +
                        'die Datei schreiben; Strg+S speichert wie gewohnt als Download.');
                return null;
            }

            // A collection in the working folder: one permission for the folder is enough.
            if (last.inFolder && state.folder) {
                if (state.folderAccess) {
                    return deriveFileHandle().then(function () {
                        last.handle = state.file.handle;
                        return connectFile(last, true);
                    });
                }
                showRestoreNotice(last, 'readwrite', 'Angezeigt wird die Kopie im Browser. ' +
                    'Ein Klick verbindet den Arbeitsordner ' + state.folder.name + ' (der ' +
                    'Browser fragt einmal nach dem Zugriff); sonst fragt er bei der ersten ' +
                    'Änderung.');
                return null;
            }
            var mode = last.autosave === 'on' ? 'readwrite' : 'read';
            return FCT.storage.queryAccess(last.handle, mode).then(function (access) {
                if (access === 'granted') return connectFile(last, mode === 'readwrite');

                // Diagnosis: "Allow on every visit" should make the browser answer "granted"
                // here. If it does not, the browser did not keep the permission.
                FCT.log.info('file', 'Zugriffsstatus beim Start', { name: last.name,
                    access: access });
                showRestoreNotice(last, mode, 'Angezeigt wird die Kopie im Browser. Der ' +
                    'Browser fragt bei der ersten Änderung nach dem Dateizugriff.');
                return null;
            });
        }).catch(function (error) {
            FCT.log.error('file', 'Kopie aus dem Browser nicht ladbar', error);
            return null;
        });
    }

    // Notice at the top: which copy is shown, with "connect" and "forget".
    function showRestoreNotice(last, mode, text) {
        var buttons = [];
        if (mode) {
            buttons.push({ label: last.inFolder && state.folder ? 'Arbeitsordner verbinden'
                : 'Mit Datei verbinden', primary: true,
                onClick: guarded(function () { return askFileAccess(mode); }) });
        }
        buttons.push({ label: 'Kopie vergessen',
            title: 'Kopie im Browser löschen; beim nächsten Start startet die App leer',
            onClick: function () {
                FCT.storage.forgetFile();
                FCT.notices.clear('restore');
            } });
        FCT.notices.show('restore', 'warn', ['Bestand ', el('strong',
            { text: last.name || '(ohne Datei)' }), ': ' + text], {
            buttons: buttons,
            hint: mode ? 'Der Browser verlangt für den Dateizugriff einen Klick. Erlaubt er ' +
                'ihn dauerhaft („Bei jedem Besuch zulassen“), verbindet sich die App künftig ' +
                'von selbst.' : null
        });
    }

    // Notice while the browser asks for write access, so that its question makes sense.
    function showPermissionNotice(viaFolder) {
        FCT.notices.show('permission', 'warn', viaFolder
            ? 'Der Browser fragt gerade, ob die Anwendung Dateien im Ordner „' +
                state.folder.name + '“ bearbeiten darf. Das ist die Erlaubnis für Bestand, ' +
                'Protokoll und Backups in diesem Ordner – bitte erlauben.'
            : 'Der Browser fragt gerade „Änderungen speichern?“ („Save changes?“). Das ist nur ' +
                'die Erlaubnis für das automatische Speichern dieser Datei – es wird noch ' +
                'nichts gespeichert. Mit „Speichern“ bzw. „Bearbeiten erlauben“ bestätigen.',
            { closable: false });
    }

    /*
     * Asks the browser for access to the file of the shown collection. The browser only
     * asks right after a click or key press, so this runs from the banner button, the
     * autosave button, or the first change (see setDirty). A collection shown from the
     * browser copy is compared with its file first (connectFile).
     */
    var askingAccess = false;

    function askFileAccess(mode) {
        var handle = state.file && state.file.handle;
        if (!handle || askingAccess) return null;
        askingAccess = true;
        var viaFolder = !!(state.file.inFolder && state.folder);
        var target = viaFolder ? state.folder : handle;
        if (viaFolder) mode = 'readwrite';
        var last = { handle: handle, name: state.file.name, autosave: state.autosaveChoice,
            logHandle: state.logCandidate, inFolder: viaFolder };
        if (mode === 'readwrite') showPermissionNotice(viaFolder);
        return FCT.storage.requestAccess(target, mode).then(function (granted) {
            FCT.notices.clear('permission');
            FCT.log.info('file', 'Zugriff ' + (granted ? 'erlaubt' : 'abgelehnt'), {
                name: state.file.name, mode: mode, viaFolder: viaFolder });
            if (viaFolder) setFolder(state.folder, granted);
            if (!granted) {
                state.autosave.denied = true;
                updateStatus();
                showMessage('Datei', 'Der Browser hat den Zugriff auf ' + (viaFolder
                    ? 'den Arbeitsordner ' + state.folder.name : state.file.name) +
                    ' nicht erlaubt. Strg+S speichert wie bisher; „Automatisch speichern“ in ' +
                    'der Statuszeile fragt erneut.');
                return null;
            }
            return (viaFolder ? deriveFileHandle() : Promise.resolve()).then(function () {
                last.handle = state.file.handle;
                if (mode === 'readwrite') ensureLogAccess(true);
                if (state.fromCopy) return connectFile(last, mode === 'readwrite');
                state.writable = mode === 'readwrite';
                state.autosave.denied = false;
                updateStatus();
                if (state.dirty) scheduleAutosave();
                return null;
            });
        }).then(function (result) {
            askingAccess = false;
            return result;
        }, function (error) {
            askingAccess = false;
            throw error;
        });
    }

    /*
     * The remembered log file (state.logCandidate) is used again once the browser allows
     * writing it. Chrome usually grants it together with the collection file (its question
     * lists both). allowAsk: may ask the browser (only right after a click or key press);
     * otherwise the candidate is kept for later. If the browser refuses, the log file has to
     * be chosen again ("Protokolldatei festlegen").
     */
    function ensureLogAccess(allowAsk) {
        var handle = state.logCandidate;
        if (!handle || state.logHandle || fileInFolder()) return Promise.resolve();
        return FCT.storage.queryAccess(handle, 'readwrite').then(function (access) {
            if (access === 'granted') return true;
            return allowAsk ? FCT.storage.requestAccess(handle, 'readwrite') : null;
        }).then(function (granted) {
            if (granted === null || state.logCandidate !== handle) return;
            state.logCandidate = null;
            if (granted) {
                state.logHandle = handle;
                if (state.writable && changelog.pending().length) writeLog(false);
            }
            updateSaveStatus();
        });
    }

    // True if autosave is wanted but the browser has not been asked for write access yet.
    function needsWriteAccess() {
        return FCT.storage.canWriteBack && !!(state.file && state.file.handle) &&
            state.autosaveChoice !== 'off' && !state.writable && !state.autosave.denied;
    }

    /*
     * Connects the shown copy with its file. If the file is unchanged since the copy was
     * made, the copy (including changes made meanwhile) stays and autosave takes over. If the
     * file was changed elsewhere, the file wins - unless the copy has changes of its own;
     * then the user decides.
     */
    function connectFile(last, writable) {
        return FCT.storage.readHandle(last.handle).then(function (result) {
            FCT.notices.clear('restore');
            FCT.log.info('file', 'Mit Datei verbunden', { name: result.name,
                unchanged: withoutBom(result.text) === state.fileText, dirty: state.dirty });
            state.fromCopy = false;
            state.writable = writable;
            if (writable) ensureLogAccess(false);
            if (withoutBom(result.text) === state.fileText) {
                updateStatus();
                if (state.dirty) scheduleAutosave();
                showMessage('Mit Datei verbunden', result.name + ' ist verbunden.' +
                    (canAutosave() ? ' Automatisches Speichern ist an.' : ''));
                return null;
            }
            if (!state.dirty) return reloadFromFile(result, last, writable);
            return openDialog({
                title: 'Datei wurde außerhalb geändert',
                body: el('p', { text: result.name + ' wurde seit dem letzten Stand außerhalb ' +
                    'der Anwendung geändert, und die Kopie im Browser hat eigene, noch nicht ' +
                    'gespeicherte Änderungen.' }),
                buttons: [
                    { label: 'Datei laden (Änderungen der Kopie verwerfen)', value: 'file' },
                    { label: 'Kopie behalten (Datei wird überschrieben)', value: 'copy',
                        primary: true }
                ]
            }).then(function (choice) {
                if (choice === 'file') return reloadFromFile(result, last, writable);
                state.fileText = withoutBom(result.text);
                updateStatus();
                scheduleAutosave();
                return null;
            });
        }, function (error) {
            FCT.log.warn('file', 'Datei nicht lesbar', error);
            showMessage('Datei', last.name + ' ließ sich nicht lesen (' + error.message +
                '). Wurde die Datei verschoben? Die Kopie bleibt angezeigt; bitte über ' +
                '„Öffnen“ laden oder speichern.');
        });
    }

    function reloadFromFile(result, last, writable) {
        if (!loadCollection(result)) return null;
        state.autosaveChoice = last.autosave || null;
        state.logCandidate = last.logHandle || null;
        state.writable = writable;
        if (writable) ensureLogAccess(false);
        showMessage('Mit Datei verbunden', result.name + ' wurde außerhalb geändert und neu ' +
            'geladen.');
        updateStatus();
        return null;
    }

    /*
     * Permission for automatic saving (Chrome/Edge). The browser asks with its own question
     * "Save changes?" / "Änderungen speichern?", which is confusing without context. So the
     * app explains it first. The decision belongs to the file: reopening the same file keeps
     * it, opening another collection asks again. With 'on' the browser still has to ask after
     * every opening - a security rule of the browser; a banner then explains its question.
     */
    function askAutosave(handle, choice) {
        if (!FCT.storage.canWriteBack || !handle) return null;
        state.autosaveChoice = choice;
        if (choice === 'off') { rememberCurrent(); return null; }

        // In the working folder the permission is there already: only the decision counts.
        if (fileInFolder()) {
            state.writable = true;
            var asked = choice === 'on' ? Promise.resolve('on') : openDialog({
                title: 'Automatisch speichern?',
                body: el('p', { text: 'Die Anwendung kann jede Änderung sofort in die Datei im ' +
                    'Arbeitsordner speichern – du musst dann nie mehr an Strg+S denken. Die ' +
                    'Entscheidung gilt für diesen Bestand und lässt sich jederzeit über ' +
                    '„Automatisch speichern“ in der Statuszeile ändern.' }),
                buttons: [
                    { label: 'Nein, ich speichere selbst', value: 'off' },
                    { label: 'Ja, automatisch speichern', value: 'on', primary: true }
                ]
            });
            return asked.then(function (value) {
                if (value === 'on' || value === 'off') state.autosaveChoice = value;
                rememberCurrent();
                updateStatus();
            });
        }
        var decided = choice === 'on' ? Promise.resolve('on') : openDialog({
            title: 'Automatisch speichern?',
            body: el('div', {}, [
                el('p', { text: 'Die Anwendung kann jede Änderung sofort in die geöffnete ' +
                    'Datei speichern – du musst dann nie mehr an Strg+S denken.' }),
                el('p', { text: 'Dafür braucht sie die Erlaubnis des Browsers. Der Browser ' +
                    'fragt gleich selbst „Änderungen speichern?“ (englisch „Save changes?“). ' +
                    'Diese Frage bedeutet: Darf die Anwendung diese Datei automatisch ' +
                    'speichern? Es wird dabei noch nichts gespeichert.' }),
                el('p', { text: 'Die Entscheidung gilt für diesen Bestand und wird gemerkt; ' +
                    'sie lässt sich jederzeit über „Automatisch speichern“ in der Statuszeile ' +
                    'ändern. Bei einem anderen Bestand fragt die Anwendung erneut. Die Frage ' +
                    'des Browsers kommt nach jedem Öffnen wieder; das schreibt der Browser ' +
                    'aus Sicherheitsgründen vor.' })
            ]),
            buttons: [
                { label: 'Nein, ich speichere selbst', value: 'off' },
                { label: 'Ja, automatisch speichern', value: 'on', primary: true }
            ]
        });
        return decided.then(function (value) {
            if (value === 'on' || value === 'off') state.autosaveChoice = value;
            rememberCurrent();
            return value === 'on' ? requestAutosave(handle) : null;
        });
    }

    // Asks the browser for write permission; a banner explains its question meanwhile.
    function requestAutosave(handle) {
        showPermissionNotice(false);
        return FCT.storage.requestWrite(handle).then(function (granted) {
            FCT.notices.clear('permission');
            FCT.log.info('file', 'Erlaubnis für automatisches Speichern ' +
                (granted ? 'erteilt' : 'verweigert'));
            state.writable = granted;
            state.autosave.denied = !granted;
            if (granted) ensureLogAccess(true);
            if (!granted) {
                showMessage('Automatisches Speichern', 'Der Browser hat die Erlaubnis nicht ' +
                    'erteilt. Strg+S speichert wie bisher; „Automatisch speichern“ in der ' +
                    'Statuszeile fragt erneut.');
            }
            updateStatus();
        });
    }

    // Button in the status line: switches automatic saving on or off (remembered per file).
    function toggleAutosave() {
        if (state.autosaveChoice !== 'off' && canAutosave()) {
            state.autosaveChoice = 'off';
            rememberCurrent();
            clearTimeout(state.autosave.timer);
            updateStatus();
            return null;
        }
        state.autosaveChoice = 'on';
        state.autosave.denied = false;
        rememberCurrent();
        var handle = state.file && state.file.handle;
        if (handle && !state.writable) return askFileAccess('readwrite');
        updateStatus();
        if (state.dirty) scheduleAutosave();
        return null;
    }

    /*
     * Saves the collection and then the new change log entries. A collection without a file
     * goes into the working folder (the name is asked for), or - without a folder - wherever
     * the user chooses in the file dialog.
     */
    function save() {
        clearTimeout(state.autosave.timer);
        var text = '﻿' + model.toCsv(state.collection);
        var started = Date.now();
        var target = state.file && state.file.handle ? Promise.resolve(null)
            : ensureFolder().then(function () { return hasFolder() ? askFileName() : null; });
        return target.then(function (name) {
            if (name === false) return null;
            if (name) {
                return FCT.storage.writeFolderFile(state.folder, name, text)
                    .then(function (handle) {
                        return { name: name, handle: handle, method: 'file', inFolder: true };
                    });
            }
            return FCT.storage.saveCollection(text, state.file).then(function (result) {
                return result && result.handle ? placeFile(result) : result;
            });
        }).then(function (result) {
            if (!result) return null;
            state.file = { name: result.name, handle: result.handle,
                inFolder: !!result.inFolder };
            state.writable = result.method === 'file';
            state.autosave.saved = new Date();
            state.autosave.error = '';
            FCT.notices.clear('autosave');
            FCT.log.info('file', 'Gespeichert', { name: result.name, method: result.method,
                inFolder: !!result.inFolder, chars: text.length, ms: Date.now() - started });
            if (result.method === 'file') {
                state.fileText = withoutBom(text);
                state.fromCopy = false;
                FCT.notices.clear('restore');
            }
            setDirty(false);
            rememberCurrent();
            showMessage('Gespeichert', result.method === 'file'
                ? result.name + ' wurde gespeichert.' + (canAutosave()
                    ? ' Weitere Änderungen werden automatisch gespeichert (abschaltbar in ' +
                        'der Statuszeile).' : '')
                : result.name + ' wurde als Download gespeichert (Download-Ordner des Browsers).');
            return saveLog(true);
        });
    }

    /*
     * Automatic saving (Chrome/Edge only): after each change and 1.5 s without further
     * changes, the collection is written into its file and new change log entries are
     * appended to the log file. The browser allows this only for a file the user opened or
     * saved with write permission; otherwise saving stays manual.
     */
    var AUTOSAVE_DELAY = 1500;

    function canAutosave() {
        return FCT.storage.canWriteBack && state.autosaveChoice !== 'off' &&
            state.writable && !!(state.file && state.file.handle);
    }

    function scheduleAutosave() {
        if (!canAutosave()) return;
        clearTimeout(state.autosave.timer);
        state.autosave.timer = setTimeout(autosave, AUTOSAVE_DELAY);
        updateSaveStatus();
    }

    function autosave() {
        var auto = state.autosave;
        auto.timer = null;
        if (!canAutosave() || !state.dirty) return;
        if (auto.running) { scheduleAutosave(); return; }
        auto.running = true;
        var text = '﻿' + model.toCsv(state.collection);
        var started = Date.now();
        FCT.storage.writeFile(state.file.handle, text).then(function () {
            auto.saved = new Date();
            auto.error = '';
            state.dirty = false;
            state.fileText = withoutBom(text);
            FCT.notices.clear('autosave');
            FCT.log.debug('file', 'Automatisch gespeichert', { name: state.file.name,
                chars: text.length, ms: Date.now() - started });
            rememberCurrent();
            offerOpenedBackup();
            return fileInFolder() || state.logHandle || state.logCandidate
                ? saveLog(false) : null;
        }).catch(function (error) {
            auto.error = error && error.message ? error.message : String(error);
            FCT.log.error('file', 'Automatisches Speichern fehlgeschlagen', error);
            FCT.notices.show('autosave', 'error', 'Automatisches Speichern fehlgeschlagen: ' +
                auto.error, { buttons: [{ label: 'Jetzt speichern', primary: true,
                    onClick: guarded(save) }], closable: true });
        }).then(function () {
            auto.running = false;
            updateStatus();
        });
    }

    // Save state in the status line: pending, saved, or failed (in red).
    function updateSaveStatus() {
        var auto = state.autosave;
        var box = $('status-save');
        var text = '';
        var cls = '';
        if (!FCT.storage.canWriteBack) {
            text = 'Automatisches Speichern ist in diesem Browser nicht möglich – Strg+S ' +
                'speichert (als Download).';
        } else if (auto.error) {
            text = 'Automatisches Speichern fehlgeschlagen: ' + auto.error + ' – Strg+S';
            cls = 'dirty';
        } else if (canAutosave()) {
            text = auto.timer || auto.running ? 'wird gespeichert …'
                : auto.saved ? 'automatisch gespeichert ' + auto.saved.toLocaleTimeString('de-DE')
                    : 'automatisches Speichern aktiv';
        } else if (state.autosaveChoice === 'off') {
            text = 'Automatisches Speichern ist aus – Strg+S speichert.';
        } else if (state.file && state.file.handle && auto.denied) {
            text = 'Keine Erlaubnis zum automatischen Speichern – Strg+S speichert; der Knopf ' +
                'daneben fragt erneut.';
        } else if (state.file && state.file.handle) {
            text = 'Automatisches Speichern: Der Browser fragt bei der ersten Änderung nach der ' +
                'Erlaubnis („Änderungen speichern?“).';
        } else if (state.collection.rows.length) {
            text = 'Automatisches Speichern startet nach dem ersten Speichern (Strg+S).';
        }
        box.textContent = text;
        box.className = cls;

        // Switch for automatic saving (only where the browser supports it).
        var toggle = $('btn-autosave');
        toggle.hidden = !FCT.storage.canWriteBack;
        var on = state.autosaveChoice !== 'off';
        toggle.textContent = 'Automatisch speichern: ' + (!on ? 'aus'
            : state.file && state.file.handle && !state.writable ? 'jetzt erlauben' : 'an');
        toggle.setAttribute('aria-pressed', String(on));
        $('btn-log-file').hidden = !(canAutosave() && !fileInFolder() && !state.logHandle &&
            !state.logCandidate && changelog.pending().length);
    }

    // After the first automatic save, the state as opened can be kept as a backup.
    function offerOpenedBackup() {
        if (state.backupOffered || state.openedText == null) return;
        state.backupOffered = true;
        var text = state.openedText;
        var name = state.file.name;
        var button = el('button', { type: 'button', text: 'Stand beim Öffnen als Backup sichern',
            onclick: guarded(function () {
                return writeBackup(text, name).then(function (result) {
                    if (result) showMessage('Backup erstellt', result.name);
                });
            }) });
        var box = $('messages-list');
        box.insertBefore(el('div', { className: 'report' }, [
            el('h3', { text: 'Automatisch gespeichert – ' +
                new Date().toLocaleTimeString('de-DE') }),
            el('p', { text: name + ' wird ab jetzt nach jeder Änderung gespeichert. Der Stand ' +
                'beim Öffnen lässt sich vorher noch als Backup sichern:' }),
            button
        ]), box.firstChild);
        showPane('messages');
    }

    /*
     * Log file: <collection>-log.csv, with the latest changelog.LIMIT entries. In the working
     * folder it is written without any question. Otherwise (Chrome/Edge) the user chooses it
     * once; it is remembered with the collection and used again as soon as the browser
     * allows it. interactive = false (autosave) writes only into a known log file, silently.
     */
    function saveLog(interactive) {
        if (fileInFolder()) return writeFolderLog(interactive);
        if (!state.logHandle && state.logCandidate) {
            return ensureLogAccess(interactive).then(function () {
                return state.logHandle || interactive ? writeLog(interactive) : null;
            });
        }
        return writeLog(interactive);
    }

    function writeLog(interactive) {
        var pending = changelog.pending();
        if (!pending.length) return null;
        var base = String(state.file ? state.file.name : 'collection.csv').replace(/\.csv$/i, '');
        var header = changelog.HEADER;
        var records = changelog.toRecords(pending);

        // Complete file content: existing lines plus the new ones, the latest ones only.
        function makeText(existing) {
            return logText(existing, records, 'Die gewählte Datei');
        }
        var newOnly = '﻿' + FCT.csv.stringify([header].concat(records));

        var ask = Promise.resolve('choose');
        if (!interactive && !state.logHandle) return null;
        if (interactive && FCT.storage.canWriteBack && !state.logHandle) {
            ask = openDialog({
                title: 'Änderungsprotokoll speichern',
                body: el('p', { text: pending.length + ' neue Einträge. Das Protokoll liegt ' +
                    'in einer eigenen Datei neben dem Bestand. Bitte die bisherige ' +
                    'Protokolldatei wählen (die neuen Einträge werden angehängt, auch wenn ' +
                    'der Browser „Ersetzen“ anbietet) oder einen neuen Namen vergeben.' }),
                hint: 'Die Datei wird für diese Sitzung gemerkt.',
                buttons: [
                    { label: 'Diesmal nicht', value: 'cancel' },
                    { label: 'Protokolldatei wählen …', value: 'choose', primary: true }
                ]
            });
        }
        return ask.then(function (choice) {
            if (choice !== 'choose') return null;
            return FCT.storage.appendLog(base + '-log.csv', state.logHandle, makeText, newOnly);
        }).then(function (result) {
            if (!result) {
                showMessage('Protokoll', 'Das Änderungsprotokoll wurde nicht gespeichert; ' +
                    'die Einträge bleiben erhalten und werden beim nächsten Speichern ' +
                    'geschrieben.');
                return;
            }
            state.logHandle = result.handle;
            state.logCandidate = null;
            rememberCurrent();
            changelog.markWritten(pending[pending.length - 1]);
            renderLog();
            updateSaveStatus();
            if (interactive) {
                showMessage('Protokoll gespeichert', records.length + ' Einträge → ' +
                    result.name);
            }
        });
    }

    // Text of a log file: the existing records (checked to be a log of this app) plus the
    // new ones, limited to the latest changelog.LIMIT entries.
    function logText(existing, records, what) {
        var header = changelog.HEADER;
        var old = existing.trim() ? FCT.csv.parse(withoutBom(existing)) : [header];
        if (old[0].join('|') !== header.join('|')) {
            throw new Error(what + ' ist kein Änderungsprotokoll dieser Anwendung und wurde ' +
                'nicht verändert.');
        }
        var kept = old.slice(1).filter(function (r) { return r.length >= header.length; });
        return '﻿' + FCT.csv.stringify([header].concat(
            changelog.fileRecords(kept, records)));
    }

    // Writes the new change log entries into the log file in the working folder.
    function writeFolderLog(interactive) {
        var pending = changelog.pending();
        if (!pending.length) return Promise.resolve();
        var name = logName();
        return FCT.storage.readFolderFile(state.folder, name).then(function (file) {
            var text = logText(file.text, changelog.toRecords(pending), name);
            return FCT.storage.writeFolderFile(state.folder, name, text);
        }).then(function () {
            changelog.markWritten(pending[pending.length - 1]);
            rememberCurrent();
            renderLog();
            updateSaveStatus();
            if (interactive) {
                showMessage('Protokoll gespeichert', pending.length + ' Einträge → ' + name);
            }
        });
    }

    // Button in the status line: choose the log file once, then autosave writes it too.
    function chooseLogFile() {
        return saveLog(true);
    }

    // Writes a backup: into the working folder without a dialog, otherwise as before.
    function writeBackup(text, name) {
        if (!hasFolder()) return FCT.storage.backup(text, name);
        var file = String(name || 'collection.csv').replace(/\.csv$/i, '') + '-backup-' +
            util.timestamp() + '.csv';
        return FCT.storage.writeFolderFile(state.folder, file, text).then(function () {
            FCT.log.info('file', 'Backup im Arbeitsordner', file);
            return { name: file + ' (im Arbeitsordner ' + state.folder.name + ')' };
        });
    }

    function backup() {
        var text = '﻿' + model.toCsv(state.collection);
        return writeBackup(text, state.file && state.file.name).then(function (result) {
            if (result) showMessage('Backup erstellt', result.name);
        });
    }

    // Common flow of both imports: pick file, convert, preview, accept.
    function runImport(accept, convert) {
        if (!confirmDiscard()) return null;
        return FCT.storage.pickFile(accept).then(function (file) {
            if (!file) return null;
            $('busy').hidden = false;
            return Promise.resolve(convert(file)).then(function (result) {
                $('busy').hidden = true;
                if (result.collection) {
                    model.reportPlaysets(result.report,
                        model.keepPlaysets(result.collection.rows));
                    var check = model.validate(result.collection);
                    check.groups.forEach(function (g) { result.report.groups.push(g); });
                }
                FCT.log.info('import', 'Import gelesen', { file: file.name,
                    rows: result.collection ? result.collection.rows.length : 0,
                    errors: result.report.count('error') });
                return preview(result.report, !!result.collection).then(function (ok) {
                    showReport(result.report);
                    FCT.log.info('import', ok ? 'Import übernommen' : 'Import verworfen');
                    if (!ok) return;
                    setCollection(result.collection, null, true);
                    changelog.add('Import', null, '', '', file.name + ' – ' +
                        result.collection.rows.length + ' Zeilen');
                    showMessage('Import übernommen', 'Der Bestand ist noch nicht gespeichert. ' +
                        'Bitte „Speichern“ wählen, um ihn als CSV-Datei abzulegen.');
                });
            }, function (error) {
                $('busy').hidden = true;
                FCT.log.error('import', 'Import fehlgeschlagen', error);
                throw error;
            });
        });
    }

    function importOds() {
        return runImport('.ods', function (file) {
            return file.arrayBuffer().then(FCT.importOds.importOds);
        });
    }

    function importFabrary() {
        return runImport('.csv,text/csv', function (file) {
            return file.text().then(FCT.importFabrary.importFabrary);
        });
    }

    function exportFabrary() {
        var result = FCT.exportFabrary.exportFabrary(state.collection);
        FCT.storage.download('fabrary-' + util.timestamp() + '.csv', result.text);
        FCT.log.info('export', 'Fabrary-Export', { chars: result.text.length });
        showReport(result.report);
    }

    /*
     * Changing cells. Every change goes through changeCell, so that overrides and the
     * change log are always kept up to date.
     */

    // Sets one cell. A reference column that now differs from the reference data is marked
    // as changed on purpose; one that matches again loses the mark.
    function changeCell(row, key, value, action) {
        var old = row[key] == null ? '' : String(row[key]);
        if (old === value) return false;
        if (row._reference) adoptReferenceRow(row);
        row[key] = value;
        if (model.columnKind(key) === 'reference') {
            var expected = FCT.reference.expected(row);
            model.setOverride(row, key, model.deviates(row, key, expected));
        }
        changelog.add(action || 'Geändert', row, key, old, value);
        return true;
    }

    // Called by the grid after a cell was edited or a quantity button was pressed.
    function onEdit(row, key, value) {
        if (!changeCell(row, key, value)) return;
        rebuildCalculationOnly();
        setDirty(true);
    }

    // Which cells can be edited: the user's input always, everything else in edit mode, and
    // marked deviations from the reference data also outside edit mode (see model).
    function isEditable(column, row) {
        if (column.kind === 'calc') return false;
        return model.isEditable(row, column.key, state.editMode);
    }

    // Value of the reference data for a cell, offered first in its drop-down (or null).
    function referenceValue(column, row) {
        if (model.columnKind(column.key) !== 'reference') return null;
        var expected = FCT.reference.expected(row);
        return expected ? expected[column.key] : null;
    }

    // Marks of a row: locally changed reference values, deviations from the reference data
    // and unknown card numbers.
    function rowMarks(row) {
        var marks = {};
        if (row._unknownId) {
            marks.Id = { className: 'unknown', title: 'Kartennummer nicht in den Stammdaten' };
        }
        if (row._reference) return marks;
        var expected = FCT.reference.expected(row);
        var overridden = model.overrides(row);
        model.REFERENCE_COLUMNS.forEach(function (column) {
            var want = expected ? '„' + expected[column] + '“' : 'unbekannt';
            if (overridden.indexOf(column) >= 0) {
                marks[column] = { className: 'override',
                    title: 'Lokal geändert – Stammdaten: ' + want + '\nKlicken zum Ändern' };
            } else if (model.deviates(row, column, expected)) {
                marks[column] = { className: 'stale',
                    title: 'Weicht von den Stammdaten ab: ' + want +
                        '\nKlicken zum Korrigieren' };
            }
        });
        return marks;
    }

    // Status symbol at the row start: what is special about this row, in one character.
    function rowStatus(row) {
        if (row._reference) {
            return { symbol: '○', className: 'gap', title: 'Noch nicht im Bestand. ' +
                'Eine Menge eintragen, − / + oder ＋ nimmt den Druck in den Bestand auf.' };
        }
        if (row._unknownId) {
            return { symbol: '?', className: 'unknown',
                title: 'Kartennummer nicht in den Stammdaten' };
        }
        var diffs = model.differences(row);
        var overridden = model.overrides(row);
        if (!diffs.length && !overridden.length) return null;
        var lines = [];
        if (diffs.length) {
            lines.push('Weicht von den Stammdaten ab (Klick: ansehen und übernehmen):');
            diffs.forEach(function (d) {
                lines.push('  ' + d.column + ': „' + d.value + '“ → „' + d.want + '“');
            });
        }
        if (overridden.length) lines.push('Lokal geändert: ' + overridden.join(', '));
        return {
            symbol: diffs.length ? '≠' : '✱',
            className: diffs.length ? 'differs' : 'override',
            title: lines.join('\n')
        };
    }

    // Quick filters of the application (in addition to those of the grid).
    function matchesMode(row, mode) {
        if (mode === 'differs') return !row._reference && model.differences(row).length > 0;
        if (mode === 'gaps') return !!row._reference;
        if (mode === 'collection') return !row._reference;
        return true;
    }

    // Values for the drop-downs of the edit mode.
    function choices(column) {
        return model.choices(column.key, state.collection.rows);
    }

    // Title and release date of a set group, e.g. "Monarch (MON)". The code is the most
    // frequent set code of the group's rows.
    function setInfo(name, rows) {
        var counts = new Map();
        rows.forEach(function (row) {
            var code = model.setCode(row.Id);
            if (code) counts.set(code, (counts.get(code) || 0) + 1);
        });
        var code = '';
        var most = 0;
        counts.forEach(function (count, c) { if (count > most) { code = c; most = count; } });
        return { label: code ? name + ' (' + code + ')' : name,
            date: code ? FCT.reference.setDate(code) : '' };
    }

    // Recalculates all shown rows without filtering again.
    function rebuildCalculationOnly() {
        model.calculate(state.shownRows);
        state.shownRows.forEach(markProblems);
        grid.refresh();
        updateStatus();
    }

    // A reference row becomes a real row as soon as it is edited. It is placed after the
    // last row of the same set, so that the file keeps its order.
    function adoptReferenceRow(row) {
        delete row._reference;
        var rows = state.collection.rows;
        var at = -1;
        for (var i = rows.length - 1; i >= 0; i--) {
            if (rows[i].Id.slice(0, 3) === row.Id.slice(0, 3) && rows[i].Id <= row.Id) {
                at = i;
                break;
            }
        }
        rows.splice(at + 1 || rows.length, 0, row);
        changelog.add('Übernommen', row, '', '', 'aus den Stammdaten in den Bestand');
    }

    /*
     * Row actions at the end of each row
     */
    function rowActions(row) {
        if (row._reference) {
            return [
                { action: 'edit', icon: 'edit', title: 'Bearbeiten und in den Bestand übernehmen' },
                { action: 'adopt', icon: 'insert', title: 'In den Bestand übernehmen' }
            ];
        }
        var copied = state.clipboard;
        return [
            { action: 'edit', icon: 'edit', title: 'Zeile bearbeiten (alle Felder)' },
            { action: 'insert', icon: 'insert', title: 'Neue Zeile darunter einfügen' },
            { action: 'copy', icon: 'copy', title: 'Zeile kopieren' },
            { action: 'paste', icon: 'paste', disabled: !copied,
                title: copied ? 'Kopie von ' + copied.Id + ' ' + copied.Name +
                    ' darunter einfügen (ohne Mengen)' : 'Erst eine Zeile kopieren' },
            { action: 'remove', icon: 'remove', title: 'Zeile löschen' }
        ];
    }

    // Inserts a row directly below another one and shows it.
    function insertBelow(row, newRow, action) {
        var rows = state.collection.rows;
        rows.splice(rows.indexOf(row) + 1, 0, newRow);
        changelog.add(action, newRow, '', '', 'unter ' + [row.Id, row.Name].join(' '));
        setDirty(true);
        rebuild();
        grid.select(newRow);
    }

    // A full copy of a row, including extra columns of the file.
    function copyRow(row) {
        var copy = model.newRow(row);
        state.collection.extraColumns.forEach(function (c) { copy[c] = row[c]; });
        return copy;
    }

    function onAction(action, row) {
        if (action === 'edit' || action === 'status') {
            editRow(row);
        } else if (action === 'adopt') {
            adoptReferenceRow(row);
            setDirty(true);
            rebuild();
            grid.select(row);
        } else if (action === 'insert') {
            // The new row keeps set, talent and classes, so it stays in the same group.
            insertBelow(row, model.newRow({ Set: row.Set, Talent: row.Talent,
                Class1: row.Class1, Class2: row.Class2, Playset: row.Playset }), 'Eingefügt');
        } else if (action === 'copy') {
            state.clipboard = copyRow(row);
            updateStatus();
            grid.refresh();
        } else if (action === 'paste' && state.clipboard) {
            // Typical use: the same card in another language or treatment, so no quantities.
            var copy = copyRow(state.clipboard);
            model.QUANTITIES.forEach(function (q) { copy[q] = ''; });
            insertBelow(row, copy, 'Kopie eingefügt');
        } else if (action === 'remove') {
            removeRow(row);
        }
    }

    function removeRow(row) {
        var label = [row.Id, row.Name].filter(Boolean).join(' ') || '(leere Zeile)';
        if (!window.confirm('Zeile „' + label + '“ löschen?')) return;
        var rows = state.collection.rows;
        rows.splice(rows.indexOf(row), 1);
        var quantities = model.QUANTITIES.map(function (q) {
            return q + '=' + (row[q] || 0);
        }).join(' ');
        changelog.add('Gelöscht', row, '', quantities, '');
        setDirty(true);
        rebuild();
    }

    // Input element of the row dialog: a drop-down for columns with a value list (the
    // current value is kept even if it is not in the list), a text field otherwise.
    function fieldInput(key, value, kind) {
        var list = model.choices(key, state.collection.rows);
        if (!list) {
            var text = el('input', { type: 'text', className: 'k-' + kind });
            text.value = value;
            return text;
        }
        var select = el('select', { className: 'k-' + kind });
        [''].concat(list).forEach(function (v) {
            select.appendChild(el('option', { value: v, text: v || '–' }));
        });
        setField(select, value);
        return select;
    }

    // Sets the value of a dialog field; a drop-down gets the value as option if missing.
    function setField(input, value) {
        if (input.tagName === 'SELECT' && !Array.prototype.some.call(input.options,
            function (o) { return o.value === value; })) {
            input.appendChild(el('option', { value: value, text: value }));
        }
        input.value = value;
    }

    /*
     * Row dialog: all fields of a row; for reference columns the value of the reference data
     * is shown next to it and can be restored per field or for all fields at once.
     */
    function editRow(row) {
        var expected = FCT.reference.expected(row);
        var overridden = model.overrides(row);
        var inputs = {};

        var lines = model.COLUMNS.filter(function (key) {
            return model.columnKind(key) !== 'internal';
        }).map(function (key) {
            var kind = model.columnKind(key);
            var input = fieldInput(key, row[key] || '', kind);
            inputs[key] = input;

            var reference = '';
            var reset = null;
            if (kind === 'reference' && expected) {
                reference = expected[key];
                reset = el('button', {
                    type: 'button', className: 'reset', text: '↺',
                    title: 'Auf den Stammdatenwert zurücksetzen',
                    onclick: function () {
                        setField(input, expected[key]);
                        input.setAttribute('data-reset', '1');
                        mark();
                    }
                });
            }

            // Marks fields whose value differs from the reference data.
            function mark() {
                var probe = {};
                probe[key] = input.value;
                var differs = kind === 'reference' && model.deviates(probe, key, expected);
                input.classList.toggle('override', differs);
                if (reset) reset.disabled = !differs;
            }
            input.addEventListener('input', mark);
            input.addEventListener('change', mark);
            mark();

            var label = key + (overridden.indexOf(key) >= 0 ? ' *' : '');
            return el('tr', {}, [
                el('th', { text: label }),
                el('td', {}, [input]),
                el('td', { className: 'reference', text: reference }),
                el('td', {}, [reset])
            ]);
        });

        var table = el('table', { className: 'row-form' }, [
            el('thead', {}, [el('tr', {}, [el('th', { text: 'Feld' }),
                el('th', { text: 'Wert' }), el('th', { text: 'Stammdaten' }), el('th')])]),
            el('tbody', {}, lines)
        ]);
        var hint = expected
            ? '* = lokal geändert. Geänderte Stammdatenfelder bleiben beim Übernehmen von ' +
                'Stammdaten erhalten, bis sie zurückgesetzt werden.'
            : 'Zu dieser Kartennummer gibt es keine Stammdaten.';

        // Puts the reference values into the fields: only the deviating ones (keeping local
        // changes), or all of them (also undoing local changes).
        function takeReference(all) {
            if (!expected) return;
            model.REFERENCE_COLUMNS.forEach(function (key) {
                if (key === 'Backside Name' && !expected[key]) return;
                if (!all && overridden.indexOf(key) >= 0) return;
                if (inputs[key].value === expected[key]) return;
                setField(inputs[key], expected[key]);
                inputs[key].setAttribute('data-reset', '1');
                inputs[key].dispatchEvent(new Event('input'));
            });
        }

        return openDialog({
            title: [row.Id, row.Name].filter(Boolean).join(' – ') || 'Neue Zeile',
            body: table,
            hint: hint,
            wide: true,
            buttons: [
                { label: 'Abweichungen übernehmen', disabled: !expected, left: true,
                    onClick: function () { takeReference(false); } },
                { label: 'Alles zurücksetzen', disabled: !expected, left: true,
                    onClick: function () { takeReference(true); } },
                { label: 'Abbrechen', value: 'cancel' },
                { label: 'Übernehmen', value: 'accept', primary: true }
            ]
        }).then(function (value) {
            if (value !== 'accept') return;
            var changed = false;
            Object.keys(inputs).forEach(function (key) {
                var input = inputs[key];
                var action = input.getAttribute('data-reset') ? 'Zurückgesetzt' : 'Geändert';
                if (changeCell(row, key, input.value, action)) changed = true;
            });
            if (!changed) return;
            setDirty(true);
            rebuild();
            grid.select(row);
        });
    }

    /*
     * Taking whole sets into the collection (feedback on 2.0.2.0): the sets of the reference
     * data that do not occur in the collection yet are listed, newest first; every printing of
     * the ticked sets becomes a row with empty quantities, as in the old spreadsheet.
     */
    function addSets() {
        var sets = model.missingSets(state.collection);
        if (!sets.length) {
            showMessage('Sets aufnehmen', 'Alle Sets der Stammdaten sind schon im Bestand.');
            return null;
        }
        var boxes = [];
        var list = el('ul', { className: 'cards set-list' });
        var search = el('input', { type: 'search', placeholder: 'Set suchen (* ?)',
            title: 'Enthält den Text; * = beliebiger Text, ? = ein Zeichen' });
        sets.forEach(function (set) {
            var box = el('input', { type: 'checkbox' });
            box._set = set;
            boxes.push(box);
            var date = set.date ? new Date(set.date + 'T00:00:00').toLocaleDateString('de-DE')
                : 'ohne Datum';
            box._item = el('li', {}, [el('label', {}, [box, ' ',
                el('strong', { text: set.name + ' (' + set.code + ')' }),
                el('span', { className: 'what', text: ' ' + date + ' · ' +
                    set.printings.toLocaleString('de-DE') + ' Drucke' })])]);
            list.appendChild(box._item);
        });

        // The search narrows the list (also with wildcards); ticked sets stay ticked.
        search.addEventListener('input', function () {
            var text = util.fold(search.value);
            var test = util.wildcard(search.value);
            boxes.forEach(function (box) {
                var name = util.fold(box._set.name + ' (' + box._set.code + ')');
                var match = !text || (test ? test(name) : name.indexOf(text) >= 0);
                box._item.hidden = !match;
            });
        });

        return openDialog({
            title: 'Sets aufnehmen – ' + sets.length + ' Sets noch nicht im Bestand',
            body: el('div', { className: 'report take-over' }, [search, list]),
            hint: 'Alle Drucke der angehakten Sets werden als Zeilen mit leeren Mengen in den ' +
                'Bestand aufgenommen – so lassen sie sich wie in der ODS ausfüllen. Später ' +
                'erscheinende Drucke eines Sets tauchen automatisch als ○ auf.',
            wide: true,
            buttons: [
                { label: 'Abbrechen', value: 'cancel' },
                { label: 'Aufnehmen', value: 'accept', primary: true }
            ]
        }).then(function (value) {
            if (value !== 'accept') return;
            var chosen = boxes.filter(function (b) { return b.checked; }).map(function (b) {
                return b._set;
            });
            if (!chosen.length) return;
            var rows = model.setRows(state.collection, chosen.map(function (set) {
                return set.code;
            }));
            Array.prototype.push.apply(state.collection.rows, rows);
            chosen.forEach(function (set) {
                var count = rows.filter(function (row) {
                    return model.setCode(row.Id) === set.code;
                }).length;
                changelog.add('Set aufgenommen', null, '', '', set.name + ' (' + set.code +
                    ') – ' + count + ' Zeilen');
            });
            FCT.log.info('sets', 'Sets aufgenommen', { sets: chosen.map(function (set) {
                return set.code;
            }), rows: rows.length });
            setDirty(true);
            rebuild();
            if (rows.length) grid.select(rows[0]);
            showMessage('Sets aufgenommen', chosen.map(function (set) {
                return set.name + ' (' + set.code + ')';
            }).join(', ') + ': ' + rows.length.toLocaleString('de-DE') + ' Zeilen mit leeren ' +
                'Mengen aufgenommen.');
        });
    }

    /*
     * Reference data: status, online update, and applying it to the collection
     */
    function referenceStatus() {
        var r = state.reference;
        var info = r.info || {};
        var date = info.commitDate ? 'Stand ' + info.commitDate : 'Stand unbekannt';
        var text;
        if (r.loading) text = 'wird online geladen …';
        else if (r.online) {
            text = 'online, ' + date + ', geladen ' + info.loadedAt.toLocaleTimeString('de-DE',
                { hour: '2-digit', minute: '2-digit' });
        } else {
            text = 'mitgeliefert, ' + date + (r.error ? ' (online nicht verfügbar)' : '');
        }
        $('reference-status').textContent = text;
        $('reference-status').className = 'badge' + (r.online ? ' ok' : r.error ? ' warn' : '');
        $('reference-status').title = r.error ? 'Letzter Fehler: ' + r.error : '';
        $('btn-reference-update').disabled = r.loading;
    }

    function installBundledReference() {
        FCT.reference.install(FCT.DATA, FCT.DATA.info);
        state.reference.info = FCT.DATA.info;
        state.reference.online = false;
    }

    // Loads the reference data online. On failure the data in use stays in place.
    function updateReference(manual) {
        state.reference.loading = true;
        referenceStatus();
        var started = Date.now();
        return FCT.referenceUpdate.run().then(function (result) {
            FCT.log.info('reference', 'Stammdaten online geladen', { commit: result.info.commit,
                date: result.info.commitDate, cards: result.data.cards.length,
                ms: Date.now() - started });
            FCT.reference.install(result.data, result.info);
            state.reference = { info: result.info, online: true, loading: false, error: '' };
            referenceStatus();
            rebuild();
            if (manual) {
                var count = differingRows().length;
                showMessage('Stammdaten aktualisiert', result.data.sets.length + ' Sets, ' +
                    result.data.cards.length + ' Karten, ' + result.data.printings.length +
                    ' Drucke. ' + (count
                        ? count + ' Zeilen weichen ab (≠) – „Übernehmen …“ zeigt sie.'
                        : 'Der Bestand stimmt mit den Stammdaten überein.'));
            }
        }, function (error) {
            FCT.log.warn('reference', 'Stammdaten online nicht verfügbar', error);
            state.reference.loading = false;
            state.reference.error = error.message;
            referenceStatus();
            showMessage('Stammdaten', 'Online-Aktualisierung nicht möglich: ' + error.message +
                '. Es werden weiter die bisherigen Stammdaten verwendet.');
        });
    }

    // Rows of the collection that differ from the reference data: [{ row, diffs }].
    // Locally changed values (overrides) are left out; they stay as the user set them.
    function differingRows() {
        return state.collection.rows.map(function (row) {
            return { row: row, diffs: model.differences(row) };
        }).filter(function (item) { return item.diffs.length > 0; });
    }

    // Takes over reference values for the given rows (see model.takeOver for the guarantee
    // that the collection itself stays unchanged).
    function takeOverReference(items) {
        try {
            return model.takeOver(state.collection, items, function (row, column, value) {
                return changeCell(row, column, value, 'Stammdaten übernommen');
            });
        } catch (error) {
            changelog.add('Zurückgerollt', null, '', '', error.message);
            throw error;
        }
    }

    // Lists every differing row with its differences; the ticked rows take over the
    // reference values. Grouped by set; nothing is ticked beforehand.
    function applyReference() {
        var items = differingRows();
        if (!items.length) {
            showMessage('Stammdaten übernehmen', 'Keine Abweichungen – der Bestand stimmt ' +
                'mit den Stammdaten überein (lokal geänderte Werte ausgenommen).');
            return null;
        }

        var boxes = [];
        var bySet = new Map();
        items.forEach(function (item) {
            var set = item.row.Set || '(ohne Set)';
            if (!bySet.has(set)) bySet.set(set, []);
            bySet.get(set).push(item);
        });
        var groups = Array.from(bySet.keys()).map(function (set) {
            var members = bySet.get(set);
            var setBox = el('input', { type: 'checkbox', title: 'Alle Karten dieses Sets' });
            var memberBoxes = [];
            var lines = members.map(function (item) {
                var box = el('input', { type: 'checkbox' });
                box._item = item;
                boxes.push(box);
                memberBoxes.push(box);
                var what = item.diffs.map(function (d) {
                    return d.column + ': „' + d.value + '“ → „' + d.want + '“';
                }).join(' · ');
                var variant = [item.row.Edition, item.row['Art Treatment']].filter(Boolean);
                return el('li', {}, [el('label', {}, [box, ' ',
                    el('strong', { text: item.row.Id + ' ' + item.row.Name }),
                    variant.length ? ' (' + variant.join(', ') + ')' : '',
                    el('div', { className: 'what', text: what })])]);
            });
            setBox.addEventListener('change', function () {
                memberBoxes.forEach(function (b) { b.checked = setBox.checked; });
            });
            return el('details', { className: 'group', open: true }, [
                el('summary', {}, [el('label', {}, [setBox, ' ' + set + ' (' +
                    members.length + ')'])]),
                el('ul', { className: 'cards' }, lines)
            ]);
        });

        function tick(on) { boxes.forEach(function (b) { b.checked = on; }); }
        return openDialog({
            title: 'Stammdaten übernehmen – ' + items.length + ' Karten weichen ab',
            body: el('div', { className: 'report take-over' }, groups),
            hint: 'Bei angehakten Karten werden alle abweichenden Werte aus den Stammdaten ' +
                'übernommen. Lokal geänderte Werte (✱) bleiben unberührt. Mengen, Notiz, ' +
                'Kartennummer, Edition und Art Treatment werden nie verändert – das wird vor ' +
                'und nach dem Übernehmen geprüft.',
            wide: true,
            buttons: [
                { label: 'Alle', left: true, onClick: function () { tick(true); } },
                { label: 'Keine', left: true, onClick: function () { tick(false); } },
                { label: 'Abbrechen', value: 'cancel' },
                { label: 'Übernehmen', value: 'accept', primary: true }
            ]
        }).then(function (value) {
            if (value !== 'accept') return;
            var chosen = boxes.filter(function (b) { return b.checked; }).map(function (b) {
                return b._item;
            });
            var count = takeOverReference(chosen);
            if (!count) return;
            setDirty(true);
            rebuild();
            showMessage('Stammdaten übernommen', count + ' Werte bei ' + chosen.length +
                ' Karten übernommen; der Bestand selbst ist unverändert. Jede Änderung steht ' +
                'im Protokoll.');
        });
    }

    function showReferenceInfo() {
        var r = state.reference;
        var info = r.info || {};
        var data = FCT.reference.data() || { sets: [], cards: [], printings: [] };
        var lines = [
            ['Herkunft', r.online ? 'online geladen' : 'mitgeliefert (im Repository)'],
            ['Quelle', (info.source || '') + ' (' + (info.branch || '') + ')'],
            ['Stand (Commit)', (info.commitDate || 'unbekannt') + ' ' +
                String(info.commit || '').slice(0, 10)],
            ['Geladen', info.loadedAt ? info.loadedAt.toLocaleString('de-DE')
                : 'Erstellt ' + (info.built || 'unbekannt')],
            ['Umfang', data.sets.length + ' Sets, ' + data.cards.length + ' Karten, ' +
                data.printings.length + ' Drucke'],
            ['Letzter Fehler', r.error || '–']
        ];
        return openDialog({
            title: 'Stammdaten',
            body: el('table', { className: 'info' }, lines.map(function (l) {
                return el('tr', {}, [el('th', { text: l[0] }), el('td', { text: l[1] })]);
            })),
            hint: 'Beim Start werden die Stammdaten automatisch online geladen. Sie werden ' +
                'nicht gespeichert; ohne Internet gelten die mitgelieferten.',
            buttons: [
                { label: 'Schließen', value: 'cancel' },
                { label: 'Jetzt aktualisieren', value: 'update', primary: true,
                    disabled: r.loading }
            ]
        }).then(function (value) {
            if (value === 'update') return updateReference(true);
            return null;
        });
    }

    /*
     * View settings: font size, edit mode, columns
     */
    var FONT_SIZES = { S: 12, M: 14, L: 16 };

    function setFontSize(size) {
        var px = FONT_SIZES[size] || FONT_SIZES.M;
        var rowHeight = Math.round(px * 1.75);
        var root = document.documentElement.style;
        root.setProperty('--font-size', px + 'px');
        root.setProperty('--row-height', rowHeight + 'px');
        $('font-size').value = size;
        settings.set('fontSize', size);
        if (grid) grid.setRowHeight(rowHeight);
    }

    function setEditMode(on) {
        state.editMode = on;
        document.body.classList.toggle('edit-mode', on);
        if (on) {
            FCT.notices.show('edit', 'info', 'Editiermodus: alle Spalten sind bearbeitbar ' +
                '(Doppelklick, Klick auf die aktive Zelle oder einfach tippen), feste Werte per ' +
                'Auswahlliste. Werte, die von den Stammdaten abweichen, sind erlaubt und werden ' +
                'mit einer violetten Ecke (✱) markiert.', { buttons: [{ label: 'Beenden',
                    onClick: function () { setEditMode(false); } }] });
        } else {
            FCT.notices.clear('edit');
        }
        FCT.log.debug('view', 'Editiermodus ' + (on ? 'an' : 'aus'));
        $('btn-edit-mode').setAttribute('aria-pressed', String(on));
        grid.refresh();
    }

    // Checkbox list to show and hide columns; the choice is remembered.
    function buildColumnChooser() {
        var list = $('columns-list');
        list.textContent = '';
        grid.columns().forEach(function (column) {
            var box = el('input', { type: 'checkbox' });
            box.checked = !column.hidden;
            box.addEventListener('change', function () {
                grid.setColumnHidden(column.key, !box.checked);
                rememberColumns();
            });
            list.appendChild(el('label', {}, [box, ' ' + column.label]));
        });
    }

    function rememberColumns() {
        settings.set('columns', grid.columns().filter(function (c) {
            return !c.hidden;
        }).map(function (c) { return c.key; }));
    }

    function restoreDefaultColumns() {
        grid.columns().forEach(function (c) {
            grid.setColumnHidden(c.key, DEFAULT_COLUMNS.indexOf(c.key) < 0);
        });
        settings.remove('columns');
        buildColumnChooser();
    }

    // Drop-down panels close on a click outside and with Escape.
    function closeDropdowns(except) {
        Array.prototype.forEach.call(document.querySelectorAll('details.dropdown[open]'),
            function (d) { if (!d.contains(except)) d.open = false; });
    }

    /*
     * Start-up
     */
    function init() {
        document.title = 'FabCollectionTool ' + FCT.VERSION;
        $('version').textContent = FCT.VERSION;
        FCT.log.info('app', 'Start FabCollectionTool ' + FCT.VERSION, {
            browser: navigator.userAgent, page: location.protocol,
            writeBack: FCT.storage.canWriteBack, folder: FCT.storage.canUseFolder });
        FCT.diagnosis.start(function () { return hasFolder() ? state.folder : null; });
        installBundledReference();
        setFontSize(settings.get('fontSize', 'M'));

        grid = FCT.grid.create($('grid'), {
            columns: buildColumns(),
            searchKeys: ['Id', 'Name', 'Translated Name', 'Backside Name',
                'Translated Backside Name', 'Set', 'Note'],
            isEditable: isEditable,
            choices: choices,
            referenceValue: referenceValue,
            rowMarks: rowMarks,
            status: rowStatus,
            statusValues: [
                { value: 'differs', label: '≠ weicht von den Stammdaten ab' },
                { value: 'override', label: '✱ lokal geändert' },
                { value: 'gap', label: '○ noch nicht im Bestand' },
                { value: 'unknown', label: '? Kartennummer unbekannt' },
                { value: 'none', label: 'ohne Auffälligkeit' }
            ],
            actions: rowActions,
            groupNames: model.groupNames,
            setInfo: setInfo,
            matchesMode: matchesMode,
            onEdit: onEdit,
            onAction: function (action, row) {
                guarded(function () { return onAction(action, row); })();
            },
            onView: function () { if ($('status-rows')) updateStatus(); }
        });
        grid.setRowHeight(Math.round((FONT_SIZES[$('font-size').value] || 14) * 1.75));

        // Toolbar.
        var actions = {
            'btn-new': newCollection, 'btn-open': open, 'btn-save': save,
            'btn-backup': backup, 'btn-add-sets': addSets, 'btn-import-ods': importOds,
            'btn-import-fabrary': importFabrary, 'btn-export-fabrary': exportFabrary,
            'btn-reference-update': function () { return updateReference(true); },
            'btn-reference-apply': applyReference, 'btn-reference-info': showReferenceInfo,
            'btn-log-file': chooseLogFile, 'btn-autosave': toggleAutosave,
            'btn-folder': chooseFolder, 'btn-diagnose': FCT.diagnosis.download,
            'btn-tour': function () { FCT.tour.start(); },
            'btn-docs': function () { window.open('doku.html', '_blank'); }
        };
        Object.keys(actions).forEach(function (id) {
            $(id).addEventListener('click', guarded(actions[id]));
        });
        $('search').addEventListener('input', function (e) { grid.setSearch(e.target.value); });
        $('mode').addEventListener('change', function (e) { grid.setMode(e.target.value); });
        $('btn-reset').addEventListener('click', function () {
            $('search').value = '';
            $('mode').value = 'all';
            grid.clearFilters();
        });
        $('btn-edit-mode').addEventListener('click', function () {
            setEditMode(!state.editMode);
        });

        // Grouping (accordion).
        var grouping = settings.get('grouping', 'setClass');
        $('grouping').value = grouping;
        grid.setGrouping(grouping);
        $('grouping').addEventListener('change', function (e) {
            settings.set('grouping', e.target.value);
            grid.setGrouping(e.target.value);
        });
        [1, 2, 3].forEach(function (level) {
            $('btn-outline-' + level).addEventListener('click', function () {
                grid.setOutline(level);
                grid.focus();
            });
        });
        var setOrder = settings.get('setOrder', 'date');
        $('set-order').value = setOrder;
        grid.setSetOrder(setOrder);
        $('set-order').addEventListener('change', function (e) {
            settings.set('setOrder', e.target.value);
            grid.setSetOrder(e.target.value);
        });

        // View settings.
        $('font-size').addEventListener('change', function (e) { setFontSize(e.target.value); });
        $('messages-position').addEventListener('change', function (e) {
            setMessagesPosition(e.target.value);
        });
        setMessagesPosition(settings.get('messagesPosition', 'bottom'));
        buildColumnChooser();
        $('btn-columns-default').addEventListener('click', restoreDefaultColumns);
        document.addEventListener('click', function (e) { closeDropdowns(e.target); });

        // Messages and change log.
        $('tab-messages').addEventListener('click', function () { showPane('messages'); });
        $('tab-log').addEventListener('click', function () { showPane('log'); });
        $('messages-toggle').addEventListener('click', function () {
            setMessagesCollapsed(!$('messages').classList.contains('collapsed'));
        });
        changelog.onChange(scheduleLog);
        renderLog();

        // Keyboard shortcuts and protection against closing with unsaved changes.
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                guarded(save)();
            } else if (e.key === 'Escape') {
                closeDropdowns(null);
            }
        });
        window.addEventListener('beforeunload', function (e) {
            if (!state.dirty && !state.autosave.running) return;
            e.preventDefault();
            e.returnValue = '';
        });

        rebuild();
        referenceStatus();
        updateReference(false);
        grid.focus();

        // The working folder of earlier sessions, then the copy of the last collection. The
        // tutorial starts by itself at the first visit.
        updateFolderStatus();
        FCT.storage.recallFolder().then(function (folder) {
            if (!folder) return null;
            return FCT.storage.queryAccess(folder, 'readwrite').then(function (access) {
                FCT.log.info('folder', 'Arbeitsordner beim Start', { name: folder.name,
                    access: access });
                setFolder(folder, access === 'granted');
            });
        }).then(restoreLast).then(function () {
            if (!settings.get('tourDone', false)) FCT.tour.start();
        });
    }

    return { init: init };
})();

document.addEventListener('DOMContentLoaded', FCT.app.init);
