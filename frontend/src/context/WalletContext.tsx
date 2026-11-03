import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { BrowserProvider } from 'ethers'
import walletService, { type WalletRecord } from '@/services/walletService'
import { useAuth } from '@/hooks/useAuth'

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
  clearError: () => void
  linkWalletWithBackend: () => Promise<boolean>
  switchNetwork: (targetChainId?: number) => Promise<void>
  refreshLinkedWallets: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

const TARGET_CHAIN_ID = Number(import.meta.env.VITE_BLOCKCHAIN_CHAIN_ID || 31337)

const pickMetaMaskProvider = (eth: any) => {
  if (!eth) return null
  if (Array.isArray(eth.providers)) {
    return eth.providers.find((p: any) => p?.isMetaMask) || eth.providers[0] || eth
  }
  return eth
}

const getEthereum = async (): Promise<any> => {
  if (typeof window === 'undefined') return null
  if (window.ethereum) {
    return pickMetaMaskProvider(window.ethereum)
  }

  return new Promise((resolve) => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const handleInitialized = () => {
      if (timer) clearTimeout(timer)
      window.removeEventListener('ethereum#initialized', handleInitialized)
      resolve(pickMetaMaskProvider(window.ethereum))
    }

    window.addEventListener('ethereum#initialized', handleInitialized, { once: true })

    timer = setTimeout(() => {
      window.removeEventListener('ethereum#initialized', handleInitialized)
      resolve(pickMetaMaskProvider(window.ethereum))
    }, 1500)
  })
}

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, isAuthenticated } = useAuth()
  const [account, setAccount] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkedWallets, setLinkedWallets] = useState<WalletRecord[]>([])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const refreshLinkedWallets = useCallback(async () => {
    if (!isAuthenticated && !token && !user) {
      setLinkedWallets([])
      setIsVerified(false)
      return
    }

    try {
      const wallets = await walletService.getMyWallets()
      setLinkedWallets(wallets)
      if (account) {
        const found = wallets.find(
          (w) => w.wallet_address.toLowerCase() === account.toLowerCase() && w.is_verified
        )
        setIsVerified(!!found)
      }
    } catch {
      // User may not be logged in or session expired
    }
  }, [account, isAuthenticated, token, user])

  useEffect(() => {
    if (isAuthenticated || token || user) {
      refreshLinkedWallets()
    } else {
      setLinkedWallets([])
      setIsVerified(false)
    }
  }, [refreshLinkedWallets, isAuthenticated, token, user])

  // Restore wallet session silently on mount (eth_accounts) & listen to changes
  useEffect(() => {
    let isMounted = true

    const restoreSession = async () => {
      try {
        const ethereum = await getEthereum()
        if (!ethereum || !isMounted) return

        const accounts: string[] = await ethereum.request({ method: 'eth_accounts' })
        if (isMounted && accounts && accounts.length > 0) {
          const currentAddress = accounts[0].toLowerCase()
          setAccount(currentAddress)

          const hexChainId: string = await ethereum.request({ method: 'eth_chainId' })
          if (isMounted && hexChainId) {
            setChainId(parseInt(hexChainId, 16))
          }
        }

        const handleAccountsChanged = (accs: string[]) => {
          if (!accs || accs.length === 0) {
            setAccount(null)
            setIsVerified(false)
          } else {
            setAccount(accs[0].toLowerCase())
          }
        }

        const handleChainChanged = (hexChain: string) => {
          setChainId(parseInt(hexChain, 16))
        }

        ethereum.on?.('accountsChanged', handleAccountsChanged)
        ethereum.on?.('chainChanged', handleChainChanged)

        return () => {
          if (ethereum.removeListener) {
            ethereum.removeListener('accountsChanged', handleAccountsChanged)
            ethereum.removeListener('chainChanged', handleChainChanged)
          }
        }
      } catch (err) {
        console.error('Silent wallet restoration error:', err)
      }
    }

    restoreSession()

    return () => {
      isMounted = false
    }
  }, [])

  const switchNetwork = useCallback(async (targetChainId: number = TARGET_CHAIN_ID) => {
    const ethereum = await getEthereum()
    if (!ethereum) return
    const hexChainId = `0x${targetChainId.toString(16)}`

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: hexChainId }],
      })
      setChainId(targetChainId)
    } catch (switchError: any) {
      // 4902 error code means chain has not been added to MetaMask
      if (switchError?.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        const isSepolia = targetChainId === 11155111
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: hexChainId,
              chainName: isSepolia
                ? 'Ethereum Sepolia Testnet'
                : targetChainId === 31337
                ? 'Hardhat Local EVM'
                : `EVM Network (${targetChainId})`,
              rpcUrls: [
                isSepolia
                  ? import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'https://rpc.sepolia.org'
                  : 'http://127.0.0.1:8545',
              ],
              nativeCurrency: {
                name: isSepolia ? 'Sepolia ETH' : 'Ethereum',
                symbol: 'ETH',
                decimals: 18,
              },
              blockExplorerUrls: isSepolia ? ['https://sepolia.etherscan.io'] : undefined,
            },
          ],
        })
        setChainId(targetChainId)
      } else {
        throw switchError
      }
    }
  }, [])

  const connectWallet = useCallback(async (): Promise<string | null> => {
    setIsConnecting(true)
    setError(null)
    try {
      const ethereum = await getEthereum()
      if (!ethereum) {
        setError('MetaMask not detected. Install it and refresh the page.')
        return null
      }

      const provider = new BrowserProvider(ethereum)
      const accounts: string[] = await provider.send('eth_requestAccounts', [])
      const network = await provider.getNetwork()

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask.')
      }

      const currentAddress = accounts[0].toLowerCase()
      const currentChainId = Number(network.chainId)
      setAccount(currentAddress)
      setChainId(currentChainId)

      // Auto-switch to required network if different
      const targetChainId = Number(import.meta.env.VITE_BLOCKCHAIN_CHAIN_ID || 31337)
      if (currentChainId !== targetChainId) {
        try {
          await switchNetwork(targetChainId)
        } catch (switchErr: any) {
          console.warn('Network switch failed or was rejected:', switchErr)
        }
      }

      return currentAddress
    } catch (err: any) {
      const code = err?.code ?? err?.info?.error?.code
      if (code === 4001 || code === 'ACTION_REJECTED') {
        setError('Connection request was rejected.')
      } else if (code === -32002) {
        setError('A MetaMask request is already pending. Open the MetaMask extension.')
      } else {
        setError(err?.message || 'Failed to connect wallet.')
      }
      return null
    } finally {
      setIsConnecting(false)
    }
  }, [switchNetwork])

  const disconnectWallet = useCallback(() => {
    setAccount(null)
    setChainId(null)
    setIsVerified(false)
    setError(null)
  }, [])

  const linkWalletWithBackend = useCallback(async (): Promise<boolean> => {
    const ethereum = await getEthereum()
    if (!ethereum || !account) {
      setError('Please connect your MetaMask wallet first.')
      return false
    }

    setError(null)
    try {
      const provider = new BrowserProvider(ethereum)
      const signer = await provider.getSigner()

      // 1. Get challenge nonce from backend
      const challenge = await walletService.getChallenge(account, chainId || TARGET_CHAIN_ID)

      // 2. Prompt user to sign challenge in MetaMask
      const signature = await signer.signMessage(challenge.challenge_message)

      // 3. Submit signature to backend
      const result = await walletService.verifySignature(account, signature, challenge.nonce)

      setIsVerified(result.is_verified)
      await refreshLinkedWallets()
      return true
    } catch (err: any) {
      const code = err?.code ?? err?.info?.error?.code
      if (code === 4001 || code === 'ACTION_REJECTED') {
        setError('Signature request was rejected in MetaMask.')
      } else {
        const backendMsg = err?.response?.data?.message || err?.response?.data?.detail
        setError(backendMsg || err?.message || 'Wallet signature challenge failed.')
      }
      return false
    }
  }, [account, chainId, refreshLinkedWallets])

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
        clearError,
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
