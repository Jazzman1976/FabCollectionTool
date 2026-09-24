/*
 * card-image.js - pictures of the cards (feedback on 2.0.3.0). Hovering over a card number
 * shows a preview, large enough to read the card title; a click opens the picture in a large
 * window, large enough to read the card text. The pictures come from the card data set
 * (reference data) and are loaded from the internet; without it "Kein Bild verfügbar" shows.
 */
FCT.cardImage = (function () {
    var el = FCT.util.el;
    var HOVER_DELAY = 300;     // milliseconds before the preview appears
    var GAP = 10;              // space between cell and preview, in pixels
    var preview = null;        // the preview element (created once)
    var timer = null;
    var current = null;        // URL of the preview shown or about to be shown
    var viewer = null;         // the large window while open

    // An image element that shows a short text instead if the picture cannot be loaded.
    function picture(url, alt, className) {
        var img = el('img', { src: url, alt: alt, className: className });
        img.addEventListener('error', function () {
            var note = el('div', { className: className + ' missing',
                text: 'Kein Bild verfügbar' });
            if (img.parentNode) img.parentNode.replaceChild(note, img);
            FCT.log.info('image', 'Kartenbild nicht ladbar', url);
        });
        return img;
    }

    /*
     * Preview while hovering: shown next to the cell (right of it, or left if there is no
     * room), kept inside the window.
     */
    function hover(url, cell, caption) {
        clearTimeout(timer);
        if (!url) { leave(); return; }
        current = url;
        timer = setTimeout(function () {
            if (current !== url) return;
            if (!preview) {
                preview = el('div', { className: 'card-preview', role: 'tooltip' });
                document.body.appendChild(preview);
            }
            preview.textContent = '';
            preview.appendChild(picture(url, caption, 'card-preview-image'));
            preview.appendChild(el('div', { className: 'card-caption', text: caption }));
            preview.hidden = false;
            place(cell.getBoundingClientRect());
        }, HOVER_DELAY);
    }

    function place(box) {
        var width = preview.offsetWidth;
        var height = preview.offsetHeight || 400;
        var left = box.right + GAP;
        if (left + width > window.innerWidth - 8) left = box.left - GAP - width;
        var top = Math.min(Math.max(8, box.top - 40), window.innerHeight - height - 8);
        preview.style.left = Math.max(8, left) + 'px';
        preview.style.top = Math.max(8, top) + 'px';
    }

    function leave() {
        clearTimeout(timer);
        current = null;
        if (preview) preview.hidden = true;
    }

    /*
     * Large window: the picture in the size of the data set's large image (546 x 762), at most
     * as high as the window, with card number, name and variant below it. Closes with Esc, a
     * click next to it or ×.
     */
    function open(url, caption) {
        leave();
        close();
        if (!url) return;
        var box = el('div', { className: 'card-viewer-box' }, [
            el('button', { type: 'button', className: 'card-viewer-close', title: 'Schließen (Esc)',
                text: '×', onclick: close }),
            picture(url, caption, 'card-viewer-image'),
            el('div', { className: 'card-caption' }, [caption, ' · ',
                el('a', { href: url, target: '_blank', rel: 'noopener',
                    text: 'Bild in neuem Tab' })])
        ]);
        var overlay = el('div', { className: 'card-viewer', role: 'dialog',
            'aria-label': caption }, [box]);
        overlay.addEventListener('mousedown', function (event) {
            if (event.target === overlay) close();
        });
        function onKey(event) {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            close();
        }
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(overlay);
        viewer = { overlay: overlay, onKey: onKey };
        FCT.log.debug('image', 'Kartenbild geöffnet', caption);
    }

    function close() {
        if (!viewer) return;
        viewer.overlay.remove();
        document.removeEventListener('keydown', viewer.onKey, true);
        viewer = null;
    }

    return { hover: hover, leave: leave, open: open, close: close };
})();
