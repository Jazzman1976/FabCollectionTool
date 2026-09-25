/*
 * notices.js - the notice area between the toolbar and the table. Everything the user should
 * notice right now (connect the file, a question of the browser, edit mode, a failed save)
 * appears here, in the usual striking notice colours: yellow for notices, red for errors,
 * green for success (fades after a few seconds). Each notice has an id, so it can be updated
 * or removed; a notice without required action can be closed with ×.
 */
FCT.notices = (function () {
    var el = FCT.util.el;
    var ICONS = { info: 'ℹ', warn: '⚠', error: '⛔', ok: '✓' };
    var SUCCESS_TIME = 5000;
    var shown = new Map();      // id -> { node, timer }

    function area() {
        return document.getElementById('banners');
    }

    /*
     * Shows (or replaces) a notice.
     *   id        name of the notice, e.g. 'restore'
     *   level     'info' (yellow notice), 'warn' (yellow, stronger), 'error' (red), 'ok' (green)
     *   content   text or array of texts and elements
     *   options   { buttons: [{ label, title, onClick, primary }], closable (default: true
     *               unless there are buttons), hint (small text after the content) }
     */
    function show(id, level, content, options) {
        options = options || {};
        clear(id);
        var buttons = (options.buttons || []).map(function (b) {
            return el('button', { type: 'button', text: b.label, title: b.title || null,
                className: b.primary ? 'primary' : '', onclick: b.onClick });
        });
        var closable = options.closable != null ? options.closable : !buttons.length;
        var close = closable ? el('button', { type: 'button', className: 'notice-close',
            title: 'Hinweis schließen', text: '×', onclick: function () { clear(id); } }) : null;
        var parts = Array.isArray(content) ? content : [content];
        var node = el('div', { className: 'notice ' + level, role: level === 'error'
            ? 'alert' : 'status' }, [
            el('span', { className: 'notice-icon', text: ICONS[level] || ICONS.info }),
            el('div', { className: 'notice-text' }, parts.concat(options.hint
                ? [el('span', { className: 'hint', text: ' ' + options.hint })] : [])),
            buttons.length ? el('div', { className: 'notice-buttons' }, buttons) : null,
            close
        ]);
        area().appendChild(node);
        var timer = level === 'ok' ? setTimeout(function () { clear(id); }, SUCCESS_TIME) : null;
        shown.set(id, { node: node, timer: timer });
        if (FCT.log) FCT.log.debug('notice', id + ' (' + level + ')', node.textContent);
        refreshLayout();
        return node;
    }

    function clear(id) {
        var notice = shown.get(id);
        if (!notice) return;
        clearTimeout(notice.timer);
        notice.node.remove();
        shown.delete(id);
        refreshLayout();
    }

    // The table below needs to know that the space above it changed.
    function refreshLayout() {
        window.dispatchEvent(new Event('resize'));
    }

    return {
        show: show,
        clear: clear,
        has: function (id) { return shown.has(id); }
    };
})();
