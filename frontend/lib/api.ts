export const API_BASE_URL = "http://localhost:8080/api/v1";
// export const API_BASE_URL = "https://g7gvt1l1-8080.inc1.devtunnels.ms/api/v1";

export class ApiService {
    private static async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const headers = new Headers(options.headers);
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
        if (!(options.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "An unexpected error occurred");
        }

        return data.data;
    }

    static get<T>(endpoint: string) {
        return this.request<T>(endpoint, { method: "GET" });
    }

    static post<T>(endpoint: string, body: any) {
        return this.request<T>(endpoint, {
            method: "POST",
            body: body instanceof FormData ? body : JSON.stringify(body),
        });
    }

    static patch<T>(endpoint: string, body?: any) {
        return this.request<T>(endpoint, {
            method: "PATCH",
            body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
        });
    }

    static put<T>(endpoint: string, body: any) {
        return this.request<T>(endpoint, {
            method: "PUT",
            body: body instanceof FormData ? body : JSON.stringify(body),
        });
    }

    static delete<T>(endpoint: string) {
        return this.request<T>(endpoint, { method: "DELETE" });
    }
}
