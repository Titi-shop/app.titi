const StellarSDK = require("@stellar/stellar-sdk");

const server = new StellarSDK.Horizon.Server(
  "https://api.testnet.minepi.com"
);

const NETWORK_PASSPHRASE = "Pi Testnet";

const issuer = StellarSDK.Keypair.fromSecret("SECRET_ISSUER");
const distributor = StellarSDK.Keypair.fromSecret("SECRET_DISTRIBUTOR");

const token = new StellarSDK.Asset(
  "TITI",
  issuer.publicKey()
);

async function main() {
  // Tạo trustline
  const distributorAccount =
    await server.loadAccount(distributor.publicKey());

  const fee = await server.fetchBaseFee();

  const trustTx = new StellarSDK.TransactionBuilder(
    distributorAccount,
    {
      fee,
      networkPassphrase: NETWORK_PASSPHRASE,
    }
  )
    .addOperation(
      StellarSDK.Operation.changeTrust({
        asset: token,
      })
    )
    .setTimeout(30)
    .build();

  trustTx.sign(distributor);

  await server.submitTransaction(trustTx);

  console.log("Trustline OK");

  // Mint token
  const issuerAccount =
    await server.loadAccount(issuer.publicKey());

  const mintTx = new StellarSDK.TransactionBuilder(
    issuerAccount,
    {
      fee,
      networkPassphrase: NETWORK_PASSPHRASE,
    }
  )
    .addOperation(
      StellarSDK.Operation.payment({
        destination: distributor.publicKey(),
        asset: token,
        amount: "1000000",
      })
    )
    .setTimeout(30)
    .build();

  mintTx.sign(issuer);

  await server.submitTransaction(mintTx);

  console.log("Mint OK");
}

main();
