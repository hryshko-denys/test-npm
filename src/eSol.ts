import { ESolConfig } from './config';
import { PublicKey, Transaction, Keypair, Signer, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { lamportsToSol } from './utils';
import { getStakePoolAccount, addAssociatedTokenAccount, findWithdrawAuthorityProgramAddress } from './service/service';
import { StakePoolProgram } from './service/stakepool-program';
import { DAO_STATE_LAYOUT, COMMUNITY_TOKEN_LAYOUT } from './service/layouts';

export class ESol {
  constructor(public readonly config: ESolConfig = new ESolConfig()) {}

  async depositSol(
    userAddress: PublicKey,
    lamports: number,
    poolTokenReceiverAccount?: PublicKey,
    daoCommunityTokenReceiverAccount?: PublicKey,
    referrerTokenAccount?: PublicKey,
  ): Promise<Transaction> {
    const CONNECTION = this.config.connection;

    const userSolBalance = await CONNECTION.getBalance(userAddress, 'confirmed');
    if (userSolBalance < lamports) {
      throw new Error(
        `Not enough SOL to deposit into pool. Maximum deposit amount is ${lamportsToSol(userSolBalance)} SOL.`,
      );
    }

    const stakePoolAddress = this.config.eSOLStakePoolAddress;
    const stakePool = await getStakePoolAccount(CONNECTION, stakePoolAddress);

    const userSolTransfer = new Keypair();
    const signers: Signer[] = [userSolTransfer];
    const instructions: TransactionInstruction[] = [];

    // Check user balance
    const feeCostInBlockchain = 3000000;
    let needForTransaction = feeCostInBlockchain;

    const daoCommunityTokenReceiverAccountRentSpace = await CONNECTION.getMinimumBalanceForRentExemption(165);
    if (!daoCommunityTokenReceiverAccount) {
      needForTransaction += daoCommunityTokenReceiverAccountRentSpace;
    }

    if (!poolTokenReceiverAccount) {
      const poolTokenReceiverAccountRentSpace = await CONNECTION.getMinimumBalanceForRentExemption(165);
      needForTransaction += poolTokenReceiverAccountRentSpace;
    }

    if (userSolBalance < lamports + needForTransaction) {
      lamports -= needForTransaction;
    }

    // Check dao stake accounts
    const seedPrefixDaoState = this.config.seedPrefixDaoState;
    const daoStateDtoInfo = await PublicKey.findProgramAddress(
      [Buffer.from(seedPrefixDaoState), stakePoolAddress.toBuffer(), StakePoolProgram.programId.toBuffer()],
      StakePoolProgram.programId,
    );
    const daoStateDtoPubkey = daoStateDtoInfo[0];

    const daoStateDtoInfoAccount = await CONNECTION.getAccountInfo(daoStateDtoPubkey);

    if (!daoStateDtoInfoAccount) {
      throw Error("Didn't find dao state account");
    }

    const daoState = DAO_STATE_LAYOUT.decode(daoStateDtoInfoAccount!.data);
    const isDaoEnabled = daoState.isEnabled;

    if (!isDaoEnabled) {
      throw Error('Dao is not enable'); // it should never happened!!!
    }

    const seedPrefixCommunityToken = this.config.seedPrefixCommunityToken;
    const communityTokenDtoInfo = await PublicKey.findProgramAddress(
      [Buffer.from(seedPrefixCommunityToken), stakePoolAddress.toBuffer(), StakePoolProgram.programId.toBuffer()],
      StakePoolProgram.programId,
    );
    const communityTokenPubkey = communityTokenDtoInfo[0];
    const communityTokenAccount = await CONNECTION.getAccountInfo(communityTokenPubkey);

    if (!communityTokenAccount) {
      throw Error('Community token is not exist'); // if isDaoEnabled -> error should NOT happened
    }

    const communityTokenInfo = COMMUNITY_TOKEN_LAYOUT.decode(communityTokenAccount!.data);

    // CommunityTokenStakingRewards
    // Account Data length = 105 bytes
    const seedPrefixCommunityTokenStakingRewards = this.config.seedPrefixCommunityTokenStakingRewards;

    const communityTokenStakingRewardsInfo = await PublicKey.findProgramAddress(
      [
        Buffer.from(seedPrefixCommunityTokenStakingRewards),
        stakePoolAddress.toBuffer(),
        userAddress.toBuffer(),
        StakePoolProgram.programId.toBuffer(),
      ],
      StakePoolProgram.programId,
    );
    const communityTokenStakingRewardsPubkey: any = communityTokenStakingRewardsInfo[0];
    const communityTokenStakingRewardsAccount = await CONNECTION.getAccountInfo(communityTokenStakingRewardsPubkey);

    // communityTokenStakingRewardsCounter
    const seedPrefixCommunityTokenStakingRewardsCounter = this.config.seedPrefixCommunityTokenStakingRewardsCounter;

    const communityTokenStakingRewardsCounterDtoInfo = await PublicKey.findProgramAddress(
      [
        Buffer.from(seedPrefixCommunityTokenStakingRewardsCounter),
        stakePoolAddress.toBuffer(),
        StakePoolProgram.programId.toBuffer(),
      ],
      StakePoolProgram.programId,
    );
    const communityStakingRewardsCounterPubkey = communityTokenStakingRewardsCounterDtoInfo[0];
    const communityTokenStakingRewardsCounterAccount = await CONNECTION.getAccountInfo(
      communityStakingRewardsCounterPubkey,
    );

    if (!communityTokenStakingRewardsCounterAccount) {
      throw Error('Community token staking reward counter is not exist'); // if isDaoEnabled -> error should NOT happened
    }

    if (!communityTokenStakingRewardsAccount) {
      // create CommunityTokenStakingRewards
      instructions.push(
        StakePoolProgram.createCommunityTokenStakingRewards({
          stakePoolPubkey: stakePoolAddress,
          ownerWallet: userAddress,
          communityTokenStakingRewardsDTO: communityTokenStakingRewardsPubkey,
          communityTokenStakingRewardsCounterDTO: communityStakingRewardsCounterPubkey,
        }),
      );
    }

    instructions.push(
      SystemProgram.transfer({
        fromPubkey: userAddress,
        toPubkey: userSolTransfer.publicKey,
        lamports,
      }),
    );

    const { poolMint } = stakePool.account.data;

    // check associatedTokenAccount for RENT 165 BYTES FOR RENTs
    if (!poolTokenReceiverAccount) {
      poolTokenReceiverAccount = await addAssociatedTokenAccount(CONNECTION, userAddress, poolMint, instructions);
    }

    // check associatedTokenAccount for RENT 165 BYTES FOR RENTs
    if (!daoCommunityTokenReceiverAccount) {
      daoCommunityTokenReceiverAccount = await addAssociatedTokenAccount(
        CONNECTION,
        userAddress,
        communityTokenInfo.tokenMint,
        instructions,
      );
    }

    const withdrawAuthority = await findWithdrawAuthorityProgramAddress(StakePoolProgram.programId, stakePoolAddress);

    instructions.push(
      StakePoolProgram.depositSolDaoInstruction({
        daoCommunityTokenReceiverAccount,
        communityTokenStakingRewards: communityTokenStakingRewardsPubkey,
        ownerWallet: userAddress,
        communityTokenPubkey,
        stakePoolPubkey: stakePoolAddress,
        depositAuthority: undefined,
        withdrawAuthority,
        reserveStakeAccount: stakePool.account.data.reserveStake,
        lamportsFrom: userSolTransfer.publicKey,
        poolTokensTo: poolTokenReceiverAccount,
        managerFeeAccount: stakePool.account.data.managerFeeAccount,
        referrerPoolTokensAccount: referrerTokenAccount ?? poolTokenReceiverAccount,
        poolMint,
        lamports,
      }),
    );

    const transaction = new Transaction();
    instructions.forEach((instruction: any) => transaction.add(instruction));
    transaction.feePayer = userAddress;
    transaction.recentBlockhash = (await CONNECTION.getRecentBlockhash()).blockhash;
    transaction.sign(...signers);

    return transaction;
  }
}
