// uBlock integration (trimmed copy from HackTheNest)
/*
 * Minimal uBlock integration extracted from HackTheNest for cosmetic filtering
 * and basic matching. This file intentionally focuses on the functions used by
 * the content script integration.
 */
class UBlockIntegration {
    constructor(){
        this.filterLists = new Map();
        this.initialized = false;
        this.init();
    }
    async init(){
        if (this.initialized) return;
        // For performance and offline, we won't fetch full uBlock lists here.
        // Consumers can call addCustomFilter or load lists later.
        this.filterLists.set('local', []);
        this.initialized = true;
        console.log('uBlockIntegration initialized (minimal)');
    }
    parseFilterList(text){
        const lines = text.split('\n');
        const filters = [];
        for (const line of lines){
            const t = line.trim(); if (!t || t.startsWith('!')) continue;
            const f = this.parseFilter(t); if (f) filters.push(f);
        }
        return filters;
    }
    parseFilter(line){
        const filter = { raw: line, type: 'unknown', pattern: line, options: {}, exception: false };
        if (line.startsWith('@@')){ filter.exception = true; filter.pattern = line.substring(2); }
        if (line.includes('##')) filter.type = 'cosmetic';
        return filter;
    }
    getStats(){ return { lists: this.filterLists.size, initialized: this.initialized }; }
}
