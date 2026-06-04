declare module 'hdkey' {
  interface HDNode {
    privateKey: Buffer | null
    publicKey: Buffer
    chainCode: Buffer
    depth: number
    derive(path: string): HDNode
  }

  interface HDKeyConstructor {
    fromMasterSeed(seed: Buffer): HDNode
    fromJSON(obj: object): HDNode
    new (): HDNode
  }

  const HDKey: HDKeyConstructor
  export = HDKey
}
