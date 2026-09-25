/*
 * load-app.mjs - loads the classic browser scripts of the app into a Node.js sandbox.
 * Used by the maintenance tools and the self test; the app itself does not need Node.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
export const appRoot = path.join(toolDir, '..');

// Scripts that work without a browser page, in the same order as in index.html.
const LOGIC_SCRIPTS = [
    'app/core.js',
    'app/log.js',
    'reference/vocab.js',
    'app/csv.js',
    'app/reference-transform.js'
];

// Creates a sandbox with a minimal "window", runs the scripts and returns the FCT namespace.
// withReference also loads the shipped reference data; extra lists further app scripts.
export function loadApp(options = {}) {
    const sandbox = { console, TextDecoder, TextEncoder, setTimeout, clearTimeout };
    sandbox.window = sandbox;
    vm.createContext(sandbox);

    const scripts = [...LOGIC_SCRIPTS];
    if (options.withReference) {
        scripts.push('reference/info.js', 'reference/sets.js', 'reference/cards.js',
            'reference/printings.js', 'reference/fabrary-skeleton.js');
    }
    scripts.push(...(options.extra || []));

    scripts.forEach((file) => {
        const code = fs.readFileSync(path.join(appRoot, file), 'utf8');
        vm.runInContext(code, sandbox, { filename: file });
    });
    return sandbox.FCT;
}
