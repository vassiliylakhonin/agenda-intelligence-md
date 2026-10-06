// Check structural compatibility with the published ElizaOS 1.7.2 type contract.
// Bundler resolution also handles that package's extensionless declaration imports.
import type { Plugin } from '@elizaos/core';
import { agendaGuardPlugin } from '../dist/index.js';
const plugin: Plugin = agendaGuardPlugin;
void plugin;
