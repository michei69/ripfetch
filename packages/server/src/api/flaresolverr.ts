import axios, { type AxiosResponse } from "axios";
import { type ByparrResponse, validateUrl } from "./game-stuff/NetworkRequest";
import { getFirstMatch } from "@/util";

const byparrInst = process.env.BYPARR_INST;

export default {
    async fetch<T>(url: string): Promise<T | undefined> {
        if (!(await validateUrl(url))) return;
        if (!byparrInst) {
            try {
                const res = await axios.get(url);
                if (!(await validateUrl(res.request?.requestURL))) return;
                return res.data as T;
            } catch {}
            return;
        }

        try {
            const res = (await axios.post(`${byparrInst}/v1`, {
                cmd: "request.get",
                url: url,
            })) as AxiosResponse<ByparrResponse>;
            if (!(await validateUrl(res?.data?.solution.url ?? ""))) return;
            return res.data?.solution?.response as T;
        } catch {}
    },
    getActualJson<T>(html: string): T {
        if (!html) return [] as T;
        const actualJson = getFirstMatch(html, /<pre>(.*)<\/pre>/gm)?.[1]
        return JSON.parse(actualJson ?? "[]");
    },
};
