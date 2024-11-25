$(document).ready(function(){
    $("input").map(function(){return this}).get(0).focus()
    createCtxMenu("html", "login-default", `
        <button onclick="back()">Zurück</button>
        <button onclick="location.reload()">Neuladen</button>
    `, () => {})
})
// $("#username").keyup(function(e){
//     const username = $("#username").val()
//     if(!/\S/.test(username)){
//         setUsernameInvalid("Benutzername ist leer")
//     }
//     else if(username.includes("\"") ||
//         username.includes("§") ||
//         username.includes("$") ||
//         username.includes("%") ||
//         username.includes("&") ||
//         username.includes("/") ||
//         username.includes("\\") ||
//         username.includes("=") ||
//         username.includes("?") ||
//         username.includes("`") ||
//         username.includes("´") ||
//         username.includes("*") ||
//         username.includes(",") ||
//         username.includes(";") ||
//         username.includes(":") ||
//         username.includes("<") ||
//         username.includes(">") ||
//         username.includes("²") ||
//         username.includes("³") ||
//         username.includes("{") ||
//         username.includes("}") ||
//         username.includes("[") ||
//         username.includes("]") ||
//         username.includes("^") ||
//         username.includes("|") ||
//         username.includes("~") ||
//         username.includes("@") ||
//         username.includes("€")
//     ){
//         setUsernameInvalid("Benutzername enthält ungültige Zeichen")
//     }
//     else if(username.length < 3){
//         setUsernameInvalid("Benutzername ist zu kurz")
//     }
//     else if(username.length > 20){
//         setUsernameInvalid("Benutzername ist zu lang")
//     }
//     else{   
//         setUsernameValid("Der Benutzername ist perfekt")
//     }
// })
// $("#password").keyup(function(e){
//     const password = $("#password").val()
//     if(!/\S/.test(password)){
//         setPasswordInvalid("Passwort ist leer")
//     }
//     else if(password.includes("\"") ||
//         password.includes("§") ||
//         password.includes("%") ||
//         password.includes("\\") ||
//         password.includes("=") ||
//         password.includes("`") ||
//         password.includes("´") ||
//         password.includes(",") ||
//         password.includes(";") ||
//         password.includes(":") ||
//         password.includes("<") ||
//         password.includes(">") ||
//         password.includes("²") ||
//         password.includes("³") ||
//         password.includes("{") ||
//         password.includes("}") ||
//         password.includes("[") ||
//         password.includes("]") ||
//         password.includes("^") ||
//         password.includes("|") ||
//         password.includes("~") ||
//         password.includes("€")
//     ){
//         setPasswordInvalid("Passwort enthält ungültige Zeichen")
//     }
//     else if(password.length < 8){
//         setPasswordInvalid("Passwort ist zu kurz")
//     }
//     else if(password.length > 50){
//         setPasswordInvalid("Passwort ist zu lang")
//     }
//     else if(!password.includes(".") &&
//         !password.includes("!") &&
//         !password.includes("$") &&
//         !password.includes("&") &&
//         !password.includes(":") &&
//         !password.includes("#") &&
//         !password.includes("+") &&
//         !password.includes("*") &&
//         !password.includes("_") &&
//         !password.includes("-") &&
//         !password.includes("?") &&
//         !password.includes("/")
//     ){
//         setPasswordInvalid("Mind. 1 Sonderzeichen")
//     }
//     else if(!password.includes("0") &&
//         !password.includes("1") &&
//         !password.includes("2") &&
//         !password.includes("3") &&
//         !password.includes("4") &&
//         !password.includes("5") &&
//         !password.includes("6") &&
//         !password.includes("7") &&
//         !password.includes("8") &&
//         !password.includes("9")
//     ){
//         setPasswordInvalid("Mind. 1 Zahl")
//     }
//     else{
//         setPasswordValid("Das Passwort ist sehr stark")
//     }
// })
$("#username").keypress(function(e){
    if(e.key == "Enter") $("#password").focus()
})
$("#password").keypress(function(e){
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
$("#submit").click(login)
async function login(){
    if($("#submit").attr("disabled")) return
    if($("#usernameInvalid").hasClass("invalid") || $("#passwordInvalid").hasClass("invalid")){
        notify("Fehlgeschlagen", "Deine Anmeldedaten sind ungültig. Überprüfe sie und probiers nochmal!", "error")
        console.error("invalid login")
        return
    }
    $("#submit").attr("disabled", " ")
    $("#submit").html("").append($(document.createElement("span")).addClass(["spinner-grow", "spinner-grow-sm"]).attr("role", "status"))
    const userOrEmail = $("#username").val()
    const password = $("#password").val()
    const res = await send("/api/account/login", {userOrEmail, password})
    console.log(res)
    if(!res.correct){
        notify("Fehlgeschlagen", res.data, "error", 15000)
        $("#submit").removeAttr("disabled")
        $("#submit").html("Anmelden")
    }
    else{
        notifyCb("Erfolgreich", "Angemeldet als " + res.data.user + ". Lade Startseite...<br>Klicke um direkt zur Startseite zu kommen.", "success", 2000, function(){
            openSite("/")
        }, true)
        setTimeout(() => openSite("/"), 2000)
    }
}