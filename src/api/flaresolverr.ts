import axios, { AxiosResponse } from "axios";
import { ByparrResponse, validateUrl } from "./game-stuff/networkRequest";

export default class Solverr {
    private static byparrInst: string | undefined = process.env["BYPARR_INST"]

    static async fetch<T>(url: string): Promise<T | undefined> {
        if (!validateUrl(url)) return
        if (!this.byparrInst) {
            try {
                const res = await axios.get(url)
                if (!validateUrl(res.request?.requestURL)) return
                return res.data as T
            } catch {
                return
            }
        }
        
        try {
            const res = await axios.post(`${this.byparrInst}/v1`, {
                "cmd": "request.get",
                "url": url
            }) as AxiosResponse<ByparrResponse>
            if (!validateUrl(res?.data?.solution.url ?? "")) return
            return res.data?.solution?.response as T
        } catch {
            return
        }
    }
}
