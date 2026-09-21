const KEY_LENGTH = 32;
const KEY_ERROR = 'Reality 密钥必须是 32 字节的 Base64URL 字符串（43 个字符，不带等号）。';
const CRYPTO_ERROR = '当前浏览器不支持 X25519 密钥操作，请使用新版浏览器，并通过 HTTPS 或本机地址访问。';

function getSecureCrypto(): Crypto {
	if (!globalThis.crypto?.getRandomValues) {
		throw new Error('当前浏览器无法生成安全随机数，请使用新版浏览器。');
	}
	return globalThis.crypto;
}

function getSubtleCrypto(): SubtleCrypto {
	const subtle = getSecureCrypto().subtle;
	if (!subtle) throw new Error(CRYPTO_ERROR);
	return subtle;
}

function encodeBase64Url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeKey(key: string): Uint8Array<ArrayBuffer> {
	if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(key)) {
		throw new Error(KEY_ERROR);
	}
	const binary = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '=');
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

	if (bytes.length !== KEY_LENGTH || encodeBase64Url(bytes) !== key) {
		throw new Error(KEY_ERROR);
	}
	return bytes;
}

function cryptoOperationError(error: unknown, message: string): Error {
	if (error instanceof Error && error.name === 'NotSupportedError') {
		return new Error(CRYPTO_ERROR);
	}
	return new Error(message);
}


export async function generateRealityKeyPair(): Promise<{ privateKey: string; publicKey: string }> {
	const subtle = getSubtleCrypto();
	try {
		const keys = await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']);
		if (!('privateKey' in keys)) throw new Error('未生成密钥对');
		const [privateJwk, publicBytes] = await Promise.all([
			subtle.exportKey('jwk', keys.privateKey),
			subtle.exportKey('raw', keys.publicKey)
		]);
		if (!privateJwk.d) throw new Error('未导出私钥');
		const privateKey = privateJwk.d;
		const publicKey = encodeBase64Url(new Uint8Array(publicBytes));
		decodeKey(privateKey);
		decodeKey(publicKey);
		return { privateKey, publicKey };
	} catch (error) {
		throw cryptoOperationError(error, 'Reality 密钥生成失败，请重试或更换支持 X25519 的浏览器。');
	}
}


export async function deriveRealityPublicKey(privateKey: string): Promise<string> {
	const rawPrivateKey = decodeKey(privateKey);
	const subtle = getSubtleCrypto();

	const pkcs8 = new Uint8Array(48);
	pkcs8.set([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]);
	pkcs8.set(rawPrivateKey, 16);
	const basePoint = new Uint8Array(KEY_LENGTH);
	basePoint[0] = 9;
	try {
		const [privateCryptoKey, basePointKey] = await Promise.all([
			subtle.importKey('pkcs8', pkcs8, { name: 'X25519' }, false, ['deriveBits']),
			subtle.importKey('raw', basePoint, { name: 'X25519' }, false, [])
		]);
		const publicBytes = await subtle.deriveBits(
			{ name: 'X25519', public: basePointKey }, privateCryptoKey, KEY_LENGTH * 8
		);
		return encodeBase64Url(new Uint8Array(publicBytes));
	} catch (error) {
		throw cryptoOperationError(error, '无法从此 Reality 私钥计算公钥，请检查密钥或更换支持 X25519 的浏览器。');
	} finally {
		rawPrivateKey.fill(0);
		pkcs8.fill(0);
	}
}


export function generateRealityShortId(): string {
	const bytes = getSecureCrypto().getRandomValues(new Uint8Array(8));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
