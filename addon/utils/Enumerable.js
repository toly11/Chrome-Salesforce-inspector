// Inspired by C# System.Linq.Enumerable
export function Enumerable(iterable) {
    this[Symbol.iterator] = iterable[Symbol.iterator].bind(iterable);
}
Enumerable.prototype = {
    __proto__: function*() { }.prototype,
    *map(f) {
        for (let e of this) {
            yield f(e);
        }
    },
    *filter(f) {
        for (let e of this) {
            if (f(e)) {
                yield e;
            }
        }
    },
    *flatMap(f) {
        for (let e of this) {
            yield* f(e);
        }
    },
    *concat(other) {
        yield* this;
        yield* other;
    },
    some() {
        for (let e of this) { // eslint-disable-line no-unused-vars
            return true;
        }
        return false;
    },
    toArray() {
        return Array.from(this);
    }
};
Enumerable.prototype.map.prototype = Enumerable.prototype;
Enumerable.prototype.filter.prototype = Enumerable.prototype;
Enumerable.prototype.flatMap.prototype = Enumerable.prototype;
Enumerable.prototype.concat.prototype = Enumerable.prototype;
