import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { expect } from "chai";
import { Gamechain } from "../target/types/gamechain";

describe("gamechain", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Gamechain as Program<Gamechain>;
  const wallet = provider.wallet as anchor.Wallet;
  const verifier = wallet.publicKey;
  const player = anchor.web3.Keypair.generate().publicKey;
  const supportedGameId = 1;
  const credentialType = 1;

  const [oracleConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("oracle-config")],
    program.programId
  );

  const [playerProfilePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("player-profile"), player.toBuffer()],
    program.programId
  );

  const [credentialPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("credential"),
      player.toBuffer(),
      Buffer.from([supportedGameId]),
      Buffer.from([credentialType]),
    ],
    program.programId
  );

  it("initializes oracle config", async () => {
    await program.methods
      .initializeOracleConfig(verifier, supportedGameId)
      .accounts({
        admin: wallet.publicKey,
        oracleConfig: oracleConfigPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.oracleConfig.fetch(oracleConfigPda);
    expect(config.admin.toBase58()).to.equal(wallet.publicKey.toBase58());
    expect(config.trustedVerifier.toBase58()).to.equal(verifier.toBase58());
    expect(config.supportedGameId).to.equal(supportedGameId);
  });

  it("upserts a player profile through the trusted verifier", async () => {
    await program.methods
      .upsertPlayerProfile("#PLAYER123")
      .accounts({
        verifier,
        oracleConfig: oracleConfigPda,
        player,
        playerProfile: playerProfilePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const profile = await program.account.playerProfile.fetch(playerProfilePda);
    expect(profile.player.toBase58()).to.equal(player.toBase58());
    expect(profile.latestCocTag).to.equal("#PLAYER123");
    expect(profile.lastVerifier.toBase58()).to.equal(verifier.toBase58());
    expect(profile.lastVerifiedAt.toNumber()).to.be.greaterThan(0);
  });

  it("issues a tournament-gating credential", async () => {
    const now = Math.floor(Date.now() / 1000);

    await program.methods
      .issueAchievementCredential(
        supportedGameId,
        credentialType,
        13,
        12,
        true,
        "#PLAYER123",
        "/credentials/demo-wallet",
        new anchor.BN(now + 60 * 60 * 24 * 7)
      )
      .accounts({
        verifier,
        oracleConfig: oracleConfigPda,
        player,
        playerProfile: playerProfilePda,
        achievementCredential: credentialPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const credential =
      await program.account.achievementCredential.fetch(credentialPda);
    expect(credential.player.toBase58()).to.equal(player.toBase58());
    expect(credential.verifier.toBase58()).to.equal(verifier.toBase58());
    expect(credential.gameId).to.equal(supportedGameId);
    expect(credential.credentialType).to.equal(credentialType);
    expect(credential.achievementValue).to.equal(13);
    expect(credential.thresholdValue).to.equal(12);
    expect(credential.eligible).to.equal(true);
    expect(credential.cocTag).to.equal("#PLAYER123");
    expect(credential.proofUri).to.equal("/credentials/demo-wallet");
  });
});
