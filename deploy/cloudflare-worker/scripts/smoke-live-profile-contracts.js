// Public smoke checks validate discovery, published examples, payment admission
// and unsigned challenge correlation. Paid results are covered offline by the
// actual handler with independent synthetic signatures and mocked chain RPC.
// No live funding, signing or receipt claim is performed here.
import './check-paid-client-path.js';
