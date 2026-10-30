import apiClient from '@/lib/axios'

export interface WalletChallengeResponse {
  challenge_message: string
  nonce: string
  wallet_address: string
  expires_at: string
}

export interface WalletRecord {
  id: string
  user_id: string
  wallet_address: string
  chain_id: number
  is_verified: boolean
  is_primary: boolean
  verified_at?: string
  created_at: string
}

export const walletService = {
  async getChallenge(walletAddress: string, chainId = 31337): Promise<WalletChallengeResponse> {
    const response = await apiClient.post<WalletChallengeResponse>('/wallet/challenge', {
      wallet_address: walletAddress,
      chain_id: chainId,
    })
    return response.data
  },

  async verifySignature(walletAddress: string, signature: string, nonce: string): Promise<WalletRecord> {
    const response = await apiClient.post<WalletRecord>('/wallet/verify', {
      wallet_address: walletAddress,
      signature,
      nonce,
    })
    return response.data
  },

  async getMyWallets(): Promise<WalletRecord[]> {
    const response = await apiClient.get<WalletRecord[]>('/wallet/me')
    return response.data
  },
}

export default walletService

