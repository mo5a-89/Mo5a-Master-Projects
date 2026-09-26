/**
 * telegramPipelineService.ts
 * Enterprise Server-Side Document Parsing & Pricing Pipeline
 * 
 * Delegates to the Autonomous Multi-Agent Enterprise Engine (telegramEnterpriseEngine.ts):
 * - Master Intent Router & Task Decomposer
 * - Stateless Document Isolation (Transaction ID)
 * - Visual Input Classification (Estimator, Site Ops, Controller, Procurement)
 * - Telegram API Resiliency (ChatAction Heartbeat, Auto-Chunking <= 4000 chars)
 * - Strict Invariant Protection (calculateQuotationTotals, 15% ZATCA VAT, Rollback Checkpoint)
 */

import {
  executeEnterpriseTelegramOrchestrator,
  sendTelegramChatAction,
  startChatActionHeartbeat,
  sendChunkedTelegramMessage,
  sendTelegramDocumentSafe,
  generateQuotationExcel,
  classifyVisualMedia,
  decomposeCompoundIntent,
} from './telegramEnterpriseEngine';

export {
  executeEnterpriseTelegramOrchestrator,
  sendTelegramChatAction,
  startChatActionHeartbeat,
  sendChunkedTelegramMessage,
  sendTelegramDocumentSafe,
  generateQuotationExcel,
  classifyVisualMedia,
  decomposeCompoundIntent,
};

/**
 * Main Enterprise Server-Side Telegram Document Parsing & Pricing Pipeline
 */
export async function executeServerTelegramDocumentPipeline(params: {
  message: any;
  botToken: string;
}): Promise<{ success: boolean; handled: boolean; result?: any; error?: string }> {
  return await executeEnterpriseTelegramOrchestrator(params);
}
