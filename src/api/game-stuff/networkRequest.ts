import axios from "axios";

async function runCommand(body: Record<string, unknown>): Promise<ByparrResponse | null> {
    const byparrInst = process.env["BYPARR_INST"]
    if (!byparrInst) {
        return null
    }
    
    try {
        const req = await axios.post(`${byparrInst}/v1`, body, { validateStatus: () => true })
        return req.data
    } catch {
        return null
    }
}

export default class NetworkRequest {
    static async get(url: string): Promise<string> {
        const byparrInst = process.env["BYPARR_INST"]
        
        const req = await axios.get(url, { validateStatus: () => true })
        let data = req.data
        if (typeof data == "string" && data.toLowerCase().includes("just a moment") && byparrInst != null) {
            console.debug("cloudflare - running via byparr")
            const result = await runCommand({
                "cmd": "request.get",
                "url": url
            })
            data = result?.solution?.response ?? ""
        }
        return data as string
    }

    static async post(url: string, postdata: string): Promise<string> {
        const byparrInst = process.env["BYPARR_INST"]
        
        const req = await axios.post(url, postdata, { validateStatus: () => true })
        let data = req.data
        if (typeof data == "string" && data.toLowerCase().includes("just a moment") && byparrInst != null) {
            console.debug("cloudflare - running via byparr")
            const result = await runCommand({
                "cmd": "request.post",
                "url": url,
                "postData": postdata
            })
            data = result?.solution?.response ?? ""
        }
        return data as string
    }
}

export type ByparrResponse = {
    status: "ok"|string,
    message: "Success"|string,
    solution: ByparrSolution,
    startTimestamp: Date,
    endTimestamp: Date,
    version: unknown
}
export type ByparrSolution = {
    url: string,
    status: number,
    cookies: Array<ByparrCookie>,
    userAgent: string,
    headers: Record<string, string>,
    response: string
}

export type ByparrCookie = {
    domain: string,
    expiry: number,
    httpOnly: boolean,
    name: string,
    path: string,
    sameSite: "Lax" | "Strict" | "None",
    secure: boolean,
    value: string,
    size: number,
    session: boolean,
    expires: number
}
