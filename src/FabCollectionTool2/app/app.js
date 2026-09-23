/*
 * app.js - wiring of the user interface: state, toolbar actions, status and messages.
 */
FCT.app = (function () {
    var util = FCT.util;
    var el = util.el;
    var model = FCT.model;

    // Application state. Nothing of it is stored in the browser.
    var state = {
        collection: model.create(),
        file: null,            // { name, handle } of the opened or last saved file
        dirty: false,
        showReference: false,
        referenceStatus: ''
    };
    var grid = null;

    function $(id) { return document.getElementById(id); }

    /*
     * Grid columns. Calculated columns cannot be edited.
     */
    function calc(key) {
        return function (row) { return row._calc ? String(row._calc[key]) : ''; };
    }
    function buildColumns() {
        var visible = ['Set', 'Edition', 'Id', 'Rarity', 'Name', 'Pitch', 'Peculiarity',
            'Art Treatment', 'Playset', 'ST', 'RF', 'CF', 'GF', 'Note'];
        var widths = { Set: 150, Name: 220, 'Translated Name': 180, 'Backside Name': 160,
            'Translated Backside Name': 160, 'Art Treatment': 110, Note: 200, Rarity: 80,
            Edition: 70, Id: 70, Pitch: 60, Peculiarity: 90 };
        var columns = model.COLUMNS.map(function (key) {
            var numeric = model.NUMBER_COLUMNS.indexOf(key) >= 0;
            return {
                key: key, label: key, editable: true, numeric: numeric,
                width: widths[key] || (numeric ? 48 : 90),
                hidden: visible.indexOf(key) < 0
            };
        });

        // Calculated columns are inserted after the quantities.
        var calculated = [
            { key: '_have', label: 'Have', value: calc('have') },
            { key: '_needSet', label: 'Need (set)', value: calc('needSet') },
            { key: '_leftSet', label: 'Left (set)', value: calc('leftSet'), hidden: true },
            { key: '_haveTotal', label: 'Have (total)', value: calc('haveTotal'), hidden: true },
            { key: '_needTotal', label: 'Need (total)', value: calc('needTotal') },
            { key: '_leftTotal', label: 'Left (total)', value: calc('leftTotal') }
        ].map(function (c) {
            c.numeric = true;
            c.width = 64;
            c.hidden = !!c.hidden;
            return c;
        });
        var types = { key: '_types', label: 'Typen (Stammdaten)', width: 200, hidden: true,
            value: function (row) { return FCT.reference.types(row.Id); } };
        var at = columns.map(function (c) { return c.key; }).indexOf('GF') + 1;
        return columns.slice(0, at).concat(calculated, columns.slice(at), [types]);
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
        $('status-reference').textContent = state.referenceStatus;
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

    // Replaces the collection.
    function setCollection(collection, file, dirty) {
        state.collection = collection;
        state.file = file;
        state.dirty = !!dirty;
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
        $('messages').open = true;
    }

    function showMessage(title, text) {
        var report = FCT.createReport(title);
        report.summary.push(text);
        showReport(report);
    }

    // Shows an import preview and resolves true if the user accepts it.
    function preview(report, canAccept) {
        var dialog = $('preview');
        var body = $('preview-body');
        body.textContent = '';
        body.appendChild(renderReport(report));
        var accept = $('preview-accept');
        var cancel = $('preview-cancel');
        accept.disabled = !canAccept;
        dialog.showModal();

        // The buttons are handled directly; the dialog's close event is not reliable enough.
        return new Promise(function (resolve) {
            function finish(ok, event) {
                if (event) event.preventDefault();
                accept.removeEventListener('click', onAccept);
                cancel.removeEventListener('click', onCancel);
                dialog.removeEventListener('cancel', onCancel);
                if (dialog.open) dialog.close();
                resolve(ok);
            }
            function onAccept(event) { finish(true, event); }
            function onCancel(event) { finish(false, event); }
            accept.addEventListener('click', onAccept);
            cancel.addEventListener('click', onCancel);
            dialog.addEventListener('cancel', onCancel);
        });
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

    function save() {
        var text = '﻿' + model.toCsv(state.collection);
        return FCT.storage.saveCollection(text, state.file).then(function (result) {
            if (!result) return;
            state.file = { name: result.name, handle: result.handle };
            setDirty(false);
            showMessage('Gespeichert', result.method === 'file'
                ? result.name + ' wurde gespeichert.'
                : result.name + ' wurde als Download gespeichert (Download-Ordner des Browsers).');
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
     * Row actions
     */

    // Called by the grid after a cell was edited.
    function onEdit(row, key, value) {
        if (row._reference) adoptReferenceRow(row);
        row[key] = value;
        rebuildCalculationOnly();
        setDirty(true);
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
    }

    function addRow() {
        var row = model.newRow({ Playset: '3' });
        var selected = grid.selected();
        var rows = state.collection.rows;
        var at = selected && !selected._reference ? rows.indexOf(selected) + 1 : rows.length;
        rows.splice(at, 0, row);
        setDirty(true);
        rebuild();
        grid.select(row);
    }

    // Copies the selected row without quantities, e.g. for another language or treatment.
    function duplicateRow() {
        var selected = grid.selected();
        if (!selected || selected._reference) {
            showMessage('Duplizieren', 'Bitte zuerst eine Zeile des Bestands anklicken.');
            return;
        }
        var copy = model.newRow(selected);
        model.QUANTITIES.forEach(function (q) { copy[q] = ''; });
        state.collection.extraColumns.forEach(function (c) { copy[c] = selected[c]; });
        var rows = state.collection.rows;
        rows.splice(rows.indexOf(selected) + 1, 0, copy);
        setDirty(true);
        rebuild();
        grid.select(copy);
    }

    function deleteRow() {
        var selected = grid.selected();
        if (!selected || selected._reference) {
            showMessage('Löschen', 'Bitte zuerst eine Zeile des Bestands anklicken.');
            return;
        }
        var label = selected.Id + ' ' + selected.Name;
        if (!window.confirm('Zeile „' + label + '“ löschen?')) return;
        var rows = state.collection.rows;
        rows.splice(rows.indexOf(selected), 1);
        setDirty(true);
        rebuild();
    }

    /*
     * Reference data
     */
    function referenceLabel(info, prefix) {
        var date = info.commitDate ? ', Stand ' + info.commitDate : '';
        return prefix + date;
    }

    function installBundledReference() {
        FCT.reference.install(FCT.DATA, FCT.DATA.info);
        state.referenceStatus = referenceLabel(FCT.DATA.info, 'Stammdaten: mitgeliefert');
    }

    function startReferenceUpdate() {
        state.referenceStatus += ' – Online-Aktualisierung läuft …';
        FCT.referenceUpdate.run().then(function (result) {
            FCT.reference.install(result.data, result.info);
            var time = result.info.loadedAt.toLocaleTimeString('de-DE',
                { hour: '2-digit', minute: '2-digit' });
            state.referenceStatus = referenceLabel(result.info,
                'Stammdaten: online (geladen ' + time + ')');
            rebuild();
        }, function (error) {
            installBundledReference();
            state.referenceStatus += ' (online nicht verfügbar)';
            updateStatus();
            showMessage('Stammdaten', 'Online-Aktualisierung nicht möglich: ' +
                error.message + '. Es werden die mitgelieferten Stammdaten verwendet.');
        });
    }

    /*
     * Start-up
     */
    function init() {
        document.title = 'FabCollectionTool ' + FCT.VERSION;
        $('version').textContent = FCT.VERSION;
        installBundledReference();

        grid = FCT.grid.create($('grid'), {
            columns: buildColumns(),
            searchKeys: ['Id', 'Name', 'Translated Name', 'Backside Name',
                'Translated Backside Name', 'Set', 'Note'],
            onEdit: onEdit,
            onView: function () { if ($('status-rows')) updateStatus(); }
        });

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
            'btn-add': addRow, 'btn-duplicate': duplicateRow, 'btn-delete': deleteRow
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
        buildColumnChooser();

        // Keyboard shortcut and protection against closing with unsaved changes.
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                guarded(save)();
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
        startReferenceUpdate();
        updateStatus();
    }

    // Checkbox list to show and hide columns.
    function buildColumnChooser() {
        var list = $('columns-list');
        grid.columns().forEach(function (column) {
            var box = el('input', { type: 'checkbox' });
            box.checked = !column.hidden;
            box.addEventListener('change', function () {
                grid.setColumnHidden(column.key, !box.checked);
            });
            list.appendChild(el('label', {}, [box, ' ' + column.label]));
        });
    }

    return { init: init };
})();

document.addEventListener('DOMContentLoaded', FCT.app.init);
