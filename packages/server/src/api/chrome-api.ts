import axios from "axios";

// TODO: implement this in networkRequest, or somehow unify all of those
// TODO: its annoying having 3 different browser-based APIs

// TODO: make chrome API also bypass cloudflare itself (easy)

export default class Chrome {
    static async browserRequest(url: string, actions: Array<{instruction: string, arguments: Array<string|number>}>, response: "content"|"title"|"url") {
        const req = await axios.post(`${process.env["CHROME_INST"]}/browser`, {
            "url": url,
            "actions": actions,
            "response": response
        })
        return req.data as {result: string}
    }
    static async curlRequest(url: string, method = "GET", config?: {timeout?: number, allow_redirects?: boolean, verify?: boolean}, headers?: Record<string, string>, data?: any, json?: any) {
        const req = await axios.post(`${process.env["CHROME_INST"]}/curl`, {
            "url": url,
            "method": method,
            "config": config,
            "headers": headers,
            "data": data,
            "json": json
        })
        return req.data as {content: string, headers: Record<string, string>, status: number}
    }
}