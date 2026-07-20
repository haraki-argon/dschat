// 全局变量存储密钥
var secret = '';

// 初始化验证（页面加载时执行）
function initSecrets() {
	// 检查是否已存在密钥
	const stored = localStorage.getItem('secret');
	if (stored) {
		// 已存在：读取并赋值全局变量
		secret = parseInt(stored);
		console.log('已加载密钥');
		document.querySelector("#secret input").value=secret;
	} else {
		// 首次使用：弹出输入框
		showInputDialog();
	}
}

// 弹出输入框并保存到localStorage
function showInputDialog() {
	const input = prompt('请输入秘钥:');
	if (input === null) return;
	// 保存到localStorage
	localStorage.setItem('secret', input);

	// 赋值全局变量
	secret = parseInt(input);

	console.log('密钥已保存');
}

// 页面加载时执行
initSecrets();