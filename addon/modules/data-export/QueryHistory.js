export class QueryHistory {
    constructor(storageKey, max) {
        this.storageKey = storageKey;
        this.max = max;
        this.list = this._get();
    }

    _get() {
        let history;
        try {
            history = JSON.parse(localStorage[this.storageKey]);
        } catch (e) {
            // empty
        }
        if (!Array.isArray(history)) {
            history = [];
        }
        // A previous version stored just strings. Skip entries from that to avoid errors.
        history = history.filter(e => typeof e == "object");
        return history;
    }

    add(entry) {
        let history = this._get();
        let historyIndex = history.findIndex(e => e.query == entry.query && e.useToolingApi == entry.useToolingApi);
        if (historyIndex > -1) {
            history.splice(historyIndex, 1);
        }
        history.splice(0, 0, entry);
        if (history.length > this.max) {
            history.pop();
        }
        localStorage[this.storageKey] = JSON.stringify(history);
        this.list = history;
    }

    remove(entry) {
        let history = this._get();
        let historyIndex = history.findIndex(e => e.query == entry.query && e.useToolingApi == entry.useToolingApi);
        if (historyIndex > -1) {
            history.splice(historyIndex, 1);
        }
        localStorage[this.storageKey] = JSON.stringify(history);
        this.list = history;
    }

    clear() {
        localStorage.removeItem(this.storageKey);
        this.list = [];
    }
}