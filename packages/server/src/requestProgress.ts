import { AsyncLocalStorage } from "node:async_hooks";
import axios from "axios";
import { REQUEST_TIMEOUT_MS } from "./api/game-stuff/NetworkRequest";

type Context = { signal: AbortSignal; report: (message: string) => void };
export const requestProgress = new AsyncLocalStorage<Context>();

axios.defaults.timeout = REQUEST_TIMEOUT_MS;
axios.defaults.maxContentLength = 8 * 1024 * 1024;
axios.defaults.maxBodyLength = 2 * 1024 * 1024;

axios.interceptors.request.use((config) => {
    const context = requestProgress.getStore();
    if (context) {
        config.signal = context.signal;
        config.timeout = config.timeout || REQUEST_TIMEOUT_MS;
        let service = "upstream service";
        try {
            const url = new URL(config.url ?? "", config.baseURL);
            service =
                url.pathname === "/browser"
                    ? "browser service"
                    : url.pathname === "/curl"
                      ? "HTTP relay"
                      : url.pathname === "/v1"
                        ? "challenge solver"
                        : url.hostname;
        } catch {
            // The request will report its own configuration error.
        }
        context.report(`Waiting for ${service}`);
    }
    return config;
});
axios.interceptors.response.use(
    (response) => {
        requestProgress
            .getStore()
            ?.report("Response received; processing page");
        return response;
    },
    (error) => {
        requestProgress
            .getStore()
            ?.report(
                axios.isCancel(error)
                    ? "Request cancelled"
                    : "Network request failed",
            );
        return Promise.reject(error);
    },
);
