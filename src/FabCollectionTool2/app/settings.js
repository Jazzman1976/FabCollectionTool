/*
 * settings.js - view settings of the user interface (visible columns, font size, position of
 * the messages, grouping). They are kept in the browser's localStorage.
 *
 * Only view settings are stored here, never collection data: the collection lives in files.
 * If the browser blocks localStorage (e.g. for pages opened via file:// in some
 * configurations), every read returns the default and every write is silently ignored.
 */
FCT.settings = (function () {
    var PREFIX = 'fct2.';

    // Returns the stored value of a setting, or the default if there is none.
    function get(key, fallback) {
        try {
            var text = window.localStorage.getItem(PREFIX + key);
            return text == null ? fallback : JSON.parse(text);
        } catch (e) {
            return fallback;
        }
    }

    // Stores the value of a setting; failures are ignored.
    function set(key, value) {
        try {
            window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch (e) {
            // Storage blocked or full: the setting simply lasts until the page is closed.
        }
    }

    // Removes a setting, so that the default applies again.
    function remove(key) {
        try {
            window.localStorage.removeItem(PREFIX + key);
        } catch (e) {
            // See set().
        }
    }

    return { get: get, set: set, remove: remove };
})();
