# Faculty Leave Ledger

A full-stack web application for managing faculty leave and permission requests, built for D.G. Vaishnav College. Faculty can submit leave/permission requests and assign substitutes; department heads (HODs) can review and approve or reject them — all with real-time email and in-app notifications.

**Live demo:** [faculty-leave-tracking.vercel.app](https://faculty-leave-tracking.vercel.app)
**Status:** In testing — built solo as a self-directed project to learn full-stack development end-to-end.

## Features

- **Role-based access** — separate Faculty and HOD views with real email/password authentication
- **Leave & permission workflow** — submit, approve, or reject requests with HOD comments
- **Business rules enforcement** — 12-day annual leave cap with automatic Loss-of-Pay flagging, 2 permissions/month limit, fixed shift time slots
- **Substitute coverage requests** — faculty can assign a substitute for their classes, who can accept or decline
- **Weekly timetable view** — per-faculty class schedule
- **Notifications** — real-time in-app notification bell + automated email alerts (Gmail SMTP)
- **Calendar view** — visual overview of approved leave across the department
- **Reports & CSV export** — leave statistics and exportable records
- **Installable PWA** — works as an installed app on desktop and mobile with offline app-shell support
- **Custom branding** — college logo, favicon, and installable app icon

## Tech Stack

- **Frontend:** React (Vite), plain CSS-in-JS
- **Backend / Database:** Supabase (PostgreSQL, Auth, Row Level Security, Edge Functions)
- **Email:** Gmail SMTP via a Supabase Edge Function (Deno)
- **Hosting:** Vercel
- **Icons/Charts:** lucide-react, Recharts

## Architecture

```
React (Vite) frontend
   |
   |--- Supabase Auth (email/password login, role + department stored in user metadata)
   |--- Supabase PostgreSQL (requests, notifications, substitute_requests, timetables)
   |--- Supabase Edge Function (send-notification-email) --- Gmail SMTP --- real inbox delivery
```

All database access is authenticated-only via Row Level Security policies — no public read/write access.

## What I learned building this

- Designing and securing a real relational schema (RLS policies, foreign keys, constraints)
- Building and debugging a serverless Edge Function (CORS, environment secrets, SMTP)
- End-to-end auth flow with role-based routing
- Deploying and iterating on a live production app (GitHub -> Vercel CI/CD)
- Making a React app installable as a PWA (manifest, service worker, icons)

## Running locally

```bash
npm install
npm run dev
```

Requires a Supabase project with the schema set up (see `/sql` for setup scripts) and environment values for `SUPABASE_URL` / `SUPABASE_KEY`.

## Author

Built by [Karthikeyan P](https://github.com/karthikn046) — B.Sc. Computer Science, D.G. Vaishnav College.


<img width="300" height="600" alt="WhatsApp Image 2026-08-31 at 10 34 49 AM" src="https://github.com/user-attachments/assets/ab4a8a02-ea15-42b3-9233-1153dd378e20" />
<img width="300" height="600" alt="WhatsApp Image 2026-08-31 at 10 34 49 AM (1)" src="https://github.com/user-attachments/assets/dd32385c-3b49-4ebb-a6bd-6986b1242ede" />
<img width="300" height="600" alt="WhatsApp Image 2026-08-31 at 10 34 49 AM (2)" src="https://github.com/user-attachments/assets/14a28ae3-062e-4152-8938-5c858ce82ac2" />
