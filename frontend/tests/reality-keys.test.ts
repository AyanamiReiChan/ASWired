import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import test from 'node:test';
import { deriveRealityPublicKey, generateRealityKeyPair, generateRealityShortId } from '../src/lib/reality-keys.ts';

function hexKey(hex: string): string {
	return Buffer.from(hex, 'hex').toString('base64url');
}

test('public key derivation matches both RFC 7748 section 6.1 test vectors', async () => {

	const vectors = [
		{
			privateKey: '77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a',
			publicKey: '8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a'
		},
		{
			privateKey: '5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb',
			publicKey: 'de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f'
		}
	];
	for (const vector of vectors) {
		assert.equal(await deriveRealityPublicKey(hexKey(vector.privateKey)), hexKey(vector.publicKey));
	}
});

test('generated raw key pair agrees with derivation and independent Node key import/export', async () => {
	const pair = await generateRealityKeyPair();
	for (const key of [pair.privateKey, pair.publicKey]) {
		assert.match(key, /^[A-Za-z0-9_-]{43}$/);
		assert.equal(Buffer.from(key, 'base64url').length, 32);
		assert.equal(Buffer.from(key, 'base64url').toString('base64url'), key);
	}
	assert.equal(await deriveRealityPublicKey(pair.privateKey), pair.publicKey);
	const nodePrivateKey = createPrivateKey({
		key: { kty: 'OKP', crv: 'X25519', d: pair.privateKey, x: pair.publicKey },
		format: 'jwk'
	});
	assert.equal(createPublicKey(nodePrivateKey).export({ format: 'jwk' }).x, pair.publicKey);
});

test('rejects malformed and noncanonical private keys with a readable error', async () => {
	const valid = hexKey('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
	const canonicalZeros = 'A'.repeat(43);
	const invalidKeys = [
		'', 'example-private-key', valid + '=', valid.slice(1), valid + 'A',
		' ' + valid, valid + '\n', '/' + valid.slice(1), '+' + valid.slice(1),
		canonicalZeros.slice(0, -1) + 'B'
	];
	for (const key of invalidKeys) {
		await assert.rejects(deriveRealityPublicKey(key), /Reality 密钥必须是 32 字节的 Base64URL/);
	}
});

test('short IDs contain exactly eight random bytes in lowercase hex', () => {
	for (let i = 0; i < 16; i++) {
		const shortId = generateRealityShortId();
		assert.match(shortId, /^[0-9a-f]{16}$/);
		assert.equal(Buffer.from(shortId, 'hex').length, 8);
	}
});
