import { describe, expect, it } from 'vitest'
import { decodeMarkdown } from './decode-markdown'

const BOM = String.fromCharCode(0xfeff)

describe('decodeMarkdown', () => {
  it('drops a leading byte order mark', () => {
    expect(decodeMarkdown(`${BOM}# Title`)).toBe('# Title')
  })

  it('turns CRLF and CR line endings into LF, as the editor does', () => {
    expect(decodeMarkdown('# Title\r\n\r\nOne\rTwo\n')).toBe(
      '# Title\n\nOne\nTwo\n',
    )
  })

  it('keeps everything else as it is', () => {
    expect(decodeMarkdown(`# Title\n\nBody ${BOM}`)).toBe(
      `# Title\n\nBody ${BOM}`,
    )
  })
})
