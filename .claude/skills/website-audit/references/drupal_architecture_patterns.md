# Drupal Architecture Patterns Reference

This document provides a comprehensive reference for mapping website features to Drupal architecture components.

## Core Drupal Entity Types

### 1. Content Types (node types)

**Purpose:** Primary content entities representing major content structures.

**When to use:**
- Pages that need to be listed, searched, or categorized
- Content with distinct workflows (draft/published)
- Content that needs revisions
- Content with specific URL patterns

**Common patterns:**
- **Landing Page** - Hero + flexible paragraph-based content
- **Article/Blog Post** - Title, body, image, categories, tags, author, date
- **News** - Similar to Article but with different taxonomy/display
- **Event** - Date/time, location (address field), registration
- **Page** - Basic page with flexible content
- **Person/Profile** - Team member, author, speaker profiles
- **Product** - E-commerce or service showcase
- **Case Study/Project** - Portfolio items with categories
- **FAQ** - Question/answer pairs (can also be Paragraph)
- **Testimonial** - Quote, author, metadata (can also be Paragraph)

**Estimation factors:**
- Base content type: 2-4 hours
- +2-4 hours per taxonomy reference field
- +1-2 hours per entity reference field
- +4-8 hours for complex workflows
- +2-4 hours per custom view mode
- +4-8 hours for advanced permissions

### 2. Paragraph Types

**Purpose:** Modular, reusable content components within nodes.

**When to use:**
- Flexible page layouts
- Reusable content blocks
- Content that shouldn't be standalone entities
- Components that can be nested or reordered

**Common patterns:**

#### Layout Paragraphs
- **Section/Container** - Wrapper with background, spacing, width controls
- **Columns/Grid** - Multi-column layouts (2-col, 3-col, 4-col)
- **Sidebyside** - Left/right content areas
- **Accordion** - Collapsible content sections
- **Tabs** - Tabbed content areas

#### Content Paragraphs
- **Text** - Rich text with WYSIWYG
- **Heading** - Styled headings with hierarchy
- **Image** - Single image with caption
- **Gallery** - Multiple images (grid, slider, lightbox)
- **Video** - Embedded or uploaded video
- **Audio** - Audio player
- **Quote/Blockquote** - Pull quotes, testimonials
- **Call-to-Action (CTA)** - Button/link with text
- **Hero** - Large banner with image/video + text + CTA

#### Interactive Paragraphs
- **Carousel/Slider** - Nested items in slideshow
- **Timeline** - Chronological content display
- **Pricing Table** - Service/product pricing
- **Statistics/Counter** - Animated numbers
- **Map** - Embedded maps (Google, OSM)
- **Form** - Webform integration

#### Advanced Paragraphs
- **Card** - Compact content block (title, image, text, link)
- **Card Grid** - Multiple cards in grid layout
- **Feature Grid** - Icons + text in grid
- **Team Grid** - Person entity references in grid
- **Logo Grid** - Partner/client logos
- **News/Blog Grid** - Referenced nodes in grid
- **Views** - Embedded view displays
- **Block Reference** - Embed any Drupal block
- **Custom Code** - Embed HTML/JS (use cautiously)

**Estimation factors:**
- Simple text paragraph: 1-2 hours
- Image/media paragraph: 2-3 hours
- Layout paragraph (columns): 3-4 hours
- Complex paragraph (carousel, accordion): 4-8 hours
- Nested paragraph support: +2-4 hours
- Custom styling/theming: +2-6 hours per paragraph

**Best practices:**
- Use `adesso_paragraph_section` pattern for common fields (theme, width, spacing)
- Keep paragraphs focused and single-purpose
- Use entity references instead of duplicating content
- Document allowed paragraph types per content type

### 3. Taxonomies (Vocabularies)

**Purpose:** Classification and organization of content.

**When to use:**
- Categories that apply to multiple content types
- Filtering/faceting content
- Tagging system
- Hierarchical classification

**Common patterns:**
- **Categories** - Primary classification (News Categories, Product Categories)
- **Tags** - Folksonomy tagging (free-tagging)
- **Topics** - Subject matter organization
- **Authors** - Content attribution (alternative to User references)
- **Locations** - Geographic organization
- **Industries/Sectors** - Business classification
- **Technologies** - Technical classification
- **Status/Phase** - Project/content lifecycle
- **Difficulty/Level** - Content complexity (Beginner, Advanced)

**Estimation factors:**
- Simple vocabulary: 1-2 hours
- Hierarchical vocabulary: 2-4 hours
- Vocabulary with custom fields: +2-4 hours
- Term reference displays: +1-2 hours per view
- Faceted search integration: +4-8 hours

**Best practices:**
- Use hierarchical vocabularies sparingly (performance impact)
- Consider if taxonomy or content type is more appropriate
- Plan vocabulary structure before creating terms
- Use term reference fields for categorization
- Implement access controls for controlled vocabularies

### 4. Media Types

**Purpose:** Reusable media assets (images, videos, documents, audio).

**When to use:**
- Media that will be reused across multiple nodes
- Media that needs metadata (captions, credits, alt text)
- Media that requires management (library, permissions)
- Remote media (YouTube, Vimeo, external images)

**Common patterns:**
- **Image** - Standard images with focal point, alt text, credit
- **Document** - PDFs, DOCs, spreadsheets for download
- **Audio** - MP3, WAV files with player
- **Video** - Uploaded MP4 or remote (YouTube, Vimeo)
- **Remote Video** - YouTube/Vimeo embed
- **SVG** - Vector graphics
- **Icon** - Icon library integration (Lucide, Font Awesome)

**Estimation factors:**
- Standard media type (Image, Document): 1-2 hours
- Remote media type (YouTube, Vimeo): 2-4 hours
- Custom media type with fields: 3-4 hours
- Focal point/cropping integration: +2-4 hours
- Media library customization: +4-8 hours

**Best practices:**
- Always use Media entities, never plain file fields
- Configure image styles for all display contexts
- Use focal point module for responsive images
- Implement lazy loading for performance
- Set file upload limits and validation

### 5. Blocks

**Purpose:** Reusable content chunks placed in regions.

**When to use:**
- Site-wide elements (footer, header, sidebars)
- Content that appears on multiple pages
- Dynamic content (recent posts, social feeds)
- Custom functionality (search, login, shopping cart)

**Common patterns:**
- **Custom Block (Content Block)** - Simple reusable content
- **View Blocks** - Dynamic content lists
- **Webform Blocks** - Embedded forms
- **Menu Blocks** - Navigation
- **Search Block** - Search interface
- **Social Media Block** - Social links/feeds
- **Newsletter Block** - Email signup
- **Contact Block** - Quick contact info

**Estimation factors:**
- Simple custom block: 1-2 hours
- View block: 2-4 hours
- Block placement/visibility: +1-2 hours
- Block styling: +1-3 hours

### 6. Views

**Purpose:** Content queries and displays (lists, grids, tables, feeds).

**When to use:**
- Listing content (news, events, products)
- Search results
- User-facing content displays
- Admin interfaces
- Data exports (CSV, JSON, RSS)

**Common patterns:**

#### Display Types
- **Page** - Standalone URL
- **Block** - Embeddable in regions or paragraphs
- **Feed** - RSS/Atom/JSON
- **Attachment** - Attached to another display
- **Entity Reference** - For autocomplete fields

#### View Styles
- **Unformatted List** - Simple list
- **Grid** - Multi-column grid
- **Table** - Sortable data table
- **Carousel** - Sliding display
- **Calendar** - Event calendar
- **Map** - Geographic display

#### Common Views
- **Recent Content** - Latest articles/news/blog posts
- **Upcoming Events** - Filtered by date
- **Team Directory** - Person content type listing
- **Project Portfolio** - Case studies/projects with filters
- **Search Results** - Full-text search display
- **Admin Content List** - Enhanced content management
- **Related Content** - Contextual filters based on taxonomy
- **Archive** - Date-based content archives

**Estimation factors:**
- Basic view (single display): 2-4 hours
- View with filters/sorting: +2-4 hours
- Contextual filters: +2-4 hours
- Exposed filters: +2-4 hours
- Custom styling: +2-6 hours
- Ajax/pagination: +2-4 hours
- Relationships (joins): +2-4 hours per relationship
- Aggregation: +2-4 hours

**Best practices:**
- Enable caching (query cache + render cache)
- Limit items per page for performance
- Use contextual filters instead of exposed filters when possible
- Use relationships sparingly (performance)
- Create separate displays instead of complex conditional logic

### 7. Webforms

**Purpose:** User input forms (contact, registration, surveys, applications).

**When to use:**
- Contact forms
- Registration/application forms
- Surveys and questionnaires
- Lead generation
- File uploads from users
- Multi-step forms

**Common patterns:**
- **Contact Form** - Name, email, message
- **Newsletter Signup** - Email, preferences
- **Quote Request** - Service inquiry with details
- **Job Application** - File upload, personal info
- **Event Registration** - Attendee details, payment
- **Survey/Feedback** - Rating scales, checkboxes
- **Support Ticket** - Issue reporting

**Estimation factors:**
- Simple form (3-5 fields): 2-4 hours
- Medium form (6-15 fields): 4-8 hours
- Complex form (16+ fields, conditionals): 8-16 hours
- File uploads: +2-4 hours
- Multi-step form: +4-8 hours
- Custom validation: +2-4 hours
- Email notifications: +1-2 hours per recipient
- Database integration: +4-8 hours
- Payment integration: +8-16 hours

**Best practices:**
- Use Webform module, not custom code
- Implement SPAM protection (CAPTCHA, honeypot)
- Configure email handlers for notifications
- Set up confirmation pages/emails
- Test thoroughly on all devices

## Advanced Patterns

### 8. Custom Modules

**When to create custom modules:**
- Business logic that doesn't fit in configuration
- Custom integrations (APIs, external services)
- Complex calculations or data processing
- Security/access control logic
- Custom field types or widgets
- Batch operations or migrations

**Estimation factors:**
- Simple custom module (basic functionality): 8-16 hours
- Medium module (services, plugins, forms): 16-40 hours
- Complex module (integrations, advanced logic): 40-100+ hours

### 9. Theme Components (SDC)

**Purpose:** Reusable UI components with templates and styling.

**Common patterns:**
- **Layout Components** - Header, footer, navigation, sidebar
- **Content Components** - Article teasers, cards, hero sections
- **Interactive Components** - Accordions, tabs, modals, carousels
- **Form Components** - Custom form elements, buttons
- **Media Components** - Image galleries, video players

**Estimation factors:**
- Simple component: 2-4 hours
- Medium component: 4-8 hours
- Complex component: 8-16 hours
- Storybook integration: +1-2 hours per component

## Migration Considerations

### Content Migration Complexity

**Simple (1x multiplier):**
- Plain text fields
- Simple taxonomy mapping
- Basic image migration
- Existing structured data

**Medium (2x multiplier):**
- HTML cleanup required
- Complex taxonomy restructuring
- Mixed content types → paragraphs
- Media library organization
- User migration with roles

**Complex (3-4x multiplier):**
- Custom scrapers/parsers needed
- Legacy database with no exports
- Significant content restructuring
- Multiple source systems
- File system cleanup/organization
- Custom field type conversions

### Migration Effort Formula

```
Base migration setup: 20-40 hours

Per content type:
- Simple content (100 nodes): 8-12 hours
- Medium content (100 nodes): 12-20 hours
- Complex content (100 nodes): 20-40 hours

Per custom transformation:
- Field mapping: 2-4 hours
- Content restructuring: 4-8 hours
- Custom parsing logic: 8-16 hours
```

## Performance Optimization Patterns

### Caching Strategy
- Cache tags on all render arrays
- BigPipe for below-fold content
- Dynamic Page Cache configuration
- View caching (query + render)

### Query Optimization
- Database indexes for custom queries
- Entity query preloading (avoid N+1)
- Lazy loading for large datasets
- Views caching

### Asset Management
- CSS/JS aggregation
- Image styles (responsive)
- Lazy loading images
- Library dependencies

**Estimation:**
- Performance audit: 4-8 hours
- Implementation: 8-16 hours
- Testing: 4-8 hours

## Accessibility Patterns

### WCAG 2.1 Level AA Compliance
- Semantic HTML
- Proper heading hierarchy
- Alt text for all images
- Keyboard navigation
- Focus indicators
- Color contrast
- Form labels and errors
- ARIA attributes

**Estimation:**
- Accessibility audit: 4-8 hours
- Implementation: 16-32 hours
- Testing: 8-16 hours

## Security Patterns

### Input/Output
- Sanitize user input
- Render arrays for HTML output
- Form validation
- Access control checks

### Best Practices
- Regular security updates
- Permission auditing
- OWASP Top 10 awareness
- Security testing

**Estimation:**
- Security audit: 8-16 hours
- Implementation: 16-32 hours
- Testing: 8-16 hours

## Estimation Summary Table

| Component | Simple | Medium | Complex |
|-----------|--------|--------|---------|
| Content Type | 2-4h | 4-8h | 8-16h |
| Paragraph Type | 1-2h | 3-4h | 4-8h |
| Taxonomy | 1-2h | 2-4h | 4-8h |
| Media Type | 1-2h | 2-4h | 4-8h |
| View | 2-4h | 4-8h | 8-16h |
| Webform | 2-4h | 4-8h | 8-16h |
| Block | 1-2h | 2-4h | 4-8h |
| Custom Module | 8-16h | 16-40h | 40-100h+ |
| Theme Component | 2-4h | 4-8h | 8-16h |
| Migration (per 100 nodes) | 8-12h | 12-20h | 20-40h |

## Complexity Multipliers

Apply these multipliers to base estimates:

- **Testing Requirements:** +20-30%
- **Documentation:** +10-15%
- **Storybook Integration:** +10-15%
- **Multilingual:** +30-50%
- **Advanced Permissions:** +20-30%
- **Custom Integrations:** +50-100%
- **High Security Requirements:** +30-50%
