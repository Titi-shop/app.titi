import { withTransaction } from "@/lib/db";

import {
  SettlementLedgerV3,
} from "@/lib/db/settlement.ledger";

export async function processEscrowReleaseJob() {

  return withTransaction(
    async (client) => {

      const escrows =
        await SettlementLedgerV3
          .findReleasableEscrows(client);

      for (const escrow of escrows) {

        await SettlementLedgerV3
          .releaseEscrowFlow({
            client,
            escrow,
          });
      }

      return {
        success: true,
        processed: escrows.length,
      };
    }
  );
}
