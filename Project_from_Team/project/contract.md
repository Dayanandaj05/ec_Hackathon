# Mini Google Drive — API Contract

**Stack:** Node.js, Express, MongoDB (Mongoose), Multer, Vanilla HTML/CSS/JS  
**Server:** http://localhost:3000  
**Uploads Directory:** /uploads/

---

## Standard Response Shapes

Every single route uses one of these two shapes, no exceptions.

### Success Response
```json
{
  "success": true,
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "error": "Human readable error message"
}
```

---

## Object Shapes

### File Object
```json
{
  "id": "MongoDB ObjectId as string",
  "originalName": "photo.jpg",
  "mimeType": "image/jpeg",
  "size": 204800,
  "folderId": null,
  "shareToken": null,
  "createdAt": "2025-01-01T00:00:00Z"
}
```

### Folder Object
```json
{
  "id": "MongoDB ObjectId as string",
  "name": "Documents",
  "parentId": null
}
```

### Quota Object
```json
{
  "used": 20971520,
  "limit": 52428800
}
```

**Note:** All quota values are in bytes. Display conversion to MB is handled by the frontend only.

---

## Test Users

Seeded into DB at startup via `seed.js`:

| Username | Password | Quota Limit |
|----------|----------|-------------|
| alice    | pass1    | 52428800 (50MB) |
| bob      | pass2    | 52428800 (50MB) |

---

## API Routes (Complete & Frozen)

### AUTH

#### POST /api/login
```
Request body:  { "username": "alice", "password": "pass1" }
Response data: { "userId": "...", "username": "alice" }
```

#### POST /api/logout
```
Response data: { "message": "Logged out" }
```

---

### FILES

#### POST /api/upload
```
Content-Type:  multipart/form-data
File field:    "file"
Body fields:   { "userId": "...", "folderId": null }
Response data: File object
```

#### GET /api/download/:fileId
```
Response: file stream (triggers browser download)
Error:    { "success": false, "error": "File not found" }
```

#### DELETE /api/files/:fileId
```
Response data: { "message": "File deleted" }
```

#### PATCH /api/files/:fileId/move
```
Request body:  { "targetFolderId": "MongoDB ObjectId or null" }
Response data: updated File object
```

---

### FOLDERS

#### POST /api/folders
```
Request body:  { "name": "Documents", "parentId": null }
Response data: Folder object
```

#### GET /api/folders/:folderId
```
URL param "root" for root level (maps to parentId: null in DB)
Response data: { "folders": [Folder objects], "files": [File objects] }
```

---

### SHARE

#### POST /api/files/:fileId/share
```
Response data: { "shareUrl": "/api/share/<token>" }
Note: Full URL for display = "http://localhost:3000" + shareUrl
```

#### GET /api/share/:token
```
Authentication: NOT required
Response: file stream (triggers browser download)
Error:    { "success": false, "error": "Invalid or expired link" }
```

---

### QUOTA

#### GET /api/quota?userId=
```
Response data: Quota object
```

---

### SEARCH

#### GET /api/search?q=&userId=
```
Search scope:  originalName field, case-insensitive
Response data: { "files": [File objects] }
```

---

## Middleware Order for Upload Route

Must be followed exactly:

1. `authMiddleware` (from middleware/auth.js)
2. `checkQuota` (from middleware/quota.js)
3. `multerUpload` (Multer handles file save to disk)
4. Route handler (saves metadata to DB)

---

## File Ownership Map

**Do not edit files outside your ownership:**

| Owner | Responsibility |
|-------|-----------------|
| M1 Backend Lead | server.js, routes/files.js, /uploads/ |
| M2 Database | models/User.js, models/File.js, models/Folder.js, middleware/quota.js, routes/quota.js, routes/search.js, seed.js |
| M3 Auth & Share | middleware/auth.js, routes/folders.js, routes/share.js |
| M4 Frontend | public/index.html, public/style.css, public/app.js |

---

## Rules

- **Frozen Contract:** This file is read-only after Hour 1. No changes without full team agreement.
- **Unilateral Changes Prohibited:** No route, field name, or response shape may be changed by a single team member.
- **Backend-First Contract:** If a backend route returns a different shape than specified here, fix the backend. Do not adapt the frontend.
- **Byte-Based Units:** All amounts, sizes, and quotas are stored and returned in bytes.
- **Root Convention:** The string `"root"` is the URL convention for root-level folder navigation.
- **Multer Field Name:** Always `"file"`. This never changes.
- **Session Management:** Session cookie is set automatically by express-session. Frontend does not manage tokens manually.
