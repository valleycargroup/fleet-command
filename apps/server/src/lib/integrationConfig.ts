// Config for the Auction and CRM integrations.
//
// - API keys: read from AWS SSM Parameter Store once deployed, so they don't
//   need to be copied into every EC2's .env by hand. Locally there's no AWS
//   access, so we just read them straight from .env — same isLocal split
//   already used for the DB connection (see lib/db.ts).
//   - FLEET_COMMAND_API_KEY (sent to Auction) lives at
//     /prod/fleet-command/fleet-command-api-key — Auction has no SSM-backed
//     parameter of its own to point at (it just reads a plain env var), so
//     Fleet has to keep its own copy here.
//   - CRM_FLEET_COMMAND_API_KEY (sent to CRM) reads CRM's own parameter
//     directly, /prod/external/fleet-command/api-key, instead of keeping a
//     separate mirrored copy — one shared secret, one source of truth.
//     Requires Fleet's EC2 instance role to have ssm:GetParameter on that
//     path (in addition to /prod/fleet-command/* for the Auction key).
// - Base URLs: three tiers (local/dev/prod), same isLocal split used for the
//   DB connection. Dev/prod are fixed real domains. Local is overridable via
//   env var because it's per-developer-machine, not because we want it
//   configurable in general.
//   CRM runs directly on the host (not in Docker) and its dev script's
//   debugger happens to share port 5001 with its API. Docker Desktop's
//   host.docker.internal bridge on Windows lands container traffic on the
//   debugger instead of the API for that specific port (confirmed: a plain
//   GET returns the debugger's "WebSockets request was expected", not a
//   real HTTP response) — this is a Docker/Windows networking quirk, not a
//   CRM bug, and we were asked not to change CRM's debug port to work
//   around it. Using the host's actual LAN IP instead of host.docker.internal
//   bypasses the quirk entirely (verified: reaches the real Express app).
//   Override via CRM_LOCAL_HOST in .env if your LAN IP changes.
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { isLocal } from './db';

const ssmClient = new SSMClient({ region: 'us-east-2' });
const cache: Record<string, { value: string; timestamp: number }> = {};
const CACHE_TTL_MS = 300000; // 5 minutes

async function getSsmParameter(name: string): Promise<string> {
  const now = Date.now();
  if (cache[name] && now - cache[name].timestamp < CACHE_TTL_MS) return cache[name].value;
  const res = await ssmClient.send(new GetParameterCommand({ Name: name, WithDecryption: true }));
  const value = res.Parameter?.Value;
  if (!value) throw new Error(`SSM parameter ${name} has no value`);
  cache[name] = { value, timestamp: now };
  return value;
}

// envVarName is only used locally (no AWS access on a laptop); ssmPath is
// the full parameter path once deployed.
export async function getApiKey(envVarName: string, ssmPath: string): Promise<string> {
  if (isLocal) {
    const value = process.env[envVarName];
    if (!value) throw new Error(`${envVarName} not configured — set it in .env for local dev`);
    return value;
  }
  return getSsmParameter(ssmPath);
}

function resolveBaseUrl(urls: { prod: string; dev: string; local: string }): string {
  if (isLocal) return urls.local;
  return process.env.NODE_ENV === 'production' ? urls.prod : urls.dev;
}

export function getAuctionBaseUrl(): string {
  return resolveBaseUrl({
    prod: 'https://api.vehiclebuyersautoauction.com',
    dev: 'https://dev.api.vehiclebuyersautoauction.com',
    local: 'http://host.docker.internal:3001',
  });
}

export function getCrmBaseUrl(): string {
  const localHost = process.env.CRM_LOCAL_HOST || 'host.docker.internal';
  return resolveBaseUrl({
    prod: 'https://api.crm.valleycargroup.net',
    dev: 'https://dev.crm.valleycargroup.net',
    local: `http://${localHost}:5001`,
  });
}
