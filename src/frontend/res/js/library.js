async function libraryElementCtxMenu(i, element){
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
        console.log("view store site", "/store/" + name)
        openSite("/store/" + name)
    }
    else if(i == 2){
        console.log("open folder", filepath)
        const response = await send("/api/games/open", {filepath}, true)
        if(response.status == 1){
            notify("Erfolgreich", response.data, "success")
        }
        else{
            notify("Fehlgeschlagen", response.data, "error")
        }
    }
    else if(i == 3){
        console.log("delete", filepath)
        const response = await send("/api/games/delete", {filepath, name}, true)
        if(response.status == 1){
            notify("Erfolgreich", response.data, "success")

            const res = await get("/api/installs")
            $(".games").get(0).replaceChildren()
            $(".softwares").get(0).replaceChildren()
            if(res.games.length > 0 || res.softwares.length > 0){
                for (let i = 0; i < res.games.length; i++) {
                    const e = res.games[i];
                    createGameLibraryElement(e)
                }
                for (let i = 0; i < res.softwares.length; i++) {
                    const e = res.softwares[i];
                    createSoftwareLibraryElement(e)
                }
                $(".games").children().each(setClick)
                $(".softwares").children().each(setClick)
                updateCtxMenu(".game", "game")
            }
            else{
                $(".filter").remove()
                $(".searchResults").remove()
                $(".games").remove()
                $(".softwares").remove()
                $("padding").append($(document.createElement("p")).css("text-align", "center").html("Keine Spiele oder Softwares installiert."))
            }
        }
        else{
            notify("Fehlgeschlagen", response.data, "error")
        }
    }
}
$(document).ready(async function(){
    const res = await get("/api/installs")
    if(res.games.length > 0 || res.softwares.length > 0){
        for (let i = 0; i < res.games.length; i++) {
            const e = res.games[i];
            createGameLibraryElement(e)
        }
        for (let i = 0; i < res.softwares.length; i++) {
            const e = res.softwares[i];
            createSoftwareLibraryElement(e)
        }
        $(".games").children().each(setClick)
        $(".softwares").children().each(setClick)
        createCtxMenu(".game", "game", `
            <button>Start</button>
            <button>Store Seite</button>
            <button>Ordner Öffnen</button>
            <button>Deinstallieren</button>
        `, libraryElementCtxMenu)
        createCtxMenu(".software", "software", `
            <button>Start</button>
            <button>Store Seite</button>
            <button>Ordner Öffnen</button>
            <button>Deinstallieren</button>
        `, libraryElementCtxMenu)
    }
    else{
        $(".filter").remove()
        $(".searchResults").remove()
        $(".games").remove()
        $(".softwares").remove()
        $("padding").append($(document.createElement("p")).css("text-align", "center").html("Keine Spiele oder Softwares installiert."))
    }
    const searchParams = new URL(location.href).searchParams
    if(searchParams.has("q")){
        $(".searchbar").focus()
        $(".searchbar").val(searchParams.get("q"))
        $(".searchbar").get(0).dispatchEvent(
            new KeyboardEvent('keyup', { key: "enter" })
        )
    }
})
function createGameLibraryElement(product){
    const titleElement = $(document.createElement("h3")).html(product.name)
    const versionElement = $(document.createElement("p")).html(product.version + " " + product.versionLevel)
    const imgElement = $(document.createElement("img")).attr("src", "/api/library/img/" + product.name + "?installationPath=" + product.installationPath).attr("alt", "")
    // const accordion1 = $(document.createElement("div")).addClass("caccordion").html("Description")
    // const accordion2 = $(document.createElement("div")).addClass("caccordion").html("Patch Notes")
    // const accordionPanel1 = $(document.createElement("div")).addClass("cpanel").html(description)
    // const accordionPanel2 = $(document.createElement("div")).addClass("cpanel").html(patchNotes)
    // const accordionContainer1 = $(document.createElement("div")).append(accordion1).append(accordionPanel1)
    // const accordionContainer2 = $(document.createElement("div")).append(accordion2).append(accordionPanel2)
    const gameContainer = $(document.createElement("div")).addClass("game").append(titleElement).append(versionElement).append(imgElement).attr("name", product.name).attr("filepath", product.start)
    $(".games").append(gameContainer)
}
function createSoftwareLibraryElement(product){
    const titleElement = $(document.createElement("h3")).html(product.name)
    const versionElement = $(document.createElement("p")).html(product.version + " " + product.versionLevel)
    // const accordion1 = $(document.createElement("div")).addClass("caccordion").html("Description")
    // const accordion2 = $(document.createElement("div")).addClass("caccordion").html("Patch Notes")
    // const accordionPanel1 = $(document.createElement("div")).addClass("cpanel").html(description)
    // const accordionPanel2 = $(document.createElement("div")).addClass("cpanel").html(patchNotes)
    // const accordionContainer1 = $(document.createElement("div")).append(accordion1).append(accordionPanel1)
    // const accordionContainer2 = $(document.createElement("div")).append(accordion2).append(accordionPanel2)
    const gameContainer = $(document.createElement("div")).addClass("software").append(titleElement).append(versionElement).attr("name", product.name).attr("filepath", product.start)
    $(".softwares").append(gameContainer)
}
// function getPatchNotes(notes, depth){
//     let result = ""
//     for (let i = 0; i < depth; i++) {
//         const element = notes[i]
//         if(!element) continue
//         result += element.version
//         result += "<br>"
//         result += element.notes.replaceAll("\n", "<br>")
//         result += "<br><br>"
//     }
//     return result
// }
$("#filter-all").click(function(){
    $(".games").css("display", "flex")
    $(".softwares").css("display", "flex")
    $("#filter-games").removeClass("marked")
    $("#filter-softwares").removeClass("marked")
    $("#filter-all").addClass("marked")
    $(".searchbar").val("")
    $(".searchResults").get(0).replaceChildren()
    $(".searchResults").css("display", "none")
})
$("#filter-games").click(function(){
    $(".games").css("display", "flex")
    $(".softwares").css("display", "none")
    $("#filter-games").addClass("marked")
    $("#filter-softwares").removeClass("marked")
    $("#filter-all").removeClass("marked")
    $(".searchbar").val("")
    $(".searchResults").get(0).replaceChildren()
    $(".searchResults").css("display", "none")
})
$("#filter-softwares").click(function(){
    $(".softwares").css("display", "flex")
    $(".games").css("display", "none")
    $("#filter-softwares").addClass("marked")
    $("#filter-games").removeClass("marked")
    $("#filter-all").removeClass("marked")
    $(".searchbar").val("")
    $(".searchResults").get(0).replaceChildren()
    $(".searchResults").css("display", "none")
})
function setClick(i, element){
    element.addEventListener("click", async function(e){
        const filepath = e.target.getAttribute("filepath")
        const name = e.target.getAttribute("name")
        console.log("start", filepath)
        const response = await send("/api/games/start", {filepath, name}, true)
        if(response.status == 1){
            notify("Erfolgreich", response.data, "success")
        }
        else{
            notify("Fehlgeschlagen", response.data, "error")
        }
    })
}
$(".searchbar").keyup(function(){
    const search = $(".searchbar").val().toLowerCase()
    if(!/\S/.test(search)){
        $(".searchResults").css("display", "none")
        $(".games").css("display", "flex")
        $(".softwares").css("display", "flex")

        $(".searchResults").get(0).replaceChildren()
        $("#filter-all").addClass("marked")
        $("#filter-games").removeClass("marked")
        $("#filter-softwares").removeClass("marked")
        return
    }
    $(".searchResults").css("display", "flex")
    $(".games").css("display", "none")
    $(".softwares").css("display", "none")
    $("#filter-all").removeClass("marked")
    $("#filter-games").removeClass("marked")
    $("#filter-softwares").removeClass("marked")

    $(".searchResults").get(0).replaceChildren()
    $(".games").children().each(addToSearchResults)
    $(".softwares").children().each(addToSearchResults)
    function addToSearchResults(i, element){
        if(element.getAttribute("name").toLowerCase().includes(search)){
            const clone = $(element).clone(true, true)
            $(".searchResults").append(clone)
        }
    }
    $(".searchResults").children().each(setClick)
})