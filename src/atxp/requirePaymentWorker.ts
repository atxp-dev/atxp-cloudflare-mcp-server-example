import { RequirePaymentConfig, paymentRequiredError } from "@atxp/common";
import { ATXPConfig } from "@atxp/server";
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

  const charge = {
    amount: paymentConfig.price, 
    currency: config.currency, 
    network: config.network, 
    destination: config.destination, 
    source: user,
    payeeName: config.payeeName,
  };

  config.logger?.debug(`Processing payment: ${charge.amount} ${charge.currency} from ${charge.source} to ${charge.destination}`);
  
  try {
    // Use the real payment server to charge the user
    const result = await config.paymentServer.charge(charge);
    
    if (!result.success) {
      config.logger?.info(`Payment failed, creating payment request`);
      
      // Handle existing payment ID if available through getExistingPaymentId
      const existingPaymentId = await paymentConfig.getExistingPaymentId?.();
      if (existingPaymentId) {
        config.logger?.info(`Found existing payment ID ${existingPaymentId}`);
        throw paymentRequiredError(config.server, existingPaymentId, charge.amount);
      }
      
      // Create a new payment request
      const paymentRequestId = await config.paymentServer.createPaymentRequest(charge);
      config.logger?.info(`Created payment request ${paymentRequestId}`);
      throw paymentRequiredError(config.server, paymentRequestId, charge.amount);
    }
    
    config.logger?.info(`Payment successful: ${charge.amount} ${charge.currency} from ${charge.source}`);
    
  } catch (error) {
    // Re-throw payment required errors as-is
    if (error instanceof Error && error.message.includes('payment_required')) {
      throw error;
    }
    
    config.logger?.error(`Payment processing error: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Payment processing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}