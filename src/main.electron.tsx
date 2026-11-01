import { mountApp } from './platform/mount'
import { createBrowserWebKit } from './platform/web-kit'

mountApp(createBrowserWebKit())
