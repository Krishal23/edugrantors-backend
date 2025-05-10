class MemoryCache {
    private cache: Map<string, { value: any; expires?: number }>;

    constructor() {
        this.cache = new Map();
    }

    async get(key: string): Promise<string | null> {
        const item = this.cache.get(key);
        if (!item) return null;
        
        if (item.expires && item.expires < Date.now()) {
            this.cache.delete(key);
            return null;
        }
        
        return item.value;
    }

    async set(key: string, value: string, _expireFlag?: string, expireValue?: number): Promise<boolean> {
        try {
            const expires = expireValue ? Date.now() + (expireValue * 1000) : undefined;
            this.cache.set(key, { value, expires });
            return true;
        } catch (error) {
            return false;
        }
    }

    async del(key: string): Promise<boolean> {
        return this.cache.delete(key);
    }

    async mget(keys: string[]): Promise<(string | null)[]> {
        return keys.map(key => this.cache.get(key)?.value || null);
    }

    async mset(keyValuePairs: { [key: string]: string }): Promise<boolean> {
        try {
            Object.entries(keyValuePairs).forEach(([key, value]) => {
                this.cache.set(key, { value });
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    async invalidatePattern(pattern: string): Promise<boolean> {
        try {
            const regex = new RegExp(pattern.replace('*', '.*'));
            for (const key of this.cache.keys()) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                }
            }
            return true;
        } catch (error) {
            return false;
        }
    }
}

export const memoryCache = new MemoryCache();