import { LexerFactory, matches, or } from "../typed-lexer";

type State = "start" | "inRangeBlock";
type TokenType = "WS" | "Identifier" | "DefinedIdentifier" | "Disj" | "CondDisj" 
    | "Without" | "OpenParen" | "CloseParen" | "Opt" | "Star" | "PosStar" | "ProdDef" | "UnicodePropertyRef"
    | "SingleChar" | "String" | "StringStart" | "StringEnd" | "HexRef" | "Range" | "RangeStart" | "RangeEnd" | "Invalid";


export class EglLexerFactory extends LexerFactory<TokenType, State> {
    constructor() {
        super("start");
        
        const start = matches<State>("start");
        const inRangeBlock = matches<State>("inRangeBlock");

        this.addRuleWithRegexGroups(/([a-zA-Z][a-zA-Z0-9]*)(\s*)(::=)/, [ "DefinedIdentifier", "WS", "ProdDef" ], start);            
        this.addSimpleRule(/[a-zA-Z_][a-zA-Z0-9_]*/, "Identifier", start);
        this.addSimpleRule(/\s+/, "WS", start);

        this.addSimpleRules({
            "||": "CondDisj",
            "|": "Disj",
            ".": "SingleChar",
            "\\": "Without",
            "?": "Opt",
            "*": "Star",
            "+": "PosStar",
            "(": "OpenParen",
            ")": "CloseParen",
            "#": "UnicodePropertyRef"
        }, start);
        
        this.addRuleWithRegexGroups(/(")(.*?)(")/,  [ "StringStart", "String", "StringEnd" ], start);
        this.addRuleWithRegexGroups(/(')(.*?)(')/, [ "StringStart", "String", "StringEnd" ], start);
        this.addSimpleRule(/#x[0-9A-F]+/, "HexRef", or(start, inRangeBlock));

        this.addSimpleRule("[", "RangeStart", start, "inRangeBlock");
        this.addSimpleRule("]", "RangeEnd", inRangeBlock, "start");
        this.addSimpleRule("-", "Range", inRangeBlock);
        this.addDefaultSimpleRule("String", inRangeBlock);
        
        this.addDefaultSimpleRule("Invalid");
    }
}

const result = new EglLexerFactory()
    .getLexerFor("foo ::= (bar (',' bar)*)?")
    .readAllWithStr();
    
for (const t of result)
    console.log(`${t.token} (${t.str})`);

/* this code prints the following to the console:

DefinedIdentifier (foo)
WS ( )
ProdDef (::=)
WS ( )
OpenParen (()
Identifier (bar)
WS ( )
OpenParen (()
StringStart (')
String (,)
StringEnd (')
WS ( )
Identifier (bar)
CloseParen ())
Star (*)
CloseParen ())
Opt (?)

*/