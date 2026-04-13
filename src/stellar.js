export const WELL_ADDRESS = 'GAP2OWZUEIGKFT2XJPYLLWH3QSGC65DZROVGGEHM3ZBSUZQZXRLUONGC'
export const MIN_AMOUNT = '0.1'
export const MAX_WISH_LENGTH = 100

const HORIZON = 'https://horizon-testnet.stellar.org'
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'

export async function buildWishTransaction({ senderPublicKey, amountXLM, wishText }) {
  const StellarSdk = await import('@stellar/stellar-sdk')
  const server = new StellarSdk.Horizon.Server(HORIZON)

  let sourceAccount
  try {
    sourceAccount = await server.loadAccount(senderPublicKey)
  } catch (e) {
    if (e?.response?.status === 404 || e?.message?.includes('Not Found')) {
      throw new Error('Account not found on testnet. Fund it at https://friendbot.stellar.org')
    }
    throw e
  }

  const memoText = wishText.substring(0, 28)

  const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: WELL_ADDRESS,
        asset: StellarSdk.Asset.native(),
        amount: amountXLM.toString(),
      })
    )
    .addMemo(StellarSdk.Memo.text(memoText))
    .setTimeout(180)
    .build()

  return transaction.toXDR()
}

export async function fetchWishes() {
  try {
    // Use /payments endpoint — returns payment ops with amount directly
    // Join with transaction to get the memo
    const paymentsResp = await fetch(
      `${HORIZON}/accounts/${WELL_ADDRESS}/payments?limit=100&order=desc&include_failed=false`
    )
    if (!paymentsResp.ok) return []
    const paymentsData = await paymentsResp.json()

    const records = paymentsData._embedded?.records || []

    // Filter only incoming native XLM payments
    const incoming = records.filter(
      r => r.type === 'payment' && r.asset_type === 'native' && r.to === WELL_ADDRESS
    )

    // Fetch the transaction for each payment to get the memo
    const wishes = []
    await Promise.all(
      incoming.map(async (payment) => {
        try {
          const txResp = await fetch(payment._links.transaction.href)
          if (!txResp.ok) return
          const tx = await txResp.json()

          // Only include payments that have a text memo (the wish)
          if (tx.memo_type !== 'text' || !tx.memo) return

          wishes.push({
            id: payment.id,
            hash: tx.hash,
            wish: tx.memo,
            amount: parseFloat(payment.amount),
            sender: payment.from,
            createdAt: new Date(tx.created_at),
            ledger: tx.ledger,
          })
        } catch {
          // skip this payment if fetch fails
        }
      })
    )

    // Sort by date descending
    wishes.sort((a, b) => b.createdAt - a.createdAt)
    return wishes
  } catch (e) {
    console.error('Failed to fetch wishes:', e)
    return []
  }
}

export function shortAddress(addr) {
  if (!addr) return ''
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}

export function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}