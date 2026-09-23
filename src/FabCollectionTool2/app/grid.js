/*
 * grid.js - the collection table: sorting, free text search, column filters, column
 * selection, colour marks and editing in place.
 *
 * Only the visible part of the table is rendered (virtual scrolling with a fixed row height),
 * so tens of thousands of rows stay fluent without any library.
 */
FCT.grid = (function () {
    var util = FCT.util;
    var el = util.el;
    var ROW_HEIGHT = 24;
    var OVERSCAN = 20;

    // Creates a grid inside the container element.
    // options: columns [{ key, label, width, numeric, editable, hidden, value(row) }],
    //          onEdit(row, key, text), onSelect(row), searchKeys [keys for free text search]
    function create(container, options) {
        var columns = options.columns;
        var allRows = [];
        var viewRows = [];
        var selected = null;
        var sort = { key: null, dir: 1 };
        var filters = {};
        var search = '';
        var mode = 'all';
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
            visibleColumns().forEach(function (column) {
                colgroup.appendChild(el('col', { style: 'width:' + column.width + 'px' }));

                var arrow = sort.key === column.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : '';
                headRow.appendChild(el('th', {
                    title: 'Klicken zum Sortieren',
                    className: column.numeric ? 'num' : '',
                    onclick: function () { toggleSort(column.key); }
                }, [column.label + arrow]));

                var input = el('input', {
                    type: 'text',
                    value: filters[column.key] || '',
                    placeholder: column.numeric ? '>0' : 'Filter',
                    title: column.numeric
                        ? 'Zahl oder Vergleich: 3, >0, <3, >=2, !=0'
                        : 'Enthält den Text; =Text genau; = leer; !Text enthält nicht',
                    oninput: function () {
                        filters[column.key] = input.value;
                        applyView();
                    }
                });
                filterRow.appendChild(el('th', {}, [input]));
            });
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

        // Recomputes the list of visible rows from search, filters, quick filter and sort.
        function applyView() {
            var words = util.fold(search).split(/\s+/).filter(Boolean);
            var active = columns.filter(function (c) {
                return filters[c.key] && filters[c.key].trim();
            });

            viewRows = allRows.filter(function (row) {
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
                viewRows.sort(function (a, b) {
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
            render();
            if (options.onView) options.onView(viewRows.length);
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
            var headHeight = table.tHead.offsetHeight;
            var viewport = scroller.clientHeight - headHeight;
            var first = Math.max(0, Math.floor(scroller.scrollTop / ROW_HEIGHT) - OVERSCAN);
            var count = Math.ceil(viewport / ROW_HEIGHT) + 2 * OVERSCAN;
            var last = Math.min(viewRows.length, first + count);

            tbody.textContent = '';
            tbody.appendChild(spacer(first * ROW_HEIGHT, cols.length));
            for (var i = first; i < last; i++) tbody.appendChild(renderRow(viewRows[i], cols));
            tbody.appendChild(spacer((viewRows.length - last) * ROW_HEIGHT, cols.length));
        }

        function spacer(height, span) {
            return el('tr', { className: 'spacer', style: 'height:' + height + 'px' },
                [el('td', { colspan: span })]);
        }

        function renderRow(row, cols) {
            var tr = el('tr', { className: rowClass(row) });
            tr._row = row;
            cols.forEach(function (column) {
                var value = cellValue(row, column);
                var classes = [];
                if (column.numeric) classes.push('num');
                if (column.editable) classes.push('edit');
                if (column.numeric && column.editable && isNaN(util.toInt(value))) {
                    classes.push('invalid');
                }
                if (column.key === 'Id' && row._unknownId) classes.push('unknown');
                var td = el('td', { className: classes.join(' '), title: value || null },
                    [value == null ? '' : String(value)]);
                td._column = column;
                tr.appendChild(td);
            });
            return tr;
        }

        /*
         * Selection and editing
         */
        tbody.addEventListener('click', function (event) {
            var tr = event.target.closest('tr');
            if (!tr || !tr._row) return;
            selected = tr._row;
            Array.prototype.forEach.call(tbody.querySelectorAll('tr.selected'), function (r) {
                r.classList.remove('selected');
            });
            tr.classList.add('selected');
            if (options.onSelect) options.onSelect(selected);
        });

        tbody.addEventListener('dblclick', function (event) {
            var td = event.target.closest('td');
            if (td && td._column && td._column.editable) startEdit(td);
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
            var editable = visibleColumns().filter(function (c) { return c.editable; });
            var index = viewRows.indexOf(row);
            var col = editable.indexOf(column);
            if (direction === 'down') index++;
            if (direction === 'right') col++;
            if (direction === 'left') col--;
            if (index >= viewRows.length || col < 0 || col >= editable.length) return;
            scrollToRow(index);
            var tr = Array.prototype.filter.call(tbody.children, function (r) {
                return r._row === viewRows[index];
            })[0];
            if (!tr) return;
            var td = Array.prototype.filter.call(tr.children, function (c) {
                return c._column === editable[col];
            })[0];
            if (td) startEdit(td);
        }

        // Scrolls so that a row is visible and renders immediately.
        function scrollToRow(index) {
            var top = index * ROW_HEIGHT;
            var visible = scroller.clientHeight - table.tHead.offsetHeight - ROW_HEIGHT;
            if (top < scroller.scrollTop) scroller.scrollTop = top;
            else if (top > scroller.scrollTop + visible) scroller.scrollTop = top - visible;
            render();
        }

        /*
         * Public interface
         */
        buildHeader();
        return {
            // Replaces all rows and re-applies search, filters and sort.
            setRows: function (rows) {
                allRows = rows;
                if (selected && rows.indexOf(selected) < 0) selected = null;
                applyView();
            },
            // Redraws without filtering again, so an edited row does not vanish from view.
            refresh: render,
            applyView: applyView,
            setSearch: function (text) { search = text; applyView(); },
            setMode: function (value) { mode = value; applyView(); },
            clearFilters: function () {
                filters = {};
                search = '';
                mode = 'all';
                sort = { key: null, dir: 1 };
                buildHeader();
                applyView();
            },
            setColumnHidden: function (key, hidden) {
                columns.forEach(function (c) { if (c.key === key) c.hidden = hidden; });
                buildHeader();
                render();
            },
            columns: function () { return columns; },
            selected: function () { return selected; },
            select: function (row) {
                selected = row;
                var index = viewRows.indexOf(row);
                if (index >= 0) scrollToRow(index); else render();
            },
            viewCount: function () { return viewRows.length; }
        };
    }

    return { create: create };
})();
