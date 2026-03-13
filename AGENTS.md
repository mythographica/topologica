# AGENTS.md - @mnemonica/topologica

This file provides guidance for AI agents working with the `@mnemonica/topologica` package.

## Project Overview

`@mnemonica/topologica` is a file system walker that automatically defines [mnemonica](https://www.npmjs.com/package/mnemonica) types based on directory and file structure. It enables declarative type definitions through filesystem organization.

## How the Loader Works

The loader (`lib/index.js`) scans a directory or file path and automatically creates mnemonica type definitions:

### Two Supported Patterns

#### 1. Directory-based (Original)
```
models/
  TypeName/
    index.js          # module.exports = function TypeName() {}
    SubType/
      index.js        # becomes nested type of TypeName
```

**Rules:**
- Directory name becomes the type name
- Must contain an `index.js`, `index.ts`, or `index.mjs` file
- The index file exports a named constructor function
- Subdirectories automatically become nested types

#### 2. Flat File (New)
```
models/
  TypeName.js         # export const TypeName = define(...)
  SubType.js          # export const SubType = define(...)
```

**Rules:**
- File name (without extension) is used as fallback type name
- Can export multiple constructors from single file
- Constructor name takes precedence over filename
- Supports `.js`, `.ts`, `.mjs` extensions

### Constructor Requirements

**CRITICAL:** All constructor functions MUST:

1. **Be a function or class**
2. **Have a name** (not anonymous)
3. **Start with Capital Letter** (enforced by mnemonica)
   - ✅ `function MyType() {}`
   - ✅ `class MyType {}`
   - ❌ `function myType() {}` - skipped (lowercase)
   - ❌ `const MyType = () => {}` - skipped (anonymous arrow function)

Lowercase-named exports are automatically skipped - no error is thrown.

### Export Patterns

**Single export (function):**
```javascript
// Definition.js
module.exports = function Definition(data) {
    this.id = data.id;
};
```

**Multiple named exports (object):**
```javascript
// Definition.js
const Definition = function(data) {
    this.id = data.id;
};

const Link = function(data) {
    this.source = data.source;
    this.target = data.target;
};

module.exports = { Definition, Link };
```

**ES6 exports:**
```typescript
// Definition.ts
export const Definition = function(data: any) {
    this.id = data.id;
};

export const Link = function(data: any) {
    this.source = data.source;
};
```

### Nested Type Discovery

If a subdirectory matches a constructor name, it becomes a nested type:

```
models/
  Scene2D.js          # exports Scene2D constructor
  Scene2D/            # becomes nested type container
    Camera2D.js       # Scene2D.Camera2D
    GraphNode2D.js    # Scene2D.GraphNode2D
```

## File Naming Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| Capitalized file | `TypeName.js` | Defines TypeName type |
| Lowercase file | `helper.js` | **Skipped** - use for utilities |
| Capitalized dir | `TypeName/` | With `index.js`, defines TypeName |
| Lowercase dir | `utils/` | **Skipped** unless contains valid index |

## Build Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Lint the built code
npm run lint

# Lint tests
npm run lint:test
```

## Test Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Debug tests
npm run debug
```

## Test Structure

- `test/tms/` - Directory-based pattern fixtures
- `test/fixtures/flat-files/` - Flat file pattern fixtures
- `test/index.js` - Main test suite using Mocha + Chai

## Common Tasks

### Adding a New Type

**Via flat file:**
```javascript
// models/MyType.js
const MyType = function(data) {
    Object.assign(this, data);
};

module.exports = { MyType };
```

**Via directory:**
```javascript
// models/MyType/index.js
module.exports = function MyType(data) {
    Object.assign(this, data);
};
```

### Creating Nested Types

```javascript
// File: models/ParentType.js
const ParentType = function() {
    this.createdAt = Date.now();
};

module.exports = { ParentType };
```

```javascript
// File: models/ParentType/ChildType.js
const ChildType = function(data) {
    this.data = data;
};

module.exports = { ChildType };
// Results in: ParentType.ChildType
```

## Loader API

```javascript
const loader = require('@mnemonica/topologica');

const { define } = require('mnemonica');

// Load from directory
const result = loader('./models', define);

// Load from specific file
const result = loader('./models/TypeName.js', define);

// With custom checker (filter)
const result = loader('./models', define, (name, dirent) => {
    // Return false to skip this entry
    return !name.startsWith('_');
});
```

### Return Value

```javascript
{
    topology: {
        TypeName: {
            name: 'TypeName',
            path: '/absolute/path/to/TypeName.js',
            type: TypeConstructor,
            kids: [
                // Nested type definitions
            ]
        }
    },
    logs: [
        // Processing logs for debugging
    ]
}
```

## Architecture Notes

### Key Functions

- `findIndexFile(dirPath)` - Locates `index.{js,ts,mjs}` in directory
- `isCapitalized(name)` - Validates constructor name starts with uppercase
- `addInliners(type, handler)` - Processes inline nested handlers
- `loader(topologyPath, define, checker)` - Main entry point

### Processing Flow

1. Check if path is file or directory
2. If file: load and inspect exports
3. If directory: scan entries
4. For each valid constructor export:
   - Validate name is capitalized
   - Call `define(name, handler)` to create type
   - Check for matching subdirectory (nested types)
   - Process inline handlers via `addInliners`
5. Return topology map and logs
