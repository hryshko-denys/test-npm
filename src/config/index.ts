import { PublicKey, Connection } from '@solana/web3.js';

const DEFAULT_PROVIDER_URL = 'https://api.testnet.solana.com';

export class ESolConfig {
  eSOLProgramId = new PublicKey('CgymamZFh5aVZhoSRtV2QrEZ58X4N1o2H5ZQPF4L5jj8');
  eSOLStakePoolAddress = new PublicKey('4QRsVADHap1AgtpryYB2vz4htG3ysJcaXFkcFqkGjaF1');
  seedPrefixDaoState = 'dao_state';
  seedPrefixCommunityToken = 'community_token';
  seedPrefixCommunityTokenStakingRewards = 'c_t_staking_rewards';
  seedPrefixCommunityTokenStakingRewardsCounter = 'c_t_staking_rewards_counter';

  connection = new Connection(DEFAULT_PROVIDER_URL);
  publicKey: PublicKey | null = null;

  constructor(configOverrides: Partial<ESolConfig> = {}) {
    Object.assign(this, configOverrides);
  }
}
