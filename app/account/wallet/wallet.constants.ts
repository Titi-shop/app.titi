// =====================================================
// app/account/wallet/wallet.constants.ts
// =====================================================
import type {
  JournalEntryType,
} from "./wallet.types";
/* =====================================================
   LABELS
===================================================== */
export const ENTRY_LABELS: Partial<
  Record<
    JournalEntryType,
    string
  >
> = {
  ESCROW_HOLD:
    "Escrow Hold",

  BUYER_REFUND:
    "Buyer Refund",

  BUYER_PARTIAL_REFUND:
    "Partial Refund",

  SELLER_CREDIT:
    "Seller Credit",

  SELLER_ESCROW_RELEASE:
    "Escrow Released",

  SELLER_WITHDRAW:
    "Withdraw",

  SELLER_WITHDRAW_REVERT:
    "Withdraw Reverted",

  ESCROW_RELEASE:
    "Escrow Release",

  ESCROW_REVERT:
    "Escrow Reverted",

  DISPUTE_LOCK:
    "Dispute Locked",

  DISPUTE_RELEASE:
    "Dispute Released",

  DISPUTE_REFUND:
    "Dispute Refund",

  ADMIN_ADJUST:
    "Admin Adjustment",

  ADMIN_REVERSE:
    "Admin Reversal",

  SYSTEM_COMPENSATION:
    "System Compensation",
};
/* =====================================================
   SWR
===================================================== */
export const WALLET_SWR_CONFIG = {
  revalidateOnFocus:
    false,
  revalidateIfStale:
    false,
  revalidateOnReconnect:
    true,
  dedupingInterval:
    15000,
  keepPreviousData:
    true,
};
