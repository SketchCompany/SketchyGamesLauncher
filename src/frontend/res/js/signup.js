$(document).ready(function(){
    $("input").map(function(){return this}).get(0).focus()
    createCtxMenu("html", "login-default", `
        <button onclick="back()">Zurück</button>
        <button onclick="location.reload()">Neuladen</button>
    `, () => {})
    
    if(sessionStorage.getItem("signUpData")){
        const oldData = sessionStorage.getItem("signUpData")
        $("#username").val(oldData.user)
        $("#email").val(oldData.email)
        $("#password").val(oldData.password)
        $("#passwordConfirm").val(oldData.password)
        sessionStorage.removeItem("signUpData")
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
$("#passwordConfirm").keyup(function(e){
    const passwordConfirm = $("#passwordConfirm").val()
    if(!/\S/.test(passwordConfirm)){
        setPasswordConfirmInvalid("Passwort leer")
    }
    else if(passwordConfirm.includes("\"") ||
        passwordConfirm.includes("§") ||
        passwordConfirm.includes("%") ||
        passwordConfirm.includes("\\") ||
        passwordConfirm.includes("=") ||
        passwordConfirm.includes("`") ||
        passwordConfirm.includes("´") ||
        passwordConfirm.includes(",") ||
        passwordConfirm.includes(";") ||
        passwordConfirm.includes("<") ||
        passwordConfirm.includes(">") ||
        passwordConfirm.includes("²") ||
        passwordConfirm.includes("³") ||
        passwordConfirm.includes("{") ||
        passwordConfirm.includes("}") ||
        passwordConfirm.includes("[") ||
        passwordConfirm.includes("]") ||
        passwordConfirm.includes("^") ||
        passwordConfirm.includes("|") ||
        passwordConfirm.includes("~") ||
        passwordConfirm.includes("€")
    ){
        setPasswordConfirmInvalid("Passwort enthält ungültige Zeichen")
    }
    else if(passwordConfirm.length < 8){
        setPasswordConfirmInvalid("Passwort zu kurz")
    }
    else if(passwordConfirm.length > 50){
        setPasswordConfirmInvalid("Passwort zu lang")
    }
    else if(!passwordConfirm.includes(".") &&
        !passwordConfirm.includes("!") &&
        !passwordConfirm.includes("$") &&
        !passwordConfirm.includes("&") &&
        !passwordConfirm.includes(":") &&
        !passwordConfirm.includes("#") &&
        !passwordConfirm.includes("+") &&
        !passwordConfirm.includes("*") &&
        !passwordConfirm.includes("_") &&
        !passwordConfirm.includes("-") &&
        !passwordConfirm.includes("?") &&
        !passwordConfirm.includes("@") &&
        !passwordConfirm.includes("/")
    ){
        setPasswordConfirmInvalid("Mind. 1 Sonderzeichen")
    }
    else if(!passwordConfirm.includes("0") &&
        !passwordConfirm.includes("1") &&
        !passwordConfirm.includes("2") &&
        !passwordConfirm.includes("3") &&
        !passwordConfirm.includes("4") &&
        !passwordConfirm.includes("5") &&
        !passwordConfirm.includes("6") &&
        !passwordConfirm.includes("7") &&
        !passwordConfirm.includes("8") &&
        !passwordConfirm.includes("9")
    ){
        setPasswordConfirmInvalid("Mind. 1 Zahl")
    }
    else{
        setPasswordConfirmValid("Das Passwort ist sehr stark")
    }
})
$("#username").keypress(function(e){
    if(e.key == "Enter") $("#email").focus()
})
$("#email").keypress(function(e){
    if(e.key == "Enter") $("#password").focus()
})
$("#password").keypress(function(e){
    if(e.key == "Enter") $("#passwordConfirm").focus()
})
$("#passwordConfirm").keypress(function(e){
    if(e.key == "Enter") $("#submit").click()
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
function setPasswordConfirmInvalid(text){
    $("#passwordConfirmInvalid").children().first().css("opacity", "1")
    if($("#passwordConfirmInvalid").hasClass("valid")) $("#passwordConfirmInvalid").removeClass("valid")            
    $("#passwordConfirmInvalid").addClass("invalid")
    $("#passwordConfirmInvalid").children().first().html(text)
}
function setPasswordConfirmValid(text){
    $("#passwordConfirmInvalid").children().first().css("opacity", "1")
    if($("#passwordConfirmInvalid").hasClass("invalid")) $("#passwordConfirmInvalid").removeClass("invalid")            
    $("#passwordConfirmInvalid").addClass("valid")
    $("#passwordConfirmInvalid").children().first().html(text)
}
$("#submit").click(signup)
async function signup(){
    if($("#usernameInvalid").hasClass("invalid") || 
        $("#emailInvalid").hasClass("invalid") ||
        $("#passwordInvalid").hasClass("invalid") ||
        $("#passwordConfirmInvalid").hasClass("invalid")
    ){
        notify("Fehlgeschalgen", "Deine Regestrierungsdaten sind ungültig. Überprüfe sie und probiers nochmal.", "error")
        console.error("invalid sign up")
        return
    }
    const user = $("#username").val()
    const email = $("#email").val()
    const password = $("#password").val()
    const passwordConfirm = $("#passwordConfirm").val()
    if(password != passwordConfirm){
        notify("Fehlgeschalgen", "Dein Passwort ist nicht das selbe wie dein Bestätigungs Passwort. Überprüfe ob sie gleich sind und probiers nochmal.", "error")
        console.error("invalid sign up")
        return
    }
    const status = await get("/api/connection")
    if(status == 2){
        const res = await send("https://api.sketch-company.de/u/check", {user, email})
        console.log(res)
        if(res){
            notify("Sorry", "Ein Nutzer mit diesen Daten existiert bereits! Bitte ändere den Benutzernamen oder die Email und probiers nochmal.", "error", 10000)
        }
        else{
            sessionStorage.setItem("signUpData", JSON.stringify({user, email, password}))
            setTimeout(() => openSite("/verify"), 1000)
        }
        // const res = await send("/api/account/signup", {user, email, password})
        // console.log(res)
        // if(res.exists){
        //     notify("Fehlgeschalgen", res.data, "error")
        // }
        // else{
        //     notify("Erfolgreich", "Du hast dich erfolgreich regestriert.", "success")
        //     setTimeout(() => openSite("/"), 5000)
        // }
    }
    else if(status == 1){
        notify("Keine Verbindung", "Keine Verbindung zum Server.", "error")
    }
    else{
        notify("Keine Verbindung", "Keine Internet Verbindung.", "error")
    }
}