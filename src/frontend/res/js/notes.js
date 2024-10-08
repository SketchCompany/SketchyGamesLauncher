$(document).ready(async function(){
    const status = await get("/api/connection")
    $(".notes").append($(document.createElement("p")).html("Patch Notes werden geladen...").css("text-align", "center").attr("id", "loadingText"))
    if(status == 2){
        const res = await get("/api/patch-notes")
        console.log("patch notes", res)
        
        for (let i = 0; i < res.length; i++) {
            const element = res[i];
            const note = $(document.createElement("div")).addClass("patch-note")
            note.append([element.description])
            $(".notes").append(note)
        }

        $("#loadingText").remove()
    }
    else if(status == 1){
        $(".notes").append($(document.createElement("p")).html("Keine Verbindung zum Server.").css("text-align", "center"))
    }
    else{
        $(".notes").append($(document.createElement("p")).html("Keine Verbindung zum Internet").css("text-align", "center"))
    }
})