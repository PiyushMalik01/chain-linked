/**
 * Email Module Index
 * @description Exports email functionality for the application
 * @module lib/email
 */

export {
  sendEmail,
  sendBatchEmails,
  getFromAddress,
} from './resend'

export type {
  SendEmailOptions,
  SendEmailResult,
} from './resend'
