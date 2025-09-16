import { ATXPConfig, ATXPArgs, TokenCheck, buildServerConfig } from "@atxp/server";
import { TokenData } from "@atxp/common";

// Use the same context structure as the SDK but with global storage
// since Cloudflare Workers don't support AsyncLocalStorage
type ATXPWorkerContextType = {
  tokenData: TokenData | null;
  config: ATXPConfig;
}

// Simple global context storage for Cloudflare Workers
// Since each Worker handles one request at a time, this is safe
let currentContext: ATXPWorkerContextType | null = null;

export function setATXPWorkerContext(config: ATXPConfig, tokenCheck?: TokenCheck): void {
  currentContext = {
    tokenData: tokenCheck?.data || null,
    config,
  };
}

export function getATXPWorkerContext(): ATXPWorkerContextType | null {
  return currentContext;
}


// Helper functions that mirror the SDK's context functions exactly
export function getATXPConfig(): ATXPConfig | null {
  const context = getATXPWorkerContext();
  return context?.config ?? null;
}

export function atxpAccountId(): string | null {
  const context = getATXPWorkerContext();
  return context?.tokenData?.sub ?? null;
}

// Build configuration for Cloudflare Workers
export function buildWorkerATXPConfig(args: ATXPArgs): ATXPConfig {
  // Override the global fetch to fix Cloudflare Workers context issues
  if (typeof globalThis.fetch !== 'undefined') {
    // Store original fetch in case we need it
    const originalFetch = globalThis.fetch;
    
    // Override global fetch with properly bound version
    // This ensures that internal ATXP HTTP requests work correctly in Cloudflare Workers
    globalThis.fetch = originalFetch.bind(globalThis);
  }
  return buildServerConfig(args);
}