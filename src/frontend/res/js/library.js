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
            <button><span class="bi bi-play-fill"></span> Start</button>
            <button><span class="bi bi-box-arrow-up-left"></span> Store Seite</button>
            <button><span class="bi bi-folder-symlink"></span> Ordner Öffnen</button>
            <button><span class="bi bi-trash"></span> Deinstallieren</button>
        `, libraryElementCtxMenu)
        createCtxMenu(".software", "software", `
            <button><span class="bi bi-play-fill"></span> Start</button>
            <button><span class="bi bi-box-arrow-up-left"></span> Store Seite</button>
            <button><span class="bi bi-folder-symlink"></span> Ordner Öffnen</button>
            <button><span class="bi bi-trash"></span> Deinstallieren</button>
        `, libraryElementCtxMenu)
    }
    else{
        $(".filter").remove()
        $(".searchResults").remove()
        $(".games").remove()
        $(".softwares").remove()
        $("padding").append($(document.createElement("p")).css("text-align", "center").html("Keine Spiele oder Softwares installiert."))
        $("padding").append($(document.createElement("a")).attr("href", "#").css("text-align", "center").css("text-decoration", "underline").html("Du hast ein Spiel schon installiert? Dann füge es hinzu!")).click(addGame)
    }
    $("#checkForUpdates").click(checkForUpdates)
    $("#addGame").click(addGame)
    const searchParams = new URL(location.href).searchParams
    if(searchParams.has("q")){
        $(".searchbar").focus()
        $(".searchbar").val(searchParams.get("q"))
        $(".searchbar").get(0).dispatchEvent(
            new KeyboardEvent('keyup', { key: "enter" })
        )
    }
})
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
                updateCtxMenu(".software", "software")
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
function createGameLibraryElement(product){
    const updatesArray = JSON.parse(sessionStorage.getItem("updates"))
    const isUpdatable = isInArray(updatesArray, product)
    const newProduct = getFromArray(updatesArray, product)
    const title = $(document.createElement("h3")).html(product.name)
    const updateElement = $(document.createElement("span")).addClass(["bi", "bi-arrow-clockwise", "updatable"])
    const titleElement = $(document.createElement("div")).css("display", "flex").css("justify-content", "space-between").css("align-items", "center").append([title])
    const smallContainer = $(document.createElement("span")).addClass("small")
    if(isUpdatable) titleElement.append(updateElement)
    let versionElement
    if(isUpdatable){ 
        versionElement = $(document.createElement("p"))
        versionElement.append($(document.createElement("span")).html(product.version + " " + product.versionLevel).css("text-decoration", "line-through").css("text-decoration-color", "var(--hover)"))
        const newVersionElement = $(document.createElement("span")).css("color", "var(--primary)").html(" ").append($(document.createElement("span")).addClass(["bi", "bi-arrow-up"])).append(" " + newProduct.version + " " + newProduct.versionLevel)
        versionElement.append(newVersionElement)
    }
    else{
        versionElement = $(document.createElement("p")).html(product.version + " " + product.versionLevel)
    }
    let totalSize = ((product.size / 1024) / 1024).toFixed(2)
    if(totalSize >= 1000){
        totalSize = (totalSize / 1024).toFixed(2)
    }
    console.log(product)
    console.log(product.size)
    if(!totalSize || isNaN(totalSize)) totalSize = 0
    const sizeElement = $(document.createElement("p")).html(totalSize + " MB")
    smallContainer.append([versionElement, sizeElement])
    const imgElement = $(document.createElement("img")).attr("src", "/api/library/img/" + product.name + "?installationPath=" + product.installationPath).attr("alt", "")
    const playButton = $(document.createElement("div")).addClass("play-button").css("opacity", "0").append([
        $(document.createElement("div")).addClass("background"),
        $(document.createElement("p")).addClass(["bi", "bi-play-fill"]).html("<span>START</span>"),
    ])
    if(isUpdatable){
        playButton.find(".bi-play-fill span").html("<span>UPDATE</span>")
        playButton.find(".bi-play-fill").removeClass("bi-play-fill").addClass("bi-arrow-clockwise")
    }
    const gameContainer = $(document.createElement("div")).addClass("game").append([titleElement, smallContainer, imgElement, playButton]).attr("name", product.name).attr("filepath", product.start).mouseenter(function(){
        $(this).find(".play-button").css("opacity", "1")
    }).mouseleave(function(){
        $(this).find(".play-button").css("opacity", "0")
    })
    if(isUpdatable) gameContainer.addClass("updatable")
    $(".games").append(gameContainer)
}
function createSoftwareLibraryElement(product){
    const updatesArray = JSON.parse(sessionStorage.getItem("updates"))
    const isUpdatable = isInArray(updatesArray, product)
    const newProduct = getFromArray(updatesArray, product)
    const title = $(document.createElement("h3")).html(product.name)
    const updateElement = $(document.createElement("span")).addClass(["bi", "bi-arrow-clockwise", "updatable"])
    const titleElement = $(document.createElement("div")).css("display", "flex").css("justify-content", "space-between").css("align-items", "center").append([title])
    const smallContainer = $(document.createElement("span")).addClass("small")
    if(isUpdatable) titleElement.append(updateElement)
    let versionElement
    if(isUpdatable){ 
        versionElement = $(document.createElement("p"))
        versionElement.append($(document.createElement("span")).html(product.version + " " + product.versionLevel).css("text-decoration", "line-through").css("text-decoration-color", "var(--hover)"))
        const newVersionElement = $(document.createElement("span")).css("color", "var(--primary)").html(" ").append($(document.createElement("span")).addClass(["bi", "bi-arrow-up"])).append(" " + newProduct.version + " " + newProduct.versionLevel)
        versionElement.append(newVersionElement)
    }
    else{
        versionElement = $(document.createElement("p")).html(product.version + " " + product.versionLevel)
    }
    let totalSize = ((product.size / 1024) / 1024).toFixed(2)
    if(totalSize >= 1000){
        totalSize = (totalSize / 1024).toFixed(2)
    }
    if(!totalSize || isNaN(totalSize)) totalSize = 0
    const sizeElement = $(document.createElement("p")).html(totalSize + " MB")
    smallContainer.append([versionElement, sizeElement])
    const playButton = $(document.createElement("div")).addClass("play-button").css("opacity", "0").append([
        $(document.createElement("div")).addClass("background"),
        $(document.createElement("p")).addClass(["bi", "bi-play-fill"]).html("<span>START</span>"),
    ])
    if(isUpdatable){
        playButton.find(".bi-play-fill span").html("<span>UPDATE</span>")
        playButton.find(".bi-play-fill").removeClass("bi-play-fill").addClass("bi-arrow-clockwise")
    }
    const gameContainer = $(document.createElement("div")).addClass("software").append([titleElement, smallContainer, playButton]).attr("name", product.name).attr("filepath", product.start).mouseenter(function(){
        $(this).find(".play-button").css("opacity", "1")
    }).mouseleave(function(){
        $(this).find(".play-button").css("opacity", "0")
    })
    if(isUpdatable) gameContainer.addClass("updatable")
    $(".softwares").append(gameContainer)
}
function isInArray(array, elementToCheck){
    if(array.length == 0) return false
    console.log("isInArray:", array, elementToCheck)
    for (let i = 0; i < array.length; i++) {
        const element = array[i];
        if(element.name == elementToCheck.name){
            return true
        }
    }
    return false
}
function getFromArray(array, elementToGet){
    if(array.length == 0) return null
    console.log("getFromArray:", array, elementToGet)
    for (let i = 0; i < array.length; i++) {
        const element = array[i];
        if(element.name == elementToGet.name){
            return element
        }
    }
    return null
}
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
    if($(element).attr("listener")) return
    else $(element).attr("listener", true)
    element.addEventListener("click", async function(e){
        const filepath = e.target.getAttribute("filepath")
        const name = e.target.getAttribute("name")
        console.log("start", filepath)

        const updatesArray = JSON.parse(sessionStorage.getItem("updates"))
        const isUpdatable = isInArray(updatesArray, {name})
        const newProduct = getFromArray(updatesArray, {name})
        if(isUpdatable){
            const status = await get("/api/connection")
            if(status == 2){
                fetch(newProduct.downloadUrl).then(async (response) => {
                    newProduct.size = parseInt(response.headers.get("Content-Length"), 10)
                }).catch((err) => {
                    console.error(err)
                })
            }
            else{
                console.error("could not request download size")
            }
            const res = await send("/api/download", newProduct)
            console.log(res)
            const res2 = await get("/api/updates/clear?name=" + name)
            console.log(res2)
            for (let i = 0; i < updatesArray.length; i++) {
                const element = updatesArray[i];
                if(element.name == name){
                    updatesArray.splice(i, 1)
                    sessionStorage.setItem("updates", JSON.stringify(updatesArray))
                    break
                }
            }
            setTimeout(() => openSite("/downloads"), 100)
        }
        else{
            const response = await send("/api/games/start", {filepath, name}, true)
            if(response.status == 1){
                notify("Erfolgreich", response.data, "success")
            }
            else{
                notify("Fehlgeschlagen", response.data, "error")
            }
        }
    })
}
$(".searchbar").keyup(search)
$("#searchBtn").click(search)
function search(){
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
            const clone = $(element).clone(true, true).css("animation", "none")
            $(".searchResults").append(clone)
        }
    }
    $(".searchResults").children().each(setClick)
}

async function addGame(){
    try{
        const addGameRes = await get("/api/library/add", true)
        const product = addGameRes.data
        if(addGameRes.status == 1){
            // if(product.categorie == "games"){
            //     createGameLibraryElement(product)
            //     $(".games").children().each(setClick)
            //     updateCtxMenu(".game", "game")
            // }
            // else if(product.categorie == "softwares"){
            //     createSoftwareLibraryElement(product)
            //     $(".softwares").children().each(setClick)
            //     updateCtxMenu(".software", "software")
            // }
            // notifyCb("Erfolgreich", product.name + " wurde zur Library hinzugefügt! Lade neu...", "success", 3000, function(){
            //     location.reload()
            // })
            // setTimeout(() => location.reload(), 3000)
            location.reload()
        }
        else{
            notify("Fehlgeschlagen", product, "error")
        }
    }
    catch(err){
        console.log("addGame: error:", err)
        notify("Fehlgeschlagen", err, "error")
    }
}

async function checkForUpdates(){
    try{
        const pullRes = await get("/api/updates/pull", true)
        const updates = pullRes.data

        if(pullRes.status == 1){
            sessionStorage.setItem("updates", JSON.stringify(updates))
            if(updates.length > 0){
                sessionStorage.setItem("showedUpdatesNotification", true)
                if(updates.length == 1) notifyCb("Update Verfügbar", "Es ist ein Update für <b>" + updates[0].name + "</b> verfügbar. Klicke um die Aktualisierung zu starten.", "note", 10000, async function(){
                    const updates = (await get("/api/updates")).updates
                    if(updates.length == 0) return
                    const res = await send("/api/download", updates[0])
                    console.log(res)
                    const res2 = await get("/api/updates/clear")
                    console.log(res2)
                    sessionStorage.setItem("updates", JSON.stringify([]))
                    setTimeout(() => openSite("/downloads"), 100)
                })
                else notifyCb("Updates Verfügbar", "Es können mehrere Spiele oder Softwares aktualisiert werden. Klicke um die Aktualisierung zu starten.", "note", 10000, async function(){
                    const updates = (await get("/api/updates")).updates
                    if(updates.length == 0) return
                    for (let i = 0; i < updates.length; i++) {
                        const element = updates[i];
                        const res = await send("/api/download", element)
                        console.log(res)
                    }
                    const res2 = await get("/api/updates/clear")
                    console.log(res2)
                    sessionStorage.setItem("updates", JSON.stringify([]))
                    setTimeout(() => openSite("/downloads"), 100)
                })
            }
            else notify("Keine Updates", "Es sind momentan keine Updates vorhanden.", "note")

            const res = await get("/api/installs")
            $(".games").get(0).replaceChildren()
            $(".softwares").get(0).replaceChildren()
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
                <button><span class="bi bi-play-fill"></span> Start</button>
                <button><span class="bi bi-box-arrow-up-left"></span> Store Seite</button>
                <button><span class="bi bi-folder-symlink"></span> Ordner Öffnen</button>
                <button><span class="bi bi-trash"></span> Deinstallieren</button>
            `, libraryElementCtxMenu)
            createCtxMenu(".software", "software", `
                <button><span class="bi bi-play-fill"></span> Start</button>
                <button><span class="bi bi-box-arrow-up-left"></span> Store Seite</button>
                <button><span class="bi bi-folder-symlink"></span> Ordner Öffnen</button>
                <button><span class="bi bi-trash"></span> Deinstallieren</button>
            `, libraryElementCtxMenu)
            $("#filter-all").click()
        }
        else{
            notify("Fehlgeschlagen", pullRes.data, "error")
        }
    }
    catch(err){
        console.log("checkForUpdates: error:", err)
        notify("Fehlgeschlagen", err, "error")
    }
}