// export const WELL_ADDRESS = 'GAP2OWZUEIGKFT2XJPYLLWH3QSGC65DZROVGGEHM3ZBSUZQZXRLUONGC'
// export const MIN_AMOUNT = '0.1'
// export const MAX_WISH_LENGTH = 100

// const HORIZON = 'https://horizon-testnet.stellar.org'
// const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'

// export async function buildWishTransaction({ senderPublicKey, amountXLM, wishText }) {
//   const StellarSdk = await import('@stellar/stellar-sdk')
//   const server = new StellarSdk.Horizon.Server(HORIZON)

//   let sourceAccount
//   try {
//     sourceAccount = await server.loadAccount(senderPublicKey)
//   } catch (e) {
//     if (e?.response?.status === 404 || e?.message?.includes('Not Found')) {
//       throw new Error('Account not found on testnet. Fund it at https://friendbot.stellar.org')
//     }
//     throw e
//   }

//   const memoText = wishText.substring(0, 28)

//   const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
//     fee: StellarSdk.BASE_FEE,
//     networkPassphrase: NETWORK_PASSPHRASE,
//   })
//     .addOperation(
//       StellarSdk.Operation.payment({
//         destination: WELL_ADDRESS,
//         asset: StellarSdk.Asset.native(),
//         amount: amountXLM.toString(),
//       })
//     )
//     .addMemo(StellarSdk.Memo.text(memoText))
//     .setTimeout(180)
//     .build()

//   return transaction.toXDR()
// }

// export async function fetchWishes() {
//   try {
//     // Use /payments endpoint — returns payment ops with amount directly
//     // Join with transaction to get the memo
//     const paymentsResp = await fetch(
//       `${HORIZON}/accounts/${WELL_ADDRESS}/payments?limit=100&order=desc&include_failed=false`
//     )
//     if (!paymentsResp.ok) return []
//     const paymentsData = await paymentsResp.json()

//     const records = paymentsData._embedded?.records || []

//     // Filter only incoming native XLM payments
//     const incoming = records.filter(
//       r => r.type === 'payment' && r.asset_type === 'native' && r.to === WELL_ADDRESS
//     )

//     // Fetch the transaction for each payment to get the memo
//     const wishes = []
//     await Promise.all(
//       incoming.map(async (payment) => {
//         try {
//           const txResp = await fetch(payment._links.transaction.href)
//           if (!txResp.ok) return
//           const tx = await txResp.json()

//           // Only include payments that have a text memo (the wish)
//           if (tx.memo_type !== 'text' || !tx.memo) return

//           wishes.push({
//             id: payment.id,
//             hash: tx.hash,
//             wish: tx.memo,
//             amount: parseFloat(payment.amount),
//             sender: payment.from,
//             createdAt: new Date(tx.created_at),
//             ledger: tx.ledger,
//           })
//         } catch {
//           // skip this payment if fetch fails
//         }
//       })
//     )

//     // Sort by date descending
//     wishes.sort((a, b) => b.createdAt - a.createdAt)
//     return wishes
//   } catch (e) {
//     console.error('Failed to fetch wishes:', e)
//     return []
//   }
// }

// export function shortAddress(addr) {
//   if (!addr) return ''
//   return `${addr.slice(0, 4)}…${addr.slice(-4)}`
// }

// export function timeAgo(date) {
//   const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
//   if (seconds < 60) return 'just now'
//   const minutes = Math.floor(seconds / 60)
//   if (minutes < 60) return `${minutes}m ago`
//   const hours = Math.floor(minutes / 60)
//   if (hours < 24) return `${hours}h ago`
//   return `${Math.floor(hours / 24)}d ago`
// }

import { Buffer } from 'buffer'

export const WELL_ADDRESS = 'GAP2OWZUEIGKFT2XJPYLLWH3QSGC65DZROVGGEHM3ZBSUZQZXRLUONGC'
export const MIN_AMOUNT = '0.1'
export const MAX_WISH_LENGTH = 100

const HORIZON = 'https://horizon-testnet.stellar.org'
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'

// Split wish text into 64-byte chunks for manage_data operations
function chunkWish(text) {
  const encoded = new TextEncoder().encode(text)
  const chunks = []
  for (let i = 0; i < encoded.length; i += 64) {
    chunks.push(encoded.slice(i, i + 64))
  }
  return chunks
}

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

  const chunks = chunkWish(wishText.trim())
  const txBuilder = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })

  // Payment operation (the XLM offering)
  txBuilder.addOperation(
    StellarSdk.Operation.payment({
      destination: WELL_ADDRESS,
      asset: StellarSdk.Asset.native(),
      amount: amountXLM.toString(),
    })
  )

  // Store wish chunks as manage_data on sender's account
  // Key: "wish_0", "wish_1", etc. — Value: chunk of wish text (up to 64 bytes)
  chunks.forEach((chunk, i) => {
    txBuilder.addOperation(
      StellarSdk.Operation.manageData({
        name: `wish_${i}`,
        value: Buffer.from(chunk),
      })
    )
  })

  // Store chunk count so we know how many to read back
  txBuilder.addOperation(
    StellarSdk.Operation.manageData({
      name: 'wish_n',
      value: Buffer.from(String(chunks.length)),
    })
  )

  // Still add a short memo for quick display fallback
  txBuilder.addMemo(StellarSdk.Memo.text(wishText.substring(0, 28)))

  const transaction = txBuilder.setTimeout(180).build()
  return transaction.toXDR()
}

export async function fetchWishes() {
  try {
    const paymentsResp = await fetch(
      `${HORIZON}/accounts/${WELL_ADDRESS}/payments?limit=100&order=desc&include_failed=false`
    )
    if (!paymentsResp.ok) return []
    const paymentsData = await paymentsResp.json()
    const records = paymentsData._embedded?.records || []

    const incoming = records.filter(
      r => r.type === 'payment' && r.asset_type === 'native' && r.to === WELL_ADDRESS
    )

    const wishes = []
    await Promise.all(
      incoming.map(async (payment) => {
        try {
          const txResp = await fetch(payment._links.transaction.href)
          if (!txResp.ok) return
          const tx = await txResp.json()
          // Validating if it's a wish transaction: either has a memo or manage_data operations.
          // We will fetch operations regardless now to check for manage_data.

          // Fetch full transaction operations to read manage_data entries
          const opsResp = await fetch(`${HORIZON}/transactions/${tx.hash}/operations`)
          if (!opsResp.ok) return
          const opsData = await opsResp.json()
          const ops = opsData._embedded?.records || []

          // Collect wish chunks from manage_data operations
          const chunks = {}
          let totalChunks = 0

          ops.forEach(op => {
            if (op.type === 'manage_data') {
              if (op.name === 'wish_n') {
                totalChunks = parseInt(atob(op.value), 10)
              } else if (op.name?.startsWith('wish_')) {
                const idx = parseInt(op.name.split('_')[1], 10)
                if (!isNaN(idx)) {
                  // value is base64 encoded by Horizon
                  chunks[idx] = new TextDecoder().decode(
                    Uint8Array.from(atob(op.value), c => c.charCodeAt(0))
                  )
                }
              }
            }
          })

          // Reconstruct full wish text from chunks
          let fullWish = ''
          if (totalChunks > 0) {
            for (let i = 0; i < totalChunks; i++) {
              fullWish += chunks[i] || ''
            }
          } else {
            // Fallback to memo for old wishes
            fullWish = tx.memo || ''
          }

          if (!fullWish) return

          wishes.push({
            id: payment.id,
            hash: tx.hash,
            wish: fullWish,
            amount: parseFloat(payment.amount),
            sender: payment.from,
            createdAt: new Date(tx.created_at),
            ledger: tx.ledger,
          })
        } catch {
          // skip
        }
      })
    )

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