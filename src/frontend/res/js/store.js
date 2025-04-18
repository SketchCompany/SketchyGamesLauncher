let store
$(document).ready(async function(){
    const connectionStatus = await get("/api/connection")
    
    if(connectionStatus != 2){
        $(".hero").remove()
        $(".categories").remove()
        $(".searchbar").remove()
    }
    if(connectionStatus == 1){
        const noConnectionLabel = $(document.createElement("p")).html("Keine Verbindung zum Server.").css("text-align", "center")
        $("padding").append(noConnectionLabel)
        return
    }
    else if(connectionStatus == 0){
        const noConnectionLabel = $(document.createElement("p")).html("Keine Verbindung zum Internet.").css("text-align", "center")
        $("padding").append(noConnectionLabel)
        return
    }

    const res = await get("/api/store")
    console.log(res)
    store = res
    for (let i = 0; i < res.populars.length; i++) {
        const element = res.populars[i];
        const newElement = createPopularElement(element)
        if(i != 0){
            newElement.css("display", "none")
        }
        else newElement.css("display", "block")
        $(".populars").append(newElement)
    }
    for (let i = 0; i < res.suggestions.suggestions.length; i++) {
        const element = res.suggestions.suggestions[i];
        createCategorieElement(".suggestions", element)
    }
    for (let i = 0; i < res.suggestions.bestofweek.length; i++) {
        const element = res.suggestions.bestofweek[i];
        createCategorieElement(".bestofweek", element)
    }
    for (let i = 0; i < res.suggestions.games.length; i++) {
        const element = res.suggestions.games[i];
        createCategorieElement(".games", element)
    }
    for (let i = 0; i < res.suggestions.softwares.length; i++) {
        const element = res.suggestions.softwares[i];
        createCategorieElement(".softwares", element)
    }
    startLoop()
    createCtxMenu(".popular", "popular-element", `
        <button><span class="bi bi-box-arrow-up-left"></span> Ansehen</button>
        <button><span class="bi bi-download"></span> Download</button>
    `, elementClicked)
    createCtxMenu(".categorieElement", "categorie-element", `
        <button><span class="bi bi-box-arrow-up-left"></span> Ansehen</button>
        <button><span class="bi bi-download"></span> Download</button>
    `, elementClicked)

    $("#searchBtn").click(search)
    $("#search").keyup(search)

    function search(e){
        let search = $("#search").val().toLowerCase()
        $(".searchResults").get(0).replaceChildren()
        if(!/\S/.test(search)) return
        if(search.startsWith("tag:")){
            search = search.replace("tag:", "")
            for (let i = 0; i < res.games.length; i++) {
                const element = res.games[i].tags;
                for (let i2 = 0; i2 < element.length; i2++) {
                    const element2 = element[i2];
                    if(element2.toLowerCase().includes(search)){
                        createSearchResultElement(".searchResults", res.games[i])
                        break
                    }
                }
            }
            for (let i = 0; i < res.softwares.length; i++) {
                const element = res.softwares[i].tags;
                for (let i2 = 0; i2 < element.length; i2++) {
                    const element2 = element[i2];
                    if(element2.toLowerCase().includes(search)){
                        createSearchResultElement(".searchResults", res.softwares[i])
                        break
                    }
                }
            }
            if($(".searchResults").get(0).children.length == 0){
                $(".searchResults").append($(document.createElement("p")).html("Nichts gefunden.").css("text-align", "center"))
            }
        }
        else{
            for (let i = 0; i < res.games.length; i++) {
                const element = res.games[i];
                if(element.name.toLowerCase().includes(search) || element.tags.find(e => e.toLowerCase().includes(search))){
                    createSearchResultElement(".searchResults", element)
                }
            }
            for (let i = 0; i < res.softwares.length; i++) {
                const element = res.softwares[i];
                if(element.name.toLowerCase().includes(search) || element.tags.find(e => e.toLowerCase().includes(search))){
                    createSearchResultElement(".searchResults", element)
                }
            }
            if($(".searchResults").get(0).children.length == 0){
                $(".searchResults").append($(document.createElement("p")).html("Nichts gefunden.").css("text-align", "center"))
            }
        } 
    }

    const params = new URL(location.href).searchParams
    if(params.get("search")){
        $("#search").val(params.get("search"))
        if($("#searchBtn").length > 0){
            $("#searchBtn").click()
            if($(".searchResults").length > 0){
                $(".searchResults").children().first().get(0).scrollIntoView({ behavior: "auto", block: "center"})
            }
        }
    }

    // Add event listeners for scroll buttons
    $(".scrollBtnLeft").click(function() {
        $(this).siblings(".categorieHolder").animate({ scrollLeft: '-=1000' }, 300);
    });

    $(".scrollBtnRight").click(function() {
        $(this).siblings(".categorieHolder").animate({ scrollLeft: '+=1000' }, 300);
    });

    // Show scroll buttons only if there are multiple elements
    $(".categorieHolder").each(function() {
        const $this = $(this);
        if ($this.get(0).scrollWidth > $this.innerWidth()) {
            $this.siblings(".scrollBtnLeft, .scrollBtnRight").show();
        } else {
            $this.siblings(".scrollBtnLeft, .scrollBtnRight").hide();
        }
    });
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
function createPopularElement(product){
    const cover = $(document.createElement("img")).attr("src", product.img).attr("alt", "")
    const description = $(document.createElement("p")).html(product.teaser)
    const headline = $(document.createElement("h1")).html(product.name)
    const contentDiv = $(document.createElement("div")).addClass("content").append(headline).append(description)
    const div = $(document.createElement("div")).addClass("popular").append(cover).append(contentDiv).click(() => {
        if(!product.isTeaser) openSite("/store/" + product.name)
    }).attr("name", product.name)
    if(product.isTeaser){
        div.attr("isTeaser", "true")
    }
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
function createSearchResultElement(type, product){
    const imgElement = $(document.createElement("img")).attr("src", product.resourcesUrl + "1.png").attr("alt", "")
    const h3 = $(document.createElement("h3")).html(product.name)
    const tags = $(document.createElement("div")).addClass("tags")
    for (let index = 0; index < product.tags.length; index++) {
        const element = product.tags[index];
        const tag = $(document.createElement("span")).addClass("tag").html(element)
        tags.append(tag)
    }
    if(product.isNew){
        h3.append($(document.createElement("span")).addClass(["badgetag", "new"]).html("NEW"))
    }
    if(product.isTeaser){
        h3.append($(document.createElement("span")).addClass(["badgetag", "soon"]).html("SOON"))
    }
    const div = $(document.createElement("div")).addClass("categorieElement").css("animation", "none").append([imgElement, h3, tags]).click(() => openSite("/store/" + product.name)).attr("name", product.name)
    if(product.isTeaser){
        div.attr("isTeaser", "true")
    }
    $(type).append(div)
}
function createCategorieElement(type, product){
    const imgElement = $(document.createElement("img")).attr("src", product.img).attr("alt", "")
    const h3 = $(document.createElement("h3")).html(product.name)
    const p = $(document.createElement("p")).html(product.description)
    const tags = $(document.createElement("div")).addClass("tags")
    for (let index = 0; index < product.tags.length; index++) {
        const element = product.tags[index];
        const tag = $(document.createElement("span")).addClass("tag").html(element)
        tags.append(tag)
    }
    if(product.isNew){
        h3.append($(document.createElement("span")).addClass(["badgetag", "new"]).html("NEW"))
    }
    if(product.isTeaser){
        h3.append($(document.createElement("span")).addClass(["badgetag", "soon"]).html("SOON"))
    }
    const div = $(document.createElement("div")).attr("name", product.name).attr("draggable", "true").addClass("categorieElement").click(() => openSite("/store/" + product.name)).append([imgElement, h3, p, tags])
    if(product.isTeaser){
        div.attr("isTeaser", "true")
    }

    // Dragging
    let isDragging = false
    let startX, startY

    div.on("mousedown", function(e) {
        isDragging = true
        startX = e.clientX
        startY = e.clientY
        e.preventDefault()
    })

    $(document).on("mousemove", function(e) {
        if (isDragging) {
            const dx = e.clientX - startX
            const dy = e.clientY - startY
            div.parent().scrollLeft(div.parent().scrollLeft() - dx)
            div.parent().scrollTop(div.parent().scrollTop() - dy)
            startX = e.clientX
            startY = e.clientY
        }
    })

    $(document).on("mouseup", function() {
        isDragging = false
    })

    div.on("click", function(e) {
        if (isDragging) {
            e.stopImmediatePropagation();
        }
    });

    $(type).append(div)
}
function elementClicked(i, element){
    //if($(element).attr("isTeaser")) return

    const name = $(element).attr("name")
    if(i == 0){
        openSite("/store/" + name)
    }
    else if(i == 1){
        openSite("/store/" + name + "?download=true")
    }
}