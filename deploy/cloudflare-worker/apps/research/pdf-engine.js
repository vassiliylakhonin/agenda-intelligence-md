// Static, in-process PDF.js transport: bytes only; no document scripts or URLs.
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {WorkerMessageHandler} from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
globalThis.pdfjsWorker={WorkerMessageHandler};
export {getDocument};
