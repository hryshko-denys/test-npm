import { PublicKey } from '@solana/web3.js';
import { publicKey, struct, u32, u64, u8, option, vec, bool } from '@project-serum/borsh';

import * as BN from 'bn.js';

export enum AccountType {
  Uninitialized,
  StakePool,
  ValidatorList,
}

export interface Lockup {
  unixTimestamp: number;
  epoch: number;
  custodian: PublicKey;
}

export interface Fee {
  denominator: BN;
  numerator: BN;
}

export interface RateOfExchange {
  denominator: BN;
  numerator: BN;
}

export interface StakePool {
  accountType: AccountType;
  manager: PublicKey;
  staker: PublicKey;
  stakeDepositAuthority: PublicKey;
  stakeWithdrawBumpSeed: number;
  validatorList: PublicKey;
  reserveStake: PublicKey;
  poolMint: PublicKey;
  managerFeeAccount: PublicKey;
  tokenProgramId: PublicKey;
  totalLamports: BN;
  poolTokenSupply: BN;
  lastUpdateEpoch: BN;
  lockup: Lockup;
  epochFee: Fee;
  nextEpochFee?: Fee | undefined;
  preferredDepositValidatorVoteAddress?: PublicKey | undefined;
  preferredWithdrawValidatorVoteAddress?: PublicKey | undefined;
  stakeDepositFee: Fee;
  stakeWithdrawalFee: Fee;
  nextWithdrawalFee?: Fee | undefined;
  stakeReferralFee: number;
  solDepositAuthority?: PublicKey | undefined;
  solDepositFee: Fee;
  solReferralFee: number;
  solWithdrawAuthority?: PublicKey | undefined;
  solWithdrawalFee: Fee;
  nextSolWithdrawalFee?: Fee | undefined;
  lastEpochPoolTokenSupply: BN;
  lastEpochTotalLamports: BN;
  rateOfExchange?: RateOfExchange | undefined;
  treasuryFeeAccount: PublicKey;
  treasuryFee: Fee;
  totalLamportsLiquidity: BN;
}

const feeFields = [u64('denominator'), u64('numerator')];
const rateOfExchangeFields = [u64('denominator'), u64('numerator')];

export const STAKE_POOL_LAYOUT = struct<StakePool>([
  // rustEnum(AccountTypeKind, 'accountType'),
  u8('accountType'),
  publicKey('manager'),
  publicKey('staker'),
  publicKey('stakeDepositAuthority'),
  u8('stakeWithdrawBumpSeed'),
  publicKey('validatorList'),
  publicKey('reserveStake'),
  publicKey('poolMint'),
  publicKey('managerFeeAccount'),
  publicKey('tokenProgramId'),
  u64('totalLamports'),
  u64('poolTokenSupply'),
  u64('lastUpdateEpoch'),
  struct([u64('unixTimestamp'), u64('epoch'), publicKey('custodian')], 'lockup'),
  struct(feeFields, 'epochFee'),
  option(struct(feeFields), 'nextEpochFee'),
  option(publicKey(), 'preferredDepositValidatorVoteAddress'),
  option(publicKey(), 'preferredWithdrawValidatorVoteAddress'),
  struct(feeFields, 'stakeDepositFee'),
  struct(feeFields, 'stakeWithdrawalFee'),
  option(struct(feeFields), 'nextWithdrawalFee'),
  u8('stakeReferralFee'),
  option(publicKey(), 'solDepositAuthority'),
  struct(feeFields, 'solDepositFee'),
  u8('solReferralFee'),
  option(publicKey(), 'solWithdrawAuthority'),
  struct(feeFields, 'solWithdrawalFee'),
  option(struct(feeFields), 'nextSolWithdrawalFee'),
  u64('lastEpochPoolTokenSupply'),
  u64('lastEpochTotalLamports'),
  option(struct(rateOfExchangeFields), 'rateOfExchange'),
  publicKey('treasuryFeeAccount'),
  struct(feeFields, 'treasuryFee'),
  u64('totalLamportsLiquidity'),
]);
