// 编码函数：将文本转为加密字符串
function encode(text, key) {
	// 1. 将文本转为UTF-8字节数组
	const encoder = new TextEncoder();
	const data = encoder.encode(text);

	// 2. 使用密钥进行异或混淆（每个字节与密钥循环异或）
	const shuffled = new Uint8Array(data.length);
	for (let i = 0; i < data.length; i++) {
		shuffled[i] = data[i] ^ (key + i) & 0xFF; // 加入位置偏移增强混淆
	}

	// 3. 转为二进制字符串
	let binary = '';
	for (let i = 0; i < shuffled.length; i++) {
		binary += String.fromCharCode(shuffled[i]);
	}

	// 4. 使用btoa进行Base64编码（安全传输）
	return btoa(binary);
}

// 解码函数：将加密字符串还原为原文
function decode(encoded, key) {
	try {
		// 1. Base64解码
		const binary = atob(encoded);

		// 2. 转为字节数组
		const data = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			data[i] = binary.charCodeAt(i);
		}

		// 3. 异或解密（与编码时相同操作）
		const decrypted = new Uint8Array(data.length);
		for (let i = 0; i < data.length; i++) {
			decrypted[i] = data[i] ^ (key + i) & 0xFF;
		}

		// 4. 转回文本
		const decoder = new TextDecoder();
		return decoder.decode(decrypted);
	} catch (e) {
		return '解密失败，请检查密钥或密文是否正确';
	}
}