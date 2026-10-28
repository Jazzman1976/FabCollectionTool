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
        if (!url) { leave(); return; }
        show(url, cell, '', function (box) {
            box.appendChild(picture(url, caption, 'card-preview-image'));
            box.appendChild(el('div', { className: 'card-caption', text: caption }));
            // The colour alone does not tell that a click opens more (feedback on #96).
            box.appendChild(el('div', { className: 'card-hint',
                text: 'Klicken für große Detailansicht' }));
        });
    }

    /*
     * The same preview window with other content (prices, feedback on #96): key tells
     * previews apart (the cell, for instance), build(box) fills the window, className is
     * added to its class.
     */
    function show(key, cell, className, build) {
        clearTimeout(timer);
        current = key;
        timer = setTimeout(function () {
            if (current !== key) return;
            if (!preview) {
                preview = el('div', { role: 'tooltip' });
                document.body.appendChild(preview);
            }
            preview.className = 'card-preview' + (className ? ' ' + className : '');
            preview.textContent = '';
            build(preview);
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
     * as high as the window, with card number, name and variant below it. details (optional,
     * issue #26) is shown next to the picture, or below it in a narrow window. Closes with
     * Esc, a click next to it or ×.
     */
    function open(url, caption, details) {
        leave();
        close();
        if (!url && !details) return;
        var image = url ? picture(url, caption, 'card-viewer-image')
            : el('div', { className: 'card-viewer-image missing', text: 'Kein Bild verfügbar' });
        var link = url ? [' · ', el('a', { href: url, target: '_blank', rel: 'noopener',
            text: 'Bild in neuem Tab' })] : [];
        var box = el('div', { className: 'card-viewer-box' + (details ? ' with-details' : '') }, [
            el('button', { type: 'button', className: 'card-viewer-close', title: 'Schließen (Esc)',
                text: '×', onclick: close }),
            el('div', { className: 'card-viewer-figure' }, [image,
                el('div', { className: 'card-caption' }, [caption].concat(link))]),
            details || null
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

    return { hover: hover, show: show, leave: leave, open: open, close: close };
})();
