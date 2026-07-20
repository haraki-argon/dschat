let elem = document.querySelector("#content")
async function submit() {
	let s = document.querySelector("#user textarea").value;
	console.log(s);

	console.log(await chatWithDeepSeek(s, elem));
}
let ilem = document.querySelector("#secret textarea")
let keys = document.querySelector("#secret input")

function jia() {
	ilem.value = encode(ilem.value, parseInt(keys.value))
}

function jie() {
	ilem.value = decode(ilem.value, parseInt(keys.value))
}