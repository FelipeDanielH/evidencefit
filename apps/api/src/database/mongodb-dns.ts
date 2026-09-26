import { getServers, setServers } from 'node:dns';

const FALLBACK_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];

export function configureMongoSrvDns(uri: string | undefined): void {
  if (!uri?.startsWith('mongodb+srv://')) return;

  const servers = getServers();
  const onlyUnsupportedLocalResolver =
    servers.length > 0 && servers.every((server) => server === '127.0.0.1' || server === '::1');

  if (onlyUnsupportedLocalResolver) {
    setServers(FALLBACK_DNS_SERVERS);
  }
}
