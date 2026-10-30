/**
 * Starts the pinned json-server so it answers this Mac and nothing else.
 *
 * json-server 1.0.0-beta.3 calls app.listen(port, cb) with no host, which binds
 * every interface and ignores --host. It holds the whole database with no login
 * and accepts writes, so anything on the Wi-Fi could read or change it. Forcing
 * the host here keeps node_modules untouched; server.js (the guarded proxy) is
 * the only thing that should ever talk to it.
 */
import http from 'node:http';

const HOST = '127.0.0.1';
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function patched(...args) {
    if (typeof args[0] === 'number') {
        const callback = args.find((a) => typeof a === 'function');
        return listen.call(this, args[0], HOST, ...(callback ? [callback] : []));
    }
    return listen.apply(this, args);
};

await import('./node_modules/json-server/lib/bin.js');
