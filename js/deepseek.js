/**
 * 调用DeepSeek API（流式输出，逐字显示到DOM）
 * @param {string} content - 用户输入的内容
 * @param {HTMLElement} outputElement - 输出的DOM元素（使用innerText）
 * @param {Object} options - 可选配置
 * @param {string} options.apiKey - API Key，默认从环境变量读取
 * @param {string} options.systemPrompt - 系统提示词
 * @param {number} options.maxTokens - 最大生成token数，默认4096
 * @param {number} options.temperature - 温度参数，默认0.7
 * @returns {Promise<Object>} - 返回 { success: boolean, content: string, error: string, usage: Object }
 */
async function chatWithDeepSeek(content, outputElement, options = {}) {
	// ========== 配置 ==========
	const API_KEY = options.apiKey || decode('PDt8ZjExYjRkOW5qbW4+amdXBFpWUwZVVV4KC19aC1cOQUY=', secret);
	const BASE_URL = 'https://api.deepseek.com';

	// ========== 准备消息 ==========
	const messages = [{
			role: "system",
			content: options.systemPrompt || "You are a helpful assistant"
		},
		{
			role: "user",
			content: content
		}
	];

	// ========== 发起请求（最便宜配置） ==========
	const requestBody = {
		model: 'deepseek-v4-flash', // 最便宜
		messages: messages,
		stream: true, // 流式输出
		max_tokens: options.maxTokens || 4096,
		temperature: options.temperature || 0.7,
		//thinking: {type: "disabled"}
		// 不传 thinking = 不思考（最便宜）
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

		// ========== 错误处理 ==========
		if (!response.ok) {
			const errorData = await response.json();
			const errorMsg = errorData.error?.message || '未知错误';
			outputElement.innerText = `❌ 错误：${errorMsg}`;
			return {
				success: false,
				error: `API错误 (${response.status}): ${errorMsg}`
			};
		}

		// ========== 处理流式响应 ==========
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let fullContent = '';
		let usage = null;

		// 清空输出元素，准备显示
		outputElement.innerText = '';

		while (true) {
			const {
				done,
				value
			} = await reader.read();
			if (done) break;

			// 解码数据
			const chunk = decoder.decode(value);
			const lines = chunk.split('\n').filter(line => line.trim() !== '');

			for (const line of lines) {
				if (line.startsWith(':') || !line.startsWith('data: ')) continue;

				const data = line.slice(6); // 去掉 "data: " 前缀

				// 流结束
				if (data === '[DONE]') continue;

				try {
					const json = JSON.parse(data);

					// 提取内容增量
					const delta = json.choices?.[0]?.delta?.content;
					if (delta) {
						fullContent += delta;
						// 实时更新DOM（逐字显示）
						outputElement.innerText = fullContent;
						// 自动滚动到底部（如果有滚动条）
						outputElement.scrollTop = outputElement.scrollHeight;
					}

					// 提取token用量
					if (json.usage) {
						usage = json.usage;
					}
				} catch (e) {
					// 忽略解析错误
				}
			}
		}

		// ========== 返回结果 ==========
		return {
			success: true,
			content: fullContent,
			usage: usage,
			// 费用估算（flash输出价格：2元/百万tokens）
			estimatedCost: usage ? (usage.total_tokens / 1000000) * 2 : null
		};

	} catch (error) {
		// 网络错误
		outputElement.innerText = `❌ 网络错误：${error.message || '请检查网络连接'}`;
		return {
			success: false,
			error: `请求失败: ${error.message || '网络错误'}`
		};
	}
}