let user
$(document).ready(async function(){
    const res = await get("/api/account", true)
    console.log(res)
    if(res.status == 1){
        user = res.data
        $("#username").val(res.data.user)
        $("#email").val(res.data.email)
        $("#password").val(res.data.password)
        res.data.games = JSON.parse(res.data.games)
        for (let i = 0; i < res.data.games.length; i++) {
            const element = res.data.games[i];
            $(".history").append(`
                <div class="caccordion">${element.name}</div>
                <div class="cpanel">
                    <p>Erworben am: <span class="marked">${element.purchased}</span><br>Letzter Download am: <span class="marked">${element.lastDownload}</span></p>
                    <button class="marked" onclick="openSite('/store/${element.name}')">Zur Store Seite</button>
                </div>
            `)
        }
        setAccordions()
    }
    else{
        notify("Uuups", res.data, "error")
    }
    $("#logout").click(function(){
        const res = get("/api/account/logout")
        console.log(res)
        notify("Abgemeldet", "Du wurdest abgemeldet und wirst zur Anmelde Seite geleitet.", "note", 1000)
        setTimeout(() => openSite("/login"), 2000)
    })
})