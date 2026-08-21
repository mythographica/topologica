# topologica

[![Coverage Status](https://coveralls.io/repos/github/mythographica/topologica/badge.svg?branch=main)](https://coveralls.io/github/mythographica/topologica?branch=main)

![NPM](https://img.shields.io/npm/l/@mnemonica/topologica)

![GitHub package.json version](https://img.shields.io/github/package-json/v/mythographica/topologica)

![GitHub last commit](https://img.shields.io/github/last-commit/mythographica/topologica)

[**$ npm install <u>@mnemonica/topologica</u>**](https://www.npmjs.com/package/@mnemonica/topologica)

---

This package is a part of [mnemonica](https://www.npmjs.com/package/mnemonica) project.

A simple file system walker that defines mnemonica types based on directory and file structure.

## Features

- **Directory-based types**: Define types using folder structure with `index.js` files
- **Flat file support**: Define multiple types in individual `.js/.ts/.mjs` files
- **Automatic nesting**: Subdirectories matching type names become nested types
- **Export inspection**: Automatically discovers named constructor exports

## Installation

```bash
npm install @mnemonica/topologica
```

## Usage

```javascript
const loader = require('@mnemonica/topologica');
const { define } = require('mnemonica');

const { topology, logs } = loader('./models', define);

// Now your types are defined and ready to use
const instance = new topology.MyType.type({ foo: 'bar' });
```

## Type Definition Patterns

### Pattern 1: Directory-based (Traditional)

Organize types as directories with `index.js` files:

```
models/
├── App/
│   ├── index.js          # exports function App() {}
│   └── Nested/
│       └── index.js      # becomes App.Nested
└── User/
    └── index.js          # exports function User() {}
```

**index.js example:**
```javascript
module.exports = function App(config) {
    this.config = config;
    this.createdAt = Date.now();
};
```

### Pattern 2: Flat Files (New)

Define types in individual files with named exports:

```
models/
├── Definition.js         # exports { Definition, Link }
├── Usages.js             # exports { Usages }
└── helper.js             # lowercase = skipped
```

**Multiple exports per file:**
```javascript
// Definition.js
const Definition = function(data) {
    this.id = data.id;
    this.name = data.name;
};

const Link = function(data) {
    this.source = data.source;
    this.target = data.target;
};

module.exports = { Definition, Link };
```

**Single export:**
```javascript
// Usages.js
const Usages = function() {
    this.createdAt = Date.now();
};

module.exports = { Usages };
```

### Pattern 3: Hybrid (Nesting with Flat Files)

Combine both approaches for nested hierarchies:

```
models/
├── Scene2D.js            # exports { Scene2D }
├── Scene3D.js            # exports { Scene3D }
├── Scene2D/              # becomes container for Scene2D children
│   ├── Camera2D.js       # Scene2D.Camera2D
│   └── GraphNode2D.js    # Scene2D.GraphNode2D
└── Scene3D/
    └── Camera3D.js       # Scene3D.Camera3D
```

**Parent type definition:**
```javascript
// Scene2D.js
export const Scene2D = function(config) {
    this.width = config.width;
    this.height = config.height;
};
```

**Child type definition:**
```javascript
// Scene2D/Camera2D.js
export const Camera2D = function(position) {
    this.x = position.x;
    this.y = position.y;
};
// Results in: Scene2D.Camera2D
```

### Pattern 4: Self-defining Modules (Re-use, not Re-define)

A module may call mnemonica's `define()` itself and export the resulting
constructors. The loader detects this (via the `.collection[MNEMONICA]`
marker) and **re-uses the constructor as-is** instead of defining it
again — calling `define()` twice on the same name throws
`ALREADY_DECLARED`:

```javascript
// SelfDefined.js
const { define } = require('mnemonica');

const SelfDefined = define('SelfDefined', function(data) {
    this.payload = data.payload;
});

const SelfChild = SelfDefined.define('SelfChild', function() {
    this.child = true;
});

module.exports = { SelfDefined, SelfChild };
// loader logs: "already defined, re-using: SelfDefined"
```

Both exports land in the topology as-is, `SelfChild` stays a true
subtype of `SelfDefined`, and no duplicate definitions are attempted.

## Constructor Requirements

All constructor functions **MUST** follow these rules:

| Requirement | Valid | Invalid |
|-------------|-------|---------|
| Must be a function or class | `function MyType() {}` | `const obj = {}` |
| Must have a name | `function MyType() {}` | `const MyType = () => {}` |
| **Must start with Capital Letter** | `function MyType() {}` | `function myType() {}` |

**Important:** Lowercase-named exports are automatically skipped (no error thrown). This allows utility files to coexist with type definitions.

### Examples

```javascript
// ✅ Valid - named function with capital letter
module.exports = function User(data) {
    this.name = data.name;
};

// ✅ Valid - ES6 class with capital letter
module.exports = class User {
    constructor(data) {
        this.name = data.name;
    }
};

// ✅ Valid - named export with capital letter
const User = function(data) { this.name = data.name; };
module.exports = { User };

// ❌ Invalid - lowercase name (will be skipped)
module.exports = function user(data) {
    this.name = data.name;
};

// ❌ Invalid - arrow function (no name)
module.exports = (data) => {
    this.name = data.name;
};
```

## File Naming Conventions

| Pattern | Behavior |
|---------|----------|
| `TypeName.js` | Processed - defines TypeName type |
| `TypeName.ts` | Processed - defines TypeName type |
| `TypeName.mjs` | Processed - defines TypeName type |
| `helper.js` | **Skipped** - lowercase filename |
| `utils/` | **Skipped** - lowercase directory |
| `TypeName/` | Processed - if contains `index.{js,ts,mjs}` |

## API

### `loader(topologyPath, define, [checker])`

Scans a file or directory and creates mnemonica type definitions.

**Parameters:**
- `topologyPath` (string): Path to file or directory to scan
- `define` (function): The `define` function from mnemonica
- `checker` (function, optional): Filter function `(name, dirent) => boolean`

**Returns:**
```javascript
{
    topology: {
        TypeName: {
            name: 'TypeName',           // type name
            path: '/abs/path/file.js',  // absolute file path
            type: Constructor,          // the mnemonica type constructor
            kids: [                     // nested types
                { name, path, type, kids }
            ]
        }
    },
    logs: [                             // processing logs
        ['definition of:', 'TypeName'],
        ['skipping (lowercase):', 'helper']
    ]
}
```

**Examples:**

```javascript
const loader = require('@mnemonica/topologica');
const { define } = require('mnemonica');

// Load entire directory
const result1 = loader('./models', define);

// Load single file
const result2 = loader('./models/TypeName.js', define);

// With custom filter (skip files starting with _)
const result3 = loader('./models', define, (name, dirent) => {
    return !name.startsWith('_');
});
```

## Supported File Types

- `.js` - JavaScript files
- `.ts` - TypeScript files
- `.mjs` - ES Module files

## License

MIT
