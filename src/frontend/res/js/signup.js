$(document).ready(function () {
    $("input").first().focus();
  
    createCtxMenu("html", "login-default", `
        <button onclick="back()"><span class="bi bi-arrow-left-circle"></span> Zurück</button>
        <button onclick="location.reload()"><span class="bi bi-arrow-clockwise"></span> Neuladen</button>
    `, () => {});
  
    const signUpData = sessionStorage.getItem("signUpData");
    if (signUpData) {
      const { user, email, password } = JSON.parse(signUpData);
      $("#username").val(user);
      $("#email").val(email);
      $("#password, #passwordConfirm").val(password);
      sessionStorage.removeItem("signUpData");
    }
  });

  const forbiddenUsername = ['"', '§', '$', '%', '&', '/', '\\', '=', '?', '`', '´', '*', ',', ';',':', '<', '>', '²', '³', '{', '}', '[', ']', '^', '|', '~', '@', '€'];
  const forbiddenEmail = Array.from(forbiddenUsername);
  forbiddenEmail.push(['#', "'", '+']);
  forbiddenEmail.splice(forbiddenEmail.indexOf("@"), 1);
  const forbiddenPassword = ['"', '§', '%', '\\', '=', '`', '´', ',', ';', '<', '>', '²', '³', '{','}', '[', ']', '^', '|', '~', '€'];
  
  const hasForbidden = (text, forbidden) => forbidden.some(char => text.includes(char));
  
  const setValidity = ($container, text, isValid) => {
    const validClass = "valid", invalidClass = "invalid";
    $container.children().first().css("opacity", "1")
      .html(text);
    $container.removeClass(isValid ? invalidClass : validClass)
      .addClass(isValid ? validClass : invalidClass);
  };
  
  $("#username").on("keyup", () => {
    const username = $("#username").val().trim();
    if (!username) {
      setValidity($("#usernameInvalid"), "Benutzername leer", false);
    } else if (hasForbidden(username, forbiddenUsername)) {
      setValidity($("#usernameInvalid"), "Benutzername enthält ungültige Zeichen", false);
    } else if (username.length < 3) {
      setValidity($("#usernameInvalid"), "Benutzername zu kurz", false);
    } else if (username.length > 20) {
      setValidity($("#usernameInvalid"), "Benutzername zu lang", false);
    } else {
      setValidity($("#usernameInvalid"), "Der Benutzername ist perfekt", true);
    }
  });
  
  $("#email").on("keyup", () => {
    const email = $("#email").val().trim();
    if (!email) {
      setValidity($("#emailInvalid"), "Email leer", false);
    } else if (hasForbidden(email, forbiddenEmail)) {
      setValidity($("#emailInvalid"), "Email enthält ungültige Zeichen", false);
    } else if (email.length < 5) {
      setValidity($("#emailInvalid"), "Email zu kurz", false);
    } else if (!email.includes("@") || !email.substring(email.indexOf("@")).includes(".")) {
      setValidity($("#emailInvalid"), "Email nicht vollständig", false);
    } else {
      setValidity($("#emailInvalid"), "Die Email gefällt uns", true);
    }
  });
  
  const validatePassword = (password, $output) => {
    if (!password.trim()) {
      setValidity($output, "Passwort leer", false);
    } else if (hasForbidden(password, forbiddenPassword)) {
      setValidity($output, "Passwort enthält ungültige Zeichen", false);
    } else if (password.length < 8) {
      setValidity($output, "Passwort zu kurz", false);
    } else if (password.length > 50) {
      setValidity($output, "Passwort zu lang", false);
    } else if (!/[.!$&:#+*_\-?@/]/.test(password)) {
      // Mindestens 1 Sonderzeichen aus der Liste
      setValidity($output, "Mind. 1 Sonderzeichen", false);
    } else if (!/\d/.test(password)) {
      // Mindestens 1 Zahl
      setValidity($output, "Mind. 1 Zahl", false);
    } else {
      setValidity($output, "Das Passwort ist sehr stark", true);
    }
  };
  
  $("#password").on("keyup", () => {
    const password = $("#password").val();
    validatePassword(password, $("#passwordInvalid"));
  });
  $("#passwordConfirm").on("keyup", () => {
    const passwordConfirm = $("#passwordConfirm").val();
    validatePassword(passwordConfirm, $("#passwordConfirmInvalid"));
  });
  
  $("#username").on("keypress", e => { if (e.key === "Enter") $("#email").focus(); });
  $("#email").on("keypress", e => { if (e.key === "Enter") $("#password").focus(); });
  $("#password").on("keypress", e => { if (e.key === "Enter") $("#passwordConfirm").focus(); });
  $("#passwordConfirm").on("keypress", e => { if (e.key === "Enter") $("#submit").click(); });
  
  $("#submit").click(signup);
  async function signup() {
    if ($("#submit").attr("disabled")) return;
  
    if (
      $("#usernameInvalid").hasClass("invalid") ||
      $("#emailInvalid").hasClass("invalid") ||
      $("#passwordInvalid").hasClass("invalid") ||
      $("#passwordConfirmInvalid").hasClass("invalid")
    ) {
      notify("Fehlgeschalgen", "Deine Registrierungsdaten sind ungültig. Überprüfe sie und probiers nochmal.", "error");
      console.error("invalid sign up");
      return;
    }
  
    const user = $("#username").val().trim();
    const email = $("#email").val().trim();
    const password = $("#password").val();
    const passwordConfirm = $("#passwordConfirm").val();
  
    if (password !== passwordConfirm) {
      notify("Fehlgeschalgen", "Dein Passwort stimmt nicht mit dem Bestätigungs Passwort überein.", "error");
      console.error("invalid sign up");
      return;
    }
  
    const status = await get("/api/connection");
    if (status === 2) {
      $("#submit").attr("disabled", true)
        .html($("<span>").addClass(["spinner-grow", "spinner-grow-sm"]).attr("role", "status"));
  
      const res = await send("https://api.sketch-company.de/u/check", { user, email });
      console.log(res);
      if (res) {
        notify("Sorry", "Ein Nutzer mit diesen Daten existiert bereits! Bitte ändere den Benutzernamen oder die Email und probiers nochmal.", "error", 10000);
        $("#submit").removeAttr("disabled").html("<span class='bi bi-check-circle'></span> Registrieren");
      } else {
        sessionStorage.setItem("signUpData", JSON.stringify({ user, email, password }));
        setTimeout(() => openSite("/verify"), 100);
      }
    } else if (status === 1) {
      notify("Keine Verbindung", "Keine Verbindung zum Server.", "error");
    } else {
      notify("Keine Verbindung", "Keine Internetverbindung.", "error");
    }
  }
  