import hoistZodSchema from '../src/hoistZodSchema.js';
import { pluginTester } from 'babel-plugin-tester';
import multiline from 'multiline-ts';

pluginTester({
  filepath: 'test.ts',
  plugin: hoistZodSchema,
  tests: [
    {
      code: multiline`
        function getSchema() {
          return z.object({ name: z.string() });
        }
      `,
      output: multiline`
        const _schema_94b7f = z.object({
          name: z.string(),
        });
        function getSchema() {
          return _schema_94b7f;
        }
      `,
      title: 'hoists a simple schema from inside a function',
    },
    {
      code: multiline`
        function getSchema() {
          return z.string().min(1).max(100).optional();
        }
      `,
      output: multiline`
        const _schema_83766b = z.string().min(1).max(100).optional();
        function getSchema() {
          return _schema_83766b;
        }
      `,
      title: 'hoists chained schemas',
    },
    {
      code: multiline`
        function a() {
          return z.string();
        }
        function b() {
          return z.string();
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        function a() {
          return _schema_6707424a;
        }
        function b() {
          return _schema_6707424a;
        }
      `,
      title: 'deduplicates identical schemas',
    },
    {
      code: multiline`
        function getSchema(minLength) {
          return z.string().min(minLength);
        }
      `,
      output: multiline`
        function getSchema(minLength) {
          return z.string().min(minLength);
        }
      `,
      title: 'does not hoist schemas that reference local variables',
    },
    {
      code: multiline`
        const schema = z.object({ name: z.string() });
      `,
      output: multiline`
        const schema = z.object({
          name: z.string(),
        });
      `,
      title: 'does not hoist schemas already at top level',
    },
    {
      code: multiline`
        function getSchema() {
          return z.object({
            name: z.string(),
            age: z.number().optional(),
          });
        }
      `,
      output: multiline`
        const _schema_ba9bf = z.object({
          name: z.string(),
          age: z.number().optional(),
        });
        function getSchema() {
          return _schema_ba9bf;
        }
      `,
      title: 'handles nested zod calls correctly (hoists entire object)',
    },
    {
      code: multiline`
        const getSchema = () => z.object({ id: z.string() });
      `,
      output: multiline`
        const _schema_3cb7abaf = z.object({
          id: z.string(),
        });
        const getSchema = () => _schema_3cb7abaf;
      `,
      title: 'hoists schemas from arrow functions',
    },
    {
      code: multiline`
        class Validator {
          getSchema() {
            return z.object({ value: z.number() });
          }
        }
      `,
      output: multiline`
        const _schema_190b397e = z.object({
          value: z.number(),
        });
        class Validator {
          getSchema() {
            return _schema_190b397e;
          }
        }
      `,
      title: 'hoists schemas from class methods',
    },
    {
      code: multiline`
        function a() {
          return z.string();
        }
        function b() {
          return z.number();
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        const _schema_5f7c1ef = z.number();
        function a() {
          return _schema_6707424a;
        }
        function b() {
          return _schema_5f7c1ef;
        }
      `,
      title: 'handles multiple different schemas',
    },
    {
      code: multiline`
        function getSchema() {
          return foo.object({ name: foo.string() });
        }
      `,
      output: multiline`
        function getSchema() {
          return foo.object({
            name: foo.string(),
          });
        }
      `,
      title: 'does not hoist non-zod calls',
    },
    {
      code: multiline`
        function outer() {
          function inner() {
            return z.string();
          }
          return inner;
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        function outer() {
          function inner() {
            return _schema_6707424a;
          }
          return inner;
        }
      `,
      title: 'hoists from deeply nested functions',
    },
    {
      code: multiline`
        function getSchema() {
          return z.enum(['a', 'b', 'c']);
        }
      `,
      output: multiline`
        const _schema_277180be = z.enum(["a", "b", "c"]);
        function getSchema() {
          return _schema_277180be;
        }
      `,
      title: 'handles schemas with literal values',
    },
    {
      code: multiline`
        function getSchema() {
          return z.lazy(() => z.object({ child: schema }));
        }
      `,
      output: multiline`
        const _schema_d7e257aa = z.lazy(() =>
          z.object({
            child: schema,
          }),
        );
        function getSchema() {
          return _schema_d7e257aa;
        }
      `,
      title: 'handles z.lazy for recursive schemas',
    },
    {
      code: multiline`
        import { MAX_LENGTH } from './constants';

        function getSchema() {
          return z.string().max(MAX_LENGTH);
        }
      `,
      output: multiline`
        const _schema_42caf = z.string().max(MAX_LENGTH);
        import { MAX_LENGTH } from "./constants";
        function getSchema() {
          return _schema_42caf;
        }
      `,
      title: 'preserves schemas that use imported constants',
    },
    {
      code: multiline`
        function getSchema(condition) {
          return condition ? z.string() : z.number();
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        const _schema_5f7c1ef = z.number();
        function getSchema(condition) {
          return condition ? _schema_6707424a : _schema_5f7c1ef;
        }
      `,
      title: 'hoists both branches of conditional/ternary returns',
    },
    {
      code: multiline`
        function getSchema() {
          const s = z.string();
          return s;
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        function getSchema() {
          const s = _schema_6707424a;
          return s;
        }
      `,
      title: 'hoists schema assigned to variable inside function',
    },
    {
      code: multiline`
        import { z as zod } from 'zod';
    
        function getSchema() {
          return zod.string();
        }
      `,
      output: multiline`
        import { z as zod } from "zod";
        function getSchema() {
          return zod.string();
        }
      `,
      title: 'does not hoist renamed zod import (only detects `z` identifier)',
    },
    {
      code: multiline`
        import * as z from 'zod';
    
        function getSchema() {
          return z.string();
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        import * as z from "zod";
        function getSchema() {
          return _schema_6707424a;
        }
      `,
      title: 'hoists schemas with namespace import',
    },
    {
      code: multiline`
        function validate(input) {
          return someValidator(z.string());
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        function validate(input) {
          return someValidator(_schema_6707424a);
        }
      `,
      title: 'hoists schema passed as function argument',
    },
    {
      code: multiline`
        function getSchemas() {
          return { name: z.string(), age: z.number() };
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        const _schema_5f7c1ef = z.number();
        function getSchemas() {
          return {
            name: _schema_6707424a,
            age: _schema_5f7c1ef,
          };
        }
      `,
      title: 'hoists schemas in returned object literal',
    },
    {
      code: multiline`
        function getSchemas() {
          return [z.string(), z.number()];
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        const _schema_5f7c1ef = z.number();
        function getSchemas() {
          return [_schema_6707424a, _schema_5f7c1ef];
        }
      `,
      title: 'hoists schemas in returned array',
    },
    {
      code: multiline`
        class Validator {
          getSchema() {
            return z.string().refine(() => this.isValid);
          }
        }
      `,
      output: multiline`
        class Validator {
          getSchema() {
            return z.string().refine(() => this.isValid);
          }
        }
      `,
      title: 'does not hoist schema with `this` reference in callback',
    },
    {
      code: multiline`
        function getSchema() {
          return z.string().transform((val) => val.trim());
        }
      `,
      output: multiline`
        const _schema_1dde9c = z.string().transform((val) => val.trim());
        function getSchema() {
          return _schema_1dde9c;
        }
      `,
      title: 'hoists schema with .transform() that has no local refs',
    },
    {
      code: multiline`
        function makeSchema(z) {
          return z.string();
        }
      `,
      output: multiline`
        function makeSchema(z) {
          return z.string();
        }
      `,
      title: 'does not hoist when z is shadowed by parameter',
    },
    {
      code: multiline`
        function getSchema() {
          const z = { string: () => 'fake' };
          return z.string();
        }
      `,
      output: multiline`
        function getSchema() {
          const z = {
            string: () => "fake",
          };
          return z.string();
        }
      `,
      title: 'does not hoist when z is shadowed by local variable',
    },
    {
      code: multiline`
        function getSchema() {
          return z.union([z.string(), z.number()]);
        }
      `,
      output: multiline`
        const _schema_ed7ede = z.union([z.string(), z.number()]);
        function getSchema() {
          return _schema_ed7ede;
        }
      `,
      title: 'hoists z.union with nested schemas',
    },
    {
      code: multiline`
        async function getSchema() {
          return z.string();
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        async function getSchema() {
          return _schema_6707424a;
        }
      `,
      title: 'hoists from async functions',
    },
    {
      code: multiline`
        export function getSchema() {
          return z.string();
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        export function getSchema() {
          return _schema_6707424a;
        }
      `,
      title: 'hoists from exported functions',
    },
    {
      code: multiline`
        function getSchema() {
          return z.coerce.number();
        }
      `,
      output: multiline`
        const _schema_9edad89b = z.coerce.number();
        function getSchema() {
          return _schema_9edad89b;
        }
      `,
      title: 'hoists z.coerce schemas',
    },
    {
      code: multiline`
        const validate = (x) => x.parse(z.string());
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        const validate = (x) => x.parse(_schema_6707424a);
      `,
      title: 'hoists schema in method argument of non-zod call',
    },
    {
      code: multiline`
        function getSchema() {
          return z.string().brand<'UserId'>();
        }
      `,
      output: multiline`
        const _schema_xxx = z.string().brand<"UserId">();
        function getSchema() {
          return _schema_xxx;
        }
      `,
      skip: true,
      title: 'hoists schema with .brand() type parameter',
    },
    {
      code: multiline`
        const baseSchema = z.object({ id: z.string() });
        function getSchema() {
          return baseSchema.extend({ name: z.string() });
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        const baseSchema = z.object({
          id: z.string(),
        });
        function getSchema() {
          return baseSchema.extend({
            name: _schema_6707424a,
          });
        }
      `,
      title:
        'does not hoist when calling method on non-z identifier (baseSchema.extend)',
    },
    {
      code: multiline`
        function getSchema() {
          return z.enum(allowedTypes);
        }
        const allowedTypes = ['a', 'b', 'c'];
      `,
      output: multiline`
        function getSchema() {
          return z.enum(allowedTypes);
        }
        const allowedTypes = ["a", "b", "c"];
      `,
      title:
        'does not hoist schema referencing top-level const declared later in file',
    },
    {
      code: multiline`
        const allowedTypes = ['a', 'b', 'c'];
    
        function getSchema() {
          return z.enum(allowedTypes);
        }
      `,
      output: multiline`
        const allowedTypes = ["a", "b", "c"];
        function getSchema() {
          return z.enum(allowedTypes);
        }
      `,
      title:
        'does not hoist schema referencing top-level const (would cause TDZ)',
    },
    {
      code: multiline`
        function getSchema() {
          return z.object({ type: z.enum(Types), status: z.enum(Statuses) });
        }
        const Types = ['a', 'b'] as const;
        const Statuses = ['pending', 'done'] as const;
      `,
      output: multiline`
        function getSchema() {
          return z.object({
            type: z.enum(Types),
            status: z.enum(Statuses),
          });
        }
        const Types = ["a", "b"] as const;
        const Statuses = ["pending", "done"] as const;
      `,
      skip: true,
      title:
        'does not hoist schema referencing multiple top-level consts declared later',
    },
    {
      code: multiline`
        function getSchema() {
          return z.string().default(DEFAULT_VALUE);
        }
        export const DEFAULT_VALUE = 'hello';
      `,
      output: multiline`
        function getSchema() {
          return z.string().default(DEFAULT_VALUE);
        }
        export const DEFAULT_VALUE = "hello";
      `,
      title: 'does not hoist schema referencing exported const declared later',
    },
    {
      code: multiline`
        let counter = 0;
        function getSchema() {
          return z.number().default(counter);
        }
      `,
      output: multiline`
        let counter = 0;
        function getSchema() {
          return z.number().default(counter);
        }
      `,
      title: 'does not hoist schema referencing let variable (mutable)',
    },
    {
      code: multiline`
        import { z } from 'zod';
        import { myRefine } from './utils';
    
        function getSchema() {
          return z.string().refine(myRefine);
        }
      `,
      output: multiline`
        const _schema_1c526a1f = z.string().refine(myRefine);
        import { z } from "zod";
        import { myRefine } from "./utils";
        function getSchema() {
          return _schema_1c526a1f;
        }
      `,
      title: 'hoists schema referencing imported function',
    },
    {
      code: multiline`
        function validate(input) {
          return z.string().parse(input);
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        function validate(input) {
          return _schema_6707424a.parse(input);
        }
      `,
      title: 'does not hoist .parse() call, only the schema definition',
    },
    {
      code: multiline`
        function validate(input) {
          return z.object({ name: z.string() }).parse(input);
        }
      `,
      output: multiline`
        const _schema_94b7f = z.object({
          name: z.string(),
        });
        function validate(input) {
          return _schema_94b7f.parse(input);
        }
      `,
      title: 'does not hoist .parse() with complex schema',
    },
    {
      code: multiline`
        async function getData() {
          const result = z.object({ data: z.string() }).parse(await fetchData());
          return result;
        }
      `,
      output: multiline`
        const _schema_b = z.object({
          data: z.string(),
        });
        async function getData() {
          const result = _schema_b.parse(await fetchData());
          return result;
        }
      `,
      title: 'does not hoist .parse() with await expression argument',
    },
    {
      code: multiline`
        function validate(input) {
          return z.string().safeParse(input);
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        function validate(input) {
          return _schema_6707424a.safeParse(input);
        }
      `,
      title: 'does not hoist .safeParse() call, only the schema definition',
    },
    {
      code: multiline`
        async function validate(input) {
          return z.string().parseAsync(input);
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        async function validate(input) {
          return _schema_6707424a.parseAsync(input);
        }
      `,
      title: 'does not hoist .parseAsync() call, only the schema definition',
    },
    {
      code: multiline`
        async function validate(input) {
          return z.string().safeParseAsync(input);
        }
      `,
      output: multiline`
        const _schema_6707424a = z.string();
        async function validate(input) {
          return _schema_6707424a.safeParseAsync(input);
        }
      `,
      title:
        'does not hoist .safeParseAsync() call, only the schema definition',
    },
  ],
});
