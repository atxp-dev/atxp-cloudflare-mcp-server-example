import { RequirePaymentConfig } from "@atxp/common";
import { requirePayment as requirePaymentSDK, withATXPContext } from "@atxp/server";
import { getATXPConfig, atxpAccountId } from "./atxpWorkerContext.js";
import { ATXPMcpApi } from "./atxpMcpApi.js";

// Extended config to support authenticated user override and ATXP init params
interface ExtendedPaymentConfig extends RequirePaymentConfig {
  authenticatedUser?: string;
  atxpInitParams?: import("./atxpMcpApi.js").ATXPMcpConfig;  // Allow passing ATXP initialization params
}

export async function requirePayment(paymentConfig: ExtendedPaymentConfig): Promise<void> {
  // Get ATXP config: try request context first, then initialize from params if needed
  let config = getATXPConfig();

  // If no config and we have init params, initialize ATXP in this Durable Object
  if (!config && paymentConfig.atxpInitParams) {
    try {
      ATXPMcpApi.init(paymentConfig.atxpInitParams);
      config = ATXPMcpApi.getConfig();
    } catch (error) {
      config?.logger?.error(`ATXP initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (!config) {
    throw new Error('No ATXP config found - payments cannot be processed');
  }

  // Use authenticated user from props (preferred) or fallback to context
  let user = paymentConfig.authenticatedUser;

  // Fallback to request-scoped context if not provided
  if (!user) {
    user = atxpAccountId() || undefined;
  }

  if (!user) {
    throw new Error('No authenticated user found - payment required');
  }

  // Use the SDK's requirePayment function with temporary context
  const dummyResource = new URL('https://example.com'); // Resource URL not used by requirePayment
  const tokenInfo = { token: null, data: { active: true, sub: user } };
  await withATXPContext(config, dummyResource, tokenInfo, async () => {
    await requirePaymentSDK(paymentConfig);
  });
}