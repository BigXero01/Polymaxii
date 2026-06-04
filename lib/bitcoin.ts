import * as bitcoin from 'bitcoinjs-lib'
import * as ecc from 'tiny-secp256k1'
import { ECPairFactory } from 'ecpair'
import { mnemonicToSeed } from 'bip39'
import HDKey from 'hdkey'
import { btcToSats, satsToBtc } from './utils'

bitcoin.initEccLib(ecc)
const ECPair = ECPairFactory(ecc)

const NETWORK = process.env.BTC_NETWORK === 'testnet'
  ? bitcoin.networks.testnet
  : bitcoin.networks.bitcoin

const BLOCKSTREAM_API = process.env.BLOCKSTREAM_API_URL ?? 'https://blockstream.info/api'
const FEE_RATE = parseInt(process.env.BTC_FEE_RATE ?? '10', 10) // sat/vbyte
const MIN_WITHDRAWAL_SATS = parseInt(process.env.BTC_MIN_WITHDRAWAL_SATS ?? '50000', 10)

// P2WPKH input size: ~68 vbytes, output: ~31 vbytes, overhead: ~10 vbytes
function estimateTxSize(inputCount: number, outputCount: number): number {
  return 10 + inputCount * 68 + outputCount * 31
}

export function estimateWithdrawalFee(
  amountBtc: number,
  feeRateSatVbyte = FEE_RATE
): { feeSats: number; feeBtc: number; netAmountBtc: number; vsize: number } {
  const vsize = estimateTxSize(1, 2) // 1 input, 2 outputs (destination + change)
  const feeSats = vsize * feeRateSatVbyte
  const feeBtc = satsToBtc(feeSats)
  return { feeSats, feeBtc, netAmountBtc: amountBtc - feeBtc, vsize }
}

export function validateBTCAddress(address: string): boolean {
  try {
    bitcoin.address.toOutputScript(address, NETWORK)
    return true
  } catch {
    return false
  }
}

interface UTXO {
  txid: string
  vout: number
  value: number // satoshis
  status: { confirmed: boolean }
}

export async function fetchUTXOs(address: string): Promise<UTXO[]> {
  const res = await fetch(`${BLOCKSTREAM_API}/address/${address}/utxo`)
  if (!res.ok) throw new Error(`Failed to fetch UTXOs: ${res.status}`)
  const utxos: UTXO[] = await res.json()
  return utxos.filter(u => u.status.confirmed)
}

export async function fetchTxHex(txid: string): Promise<string> {
  const res = await fetch(`${BLOCKSTREAM_API}/tx/${txid}/hex`)
  if (!res.ok) throw new Error(`Failed to fetch tx hex: ${res.status}`)
  return res.text()
}

export async function broadcastTx(rawTxHex: string): Promise<string> {
  const res = await fetch(`${BLOCKSTREAM_API}/tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: rawTxHex,
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Broadcast failed: ${errText}`)
  }
  return res.text() // returns txid
}

export async function checkTxConfirmations(txid: string): Promise<{
  confirmed: boolean
  confirmations: number
  blockHeight?: number
}> {
  const res = await fetch(`${BLOCKSTREAM_API}/tx/${txid}/status`)
  if (!res.ok) return { confirmed: false, confirmations: 0 }
  const status = await res.json()
  if (!status.confirmed) return { confirmed: false, confirmations: 0 }

  const heightRes = await fetch(`${BLOCKSTREAM_API}/blocks/tip/height`)
  const tipHeight = parseInt(await heightRes.text(), 10)
  const confirmations = status.block_height ? tipHeight - status.block_height + 1 : 0
  return { confirmed: true, confirmations, blockHeight: status.block_height }
}

export async function fetchCurrentFeeRate(): Promise<{
  fastest: number
  halfHour: number
  hour: number
}> {
  try {
    const res = await fetch('https://mempool.space/api/v1/fees/recommended')
    if (!res.ok) return { fastest: FEE_RATE, halfHour: FEE_RATE, hour: FEE_RATE }
    const fees = await res.json()
    return {
      fastest: fees.fastestFee,
      halfHour: fees.halfHourFee,
      hour: fees.hourFee,
    }
  } catch {
    return { fastest: FEE_RATE, halfHour: FEE_RATE, hour: FEE_RATE }
  }
}

export async function buildAndBroadcastWithdrawal(
  destinationAddress: string,
  amountSats: number,
  feeRateSatVbyte = FEE_RATE
): Promise<{ txid: string; feeSats: number; rawHex: string }> {
  if (amountSats < MIN_WITHDRAWAL_SATS) {
    throw new Error(`Amount below minimum (${MIN_WITHDRAWAL_SATS} sats)`)
  }

  if (!validateBTCAddress(destinationAddress)) {
    throw new Error('Invalid Bitcoin address')
  }

  const mnemonic = process.env.BTC_WALLET_MNEMONIC
  if (!mnemonic) throw new Error('Hot wallet not configured')

  // Derive hot wallet keypair (BIP84 P2WPKH)
  const seed = await mnemonicToSeed(mnemonic)
  const root = HDKey.fromMasterSeed(seed)
  const child = root.derive("m/84'/0'/0'/0/0") // BIP84 P2WPKH

  const keyPair = ECPair.fromPrivateKey(child.privateKey!, { network: NETWORK })
  const { address: hotWalletAddress, output: redeemScript } = bitcoin.payments.p2wpkh({
    pubkey: keyPair.publicKey,
    network: NETWORK,
  })

  if (!hotWalletAddress || !redeemScript) {
    throw new Error('Failed to derive hot wallet address')
  }

  // Fetch UTXOs
  const utxos = await fetchUTXOs(hotWalletAddress)
  if (utxos.length === 0) throw new Error('No UTXOs available in hot wallet')

  // Select UTXOs (simple greedy selection)
  const vsize = estimateTxSize(1, 2)
  const feeSats = vsize * feeRateSatVbyte
  const totalNeeded = amountSats + feeSats

  let selectedSats = 0
  const selectedUTXOs: UTXO[] = []
  for (const utxo of utxos.sort((a, b) => b.value - a.value)) {
    selectedUTXOs.push(utxo)
    selectedSats += utxo.value
    if (selectedSats >= totalNeeded) break
  }

  if (selectedSats < totalNeeded) {
    throw new Error(`Insufficient hot wallet balance: have ${selectedSats} sats, need ${totalNeeded}`)
  }

  const changeSats = selectedSats - amountSats - feeSats

  // Build PSBT
  const psbt = new bitcoin.Psbt({ network: NETWORK })

  for (const utxo of selectedUTXOs) {
    psbt.addInput({
      hash: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: redeemScript,
        value: utxo.value,
      },
    })
  }

  psbt.addOutput({
    address: destinationAddress,
    value: amountSats,
  })

  if (changeSats > 546) { // Dust threshold
    psbt.addOutput({
      address: hotWalletAddress,
      value: changeSats,
    })
  }

  // Sign all inputs
  for (let i = 0; i < selectedUTXOs.length; i++) {
    psbt.signInput(i, keyPair)
  }
  psbt.finalizeAllInputs()

  const tx = psbt.extractTransaction()
  const rawHex = tx.toHex()
  const txid = await broadcastTx(rawHex)

  return { txid, feeSats, rawHex }
}
