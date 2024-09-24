let product = {}

$(document).ready(async function(){
    const status = await get("/api/connection")
    if(status == 2){
        let productName = decodeURI(location.pathname.substring(location.pathname.lastIndexOf("/"))).replace("/", "")
        const res = await get("https://api.sketch-company.de/store")
        console.log(res)
        $(".imagesHolder .images").removeClass("placeholder-wave")
        for (let i = 0; i < res.games.length; i++) {
            const element = res.games[i];
            if(element.name == productName){
                element.categorie = "games"
                setup(element)
                return
            }
        }
        for (let i = 0; i < res.softwares.length; i++) {
            const element = res.softwares[i];
            if(element.name == productName){
                element.categorie = "softwares"
                setup(element)
                return
            }
        }
    }
    else if(status == 1){
        notify("Keine Verbindung", "Wir konnten keine Verbindung zu den Servern aufbauen.", "error")
        $(".imagesHolder").remove()
        $(".content").remove()
        $(".product").append($(document.createElement("p")).html("Keine Verbindung zu den Servern.").css("text-align", "center"))
    }
    else{
        notify("Keine Verbindung", "Wir konnten keine Internet Verbindung aufbauen.", "error")
        $(".imagesHolder").remove()
        $(".content").remove()
        $(".product").append($(document.createElement("p")).html("Keine Internet Verbindung.").css("text-align", "center"))
    }
})

window.addEventListener("scroll", (e) => {
    if(window.scrollY > 870){
        $("#downloadBtn").css("box-shadow", "0 6px 8px var(--bx0)")
    }
    else{
        $("#downloadBtn").css("box-shadow", "none")
    }
})

function setup(element){
    product = element

    if(element.isTeaser){
        $("#downloadBtn").attr("disabled", "").html("Unreleased")
    }
    else $("#downloadBtn").removeAttr("disabled")

    if(new URL(location.href).searchParams.get("download") && !element.isTeaser){
        download()
    }

    for (let i = 1; i < element.images +1; i++) {
        const img = $(document.createElement("img")).attr("src", element.resourcesUrl + i + ".png").attr("alt", "")
        if(i != 1){
            img.css("display", "none")
        }
        else img.css("display", "block")
        $(".images").append(img)
    }
    $("#name").html(product.name)
    $("#version").html(element.versionLevel + " " + element.version)
    const tags = $(".tags")
    for (let index = 0; index < element.tags.length; index++) {
        const element2 = element.tags[index];
        const tag = $(document.createElement("span")).addClass("tag").html(element2)
        tags.append(tag)
    }
    $("#description").html(element.description)
    if(!element.isTeaser){
        for (let i = 0; i < 5; i++) {
            const note = element.patchNotes[i];
            if(!note) break
            const accardion = $(document.createElement("div")).addClass("caccordion").html(note.version)
            const accardionPanel = $(document.createElement("div")).addClass("cpanel").html(note.notes.replaceAll("\n", "<br>"))
            $(".patchNotes").append(accardion).append(accardionPanel)
        }
        $("#more").click(() => morePatchNotes(element))
        setAccordions()
        $(".patchNotes").children().first().click()
    }
    else $(".patchNotesHolder").remove()
}

function morePatchNotes(element){
    const length = $(".patchNotes").children().length / 2
    for (let i = length; i < length +5; i++) {
        const note = element.patchNotes[i];
        if(!note) break
        const accardion = $(document.createElement("div")).addClass("caccordion").html(note.version)
        const accardionPanel = $(document.createElement("div")).addClass("cpanel").html(note.notes.replaceAll("\n", "<br>"))
        $(".patchNotes").append(accardion).append(accardionPanel)
    }
    setAccordions()
}
function lessPatchNotes(){
    if($(".patchNotes").children().length < 10) return
    for (let i = 0; i < 10; i++) {
        $(".patchNotes").children().last().remove()
    }
}

$(".btnLeft").click(function(){
    const images = $(".images img").map(function(){return this}).get()
    if(images.length <= 1) return
    for (let i = 0; i < images.length; i++) {
        const element = $(images[i]);
        if(element.css("display") == "block"){
            element.css("display", "none")
            if(element.prev().length > 0){
                element.prev().css("display", "block")
            }
            else{
                $(images.length -1).css("display", "block")
            }
            break
        }
    }
})
$(".btnRight").click(function(){
    const images = $(".images img").map(function(){return this}).get()
    if(images.length <= 1) return
    for (let i = 0; i < images.length; i++) {
        const element = $(images[i]);
        if(element.css("display") == "block"){
            element.css("display", "none")
            if(element.next().length > 0){
                element.next().css("display", "block")
            }
            else{
                $(images[0]).css("display", "block")
            }
            break
        }
    }
})
async function download(){
    const settings = await get("/api/settings")

    const installationPathHover = $(document.createElement("style")).attr("id", "installationPathHover").html(`
        #installationPath:hover{
            cursor: pointer;
        }
    `)
    $("head").append(installationPathHover)

    const dialog = createDialog("Download", "Lege deine Download Optionen fest und klicke auf \"Download Starten\" um den download zu starten.", `
        <div class="crow">
            <p>Downloaden:</p>
            <p>${product.name}</p>
        </div>
        <div class="crow">
            <p>Installations Pfad:</p>
            <input id="installationPath" style="width: 50%" type="text" placeholder="C:\\Windows\\Program Files\\..." value="${settings.installationPath}">
        </div>
        <div class="crow">
            <p>Desktop Verknüpfung:</p>
            <input id="shortcut" type="checkbox" checked>
        </div>
        <div style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
            <button id="startDownload" class="marked">Download Starten</button> 
            <button id="cancelDownload">Abbrechen</button>
        </div>
    `, 550, 525)

    $("#installationPath").focus(function(){
        $("#installationPath").blur()
    })

    $("#installationPath").click(async function(){
        $("#installationPath").blur()
        const res = await get("/api/settings/open")
        console.log(res)
        if(res.length == 0) return
        $("#installationPath").val(res[0])
        $("#submit").focus()
    })

    $("#startDownload").click(async function(){
        console.log("download started", product.downloadUrl)
        const patchNotes = getPatchNotes(product.patchNotes, 5)
        product.patchNotes = patchNotes
        product.createShortcut = isChecked("#shortcut")
        product.installationPath = $("#installationPath").val() + "/"
        removeDialog(dialog)
        const res = await send("/api/download", product)
        console.log(res)
        setTimeout(() => openSite("/downloads"), 100)
    })
    
    $("#cancelDownload").click(function(){
        removeDialog(dialog)
        $("#installationPathHover").remove()
    })
}

function isChecked(selector){
    if($(selector).get(0).checked) return true
    else return false
}

function getPatchNotes(notes, depth){
    let result = ""
    for (let i = 0; i < depth; i++) {
        const element = notes[i]
        if(!element) continue
        result += element.version
        result += "<br>"
        result += element.notes.replaceAll("\n", "<br>")
        result += "<br><br>"
    }
    return result
}