const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)

export const decodeMarkdown = (text: string): string =>
  (text.startsWith(BYTE_ORDER_MARK)
    ? text.slice(BYTE_ORDER_MARK.length)
    : text
  ).replace(/\r\n?/g, '\n')
