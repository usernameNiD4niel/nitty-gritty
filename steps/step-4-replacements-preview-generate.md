# Step 4: Replacements, Preview, and Generate Code

## Goal

Complete the MVP behavior.

The user should be able to:

1. replace detected text
2. replace detected colors
3. preview the updated template
4. generate a modified zip
5. download the generated code

## API Routes

Create these routes:

```txt
PATCH /api/templates/:id/replacements
POST  /api/templates/:id/preview
POST  /api/templates/:id/generate
GET   /api/templates/:id/download
```

## Replacement Payload

Frontend sends this payload:

```json
{
  "texts": [
    {
      "from": "Operation Management",
      "to": "NACT"
    },
    {
      "from": "Monitor, track, and manage safety operations with real-time data and comprehensive reporting tools.",
      "to": "This is a sample text"
    }
  ],
  "colors": [
    {
      "from": "#000000",
      "to": "#111827"
    },
    {
      "from": "#ffffff",
      "to": "#f8fafc"
    }
  ]
}
```

## PATCH /api/templates/:id/replacements

Validate and save replacements into:

```txt
Template.replacements
```

Validation:

- `texts` is optional array
- `colors` is optional array
- every text replacement must have `from` and `to`
- every color replacement must have `from` and `to`
- do not allow empty `from`
- color values must be valid CSS colors for MVP-supported formats

Return the updated template.

## Replacement Logic

When applying replacements:

1. Download original zip.
2. Extract into temporary directory.
3. Apply ignore rules.
4. Scan allowed files.
5. Replace text values.
6. Replace color values.
7. Preserve original folder structure.
8. Create a new zip.
9. Upload generated zip to Supabase Storage.
10. Save generated zip URL to database.

Allowed replacement file types:

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

Do not replace content inside ignored files.

Do not modify binary files.

## Generate API

`POST /api/templates/:id/generate`

Behavior:

1. Load template from database.
2. Ensure original zip exists.
3. Ensure replacements exist.
4. Queue or run generation.
5. Create generated zip.
6. Upload generated zip to Supabase Storage.
7. Update template:

```txt
status = GENERATED
generatedZipUrl = uploaded generated zip URL
```

Response:

```json
{
  "id": "template_id",
  "status": "GENERATED",
  "downloadUrl": "https://storage-url/generated.zip"
}
```

## Download API

`GET /api/templates/:id/download`

Behavior:

- if generated zip exists, redirect to signed Supabase URL
- otherwise return `404`

## Preview API

`POST /api/templates/:id/preview`

Behavior:

1. Apply current replacements to a temporary copy.
2. Try to generate a preview.
3. Save preview URL to database.
4. Return preview URL.

## Preview Strategy

For MVP, use this order:

### 1. Static Build Preview

If `package.json` exists, try:

```bash
npm install
npm run build
```

Then serve output from one of:

```txt
dist
build
out
```

### 2. HTML Preview

If build fails but `index.html` exists, serve the modified `index.html`.

### 3. Placeholder Preview

If preview fails, return:

```txt
Preview unavailable. Generate code is still available.
```

## Docker Worker Safety

All preview and generation work must happen inside the worker.

Do not run uploaded code inside the API server.

Worker limits:

```txt
CPU: 1 core
Memory: 512MB
Timeout: 60 seconds
```

Use temporary directories.

Do not expose host filesystem.

Do not pass backend secrets into the container.

Network access:

- allowed only during `npm install`
- disabled during scanning and replacement

## Frontend Final UI

Update the left panel.

Show:

```txt
RENAME TEXTS
```

Fields:

```txt
From
To
+
```

When user clicks `+`:

1. check if `From` exists in detected texts
2. add replacement row
3. show found status if matched

Display rows:

```txt
Operation Management -> NACT
Monitor, track, and manage safety operations with real-time data and comprehensive reporting tools. -> This is a sample text
```

Show:

```txt
COLORS
```

Display detected colors as editable fields.

Example:

```txt
#000000 [color picker]
#ffffff [color picker]
...
```

Footer buttons:

```txt
Generate Code
Cancel
```

## Right Panel Preview

Render preview using iframe:

```tsx
<iframe
  src={previewUrl}
  className="w-full h-full border-0"
  title="Template preview"
/>
```

If preview is loading, show:

```txt
Generating preview...
```

If preview fails, show:

```txt
Preview unavailable.
```

## Button Behavior

### Generate Code

When clicked:

1. save replacements
2. call preview or generate endpoint
3. call generate endpoint
4. show download link when complete

### Cancel

Reset local form state.

Do not delete the template record in MVP.

## Acceptance Criteria

This step is complete when:

- user can add text replacements
- user can edit detected colors
- replacements are saved to backend
- preview iframe displays result when possible
- generated zip is created
- user can download generated zip
- all uploaded code processing happens in worker, not API server
