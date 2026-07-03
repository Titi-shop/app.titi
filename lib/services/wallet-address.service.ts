// =====================================================
// lib/services/wallet-address.service.ts
// =====================================================

import {
  createWalletAddress,
  getWalletAddressesByUser,
} from "@/lib/db/wallet-addresses";

/* =====================================================
   TYPES
===================================================== */

type CreateWalletAddressFlowInput = {
  userId: string;

  body: unknown;
};

type CreateBody = {
  wallet_id?: string;

  address?: string;

  label?: string;
};

/* =====================================================
   LOG
===================================================== */

function log(
  tag: string,
  data?: unknown
) {
  console.log(
    `[WALLET_ADDRESS] ${tag}`,
    data ?? ""
  );
}

function err(
  tag: string,
  data?: unknown
) {
  console.error(
    `[WALLET_ADDRESS] ${tag}`,
    data ?? ""
  );
}

/* =====================================================
   LIST
===================================================== */

export async function listWalletAddressesFlow(
  userId: string
) {

  log(
    "LIST_START",
    {
      userId,
    }
  );
log(
  "DB_LIST_START",
  {
    userId,
  }
);
  const rows =
    await getWalletAddressesByUser(
      userId
    );
log(
  "DB_LIST_DONE",
  {
    userId,
    total: rows.length,
  }
);

log(
  "LIST_SUCCESS",
  {
    userId,
    total: rows.length,
  }
);
  log(
    "LIST_DONE",
    {
      userId,
      total:
        rows.length,
    }
  );

  return rows;
}

/* =====================================================
   CREATE
===================================================== */

export async function createWalletAddressFlow(
  input: CreateWalletAddressFlowInput
) {
try {
  } catch (error) {
      err(
        "CREATE_FAILED",
        {
          userId:
            input.userId,
          error,
        }
      );
      throw error;
  }
}
  log(
    "CREATE_START",
    {
      userId:
        input.userId,
    }
  );
log(
  "BODY_PARSE_START"
);
  /* ===================================================
     BODY
  =================================================== */

  const body =
    input.body as CreateBody;

  const address =
    typeof body.address ===
    "string"
      ? body.address.trim()
      : "";

  const label =
    typeof body.label ===
    "string"
      ? body.label.trim()
      : null;
log(
  "BODY_PARSE_DONE",
  {
    hasAddress:
      !!address,

    hasLabel:
      !!label,
  }
);
  if (!address) {

  err(
    "INVALID_ADDRESS",
    {
      userId:
        input.userId,
    }
  );

  throw new Error(
    "INVALID_ADDRESS"
  );
}

  log(
  "INPUT_OK",
  {
    addressPrefix:
      address.substring(
        0,
        8
      ),

    addressLength:
      address.length,
  }
);

  /* ===================================================
     RPC VALIDATE
     (next step)
  =================================================== */

  log(
  "RPC_VALIDATE_PENDING"
);

  /*
  Sau sẽ thay bằng
  log("RPC_VALIDATE_START");
  await validatePiWalletAddress(
      address
  );

  log("RPC_VALIDATE_DONE");
  */

  /* ===================================================
     DB
  =================================================== */

  log(
    "DB_CREATE_START"
  );
log(
  "DB_CREATE_START",
  {
    userId:
      input.userId,
  }
);
  const wallet =
    await createWalletAddress({

      wallet_id:
        body.wallet_id,

      user_id:
        input.userId,

      network:
        "PI",

      address,

      label,

      is_default:
        true,

      created_by:
        input.userId,

    });
log(
  "DB_CREATE_DONE",
  {
    walletAddressId:
      wallet.id,
  }
);
  log(
    "DB_CREATE_DONE",
    {
      id:
        wallet.id,
    }
  );

  log(
  "CREATE_SUCCESS",
  {
    walletAddressId:
      wallet.id,

    userId:
      input.userId,

    validationStatus:
      wallet.validation_status,

    verified:
      wallet.is_verified,
  }
);

  return wallet;

}
