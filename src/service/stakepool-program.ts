/* eslint-disable no-shadow */
/* eslint-disable max-classes-per-file */
/*
 based on https://github.com/solana-labs/solana-web3.js/blob/master/src/stake-program.ts
 */
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  StakeProgram,
  StakeAuthorizationLayout,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_STAKE_HISTORY_PUBKEY,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import * as BufferLayout from '@solana/buffer-layout';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';
import * as Layout from './layout';

// import { encodeData, decodeData, InstructionType } from "./copied-from-solana-web3/instruction";

export type InstructionType = {
  /** The Instruction index (from solana upstream program) */
  index: number;
  /** The BufferLayout to use to build data */
  layout: BufferLayout.Layout;
};

type WithdrawStakeParams = {
  stakePool: PublicKey;
  validatorList: PublicKey;
  withdrawAuthority: PublicKey;
  validatorStake: PublicKey;
  destinationStake: PublicKey;
  destinationStakeAuthority: PublicKey;
  sourceTransferAuthority: PublicKey;
  sourcePoolAccount: PublicKey;
  managerFeeAccount: PublicKey;
  poolMint: PublicKey;
  poolTokens: number;
};

type WithdrawStakeWithDaoParams = {
  daoCommunityTokenReceiverAccount: PublicKey;
  communityTokenStakingRewards: PublicKey;
  ownerWallet: PublicKey;
  communityTokenPubkey: PublicKey;
  stakePool: PublicKey;
  validatorList: PublicKey;
  withdrawAuthority: PublicKey;
  validatorStake: PublicKey;
  destinationStake: PublicKey;
  destinationStakeAuthority: PublicKey;
  sourceTransferAuthority: PublicKey;
  sourcePoolAccount: PublicKey;
  managerFeeAccount: PublicKey;
  poolMint: PublicKey;
  poolTokens: number;
};

/**
 * Populate a buffer of instruction data using an InstructionType
 * @internal
 */
export function encodeData(type: InstructionType, fields?: any): Buffer {
  const allocLength = type.layout.span >= 0 ? type.layout.span : Layout.getAlloc(type, fields);
  const data = Buffer.alloc(allocLength);
  const layoutFields = { instruction: type.index, ...fields };
  type.layout.encode(layoutFields, data);

  return data;
}

/**
 * Decode instruction data buffer using an InstructionType
 * @internal
 */
export function decodeData(type: InstructionType, buffer: Buffer): any {
  let data;
  try {
    data = type.layout.decode(buffer);
  } catch (err) {
    throw new Error(`invalid instruction; ${err}`);
  }

  if (data.instruction !== type.index) {
    throw new Error(`invalid instruction; instruction index mismatch ${data.instruction} != ${type.index}`);
  }

  return data;
}

/**
 * An enumeration of valid StakePoolInstructionType's
 */
export type StakePoolInstructionType =
  | 'Initialize'
  | 'Deposit'
  | 'DepositSol'
  | 'WithdrawStake'
  | 'WithdrawStakeWithDao'
  | 'WithdrawSol'
  | 'SetFundingAuthority'
  | 'CreateCommunityTokenStakingRewards'
  | 'DepositSolDao'
  | 'WithdrawSolWithDao';

/**
 * Defines which deposit authority to update in the `SetDepositAuthority`
 */
export enum DepositType {
  /// Sets the stake deposit authority
  Stake,
  /// Sets the SOL deposit authority
  Sol,
}

/**
 * An enumeration of valid stake InstructionType's
 * @internal
 */
export const STAKE_POOL_INSTRUCTION_LAYOUTS: {
  [type in StakePoolInstructionType]: InstructionType;
} = Object.freeze({
  Initialize: {
    index: 0,
    layout: BufferLayout.struct([
      BufferLayout.u8('instruction'),
      BufferLayout.ns64('fee_denominator'),
      BufferLayout.ns64('fee_numerator'),
      BufferLayout.ns64('withdrawal_fee_denominator'),
      BufferLayout.ns64('withdrawal_fee_numerator'),
      BufferLayout.u32('max_validators'),
    ]),
  },
  Deposit: {
    index: 9,
    layout: BufferLayout.struct([BufferLayout.u8('instruction')]),
  },
  ///   Withdraw the token from the pool at the current ratio.
  ///
  ///   Succeeds if the stake account has enough SOL to cover the desired amount
  ///   of pool tokens, and if the withdrawal keeps the total staked amount
  ///   above the minimum of rent-exempt amount + 0.001 SOL.
  ///
  ///   When allowing withdrawals, the order of priority goes:
  ///
  ///   * preferred withdraw validator stake account (if set)
  ///   * validator stake accounts
  ///   * transient stake accounts
  ///   * reserve stake account
  ///
  ///   A user can freely withdraw from a validator stake account, and if they
  ///   are all at the minimum, then they can withdraw from transient stake
  ///   accounts, and if they are all at minimum, then they can withdraw from
  ///   the reserve.
  ///
  ///   0. `[w]` Stake pool
  ///   1. `[w]` Validator stake list storage account
  ///   2. `[]` Stake pool withdraw authority
  ///   3. `[w]` Validator or reserve stake account to split
  ///   4. `[w]` Unitialized stake account to receive withdrawal
  ///   5. `[]` User account to set as a new withdraw authority
  ///   6. `[s]` User transfer authority, for pool token account
  ///   7. `[w]` User account with pool tokens to burn from
  ///   8. `[w]` Account to receive pool fee tokens
  ///   9. `[w]` Pool token mint account
  ///  10. `[]` Sysvar clock account (required)
  ///  11. `[]` Pool token program id
  ///  12. `[]` Stake program id,
  ///  userdata: amount of pool tokens to withdraw
  WithdrawStake: {
    index: 10,
    layout: BufferLayout.struct([BufferLayout.u8('instruction'), BufferLayout.ns64('poolTokens')]),
  },
  ///   Withdraw the token from the pool at the current ratio.
  ///
  ///   Succeeds if the stake account has enough SOL to cover the desired amount
  ///   of pool tokens, and if the withdrawal keeps the total staked amount
  ///   above the minimum of rent-exempt amount + 0.001 SOL.
  ///
  ///   When allowing withdrawals, the order of priority goes:
  ///
  ///   * preferred withdraw validator stake account (if set)
  ///   * validator stake accounts
  ///   * transient stake accounts
  ///   * reserve stake account
  ///
  ///   A user can freely withdraw from a validator stake account, and if they
  ///   are all at the minimum, then they can withdraw from transient stake
  ///   accounts, and if they are all at minimum, then they can withdraw from
  ///   the reserve.
  ///   0. [w] Stake pool
  ///   1. [w] Validator stake list storage account
  ///   2. [] Stake pool withdraw authority
  ///   3. [w] Validator or reserve stake account to split
  ///   4. [w] Unitialized stake account to receive withdrawal
  ///   5. [] User account to set as a new withdraw authority
  ///   6. [s] User transfer authority, for pool token account
  ///   7. [w] User account with pool tokens to burn from
  ///   8. [w] Account to receive pool fee tokens
  ///   9. [w] Pool token mint account
  ///  10. [] Sysvar clock account (required)
  ///  11. [] Pool token program id
  ///  12. [] Stake program id,
  ///  13  [] User account to hold DAO`s community tokens
  ///  14  [w] Account for storing community token staking rewards dto
  ///  15. [s] Owner wallet
  ///  16  [] Account for storing community token dto
  ///  userdata: amount of pool tokens to withdraw
  WithdrawStakeWithDao: {
    index: 24,
    layout: BufferLayout.struct([BufferLayout.u8('instruction'), BufferLayout.ns64('poolTokens')]),
  },
  ///   Deposit SOL directly into the pool's reserve account. The output is a "pool" token
  ///   representing ownership into the pool. Inputs are converted to the current ratio.
  ///
  ///   0. `[w]` Stake pool
  ///   1. `[]` Stake pool withdraw authority
  ///   2. `[w]` Reserve stake account, to deposit SOL
  ///   3. `[s]` Account providing the lamports to be deposited into the pool
  ///   4. `[w]` User account to receive pool tokens
  ///   5. `[w]` Account to receive fee tokens
  ///   6. `[w]` Account to receive a portion of fee as referral fees
  ///   7. `[w]` Pool token mint account
  ///   8. `[]` System program account
  ///   9. `[]` Token program id
  ///  10. `[s]` (Optional) Stake pool sol deposit authority.
  DepositSol: {
    index: 14,
    layout: BufferLayout.struct([BufferLayout.u8('instruction'), BufferLayout.ns64('lamports')]),
  },
  /// DepositSolDao
  ///   0. [w] Stake pool
  ///   1. [] Stake pool withdraw authority
  ///   2. [w] Reserve stake account, to deposit SOL
  ///   3. [s] Account providing the lamports to be deposited into the pool
  ///   4. [w] User account to receive pool tokens
  ///   5  [] User account to hold DAO`s community tokens
  ///   6. [w] Account to receive fee tokens
  ///   7. [w] Account to receive a portion of fee as referral fees
  ///   8. [w] Pool token mint account
  ///   9. [] System program account
  ///  10. [] Token program id
  ///  11. [w] Account for storing community token staking rewards dto
  ///  12. [s] Owner wallet
  ///  13  [] Account for storing community token dto
  ///  14. [s] (Optional) Stake pool sol deposit authority.
  DepositSolDao: {
    index: 22,
    layout: BufferLayout.struct([BufferLayout.u8('instruction'), BufferLayout.ns64('lamports')]),
  },
  ///  (Manager only) Update SOL deposit authority
  ///
  ///  0. `[w]` StakePool
  ///  1. `[s]` Manager
  ///  2. '[]` New authority pubkey or none
  SetFundingAuthority: {
    index: 15,
    layout: BufferLayout.struct([BufferLayout.u8('instruction'), BufferLayout.u32('fundingType')]),
  },
  ///   Withdraw SOL directly from the pool's reserve account. Fails if the
  ///   reserve does not have enough SOL.
  ///
  ///   0. `[w]` Stake pool
  ///   1. `[]` Stake pool withdraw authority
  ///   2. `[s]` User transfer authority, for pool token account
  ///   3. `[w]` User account to burn pool tokens
  ///   4. `[w]` Reserve stake account, to withdraw SOL
  ///   5. `[w]` Account receiving the lamports from the reserve, must be a system account
  ///   6. `[w]` Account to receive pool fee tokens
  ///   7. `[w]` Pool token mint account
  ///   8. '[]' Clock sysvar
  ///   9. '[]' Stake history sysvar
  ///  10. `[]` Stake program account
  ///  11. `[]` Token program id
  ///  12. `[s]` (Optional) Stake pool sol withdraw authority
  WithdrawSol: {
    index: 16,
    layout: BufferLayout.struct([BufferLayout.u8('instruction'), BufferLayout.ns64('poolTokens')]),
  },
  ///   Withdraw SOL directly from the pool's reserve account with existing DAO`s community tokens strategy. Fails if the
  ///   reserve does not have enough SOL.
  ///
  ///   0. [w] Stake pool
  ///   1. [] Stake pool withdraw authority
  ///   2. [s] User transfer authority, for pool token account
  ///   3. [w] User account to burn pool tokens
  ///   4  [] User account to hold DAO`s community tokens
  ///   5. [w] Reserve stake account, to withdraw SOL
  ///   6. [w] Account receiving the lamports from the reserve, must be a system account
  ///   7. [w] Account to receive pool fee tokens
  ///   8. [w] Pool token mint account
  ///   9. '[]' Clock sysvar
  ///  10. '[]' Stake history sysvar
  ///  11. [] Stake program account
  ///  12. [] Token program id
  ///  13. [w] Account for storing community token staking rewards dto
  ///  14. [s] Owner wallet
  ///  15. [] Account for storing community token
  ///  16. [s] (Optional) Stake pool sol withdraw authority
  WithdrawSolWithDao: {
    index: 23,
    layout: BufferLayout.struct([BufferLayout.u8('instruction'), BufferLayout.ns64('poolTokens')]),
  },
  ///   Create account for storing information for DAO`s community tokens destribution strategy
  ///   0. [] Stake pool
  ///   1. [s] Owner wallet
  ///   2. [w] Account storing community token staking rewards dto
  ///   3. [w] Account for storing counter for community token staking rewards accounts
  ///   4. [] Rent sysvar
  ///   5  [] System program account
  CreateCommunityTokenStakingRewards: {
    index: 21,
    layout: BufferLayout.struct([BufferLayout.u8('instruction')]),
  },
});

/**
 * Initialize stake instruction params
 */
export type InitializeStakePoolParams = {
  feeDenominator: number;
  feeNumerator: number;
  withdrawalDenominator: number;
  withdrawalNumerator: number;
  maxValidators: number;
};

/**
 * Deposit stake pool instruction params
 */
export type DepositStakePoolParams = {
  stakePoolPubkey: PublicKey;
  validatorListStorage: PublicKey;
  stakePoolDepositAuthority: PublicKey;
  stakePoolWithdrawAuthority: PublicKey;
  depositStakeAddress: PublicKey;
  depositStakeWithdrawAuthority: PublicKey;
  validatorStakeAccount: PublicKey;
  reserveStakeAccount: PublicKey;
  poolTokensTo: PublicKey;
  poolMint: PublicKey;
};

/**
 * Withdraw stake pool instruction params
 */
export type WithdrawStakePoolParams = {
  stakePoolPubkey: PublicKey;
  validatorListStorage: PublicKey;
  stakePoolWithdrawAuthority: PublicKey;
  stakeToSplit: PublicKey;
  stakeToReceive: PublicKey;
  userStakeAuthority: PublicKey;
  userTransferAuthority: PublicKey;
  userPoolTokenAccount: PublicKey;
  managerFeeAccount: PublicKey;
  poolMint: PublicKey;
  lamports: number;
};

export type WithdrawStakeWithDaoPoolParams = {
  daoCommunityTokenReceiverAccount: PublicKey;
  communityTokenStakingRewards: PublicKey;
  ownerWallet: PublicKey;
  communityTokenPubkey: PublicKey;
  stakePoolPubkey: PublicKey;
  validatorListStorage: PublicKey;
  stakePoolWithdrawAuthority: PublicKey;
  stakeToSplit: PublicKey;
  stakeToReceive: PublicKey;
  userStakeAuthority: PublicKey;
  userTransferAuthority: PublicKey;
  userPoolTokenAccount: PublicKey;
  managerFeeAccount: PublicKey;
  poolMint: PublicKey;
  lamports: number;
};

/**
 * Withdraw sol instruction params
 */
export type WithdrawSolParams = {
  stakePoolPubkey: PublicKey;
  solWithdrawAuthority: PublicKey | undefined;
  stakePoolWithdrawAuthority: PublicKey;
  userTransferAuthority: PublicKey;
  poolTokensFrom: PublicKey;
  reserveStakeAccount: PublicKey;
  lamportsTo: PublicKey;
  managerFeeAccount: PublicKey;
  poolMint: PublicKey;
  poolTokens: number;
};

export type WithdrawSolWithDaoParams = {
  daoCommunityTokenReceiverAccount: PublicKey;
  communityTokenStakingRewards: PublicKey;
  ownerWallet: PublicKey;
  communityTokenPubkey: PublicKey;
  stakePoolPubkey: PublicKey;
  solWithdrawAuthority: PublicKey | undefined;
  stakePoolWithdrawAuthority: PublicKey;
  userTransferAuthority: PublicKey;
  poolTokensFrom: PublicKey;
  reserveStakeAccount: PublicKey;
  lamportsTo: PublicKey;
  managerFeeAccount: PublicKey;
  poolMint: PublicKey;
  poolTokens: number;
};

/**
 * Deposit sol instruction params
 */
export type DepositSolParams = {
  stakePoolPubkey: PublicKey;
  depositAuthority?: PublicKey;
  withdrawAuthority: PublicKey;
  reserveStakeAccount: PublicKey;
  lamportsFrom: PublicKey;
  poolTokensTo: PublicKey;
  managerFeeAccount: PublicKey;
  referrerPoolTokensAccount: PublicKey;
  poolMint: PublicKey;
  lamports: number;
};

export type DepositSolDaoParams = {
  daoCommunityTokenReceiverAccount: PublicKey;
  communityTokenStakingRewards: PublicKey;
  ownerWallet: PublicKey;
  communityTokenPubkey: PublicKey;
  stakePoolPubkey: PublicKey;
  depositAuthority?: PublicKey;
  withdrawAuthority: PublicKey;
  reserveStakeAccount: PublicKey;
  lamportsFrom: PublicKey;
  poolTokensTo: PublicKey;
  managerFeeAccount: PublicKey;
  referrerPoolTokensAccount: PublicKey;
  poolMint: PublicKey;
  lamports: number;
};

export type CreateCommunityTokenStakingRewardsParams = {
  stakePoolPubkey: PublicKey;
  ownerWallet: PublicKey;
  communityTokenStakingRewardsDTO: PublicKey;
  communityTokenStakingRewardsCounterDTO: PublicKey;
};

export const toBuffer = (arr: Buffer | Uint8Array | number[]): Buffer => {
  if (Buffer.isBuffer(arr)) {
    return arr;
  }
  if (arr instanceof Uint8Array) {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  return Buffer.from(arr);
};

/**
 * Factory class for transactions to interact with the Stake program
 */
export class StakePoolProgram {
  /**
   * Public key that identifies the Stake Pool program
   */
  // static programId: PublicKey = new PublicKey("EverSFw9uN5t1V8kS3ficHUcKffSjwpGzUSGd7mgmSks")
  static programId: PublicKey = new PublicKey('CgymamZFh5aVZhoSRtV2QrEZ58X4N1o2H5ZQPF4L5jj8');

  // testtest CgymamZFh5aVZhoSRtV2QrEZ58X4N1o2H5ZQPF4L5jj8
  // mainnet EverSFw9uN5t1V8kS3ficHUcKffSjwpGzUSGd7mgmSks
  // dao-test CgymamZFh5aVZhoSRtV2QrEZ58X4N1o2H5ZQPF4L5jj8
  // testnet id new 49jTXmoSFDEvMHWZhGxjzfgBU11KCqMhK45itiAoqbpa

  static tokenProgramId: PublicKey = TOKEN_PROGRAM_ID;

  static stakeProgramId = StakeProgram.programId;

  static changeProgramId(id: string) {
    this.programId = new PublicKey(id);
  }

  static initialize(params: InitializeStakePoolParams): Transaction {
    const { feeDenominator, feeNumerator, withdrawalDenominator, withdrawalNumerator, maxValidators } = params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.Initialize;

    const data = encodeData(type, {
      feeDenominator,
      feeNumerator,
      withdrawalDenominator,
      withdrawalNumerator,
      maxValidators,
    });

    return new Transaction().add();
  }

  static deposit(params: DepositStakePoolParams): Transaction {
    const {
      stakePoolPubkey,
      validatorListStorage,
      stakePoolDepositAuthority,
      stakePoolWithdrawAuthority,
      depositStakeAddress,
      depositStakeWithdrawAuthority,
      validatorStakeAccount,
      reserveStakeAccount,
      poolTokensTo,
      poolMint,
    } = params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.Deposit;
    const data = encodeData(type);

    return new Transaction().add(
      StakeProgram.authorize({
        stakePubkey: depositStakeAddress,
        authorizedPubkey: depositStakeWithdrawAuthority,
        newAuthorizedPubkey: stakePoolDepositAuthority,
        stakeAuthorizationType: StakeAuthorizationLayout.Staker,
      }),
      StakeProgram.authorize({
        stakePubkey: depositStakeAddress,
        authorizedPubkey: depositStakeWithdrawAuthority,
        newAuthorizedPubkey: stakePoolDepositAuthority,
        stakeAuthorizationType: StakeAuthorizationLayout.Withdrawer,
      }),
      {
        keys: [
          { pubkey: stakePoolPubkey, isSigner: false, isWritable: true },
          { pubkey: validatorListStorage, isSigner: false, isWritable: true },
          { pubkey: stakePoolDepositAuthority, isSigner: false, isWritable: false },
          { pubkey: stakePoolWithdrawAuthority, isSigner: false, isWritable: false },
          { pubkey: depositStakeAddress, isSigner: false, isWritable: true },
          { pubkey: validatorStakeAccount, isSigner: false, isWritable: true },
          { pubkey: reserveStakeAccount, isSigner: false, isWritable: true },
          { pubkey: poolTokensTo, isSigner: false, isWritable: true },
          { pubkey: poolMint, isSigner: false, isWritable: true },
          { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
          { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
          { pubkey: this.stakeProgramId, isSigner: false, isWritable: false },
        ],
        programId: this.programId,
        data,
      },
    );
  }

  static depositSolInstruction(params: DepositSolParams): TransactionInstruction {
    const {
      stakePoolPubkey,
      depositAuthority,
      withdrawAuthority,
      reserveStakeAccount,
      lamportsFrom,
      poolTokensTo,
      managerFeeAccount,
      referrerPoolTokensAccount,
      poolMint,
      lamports,
    } = params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.DepositSol;
    const data = encodeData(type, { lamports });

    const keys = [
      { pubkey: stakePoolPubkey, isSigner: false, isWritable: true },
      { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: reserveStakeAccount, isSigner: false, isWritable: true },
      { pubkey: lamportsFrom, isSigner: true, isWritable: false },
      { pubkey: poolTokensTo, isSigner: false, isWritable: true },
      { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: referrerPoolTokensAccount, isSigner: false, isWritable: true },
      { pubkey: poolMint, isSigner: false, isWritable: true },
      // { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
    ];

    if (depositAuthority) {
      keys.push({
        pubkey: depositAuthority,
        isSigner: false,
        isWritable: false,
      });
    }

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }

  static depositSolDaoInstruction(params: DepositSolDaoParams): TransactionInstruction {
    const {
      daoCommunityTokenReceiverAccount,
      communityTokenStakingRewards,
      ownerWallet,
      communityTokenPubkey,
      stakePoolPubkey,
      depositAuthority,
      withdrawAuthority,
      reserveStakeAccount,
      lamportsFrom,
      poolTokensTo,
      managerFeeAccount,
      referrerPoolTokensAccount,
      poolMint,
      lamports,
    } = params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.DepositSolDao;
    const data = encodeData(type, { lamports });

    const keys = [
      { pubkey: stakePoolPubkey, isSigner: false, isWritable: true },
      { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: reserveStakeAccount, isSigner: false, isWritable: true },
      { pubkey: lamportsFrom, isSigner: true, isWritable: false },
      { pubkey: poolTokensTo, isSigner: false, isWritable: true },
      { pubkey: daoCommunityTokenReceiverAccount, isSigner: false, isWritable: false },
      { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: referrerPoolTokensAccount, isSigner: false, isWritable: true },
      { pubkey: poolMint, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
      { pubkey: communityTokenStakingRewards, isSigner: false, isWritable: true },
      { pubkey: ownerWallet, isSigner: true, isWritable: false },
      { pubkey: communityTokenPubkey, isSigner: false, isWritable: false },
    ];

    if (depositAuthority) {
      keys.push({
        pubkey: depositAuthority,
        isSigner: false,
        isWritable: false,
      });
    }

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }

  static withdrawStakeInstruction(params: WithdrawStakePoolParams) {
    const {
      stakePoolPubkey,
      validatorListStorage,
      stakePoolWithdrawAuthority,
      stakeToSplit,
      stakeToReceive,
      userStakeAuthority,
      userTransferAuthority,
      userPoolTokenAccount,
      managerFeeAccount,
      poolMint,
      lamports,
    } = params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawStake;
    const data = encodeData(type, { lamports });

    const keys = [
      { pubkey: stakePoolPubkey, isSigner: false, isWritable: true },
      { pubkey: validatorListStorage, isSigner: false, isWritable: true },
      { pubkey: stakePoolWithdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: stakeToSplit, isSigner: false, isWritable: true },
      { pubkey: stakeToReceive, isSigner: false, isWritable: true },
      { pubkey: userStakeAuthority, isSigner: false, isWritable: false },
      { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
      { pubkey: userPoolTokenAccount, isSigner: false, isWritable: true },
      { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: poolMint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
      { pubkey: this.stakeProgramId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }

  static withdrawStake(params: WithdrawStakeParams): TransactionInstruction {
    const {
      stakePool,
      validatorList,
      withdrawAuthority,
      validatorStake,
      destinationStake,
      destinationStakeAuthority,
      sourceTransferAuthority,
      sourcePoolAccount,
      managerFeeAccount,
      poolMint,
      poolTokens,
    } = params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawStake;
    const data = encodeData(type, { poolTokens });

    const keys = [
      { pubkey: stakePool, isSigner: false, isWritable: true },
      { pubkey: validatorList, isSigner: false, isWritable: true },
      { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: validatorStake, isSigner: false, isWritable: true },
      { pubkey: destinationStake, isSigner: false, isWritable: true },
      { pubkey: destinationStakeAuthority, isSigner: false, isWritable: false },
      { pubkey: sourceTransferAuthority, isSigner: true, isWritable: false },
      { pubkey: sourcePoolAccount, isSigner: false, isWritable: true },
      { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: poolMint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }

  static withdrawStakeWithDao(params: WithdrawStakeWithDaoParams): TransactionInstruction {
    const {
      daoCommunityTokenReceiverAccount,
      communityTokenStakingRewards,
      ownerWallet,
      communityTokenPubkey,
      stakePool,
      validatorList,
      withdrawAuthority,
      validatorStake,
      destinationStake,
      destinationStakeAuthority,
      sourceTransferAuthority,
      sourcePoolAccount,
      managerFeeAccount,
      poolMint,
      poolTokens,
    } = params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawStakeWithDao;
    const data = encodeData(type, { poolTokens });

    const keys = [
      { pubkey: stakePool, isSigner: false, isWritable: true },
      { pubkey: validatorList, isSigner: false, isWritable: true },
      { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: validatorStake, isSigner: false, isWritable: true },
      { pubkey: destinationStake, isSigner: false, isWritable: true },
      { pubkey: destinationStakeAuthority, isSigner: false, isWritable: false },
      { pubkey: sourceTransferAuthority, isSigner: true, isWritable: false },
      { pubkey: sourcePoolAccount, isSigner: false, isWritable: true },
      { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: poolMint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: StakeProgram.programId, isSigner: false, isWritable: false },
      { pubkey: daoCommunityTokenReceiverAccount, isSigner: false, isWritable: false },
      { pubkey: communityTokenStakingRewards, isSigner: false, isWritable: true },
      { pubkey: ownerWallet, isSigner: true, isWritable: false },
      { pubkey: communityTokenPubkey, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }

  static withdrawSolInstruction(params: WithdrawSolParams) {
    const {
      stakePoolPubkey,
      solWithdrawAuthority,
      stakePoolWithdrawAuthority,
      userTransferAuthority,
      poolTokensFrom,
      reserveStakeAccount,
      lamportsTo,
      managerFeeAccount,
      poolMint,
      poolTokens,
    } = params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawSol;
    const data = encodeData(type, { poolTokens });

    const keys = [
      { pubkey: stakePoolPubkey, isSigner: false, isWritable: true },
      { pubkey: stakePoolWithdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
      { pubkey: poolTokensFrom, isSigner: false, isWritable: true },
      { pubkey: reserveStakeAccount, isSigner: false, isWritable: true },
      { pubkey: lamportsTo, isSigner: false, isWritable: true },
      { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: poolMint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: this.stakeProgramId, isSigner: false, isWritable: false },
      { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
    ];

    if (solWithdrawAuthority) {
      keys.push({
        pubkey: solWithdrawAuthority,
        isSigner: true,
        isWritable: false,
      });
    }

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }

  static withdrawSolWithDaoInstruction(params: WithdrawSolWithDaoParams) {
    const {
      daoCommunityTokenReceiverAccount,
      communityTokenStakingRewards,
      ownerWallet,
      communityTokenPubkey,
      stakePoolPubkey,
      solWithdrawAuthority,
      stakePoolWithdrawAuthority,
      userTransferAuthority,
      poolTokensFrom,
      reserveStakeAccount,
      lamportsTo,
      managerFeeAccount,
      poolMint,
      poolTokens,
    } = params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.WithdrawSolWithDao;
    const data = encodeData(type, { poolTokens });

    const keys = [
      { pubkey: stakePoolPubkey, isSigner: false, isWritable: true },
      { pubkey: stakePoolWithdrawAuthority, isSigner: false, isWritable: false },
      { pubkey: userTransferAuthority, isSigner: true, isWritable: false },
      { pubkey: poolTokensFrom, isSigner: false, isWritable: true },
      { pubkey: daoCommunityTokenReceiverAccount, isSigner: false, isWritable: false },
      { pubkey: reserveStakeAccount, isSigner: false, isWritable: true },
      { pubkey: lamportsTo, isSigner: false, isWritable: true },
      { pubkey: managerFeeAccount, isSigner: false, isWritable: true },
      { pubkey: poolMint, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: this.stakeProgramId, isSigner: false, isWritable: false },
      { pubkey: this.tokenProgramId, isSigner: false, isWritable: false },
      { pubkey: communityTokenStakingRewards, isSigner: false, isWritable: true },
      { pubkey: ownerWallet, isSigner: true, isWritable: false },
      { pubkey: communityTokenPubkey, isSigner: false, isWritable: false },
    ];

    if (solWithdrawAuthority) {
      keys.push({
        pubkey: solWithdrawAuthority,
        isSigner: true,
        isWritable: false,
      });
    }

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }

  static createCommunityTokenStakingRewards(params: CreateCommunityTokenStakingRewardsParams): TransactionInstruction {
    const { stakePoolPubkey, ownerWallet, communityTokenStakingRewardsDTO, communityTokenStakingRewardsCounterDTO } =
      params;

    const type = STAKE_POOL_INSTRUCTION_LAYOUTS.CreateCommunityTokenStakingRewards;
    const data = encodeData(type);

    const keys = [
      { pubkey: stakePoolPubkey, isSigner: false, isWritable: false },
      { pubkey: ownerWallet, isSigner: true, isWritable: false },
      { pubkey: communityTokenStakingRewardsDTO, isSigner: false, isWritable: true },
      { pubkey: communityTokenStakingRewardsCounterDTO, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
      programId: this.programId,
      keys,
      data,
    });
  }
}
