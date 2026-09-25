/*
 * grid.js - the collection table: sorting, free text search, column filters, column
 * selection, accordion groups, colour marks, a status column, row actions and editing in
 * place with a cell cursor that is operated by keyboard like a spreadsheet.
 *
 * Only the visible part of the table is rendered (virtual scrolling with a fixed row height),
 * so tens of thousands of rows stay fluent without any library. Group headers of the
 * accordion are rows of the same height, so they fit into the same scheme.
 */
FCT.grid = (function () {
    var util = FCT.util;
    var el = util.el;
    var OVERSCAN = 20;
    var STATUS_WIDTH = 2;
    var ACTIONS_WIDTH = 10;
    var SEP = '\u0000';     // separator in group keys, the same as model.SECTION_SEP
    var STATUS_KEY = '_status';

    // Icons of the row actions (inline SVG, drawn with the text colour).
    var ICONS = {
        edit: '<path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z"/>',
        insert: '<path d="M8 3v10M3 8h10"/>',
        // "take into the collection": an arrow into a tray, clearly unlike the plus of insert
        adopt: '<path d="M8 2v7.5M5 6.5l3 3 3-3"/><path d="M2.5 10v3.5h11V10"/>',
        copy: '<rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1"/><path d="M3 10.5V3h7.5"/>',
        paste: '<rect x="3" y="3" width="10" height="11" rx="1"/>' +
            '<path d="M6 3V2h4v1M8 6v5M5.5 8.5L8 11l2.5-2.5"/>',
        remove: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>',
        picture: '<rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/>' +
            '<path d="M4.5 11l2.5-3 2 2 1.5-1.5 1.5 2.5"/><circle cx="10" cy="5" r="1"/>'
    };

    // Icons are parsed once and then copied; parsing SVG for every row slowed down scrolling.
    var iconCache = {};
    function icon(name) {
        if (!iconCache[name]) {
            var span = el('span', { className: 'icon' });
            span.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">' + ICONS[name] +
                '</svg>';
            iconCache[name] = span;
        }
        return iconCache[name].cloneNode(true);
    }

    // Creates a grid inside the container element.
    // options:
    //   columns     [{ key, label, width (em), numeric, kind, hidden, step, list, group,
    //                  value(row) }]
    //               kind is 'input', 'reference', 'identity' or 'calc'; list = check box
    //               filter (fixed values) instead of a text filter; columns with the same
    //               group can be collapsed into one narrow column; sparse = numbers that
    //               may be missing (an empty value matches no number comparison); hint =
    //               explanation shown when hovering over the title. Titles never wrap; a
    //               column is widened where its title would not fit.
    //   collapsed                 { group: true } groups collapsed at the start
    //   onCollapse(group, collapsed)   a group was collapsed or expanded (to remember it)
    //   searchKeys  keys searched by the free text search, or functions (row) -> text
    //   isEditable(column, row)   whether a cell may be edited
    //   choices(column)           value list for a drop-down editor, or null for free text
    //   referenceValue(column, row)  value of the reference data, offered first in drop-downs
    //   rowMarks(row)             { key: { className, title } } extra marks per cell
    //   status(row)               { symbol, className, title } for the status column
    //   statusValues              [{ value, label }] of the status filter (value = className,
    //                             'none' for rows without a status)
    //   actions(row)              [{ action, icon, title, disabled }] buttons at the row end
    //   groupNames(row)           [level 1 name, level 2 name] for the accordion
    //   sections(rows)            level 2 sections of all rows, see model.sections
    //   setInfo(name, rows)       { label, date } of a level 1 group (title and release date)
    //   matchesMode(row, mode)    extra quick filters of the application
    //   imageColumn               key of the column that shows card pictures (e.g. 'Id')
    //   hasImage(row)             whether a row has a card picture
    //   onImage(action, row, td)  'hover' (show preview), 'leave' (hide it), 'open' (large)
    //   onEdit(row, key, text), onAction(action, row), onView(count)
    function create(container, options) {
        var columns = options.columns;
        var allRows = [];
        var viewRows = [];
        var matchCount = 0;
        var cursor = { item: null, key: null };  // active cell: row (or group) and column
        var sort = { key: null, dir: 1 };
        var filters = {};              // text filters per column key
        var checks = {};               // check box filters: column key -> Set of values
        var search = '';
        var wordsOf = { search: null, words: [] };  // search split into words (cached)
        var mode = 'all';
        var grouping = 'setClass';
        var setOrder = 'date';
        var groupOpen = new Map();      // explicit open/closed state of groups
        var filterOpen = new Map();     // the same while a search or filter is active
        var groupKeys = [];             // keys of all groups of the current rows
        var pinned = new Set();         // rows shown regardless of filters (just inserted)
        var collapsed = Object.assign({}, options.collapsed || {});  // collapsed groups
        var rowHeight = 24;
        var editor = null;
        var renderPending = false;

        // Static structure: scroll area with a table; the body is re-rendered on demand.
        // The scroll area takes the keyboard focus for the cell cursor.
        var colgroup = el('colgroup');
        var headRow = el('tr');
        var filterRow = el('tr', { className: 'filters' });
        var tbody = el('tbody');
        var table = el('table', { className: 'grid' }, [colgroup, el('thead', {}, [headRow,
            filterRow]), tbody]);
        var scroller = el('div', { className: 'grid-scroll', tabindex: '0' }, [table]);
        container.appendChild(scroller);
        scroller.addEventListener('scroll', function () {
            watchScroll();
            scheduleScroll();
            if (options.onImage) options.onImage('leave');
        });

        // Diagnosis of the scroll jump reported on 2.0.2.0: a jump of more than one screen
        // without mouse, wheel or key shortly before, and not caused by the grid itself, is
        // written to the diagnosis log.
        var scrollWatch = { input: 0, own: 0, top: 0 };
        ['wheel', 'keydown', 'mousedown', 'touchstart'].forEach(function (type) {
            scroller.addEventListener(type, function () { scrollWatch.input = Date.now(); },
                { passive: true });
        });
        function watchScroll() {
            var top = scroller.scrollTop;
            var now = Date.now();
            if (Math.abs(top - scrollWatch.top) > scroller.clientHeight &&
                now - scrollWatch.input > 1000 && now - scrollWatch.own > 300) {
                FCT.log.warn('grid', 'Scroll-Sprung ohne Nutzeraktion', { from: scrollWatch.top,
                    to: top, rows: viewRows.length, height: scroller.scrollHeight });
            }
            scrollWatch.top = top;
        }
        window.addEventListener('resize', scheduleRender);

        /*
         * Column widths: the configured width, widened where the title would not fit. Titles
         * never wrap. A first estimate is measured on a canvas; once the header is on screen,
         * fitTitles() measures the real titles (collapse button and sort marker included) and
         * widens columns that are still too narrow. Widths are kept in em, so they follow the
         * font size; refit() measures again (font size changed, web fonts loaded).
         */
        var fitted = {};
        var measure = null;

        function widthOf(column) {
            if (column.placeholder) return column.width;
            if (fitted[column.key] == null) {
                if (!measure) measure = document.createElement('canvas').getContext('2d');
                var style = window.getComputedStyle(headRow.cells[0] || table);
                var size = parseFloat(style.fontSize) || 14;
                measure.font = '700 ' + size + 'px ' + style.fontFamily;
                var text = measure.measureText(String(column.label)).width;
                // Padding left (5px), sort marker at the right (1.3em), the collapse button of
                // a group's first column, and a little air.
                var extra = 5 / size + 1.3 + (column.group && firstOfGroup(column) ? 1.9 : 0) +
                    0.3;
                fitted[column.key] = Math.max(column.width,
                    Math.ceil((text / size + extra) * 10) / 10);
            }
            return fitted[column.key];
        }

        // Widens columns whose title is wider than the column (only possible while the table
        // is displayed). Titles only ever widen a column, so this ends after one more pass.
        var fitPending = false;
        function fitTitles() {
            if (fitPending) return;
            fitPending = true;
            window.requestAnimationFrame(function () {
                fitPending = false;
                if (!table.offsetWidth) return;
                var em = parseFloat(window.getComputedStyle(table).fontSize) || 14;
                var changed = false;
                Array.prototype.forEach.call(headRow.cells, function (th) {
                    var key = th.getAttribute('data-key');
                    if (!key || th.scrollWidth <= th.clientWidth) return;
                    fitted[key] = Math.ceil((th.scrollWidth / em + 0.2) * 10) / 10;
                    changed = true;
                });
                if (changed) {
                    buildHeader();
                    render();
                }
            });
        }

        function refit() {
            fitted = {};
            buildHeader();
            render();
        }
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);

        /*
         * Header: labels with sorting, one filter input per column
         */
        function buildHeader() {
            colgroup.textContent = '';
            headRow.textContent = '';
            filterRow.textContent = '';

            // Status column at the left edge; stays visible when scrolling sideways. Its filter
            // is a check box list of the status symbols.
            colgroup.appendChild(el('col', { style: 'width:' + STATUS_WIDTH + 'em' }));
            headRow.appendChild(el('th', { className: 'status', title: 'Status der Zeile' }));
            filterRow.appendChild(el('th', { className: 'status' + (checks[STATUS_KEY]
                ? ' filtered' : '') }, [listButton({ key: STATUS_KEY, label: 'Status' }, true)]));

            // The table gets the sum of all column widths. Only then does the fixed table
            // layout really hold, and columns no longer jump while scrolling.
            var total = STATUS_WIDTH + ACTIONS_WIDTH;
            visibleColumns().forEach(function (column) {
                var width = widthOf(column);
                total += width;
                colgroup.appendChild(el('col', { style: 'width:' + width + 'em' }));

                var active = sort.key === column.key;
                var marker = el('span', {
                    className: 'sort' + (active ? ' active' : ''),
                    text: active ? (sort.dir > 0 ? '▲' : '▼') : '⇅'
                });
                // A collapsed group shows one narrow column that expands it again.
                if (column.placeholder) {
                    headRow.appendChild(el('th', { className: 'group-expand' }, [
                        el('button', { type: 'button', className: 'group-toggle',
                            title: column.title, text: 'Σ ▸',
                            onclick: function () { setCollapsed(column.group, false); } })
                    ]));
                    filterRow.appendChild(el('th'));
                    return;
                }

                // The first column of a group can collapse the whole group.
                var toggle = null;
                if (column.group && firstOfGroup(column)) {
                    toggle = el('button', { type: 'button', className: 'group-toggle',
                        title: 'Rechenspalten einklappen', text: '◂',
                        onclick: function (event) {
                            event.stopPropagation();
                            setCollapsed(column.group, true);
                        } });
                }
                headRow.appendChild(el('th', {
                    title: column.label + (column.hint ? ': ' + column.hint : '') +
                        '\nKlicken zum Sortieren (auf, ab, aus)',
                    className: 'sortable ' + (column.numeric ? 'num' : '') +
                        (toggle ? ' has-toggle' : ''),
                    'data-key': column.key,
                    onclick: function () { toggleSort(column.key); }
                }, [toggle, el('span', { className: 'label', text: column.label }), marker]));

                if (column.list) {
                    filterRow.appendChild(el('th', { className: checks[column.key]
                        ? 'filtered' : '' }, [listButton(column, false), clearButton(function () {
                        delete checks[column.key];
                        filterChanged();
                        buildHeader();
                        applyView();
                    })]));
                    return;
                }
                var input = el('input', {
                    type: 'text',
                    value: filters[column.key] || '',
                    placeholder: column.numeric ? '>0' : 'Filter',
                    title: column.numeric
                        ? 'Zahl oder Vergleich: 3, >0, <3, >=2, !=0'
                        : 'Enthält den Text; * = beliebiger Text, ? = ein Zeichen ' +
                            '(Gravy* beginnt mit Gravy); =Text genau; = leer; !Text nicht',
                    oninput: function () {
                        filters[column.key] = input.value;
                        filterChanged();
                        applyView();
                    }
                });
                var clear = clearButton(function () {
                    input.value = '';
                    filters[column.key] = '';
                    cell.classList.remove('filtered');
                    filterChanged();
                    applyView();
                });
                var cell = el('th', { className: filters[column.key] &&
                    filters[column.key].trim() ? 'filtered' : '' }, [input, clear]);
                filterRow.appendChild(cell);
                input.addEventListener('input', function () {
                    cell.classList.toggle('filtered', !!input.value.trim());
                });
            });

            // Row actions stay visible at the right edge, also when scrolling sideways.
            colgroup.appendChild(el('col', { style: 'width:' + ACTIONS_WIDTH + 'em' }));
            headRow.appendChild(el('th', { className: 'actions', text: 'Aktionen' }));
            filterRow.appendChild(el('th', { className: 'actions' }));
            table.style.width = total + 'em';
            fitTitles();
        }

        // Small × that clears the filter of its cell; shown while the filter is active.
        function clearButton(onClear) {
            return el('button', { type: 'button', className: 'filter-clear', tabindex: '-1',
                title: 'Filter löschen', text: '×',
                onclick: function (event) {
                    event.stopPropagation();
                    onClear();
                } });
        }

        /*
         * Column groups (the calculated columns): collapsed into one narrow column, which
         * expands them again. The state is remembered by the application (onCollapse).
         */
        function firstOfGroup(column) {
            var members = columns.filter(function (c) {
                return c.group === column.group && !c.hidden;
            });
            return members[0] === column;
        }

        function setCollapsed(group, value) {
            collapsed[group] = value;
            if (options.onCollapse) options.onCollapse(group, value);
            buildHeader();
            keepCursorColumn();
            render();
        }

        // The cursor never stays in a column that is not shown any more.
        function keepCursorColumn() {
            var keys = cursorColumns().map(function (c) { return c.key; });
            if (cursor.key && keys.indexOf(cursor.key) < 0) cursor.key = keys[0] || null;
        }

        /*
         * Check box filters (see grid-filter.js). The list shows the values of the rows that
         * pass all other filters, with their number of rows.
         */
        function listButton(column, compact) {
            var active = checks[column.key];
            var button = el('button', { type: 'button', className: 'list-filter',
                title: 'Werte zum Anzeigen auswählen (wie der Autofilter der 1.0-Tabelle)',
                text: compact ? '▾' : (active ? active.size + ' gewählt ▾' : 'Alle ▾') });
            button.addEventListener('click', function () {
                FCT.gridFilter.open({
                    anchor: button,
                    title: column.label,
                    values: listValues(column),
                    selected: checks[column.key] || null,
                    onChange: function (selected) {
                        if (selected) checks[column.key] = selected;
                        else delete checks[column.key];
                        if (!compact) {
                            button.textContent = selected
                                ? selected.size + ' gewählt ▾' : 'Alle ▾';
                        }
                        button.parentNode.classList.toggle('filtered', !!selected);
                        filterChanged();
                        applyView();
                    }
                });
            });
            return button;
        }

        // Value of a row for a check box filter.
        function listValue(row, key) {
            if (key === STATUS_KEY) {
                var status = options.status ? options.status(row) : null;
                return status ? status.className : 'none';
            }
            var value = cellValue(row, columnByKey(key));
            return value == null ? '' : String(value);
        }

        // Values of a column with their number of rows, in the order of the value list.
        function listValues(column) {
            var counts = new Map();
            allRows.forEach(function (row) {
                if (!passes(row, column.key)) return;
                var value = listValue(row, column.key);
                counts.set(value, (counts.get(value) || 0) + 1);
            });
            if (column.key === STATUS_KEY) {
                return (options.statusValues || []).map(function (s) {
                    return { value: s.value, label: s.label, count: counts.get(s.value) || 0 };
                });
            }
            // Values ticked earlier stay in the list, even if no row has them now.
            (checks[column.key] || new Set()).forEach(function (v) {
                if (!counts.has(v)) counts.set(v, 0);
            });
            var order = new Map();
            ((options.choices && options.choices(column)) || []).forEach(function (v, i) {
                order.set(v, i);
            });
            return Array.from(counts.keys()).sort(function (a, b) {
                if (a === '' || b === '') return a === '' ? -1 : 1;
                var ia = order.has(a) ? order.get(a) : Infinity;
                var ib = order.has(b) ? order.get(b) : Infinity;
                if (ia !== ib) return ia < ib ? -1 : 1;
                return util.fold(a).localeCompare(util.fold(b));
            }).map(function (v) {
                return { value: v, label: v === '' ? '(leer)' : v, count: counts.get(v) };
            });
        }

        // Columns shown, with a collapsed group replaced by one narrow placeholder column.
        function visibleColumns() {
            var result = [];
            columns.forEach(function (c) {
                if (c.hidden) return;
                if (!c.group || !collapsed[c.group]) { result.push(c); return; }
                if (firstOfGroup(c)) {
                    result.push({ key: '_group_' + c.group, label: 'Σ', width: 3,
                        kind: 'calc', group: c.group, placeholder: true,
                        title: 'Rechenspalten einblenden (Have / Need / Left)' });
                }
            });
            return result;
        }

        // Columns the cell cursor can stand in (not a collapsed group).
        function cursorColumns() {
            return visibleColumns().filter(function (c) { return !c.placeholder; });
        }

        function columnByKey(key) {
            return columns.filter(function (c) { return c.key === key; })[0];
        }

        // Display value of a cell.
        function cellValue(row, column) {
            return column.value ? column.value(row) : row[column.key];
        }

        /*
         * Filtering and sorting
         */

        // Tests one value against a column filter expression.
        function matchesFilter(value, expression, numeric, sparse) {
            var text = expression.trim();
            if (!text) return true;
            if (numeric) {
                var m = /^(<=|>=|!=|<|>|=)?\s*(-?\d+)$/.exec(text);
                if (m) {
                    if (sparse && !String(value == null ? '' : value).trim()) return false;
                    var n = util.toInt(value);
                    if (isNaN(n)) return false;
                    var x = parseInt(m[2], 10);
                    switch (m[1] || '=') {
                        case '<': return n < x;
                        case '>': return n > x;
                        case '<=': return n <= x;
                        case '>=': return n >= x;
                        case '!=': return n !== x;
                        default: return n === x;
                    }
                }
            }
            var folded = util.fold(value);
            if (text === '=') return folded === '';
            if (text[0] === '=') return folded === util.fold(text.slice(1));
            if (text[0] === '!') return !matchesText(folded, text.slice(1));
            return matchesText(folded, text);
        }

        // "Contains", or with wildcards (* and ?) the whole value must match the pattern.
        function matchesText(folded, pattern) {
            var test = util.wildcard(pattern);
            return test ? test(folded) : folded.indexOf(util.fold(pattern)) >= 0;
        }

        // Quick filters for the most common questions.
        function matchesMode(row) {
            var calc = row._calc || {};
            switch (mode) {
                case 'all': return true;
                case 'owned': return calc.have > 0;
                case 'missing': return calc.needTotal > 0;
                case 'missingSet': return calc.needSet > 0;
                case 'surplus': return calc.have > 0 && calc.leftSet > 0;
                case 'problems': return row._problem;
                default: return options.matchesMode ? options.matchesMode(row, mode) : true;
            }
        }

        // A new search or filter starts with all groups open and no pinned rows.
        function filterChanged() {
            filterOpen.clear();
            pinned.clear();
        }

        // True while a search, column filter or quick filter narrows the rows.
        function filtering() {
            return !!search.trim() || mode !== 'all' || Object.keys(checks).length > 0 ||
                Object.keys(filters).some(function (k) {
                    return filters[k] && filters[k].trim();
                });
        }

        /*
         * Whether a row passes the quick filter, the search and all column filters. except
         * leaves out the filter of one column (for the value list of its check box filter).
         * Search words may contain wildcards; such a word must match one whole field.
         */
        function passes(row, except) {
            if (!matchesMode(row)) return false;
            if (wordsOf.search !== search) {
                wordsOf = { search: search, words: util.fold(search).split(/\s+/)
                    .filter(Boolean) };
            }
            var words = wordsOf.words;
            if (words.length) {
                var fields = options.searchKeys.map(function (key) {
                    return util.fold(typeof key === 'function' ? key(row) : row[key]);
                });
                var haystack = fields.join(' ');
                for (var w = 0; w < words.length; w++) {
                    var test = util.wildcard(words[w]);
                    if (test ? !fields.some(test) : haystack.indexOf(words[w]) < 0) return false;
                }
            }
            var keys = Object.keys(checks);
            for (var k = 0; k < keys.length; k++) {
                if (keys[k] !== except && !checks[keys[k]].has(listValue(row, keys[k]))) {
                    return false;
                }
            }
            return columns.every(function (c) {
                if (c.key === except || !filters[c.key] || !filters[c.key].trim()) return true;
                return matchesFilter(cellValue(row, c), filters[c.key], c.numeric, c.sparse);
            });
        }

        // Recomputes the list of visible rows from search, filters, quick filter and sort.
        function applyView() {
            var rows = allRows.filter(function (row) {
                return pinned.has(row) || passes(row, null);
            });

            // Sorting is stable: equal values keep the order of the file. Without a chosen
            // column, rows are ordered by card number (set code and number, e.g. AGB001 before
            // AGB004), so that printings not yet in the collection stand at their place.
            var positions = new Map();
            allRows.forEach(function (row, i) { positions.set(row, i); });
            if (!sort.key) {
                // A row without card number (e.g. just inserted) stays right after the row
                // before it in the file.
                var sortId = new Map();
                var previous = '';
                allRows.forEach(function (row) {
                    if (row.Id) previous = row.Id;
                    sortId.set(row, row.Id || previous);
                });
                rows.sort(function (a, b) {
                    var ia = sortId.get(a);
                    var ib = sortId.get(b);
                    if (ia !== ib) return ia < ib ? -1 : 1;
                    return positions.get(a) - positions.get(b);
                });
            } else {
                var column = columnByKey(sort.key);
                rows.sort(function (a, b) {
                    var va = cellValue(a, column);
                    var vb = cellValue(b, column);
                    var result;
                    if (column.numeric) {
                        result = (util.toInt(va) || 0) - (util.toInt(vb) || 0);
                    } else {
                        result = util.fold(va).localeCompare(util.fold(vb));
                    }
                    return result * sort.dir || positions.get(a) - positions.get(b);
                });
            }
            matchCount = rows.length;
            viewRows = grouping === 'none' ? rows : groupRows(rows);
            keepCursor();
            render();
            if (options.onView) options.onView(matchCount);
        }

        // Sections of the accordion from all rows (see model.sections).
        function buildSections() {
            return options.sections(allRows);
        }

        /*
         * Accordion: rows are grouped by set and, below that, in sections by talent and class
         * (see buildSections). Sets are ordered by release date (or by name), sections by card
         * number; sorting applies within the groups. All groups start closed. While a search
         * or filter is active, all groups with hits are open.
         */
        function groupRows(rows) {
            var levels = grouping === 'set' ? 1 : 2;
            var sections = buildSections();

            // Order of the sets in the file (for equal dates) and keys of all groups, for the
            // outline levels.
            var setIndex = new Map();
            Array.from(sections.rowsOf.keys()).forEach(function (name, i) {
                setIndex.set(name, i);
            });
            var keys = new Set();
            allRows.forEach(function (row) {
                var set = options.groupNames(row)[0];
                keys.add(set);
                if (levels === 2 && !sections.flat.has(set)) keys.add(sections.of.get(row).key);
            });
            groupKeys = Array.from(keys);

            // Put the (sorted) rows into their groups.
            var sets = new Map();
            rows.forEach(function (row) {
                var name = options.groupNames(row)[0];
                var set = sets.get(name);
                if (!set) {
                    var info = options.setInfo(name, sections.rowsOf.get(name));
                    set = header(1, name, info.label);
                    set.date = info.date || '';
                    set.order = setIndex.get(name);
                    set.children = new Map();
                    sets.set(name, set);
                }
                set.rows.push(row);
                if (levels === 1 || sections.flat.has(name)) return;
                var section = sections.of.get(row);
                var sub = set.children.get(section.key);
                if (!sub) {
                    sub = header(2, section.key, section.label);
                    sub.index = section.index;
                    set.children.set(section.key, sub);
                }
                sub.rows.push(row);
            });

            // Sets by release date (sets without a date, e.g. promos, first, as in the old
            // spreadsheet) or by name; sections by card number.
            function bySet(a, b) {
                var result = setOrder === 'alpha'
                    ? util.fold(a.key).localeCompare(util.fold(b.key))
                    : (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
                return result || a.order - b.order;
            }

            // Flatten into the list of view rows: headers, and rows of open groups.
            var result = [];
            Array.from(sets.values()).sort(bySet).forEach(function (set) {
                result.push(set);
                if (!set.open) return;
                if (levels === 1 || sections.flat.has(set.key)) {
                    Array.prototype.push.apply(result, set.rows);
                    return;
                }
                Array.from(set.children.values()).sort(function (a, b) {
                    return a.index - b.index;
                }).forEach(function (sub) {
                    result.push(sub);
                    if (sub.open) Array.prototype.push.apply(result, sub.rows);
                });
            });
            return result;
        }

        // Creates a group header row.
        function header(level, key, label) {
            return { _group: true, level: level, key: key, label: label, rows: [],
                open: isOpen(key) };
        }

        function isOpen(key) {
            var states = filtering() ? filterOpen : groupOpen;
            if (states.has(key)) return states.get(key);
            return filtering();
        }

        function setGroupOpen(group, open) {
            var states = filtering() ? filterOpen : groupOpen;
            states.set(group.key, open);
            applyView();
        }

        // Outline levels as in the spreadsheet: 1 = sets only, 2 = sets with their
        // talent/class groups, 3 = everything open.
        function setOutline(level) {
            var states = filtering() ? filterOpen : groupOpen;
            groupKeys.forEach(function (key) {
                var sub = key.indexOf(SEP) >= 0;
                states.set(key, sub ? level >= 3 : level >= 2);
            });
            applyView();
        }

        function toggleSort(key) {
            if (sort.key !== key) sort = { key: key, dir: 1 };
            else if (sort.dir > 0) sort.dir = -1;
            else sort = { key: null, dir: 1 };
            buildHeader();
            applyView();
        }

        /*
         * Rendering (virtual scrolling)
         */
        function scheduleRender() {
            if (renderPending) return;
            renderPending = true;
            window.requestAnimationFrame(function () {
                renderPending = false;
                render();
            });
        }

        // While scrolling, the rows are only rebuilt when the visible area comes close to the
        // edge of the rows drawn in advance (OVERSCAN). Rebuilding the table on every scroll
        // step made scrolling sluggish: the browser has to lay out ~1,500 cells each time.
        var rendered = { first: 0, last: 0 };
        var headHeight = 0;
        var renderedHead = 0;         // height of the label row, for the sticky filter row
        var MARGIN = 5;

        function scheduleScroll() {
            if (renderPending) return;
            renderPending = true;
            window.requestAnimationFrame(function () {
                renderPending = false;
                var visibleFirst = Math.floor(scroller.scrollTop / rowHeight);
                var visibleLast = Math.min(viewRows.length, Math.ceil((scroller.scrollTop +
                    scroller.clientHeight - headHeight) / rowHeight));
                var topOk = rendered.first === 0 || visibleFirst >= rendered.first + MARGIN;
                var bottomOk = rendered.last >= viewRows.length ||
                    visibleLast <= rendered.last - MARGIN;
                if (!topOk || !bottomOk) render();
            });
        }

        // Row classes for colour marks.
        function rowClass(row) {
            var calc = row._calc || {};
            var classes = [];
            if (row._reference) classes.push('ref');
            if (calc.needTotal > 0) classes.push('missing');
            else if (calc.have > 0 && calc.leftSet > 0) classes.push('surplus');
            if (row._problem) classes.push('problem');
            if (row === cursor.item) classes.push('selected');
            return classes.join(' ');
        }

        function render() {
            if (editor) return;
            var cols = visibleColumns();
            var span = cols.length + 2;
            headHeight = table.tHead.offsetHeight;
            var labelHeight = headRow.offsetHeight;
            if (labelHeight && labelHeight !== renderedHead) {
                renderedHead = labelHeight;
                table.style.setProperty('--head-height', labelHeight + 'px');
            }
            var viewport = scroller.clientHeight - headHeight;
            var first = Math.max(0, Math.floor(scroller.scrollTop / rowHeight) - OVERSCAN);
            var count = Math.ceil(viewport / rowHeight) + 2 * OVERSCAN;
            var last = Math.min(viewRows.length, first + count);
            rendered = { first: first, last: last };

            // Build the rows off-screen and insert them in one step.
            var rows = document.createDocumentFragment();
            rows.appendChild(spacer(first * rowHeight, span));
            for (var i = first; i < last; i++) {
                var item = viewRows[i];
                rows.appendChild(item._group ? renderGroup(item, span) : renderRow(item, cols));
            }
            rows.appendChild(spacer((viewRows.length - last) * rowHeight, span));
            tbody.textContent = '';
            tbody.appendChild(rows);
        }

        function spacer(height, span) {
            return el('tr', { className: 'spacer', style: 'height:' + height + 'px' },
                [el('td', { colspan: span })]);
        }

        // Group header: open/closed marker, name (centred) and a short summary of its rows.
        function renderGroup(group, span) {
            var cards = 0;
            var missing = 0;
            var gaps = 0;
            group.rows.forEach(function (row) {
                cards += row._have || 0;
                if (row._reference) gaps++;
                else if (row._calc && row._calc.needTotal > 0) missing++;
            });
            var info = (group.rows.length - gaps).toLocaleString('de-DE') + ' Zeilen · ' +
                cards.toLocaleString('de-DE') + ' Karten' +
                (missing ? ' · ' + missing.toLocaleString('de-DE') + ' fehlen' : '') +
                (gaps ? ' · ' + gaps.toLocaleString('de-DE') + ' nicht im Bestand' : '');
            var classes = 'group level' + group.level + (group.open ? ' open' : '') +
                (group === cursor.item ? ' cursor' : '');
            // The title is centred in the visible part of the table, not in its full width.
            var tr = el('tr', { className: classes }, [
                el('td', { colspan: span }, [
                    el('div', { className: 'group-title',
                        style: 'width:' + scroller.clientWidth + 'px' }, [
                        el('span', { className: 'toggle', text: group.open ? '▾' : '▸' }),
                        el('span', { className: 'name', text: group.label }),
                        el('span', { className: 'info', text: info })
                    ])
                ])
            ]);
            tr._group = group;
            return tr;
        }

        function renderRow(row, cols) {
            var tr = el('tr', { className: rowClass(row) });
            tr._row = row;
            var marks = options.rowMarks ? options.rowMarks(row) : {};
            tr.appendChild(renderStatus(row));
            cols.forEach(function (column) {
                tr.appendChild(renderCell(row, column, marks[column.key]));
            });
            tr.appendChild(renderActions(row));
            return tr;
        }

        // Status symbol of a row (deviation, local change, not in collection, unknown).
        function renderStatus(row) {
            var status = options.status ? options.status(row) : null;
            var td = el('td', { className: 'status' + (status ? ' ' + status.className : ''),
                title: status ? status.title : null, text: status ? status.symbol : '' });
            td._status = true;
            return td;
        }

        // One cell. Its class tells what kind of value it holds, so that the user sees at a
        // glance where input is possible and what is calculated.
        function renderCell(row, column, mark) {
            var value = cellValue(row, column);
            var text = value == null ? '' : String(value);
            var editable = options.isEditable(column, row);
            var isCursor = row === cursor.item && column.key === cursor.key;
            var classes = ['k-' + column.kind];
            if (column.numeric) classes.push('num');
            if (editable) classes.push('edit');
            if (isCursor) classes.push('cursor');
            if (column.numeric && editable && isNaN(util.toInt(value))) classes.push('invalid');
            if (mark && mark.className) classes.push(mark.className);

            var title = mark && mark.title ? text + '\n' + mark.title : text;
            var picture = column.key === options.imageColumn && options.hasImage &&
                options.hasImage(row);
            if (picture) classes.push('has-image');
            var td = el('td', { className: classes.join(' '),
                title: picture ? null : title || null });
            td._column = column;
            if (column.step && editable && isCursor) {
                // "-" and "+" only in the active cell (also the keys - / + and Shift+Down /
                // Shift+Up).
                td.classList.add('stepper');
                td.appendChild(el('button', { type: 'button', className: 'step minus',
                    tabindex: '-1', 'data-step': '-1', title: 'Eins weniger (− oder Shift+↓)',
                    text: '−' }));
                td.appendChild(el('span', { className: 'value', text: text }));
                td.appendChild(el('button', { type: 'button', className: 'step plus',
                    tabindex: '-1', 'data-step': '1', title: 'Eins mehr (+ oder Shift+↑)',
                    text: '+' }));
            } else {
                td.textContent = text;
            }
            // Card picture: a symbol shows that hovering and clicking show the card.
            if (picture) {
                var symbol = icon('picture');
                symbol.classList.add('card-icon');
                symbol.title = 'Kartenbild: überfahren = Vorschau, Klick = groß';
                td.appendChild(symbol);
            }
            return td;
        }

        function renderActions(row) {
            var buttons = (options.actions ? options.actions(row) : []).map(function (a) {
                return el('button', { type: 'button', className: 'row-action', tabindex: '-1',
                    'data-action': a.action, title: a.title, disabled: !!a.disabled },
                [icon(a.icon)]);
            });
            return el('td', { className: 'actions' }, buttons);
        }

        /*
         * Cell cursor. It points at a row (or group header) and a column key; group headers
         * have no column. The row under the cursor is the selected row.
         */
        function cursorIndex() {
            return cursor.item ? viewRows.indexOf(cursor.item) : -1;
        }

        // After the view changed, the cursor stays on its row if it is still visible. Group
        // headers are rebuilt with every view, so they are found again by their key.
        function keepCursor() {
            var item = cursor.item;
            if (!item || viewRows.indexOf(item) >= 0) return;
            cursor.item = item._group ? viewRows.filter(function (r) {
                return r._group && r.key === item.key;
            })[0] || null : null;
        }

        function setCursor(item, key, scroll) {
            cursor.item = item || null;
            if (key) cursor.key = key;
            if (!cursor.key) cursor.key = (cursorColumns()[0] || {}).key || null;
            if (scroll) scrollToCursor(true);
            render();
        }

        // Moves the cursor by rows and columns; columns wrap into the next or previous row.
        function moveCursor(dRow, dCol, wrap) {
            var cols = cursorColumns();
            if (!viewRows.length || !cols.length) return;
            var index = cursorIndex();
            if (index < 0) {
                // Without a cursor, start at the first visible row instead of jumping to the top.
                var top = Math.min(viewRows.length - 1, Math.ceil(scroller.scrollTop / rowHeight));
                setCursor(viewRows[Math.max(0, top)], cols[0].key, true);
                return;
            }
            var col = Math.max(0, cols.map(function (c) { return c.key; })
                .indexOf(cursor.key));
            col += dCol;
            if (wrap && col >= cols.length) { col = 0; dRow = 1; }
            if (wrap && col < 0) { col = cols.length - 1; dRow = -1; }
            col = Math.max(0, Math.min(cols.length - 1, col));
            index = Math.max(0, Math.min(viewRows.length - 1, index + dRow));
            setCursor(viewRows[index], cols[col].key, true);
        }

        // Scrolls so that the cursor cell is visible (vertically and sideways).
        // centre: the row goes to the middle (keyboard); otherwise it is only made visible.
        function scrollToCursor(centre) {
            var index = cursorIndex();
            if (index < 0) return;
            scrollToRow(index, centre);
            if (cursor.item._group || !cursor.key) return;
            var em = parseFloat(window.getComputedStyle(table).fontSize) || 14;
            var left = STATUS_WIDTH * em;
            var cols = visibleColumns();
            for (var i = 0; i < cols.length && cols[i].key !== cursor.key; i++) {
                left += widthOf(cols[i]) * em;
            }
            var column = columnByKey(cursor.key);
            var width = (column ? widthOf(column) : 5) * em;
            var viewLeft = scroller.scrollLeft + STATUS_WIDTH * em;
            var viewRight = scroller.scrollLeft + scroller.clientWidth - ACTIONS_WIDTH * em;
            if (left < viewLeft) scroller.scrollLeft = left - STATUS_WIDTH * em;
            else if (left + width > viewRight) {
                scroller.scrollLeft = left + width - scroller.clientWidth + ACTIONS_WIDTH * em;
            }
        }

        // Scrolls so that a row is visible and renders immediately. With centre, the row
        // stands in the middle of the visible rows (feedback on 2.0.5.0: moving with the
        // keyboard keeps the active row centred, downwards as upwards); near the start and the
        // end of the list the browser limits it.
        function scrollToRow(index, centre) {
            var top = index * rowHeight;
            var visible = scroller.clientHeight - table.tHead.offsetHeight - rowHeight;
            scrollWatch.own = Date.now();
            if (centre) scroller.scrollTop = Math.max(0, Math.round(top - visible / 2));
            else if (top < scroller.scrollTop) scroller.scrollTop = top;
            else if (top > scroller.scrollTop + visible) scroller.scrollTop = top - visible;
            render();
        }

        // Number of rows that fit into the visible area (for page up / page down).
        function pageRows() {
            var visible = scroller.clientHeight - table.tHead.offsetHeight;
            return Math.max(1, Math.floor(visible / rowHeight) - 1);
        }

        // The table cell of the cursor, if it is rendered.
        function cursorCell() {
            var tr = Array.prototype.filter.call(tbody.children, function (r) {
                return r._row === cursor.item;
            })[0];
            if (!tr) return null;
            return Array.prototype.filter.call(tr.children, function (c) {
                return c._column && c._column.key === cursor.key;
            })[0] || null;
        }

        function cursorEditable() {
            var column = columnByKey(cursor.key);
            return cursor.item && !cursor.item._group && column &&
                options.isEditable(column, cursor.item) ? column : null;
        }

        // Adds a step (+1 / -1) to a quantity. Quantities never go below 0.
        function step(row, column, delta) {
            var current = util.toInt(row[column.key]);
            if (isNaN(current)) current = 0;
            var next = Math.max(0, current + delta);
            if (next !== current) options.onEdit(row, column.key, String(next));
        }

        /*
         * Mouse: clicks set the cursor; buttons in cells and row ends act; group headers toggle
         */
        tbody.addEventListener('mousedown', function (event) {
            // Keep the keyboard focus in the table (not on the clicked button). Clicks into an
            // open cell editor keep their focus.
            if (event.target.closest('input, select')) return;
            event.preventDefault();
            scroller.focus({ preventScroll: true });

            // Double click: detected here and not with "dblclick". The first click redraws the
            // rows, so the cell of the second click is a new element and "dblclick" would go
            // to an element that is no longer in the page (the bug of 2.0.2.0).
            var td = event.target.closest('td');
            var tr = event.target.closest('tr');
            if (event.detail >= 2 && td && td._column && !td._column.placeholder &&
                tr && tr._row &&
                !event.target.closest('button')) {
                cursor.item = tr._row;
                cursor.key = td._column.key;
                if (cursorEditable()) startEdit(null, true);
            }
        });

        // Card pictures: preview while hovering over the picture column.
        tbody.addEventListener('mouseover', function (event) {
            if (!options.onImage) return;
            var td = event.target.closest('td.has-image');
            var tr = td && td.parentNode;
            if (td && tr._row && !editor) options.onImage('hover', tr._row, td);
        });
        tbody.addEventListener('mouseout', function (event) {
            if (!options.onImage) return;
            var td = event.target.closest('td.has-image');
            if (td && !td.contains(event.relatedTarget)) options.onImage('leave');
        });

        tbody.addEventListener('click', function (event) {
            if (editor || event.target.closest('input, select')) return;
            var tr = event.target.closest('tr');
            if (!tr) return;
            if (tr._group) {
                cursor.item = tr._group;
                setGroupOpen(tr._group, !tr._group.open);
                return;
            }
            if (!tr._row) return;
            var td = event.target.closest('td');

            // Row actions at the row end, and the status symbol at the row start.
            var action = event.target.closest('button.row-action');
            if (action) {
                setCursor(tr._row, null, false);
                options.onAction(action.getAttribute('data-action'), tr._row);
                return;
            }
            if (td && td._status) {
                setCursor(tr._row, null, false);
                options.onAction('status', tr._row);
                return;
            }

            // "-" and "+" in the active quantity cell.
            var button = event.target.closest('button.step');
            if (button) {
                step(tr._row, td._column, parseInt(button.getAttribute('data-step'), 10));
                return;
            }
            if (!td || !td._column || td._column.placeholder) return;

            // Card picture: the symbol always opens it; a click on the card number too, unless
            // the number is editable (edit mode), where the click edits as everywhere else.
            if (td.classList.contains('has-image') && options.onImage &&
                (event.target.closest('.card-icon') ||
                    !options.isEditable(td._column, tr._row))) {
                setCursor(tr._row, td._column.key, false);
                options.onImage('open', tr._row, td);
                return;
            }

            // A click on the active cell edits it (as in the spreadsheet); a click on another
            // cell moves the cursor there.
            if (event.detail === 1 && tr._row === cursor.item && td._column.key === cursor.key &&
                cursorEditable()) {
                startEdit(null, true);
                return;
            }
            setCursor(tr._row, td._column.key, false);
        });

        /*
         * Keyboard, as in a spreadsheet:
         *   arrows, Tab / Shift+Tab, Home / End, Ctrl+Home / Ctrl+End, Page Up / Page Down
         *   typing starts editing (replacing the value), F2 edits the value, Delete clears it
         *   Enter moves down; + / - and Shift+Up / Shift+Down add or remove one of a quantity
         *   (+ and - only in quantity columns; elsewhere they are typed as usual)
         *   on a group header: Enter / Space toggles, Right opens, Left closes
         */
        scroller.addEventListener('keydown', function (e) {
            if (e.target !== scroller || editor) return;
            var item = cursor.item;
            var column = cursorEditable();
            var key = e.key;
            var handled = true;

            if (item && item._group && (key === 'Enter' || key === ' ')) {
                setGroupOpen(item, !item.open);
            } else if (item && item._group && key === 'ArrowRight') {
                setGroupOpen(item, true);
            } else if (item && item._group && key === 'ArrowLeft') {
                setGroupOpen(item, false);
            } else if (e.shiftKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
                if (column && column.step) step(item, column, key === 'ArrowUp' ? 1 : -1);
            } else if ((key === '+' || key === '-') && column && column.step &&
                !e.ctrlKey && !e.metaKey && !e.altKey) {
                step(item, column, key === '+' ? 1 : -1);
            } else if (key === 'ArrowUp') {
                moveCursor(-1, 0);
            } else if (key === 'ArrowDown' || key === 'Enter') {
                moveCursor(1, 0);
            } else if (key === 'ArrowLeft') {
                moveCursor(0, -1);
            } else if (key === 'ArrowRight') {
                moveCursor(0, 1);
            } else if (key === 'Tab') {
                moveCursor(0, e.shiftKey ? -1 : 1, true);
            } else if (key === 'Home' && e.ctrlKey) {
                if (viewRows.length) setCursor(viewRows[0], cursorColumns()[0].key, true);
            } else if (key === 'End' && e.ctrlKey) {
                var cols = cursorColumns();
                if (viewRows.length) {
                    setCursor(viewRows[viewRows.length - 1], cols[cols.length - 1].key, true);
                }
            } else if (key === 'Home') {
                moveCursor(0, -cursorColumns().length);
            } else if (key === 'End') {
                moveCursor(0, cursorColumns().length);
            } else if (key === 'PageDown') {
                moveCursor(pageRows(), 0);
            } else if (key === 'PageUp') {
                moveCursor(-pageRows(), 0);
            } else if (key === 'F2') {
                if (column) startEdit(null);
            } else if (key === 'Delete' || key === 'Backspace') {
                if (column && (item[column.key] || '') !== '') {
                    options.onEdit(item, column.key, '');
                }
            } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                if (column) startEdit(key);
                else handled = false;
            } else {
                handled = false;
            }
            if (handled) e.preventDefault();
        });

        /*
         * Editing in place. Columns with a value list get a drop-down, all others a text
         * field. Enter saves and moves down, Tab moves right, Up/Down in a text field save
         * and move, Escape cancels; leaving the cell saves.
         */
        function startEdit(typed, byMouse) {
            var column = cursorEditable();
            if (!column || editor) return;
            scrollToCursor();
            var td = cursorCell();
            if (!td) return;
            var row = cursor.item;
            var current = row[column.key] || '';
            var list = options.choices ? options.choices(column) : null;
            var input;

            if (list) {
                // Drop-down: the value of the reference data first, an empty entry, the known
                // values, and the current value if it is not among them, so that nothing is
                // lost. Only valid values can be chosen, but any of them - also one that
                // differs from the reference data.
                var values = [''].concat(list);
                if (values.indexOf(current) < 0) values.push(current);
                var want = options.referenceValue ? options.referenceValue(column, row) : null;
                var items = values.map(function (v) {
                    return el('option', { value: v, text: v || '–' });
                });
                if (want != null) {
                    items.unshift(el('option', { value: want, className: 'reference',
                        text: 'Stammdaten: ' + (want || '–') }));
                }
                input = el('select', { className: 'cell-editor' }, items);
                input.value = current;
                if (typed) {
                    // Typing a letter jumps to the first value starting with it.
                    var hit = list.filter(function (v) {
                        return v.toLowerCase().indexOf(typed.toLowerCase()) === 0;
                    })[0];
                    if (hit) input.value = hit;
                }
            } else {
                input = el('input', { type: 'text', className: 'cell-editor' });
                input.value = typed != null ? typed : current;
            }
            td.textContent = '';
            td.classList.remove('stepper');
            td.appendChild(input);
            editor = { row: row, column: column };
            input.focus();
            if (!list && typed == null) input.select();

            // A drop-down started with the mouse opens its list at once.
            if (list && byMouse && typeof input.showPicker === 'function') {
                try { input.showPicker(); } catch (e) { /* not allowed here: stays closed */ }
            }

            var done = false;
            function finish(save, move) {
                if (done) return;
                done = true;
                editor = null;
                if (save && input.value !== current) options.onEdit(row, column.key, input.value);
                render();
                if (move !== undefined) {
                    scroller.focus({ preventScroll: true });
                    if (move === 'down') moveCursor(1, 0);
                    else if (move === 'up') moveCursor(-1, 0);
                    else if (move === 'right') moveCursor(0, 1, true);
                    else if (move === 'left') moveCursor(0, -1, true);
                }
            }
            input.addEventListener('keydown', function (e) {
                e.stopPropagation();
                if (e.key === 'Enter') { e.preventDefault(); finish(true, 'down'); }
                else if (e.key === 'Tab') {
                    e.preventDefault();
                    finish(true, e.shiftKey ? 'left' : 'right');
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    finish(false, null);
                } else if (!list && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
                    e.preventDefault();
                    finish(true, e.key === 'ArrowUp' ? 'up' : 'down');
                }
            });
            input.addEventListener('blur', function () { finish(true); });

            // Choosing a value with the mouse in the opened list saves it at once. With the
            // keyboard, the arrow keys only move through the list; Enter saves.
            if (list && byMouse) {
                input.addEventListener('change', function () { finish(true, null); });
            }
        }

        /*
         * Public interface
         */
        buildHeader();
        return {
            // Replaces all rows and re-applies search, filters, grouping and sort.
            setRows: function (rows) {
                allRows = rows;
                applyView();
            },
            // Redraws without filtering again, so an edited row does not vanish from view.
            refresh: render,
            applyView: applyView,
            setSearch: function (text) { search = text; filterChanged(); applyView(); },
            setMode: function (value) { mode = value; filterChanged(); applyView(); },
            clearFilters: function () {
                FCT.gridFilter.close();
                filters = {};
                checks = {};
                search = '';
                mode = 'all';
                sort = { key: null, dir: 1 };
                filterChanged();
                buildHeader();
                applyView();
            },
            setColumnHidden: function (key, hidden) {
                columns.forEach(function (c) { if (c.key === key) c.hidden = hidden; });
                fitted = {};    // the first column of a group may have changed
                buildHeader();
                render();
            },
            // Row height in pixels; follows the font size, so the titles are measured again.
            setRowHeight: function (px) {
                rowHeight = px;
                refit();
            },
            // Grouping: 'none', 'set' or 'setClass'.
            setGrouping: function (value) {
                grouping = value;
                applyView();
            },
            // Order of the sets: 'date' (release date) or 'alpha'.
            setSetOrder: function (value) {
                setOrder = value;
                applyView();
            },
            setOutline: setOutline,
            columns: function () { return columns; },
            selected: function () {
                return cursor.item && !cursor.item._group ? cursor.item : null;
            },
            focus: function () { scroller.focus({ preventScroll: true }); },
            // Selects a row and scrolls to it. A row hidden by filters or closed groups (e.g. one
            // just inserted) is shown anyway until the filters change.
            select: function (row) {
                var index = viewRows.indexOf(row);
                if (index < 0 && allRows.indexOf(row) >= 0) {
                    pinned.add(row);
                    var states = filtering() ? filterOpen : groupOpen;
                    states.set(options.groupNames(row)[0], true);
                    var section = buildSections().of.get(row);
                    if (section) states.set(section.key, true);
                    applyView();
                }
                setCursor(row, null, true);
            },
            // Number of rows matching search and filters, including those in closed groups.
            viewCount: function () { return matchCount; }
        };
    }

    return { create: create };
})();
