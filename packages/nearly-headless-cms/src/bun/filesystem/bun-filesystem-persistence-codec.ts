const digest = <Bytes extends Uint8Array>(bytes: Readonly<Bytes>): string => {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(bytes);
    return hasher.digest("hex");
  },
  encode = (value: unknown): Uint8Array => new TextEncoder().encode(`${JSON.stringify(value)}\n`);

export { digest, encode };
