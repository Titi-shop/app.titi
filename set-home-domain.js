const StellarSDK = require("@stellar/stellar-sdk");

const server = new StellarSDK.Horizon.Server(
  "https://api.testnet.minepi.com"
);

const NETWORK_PASSPHRASE = "Pi Testnet";

// THAY BẰNG SECRET KEY THẬT CỦA ISSUER
const issuer = StellarSDK.Keypair.fromSecret(
  "SB46BZVVARG7ITVQ37J5DPEV2NFTHD7AHC327RDTSIJ4HIBFAZ6YGVU4"
);

async function main() {
  // Luôn lấy account mới nhất để có sequence number mới nhất
  const issuerAccount = await server.loadAccount(
    issuer.publicKey()
  );

  // Lấy base fee hiện tại
  const baseFee = await server.fetchBaseFee();

  // Tạo transaction set Home Domain
  const tx = new StellarSDK.TransactionBuilder(issuerAccount, {
    fee: baseFee,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSDK.Operation.setOptions({
        homeDomain: "muasam.titi.onl",
      })
    )
    .setTimeout(30)
    .build();

  // Ký giao dịch
  tx.sign(issuer);

  // Gửi lên Pi Testnet
  await server.submitTransaction(tx);

  console.log("Home Domain OK!");
  console.log("Issuer:", issuer.publicKey());
  console.log("Home Domain: muasam.titi.onl");
}

main().catch((err) => {
  console.error("ERROR:");
  console.error(err);
});