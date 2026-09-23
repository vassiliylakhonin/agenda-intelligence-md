/**
 * Safe Transaction Execution Flow with Agenda Financial Guard
 *
 * This recipe demonstrates the pre-flight firewall pattern for ElizaOS agents:
 * 1. Agent plans a financial transaction (e.g. transfer USDC, smart contract call).
 * 2. Pre-flight check evaluates recipient address, calldata, spending limits, and known risk patterns.
 * 3. If verdict is 'reject' -> abort execution, log violation.
 * 4. If verdict is 'step_up_human_required' -> pause and hold for operator confirmation.
 * 5. Only if verdict is explicitly authorized or approved -> sign and broadcast.
 */

import {
  AgendaGuardClient,
  TransactionSafetyRequest,
  TransactionSafetyVerdict,
} from "../src/index.js";

export interface ProposedTransaction {
  to: string;
  amountUsd: number;
  network: "base" | "base_sepolia";
  asset: "USDC";
  calldata?: string;
  intent: string;
}

// Simulated wallet provider interface
export interface AgentWallet {
  getAddress(): Promise<string>;
  sendTransaction(tx: { to: string; value: string; data?: string }): Promise<string>;
}

export async function executeSafeTransaction(
  wallet: AgentWallet,
  guardClient: AgendaGuardClient,
  proposedTx: ProposedTransaction,
  operatorApproved: boolean = false
): Promise<{
  success: boolean;
  txHash?: string;
  reason?: string;
  verdict: TransactionSafetyVerdict;
}> {
  console.log(`\n🛡️ [Agenda Guard] Initiating pre-flight screening for proposed transaction:`);
  console.log(`   To: ${proposedTx.to}`);
  console.log(`   Amount: $${proposedTx.amountUsd} ${proposedTx.asset}`);
  console.log(`   Network: ${proposedTx.network}`);
  console.log(`   Intent: "${proposedTx.intent}"`);

  // Step 1: Query pre-sign firewall
  const safetyRequest: TransactionSafetyRequest = {
    recipient: proposedTx.to,
    amount_usd: proposedTx.amountUsd,
    network: proposedTx.network,
    asset: proposedTx.asset,
    calldata: proposedTx.calldata || "0x",
    intent: proposedTx.intent,
  };

  const verdict = await guardClient.checkTransactionSafety(safetyRequest);

  console.log(`\n📊 [Verdict Received]`);
  console.log(`   Decision: ${verdict.decision.toUpperCase()}`);
  console.log(`   Risk Score: ${verdict.score}/100`);
  console.log(`   Advisory: ${verdict.execution_advisory}`);

  // Step 2: Handle malicious/prohibited patterns
  if (verdict.decision === "reject") {
    console.error(`❌ [BLOCKED] Transaction rejected by Financial Guard.`);
    if (verdict.violations && verdict.violations.length > 0) {
      console.error(`   Violations:`, verdict.violations);
    }
    return {
      success: false,
      reason: `Transaction rejected by guard firewall: ${verdict.execution_advisory}`,
      verdict,
    };
  }

  // Step 3: Handle step-up human review requirement (mandatory for unverified counterparties)
  if (verdict.decision === "step_up_human_required" || !verdict.is_safe) {
    if (!operatorApproved) {
      console.warn(`⚠️ [HELD] Transaction requires explicit human authorization.`);
      console.warn(`   Do NOT automatically sign with agent wallet key until approved.`);
      return {
        success: false,
        reason: `Pending human review: ${verdict.execution_advisory}`,
        verdict,
      };
    }
    console.log(`✅ [HUMAN APPROVED] Operator granted explicit sign-off for transaction.`);
  }

  // Step 4: Execute on-chain with wallet
  console.log(`🚀 [EXECUTING] Broadcasting transaction to ${proposedTx.network}...`);
  const txHash = await wallet.sendTransaction({
    to: proposedTx.to,
    value: "0",
    data: proposedTx.calldata || "0x",
  });

  console.log(`🎉 [COMPLETED] Transaction broadcast successfully! Hash: ${txHash}`);
  return {
    success: true,
    txHash,
    verdict,
  };
}

// Example runnable demonstration
async function runExample() {
  const guardClient = new AgendaGuardClient();

  const mockWallet: AgentWallet = {
    async getAddress() {
      return "0xAgentWalletAddress000000000000000000000001";
    },
    async sendTransaction(tx) {
      return "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    },
  };

  // Scenario A: Unknown recipient without operator approval (held for review)
  console.log("\n--- Scenario A: Unverified Counterparty Payment ---");
  await executeSafeTransaction(
    mockWallet,
    guardClient,
    {
      to: "0x1111111111111111111111111111111111111111",
      amountUsd: 25,
      network: "base",
      asset: "USDC",
      intent: "Pay invoice for data indexing API",
    },
    false
  );
}

if (process.argv[1] && process.argv[1].endsWith("safe-transaction-flow.ts")) {
  runExample().catch(console.error);
}
