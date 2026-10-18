import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitStore } from './rate-limit.store';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitOptions {
  /** Máximo de requisições por IP nesta rota, dentro da janela. */
  limit: number;
  windowSec: number;
}

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

// Barra enxurrada de requisições por IP (robôs, spam de cadastro). Os limites
// são folgados de propósito: se a API enxergar o mesmo IP para todo mundo (ex.:
// o IP do proxy), o tráfego normal do site continua passando. A proteção da
// senha em si fica no LoginThrottle.
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly store = new RateLimitStore();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    if (!options) return true;

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const ip: string = req.ip || req.socket?.remoteAddress || 'unknown';
    const route = `${req.method}:${req.route?.path ?? req.path}`;

    const result = this.store.hit(
      `${route}|${ip}`,
      options.limit,
      options.windowSec * 1000,
    );

    if (!result.allowed) {
      res.setHeader('Retry-After', String(result.retryAfterSec));

      throw new HttpException(
        'Muitas requisições. Aguarde alguns minutos e tente novamente.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
