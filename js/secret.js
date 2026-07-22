// ============================================================
// 安全加密方案：使用 Web Crypto API (AES-GCM)
// 接口保持不变：encode(text, key) 和 decode(encoded, key)
// key: 数字（自动扩展为 256 位安全密钥）
// ============================================================

// -------------------- 工具函数 --------------------

// 将数字 key 转换为 32 字节的 Uint8Array（使用 SHA-256 派生）
async function deriveKeyFromNumber(keyNum) {
    // 将数字转为字节数组（确保 64 位整数精度）
    const bigInt = BigInt(keyNum);
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        bytes[7 - i] = Number((bigInt >> BigInt(i * 8)) & BigInt(0xFF));
    }
    
    // 使用 SHA-256 派生固定长度的密钥
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return new Uint8Array(hashBuffer);
}

// Uint8Array 转 Base64（URL 安全版本，避免 +/ 干扰）
function uint8ArrayToBase64(arr) {
    let binary = '';
    for (let i = 0; i < arr.length; i++) {
        binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

// Base64 转 Uint8Array
function base64ToUint8Array(base64) {
    // 恢复标准 Base64
    let standard = base64.replace(/-/g, '+').replace(/_/g, '/');
    // 补充 padding
    while (standard.length % 4) {
        standard += '=';
    }
    const binary = atob(standard);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        arr[i] = binary.charCodeAt(i);
    }
    return arr;
}

// -------------------- 核心加密/解密函数 --------------------

/**
 * 将文本加密为安全的 Base64 字符串
 * @param {string} text - 要加密的明文
 * @param {number} key - 数字密钥（任意整数，会自动扩展为 256 位）
 * @returns {string} 加密后的 Base64 字符串（包含 iv + 密文）
 */
async function encode(text, key) {
    try {
        // 1. 将文本转为 UTF-8 字节数组
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        
        // 2. 从数字派生 AES 密钥
        const keyBytes = await deriveKeyFromNumber(key);
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'AES-GCM' },
            false,
            ['encrypt']
        );
        
        // 3. 生成随机 IV（12 字节，GCM 推荐）
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // 4. 加密数据
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv,
                tagLength: 128  // 128 位认证标签
            },
            cryptoKey,
            data
        );
        
        // 5. 合并 IV + 密文（便于传输）
        const encryptedArray = new Uint8Array(encrypted);
        const result = new Uint8Array(iv.length + encryptedArray.length);
        result.set(iv, 0);
        result.set(encryptedArray, iv.length);
        
        // 6. 转为 Base64 返回
        return uint8ArrayToBase64(result);
    } catch (e) {
        console.error('加密失败:', e);
        throw new Error('加密失败，请检查密钥是否正确');
    }
}

/**
 * 解密安全的 Base64 字符串还原为原文
 * @param {string} encoded - 加密后的 Base64 字符串
 * @param {number} key - 数字密钥（必须与加密时一致）
 * @returns {string} 解密后的原文，失败返回错误信息
 */
async function decode(encoded, key) {
    try {
        // 1. Base64 解码
        const combined = base64ToUint8Array(encoded);
        
        // 2. 提取 IV（前 12 字节）和密文
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        
        // 3. 从数字派生 AES 密钥
        const keyBytes = await deriveKeyFromNumber(key);
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            { name: 'AES-GCM' },
            false,
            ['decrypt']
        );
        
        // 4. 解密数据
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
                tagLength: 128
            },
            cryptoKey,
            ciphertext
        );
        
        // 5. 转为文本
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (e) {
        // 返回友好错误信息（保持与原接口一致）
        return '解密失败，请检查密钥或密文是否正确';
    }
}