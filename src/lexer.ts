import { Matcher } from "./regexp";

export interface TokenWithPosAndLen<TToken> {
    token: TToken;
    startPos: number;
    length: number;
}

export interface TokenWithLen<TToken> {
    token: TToken;
    length: number;
}

export interface TokenWithStr<TToken> {
    token: TToken;
    str: string;
}

export interface Result {
    type: "Result";
}

export interface ResultFactory<TToken, TState> {
    tokens(tokens: TToken[], nextState?: TState): Result;
    tokensWithPos(tokens: TokenWithPosAndLen<TToken>[], nextState?: TState): Result;
    tokensWithLen(tokens: TokenWithLen<TToken>[], nextState?: TState): Result;
    token(token: TToken, nextState?: TState): Result;
    state(nextState: TState): Result;
    nothing(): Result;
}

export type Handler<TToken, TState> = (matched: string, ret: ResultFactory<TToken, TState>, state: TState, matchedGroups?: RegExpExecArray) => Result | boolean;
export type Predicate<T> = (v: T) => boolean;


function isString(a: any): a is string { return typeof(a) === "string"; }
function isBool(a: any): a is boolean { return typeof(a) === "boolean"; }


class ResultImplementation<TToken, TState> implements Result {
    public type: "Result";
    
    public tokens: TokenWithPosAndLen<TToken>[];
    public nextState: TState|undefined;
    
    public matchedString: string;
}

class ResultFactoryImplementation<TToken, TState> implements ResultFactory<TToken, TState> {
    constructor(public readonly matchedString: string) {
    }

    public tokensWithPos(tokens: TokenWithPosAndLen<TToken>[], nextState?: TState): ResultImplementation<TToken, TState> {
        const r = new ResultImplementation<TToken, TState>();
        r.nextState = nextState;
        r.matchedString = this.matchedString;
        r.tokens = tokens;
        return r;
    }

    public tokens(tokens: TToken[], nextState?: TState): ResultImplementation<TToken, TState> {
        if (tokens.length == 0)
            return this.tokensWithPos([], nextState);
        let t2 = tokens.map<TokenWithPosAndLen<TToken>>(t => ({ token: t, startPos: 0, length: 0 }));
        t2[t2.length - 1].length = this.matchedString.length;
        return this.tokensWithPos(t2, nextState);
    }

    public tokensWithLen(tokens: TokenWithLen<TToken>[], nextState?: TState): ResultImplementation<TToken, TState> {
        const t2 = tokens as TokenWithPosAndLen<TToken>[];
        
        let pos = 0;
        for (const t of t2) {
            t.startPos = pos;
            pos += t.length;
        }
        
        return this.tokensWithPos(t2, nextState);
    }
    
    public token(token: TToken, nextState?: TState): ResultImplementation<TToken, TState> { 
        return this.tokensWithPos([{ token: token, startPos: 0, length: this.matchedString.length }], nextState);
    }
    
    public state(nextState: TState): ResultImplementation<TToken, TState> {
        return this.tokensWithPos([], nextState);
    }
    
    public nothing(): ResultImplementation<TToken, TState> {
        return this.tokensWithPos([]);
    }
}

abstract class Rule<TToken, TState> {    
    constructor(private handler: Handler<TToken, TState>, private statePredicate?: Predicate<TState>) {
    }

    protected abstract internalMatch(str: string, pos: number): [string|null, RegExpExecArray|undefined];
    
    public match(str: string, pos: number, state: TState): ResultImplementation<TToken, TState>|null  {
        
        if (this.statePredicate && !this.statePredicate(state)) return null;

        let [ matchedStr, matchedGroups ] = this.internalMatch(str, pos);
        if (matchedStr == null) return null;

        const ret = new ResultFactoryImplementation<TToken, TState>(matchedStr);
        let result = this.handler(matchedStr, ret, state, matchedGroups) as (ResultImplementation<TToken, TState> | boolean);
        
        if (isBool(result)) {
            if (!result) return null;
            return ret.tokens([], state);
        }
        else {
            if (result.nextState === undefined)
                result.nextState = state;
            return result;
        }
    }
}

class RegExRule<TToken, TState> extends Rule<TToken, TState> {
    private matchRegex: RegExp;
    
    constructor(regex: string, handler: Handler<TToken, TState>, statePredicate?: Predicate<TState>) {
        super(handler, statePredicate);
        this.matchRegex = new RegExp(regex, "y");
    }
    
    protected internalMatch(str: string, pos: number): [string|null, RegExpExecArray|undefined]{
        this.matchRegex.lastIndex = pos;
        let matchedGroups = this.matchRegex.exec(str);
        if (matchedGroups == null || matchedGroups.length == 0) return [ null, undefined ];
        return [ matchedGroups[0], matchedGroups ];
    }
}

class StringRule<TToken, TState> extends Rule<TToken, TState> {
    constructor(private matchStr: string, handler: Handler<TToken, TState>, statePredicate?: Predicate<TState>) {
        super(handler, statePredicate);
    }
    
    protected internalMatch(str: string, pos: number): [string|null, RegExpExecArray|undefined] {
        const str2 = str.substr(pos, this.matchStr.length);
        if (str2 !== this.matchStr) return [ null, undefined ];
        return [ this.matchStr, undefined ];
    }
}

export abstract class StaticLexingRules<TToken, TState> {
    protected readonly rules: LexingRules<TToken, TState>;

    constructor(startState?: TState|undefined) {
        this.rules = new LexingRules(startState);
    }

    public getLexerFor(input: string, startState?: TState) { return this.rules.getLexerFor(input, startState); }

    public lex(input: string, processor: (token: TToken, lexer: Lexer<TToken, TState>) => void): this {
        this.rules.lex(input, processor);
        return this;
    }

    public lexTokens(input: string) { return this.rules.lexTokens(input); }
    public lexTokensWithStr(input: string) { return this.rules.lexTokensWithStr(input); }
}

export class LexingRules<TToken, TState> {
    private rules: Rule<TToken, TState>[] = [];

    constructor(public readonly startState?: TState) {}

    public addRule(regex: RegExp|string|Matcher, handler: Handler<TToken, TState>, statePredicate?: Predicate<TState>): this {
        let rule: Rule<TToken, TState>;
        if (isString(regex)) 
            rule = new StringRule(regex, handler, statePredicate);
        else if (regex instanceof Matcher)
            rule = new RegExRule(regex.toRegExp(), handler, statePredicate);
        else
            rule = new RegExRule(regex.source, handler, statePredicate);
            
        this.rules.push(rule);
        return this;
    }

    public addDefaultRule(handler?: Handler<TToken, TState>, statePredicate?: Predicate<TState>): this {
        if (handler === undefined)
            handler = (m, ret) => ret.nothing(); 
        
        return this.addRule(/[\s\S]/, handler, statePredicate);
    }
    
    public addDefaultSimpleRule(token?: TToken, statePredicate?: Predicate<TState>): this {
        return this.addSimpleRule(/[\s\S]/, token, statePredicate);
    }

    public addSimpleRule(regex: RegExp|string|Matcher, token?: TToken, statePredicate?: Predicate<TState>, nextState?: TState): this {
        if (token === undefined) {
            if (nextState === undefined)
                return this.addRule(regex, (m, ret) => ret.nothing(), statePredicate);
            return this.addRule(regex, (m, ret) => ret.state(nextState), statePredicate);
        }

        return this.addRule(regex, (m, ret) => ret.token(token, nextState), statePredicate);
    }

    public addSimpleRules(rules: { [char: string]: TToken }, statePredicate?: Predicate<TState>, nextState?: TState): this {
        for (const c in rules)
            this.addSimpleRule(c, rules[c], statePredicate, nextState);
        return this;
    }

    public addRuleWithRegexGroups(regex: RegExp, tokens: TToken[], statePredicate?: Predicate<TState>, nextState?: TState): this {
        return this.addRule(regex, (m, ret, state, groups) =>
            ret.tokensWithLen(groups!.slice(1).map((g, idx) => ({ token: tokens[idx], length: g.length })), nextState),
            statePredicate);
    }
    
    public getLexerFor(input: string, startState?: TState): Lexer<TToken, TState> {
        startState = startState || this.startState;
        if (startState === undefined) throw new Error("No start state is given!");

        return new Lexer<TToken, TState>(input, this.rules, startState);
    }

    public lex(input: string, processor: (token: TToken, lexer: Lexer<TToken, TState>) => void): this {
        const lexer = this.getLexerFor(input);
        while (true) {
            let cur = lexer.next();
            if (cur === undefined)
                break;
            processor(cur, lexer);
        }
        return this;
    }

    public lexTokens(input: string): TToken[] {
        const result: TToken[] = [];
        this.lex(input, t => result.push(t));
        return result;
    }
    
    public lexTokensWithStr(input: string): TokenWithStr<TToken>[] {
        const result: TokenWithStr<TToken>[] = [];
        this.lex(input, (cur, lexer) => {
            const c = lexer.getCur()!;
            result.push({ token: cur, str: input.substr(c.startPos, c.length) });
        });
        return result;
    }
}

class LookaheadLexer<TToken> {
    constructor(private readonly lexer: Lexer<TToken, any>) {}

    public next(): TToken|undefined {

    }

    public pushPosition(): number {}
    public popPosition(handle: number) {}
    public restorePosition(handle: number) {}
}

export class Lexer<TToken, TState> {
    private pos: number = 0;
    private cur:  TokenWithPosAndLen<TToken>|undefined = undefined;
    private restrained: TokenWithPosAndLen<TToken>[] = [];
    private rules: Rule<TToken, TState>[];
    
    constructor(private input: string, rules: any[], private state: TState) {
        this.rules = rules;
    }
    
       
    public getInput(): string { return this.input; }
    
    public getCur(): TokenWithPosAndLen<TToken>|undefined { return this.cur; }
    public getCurToken(): TToken|undefined { return this.cur ? this.cur.token : undefined; }
    public getCurState(): TState { return this.state; }
    
    public getRestrained(): TokenWithPosAndLen<TToken>[] { return this.restrained; }
    
    public next(): TToken|undefined {
        while (this.restrained.length == 0) {
            if (this.input.length === this.pos) {
                this.cur = undefined;
                return undefined;
            }
            
            let result: ResultImplementation<TToken, TState>|null = null;
            
            for (const r of this.rules) {
                result = r.match(this.input, this.pos, this.state);
                if (result != null) break;
            }
            
            if (result == null) throw new Error(`'${this.input.substr(0, 10)}...' could not be matched.`);
            
            for (const t of result.tokens)
                t.startPos += this.pos; // add offset
            
            this.pos += result.matchedString.length;
            if (result.nextState)
                this.state = result.nextState;
            
            this.restrained.push(...result.tokens);
        }
        
        this.cur = this.restrained.shift();
        return this.cur!.token;
    }
}

export function matches<T>(...elements: T[]): Predicate<T> { return (other) => elements.some(element => element === other); }
export function matchesNot<T>(...elements: T[]): Predicate<T> { return (other) => !elements.some(element => element === other); }
export function and<T>(...ops: Predicate<T>[]): Predicate<T> { return (other) => ops.every(o => o(other)); }
export function or<T>(...ops: Predicate<T>[]): Predicate<T> { return (other) => ops.some(o => o(other)); }

// from http://stackoverflow.com/questions/728360/most-elegant-way-to-clone-a-javascript-object
export function clone<T>(obj: T): T {
    var copy;

    // Handle the 3 simple types, and null or undefined
    if (null == obj || "object" != typeof obj) return obj;

    // Handle Date
    if (obj instanceof Date) {
        copy = new Date();
        copy.setTime(obj.getTime());
        return copy as any;
    }

    // Handle Array
    if (obj instanceof Array) {
        copy = [];
        for (var i = 0, len = obj.length; i < len; i++) {
            copy[i] = clone(obj[i]);
        }
        return copy as any;
    }

    // Handle Object
    if (obj instanceof Object) {
        copy = {} as any;
        for (var attr in obj) {
            if (obj.hasOwnProperty(attr)) copy[attr] = clone(obj[attr]);
        }
        return copy;
    }

    throw new Error("Unable to copy obj! Its type isn't supported.");
}