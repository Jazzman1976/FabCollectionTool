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

    // Application state. The collection lives only here and in files, never in the browser.
    var state = {
        collection: model.create(),
        file: null,            // { name, handle } of the opened or last saved file
        logHandle: null,       // file handle of the change log (Chrome/Edge)
        dirty: false,
        showReference: false,
        editMode: false,
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
                step: numeric, width: numeric ? STEP_WIDTH : WIDTHS[key] || 7
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

    // Recalculates everything and shows the current rows.
    function rebuild() {
        var rows = state.collection.rows;
        if (state.showReference) rows = rows.concat(model.referenceRows(state.collection));
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
        var name = state.file ? state.file.name : 'kein Bestand geöffnet';
        $('status-file').textContent = name + (state.dirty ? ' • ungespeicherte Änderungen' : '');
        $('status-file').className = state.dirty ? 'dirty' : '';
        $('status-rows').textContent = totals.rows.toLocaleString('de-DE') + ' Zeilen, ' +
            totals.cards.toLocaleString('de-DE') + ' Karten, ' +
            grid.viewCount().toLocaleString('de-DE') + ' angezeigt';
        $('status-clipboard').textContent = state.clipboard
            ? 'Kopiert: ' + state.clipboard.Id + ' ' + state.clipboard.Name : '';
    }

    function setDirty(dirty) {
        state.dirty = dirty;
        updateStatus();
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
     * Change log pane: newest entries first; only the latest ones are drawn.
     */
    var LOG_SHOWN = 500;
    var logPending = false;

    function renderLog() {
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
        var items = entries.slice(-LOG_SHOWN).reverse().map(function (e) {
            var what = e.column
                ? e.column + ': „' + e.old + '“ → „' + e.new + '“'
                : (e.new || e.old);
            return el('li', {}, [
                el('span', { className: 'time', text: e.time.slice(11) }),
                ' ',
                el('strong', { text: e.action }),
                ' ' + [e.id, e.name, e.variant].filter(Boolean).join(' · '),
                what ? el('div', { className: 'what', text: what }) : null
            ]);
        });
        box.appendChild(el('ul', { className: 'log' }, items));
        if (entries.length > LOG_SHOWN) {
            box.appendChild(el('p', { className: 'hint', text: 'Ältere Einträge stehen in ' +
                'der Protokolldatei.' }));
        }
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
                if (dialog.open) dialog.close();
                resolve(value);
            }
            function onCancel(event) { finish('cancel', event); }
            options.buttons.forEach(function (b) {
                var button = el('button', {
                    type: 'button', text: b.label, disabled: !!b.disabled,
                    className: b.primary ? 'primary' : '',
                    onclick: function (event) {
                        if (b.onClick) { b.onClick(event); return; }
                        finish(b.value, event);
                    }
                });
                menu.appendChild(button);
            });
            dialog.addEventListener('cancel', onCancel);
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
                console.error(error);
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
    }

    function open() {
        if (!confirmDiscard()) return null;
        return FCT.storage.openCollection().then(function (result) {
            if (!result) return;
            var loaded = model.fromCsv(result.text);
            if (!loaded.collection) { showReport(loaded.report); return; }
            setCollection(loaded.collection, { name: result.name, handle: result.handle },
                false);
            showReport(loaded.report);
            showReport(model.validate(state.collection, 'Prüfung des Bestands'));
        });
    }

    // Saves the collection and then appends the new change log entries to the log file.
    function save() {
        var text = '﻿' + model.toCsv(state.collection);
        return FCT.storage.saveCollection(text, state.file).then(function (result) {
            if (!result) return null;
            state.file = { name: result.name, handle: result.handle };
            setDirty(false);
            showMessage('Gespeichert', result.method === 'file'
                ? result.name + ' wurde gespeichert.'
                : result.name + ' wurde als Download gespeichert (Download-Ordner des Browsers).');
            return saveLog();
        });
    }

    // Log file: <collection>-log.csv. In Chrome/Edge the user chooses it once per session;
    // the dialog in between provides the click that the browser's file picker requires.
    function saveLog() {
        var pending = changelog.pending();
        if (!pending.length) return null;
        var base = String(state.file ? state.file.name : 'collection.csv').replace(/\.csv$/i, '');
        var header = changelog.HEADER;
        var records = changelog.toRecords(pending);

        // Complete file content: existing lines plus the new ones.
        function makeText(existing) {
            var old = existing.trim() ? FCT.csv.parse(existing) : [header];
            if (old[0].join('|') !== header.join('|')) {
                throw new Error('Die gewählte Datei ist kein Änderungsprotokoll dieser ' +
                    'Anwendung und wurde nicht verändert.');
            }
            return '﻿' + FCT.csv.stringify(old.concat(records));
        }
        var newOnly = '﻿' + FCT.csv.stringify([header].concat(records));

        var ask = Promise.resolve('choose');
        if (FCT.storage.canWriteBack && !state.logHandle) {
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
            changelog.markWritten();
            renderLog();
            showMessage('Protokoll gespeichert', records.length + ' Einträge → ' + result.name);
        });
    }

    function backup() {
        var text = '﻿' + model.toCsv(state.collection);
        return FCT.storage.backup(text, state.file && state.file.name).then(function (result) {
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
                    var check = model.validate(result.collection);
                    check.groups.forEach(function (g) { result.report.groups.push(g); });
                }
                return preview(result.report, !!result.collection).then(function (ok) {
                    showReport(result.report);
                    if (!ok) return;
                    setCollection(result.collection, null, true);
                    changelog.add('Import', null, '', '', file.name + ' – ' +
                        result.collection.rows.length + ' Zeilen');
                    showMessage('Import übernommen', 'Der Bestand ist noch nicht gespeichert. ' +
                        'Bitte „Speichern“ wählen, um ihn als CSV-Datei abzulegen.');
                });
            }, function (error) {
                $('busy').hidden = true;
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

    // Which cells can be edited: the user's input always, everything else in edit mode.
    function isEditable(column) {
        if (column.kind === 'input') return true;
        if (column.kind === 'reference' || column.kind === 'identity') return state.editMode;
        return false;
    }

    // Marks of a row: locally changed reference values (always), deviations from the
    // reference data (edit mode only) and unknown card numbers.
    function rowMarks(row) {
        var marks = {};
        if (row._unknownId) {
            marks.Id = { className: 'unknown', title: 'Kartennummer nicht in den Stammdaten' };
        }
        if (row._reference) return marks;
        var overridden = model.overrides(row);
        if (!overridden.length && !state.editMode) return marks;
        var expected = FCT.reference.expected(row);
        model.REFERENCE_COLUMNS.forEach(function (column) {
            var want = expected ? '„' + expected[column] + '“' : 'unbekannt';
            if (overridden.indexOf(column) >= 0) {
                marks[column] = { className: 'override',
                    title: 'Lokal geändert – Stammdaten: ' + want };
            } else if (state.editMode && model.deviates(row, column, expected)) {
                marks[column] = { className: 'stale',
                    title: 'Weicht von den Stammdaten ab: ' + want };
            }
        });
        return marks;
    }

    // Recalculates all visible rows without filtering again.
    function rebuildCalculationOnly() {
        var rows = state.collection.rows;
        if (state.showReference) {
            rows = rows.concat(lastReferenceRows());
        }
        model.calculate(rows);
        rows.forEach(markProblems);
        grid.refresh();
    }

    // Reference rows currently shown (those not yet adopted into the collection).
    var referenceRowsCache = [];
    function lastReferenceRows() {
        return referenceRowsCache.filter(function (r) { return r._reference; });
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
        if (action === 'edit') {
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
            var input = el('input', { type: 'text', className: 'k-' + kind });
            input.value = row[key] || '';
            inputs[key] = input;

            var reference = '';
            var reset = null;
            if (kind === 'reference' && expected) {
                reference = expected[key];
                reset = el('button', {
                    type: 'button', className: 'reset', text: '↺',
                    title: 'Auf den Stammdatenwert zurücksetzen',
                    onclick: function () {
                        input.value = expected[key];
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

        function resetAll() {
            if (!expected) return;
            model.REFERENCE_COLUMNS.forEach(function (key) {
                if (key === 'Backside Name' && !expected[key]) return;
                inputs[key].value = expected[key];
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
                { label: 'Alle Stammdatenfelder zurücksetzen', disabled: !expected,
                    onClick: resetAll },
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
        return FCT.referenceUpdate.run().then(function (result) {
            FCT.reference.install(result.data, result.info);
            state.reference = { info: result.info, online: true, loading: false, error: '' };
            referenceStatus();
            rebuild();
            if (manual) {
                var count = countDeviations();
                showMessage('Stammdaten aktualisiert', result.data.sets.length + ' Sets, ' +
                    result.data.cards.length + ' Karten, ' + result.data.printings.length +
                    ' Drucke. ' + (count
                        ? count + ' Werte im Bestand weichen ab – „Übernehmen …“ zeigt sie.'
                        : 'Der Bestand stimmt mit den Stammdaten überein.'));
            }
        }, function (error) {
            state.reference.loading = false;
            state.reference.error = error.message;
            referenceStatus();
            showMessage('Stammdaten', 'Online-Aktualisierung nicht möglich: ' + error.message +
                '. Es werden weiter die bisherigen Stammdaten verwendet.');
        });
    }

    // Values of the collection that differ from the reference data, per column.
    // Locally changed values (overrides) are left out; they stay as the user set them.
    function referenceDifferences() {
        var byColumn = {};
        model.REFERENCE_COLUMNS.forEach(function (c) { byColumn[c] = []; });
        state.collection.rows.forEach(function (row) {
            var expected = FCT.reference.expected(row);
            if (!expected) return;
            var overridden = model.overrides(row);
            model.REFERENCE_COLUMNS.forEach(function (c) {
                if (overridden.indexOf(c) < 0 && model.deviates(row, c, expected)) {
                    byColumn[c].push({ row: row, value: expected[c] });
                }
            });
        });
        return byColumn;
    }

    function countDeviations() {
        var byColumn = referenceDifferences();
        return Object.keys(byColumn).reduce(function (sum, c) {
            return sum + byColumn[c].length;
        }, 0);
    }

    // Shows the differences per column; the chosen columns are taken from the reference data.
    function applyReference() {
        var byColumn = referenceDifferences();
        var columns = model.REFERENCE_COLUMNS.filter(function (c) {
            return byColumn[c].length;
        });
        if (!columns.length) {
            showMessage('Stammdaten übernehmen', 'Keine Abweichungen – der Bestand stimmt ' +
                'mit den Stammdaten überein (lokal geänderte Werte ausgenommen).');
            return null;
        }

        var boxes = {};
        var items = columns.map(function (c) {
            var box = el('input', { type: 'checkbox' });
            box.checked = c !== 'Set';
            boxes[c] = box;
            var examples = byColumn[c].slice(0, 12).map(function (d) {
                return el('li', { text: d.row.Id + ': „' + (d.row[c] || '') + '“ → „' +
                    d.value + '“' });
            });
            if (byColumn[c].length > examples.length) {
                examples.push(el('li', { className: 'more', text: '… und ' +
                    (byColumn[c].length - examples.length) + ' weitere' }));
            }
            return el('details', { className: 'group' }, [
                el('summary', {}, [el('label', {}, [box, ' ' + c + ' (' +
                    byColumn[c].length.toLocaleString('de-DE') + ')'])]),
                el('ul', {}, examples)
            ]);
        });

        return openDialog({
            title: 'Stammdaten übernehmen',
            body: el('div', { className: 'report' }, items),
            hint: 'Angehakte Spalten werden aus den Stammdaten übernommen. Lokal geänderte ' +
                'Werte bleiben unberührt. „Set“ ist nicht vorausgewählt, weil eigene ' +
                'Set-Namen die Gruppierung bestimmen.',
            wide: true,
            buttons: [
                { label: 'Abbrechen', value: 'cancel' },
                { label: 'Übernehmen', value: 'accept', primary: true }
            ]
        }).then(function (value) {
            if (value !== 'accept') return;
            var count = 0;
            columns.forEach(function (c) {
                if (!boxes[c].checked) return;
                byColumn[c].forEach(function (d) {
                    if (changeCell(d.row, c, d.value, 'Stammdaten übernommen')) count++;
                });
            });
            if (!count) return;
            setDirty(true);
            rebuild();
            showMessage('Stammdaten übernommen', count + ' Werte aus den Stammdaten ' +
                'übernommen; jede Änderung steht im Protokoll.');
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
        $('edit-banner').hidden = !on;
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
        installBundledReference();
        setFontSize(settings.get('fontSize', 'M'));

        grid = FCT.grid.create($('grid'), {
            columns: buildColumns(),
            searchKeys: ['Id', 'Name', 'Translated Name', 'Backside Name',
                'Translated Backside Name', 'Set', 'Note'],
            isEditable: isEditable,
            rowMarks: rowMarks,
            actions: rowActions,
            groupNames: model.groupNames,
            onEdit: onEdit,
            onAction: function (action, row) {
                guarded(function () { return onAction(action, row); })();
            },
            onView: function () { if ($('status-rows')) updateStatus(); }
        });
        grid.setRowHeight(Math.round((FONT_SIZES[$('font-size').value] || 14) * 1.75));

        // Keep the currently shown reference rows, so edits can recalculate them.
        var originalSetRows = grid.setRows;
        grid.setRows = function (rows) {
            referenceRowsCache = rows.filter(function (r) { return r._reference; });
            originalSetRows(rows);
        };

        // Toolbar.
        var actions = {
            'btn-new': newCollection, 'btn-open': open, 'btn-save': save,
            'btn-backup': backup, 'btn-import-ods': importOds,
            'btn-import-fabrary': importFabrary, 'btn-export-fabrary': exportFabrary,
            'btn-reference-update': function () { return updateReference(true); },
            'btn-reference-apply': applyReference, 'btn-reference-info': showReferenceInfo
        };
        Object.keys(actions).forEach(function (id) {
            $(id).addEventListener('click', guarded(actions[id]));
        });
        $('search').addEventListener('input', function (e) { grid.setSearch(e.target.value); });
        $('mode').addEventListener('change', function (e) { grid.setMode(e.target.value); });
        $('show-reference').addEventListener('change', function (e) {
            state.showReference = e.target.checked;
            rebuild();
        });
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
        $('btn-expand').addEventListener('click', function () { grid.setAllGroups(true); });
        $('btn-collapse').addEventListener('click', function () { grid.setAllGroups(false); });

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
            if (!state.dirty) return;
            e.preventDefault();
            e.returnValue = '';
        });

        if (!FCT.storage.canWriteBack) {
            $('save-hint').textContent = 'Speichern erfolgt in diesem Browser als Download.';
        }

        rebuild();
        referenceStatus();
        updateReference(false);
    }

    return { init: init };
})();

document.addEventListener('DOMContentLoaded', FCT.app.init);
