import type { NextFunction, Request, Response } from 'express';

// Cabeçalhos de segurança básicos para uma API JSON, sem depender do helmet.
//
// Não definimos Content-Security-Policy de propósito: a API serve o Swagger em
// /api, que carrega scripts e estilos próprios e quebraria com uma CSP rígida.
export function securityHeaders(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // O navegador só aplica o HSTS em conexões HTTPS (ignora em http://localhost).
  res.setHeader('Strict-Transport-Security', 'max-age=15552000');

  next();
}
