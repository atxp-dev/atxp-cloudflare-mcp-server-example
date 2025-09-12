import { RequirePaymentConfig, paymentRequiredError } from "@atxp/common";
import { getATXPConfig, atxpAccountId } from "./atxpWorkerContext.js";

export async function requirePayment(paymentConfig: RequirePaymentConfig): Promise<void> {
  console.log('requirePayment called');
  let config = getATXPConfig();
  console.log('ATXP config from context:', config ? 'found' : 'null');
  
  // Fallback to global config if context config is not available
  if (!config) {
    const { MyMCP } = await import('./index.js');
    config = MyMCP.atxpConfig;
    console.log('ATXP config from global:', config ? 'found' : 'null');
  }
  
  if (!config) {
    throw new Error('No ATXP config found - payments cannot be processed');
  }
  
  let user = atxpAccountId();
  console.log('User from context:', user);
  
  // Fallback to globally stored user ID if context user is null
  if (!user) {
    const { MyMCP } = await import('./index.js');
    user = MyMCP.currentUserId;
    console.log('User from global fallback:', user);
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

  config.logger.debug(`Processing payment: ${charge.amount} ${charge.currency} from ${charge.source} to ${charge.destination}`);
  
  try {
    // Use the real payment server to charge the user
    console.log('About to charge:', JSON.stringify(charge, null, 2));
    const result = await config.paymentServer.charge(charge);
    console.log('Charge result:', JSON.stringify(result, null, 2));
    console.log('Charge result success property:', result.success);
    console.log('Charge result type:', typeof result.success);
    
    if (!result.success) {
      config.logger.info(`Payment failed, creating payment request`);
      
      // Handle existing payment ID if available through getExistingPaymentId
      const existingPaymentId = await paymentConfig.getExistingPaymentId?.();
      if (existingPaymentId) {
        config.logger.info(`Found existing payment ID ${existingPaymentId}`);
        throw paymentRequiredError(config.server, existingPaymentId, charge.amount);
      }
      
      // Create a new payment request
      const paymentRequestId = await config.paymentServer.createPaymentRequest(charge);
      config.logger.info(`Created payment request ${paymentRequestId}`);
      throw paymentRequiredError(config.server, paymentRequestId, charge.amount);
    }
    
    config.logger.info(`Payment successful: ${charge.amount} ${charge.currency} from ${charge.source}`);
    
  } catch (error) {
    // Re-throw payment required errors as-is
    if (error instanceof Error && error.message.includes('payment_required')) {
      throw error;
    }
    
    config.logger.error(`Payment processing error: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Payment processing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}