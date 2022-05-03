/* eslint-disable no-shadow */
/* eslint-disable max-classes-per-file */
/*
 based on https://github.com/solana-labs/solana-web3.js/blob/master/src/stake-program.ts
 */
import { PublicKey, TransactionInstruction, StakeProgram } from '@solana/web3.js';
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

/**
 * Stake Pool Instruction class
 */
export class StakePoolInstruction {
  /**
   * Decode a initialize stake pool instruction and retrieve the instruction params.
   */
  static decodeInitialize(instruction: TransactionInstruction): InitializeStakePoolParams {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 6);
    const { feeDenominator, feeNumerator, withdrawalDenominator, withdrawalNumerator, maxValidators } = decodeData(
      STAKE_POOL_INSTRUCTION_LAYOUTS.Initialize,
      instruction.data,
    );

    return {
      feeDenominator,
      feeNumerator,
      withdrawalDenominator,
      withdrawalNumerator,
      maxValidators,
    };
  }

  /**
   * Decode a deposit stake pool instruction and retrieve the instruction params.
   */
  static decodeDeposit(instruction: TransactionInstruction): DepositStakePoolParams {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 6);
    decodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.Deposit, instruction.data);

    return {
      stakePoolPubkey: instruction.keys[0].pubkey,
      validatorListStorage: instruction.keys[1].pubkey,
      stakePoolDepositAuthority: instruction.keys[2].pubkey,
      stakePoolWithdrawAuthority: instruction.keys[3].pubkey,
      depositStakeAddress: instruction.keys[4].pubkey,
      depositStakeWithdrawAuthority: instruction.keys[5].pubkey,
      validatorStakeAccount: instruction.keys[6].pubkey,
      reserveStakeAccount: instruction.keys[7].pubkey,
      poolTokensTo: instruction.keys[8].pubkey,
      poolMint: instruction.keys[9].pubkey,
    };
  }

  /**
   * Decode a deposit sol instruction and retrieve the instruction params.
   */
  static decodeDepositSol(instruction: TransactionInstruction): DepositSolParams {
    this.checkProgramId(instruction.programId);
    this.checkKeyLength(instruction.keys, 9);

    const { amount } = decodeData(STAKE_POOL_INSTRUCTION_LAYOUTS.DepositSol, instruction.data);

    return {
      stakePoolPubkey: instruction.keys[0].pubkey,
      depositAuthority: instruction.keys[1].pubkey,
      withdrawAuthority: instruction.keys[2].pubkey,
      reserveStakeAccount: instruction.keys[3].pubkey,
      lamportsFrom: instruction.keys[4].pubkey,
      poolTokensTo: instruction.keys[5].pubkey,
      managerFeeAccount: instruction.keys[6].pubkey,
      referrerPoolTokensAccount: instruction.keys[7].pubkey,
      poolMint: instruction.keys[8].pubkey,
      lamports: amount,
    };
  }

  /**
   * @internal
   */
  static checkProgramId(programId: PublicKey) {
    if (!programId.equals(StakeProgram.programId)) {
      throw new Error('invalid instruction; programId is not StakeProgram');
    }
  }

  /**
   * @internal
   */
  static checkKeyLength(keys: any[], expectedLength: number) {
    if (keys.length < expectedLength) {
      throw new Error(`invalid instruction; found ${keys.length} keys, expected at least ${expectedLength}`);
    }
  }
}

export const toBuffer = (arr: Buffer | Uint8Array | number[]): Buffer => {
  if (Buffer.isBuffer(arr)) {
    return arr;
  }
  if (arr instanceof Uint8Array) {
    return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
  }
  return Buffer.from(arr);
};
