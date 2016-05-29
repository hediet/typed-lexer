# typed-lexer

An easy to use lexer that features typescript type definition.
This lexer is inspired by [aaditmshah/lexer](https://github.com/aaditmshah/lexer "aaditmshah/lexer") but tries 
to provide a cleaner API.

## Installation

`typed-lexer` can be installed via the node package manager using the command `npm install typed-lexer`.

## Usage

The lexer supports state based tokenizing. Both the state and the tokens can be typed.
See the examples in the examples directory for other applications.

```typescript
import { LexerFactory, matches, or } from "typed-lexer";

type State = "start" | "inRangeBlock";
type TokenType = "DefinedIdentifier" | "WS" | "ProdDef" 
        | "Identifier" | "StringStart" | "String" | "StringEnd" 
        | "RangeStart" | "Range" | "RangeEnd" | "Invalid";

export class MyLexerFactory extends LexerFactory<TokenType, State> {
    constructor() {
        super("start");
        
        const start = matches<State>("start");
        const inRangeBlock = matches<State>("inRangeBlock");

        this.addRuleWithRegexGroups(/([a-zA-Z][a-zA-Z0-9]*)(\s*)(::=)/, 
            [ "DefinedIdentifier", "WS", "ProdDef" ], start);            
        this.addSimpleRule(/[a-zA-Z_][a-zA-Z0-9_]*/, "Identifier", start);
        this.addSimpleRule(/\s+/, "WS", start);

        this.addRuleWithRegexGroups(/(")(.*?)(")/,  [ "StringStart", "String", "StringEnd" ], start);
        this.addSimpleRule(/#x[0-9A-F]+/, "HexRef", or(start, inRangeBlock));

        this.addSimpleRule("[", "RangeStart", start, "inRangeBlock");
        this.addSimpleRule("]", "RangeEnd", inRangeBlock, "start");
        this.addSimpleRule("-", "Range", inRangeBlock);
        this.addSimpleRule(/./, "String", inRangeBlock);
        
        this.addSimpleRule(/./, "Invalid", start);
    }
}

const result = new MyLexerFactory()
    .getLexerFor("foo ::= (bar (',' bar)*)?")
    .readAllWithStr();
    
for (const t of result)
    console.log(`${t.token} (${t.str})`);

```

## TODOs
* Add support for Jison
* Add support for code mirror syntax highlighting
* Improve documentation
* Add proper tests
* Improve performance by storing rules that match constant strings into an hashmap or a tries