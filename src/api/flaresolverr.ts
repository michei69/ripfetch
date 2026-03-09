import axios from "axios";

export default class Solverr {
    private static byparrInst: string | undefined = process.env["BYPARR_INST"]

    static async fetch<T>(url: string): Promise<T | undefined> {
        if (!this.byparrInst) {
            try {
                const res = await axios.get(url)
                return res.data as T
            } catch {
                return undefined
            }
        }
        
        try {
            const res = await axios.post(`${this.byparrInst}/v1`, {
                "cmd": "request.get",
                "url": url
            })
            return res.data?.solution?.response as T
        } catch {
            return undefined
        }
    }
}
