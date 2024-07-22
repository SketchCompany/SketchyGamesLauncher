const code = getRandomInt(100000, 1000000)
$(document).ready(async function(){
    createCtxMenu("html", "login-default", `
        <button onclick="back()">Zurück</button>
        <button onclick="location.reload()">Neuladen</button>
    `, () => {})
    
    if(!localStorage.getItem("signUpData")) openSite("/signup")
    const userData = JSON.parse(localStorage.getItem("signUpData"))
    const user = userData.user
    const email = userData.email
    const subject = "Verification Code"
    const message = "this email got sent to you to verify your Sketch Company account, because of security reasons. We use this code to check that your email exists and correct for purposes like the recovering of your account if you forgot your password. To verify your account, use the code below and copy it to your clipboard and paste it into the input field. Or type it one by one into the input field. Here is your verification code:<h1>" + code + "</h1>If the code doesn't work or you got other problems, join our <a href=\"https://discord.gg/u94GDJycP4\">Discord Server</a> or send us an email at <a href=\"mailto:sketch-company@web.de\">sketch-company@web.de</a>.<br><br>Best Wishes<br><br>Your Sketch Company Team"
    const res = await send("/api/email", {
        user,
        email,
        subject,
        message,
    })
    console.log("email: res", res)


    $(".input-code").children().first().on("paste", function(e){
        e.preventDefault()
        e.stopImmediatePropagation()
        const pasted = e.originalEvent.clipboardData.getData('Text');
        if(pasted.length > 6){
            notify("Fehlgeschlagen", "Der Code aus der Zwischenablage ist zu lang!", "error")
            return
        }
        for (let i = 0; i < pasted.length; i++) {
            const codeNumber = pasted[i];
            $("#code" + i).val(codeNumber)
            $("#code" + i).focus()
        }
    })
    $(".input-code").children().last().keyup(function(){
        $("#submit").click()
    })
    $("#submit").click(async function(){
        const codes = $(".input-code").children().map(function(){return this})
        for (let i = 0; i < codes.length; i++) {
            const element = $(codes[i]);
            if(element.val() != code.toString()[i]){
                notify("Fehlgeschlagen", "Der Verifikations Code ist falsch.", "error")
                return
            }
        }
        signUp()
    })
})
async function signUp(){
    const userData = JSON.parse(localStorage.getItem("signUpData"))
    const res = await send("/api/account/signup", userData)
    console.log(res)
    if(res.exists){
        notifyCb("Fehlgeschlagen", "Ein Nutzer mit diesen Daten existiert bereits! Bitte ändere den Benutzernamen oder die Email und probiers nochmal. Klick um zurück zur Regestrierungs Seite zu kommen.", "error", 100000, function(){
            openSite("/signup")
        })
        // localStorage.removeItem("signUpData")
        // setTimeout(() => openSite("/signup"), 10000)
    }
    else{
        notifyCb("Erfolgreich", "Erfolgreich regestriert als " + userData.user + ". Lade Startseite...<br>Klicke um direkt zur Startseite zu kommen.", "success", 4000, function(){
            openSite("/")
        })
        localStorage.removeItem("signUpData")
        setTimeout(() => openSite("/"), 5000)
    }
}
function getRandomInt(min, max) {
    const minCeiled = Math.ceil(min)
    const maxFloored = Math.floor(max)
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled)
}