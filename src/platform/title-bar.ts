import type { TitleBarColors } from '../../electron/api'
import type { ThemeRoles } from '../theme/tokens'

export const titleBarColors = (roles: ThemeRoles): TitleBarColors => ({
  color: roles.raised,
  symbolColor: roles.ink,
})
