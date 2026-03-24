import axios from "axios"
import DirectSolver from "./src/api/game-stuff/direct"

async function main() {
    const realurl = await DirectSolver.solve("https://megaup.net/7d89759da5a4e3b45e0025a3b49a5c4e", true)
    console.log(realurl)
    await new Promise(resolve => setTimeout(resolve, 6000))
    const req = await axios.get(realurl.url, {
        headers: {
            referer: realurl.referer,
            "user-agent": "yaak",
            "accept-encoding": ""
        }
    })
    const data = req.data
    console.log(data)
}
main()