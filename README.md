# ✦ XLM Wishing Well

Cast your wish onto the Stellar blockchain — permanently, for the price of a coin.

## What it does

Users connect their **Freighter wallet**, type a wish (up to 100 chars), choose an XLM amount (min 0.1 XLM), and submit. The wish is stored as a **Stellar transaction memo** on-chain. All wishes are displayed on a public wall, sortable by top contributors or most recent.

## Tech stack

- **React + Vite** — frontend
- **Freighter API** — wallet connection & transaction signing
- **Stellar SDK** — transaction building (payment + memo)
- **Stellar Horizon** — fetching wishes from blockchain

## Setup

```bash
npm install
npm run dev
```

## ⚠️ Important: Set your well address

In `src/stellar.js`, replace `WELL_ADDRESS` with **your own Stellar public key**. This is the address that receives all XLM offerings.

```js
export const WELL_ADDRESS = 'YOUR_STELLAR_PUBLIC_KEY_HERE'
```

Generate a Stellar keypair at https://stellar.org/laboratory

## How wishes work

1. User types a wish + selects XLM amount
2. App builds a Stellar payment transaction with the wish as a **text memo** (first 28 chars — Stellar's limit)
3. Freighter signs and submits to the Public Stellar Network
4. The wish lives on-chain forever
5. The wishes wall reads all transactions sent to `WELL_ADDRESS` via Horizon API

## Freighter Wallet

Install from https://www.freighter.app/

## Deploy

```bash
npm run build
# Deploy /dist to Vercel, Netlify, Cloudflare Pages, etc.
```

