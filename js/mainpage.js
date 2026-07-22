let elem = document.querySelector("#content")
async function submit() {
	let s = document.querySelector("#user textarea").value;
	console.log(s);
	let u=await chatWithDeepSeek(s, elem)
	console.log(u);
	document.querySelector("#user #okane").innerHTML="预估花费 "+u.estimatedCost+" 元";
}
let ilem = document.querySelector("#secret textarea")
let keys = document.querySelector("#secret input")

async function jia() {
	ilem.value = await encode(ilem.value, parseInt(keys.value))
}

async function jie() {
	ilem.value = await decode(ilem.value, parseInt(keys.value))
}