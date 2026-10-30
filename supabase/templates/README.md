# Email sign-in codes

`sign-in.html` is the prepared template for Magic link or OTP and Confirm sign up.
Use subject `Your Recipe Box sign-in code`. It includes `{{ .Token }}` for entry
in the home-screen app, plus the existing browser link as an alternative.

This template is **not applied**. The live dashboard currently requires custom
SMTP or Pro before it permits template editing. The project uses default SMTP.
Do not update login copy to promise codes until email delivery is configured and
a newly requested email has been verified to include the code.

The current app already calls `verifyOtp` with type `email` and supports typing a
code. Applying a working email template would therefore fix code delivery without
requiring a frontend deployment. The user must request a new email afterward;
emails already delivered cannot change.

References:
- https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier
- https://supabase.com/docs/guides/auth/auth-email-templates
