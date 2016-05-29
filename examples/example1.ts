import { LexerFactory, clone, TokenWithLen } from "../typed-lexer";


let lineCounter = new LexerFactory<any, { line: number, column: number }>({ line: 0, column: 0 });
// either return new state
lineCounter.addRule("\n", (m, ret, state) => ret.state({ line: state.line + 1, column: 0 }));
// or modify state and return true to proceed. Returning false would try the next rule.
lineCounter.addDefaultRule((m, ret, state) => { state.column++; return true; });

var lineBreaks = lineCounter.getLexerFor("test\nhallo").readToEnd().getCurState();
console.log(lineBreaks);






interface State {
    indent: number[];
    start: boolean;
}

type Token = "Indent" | "Dedent" | "Other" | "WS" | "Identifier";

class MyLexer extends LexerFactory<Token, State> {
    constructor() {
        super({ indent: [0], start: true });
        
        this.addRule(/[\t ]*/, (m, ret, state) => {
           state.start = false;
           state.indent.unshift(m.length);
           return ret.token("Indent", state);
        }, s => s.start);
        
        const notStart = (s: State) => !s.start;
        
        this.addRule(/\n[\t ]*/, (m, ret, state) => {
            const indent = m.length;
            if (indent > state.indent[0]) {
                state.indent.unshift(indent);
                return ret.token("Indent");
            }
            const tokens: Token[] = [];
            while (indent < state.indent[0]) {
                tokens.push("Dedent");
                state.indent.shift();
            }
            return ret.tokens(tokens);
            
        }, notStart);
        
        this.addSimpleRule(/[a-zA-Z_][a-zA-Z0-9_]*/, "Identifier", notStart);
        this.addSimpleRule(/[ \r\t]+/, "WS", notStart);
        
        this.addDefaultSimpleRule("Other");
    }
}

const result = new MyLexer().getLexerFor(
`    
class Test1
    foo bar
        return 4
class Test2
    bazz buzz
`).readAllWithStr();

for (const r of result)
    console.log(r);