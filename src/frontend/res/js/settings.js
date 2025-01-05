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
        if(originalSettings.installationPath != newSettings.installationPath){
            const dialog = createDialog("Verschieben", "Da das Installations Verzeichnis geändert wurde, nehmen wir an das du auch deine Spiele dort hin verschieben willst. Möchtest du deine installierten Spiele und Programme verschieben?", `
                <div style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
                    <button id="dialog-move-yes" class="marked"><span class="bi bi-folder-symlink"></span> Ja - Verschieben</button>
                    <button id="dialog-move-no"><span class="bi bi-x-circle"></span> Nein - Nicht Verschieben</button>
                </div>
            `, 500, 400)
            $("#dialog-move-yes").click(async function(){
                const resMove = await send("/api/settings/move", {oldInstallationPath: originalSettings.installationPath, newInstallationPath: newSettings.installationPath})
                console.log(resMove)
                removeDialog(dialog)
            })
            $("#dialog-move-no").click(() => removeDialog(dialog))
        }
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