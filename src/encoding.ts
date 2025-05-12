import { promisify } from 'util'
import { deflate, deflateSync, inflate, inflateSync } from 'zlib'

/**
 * Decode a base64 value to an object.
 *
 * @param {String} string
 * @return {Object}
 */
export const decodeBase64 = (str: string) => {
  const body = Buffer.from(str, 'base64').toString('utf8')
  return JSON.parse(body)
}

const isErrorLike = (error: unknown): error is Error => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as Record<string, unknown>).message === 'string'
  )
}

/**
 * Encode an object into a base64-encoded JSON string.
 *
 * @param {Object} obj
 * @return {String}
 * @private
 */
export const encodeBase64 = (obj: object | string) => {
  const str = JSON.stringify(obj)
  return Buffer.from(str).toString('base64')
}

export const compressEncode = async (obj: object | string) => {
  const str = JSON.stringify(obj)

  const compressedData = await promisify(deflate)(str)

  return compressedData.toString('base64')
}

export const compressDecode = async (str: string) => {
  const compressedData = Buffer.from(str, 'base64')

  const decompressedData = await promisify(inflate)(
    new Uint8Array(compressedData)
  )

  return JSON.parse(decompressedData.toString())
}

export const compressEncodeSync = (obj: object | string) => {
  const str = JSON.stringify(obj)

  const compressedData = deflateSync(str)

  return compressedData.toString('base64')
}

const tryInflate = (str: string) => {
  try {
    const body = inflateSync(
      new Uint8Array(Buffer.from(str, 'base64'))
    ).toString('utf8')

    return body
  } catch (error) {
    if (
      isErrorLike(error) &&
      typeof error.message.includes('incorrect header check')
    ) {
      const body = Buffer.from(str, 'base64').toString('utf8')
      return body
    }

    throw error
  }
}

export const compressDecodeSync = (str: string) => {
  const body = tryInflate(str)

  return JSON.parse(body)
}
