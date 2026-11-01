import { describe, expect, it } from 'vitest'
import { bareImports } from './externals'

describe('bareImports', () => {
  it('finds package imports in ESM output', () => {
    const source = [
      'import { join } from "node:path";',
      'import { app } from "electron";',
      'import { z } from "zod";',
      'import * as lodash from "lodash/fp";',
      'import "side-effect-package";',
    ].join('\n')
    expect(bareImports(source)).toEqual([
      'lodash',
      'side-effect-package',
      'zod',
    ])
  })

  it('finds require calls and dynamic imports', () => {
    const source =
      'const a = require("left-pad"); const b = await import("@scope/pkg/sub");'
    expect(bareImports(source)).toEqual(['@scope/pkg', 'left-pad'])
  })

  it('ignores electron, node: modules, Node builtins and relative paths', () => {
    const source = [
      'import fs from "fs";',
      'import path from "node:path";',
      'import { app } from "electron";',
      'import { a } from "./chunk-a.js";',
      'import { b } from "../shared/b.js";',
      'const c = require("electron");',
      'const d = require("fs/promises");',
    ].join('\n')
    expect(bareImports(source)).toEqual([])
  })

  it('lists each package once', () => {
    const source = 'import "zod"; import { z } from "zod"; require("zod/v4")'
    expect(bareImports(source)).toEqual(['zod'])
  })

  it('finds a multi-line import', () => {
    const source =
      'import {\n  a,\n  b,\n} from "zod";\nexport * from "left-pad";'
    expect(bareImports(source)).toEqual(['left-pad', 'zod'])
  })

  it('ignores import text inside strings', () => {
    expect(bareImports('const note = "import from the vendor";')).toEqual([])
    expect(
      bareImports('throw new Error(\'use: import x from "pkg" instead\')'),
    ).toEqual([])
  })
})
