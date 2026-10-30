import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { BrowserProvider } from 'ethers'
import walletService, { type WalletRecord } from '@/services/walletService'

export interface WalletContextType {
  account: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  isVerified: boolean
  error: string | null
  linkedWallets: WalletRecord[]
  connectWallet: () => Promise<string | null>
  disconnectWallet: () => void
  linkWalletWithBackend: () => Promise<boolean>
  switchNetwork: (targetChainId?: number) => Promise<void>
  refreshLinkedWallets: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

const HARDHAT_CHAIN_ID = 31337
const HARDHAT_HEX_CHAIN_ID = '0x7a69'

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkedWallets, setLinkedWallets] = useState<WalletRecord[]>([])

  const refreshLinkedWallets = useCallback(async () => {
    try {
      const wallets = await walletService.getMyWallets()
      setLinkedWallets(wallets)
      if (account) {
        const found = wallets.find((w) => w.wallet_address.toLowerCase() === account.toLowerCase() && w.is_verified)
        setIsVerified(!!found)
      }
    } catch {
      // User may not be logged in yet
    }
  }, [account])

  useEffect(() => {
    refreshLinkedWallets()
  }, [refreshLinkedWallets])

  // Listen to MetaMask account and chain changes
  useEffect(() => {
    const ethereum = (window as any).ethereum
    if (!ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        setAccount(null)
        setIsVerified(false)
      } else {
        setAccount(accounts[0].toLowerCase())
      }
    }

    const handleChainChanged = (hexChain: string) => {
      setChainId(parseInt(hexChain, 16))
    }

    ethereum.on('accountsChanged', handleAccountsChanged)
    ethereum.on('chainChanged', handleChainChanged)

    return () => {
      if (ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleAccountsChanged)
        ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [])

  const connectWallet = async (): Promise<string | null> => {
    const ethereum = (window as any).ethereum
    if (!ethereum) {
      setError('MetaMask or EVM web3 wallet is not detected. Please install MetaMask.')
      return null
    }

    setIsConnecting(true)
    setError(null)
    try {
      const provider = new BrowserProvider(ethereum)
      const accounts = await provider.send('eth_requestAccounts', [])
      const network = await provider.getNetwork()

      const currentAddress = accounts[0].toLowerCase()
      setAccount(currentAddress)
      setChainId(Number(network.chainId))

      return currentAddress
    } catch (err: any) {
      setError(err?.message || 'User rejected wallet connection request.')
      return null
    } finally {
      setIsConnecting(false)
    }
  }

  const disconnectWallet = () => {
    setAccount(null)
    setChainId(null)
    setIsVerified(false)
    setError(null)
  }

  const switchNetwork = async (_targetChainId = HARDHAT_CHAIN_ID) => {
    const ethereum = (window as any).ethereum
    if (!ethereum) return

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: HARDHAT_HEX_CHAIN_ID }],
      })
    } catch (switchError: any) {
      // 4902 error code means chain has not been added to MetaMask
      if (switchError.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: HARDHAT_HEX_CHAIN_ID,
              chainName: 'Hardhat Local EVM',
              rpcUrls: ['http://127.0.0.1:8545'],
              nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            },
          ],
        })
      }
    }
  }

  const linkWalletWithBackend = async (): Promise<boolean> => {
    const ethereum = (window as any).ethereum
    if (!ethereum || !account) {
      setError('Please connect your MetaMask wallet first.')
      return false
    }

    setError(null)
    try {
      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()

      // 1. Get challenge nonce from backend
      const challenge = await walletService.getChallenge(account, chainId || HARDHAT_CHAIN_ID)

      // 2. Prompt user to sign challenge in MetaMask
      const signature = await signer.signMessage(challenge.challenge_message)

      // 3. Submit signature to backend
      const result = await walletService.verifySignature(account, signature, challenge.nonce)

      setIsVerified(result.is_verified)
      await refreshLinkedWallets()
      return true
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Wallet signature challenge failed.')
      return false
    }
  }

  return (
    <WalletContext.Provider
      value={{
        account,
        chainId,
        isConnected: !!account,
        isConnecting,
        isVerified,
        error,
        linkedWallets,
        connectWallet,
        disconnectWallet,
        linkWalletWithBackend,
        switchNetwork,
        refreshLinkedWallets,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

export default WalletContext
