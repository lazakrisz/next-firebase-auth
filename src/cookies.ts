// https://github.com/pillarjs/cookies
import Cookies from 'cookies'
import {
  GetServerSidePropsContext,
  NextApiRequest,
  NextApiResponse,
} from 'next'
import {
  compressDecodeSync,
  compressEncodeSync,
  decodeBase64,
  encodeBase64,
} from 'src/encoding'

interface ReqResObj {
  req: NextApiRequest | GetServerSidePropsContext['req']
  res: NextApiResponse | GetServerSidePropsContext['res']
}

interface ReqResOptionalObj {
  req: NextApiRequest | GetServerSidePropsContext['req']
  res?: NextApiResponse | GetServerSidePropsContext['res']
}

type CookieOptions = Omit<Cookies.Option & Cookies.SetOption, 'sameSite'> & {
  sameSite?: string
  merged?: boolean
  compression?: boolean
}

const createCookieMgr = (
  { req, res }: ReqResObj,
  {
    keys,
    secure,
  }: { keys?: Cookies.Option['keys']; secure?: Cookies.Option['secure'] } = {}
) => {
  // https://github.com/pillarjs/cookies
  const cookies = Cookies(req, res, {
    keys,
    secure,
  })
  return cookies
}

export const getCookie = (
  name: string,
  // The request object is mandatory. The response object is optional.
  {
    req,
    // The "cookies" package still interacts with the response object when
    // initializing. As a convenience, default to a minimal response object
    // that avoids unhelpful "cookies" errors when a response object is not
    // provided.
    // https://github.com/pillarjs/cookies/blob/master/index.js
    res = {
      getHeader: () => [],
      setHeader: () => ({
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        call: () => {},
      }),
    } as unknown as NextApiResponse,
  }: ReqResOptionalObj,
  {
    keys,
    secure,
    signed = false,
    merged = false,
    compression = false,
  }: {
    keys?: Cookies.Option['keys']
    secure?: Cookies.Option['secure']
    signed?: Cookies.SetOption['signed']
    merged?: boolean
    compression?: boolean
  } = {}
) => {
  if (signed) {
    const areCookieKeysDefined = Array.isArray(keys)
      ? keys.length &&
        (keys.filter ? keys.filter((item) => item !== undefined).length : true)
      : !!keys
    if (!areCookieKeysDefined) {
      throw new Error(
        'The "keys" value must be provided when using signed cookies.'
      )
    }
  }
  if (!req) {
    throw new Error('The "req" argument is required when calling `getCookie`.')
  }

  const cookies = createCookieMgr({ req, res }, { keys, secure })

  const decoder = compression ? compressDecodeSync : decodeBase64

  // old behavior
  if (!merged) {
    // https://github.com/pillarjs/cookies#cookiesget-name--options--
    const cookieVal = cookies.get(name, { signed })
    return cookieVal ? decoder(cookieVal) : undefined
  }

  // we restore the cookie here. using unsigned because otherwise it checks if using signed or not
  const cookie = cookies.get(name, { signed: false })
  const cookieValue = cookie ? compressDecodeSync(cookie) : undefined
  const separator = '|-|'

  const hasSeparator = cookieValue?.includes(separator)

  // if the cookie value has no separator we fall back to the old way
  if (!hasSeparator) {
    // https://github.com/pillarjs/cookies#cookiesget-name--options--
    const cookieVal = cookies.get(name, { signed })
    return cookieVal ? compressDecodeSync(cookieVal) : undefined
  }

  const primaryCookieValue = cookieValue?.split(separator)[0]
  let signature = cookieValue?.split(separator)[1]

  if (!signature && signed) {
    // if the cookie is signed, we need to get the signature from the cookie
    const signatureCookie = cookies.get(`${name}.sig`, { signed: false })
    if (signatureCookie) {
      signature = signatureCookie
    }
  }

  // restore the signature onto the cookie
  const oldCookie = `${name}=${cookie}`
  const newCookie = `${name}=${
    primaryCookieValue ? compressEncodeSync(primaryCookieValue) : ''
  }`

  const replaced = req.headers.cookie?.replace(oldCookie, newCookie)
  if (req.headers.cookie) {
    req.headers.cookie = replaced
    req.headers.cookie += `; ${name}.sig=${signature}`
  }
  // req.cookies[name] = realCookie ? encodeBase64(realCookie) : realCookie; // originally we hashed the encoded value
  // req.cookies[`${name}.sig`] = signature;

  // https://github.com/pillarjs/cookies#cookiesget-name--options--
  const cookieVal = createCookieMgr({ req, res }, { keys, secure }).get(name, {
    signed,
  })

  return cookieVal ? compressDecodeSync(cookieVal) : undefined
}

export const setCookie = (
  name: string,
  cookieVal: string | undefined,
  // The response object is mandatory. The request is optional and unused.
  { req, res }: ReqResObj,
  {
    keys,
    domain,
    httpOnly,
    maxAge,
    overwrite,
    path,
    sameSite,
    secure,
    signed,
    merged = false,
    compression = false,
  }: CookieOptions = {}
) => {
  if (signed && !keys) {
    throw new Error(
      'The "keys" value must be provided when using signed cookies.'
    )
  }
  if (!res) {
    throw new Error('The "res" argument is required when calling `setCookie`.')
  }

  const cookies = createCookieMgr({ req, res }, { keys, secure })
  const encoder = compression ? compressEncodeSync : encodeBase64

  // If the value is not defined, set the value to undefined
  // so that the cookie will be deleted.
  let valToSet = cookieVal == null ? undefined : encoder(cookieVal)

  if (merged) {
    cookies.set(name, valToSet, {
      domain,
      httpOnly,
      maxAge,
      overwrite,
      path,
      // Prefer explicit sameSite string instead of boolean.
      sameSite: sameSite as Cookies.SetOption['sameSite'],
      secure,
      signed: true,
    })

    const signatureName = `${name}.sig`

    const setCookieHeader = res.getHeader('set-cookie')
    // we need to get the cookies from the response, and not the request.
    const setCookies =
      typeof setCookieHeader === 'string'
        ? [setCookieHeader]
        : typeof setCookieHeader === 'number'
          ? [setCookieHeader.toString()]
          : setCookieHeader ?? []

    let signatureValue: string | undefined = setCookies.filter((cookie) =>
      cookie.includes(`${name}.sig=`)
    )[0]
    signatureValue = signatureValue
      ? signatureValue.split(';')[0]?.replace(`${signatureName}=`, '')
      : undefined

    // we just remove the signature cookie.
    cookies.set(signatureName, null, {
      domain,
      httpOnly,
      maxAge,
      overwrite,
      path,
      sameSite: sameSite as Cookies.SetOption['sameSite'],
      secure,
      signed: false,
    })

    valToSet =
      cookieVal == null
        ? undefined
        : compressEncodeSync(`${cookieVal}|-|${signatureValue}`)

    cookies.set(name, valToSet, {
      domain,
      httpOnly,
      maxAge,
      overwrite,
      path,
      // Prefer explicit sameSite string instead of boolean.
      sameSite: sameSite as Cookies.SetOption['sameSite'],
      secure,
      signed: false, // signed here doesn't matter
    })
  } else {
    // https://github.com/pillarjs/cookies#cookiesset-name--value---options--
    cookies.set(name, valToSet, {
      domain,
      httpOnly,
      maxAge,
      overwrite,
      path,
      // Prefer explicit sameSite string instead of boolean.
      sameSite: sameSite as Cookies.SetOption['sameSite'],
      secure,
      signed,
    })
  }
}

// Some options, like path and domain, must match those used when setting
// the cookie.
export const deleteCookie = (
  name: string,
  reqResObj: ReqResObj,
  options: CookieOptions
) => {
  // "If the value is omitted, an outbound header with an expired
  // date is used to delete the cookie."
  // https://github.com/pillarjs/cookies#cookiesset-name--value---options--
  setCookie(name, undefined, reqResObj, options)
}
