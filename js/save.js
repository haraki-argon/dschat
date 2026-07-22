function saveText(text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dseroi${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function save(){
	let s1=document.querySelector("#user textarea").value;
	let s2=document.querySelector("#user #content").innerHTML;
	saveText(s1+"\n——————\n"+s2)
}