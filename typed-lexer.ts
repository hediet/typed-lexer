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
    typeDiscriminator_Result: string;
}

export interface ResultFactory<TToken, TState> {
    tokens(tokens: TToken[], nextState?: TState): Result;
    tokensWithPos(tokens: TokenWithPosAndLen<TToken>[], nextState?: TState): Result;
    tokensWithLen(tokens: TokenWithLen<TToken>[], nextState?: TState): Result;
    token(token: TToken, nextState?: TState): Result;
    state(nextState: TState): Result;
}

export type Handler<TToken, TState> = (matched: string, ret: ResultFactory<TToken, TState>, state: TState, matchedGroups?: RegExpExecArray) => Result | boolean;
export type Predicate<T> = (v: T) => boolean;


function isString(a: any): a is string { return typeof(a) === "string"; }
function isBool(a: any): a is boolean { return typeof(a) === "boolean"; }


class ResultImplementation<TToken, TState> implements Result {
    public typeDiscriminator_Result: string;
    
    public tokens: TokenWithPosAndLen<TToken>[];
    public nextState: TState; // |undefined
    
    public matchedString: string;
}

class ResultFactoryImplementation<TToken, TState> implements ResultFactory<TToken, TState> {
    
    constructor(public matchedString: string) {
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
}

abstract class Rule<TToken, TState> {    
    constructor(private handler: Handler<TToken, TState>, private statePredicate?: Predicate<TState>) {
    }

    protected abstract internalMatch(str: string): [string, RegExpExecArray];
    
    public match(str: string, state: TState): ResultImplementation<TToken, TState>  { // | null
        
        if (!this.statePredicate(state)) return null;

        let [ matchedStr, matchedGroups ] = this.internalMatch(str);
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
    
    constructor(regex: RegExp, handler: Handler<TToken, TState>, statePredicate?: Predicate<TState>) {
        super(handler, statePredicate);
        this.matchRegex = new RegExp("^" + regex.source);
    }
    
    protected internalMatch(str: string): [string, RegExpExecArray] {
        let matchedGroups = this.matchRegex.exec(str);
        if (matchedGroups == null || matchedGroups.length == 0) return null;
        return [ matchedGroups[0], matchedGroups ];
    }
}

class StringRule<TToken, TState> extends Rule<TToken, TState> {
    constructor(private matchStr: string, handler: Handler<TToken, TState>, statePredicate?: Predicate<TState>) {
        super(handler, statePredicate);
    }
    
    protected internalMatch(str: string): [string, RegExpExecArray] {
        const str2 = str.substr(0, this.matchStr.length);
        if (str2 !== this.matchStr) return null;
        return [ this.matchStr, null ];
    }
}

export class LexerFactory<TToken, TState> {
    private rules: Rule<TToken, TState>[] = [];

    constructor(private startState?: TState) {
    }

    public addRule(regex: RegExp|string, handler: Handler<TToken, TState>, statePredicate?: Predicate<TState>): this {
        let rule: Rule<TToken, TState>;
        if (isString(regex)) 
            rule = new StringRule(regex, handler, statePredicate);
        else
            rule = new RegExRule(regex, handler, statePredicate);
            
        this.rules.push(rule);
        return this;
    }

    public addSimpleRule(regex: RegExp|string, token: TToken, statePredicate?: Predicate<TState>, nextState?: TState): this {
        return this.addRule(regex, (m, ret) => ret.token(token, nextState), statePredicate);
    }

    public addSimpleRules(rules: { [char: string]: TToken }, statePredicate?: Predicate<TState>, nextState?: TState): this {
        for (const c in rules)
            this.addSimpleRule(c, rules[c], statePredicate, nextState);
        return this;
    }

    public addRuleWithRegexGroups(regex: RegExp, tokens: TToken[], statePredicate?: Predicate<TState>, nextState?: TState): this {
        return this.addRule(regex, (m, ret, state, groups) =>
            ret.tokensWithLen(groups.slice(1).map((g, idx) => ({ token: tokens[idx], length: g.length })), nextState),
            statePredicate);
    }
    
    public getLexerFor(input: string, startState?: TState): Lexer<TToken, TState> {
        if (startState === undefined)
            startState = this.startState || null;
        return new Lexer<TToken, TState>(input, this.rules, startState);
    }
}


export class Lexer<TToken, TState> {

    private pos: number = 0;
    private cur:  TokenWithPosAndLen<TToken> = null;
    private restrained: TokenWithPosAndLen<TToken>[] = [];
    private rules: Rule<TToken, TState>[];
    
    constructor(private input: string, rules: any[], private state: TState) {
        this.rules = rules;
    }
    
    public readAll(): TToken[] {
        const result: TToken[] = [];
        while (true) {
            let cur = this.next();
            if (cur == undefined)
                break;
            result.push(cur);
        }
        
        return result;
    }
    
    public readAllWithStr(): TokenWithStr<TToken>[] {
        const result: TokenWithStr<TToken>[] = [];
        while (true) {
            let cur = this.next();
            if (cur == undefined)
                break;
            result.push({ token: cur, str: this.input.substr(this.cur.startPos, this.cur.length) });
        }
        return result;
    }
    
    
    public getInput(): string { return this.input; }
    
    public getCur(): TokenWithPosAndLen<TToken> { return this.cur; }
    public getCurToken(): TToken { return this.cur ? this.cur.token : undefined; }
    public getCurState(): TState { return this.state; }
    
    public getRestrained(): TokenWithPosAndLen<TToken>[] { return this.restrained; }
    

    public next(): TToken { // |undefined
        
        if (this.restrained.length == 0) {
            
            var curStr = this.input.substr(this.pos);
            
            if (curStr.length == 0) {
                this.cur = undefined;
                return undefined;
            }
            
            let result: ResultImplementation<TToken, TState> = null;
            
            for (const r of this.rules) {
                result = r.match(curStr, this.state);
                if (result != null) break;
            }
            
            if (result == null) throw new Error(`${curStr} could not be matched!`);
            
            for (const t of result.tokens)
                t.startPos += this.pos; // add offset
            
            this.pos += result.matchedString.length;
            this.state = result.nextState;
            
            this.restrained.push(...result.tokens);
        }
        
        this.cur = this.restrained.shift();
        return this.cur ? this.cur.token : undefined;
    }
}

export function matches<T>(...elements: T[]): Predicate<T> { return (other) => elements.some(element => element === other); }
export function matchesNot<T>(...elements: T[]): Predicate<T> { return (other) => !elements.some(element => element === other); }
export function and<T>(...ops: Predicate<T>[]): Predicate<T> { return (other) => ops.every(o => o(other)); }
export function or<T>(...ops: Predicate<T>[]): Predicate<T> { return (other) => ops.some(o => o(other)); }