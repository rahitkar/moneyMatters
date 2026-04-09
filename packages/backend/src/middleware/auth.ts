import fp from 'fastify-plugin';
import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { authService } from '../services/auth.service.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    userEmail: string;
  }
}

export const authPlugin = fp(async function authPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest('userId', '');
  fastify.decorateRequest('userEmail', '');

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const publicPaths = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];
    if (publicPaths.some(p => request.url.startsWith(p))) return;
    if (request.url === '/api/health') return;

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.slice(7);
    try {
      const payload = authService.verifyAccessToken(token);
      request.userId = payload.userId;
      request.userEmail = payload.email;
    } catch {
      reply.code(401).send({ error: 'Invalid or expired token' });
    }
  });
});
