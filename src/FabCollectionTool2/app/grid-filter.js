/*
 * grid-filter.js - the check box filter of the table, as the auto filter of the old
 * spreadsheet: a panel below a column head lists the values of the column with their number
 * of rows; only rows with a ticked value are shown. A search field narrows the list (with
 * wildcards * and ?); "Alle" and "Keine" tick or untick the values listed.
 */
FCT.gridFilter = (function () {
    var util = FCT.util;
    var el = util.el;
    var current = null;     // the open panel: { panel, anchor, outside, key }

    function close() {
        if (!current) return;
        var open = current;
        current = null;
        open.panel.remove();
        document.removeEventListener('mousedown', open.outside, true);
        document.removeEventListener('keydown', open.key, true);
        if (open.onClose) open.onClose();
    }

    /*
     * Opens the panel below an anchor element (the filter button). A second click on the same
     * button closes it again.
     * options:
     *   anchor     the button that opens the panel
     *   title      heading of the panel
     *   values     [{ value, label, count }] in the order to show
     *   selected   Set of ticked values, or null for "all ticked" (no filter)
     *   onChange(selected)   called on every change; null means "all ticked"
     *   onClose()  called when the panel closes
     */
    function open(options) {
        if (current && current.anchor === options.anchor) { close(); return; }
        close();
        var all = options.values.map(function (v) { return v.value; });
        var selected = new Set(options.selected || all);
        var list = el('div', { className: 'lf-list' });
        var search = el('input', { type: 'search', className: 'lf-search',
            placeholder: 'Werte suchen (* ?)',
            title: 'Enthält den Text; * = beliebiger Text, ? = ein Zeichen' });

        // Values matching the search field.
        function shown() {
            var text = util.fold(search.value);
            var test = util.wildcard(search.value);
            return options.values.filter(function (v) {
                var label = util.fold(v.label);
                return !text || (test ? test(label) : label.indexOf(text) >= 0);
            });
        }

        function emit() {
            var complete = all.every(function (v) { return selected.has(v); });
            options.onChange(complete ? null : new Set(selected));
        }

        function draw() {
            list.textContent = '';
            shown().forEach(function (v) {
                var box = el('input', { type: 'checkbox' });
                box.checked = selected.has(v.value);
                box.addEventListener('change', function () {
                    if (box.checked) selected.add(v.value);
                    else selected.delete(v.value);
                    emit();
                });
                list.appendChild(el('label', { className: 'lf-item' }, [box,
                    el('span', { className: 'lf-label', text: v.label }),
                    el('span', { className: 'lf-count', text: v.count.toLocaleString('de-DE') })
                ]));
            });
            if (!list.firstChild) {
                list.appendChild(el('p', { className: 'hint', text: 'Keine passenden Werte' }));
            }
        }

        // "Alle" / "Keine" act on the values listed (as in the spreadsheet).
        function tickShown(on) {
            shown().forEach(function (v) {
                if (on) selected.add(v.value);
                else selected.delete(v.value);
            });
            draw();
            emit();
        }

        search.addEventListener('input', draw);
        var panel = el('div', { className: 'list-filter-panel' }, [
            el('div', { className: 'lf-title', text: options.title }),
            search,
            el('div', { className: 'lf-buttons' }, [
                el('button', { type: 'button', text: 'Alle',
                    onclick: function () { tickShown(true); } }),
                el('button', { type: 'button', text: 'Keine',
                    onclick: function () { tickShown(false); } })
            ]),
            list
        ]);
        draw();
        document.body.appendChild(panel);

        // Below the button, kept inside the window.
        var box = options.anchor.getBoundingClientRect();
        var top = box.bottom + 2;
        panel.style.top = top + 'px';
        panel.style.maxHeight = Math.max(160, window.innerHeight - top - 8) + 'px';
        panel.style.left = Math.max(4, Math.min(box.left,
            window.innerWidth - panel.offsetWidth - 4)) + 'px';

        // Closes on a click outside and with Escape.
        function outside(event) {
            if (!panel.contains(event.target) && !options.anchor.contains(event.target)) close();
        }
        function key(event) {
            if (event.key !== 'Escape') return;
            event.stopPropagation();
            event.preventDefault();
            close();
            options.anchor.focus();
        }
        document.addEventListener('mousedown', outside, true);
        document.addEventListener('keydown', key, true);
        current = { panel: panel, anchor: options.anchor, outside: outside, key: key,
            onClose: options.onClose };
        search.focus();
    }

    return { open: open, close: close };
})();
