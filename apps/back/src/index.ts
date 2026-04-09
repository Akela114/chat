import http from 'http';
import { apiRootHandler } from './api/root.ts';

const server = http.createServer(apiRootHandler);

server.listen(5000, () => {
  console.log('Server running at http://localhost:5000/');
});
