$(document).ready(async function(){
    const res = await get("/api/lastplayed")
    console.log(res)
    if(res) {
        const uh2 = $(document.createElement("uh2")).html("Zuletzt Gespielt")
        const h3 = $(document.createElement("h3")).html(res.name)
        const p = $(document.createElement("p")).html(res.versionLevel + " " + res.version)
        const img = $(document.createElement("img")).attr("src", "/api/library/img/" + res.name + "?installationPath=" + res.installationPath).attr("alt", "")
        const paddingDiv = $(document.createElement("div")).addClass("lastPlayedElement").append(h3).append(p).append(img)
        const div = $(document.createElement("div")).attr("name", res.name).attr("filepath", res.start).attr("id", "lastplayed").addClass("ccard").append(uh2).append(paddingDiv).click(async function(){
            const res2 = await send("/api/games/start", {filepath: res.start, name: res.name})
            console.log(res2)
        })
        $(".lastPlayed").prepend(div)
        createCtxMenu("#lastplayed", "lastplayed", `
            <button>Start</button>
            <button>Store Seite</button>
            <button>In Library Ansehen</button>
            <button>Deinstallieren</button>
        `, lastPlayedCtxMenu)
    }
    else console.warn("could not find last played game")
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