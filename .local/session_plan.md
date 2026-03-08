# Objective
Reset the password for zachfuchs@gmail.com to "password123" and restart the app.

# Tasks

### T001: Reset password and restart app
- **Blocked By**: []
- **Details**:
  - Generate a bcrypt hash for "password123"
  - Run a SQL UPDATE to set the new password hash on the zachfuchs@gmail.com user row
  - Restart the "Start application" workflow so the app is accessible again
  - Files: DB only (no code changes)
  - Acceptance: User can log in at /login with zachfuchs@gmail.com / password123
