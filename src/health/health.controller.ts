import { Controller, Get } from '@nestjs/common';

// Rota leve para monitoramento (Render health check, UptimeRobot etc.).
// Não consulta o banco nem serviços externos de propósito.
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
