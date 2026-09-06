import type { AiProvider, ContextPacket } from '@/lib/types';
import { createHash } from 'node:crypto';

const cache = new Map<string, ContextPacket>();

const key = (packet: ContextPacket, provider: AiProvider, connectionId: string, model: string) =>
  [packet.thinkalongSessionId, packet.version, createHash('sha256').update(packet.system).digest('hex').slice(0, 12), provider, connectionId, model].join(':');

export function cacheContext(packet: ContextPacket, provider: AiProvider, connectionId: string, model: string) {
  const currentKey = key(packet, provider, connectionId, model);
  const prefix = `${packet.thinkalongSessionId}:`;
  for (const entryKey of cache.keys()) {
    if (entryKey.startsWith(prefix) && entryKey !== currentKey) cache.delete(entryKey);
  }
  const existing = cache.get(currentKey);
  if (existing) return existing;
  cache.set(currentKey, packet);
  return packet;
}

// ponytail: process-local cache; move to shared storage only when multiple app instances are deployed.
export function clearContextCache() {
  cache.clear();
}
