const data = {
}
let preelem = document.querySelector("#presets")
let conelem = document.querySelector("#consets")
function load() {
	for (let key in data) {
		let a = document.createElement("button")
		a.innerText = key
		a.addEventListener('click', function () {
			ilem.value = data[key]
		})
		preelem.appendChild(a)
	}
	for (let key in data) {
		let a = document.createElement("button")
		a.innerText = key
		a.addEventListener('click', async function () {
			document.querySelector("#user textarea").value += await decode(data[key], secret)
		})
		conelem.appendChild(a)
	}
}
load();