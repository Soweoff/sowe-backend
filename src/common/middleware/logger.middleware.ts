import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl } = req;
    const now = new Date().toISOString();

    // `ip` é o IP que a API enxerga e `xff` o que o proxy enviou. Servem para
    // conferir se o TRUST_PROXY_HOPS está certo (o `ip` deve ser o do cliente).
    const xff = req.headers['x-forwarded-for'];
    const forwarded = xff ? ` xff=${String(xff)}` : '';

    console.log(`[${now}] ${method} ${originalUrl} ip=${req.ip}${forwarded}`);

    next();
  }
}
