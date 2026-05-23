# Step 1: Project Setup and Basic Layout

## Goal

Build the initial MVP shell for the Template Builder app.

This step should only create:

- the frontend project setup
- the backend project setup
- the create-template page layout
- no upload logic yet
- no database logic yet
- no preview logic yet

## Tech Stack

### Frontend

Use:

- React
- TypeScript
- Tailwind CSS
- Vite

### Backend

Prepare the backend project using:

- Fastify
- TypeScript
- Prisma
- PostgreSQL
- Redis
- BullMQ
- Supabase Storage
- Docker worker

For this step, only set up the backend folder structure. Do not implement full backend behavior yet.

## Frontend Route

Create this page:

`/templates/create`

## Page Layout

Create a two-column layout.

The full page should be inside one main bordered container.

Container style:

- full desktop width
- rounded corners
- border
- white background
- overflow hidden
- minimum height around 700px

Layout:

- left panel: 40%
- right panel: 60%
- vertical divider between panels

## Left Panel Content

The left panel should contain the create-template form.

### Heading

Show:

`Create Template`

### Template Name Field

Show label:

`Template name`

Then show one text input.

### Template Code Section

Show label:

`Template code`

Then show two buttons side by side:

`Upload`

`Paste code`

For this step, the buttons do not need to work yet.

### Upload Box

Below the buttons, show a dashed upload box.

Default text:

`Drag/Drop zip file`

## Right Panel Content

The right panel should contain the preview area.

### Heading

Show:

`Preview`

Below the heading, show an empty preview area.

For now, do not render an iframe.

## Styling Requirements

Use Tailwind CSS.

The UI should match this style:

- simple black and white wireframe
- clean spacing
- rounded borders
- no complex colors
- no animations yet
- no external UI library required

## Suggested Frontend Structure

Use this structure:

`frontend/src/pages/templates/CreateTemplatePage.tsx`

`frontend/src/components/templates/TemplateForm.tsx`

`frontend/src/components/templates/TemplatePreview.tsx`

`frontend/src/components/ui/Button.tsx`

`frontend/src/components/ui/Input.tsx`

## Suggested Backend Structure

Create this structure:

`backend/src/app.ts`

`backend/src/server.ts`

`backend/src/modules/templates/templates.routes.ts`

`backend/src/modules/templates/templates.service.ts`

`backend/src/lib/prisma.ts`

`backend/src/lib/env.ts`

Do not implement the actual template logic yet.

## Acceptance Criteria

This step is complete when:

- frontend app runs
- backend app runs
- `/templates/create` page exists
- two-column UI exists
- left panel has template form UI
- right panel has preview heading
- no upload functionality is implemented yet
