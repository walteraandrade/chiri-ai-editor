import type { ClientError } from '../ai/errors'

export const describeError = (error: ClientError): string => {
  switch (error.type) {
    case 'out-of-credit':
      return 'OpenRouter is out of credit. Add credit to your OpenRouter account, then retry.'
    case 'rate-limited':
      return 'Too many requests. Wait a moment, then retry.'
    case 'timeout':
      return 'The model took too long to answer. Retry.'
    case 'network':
      return 'Could not reach the model. Check your connection, then retry.'
    case 'invalid-output':
      return 'The model returned an unusable answer twice. Retry, or rephrase the Instruction.'
    case 'aborted':
      return 'The request was cancelled.'
    case 'api':
      return `The model request failed (${error.status}): ${error.message}`
    case 'unknown':
      return `Something went wrong: ${error.message}`
  }
}
