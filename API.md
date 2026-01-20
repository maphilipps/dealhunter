# API Documentation

This document describes all API endpoints available in Dealhunter.

## Base URL

- **Development:** `http://localhost:3000/api`
- **Production:** `https://your-domain.vercel.app/api`

## Authentication

All API endpoints (except `/auth/*`) require authentication via NextAuth.js session cookies.

### Authentication Endpoints

#### POST `/api/auth/signin`

Login with email and password.

**Request:**
```json
{
  "email": "user@adesso.de",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user-id",
    "email": "user@adesso.de",
    "name": "User Name",
    "role": "admin"
  }
}
```

#### POST `/api/auth/signout`

Logout current user.

**Response:** Redirects to login page

---

## RFP Endpoints

### File Upload

#### POST `/api/submit`

Upload RFP document (PDF, DOCX, TXT) or paste text.

**Headers:**
```
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: File upload (optional)
- `text`: Raw text (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "rfp-id",
    "title": "Extracted title",
    "description": "Extracted description",
    "status": "pending_extraction",
    "createdAt": "2024-01-20T10:00:00Z"
  }
}
```

### Extraction

#### GET `/api/rfps/[id]/extraction/stream`

Stream AI extraction process using Server-Sent Events (SSE).

**Response:** SSE stream with events:

```typescript
// Event types
type ExtractionEvent =
  | { type: 'agent-start', data: { agentName: string } }
  | { type: 'agent-thinking', data: { thought: string } }
  | { type: 'tool-call', data: { toolName: string, args: any } }
  | { type: 'tool-result', data: { toolName: string, result: any } }
  | { type: 'agent-complete', data: { result: any } }
  | { type: 'error', data: { message: string } }
```

**Example Event:**
```
event: agent-thinking
data: {"thought":"Extracting company name..."}

event: tool-result
data: {"toolName":"extractCompany","result":"ACME Corp"}

event: agent-complete
data: {"result":{"company":"ACME Corp","budget":250000}}
```

### Quick Scan

#### GET `/api/rfps/[id]/quick-scan/stream`

Stream Quick Scan analysis (tech stack detection, BU matching).

**Response:** SSE stream (same format as extraction)

**Final Event Data:**
```json
{
  "result": {
    "technologies": ["Drupal", "React", "PostgreSQL"],
    "businessLine": "Banking & Insurance",
    "confidence": 0.92,
    "reasoning": "Strong match based on tech stack..."
  }
}
```

### BIT Evaluation

#### GET `/api/rfps/[id]/evaluate/stream`

Stream BIT/NO BIT evaluation with multi-agent analysis.

**Response:** SSE stream with sub-agent events

**Agents:**
- Capability Agent (tech fit)
- Competition Agent (market analysis)
- Deal Quality Agent (commercial viability)
- Legal Agent (contract risks)
- Reference Agent (similar projects)
- Strategic Fit Agent (alignment)

**Final Event Data:**
```json
{
  "result": {
    "recommendation": "BIT",
    "confidence": 0.85,
    "scores": {
      "capability": 0.9,
      "competition": 0.7,
      "dealQuality": 0.85,
      "legal": 0.95,
      "reference": 0.8,
      "strategicFit": 0.88
    },
    "reasoning": "...",
    "risks": ["Risk 1", "Risk 2"]
  }
}
```

### Deep Analysis

#### POST `/api/rfps/[id]/deep-analysis/trigger`

Trigger background deep analysis job (Inngest).

**Response:**
```json
{
  "success": true,
  "jobId": "inngest-job-id"
}
```

#### GET `/api/rfps/[id]/deep-analysis/status`

Check deep analysis job status.

**Response:**
```json
{
  "status": "running" | "completed" | "failed",
  "progress": 0.65,
  "currentStep": "Analyzing tech stack"
}
```

#### GET `/api/rfps/[id]/deep-analysis/results`

Get deep analysis results.

**Response:**
```json
{
  "techStack": {
    "detected": ["Drupal 10", "React 18"],
    "confidence": 0.92
  },
  "company": {
    "name": "ACME Corp",
    "valuation": "$50M",
    "leadership": [...]
  },
  "digitalMaturity": {
    "score": 0.75,
    "factors": [...]
  }
}
```

### Business Unit Matching

#### POST `/api/rfps/[id]/bu-matching`

Match RFP to Business Unit.

**Request:**
```json
{
  "technologies": ["Drupal", "React"],
  "industry": "Banking",
  "requirements": "..."
}
```

**Response:**
```json
{
  "businessUnit": {
    "id": "bu-id",
    "name": "Banking & Insurance",
    "confidence": 0.88
  },
  "alternatives": [
    { "id": "bu-id-2", "name": "Technology & Innovation", "confidence": 0.65 }
  ]
}
```

### Visualization

#### GET `/api/rfps/[id]/visualization`

Generate AI-powered visualization using json-render.

**Query Parameters:**
- `type`: Visualization type (optional)
- `data`: Data key to visualize (optional)

**Response:**
```json
{
  "jsonRender": {
    "type": "Catalog",
    "blocks": [
      {
        "component": "shadcn/chart-pie",
        "props": {
          "title": "Tech Stack Distribution",
          "data": [...]
        }
      }
    ]
  }
}
```

### CMS Matrix

#### GET `/api/rfps/[id]/cms-matrix/stream`

Stream CMS comparison matrix generation.

**Response:** SSE stream

**Final Event Data:**
```json
{
  "matrix": [
    {
      "feature": "Multi-site Management",
      "drupal": true,
      "typo3": true,
      "aem": true,
      "weight": 0.9
    }
  ]
}
```

### Facts Visualization

#### GET `/api/rfps/[id]/facts-visualization`

Generate facts visualization from Quick Scan data.

**Response:**
```json
{
  "facts": [
    { "label": "Budget", "value": "$250,000", "confidence": 0.92 },
    { "label": "Deadline", "value": "Q2 2024", "confidence": 0.85 }
  ]
}
```

---

## Admin Endpoints

### Technologies

#### GET `/api/admin/technologies/[id]`

Get technology details.

**Response:**
```json
{
  "id": "tech-id",
  "name": "Drupal",
  "category": "CMS",
  "baselines": [...]
}
```

#### POST `/api/admin/technologies/[id]/research`

Trigger technology research (web scraping, docs analysis).

**Request:**
```json
{
  "url": "https://drupal.org/docs",
  "depth": 2
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "inngest-job-id"
}
```

#### POST `/api/admin/technologies/[id]/research-feature`

Research specific technology feature.

**Request:**
```json
{
  "feature": "Multi-site Management"
}
```

**Response:**
```json
{
  "found": true,
  "description": "...",
  "references": [...]
}
```

#### POST `/api/admin/technologies/[id]/review-features`

Review technology features with AI.

**Request:**
```json
{
  "features": ["Feature 1", "Feature 2"]
}
```

**Response:**
```json
{
  "reviews": [
    { "feature": "Feature 1", "score": 0.9, "notes": "..." }
  ]
}
```

#### POST `/api/admin/technologies/[id]/orchestrator`

Orchestrate technology research workflow.

**Request:**
```json
{
  "workflow": "full-research",
  "options": { "includeCompetitors": true }
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "inngest-job-id"
}
```

---

## Agent Endpoints

### Capabilities

#### GET `/api/agent/capabilities`

Get all available agent capabilities.

**Response:**
```json
{
  "agents": [
    {
      "name": "Quick Scan Agent",
      "capabilities": ["tech-detection", "bu-matching"],
      "models": ["gpt-4o-mini"]
    }
  ]
}
```

---

## Document Endpoints

### Download

#### GET `/api/documents/[id]/download`

Download uploaded document.

**Response:** File download with appropriate `Content-Type` header

---

## Slack Integration (Optional)

### Events

#### POST `/api/slack`

Slack event webhook endpoint.

**Security:** Requires `SLACK_SIGNING_SECRET` verification

**Supported Events:**
- `app_mention` - Bot mentioned in channel
- `message` - Direct message to bot

**Response:**
```json
{
  "ok": true
}
```

---

## Inngest (Background Jobs)

### Webhook

#### POST `/api/inngest`

Inngest webhook endpoint for background job execution.

**Security:** Requires `INNGEST_SIGNING_KEY` verification

**Jobs:**
- Deep Analysis
- Technology Research
- Email Notifications
- Batch Processing

---

## Error Responses

All endpoints use consistent error format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": { ... }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

### Error Codes

- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `VALIDATION_ERROR` - Invalid input
- `NOT_FOUND` - Resource not found
- `RATE_LIMIT` - Too many requests
- `INTERNAL_ERROR` - Server error

---

## Rate Limiting

**Not implemented yet.** Future versions will implement rate limiting:

- 100 requests/minute per user
- 1000 requests/hour per IP
- Special limits for AI endpoints (10/minute)

---

## Webhooks

### RFP Events

Subscribe to RFP lifecycle events (future feature):

**Events:**
- `rfp.created`
- `rfp.extracted`
- `rfp.quick_scan_complete`
- `rfp.evaluation_complete`
- `rfp.assigned`

**Payload:**
```json
{
  "event": "rfp.evaluation_complete",
  "data": {
    "id": "rfp-id",
    "recommendation": "BIT",
    "confidence": 0.85
  },
  "timestamp": "2024-01-20T10:00:00Z"
}
```

---

## Server-Sent Events (SSE)

All streaming endpoints use SSE protocol:

### Connection

```javascript
const eventSource = new EventSource('/api/rfps/123/quick-scan/stream')

eventSource.addEventListener('agent-thinking', (event) => {
  const data = JSON.parse(event.data)
  console.log('Agent thinking:', data.thought)
})

eventSource.addEventListener('agent-complete', (event) => {
  const data = JSON.parse(event.data)
  console.log('Complete:', data.result)
  eventSource.close()
})

eventSource.addEventListener('error', (event) => {
  console.error('Error:', event)
  eventSource.close()
})
```

### Event Types

All streaming endpoints emit these standard events:

- `agent-start` - Agent started
- `agent-thinking` - Chain-of-thought step
- `tool-call` - Tool invoked
- `tool-result` - Tool result
- `agent-message` - Status message
- `agent-complete` - Agent finished
- `error` - Error occurred

---

## TypeScript SDK (Future)

Future versions will provide a TypeScript SDK:

```typescript
import { DealhunterClient } from '@dealhunter/sdk'

const client = new DealhunterClient({
  baseUrl: 'https://api.dealhunter.adesso.de',
  apiKey: process.env.DEALHUNTER_API_KEY,
})

// Create RFP
const rfp = await client.rfps.create({
  file: uploadFile,
})

// Stream Quick Scan
const stream = await client.rfps.quickScan(rfp.id)
for await (const event of stream) {
  console.log(event)
}

// Get evaluation
const evaluation = await client.rfps.getEvaluation(rfp.id)
```

---

## Examples

### Upload and Extract

```typescript
// Upload file
const formData = new FormData()
formData.append('file', file)

const response = await fetch('/api/submit', {
  method: 'POST',
  body: formData,
})

const { data } = await response.json()
const rfpId = data.id

// Stream extraction
const eventSource = new EventSource(`/api/rfps/${rfpId}/extraction/stream`)

eventSource.addEventListener('agent-complete', (event) => {
  const { result } = JSON.parse(event.data)
  console.log('Extracted:', result)
  eventSource.close()
})
```

### Quick Scan

```typescript
const eventSource = new EventSource(`/api/rfps/${rfpId}/quick-scan/stream`)

eventSource.addEventListener('agent-complete', (event) => {
  const { result } = JSON.parse(event.data)
  console.log('Technologies:', result.technologies)
  console.log('Business Line:', result.businessLine)
  eventSource.close()
})
```

### BIT Evaluation

```typescript
const eventSource = new EventSource(`/api/rfps/${rfpId}/evaluate/stream`)

// Track sub-agents
eventSource.addEventListener('agent-start', (event) => {
  const { agentName } = JSON.parse(event.data)
  console.log(`Starting: ${agentName}`)
})

eventSource.addEventListener('agent-complete', (event) => {
  const { result } = JSON.parse(event.data)
  console.log('Recommendation:', result.recommendation)
  console.log('Confidence:', result.confidence)
  eventSource.close()
})
```

---

## Security

### Authentication

All endpoints require NextAuth.js session except:
- `/api/auth/*` - Authentication endpoints
- `/api/inngest` - Verified via signing key
- `/api/slack` - Verified via signing secret

### CORS

CORS is disabled by default. Enable in `next.config.js` if needed:

```javascript
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
      ],
    },
  ]
}
```

### Rate Limiting

Implement rate limiting for production (recommended):

```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
})
```

---

## Support

For API questions or issues:
- Check [CONTRIBUTING.md](CONTRIBUTING.md) for development setup
- Review [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Contact adesso DevOps team
