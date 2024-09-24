$(document).ready(async function(){
    const res = await get("/patch-notes")
    console.log("patch notes", res)
    $("#output").html(res)
})