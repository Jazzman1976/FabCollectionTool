/*
 * onboarding.js - the setup assistant (feedback on 2.0.6.3): it leads a new user step by step
 * to a first collection - start from scratch with a first set, import the 1.0 spreadsheet or
 * a Fabrary export, or open an existing collection.csv. It is separate from the tutorial
 * (tour.js): the assistant sets something up, the tutorial explains the page. It starts by
 * itself at the first visit when there is no collection yet, and can be repeated via
 * "Hilfe" > "Einrichtung". The dialogs and actions come from app.js (see init).
 */
FCT.onboarding = (function () {
    var el = FCT.util.el;
    var app = null;           // actions of the application, see init
    var STEPS = 3;

    /*
     * app: { openDialog, ensureFolder, canUseFolder, hasFolder, folderName, canWriteBack,
     * newCollection, importOds, importFabrary, open, save, rowCount, fileName, dirty }
     */
    function init(actions) {
        app = actions;
    }

    // Title of a step, e.g. "Einrichtung – Schritt 1 von 3".
    function title(step, text) {
        return 'Einrichtung – Schritt ' + step + ' von ' + STEPS + ': ' + text;
    }

    // Step 1: how to start. Resolves with 'new', 'ods', 'fabrary', 'open' or 'cancel'.
    function askStart() {
        var choose = null;
        function way(value, label, what) {
            return el('li', {}, [el('button', { type: 'button', text: label,
                onclick: function () { choose(value); } }),
                el('span', { className: 'what', text: ' ' + what })]);
        }
        var current = app.fileName() || (app.rowCount() ? 'ohne Datei' : '');
        return app.openDialog({
            title: title(1, 'Wie möchtest du starten?'),
            body: el('div', {}, [
                el('p', { text: 'Dieser Assistent richtet deinen Bestand ein – die Liste ' +
                    'deiner Karten mit den Mengen je Foiling. Wähle, womit du beginnst:' }),
                el('ul', { className: 'folder-files' }, [
                    way('new', 'Neu anfangen …', 'leerer Bestand, danach die Sets wählen, ' +
                        'die du sammelst'),
                    way('ods', '1.0-Tabelle importieren …', 'die .ods-Datei des alten ' +
                        'FabCollectionTool'),
                    way('fabrary', 'Fabrary-Export importieren …', 'die CSV-Datei, die ' +
                        'Fabrary exportiert'),
                    way('open', 'Vorhandenen Bestand öffnen …', 'eine collection.csv, die ' +
                        'du schon hast')
                ]),
                current ? el('p', { className: 'warn', text: 'Der aktuelle Bestand („' +
                    current + '“) wird dabei ersetzt; als Datei bleibt er erhalten und lässt ' +
                    'sich jederzeit über „Öffnen“ wieder laden.' }) : null
            ]),
            setup: function (done) { choose = done; },
            hint: 'Der Assistent lässt sich jederzeit über „Hilfe“ → „Einrichtung“ wiederholen.',
            buttons: [{ label: 'Später', value: 'cancel' }]
        });
    }

    // Step 2: where the files go. Resolves false if cancelled.
    function askPlace() {
        if (app.canUseFolder() && app.hasFolder()) return Promise.resolve(true);
        var folder = app.canUseFolder();
        return app.openDialog({
            title: title(2, 'Wo sollen deine Dateien liegen?'),
            body: el('div', {}, folder ? [
                el('p', { text: 'Dein Bestand ist eine CSV-Datei auf deinem Rechner – gern ' +
                    'in einem Ordner mit Cloud-Sicherung wie OneDrive. Am einfachsten ist ein ' +
                    'Arbeitsordner: Bestand, Änderungsprotokoll und Backups liegen dann ' +
                    'zusammen, und Änderungen werden automatisch gespeichert.' }),
                el('p', { text: 'Im nächsten Dialog wählst du den Ordner (oder arbeitest ohne ' +
                    'Arbeitsordner mit einzelnen Dateien).' })
            ] : [
                el('p', { text: 'Dieser Browser wird nicht unterstützt: Er kann nicht direkt ' +
                    'in Dateien schreiben, gespeichert wird nur als Download. Für die volle ' +
                    'Funktion (Arbeitsordner, automatisches Speichern) bitte Google Chrome ' +
                    'oder Microsoft Edge verwenden.' })
            ]),
            buttons: [
                { label: 'Abbrechen', value: 'cancel' },
                { label: 'Weiter', value: 'next', primary: true }
            ]
        }).then(function (value) {
            if (value !== 'next') return false;
            return folder ? Promise.resolve(app.ensureFolder()).then(function () {
                return true;
            }) : true;
        });
    }

    // Step 3: runs the chosen way. Resolves true if a collection is there afterwards.
    function runWay(way) {
        var before = { file: app.fileName(), rows: app.rowCount() };
        var run;
        if (way === 'new') run = app.newCollection({ thenAddSets: true });
        else if (way === 'ods') run = app.importOds();
        else if (way === 'fabrary') run = app.importFabrary();
        else run = app.open();
        return Promise.resolve(run).then(function () {
            var changed = app.fileName() !== before.file || app.rowCount() !== before.rows;
            if (!changed) return false;
            // An import is not saved yet: save it right away, so it is a file.
            if ((way === 'ods' || way === 'fabrary') && app.dirty()) {
                return Promise.resolve(app.save()).then(function () { return true; });
            }
            return true;
        });
    }

    // Last step: what to do now. Resolves true if the tutorial should start.
    function finish() {
        return app.openDialog({
            title: 'Einrichtung – geschafft',
            body: el('div', {}, [
                el('p', { text: 'Dein Bestand „' + (app.fileName() || 'ohne Datei') + '“ ist ' +
                    'eingerichtet (' + app.rowCount().toLocaleString('de-DE') + ' Zeilen).' }),
                el('ul', {}, [
                    el('li', { text: 'Mengen trägst du in ST, RF, CF und GF ein: Zelle ' +
                        'anklicken und Zahl tippen, oder mit den Tasten + / − zählen.' }),
                    el('li', { text: 'Weitere Sets holst du mit „Sets aufnehmen …“ (Gruppe ' +
                        'Bestand).' }),
                    el('li', { text: app.canWriteBack()
                        ? 'Änderungen werden – wenn du es erlaubt hast – automatisch ' +
                            'gespeichert; sonst speichert Strg+S.'
                        : 'Strg+S speichert (als Download).' })
                ])
            ]),
            hint: 'Das Tutorial zeigt in einer Minute die wichtigsten Bereiche der Seite.',
            buttons: [
                { label: 'Schließen', value: 'close' },
                { label: 'Tutorial starten', value: 'tour', primary: true }
            ]
        }).then(function (value) { return value === 'tour'; });
    }

    /*
     * Runs the assistant. Resolves with { tour: true } if the user asked for the tutorial at
     * the end, { done: true } if a collection was set up, or {} if it was left early.
     */
    function start() {
        FCT.settings.set('onboardingDone', true);
        FCT.log.info('onboarding', 'Einrichtungs-Assistent gestartet');
        var chosen = null;
        return askStart().then(function (way) {
            if (way === 'cancel') return false;
            chosen = way;
            return askPlace();
        }).then(function (go) {
            return go ? runWay(chosen) : false;
        }).then(function (done) {
            FCT.log.info('onboarding', 'Einrichtungs-Assistent beendet', { way: chosen,
                done: done });
            if (!done) return {};
            return finish().then(function (tour) { return { done: true, tour: tour }; });
        });
    }

    return { init: init, start: start };
})();
