import { useState, useCallback } from 'react'
import {
  isConnected,
  requestAccess,
  getPublicKey,
  signTransaction,
} from '@stellar/freighter-api'

const HORIZON = 'https://horizon-testnet.stellar.org'
const NETWORK = 'TESTNET'
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'

export function useWallet() {
  const [publicKey, setPublicKey] = useState(null)
  const [balance, setBalance] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState(null)

  const isInstalled = () => true

  const fetchBalance = useCallback(async (pk) => {
    try {
      const resp = await fetch(`${HORIZON}/accounts/${pk}`)
      if (!resp.ok) return
      const data = await resp.json()
      const native = data.balances?.find(b => b.asset_type === 'native')
      if (native) setBalance(parseFloat(native.balance).toFixed(2))
    } catch { }
  }, [])

  const connect = useCallback(async () => {
    setConnecting(true)
    setError(null)
    try {
      const connResult = await isConnected()
      const connected = connResult === true || connResult?.isConnected === true
      if (!connected) {
        setError('Freighter not detected. Install the extension and refresh.')
        return false
      }

      let pk = null
      try {
        const access = await requestAccess()
        if (access?.error) throw new Error(access.error)
        pk = access?.address ?? (typeof access === 'string' ? access : null)
      } catch (e) {
        const msg = e.message?.toLowerCase() ?? ''
        if (msg.includes('reject') || msg.includes('cancel')) {
          setError('Connection rejected. Please approve in Freighter.')
          return false
        }
      }

      if (!pk) {
        const fallback = await getPublicKey()
        pk = typeof fallback === 'string' ? fallback : fallback?.publicKey ?? null
      }

      if (!pk || pk.length < 10) {
        setError('Could not get public key. Please try again.')
        return false
      }

      setPublicKey(pk)
      await fetchBalance(pk)
      return true
    } catch (e) {
      setError(e.message || 'Failed to connect wallet')
      return false
    } finally {
      setConnecting(false)
    }
  }, [fetchBalance])

  const disconnect = useCallback(() => {
    setPublicKey(null)
    setBalance(null)
    setError(null)
  }, [])

  const signAndSubmitTransaction = useCallback(async (xdr) => {
    if (!publicKey) throw new Error('Wallet not connected')

    let signedXDR = null
    try {
      const result = await signTransaction(xdr, {
        network: NETWORK,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
      if (result?.error) throw new Error(result.error)
      signedXDR = typeof result === 'string' ? result
        : result?.signedXDR ?? result?.signedTransaction ?? null
    } catch (e) {
      const msg = e.message?.toLowerCase() ?? ''
      if (msg.includes('reject') || msg.includes('cancel') || msg.includes('denied')) {
        throw new Error('User rejected transaction')
      }
      throw e
    }

    if (!signedXDR) throw new Error('No signed XDR returned from Freighter')

    const resp = await fetch(`${HORIZON}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `tx=${encodeURIComponent(signedXDR)}`,
    })

    const result = await resp.json()
    if (!resp.ok) {
      const opCode =
        result?.extras?.result_codes?.operations?.[0] ??
        result?.extras?.result_codes?.transaction
      throw new Error(`Transaction failed: ${opCode ?? result.title ?? 'Unknown error'}`)
    }
    return result
  }, [publicKey])

  return {
    publicKey, balance, connecting, error,
    isInstalled, connect, disconnect,
    signAndSubmitTransaction,
    refreshBalance: () => publicKey && fetchBalance(publicKey),
  }
}


