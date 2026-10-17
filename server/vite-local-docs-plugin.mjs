import {createLocalApiHandler} from './local-api-handler.mjs';

export function localDocsPlugin() {
  return {
    name: 'local-docs-api',
    configureServer(server) {
      server.middlewares.use(createLocalApiHandler());
    },
  };
}
