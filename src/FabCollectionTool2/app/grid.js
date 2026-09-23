/*
 * grid.js - the collection table: sorting, free text search, column filters, column
 * selection, accordion groups, colour marks, row actions and editing in place.
 *
 * Only the visible part of the table is rendered (virtual scrolling with a fixed row height),
 * so tens of thousands of rows stay fluent without any library. Group headers of the
 * accordion are rows of the same height, so they fit into the same scheme.
 */
FCT.grid = (function () {
    var util = FCT.util;
    var el = util.el;
    var OVERSCAN = 20;
    var ACTIONS_WIDTH = 10;

    // Icons of the row actions (inline SVG, drawn with the text colour).
    var ICONS = {
        edit: '<path d="M11 2.5l2.5 2.5L6 12.5H3.5V10z"/>',
        insert: '<path d="M8 3v10M3 8h10"/>',
        copy: '<rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1"/><path d="M3 10.5V3h7.5"/>',
        paste: '<rect x="3" y="3" width="10" height="11" rx="1"/>' +
            '<path d="M6 3V2h4v1M8 6v5M5.5 8.5L8 11l2.5-2.5"/>',
        remove: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>'
    };

    function icon(name) {
        var span = el('span', { className: 'icon' });
        span.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true">' + ICONS[name] + '</svg>';
        return span;
    }

    // Creates a grid inside the container element.
    // options:
    //   columns     [{ key, label, width (em), numeric, kind, hidden, step, value(row) }]
    //               kind is 'input', 'reference', 'identity' or 'calc'
    //   searchKeys  keys searched by the free text search
    //   isEditable(column, row)   whether a cell may be edited
    //   rowMarks(row)             { key: { className, title } } extra marks per cell
    //   actions(row)              [{ action, icon, title, disabled }] buttons at the row end
    //   groupNames(row)           [level 1 name, level 2 name] for the accordion
    //   onEdit(row, key, text), onAction(action, row), onView(count)
    function create(container, options) {
        var columns = options.columns;
        var allRows = [];
        var viewRows = [];
        var matchCount = 0;
        var selected = null;
        var sort = { key: null, dir: 1 };
        var filters = {};
        var search = '';
        var mode = 'all';
        var grouping = 'setClass';
        var groupOpen = new Map();      // explicit open/closed state of groups
        var filterOpen = new Map();     // the same while a search or filter is active
        var groupKeys = [];             // keys of all groups of the current rows
        var pinned = new Set();         // rows shown regardless of filters (just inserted)
        var rowHeight = 24;
        var editor = null;
        var renderPending = false;

        // Static structure: scroll area with a table; the body is re-rendered on demand.
        var colgroup = el('colgroup');
        var headRow = el('tr');
        var filterRow = el('tr', { className: 'filters' });
        var tbody = el('tbody');
        var table = el('table', { className: 'grid' }, [colgroup, el('thead', {}, [headRow,
            filterRow]), tbody]);
        var scroller = el('div', { className: 'grid-scroll' }, [table]);
        container.appendChild(scroller);
        scroller.addEventListener('scroll', scheduleRender);
        window.addEventListener('resize', scheduleRender);

        /*
         * Header: labels with sorting, one filter input per column
         */
        function buildHeader() {
            colgroup.textContent = '';
            headRow.textContent = '';
            filterRow.textContent = '';

            // The table gets the sum of all column widths. Only then does the fixed table
            // layout really hold, and columns no longer jump while scrolling.
            var total = ACTIONS_WIDTH;
            visibleColumns().forEach(function (column) {
                total += column.width;
                colgroup.appendChild(el('col', { style: 'width:' + column.width + 'em' }));

                var active = sort.key === column.key;
                var marker = el('span', {
                    className: 'sort' + (active ? ' active' : ''),
                    text: active ? (sort.dir > 0 ? '▲' : '▼') : '⇅'
                });
                headRow.appendChild(el('th', {
                    title: column.label + ' – klicken zum Sortieren (auf, ab, aus)',
                    className: 'sortable ' + (column.numeric ? 'num' : ''),
                    onclick: function () { toggleSort(column.key); }
                }, [el('span', { className: 'label', text: column.label }), marker]));

                var input = el('input', {
                    type: 'text',
                    value: filters[column.key] || '',
                    placeholder: column.numeric ? '>0' : 'Filter',
                    title: column.numeric
                        ? 'Zahl oder Vergleich: 3, >0, <3, >=2, !=0'
                        : 'Enthält den Text; =Text genau; = leer; !Text enthält nicht',
                    oninput: function () {
                        filters[column.key] = input.value;
                        filterChanged();
                        applyView();
                    }
                });
                filterRow.appendChild(el('th', {}, [input]));
            });

            // Row actions stay visible at the right edge, also when scrolling sideways.
            colgroup.appendChild(el('col', { style: 'width:' + ACTIONS_WIDTH + 'em' }));
            headRow.appendChild(el('th', { className: 'actions', text: 'Aktionen' }));
            filterRow.appendChild(el('th', { className: 'actions' }));
            table.style.width = total + 'em';
        }

        function visibleColumns() {
            return columns.filter(function (c) { return !c.hidden; });
        }

        // Display value of a cell.
        function cellValue(row, column) {
            return column.value ? column.value(row) : row[column.key];
        }

        /*
         * Filtering and sorting
         */

        // Tests one value against a column filter expression.
        function matchesFilter(value, expression, numeric) {
            var text = expression.trim();
            if (!text) return true;
            if (numeric) {
                var m = /^(<=|>=|!=|<|>|=)?\s*(-?\d+)$/.exec(text);
                if (m) {
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
            if (text[0] === '!') return folded.indexOf(util.fold(text.slice(1))) < 0;
            return folded.indexOf(util.fold(text)) >= 0;
        }

        // Quick filters for the most common questions.
        function matchesMode(row) {
            var calc = row._calc || {};
            switch (mode) {
                case 'owned': return calc.have > 0;
                case 'missing': return calc.needTotal > 0;
                case 'missingSet': return calc.needSet > 0;
                case 'surplus': return calc.have > 0 && calc.leftSet > 0;
                case 'problems': return row._problem;
                default: return true;
            }
        }

        // A new search or filter starts with all groups open and no pinned rows.
        function filterChanged() {
            filterOpen.clear();
            pinned.clear();
        }

        // True while a search, column filter or quick filter narrows the rows.
        function filtering() {
            return !!search.trim() || mode !== 'all' || Object.keys(filters).some(function (k) {
                return filters[k] && filters[k].trim();
            });
        }

        // Recomputes the list of visible rows from search, filters, quick filter and sort.
        function applyView() {
            var words = util.fold(search).split(/\s+/).filter(Boolean);
            var active = columns.filter(function (c) {
                return filters[c.key] && filters[c.key].trim();
            });

            var rows = allRows.filter(function (row) {
                if (pinned.has(row)) return true;
                if (!matchesMode(row)) return false;
                if (words.length) {
                    var haystack = options.searchKeys.map(function (key) {
                        return util.fold(row[key]);
                    }).join(' ');
                    for (var w = 0; w < words.length; w++) {
                        if (haystack.indexOf(words[w]) < 0) return false;
                    }
                }
                return active.every(function (c) {
                    return matchesFilter(cellValue(row, c), filters[c.key], c.numeric);
                });
            });

            // Sorting is stable: equal values keep the order of the file.
            if (sort.key) {
                var column = columns.filter(function (c) { return c.key === sort.key; })[0];
                var positions = new Map();
                allRows.forEach(function (row, i) { positions.set(row, i); });
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
            render();
            if (options.onView) options.onView(matchCount);
        }

        /*
         * Accordion: rows are grouped by set and, below that, by talent and class.
         * Groups appear in the order of their first row in the file; sorting applies within
         * the groups. Sets start closed, talent/class groups inside an opened set start open.
         * While a search or filter is active, all groups with hits are open.
         */
        function groupRows(rows) {
            var levels = grouping === 'set' ? 1 : 2;

            // Order of the groups: first appearance in the file.
            var order = new Map();
            allRows.forEach(function (row) {
                var names = options.groupNames(row);
                var key1 = names[0];
                var key2 = names[0] + '\u0000' + names[1];
                if (!order.has(key1)) order.set(key1, order.size);
                if (!order.has(key2)) order.set(key2, order.size);
            });
            groupKeys = Array.from(order.keys()).filter(function (key) {
                return levels === 2 || key.indexOf('\u0000') < 0;
            });

            // Put the (sorted) rows into their groups.
            var sets = new Map();
            rows.forEach(function (row) {
                var names = options.groupNames(row);
                var set = sets.get(names[0]);
                if (!set) {
                    set = header(1, names[0], names[0]);
                    set.children = new Map();
                    sets.set(names[0], set);
                }
                set.rows.push(row);
                if (levels === 1) return;
                var key2 = names[0] + '\u0000' + names[1];
                var sub = set.children.get(key2);
                if (!sub) {
                    sub = header(2, key2, names[1]);
                    set.children.set(key2, sub);
                }
                sub.rows.push(row);
            });

            // Flatten into the list of view rows: headers, and rows of open groups.
            function byOrder(a, b) { return order.get(a.key) - order.get(b.key); }
            var result = [];
            Array.from(sets.values()).sort(byOrder).forEach(function (set) {
                result.push(set);
                if (!set.open) return;
                if (levels === 1) {
                    Array.prototype.push.apply(result, set.rows);
                    return;
                }
                Array.from(set.children.values()).sort(byOrder).forEach(function (sub) {
                    result.push(sub);
                    if (sub.open) Array.prototype.push.apply(result, sub.rows);
                });
            });
            return result;
        }

        // Creates a group header row.
        function header(level, key, label) {
            return { _group: true, level: level, key: key, label: label, rows: [],
                open: isOpen(key, level) };
        }

        function isOpen(key, level) {
            var states = filtering() ? filterOpen : groupOpen;
            if (states.has(key)) return states.get(key);
            return filtering() || level === 2;
        }

        function toggleGroup(group) {
            var states = filtering() ? filterOpen : groupOpen;
            states.set(group.key, !group.open);
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

        // Row classes for colour marks.
        function rowClass(row) {
            var calc = row._calc || {};
            var classes = [];
            if (row._reference) classes.push('ref');
            if (calc.needTotal > 0) classes.push('missing');
            else if (calc.have > 0 && calc.leftSet > 0) classes.push('surplus');
            if (row._problem) classes.push('problem');
            if (row === selected) classes.push('selected');
            return classes.join(' ');
        }

        function render() {
            if (editor) return;
            var cols = visibleColumns();
            var span = cols.length + 1;
            var headHeight = table.tHead.offsetHeight;
            var viewport = scroller.clientHeight - headHeight;
            var first = Math.max(0, Math.floor(scroller.scrollTop / rowHeight) - OVERSCAN);
            var count = Math.ceil(viewport / rowHeight) + 2 * OVERSCAN;
            var last = Math.min(viewRows.length, first + count);

            tbody.textContent = '';
            tbody.appendChild(spacer(first * rowHeight, span));
            for (var i = first; i < last; i++) {
                var item = viewRows[i];
                tbody.appendChild(item._group ? renderGroup(item, span) : renderRow(item, cols));
            }
            tbody.appendChild(spacer((viewRows.length - last) * rowHeight, span));
        }

        function spacer(height, span) {
            return el('tr', { className: 'spacer', style: 'height:' + height + 'px' },
                [el('td', { colspan: span })]);
        }

        // Group header: open/closed marker, name and a short summary of its rows.
        function renderGroup(group, span) {
            var cards = 0;
            var missing = 0;
            group.rows.forEach(function (row) {
                cards += row._have || 0;
                if (row._calc && row._calc.needTotal > 0) missing++;
            });
            var info = group.rows.length.toLocaleString('de-DE') + ' Zeilen · ' +
                cards.toLocaleString('de-DE') + ' Karten' +
                (missing ? ' · ' + missing.toLocaleString('de-DE') + ' fehlen' : '');
            var tr = el('tr', { className: 'group level' + group.level +
                (group.open ? ' open' : '') }, [
                el('td', { colspan: span }, [
                    el('span', { className: 'toggle', text: group.open ? '▾' : '▸' }),
                    el('span', { className: 'name', text: group.label }),
                    el('span', { className: 'info', text: info })
                ])
            ]);
            tr._group = group;
            return tr;
        }

        function renderRow(row, cols) {
            var tr = el('tr', { className: rowClass(row) });
            tr._row = row;
            var marks = options.rowMarks ? options.rowMarks(row) : {};
            cols.forEach(function (column) {
                tr.appendChild(renderCell(row, column, marks[column.key]));
            });
            tr.appendChild(renderActions(row));
            return tr;
        }

        // One cell. Its class tells what kind of value it holds, so that the user sees at a
        // glance where input is possible and what is calculated.
        function renderCell(row, column, mark) {
            var value = cellValue(row, column);
            var text = value == null ? '' : String(value);
            var editable = options.isEditable(column, row);
            var classes = ['k-' + column.kind];
            if (column.numeric) classes.push('num');
            if (editable) classes.push('edit');
            if (column.numeric && editable && isNaN(util.toInt(value))) classes.push('invalid');
            if (mark && mark.className) classes.push(mark.className);

            var title = mark && mark.title ? text + '\n' + mark.title : text;
            var td = el('td', { className: classes.join(' '), title: title || null });
            td._column = column;
            if (column.step && editable) {
                // Quantities get "-" and "+" buttons; their space is always reserved.
                td.classList.add('stepper');
                td.appendChild(el('button', { type: 'button', className: 'step',
                    'data-step': '-1', title: 'Eins weniger', text: '−' }));
                td.appendChild(el('span', { className: 'value', text: text }));
                td.appendChild(el('button', { type: 'button', className: 'step',
                    'data-step': '1', title: 'Eins mehr', text: '+' }));
            } else {
                td.textContent = text;
            }
            return td;
        }

        function renderActions(row) {
            var buttons = (options.actions ? options.actions(row) : []).map(function (a) {
                return el('button', { type: 'button', className: 'row-action',
                    'data-action': a.action, title: a.title, disabled: !!a.disabled },
                [icon(a.icon)]);
            });
            return el('td', { className: 'actions' }, buttons);
        }

        /*
         * Selection, row actions, quantity buttons and editing
         */
        function selectRow(tr) {
            selected = tr._row;
            Array.prototype.forEach.call(tbody.querySelectorAll('tr.selected'), function (r) {
                r.classList.remove('selected');
            });
            tr.classList.add('selected');
        }

        tbody.addEventListener('click', function (event) {
            var tr = event.target.closest('tr');
            if (!tr) return;
            if (tr._group) { toggleGroup(tr._group); return; }
            if (!tr._row) return;
            selectRow(tr);

            // Row actions at the row end.
            var action = event.target.closest('button.row-action');
            if (action) {
                options.onAction(action.getAttribute('data-action'), tr._row);
                return;
            }

            // "-" and "+" next to a quantity. Quantities never go below 0.
            var step = event.target.closest('button.step');
            if (step) {
                var td = step.closest('td');
                var key = td._column.key;
                var current = util.toInt(tr._row[key]);
                if (isNaN(current)) current = 0;
                var next = Math.max(0, current + parseInt(step.getAttribute('data-step'), 10));
                if (next !== current) options.onEdit(tr._row, key, String(next));
            }
        });

        tbody.addEventListener('dblclick', function (event) {
            if (event.target.closest('button')) return;
            var td = event.target.closest('td');
            var tr = td && td.parentNode;
            if (td && td._column && tr._row && options.isEditable(td._column, tr._row)) {
                startEdit(td);
            }
        });

        // Replaces a cell by an input field. Enter saves and moves down, Tab moves right,
        // Escape cancels.
        function startEdit(td) {
            var row = td.parentNode._row;
            var column = td._column;
            var input = el('input', { type: 'text', className: 'cell-editor' });
            input.value = row[column.key] || '';
            td.textContent = '';
            td.appendChild(input);
            editor = { row: row, column: column };
            input.focus();
            input.select();

            var done = false;
            function finish(save, move) {
                if (done) return;
                done = true;
                editor = null;
                if (save && input.value !== (row[column.key] || '')) {
                    options.onEdit(row, column.key, input.value);
                }
                render();
                if (move) moveEditor(row, column, move);
            }
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); finish(true, 'down'); }
                else if (e.key === 'Tab') {
                    e.preventDefault();
                    finish(true, e.shiftKey ? 'left' : 'right');
                } else if (e.key === 'Escape') { finish(false); }
            });
            input.addEventListener('blur', function () { finish(true); });
        }

        // Opens the editor in the neighbouring cell after Enter or Tab.
        function moveEditor(row, column, direction) {
            var index = viewRows.indexOf(row);
            if (direction === 'down') {
                do { index++; } while (index < viewRows.length && viewRows[index]._group);
            }
            if (index >= viewRows.length) return;
            var target = viewRows[index];
            var editable = visibleColumns().filter(function (c) {
                return options.isEditable(c, target);
            });
            var col = editable.indexOf(column);
            if (direction === 'right') col++;
            if (direction === 'left') col--;
            if (col < 0 || col >= editable.length) return;
            scrollToRow(index);
            var tr = Array.prototype.filter.call(tbody.children, function (r) {
                return r._row === target;
            })[0];
            if (!tr) return;
            var td = Array.prototype.filter.call(tr.children, function (c) {
                return c._column === editable[col];
            })[0];
            if (td) startEdit(td);
        }

        // Scrolls so that a row is visible and renders immediately.
        function scrollToRow(index) {
            var top = index * rowHeight;
            var visible = scroller.clientHeight - table.tHead.offsetHeight - rowHeight;
            if (top < scroller.scrollTop) scroller.scrollTop = top;
            else if (top > scroller.scrollTop + visible) scroller.scrollTop = top - visible;
            render();
        }

        /*
         * Public interface
         */
        buildHeader();
        return {
            // Replaces all rows and re-applies search, filters, grouping and sort.
            setRows: function (rows) {
                allRows = rows;
                if (selected && rows.indexOf(selected) < 0) selected = null;
                applyView();
            },
            // Redraws without filtering again, so an edited row does not vanish from view.
            refresh: render,
            applyView: applyView,
            setSearch: function (text) { search = text; filterChanged(); applyView(); },
            setMode: function (value) { mode = value; filterChanged(); applyView(); },
            clearFilters: function () {
                filters = {};
                search = '';
                mode = 'all';
                sort = { key: null, dir: 1 };
                filterChanged();
                buildHeader();
                applyView();
            },
            setColumnHidden: function (key, hidden) {
                columns.forEach(function (c) { if (c.key === key) c.hidden = hidden; });
                buildHeader();
                render();
            },
            // Row height in pixels; follows the font size.
            setRowHeight: function (px) {
                rowHeight = px;
                render();
            },
            // Grouping: 'none', 'set' or 'setClass'.
            setGrouping: function (value) {
                grouping = value;
                applyView();
            },
            // Opens or closes all groups.
            setAllGroups: function (open) {
                var states = filtering() ? filterOpen : groupOpen;
                groupKeys.forEach(function (key) { states.set(key, open); });
                applyView();
            },
            columns: function () { return columns; },
            selected: function () { return selected; },
            // Selects a row and scrolls to it. A row hidden by filters or closed groups (e.g. one
            // just inserted) is shown anyway until the filters change.
            select: function (row) {
                selected = row;
                var index = viewRows.indexOf(row);
                if (index < 0 && allRows.indexOf(row) >= 0) {
                    pinned.add(row);
                    var names = options.groupNames(row);
                    var states = filtering() ? filterOpen : groupOpen;
                    states.set(names[0], true);
                    states.set(names[0] + '\u0000' + names[1], true);
                    applyView();
                    index = viewRows.indexOf(row);
                }
                if (index >= 0) scrollToRow(index); else render();
            },
            // Number of rows matching search and filters, including those in closed groups.
            viewCount: function () { return matchCount; }
        };
    }

    return { create: create };
})();
