# Babel Plugin to Hoist Zod Schemas

Hoists Zod schema definitions to the top of the file.

This:

```ts
function getSchema() {
  return z.object({ name: z.string() });
}
```

Becomes this:

```ts
const _schema_94b7f = z.object({
  name: z.string(),
});
function getSchema() {
  return _schema_94b7f;
}
```

## Motivation

Initializing [Zod](https://zod.dev/) schemas is expensive.

By hoisting the schema to the top of the file, we can avoid re-initializing the schema every time we use it.

## Why Use This?

- **Performance Boost**: Prevents unnecessary re-initialization.
- **Zero Mental Overhead**: Write normal Zod code - the hoisting happens automatically.
- **No Code Changes Required**: Works with your existing codebase without modifications.

## Installation

```bash
npm install --save-dev babel-plugin-zod-hoist
```

## Usage

Add the plugin to your Babel configuration:

```json
{
  "plugins": ["babel-plugin-zod-hoist"]
}
```
