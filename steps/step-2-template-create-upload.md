# Step 2: Backend Template Creation and Zip Upload

## Goal

Implement the first real backend behavior:

- create a template record
- upload a zip file
- store the zip in Supabase Storage
- connect upload flow to the frontend

Do not extract the zip yet.

Do not scan files yet.

Do not generate preview yet.

## Backend Stack

Use:

- Fastify
- TypeScript
- Prisma
- PostgreSQL
- Supabase Storage

Do not implement Redis, BullMQ, or Docker worker yet in this step.

## Prisma Schema

Create this Prisma model:

```prisma
model Template {
  id              String         @id @default(cuid())
  name            String
  originalZipUrl  String?
  generatedZipUrl String?
  previewUrl      String?
  status          TemplateStatus @default(DRAFT)

  detectedTexts   Json?
  detectedColors  Json?
  replacements    Json?

  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

enum TemplateStatus {
  DRAFT
  UPLOADED
  PROCESSING
  READY
  FAILED
  GENERATED
}
```

Run the Prisma migration.

## Environment Variables

Add these backend environment variables:

```env
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=
```

Use the service role key only on the backend.

Never expose it to the frontend.

## API Routes

Create these routes:

```txt
POST /api/templates
POST /api/templates/:id/upload
GET  /api/templates/:id
```

## POST /api/templates

Create a new template record.

Request body:

```json
{
  "name": "Operation Management Template"
}
```

Response:

```json
{
  "id": "template_id",
  "name": "Operation Management Template",
  "status": "DRAFT"
}
```

Validation:

- name is required
- name must not be empty
- trim whitespace

## POST /api/templates/:id/upload

Accept multipart form data.

File field name:

```txt
file
```

Validation:

- only allow `.zip`
- reject files larger than `20MB`
- reject missing file
- reject if template does not exist

After successful upload:

1. Upload the zip to Supabase Storage.
2. Store it under a path like:

```txt
templates/{templateId}/original.zip
```

3. Update the template record:

```txt
status = UPLOADED
originalZipUrl = uploaded file URL
```

4. Return the updated template.

## GET /api/templates/:id

Return one template by id.

Response example:

```json
{
  "id": "template_id",
  "name": "Operation Management Template",
  "originalZipUrl": "https://storage-url/original.zip",
  "generatedZipUrl": null,
  "previewUrl": null,
  "status": "UPLOADED",
  "detectedTexts": null,
  "detectedColors": null,
  "replacements": null,
  "createdAt": "date",
  "updatedAt": "date"
}
```

## Frontend Integration

Update `/templates/create`.

When the user enters a template name and uploads a zip:

1. Call `POST /api/templates`
2. Call `POST /api/templates/:id/upload`
3. Store the returned `templateId` in component state
4. Display the uploaded filename inside the dashed upload box

Example display:

```txt
operation-management-system.zip
```

## UI Behavior

The Upload button should open a file picker.

The drag-and-drop box should also accept dropped `.zip` files.

Show basic states:

- idle
- uploading
- uploaded
- failed

Show a simple error message if upload fails.

## Acceptance Criteria

This step is complete when:

- user can enter a template name
- user can upload a zip
- backend creates a Template row
- zip is stored in Supabase Storage
- template status becomes `UPLOADED`
- frontend displays the uploaded file name
