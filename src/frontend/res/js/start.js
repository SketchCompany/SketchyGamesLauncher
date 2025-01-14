$(document).ready(async function(){
    const res = await get("/api/lastplayed")
    console.log(res)
    if(res) {
        const uh2 = $(document.createElement("uh2")).html("Zuletzt Gespielt")
        const h3 = $(document.createElement("h3")).html(res.name)
        const p = $(document.createElement("p")).html(res.versionLevel + " " + res.version)
        const img = $(document.createElement("img")).attr("src", "/api/library/img/" + res.name + "?installationPath=" + res.installationPath).attr("alt", "")
        const playButton = $(document.createElement("div")).addClass("play-button").css("opacity", "0").append([
            $(document.createElement("div")).addClass("background"),
            $(document.createElement("p")).addClass(["bi", "bi-play-fill"]).html("<span>START</span>"),
        ])
        const paddingDiv = $(document.createElement("div")).addClass("lastPlayedElement").append([h3, p, img, playButton])
        const div = $(document.createElement("div")).attr("name", res.name).attr("filepath", res.start).attr("id", "lastplayed").addClass(["ccard", "pink-gradient"]).append([uh2, paddingDiv]).click(async function(){
            const res2 = await send("/api/games/start", {filepath: res.start, name: res.name})
            console.log(res2)
        }).mouseenter(function(){
            $(this).find(".play-button").css("opacity", "1")
        }).mouseleave(function(){
            $(this).find(".play-button").css("opacity", "0")
        })

        $(".lastPlayed").prepend(div)
        createCtxMenu("#lastplayed", "lastplayed", `
            <button><span class="bi bi-play-fill"></span> Start</button>
            <button><span class="bi bi-box-arrow-up-left"></span> Store Seite</button>
            <button><span class="bi bi-controller"></span> In Library Ansehen</button>
            <button><span class="bi bi-trash"></span> Deinstallieren</button>
        `, lastPlayedCtxMenu)
    }
    else console.warn("could not find last played game")

    $(".notes").append($(document.createElement("p")).html("Patch Notes werden geladen...").css("text-align", "center").attr("id", "loadingText"))
    const status = await get("/api/connection")
    if(status == 2){
        const res = await get("/api/patch-notes")
        console.log("patch notes", res)
        
        const element = res[0]
        const note = $(document.createElement("div")).addClass("patch-note")
        note.append([element.description])
        $(".notes").append(note)
        $("#loadingText").remove()
    }
    else if(status == 1){
        $(".notes").append($(document.createElement("p")).html("Keine Verbindung zum Server.").css("text-align", "center"))
        $("#loadingText").remove()
    }
    else{
        $(".notes").append($(document.createElement("p")).html("Keine Verbindung zum Internet").css("text-align", "center"))
        $("#loadingText").remove()
    }
})
async function lastPlayedCtxMenu(i, element){
    const filepath = element.getAttribute("filepath")
    const name = element.getAttribute("name")
    if(i == 0){
        console.log("start", filepath)
        const response = await send("/api/games/start", {filepath, name}, true)
        if(response.status == 1){
            notify("Erfolgreich", response.data, "success")
        }
        else{
            notify("Fehlgeschlagen", response.data, "error")
        }
    }
    else if(i == 1){
        openSite("/store/" + name)
    }
    else if(i == 2){
        openSite("/library?q=" + name)
    }
    else if(i == 3){
        $(element).remove()
    }
}