import { StaticLexingRules, matches, or } from "../typed-lexer";

enum State { start, inRangeBlock };
type TokenType = "WS" | "Identifier" | "DefinedIdentifier" | "Disj" | "CondDisj" 
    | "Without" | "OpenParen" | "CloseParen" | "Opt" | "Star" | "PosStar" | "ProdDef" | "UnicodePropertyRef"
    | "SingleChar" | "String" | "StringStart" | "StringEnd" | "HexRef" | "Range" | "RangeStart" | "RangeEnd" | "Invalid";


export class EglLexingRules extends StaticLexingRules<TokenType, State> {
    constructor() {
        super(State.start);
        
        const r = this.rules;

        const start = matches(State.start);
        const inRangeBlock = matches(State.inRangeBlock);

        r.addRuleWithRegexGroups(/([a-zA-Z][a-zA-Z0-9]*)(\s*)(::=)/, [ "DefinedIdentifier", "WS", "ProdDef" ], start);            
        r.addSimpleRule(/[a-zA-Z_][a-zA-Z0-9_]*/, "Identifier", start);
        r.addSimpleRule(/\s+/, "WS", start);

        r.addSimpleRules({
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
        
        r.addRuleWithRegexGroups(/(")(.*?)(")/,  [ "StringStart", "String", "StringEnd" ], start);
        r.addRuleWithRegexGroups(/(')(.*?)(')/, [ "StringStart", "String", "StringEnd" ], start);
        r.addSimpleRule(/#x[0-9A-F]+/, "HexRef", or(start, inRangeBlock));

        r.addSimpleRule("[", "RangeStart", start, State.inRangeBlock);
        r.addSimpleRule("]", "RangeEnd", inRangeBlock, State.start);
        r.addSimpleRule("-", "Range", inRangeBlock);
        r.addDefaultSimpleRule("String", inRangeBlock);
        
        r.addDefaultSimpleRule("Invalid");
    }
}

const result = new EglLexingRules()
    .lexTokensWithStr("foo ::= (bar (',' bar)*)?");
    
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