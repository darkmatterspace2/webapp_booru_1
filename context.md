# Project Context – External Media Index Web App

## Overview

This project is a **beginner-friendly web application** that displays images or videos using **external links only**.  
No media files are stored, uploaded, or processed by this application.

The app behaves like a **lightweight booru-style index**:
- Stores metadata and tags
- Displays previews via external URLs
- Redirects users to original source sites

The entire system is **serverless, asset-light, and free-tier friendly**.

---

## Core Principles

- ❌ No image/video storage
- ❌ No file uploads
- ❌ No media processing
- ✅ Only external URLs
- ✅ Static frontend
- ✅ Serverless backend
- ✅ Easy to deploy and maintain

---

## Tech Stack

### Version Control
- **GitHub**
  - Stores frontend code
  - Stores documentation
  - Triggers deployment

### Frontend Hosting
- **Netlify**
  - Static site hosting
  - Auto-deploy on GitHub push
  - Optional serverless functions

### Backend
- **Supabase**
  - PostgreSQL database
  - Auto-generated REST API
  - Authentication (optional)

---

## What This App Does

- Displays a grid of media previews
- Uses `<img>` or `<video>` tags with external URLs
- Allows searching by tags
- Stores:
  - Media source links
  - Preview links
  - Tags
  - Basic metadata

---

## What This App Does NOT Do

- Does not host media
- Does not download media
- Does not resize or optimize media
- Does not bypass paywalls or permissions
- Does not scrape aggressively

---

## High-Level Architecture

```

Browser
↓
Netlify (Static Frontend)
↓
Supabase REST API
↓
PostgreSQL (Metadata Only)

````

External media is loaded **directly from source URLs**.

---

## Database Design (Supabase)

### posts
Stores external media references.

| column | type | description |
|------|-----|------------|
| id | bigint | primary key |
| source_url | text | original media page |
| media_url | text | direct image/video URL |
| preview_url | text | optional thumbnail |
| rating | text | safe / nsfw / explicit |
| created_at | timestamp | auto |

---

### tags
Stores unique tags.

| column | type | description |
|------|-----|------------|
| id | bigint | primary key |
| name | text | unique tag name |
| type | text | general / artist / meta |

---

### post_tags
Many-to-many mapping.

| column | type |
|------|-----|
| post_id | bigint |
| tag_id | bigint |

---

## Example Media Rendering

```html
<a href="SOURCE_URL" target="_blank">
  <img src="PREVIEW_OR_MEDIA_URL" loading="lazy" />
</a>
````

No files are hosted locally.

---

## Tag Search Concept

Users can search using:

* `cat girl`
* `cat -gore`
* `artist:name`

Tag filtering is done via **SQL queries** or **Supabase RPC functions**.

---

## Deployment Flow

1. Create GitHub repository
2. Add frontend files (HTML/CSS/JS)
3. Create Supabase project
4. Create tables
5. Copy Supabase URL + anon key
6. Add keys to frontend config
7. Connect GitHub repo to Netlify
8. Auto-deploy on every push

---

## Environment Variables

Used only in frontend (public keys):

* `SUPABASE_URL`
* `SUPABASE_ANON_KEY`

No secrets stored in code.

---

## Legal & Safety Notes

* This app indexes content, it does not host it
* Media belongs to original sources
* Links are removed upon request
* Users are redirected to original sites

---

## Intended Audience

* Beginners learning full-stack web apps
* Solo developers
* Hobby projects
* Metadata indexing tools
* Research or archival browsing

---

## Future Enhancements (Optional)

* Tag aliases
* Tag implications
* Favorites
* Broken link detection
* User submissions (links only)
* Rate limiting

---

## Summary

This project demonstrates how to build a **modern, serverless web app** using:

* GitHub
* Supabase
* Netlify

while remaining **simple, fast, and low-cost**, by **never storing media files** and relying entirely on **external links**.
