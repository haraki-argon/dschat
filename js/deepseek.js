async function chatWithDeepSeek(content, outputElement, options = {}) {
    const API_KEY = options.apiKey || await decode('oOXxuSTHBjgCZvSqEwMq3gD1xdXue_ydOjVwrgFAFlY0Vol7reSpQQGI9vux3_kHjYcDvuqN-lCMR8X8beiy', secret);
    const BASE_URL = 'https://api.deepseek.com';

    const messages = [
        { role: "system", content: options.systemPrompt || "中文涩涩小说写作，禁用Markdown" },
        { role: "user", content: content }
    ];

    const requestBody = {
        model: 'deepseek-v4-flash',
        messages: messages,
        stream: true,
        max_tokens: options.maxTokens || 16000,
        temperature: options.temperature || 0.7,
    };

    try {
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            const errorMsg = errorData.error?.message || '未知错误';
            outputElement.innerText = `❌ 错误：${errorMsg}`;
            return { success: false, error: `API错误 (${response.status}): ${errorMsg}` };
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let usage = null;
        let buffer = '';
        let updateTimer = null;
        let pendingUpdate = false;

        // 清空
        outputElement.innerText = '';

        // ====== 核心优化：使用 requestAnimationFrame 批量更新 ======
        function scheduleUpdate() {
            if (pendingUpdate) return;
            pendingUpdate = true;
            
            // 使用 RAF 确保在浏览器下一帧渲染前更新
            if (window.requestAnimationFrame) {
                requestAnimationFrame(() => {
                    outputElement.innerText = fullContent;
                    outputElement.scrollTop = outputElement.scrollHeight;
                    pendingUpdate = false;
                });
            } else {
                // 降级方案：使用 setTimeout
                setTimeout(() => {
                    outputElement.innerText = fullContent;
                    outputElement.scrollTop = outputElement.scrollHeight;
                    pendingUpdate = false;
                }, 50);
            }
        }

        // ====== 可选：使用 DocumentFragment 批量追加 ======
        // 如果内容量特别大，可以改用 appendChild 方式
        // 但 innerText 在移动端更简单，配合 RAF 即可

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith(':') || !line.startsWith('data: ')) continue;
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const json = JSON.parse(data);
                    const delta = json.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        // 不再立即更新，而是调度更新
                        scheduleUpdate();
                    }
                    if (json.usage) {
                        usage = json.usage;
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }

        // 最终确保内容完整显示
        outputElement.innerText = fullContent;
        outputElement.scrollTop = outputElement.scrollHeight;

        return {
            success: true,
            content: fullContent,
            usage: usage,
            estimatedCost: usage ? (usage.total_tokens / 1000000) * 2 : null
        };

    } catch (error) {
        outputElement.innerText = `❌ 网络错误：${error.message || '请检查网络连接'}`;
        return { success: false, error: `请求失败: ${error.message || '网络错误'}` };
    }
}