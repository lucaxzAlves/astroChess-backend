import { createServer } from 'node:http';

import { app } from '../src/app';

const server = createServer(app);

export default server;
