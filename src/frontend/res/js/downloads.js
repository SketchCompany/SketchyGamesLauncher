let queue = []
let paused = false
let progressInterval
let progressUpdateRate = 100

$(document).ready(async function(){
    const res = await get("/api/downloads")
    if(res.downloadQueue){
        queue = res.downloadQueue
        createCurrentDownload(queue[0])
        queue.splice(0, 1)
        if(queue.length < 1){
            $(".queue").prev().remove()
            $(".queue").remove()
            return
        } 
        for (let i = 0; i < queue.length; i++) {
            const element = queue[i];
            createDownloadQueueElement(element, i)
        }
    }
    else{
        console.log(res)
        $(".currentDownload").remove()
        $(".queue").prev().remove()
        $(".queue").remove()
        $("padding").append($(document.createElement("p")).html("Keine Downloads momentan.").css("text-align", "center"))
    }
})

async function createCurrentDownload(current){
    $(".currentDownload").append(`
        <div class="crow">
            <h4>${current.name}</h4>
            <h4 id="progress">Starte Download</h4>
        </div>
        <div class="crow">
            <p>${current.version + " " + current.versionLevel}</p>
            <div class="options">
                <button class="status"><i class="bi bi-pause"></i></button>
                <button class="cancel"><i class="bi bi-x-lg"></i></button>
            </div>
        </div>
        <div class="crow">
            <div class="cprogressBar">
                <div class="cprogress"></div>
            </div>
        </div>
        <div class="crow">
            <p class="time"></p>
            <p class="speed"></p>
        </div>
    `)

    progressInterval = setInterval(async () => {
        const progress = (await get("/api/download/progress"))
        console.log("progress", progress.percentage)
        $("#progress").html(progress.percentage + "%")
        $(".cprogress").css("width", progress.percentage + "%")
        $(".time").html("Zeit verbleibend: " + progress.time.hours + ":" + progress.time.minutes + ":" + progress.time.seconds)
        if(progress.time.hours == "00"){
            $(".time").html("Zeit verbleibend: " + progress.time.minutes + ":" + progress.time.seconds)
        }
        $(".speed").html(progress.speed + " MB/s")
        if(progress.percentage >= 100){
            finishDownload()
        }
    }, progressUpdateRate)

    paused = await get("/api/download/state")
    if(paused){
        $(".status").children().first().removeClass("bi-pause")
        $(".status").children().first().addClass("bi-play-fill")
    }
    $(".status").click(async function(){
        if(!paused){
            paused = true
            const res = await get("/api/download/pause")
            $(".status").children().first().removeClass("bi-pause")
            $(".status").children().first().addClass("bi-play-fill")
        }
        else{
            paused = false
            const res = await get("/api/download/resume")
            $(".status").children().first().addClass("bi-pause")
            $(".status").children().first().removeClass("bi-play-fill")
        }
    })
    $(".cancel").click(async function(){
        const res = await get("/api/download/cancel")
        finishDownload()
    })
}
function createDownloadQueueElement(download, index){
    const downloadQueueElement = $(`
        <div class="download">
            <div class="crow">
                <h4>${download.name}</h4>
            </div>
            <div>
                <p>${download.version}</p>
            </div>
        </div>
    `)
    const upBtn = $(document.createElement("button")).append($(document.createElement("i")).addClass(["bi", "bi-arrow-up"])).click(async function(){
        queue.splice(index - 1, 0, queue.splice(index, 1)[0])
        console.log("moved up", queue[index], queue)
        const res = await send("/api/downloads/move", {index: index, to: index-1})
        $(".queue").get(0).replaceChildren()
        for (let i = 0; i < queue.length; i++) {
            const element = queue[i];
            createDownloadQueueElement(element, i)
        }
    })
    const downBtn = $(document.createElement("button")).append($(document.createElement("i")).addClass(["bi", "bi-arrow-down"])).click(async function(){
        queue.splice(index + 1, 0, queue.splice(index, 1)[0])
        console.log("moved down", queue[index], queue)
        const res = await send("/api/downloads/move", {index: index, to: index+1})
        $(".queue").get(0).replaceChildren()
        for (let i = 0; i < queue.length; i++) {
            const element = queue[i];
            createDownloadQueueElement(element, i)
        }
    })
    const cancelBtn = $(document.createElement("button")).append($(document.createElement("i")).addClass(["bi", "bi-x-lg"])).click(async function(){
        queue.splice(index, 1)
        downloadQueueElement.remove()
        const res = await send("/api/downloads/unqueue", {index})
    })
    const div = $(document.createElement("div")).append([upBtn, " ", downBtn, " ", cancelBtn, " "])
    downloadQueueElement.children().first().append(div)
    $(".queue").append(downloadQueueElement)
}
function finishDownload(){
    clearInterval(progressInterval)
    setTimeout(async function(){
        $(".currentDownload").get(0).replaceChildren()
        const resetRes = await get("/api/download/progress/reset")
        console.log("finish: resetRes", resetRes)
        if(queue.length > 0){
            paused = false
            createCurrentDownload(queue[0])
            $(".queue").children().first().remove()
            queue.splice(0, 1)
            if(queue.length < 1){
                $(".queue").prev().remove()
                $(".queue").remove()
                return
            } 
            $(".queue").get(0).replaceChildren()
            for (let i = 0; i < queue.length; i++) {
                const element = queue[i];
                createDownloadQueueElement(element, i)
            }
            console.log("finish: next download")
        }
        else{
            console.log("all downloads finished")
            $(".currentDownload").remove()
            $(".queue").prev().remove()
            $(".queue").remove()
            $("padding").append($(document.createElement("p")).html("Alle Downloads abgeschlossen!").css("text-align", "center"))
            notifyCb("Fertig", "Alle Downloads wurden erfolgreich beendet. Klicke um sie dir in der Library anzusehen.", "note", 10000, function(){
                openSite("/library")
            })
            notifyComputer("Downloads beendet", "Alle Downloads beendet. Du kannst jetzt die Spiele aus deiner Library starten.")
        }
    }, 500)
}