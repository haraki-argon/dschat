let elem = document.querySelector("#content")
let isSubmitting = false;
let statusAnimationTimer = null;
let latestProgress = null;
let statusDots = 1;
let requestStartedAt = 0;
let waitTimer = null;
let submissionId = 0;
const waitHistoryKey = 'deepseekWaitDurations';
const personNamesKey = 'deepseekPersonNames';
const dialogueFontKey = 'deepseekDialogueFont';
let latestGeneratedContent = '';

const personNamesInput = document.querySelector("#personNames");
const dialogueFontInput = document.querySelector("#dialogueFont");

personNamesInput.value = localStorage.getItem(personNamesKey) || '';
dialogueFontInput.value = localStorage.getItem(dialogueFontKey) || '';

personNamesInput.addEventListener('input', () => {
	localStorage.setItem(personNamesKey, personNamesInput.value);
	renderFormattedContent(latestGeneratedContent);
});

dialogueFontInput.addEventListener('input', () => {
	localStorage.setItem(dialogueFontKey, dialogueFontInput.value);
	renderFormattedContent(latestGeneratedContent);
});

function escapeRegExp(text) {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hexToRgba(hex, alpha) {
	let value = hex.replace('#', '');
	if (value.length === 3) {
		value = value.split('').map(character => character + character).join('');
	}
	let red = parseInt(value.slice(0, 2), 16);
	let green = parseInt(value.slice(2, 4), 16);
	let blue = parseInt(value.slice(4, 6), 16);
	return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function appendNameHighlights(container, text) {
	let names = [...new Set(
		personNamesInput.value.split(',')
			.map(name => name.trim())
			.filter(Boolean)
	)].sort((a, b) => b.length - a.length);

	if (!names.length) {
		container.appendChild(document.createTextNode(text));
		return;
	}

	let pattern = new RegExp(names.map(escapeRegExp).join('|'), 'g');
	let lastIndex = 0;
	let match;
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) {
			container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
		}
		let mark = document.createElement('mark');
		let nameIndex = names.indexOf(match[0]);
		let colors = ['#ffdb65', '#92fbd4', '#97cbff', '#ffb3da', '#cc99ff', '#ffb98a'];
		mark.className = 'person-highlight';
		let highlightColor = colors[nameIndex % colors.length];
		mark.style.background = `linear-gradient(to bottom, transparent 78%, ${hexToRgba(highlightColor, 0.34)} 78%, ${hexToRgba(highlightColor, 0.34)} 100%)`;
		mark.textContent = match[0];
		container.appendChild(mark);
		lastIndex = pattern.lastIndex;
	}
	if (lastIndex < text.length) {
		container.appendChild(document.createTextNode(text.slice(lastIndex)));
	}
}

function renderFormattedContent(text) {
	latestGeneratedContent = text || '';
	elem.replaceChildren();
	elem.scrollTop = elem.scrollHeight;
	if (!latestGeneratedContent) return;

	let dialoguePattern = /[“][^”]*[”]|[「][^」]*[」]/g;
	let lastIndex = 0;
	let match;
	while ((match = dialoguePattern.exec(latestGeneratedContent)) !== null) {
		if (match.index > lastIndex) {
			appendNameHighlights(elem, latestGeneratedContent.slice(lastIndex, match.index));
		}
		let dialogue = document.createElement('span');
		dialogue.className = 'dialogue-highlight';
		if (dialogueFontInput.value.trim()) {
			dialogue.style.fontFamily = dialogueFontInput.value.trim();
		}
		appendNameHighlights(dialogue, match[0]);
		elem.appendChild(dialogue);
		lastIndex = dialoguePattern.lastIndex;
	}
	if (lastIndex < latestGeneratedContent.length) {
		appendNameHighlights(elem, latestGeneratedContent.slice(lastIndex));
	}
}

function formatDuration(milliseconds) {
	let seconds = Math.max(0, milliseconds / 1000);
	return seconds < 60 ? `${seconds.toFixed(1)} 秒` : `${Math.floor(seconds / 60)} 分 ${(seconds % 60).toFixed(0)} 秒`;
}

function getWaitDurations() {
	try {
		let values = JSON.parse(localStorage.getItem(waitHistoryKey) || '[]');
		return Array.isArray(values) ? values.filter(value => Number.isFinite(value) && value >= 0) : [];
	} catch (error) {
		return [];
	}
}

function renderWaitHistory() {
	let values = getWaitDurations();
	let history = document.querySelector("#waitHistory");
	if (!values.length) {
		history.textContent = '历史首个有效文本：暂无数据';
		return;
	}
	let sorted = [...values].sort((a, b) => a - b);
	let percentileIndex = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.75) - 1);
	let average = values.reduce((sum, value) => sum + value, 0) / values.length;
	history.textContent =
		`历史首个有效文本（${values.length} 次）：平均 ${formatDuration(average)}，最长 ${formatDuration(sorted[sorted.length - 1])}，75 分位 ${formatDuration(sorted[percentileIndex])}`;
}

function updateWaitTimer() {
	if (!requestStartedAt) return;
	document.querySelector("#waitTimer").textContent = `本次已等待 ${formatDuration(Date.now() - requestStartedAt)}`;
}

function startWaitTimer() {
	requestStartedAt = Date.now();
	updateWaitTimer();
	clearInterval(waitTimer);
	waitTimer = setInterval(updateWaitTimer, 100);
}

function stopWaitTimer(recordDuration) {
	let elapsed = requestStartedAt ? Date.now() - requestStartedAt : 0;
	if (requestStartedAt && recordDuration) {
		let values = getWaitDurations();
		values.push(elapsed);
		localStorage.setItem(waitHistoryKey, JSON.stringify(values.slice(-100)));
	}
	clearInterval(waitTimer);
	waitTimer = null;
	if (requestStartedAt) {
		document.querySelector("#waitTimer").textContent = `本次已等待 ${formatDuration(elapsed)}`;
	}
	requestStartedAt = 0;
	renderWaitHistory();
}

renderWaitHistory();

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
		stopWaitTimer(false);
		stopStatusAnimation();
		submissionId++;
		isSubmitting = false;
		button.textContent = "提交";
		updateRequestStatus({ status: '已停止本次请求', inputTokens: latestProgress?.inputTokens || 0, outputTokens: latestProgress?.outputTokens || 0, estimatedCost: latestProgress?.estimatedCost || 0 });
		return;
	}

	let s = document.querySelector("#user textarea").value;
	let model = document.querySelector("#modelInput").value;
	const currentSubmissionId = ++submissionId;
	isSubmitting = true;
	button.textContent = "停止生成";
	renderFormattedContent('');
	startWaitTimer();
	startStatusAnimation();
	updateRequestStatus({ status: '已点击提交，正在请求...', inputTokens: 0, outputTokens: 0, estimatedCost: 0 });

	let firstTextReceivedAt = 0;
	let u = await chatWithDeepSeek(s, elem, {
		model: model,
		onContentUpdate: (text) => {
			if (currentSubmissionId === submissionId) {
				renderFormattedContent(text);
			}
		},
		onProgress: (progress) => {
			if (currentSubmissionId !== submissionId) return;
			if (!firstTextReceivedAt && progress.hasContent) {
				firstTextReceivedAt = Date.now();
				stopWaitTimer(true);
			}
			updateRequestStatus(progress);
		}
	});
	if (currentSubmissionId !== submissionId) return;
	stopWaitTimer(false);
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