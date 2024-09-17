let originalSettings

$(document).ready(async function(){
    const settings = await get("/api/settings")
    console.log(settings)
    originalSettings = settings

    // set settings
    $("#version").html(settings.version)
    $("#installationPath").val(settings.installationPath)
    if(settings.notifications){
        $("#notifications").attr("checked", "")
    }
    if(settings.desktopNotifications){
        $("#desktopNotifications").attr("checked", "")
    }
    if(settings.loginOnStartup){
        $("#loginOnStartup").attr("checked", "")
    }
    $($("#actionAfterGameStarted").children().get(settings.actionAfterGameStarted)).attr("selected", "")
    if(settings.console){
        $("#console").attr("checked", "")
    }

    $("#submit").click(async function(){
        const newSettings = {
            installationPath: $("#installationPath").val(),
            notifications: isChecked("#notifications"),
            desktopNotifications: isChecked("#desktopNotifications"),
            loginOnStartup: isChecked("#loginOnStartup"),
            actionAfterGameStarted: getSelected("#actionAfterGameStarted"),
            console: isChecked("#console")
        }
        console.log("newSettings", newSettings)
        const res = await send("/api/settings", newSettings)
        console.log(res)
        notify("Gespeichert", "Alle Änderungen wurden erfolgreich gespeichert!", "success", 5000)
    })

    $("#installationPath").focus(function(){
        $("#installationPath").blur()
    })    

    $("#installationPath").click(async function(){
        $("#installationPath").blur()
        const res = await get("/api/settings/open")
        console.log(res)
        if(res.length == 0) return
        $("#installationPath").val(res[0]) + "/"
        $("#submit").focus()
    })
})

function isChecked(selector){
    if($(selector).get(0).checked) return true
    else return false
}
function getSelected(selector){
    const options = $(selector).children().map(function(){return this}).get()
    for (let i = 0; i < options.length; i++) {
        const element = $(options[i]);
        if(element.get(0).selected) return i
    }
    console.error("getSelected: could not find selected in", options, "from", selector)
    return 0
}