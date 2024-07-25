$(document).ready(async function(){
    const res = await get("https://api.sketch-company.de/store")
    for (let i = 0; i < res.populars.length; i++) {
        const element = res.populars[i];
        const newElement = createPopularElement(element.name, element.teaser, element.img)
        if(i != 0){
            newElement.css("display", "none")
        }
        else newElement.css("display", "block")
        $(".populars").append(newElement)
    }
    for (let i = 0; i < res.suggestions.suggestions.length; i++) {
        const element = res.suggestions.suggestions[i];
        createCategorieElement(".suggestions", element.name, element.description, element.img)
    }
    for (let i = 0; i < res.suggestions.bestofweek.length; i++) {
        const element = res.suggestions.bestofweek[i];
        createCategorieElement(".bestofweek", element.name, element.description, element.img)
    }
    for (let i = 0; i < res.suggestions.games.length; i++) {
        const element = res.suggestions.games[i];
        createCategorieElement(".games", element.name, element.description, element.img)
    }
    for (let i = 0; i < res.suggestions.softwares.length; i++) {
        const element = res.suggestions.softwares[i];
        createCategorieElement(".softwares", element.name, element.description, element.img)
    }
    startLoop()
    createCtxMenu(".popular", "popular-element", `
        <button>Ansehen</button>
        <button>Download</button>
    `, elementClicked)
    createCtxMenu(".categorieElement", "categorie-element", `
        <button>Ansehen</button>
        <button>Download</button>
    `, elementClicked)
})
const time = 10 * 1000
let lastChange = Date.now()
function startLoop(){
    setInterval(() => {
        if((Date.now() - lastChange) <= time) return
        lastChange = Date.now()
        const populars = $(".popular").map(function(){return this}).get()
        for (let i = 0; i < populars.length; i++) {
            const element = $(populars[i]);
            if(element.css("display") == "block"){
                lastChange = Date.now()
                element.css("display", "none")
                if(element.next().length > 0){
                    element.next().css("display", "block")
                }
                else{
                    $(populars[0]).css("display", "block")
                }
                break
            }
        }
    }, 1000)
}
function createPopularElement(name, teaser, img){
    const cover = $(document.createElement("img")).attr("src", img).attr("alt", "")
    const description = $(document.createElement("p")).html(teaser)
    const headline = $(document.createElement("h1")).html(name)
    const contentDiv = $(document.createElement("div")).addClass("content").append(headline).append(description)
    const div = $(document.createElement("div")).addClass("popular").append(cover).append(contentDiv).click(() => openSite("/store/" + name)).attr("name", name)
    return div
}
$("#popularsBtnLeft").click(function(){
    const populars = $(".popular").map(function(){return this}).get()
    for (let i = 0; i < populars.length; i++) {
        const element = $(populars[i]);
        if(element.css("display") == "block"){
            lastChange = Date.now()
            element.css("display", "none")
            if(element.prev().length > 0){
                element.prev().css("display", "block")
            }
            else{
                $(populars[populars.length -1]).css("display", "block")
            }
            break
        }
    }
})
$("#popularsBtnRight").click(function(){
    const populars = $(".popular").map(function(){return this}).get()
    for (let i = 0; i < populars.length; i++) {
        const element = $(populars[i]);
        if(element.css("display") == "block"){
            lastChange = Date.now()
            element.css("display", "none")
            if(element.next().length > 0){
                element.next().css("display", "block")
            }
            else{
                $(populars[0]).css("display", "block")
            }
            break
        }
    }
})
function createCategorieElement(type, name, description, img){
    const imgElement = $(document.createElement("img")).attr("src", img).attr("alt", "")
    const h3 = $(document.createElement("h3")).html(name)
    const p = $(document.createElement("p")).html(description)
    const div = $(document.createElement("div")).addClass("categorieElement").append(imgElement).append(h3).append(p).click(() => openSite("/store/" + name)).attr("name", name)
    $(type).append(div)
}
function elementClicked(i, element){
    const name = $(element).attr("name")
    if(i == 0){
        openSite("/store/" + name)
    }
    else if(i == 1){
        openSite("/store/" + name + "?download=true")
    }
}