let activeDeepSeekController = null;

function stopDeepSeekRequest() {
    if (activeDeepSeekController) {
        activeDeepSeekController.abort();
        return true;
    }
    return false;
}

function getDeepSeekPricing() {
    const now = new Date();
    const beijingHour = (now.getUTCHours() + 8) % 24;
    const weekday = now.getUTCDay();
    const isPeak = weekday >= 1 && weekday <= 5 &&
        ((beijingHour >= 9 && beijingHour < 12) || (beijingHour >= 14 && beijingHour < 18));

    return {
        inputCached: isPeak ? 0.10 : 0.05,
        inputUncached: isPeak ? 3.00 : 1.50,
        output: isPeak ? 9.00 : 4.50,
        period: isPeak ? '高峰时段' : '空闲时段'
    };
}

function estimateTokenCount(text) {
    if (!text) return 0;
    const chineseCharacters = (text.match(/[\u3400-\u9fff]/g) || []).length;
    const otherCharacters = text.length - chineseCharacters;
    return Math.ceil(chineseCharacters / 1.5 + otherCharacters / 4);
}

function estimateDeepSeekCost(inputTokens, outputTokens) {
    const pricing = getDeepSeekPricing();
    return (inputTokens / 1000000) * pricing.inputUncached +
        (outputTokens / 1000000) * pricing.output;
}

function getDeepSeekUsageCost(usage) {
    const pricing = getDeepSeekPricing();
    const promptTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;
    const cachedTokens = usage.prompt_cache_hit_tokens || 0;
    const uncachedTokens = usage.prompt_cache_miss_tokens ?? Math.max(promptTokens - cachedTokens, 0);

    return (cachedTokens / 1000000) * pricing.inputCached +
        (uncachedTokens / 1000000) * pricing.inputUncached +
        (outputTokens / 1000000) * pricing.output;
}

async function chatWithDeepSeek(content, outputElement, options = {}) {
    const API_KEY = options.apiKey || await decode('oOXxuSTHBjgCZvSqEwMq3gD1xdXue_ydOjVwrgFAFlY0Vol7reSpQQGI9vux3_kHjYcDvuqN-lCMR8X8beiy', secret);
    const BASE_URL = 'https://api.deepseek.com';
    const model = options.model?.trim() || 'deepseek-flash';

    const messages = [
        { role: "system", content: options.systemPrompt || "" },
        { role: "user", content: content }
    ];

    const inputTokensEstimate = estimateTokenCount(messages.map(message => message.content).join('\n'));
    const requestBody = {
        model: model,
        messages: messages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: options.maxTokens || 16000,
        temperature: options.temperature || 0.7,
        extra_body: { "thinking": { "type": "disabled" } }
    };

    const controller = new AbortController();
    activeDeepSeekController = controller;
    const reportProgress = (status, outputTokens = 0, costOverride = null) => {
        if (typeof options.onProgress === 'function') {
            options.onProgress({
                status,
                inputTokens: inputTokensEstimate,
                outputTokens,
                estimatedCost: costOverride ?? estimateDeepSeekCost(inputTokensEstimate, outputTokens),
                pricing: getDeepSeekPricing()
            });
        }
    };

    try {
        reportProgress('正在连接 DeepSeek API...');
        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            signal: controller.signal,
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

        reportProgress('请求已连接，等待模型输出...');
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

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
                        reportProgress(`正在生成回复，已接收约 ${estimateTokenCount(fullContent)} tokens...`, estimateTokenCount(fullContent));
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

        const outputTokens = usage?.completion_tokens || estimateTokenCount(fullContent);
        const estimatedCost = usage
            ? getDeepSeekUsageCost(usage)
            : estimateDeepSeekCost(inputTokensEstimate, outputTokens);
        reportProgress('回复完成', outputTokens, estimatedCost);

        return {
            success: true,
            content: fullContent,
            usage: usage,
            estimatedCost
        };

    } catch (error) {
        if (error.name === 'AbortError') {
            reportProgress('已停止请求');
            return { success: false, cancelled: true, error: '请求已停止' };
        }
        outputElement.innerText = `❌ 网络错误：${error.message || '请检查网络连接'}`;
        return { success: false, error: `请求失败: ${error.message || '网络错误'}` };
    } finally {
        if (activeDeepSeekController === controller) {
            activeDeepSeekController = null;
        }
    }
}

window.addEventListener('pagehide', stopDeepSeekRequest);