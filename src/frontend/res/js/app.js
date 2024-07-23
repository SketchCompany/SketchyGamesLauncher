// a list of blocked sites, that should not have the default layout
const blocked = [
    "/login",
    "/signup",
    "/verify",
    "/loading"
]

// check if the current site is on the blocked list
function notValid(){
    if(blocked.includes(location.pathname)) return true
    else return false
}

// check if the current site is not on the blocked list
function isValid(){
    if(blocked.includes(location.pathname)) return false
    else return true
}

// get the current site name
var siteName
if(location.pathname == "/"){
    siteName = "Start"
}
else{
    siteName = decodeURI(location.pathname.substring(location.pathname.lastIndexOf("/") + 1).replace("/", "")).substring(0, 1).toUpperCase() + decodeURI(location.pathname.substring(location.pathname.lastIndexOf("/") + 1).replace("/", "")).substring(1)
}

// handle context menus
let clicked
function createCtxMenu(name, id, elements, event, blocked){
    $("body").prepend(`
        <div id="` + id + `-ctx-menu" class="context-menu" style="display: none;"></div>
    `)

    $("#" + id + "-ctx-menu").append(elements)
    $("#" + id + "-ctx-menu").children().last().addClass("lastItem")
    $("#" + id + "-ctx-menu").on("mouseleave", function(e){
        $("#" + id + "-ctx-menu").css("display", "none")
    })
    $("#" + id + "-ctx-menu").on("contextmenu", function(e){
        e.stopPropagation()
    })

    $("#" + id + "-ctx-menu").children().each((i, element) => {
        if($(element).attr("listener")) return
        $(element).attr("listener", "true")
        $(element).click(() => {
            event(i, clicked)
            $("#" + id + "-ctx-menu").css("display", "none")
        })
    })

    $(name).on("contextmenu", function(e){
        e.preventDefault()
        e.stopPropagation()
        if(blocked){
            for (let i = 0; i < blocked.length; i++) {
                const element = blocked[i];
                if(e.target.classList.contains(element)){
                    return
                }
            }
        }

        const {clientX: mouseX, clientY: mouseY} = e

        $("#" + id + "-ctx-menu").css("top", mouseY - 20 + "px")
        $("#" + id + "-ctx-menu").css("left", mouseX - 20 + "px")
        $("#" + id + "-ctx-menu").css("display", "block")
        clicked = e.target
    })
}

// update a context menu by its name and id
function updateCtxMenu(name, id, blocked){
    $(name).on("contextmenu", function(e){
        e.preventDefault()
        e.stopPropagation()
        if(blocked){
            for (let i = 0; i < blocked.length; i++) {
                const element = blocked[i];
                if(e.target.classList.contains(element)){
                    return
                }
            }
        }

        const {clientX: mouseX, clientY: mouseY} = e

        $("#" + id + "-ctx-menu").css("top", mouseY - 20 + "px")
        $("#" + id + "-ctx-menu").css("left", mouseX - 20 + "px")
        $("#" + id + "-ctx-menu").css("display", "block")
        clicked = e.target
    })
}

// remove a created context menu by it's id
function removeCtxMenu(id){
    $("#" + id + "-ctx-menu").remove()
}

// check if the current site is valid before creating the default layout
if(isValid()){
    // create the default header
    $("body").prepend(`
    <header>
        <span class="left">
            <span class="bi bi-list" onclick="toggleOffcanvas()"></span>
            <span class="bi bi-bell" style="position: relative;" onclick="toggleNotificationsCenter()">
                <span style="display: none; position: absolute; right: -10px; top: -5px; font-size: 12px; background-color: springgreen; padding: 1px; border-radius: 12px; min-width: 25px; text-align: center; color: white; text-shadow: var(--tx0); font-weight: bold;">
                    0
                </span>
            </span>
            <span onclick="openSite('/')" class="title"><img src="/res?f=img/icon.png"><p>ketchy Games Launcher</p></span>
        </span>
    </header>`)
    
    // create the default breadcrumb bar 
    $("padding").prepend(`
        <div class="breadcrumb">
            <ul>
                <li><a href="/">Start</a></li>
            </ul>
        </div>
    `)

    // handle the breadcrumbs for the current site
    const breadcrumb = $(".breadcrumb").children("ul")[0]
    const paths = location.pathname.split("/")
    var before = ""
    var links = []
    for (let i = 1; i < paths.length; i++) {
        const element = paths[i];
        var link = before + "/" + element + location.search
        before = link
        links.push(link)
    }
    for (let i = 1; i < paths.length; i++) {
        const element = paths[i]
        if(/\S/.test(element)){
            var linkName = element.substring(0, 1).toUpperCase() + element.substring(1)
            const a = document.createElement("a")
            a.href = links[i -1]
            a.innerHTML = decodeURI(linkName.toString())
            const li = document.createElement("li")
            li.appendChild(a)
            breadcrumb.appendChild(li)
        }
    }

    // create the offcanvas
    $("body").prepend(`
        <offcanvas id="offcanvas" style="display: none;">
            <span class="top">
                <span>
                    <span class="bi bi-list"></span>
                    <span>Menu</span>
                </span>
                <span>
                    <span onclick="toggleOffcanvas()" class="bi bi-x-lg"></span>
                </span>
            </span>
            <p class="title">` + siteName + `</p>
            <div class="wrapper">
                <div class="content">
                    <a fhref="/"><span class="bi bi-caret-right expandable" style="display: none;"></span> <span class="bi bi-house"></span> Start</a>
                    <div style="display: none;">
                        <a href="/news"><span class="bi bi-arrow-return-right" style="color: var(--clr-gray)"></span> News</a>
                        <a href="/notes"><span class="bi bi-arrow-return-right" style="color: var(--clr-gray)"></span> Patch Notes</a>
                    </div>
                    <a href="/library"><span class="bi bi-controller"></span> Library</a>
                    <a href="/store"><span class="bi bi-shop"></span> Store</a>
                    <a href="/downloads"><span class="bi bi-download"></span> Downloads</a>
                    <a href="/account"><span class="bi bi-person"></span> Account</a>
                    <a href="/settings"><span class="bi bi-gear"></span> Settings</a>
                </div>
            </div>
        </offcanvas>
    `)

    // create the notification center
    $("body").prepend(`
        <notificationsCenter id="notificationsCenter" style="display: none;">
            <span class="top">
                <span>
                    <span class="bi bi-list"></span>
                    <span>Benachrichtigungen</span>
                </span>
                <span>
                    <span onclick="toggleNotificationsCenter()" class="bi bi-x-lg"></span>
                </span>
            </span>
            <div class="wrapper">
                <div class="content">
                    
                </div>
            </div>
        </notificationsCenter>
    `)

    // create default context menu
    createCtxMenu("html", "default", `
        <button onclick="back()">Zurück</button>
        <button onclick="location.reload()">Neuladen</button>
        <button onclick="openSite('/')">Start</button>
        <button onclick="openSite('/library')">Library</button>
        <button onclick="openSite('/store')">Store</button>
        <button onclick="openSite('/downloads')">Downloads</button>
        <button onclick="openSite('/account')">Account</button>
        <button onclick="openSite('/settings')">Settings</button>
    `, () => {})
}

// change background color of the header when the user scrolled more than 30px
window.addEventListener("scroll", () => {
    if(window.scrollY > 30){
        $("header").addClass("header-scrolling")
    }
    else if($("header").hasClass("header-scrolling")){
       $("header").removeClass("header-scrolling")
    }
})

// handle the input fields that are used for codes with multiple single input fields
const inputCodes = $(".input-code").map(function(){return this}).get()
for (let i = 0; i < inputCodes.length; i++) {
    const element = $(inputCodes[i]);
    element.children().first().focus()
    element.children().map(function(){return this}).get().forEach((codeInput, index) => {
        $(codeInput).attr("maxlength", "1")
        $(codeInput).keyup(function(e){
            if(e.key == "Backspace"){
                const prev = $(codeInput).prev()
                if(prev.length > 0){
                    prev.focus()
                }
            }
            else{
                const next = $(codeInput).next()
                if(next.length > 0){
                    next.focus()
                }
            }
        })
    })
}

// disable spellcheck and autocomplete attributes for input fields
const inputs = $("input").map(function(){return this}).get()
for (let i = 0; i < inputs.length; i++) {
    const element = $(inputs[i]);
    element.attr("spellcheck", "false")
    element.attr("autocomplete", "off")
}

// input fields with a clickable eye on the right side to view input of password input fields
const inputViewables = $(".input-viewable").map(function(){return this}).get()
for (let i = 0; i < inputViewables.length; i++) {
    const element = $(inputViewables[i]);
    const button = element.children().last()
    const input = element.children().first()
    button.click(function(){
        if(input.attr("type") == "password"){
            button.children().first().removeClass("bi-eye")
            button.children().first().addClass("bi-eye-slash")
            input.attr("type", "text")
        }
        else{
            button.children().first().removeClass("bi-eye-slash")
            button.children().first().addClass("bi-eye")
            input.attr("type", "password")
        }
    })
}

// set buttons in the offcanvas to be expandable when arrow on the side is clicked
const expandables = $(".expandable").map(function(){return this}).get()
for(let i = 0; i < expandables.length; i++){
    const element = expandables[i];
    element.parentElement.addEventListener("mouseover", () => {
        element.style.display = "block"
    })
    element.parentElement.addEventListener("mouseout", () => {
        element.style.display = "none"
    })
    element.parentElement.addEventListener("click", () => {
        const link = element.parentElement.getAttribute("fhref")
        const a = document.createElement("a")
        a.href = link
        a.click()
    })
    element.addEventListener("click", (e) => {
        e.stopPropagation()
        if(element.parentElement.nextElementSibling.style.display == "none"){
            element.parentElement.nextElementSibling.style.display = "block"
            element.classList.replace("bi-caret-right", "bi-caret-down")
        }
        else{
            element.parentElement.nextElementSibling.style.display = "none"
            element.classList.replace("bi-caret-down", "bi-caret-right")
        }
    })
}

// togle offcanvas on or off
function toggleOffcanvas(){
    if(notValid()) return
    if($("#offcanvas").css("display") == "block"){
        $("#offcanvas").css("display", "none")
        enableScroll()
    }
    else{
        $("#offcanvas").css("display", "block")
        disableScroll()
    }
}

// togle notificationsCenter on or off
function toggleNotificationsCenter(){
    if(notValid()) return
    if($("#notificationsCenter").css("display") == "block"){
        $("#notificationsCenter").css("display", "none")
        enableScroll()
    }
    else{
        $("#notificationsCenter").css("display", "block")
        disableScroll()
    }
}

// wait for an element to load before using it (no usages)
function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

// disable scroll if another element is opened on top like the offcanvas
function disableScroll(){
    document.body.classList.add("disabledInput")
}

// enable scroll if another element is close on top like the offcanvas
function enableScroll(){
    if(document.body.classList.contains("disabledInput")){
        document.body.classList.remove("disabledInput")
    }
}

// open another site
function openSite(href, target){
    const a = document.createElement("a")
    a.href = href
    if(target) a.target = target
    a.click()
    a.remove()
}

// fetch information from the backend with the GET method and return the data of the response
function get(url){
    return new Promise(async cb => {
        const response = await fetch(url)
        const result = await response.json()
        console.log("get:", url, "response:", result)
        cb(result.data)
    })
}

// fetch information from the backend with the GET method and return the complete response
function get(url, raw){
    return new Promise(async cb => {
        const response = await fetch(url)
        const result = await response.json()
        console.log("get:", url, "response:", result)
        if(raw) cb(result)
        else cb(result.data)   
    })
}

// fetch information from the backend with the GET method and return the complete response but only log it when "log" was set to true
function get(url, raw, log){
    return new Promise(async cb => {
        const response = await fetch(url)
        const result = await response.json()
        if(log) console.log("get:", url, "response:", result)
        if(raw) cb(result)
        else cb(result.data)   
    })
}

// fetch information from or to the backend with the POST method and return the data of the response
function send(url, data){
    return new Promise(async cb => {
        const response = await fetch(url, {method: "post", body: JSON.stringify(data), headers: {"Content-Type": "application/json"}})
        const result = await response.json()
        console.log("send:", url, "response:", result)
        cb(result.data)
    })
}

// fetch information from or to the backend with the POST method and return the complete response
function send(url, data, raw){
    return new Promise(async cb => {
        const response = await fetch(url, {method: "post", body: JSON.stringify(data), headers: {"Content-Type": "application/json"}})
        const result = await response.json()
        console.log("send:", url, "response:", result)
        if(raw) cb(result)
        else cb(result.data)
    })
}

// fetch information from or to the backend with the POST method and return the complete response but only log it when "log" was set to true
function send(url, data, raw, log){
    return new Promise(async cb => {
        const response = await fetch(url, {method: "post", body: JSON.stringify(data), headers: {"Content-Type": "application/json"}})
        const result = await response.json()
        if(log) console.log("send:", url, "response:", result)
        if(raw) cb(result)
        else cb(result.data)
    })
}

// create an notification in the bottom right and call a callback when it was clicked
async function notifyCb(title, message, type, cb){
    const res = await get("/api/settings")
    if(!res.notifications) return

    addToNotificationsCenter(title, message, type, cb)

    let duration = (1000 * 7) + 1000
    const element = $(document.createElement("div")).addClass("notification").addClass(type)
    element.append($(document.createElement("div")).append($(document.createElement("h3")).html(title)).append($(document.createElement("p")).html(message)))
    element.append($(document.createElement("i")).addClass(["bi", "bi-x-lg"]).click(async function(){
        removeCtxMenu("notification")
        element.remove()
        removeNotification(title, message, type)
    }))
    element.css("animation", "notificationSlideIn 1000ms")
    setTimeout(function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    }, duration)
    element.click(async function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
        cb()
        removeNotification(title, message, type)
    })
    $("body").append(element)
    createCtxMenu(".notification", "notification", `
        <button>Dismiss</button>
        <button>Close</button>
    `, async function(i, element2){
        if(i == 0){
            element.css("animation", "notificationSlideOut 1000ms")
            removeCtxMenu("notification")
            setTimeout(() => element.remove(), 750)
            removeNotification(title, message, type)
        }
        else if(i == 1){
            removeCtxMenu("notification")
            element.remove()
            removeNotification(title, message, type)
        }
    })
}
// create an notification in the bottom right
async function notify(title, message, type){
    const res = await get("/api/settings")
    if(!res.notifications) return

    addToNotificationsCenter(title, message, type)

    let duration = (1000 * 7) + 1000
    const element = $(document.createElement("div")).addClass("notification").addClass(type)
    element.append($(document.createElement("div")).append($(document.createElement("h3")).html(title)).append($(document.createElement("p")).html(message)))
    element.append($(document.createElement("i")).addClass(["bi", "bi-x-lg"]).click(async function(){
        removeCtxMenu("notification")
        element.remove()
        removeNotification(title, message, type)
    }))
    element.css("animation", "notificationSlideIn 1000ms")
    element.click(async function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
        removeNotification(title, message, type)
    })
    setTimeout(function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    }, duration)
    $("body").append(element)
    createCtxMenu(".notification", "notification", `
        <button>Dismiss</button>
        <button>Close</button>
    `, async function(i, element2){
        if(i == 0){
            element.css("animation", "notificationSlideOut 1000ms")
            removeCtxMenu("notification")
            setTimeout(() => element.remove(), 750)
            removeNotification(title, message, type)
        }
        else if(i == 1){
            removeCtxMenu("notification")
            element.remove()
            removeNotification(title, message, type)
        }
    })
}

// create an notification in the bottom right with a specified duration and call a callback when it was clicked
async function notifyCb(title, message, type, duration, cb){
    const res = await get("/api/settings")
    if(!res.notifications) return

    addToNotificationsCenter(title, message, type, cb)

    let finalDuration = (1000 * 7) + 1000
    if(duration) finalDuration = duration
    const element = $(document.createElement("div")).addClass("notification").addClass(type)
    element.append($(document.createElement("div")).append($(document.createElement("h3")).html(title)).append($(document.createElement("p")).html(message)))
    element.append($(document.createElement("i")).addClass(["bi", "bi-x-lg"]).click(async function(){
        removeCtxMenu("notification")
        element.remove()
        removeNotification(title, message, type)
    }))
    element.css("animation", "notificationSlideIn 1000ms")
    setTimeout(function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    }, finalDuration)
    element.click(async function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
        cb()
        removeNotification(title, message, type)
    })
    $("body").append(element)
    createCtxMenu(".notification", "notification", `
        <button>Dismiss</button>
        <button>Close</button>
    `, async function(i, element2){
        if(i == 0){
            element.css("animation", "notificationSlideOut 1000ms")
            removeCtxMenu("notification")
            setTimeout(() => element.remove(), 750)
            removeNotification(title, message, type)
        }
        else if(i == 1){
            removeCtxMenu("notification")
            element.remove()
            removeNotification(title, message, type)
        }
    })
}

// create an notification in the bottom right with a specified duration
async function notify(title, message, type, duration){
    const res = await get("/api/settings")
    if(!res.notifications) return

    addToNotificationsCenter(title, message, type)

    let finalDuration = (1000 * 7) + 1000
    if(duration) finalDuration = duration
    const element = $(document.createElement("div")).addClass("notification").addClass(type)
    element.append($(document.createElement("div")).append($(document.createElement("h3")).html(title)).append($(document.createElement("p")).html(message)))
    element.append($(document.createElement("i")).addClass(["bi", "bi-x-lg"]).click(async function(){
        removeCtxMenu("notification")
        element.remove()
        removeNotification(title, message, type)
    }))
    element.css("animation", "notificationSlideIn 1000ms")
    setTimeout(function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
    }, finalDuration)
    element.click(async function(){
        element.css("animation", "notificationSlideOut 1000ms")
        removeCtxMenu("notification")
        setTimeout(() => element.remove(), 750)
        removeNotification(title, message, type)
    })
    $("body").append(element)
    createCtxMenu(".notification", "notification", `
        <button>Dismiss</button>
        <button>Close</button>
    `, async function(i, element2){
        if(i == 0){
            element.css("animation", "notificationSlideOut 1000ms")
            removeCtxMenu("notification")
            setTimeout(() => element.remove(), 750)
            removeNotification(title, message, type)
        }
        else if(i == 1){
            removeCtxMenu("notification")
            element.remove()
            removeNotification(title, message, type)
        }
    })
}

// send a notification on the computer, like in windows the toast notification in the bottom right
async function notifyComputer(title, message){
    const res = await get("/api/settings")
    if(!res.desktopNotifications) return

    const res2 = await send("/api/notify", {title, message})
}

async function addToNotificationsCenter(title, message, type, cb){
    const addRes = await send("/api/notifications/add", {title, message, type, cb})
    console.log("addRes", addRes)
    setNotifications()
}

setNotifications()
async function setNotifications(){
    const notifications = await get("/api/notifications")
    console.log("notifications", notifications)
    $("#notificationsCenter .wrapper .content").get(0).replaceChildren()
    for (let i = 0; i < notifications.length; i++) {
        const element = notifications[i];
        createNotificationElement(element, i)
    }
}

function createNotificationElement(notification, i){
    const element = $(document.createElement("div")).addClass("element").addClass(notification.type)
    element.append($(document.createElement("div")).append($(document.createElement("h3")).html(notification.title)).append($(document.createElement("p")).html(notification.message)))
    element.append($(document.createElement("i")).addClass(["bi", "bi-x-lg"]).click(async function(){
        element.remove()
        const res = await send("/api/notifications/remove", {i})
        console.log(res)
    }))
    element.click(async function(){
        //
        //
        //
        //
        //
        //
        // ************************* !!! HIER WEITERMACHEN !!! *******************************************************************************************************************************************************************************
        //
        //
        //
        //
        //
        //

        console.log("cb", notification.cb)
        if(notification.cb) notification.cb()

        //
        //
        //
        //
        //
        //

        element.remove()
        const res = await send("/api/notifications/remove", {i})
        console.log(res)
    })
    $("#notificationsCenter .wrapper .content").append(element)
}

async function removeNotification(title, message, type){
    const res = await send("/api/notifications/remove", {title, message, type})
    console.log(res)
    setNotifications()
}

// search for "caccordion" HTML elements and make them clickable if they not already are
setAccordions()
function setAccordions(){
    const accordions = $(".caccordion").map(function(){return this}).get()
    for (let i = 0; i < accordions.length; i++) {
        const element = accordions[i];
        if($(element).attr("listener") == "true") continue
        $(element).attr("listener", "true")
        $(element).next().click(function(e){
            e.stopImmediatePropagation()
        })
        $(element).next().dblclick(function(e){
            e.stopImmediatePropagation()
        })

        $(element).dblclick(function(e){
            e.stopImmediatePropagation()
        })       
        $(element).click(function(e){
            e.stopImmediatePropagation()
            if($(element).next().hasClass("cpanel")){
                if($(element).next().css("display") == "none"){
                    $(element).next().css("display", "block")
                    $(element).addClass("active")
                    $(element).children().last().removeClass("bi-caret-down")
                    $(element).children().last().addClass("bi-caret-up")
                }
                else{
                    $(element).next().css("display", "none")
                    $(element).removeClass("active")
                    $(element).children().last().addClass("bi-caret-down")
                    $(element).children().last().removeClass("bi-caret-up")
                } 
            }
        })
        $(element).append($(document.createElement("i")).addClass(["caccordion-arrow", "bi", "bi-caret-down"]))
    }
}

// get back to last page if it was not the "loading" page
function back(){
    if(!/\S/.test(document.referrer) || document.referrer == location.href ) return
    else history.back()
}