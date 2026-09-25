/*
 * tour.js - the tutorial: a short step-by-step tour through the most important parts of the
 * page. Each step highlights one area (the rest is dimmed) and explains it in a small popup
 * with an arrow. It starts by itself at the first visit, can be cancelled at any time (Esc,
 * "Beenden") and repeated via "Hilfe" > "Tutorial". Details are in the documentation
 * (doku.html); the tour only covers the essentials.
 */
FCT.tour = (function () {
    var el = FCT.util.el;
    var MARGIN = 6;           // space around the highlighted area, in pixels
    var GAP = 12;             // space between area and popup

    // Steps: target (CSS selector, or null for a centred popup), title and text.
    var STEPS = [
        { target: null, title: 'Willkommen beim FabCollectionTool',
            text: 'Diese kurze Tour zeigt die wichtigsten Bereiche – in einer Minute. Mit ' +
                '„Weiter“ oder der Pfeiltaste → geht es voran, Esc beendet die Tour jederzeit.' },
        { target: '#btn-open', parent: 'fieldset', title: 'Bestand',
            text: 'Hier öffnest und speicherst du deinen Bestand (eine CSV-Datei). Beim ' +
                'ersten Mal wählst du einen Arbeitsordner: Bestand, Protokoll und Backups ' +
                'liegen dann zusammen, und Änderungen werden automatisch gespeichert.' },
        { target: '#btn-add-sets', title: 'Sets aufnehmen',
            text: 'Neue Sets holst du dir hier in den Bestand – auch solche, von denen du noch ' +
                'keine Karte hast. Alle Varianten erscheinen dann als Zeilen zum Ausfüllen.' },
        { target: '#grid', title: 'Die Tabelle',
            text: 'Sie funktioniert wie die 1.0-Tabelle: Zelle anklicken, Zahl tippen, Enter ' +
                'geht nach unten. Mengen zählst du mit den Tasten + / − hoch oder runter – ' +
                'oder gleichwertig mit Shift+↑ / Shift+↓ (eine Besonderheit dieser App, kein ' +
                'Tabellen-Standard). Sets und Talent/Class-Gruppen lassen sich auf- und ' +
                'zuklappen. Eine Kartennummer ' +
                'mit Bildsymbol zeigt beim Überfahren die Karte, ein Klick zeigt sie groß.' },
        { target: '.grid thead th.status', title: 'Status jeder Zeile',
            text: '≠ weicht von den Stammdaten ab, ✱ hast du bewusst geändert, ○ ist eine ' +
                'Variante, die du noch nicht im Bestand hast, ? eine unbekannte Kartennummer. ' +
                'Unterstrichene Werte korrigierst du direkt per Klick.' },
        { target: '.grid thead tr.filters', title: 'Filter',
            text: 'Spalten mit festen Werten filterst du per Häkchen wie in der 1.0-Tabelle, ' +
                'Text mit Platzhaltern: * steht für beliebigen Text, ? für ein Zeichen – z. B. ' +
                '*Gravy*. Das × löscht einen Filter.' },
        { target: '#search', parent: 'fieldset', title: 'Suche und Schnellfilter',
            text: 'Die Suche findet Name, Kartennummer, Set, Notiz und Kartentext. Der ' +
                'Schnellfilter beantwortet häufige Fragen, z. B. „Fehlt zum Playset“.' },
        { target: '#btn-outline-1', parent: 'fieldset', title: 'Gliederung',
            text: 'Wie die Gliederungsknöpfe der 1.0-Tabelle: 1 zeigt nur die Sets, 2 auch ' +
                'die Talent/Class-Gruppen, 3 klappt alles auf.' },
        { target: '#btn-reference-apply', parent: 'fieldset', title: 'Stammdaten',
            text: 'Kartendaten kommen automatisch online. Das Auswahlfeld wählt den Branch – ' +
                'neue Sets gibt es oft zuerst in einem eigenen. „Übernehmen …“ zeigt alle ' +
                'Karten, die abweichen, und übernimmt die Stammdaten nur, wo du es willst.' },
        { target: '#btn-edit-mode', title: 'Editiermodus',
            text: 'Normalerweise änderst du nur Mengen und Notizen. Im Editiermodus lässt sich ' +
                'alles bearbeiten – auch abweichend von den Stammdaten.' },
        { target: '#messages .tabs', title: 'Meldungen und Protokoll',
            text: 'Das Protokoll hält jede Änderung fest, auch über Tage: Du siehst, ob du ' +
                'eine Zahl schon erhöht hast, springst zur Zeile oder machst eine Änderung ' +
                'rückgängig.' },
        { target: '#group-help', title: 'Hilfe',
            text: 'Hier startest du die Tour erneut. Die Dokumentation erklärt alles bis ins ' +
                'Detail. „Diagnose“ lädt ein Log für die Fehlersuche herunter. Viel Spaß!' }
    ];

    var tour = null;          // { index, block, spot, popup, onKey, onResize }

    // The area of a step: its element (or the enclosing element named in "parent").
    function targetOf(step) {
        if (!step.target) return null;
        var node = document.querySelector(step.target);
        if (node && step.parent) node = node.closest(step.parent) || node;
        if (!node) return null;
        var box = node.getBoundingClientRect();
        return box.width && box.height ? box : null;
    }

    function show(index) {
        tour.index = index;
        var step = STEPS[index];
        var box = targetOf(step);
        var popup = tour.popup;
        popup.textContent = '';
        popup.appendChild(el('div', { className: 'tour-count',
            text: 'Schritt ' + (index + 1) + ' von ' + STEPS.length }));
        popup.appendChild(el('h3', { text: step.title }));
        popup.appendChild(el('p', { text: step.text }));
        popup.appendChild(el('div', { className: 'tour-buttons' }, [
            el('button', { type: 'button', text: 'Beenden', onclick: function () { stop(); } }),
            el('span', { className: 'tour-space' }),
            index > 0 ? el('button', { type: 'button', text: '‹ Zurück',
                onclick: function () { show(index - 1); } }) : null,
            el('button', { type: 'button', className: 'primary',
                text: index < STEPS.length - 1 ? 'Weiter ›' : 'Fertig',
                onclick: next })
        ]));
        place(box);
        popup.querySelector('button.primary').focus();
    }

    // Puts the highlight on the area and the popup below it (or above, or centred).
    function place(box) {
        var spot = tour.spot;
        var popup = tour.popup;
        popup.className = 'tour-popup';
        // Without an area the whole page is dimmed (a highlight of size 0 casts no shadow).
        tour.block.classList.toggle('dim', !box);
        if (!box) {
            spot.style.cssText = 'left:50%;top:40%;width:0;height:0';
            popup.style.left = Math.max(8, (window.innerWidth - popup.offsetWidth) / 2) + 'px';
            popup.style.top = Math.max(8, (window.innerHeight - popup.offsetHeight) / 3) + 'px';
            return;
        }
        // Very large areas (the table) are cut to the window.
        var top = Math.max(0, box.top - MARGIN);
        var left = Math.max(0, box.left - MARGIN);
        var bottom = Math.min(window.innerHeight, box.bottom + MARGIN);
        var right = Math.min(window.innerWidth, box.right + MARGIN);
        spot.style.cssText = 'left:' + left + 'px;top:' + top + 'px;width:' + (right - left) +
            'px;height:' + (bottom - top) + 'px';

        var height = popup.offsetHeight;
        var width = popup.offsetWidth;
        var y;
        if (bottom + GAP + height <= window.innerHeight) {
            y = bottom + GAP;
            popup.classList.add('below');
        } else if (top - GAP - height >= 0) {
            y = top - GAP - height;
            popup.classList.add('above');
        } else {
            y = Math.max(8, top + 40);   // inside a large area, near its top
        }
        var center = (left + right) / 2;
        var x = Math.max(8, Math.min(window.innerWidth - width - 8, center - width / 2));
        popup.style.left = x + 'px';
        popup.style.top = y + 'px';
        popup.style.setProperty('--arrow', Math.max(16, Math.min(width - 16, center - x)) + 'px');
    }

    function next() {
        if (tour.index < STEPS.length - 1) show(tour.index + 1);
        else stop();
    }

    function start() {
        stop(true);
        var block = el('div', { className: 'tour-block' });
        var spot = el('div', { className: 'tour-spot' });
        var popup = el('div', { className: 'tour-popup', role: 'dialog',
            'aria-label': 'Tutorial' });
        function onKey(event) {
            var handled = true;
            if (event.key === 'Escape') stop();
            else if (event.key === 'ArrowRight') next();
            else if (event.key === 'ArrowLeft' && tour.index > 0) show(tour.index - 1);
            else handled = false;
            if (handled) {
                event.preventDefault();
                event.stopPropagation();
            }
        }
        function onResize() { if (tour) place(targetOf(STEPS[tour.index])); }
        document.body.appendChild(block);
        document.body.appendChild(spot);
        document.body.appendChild(popup);
        document.addEventListener('keydown', onKey, true);
        window.addEventListener('resize', onResize);
        tour = { index: 0, block: block, spot: spot, popup: popup, onKey: onKey,
            onResize: onResize };
        FCT.log.info('tour', 'Tutorial gestartet');
        show(0);
    }

    // Ends the tour; it does not start by itself any more (quiet: no log, e.g. on restart).
    function stop(quiet) {
        if (!tour) return;
        if (!quiet) FCT.log.info('tour', 'Tutorial beendet bei Schritt ' + (tour.index + 1));
        tour.block.remove();
        tour.spot.remove();
        tour.popup.remove();
        document.removeEventListener('keydown', tour.onKey, true);
        window.removeEventListener('resize', tour.onResize);
        tour = null;
        FCT.settings.set('tourDone', true);
    }

    return { start: start, stop: stop, STEPS: STEPS };
})();
