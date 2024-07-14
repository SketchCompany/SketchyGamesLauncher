let product = {}

$(document).ready(async function(){
    let productName = decodeURI(location.pathname.substring(location.pathname.lastIndexOf("/"))).replace("/", "")
    const res = await get("https://api.sketch-company.de/store")
    for (let i = 0; i < res.games.length; i++) {
        const element = res.games[i];
        console.log(element)
        if(element.name == productName){
            element.categorie = "games"
            setup(element)
            return
        }
    }
    for (let i = 0; i < res.softwares.length; i++) {
        const element = res.softwares[i];
        console.log(element)
        if(element.name == productName){
            element.categorie = "softwares"
            setup(element)
            return
        }
    }
})

function setup(element){
    product = element
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
    $("#description").html(element.description)
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
    console.log("download started", product.downloadUrl)
    const patchNotes = getPatchNotes(product.patchNotes, 5)
    product.patchNotes = patchNotes
    const res = await send("/api/download", product)
    console.log(res)
    setTimeout(() => openSite("/downloads"), 100)
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