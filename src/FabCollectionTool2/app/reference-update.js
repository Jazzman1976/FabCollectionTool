/*
 * reference-update.js - refreshes the reference data online at start-up.
 *
 * The app starts immediately with the shipped reference data. In parallel, the current
 * source files are loaded from GitHub (raw.githubusercontent.com allows this even for pages
 * opened via file://). Only if all files arrive in time and have the expected columns, the
 * new data replaces the shipped data. Nothing is stored; the next start loads again.
 */
FCT.referenceUpdate = (function () {
    var TIMEOUT_MS = 20000;

    // Loads one URL as text, aborting after the timeout.
    function fetchText(url, signal) {
        return fetch(url, { cache: 'no-store', signal: signal }).then(function (response) {
            if (!response.ok) throw new Error(url + ': HTTP ' + response.status);
            return response.text();
        });
    }

    // Reads the latest commit of the data set (only for display; failures are ignored).
    function fetchCommit(signal) {
        var transform = FCT.referenceTransform;
        var url = 'https://api.github.com/repos/' + transform.SOURCE_REPO + '/commits/' +
            transform.SOURCE_BRANCH;
        return fetch(url, { signal: signal })
            .then(function (response) { return response.ok ? response.json() : null; })
            .then(function (json) {
                return json ? { commit: json.sha, commitDate: json.commit.committer.date } : {};
            })
            .catch(function () { return {}; });
    }

    // Main entry. Resolves with { data, info } or rejects with an error explaining why not.
    function run() {
        var transform = FCT.referenceTransform;
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
        var files = transform.FILES;

        return Promise.all([
            fetchText(transform.SOURCE_BASE + files.set, controller.signal),
            fetchText(transform.SOURCE_BASE + files.setPrinting, controller.signal),
            fetchText(transform.SOURCE_BASE + files.card, controller.signal),
            fetchText(transform.SOURCE_BASE + files.printing, controller.signal),
            fetchCommit(controller.signal)
        ]).then(function (results) {
            var data = transform.transform({
                set: results[0], setPrinting: results[1], card: results[2],
                printing: results[3]
            });

            // Plausibility check: a broken download must not replace good data.
            var shipped = FCT.DATA.printings.length;
            if (data.printings.length < shipped * 0.9) {
                throw new Error('Online-Daten unvollständig (' + data.printings.length +
                    ' statt mindestens ' + Math.round(shipped * 0.9) + ' Drucke)');
            }
            var info = {
                source: transform.SOURCE_REPO,
                branch: transform.SOURCE_BRANCH,
                commit: results[4].commit || '',
                commitDate: (results[4].commitDate || '').slice(0, 10),
                online: true,
                loadedAt: new Date()
            };
            return { data: data, info: info };
        }, function (error) {
            if (error && error.name === 'AbortError') {
                throw new Error('Zeitüberschreitung nach ' + TIMEOUT_MS / 1000 + ' s');
            }
            throw error;
        }).finally(function () {
            clearTimeout(timer);
        });
    }

    return { run: run };
})();
