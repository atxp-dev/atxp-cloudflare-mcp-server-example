import { RequirePaymentConfig, paymentRequiredError } from "@atxp/common";
import { getATXPConfig, atxpAccountId } from "./atxpWorkerContext.js";

export async function requirePayment(paymentConfig: RequirePaymentConfig): Promise<void> {
  const config = getATXPConfig();
  if (!config) {
    console.log('No ATXP config found - running in demo mode without payment');
    // For demo purposes, simulate payment success
    return;
  }
  
  const user = atxpAccountId();
  if (!user) {
    config.logger.info('No authenticated user found - running in demo mode');
    // For demo purposes, simulate payment success
    return;
  }

  const charge = {
    amount: paymentConfig.price, 
    currency: config.currency, 
    network: config.network, 
    destination: config.destination, 
    source: user,
    payeeName: config.payeeName,
  };

  config.logger.debug(`Demo mode: Would charge ${charge.amount} USDC from ${charge.source} to ${charge.destination}`);
  config.logger.info(`Demo payment simulated for ${charge.amount} USDC`);
  
  // For now, we'll simulate successful payment
  // In a full implementation, this would use config.paymentServer.charge()
  return;
}