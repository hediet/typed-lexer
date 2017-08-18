
export type MatcherLike = Matcher | string;

export abstract class Matcher {
    public abstract toRegExp(): string;

    public concat(m: MatcherLike) {
        return concat(this, m);
    }
}

export function asMatcher(m: MatcherLike): Matcher {
    if (typeof m === "string") return new StringMatcher(m);
    return m;
}

function escapeRegExp(str: string): string {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

class StringMatcher extends Matcher {
    constructor(private readonly literal: string) { super(); }

    public toRegExp() { return escapeRegExp(this.literal); }
}


export function range(startChar: string, endChar: string): Matcher {
    return new RangeMatcher(startChar, endChar);
}



class RangeMatcher extends Matcher {
    constructor(private readonly startChar: string, private readonly endChar: string) { super(); }

    public toRegExp(): string {
        return `[${this.startChar}-${this.endChar}]`;
    }
}

class AnyMatcher extends Matcher {
    public toRegExp(): string { return "."; }
}

export const any: Matcher = new AnyMatcher();

export function noneOfChars(items: string[]): Matcher {
    return new NegativeCharacterClassMatcher(items);
}

class NegativeCharacterClassMatcher extends Matcher {
    constructor(private readonly items: string[]) { super(); }

    public toRegExp() { return `[^${escapeRegExp(this.items.join(""))}]` }
}

export function oneOf(...items: MatcherLike[]): Matcher {
    if (items.length === 0) throw new Error("No choice given.");
    let m = asMatcher(items[0]);
    for (let i = 1; i < items.length; i++)
        m = new ChoiceMatcher(m, asMatcher(items[i]));
    return m;
}

class ChoiceMatcher extends Matcher {
    constructor(private readonly first: Matcher, private readonly second: Matcher) { super(); }

    public toRegExp(): string {
        return `(?:${this.first.toRegExp()})|(?:${this.second.toRegExp()})`;
    }
}

export function concat(...items: MatcherLike[]): Matcher {
    if (items.length === 0) throw new Error("No matcher given.");
    let m = asMatcher(items[0]);
    for (let i = 1; i < items.length; i++)
        m = new ConcatMatcher(m, asMatcher(items[i]));
    return m;
}

class ConcatMatcher extends Matcher {
    constructor(private readonly first: Matcher, private readonly second: Matcher) { super(); }

    public toRegExp(): string {
        return `(${this.first.toRegExp()})(${this.second.toRegExp()})`;
    }
}

export function repeat0(m: MatcherLike): Matcher {
    return new RepeatMatcher(asMatcher(m), 0, undefined);
}

export function repeat1(m: MatcherLike): Matcher {
    return new RepeatMatcher(asMatcher(m), 1, undefined);
}

export function optional(m: MatcherLike): Matcher {
    return new RepeatMatcher(asMatcher(m), 0, 1);
}

class RepeatMatcher extends Matcher {
    constructor(private readonly m: Matcher, private readonly min: number, private readonly max: number|undefined) {
        super();
    }

    public toRegExp(): string {
        let op: string;

        if (this.min === 0 && this.max === undefined) op = "*";
        else if (this.min === 1 && this.max === undefined) op = "+";
        else if (this.min === 0 && this.max === 1) op = "?";
        else if (this.max !== undefined) op = `{${this.min}, ${this.max}}`;
        else op = `{${this.min},}`;

        return `(?:${this.m.toRegExp()})${op}`;
    }
}