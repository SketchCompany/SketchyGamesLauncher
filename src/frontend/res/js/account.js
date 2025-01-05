let user
$(document).ready(async function(){
    $("#logout").attr("disabled", " ")
    $("#logout").html("").append($(document.createElement("span")).addClass(["spinner-grow", "spinner-grow-sm"]).attr("role", "status"))
    $("#saveAccount").attr("disabled", " ")
    $("#saveAccount").html("").append($(document.createElement("span")).addClass(["spinner-grow", "spinner-grow-sm"]).attr("role", "status"))
    const res = await get("/api/account", true)
    console.log(res)
    $("#logout").removeAttr("disabled")
    $("#logout").html("<span class='bi bi-box-arrow-left'></span> Abmelden")
    $("#saveAccount").removeAttr("disabled")
    $("#saveAccount").html("<span class='bi bi-floppy2-fill'></span> Änderungen Speichern")
    if(res.status == 1){
        user = res.data
        $("#username").val(res.data.user).attr("placeholder", "Dein Benutzername")
        $("#email").val(res.data.email).attr("placeholder", "Deine Email")
        $("#password").val(res.data.password).attr("placeholder", "Dein Passwort")
        res.data.games = JSON.parse(res.data.games)
        for (let i = 0; i < res.data.games.length; i++) {
            const element = res.data.games[i];
            $(".history").append(`
                <div class="caccordion">${element.name}</div>
                <div class="cpanel">
                    <p>Erworben am: <span class="marked">${element.purchased}</span><br>Letzter Download am: <span class="marked">${element.lastDownload}</span></p>
                    <button class="marked" onclick="openSite('/store/${element.name}')"><span class="bi bi-box-arrow-up-left"></span> Zur Store Seite</button>
                </div>
            `)
        }
        setAccordions()
    }
    else{
        notifyCb("Fehlgeschlagen", res.data + "<br>Klicke um dich neu anzumelden.", "error", function(){
            openSite("/login")
        })
        setTimeout(() => openSite("/login"), 5000)
    }
    $("#logout").click(function(){
        const res = get("/api/account/logout")
        console.log(res)
        notify("Abgemeldet", "Du wurdest abgemeldet und wirst zur Anmelde Seite geleitet.", "note", 1000)
        setTimeout(() => openSite("/login"), 2000)
    })

    $("#saveAccount").click(async function(){
        if(!$("#usernameInvalid").hasClass("invalid") && !$("#emailInvalid").hasClass("invalid") && !$("#passwordInvalid").hasClass("invalid")){
            const res = await send("/api/account/update", {user: $("#username").val(), email: $("#email").val(), password: $("#password").val()}, true)
            console.log(res)
            if(res.status == 1){
                notifyCb("Erfolgreich", res.data + " Klicke zum neuladen!", "success", 5000, function(){
                    location.reload()
                })
                setTimeout(function(){
                    location.reload()
                }, 5000)
            }
            else{
                notify("Fehlgeschlagen", res.data, "error")
            }
        }
        else{
            notify("Ungültige Informationen", "Deine Account Informationen sind ungültig und müssen geändert werden. Passe sie an die Anforderungen an und versuche es nochmal!", "warning")
        }
    })
    
    $("#username").keyup(function(e){
        const username = $("#username").val()
        if(!/\S/.test(username)){
            setUsernameInvalid("Benutzername leer")
        }
        else if(username.includes("\"") ||
            username.includes("§") ||
            username.includes("$") ||
            username.includes("%") ||
            username.includes("&") ||
            username.includes("/") ||
            username.includes("\\") ||
            username.includes("=") ||
            username.includes("?") ||
            username.includes("`") ||
            username.includes("´") ||
            username.includes("*") ||
            username.includes(",") ||
            username.includes(";") ||
            username.includes(":") ||
            username.includes("<") ||
            username.includes(">") ||
            username.includes("²") ||
            username.includes("³") ||
            username.includes("{") ||
            username.includes("}") ||
            username.includes("[") ||
            username.includes("]") ||
            username.includes("^") ||
            username.includes("|") ||
            username.includes("~") ||
            username.includes("@") ||
            username.includes("€")
        ){
            setUsernameInvalid("Benutzername enthält ungültige Zeichen")
        }
        else if(username.length < 3){
            setUsernameInvalid("Benutzername zu kurz")
        }
        else if(username.length > 20){
            setUsernameInvalid("Benutzername zu lang")
        }
        else{   
            setUsernameValid("Der Benutzername ist perfekt")
        }
    })
    $("#email").keyup(function(e){
        $("#saveAccount").css("display", "none")
        const email = $("#email").val()
        if(!/\S/.test(email)){
            setEmailInvalid("Email leer")
        }
        else if(email.includes("\"") ||
            email.includes("§") ||
            email.includes("$") ||
            email.includes("%") ||
            email.includes("&") ||
            email.includes("/") ||
            email.includes("\\") ||
            email.includes("=") ||
            email.includes("?") ||
            email.includes("`") ||
            email.includes("´") ||
            email.includes("*") ||
            email.includes(",") ||
            email.includes(";") ||
            email.includes(":") ||
            email.includes("<") ||
            email.includes(">") ||
            email.includes("²") ||
            email.includes("³") ||
            email.includes("{") ||
            email.includes("}") ||
            email.includes("[") ||
            email.includes("]") ||
            email.includes("^") ||
            email.includes("|") ||
            email.includes("~") ||
            email.includes("#") ||
            email.includes("'") ||
            email.includes("+") ||
            email.includes("€") 
        ){
            setEmailInvalid("Email enthält ungültige Zeichen")
        }
        else if(email.length < 5){
            setEmailInvalid("Email zu kurz")
        }
        else if(!email.includes("@") || !email.substring(email.indexOf("@")).includes(".")){
            setEmailInvalid("Email nicht vollständig")
        }
        else{   
            setEmailValid("Die Email gefällt uns")
        }
    })
    $("#password").keyup(function(e){
        $("#saveAccount").css("display", "none")
        const password = $("#password").val()
        if(!/\S/.test(password)){
            setPasswordInvalid("Passwort leer")
        }
        else if(password.includes("\"") ||
            password.includes("§") ||
            password.includes("%") ||
            password.includes("\\") ||
            password.includes("=") ||
            password.includes("`") ||
            password.includes("´") ||
            password.includes(",") ||
            password.includes(";") ||
            password.includes("<") ||
            password.includes(">") ||
            password.includes("²") ||
            password.includes("³") ||
            password.includes("{") ||
            password.includes("}") ||
            password.includes("[") ||
            password.includes("]") ||
            password.includes("^") ||
            password.includes("|") ||
            password.includes("~") ||
            password.includes("€")
        ){
            setPasswordInvalid("Passwort enthält ungültige Zeichen")
        }
        else if(password.length < 8){
            setPasswordInvalid("Passwort zu kurz")
        }
        else if(password.length > 50){
            setPasswordInvalid("Passwort zu lang")
        }
        else if(!password.includes(".") &&
            !password.includes("!") &&
            !password.includes("$") &&
            !password.includes("&") &&
            !password.includes(":") &&
            !password.includes("#") &&
            !password.includes("+") &&
            !password.includes("*") &&
            !password.includes("_") &&
            !password.includes("-") &&
            !password.includes("?") &&
            !password.includes("@") &&
            !password.includes("/")
        ){
            setPasswordInvalid("Mind. 1 Sonderzeichen")
        }
        else if(!password.includes("0") &&
            !password.includes("1") &&
            !password.includes("2") &&
            !password.includes("3") &&
            !password.includes("4") &&
            !password.includes("5") &&
            !password.includes("6") &&
            !password.includes("7") &&
            !password.includes("8") &&
            !password.includes("9")
        ){
            setPasswordInvalid("Mind. 1 Zahl")
        }
        else{
            setPasswordValid("Das Passwort ist sehr stark")
        }
    })

    $("#username").keyup(function(e){
        const username = $("#username").val()
        if($("#usernameInvalid").hasClass("valid") && username != user.user){
            $("#saveAccount").css("display", "block")
            $("#saveAccount").css("animation", "moveInFromLeft 750ms")
        }
        else{
            $("#saveAccount").css("animation", "moveOutToLeft 750ms")
            setTimeout(function(){
                $("#saveAccount").css("display", "none")
            }, 300)
        } 
    })
    $("#email").keyup(function(e){
        const email = $("#email").val()
        if($("#emailInvalid").hasClass("valid") && email != user.email){
            $("#saveAccount").css("display", "block")
            $("#saveAccount").css("animation", "moveInFromLeft 750ms")
        }
        else{
            $("#saveAccount").css("animation", "moveOutToLeft 750ms")
            setTimeout(function(){
                $("#saveAccount").css("display", "none")
            }, 300)
        }
    })
    $("#password").keyup(function(e){
        const password = $("#password").val()
        if($("#passwordInvalid").hasClass("valid") && password != user.password){
            $("#saveAccount").css("display", "block")
            $("#saveAccount").css("animation", "moveInFromLeft 750ms")
        }
        else{
            $("#saveAccount").css("animation", "moveOutToLeft 750ms")
            setTimeout(function(){
                $("#saveAccount").css("display", "none")
            }, 300)
        }
    })
})

function setUsernameInvalid(text){
    $("#usernameInvalid").children().first().css("opacity", "1")
    if($("#usernameInvalid").hasClass("valid")) $("#usernameInvalid").removeClass("valid")            
    $("#usernameInvalid").addClass("invalid")
    $("#usernameInvalid").children().first().html(text)
}
function setUsernameValid(text){
    $("#usernameInvalid").children().first().css("opacity", "1")
    if($("#usernameInvalid").hasClass("invalid")) $("#usernameInvalid").removeClass("invalid")            
    $("#usernameInvalid").addClass("valid")
    $("#usernameInvalid").children().first().html(text)
}
function setEmailInvalid(text){
    $("#emailInvalid").children().first().css("opacity", "1")
    if($("#emailInvalid").hasClass("valid")) $("#emailInvalid").removeClass("valid")            
    $("#emailInvalid").addClass("invalid")
    $("#emailInvalid").children().first().html(text)
}
function setEmailValid(text){
    $("#emailInvalid").children().first().css("opacity", "1")
    if($("#emailInvalid").hasClass("invalid")) $("#emailInvalid").removeClass("invalid")            
    $("#emailInvalid").addClass("valid")
    $("#emailInvalid").children().first().html(text)
}
function setPasswordInvalid(text){
    $("#passwordInvalid").children().first().css("opacity", "1")
    if($("#passwordInvalid").hasClass("valid")) $("#passwordInvalid").removeClass("valid")            
    $("#passwordInvalid").addClass("invalid")
    $("#passwordInvalid").children().first().html(text)
}
function setPasswordValid(text){
    $("#passwordInvalid").children().first().css("opacity", "1")
    if($("#passwordInvalid").hasClass("invalid")) $("#passwordInvalid").removeClass("invalid")            
    $("#passwordInvalid").addClass("valid")
    $("#passwordInvalid").children().first().html(text)
}