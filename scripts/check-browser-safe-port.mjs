import http from 'node:http';
import assert from 'node:assert/strict';
import {isBrowserSafePort,listenBrowserSafe} from '../desktop/browser-safe-port.mjs';
assert.equal(isBrowserSafePort(6665),false);assert.equal(isBrowserSafePort(6667),false);assert.equal(isBrowserSafePort(6000),false);assert.equal(isBrowserSafePort(0),false);
const occupied=http.createServer();await listenBrowserSafe(occupied);const server=http.createServer();let calls=0;
try{await listenBrowserSafe(server,{nextPort:()=>{calls++;return calls===1?6665:calls===2?occupied.address().port:occupied.address().port===65535?49152:occupied.address().port+1;}});assert.ok(calls>=3);assert.equal(isBrowserSafePort(server.address().port),true);console.log('Unsafe port 6665 skipped and occupied safe port retried.');}
finally{await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>occupied.close(r))]);}
