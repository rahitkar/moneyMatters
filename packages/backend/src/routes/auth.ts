import { FastifyInstance } from 'fastify';
import { authService } from '../services/auth.service.js';

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/register
  fastify.post<{
    Body: { email: string; password: string; name: string };
  }>('/register', async (request, reply) => {
    const { email, password, name } = request.body;

    if (!email || !password || !name) {
      return reply.code(400).send({ error: 'Email, password, and name are required' });
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: 'Password must be at least 6 characters' });
    }

    try {
      const result = await authService.register(email, password, name);
      return reply.code(201).send(result);
    } catch (err: any) {
      if (err.message === 'Email already registered') {
        return reply.code(409).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /api/auth/login
  fastify.post<{
    Body: { email: string; password: string };
  }>('/login', async (request, reply) => {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply.code(400).send({ error: 'Email and password are required' });
    }

    try {
      const result = await authService.login(email, password);
      return result;
    } catch (err: any) {
      if (err.message === 'Invalid email or password') {
        return reply.code(401).send({ error: err.message });
      }
      throw err;
    }
  });

  // POST /api/auth/refresh
  fastify.post<{
    Body: { refreshToken: string };
  }>('/refresh', async (request, reply) => {
    const { refreshToken } = request.body;

    if (!refreshToken) {
      return reply.code(400).send({ error: 'Refresh token is required' });
    }

    try {
      const tokens = authService.refreshAccessToken(refreshToken);
      return tokens;
    } catch (err: any) {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }
  });

  // GET /api/auth/me (requires auth — the global hook handles it)
  fastify.get('/me', async (request) => {
    const user = await authService.getUser(request.userId);
    if (!user) {
      throw new Error('User not found');
    }
    return { user };
  });
}
