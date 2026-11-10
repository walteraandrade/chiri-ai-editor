import type { TitleBarColors } from '../../electron/api'
import { sixDigitHex } from '../theme/color'
import type { ThemeRoles } from '../theme/tokens'

export const titleBarColors = (roles: ThemeRoles): TitleBarColors => ({
  color: sixDigitHex(roles.raised),
  symbolColor: sixDigitHex(roles.ink),
})
