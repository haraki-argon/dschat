let elem = document.querySelector("#content")
let isSubmitting = false;
let statusAnimationTimer = null;
let latestProgress = null;
let statusDots = 1;

function renderRequestStatus() {
	if (!latestProgress) return;
	let progress = latestProgress;
	let pricing = progress.pricing ? `（${progress.pricing.period}）` : '';
	let dots = statusAnimationTimer ? '.'.repeat(statusDots) : '';
	document.querySelector("#requestStatus").textContent =
		`${progress.status}${dots} 输入约 ${progress.inputTokens || 0} tokens，输出约 ${progress.outputTokens || 0} tokens，预估 ${Number(progress.estimatedCost || 0).toFixed(6)} 元 ${pricing}`;
}

function startStatusAnimation() {
	stopStatusAnimation();
	statusDots = 1;
	statusAnimationTimer = setInterval(() => {
		statusDots = statusDots === 3 ? 1 : statusDots + 1;
		renderRequestStatus();
	}, 500);
}

function stopStatusAnimation() {
	if (statusAnimationTimer) {
		clearInterval(statusAnimationTimer);
		statusAnimationTimer = null;
	}
}

function updateRequestStatus(progress) {
	latestProgress = progress;
	renderRequestStatus();
	document.querySelector("#okane").textContent = `预计花费 ${Number(progress.estimatedCost || 0).toFixed(6)} 元`;
}

async function submit() {
	let button = document.querySelector("#submitButton");
	if (isSubmitting) {
		stopDeepSeekRequest();
		return;
	}

	let s = document.querySelector("#user textarea").value;
	let model = document.querySelector("#modelInput").value;
	isSubmitting = true;
	button.textContent = "停止生成";
	elem.textContent = '';
	startStatusAnimation();
	updateRequestStatus({ status: '已点击提交，正在请求...', inputTokens: 0, outputTokens: 0, estimatedCost: 0 });

	let u = await chatWithDeepSeek(s, elem, { model: model, onProgress: updateRequestStatus });
	stopStatusAnimation();
	renderRequestStatus();
	if (u.estimatedCost !== null && u.estimatedCost !== undefined) {
		document.querySelector("#okane").textContent = `预计花费 ${Number(u.estimatedCost).toFixed(6)} 元`;
	}
	if (u.cancelled) {
		document.querySelector("#requestStatus").textContent += '，已保留当前已生成内容';
	}
	button.textContent = "提交";
	isSubmitting = false;
}
let ilem = document.querySelector("#secret textarea")
let keys = document.querySelector("#secret input")

async function jia() {
	ilem.value = await encode(ilem.value, parseInt(keys.value))
}

async function jie() {
	ilem.value = await decode(ilem.value, parseInt(keys.value))
}