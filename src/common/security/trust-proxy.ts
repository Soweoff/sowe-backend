/**
 * Quantos proxies confiáveis existem entre o cliente e a API (o "trust proxy"
 * do Express). Controla qual IP aparece em `req.ip`.
 *
 * Lê TRUST_PROXY_HOPS. Sem valor válido, usa 1 (o proxy do Render).
 * Para conferir o valor certo, veja nos logs do Render a linha de cada
 * requisição (`ip=... xff=...`) e compare com o seu IP real.
 */
export function parseTrustProxyHops(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return 1;

  const hops = Number(value);

  if (!Number.isInteger(hops) || hops < 0 || hops > 10) return 1;

  return hops;
}
