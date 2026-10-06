#!/usr/bin/env node
// Production exposes free protocol refusals; domain evaluations require paid admission.
// Domain input validation is tested offline against the actual Worker handler.
import {runPublicConformance} from './public-conformance.js';
await runPublicConformance({refusalsOnly:true});
