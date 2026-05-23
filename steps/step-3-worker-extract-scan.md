# Step 3: Worker Extraction and Detection

## Goal

Implement background processing after upload.

The worker should:

1. download the uploaded zip
2. extract it safely
3. ignore unsafe files
4. scan source files
5. detect editable texts
6. detect colors
7. save detected values to PostgreSQL

## Stack

Use:

- Redis
- BullMQ
- Docker worker
- Fastify API
- Prisma
- Supabase Storage

## Queue

Create a BullMQ queue named:

```txt
template-processing
```

Create a job named:

```txt
scan-template
```

Job payload:

```json
{
  "templateId": "template_id",
  "zipUrl": "https://storage-url/original.zip"
}
```

## Backend Behavior After Upload

After `POST /api/templates/:id/upload` succeeds:

1. update template status to `PROCESSING`
2. enqueue `scan-template`
3. return the updated template

## Worker Responsibilities

The worker must process the uploaded template in an isolated temporary directory.

Steps:

1. Create temporary work directory.
2. Download zip from Supabase Storage.
3. Extract zip.
4. Apply ignore rules.
5. Scan allowed files.
6. Detect texts.
7. Detect colors.
8. Save results to database.
9. Cleanup temporary directory.

## Ignore Rules

Always ignore these:

```txt
node_modules
.git
.env
.env.local
.env.production
dist
build
.next
.vercel
.ssh
*.pem
*.key
*.exe
*.dll
*.so
package-lock.json
pnpm-lock.yaml
yarn.lock
```

Also respect `.gitignore` if it exists in the uploaded project.

Do not rely only on `.gitignore`.

The denylist above always wins.

## Allowed Scan File Types

Only scan files with these extensions:

```txt
.ts
.tsx
.js
.jsx
.html
.css
.scss
.json
.md
```

Do not scan binary files.

Skip files larger than `1MB`.

## Text Detection Rules

Detect likely user-facing strings from:

- double quoted strings
- single quoted strings
- template string literals
- HTML text nodes

Examples that should be detected:

```txt
Operation Management
Monitor, track, and manage safety operations with real-time data and comprehensive reporting tools.
Get Started
Dashboard
Sign In
```

Ignore:

- strings shorter than 3 characters
- import paths
- URLs
- package names
- className values
- environment variable names
- random IDs
- file paths
- Tailwind class strings
- strings with mostly symbols

Return detected texts like this:

```json
[
  {
    "id": "text_1",
    "value": "Operation Management",
    "occurrences": 4
  },
  {
    "id": "text_2",
    "value": "Monitor, track, and manage safety operations with real-time data and comprehensive reporting tools.",
    "occurrences": 1
  }
]
```

## Color Detection Rules

Detect these color formats:

```txt
#000
#000000
#ffffff
rgb(0, 0, 0)
rgba(0, 0, 0, 0.5)
hsl(0, 0%, 100%)
```

Return detected colors like this:

```json
[
  {
    "id": "color_1",
    "value": "#000000",
    "occurrences": 12
  },
  {
    "id": "color_2",
    "value": "#ffffff",
    "occurrences": 8
  }
]
```

Normalize hex colors to lowercase.

Example:

```txt
#FFFFFF -> #ffffff
```

## Database Update

If scanning succeeds, update the template:

```txt
status = READY
detectedTexts = detected texts JSON
detectedColors = detected colors JSON
```

If scanning fails, update the template:

```txt
status = FAILED
```

## API Route

Create this route:

```txt
GET /api/templates/:id/detected-values
```

Response:

```json
{
  "texts": [
    {
      "id": "text_1",
      "value": "Operation Management",
      "occurrences": 4
    }
  ],
  "colors": [
    {
      "id": "color_1",
      "value": "#000000",
      "occurrences": 12
    }
  ]
}
```

## Frontend Integration

After upload, poll:

```txt
GET /api/templates/:id
```

Poll every `1500ms`.

When status becomes `READY`, call:

```txt
GET /api/templates/:id/detected-values
```

Then display two sections:

```txt
RENAME TEXTS
COLORS
```

## Rename Texts UI

Show fields:

```txt
From
To
+
```

When user enters a `From` value, check if it exists in detected texts.

If it exists, show:

```txt
✓ FOUND
```

If it does not exist, show:

```txt
Not found
```

Do not save replacements yet.

## Colors UI

Display detected colors as inputs.

Example:

```txt
#000000 [color picker]
#ffffff [color picker]
```

Do not save color replacements yet.

## Acceptance Criteria

This step is complete when:

- upload queues a scan job
- worker extracts the zip
- worker detects texts
- worker detects colors
- results are saved to database
- frontend displays detected texts and colors
