import { getConfig } from 'src/config'

const getBaseCookieName = () => getConfig().cookies.name
const isMergedCookie = () => getConfig().cookies.merged

export const getUserCookieName = () => {
  const baseAuthCookieName = getBaseCookieName()
  if (isMergedCookie()) {
    return baseAuthCookieName
  }
  return `${baseAuthCookieName}.AuthUser` // do not modify
}

export const getUserSigCookieName = () => `${getUserCookieName()}.sig`

export const getUserTokensCookieName = () => {
  const baseAuthCookieName = getBaseCookieName()
  if (isMergedCookie()) {
    return baseAuthCookieName
  }
  return `${baseAuthCookieName}.AuthUserTokens` // do not modify
}

export const getUserTokensSigCookieName = () =>
  `${getUserTokensCookieName()}.sig`
