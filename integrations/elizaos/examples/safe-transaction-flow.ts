/** Deprecated recipe: evidence review only. Use mock-review.cjs for an offline demo.
 * Does not construct calldata, sign, broadcast or implement human authorization.
 * In particular, a native-asset send with value=0 does not transfer USDC.
 */
import {AgendaGuardClient, TransactionSafetyRequest, TransactionSafetyVerdict} from '../src/index.js';

export async function reviewProposedTransaction(
  client: AgendaGuardClient,
  proposed: TransactionSafetyRequest,
): Promise<{verdict: TransactionSafetyVerdict; signing_authorized: false; human_review_required: true}> {
  const verdict = await client.checkTransactionSafety(proposed);
  return {verdict, signing_authorized:false, human_review_required:true};
}
